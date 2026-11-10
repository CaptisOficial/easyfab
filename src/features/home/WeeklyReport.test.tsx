// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WeeklyReport } from "./WeeklyReport";
import { weeklySnapshot, type WeeklySnapshot } from "../../lib/api";
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
