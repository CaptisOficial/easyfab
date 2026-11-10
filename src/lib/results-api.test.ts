import { beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import * as api from "./results-api";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
beforeEach(() => { vi.mocked(invoke).mockReset(); });

it("consulta resultados y evidencia por IDs sin enviar rutas o identidad", async () => {
  vi.mocked(invoke).mockResolvedValue({});
  await api.resultsDetail("project_1");
  expect(invoke).toHaveBeenLastCalledWith("results_detail", { projectId: "project_1" });
  await api.readResultsEvidence("project_1", "a".repeat(64));
  expect(invoke).toHaveBeenLastCalledWith("results_read_evidence", { projectId: "project_1", evidenceId: "a".repeat(64) });
});

it("preserva revisiones y rechazos del contrato en todas las mutaciones", async () => {
  const activity: api.ResultsActivity = { id: "task_1", deliverable_id: "delivery_1", title: "Instalar",
    responsible_id: "eng", forecast_start: "2026-10-29", forecast_due: "2026-11-01", dependency_ids: [],
    status: "in_progress", progress: 25, at_risk: false, hours_spent: null, note: null };
  const common = { project_id: "project_1", expected_revision: "a".repeat(64) };
  const calls = [
    ["results_save_activity", () => api.saveResultsActivity({ ...common, activity }), { ...common, activity }],
    ["results_save_blocker", () => api.saveResultsBlocker({ ...common, blocker_id: "block_1", activity_id: "task_1", reason: "Sin acceso", help_needed: "Autorizar", action: "attend", comment: "En atención" }), { ...common, blocker_id: "block_1", activity_id: "task_1", reason: "Sin acceso", help_needed: "Autorizar", action: "attend", comment: "En atención" }],
    ["results_review", () => api.reviewResultsDeliverable({ ...common, deliverable_id: "delivery_1", action: "return", criteria: [], comment: "Falta evidencia" }), { ...common, deliverable_id: "delivery_1", action: "return", criteria: [], comment: "Falta evidencia" }],
    ["results_set_closure", () => api.setResultsClosure({ ...common, closed: true, confirm_final_outcome: true, comment: "Verificado" }), { ...common, closed: true, confirm_final_outcome: true, comment: "Verificado" }],
    ["results_resolve", () => api.resolveResultsConflict({ project_id: "project_1", stream: "activity/task_1", expected_revisions: ["a".repeat(64), "b".repeat(64)], keep_revision: "a".repeat(64), comment: "Integra" }), { project_id: "project_1", stream: "activity/task_1", expected_revisions: ["a".repeat(64), "b".repeat(64)], keep_revision: "a".repeat(64), comment: "Integra" }],
    ["results_attach_evidence", () => api.attachResultsEvidence({ project_id: "project_1", activity_id: "task_1", expected_revision: "a".repeat(64), name: "prueba.pdf", bytes: [37, 80, 68, 70] }), { project_id: "project_1", activity_id: "task_1", expected_revision: "a".repeat(64), name: "prueba.pdf", bytes: [37, 80, 68, 70] }],
  ] as const;
  for (const [command, perform, input] of calls) {
    vi.mocked(invoke).mockRejectedValue("Revisión obsoleta");
    await expect(perform()).rejects.toBe("Revisión obsoleta");
    expect(invoke).toHaveBeenLastCalledWith(command, { input });
  }
});

it("la activación conserva la selección explícita de migración y el motivo", async () => {
  const input: api.OperationsCommitmentInput = { project_id: "project_1", expected_revision: null,
    commitment: { final_outcome: "Estación disponible", scope: "Instalar y validar", start_date: "2026-10-29", target_date: "2026-11-30", engineer_ids: ["eng"],
      deliverables: [{ id: "delivery_1", title: "Validación", due_date: "2026-11-30", criteria: [{ id: "criterion_1", description: "Capacidad acordada", evidence_required: true }] }] },
    change_reason: "Compromiso inicial", legacy_deliverable_id: "delivery_1" };
  vi.mocked(invoke).mockResolvedValue({});
  await api.saveResultsCommitment(input);
  expect(invoke).toHaveBeenLastCalledWith("results_save_commitment", { input });
});
