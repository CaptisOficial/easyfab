// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceSetup } from "./WorkspaceSetup";
import { I18nProvider } from "../lib/i18n";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  workspaceStatus: vi.fn(), configureWorkspace: vi.fn(), runningInTauri: vi.fn(),
  listLoginUsers: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn(),
  provisionInitialAdmin: vi.fn(), listUsers: vi.fn(), createUser: vi.fn(),
  setUserActive: vi.fn(), resetPassword: vi.fn(), projectsOverview: vi.fn(), createProject: vi.fn(), plantCatalogs: vi.fn(),
  userPreferences: vi.fn(),
}));
const workspace: api.WorkspaceInfo = {
  id: "synthetic", root: "C:\\synthetic\\FAB", path: "C:\\synthetic\\FAB\\easy-fab",
  data_dir: "C:\\synthetic\\FAB\\easy-fab\\data", docs_dir: "C:\\synthetic\\FAB\\easy-fab\\docs",
  contracts_dir: "contracts", software_dir: "software", exports_dir: "exports", backups_dir: "backups",
  executable: "C:\\synthetic\\FAB\\easy-fab\\software\\easyfab.exe",
};
const engineer: api.SessionUser = { id: "engineer", name: "Engineer Fixture", role: "engineer", must_change_password: false };
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.lang = "";
});
beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  document.documentElement.lang = "";
  vi.mocked(api.runningInTauri).mockReturnValue(true);
  vi.mocked(api.workspaceStatus).mockResolvedValue({ phase: "ready", workspace, candidate_root: "C:\\other-suggestion", message: null });
  vi.mocked(api.listLoginUsers).mockResolvedValue({ users: [engineer], requires_admin: false });
  vi.mocked(api.login).mockResolvedValue(engineer);
  vi.mocked(api.logout).mockResolvedValue();
  vi.mocked(api.userPreferences).mockResolvedValue({ preferences: { version: 1, workspace_id: "fixture", user_id: "fixture", theme: "light", ui_scale: "standard" }, revision: null, warning: null });
  vi.mocked(api.plantCatalogs).mockResolvedValue({ config: { version: 1, lines: [], machines: [], failure_types: [] }, revision: "fixture", can_edit: true });
  vi.mocked(api.projectsOverview).mockResolvedValue({ projects: [], leads: [], can_create: false, write_message: "Consulta los proyectos donde eres el ingeniero responsable." });
});

