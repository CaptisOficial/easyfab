// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ResultsGantt } from "./ResultsWorkGantt";
import { ProjectTimeline } from "./ProjectTimeline";
import type { OperationsActivityEntry, ResultsDeliverable } from "../../lib/results-api";
import type { ProjectsOverview } from "../../lib/api";

afterEach(cleanup);

const deliverable: ResultsDeliverable = {
  id: "deliv_1",
  title: "Estación validada",
  due_date: "2026-11-30",
  criteria: [{ id: "crit_1", description: "Capacidad verificada", evidence_required: true }],
};

const activityEntry: OperationsActivityEntry = {
  revision: "a".repeat(64),
  created_by: "eng",
  edited_by: "eng",
  recorded_at: "2026-10-30T12:00:00Z",
  activity: {
    id: "act_1",
    deliverable_id: "deliv_1",
    title: "Instalar prensa hidráulica",
    responsible_id: "Juan Pérez",
    forecast_start: "2026-11-02",
    forecast_due: "2026-11-12",
    dependency_ids: [],
    status: "in_progress",
    progress: 50,
    at_risk: true,
    hours_spent: null,
    note: null,
  },
  evidence: [],
};

describe("ResultsWorkGantt", () => {
  it("muestra fechas exactas de inicio, fin y duración al hacer hover o focus en la barra de actividad", () => {
    render(
      <ResultsGantt
        entries={[activityEntry]}
        deliverables={[deliverable]}
        projectStart="2026-11-01"
        projectTarget="2026-11-30"
        canPlan
        onUpdateActivity={vi.fn()}
      />
    );

    const bar = screen.getByRole("button", {
      name: /Instalar prensa hidráulica, del 2026-11-02 al 2026-11-12, avance 50%/,
    });

    fireEvent.mouseEnter(bar);
    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText("Instalar prensa hidráulica")).toBeTruthy();
    expect(within(tooltip).getByText("2026-11-02")).toBeTruthy();
    expect(within(tooltip).getByText("2026-11-12")).toBeTruthy();
    expect(within(tooltip).getByText("11 días")).toBeTruthy();
    expect(within(tooltip).getByText("En riesgo")).toBeTruthy();

    fireEvent.mouseLeave(bar);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.focus(bar);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("permite expandir/contraer el entregable independientemente y activar actividad con teclado", () => {
    const onUpdate = vi.fn();
    render(
      <ResultsGantt
        entries={[activityEntry]}
        deliverables={[deliverable]}
        projectStart="2026-11-01"
        projectTarget="2026-11-30"
        canPlan
        onUpdateActivity={onUpdate}
      />
    );

    const bar = screen.getByRole("button", { name: /Instalar prensa hidráulica/ });
    fireEvent.keyDown(bar, { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    const toggleBtn = screen.getByRole("button", { name: "Contraer Estación validada" });
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggleBtn);
    expect(screen.getByRole("button", { name: "Expandir Estación validada" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Instalar prensa hidráulica")).toBeNull();
  });
});

describe("ProjectTimeline compacto y tooltip", () => {
  it("compacta múltiples responsables en iniciales apiladas con +N y muestra fechas exactas en hover", () => {
    const data: ProjectsOverview = {
      can_create: false,
      write_message: "Solo lectura",
      leads: [
        { id: "eng1", name: "Juan Pérez" },
        { id: "eng2", name: "Ana López" },
        { id: "eng3", name: "Carlos Ruiz" },
      ],
      projects: [
        {
          id: "PRJ-1",
          wbs: "FAB-10",
          name: "Línea Soldadura",
          process_area: "Soldadura de Cuadros",
          engineer_ids: ["eng1", "eng2", "eng3"],
          start_date: "2026-11-01",
          target_date: "2026-11-20",
          status: "In Progress",
        },
      ],
    };

    render(<ProjectTimeline data={data} onOpen={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Fecha de referencia"), { target: { value: "2026-11-05" } });

    const respCell = screen.getByRole("cell", { name: "Juan Pérez, Ana López, Carlos Ruiz" });
    expect(within(respCell).getByText("JP")).toBeTruthy();
    expect(within(respCell).getByText("AL")).toBeTruthy();
    expect(within(respCell).getByText("+1")).toBeTruthy();

    const bars = screen.getAllByLabelText("Línea Soldadura: 2026-11-01 a 2026-11-20");
    fireEvent.mouseEnter(bars[0]);
    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText("2026-11-01")).toBeTruthy();
    expect(within(tooltip).getByText("2026-11-20")).toBeTruthy();
    expect(within(tooltip).getByText("20 días")).toBeTruthy();
  });
});
