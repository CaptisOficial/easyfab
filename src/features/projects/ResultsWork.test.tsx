// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsWork } from "./ResultsWork";
import * as api from "../../lib/results-api";

vi.mock("../../lib/results-api", () => ({ resultsDetail: vi.fn(), saveResultsCommitment: vi.fn(), saveResultsActivity: vi.fn(), saveResultsBlocker: vi.fn(), requestActivityRevision: vi.fn(), reviewResultsDeliverable: vi.fn(), setResultsClosure: vi.fn(), resolveResultsConflict: vi.fn(), attachResultsEvidence: vi.fn(), readResultsEvidence: vi.fn() }));
afterEach(cleanup);
const rev = (letter: string) => letter.repeat(64);
function fixture(role: "engineer" | "supervisor" | "admin" = "engineer"): api.ResultsDetail {
  const commitment: api.ResultsCommitment = { revision: rev("a"), final_outcome: "Estación lista para producción", scope: "Instalar y validar", start_date: "2026-10-29", target_date: "2026-11-30", engineer_ids: ["eng", "eng2"], deliverables: [{ id: "delivery_1", title: "Estación validada", due_date: "2026-11-30", criteria: [{ id: "capacity", description: "Capacidad verificada", evidence_required: true }] }] };
  return {
    project: { id: "project_1", wbs: "FAB-1", name: "Proyecto sintético", process_area: "FAB", engineer_ids: ["eng", "eng2"], start_date: "2026-10-29", target_date: "2026-11-30", status: "In Progress" },
    commitment, baseline: structuredClone(commitment), activities: [{ revision: rev("b"), created_by: "eng2", edited_by: "eng", recorded_at: "2026-10-30T12:00:00Z", activity: { id: "task_1", deliverable_id: "delivery_1", title: "Instalar estación", responsible_id: "eng2", forecast_start: "2026-10-29", forecast_due: "2026-11-10", dependency_ids: [], status: "in_progress", progress: 25, at_risk: false, hours_spent: null, note: null }, evidence: [{ id: rev("c"), name: "prueba.pdf", relative_path: `evidence/${rev("c")}.pdf`, sha256: rev("d"), size: 6 }] }],
    blockers: [], reviews: [], closure: null,
    capabilities: { can_plan_activities: role === "engineer" || role === "supervisor", can_change_commitment: role === "supervisor", can_review_deliverables: role === "supervisor", can_resolve_blockers: role === "supervisor" },
    history: [], conflicts: [], plan_issues: [], legacy_entries: [],
  };
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.resultsDetail).mockResolvedValue(fixture()); });
async function mount(value = fixture()) {
  vi.mocked(api.resultsDetail).mockResolvedValue(value);
  render(<ResultsWork projectId="project_1" onBack={vi.fn()} />);
  await screen.findByText("Estación lista para producción");
}
function form(dialog: HTMLElement) { return within(dialog).getByRole("button", { name: /Guardar avance|Guardar actualización|Reportar bloqueo|Atender bloqueo|Resolver bloqueo|Solicitar revisión|Cerrar proyecto|Reabrir proyecto|Integrar versiones/ }).closest("form")!; }
function submitted(value = fixture("supervisor")): api.ResultsDetail {
  value.reviews = [{ revision: rev("e"), deliverable_id: "delivery_1", commitment_revision: rev("a"), status: "submitted", submission: { id: rev("f"), deliverable_id: "delivery_1", commitment_revision: rev("a"), criteria: [{ criterion_id: "capacity", fulfilled: true, evidence_ids: [rev("c")] }] }, decision: null }];
  return value;
}
function accepted(value = submitted()): api.ResultsDetail {
  value.reviews[0].status = "accepted";
  value.reviews[0].decision = { id: rev("d"), project_id: "project_1", deliverable_id: "delivery_1", submission_id: rev("f"), commitment_revision: rev("a"), accepted: true, comment: "Verificado", supervisor_id: "supervisor", recorded_at: "2026-10-30T12:00:00Z", signature: rev("b") };
  return value;
}

