// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlantCatalog } from "./PlantCatalog";
import * as api from "../../lib/api";

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
