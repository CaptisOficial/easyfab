// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "./Login";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  listLoginUsers: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn(),
  provisionInitialAdmin: vi.fn(), listUsers: vi.fn(), createUser: vi.fn(),
  setUserActive: vi.fn(), resetPassword: vi.fn(), projectsOverview: vi.fn().mockResolvedValue({ projects: [], leads: [], can_create: false, write_message: "Piloto pendiente" }), createProject: vi.fn(),
}));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.projectsOverview).mockResolvedValue({ projects: [], leads: [], can_create: false, write_message: "Piloto pendiente" }); });

describe("primer recorrido de acceso", () => {
  it("crea Admin, cambia contraseña, registra usuario y permite probar su acceso", async () => {
    const actor = userEvent.setup();
    const admin = { id: "admin", name: "Admin Test", role: "admin" as const, must_change_password: false };
    const engineer = { id: "engineer", name: "Engineer Test", role: "engineer" as const, must_change_password: false };
    const choices = [{ id: admin.id, name: admin.name }];
    vi.mocked(api.listLoginUsers).mockImplementation(async () => ({ users: [...choices], requires_admin: choices.length === 0 }));
    vi.mocked(api.listLoginUsers).mockResolvedValueOnce({ users: [], requires_admin: true });
    vi.mocked(api.provisionInitialAdmin).mockResolvedValue("TEMP1234");
    vi.mocked(api.changePassword).mockResolvedValue();
    vi.mocked(api.logout).mockResolvedValue();
    vi.mocked(api.listUsers).mockResolvedValue([{ ...admin, status: "active" }]);
    vi.mocked(api.createUser).mockImplementation(async () => {
      choices.push({ id: engineer.id, name: engineer.name });
      return "USER1234";
    });
    vi.mocked(api.login)
      .mockResolvedValueOnce({ ...admin, must_change_password: true })
      .mockResolvedValueOnce(admin)
      .mockResolvedValueOnce({ ...engineer, must_change_password: true })
      .mockResolvedValueOnce(engineer);
    render(<Login />);
    await actor.type(await screen.findByLabelText("Usuario EasyFAB"), "admin");
    await actor.type(screen.getByLabelText("Nombre completo"), "Admin Test");
    await actor.click(screen.getByRole("button", { name: "Crear administrador" }));
    await screen.findByText("TEMP1234");
    await actor.click(screen.getByRole("button", { name: "Continuar al acceso" }));

    async function signIn(password: string) {
      await actor.type(await screen.findByLabelText("Contraseña (8 caracteres)"), password);
      await actor.click(screen.getByRole("button", { name: "Ingresar" }));
    }
    async function changePassword(password: string) {
      await actor.type(await screen.findByLabelText("Nueva contraseña (8 caracteres)"), password);
      await actor.type(screen.getByLabelText("Confirmar contraseña"), password);
      await actor.click(screen.getByRole("button", { name: "Guardar y volver a ingresar" }));
      await screen.findByText("Contraseña actualizada. Ingresa con tu nueva contraseña.");
    }
    await signIn("TEMP1234");
    expect(screen.queryByRole("heading", { name: "Gestión de usuarios" })).toBeNull();
    await changePassword("Admin123");
    await signIn("Admin123");
    await screen.findByRole("heading", { name: "Gestión de usuarios" });
    await actor.type(screen.getByLabelText("ID de usuario"), "engineer");
    await actor.type(screen.getByLabelText("Nombre completo"), "Engineer Test");
    await actor.click(screen.getByRole("button", { name: "Crear y generar temporal" }));
    await screen.findByText("USER1234");
    await actor.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await actor.selectOptions(await screen.findByLabelText("Usuario"), "engineer");
    await signIn("USER1234");
    expect(screen.queryByRole("heading", { name: "Gestión de usuarios" })).toBeNull();
    await changePassword("User1234");
    await signIn("User1234");
    await screen.findByText("Acceso confirmado con tu contraseña personal.");
    expect(screen.getByText("Usuario EasyFAB: engineer")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Gestión de usuarios" })).toBeNull();
    expect(api.login).toHaveBeenLastCalledWith("engineer", "User1234");
  });

  it("una falla al leer el directorio no ofrece crear otro Admin", async () => {
    vi.mocked(api.listLoginUsers).mockRejectedValue("Directorio inválido");
    render(<Login />);
    expect((await screen.findByRole("alert")).textContent).toContain("Directorio inválido");
    expect(screen.queryByRole("button", { name: "Crear administrador" })).toBeNull();
  });

  it("si guardar la contraseña falla conserva el cambio obligatorio", async () => {
    const actor = userEvent.setup();
    vi.mocked(api.listLoginUsers).mockResolvedValue({ users: [{ id: "admin", name: "Admin" }], requires_admin: false });
    vi.mocked(api.login).mockResolvedValue({ id: "admin", name: "Admin", role: "admin", must_change_password: true });
    vi.mocked(api.changePassword).mockRejectedValue("No se pudo guardar");
    render(<Login />);
    await actor.type(await screen.findByLabelText("Contraseña (8 caracteres)"), "TEMP1234");
    await actor.click(screen.getByRole("button", { name: "Ingresar" }));
    await actor.type(await screen.findByLabelText("Nueva contraseña (8 caracteres)"), "Admin123");
    await actor.type(screen.getByLabelText("Confirmar contraseña"), "Admin123");
    await actor.click(screen.getByRole("button", { name: "Guardar y volver a ingresar" }));
    await screen.findByText("No se pudo guardar");
    await waitFor(() => expect(screen.getByLabelText("Nueva contraseña (8 caracteres)")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "Gestión de usuarios" })).toBeNull();
  });
});