it("simplifica la vista de Engineer al estado actual, entregables y Gantt sin tabla ni acciones redundantes", async () => {
  await mount();
  const gantt = screen.getByRole("region", { name: "Gantt de actividades" });
  expect(within(gantt).getByText("Instalar estación")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Agregar actividad en Estación validada" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Entregables y validación" })).toBeNull();
  expect(screen.queryByRole("table", { name: "Actividades del proyecto" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Nueva actividad" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Reportes de las actividades" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Bloqueos y seguimiento" })).toBeNull();
  expect(screen.queryByText(/Historial del proyecto/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Editar compromiso y DoD" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Cerrar proyecto" })).toBeNull();
  expect(screen.queryByText("Métricas operativas y cohorte semanal")).toBeNull();
});

it("omite las secciones redundantes de métricas operativas y reportes de actividades en favor del historial", async () => {
  await mount(fixture("engineer"));
  expect(screen.queryByText("Métricas operativas y cohorte semanal")).toBeNull();
  expect(screen.queryByRole("region", { name: "Reportes de las actividades" })).toBeNull();

  cleanup();
  await mount(fixture("supervisor"));
  expect(screen.queryByText("Métricas operativas y cohorte semanal")).toBeNull();
  expect(screen.queryByRole("region", { name: "Reportes de las actividades" })).toBeNull();
  expect(screen.getByText(/Historial del proyecto/)).toBeTruthy();
});

it("Admin consulta sin controles de edición ni aceptación", async () => {
  await mount(fixture("admin"));
  expect(screen.queryByRole("button", { name: "Nueva actividad" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Actualizar Instalar|Bloqueo en|Solicitar aceptación|Editar compromiso|Cerrar proyecto/ })).toBeNull();
  expect(screen.getByRole("table", { name: "Actividades del proyecto" })).toBeTruthy();
});

it("guarda actividad cumplida sin solicitar aceptación y sin campos de planeación", async () => {
  const next = fixture(); next.activities[0].activity.progress = 100; next.activities[0].activity.status = "done"; next.activities[0].revision = rev("d");
  vi.mocked(api.saveResultsActivity).mockResolvedValue(next);
  await mount();
  await userEvent.click(screen.getByRole("button", { name: "Agregar actividad en Estación validada" }));
  const dialog = screen.getByRole("dialog", { name: "Actualizar actividad" });
  expect(within(dialog).queryByText("Editar planeación y horas")).toBeNull();
  expect(within(dialog).getByText("Condición anterior")).toBeTruthy();
  expect(within(dialog).getByText("Nueva condición (Avance)")).toBeTruthy();
  await userEvent.click(within(dialog).getByLabelText(/cumple la condición para el cierre/i));
  fireEvent.submit(form(dialog));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.saveResultsActivity).toHaveBeenCalledWith({ project_id: "project_1", expected_revision: rev("b"), activity: expect.objectContaining({ id: "task_1", progress: 100, status: "done", responsible_id: "eng2", forecast_due: "2026-11-10", note: null }) });
  expect(api.reviewResultsDeliverable).not.toHaveBeenCalled();
  expect(api.attachResultsEvidence).not.toHaveBeenCalled();
});

it("un avance positivo inicia una actividad y un error conserva la nota y el modal", async () => {
  const initial = fixture(); initial.activities[0].activity.status = "not_started"; initial.activities[0].activity.progress = 0;
  vi.mocked(api.saveResultsActivity).mockRejectedValue("La revisión cambió");
  await mount(initial);
  await userEvent.click(screen.getByRole("button", { name: "Agregar actividad en Estación validada" }));
  const dialog = screen.getByRole("dialog", { name: "Actualizar actividad" });
  fireEvent.change(within(dialog).getByLabelText(/^Nueva condición/i, { selector: "textarea" }), { target: { value: "Base instalada" } });
  fireEvent.submit(form(dialog));
  expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", "La revisión cambió");
  expect((within(dialog).getByLabelText(/^Nueva condición/i, { selector: "textarea" }) as HTMLTextAreaElement).value).toBe("Base instalada");
  expect(api.saveResultsActivity).toHaveBeenCalledWith(expect.objectContaining({ activity: expect.objectContaining({ status: "in_progress", progress: 50 }) }));
});

