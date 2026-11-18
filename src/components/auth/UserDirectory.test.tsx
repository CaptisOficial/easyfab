// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserDirectory } from "./UserDirectory";
import { I18nProvider, useI18n } from "../../lib/i18n";
import * as api from "../../lib/api";
vi.mock("../../lib/api", () => ({ listUsers: vi.fn(), createUser: vi.fn(), resetPassword: vi.fn(), setUserActive: vi.fn() }));
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.lang = "";
});
beforeEach(() => {
 vi.resetAllMocks();
 window.localStorage.clear();
 document.documentElement.lang = "";
 vi.mocked(api.listUsers).mockResolvedValue([{ id: "eng-a", name: "Persona A", role: "engineer", status: "active" }, { id: "eng-b", name: "Persona B", role: "engineer", status: "active" }, { id: "inactive", name: "Persona inactiva", role: "engineer", status: "inactive" }]);
});
it("abre el alta flotante, contiene foco y conserva borrador al cerrar", async () => {
 const user = userEvent.setup(); render(<UserDirectory />);
 expect(screen.queryByLabelText("ID de usuario")).toBeNull();
 const trigger = screen.getByRole("button", { name: "Nuevo usuario" });
 await user.click(trigger);
 const dialog = screen.getByRole("dialog", { name: "Crear usuario" });
 expect(dialog.getAttribute("aria-modal")).toBe("true");
 expect(document.activeElement).toBe(screen.getByLabelText("ID de usuario"));
 await user.type(screen.getByLabelText("ID de usuario"), "nuevo");
 await user.click(screen.getByRole("button", { name: "Cerrar alta de usuario" }));
 expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
 await user.click(trigger);
 expect((screen.getByLabelText("ID de usuario") as HTMLInputElement).value).toBe("nuevo");
 await user.keyboard("{Escape}"); expect(screen.queryByRole("dialog")).toBeNull();
 await user.click(trigger);
 await user.click(screen.getByRole("dialog").parentElement!);
 expect(screen.queryByRole("dialog")).toBeNull();
});
it("conserva errores dentro del modal y evita duplicados o cierre durante el alta", async () => {
 const user = userEvent.setup(); render(<UserDirectory />);
 await user.click(screen.getByRole("button", { name: "Nuevo usuario" }));
 await user.type(screen.getByLabelText("ID de usuario"), "nuevo");
 await user.type(screen.getByLabelText("Nombre completo"), "Nueva persona");
 vi.mocked(api.createUser).mockRejectedValueOnce("ID ocupado");
 await user.click(screen.getByRole("button", { name: "Crear y generar temporal" }));
 expect(await within(screen.getByRole("dialog")).findByRole("alert")).toBeTruthy();
 let finish!: (value: string) => void;
 vi.mocked(api.createUser).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
 await user.click(screen.getByRole("button", { name: "Crear y generar temporal" }));
 fireEvent.submit(screen.getByLabelText("ID de usuario").closest("form")!);
 await user.keyboard("{Escape}"); expect(screen.getByRole("dialog")).toBeTruthy();
 expect(api.createUser).toHaveBeenCalledTimes(2);
 finish("TEMP1234");
 await screen.findByText("TEMP1234");
 expect(api.createUser).toHaveBeenLastCalledWith({ id: "nuevo", name: "Nueva persona", role: "engineer" });
 await waitFor(() => expect(api.listUsers).toHaveBeenCalledTimes(2));
});
it("recupera solo la cuenta de la fila elegida y omite cuentas inactivas", async () => {
 const user = userEvent.setup(); render(<UserDirectory />);
 const row = (await screen.findByText("Persona B")).closest("tr")!;
 expect(within((screen.getByText("Persona inactiva")).closest("tr")!).queryByRole("button", { name: "Recuperar contraseña" })).toBeNull();
 await user.click(within(row).getByRole("button", { name: "Recuperar contraseña" }));
 expect(screen.queryByLabelText("Recuperación: usuario")).toBeNull();
 vi.mocked(api.resetPassword).mockRejectedValueOnce("No disponible").mockResolvedValueOnce("RESET123");
 await user.click(within(row).getByRole("button", { name: "Emitir contraseña temporal" }));
 await within(row).findByRole("alert");
 await user.click(within(row).getByRole("button", { name: "Emitir contraseña temporal" }));
 await within(row).findByText("RESET123");
 expect(api.resetPassword).toHaveBeenNthCalledWith(1, "eng-b");
 expect(api.resetPassword).toHaveBeenNthCalledWith(2, "eng-b");
 expect(within(screen.getByText("Persona A").closest("tr")!).queryByText("RESET123")).toBeNull();
 await user.click(within(row).getByRole("button", { name: "Ocultar temporal" }));
 expect(screen.queryByText("RESET123")).toBeNull();
});


