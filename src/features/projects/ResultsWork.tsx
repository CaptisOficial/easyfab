import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, BarChart3, LayoutGrid, Paperclip, Plus, RefreshCw, Table2, Target } from "lucide-react";
import { CommitmentEditor, emptyCommitment, commitmentError } from "./CommitmentEditor";
import { ResultsModal } from "./ResultsWorkModal";
import { ResultsGantt } from "./ResultsWorkGantt";
import { DeliverableActions, getActivityStatusLabel, groupDeliverables } from "./deliverableView";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { summarizeResults } from "../../lib/results-metrics";
import {
  resultsDetail, saveResultsCommitment, saveResultsActivity, saveResultsBlocker,
  requestActivityRevision, setResultsClosure, resolveResultsConflict, attachResultsEvidence, openResultsEvidence,
  type ResultsDetail, type ResultsActivity, type OperationsActivityEntry, type OperationsCommitmentDraft,
  type ResultsDeliverable, type OperationsBlockerEntry, type OperationsConflict,
} from "../../lib/results-api";
import "./results-work.css";

const historyActionKey: Record<string, MessageKey> = {
  activate: "results.historyAction.activate", change_commitment: "results.historyAction.changeCommitment", save_activity: "results.historyAction.saveActivity",
  request_activity_revision: "results.historyAction.requestRevision",
  migrate: "results.historyAction.migrate", attach: "results.historyAction.attach", report: "results.historyAction.report", attend: "results.historyAction.attend",
  resolve_blocker: "results.historyAction.resolveBlocker", submit: "results.historyAction.submit", withdraw: "results.historyAction.withdraw", accept: "results.historyAction.accept",
  return: "results.historyAction.return", revise: "results.historyAction.revise", close: "results.historyAction.close", reopen: "results.historyAction.reopen", resolve: "results.historyAction.resolve",
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
  const { lang, t, pick, tError } = useI18n();
  const [data, setData] = useState<ResultsDetail | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false); const sending = useRef(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [activity, setActivity] = useState<ResultsActivity | null>(null);
  const [activityRevision, setActivityRevision] = useState<string | null>(null);
  const [savedActivityJson, setSavedActivityJson] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [commitment, setCommitment] = useState<OperationsCommitmentDraft>(emptyCommitment);
  const [commitmentStartDates, setCommitmentStartDates] = useState<Record<string, string>>({});
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
    resultsDetail(projectId).then(value => { if (active) setData(value); }).catch(e => { if (active) setError(tError(e)); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);

  async function perform(action: () => Promise<ResultsDetail>, message: string) {
    if (sending.current) return null;
    sending.current = true; setBusy(true); setError(""); setNotice("");
    try { const next = await action(); setData(next); setNotice(message); return next; }
    catch (e) { setError(tError(e)); return null; }
    finally { sending.current = false; setBusy(false); }
  }

  function closeModal() { if (!sending.current) { setModal(null); setError(""); } }

  function openCommitment() {
    if (!data) return;
    const startDates: Record<string, string> = {};
    for (const deliv of data.commitment?.deliverables ?? []) {
      const starts = data.activities
        .filter(e => e.activity.deliverable_id === deliv.id && e.activity.forecast_start)
        .map(e => e.activity.forecast_start)
        .sort();
      if (starts.length) startDates[deliv.id] = starts[0];
    }
    setCommitmentStartDates(startDates);
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
    const message = commitmentError(commitment, lang);
    if (message) { setError(message); return; }
    if (data.legacy_entries.length && !data.commitment && !legacyTarget) { setError(t("results.error.selectLegacyTarget")); return; }
    if (!comment.trim()) { setError(t("results.error.missingCommitmentReason")); return; }
    const next = await perform(() => saveResultsCommitment({ project_id: projectId, expected_revision: data.commitment?.revision ?? null, commitment, change_reason: comment, legacy_deliverable_id: legacyTarget || null }), t("results.notice.commitmentSaved"));
    if (!next) return;

    let latest = next;
    const defaultEngineer = latest.project.engineer_ids[0] ?? commitment.engineer_ids[0] ?? "";
    for (const d of commitment.deliverables) {
      const explicitStart = commitmentStartDates[d.id];
      const existing = latest.activities.filter(e => e.activity.deliverable_id === d.id);
      if (existing.length === 0 && explicitStart && defaultEngineer && explicitStart <= d.due_date) {
        try {
          const updated = await saveResultsActivity({
            project_id: projectId,
            expected_revision: null,
            activity: {
              id: `act_${crypto.randomUUID().replaceAll("-", "")}`,
              deliverable_id: d.id,
              title: d.title.trim(),
              responsible_id: defaultEngineer,
              forecast_start: explicitStart,
              forecast_due: d.due_date,
              dependency_ids: [],
              status: "not_started",
              progress: 0,
              at_risk: false,
              hours_spent: null,
              note: null,
            },
          });
          if (updated) {
            latest = updated;
            setData(updated);
          }
        } catch { }
      } else if (existing.length > 0 && explicitStart) {
        const earliest = [...existing].sort((a, b) => a.activity.forecast_start.localeCompare(b.activity.forecast_start))[0];
        if (earliest && earliest.activity.forecast_start !== explicitStart && explicitStart <= earliest.activity.forecast_due) {
          try {
            const updated = await saveResultsActivity({
              project_id: projectId,
              expected_revision: earliest.revision,
              activity: { ...earliest.activity, forecast_start: explicitStart },
            });
            if (updated) {
              latest = updated;
              setData(updated);
            }
          } catch { }
        }
      }
    }
    setModal(null);
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
        if (!row) throw new Error(t("results.error.refreshForEvidence"));
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
            help_needed: activityBlockerHelp.trim() || t("results.defaultHelpNeeded"),
            action: "report",
            comment: "",
          });
          setData(current);
        } catch { }
      }
      setNotice(attachment ? t("results.notice.progressAndEvidenceSaved") : hasTargetDateIssue ? t("results.notice.progressAndRiskSaved") : t("results.notice.progressSaved"));
      setModal(null);
    } catch (e) {
      setError(tError(e));
      if (attaching) setNotice(t("results.notice.progressSavedEvidencePending"));
    } finally {
      sending.current = false; setBusy(false);
    }
  }

  async function submitActivityRevision(event: FormEvent) {
    event.preventDefault(); if (!data || modal?.kind !== "activity_revision") return;
    if (!comment.trim()) { setError(t("results.error.missingRevisionComment")); return; }
    const next = await perform(
      () => requestActivityRevision({ project_id: projectId, activity_id: modal.entry.activity.id, expected_revision: modal.entry.revision, comment }),
      t("results.notice.revisionRequested"),
    );
    if (next) setModal(null);
  }

  async function submitBlocker(event: FormEvent) {
    event.preventDefault(); if (modal?.kind !== "blocker") return;
    if (modal.action === "report" && (!reason.trim() || !help.trim())) { setError(t("results.error.missingBlockerDetails")); return; }
    if (modal.action !== "report" && !comment.trim()) { setError(t("results.error.missingBlockerAction")); return; }
    const next = await perform(() => saveResultsBlocker({ project_id: projectId, blocker_id: modal.entry?.blocker.id ?? null, expected_revision: modal.entry?.revision ?? null, activity_id: modal.activityId, reason, help_needed: help, action: modal.action, comment }), modal.action === "report" ? t("results.notice.blockerReported") : modal.action === "attend" ? t("results.notice.blockerAttended") : t("results.notice.blockerResolved"));
    if (next) setModal(null);
  }

  async function submitClosure(event: FormEvent) {
    event.preventDefault(); if (!data || modal?.kind !== "closure") return;
    const allDeliverablesChecked = !modal.closed || (data.commitment?.deliverables.every(d => closureDeliverableChecks[d.id]) ?? false);
    if (!comment.trim() || (modal.closed && (!confirmOutcome || !allDeliverablesChecked))) {
      setError(t("results.error.incompleteClosure"));
      return;
    }
    const next = await perform(() => setResultsClosure({ project_id: projectId, expected_revision: data.closure?.revision ?? null, closed: modal.closed, confirm_final_outcome: modal.closed && confirmOutcome, comment }), modal.closed ? t("results.notice.projectClosed") : t("results.notice.projectReopened"));
    if (next) setModal(null);
  }

  async function submitConflict(event: FormEvent) {
    event.preventDefault(); if (modal?.kind !== "conflict") return;
    if (!keepRevision || !comment.trim()) { setError(t("results.error.incompleteConflict")); return; }
    const next = await perform(() => resolveResultsConflict({ project_id: projectId, stream: modal.conflict.stream, expected_revisions: modal.conflict.revisions.map(r => r.revision), keep_revision: keepRevision, comment }), t("results.notice.conflictResolved"));
    if (next) setModal(null);
  }

  async function download(id: string, _name: string) {
    if (sending.current) return; sending.current = true; setBusy(true); setError("");
    try { await openResultsEvidence(projectId, id); }
    catch (e) { setError(tError(e)); } finally { sending.current = false; setBusy(false); }
  }

  const closed = data?.closure?.closed === true;
  const canPlan = !!data?.commitment && !!data.capabilities.can_plan_activities && !closed && !data.conflicts.some(c => c.stream === "commitment");
  const isEngineerView = canPlan && !data?.capabilities.can_review_deliverables && !data?.capabilities.can_change_commitment;
  const metrics = data ? summarizeResults(data, reportingDate, lang) : null;

  function conflictLabel(conflict: OperationsConflict, index: number) {
    if (conflict.stream === "commitment") return t("results.conflict.commitment");
    if (conflict.stream === "closure") return t("results.conflict.closure");
    if (conflict.stream.startsWith("review/")) {
      const raw = data?.commitment?.deliverables.find(d => d.id === conflict.stream.slice(7))?.title;
      return t("results.conflict.deliverable", { title: raw ? pick(raw) : index + 1 });
    }
    return t(conflict.stream.startsWith("blocker/") ? "results.conflict.blocker" : "results.conflict.activity", { index: index + 1 });
  }

  const totalActivities = data?.activities.length ?? 0;
  const doneActivities = data?.activities.filter(entry => entry.activity.status === "done" || entry.activity.progress === 100).length ?? 0;
  const overallProgress = totalActivities > 0
    ? Math.round((doneActivities / totalActivities) * 100)
    : 0;
  const openBlockersList = data?.blockers.filter(entry => !entry.blocker.resolved_at) ?? [];

  const modalTitle = modal?.kind === "activity" ? activityRevision ? t("results.modal.updateActivity") : t("results.modal.registerProgress") : modal?.kind === "commitment" ? t("results.modal.defineClosure") : modal?.kind === "blocker" ? modal.action === "report" ? t("results.modal.reportBlocker") : modal.action === "attend" ? t("results.modal.attendBlocker") : t("results.modal.resolveBlocker") : modal?.kind === "activity_revision" ? t("results.modal.reviewActivity") : modal?.kind === "closure" ? modal.closed ? t("results.modal.closeProject") : t("results.modal.reopenProject") : t("results.modal.resolveConflict");

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

  return <section className="results-work" aria-label={t("results.sectionAria")}>
    <header className="results-work-header" aria-label={t("results.headerAria")}>
      <div className="results-work-header-top">
        <div className="results-work-header-title">
          {data ? (
            <>
              <p className="results-eyebrow">{data.project.wbs} · {pick(data.project.process_area)}</p>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-bold text-kmx-carbon">{pick(data.project.name)}</h3>
                <span className="results-state">
                  {closed ? t("results.historyAction.close") : data.project.status === "Not Started" ? t("common.status.notStarted") : data.project.status === "On Hold" ? t("common.status.onHold") : t("common.status.inProgress")}
                </span>
              </div>
            </>
          ) : (
            <h3 className="text-lg font-bold text-kmx-carbon">{t("projects.detail")}</h3>
          )}
        </div>
        <div className="results-work-header-actions">
          {data?.commitment && data.capabilities.can_review_deliverables && (
            <button
              type="button"
              className="btn-primary text-xs py-1.5 px-3"
              disabled={busy || !canCloseProject}
              title={!canCloseProject ? t("results.resolveConflictsFirst") : undefined}
              onClick={() => { setComment(""); setConfirmOutcome(false); setClosureDeliverableChecks({}); setError(""); setModal({ kind: "closure", closed: !closed }); }}
            >
              {closed ? t("results.modal.reopenProject") : t("results.modal.closeProject")}
            </button>
          )}
          <button
            type="button"
            className="action results-icon-btn"
            aria-label={t("results.refreshProject")}
            title={t("results.refreshProject")}
            disabled={busy}
            onClick={() => void perform(() => resultsDetail(projectId), t("results.notice.projectRefreshed"))}
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="action results-icon-btn"
            aria-label={t("results.closeDetail")}
            title={t("common.close")}
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
            <span className="results-header-inline-label">{t("results.commitmentLabel")}</span>
            <strong className="tabular-nums">{data.project.start_date} → {data.project.target_date}</strong>
          </div>
          <div className="results-header-inline-item">
            <span className="results-header-inline-label">{t("results.deliverablesLabel")}</span>
            <strong className="tabular-nums">{t("results.deliverablesCompletedRatio", { completed: completedDeliverableGroups, total: data.commitment?.deliverables.length ?? 0 })}</strong>
          </div>
          <div className="results-header-progress">
            <span className="results-header-inline-label">{t("results.overallProgress")}</span>
            <div className="results-progress-bar-container" role="progressbar" aria-valuenow={overallProgress} aria-valuemin={0} aria-valuemax={100} aria-label={t("results.overallProgress")}>
              <div className="results-progress-bar-fill" style={{ width: `${overallProgress}%` }} />
            </div>
            <strong className="text-xs font-bold tabular-nums">{t("results.activitiesProgressSummary", { done: doneActivities, total: totalActivities, percent: overallProgress })}</strong>
          </div>
          {openBlockersList.length > 0 && (
            <span className="results-state text-kmx-red font-bold">
              {t(openBlockersList.length === 1 ? "results.blockerCountSingle" : "results.blockerCountPlural", { count: openBlockersList.length })}
            </span>
          )}
        </div>
      )}

      {data?.commitment && (
        <div className="results-work-header-outcome">
          <p className="text-sm font-medium text-kmx-carbon">{pick(data.commitment.final_outcome)}</p>
          {data.capabilities.can_change_commitment && !closed && (
            <button type="button" className="action text-xs py-1 px-2.5" aria-label={t("results.editCommitment")} disabled={busy} onClick={openCommitment}>{t("common.edit")}</button>
          )}
        </div>
      )}
    </header>

    {error && !modal && <p role="alert" className="results-error">{error}</p>}
    {notice && !modal && <p role="status" className="results-notice">{notice}</p>}

    {!data ? !error && <p role="status">{t("results.loadingWork")}</p> : <>

      {!!data.plan_issues?.length && (
        <div className="results-warning" role="status">
          <strong>{t("results.planIssuesTitle")}</strong>
          <p>{t("results.planIssuesHelp")}</p>
          <ul>{data.plan_issues.map((issue, index) => <li key={index}>{tError(issue)}</li>)}</ul>
        </div>
      )}

      {!!data.conflicts.length && (
        <section className="results-panel" aria-label={t("results.conflictsAria")}>
          <h4>{t("results.conflictsHeading")}</h4>
          <p className="results-warning">{t("results.conflictsHelp")}</p>
          {data.conflicts.map((conflict, index) => (
            <div className="results-blocker" key={conflict.stream}>
              <p><strong>{conflictLabel(conflict, index)}</strong> · {t("results.conflictAlternatives", { count: conflict.revisions.length })}</p>
              {conflict.revisions.map(v => <p className="results-help" key={v.revision}>{v.author_id} · {v.recorded_at} · {pick(v.summary)}</p>)}
              {data.capabilities.can_change_commitment && (
                <button className="action" disabled={busy} onClick={() => { setComment(""); setKeepRevision(""); setError(""); setModal({ kind: "conflict", conflict }); }}>
                  {t("results.resolveConflictBtn", { label: conflictLabel(conflict, index) })}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {!data.commitment ? (
        <div className="results-panel">
          <h4>{t("results.noCommitmentHeading")}</h4>
          <p className="results-help">{t("results.noCommitmentHelp")}</p>
          {data.conflicts.some(conflict => conflict.stream === "commitment") ? (
            <p className="results-warning">{t("results.commitmentConflictWarning")}</p>
          ) : data.capabilities.can_change_commitment ? (
            <button className="btn-primary" disabled={busy} onClick={openCommitment}>{t("results.defineDodBtn")}</button>
          ) : (
            <p className="results-warning">{t("results.waitForSupervisorDod")}</p>
          )}
        </div>
      ) : (
        <>

          {/* 3. DESGLOSE OPERATIVO: PLANEACIÓN Y PREVISIÓN POR ENTREGABLES */}
          <div className="block">
            {/* COLUMNA IZQUIERDA: ACTIVIDADES POR CUMPLIR */}
            <section className="results-panel space-y-3" aria-label={t("results.planningAria")}>
              <div className="results-section-heading">
                <div className="flex items-center gap-3 flex-wrap">
                  <h4>{t("results.planningHeading")}</h4>
                  {!isEngineerView && (
                    <div className="results-plan-view-controls" role="group" aria-label={t("results.planViewModeAria")}>
                      <button
                        type="button"
                        className={`results-plan-view-btn ${planViewMode === "both" ? "is-active" : ""}`}
                        onClick={() => setPlanViewMode("both")}
                        title={t("results.viewMode.bothTitle")}
                      >
                        <LayoutGrid size={13} aria-hidden="true" />
                        <span>{t("results.viewMode.both")}</span>
                      </button>
                      <button
                        type="button"
                        className={`results-plan-view-btn ${planViewMode === "gantt" ? "is-active" : ""}`}
                        onClick={() => setPlanViewMode("gantt")}
                        title={t("results.viewMode.ganttTitle")}
                      >
                        <BarChart3 size={13} aria-hidden="true" />
                        <span>{t("results.viewMode.gantt")}</span>
                      </button>
                      <button
                        type="button"
                        className={`results-plan-view-btn ${planViewMode === "table" ? "is-active" : ""}`}
                        onClick={() => setPlanViewMode("table")}
                        title={t("results.viewMode.tableTitle")}
                      >
                        <Table2 size={13} aria-hidden="true" />
                        <span>{t("results.viewMode.table")}</span>
                      </button>
                    </div>
                  )}
                </div>
                {canPlan && !isEngineerView && (
                  <button
                    type="button"
                    className="btn-primary results-icon-btn"
                    aria-label={t("results.newActivity")}
                    title={t("results.newActivity")}
                    disabled={busy}
                    onClick={() => openActivity(null)}
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              {!data.activities.length && !isEngineerView && <p>{t("results.emptyActivities")}</p>}

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
                      <table className="results-table" aria-label={t("results.activitiesTableAria")}>
                        <colgroup>
                          <col className="results-col-activity" />
                          <col className="results-col-responsible" />
                          <col className="results-col-forecast" />
                          <col className="results-col-progress" />
                          <col className="results-col-actions" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>{t("gantt.activityKind")}</th>
                            <th>{t("common.responsible")}</th>
                            <th>{t("results.col.forecast")}</th>
                            <th>{t("results.col.progress")}</th>
                            <th>{t("common.actions")}</th>
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
                                            <span className="truncate">{pick(deliv.title)}</span>
                                          </span>
                                          <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-xs text-kmx-gray-500 font-normal tabular-nums">
                                              {t("results.deliverableMeta", { date: deliv.due_date, done: group.doneCount, total: group.totalCount })}
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
                                      const aTitle = pick(a.title);
                                      const blockers = data.blockers.filter(b => b.blocker.activity_id === a.id && !b.blocker.resolved_at);
                                      return (
                                        <tr key={a.id}>
                                          <td>
                                            <span className="results-task-title">{aTitle}</span>
                                            {a.note && <small className="italic text-kmx-gray-500">"{pick(a.note)}"</small>}
                                            {a.dependency_ids.length > 0 && (
                                              <small>{t("results.dependsOn", { list: a.dependency_ids.map(id => { const dep = data.activities.find(e => e.activity.id === id)?.activity.title; return dep ? pick(dep) : t("results.pendingSyncActivity"); }).join(", ") })}</small>
                                            )}
                                          </td>
                                          <td className="results-cell-responsible">
                                            <strong>{a.responsible_id || t("common.unassigned")}</strong>
                                            <small>{t("results.createdEditedBy", { createdBy: entry.created_by, editedBy: entry.edited_by })}</small>
                                          </td>
                                          <td className="results-forecast tabular-nums">
                                            {a.forecast_start}<br />{a.forecast_due}
                                            {a.forecast_due > (deliv.due_date || data.project.target_date) && (
                                              <small>{t("results.forecastAfterCommitment")}</small>
                                            )}
                                          </td>
                                          <td>
                                            <span className={`results-state ${a.status === "done" ? "bg-kmx-lime/20 font-bold" : a.status === "in_progress" ? "bg-blue-50 font-semibold text-blue-900" : ""}`}>
                                              {getActivityStatusLabel(a.status, lang)}
                                            </span>
                                            {a.at_risk && <small className="text-kmx-red font-semibold">{t("common.atRisk")}</small>}
                                            {blockers.length > 0 && <small className="text-kmx-red font-semibold">{t("results.blockersShort", { count: blockers.length })}</small>}
                                          </td>
                                          <td>
                                            <div className="results-actions">
                                              {canPlan && (
                                                <>
                                                  <button className="action" aria-label={t("results.updateActivityAria", { title: aTitle })} disabled={busy} onClick={() => openActivity(entry)}>{t("results.updateBtn")}</button>
                                                  <button className="action" aria-label={t("results.blockerAria", { title: aTitle })} disabled={busy} onClick={() => openBlocker(a.id, null, "report")}>{t("results.blockerBtn")}</button>
                                                </>
                                              )}
                                              {a.status === "done" && data.capabilities.can_review_deliverables && !closed && (
                                                <button type="button" className="action" aria-label={t("results.requestRevisionAria", { title: aTitle })} disabled={busy} onClick={() => openActivityRevision(entry)}>{t("results.requestRevisionBtn")}</button>
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
                                      {t("results.otherUnassignedActivities")}
                                    </td>
                                  </tr>
                                  {data.activities
                                    .filter(e => !data.commitment?.deliverables.some(d => d.id === e.activity.deliverable_id))
                                    .map(entry => {
                                      const a = entry.activity;
                                      const aTitle = pick(a.title);
                                      const blockers = data.blockers.filter(b => b.blocker.activity_id === a.id && !b.blocker.resolved_at);
                                      return (
                                        <tr key={a.id}>
                                          <td>
                                            <span className="results-task-title">{aTitle}</span>
                                            <small>{t("results.noAssignedDeliverable")}</small>
                                            {a.note && <small className="italic text-kmx-gray-500">"{pick(a.note)}"</small>}
                                            {a.dependency_ids.length > 0 && (
                                              <small>{t("results.dependsOn", { list: a.dependency_ids.map(id => { const dep = data.activities.find(e => e.activity.id === id)?.activity.title; return dep ? pick(dep) : t("results.pendingSyncActivity"); }).join(", ") })}</small>
                                            )}
                                          </td>
                                          <td>
                                            {a.responsible_id}
                                            <small>{t("results.createdEditedBy", { createdBy: entry.created_by, editedBy: entry.edited_by })}</small>
                                          </td>
                                          <td className="results-forecast">
                                            {a.forecast_start}<br />{a.forecast_due}
                                          </td>
                                          <td>
                                            <span className={`results-state ${a.status === "done" ? "bg-kmx-lime/20 font-bold" : a.status === "in_progress" ? "bg-blue-50 font-semibold text-blue-900" : ""}`}>
                                              {getActivityStatusLabel(a.status, lang)}
                                            </span>
                                            {a.at_risk && <small className="text-kmx-red font-semibold">{t("common.atRisk")}</small>}
                                            {blockers.length > 0 && <small className="text-kmx-red font-semibold">{t("results.blockersShort", { count: blockers.length })}</small>}
                                          </td>
                                          <td>
                                            <div className="results-actions">
                                              {canPlan && (
                                                <>
                                                  <button className="action" aria-label={t("results.updateActivityAria", { title: aTitle })} disabled={busy} onClick={() => openActivity(entry)}>{t("results.updateBtn")}</button>
                                                  <button className="action" aria-label={t("results.blockerAria", { title: aTitle })} disabled={busy} onClick={() => openBlocker(a.id, null, "report")}>{t("results.blockerBtn")}</button>
                                                </>
                                              )}
                                              {a.status === "done" && data.capabilities.can_review_deliverables && !closed && (
                                                <button type="button" className="action" aria-label={t("results.requestRevisionAria", { title: aTitle })} disabled={busy} onClick={() => openActivityRevision(entry)}>{t("results.requestRevisionBtn")}</button>
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
                              const aTitle = pick(a.title);
                              const blockers = data.blockers.filter(b => b.blocker.activity_id === a.id && !b.blocker.resolved_at);
                              return (
                                <tr key={a.id}>
                                  <td>
                                    <span className="results-task-title">{aTitle}</span>
                                    <small>{t("results.noDefinedDeliverables")}</small>
                                    {a.note && <small className="italic text-kmx-gray-500">"{pick(a.note)}"</small>}
                                    {a.dependency_ids.length > 0 && (
                                      <small>{t("results.dependsOn", { list: a.dependency_ids.map(id => { const dep = data.activities.find(e => e.activity.id === id)?.activity.title; return dep ? pick(dep) : t("results.pendingSyncActivity"); }).join(", ") })}</small>
                                    )}
                                  </td>
                                  <td>
                                    {a.responsible_id}
                                    <small>{t("results.createdEditedBy", { createdBy: entry.created_by, editedBy: entry.edited_by })}</small>
                                  </td>
                                  <td className="results-forecast">
                                    {a.forecast_start}<br />{a.forecast_due}
                                  </td>
                                  <td>
                                    <span className={`results-state ${a.status === "done" ? "bg-kmx-lime/20 font-bold" : a.status === "in_progress" ? "bg-blue-50 font-semibold text-blue-900" : ""}`}>
                                      {getActivityStatusLabel(a.status, lang)}
                                    </span>
                                    {a.at_risk && <small className="text-kmx-red font-semibold">{t("common.atRisk")}</small>}
                                    {blockers.length > 0 && <small className="text-kmx-red font-semibold">{t("results.blockersShort", { count: blockers.length })}</small>}
                                  </td>
                                  <td>
                                    <div className="results-actions">
                                      {canPlan && (
                                        <>
                                          <button className="action" aria-label={t("results.updateActivityAria", { title: aTitle })} disabled={busy} onClick={() => openActivity(entry)}>{t("results.updateBtn")}</button>
                                          <button className="action" aria-label={t("results.blockerAria", { title: aTitle })} disabled={busy} onClick={() => openBlocker(a.id, null, "report")}>{t("results.blockerBtn")}</button>
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
            <section className="results-panel" aria-label={t("results.blockersAria")}>
              <h4>{t("results.blockersHeading")}</h4>
              {data.blockers.map(entry => {
                const b = entry.blocker;
                const age = metrics?.openBlockers.find(item => item.id === b.id)?.ageDays;
                const actRaw = data.activities.find(e => e.activity.id === b.activity_id)?.activity.title;
                const reasonText = pick(b.reason);
                return (
                  <article className="results-blocker" key={b.id}>
                    <div className="results-section-heading">
                      <h5>{actRaw ? pick(actRaw) : b.activity_id}</h5>
                      <span className="results-state">{b.resolved_at ? t("results.blockerStatus.resolved") : b.first_attention_at ? t("results.blockerStatus.attended") : t("results.blockerStatus.pending")}</span>
                    </div>
                    <p>{reasonText}</p>
                    <p className="results-help">{t("results.helpNeededLine", { help: pick(b.help_needed) })}</p>
                    <p className="results-help">{t("results.blockerReportedBy", { name: entry.reported_by, date: b.reported_at })}{age != null ? ` · ${t("results.blockerAgeAtCutoff", { days: age })}` : ""}</p>
                    {b.resolution_note && <p className="results-help">{t("results.blockerResolutionLine", { note: pick(b.resolution_note) })}</p>}
                    {data.capabilities.can_resolve_blockers && !b.resolved_at && !closed && (
                      <div className="results-actions">
                        {!b.first_attention_at && (
                          <button className="action" disabled={busy} onClick={() => openBlocker(b.activity_id, entry, "attend")}>
                            {t("results.attendBlockerBtn", { reason: reasonText })}
                          </button>
                        )}
                        <button className="action" disabled={busy} onClick={() => openBlocker(b.activity_id, entry, "resolve")}>
                          {t("results.resolveBlockerBtn", { reason: reasonText })}
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
          <summary>{t("results.legacySummary", { count: data.legacy_entries.length })}</summary>
          <p className="results-help">{t("results.legacyHelp")}</p>
          <ul>{data.legacy_entries.map(entry => <li key={`${entry.owner_id}/${entry.activity.id}`}>{pick(entry.activity.task_title)} · {entry.owner_name} · {entry.activity.milestone_gate}%</li>)}</ul>
        </details>
      )}

      {!isEngineerView && (
        <details className="results-panel">
          <summary>{t("results.historySummary", { count: data.history.length })}</summary>
          <div className="results-table-scroll">
            <table className="results-table" aria-label={t("results.historyAria")}>
              <thead>
                <tr><th>{t("results.historyCol.date")}</th><th>{t("results.historyCol.person")}</th><th>{t("common.action")}</th><th>{t("results.historyCol.detail")}</th></tr>
              </thead>
              <tbody>
                {data.history.map(item => <tr key={item.revision}><td>{item.recorded_at}</td><td>{item.author_id}</td><td>{t(historyActionKey[item.action] ?? "results.historyAction.default")}</td><td>{pick(item.summary)}</td></tr>)}
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
          <CommitmentEditor
            value={commitment}
            onChange={setCommitment}
            disabled={busy}
            activityStartDates={commitmentStartDates}
            onActivityStartDateChange={(delivId, startDate) => setCommitmentStartDates(prev => ({ ...prev, [delivId]: startDate }))}
          />
          <label className="field">{t("results.commitmentReasonLabel")}<textarea required disabled={busy} value={comment} onChange={e => setComment(e.target.value)} /></label>
          {!data.commitment && data.legacy_entries.length > 0 && (
            <div className="results-warning">
              <p>{t("results.legacyMigrationWarning")}</p>
              <label className="field">{t("results.legacyTargetLabel")}
                <select required disabled={busy} value={legacyTarget} onChange={e => setLegacyTarget(e.target.value)}>
                  <option value="">{t("results.selectDeliverableOption")}</option>
                  {commitment.deliverables.map(d => <option key={d.id} value={d.id}>{pick(d.title) || t("results.unnamedDeliverable")}</option>)}
                </select>
              </label>
            </div>
          )}
          <button className="btn-primary" disabled={busy}>{busy ? t("common.saving") : data.commitment ? t("results.saveCommitmentChange") : t("results.saveDodAndActivate")}</button>
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
                  <h5 className="text-base font-bold text-kmx-carbon">{pick(activity.title) || t("results.newActivity")}</h5>
                  <span className="text-xs text-kmx-gray-500 font-medium">
                    {t("results.ownerInline")} <strong>{activity.responsible_id || t("common.unassigned")}</strong>
                  </span>
                </div>
                {deliverable && (
                  <p className="text-xs text-kmx-gray-500 mt-0.5 tabular-nums">
                    {t("results.targetDeliverableLabel")} <strong>{pick(deliverable.title)}</strong> {t("results.commitmentDateParen", { date: deliverable.due_date })}
                  </p>
                )}
                {!previousEntry && (
                  <div className="results-fields-row mt-3 pt-2 border-t border-kmx-gray-200">
                    <label className="field">
                      {t("results.activityTitleLabel")}
                      <input
                        type="text"
                        required
                        placeholder={t("results.activityTitlePlaceholder")}
                        value={activity.title}
                        onChange={e => setActivity({ ...activity, title: e.target.value })}
                      />
                    </label>
                    {data.commitment?.deliverables && data.commitment.deliverables.length > 0 && (
                      <label className="field">
                        {t("activityGrid.col.deliverable")}
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
                              {pick(d.title)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="field">
                      {t("common.responsible")}
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
                  </div>
                )}
                {(!previousEntry || (data.capabilities.can_plan_activities && !closed)) && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="field">
                      {t("results.forecastStart")}
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
                      {t("results.forecastDue")}
                      <input
                        type="date"
                        required
                        value={activity.forecast_due}
                        onChange={e => setActivity({ ...activity, forecast_due: e.target.value })}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Contraste: Condición Anterior vs. Nueva Condición (Avance) */}
              <div className="results-condition-contrast-grid">
                {/* Columna Izquierda: Condición anterior e histórico */}
                <section className="results-condition-card is-previous space-y-2.5" aria-label={t("results.previousConditionAria")}>
                  <div className="flex items-center justify-between border-b border-kmx-gray-200 pb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-kmx-gray-600">{t("results.previousCondition")}</span>
                    <span className={`results-state ${previousEntry?.activity.status === "done" ? "bg-kmx-lime/20 font-bold" : previousEntry?.activity.status === "in_progress" ? "bg-blue-50 font-semibold" : ""}`}>
                      {getActivityStatusLabel(previousEntry?.activity.status ?? "not_started", lang)}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-kmx-gray-600 block">{t("results.lastReport")}</span>
                    {previousEntry?.activity.note ? (
                      <p className="results-report-note mt-1 text-xs italic text-kmx-carbon">"{pick(previousEntry.activity.note)}"</p>
                    ) : (
                      <p className="text-xs text-kmx-gray-400 italic mt-1">{t("results.noPreviousProgress")}</p>
                    )}
                  </div>

                  {previousEntry && (
                    <div className="results-condition-meta pt-1 border-t border-kmx-gray-200">
                      <span>{t("results.lastRecord")} <strong>{previousEntry.edited_by || previousEntry.created_by}</strong> · {previousEntry.recorded_at.slice(0, 10)}</span>
                    </div>
                  )}

                  {previousEntry && previousEntry.evidence.length > 0 && (
                    <div className="pt-1.5 border-t border-kmx-gray-200 space-y-1">
                      <span className="text-xs font-semibold text-kmx-gray-600 block">{t("results.previousEvidence")}</span>
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
                      <span><strong>{t("results.activeBlocker")}</strong> {pick(previousBlocker.blocker.reason)}</span>
                    </div>
                  )}

                  {activityHistory.length > 0 && (
                    <details className="pt-1 border-t border-kmx-gray-200 text-xs">
                      <summary className="font-semibold text-kmx-gray-600 cursor-pointer">{t("results.activityHistorySummary", { count: activityHistory.length })}</summary>
                      <ul className="mt-1 space-y-1 pl-2 border-l-2 border-kmx-gray-300">
                        {activityHistory.map(h => (
                          <li key={h.revision} className="text-kmx-gray-600">
                            <span className="text-kmx-gray-400">{h.recorded_at.slice(0, 10)}</span> · <strong>{h.author_id}</strong>: {pick(h.summary)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>

                {/* Columna Derecha: Nueva condición (Registro de avance hacia cierre) */}
                <section className="results-condition-card is-new space-y-3" aria-label={t("results.newConditionAria")}>
                  <div className="flex items-center justify-between border-b border-kmx-gray-200 pb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-kmx-carbon">{t("results.newConditionHeading")}</span>
                  </div>

                  {/* 1. Fecha de registro */}
                  <label className="field">{t("results.registrationDate")}
                    <input
                      type="date"
                      required
                      value={registrationDate}
                      onChange={e => setRegistrationDate(e.target.value)}
                    />
                  </label>

                  {/* 2. Nueva condición */}
                  <label className="field">{t("results.newConditionLabel")}
                    <textarea
                      rows={3}
                      placeholder={t("results.newConditionPlaceholder")}
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
                      <span>{t("results.meetsClosureCondition")}</span>
                    </label>
                  </div>

                  {/* Evidencia de respaldo */}
                  <label className="field">{t("results.evidenceOptional")}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                      onChange={e => {
                        const file = e.target.files?.[0] ?? null;
                        if (file && (!file.size || file.size > 20 * 1024 * 1024)) {
                          setError(t("results.error.evidenceFile"));
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
                    <span className="results-help">{t("results.evidenceHelp")}</span>
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
                        {t("results.targetDateRiskQuestion", { date: deliverable?.due_date ?? data.project.target_date })}
                      </span>
                    </label>
                    {hasTargetDateIssue && (
                      <div className="space-y-2 pt-1 border-t border-kmx-gray-200">
                        <label className="field text-xs">{t("results.blockerIssueLabel")}
                          <input
                            type="text"
                            className="text-xs p-1.5 border rounded"
                            placeholder={t("results.blockerIssuePlaceholder")}
                            value={activityBlockerReason}
                            onChange={e => setActivityBlockerReason(e.target.value)}
                          />
                        </label>
                        <label className="field text-xs">{t("results.helpNeededLabel")}
                          <input
                            type="text"
                            className="text-xs p-1.5 border rounded"
                            placeholder={t("results.helpNeededPlaceholder")}
                            value={activityBlockerHelp}
                            onChange={e => setActivityBlockerHelp(e.target.value)}
                          />
                        </label>
                        <label className="field text-xs">{t("results.estimatedForecastDate")}
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
                  {t("common.cancel")}
                </button>
                <button className="btn-primary">{busy ? t("common.saving") : t("results.saveProgress")}</button>
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
                <label className="field">{t("results.blockerReasonQuestion")}<textarea required value={reason} onChange={e => setReason(e.target.value)} /></label>
                <label className="field">{t("results.blockerHelpQuestion")}<textarea required value={help} onChange={e => setHelp(e.target.value)} /></label>
              </>
            ) : (
              <>
                <p><strong>{pick(reason)}</strong></p>
                <p className="results-help">{t("results.helpNeededLine", { help: pick(help) })}</p>
                <label className="field">{modal.action === "attend" ? t("results.blockerAttentionLabel") : t("results.blockerResolutionLabel")}<textarea required value={comment} onChange={e => setComment(e.target.value)} /></label>
                {modal.action === "attend" && <p className="results-help">{t("results.blockerAttendHelp")}</p>}
              </>
            )}
            <button className="btn-primary">{busy ? t("common.saving") : modalTitle}</button>
          </fieldset>
        </form>
      )}
      {modal.kind === "activity_revision" && (
        <form onSubmit={submitActivityRevision}>
          <fieldset disabled={busy} className="results-commitment-editor">
            <p><strong>{pick(modal.entry.activity.title)}</strong></p>
            <p className="results-help">
              {t("results.ownerInline")} {modal.entry.activity.responsible_id || t("common.unassigned")}
              {modal.entry.activity.note ? ` · "${pick(modal.entry.activity.note)}"` : ""}
            </p>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-kmx-carbon">{t("results.finishedActivityDocs")}</span>
              {modal.entry.evidence.length > 0 ? (
                <div className="results-actions">
                  {modal.entry.evidence.map(file => (
                    <button type="button" key={file.id} className="action" onClick={() => void download(file.id, file.name)}>
                      {file.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="results-help">{t("results.noActivityDocs")}</p>
              )}
            </div>
            <label className="field">{t("results.revisionNotesLabel")}
              <textarea required value={comment} onChange={e => setComment(e.target.value)} placeholder={t("results.revisionNotesPlaceholder")} />
            </label>
            <button className="btn-primary">{busy ? t("common.saving") : t("results.requestRevisionBtn")}</button>
          </fieldset>
        </form>
      )}
      {modal.kind === "closure" && (
        <form onSubmit={submitClosure}>
          <fieldset disabled={busy} className="results-commitment-editor">
            {modal.closed && (
              <>
                <p>{data.commitment ? pick(data.commitment.final_outcome) : ""}</p>
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-kmx-carbon">{t("results.closureDeliverablesHeading")}</span>
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
                          <span><strong>{pick(d.title)}</strong> {t("results.commitmentDateParen", { date: d.due_date })}</span>
                        </label>
                        <ul>
                          {d.criteria.map(c => (
                            <li key={c.id} className="text-xs text-kmx-gray-600">
                              {pick(c.description)}{c.evidence_required ? t("results.requiresEvidenceParen") : ""}
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
                          <p className="results-help">{t("results.noDeliverableDocs")}</p>
                        )}
                      </fieldset>
                    );
                  })}
                </div>
                <label className="results-check">
                  <input required type="checkbox" checked={confirmOutcome} onChange={e => setConfirmOutcome(e.target.checked)} />
                  {t("results.confirmClosureOutcome")}
                </label>
              </>
            )}
            <label className="field">{modal.closed ? t("results.closeReasonLabel") : t("results.reopenReasonLabel")}
              <textarea required value={comment} onChange={e => setComment(e.target.value)} />
            </label>
            <button className="btn-primary">{busy ? t("common.saving") : modalTitle}</button>
          </fieldset>
        </form>
      )}
      {modal.kind === "conflict" && (
        <form onSubmit={submitConflict}>
          <fieldset disabled={busy} className="results-commitment-editor">
            <p>{t("results.conflictPrompt")}</p>
            {modal.conflict.revisions.map(variant => (
              <label className="results-check" key={variant.revision}>
                <input required type="radio" name="kept-revision" checked={keepRevision === variant.revision} onChange={() => setKeepRevision(variant.revision)} />
                <span>{variant.author_id} · {variant.recorded_at}<br />{pick(variant.summary)}</span>
              </label>
            ))}
            <label className="field">{t("results.conflictReasonLabel")}<textarea required value={comment} onChange={e => setComment(e.target.value)} /></label>
            <button className="btn-primary">{busy ? t("common.saving") : t("results.integrateVersions")}</button>
          </fieldset>
        </form>
      )}
    </ResultsModal>}
  </section>;
}