it("Engineer navega a sus proyectos en consulta y cierra sesión sin conservar la lista", async () => {
  const user = userEvent.setup();
  vi.mocked(api.projectsOverview).mockResolvedValue({ projects: [{ id: "PRJ-own", wbs: "FAB-OWN", name: "Asignado", process_area: "FAB", engineer_ids: [engineer.id], start_date: "2026-10-29", target_date: "2026-11-30", status: "Not Started" }], leads: [{ id: engineer.id, name: engineer.name }], can_create: false, write_message: "Consulta los proyectos donde eres el ingeniero responsable." });
  render(<WorkspaceSetup />);
  const password = await screen.findByLabelText("Contraseña (8 caracteres)");
  await waitFor(() => expect((password as HTMLInputElement).disabled).toBe(false));
  await user.type(password, "User1234");
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
  await screen.findByText(engineer.name);
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Proyectos" }));
  expect(await screen.findByText("FAB-OWN · Asignado")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Guardar proyecto" })).toBeNull();
  expect(api.createProject).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  await screen.findByLabelText("Contraseña (8 caracteres)");
  expect(screen.queryByText("FAB-OWN · Asignado")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  expect(screen.queryByRole("button", { name: "Proyectos" })).toBeNull();
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

it("oculta el acceso en Configuración y lo recupera al volver a Inicio", async () => {
  const user = userEvent.setup();
  render(<WorkspaceSetup />);
  const password = await screen.findByLabelText("Contraseña (8 caracteres)");
  await waitFor(() => expect((password as HTMLInputElement).disabled).toBe(false));
  await user.type(password, "draft");
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  expect(screen.getByRole("heading", { name: "Carpeta activa" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Acceso a EasyFAB" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Ingresar" })).toBeNull();
  expect(password.closest("[hidden]")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Inicio" }));
  expect(screen.getByRole("button", { name: "Ingresar" })).toBeTruthy();
  expect(password.closest("[hidden]")).toBeNull();
  expect((password as HTMLInputElement).value).toBe("draft");
  expect(api.listLoginUsers).toHaveBeenCalledTimes(1);
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

it("Admin encuentra Usuarios en su módulo y Proyectos en su destino sin recapturar acceso", async () => {
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
  await user.click(screen.getByRole("button", { name: "Usuarios" }));
  expect(screen.getByRole("heading", { name: "Gestión de usuarios" })).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Usuarios" })));
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Proyectos" }));
  expect(await screen.findByRole("heading", { name: "Proyectos FAB" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Gestión de usuarios" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Catálogos" }));
  expect(await screen.findByRole("heading", { name: "Catálogos FAB" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Gestión de usuarios" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  expect(screen.queryByRole("heading", { name: "Catálogos FAB" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Gestión de usuarios" })).toBeNull();
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
  // Open the creation modal before typing the new project name
  await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
  await user.type(await screen.findByLabelText("Título del proyecto"), "Mejora fixture");
  await go("Configuración");
  expect(screen.queryByRole("heading", { name: "Administración del sistema" })).toBeNull();
  await go("Proyectos");
  expect((screen.getByLabelText("Título del proyecto") as HTMLInputElement).value).toBe("Mejora fixture");
  expect(api.projectsOverview).toHaveBeenCalledTimes(1);
  expect(api.createProject).not.toHaveBeenCalled();
});


it("alterna idioma antes de iniciar sesión desde TopNav y persiste en localStorage al remount", async () => {
  const user = userEvent.setup();
  vi.mocked(api.workspaceStatus).mockResolvedValue({ phase: "unconfigured", workspace: null, candidate_root: "", message: null });

  const first = render(<I18nProvider><WorkspaceSetup /></I18nProvider>);
  expect(await screen.findByRole("heading", { name: "Carpeta activa" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Espacio de trabajo EasyFAB" })).toBeTruthy();

  const toggle = screen.getByRole("button", { name: "Idioma" });
  expect(toggle.textContent).toBe("ES");
  await user.click(toggle);

  expect(window.localStorage.getItem("easyfab.lang")).toBe("en");
  expect(document.documentElement.lang).toBe("en");
  expect(within(screen.getByRole("banner")).getByRole("heading", { name: "Settings" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Active folder" })).toBeTruthy();
  expect(screen.getByLabelText("Corporate shared folder")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Create or open workspace" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "EasyFAB Workspace" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open settings" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Language" })).toHaveLength(1);

  first.unmount();
  vi.mocked(api.workspaceStatus).mockResolvedValue({ phase: "ready", workspace, candidate_root: "", message: null });
  render(<I18nProvider><WorkspaceSetup /></I18nProvider>);
  expect(await screen.findByRole("heading", { name: "Sign in to EasyFAB" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Language" })).toHaveLength(1);

  await user.click(screen.getByRole("button", { name: "Open menu" }));
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByText("Workspace ready")).toBeTruthy();
  expect(screen.getByText("Shared folder")).toBeTruthy();
  expect(screen.getByText("Workspace locations")).toBeTruthy();
  expect(screen.getByText("System workspace")).toBeTruthy();
  expect(screen.getByText("Data")).toBeTruthy();
  expect(screen.getByText("Documentation")).toBeTruthy();
  expect(screen.getByText("Portable executable")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Change shared folder" })).toBeTruthy();
});

it("conserva el idioma inglés pre-login tras autenticar cuando userPreferences no tiene revisión", async () => {
  const user = userEvent.setup();
  window.localStorage.setItem("easyfab.lang", "en");
  render(<I18nProvider><WorkspaceSetup /></I18nProvider>);
  const password = await screen.findByLabelText("Password (8 characters)");
  await waitFor(() => expect((password as HTMLInputElement).disabled).toBe(false));
  await user.type(password, "User1234");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  const header = screen.getByRole("banner");
  expect(await within(header).findByText("Engineer")).toBeTruthy();
  expect(within(header).getByRole("button", { name: "Sign out" })).toBeTruthy();

  await user.click(within(header).getByRole("button", { name: "Open menu" }));
  const dialog = screen.getByRole("dialog", { name: "EasyFAB Menu" });
  expect(within(dialog).getByRole("button", { name: "Home" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Projects" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Line issues" })).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Settings" }));

  expect((screen.getByRole("button", { name: "Change shared folder" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Sign out to change workspace.")).toBeTruthy();
});

it("traduce WorkspaceStatus.message y errores de configureWorkspace en es y en reactivamente", async () => {
  const user = userEvent.setup();
  window.localStorage.setItem("easyfab.lang", "en");
  vi.mocked(api.workspaceStatus).mockResolvedValue({
    phase: "unavailable",
    workspace: null,
    candidate_root: null,
    message: "El espacio está incompleto (team.json). Restaura sus datos; no se creará otro directorio vacío.",
  });
  vi.mocked(api.configureWorkspace).mockRejectedValueOnce("Elige una carpeta compartida existente con ruta absoluta.");

  render(<I18nProvider><WorkspaceSetup /></I18nProvider>);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "The workspace is incomplete (team.json). Restore its data; no new empty directory will be created."
  );

  await user.click(screen.getByRole("button", { name: "Language" }));
  expect(screen.getByRole("alert").textContent).toBe(
    "El espacio está incompleto (team.json). Restaura sus datos; no se creará otro directorio vacío."
  );

  await user.click(screen.getByRole("button", { name: "Idioma" }));
  await user.type(screen.getByLabelText("Corporate shared folder"), "relative\\path");
  await user.click(screen.getByRole("button", { name: "Create or open workspace" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Choose an existing shared folder with an absolute path."
  );

  await user.click(screen.getByRole("button", { name: "Language" }));
  expect(screen.getByRole("alert").textContent).toBe(
    "Elige una carpeta compartida existente con ruta absoluta."
  );
});