function LangHarness({ children }: { children: ReactNode }) {
 const { lang, setLang } = useI18n();
 return <>
  <button type="button" onClick={() => setLang(lang === "es" ? "en" : "es")}>Toggle lang ({lang})</button>
  {children}
 </>;
}

describe("bilingüe es / en (N1)", () => {
 it("renderiza UserDirectory, NewUserForm, RecoveryForm y estados en inglés y reacciona al cambio de idioma", async () => {
  const user = userEvent.setup();
  window.localStorage.setItem("easyfab.lang", "en");
  vi.mocked(api.listUsers).mockResolvedValue([
   { id: "admin", name: "Admin Uno", role: "admin", status: "active" },
   { id: "sup-1", name: "Sup Uno", role: "supervisor", status: "active" },
   { id: "eng-b", name: "Persona B", role: "engineer", status: "active" },
   { id: "inactive", name: "Persona inactiva", role: "engineer", status: "inactive" },
  ]);
  vi.mocked(api.createUser).mockResolvedValue("NEWU1234");
  vi.mocked(api.resetPassword).mockResolvedValue("REC12345");
  vi.mocked(api.setUserActive).mockResolvedValueOnce(null).mockResolvedValueOnce("ACT12345");

  render(<I18nProvider><LangHarness><UserDirectory /></LangHarness></I18nProvider>);
  expect(await screen.findByRole("heading", { name: "User management" })).toBeTruthy();
  expect(screen.getByText("User directory and access status")).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Name / ID" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Role" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Action" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Password reset" })).toBeTruthy();
  expect(screen.getByText("Administrator")).toBeTruthy();
  expect(screen.getByText("Supervisor")).toBeTruthy();
  expect(screen.getAllByText("Engineer").length).toBeGreaterThan(0);
  expect(screen.getByText("Protected account")).toBeTruthy();
  expect(screen.getByText("Inactive")).toBeTruthy();
  expect(screen.getByText("Requires reactivation")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "New user" }));
  const dialog = screen.getByRole("dialog", { name: "Create user" });
  expect(within(dialog).getByRole("option", { name: "Engineer" })).toBeTruthy();
  expect(within(dialog).getByRole("option", { name: "Supervisor" })).toBeTruthy();
  await user.type(within(dialog).getByLabelText("User ID"), "nuevo2");
  await user.type(within(dialog).getByLabelText("Full name"), "Nuevo Dos");
  await user.click(within(dialog).getByRole("button", { name: "Create & generate temporary" }));
  expect(await within(dialog).findByText("User created: nuevo2. 8-character temporary password, valid for 24 hours:")).toBeTruthy();
  expect(within(dialog).getByText("NEWU1234")).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Hide temporary" }));
  await user.click(within(dialog).getByRole("button", { name: "Close create user" }));

  const rowB = screen.getByText("Persona B").closest("tr")!;
  await user.click(within(rowB).getByRole("button", { name: "Reset password" }));
  const recoveryForm = within(rowB).getByRole("form", { name: "Reset password for Persona B" });
  await user.click(within(recoveryForm).getByRole("button", { name: "Issue temporary password" }));
  expect(await within(recoveryForm).findByText("Temporary password generated. Shown in this session only:")).toBeTruthy();
  expect(within(recoveryForm).getByText("REC12345")).toBeTruthy();
  await user.click(within(recoveryForm).getByRole("button", { name: "Hide temporary" }));

  await user.click(within(rowB).getByRole("button", { name: "Deactivate" }));
  expect(within(rowB).getByText("Deactivate Persona B?")).toBeTruthy();
  await user.click(within(rowB).getByRole("button", { name: "Confirm" }));
  expect(await screen.findByText("Persona B: account deactivated.")).toBeTruthy();

  const rowInactive = screen.getByText("Persona inactiva").closest("tr")!;
  await user.click(within(rowInactive).getByRole("button", { name: "Activate & generate temporary" }));
  expect(await screen.findByText("Persona inactiva: account activated; deliver the new temporary password.")).toBeTruthy();
  expect(screen.getByText("Temporary password valid for 24 hours:")).toBeTruthy();
  expect(screen.getByText("ACT12345")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /Toggle lang/ }));
  expect(screen.getByText("Persona inactiva: cuenta activada; entrega la nueva temporal.")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Gestión de usuarios" })).toBeTruthy();
 });

 it("traduce errores del backend Rust en es y en para listado, alta, recuperación y cambio de estado", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listUsers).mockRejectedValueOnce("Se requiere sesion normal de administrador.");
  const first = render(<I18nProvider><LangHarness><UserDirectory /></LangHarness></I18nProvider>);
  expect((await screen.findByRole("alert")).textContent).toBe("Se requiere sesión normal de administrador.");
  await user.click(screen.getByRole("button", { name: /Toggle lang/ }));
  expect(screen.getByRole("alert").textContent).toBe("A normal administrator session is required.");
  first.unmount();

  window.localStorage.setItem("easyfab.lang", "en");
  vi.mocked(api.listUsers).mockResolvedValue([
   { id: "admin", name: "Admin Uno", role: "admin", status: "active" },
   { id: "eng-b", name: "Persona B", role: "engineer", status: "active" },
   { id: "inactive", name: "Persona inactiva", role: "engineer", status: "inactive" },
  ]);
  vi.mocked(api.createUser).mockRejectedValueOnce("El ID ya está registrado, incluso en cuentas inactivas.");
  vi.mocked(api.resetPassword).mockRejectedValueOnce("Usuario activo no encontrado.");
  vi.mocked(api.setUserActive).mockRejectedValueOnce("El administrador no se modifica desde este directorio.");

  render(<I18nProvider><LangHarness><UserDirectory /></LangHarness></I18nProvider>);
  await screen.findByText("Persona B");

  await user.click(screen.getByRole("button", { name: "New user" }));
  const dialog = screen.getByRole("dialog", { name: "Create user" });
  await user.type(within(dialog).getByLabelText("User ID"), "eng-b");
  await user.type(within(dialog).getByLabelText("Full name"), "Persona B");
  await user.click(within(dialog).getByRole("button", { name: "Create & generate temporary" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe("This ID is already registered, including inactive accounts.");
  await user.click(within(dialog).getByRole("button", { name: "Close create user" }));

  const rowB = screen.getByText("Persona B").closest("tr")!;
  await user.click(within(rowB).getByRole("button", { name: "Reset password" }));
  await user.click(within(rowB).getByRole("button", { name: "Issue temporary password" }));
  expect((await within(rowB).findByRole("alert")).textContent).toBe("Active user not found.");

  const rowInactive = screen.getByText("Persona inactiva").closest("tr")!;
  await user.click(within(rowInactive).getByRole("button", { name: "Activate & generate temporary" }));
  const alerts = await screen.findAllByRole("alert");
  expect(alerts.some(a => a.textContent === "The administrator cannot be modified from this directory.")).toBe(true);
 });
});
