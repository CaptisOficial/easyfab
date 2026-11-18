// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitmentEditor, commitmentError, emptyCommitment } from "./CommitmentEditor";

afterEach(cleanup);

describe("CommitmentEditor", () => {
  it("muestra el campo consolidado de resultado esperado y alcance", () => {
    const commitment = emptyCommitment();
    commitment.final_outcome = "Línea lista";
    commitment.scope = "Línea lista";
    render(<CommitmentEditor value={commitment} onChange={() => {}} />);

    const field = screen.getByLabelText("Resultado esperado y alcance") as HTMLTextAreaElement;
    expect(field).toBeTruthy();
    expect(field.value).toBe("Línea lista");
  });

  it("actualiza final_outcome y scope de forma sincronizada al escribir", () => {
    const commitment = emptyCommitment();
    const onChange = vi.fn();
    render(<CommitmentEditor value={commitment} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Resultado esperado y alcance"), {
      target: { value: "Instalación completada y verificada" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        final_outcome: "Instalación completada y verificada",
        scope: "Instalación completada y verificada",
      })
    );
  });

  it("renderiza los entregables en formato de tabla similar a la rejilla de subactividades", () => {
    const commitment = emptyCommitment();
    commitment.deliverables = [
      {
        id: "d1",
        title: "Dispositivo ensamble",
        due_date: "2026-11-15",
        criteria: [{ id: "c1", description: "Prueba de ciclo <45s", evidence_required: true }],
      },
    ];

    render(<CommitmentEditor value={commitment} onChange={() => {}} />);

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("Entregables y criterios de aceptación (1)")).toBeTruthy();
    expect(screen.getByLabelText("Nombre del entregable 1")).toHaveProperty("value", "Dispositivo ensamble");
    expect(screen.getByLabelText("Criterio 1.1")).toHaveProperty("value", "Prueba de ciclo <45s");
    expect(screen.getByLabelText("Fecha del entregable 1")).toHaveProperty("value", "2026-11-15");
    expect(screen.getByLabelText("Evidencia requerida para criterio 1.1")).toHaveProperty("checked", true);
  });

  it("permite añadir un nuevo entregable a la tabla", async () => {
    const user = userEvent.setup();
    const commitment = emptyCommitment();
    const onChange = vi.fn();

    render(<CommitmentEditor value={commitment} onChange={onChange} defaultDueDate="2026-11-30" />);

    await user.click(screen.getByRole("button", { name: "+ Añadir entregable" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        deliverables: expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), due_date: "2026-11-30" }),
        ]),
      })
    );
  });

  it("permite añadir un criterio secundario al entregable", async () => {
    const user = userEvent.setup();
    const commitment = emptyCommitment();
    const onChange = vi.fn();

    render(<CommitmentEditor value={commitment} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "+ Añadir criterio al entregable 1" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        deliverables: [
          expect.objectContaining({
            criteria: expect.arrayContaining([
              expect.objectContaining({ id: expect.any(String), description: "" }),
            ]),
          }),
        ],
      })
    );
  });

  it("valida que resultado esperado y alcance, y entregables estén completos", () => {
    const draft = emptyCommitment();
    expect(commitmentError(draft)).toBe("Define el resultado esperado y alcance del proyecto.");

    draft.final_outcome = "Estación disponible";
    draft.scope = "Estación disponible";
    expect(commitmentError(draft)).toBe("Completa los entregables, sus fechas y criterios de aceptación.");

    draft.deliverables[0].title = "Validación";
    draft.deliverables[0].due_date = "2026-11-20";
    draft.deliverables[0].criteria[0].description = "Inspección aprobada";
    expect(commitmentError(draft)).toBeNull();
  });

  it("permite capturar la fecha de inicio de la actividad por entregable cuando se habilita onActivityStartDateChange", () => {
    const commitment = emptyCommitment();
    commitment.start_date = "2026-11-01";
    commitment.deliverables = [
      {
        id: "d1",
        title: "Dispositivo ensamble",
        due_date: "2026-11-15",
        criteria: [{ id: "c1", description: "Prueba de ciclo", evidence_required: true }],
      },
    ];
    const onStartChange = vi.fn();

    render(
      <CommitmentEditor
        value={commitment}
        onChange={() => {}}
        activityStartDates={{ d1: "2026-11-03" }}
        onActivityStartDateChange={onStartChange}
      />
    );

    const startInput = screen.getByLabelText("Inicio del entregable 1") as HTMLInputElement;
    expect(startInput.value).toBe("2026-11-03");
    fireEvent.change(startInput, { target: { value: "2026-11-05" } });
    expect(onStartChange).toHaveBeenCalledWith("d1", "2026-11-05");
  });
});
