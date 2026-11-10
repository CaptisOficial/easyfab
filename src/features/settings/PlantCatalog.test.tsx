// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlantCatalog } from "./PlantCatalog";
import * as api from "../../lib/api";
vi.mock("../../lib/api", () => ({ plantCatalogs: vi.fn(), savePlantCatalogs: vi.fn(), requestId: () => "new-id" }));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.plantCatalogs).mockResolvedValue({ revision: "r1", can_edit: true, config: { version: 1, lines: [{ id: "l1", name: "Línea A", active: true }, { id: "l2", name: "Línea B", active: true }], machines: [{ id: "m1", name: "Equipo A", active: true, line_id: "l1" }], failure_types: [] } });
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
