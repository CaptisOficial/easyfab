import { useEffect, useRef, useState, type FormEvent } from "react";
import { CommitmentEditor, emptyCommitment, commitmentError } from "./CommitmentEditor";
import { ResultsModal } from "./ResultsWorkModal";
import { ResultsGantt } from "./ResultsWorkGantt";
import { summarizeResults } from "../../lib/results-metrics";
import {
  resultsDetail, saveResultsCommitment, saveResultsActivity, saveResultsBlocker,
  reviewResultsDeliverable, setResultsClosure, resolveResultsConflict, attachResultsEvidence, readResultsEvidence,
  type ResultsDetail, type ResultsActivity, type OperationsActivityEntry, type OperationsCommitmentDraft,
  type ResultsDeliverable, type OperationsBlockerEntry, type OperationsConflict, type ResultsReviewAction,
} from "../../lib/results-api";
import "./results-work.css";

const statusLabel = { not_started: "Sin iniciar", in_progress: "En curso", done: "Terminada" };
const reviewLabel = { preparing: "En preparación", submitted: "En revisión", returned: "Devuelto", accepted: "Aceptado", withdrawn: "Solicitud retirada" };
const historyActionLabel: Record<string, string> = {
  activate: "Definición inicial", change_commitment: "Cambio de compromiso", save_activity: "Actualización de actividad",
  migrate: "Trabajo anterior incorporado", attach: "Evidencia adjunta", report: "Bloqueo reportado", attend: "Atención de bloqueo",
  resolve_blocker: "Bloqueo resuelto", submit: "Solicitud de aceptación", withdraw: "Solicitud retirada", accept: "Entregable aceptado",
  return: "Entregable devuelto", revise: "Entregable reabierto", close: "Proyecto cerrado", reopen: "Proyecto reabierto", resolve: "Versiones integradas",
};
type Modal = { kind: "activity" } | { kind: "commitment" } | { kind: "review"; deliverable: ResultsDeliverable; action: ResultsReviewAction }
  | { kind: "blocker"; activityId: string; entry: OperationsBlockerEntry | null; action: "report" | "attend" | "resolve" }
  | { kind: "closure"; closed: boolean } | { kind: "conflict"; conflict: OperationsConflict };

function latestCompleteSunday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() || 7));
  return date.toISOString().slice(0, 10);
}

function blankActivity(detail: ResultsDetail): ResultsActivity {
  return { id: `activity_${crypto.randomUUID().replaceAll("-", "")}`, deliverable_id: detail.commitment?.deliverables[0]?.id ?? "", title: "", responsible_id: detail.project.engineer_ids[0] ?? "", forecast_start: detail.project.start_date, forecast_due: detail.project.target_date, dependency_ids: [], status: "not_started", progress: 0, at_risk: false, hours_spent: null, note: null };
}

