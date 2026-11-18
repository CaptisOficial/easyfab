import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { configureWorkspace, login, workspaceStatus } from "./api";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(isTauri).mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("frontera frontend / Tauri", () => {
  it("ofrece configuración en navegador sin intentar acceder al backend", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    expect(await workspaceStatus()).toMatchObject({
      phase: "unconfigured", workspace: null, candidate_root: null,
      message: "Abre la aplicación de escritorio para configurar el espacio compartido.",
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("localiza el mensaje de navegador cuando el idioma guardado es inglés", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (key === "easyfab.lang" ? "en" : null),
      },
    });
    expect(await workspaceStatus()).toEqual({
      phase: "unconfigured",
      candidate_root: null,
      workspace: null,
      message: "Open the desktop application to configure the shared workspace.",
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("conserva el estado unavailable que informa el backend", async () => {
    const status = { phase: "unavailable", workspace: null, candidate_root: null, message: "Sin acceso" };
    vi.mocked(invoke).mockResolvedValue(status);
    expect(await workspaceStatus()).toEqual(status);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("workspace_status");
  });

  it("envía el identificador y PIN con los nombres esperados por IPC", async () => {
    vi.mocked(invoke).mockResolvedValue({ id: "engineer", role: "engineer" });
    await login("engineer", "test-pin");
    expect(invoke).toHaveBeenCalledExactlyOnceWith("login", { userId: "engineer", pin: "test-pin" });
  });

  it("propaga un rechazo de configuración sin convertirlo en éxito", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("Ruta inválida"));
    await expect(configureWorkspace("invalid-test-root")).rejects.toThrow("Ruta inválida");
    expect(invoke).toHaveBeenCalledExactlyOnceWith("configure_workspace", { root: "invalid-test-root" });
  });
});

it("proyectos usa los comandos y payload del contrato sin rutas ni identidad del llamador", async () => {
  const api = await import("./api");
  const input = { wbs: "FAB-1", name: "Fixture", process_area: "FAB", engineer_ids: ["eng"], start_date: "2026-10-28", target_date: "2026-10-29" };
  vi.mocked(invoke).mockResolvedValue({ projects: [], leads: [], can_create: false, write_message: "Pending" });
  await api.projectsOverview();
  expect(invoke).toHaveBeenLastCalledWith("projects_overview");
  await api.projectResultsCapabilities("fixture");
  expect(invoke).toHaveBeenLastCalledWith("project_results_capabilities", { projectId: "fixture" });
  vi.mocked(invoke).mockRejectedValue("Denied");
  await expect(api.createProject(input)).rejects.toBe("Denied");
  expect(invoke).toHaveBeenLastCalledWith("create_project", { input });
});
