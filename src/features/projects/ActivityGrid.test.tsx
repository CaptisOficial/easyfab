// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityGrid, emptyRow, type ActivityRow } from "./ActivityGrid";
import type { ResultsDeliverable } from "../../lib/results-api";

afterEach(cleanup);

const mockDeliverables: ResultsDeliverable[] = [
  { id: "deliv_1", title: "Prototipo validado", due_date: "2026-11-15", criteria: [] },
  { id: "deliv_2", title: "Manual de operación", due_date: "2026-11-20", criteria: [] },
];

describe("ActivityGrid", () => {
  it("muestra numeración automática, selectores y checkers sin campo de responsable", () => {
    const rows: ActivityRow[] = [
      {
        id: "act_1",
        wbs: "1.1",
        title: "Diseño 3D de herramental",
        deliverable_id: "deliv_1",
        start_date: "2026-11-01",
        due_date: "2026-11-05",
        status: "not_started",
        at_risk: false,
      },
      {
        id: "act_2",
        wbs: "1.2",
        title: "Mecanizado de placas",
        deliverable_id: "deliv_1",
        start_date: "2026-11-06",
        due_date: "2026-11-10",
        status: "in_progress",
        at_risk: true,
      },
    ];

    render(
      <ActivityGrid
        rows={rows}
        onChange={vi.fn()}
        deliverables={mockDeliverables}
      />
    );

    // Numeración automática como badges visibles
    expect(screen.getByText("1.1")).toBeTruthy();
    expect(screen.getByText("1.2")).toBeTruthy();

    // No debe existir columna ni input de responsable_id
    expect(screen.queryByText(/responsible/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/responsable/i)).toBeNull();

    // Títulos de subactividades
    expect(screen.getByDisplayValue("Diseño 3D de herramental")).toBeTruthy();
    expect(screen.getByDisplayValue("Mecanizado de placas")).toBeTruthy();

    // Selectores de entregables
    const delivSelects = screen.getAllByRole("combobox");
    expect(delivSelects.length).toBeGreaterThanOrEqual(2);

    // Checker de riesgo
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
  });

  it("autogenera número al añadir subactividad", async () => {
    const user = userEvent.setup();
    const rows: ActivityRow[] = [emptyRow("deliv_1")];
    const onChange = vi.fn();

    render(
      <ActivityGrid
        rows={rows}
        onChange={onChange}
        deliverables={mockDeliverables}
      />
    );

    await user.click(screen.getByRole("button", { name: "+ Añadir subactividad" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedRows = onChange.mock.calls[0][0] as ActivityRow[];
    expect(updatedRows.length).toBe(2);
    expect(updatedRows[0].wbs).toBe("1.1");
    expect(updatedRows[1].wbs).toBe("1.2");
  });

  it("importa filas de Excel (TSV) y autogenera números sin requerir responsable", async () => {
    const user = userEvent.setup();
    const rows: ActivityRow[] = [emptyRow()];
    const onChange = vi.fn();

    render(
      <ActivityGrid
        rows={rows}
        onChange={onChange}
        deliverables={mockDeliverables}
      />
    );

    // Abrir panel de pegado
    await user.click(screen.getByRole("button", { name: "Pegar desde Excel…" }));
    const textarea = screen.getByPlaceholderText(/Pega aquí las filas copiadas desde Excel/i);

    // Pegar dos filas tipo TSV (Título \t Inicio \t Fin)
    const tsvData = "Ensamble del bastidor\t2026-11-01\t2026-11-05\nCableado de sensores\t2026-11-06\t2026-11-10";
    fireEvent.change(textarea, { target: { value: tsvData } });

    await user.click(screen.getByRole("button", { name: "Importar filas" }));
    expect(onChange).toHaveBeenCalledTimes(1);

    const imported = onChange.mock.calls[0][0] as ActivityRow[];
    expect(imported.length).toBe(2);
    expect(imported[0].title).toBe("Ensamble del bastidor");
    expect(imported[0].start_date).toBe("2026-11-01");
    expect(imported[0].wbs).toBe("1.1");
    expect(imported[1].title).toBe("Cableado de sensores");
    expect(imported[1].wbs).toBe("1.2");
  });

  it("permite planear subactividades con entregables y criterios embebidos para agilizar el registro", () => {
    const rows: ActivityRow[] = [
      {
        id: "act_1",
        wbs: "1",
        title: "Sprint 1: Maquinado CNC",
        deliverable_id: "",
        criterion: "Tolerancia dimensional <0.02mm",
        evidence_required: true,
        start_date: "2026-11-01",
        due_date: "2026-11-05",
        status: "not_started",
        at_risk: false,
      },
    ];

    render(
      <ActivityGrid
        rows={rows}
        onChange={vi.fn()}
        embedDeliverable
      />
    );

    // Encabezado unificado de subactividades y entregables
    expect(screen.getByText("Subactividades y entregables (1)")).toBeTruthy();
    expect(screen.getByText(/embebe su condición de cierre verificable/i)).toBeTruthy();

    // Inputs embebidos en la fila
    expect(screen.getByDisplayValue("Sprint 1: Maquinado CNC")).toBeTruthy();
    expect(screen.getByDisplayValue("Tolerancia dimensional <0.02mm")).toBeTruthy();
    expect(screen.getByLabelText("Evidencia requerida para criterio 1.1")).toHaveProperty("checked", true);

    // No debe existir el combobox selector de entregable separado
    expect(screen.queryByText("Entregable asociado")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeTruthy(); // solo el de status
  });

  it("permite asignar responsable por fila solo cuando hay más de un ingeniero", async () => {
    const user = userEvent.setup();
    const rows: ActivityRow[] = [emptyRow("", "2026-11-01", "2026-11-10")];
    const onChange = vi.fn();

    render(
      <ActivityGrid
        rows={rows}
        onChange={onChange}
        embedDeliverable
        engineers={[
          { id: "ing_1", name: "Ana" },
          { id: "ing_2", name: "Luis" },
        ]}
      />
    );

    const select = screen.getByLabelText("Responsable 1");
    await user.selectOptions(select, "ing_2");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as ActivityRow[])[0].responsible_id).toBe("ing_2");
  });

  it("importa filas TSV al pegar directo en el título y agrega fila con Enter en la última fila", async () => {
    const onChange = vi.fn();
    const rows: ActivityRow[] = [
      { ...emptyRow("", "2026-11-01", "2026-11-10"), title: "Actividad inicial" },
    ];

    render(
      <ActivityGrid
        rows={rows}
        onChange={onChange}
        embedDeliverable
      />
    );

    const titleInput = screen.getByLabelText("Nombre del entregable 1");
    fireEvent.keyDown(titleInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as ActivityRow[]).length).toBe(2);

    fireEvent.paste(titleInput, {
      clipboardData: {
        getData: () => "Paso A\t2026-11-02\t2026-11-04\tFoto\nPaso B\t2026-11-05\t2026-11-08\tChecklist",
      },
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    const pasted = onChange.mock.calls[1][0] as ActivityRow[];
    expect(pasted.length).toBe(3);
    expect(pasted[1].title).toBe("Paso A");
    expect(pasted[1].criterion).toBe("Foto");
    expect(pasted[2].title).toBe("Paso B");
  });
});