export function ResultsWork({ projectId, onBack, onBusyChange }: { projectId: string; onBack: () => void; onBusyChange?: (busy: boolean) => void }) {
  const [data, setData] = useState<ResultsDetail | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false); const sending = useRef(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [activity, setActivity] = useState<ResultsActivity | null>(null);
  const [activityRevision, setActivityRevision] = useState<string | null>(null);
  const [savedActivityJson, setSavedActivityJson] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [commitment, setCommitment] = useState<OperationsCommitmentDraft>(emptyCommitment);
  const [comment, setComment] = useState("");
  const [legacyTarget, setLegacyTarget] = useState("");
  const [reason, setReason] = useState(""); const [help, setHelp] = useState("");
  const [criterionChecks, setCriterionChecks] = useState<Record<string, boolean>>({});
  const [criterionEvidence, setCriterionEvidence] = useState<Record<string, string[]>>({});
  const [confirmOutcome, setConfirmOutcome] = useState(false);
  const [keepRevision, setKeepRevision] = useState("");
  const [reportingDate, setReportingDate] = useState(latestCompleteSunday);

  useEffect(() => {
    let active = true;
    resultsDetail(projectId).then(value => { if (active) setData(value); }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);

  async function perform(action: () => Promise<ResultsDetail>, message: string) {
    if (sending.current) return null;
    sending.current = true; setBusy(true); setError(""); setNotice("");
    try { const next = await action(); setData(next); setNotice(message); return next; }
    catch (e) { setError(String(e)); return null; }
    finally { sending.current = false; setBusy(false); }
  }

  function closeModal() { if (!sending.current) { setModal(null); setError(""); } }

  function openCommitment() {
    if (!data) return;
    setCommitment(data.commitment ? { final_outcome: data.commitment.final_outcome, scope: data.commitment.scope, start_date: data.commitment.start_date, target_date: data.commitment.target_date, engineer_ids: [...data.commitment.engineer_ids], deliverables: structuredClone(data.commitment.deliverables) }
      : { ...emptyCommitment(), start_date: data.project.start_date, target_date: data.project.target_date, engineer_ids: [...data.project.engineer_ids] });
    setComment(""); setLegacyTarget(""); setError(""); setModal({ kind: "commitment" });
  }

  function openActivity(entry: OperationsActivityEntry | null) {
    if (!data) return;
    setActivity(entry ? structuredClone(entry.activity) : blankActivity(data));
    setActivityRevision(entry?.revision ?? null); setSavedActivityJson(entry ? JSON.stringify(entry.activity) : null);
    setAttachment(null); setError(""); setModal({ kind: "activity" });
  }

  function openReview(deliverable: ResultsDeliverable, action: ResultsReviewAction) {
    setComment(""); setCriterionChecks({}); setCriterionEvidence({}); setError(""); setModal({ kind: "review", deliverable, action });
  }

  function openBlocker(activityId: string, entry: OperationsBlockerEntry | null, action: "report" | "attend" | "resolve") {
    setReason(entry?.blocker.reason ?? ""); setHelp(entry?.blocker.help_needed ?? ""); setComment(""); setError(""); setModal({ kind: "blocker", activityId, entry, action });
  }

  async function saveCommitment(event: FormEvent) {
    event.preventDefault(); if (!data) return;
    const message = commitmentError(commitment);
    if (message) { setError(message); return; }
    if (data.legacy_entries.length && !data.commitment && !legacyTarget) { setError("Selecciona el entregable que recibirá las actividades anteriores para activar este flujo."); return; }
    if (!comment.trim()) { setError("Describe el motivo de la definición o cambio."); return; }
    const next = await perform(() => saveResultsCommitment({ project_id: projectId, expected_revision: data.commitment?.revision ?? null, commitment, change_reason: comment, legacy_deliverable_id: legacyTarget || null }), "Definición de cierre guardada.");
    if (next) setModal(null);
  }

  async function saveActivity(event: FormEvent) {
    event.preventDefault(); if (!activity || !data || sending.current) return;
    sending.current = true; setBusy(true); setError(""); setNotice("");
    const payload = structuredClone(activity);
    let current = data;
    let attaching = false;
    try {
      if (JSON.stringify(payload) !== savedActivityJson || !activityRevision) {
        current = await saveResultsActivity({ project_id: projectId, expected_revision: activityRevision, activity: payload });
        setData(current);
        setSavedActivityJson(JSON.stringify(payload));
        setActivityRevision(current.activities.find(entry => entry.activity.id === payload.id)?.revision ?? null);
      }
      if (attachment) {
        attaching = true;
        const row = current.activities.find(entry => entry.activity.id === payload.id);
        if (!row) throw new Error("Actualiza el proyecto para adjuntar la evidencia a su revisión vigente.");
        const file = attachment;
        current = await attachResultsEvidence({ project_id: projectId, activity_id: payload.id, expected_revision: row.revision, name: file.name, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) });
        setData(current); setAttachment(null);
      }
      setNotice(attachment ? "Avance y evidencia guardados." : "Avance guardado. No requiere aprobación.");
      setModal(null);
    } catch (e) {
      setError(String(e));
      if (attaching) setNotice("El avance ya está guardado. La evidencia sigue pendiente; puedes reintentar sin duplicar la actividad.");
    } finally {
      sending.current = false; setBusy(false);
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault(); if (!data || modal?.kind !== "review") return;
    const review = data.reviews.find(r => r.deliverable_id === modal.deliverable.id && r.commitment_revision === data.commitment?.revision);
    if (modal.action === "submit" && modal.deliverable.criteria.some(c => !criterionChecks[c.id] || (c.evidence_required && !criterionEvidence[c.id]?.length))) { setError("Confirma cada criterio y selecciona su evidencia requerida."); return; }
    if ((modal.action === "return" || modal.action === "revise") && !comment.trim()) { setError("Describe el motivo de esta decisión."); return; }
    const next = await perform(() => reviewResultsDeliverable({ project_id: projectId, deliverable_id: modal.deliverable.id, expected_revision: review?.revision ?? null, action: modal.action, criteria: modal.action === "submit" ? modal.deliverable.criteria.map(c => ({ criterion_id: c.id, fulfilled: true, evidence_ids: criterionEvidence[c.id] ?? [] })) : [], comment }), modal.action === "submit" ? "Entregable enviado a revisión." : "Revisión actualizada.");
    if (next) setModal(null);
  }

  async function submitBlocker(event: FormEvent) {
    event.preventDefault(); if (modal?.kind !== "blocker") return;
    if (modal.action === "report" && (!reason.trim() || !help.trim())) { setError("Describe el impedimento y la ayuda que necesitas."); return; }
    if (modal.action !== "report" && !comment.trim()) { setError("Describe la atención o solución realizada."); return; }
    const next = await perform(() => saveResultsBlocker({ project_id: projectId, blocker_id: modal.entry?.blocker.id ?? null, expected_revision: modal.entry?.revision ?? null, activity_id: modal.activityId, reason, help_needed: help, action: modal.action, comment }), modal.action === "report" ? "Bloqueo reportado al Supervisor." : modal.action === "attend" ? "Atención registrada. El bloqueo continúa abierto." : "Bloqueo resuelto.");
    if (next) setModal(null);
  }

  async function submitClosure(event: FormEvent) {
    event.preventDefault(); if (!data || modal?.kind !== "closure") return;
    if (!comment.trim() || (modal.closed && !confirmOutcome)) { setError("Registra el motivo y confirma el estado final cuando corresponda."); return; }
    const next = await perform(() => setResultsClosure({ project_id: projectId, expected_revision: data.closure?.revision ?? null, closed: modal.closed, confirm_final_outcome: modal.closed && confirmOutcome, comment }), modal.closed ? "Proyecto cerrado con resultados validados." : "Proyecto reabierto. El cierre anterior permanece en el historial.");
    if (next) setModal(null);
  }

  async function submitConflict(event: FormEvent) {
    event.preventDefault(); if (modal?.kind !== "conflict") return;
    if (!keepRevision || !comment.trim()) { setError("Selecciona una versión e indica el motivo de la resolución."); return; }
    const next = await perform(() => resolveResultsConflict({ project_id: projectId, stream: modal.conflict.stream, expected_revisions: modal.conflict.revisions.map(r => r.revision), keep_revision: keepRevision, comment }), "Conflicto integrado. Se conservaron las versiones originales.");
    if (next) setModal(null);
  }

  async function download(id: string, name: string) {
    if (sending.current) return; sending.current = true; setBusy(true); setError("");
    try { const bytes = await readResultsEvidence(projectId, id); const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)])); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (e) { setError(String(e)); } finally { sending.current = false; setBusy(false); }
  }

  const closed = data?.closure?.closed === true;
  const canPlan = !!data?.commitment && !!data.capabilities.can_plan_activities && !closed && !data.conflicts.some(c => c.stream === "commitment");
  const allEvidence = [...new Map(data?.activities.flatMap(entry => entry.evidence).map(file => [file.id, file]) ?? []).values()];
  const metrics = data ? summarizeResults(data, reportingDate) : null;

  function conflictLabel(conflict: OperationsConflict, index: number) {
    if (conflict.stream === "commitment") return "compromiso del proyecto";
    if (conflict.stream === "closure") return "cierre del proyecto";
    if (conflict.stream.startsWith("review/")) return `entregable ${data?.commitment?.deliverables.find(d => d.id === conflict.stream.slice(7))?.title ?? index + 1}`;
    return `${conflict.stream.startsWith("blocker/") ? "bloqueo" : "actividad"} ${index + 1}`;
  }

  const totalActivities = data?.activities.length ?? 0;
  const overallProgress = totalActivities > 0
    ? Math.round((data?.activities.reduce((sum, entry) => sum + entry.activity.progress, 0) ?? 0) / totalActivities)
    : 0;
  const doneActivities = data?.activities.filter(entry => entry.activity.status === "done" || entry.activity.progress === 100).length ?? 0;
  const openBlockersList = data?.blockers.filter(entry => !entry.blocker.resolved_at) ?? [];

  const modalTitle = modal?.kind === "activity" ? activityRevision ? "Actualizar actividad" : "Planear actividad" : modal?.kind === "commitment" ? "Definir cierre del proyecto" : modal?.kind === "blocker" ? modal.action === "report" ? "Reportar bloqueo" : modal.action === "attend" ? "Atender bloqueo" : "Resolver bloqueo" : modal?.kind === "review" ? modal.action === "submit" ? "Solicitar aceptación" : modal.action === "accept" ? "Aceptar entregable" : modal.action === "return" ? "Devolver entregable" : modal.action === "withdraw" ? "Retirar solicitud" : "Reabrir entregable" : modal?.kind === "closure" ? modal.closed ? "Cerrar proyecto" : "Reabrir proyecto" : "Resolver conflicto";

  return <section className="results-work" aria-label="Trabajo por resultados">
    <div className="results-actions">
      <button className="action" disabled={busy} onClick={onBack}>Volver a proyectos</button>
      <button className="action" disabled={busy} onClick={() => void perform(() => resultsDetail(projectId), "Proyecto actualizado.")}>Actualizar proyecto</button>
    </div>

    {error && !modal && <p role="alert" className="results-error">{error}</p>}
    {notice && !modal && <p role="status" className="results-notice">{notice}</p>}

    {!data ? !error && <p role="status">Cargando trabajo del proyecto…</p> : <>
      {/* 1. ESTATUS Y AVANCE ESTRATÉGICO SUPERIOR */}
      <header className="results-consolidated-header" aria-label="Compromiso y condiciones de cierre">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="results-eyebrow">{data.project.wbs} · {data.project.process_area}</p>
            <h3 className="text-xl font-bold">{data.project.name}</h3>
          </div>
          <span className="results-state">
            {closed ? "Proyecto cerrado" : data.project.status === "Not Started" ? "Sin iniciar" : data.project.status === "On Hold" ? "En pausa" : "En curso"}
          </span>
        </div>

        {/* Barra de avance estratégico */}
        <div className="results-strategic-progress">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold">Avance general del proyecto</span>
            <strong className="text-sm font-bold">{overallProgress}%</strong>
          </div>
          <div className="results-progress-bar-container" role="progressbar" aria-valuenow={overallProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Avance general del proyecto">
            <div className="results-progress-bar-fill" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>

        {/* Tarjetas KPI de estatus */}
        <div className="results-strategic-kpis">
          <div className="results-kpi-card">
            <span className="results-kpi-label">Compromiso</span>
            <span className="results-kpi-value">{data.project.start_date} → {data.project.target_date}</span>
          </div>
          <div className="results-kpi-card">
            <span className="results-kpi-label">Actividades</span>
            <span className="results-kpi-value">{doneActivities} / {totalActivities} terminadas</span>
          </div>
          <div className="results-kpi-card">
            <span className="results-kpi-label">Entregables (DoD)</span>
            <span className="results-kpi-value">{metrics?.acceptedCount ?? 0} / {metrics?.totalDeliverables ?? 0} aceptados</span>
          </div>
          <div className="results-kpi-card">
            <span className="results-kpi-label">Bloqueos abiertos</span>
            <span className={`results-kpi-value ${openBlockersList.length > 0 ? "text-kmx-red font-bold" : ""}`}>
              {openBlockersList.length} {openBlockersList.length === 1 ? "bloqueo" : "bloqueos"}
            </span>
          </div>
        </div>

        {/* Objetivo y alcance acordado */}
        {data.commitment && (
          <div className="pt-2 border-t border-kmx-gray-200 text-sm space-y-1">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <p><strong>{data.commitment.final_outcome}</strong></p>
              {data.capabilities.can_change_commitment && !closed && (
                <button className="action" disabled={busy} onClick={openCommitment}>Editar compromiso y DoD</button>
              )}
            </div>
            {data.commitment.scope && data.commitment.scope !== data.commitment.final_outcome && (
              <p className="results-help">{data.commitment.scope}</p>
            )}
            <p className="results-help">Ingenieros asignados: {data.commitment.engineer_ids.join(", ")}</p>
            {data.baseline && <p className="results-help">Referencia inicial: {data.baseline.start_date} → {data.baseline.target_date}. Las previsiones de las actividades no cambian este compromiso.</p>}
          </div>
        )}
      </header>

      {!!data.plan_issues?.length && (
        <div className="results-warning" role="status">
          <strong>Revisa las relaciones del plan antes de cerrar.</strong>
          <p>Las actividades siguen disponibles para corregir fechas o dependencias.</p>
          <ul>{data.plan_issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
        </div>
      )}

      {!!data.conflicts.length && (
        <section className="results-panel" aria-label="Conflictos pendientes">
          <h4>Versiones concurrentes que requieren integración</h4>
          <p className="results-warning">Estas versiones se conservan y se excluyen de los resultados definitivos hasta resolverlas.</p>
          {data.conflicts.map((conflict, index) => (
            <div className="results-blocker" key={conflict.stream}>
              <p><strong>{conflictLabel(conflict, index)}</strong> · {conflict.revisions.length} alternativas</p>
              {conflict.revisions.map(v => <p className="results-help" key={v.revision}>{v.author_id} · {v.recorded_at} · {v.summary}</p>)}
              {data.capabilities.can_change_commitment && (
                <button className="action" disabled={busy} onClick={() => { setComment(""); setKeepRevision(""); setError(""); setModal({ kind: "conflict", conflict }); }}>
                  Resolver versiones de {conflictLabel(conflict, index)}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {!data.commitment ? (
        <div className="results-panel">
          <h4>Definir el resultado antes de planear</h4>
          <p className="results-help">El Supervisor define el estado final, los entregables y la evidencia de cierre. Después, los ingenieros organizan las actividades.</p>
          {data.conflicts.some(conflict => conflict.stream === "commitment") ? (
            <p className="results-warning">Resuelve las versiones del compromiso antes de continuar la planeación.</p>
          ) : data.capabilities.can_change_commitment ? (
            <button className="btn-primary" disabled={busy} onClick={openCommitment}>Definir DoD y activar flujo</button>
          ) : (
            <p className="results-warning">El Supervisor debe definir las condiciones de cierre para habilitar la planeación.</p>
          )}
        </div>
      ) : (
        <>
          {/* 2 y 3. LAYOUT PRINCIPAL: ACTIVIDADES (IZQ) Y REPORTES (DER) */}
          <div className="results-main-layout">
            {/* COLUMNA IZQUIERDA: ACTIVIDADES POR CUMPLIR */}
            <section className="results-panel space-y-3" aria-label="Planeación y ejecución">
              <div className="results-section-heading">
                <h4>Actividades y previsión</h4>
                {canPlan && <button className="btn-primary" disabled={busy} onClick={() => openActivity(null)}>Nueva actividad</button>}
              </div>
              <p className="results-help">Actualizar el avance no requiere aprobación. El 100 % termina la actividad; la aceptación se solicita por entregable.</p>

              {!data.activities.length && <p>Todavía no hay actividades en este proyecto.</p>}

              <div className="results-planning">
                <div className="results-table-scroll">
                  <table className="results-table" aria-label="Actividades del proyecto">
                    <thead>
                      <tr>
                        <th>Actividad / entregable</th>
                        <th>Responsable</th>
                        <th>Previsión</th>
                        <th>Avance</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activities.map(entry => {
                        const a = entry.activity;
                        const blockers = data.blockers.filter(b => b.blocker.activity_id === a.id && !b.blocker.resolved_at);
                        return (
                          <tr key={a.id}>
                            <td>
                              <span className="results-task-title">{a.title}</span>
                              <small>{data.commitment?.deliverables.find(d => d.id === a.deliverable_id)?.title ?? "Entregable pendiente de revisar"}</small>
                              {a.note && <small className="italic text-kmx-gray-500">"{a.note}"</small>}
                              {a.dependency_ids.length > 0 && (
                                <small>Depende de: {a.dependency_ids.map(id => data.activities.find(e => e.activity.id === id)?.activity.title ?? "Actividad pendiente de sincronizar").join(", ")}</small>
                              )}
                            </td>
                            <td>
                              {a.responsible_id}
                              <small>Creó {entry.created_by} · Editó {entry.edited_by}</small>
                            </td>
                            <td className="results-forecast">
                              {a.forecast_start}<br />{a.forecast_due}
                              {a.forecast_due > (data.commitment?.deliverables.find(d => d.id === a.deliverable_id)?.due_date ?? data.project.target_date) && (
                                <small>Previsión posterior al compromiso</small>
                              )}
                            </td>
                            <td>
                              <span className="results-state">{statusLabel[a.status]}</span>
                              <small>{a.progress}% · {a.hours_spent == null ? "Horas sin registrar" : `${a.hours_spent} h`}</small>
                              {a.at_risk && <small className="text-kmx-red font-semibold">En riesgo</small>}
                              {blockers.length > 0 && <small className="text-kmx-red font-semibold">{blockers.length} bloqueo(s)</small>}
                            </td>
                            <td>
                              <div className="results-actions">
                                {canPlan && (
                                  <>
                                    <button className="action" aria-label={`Actualizar ${a.title}`} disabled={busy} onClick={() => openActivity(entry)}>Actualizar</button>
                                    <button className="action" aria-label={`Bloqueo en ${a.title}`} disabled={busy} onClick={() => openBlocker(a.id, null, "report")}>Bloqueo</button>
                                  </>
                                )}
                              </div>
                              {entry.evidence.map(file => (
                                <button key={file.id} className="action" disabled={busy} onClick={() => void download(file.id, file.name)}>{file.name}</button>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ResultsGantt entries={data.activities} />
              </div>
            </section>

            {/* COLUMNA DERECHA: REPORTES Y BITÁCORA DE ACTIVIDADES */}
            <section className="results-panel results-reports-col" aria-label="Reportes de las actividades">
              <div className="results-section-heading">
                <h4>Reportes de las actividades</h4>
              </div>
              <p className="results-help">
                Bitácora de avances, notas técnicas y evidencias compartidas por los ingenieros.
              </p>

              {openBlockersList.length > 0 && (
                <div className="results-active-blockers-callout">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-kmx-red-racing flex items-center gap-1.5">
                    <span aria-hidden="true">⚠</span> Bloqueos activos ({openBlockersList.length})
                  </h5>
                  <div className="space-y-2 mt-2">
                    {openBlockersList.map(entry => {
                      const b = entry.blocker;
                      const act = data.activities.find(e => e.activity.id === b.activity_id)?.activity;
                      return (
                        <div key={b.id} className="results-report-item is-blocker">
                          <div className="results-report-header">
                            <span className="font-bold">{act?.title ?? b.activity_id}</span>
                            <span>{b.reported_at}</span>
                          </div>
                          <p className="text-xs"><strong>Impedimento:</strong> {b.reason}</p>
                          <p className="text-xs text-kmx-gray-500"><strong>Ayuda:</strong> {b.help_needed}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="results-reports-feed">
                {data.activities.some(e => e.activity.progress > 0 || e.activity.note || e.evidence.length > 0) ? (
                  data.activities
                    .filter(e => e.activity.progress > 0 || e.activity.note || e.evidence.length > 0)
                    .map(entry => {
                      const a = entry.activity;
                      const deliv = data.commitment?.deliverables.find(d => d.id === a.deliverable_id);
                      return (
                        <article key={a.id} className="results-report-item">
                          <div className="results-report-header">
                            <span className="results-report-task">{a.title}</span>
                            <span className="results-state">{statusLabel[a.status]} · {a.progress}%</span>
                          </div>
                          <div className="text-xs text-kmx-gray-500 flex justify-between">
                            <span>Resp: {a.responsible_id}</span>
                            {entry.edited_by && <span>Editó: {entry.edited_by}</span>}
                          </div>
                          {deliv && <small className="text-xs text-kmx-gray-500 block">Entregable: {deliv.title}</small>}
                          {a.note && <p className="results-report-note">"{a.note}"</p>}
                          {entry.evidence.length > 0 && (
                            <div className="results-report-evidences">
                              <span className="text-xs font-semibold">Evidencia:</span>
                              {entry.evidence.map(file => (
                                <button
                                  key={file.id}
                                  type="button"
                                  className="action text-xs"
                                  disabled={busy}
                                  onClick={() => void download(file.id, file.name)}
                                  title={`Descargar ${file.name}`}
                                >
                                  📎 {file.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })
                ) : (
                  <p className="results-help">
                    Aún no hay avances ni notas registradas. Usa el botón "Actualizar" en cada actividad para reportar tu trabajo y evidencias.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* 4. GOBERNANZA, ENTREGABLES Y CIERRE (DOD) */}
          <section className="results-panel" aria-label="Entregables y validación">
            <h4>Entregables de cierre</h4>
            <div className="results-delivery-list">
              {data.commitment.deliverables.map(deliverable => {
                const review = data.reviews.find(r => r.deliverable_id === deliverable.id && r.commitment_revision === data.commitment?.revision);
                const status = review?.status ?? "preparing";
                return (
                  <article className={`results-delivery ${status === "accepted" ? "is-accepted" : ""}`} key={deliverable.id}>
                    <div className="results-section-heading">
                      <h5>{deliverable.title}</h5>
                      <span className="results-state">{reviewLabel[status]}</span>
                    </div>
                    <p className="results-help">Fecha compromiso: {deliverable.due_date}</p>
                    <ul>
                      {deliverable.criteria.map(c => (
                        <li key={c.id}>
                          {c.description}{c.evidence_required ? " · Evidencia requerida" : ""}
                        </li>
                      ))}
                    </ul>
                    {review?.decision?.comment && <p className="results-warning">Decisión: {review.decision.comment}</p>}
                    <div className="results-actions">
                      {!closed && canPlan && status !== "accepted" && status !== "submitted" && (
                        <button className="action" disabled={busy} onClick={() => openReview(deliverable, "submit")}>
                          Solicitar aceptación de {deliverable.title}
                        </button>
                      )}
                      {!closed && canPlan && status === "submitted" && (
                        <button className="action" disabled={busy} onClick={() => openReview(deliverable, "withdraw")}>
                          Retirar solicitud de {deliverable.title}
                        </button>
                      )}
                      {!closed && data.capabilities.can_review_deliverables && status === "submitted" && (
                        <>
                          <button className="btn-primary" disabled={busy} onClick={() => openReview(deliverable, "accept")}>
                            Aceptar {deliverable.title}
                          </button>
                          <button className="action" disabled={busy} onClick={() => openReview(deliverable, "return")}>
                            Devolver {deliverable.title}
                          </button>
                        </>
                      )}
                      {!closed && data.capabilities.can_change_commitment && status === "accepted" && (
                        <button className="action" disabled={busy} onClick={() => openReview(deliverable, "revise")}>
                          Reabrir {deliverable.title}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Bloqueos y seguimiento completo */}
          <section className="results-panel" aria-label="Bloqueos y seguimiento">
            <h4>Bloqueos y ayuda requerida</h4>
            {!data.blockers.length && <p className="results-help">No hay bloqueos reportados.</p>}
            {data.blockers.map(entry => {
              const b = entry.blocker;
              const age = metrics?.openBlockers.find(item => item.id === b.id)?.ageDays;
              return (
                <article className="results-blocker" key={b.id}>
                  <div className="results-section-heading">
                    <h5>{data.activities.find(e => e.activity.id === b.activity_id)?.activity.title ?? b.activity_id}</h5>
                    <span className="results-state">{b.resolved_at ? "Resuelto" : b.first_attention_at ? "Atendido · sigue abierto" : "Pendiente de atención"}</span>
                  </div>
                  <p>{b.reason}</p>
                  <p className="results-help">Ayuda requerida: {b.help_needed}</p>
                  <p className="results-help">Reportó {entry.reported_by} · {b.reported_at}{age != null ? ` · ${age} días al corte` : ""}</p>
                  {b.resolution_note && <p className="results-help">Solución: {b.resolution_note}</p>}
                  {data.capabilities.can_resolve_blockers && !b.resolved_at && !closed && (
                    <div className="results-actions">
                      {!b.first_attention_at && (
                        <button className="action" disabled={busy} onClick={() => openBlocker(b.activity_id, entry, "attend")}>
                          Registrar atención a {b.reason}
                        </button>
                      )}
                      <button className="action" disabled={busy} onClick={() => openBlocker(b.activity_id, entry, "resolve")}>
                        Resolver {b.reason}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          {data.capabilities.can_review_deliverables && (
            <section className="results-panel" aria-label="Cierre del proyecto">
              <h4>{closed ? "Cierre registrado" : "Validar el estado final"}</h4>
              <p className="results-help">Cerrar requiere todos los entregables aceptados y comprobar el estado final. Las actividades terminadas por sí solas no cierran el proyecto.</p>
              <button
                className="btn-primary"
                disabled={busy || (!closed && (data.conflicts.length > 0 || data.commitment.deliverables.some(d => !data.reviews.some(r => r.deliverable_id === d.id && r.commitment_revision === data.commitment?.revision && r.status === "accepted"))))}
                onClick={() => { setComment(""); setConfirmOutcome(false); setError(""); setModal({ kind: "closure", closed: !closed }); }}
              >
                {closed ? "Reabrir proyecto" : "Cerrar proyecto"}
              </button>
            </section>
          )}

          {/* 5. SECCIÓN TÉCNICA / MÉTRICAS E HISTORIAL */}
          {metrics && (
            <details className="results-panel" aria-label="Lectura operativa">
              <summary className="font-bold">Métricas operativas y cohorte semanal</summary>
              <div className="mt-3 space-y-3">
                <div className="results-section-heading">
                  <h4>Resultados y atención</h4>
                  <label className="field">Semana de referencia<input type="date" required value={reportingDate} onChange={e => { if (e.target.value) setReportingDate(e.target.value); }} /></label>
                </div>
                <p className="results-help">Semana {metrics.weekStart} → {metrics.weekEnd} · America/Mexico_City. Cohortes y datos al corte indicado; sin metas ni puntuaciones individuales.</p>
                <div className="results-metrics">
                  <div className="results-metric"><span>Entregables aceptados actuales</span><strong>{metrics.acceptanceComplete ? `${metrics.acceptedCount}/${metrics.totalDeliverables}` : "Sin datos completos"}</strong></div>
                  <div className="results-metric"><span>Bloqueos abiertos al corte</span><strong>{metrics.openBlockers.length}</strong></div>
                  <div className="results-metric"><span>Aceptados a tiempo · vencían en semana</span><strong>{metrics.onTime.due ? metrics.onTime.rate == null ? "Sin datos completos" : `${metrics.onTime.accepted}/${metrics.onTime.due}` : "No aplica"}</strong></div>
                  <div className="results-metric"><span>Aceptados en primera revisión · semana</span><strong>{metrics.firstPass.reviewed ? metrics.firstPass.rate == null ? "Sin datos completos" : `${metrics.firstPass.accepted}/${metrics.firstPass.reviewed}` : "No aplica"}</strong></div>
                </div>
                {metrics.caveats.map(caveat => <p key={caveat} className="results-help">{caveat}</p>)}
              </div>
            </details>
          )}
        </>
      )}

      {!!data.legacy_entries.length && (
        <details className="results-panel">
          <summary>Trabajo anterior conservado · {data.legacy_entries.length} actividades</summary>
          <p className="results-help">Registro de consulta. Sus aprobaciones anteriores no equivalen a la aceptación de los nuevos entregables.</p>
          <ul>{data.legacy_entries.map(entry => <li key={`${entry.owner_id}/${entry.activity.id}`}>{entry.activity.task_title} · {entry.owner_name} · {entry.activity.milestone_gate}%</li>)}</ul>
        </details>
      )}

      <details className="results-panel">
        <summary>Historial del proyecto · {data.history.length} registros</summary>
        <div className="results-table-scroll">
          <table className="results-table" aria-label="Historial del proyecto">
            <thead>
              <tr><th>Fecha</th><th>Persona</th><th>Acción</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {data.history.map(item => <tr key={item.revision}><td>{item.recorded_at}</td><td>{item.author_id}</td><td>{historyActionLabel[item.action] ?? "Cambio registrado"}</td><td>{item.summary}</td></tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </>}

    {modal && data && <ResultsModal title={modalTitle} busy={busy} onClose={closeModal}>
      {error && <p role="alert" className="results-error">{error}</p>}
      {notice && <p role="status" className="results-help">{notice}</p>}
      {modal.kind === "commitment" && (
        <form onSubmit={saveCommitment}>
          <CommitmentEditor value={commitment} onChange={setCommitment} disabled={busy} />
          <label className="field">Motivo de la definición o cambio<textarea required disabled={busy} value={comment} onChange={e => setComment(e.target.value)} /></label>
          {!data.commitment && data.legacy_entries.length > 0 && (
            <div className="results-warning">
              <p>Activar este flujo incorporará las actividades anteriores al entregable seleccionado y conservará el historial. Sus aprobaciones no se transferirán a los entregables.</p>
              <label className="field">Entregable para actividades anteriores
                <select required disabled={busy} value={legacyTarget} onChange={e => setLegacyTarget(e.target.value)}>
                  <option value="">Selecciona un entregable</option>
                  {commitment.deliverables.map(d => <option key={d.id} value={d.id}>{d.title || "Entregable sin nombre"}</option>)}
                </select>
              </label>
            </div>
          )}
          <button className="btn-primary" disabled={busy}>{busy ? "Guardando…" : data.commitment ? "Guardar cambio de compromiso" : "Guardar DoD y activar"}</button>
        </form>
      )}
      {modal.kind === "activity" && activity && (
        <form onSubmit={saveActivity}>
          <fieldset disabled={busy} className="results-commitment-editor">
            <p><strong>{activity.title || "Nueva actividad"}</strong></p>
            <div className="results-fields-row">
              <label className="field">Avance
                <select value={activity.progress} onChange={e => { const progress = Number(e.target.value) as ResultsActivity["progress"]; setActivity({ ...activity, progress, status: progress === 100 ? "done" : progress > 0 || activity.status === "done" ? "in_progress" : activity.status }); }}>
                  {[0, 25, 50, 75, 100].map(value => <option key={value} value={value}>{value}%{value === 100 ? " · Terminada" : ""}</option>)}
                </select>
              </label>
              <label className="field">Estado de la actividad
                <select value={activity.status} onChange={e => { const status = e.target.value as ResultsActivity["status"]; setActivity({ ...activity, status, progress: status === "done" ? 100 : status === "not_started" ? 0 : activity.progress === 100 ? 75 : activity.progress }); }}>
                  {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value} disabled={value === "not_started" && (activity.hours_spent ?? 0) > 0}>{label}</option>)}
                </select>
              </label>
            </div>
            <label className="field">Nota de avance · opcional
              <textarea value={activity.note ?? ""} onChange={e => setActivity({ ...activity, note: e.target.value || null })} />
            </label>
            <label className="field">Evidencia · opcional
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv" onChange={e => { const file = e.target.files?.[0] ?? null; if (file && (!file.size || file.size > 20 * 1024 * 1024)) { setError("La evidencia debe contener datos y no superar 20 MB."); e.target.value = ""; setAttachment(null); } else setAttachment(file); }} />
              <span className="results-help">PDF, PNG, JPG o Excel (XLSX, XLS). No se exige evidencia en cada actualización.</span>
            </label>
            <details open={!activityRevision}>
              <summary>Editar planeación y horas</summary>
              <div className="results-commitment-editor">
                <label className="field">Actividad<input required value={activity.title} onChange={e => setActivity({ ...activity, title: e.target.value })} /></label>
                <div className="results-fields-row">
                  <label className="field">Entregable
                    <select value={activity.deliverable_id} onChange={e => setActivity({ ...activity, deliverable_id: e.target.value })}>
                      {data.commitment?.deliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                  </label>
                  <label className="field">Responsable de la actividad
                    <select value={activity.responsible_id} onChange={e => setActivity({ ...activity, responsible_id: e.target.value })}>
                      {data.project.engineer_ids.map(id => <option key={id} value={id}>{id}</option>)}
                    </select>
                  </label>
                </div>
                <div className="results-fields-row">
                  <label className="field">Inicio previsto<input required type="date" value={activity.forecast_start} onChange={e => setActivity({ ...activity, forecast_start: e.target.value })} /></label>
                  <label className="field">Fin previsto<input required type="date" value={activity.forecast_due} onChange={e => setActivity({ ...activity, forecast_due: e.target.value })} /></label>
                </div>
                <fieldset><legend>Depende de</legend>{data.activities.filter(e => e.activity.id !== activity.id).map(entry => <label className="results-check" key={entry.activity.id}><input type="checkbox" checked={activity.dependency_ids.includes(entry.activity.id)} onChange={e => setActivity({ ...activity, dependency_ids: e.target.checked ? [...activity.dependency_ids, entry.activity.id] : activity.dependency_ids.filter(id => id !== entry.activity.id) })} />{entry.activity.title}</label>)}</fieldset>
                <label className="field">Horas invertidas acumuladas · opcional<input type="number" min="0" step="0.01" value={activity.hours_spent ?? ""} onChange={e => setActivity({ ...activity, hours_spent: e.target.value === "" ? null : e.target.valueAsNumber, status: e.target.valueAsNumber > 0 && activity.status === "not_started" ? "in_progress" : activity.status })} /></label>
                <label className="results-check"><input type="checkbox" checked={activity.at_risk} onChange={e => setActivity({ ...activity, at_risk: e.target.checked })} />Actividad en riesgo</label>
              </div>
            </details>
            <p className="results-help">Guardar actualiza el trabajo y te permite continuar. No solicita aprobación del Supervisor.</p>
            <div className="results-modal-sticky-actions">
              <button className="btn-primary">{busy ? "Guardando…" : "Guardar actualización"}</button>
            </div>
          </fieldset>
        </form>
      )}
      {modal.kind === "blocker" && (
        <form onSubmit={submitBlocker}>
          <fieldset disabled={busy} className="results-commitment-editor">
            {modal.action === "report" ? (
              <>
                <label className="field">¿Qué impide continuar?<textarea required value={reason} onChange={e => setReason(e.target.value)} /></label>
                <label className="field">¿Qué ayuda o decisión necesitas?<textarea required value={help} onChange={e => setHelp(e.target.value)} /></label>
              </>
            ) : (
              <>
                <p><strong>{reason}</strong></p>
                <p className="results-help">Ayuda requerida: {help}</p>
                <label className="field">{modal.action === "attend" ? "Atención realizada" : "Solución realizada"}<textarea required value={comment} onChange={e => setComment(e.target.value)} /></label>
                {modal.action === "attend" && <p className="results-help">Registrar atención conserva el bloqueo abierto hasta resolverlo.</p>}
              </>
            )}
            <button className="btn-primary">{busy ? "Guardando…" : modalTitle}</button>
          </fieldset>
        </form>
      )}
      {modal.kind === "review" && (
        <form onSubmit={submitReview}>
          <fieldset disabled={busy} className="results-commitment-editor">
            <p><strong>{modal.deliverable.title}</strong></p>
            {modal.action === "submit" ? (
              modal.deliverable.criteria.map(c => (
                <fieldset className="results-deliverable-editor" key={c.id}>
                  <label className="results-check">
                    <input required type="checkbox" checked={criterionChecks[c.id] ?? false} onChange={e => setCriterionChecks({ ...criterionChecks, [c.id]: e.target.checked })} />
                    Confirmo: {c.description}
                  </label>
                  <p className="results-help">{c.evidence_required ? "Selecciona al menos una evidencia para este criterio." : "Puedes añadir evidencia si ayuda a comprobar el criterio."}</p>
                  <div className="results-evidence-picker">
                    {allEvidence.length ? allEvidence.map(file => (
                      <label className="results-check" key={file.id}>
                        <input type="checkbox" checked={criterionEvidence[c.id]?.includes(file.id) ?? false} onChange={e => setCriterionEvidence({ ...criterionEvidence, [c.id]: e.target.checked ? [...(criterionEvidence[c.id] ?? []), file.id] : (criterionEvidence[c.id] ?? []).filter(id => id !== file.id) })} />
                        {file.name}
                      </label>
                    )) : <p className="results-help">Aún no hay evidencias adjuntas en las actividades.</p>}
                  </div>
                </fieldset>
              ))
            ) : (
              <>
                <ul>{modal.deliverable.criteria.map(c => <li key={c.id}>{c.description}</li>)}</ul>
                {data.reviews.find(r => r.deliverable_id === modal.deliverable.id)?.submission?.criteria.map(c => (
                  <div key={c.criterion_id}>
                    <p className="results-help">Evidencia de {modal.deliverable.criteria.find(item => item.id === c.criterion_id)?.description ?? c.criterion_id}</p>
                    {c.evidence_ids.map(id => {
                      const file = allEvidence.find(f => f.id === id);
                      return <button type="button" key={id} className="action" onClick={() => void download(id, file?.name ?? "evidencia")}>{file?.name ?? "Consultar evidencia"}</button>;
                    })}
                  </div>
                ))}
              </>
            )}
            <label className="field">Comentario{modal.action === "return" || modal.action === "revise" ? " · obligatorio" : " · opcional"}
              <textarea required={modal.action === "return" || modal.action === "revise"} value={comment} onChange={e => setComment(e.target.value)} />
            </label>
            <button className="btn-primary">{busy ? "Guardando…" : modalTitle}</button>
          </fieldset>
        </form>
      )}
      {modal.kind === "closure" && (
        <form onSubmit={submitClosure}>
          <fieldset disabled={busy} className="results-commitment-editor">
            {modal.closed && (
              <>
                <p>{data.commitment?.final_outcome}</p>
                <label className="results-check">
                  <input required type="checkbox" checked={confirmOutcome} onChange={e => setConfirmOutcome(e.target.checked)} />
                  He comprobado el estado final acordado y sus entregables aceptados.
                </label>
              </>
            )}
            <label className="field">Motivo del {modal.closed ? "cierre" : "reingreso a ejecución"}
              <textarea required value={comment} onChange={e => setComment(e.target.value)} />
            </label>
            <button className="btn-primary">{busy ? "Guardando…" : modalTitle}</button>
          </fieldset>
        </form>
      )}
      {modal.kind === "conflict" && (
        <form onSubmit={submitConflict}>
          <fieldset disabled={busy} className="results-commitment-editor">
            <p>Selecciona la versión que servirá de base. Todas las alternativas permanecerán en el historial; después puedes editar para completar la integración.</p>
            {modal.conflict.revisions.map(variant => (
              <label className="results-check" key={variant.revision}>
                <input required type="radio" name="kept-revision" checked={keepRevision === variant.revision} onChange={() => setKeepRevision(variant.revision)} />
                <span>{variant.author_id} · {variant.recorded_at}<br />{variant.summary}</span>
              </label>
            ))}
            <label className="field">Motivo de la integración<textarea required value={comment} onChange={e => setComment(e.target.value)} /></label>
            <button className="btn-primary">{busy ? "Guardando…" : "Integrar versiones"}</button>
          </fieldset>
        </form>
      )}
    </ResultsModal>}
  </section>;
}
