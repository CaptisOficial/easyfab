// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceSetup } from "./WorkspaceSetup";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  workspaceStatus: vi.fn(), configureWorkspace: vi.fn(), runningInTauri: vi.fn(),
  listLoginUsers: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn(),
  provisionInitialAdmin: vi.fn(), listUsers: vi.fn(), createUser: vi.fn(),
  setUserActive: vi.fn(), resetPassword: vi.fn(), projectsOverview: vi.fn(), createProject: vi.fn(),
}));
const workspace: api.WorkspaceInfo = {
  id: "synthetic", root: "C:\\synthetic\\FAB", path: "C:\\synthetic\\FAB\\easy-fab",
  data_dir: "C:\\synthetic\\FAB\\easy-fab\\data", docs_dir: "C:\\synthetic\\FAB\\easy-fab\\docs",
  contracts_dir: "contracts", software_dir: "software", exports_dir: "exports", backups_dir: "backups",
  executable: "C:\\synthetic\\FAB\\easy-fab\\software\\easyfab.exe",
};
const engineer: api.SessionUser = { id: "engineer", name: "Engineer Fixture", role: "engineer", must_change_password: false };
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.runningInTauri).mockReturnValue(true);
  vi.mocked(api.workspaceStatus).mockResolvedValue({ phase: "ready", workspace, candidate_root: "C:\\other-suggestion", message: null });
  vi.mocked(api.listLoginUsers).mockResolvedValue({ users: [engineer], requires_admin: false });
  vi.mocked(api.login).mockResolvedValue(engineer);
  vi.mocked(api.logout).mockResolvedValue();
  vi.mocked(api.projectsOverview).mockResolvedValue({ projects: [], leads: [], can_create: false, write_message: "Consulta los proyectos donde eres el ingeniero responsable." });
});