it("mantiene exclusión de envío y cierre durante guardado y archivo, y reintenta evidencia sin duplicar actividad", async () => {
  let finishSave!: (detail: api.ResultsDetail) => void;
  let failAttachment!: (error: string) => void;
  vi.mocked(api.saveResultsActivity).mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
  vi.mocked(api.attachResultsEvidence).mockImplementationOnce(() => new Promise((_resolve, reject) => { failAttachment = reject; })).mockResolvedValueOnce(fixture());
  await mount();
  const opener = screen.getByRole("button", { name: "Agregar actividad en Estación validada" });
  await userEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Actualizar actividad" });
  fireEvent.change(within(dialog).getByLabelText(/^Nueva condición/i, { selector: "textarea" }), { target: { value: "Nueva nota" } });
  const file = new File(["%PDF-1"], "evidencia.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45, 49]).buffer) });
  fireEvent.change(within(dialog).getByLabelText(/Evidencia · opcional/), { target: { files: [file] } });
  const activityForm = form(dialog);
  fireEvent.submit(activityForm); fireEvent.submit(activityForm);
  expect(api.saveResultsActivity).toHaveBeenCalledTimes(1);
  expect((within(dialog).getByRole("button", { name: "Cerrar actualizar actividad" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(dialog, { key: "Escape" }); expect(screen.getByRole("dialog")).toBeTruthy();
  const saved = fixture(); saved.activities[0].activity.note = "Nueva nota"; saved.activities[0].revision = rev("d");
  finishSave(saved);
  await waitFor(() => expect(api.attachResultsEvidence).toHaveBeenCalledTimes(1));
  fireEvent.submit(activityForm); expect(api.saveResultsActivity).toHaveBeenCalledTimes(1);
  expect((within(dialog).getByRole("button", { name: "Cerrar actualizar actividad" }) as HTMLButtonElement).disabled).toBe(true);
  failAttachment("No se publicó el archivo");
  expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", "No se publicó el archivo");
  expect(screen.getByText(/El avance ya está guardado/)).toBeTruthy();
  fireEvent.submit(activityForm);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.saveResultsActivity).toHaveBeenCalledTimes(1);
  expect(api.attachResultsEvidence).toHaveBeenCalledTimes(2);
  expect(api.attachResultsEvidence).toHaveBeenLastCalledWith(expect.objectContaining({ activity_id: "task_1", expected_revision: rev("d"), name: "evidencia.pdf" }));
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

it("reporta un bloqueo con impedimento y ayuda desde el entregable, sin aprobar entregable", async () => {
  const saved = fixture();
  saved.activities[0].activity.at_risk = true;
  vi.mocked(api.saveResultsActivity).mockResolvedValue(saved);
  vi.mocked(api.saveResultsBlocker).mockResolvedValue(saved);
  await mount();
  await userEvent.click(screen.getByRole("button", { name: "Agregar actividad en Estación validada" }));
  const dialog = screen.getByRole("dialog", { name: "Actualizar actividad" });
  await userEvent.click(within(dialog).getByLabelText(/¿Riesgo en fecha objetivo/i));
  fireEvent.change(within(dialog).getByLabelText("Problema / impedimento"), { target: { value: "Sin acceso" } });
  fireEvent.change(within(dialog).getByLabelText("Ayuda requerida"), { target: { value: "Autorizar entrada" } });
  fireEvent.submit(form(dialog));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.saveResultsBlocker).toHaveBeenCalledWith({ project_id: "project_1", blocker_id: null, expected_revision: null, activity_id: "task_1", reason: "Sin acceso", help_needed: "Autorizar entrada", action: "report", comment: "" });
  expect(api.reviewResultsDeliverable).not.toHaveBeenCalled();
});

it("Supervisor registra atención y resolución como acciones diferentes con motivo", async () => {
  const initial = fixture("supervisor");
  initial.blockers = [{ revision: rev("f"), reported_by: "eng", edited_by: "eng", recorded_at: "2026-10-30T12:00:00Z", blocker: { id: "block_1", activity_id: "task_1", reason: "Sin acceso", help_needed: "Autorizar entrada", reported_at: "2026-10-30T12:00:00Z", first_attention_at: null, resolved_at: null, resolution_note: null } }];
  const attended = structuredClone(initial); attended.blockers[0].blocker.first_attention_at = "2026-10-30T13:00:00Z"; attended.blockers[0].revision = rev("d");
  vi.mocked(api.saveResultsBlocker).mockResolvedValueOnce(attended).mockResolvedValueOnce(fixture("supervisor"));
  await mount(initial);
  await userEvent.click(screen.getByRole("button", { name: "Registrar atención a Sin acceso" }));
  let dialog = screen.getByRole("dialog", { name: "Atender bloqueo" });
  fireEvent.change(within(dialog).getByLabelText("Atención realizada"), { target: { value: "Solicité autorización" } });
  fireEvent.submit(form(dialog));
  await screen.findByText("Atendido · sigue abierto");
  expect(api.saveResultsBlocker).toHaveBeenLastCalledWith(expect.objectContaining({ action: "attend", expected_revision: rev("f"), comment: "Solicité autorización" }));
  await userEvent.click(screen.getByRole("button", { name: "Resolver Sin acceso" }));
  dialog = screen.getByRole("dialog", { name: "Resolver bloqueo" });
  fireEvent.change(within(dialog).getByLabelText("Solución realizada"), { target: { value: "Acceso autorizado" } });
  fireEvent.submit(form(dialog));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.saveResultsBlocker).toHaveBeenLastCalledWith(expect.objectContaining({ action: "resolve", expected_revision: rev("d"), comment: "Acceso autorizado" }));
});

it("no muestra revisiones individuales de entregables y habilita el cierre para evaluarlos en conjunto", async () => {
  await mount(fixture("supervisor"));
  expect(screen.queryByRole("button", { name: /Solicitar aceptación/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /Aceptar /i })).toBeNull();
  expect(screen.queryByRole("button", { name: /Devolver /i })).toBeNull();
  expect((screen.getByRole("button", { name: "Cerrar proyecto" }) as HTMLButtonElement).disabled).toBe(false);
});

it("Supervisor puede revisar documentos de una actividad finalizada y solicitar revisión", async () => {
  const initial = fixture("supervisor");
  initial.activities[0].activity.status = "done";
  initial.activities[0].activity.progress = 100;
  const afterRevision = structuredClone(initial);
  afterRevision.activities[0].activity.status = "in_progress";
  afterRevision.activities[0].activity.progress = 75;
  afterRevision.activities[0].activity.note = "[Revisión solicitada]: Falta firma en el reporte";
  vi.mocked(api.requestActivityRevision).mockResolvedValue(afterRevision);
  await mount(initial);
  await userEvent.click(screen.getByRole("button", { name: "Solicitar revisión de Instalar estación" }));
  const dialog = screen.getByRole("dialog", { name: "Revisar actividad finalizada" });
  expect(within(dialog).getByRole("button", { name: "prueba.pdf" })).toBeTruthy();
  fireEvent.submit(form(dialog));
  expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", "Describe el motivo o las observaciones de la revisión.");
  fireEvent.change(within(dialog).getByLabelText("Observaciones / motivo de revisión · obligatorio"), { target: { value: "Falta firma en el reporte" } });
  fireEvent.submit(form(dialog));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.requestActivityRevision).toHaveBeenCalledWith({
    project_id: "project_1",
    activity_id: "task_1",
    expected_revision: rev("b"),
    comment: "Falta firma en el reporte",
  });
});

it("el cierre evalúa entregables en conjunto y exige comprobación explícita del Supervisor", async () => {
  const closed = fixture("supervisor");
  closed.closure = { revision: rev("f"), closed: true, commitment_revision: rev("a"), recorded_at: "2026-10-30T15:00:00Z", author_id: "supervisor", comment: "Estado final comprobado" };
  vi.mocked(api.setResultsClosure).mockResolvedValue(closed);
  await mount(fixture("supervisor"));
  await userEvent.click(screen.getByRole("button", { name: "Cerrar proyecto" }));
  const dialog = screen.getByRole("dialog", { name: "Cerrar proyecto" });
  expect(within(dialog).getByRole("button", { name: "prueba.pdf" })).toBeTruthy();
  fireEvent.change(within(dialog).getByLabelText("Motivo del cierre"), { target: { value: "Estado final comprobado" } });
  fireEvent.submit(form(dialog));
  expect(api.setResultsClosure).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByLabelText(/Estación validada/));
  await userEvent.click(within(dialog).getByLabelText("He comprobado el estado final acordado y evaluado los entregables de cierre."));
  fireEvent.submit(form(dialog));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.setResultsClosure).toHaveBeenCalledWith({ project_id: "project_1", expected_revision: null, closed: true, confirm_final_outcome: true, comment: "Estado final comprobado" });
  expect(screen.getByText("Proyecto cerrado")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reabrir proyecto" })).toBeTruthy();
});

it("resuelve conflictos enviando todas las alternativas y devuelve el foco al cerrar", async () => {
  const initial = fixture("supervisor");
  initial.conflicts = [{ stream: "activity/task_1", revisions: [{ revision: rev("b"), author_id: "eng", recorded_at: "2026-10-30T12:00:00Z", summary: "Instalación A" }, { revision: rev("c"), author_id: "eng2", recorded_at: "2026-10-30T12:01:00Z", summary: "Instalación B" }] }];
  vi.mocked(api.resolveResultsConflict).mockResolvedValue(fixture("supervisor"));
  await mount(initial);
  const opener = screen.getByRole("button", { name: "Resolver versiones de actividad 1" });
  await userEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Resolver conflicto" });
  const close = within(dialog).getByRole("button", { name: "Cerrar resolver conflicto" });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Integrar versiones" }));
  await userEvent.click(within(dialog).getByRole("radio", { name: /Instalación B/ }));
  fireEvent.change(within(dialog).getByLabelText("Motivo de la integración"), { target: { value: "Conservar la integración de ambas piezas" } });
  fireEvent.submit(form(dialog));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.resolveResultsConflict).toHaveBeenCalledWith({ project_id: "project_1", stream: "activity/task_1", expected_revisions: [rev("b"), rev("c")], keep_revision: rev("c"), comment: "Conservar la integración de ambas piezas" });
});

it("permite resolver un compromiso en conflicto aunque no exista una versión vigente", async () => {
  const initial = fixture("supervisor"); initial.commitment = null; initial.baseline = null;
  initial.conflicts = [{ stream: "commitment", revisions: [{ revision: rev("a"), author_id: "supervisor", recorded_at: "2026-10-30T12:00:00Z", summary: "Alternativa inicial" }, { revision: rev("b"), author_id: "supervisor", recorded_at: "2026-10-30T12:01:00Z", summary: "Alternativa revisada" }] }];
  vi.mocked(api.resultsDetail).mockResolvedValue(initial);
  render(<ResultsWork projectId="project_1" onBack={vi.fn()} />);
  await screen.findByText("Resuelve las versiones del compromiso antes de continuar la planeación.");
  expect(screen.getByRole("button", { name: "Resolver versiones de compromiso del proyecto" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Definir DoD y activar flujo" })).toBeNull();
});

it("Engineer espera la definición del Supervisor cuando el proyecto aún no tiene DoD", async () => {
  const initial = fixture(); initial.commitment = null; initial.baseline = null; initial.activities = [];
  vi.mocked(api.resultsDetail).mockResolvedValue(initial);
  render(<ResultsWork projectId="project_1" onBack={vi.fn()} />);
  await screen.findByText("El Supervisor debe definir las condiciones de cierre para habilitar la planeación.");
  expect(screen.queryByRole("button", { name: "Nueva actividad" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Definir DoD y activar flujo" })).toBeNull();
});

// Individual deliverable review tests (withdraw/accept) removed: deliverables are evaluated at closure.

it("reabre proyecto cerrado con motivo sin habilitar edición cotidiana mientras siga cerrado", async () => {
  const initial = accepted(); initial.closure = { revision: rev("f"), closed: true, commitment_revision: rev("a"), recorded_at: "2026-10-30T15:00:00Z", author_id: "supervisor", comment: "Cierre" };
  const reopened = structuredClone(initial); reopened.closure!.closed = false;
  vi.mocked(api.setResultsClosure).mockResolvedValue(reopened);
  await mount(initial);
  expect(screen.queryByRole("button", { name: "Editar compromiso y DoD" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Reabrir proyecto" }));
  const dialog = screen.getByRole("dialog", { name: "Reabrir proyecto" });
  fireEvent.change(within(dialog).getByLabelText("Motivo del reingreso a ejecución"), { target: { value: "Verificar ajuste solicitado" } });
  fireEvent.submit(form(dialog));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.setResultsClosure).toHaveBeenCalledWith({ project_id: "project_1", expected_revision: rev("f"), closed: false, confirm_final_outcome: false, comment: "Verificar ajuste solicitado" });
  expect(screen.getByRole("button", { name: "Editar compromiso y DoD" })).toBeTruthy();
});

it("activa trabajo anterior solo después de seleccionar explícitamente su entregable", async () => {
  const initial = fixture("supervisor"); initial.commitment = null; initial.baseline = null; initial.activities = [];
  initial.legacy_entries = [{ owner_id: "eng", owner_name: "Engineer", revision: rev("b"), activity: { id: "legacy_1", project_id: "project_1", wbs: "1", task_title: "Trabajo anterior", start_date: "2026-10-29", due_date: "2026-11-10", milestone_gate: 100, status: "Completed", supervisor_approved: true, evidence: [], hours_spent: null }, decision: null }];
  vi.mocked(api.resultsDetail).mockResolvedValue(initial); vi.mocked(api.saveResultsCommitment).mockResolvedValue(fixture("supervisor"));
  render(<ResultsWork projectId="project_1" onBack={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Definir DoD y activar flujo" }));
  const dialog = screen.getByRole("dialog", { name: "Definir cierre del proyecto" });
  fireEvent.change(within(dialog).getByLabelText("Resultado esperado y alcance"), { target: { value: "Estación operativa y validación" } });

  fireEvent.change(within(dialog).getByLabelText("Nombre del entregable 1"), { target: { value: "Validación" } });
  fireEvent.change(within(dialog).getByLabelText("Fecha del entregable 1"), { target: { value: "2026-11-30" } });
  fireEvent.change(within(dialog).getByLabelText("Criterio 1.1"), { target: { value: "Capacidad validada" } });
  fireEvent.change(within(dialog).getByLabelText("Motivo de la definición o cambio"), { target: { value: "Adoptar nuevo método" } });
  const activationForm = within(dialog).getByRole("button", { name: "Guardar DoD y activar" }).closest("form")!;
  fireEvent.submit(activationForm);
  expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", "Selecciona el entregable que recibirá las actividades anteriores para activar este flujo.");
  expect(api.saveResultsCommitment).not.toHaveBeenCalled();
  const target = within(dialog).getByLabelText("Entregable para actividades anteriores") as HTMLSelectElement;
  const chosen = Array.from(target.options).find(option => option.textContent === "Validación")!.value;
  fireEvent.change(target, { target: { value: chosen } });
  fireEvent.submit(activationForm);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.saveResultsCommitment).toHaveBeenCalledWith(expect.objectContaining({ legacy_deliverable_id: chosen, expected_revision: null, change_reason: "Adoptar nuevo método" }));
});


it("consolida estatus y KPIs estratégicos arriba y planeación por entregables con historial para Supervisor", async () => {
  const detail = fixture("supervisor");
  detail.activities[0].activity.note = "Instalación completada y verificada";
  await mount(detail);

  // Estatus superior consolidado embebido en el encabezado (sin botón redundante "Volver a proyectos" ni tarjetas KPI)
  const header = screen.getByRole("banner", { name: "Compromiso y condiciones de cierre" });
  expect(within(header).getByRole("heading", { name: "Proyecto sintético" })).toBeTruthy();
  expect(within(header).getByRole("progressbar", { name: "Avance general del proyecto" })).toBeTruthy();
  expect(within(header).getByText("Avance general del proyecto")).toBeTruthy();
  expect(within(header).getByText("Compromiso")).toBeTruthy();
  expect(within(header).getByText("Entregables")).toBeTruthy();
  expect(within(header).getByRole("button", { name: "Actualizar proyecto" })).toBeTruthy();
  expect(within(header).getByRole("button", { name: "Cerrar proyecto" })).toBeTruthy();
  expect(within(header).getByRole("button", { name: "Cerrar detalle del proyecto" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Volver a proyectos" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Cierre del proyecto" })).toBeNull();
  expect(screen.queryByText("0 bloqueos")).toBeNull();

  // Planeación por entregables + historial sin secciones redundantes
  expect(screen.getByRole("region", { name: "Planeación y ejecución" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Reportes de las actividades" })).toBeNull();
  expect(screen.queryByText("Métricas operativas y cohorte semanal")).toBeNull();
  expect(screen.getByText(/Historial del proyecto/)).toBeTruthy();
});

it("registra avance por entregable agrupando fecha de registro, nueva condición, evidencia y riesgo de fecha objetivo", async () => {
  const initial = fixture("engineer");
  initial.activities = [];
  const saved = fixture("engineer");
  saved.activities[0].activity = {
    ...saved.activities[0].activity,
    forecast_start: "2026-11-05",
    forecast_due: "2026-11-20",
    at_risk: true,
    note: "Pieza recibida con retraso parcial",
    status: "in_progress",
    progress: 50,
  };
  vi.mocked(api.saveResultsActivity).mockResolvedValue(saved);
  vi.mocked(api.saveResultsBlocker).mockResolvedValue(saved);

  await mount(initial);

  // Abrir registro directamente desde el entregable cuando aún no hay actividades
  await userEvent.click(screen.getAllByRole("button", { name: "Agregar actividad en Estación validada" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Registrar avance" });

  // No debe existir campo redundante de título de actividad
  expect(within(dialog).queryByLabelText(/Nombre de la actividad/i)).toBeNull();
  expect(within(dialog).getByText("Condición anterior")).toBeTruthy();
  expect(within(dialog).getByText("Nueva condición (Avance)")).toBeTruthy();

  // 1. Fecha de registro
  fireEvent.change(within(dialog).getByLabelText("Fecha de registro"), { target: { value: "2026-11-05" } });

  // 2. Nueva condición
  fireEvent.change(within(dialog).getByLabelText(/^Nueva condición/i, { selector: "textarea" }), {
    target: { value: "Pieza recibida con retraso parcial" },
  });

  // 3. Evidencia · opcional está presente
  expect(within(dialog).getByLabelText(/Evidencia · opcional/)).toBeTruthy();

  // 4. Problema para cumplir la fecha objetivo (sin alterar fecha compromiso del entregable)
  await userEvent.click(within(dialog).getByLabelText(/¿Riesgo en fecha objetivo/i));
  fireEvent.change(within(dialog).getByLabelText("Problema / impedimento"), {
    target: { value: "Falta liberación de proveedor" },
  });
  fireEvent.change(within(dialog).getByLabelText("Ayuda requerida"), {
    target: { value: "Escalar con compras" },
  });
  fireEvent.change(within(dialog).getByLabelText(/Fecha estimada \(previsión\)/i), {
    target: { value: "2026-11-20" },
  });

  fireEvent.submit(form(dialog));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  expect(api.saveResultsActivity).toHaveBeenCalledWith({
    project_id: "project_1",
    expected_revision: null,
    activity: expect.objectContaining({
      deliverable_id: "delivery_1",
      title: "Estación validada",
      forecast_start: "2026-11-05",
      forecast_due: "2026-11-20",
      at_risk: true,
      note: "Pieza recibida con retraso parcial",
      status: "in_progress",
      progress: 50,
    }),
  });

  expect(api.saveResultsBlocker).toHaveBeenCalledWith({
    project_id: "project_1",
    expected_revision: null,
    blocker_id: null,
    activity_id: expect.stringMatching(/^activity_/),
    action: "report",
    reason: "Falta liberación de proveedor",
    help_needed: "Escalar con compras",
    comment: "",
  });
});

it("Supervisor puede registrar avances en las actividades del proyecto", async () => {
  const initial = fixture("supervisor");
  vi.mocked(api.saveResultsActivity).mockResolvedValue(initial);
  await mount(initial);

  await userEvent.click(screen.getAllByRole("button", { name: "Agregar actividad en Estación validada" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Actualizar actividad" });
  fireEvent.change(within(dialog).getByLabelText(/^Nueva condición/i, { selector: "textarea" }), {
    target: { value: "Avance registrado por supervisor" },
  });
  fireEvent.submit(form(dialog));

  await waitFor(() => expect(api.saveResultsActivity).toHaveBeenCalledTimes(1));
  expect(api.saveResultsActivity).toHaveBeenCalledWith(
    expect.objectContaining({
      project_id: "project_1",
      activity: expect.objectContaining({ note: "Avance registrado por supervisor" }),
    })
  );
});
