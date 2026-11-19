import { useRef, useState } from "react";
import { exportWeekly, weeklySnapshot, type WeeklySnapshot } from "../../lib/api";
import { extractErrorMessage } from "../../lib/errors";
import { useI18n } from "../../lib/i18n";
function today() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); return ["year", "month", "day"].map(key => parts.find(p => p.type === key)!.value).join("-"); }
export function WeeklyReport() {
  const { t, pick, tError } = useI18n();
  const [date, setDate] = useState(today);
  const [data, setData] = useState<WeeklySnapshot | null>(null);
  const [state, setState] = useState<"idle" | "querying" | "exporting" | "success" | "error">("idle");
  const running = useRef(false);
  const busy = state === "querying" || state === "exporting";
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Awaited<ReturnType<typeof exportWeekly>> | null>(null);
  async function run(exporting: boolean) {
    if (running.current) return;
    running.current = true;
    setState(exporting ? "exporting" : "querying");
    setError("");
    setOutput(null);
    try {
      if (exporting) setOutput(await exportWeekly(date));
      else setData(await weeklySnapshot(date));
      setState("success");
    } catch (e) {
      setError(extractErrorMessage(e));
      setState("error");
    } finally {
      running.current = false;
    }
  }
  const entries = data?.projects.flatMap(p => p.entries) ?? []; const issues = data?.incidents.records.flatMap(r => r.leaves) ?? [];
  const results = data?.result_projects ?? [];
  const resultIds = new Set(results.map(value => value.project.id));
  const accepted = results.flatMap(value => value.reviews.filter(review => review.commitment_revision === value.commitment?.revision && review.status === "accepted"));
  const submitted = results.flatMap(value => value.reviews.filter(review => review.commitment_revision === value.commitment?.revision && review.status === "submitted"));
  return <section className="space-y-4" aria-label={t("weekly.ariaLabel")}><div className="work-heading"><p className="eyebrow">FABRICATION · 10.FAB</p><h3>{t("weekly.title")}</h3><p>{t("weekly.subtitle")}</p></div>
    <fieldset disabled={busy} className="flex flex-wrap items-end gap-3"><label className="field">{t("weekly.reportDate")}<input type="date" required value={date} onChange={e => { setDate(e.target.value); setData(null); setOutput(null); }} /></label><button className="action" disabled={!date} onClick={() => void run(false)}>{t("weekly.queryWeek")}</button><button className="btn-primary" disabled={!date} onClick={() => void run(true)}>{t("weekly.exportExcel")}</button></fieldset>
    <p className="text-sm">{t("weekly.note")}</p>
    {busy && <p role="status">{state === "exporting" ? t("weekly.generating") : t("weekly.preparing")}</p>}{error && <p role="alert" className="text-kmx-red">{tError(error)}</p>}
    {output && <div role="status" className="work-card space-y-2"><p className="font-bold">{t("weekly.saved")}</p><p className="break-all text-sm">{output.path}</p><p className="break-all font-mono text-xs">SHA256: {output.sha256}</p></div>}
    {output?.open_error && <p role="alert">{tError(output.open_error)}</p>}
    {data && <><div className="grid gap-3 sm:grid-cols-4">{[[t("weekly.projects"), data.projects.length], [t("weekly.activities"), entries.length], [t("weekly.acceptedDeliverables"), accepted.length], [t("weekly.submittedDeliverables"), submitted.length]].map(([label, value]) => <div key={label} className="work-card"><p className="eyebrow">{label}</p><strong className="milestone">{value}</strong></div>)}</div>
      <p className="text-sm">{t("weekly.legacyClosuresNote", { count: entries.filter(e => !resultIds.has(e.activity.project_id) && e.activity.supervisor_approved).length })}</p>
      <div className="grid gap-3 sm:grid-cols-3"><div className="work-card"><p>{t("weekly.downtime")}</p><strong className="milestone">{issues.reduce((sum, e) => sum + e.issue.downtime_hours, 0).toFixed(2)} h</strong></div><div className="work-card"><p>{t("weekly.scrap")}</p><strong className="milestone">{issues.reduce((sum, e) => sum + e.issue.scrap_pieces, 0)} {t("weekly.pieces")}</strong></div><div className="work-card"><p>{t("weekly.capacity")}</p><strong>{t("weekly.noData")}</strong><p className="text-sm">{t("weekly.capacityNote")}</p></div></div>
      <ul className="space-y-3" aria-label={t("weekly.periodProjectsAria")}>{data.projects.map(detail => {
        const result = results.find(value => value.project.id === detail.project.id);
        const count = result?.reviews.filter(review => review.commitment_revision === result.commitment?.revision && review.status === "accepted").length ?? 0;
        return <li className="work-card" key={detail.project.id}><h4 className="font-bold">{detail.project.wbs} · {pick(detail.project.name)}</h4><p>{t("weekly.periodActivitiesCount", { count: detail.entries.length })} · {result ? t("weekly.deliverablesAcceptedRatio", { accepted: count, total: result.commitment?.deliverables.length ?? 0 }) : t("weekly.legacyProjectClosures", { count: detail.entries.filter(e => e.activity.supervisor_approved).length })}</p><p className="text-sm">{detail.project.start_date} → {detail.project.target_date}</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><p>{t("weekly.targetLabel")} <strong>{detail.project.target_hours == null ? t("common.undefined") : `${detail.project.target_hours} h`}</strong></p><p>{t("weekly.cumulativeSpentLabel")} <strong>{detail.hours_spent == null ? t("common.incompleteData") : `${detail.hours_spent} h`}</strong></p><p>{result ? t("weekly.openBlockersLabel") : t("weekly.declaredProgressLabel")}: <strong>{result ? result.blockers.filter(value => !value.blocker.resolved_at).length : detail.engineer_progress.map(p => `${p.engineer_name}: ${p.progress == null ? t("common.undeclared") : `${p.progress}%`}`).join(" · ") || t("common.undeclared")}</strong></p></div></li>;
      })}</ul>
    </>}
  </section>;
}