it("Engineer navega a sus proyectos en consulta y cierra sesión sin conservar la lista", async () => {
  const user = userEvent.setup();
  vi.mocked(api.projectsOverview).mockResolvedValue({ projects: [{ id: "PRJ-own", wbs: "FAB-OWN", name: "Asignado", process_area: "FAB", lead_engineer_id: engineer.id, start_date: "2026-10-29", target_date: "2026-11-01", status: "Not Started" }], leads: [{ id: engineer.id, name: engineer.name }], can_create: false, write_message: "Consulta los proyectos donde eres el ingeniero responsable." });
  render(<WorkspaceSetup />);
  await user.type(await screen.findByLabelText("Contraseña (8 caracteres)"), "User1234");
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
  await screen.findByText(engineer.name);
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Proyectos", exact: true }));
  expect(await screen.findByText("FAB-OWN · Asignado")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Guardar proyecto" })).toBeNull();
  expect(api.createProject).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  await screen.findByLabelText("Contraseña (8 caracteres)");
  expect(screen.queryByText("FAB-OWN · Asignado")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  expect(screen.queryByRole("button", { name: "Proyectos", exact: true })).toBeNull();
});

it("deja la carpeta fuera del área central y abre/cierra configuración sin reiniciar la captura", async () => {
  const user = userEvent.setup();
  render(<WorkspaceSetup />);
  const password = await screen.findByLabelText("Contraseña (8 caracteres)");
  await waitFor(() => expect((password as HTMLInputElement).disabled).toBe(false));
  await user.type(password, "draft");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText(workspace.root).closest("[hidden]")).toBeTruthy();
  const gear = screen.getByRole("button", { name: "Abrir menú" });
  await user.click(gear);
  const dialog = screen.getByRole("dialog", { name: "Menú de EasyFAB" });
  expect(within(dialog).getByRole("button", { name: "Configuración" })).toBeTruthy();
  expect(gear.getAttribute("aria-expanded")).toBe("true");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(gear);
  expect((password as HTMLInputElement).value).toBe("draft");
  expect(api.listLoginUsers).toHaveBeenCalledTimes(1);
  await user.click(gear);
  await user.click(screen.getByRole("dialog").parentElement!);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("muestra usuario y salida en topnav, consulta carpeta autenticado y conserva bloqueo de cambio", async () => {
  const user = userEvent.setup();
  render(<WorkspaceSetup />);
  const password = await screen.findByLabelText("Contraseña (8 caracteres)");
  await waitFor(() => expect((password as HTMLInputElement).disabled).toBe(false));
  await user.type(password, "User1234");
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
  const header = screen.getByRole("banner");
  expect(await within(header).findByText(engineer.name)).toBeTruthy();
  expect(within(header).getByText("Ingeniero")).toBeTruthy();
  expect(screen.queryByText(`Usuario EasyFAB: ${engineer.id}`)).toBeNull();
  await user.click(within(header).getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  expect(screen.getByText(workspace.root)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Cambiar carpeta compartida" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Cierra sesión para cambiar de espacio.")).toBeTruthy();
  await user.keyboard("{Escape}");
  const exit = within(header).getByRole("button", { name: "Cerrar sesión" });
  expect(screen.getAllByRole("button", { name: "Cerrar sesión" })).toHaveLength(1);
  await user.click(exit);
  await waitFor(() => expect(within(header).queryByText(engineer.name)).toBeNull());
  expect(api.logout).toHaveBeenCalledTimes(1);
  await screen.findByLabelText("Contraseña (8 caracteres)");
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  expect((screen.getByRole("button", { name: "Cambiar carpeta compartida" }) as HTMLButtonElement).disabled).toBe(false);
});

it("abre la configuración inicial y conecta el espacio seleccionado antes de mostrar acceso", async () => {
  const user = userEvent.setup();
  vi.mocked(api.workspaceStatus).mockResolvedValue({ phase: "unconfigured", workspace: null, candidate_root: "", message: null });
  vi.mocked(api.configureWorkspace).mockResolvedValue(workspace);
  render(<WorkspaceSetup />);
  await user.type(await screen.findByLabelText("Carpeta compartida corporativa"), workspace.root);
  expect(screen.queryByLabelText("Contraseña (8 caracteres)")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Crear o abrir espacio" }));
  await screen.findByLabelText("Contraseña (8 caracteres)");
  expect(api.configureWorkspace).toHaveBeenCalledWith(workspace.root);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("conserva la carpeta guardada al cancelar y mantiene el error de configuración sin guardar otra raíz", async () => {
  const user = userEvent.setup();
  render(<WorkspaceSetup />);
  await screen.findByLabelText("Contraseña (8 caracteres)");
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  await user.click(screen.getByRole("button", { name: "Cambiar carpeta compartida" }));
  const root = screen.getByLabelText("Carpeta compartida corporativa") as HTMLInputElement;
  expect(root.value).toBe(workspace.root);
  await user.clear(root); await user.type(root, "C:\\invalid");
  vi.mocked(api.configureWorkspace).mockRejectedValue("Carpeta no disponible");
  await user.click(screen.getByRole("button", { name: "Crear o abrir espacio" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Carpeta no disponible");
  expect(root.value).toBe("C:\\invalid");
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByText(workspace.root)).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("expone el error de espacio inaccesible sin abrir acceso ni crear una ubicación alternativa", async () => {
  vi.mocked(api.workspaceStatus).mockResolvedValue({ phase: "unavailable", workspace: null, candidate_root: null, message: "Espacio no disponible" });
  render(<WorkspaceSetup />);
  expect((await screen.findByRole("alert")).textContent).toBe("Espacio no disponible");
  expect(screen.queryByLabelText("Contraseña (8 caracteres)")).toBeNull();
  expect(api.configureWorkspace).not.toHaveBeenCalled();
});

it("espera confirmación del backend al salir y conserva la sesión si el cierre falla", async () => {
  const user = userEvent.setup();
  let rejectLogout!: (reason: string) => void;
  vi.mocked(api.logout).mockImplementationOnce(() => new Promise((_, reject) => { rejectLogout = reject; }));
  render(<WorkspaceSetup />);
  const password = await screen.findByLabelText("Contraseña (8 caracteres)");
  await waitFor(() => expect((password as HTMLInputElement).disabled).toBe(false));
  await user.type(password, "User1234");
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
  const header = screen.getByRole("banner");
  await within(header).findByText(engineer.name);
  const exit = within(header).getByRole("button", { name: "Cerrar sesión" }) as HTMLButtonElement;
  await user.click(exit);
  await waitFor(() => expect(exit.disabled).toBe(true));
  expect(within(header).getByText(engineer.name)).toBeTruthy();
  rejectLogout("No se pudo cerrar sesión");
  expect((await screen.findByRole("alert")).textContent).toBe("No se pudo cerrar sesión");
  await waitFor(() => expect(exit.disabled).toBe(false));
  expect(within(header).getByText(engineer.name)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  expect((screen.getByRole("button", { name: "Cambiar carpeta compartida" }) as HTMLButtonElement).disabled).toBe(true);
});

it("Admin encuentra Usuarios en Configuración y Proyectos en su destino sin recapturar acceso", async () => {
  const user = userEvent.setup();
  const admin: api.SessionUser = { ...engineer, id: "admin", role: "admin" };
  vi.mocked(api.login).mockResolvedValue(admin);
  vi.mocked(api.listUsers).mockResolvedValue([]);
  vi.mocked(api.projectsOverview).mockResolvedValue({ projects: [], leads: [], can_create: false, write_message: "Solo consulta" });
  render(<WorkspaceSetup />);
  const password = await screen.findByLabelText("Contraseña (8 caracteres)");
  await waitFor(() => expect((password as HTMLInputElement).disabled).toBe(false));
  await user.type(password, "User1234"); await user.click(screen.getByRole("button", { name: "Ingresar" }));
  await within(screen.getByRole("banner")).findByText(admin.name);
  expect(screen.queryByRole("heading", { name: "Proyectos FAB" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  expect(screen.getByRole("heading", { name: "Administración del sistema" })).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Configuración" })));
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Proyectos" }));
  expect(await screen.findByRole("heading", { name: "Proyectos FAB" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Administración del sistema" })).toBeNull();
  expect(api.login).toHaveBeenCalledTimes(1);
  expect(api.projectsOverview).toHaveBeenCalledTimes(1);
});


it("Supervisor conserva el borrador del proyecto al visitar Configuración y volver", async () => {
  const user = userEvent.setup();
  vi.mocked(api.login).mockResolvedValue({ ...engineer, role: "supervisor" });
  vi.mocked(api.projectsOverview).mockResolvedValue({ projects: [], leads: [], can_create: true, write_message: "Registro autorizado" });
  render(<WorkspaceSetup />);
  const password = await screen.findByLabelText("Contraseña (8 caracteres)");
  await waitFor(() => expect((password as HTMLInputElement).disabled).toBe(false));
  await user.type(password, "User1234"); await user.click(screen.getByRole("button", { name: "Ingresar" }));
  await within(screen.getByRole("banner")).findByText("Supervisor");
  async function go(name: string) {
    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    await user.click(screen.getByRole("button", { name }));
  }
  await go("Proyectos");
  await user.type(await screen.findByLabelText("Título del proyecto"), "Mejora fixture");
  await go("Configuración");
  expect(screen.queryByRole("heading", { name: "Administración del sistema" })).toBeNull();
  await go("Proyectos");
  expect((screen.getByLabelText("Título del proyecto") as HTMLInputElement).value).toBe("Mejora fixture");
  expect(api.projectsOverview).toHaveBeenCalledTimes(1);
  expect(api.createProject).not.toHaveBeenCalled();
});
