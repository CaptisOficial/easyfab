import { useEffect, useRef, useState, type FormEvent } from "react";
import { ResultsModal } from "../projects/ResultsWorkModal";
import { incidentsOverview, requestId, saveIncident, type IncidentInput, type IncidentRecord, type IncidentsOverview, type Issue } from "../../lib/api";
import { extractErrorMessage } from "../../lib/errors";
import { useI18n, type MessageKey } from "../../lib/i18n";

const STATUS_KEYS: Record<Issue["status"], MessageKey> = {
  Open: "incidents.status.open",
  "In Progress": "incidents.status.inProgress",
  Contained: "incidents.status.contained",
  Resolved: "incidents.status.resolved",
};

function blank(): IncidentInput { return { request_id: requestId(), issue_id: null, supersedes: [], issue: { part_number: "", description: "", machine_station: "", occurrence_date: "", target_due_date: "", downtime_hours: 0, scrap_pieces: 0, impact_level: "", status: "Open", root_cause_containment: "", failure_type_id: null } }; }
export function Incidents() {
  const { t, pick, tError } = useI18n();
  const [data, setData] = useState<IncidentsOverview | null>(null); const [input, setInput] = useState(blank);
  const [error, setError] = useState(""); const [noticeKey, setNoticeKey] = useState<MessageKey | "">(""); const [busy, setBusy] = useState(false); const sending = useRef(false);
  const [showForm, setShowForm] = useState(false);
  useEffect(() => { let active = true; incidentsOverview().then(v => { if (active) setData(v); }).catch(e => { if (active) setError(extractErrorMessage(e)); }); return () => { active = false; }; }, []);
  async function reload() { if (sending.current) return; sending.current = true; setBusy(true); setError(""); try { setData(await incidentsOverview()); } catch (e) { setError(extractErrorMessage(e)); } finally { sending.current = false; setBusy(false); } }
  async function submit(e: FormEvent) { e.preventDefault(); if (sending.current) return; sending.current = true; setBusy(true); setError(""); setNoticeKey(""); try { setData(await saveIncident(input)); setInput(blank()); setShowForm(false); setNoticeKey("incidents.notice.saved"); } catch (e) { setError(extractErrorMessage(e)); } finally { sending.current = false; setBusy(false); } }
  function change<K extends keyof Issue>(key: K, value: Issue[K]) { setInput(current => ({ ...current, issue: { ...current.issue, [key]: value } })); }
  function field(key: "part_number" | "description" | "occurrence_date" | "target_due_date" | "impact_level" | "root_cause_containment", label: string, required = true, type = "text") { return <label className="field">{label}<input type={type} required={required} value={input.issue[key]} onChange={e => change(key, e.target.value)} /></label>; }
  function correct(record: IncidentRecord, issue: Issue) { setInput({ request_id: requestId(), issue_id: record.issue_id, supersedes: record.leaves.map(e => e.id), issue: { ...issue } }); setShowForm(true); setNoticeKey(record.leaves.length > 1 ? "incidents.notice.reviewConflicts" : "incidents.notice.editingCorrection"); }
  function machineName(id: string) { const found = data?.catalogs.machines.find(m => m.id === id); return found ? pick(found.name) : id; }
  function legacyStatusLabel(status: unknown) {
    const raw = String(status ?? "");
    return Object.prototype.hasOwnProperty.call(STATUS_KEYS, raw) ? t(STATUS_KEYS[raw as Issue["status"]]) : pick(raw);
  }
  const modalTitle = t(input.issue_id ? "incidents.modal.correctTitle" : "incidents.modal.createTitle");
  return <section className="space-y-5" aria-label={t("nav.incidents")}><div className="flex justify-between gap-3"><h3 className="sr-only">{t("nav.incidents")}</h3><button className="action" disabled={busy} onClick={() => void reload()}>{t("incidents.refresh")}</button><button className="btn-primary" disabled={busy} onClick={() => { setInput(blank()); setShowForm(true); }}>{t("incidents.new")}</button></div>
    {error && <p role="alert" className="text-kmx-red">{tError(error)}</p>}{noticeKey && <p role="status">{t(noticeKey)}</p>}
    {!data ? <p role="status">{t("incidents.loading")}</p> : <div className="work-grid"><div className="space-y-4">{!data.records.length && !data.legacy.length && <p className="empty-state">{t("incidents.empty")}</p>}
      {data.records.map(record => <article className="work-card space-y-3" key={record.issue_id}>{record.leaves.length > 1 && <p role="alert">{t("incidents.concurrentWarning", { count: record.leaves.length })}</p>}{record.leaves.map(event => <div className="space-y-2" key={event.id}><p className="eyebrow">{event.issue.occurrence_date} · {event.reported_by}</p><h4 className="font-bold">{pick(event.issue.description)}</h4><p>{machineName(event.issue.machine_station)} · {t(STATUS_KEYS[event.issue.status])}</p><p className="text-sm">{t("incidents.metricsLine", { downtime: event.issue.downtime_hours, scrap: event.issue.scrap_pieces, pieces: t("weekly.pieces") })}</p><p className="text-sm">{pick(event.issue.root_cause_containment)}</p>{record.can_correct && <button className="action" disabled={busy} onClick={() => correct(record, event.issue)}>{t(record.leaves.length > 1 ? "incidents.mergeFromVersion" : "incidents.correctOrFollowUp")}</button>}</div>)}<details><summary>{t("incidents.historySummary", { count: record.history.length })}</summary><ol className="space-y-2 pt-2">{record.history.map(event => <li key={event.id} className="text-sm">{event.recorded_at} · {event.author_id} · {t(STATUS_KEYS[event.issue.status])} · {pick(event.issue.description)} · {event.issue.downtime_hours} h / {event.issue.scrap_pieces} {t("weekly.pieces")}</li>)}</ol></details></article>)}
      {data.legacy.map((legacy, i) => <article key={i} className="work-card"><p className="eyebrow">{t("incidents.legacyEyebrow")}</p><h4>{pick(String(legacy.description ?? legacy.id ?? t("incidents.legacyFallbackTitle")))}</h4><p>{legacyStatusLabel(legacy.status)}</p><p className="text-sm">{t("incidents.legacyHelp")}</p></article>)}
    </div></div>}
        {showForm && data && <ResultsModal title={modalTitle} closeLabel={t("modal.closeWithTitle", { title: modalTitle.toLowerCase() })} busy={busy} onClose={() => setShowForm(false)}>
          <form onSubmit={submit}><fieldset disabled={busy} className="space-y-3"><p className="text-xs text-kmx-gray-600">{t("common.bilingualHint")}</p>{field("part_number", t("incidents.field.partNumber"))}{field("description", t("incidents.field.description"))}
            <label className="field">{t("incidents.field.machine")}<select required value={input.issue.machine_station} onChange={e => change("machine_station", e.target.value)}><option value="">{t("incidents.field.selectMachine")}</option>{data.catalogs.machines.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{pick(m.name)}</option>)}</select></label>
            <label className="field">{t("incidents.field.failureType")}<select value={input.issue.failure_type_id ?? ""} onChange={e => change("failure_type_id", e.target.value || null)}><option value="">{t("incidents.field.unclassified")}</option>{data.catalogs.failure_types.filter(f => f.active).map(f => <option key={f.id} value={f.id}>{pick(f.name)}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2">{field("occurrence_date", t("incidents.field.occurrenceDate"), true, "date")}{field("target_due_date", t("commitment.targetDate"), false, "date")}</div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="field">{t("incidents.field.downtimeHours")}<input required type="number" min="0" step="0.01" value={input.issue.downtime_hours} onChange={e => change("downtime_hours", e.target.valueAsNumber)} /></label><label className="field">{t("incidents.field.scrapPieces")}<input required type="number" min="0" step="1" value={input.issue.scrap_pieces} onChange={e => change("scrap_pieces", e.target.valueAsNumber)} /></label></div>
            {field("impact_level", t("incidents.field.impactLevel"))}<label className="field">{t("common.status")}<select value={input.issue.status} onChange={e => change("status", e.target.value as Issue["status"])}>{(Object.entries(STATUS_KEYS) as Array<[Issue["status"], MessageKey]>).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}</select></label>{field("root_cause_containment", t("incidents.field.rootCause"), false)}
            {!data.catalogs.machines.some(m => m.active) && <p role="status">{t("incidents.noActiveMachines")}</p>}
            <div className="flex gap-2"><button className="btn-primary" disabled={!data.catalogs.machines.some(m => m.active)}>{t(busy ? "common.saving" : "incidents.save")}</button>{input.issue_id && <button type="button" className="action" onClick={() => setInput(blank())}>{t("incidents.cancelCorrection")}</button>}</div>
          </fieldset></form>
        </ResultsModal>}
  </section>;
}
