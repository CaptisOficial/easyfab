import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, BarChart3, LayoutGrid, Paperclip, Plus, RefreshCw, Table2, Target } from "lucide-react";
import { CommitmentEditor, emptyCommitment, commitmentError } from "./CommitmentEditor";
import { ResultsModal } from "./ResultsWorkModal";
import { ResultsGantt } from "./ResultsWorkGantt";
import { DeliverableActions, activityStatusLabel, groupDeliverables } from "./deliverableView";
import { summarizeResults } from "../../lib/results-metrics";
import {
  resultsDetail, saveResultsCommitment, saveResultsActivity, saveResultsBlocker,
  requestActivityRevision, setResultsClosure, resolveResultsConflict, attachResultsEvidence, readResultsEvidence,
  type ResultsDetail, type ResultsActivity, type OperationsActivityEntry, type OperationsCommitmentDraft,
  type ResultsDeliverable, type OperationsBlockerEntry, type OperationsConflict,
} from "../../lib/results-api";
import "./results-work.css";

const historyActionLabel: Record<string, string> = {
  activate: "Definición inicial", change_commitment: "Cambio de compromiso", save_activity: "Actualización de actividad",
  request_activity_revision: "Revisión de actividad solicitada",
  migrate: "Trabajo anterior incorporado", attach: "Evidencia adjunta", report: "Bloqueo reportado", attend: "Atención de bloqueo",
  resolve_blocker: "Bloqueo resuelto", submit: "Solicitud de aceptación", withdraw: "Solicitud retirada", accept: "Entregable aceptado",
  return: "Entregable devuelto", revise: "Entregable reabierto", close: "Proyecto cerrado", reopen: "Proyecto reabierto", resolve: "Versiones integradas",
};
type Modal = { kind: "activity" } | { kind: "commitment" } | { kind: "activity_revision"; entry: OperationsActivityEntry }
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
  const [closureDeliverableChecks, setClosureDeliverableChecks] = useState<Record<string, boolean>>({});
  const [confirmOutcome, setConfirmOutcome] = useState(false);
  const [keepRevision, setKeepRevision] = useState("");
  const [reportingDate] = useState(latestCompleteSunday);
  const [hasTargetDateIssue, setHasTargetDateIssue] = useState(false);
  const [registrationDate, setRegistrationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customForecastStart, setCustomForecastStart] = useState(false);
  const [activityBlockerReason, setActivityBlockerReason] = useState("");
  const [activityBlockerHelp, setActivityBlockerHelp] = useState("");
  const [planViewMode, setPlanViewMode] = useState<"both" | "gantt" | "table">("both");

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

  function openActivity(entry: OperationsActivityEntry | null, deliverable?: ResultsDeliverable) {
    if (!data) return;
    const base = entry
      ? structuredClone(entry.activity)
      : (() => {
          const blank = blankActivity(data);
          if (deliverable) {
            blank.deliverable_id = deliverable.id;
            blank.title = deliverable.title;
            blank.forecast_due = deliverable.due_date;
          } else {
            const firstDeliv = data.commitment?.deliverables[0];
            if (firstDeliv) {
              blank.deliverable_id = firstDeliv.id;
              blank.title = firstDeliv.title;
              blank.forecast_due = firstDeliv.due_date;
            }
          }
          return blank;
        })();
    setActivity(base);
    setActivityRevision(entry?.revision ?? null);
    setSavedActivityJson(entry ? JSON.stringify(entry.activity) : null);
    setRegistrationDate(new Date().toISOString().slice(0, 10));
    setCustomForecastStart(false);
    setAttachment(null);
    setHasTargetDateIssue(entry?.activity.at_risk ?? false);
    setActivityBlockerReason("");
    setActivityBlockerHelp("");
    setError("");
    setModal({ kind: "activity" });
  }

  function openDeliverableProgress(deliverable: ResultsDeliverable) {
    if (!data) return;
    const delivActivities = data.activities.filter(e => e.activity.deliverable_id === deliverable.id);
    const target = delivActivities.find(e => e.activity.status !== "done") ?? delivActivities[0] ?? null;
    openActivity(target, deliverable);
  }

  function openActivityRevision(entry: OperationsActivityEntry) {
    setComment(""); setError(""); setModal({ kind: "activity_revision", entry });
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
    if (!activityRevision && !customForecastStart && registrationDate && registrationDate <= payload.forecast_due) {
      payload.forecast_start = registrationDate;
    }
    payload.at_risk = hasTargetDateIssue;
    // Transición objetiva: el avance se destina directamente al cierre
    if (payload.status === "done") {
      payload.progress = 100;
    } else if (payload.status === "not_started" && (payload.note?.trim() || attachment || (hasTargetDateIssue && activityBlockerReason.trim()))) {
      payload.status = "in_progress";
      payload.progress = 50;
    } else if (payload.status === "in_progress" && payload.progress === 0) {
      payload.progress = 50;
    }
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
      if (hasTargetDateIssue && activityBlockerReason.trim()) {
        try {
          current = await saveResultsBlocker({
            project_id: projectId,
            blocker_id: null,
            expected_revision: null,
            activity_id: payload.id,
            reason: activityBlockerReason.trim(),
            help_needed: activityBlockerHelp.trim() || "Apoyo requerido",
            action: "report",
            comment: "",
          });
          setData(current);
        } catch {}
      }
      setNotice(attachment ? "Avance y evidencia guardados." : hasTargetDateIssue ? "Avance y alerta de fecha objetivo registrados." : "Avance guardado. No requiere aprobación.");
      setModal(null);
    } catch (e) {
      setError(String(e));
      if (attaching) setNotice("El avance ya está guardado. La evidencia sigue pendiente; puedes reintentar sin duplicar la actividad.");
    } finally {
      sending.current = false; setBusy(false);
    }
  }

  async function submitActivityRevision(event: FormEvent) {
    event.preventDefault(); if (!data || modal?.kind !== "activity_revision") return;
    if (!comment.trim()) { setError("Describe el motivo o las observaciones de la revisión."); return; }
    const next = await perform(
      () => requestActivityRevision({ project_id: projectId, activity_id: modal.entry.activity.id, expected_revision: modal.entry.revision, comment }),
      "Revisión solicitada. La actividad volvió a En curso.",
    );
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
    const allDeliverablesChecked = !modal.closed || (data.commitment?.deliverables.every(d => closureDeliverableChecks[d.id]) ?? false);
    if (!comment.trim() || (modal.closed && (!confirmOutcome || !allDeliverablesChecked))) {
      setError("Evalúa todos los entregables, confirma el estado final y registra el motivo del cierre.");
      return;
    }
    const next = await perform(() => setResultsClosure({ project_id: projectId, expected_revision: data.closure?.revision ?? null, closed: modal.closed, confirm_final_outcome: modal.closed && confirmOutcome, comment }), modal.closed ? "Proyecto cerrado con resultados evaluados." : "Proyecto reabierto. El cierre anterior permanece en el historial.");
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
  const isEngineerView = canPlan && !data?.capabilities.can_review_deliverables && !data?.capabilities.can_change_commitment;
  const metrics = data ? summarizeResults(data, reportingDate) : null;

  function conflictLabel(conflict: OperationsConflict, index: number) {
    if (conflict.stream === "commitment") return "compromiso del proyecto";
    if (conflict.stream === "closure") return "cierre del proyecto";
    if (conflict.stream.startsWith("review/")) return `entregable ${data?.commitment?.deliverables.find(d => d.id === conflict.stream.slice(7))?.title ?? index + 1}`;
    return `${conflict.stream.startsWith("blocker/") ? "bloqueo" : "actividad"} ${index + 1}`;
  }

  const totalActivities = data?.activities.length ?? 0;
  const doneActivities = data?.activities.filter(entry => entry.activity.status === "done" || entry.activity.progress === 100).length ?? 0;
  const overallProgress = totalActivities > 0
    ? Math.round((doneActivities / totalActivities) * 100)
    : 0;
  const openBlockersList = data?.blockers.filter(entry => !entry.blocker.resolved_at) ?? [];

  const modalTitle = modal?.kind === "activity" ? activityRevision ? "Actualizar actividad" : "Registrar avance" : modal?.kind === "commitment" ? "Definir cierre del proyecto" : modal?.kind === "blocker" ? modal.action === "report" ? "Reportar bloqueo" : modal.action === "attend" ? "Atender bloqueo" : "Resolver bloqueo" : modal?.kind === "activity_revision" ? "Revisar actividad finalizada" : modal?.kind === "closure" ? modal.closed ? "Cerrar proyecto" : "Reabrir proyecto" : "Resolver conflicto";

  const canCloseProject = Boolean(
    data?.commitment &&
      data.capabilities.can_review_deliverables &&
      (closed || data.conflicts.length === 0),
  );
  const tableDeliverableGroups = data?.commitment?.deliverables
    ? groupDeliverables(
        data.activities,
        data.commitment.deliverables,
        data.reviews,
        data.commitment.revision,
        0,
        0,
      )
    : [];
  const completedDeliverableGroups = tableDeliverableGroups.filter(
    g => g.totalCount > 0 && g.doneCount === g.totalCount,
  ).length;

  return <section className="results-work" aria-label="Trabajo por resultados">
    <header className="results-work-header" aria-label="Compromiso y condiciones de cierre">
      <div className="results-work-header-top">
        <div className="results-work-header-title">
          {data ? (
            <>
              <p className="results-eyebrow">{data.project.wbs} · {data.project.process_area}</p>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-bold text-kmx-carbon">{data.project.name}</h3>
                <span className="results-state">
                  {closed ? "Proyecto cerrado" : data.project.status === "Not Started" ? "Sin iniciar" : data.project.status === "On Hold" ? "En pausa" : "En curso"}
                </span>
              </div>
            </>
          ) : (
            <h3 className="text-lg font-bold text-kmx-carbon">Detalle del proyecto</h3>
          )}
        </div>
        <div className="results-work-header-actions">
          {data?.commitment && data.capabilities.can_review_deliverables && (
            <button
              type="button"
              className="btn-primary text-xs py-1.5 px-3"
              disabled={busy || !canCloseProject}
              title={!canCloseProject ? "Resuelve los conflictos antes de cerrar" : undefined}
              onClick={() => { setComment(""); setConfirmOutcome(false); setClosureDeliverableChecks({}); setError(""); setModal({ kind: "closure", closed: !closed }); }}
            >
              {closed ? "Reabrir proyecto" : "Cerrar proyecto"}
            </button>
          )}
          <button
            type="button"
            className="action results-icon-btn"
            aria-label="Actualizar proyecto"
            title="Actualizar proyecto"
            disabled={busy}
            onClick={() => void perform(() => resultsDetail(projectId), "Proyecto actualizado.")}
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="action results-icon-btn"
            aria-label="Cerrar detalle del proyecto"
            title="Cerrar"
            disabled={busy}
            onClick={onBack}
          >
            ✕
          </button>
        </div>
      </div>

      {data && (
        <div className="results-work-header-meta">
          <div className="results-header-inline-item">
            <span className="results-header-inline-label">Compromiso</span>
            <strong className="tabular-nums">{data.project.start_date} → {data.project.target_date}</strong>
          </div>
          <div className="results-header-inline-item">
            <span className="results-header-inline-label">Entregables</span>
            <strong className="tabular-nums">{completedDeliverableGroups} / {data.commitment?.deliverables.length ?? 0} cumplidos</strong>
          </div>
          <div className="results-header-progress">
            <span className="results-header-inline-label">Avance general del proyecto</span>
            <div className="results-progress-bar-container" role="progressbar" aria-valuenow={overallProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Avance general del proyecto">
              <div className="results-progress-bar-fill" style={{ width: `${overallProgress}%` }} />
            </div>
            <strong className="text-xs font-bold tabular-nums">{doneActivities} de {totalActivities} cumplidas ({overallProgress}%)</strong>
          </div>
          {openBlockersList.length > 0 && (
            <span className="results-state text-kmx-red font-bold">
              {openBlockersList.length} {openBlockersList.length === 1 ? "bloqueo" : "bloqueos"}
            </span>
          )}
        </div>
      )}

      {data?.commitment && (
        <div className="results-work-header-outcome">
          <p className="text-sm font-medium text-kmx-carbon">{data.commitment.final_outcome}</p>
          {data.capabilities.can_change_commitment && !closed && (
            <button type="button" className="action text-xs py-1 px-2.5" disabled={busy} onClick={openCommitment}>Editar compromiso y DoD</button>
          )}
        </div>
      )}
    </header>

    {error && !modal && <p role="alert" className="results-error">{error}</p>}
    {notice && !modal && <p role="status" className="results-notice">{notice}</p>}

    {!data ? !error && <p role="status">Cargando trabajo del proyecto…</p> : <>

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

          {/* 3. DESGLOSE OPERATIVO: PLANEACIÓN Y PREVISIÓN POR ENTREGABLES */}
          <div className="block">
            {/* COLUMNA IZQUIERDA: ACTIVIDADES POR CUMPLIR */}
            <section className="results-panel space-y-3" aria-label="Planeación y ejecución">
              <div className="results-section-heading">
                <div className="flex items-center gap-3 flex-wrap">
                  <h4>Planeación y previsión por entregables</h4>
                  {!isEngineerView && (
                    <div className="results-plan-view-controls" role="group" aria-label="Modo de visualización del plan">
                      <button
                        type="button"
                        className={`results-plan-view-btn ${planViewMode === "both" ? "is-active" : ""}`}
                        onClick={() => setPlanViewMode("both")}
                        title="Mostrar Gantt y Tabla juntos"
                      >
                        <LayoutGrid size={13} aria-hidden="true" />
                        <span>Vista dual</span>
                      </button>
                      <button
                        type="button"
                        className={`results-plan-view-btn ${planViewMode === "gantt" ? "is-active" : ""}`}
                        onClick={() => setPlanViewMode("gantt")}
                        title="Gantt conciso y simple centrado en entregables de cierre"
                      >
                        <BarChart3 size={13} aria-hidden="true" />
                        <span>Solo Gantt</span>
                      </button>
                      <button
                        type="button"
                        className={`results-plan-view-btn ${planViewMode === "table" ? "is-active" : ""}`}
                        onClick={() => setPlanViewMode("table")}
                        title="Tabla agrupada por entregables de cierre"
                      >
                        <Table2 size={13} aria-hidden="true" />
                        <span>Solo Tabla</span>
                      </button>
                    </div>
                  )}
                </div>
                {canPlan && !isEngineerView && (
                  <button
                    type="button"
                    className="btn-primary results-icon-btn"
                    aria-label="Nueva actividad"
                    title="Nueva actividad"
                    disabled={busy}
                    onClick={() => openActivity(null)}
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              {!data.activities.length && !isEngineerView && <p>Sin actividades registradas.</p>}

              <div className="results-planning">
                {/* Visualización Gantt de entregables y previsión */}
                <div className={!isEngineerView && planViewMode === "table" ? "hidden" : "block w-full"}>
                  <ResultsGantt
                    entries={data.activities}
                    deliverables={data.commitment?.deliverables}
                    reviews={data.reviews}
                    projectStart={data.project.start_date}
                    projectTarget={data.project.target_date}
                    canPlan={canPlan}
                    onUpdateActivity={openActivity}
                    onRegisterDeliverableProgress={openDeliverableProgress}
                  />
                </div>

                {/* Tabla de actividades agrupadas por entregable */}
                {!isEngineerView && (
                <div className={planViewMode === "gantt" ? "hidden" : "block w-full"}>
                  <div className="results-table-scroll">
                    <table className="results-table" aria-label="Actividades del proyecto">
                      <colgroup>
                        <col className="results-col-activity" />
                        <col className="results-col-responsible" />
                        <col className="results-col-forecast" />
                        <col className="results-col-progress" />
                        <col className="results-col-actions" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Actividad</th>
                          <th>Responsable</th>
                          <th>Previsión</th>
                          <th>Avance</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableDeliverableGroups.length > 0 ? (
                          <>
                            {tableDeliverableGroups.map(group => {
                              const deliv = group.deliverable;
                              const delivActivities = group.activities;

                              return (
                                <Fragment key={deliv.id}>
                                  <tr className="results-table-deliverable-header">
                                    <td colSpan={5}>
                                      <div className="results-table-deliverable-bar">
                                        <span className="font-bold text-kmx-carbon inline-flex items-center gap-1.5 min-w-0">
                                          <Target size={14} className="text-kmx-lime shrink-0" aria-hidden="true" />
                                          <span className="truncate">{deliv.title}</span>
                                        </span>
                                        <div className="flex items-center gap-3 flex-wrap">
                                          <span className="text-xs text-kmx-gray-500 font-normal tabular-nums">
                                            Compromiso: <strong>{deliv.due_date}</strong> · {group.doneCount}/{group.totalCount} cumplidas
                                          </span>
                                          <DeliverableActions
                                            deliverable={deliv}
                                            canPlan={!closed && canPlan}
                                            disabled={busy}
                                            onAddActivity={openDeliverableProgress}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                  {delivActivities.map(entry => {
                                    const a = entry.activity;
                                    const blockers = data.blockers.filter(b => b.blocker.activity_id === a.id && !b.blocker.resolved_at);
                                    return (
                                      <tr key={a.id}>
                                        <td>
                                          <span className="results-task-title">{a.title}</span>
                                          {a.note && <small className="italic text-kmx-gray-500">"{a.note}"</small>}
                                          {a.dependency_ids.length > 0 && (
                                            <small>Depende de: {a.dependency_ids.map(id => data.activities.find(e => e.activity.id === id)?.activity.title ?? "Actividad pendiente de sincronizar").join(", ")}</small>
                                          )}
                                        </td>
                                        <td className="results-cell-responsible">
                                          <strong>{a.responsible_id || "Sin asignar"}</strong>
                                          <small>Creó {entry.created_by} · Editó {entry.edited_by}</small>
                                        </td>
                                        <td className="results-forecast tabular-nums">
                                          {a.forecast_start}<br />{a.forecast_due}
                                          {a.forecast_due > (deliv.due_date || data.project.target_date) && (
                                            <small>Previsión posterior al compromiso</small>
                                          )}
                                        </td>
                                        <td>
                                          <span className={`results-state ${a.status === "done" ? "bg-kmx-lime/20 font-bold" : a.status === "in_progress" ? "bg-blue-50 font-semibold text-blue-900" : ""}`}>
                                            {activityStatusLabel[a.status] ?? a.status}
                                          </span>
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
                                            {a.status === "done" && data.capabilities.can_review_deliverables && !closed && (
                                              <button type="button" className="action" aria-label={`Solicitar revisión de ${a.title}`} disabled={busy} onClick={() => openActivityRevision(entry)}>Solicitar revisión</button>
                                            )}
                                          </div>
                                          {entry.evidence.map(file => (
                                            <button key={file.id} className="action" disabled={busy} onClick={() => void download(file.id, file.name)}>{file.name}</button>
                                          ))}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              );
                            })}

                            {data.activities.filter(e => !data.commitment?.deliverables.some(d => d.id === e.activity.deliverable_id)).length > 0 && (
                              <>
                                <tr className="results-table-deliverable-header">
                                  <td colSpan={5} className="font-bold text-kmx-gray-600">
                                    📋 Otras actividades sin entregable asignado
                                  </td>
                                </tr>
                                {data.activities
                                  .filter(e => !data.commitment?.deliverables.some(d => d.id === e.activity.deliverable_id))
                                  .map(entry => {
                                    const a = entry.activity;
                                    const blockers = data.blockers.filter(b => b.blocker.activity_id === a.id && !b.blocker.resolved_at);
                                    return (
                                      <tr key={a.id}>
                                        <td>
                                          <span className="results-task-title">{a.title}</span>
                                          <small>Sin entregable asignado</small>
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
                                        </td>
                                        <td>
                                          <span className={`results-state ${a.status === "done" ? "bg-kmx-lime/20 font-bold" : a.status === "in_progress" ? "bg-blue-50 font-semibold text-blue-900" : ""}`}>
                                            {a.status === "done" ? "Cumplida" : a.status === "in_progress" ? "En curso" : "Sin iniciar"}
                                          </span>
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
                                            {a.status === "done" && data.capabilities.can_review_deliverables && !closed && (
                                              <button type="button" className="action" aria-label={`Solicitar revisión de ${a.title}`} disabled={busy} onClick={() => openActivityRevision(entry)}>Solicitar revisión</button>
                                            )}
                                          </div>
                                          {entry.evidence.map(file => (
                                            <button key={file.id} className="action" disabled={busy} onClick={() => void download(file.id, file.name)}>{file.name}</button>
                                          ))}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </>
                            )}
                          </>
                        ) : (
                          data.activities.map(entry => {
                            const a = entry.activity;
                            const blockers = data.blockers.filter(b => b.blocker.activity_id === a.id && !b.blocker.resolved_at);
                            return (
                              <tr key={a.id}>
                                <td>
                                  <span className="results-task-title">{a.title}</span>
                                  <small>Sin entregables definidos</small>
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
                                </td>
                                <td>
                                  <span className={`results-state ${a.status === "done" ? "bg-kmx-lime/20 font-bold" : a.status === "in_progress" ? "bg-blue-50 font-semibold text-blue-900" : ""}`}>
                                    {a.status === "done" ? "Cumplida" : a.status === "in_progress" ? "En curso" : "Sin iniciar"}
                                  </span>
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
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}
              </div>
            </section>
          </div>

          {/* Bloqueos y seguimiento completo (solo si hay bloqueos) */}
          {!isEngineerView && data.blockers.length > 0 && (
          <section className="results-panel" aria-label="Bloqueos y seguimiento">
            <h4>Bloqueos y ayuda requerida</h4>
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

      {!isEngineerView && (
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
      )}
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
      {modal.kind === "activity" && activity && (() => {
        const previousEntry = data.activities.find(e => e.activity.id === activity.id) ?? null;
        const previousBlocker = data.blockers.find(b => b.blocker.activity_id === activity.id && !b.blocker.resolved_at) ?? null;
        const activityHistory = data.history.filter(h => h.stream === `activity/${activity.id}`);
        const deliverable = data.commitment?.deliverables.find(d => d.id === activity.deliverable_id);
        const isDone = activity.status === "done";
        return (
          <form onSubmit={saveActivity}>
            <fieldset disabled={busy} className="results-commitment-editor">
              {/* Encabezado del hito / actividad */}
              <div className="border-b border-kmx-gray-200 pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h5 className="text-base font-bold text-kmx-carbon">{activity.title || "Nueva actividad"}</h5>
                  <span className="text-xs text-kmx-gray-500 font-medium">
                    Responsable: <strong>{activity.responsible_id || "Sin asignar"}</strong>
                  </span>
                </div>
                {deliverable && (
                  <p className="text-xs text-kmx-gray-500 mt-0.5 tabular-nums">
                    Entregable objetivo: <strong>{deliverable.title}</strong> (Compromiso: {deliverable.due_date})
                  </p>
                )}
                {!previousEntry && (
                  <div className="results-fields-row mt-3 pt-2 border-t border-kmx-gray-200">
                    <label className="field">
                      Título de la actividad
                      <input
                        type="text"
                        required
                        placeholder="Describe la actividad..."
                        value={activity.title}
                        onChange={e => setActivity({ ...activity, title: e.target.value })}
                      />
                    </label>
                    {data.commitment?.deliverables && data.commitment.deliverables.length > 0 && (
                      <label className="field">
                        Entregable asociado
                        <select
                          value={activity.deliverable_id}
                          onChange={e => {
                            const nextDeliv = data.commitment?.deliverables.find(d => d.id === e.target.value);
                            setActivity({
                              ...activity,
                              deliverable_id: e.target.value,
                              forecast_due: nextDeliv?.due_date || activity.forecast_due,
                            });
                          }}
                        >
                          {data.commitment.deliverables.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="field">
                      Responsable
                      <select
                        value={activity.responsible_id}
                        onChange={e => setActivity({ ...activity, responsible_id: e.target.value })}
                      >
                        {data.project.engineer_ids.map(id => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="field">
                        Inicio previsto
                        <input
                          type="date"
                          required
                          value={activity.forecast_start}
                          onChange={e => {
                            setCustomForecastStart(true);
                            setActivity({ ...activity, forecast_start: e.target.value });
                          }}
                        />
                      </label>
                      <label className="field">
                        Fin previsto
                        <input
                          type="date"
                          required
                          value={activity.forecast_due}
                          onChange={e => setActivity({ ...activity, forecast_due: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Contraste: Condición Anterior vs. Nueva Condición (Avance) */}
              <div className="results-condition-contrast-grid">
                {/* Columna Izquierda: Condición anterior e histórico */}
                <section className="results-condition-card is-previous space-y-2.5" aria-label="Condición anterior e historial">
                  <div className="flex items-center justify-between border-b border-kmx-gray-200 pb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-kmx-gray-600">Condición anterior</span>
                    <span className={`results-state ${previousEntry?.activity.status === "done" ? "bg-kmx-lime/20 font-bold" : previousEntry?.activity.status === "in_progress" ? "bg-blue-50 font-semibold" : ""}`}>
                      {previousEntry?.activity.status === "done" ? "Cumplida" : previousEntry?.activity.status === "in_progress" ? "En curso" : "Sin iniciar"}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-kmx-gray-600 block">Último reporte:</span>
                    {previousEntry?.activity.note ? (
                      <p className="results-report-note mt-1 text-xs italic text-kmx-carbon">"{previousEntry.activity.note}"</p>
                    ) : (
                      <p className="text-xs text-kmx-gray-400 italic mt-1">Sin avances previos.</p>
                    )}
                  </div>

                  {previousEntry && (
                    <div className="results-condition-meta pt-1 border-t border-kmx-gray-200">
                      <span>Último registro: <strong>{previousEntry.edited_by || previousEntry.created_by}</strong> · {previousEntry.recorded_at.slice(0, 10)}</span>
                    </div>
                  )}

                  {previousEntry && previousEntry.evidence.length > 0 && (
                    <div className="pt-1.5 border-t border-kmx-gray-200 space-y-1">
                      <span className="text-xs font-semibold text-kmx-gray-600 block">Evidencias previas:</span>
                      <div className="flex flex-wrap gap-1">
                        {previousEntry.evidence.map(f => (
                          <button key={f.id} type="button" className="action text-xs inline-flex items-center gap-1" onClick={() => void download(f.id, f.name)}>
                            <Paperclip size={12} aria-hidden="true" />
                            <span>{f.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {previousBlocker && (
                    <div className="p-2 border border-kmx-red-racing bg-red-50 text-xs text-kmx-red-racing rounded mt-1 flex items-center gap-1.5">
                      <AlertTriangle size={13} className="shrink-0" aria-hidden="true" />
                      <span><strong>Bloqueo activo:</strong> {previousBlocker.blocker.reason}</span>
                    </div>
                  )}

                  {activityHistory.length > 0 && (
                    <details className="pt-1 border-t border-kmx-gray-200 text-xs">
                      <summary className="font-semibold text-kmx-gray-600 cursor-pointer">Historial del hito ({activityHistory.length})</summary>
                      <ul className="mt-1 space-y-1 pl-2 border-l-2 border-kmx-gray-300">
                        {activityHistory.map(h => (
                          <li key={h.revision} className="text-kmx-gray-600">
                            <span className="text-kmx-gray-400">{h.recorded_at.slice(0, 10)}</span> · <strong>{h.author_id}</strong>: {h.summary}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>

                {/* Columna Derecha: Nueva condición (Registro de avance hacia cierre) */}
                <section className="results-condition-card is-new space-y-3" aria-label="Nueva condición y registro de avance">
                  <div className="flex items-center justify-between border-b border-kmx-gray-200 pb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-kmx-carbon">Nueva condición (Avance)</span>
                  </div>

                  {/* 1. Fecha de registro */}
                  <label className="field">Fecha de registro
                    <input
                      type="date"
                      required
                      value={registrationDate}
                      onChange={e => setRegistrationDate(e.target.value)}
                    />
                  </label>

                  {/* 2. Nueva condición */}
                  <label className="field">Nueva condición
                    <textarea
                      rows={3}
                      placeholder="Describe el avance u observación..."
                      value={activity.note ?? ""}
                      onChange={e => {
                        const note = e.target.value;
                        setActivity({
                          ...activity,
                          note: note || null,
                          status: isDone ? "done" : note.trim() ? "in_progress" : activity.status,
                          progress: isDone ? 100 : note.trim() ? 50 : activity.progress,
                        });
                      }}
                    />
                  </label>

                  {/* Destino simple al cierre del entregable */}
                  <div className="p-2.5 rounded bg-kmx-gray-50 border border-kmx-gray-300">
                    <label className="results-check cursor-pointer font-bold text-xs text-kmx-carbon">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={e => {
                          const done = e.target.checked;
                          setActivity({
                            ...activity,
                            status: done ? "done" : "in_progress",
                            progress: done ? 100 : 50,
                          });
                        }}
                      />
                      <span>Cumple la condición para el cierre</span>
                    </label>
                  </div>

                  {/* Evidencia de respaldo */}
                  <label className="field">Evidencia · opcional
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                      onChange={e => {
                        const file = e.target.files?.[0] ?? null;
                        if (file && (!file.size || file.size > 20 * 1024 * 1024)) {
                          setError("La evidencia debe contener datos y no superar 20 MB.");
                          e.target.value = "";
                          setAttachment(null);
                        } else {
                          setAttachment(file);
                          if (file && activity.status === "not_started") {
                            setActivity({ ...activity, status: "in_progress", progress: 50 });
                          }
                        }
                      }}
                    />
                    <span className="results-help">PDF, imagen o Excel · máx. 20 MB.</span>
                  </label>

                  {/* 4. Riesgo / problema con la fecha objetivo */}
                  <div className="border border-kmx-gray-300 rounded p-2.5 bg-kmx-gray-50/70 space-y-2">
                    <label className="results-check cursor-pointer font-semibold text-xs">
                      <input
                        type="checkbox"
                        checked={hasTargetDateIssue}
                        onChange={e => {
                          const checked = e.target.checked;
                          setHasTargetDateIssue(checked);
                          setActivity({ ...activity, at_risk: checked });
                        }}
                      />
                      <span className={hasTargetDateIssue ? "text-kmx-red-racing font-bold" : "text-kmx-carbon"}>
                        ¿Riesgo en fecha objetivo ({deliverable?.due_date ?? data.project.target_date})?
                      </span>
                    </label>
                    {hasTargetDateIssue && (
                      <div className="space-y-2 pt-1 border-t border-kmx-gray-200">
                        <label className="field text-xs">Problema / impedimento
                          <input
                            type="text"
                            className="text-xs p-1.5 border rounded"
                            placeholder="¿Qué impide cumplir la fecha?"
                            value={activityBlockerReason}
                            onChange={e => setActivityBlockerReason(e.target.value)}
                          />
                        </label>
                        <label className="field text-xs">Ayuda requerida
                          <input
                            type="text"
                            className="text-xs p-1.5 border rounded"
                            placeholder="¿Qué apoyo o decisión necesitas?"
                            value={activityBlockerHelp}
                            onChange={e => setActivityBlockerHelp(e.target.value)}
                          />
                        </label>
                        <label className="field text-xs">Fecha estimada (previsión)
                          <input
                            type="date"
                            className="text-xs p-1.5 border rounded"
                            value={activity.forecast_due}
                            onChange={e => setActivity({ ...activity, forecast_due: e.target.value })}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="results-modal-sticky-actions">
                <button type="button" className="action" disabled={busy} onClick={closeModal}>
                  Cancelar
                </button>
                <button className="btn-primary">{busy ? "Guardando…" : "Guardar avance"}</button>
              </div>
            </fieldset>
          </form>
        );
      })()}
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
      {modal.kind === "activity_revision" && (
        <form onSubmit={submitActivityRevision}>
          <fieldset disabled={busy} className="results-commitment-editor">
            <p><strong>{modal.entry.activity.title}</strong></p>
            <p className="results-help">
              Responsable: {modal.entry.activity.responsible_id || "Sin asignar"}
              {modal.entry.activity.note ? ` · "${modal.entry.activity.note}"` : ""}
            </p>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-kmx-carbon">Documentos de la actividad finalizada</span>
              {modal.entry.evidence.length > 0 ? (
                <div className="results-actions">
                  {modal.entry.evidence.map(file => (
                    <button type="button" key={file.id} className="action" onClick={() => void download(file.id, file.name)}>
                      {file.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="results-help">Esta actividad no tiene documentos adjuntos.</p>
              )}
            </div>
            <label className="field">Observaciones / motivo de revisión · obligatorio
              <textarea required value={comment} onChange={e => setComment(e.target.value)} placeholder="Indica qué documento o detalle requiere revisión..." />
            </label>
            <button className="btn-primary">{busy ? "Guardando…" : "Solicitar revisión"}</button>
          </fieldset>
        </form>
      )}
      {modal.kind === "closure" && (
        <form onSubmit={submitClosure}>
          <fieldset disabled={busy} className="results-commitment-editor">
            {modal.closed && (
              <>
                <p>{data.commitment?.final_outcome}</p>
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-kmx-carbon">Evaluación de entregables al cierre</span>
                  {data.commitment?.deliverables.map(d => {
                    const delivEvidence = data.activities
                      .filter(e => e.activity.deliverable_id === d.id)
                      .flatMap(e => e.evidence);
                    return (
                      <fieldset className="results-deliverable-editor" key={d.id}>
                        <label className="results-check">
                          <input
                            required
                            type="checkbox"
                            checked={closureDeliverableChecks[d.id] ?? false}
                            onChange={e => setClosureDeliverableChecks({ ...closureDeliverableChecks, [d.id]: e.target.checked })}
                          />
                          <span><strong>{d.title}</strong> (Compromiso: {d.due_date})</span>
                        </label>
                        <ul>
                          {d.criteria.map(c => (
                            <li key={c.id} className="text-xs text-kmx-gray-600">
                              {c.description}{c.evidence_required ? " (requiere evidencia)" : ""}
                            </li>
                          ))}
                        </ul>
                        {delivEvidence.length > 0 ? (
                          <div className="results-actions">
                            {delivEvidence.map(file => (
                              <button type="button" key={file.id} className="action" onClick={() => void download(file.id, file.name)}>
                                {file.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="results-help">Sin documentos adjuntos en actividades de este entregable.</p>
                        )}
                      </fieldset>
                    );
                  })}
                </div>
                <label className="results-check">
                  <input required type="checkbox" checked={confirmOutcome} onChange={e => setConfirmOutcome(e.target.checked)} />
                  He comprobado el estado final acordado y evaluado los entregables de cierre.
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
