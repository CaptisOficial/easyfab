// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlantCatalog } from "./PlantCatalog";
import * as api from "../../lib/api";
import { I18nProvider } from "../../lib/i18n";
import { TopNav } from "../../components/TopNav";

let reqCounter = 1;
vi.mock("../../lib/api", () => ({
  plantCatalogs: vi.fn(),
  savePlantCatalogs: vi.fn(),
  requestId: () => `gen-id-${reqCounter++}`
}));

afterEach(cleanup);

beforeEach(() => {
  vi.resetAllMocks();
  reqCounter = 1;
  vi.mocked(api.plantCatalogs).mockResolvedValue({
    revision: "r1",
    can_edit: true,
    config: {
      version: 1,
      lines: [
        { id: "l1", name: "Línea A", active: true },
        { id: "l2", name: "Línea B", active: true }
      ],
      machines: [
        { id: "m1", name: "Equipo A", active: true, line_id: "l1" }
      ],
      failure_types: []
    }
  });
  vi.mocked(api.savePlantCatalogs).mockImplementation(async input => ({ ...input, revision: "r2", can_edit: true }));
});

it("edita nombres y reasigna equipos conservando IDs y revisión; recupera al volver", async () => {
  const view = render(<PlantCatalog />);
  fireEvent.change(await screen.findByLabelText("Nombre de Línea A"), { target: { value: "Línea nueva" } });
  fireEvent.change(screen.getByLabelText("Nombre de Equipo A"), { target: { value: "Equipo nuevo" } });
  fireEvent.change(screen.getByLabelText("Línea de Equipo nuevo"), { target: { value: "l2" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar catálogos" }));
  await screen.findByText("Catálogos guardados.");
  const input = vi.mocked(api.savePlantCatalogs).mock.calls[0][0];
  expect(input.expected_revision).toBe("r1");
  expect(input.config.lines[0]).toEqual({ id: "l1", name: "Línea nueva", active: true });
  expect(input.config.machines[0]).toEqual({ id: "m1", name: "Equipo nuevo", active: true, line_id: "l2" });
  view.unmount();
  vi.mocked(api.plantCatalogs).mockResolvedValue({ config: input.config, revision: "r2", can_edit: true });
  render(<PlantCatalog />);
  expect((await screen.findByLabelText("Nombre de Equipo nuevo") as HTMLInputElement).value).toBe("Equipo nuevo");
});

it("conserva el borrador ante error y permite quitar la asociación", async () => {
  vi.mocked(api.savePlantCatalogs).mockRejectedValue("El catálogo cambió. Actualiza antes de guardar.");
  render(<PlantCatalog />);
  fireEvent.change(await screen.findByLabelText("Línea de Equipo A"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar catálogos" }));
  await screen.findByRole("alert");
  expect(vi.mocked(api.savePlantCatalogs).mock.calls[0][0].config.machines[0].line_id).toBeUndefined();
  expect((screen.getByLabelText("Línea de Equipo A") as HTMLSelectElement).value).toBe("");
});

it("deshabilita la edición cuando el servidor no la autoriza", async () => {
  const data = await api.plantCatalogs();
  vi.mocked(api.plantCatalogs).mockResolvedValue({ ...data, can_edit: false });
  render(<PlantCatalog />);
  const input = await screen.findByLabelText("Nombre de Equipo A");
  expect(input.closest("fieldset")?.disabled).toBe(true);
});

it("añade y persiste inmediatamente una nueva línea al hacer clic en Añadir a Líneas", async () => {
  render(<PlantCatalog />);
  const input = await screen.findByPlaceholderText("Nombre de línea...");
  fireEvent.change(input, { target: { value: "Línea C" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir a Líneas" }));
  await screen.findByText("Registro añadido y guardado en Líneas.");
  expect(api.savePlantCatalogs).toHaveBeenCalledTimes(1);
  const callInput = vi.mocked(api.savePlantCatalogs).mock.calls[0][0];
  expect(callInput.expected_revision).toBe("r1");
  expect(callInput.config.lines.some(l => l.name === "Línea C")).toBe(true);
});

it("añade una fila vacía en la tabla y permite descartarla con Quitar", async () => {
  render(<PlantCatalog />);
  await screen.findByText("Todos los catálogos");

  // Hacer clic en + Añadir fila a Líneas
  const addButtons = screen.getAllByRole("button", { name: "+ Añadir fila a Líneas" });
  fireEvent.click(addButtons[0]);

  // Se añade una fila con input para nuevo registro
  const newInput = screen.getByLabelText("Nombre de nuevo registro");
  fireEvent.change(newInput, { target: { value: "Línea Borrador" } });
  expect((screen.getByLabelText("Nombre de Línea Borrador") as HTMLInputElement).value).toBe("Línea Borrador");

  // El botón Quitar descarta la fila nueva
  const removeBtn = screen.getByRole("button", { name: "Quitar" });
  fireEvent.click(removeBtn);
  expect(screen.queryByLabelText("Nombre de Línea Borrador")).toBeNull();
});

it("permite pegar filas en lote desde Excel (TSV) y asocia líneas automáticamente", async () => {
  render(<PlantCatalog />);
  await screen.findByText("Todos los catálogos");

  // Filtrar o navegar a la pestaña Equipos
  fireEvent.click(screen.getByRole("tab", { name: /Equipos/ }));

  // Abrir pegado desde Excel
  fireEvent.click(screen.getByRole("button", { name: "Pegar desde Excel…" }));

  // Escribir texto simulando 2 filas copiadas de Excel (Nombre [Tab] Línea)
  const textarea = screen.getByPlaceholderText(/Pega aquí filas copiadas de Excel/i);
  fireEvent.change(textarea, { target: { value: "Prensa 01\tLínea A\nRobot Soldadura\tLínea B" } });

  // Importar
  fireEvent.click(screen.getByRole("button", { name: "Importar filas" }));

  // Verificar aviso de importación
  expect(screen.getByText(/Se importaron 2 filas en borrador para Equipos/i)).toBeTruthy();

  // Guardar catálogos
  fireEvent.click(screen.getByRole("button", { name: "Guardar catálogos" }));
  await screen.findByText("Catálogos guardados.");

  const savedConfig = vi.mocked(api.savePlantCatalogs).mock.calls[0][0].config;
  const prensa = savedConfig.machines.find(m => m.name === "Prensa 01");
  const robot = savedConfig.machines.find(m => m.name === "Robot Soldadura");

  expect(prensa).toBeDefined();
  expect(prensa?.line_id).toBe("l1"); // Línea A
  expect(robot).toBeDefined();
  expect(robot?.line_id).toBe("l2"); // Línea B
});

it("filtra equipos por línea en la tabla interactiva", async () => {
  render(<PlantCatalog />);
  await screen.findByText("Todos los catálogos");

  // Cambiar a la pestaña de Equipos
  fireEvent.click(screen.getByRole("tab", { name: /Equipos/ }));

  // Selector de filtro de línea
  const filterSelect = screen.getByLabelText("Filtrar por línea");
  fireEvent.change(filterSelect, { target: { value: "l2" } }); // Línea B

  // Como Equipo A pertenece a l1, no debe mostrarse en la tabla filtrada
  expect(screen.queryByLabelText("Nombre de Equipo A")).toBeNull();
  expect(screen.getByText(/Sin registros en Equipos/i)).toBeTruthy();

  // Cambiar filtro a Línea A (l1)
  fireEvent.change(filterSelect, { target: { value: "l1" } });
  expect(screen.getByLabelText("Nombre de Equipo A")).toBeTruthy();
});

describe("PlantCatalog bilingual & i18n", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function renderWithNav() {
    return render(
      <I18nProvider>
        <TopNav settings={null} user={null} logoutDisabled={false} onLogout={() => {}} />
        <PlantCatalog />
      </I18nProvider>,
    );
  }

  it("switches UI reactively between es and en while pick() resolves reads with Spanish fallback", async () => {
    vi.mocked(api.plantCatalogs).mockResolvedValue({
      revision: "r1",
      can_edit: true,
      config: {
        version: 1,
        lines: [
          { id: "l1", name: "Línea Prensas | Press Line", active: true },
          { id: "l2", name: "Línea Única", active: false },
        ],
        machines: [
          { id: "m1", name: "Prensa 100T | 100T Press", active: true, line_id: "l1" },
        ],
        failure_types: [
          { id: "f1", name: "Falla eléctrica | Electrical fault", active: true },
        ],
      },
    });

    renderWithNav();
    expect(await screen.findByText("Catálogos FAB")).toBeTruthy();
    expect(screen.getByText("Todos los catálogos")).toBeTruthy();

    const filterSelectEs = screen.getByLabelText("Filtrar por línea");
    expect(Array.from(filterSelectEs.querySelectorAll("option")).map(o => o.textContent)).toEqual([
      "Todas las líneas",
      "Sin línea asignada",
      "Línea Prensas",
      "Línea Única (inactiva)",
    ]);
    const rowSelectEs = screen.getByLabelText("Línea de Prensa 100T");
    expect(Array.from(rowSelectEs.querySelectorAll("option")).map(o => o.textContent)).toEqual([
      "Sin línea",
      "Línea Prensas",
    ]);
    expect((screen.getByLabelText("Nombre de Prensa 100T") as HTMLInputElement).value).toBe("Prensa 100T | 100T Press");

    // Toggle language via TopNav
    fireEvent.click(screen.getByRole("button", { name: "Idioma" }));

    expect(screen.getByText("FAB Catalogs")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /All catalogs/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Lines/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Machines/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Failure types/ })).toBeTruthy();

    const filterSelectEn = screen.getByLabelText("Filter by line");
    expect(Array.from(filterSelectEn.querySelectorAll("option")).map(o => o.textContent)).toEqual([
      "All lines",
      "No line assigned",
      "Press Line",
      "Línea Única (inactive)",
    ]);
    const rowSelectEn = screen.getByLabelText("Line for 100T Press");
    expect(Array.from(rowSelectEn.querySelectorAll("option")).map(o => o.textContent)).toEqual([
      "No line",
      "Press Line",
    ]);
    expect((screen.getByLabelText("Name of 100T Press") as HTMLInputElement).value).toBe("Prensa 100T | 100T Press");
    expect(screen.getByText("100T Press active")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save catalogs" })).toBeTruthy();
  });

  it("preserves full 'Español | Inglés' on inline edit and quick-add in English mode", async () => {
    vi.mocked(api.plantCatalogs).mockResolvedValue({
      revision: "r1",
      can_edit: true,
      config: {
        version: 1,
        lines: [{ id: "l1", name: "Línea Prensas | Press Line", active: true }],
        machines: [],
        failure_types: [],
      },
    });
    window.localStorage.setItem("easyfab.lang", "en");

    renderWithNav();
    const lineInput = (await screen.findByLabelText("Name of Press Line")) as HTMLInputElement;
    fireEvent.change(lineInput, { target: { value: "Línea Prensas v2 | Press Line v2" } });
    expect((screen.getByLabelText("Name of Press Line v2") as HTMLInputElement).value).toBe("Línea Prensas v2 | Press Line v2");

    fireEvent.click(screen.getByRole("tab", { name: /Failure types/ }));
    const quickInput = screen.getByLabelText("New record: Failure types");
    fireEvent.change(quickInput, { target: { value: "Fuga de aceite | Oil leak" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Failure types" }));

    await screen.findByText("Record added and saved in Failure types.");
    const saved = vi.mocked(api.savePlantCatalogs).mock.calls[0][0].config;
    expect(saved.lines[0].name).toBe("Línea Prensas v2 | Press Line v2");
    expect(saved.failure_types[0].name).toBe("Fuga de aceite | Oil leak");
  });

  it("matches bilingual line names on TSV paste (es, en, raw, and blank-en guard)", async () => {
    vi.mocked(api.plantCatalogs).mockResolvedValue({
      revision: "r1",
      can_edit: true,
      config: {
        version: 1,
        lines: [
          { id: "l1", name: "Línea A | Line A", active: true },
          { id: "l2", name: "Línea B |   ", active: true },
        ],
        machines: [],
        failure_types: [],
      },
    });
    window.localStorage.setItem("easyfab.lang", "en");

    renderWithNav();
    await screen.findByText("FAB Catalogs");
    fireEvent.click(screen.getByRole("tab", { name: /Machines/ }));
    fireEvent.click(screen.getByRole("button", { name: "Paste from Excel…" }));

    const textarea = screen.getByPlaceholderText(/Paste rows copied from Excel/i);
    fireEvent.change(textarea, {
      target: {
        value: [
          "Robot 01 | Robot 01 EN\tlínea a",
          "Prensa 02 | Press 02\t  LINE A  ",
          "Soldadora 03 | Welder 03\tLínea B |   ",
          "Cortadora 04\tlínea b",
          "Estampadora 05\tNo match",
        ].join("\n"),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import rows" }));

    expect(screen.getByText(/Imported 5 draft rows for Machines/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save catalogs" }));
    await screen.findByText("Catalogs saved.");

    const machines = vi.mocked(api.savePlantCatalogs).mock.calls[0][0].config.machines;
    expect(machines.find(m => m.name === "Robot 01 | Robot 01 EN")?.line_id).toBe("l1");
    expect(machines.find(m => m.name === "Prensa 02 | Press 02")?.line_id).toBe("l1");
    expect(machines.find(m => m.name === "Soldadora 03 | Welder 03")?.line_id).toBe("l2");
    expect(machines.find(m => m.name === "Cortadora 04")?.line_id).toBe("l2");
    expect(machines.find(m => m.name === "Estampadora 05")?.line_id).toBeUndefined();
  });

  it("translates backend load and save errors via tError() and updates reactively on toggle", async () => {
    vi.mocked(api.plantCatalogs).mockRejectedValueOnce("Acceso rechazado.");
    window.localStorage.setItem("easyfab.lang", "en");

    const view = renderWithNav();
    expect((await screen.findByRole("alert")).textContent).toBe("Access denied.");
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    expect(screen.getByRole("alert").textContent).toBe("Acceso rechazado.");
    view.unmount();

    vi.mocked(api.plantCatalogs).mockResolvedValue({
      revision: "r1",
      can_edit: true,
      config: { version: 1, lines: [{ id: "l1", name: "Línea A | Line A", active: true }], machines: [], failure_types: [] },
    });
    vi.mocked(api.savePlantCatalogs).mockRejectedValue("El catálogo cambió. Actualiza antes de guardar.");
    window.localStorage.setItem("easyfab.lang", "en");

    renderWithNav();
    await screen.findByText("FAB Catalogs");
    fireEvent.click(screen.getByRole("button", { name: "Save catalogs" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The catalog changed. Refresh before saving.");

    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    expect(screen.getByRole("alert").textContent).toBe("El catálogo cambió. Actualiza antes de guardar.");
  });
});
