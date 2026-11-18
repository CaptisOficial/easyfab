// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WeeklyReport } from "./WeeklyReport";
import { exportWeekly, weeklySnapshot, type WeeklySnapshot } from "../../lib/api";
import { I18nProvider, useI18n } from "../../lib/i18n";
vi.mock("../../lib/api", () => ({ weeklySnapshot: vi.fn(), exportWeekly: vi.fn() }));
afterEach(cleanup);

it("no convierte una actividad terminada en solicitud de aceptación del entregable", async () => {
  const project = { id: "project_1", wbs: "1", name: "Estación", process_area: "FAB", engineer_ids: ["eng"], start_date: "2026-10-26", target_date: "2026-11-30", status: "In Progress" as const };
  const snapshot: WeeklySnapshot = {
    generated_at: "2026-10-30T12:00:00Z", reporting_date: "2026-10-30", prepared_by: "Supervisor",
    projects: [{ project, can_edit: false, can_review: false, declared_progress: null, engineer_progress: [], hours_spent: 2,
      entries: [{ owner_id: "eng", owner_name: "Ingeniero", revision: "a".repeat(64), decision: null, activity: { id: "task_1", project_id: project.id, wbs: "1", task_title: "Instalar", start_date: "2026-10-26", due_date: "2026-10-30", milestone_gate: 100, status: "Completed", supervisor_approved: false, evidence: [], hours_spent: 2 } }] }],
    result_projects: [{ project, commitment: { revision: "b".repeat(64), final_outcome: "Estación disponible", scope: "Instalar", start_date: project.start_date, target_date: project.target_date, engineer_ids: ["eng"], deliverables: [{ id: "delivery_1", title: "Validación", due_date: project.target_date, criteria: [{ id: "c1", description: "Prueba acordada", evidence_required: true }] }] }, baseline: null,
      activities: [], blockers: [], reviews: [], closure: null, history: [], conflicts: [], plan_issues: [], legacy_entries: [], capabilities: { can_plan_activities: false, can_review_deliverables: true, can_change_commitment: true, can_resolve_blockers: true } }],
    incidents: { records: [], legacy: [], catalogs: { version: 1, machines: [], lines: [], failure_types: [] } },
  };
  vi.mocked(weeklySnapshot).mockResolvedValue(snapshot);
  render(<WeeklyReport />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar semana" }));
  await screen.findByText("Entregables en revisión");
  expect(screen.getByText("Entregables en revisión").parentElement?.textContent).toContain("0");
  expect(screen.getByText("Entregables aceptados").parentElement?.textContent).toContain("0");
  expect(screen.getByText(/1 actividades del periodo/).textContent).toContain("0/1 entregables aceptados");
  expect(screen.queryByText("Solicitudes de cierre")).toBeNull();
});

describe("WeeklyReport bilingual & i18n", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(weeklySnapshot).mockReset();
    vi.mocked(exportWeekly).mockReset();
  });

  function LangToggle() {
    const { lang, setLang } = useI18n();
    return (
      <button type="button" onClick={() => setLang(lang === "es" ? "en" : "es")}>
        toggle-lang
      </button>
    );
  }

  function renderWithI18n() {
    return render(
      <I18nProvider>
        <LangToggle />
        <WeeklyReport />
      </I18nProvider>,
    );
  }

  function makeMixedSnapshot(): WeeklySnapshot {
    const p1 = {
      id: "project_1",
      wbs: "1",
      name: "Prensa hidráulica | Hydraulic press",
      process_area: "FAB",
      engineer_ids: ["eng1"],
      start_date: "2026-10-26",
      target_date: "2026-11-30",
      status: "In Progress" as const,
    };
    const p2 = {
      id: "project_2",
      wbs: "2",
      name: "Troqueladora Norte",
      process_area: "FAB",
      engineer_ids: ["eng2", "eng3"],
      start_date: "2026-10-20",
      target_date: "2026-12-05",
      target_hours: 12,
      status: "In Progress" as const,
    };
    return {
      generated_at: "2026-10-30T12:00:00Z",
      reporting_date: "2026-10-30",
      prepared_by: "Supervisor",
      projects: [
        {
          project: p1,
          can_edit: false,
          can_review: false,
          declared_progress: null,
          engineer_progress: [],
          hours_spent: null,
          entries: [
            {
              owner_id: "eng1",
              owner_name: "Ana",
              revision: "a".repeat(64),
              decision: null,
              activity: {
                id: "t1",
                project_id: p1.id,
                wbs: "1",
                task_title: "Montaje",
                start_date: "2026-10-26",
                due_date: "2026-10-30",
                milestone_gate: 100,
                status: "Completed",
                supervisor_approved: false,
                evidence: [],
                hours_spent: 2,
              },
            },
          ],
        },
        {
          project: p2,
          can_edit: false,
          can_review: false,
          declared_progress: 65,
          engineer_progress: [
            { engineer_id: "eng2", engineer_name: "Ana", progress: null },
            { engineer_id: "eng3", engineer_name: "Luis", progress: 65 },
          ],
          hours_spent: 8.5,
          entries: [
            {
              owner_id: "eng2",
              owner_name: "Ana",
              revision: "b".repeat(64),
              decision: null,
              activity: {
                id: "t2",
                project_id: p2.id,
                wbs: "2",
                task_title: "Ajuste",
                start_date: "2026-10-26",
                due_date: "2026-10-30",
                milestone_gate: 100,
                status: "Completed",
                supervisor_approved: true,
                evidence: [],
                hours_spent: 8.5,
              },
            },
          ],
        },
      ],
      result_projects: [
        {
          project: p1,
          commitment: {
            revision: "c".repeat(64),
            final_outcome: "Prensa lista",
            scope: "Montaje",
            start_date: p1.start_date,
            target_date: p1.target_date,
            engineer_ids: ["eng1"],
            deliverables: [
              { id: "d1", title: "Validación", due_date: p1.target_date, criteria: [{ id: "c1", description: "OK", evidence_required: true }] },
            ],
          },
          baseline: null,
          activities: [],
          blockers: [
            {
              id: "b1",
              blocker: {
                id: "b1",
                title: "Falta pieza",
                detail: "Esperando proveedor",
                owner_id: "eng1",
                created_at: "2026-10-27T08:00:00Z",
                resolved_at: null,
              },
              owner_name: "Ana",
              resolved_by_name: null,
            },
          ],
          reviews: [],
          closure: null,
          history: [],
          conflicts: [],
          plan_issues: [],
          legacy_entries: [],
          capabilities: { can_plan_activities: false, can_review_deliverables: true, can_change_commitment: true, can_resolve_blockers: true },
        },
      ],
      incidents: {
        records: [
          {
            issue_id: "i1",
            can_correct: true,
            leaves: [
              {
                id: "leaf1",
                issue_id: "i1",
                recorded_at: "2026-10-29T10:00:00Z",
                author_id: "sup1",
                reported_by: "Sup",
                supersedes: [],
                issue: {
                  part_number: "P1",
                  description: "Paro",
                  machine_station: "m1",
                  occurrence_date: "2026-10-29",
                  target_due_date: "",
                  downtime_hours: 1.5,
                  scrap_pieces: 4,
                  impact_level: "Alto",
                  status: "Open",
                  root_cause_containment: "Ajuste",
                  failure_type_id: null,
                },
              },
            ],
            history: [],
          },
        ],
        legacy: [],
        catalogs: { version: 1, machines: [], lines: [], failure_types: [] },
      },
    };
  }

  it("switches all UI copy, aria-labels, KPIs, and project card labels between es and en", async () => {
    vi.mocked(weeklySnapshot).mockResolvedValue(makeMixedSnapshot());
    renderWithI18n();

    fireEvent.click(screen.getByRole("button", { name: "Consultar semana" }));
    await screen.findByRole("list", { name: "Proyectos del periodo" });

    expect(screen.getByText("FABRICATION · 10.FAB")).toBeTruthy();
    expect(screen.getByText("Resumen semanal")).toBeTruthy();
    expect(
      screen.getByText(
        "Aceptaciones vigentes al consultar. Una actividad terminada no equivale a un entregable aceptado. 1 cierres de actividades del formato anterior.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("4 piezas")).toBeTruthy();
    expect(screen.getByText(/1 actividades del periodo · 0\/1 entregables aceptados/)).toBeTruthy();
    expect(screen.getByText(/1 actividades del periodo · 1 cierres del formato anterior/)).toBeTruthy();
    expect(screen.getByText("Sin definir")).toBeTruthy();
    expect(screen.getByText("Sin datos completos")).toBeTruthy();
    expect(screen.getByText("Ana: Sin declarar · Luis: 65%")).toBeTruthy();
    expect(screen.getAllByText(/Objetivo:/)).toHaveLength(2);
    expect(screen.getAllByText(/Invertido acumulado:/)).toHaveLength(2);
    expect(screen.getByText(/Bloqueos abiertos:/)).toBeTruthy();
    expect(screen.getByText(/Avance declarado:/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "toggle-lang" }));

    expect(screen.getByText("Weekly summary")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Projects in period" })).toBeTruthy();
    expect(
      screen.getByText(
        "Current acceptances at query time. A finished activity does not equal an accepted deliverable. 1 legacy-format activity closures.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("4 pieces")).toBeTruthy();
    expect(screen.getByText(/1 activities in period · 0\/1 deliverables accepted/)).toBeTruthy();
    expect(screen.getByText(/1 activities in period · 1 legacy-format closures/)).toBeTruthy();
    expect(screen.getByText("Not set")).toBeTruthy();
    expect(screen.getByText("Incomplete data")).toBeTruthy();
    expect(screen.getByText("Ana: Not declared · Luis: 65%")).toBeTruthy();
    expect(screen.getAllByText(/Target:/)).toHaveLength(2);
    expect(screen.getAllByText(/Cumulative spent:/)).toHaveLength(2);
    expect(screen.getByText(/Open blockers:/)).toBeTruthy();
    expect(screen.getByText(/Declared progress:/)).toBeTruthy();
  });

  it("renders bilingual project names via pick() with Spanish fallback", async () => {
    vi.mocked(weeklySnapshot).mockResolvedValue(makeMixedSnapshot());
    renderWithI18n();

    fireEvent.click(screen.getByRole("button", { name: "Consultar semana" }));
    await screen.findByText("1 · Prensa hidráulica");
    expect(screen.getByText("2 · Troqueladora Norte")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "toggle-lang" }));
    expect(screen.getByText("1 · Hydraulic press")).toBeTruthy();
    expect(screen.getByText("2 · Troqueladora Norte")).toBeTruthy();
  });

  it("translates backend snapshot and export errors via tError and updates reactively on language change", async () => {
    vi.mocked(weeklySnapshot).mockRejectedValue("El reporte del área corresponde a Supervisor o Admin.");
    renderWithI18n();

    fireEvent.click(screen.getByRole("button", { name: "Consultar semana" }));
    expect((await screen.findByRole("alert")).textContent).toBe("El reporte del área corresponde a Supervisor o Admin.");

    fireEvent.click(screen.getByRole("button", { name: "toggle-lang" }));
    expect(screen.getByRole("alert").textContent).toBe("Area reporting is restricted to Supervisor or Admin.");

    vi.mocked(exportWeekly).mockRejectedValue(
      "Excel no completó el reporte. Revisa que Microsoft Excel esté instalado y disponible.\nLa estructura del reporte exportado no coincide con el snapshot.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Export weekly Excel" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Excel did not complete the report. Check that Microsoft Excel is installed and available. The exported report structure does not match the snapshot.",
    );
  });

  it("renders localized Excel export confirmation in es and en", async () => {
    vi.mocked(exportWeekly).mockResolvedValue({
      path: "C:\\exports\\KMX-FW-2026-10-30-abc.xlsx",
      sha256: "deadbeef",
    });
    renderWithI18n();

    fireEvent.click(screen.getByRole("button", { name: "Exportar Excel semanal" }));
    expect(await screen.findByText("Reporte Excel guardado.")).toBeTruthy();
    expect(screen.getByText("C:\\exports\\KMX-FW-2026-10-30-abc.xlsx")).toBeTruthy();
    expect(screen.getByText("SHA256: deadbeef")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "toggle-lang" }));
    expect(screen.getByText("Excel report saved.")).toBeTruthy();
  });
});
