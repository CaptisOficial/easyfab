import { useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, ClipboardList, Target } from "lucide-react";
import type { OperationsActivityEntry, ResultsDeliverable, OperationsReviewEntry } from "../../lib/results-api";
import { toInitials } from "./compactLabels";
import { GanttTooltip, type GanttTooltipData } from "./GanttTooltip";
import { localeForLang, useI18n } from "../../lib/i18n";
import {
  DeliverableActions,
  getActivityStatusLabel,
  groupDeliverables,
} from "./deliverableView";

const day = (value: string) => {
  const ts = Date.parse(`${value}T00:00:00Z`);
  return isNaN(ts) ? 0 : ts / 86400000;
};

const shortAxisDate = (tickDay: number, locale = "es-MX") =>
  new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(tickDay * 86400000));

const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

interface ActiveTooltip {
  id: string;
  anchorLeftPct: number;
  placement: "top" | "bottom";
  data: GanttTooltipData;
}

export interface ResultsGanttProps {
  entries: OperationsActivityEntry[];
  deliverables?: ResultsDeliverable[];
  reviews?: OperationsReviewEntry[];
  projectStart?: string;
  projectTarget?: string;
  canPlan?: boolean;
  onUpdateActivity?: (entry: OperationsActivityEntry) => void;
  onRegisterDeliverableProgress?: (deliverable: ResultsDeliverable) => void;
}

export function ResultsGantt({
  entries,
  deliverables = [],
  reviews = [],
  projectStart = "",
  projectTarget = "",
  canPlan = false,
  onUpdateActivity,
  onRegisterDeliverableProgress,
}: ResultsGanttProps) {
  const { lang, t, pick } = useI18n();
  const locale = localeForLang(lang);
  const [viewScope, setViewScope] = useState<"all" | "deliverables_only">("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tooltip, setTooltip] = useState<ActiveTooltip | null>(null);

  if (!entries.length && !deliverables.length) {
    return <p className="results-help">{t("gantt.empty")}</p>;
  }

  const validDays: number[] = [
    ...entries.flatMap(e => [day(e.activity.forecast_start), day(e.activity.forecast_due)]),
    ...deliverables.map(d => day(d.due_date)),
  ].filter(d => d > 0);

  if (projectStart && day(projectStart) > 0) validDays.push(day(projectStart));
  if (projectTarget && day(projectTarget) > 0) validDays.push(day(projectTarget));

  const start = validDays.length ? Math.min(...validDays) : 0;
  const end = validDays.length ? Math.max(...validDays) : start + 1;
  const span = Math.max(1, end - start + 1);

  const todayDay = day(todayIso());
  const todayLeftPct =
    todayDay >= start && todayDay <= end ? ((todayDay - start + 0.5) / span) * 100 : null;

  const deliverableGroups = groupDeliverables(entries, deliverables, reviews, undefined, start, end);

  const knownDeliverableIds = new Set(deliverables.map(d => d.id));
  const orphanActivities = entries.filter(e => !knownDeliverableIds.has(e.activity.deliverable_id));

  function toggleDeliverable(id: string) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function showTooltip(id: string, anchorLeftPct: number, placement: "top" | "bottom", data: GanttTooltipData) {
    setTooltip({ id, anchorLeftPct, placement, data });
  }

  function hideTooltip(id: string) {
    setTooltip(current => (current?.id === id ? null : current));
  }

  function handleBarKeyDown(e: KeyboardEvent<HTMLElement>, entry: OperationsActivityEntry) {
    if (!canPlan || !onUpdateActivity) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onUpdateActivity(entry);
    }
  }

  const timelineMinWidth = Math.min(1400, Math.max(460, span * 10));

  function renderActivityRow(
    entry: OperationsActivityEntry,
    isNested: boolean,
    rowIndex: number,
    deliverableTitle?: string
  ) {
    const a = entry.activity;
    const aStart = day(a.forecast_start);
    const aEnd = day(a.forecast_due);
    const isDone = a.status === "done" || a.progress === 100;
    const actTitle = pick(a.title);
    const delivPicked = deliverableTitle ? pick(deliverableTitle) : undefined;
    const matchesDeliverable = Boolean(
      isNested && deliverableTitle && (a.title.trim().toLowerCase() === deliverableTitle.trim().toLowerCase() || (delivPicked && actTitle.trim().toLowerCase() === delivPicked.trim().toLowerCase()))
    );
    const statusText = getActivityStatusLabel(a.status, lang);
    const displayLabel = matchesDeliverable
      ? (a.note?.trim() ? `${a.progress}% · ${pick(a.note.trim())}` : t("gantt.progressWithStatus", { progress: a.progress, status: statusText }))
      : actTitle;
    const actLeft = Math.max(0, (100 * (aStart - start)) / span);
    const actWidth = Math.max(2.2, (100 * (Math.max(aStart, aEnd) - aStart + 1)) / span);
    const barCenter = actLeft + actWidth / 2;
    const interactive = Boolean(onUpdateActivity && canPlan);
    const placement: "top" | "bottom" = rowIndex === 0 ? "bottom" : "top";
    const tooltipData: GanttTooltipData = {
      kindLabel: t("gantt.activityKind"),
      title: actTitle,
      statusLabel: statusText,
      atRisk: a.at_risk,
      startDate: a.forecast_start,
      endDate: a.forecast_due,
      progress: a.progress,
      people: a.responsible_id ? [a.responsible_id] : [],
      actionHint: interactive ? t("gantt.activityActionHint") : undefined,
    };

    return (
      <div className="results-gantt-row results-gantt-row-activity" key={a.id}>
        <div className="results-gantt-rail">
          <div className="results-gantt-rail-col-expand">
            {isNested && (
              <span className="results-gantt-sub-indent" aria-hidden="true">
                └
              </span>
            )}
          </div>
          <div className="results-gantt-rail-col-text">
            <div className="results-gantt-rail-main">
              <span
                className={`results-gantt-title ${matchesDeliverable ? "text-kmx-gray-600 italic" : "font-medium"}`}
                title={displayLabel}
              >
                {displayLabel}
              </span>
              <span
                className="results-gantt-initials-badge"
                title={t("gantt.ownerTitle", { name: a.responsible_id })}
                aria-label={t("gantt.ownerAria", { name: a.responsible_id })}
              >
                {toInitials(a.responsible_id)}
              </span>
            </div>
          </div>
          <div className="results-gantt-rail-col-action" />
        </div>

        <div className="results-gantt-track-cell">
          <div className="results-gantt-track" style={{ minWidth: timelineMinWidth }}>
            {todayLeftPct !== null && (
              <div className="results-gantt-today-line" style={{ left: `${todayLeftPct}%` }} aria-hidden="true" />
            )}
            <div
              className={`results-gantt-bar results-gantt-activity-bar ${isDone ? "is-done" : ""} ${a.at_risk ? "is-at-risk" : ""
                } ${interactive ? "is-interactive" : ""}`}
              style={{ left: `${actLeft}%`, width: `${actWidth}%` }}
              aria-label={t("gantt.activityBarAria", { title: actTitle, start: a.forecast_start, end: a.forecast_due, progress: a.progress, risk: a.at_risk ? t("gantt.atRiskSuffix") : "" })}
              onClick={() => interactive && onUpdateActivity?.(entry)}
              onKeyDown={e => handleBarKeyDown(e, entry)}
              onMouseEnter={() => showTooltip(a.id, barCenter, placement, tooltipData)}
              onMouseLeave={() => hideTooltip(a.id)}
              onFocus={() => showTooltip(a.id, barCenter, placement, tooltipData)}
              onBlur={() => hideTooltip(a.id)}
              role={interactive ? "button" : undefined}
              tabIndex={0}
            >
              <span className="results-gantt-progress" style={{ width: `${a.progress}%` }} />
              <span className="tabular-nums">
                {a.at_risk ? "! " : isDone ? "✓ " : ""}
                {a.progress}%
              </span>
            </div>
            {tooltip?.id === a.id && (
              <GanttTooltip data={tooltip.data} anchorLeftPct={tooltip.anchorLeftPct} placement={tooltip.placement} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="results-gantt-wrapper space-y-2">
      {/* Barra de control del Gantt */}
      <div className="results-gantt-toolbar">
        {deliverables.length > 0 && (
          <div className="inline-flex rounded-md shadow-sm border border-kmx-gray-300 overflow-hidden text-xs">
            <button
              type="button"
              className={`px-2.5 py-1.5 font-medium transition-colors ${viewScope === "all" ? "bg-kmx-carbon text-white" : "bg-white text-kmx-carbon hover:bg-kmx-gray-100"
                }`}
              onClick={() => setViewScope("all")}
              title={t("gantt.scopeAllTitle")}
            >
              {t("gantt.scopeAll", { count: entries.length })}
            </button>
            <button
              type="button"
              className={`px-2.5 py-1.5 font-medium transition-colors border-l border-kmx-gray-300 ${viewScope === "deliverables_only"
                ? "bg-kmx-carbon text-white"
                : "bg-white text-kmx-carbon hover:bg-kmx-gray-100"
                }`}
              onClick={() => setViewScope("deliverables_only")}
              title={t("gantt.scopeDeliverablesTitle")}
            >
              {t("gantt.scopeDeliverables", { count: deliverables.length })}
            </button>
          </div>
        )}
      </div>

      {/* Región accesible del Gantt */}
      <div className="results-gantt-scroll" role="region" aria-label={t("gantt.regionLabel")} tabIndex={0}>
        <div className="results-gantt">
          {/* Encabezado sincronizado */}
          <div className="results-gantt-header-row">
            <div className="results-gantt-rail results-gantt-rail-head">
              <span className="results-gantt-rail-col-expand" aria-hidden="true" />
              <span className="results-gantt-rail-col-text">{t("gantt.activityKind")}</span>
              <span className="results-gantt-rail-col-action" aria-hidden="true" />
            </div>
            <div className="results-gantt-track-cell">
              <div className="results-gantt-axis" style={{ minWidth: timelineMinWidth }}>
                {Array.from({ length: 5 }, (_, i) => {
                  const tickDay = start + Math.round(((span - 1) * i) / 4);
                  const iso = new Date(tickDay * 86400000).toISOString().slice(0, 10);
                  return (
                    <span key={i} className="tabular-nums" title={iso}>
                      {shortAxisDate(tickDay, locale)}
                    </span>
                  );
                })}
                {todayLeftPct !== null && (
                  <span
                    className="results-gantt-today-badge"
                    style={{ left: `${todayLeftPct}%` }}
                    title={t("gantt.todayTitle", { date: todayIso() })}
                  >
                    {t("timeline.today")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Entregables y subactividades */}
          {deliverables.length > 0 ? (
            deliverableGroups.map((group, groupIdx) => {
              const d = group.deliverable;
              const dTitle = pick(d.title);
              const isCollapsed = collapsed[d.id] && viewScope === "all";
              const delivLeft = Math.max(0, (100 * (group.startDay - start)) / span);
              const delivWidth = Math.max(2.5, (100 * (group.endDay - group.startDay + 1)) / span);
              const dueMarkerLeft =
                group.dueDay > 0 ? Math.max(0, Math.min(100, (100 * (group.dueDay - start)) / span)) : null;
              const barCenter = delivLeft + delivWidth / 2;
              const placement: "top" | "bottom" = groupIdx === 0 ? "bottom" : "top";
              const delivTooltip: GanttTooltipData = {
                kindLabel: t("gantt.deliverableKind"),
                title: dTitle,
                statusLabel: group.totalCount > 0 && group.doneCount === group.totalCount ? t("gantt.deliverableDone") : t("gantt.deliverableInProgress"),
                startDate: group.startIso,
                endDate: d.due_date || group.endIso,
                endLabel: t("results.commitmentLabel"),
                progress: group.progress,
                actionHint: t("gantt.deliverableProgressHint", { done: group.doneCount, total: group.totalCount }),
              };

              return (
                <div key={d.id} className="results-gantt-deliverable-block">
                  <div className="results-gantt-row results-gantt-row-deliverable">
                    <div className="results-gantt-rail">
                      <div className="results-gantt-rail-col-expand">
                        {viewScope === "all" && (
                          <button
                            type="button"
                            className="results-gantt-expand-btn"
                            aria-expanded={!isCollapsed}
                            aria-label={t(isCollapsed ? "gantt.expandDeliverable" : "gantt.collapseDeliverable", { title: dTitle })}
                            onClick={() => toggleDeliverable(d.id)}
                          >
                            {isCollapsed ? (
                              <ChevronRight size={14} aria-hidden="true" />
                            ) : (
                              <ChevronDown size={14} aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </div>

                      <div className="results-gantt-rail-col-text">
                        <div className="results-gantt-rail-main">
                          <Target size={14} className="results-gantt-icon-target" aria-hidden="true" />
                          <span className="results-gantt-title font-bold text-kmx-carbon" title={dTitle}>
                            {dTitle}
                          </span>
                        </div>
                      </div>

                      <div className="results-gantt-rail-col-action">
                        <DeliverableActions
                          deliverable={d}
                          canPlan={canPlan}
                          onAddActivity={onRegisterDeliverableProgress}
                        />
                      </div>
                    </div>

                    <div className="results-gantt-track-cell">
                      <div className="results-gantt-track" style={{ minWidth: timelineMinWidth }}>
                        {todayLeftPct !== null && (
                          <div
                            className="results-gantt-today-line"
                            style={{ left: `${todayLeftPct}%` }}
                            aria-hidden="true"
                          />
                        )}
                        <div
                          className={`results-gantt-bar results-gantt-deliverable-bar ${group.status === "accepted" ? "is-done" : ""
                            }`}
                          style={{ left: `${delivLeft}%`, width: `${delivWidth}%` }}
                          tabIndex={0}
                          aria-label={t("gantt.deliverableBarAria", { title: dTitle, start: group.startIso, end: d.due_date, progress: group.progress })}
                          onMouseEnter={() => showTooltip(d.id, barCenter, placement, delivTooltip)}
                          onMouseLeave={() => hideTooltip(d.id)}
                          onFocus={() => showTooltip(d.id, barCenter, placement, delivTooltip)}
                          onBlur={() => hideTooltip(d.id)}
                        >
                          <span className="results-gantt-progress" style={{ width: `${group.progress}%` }} />
                          <span className="tabular-nums">
                            {group.status === "accepted" ? "✓ " : ""}
                            {group.progress}%
                          </span>
                        </div>
                        {dueMarkerLeft !== null && (
                          <div
                            className="results-gantt-due-marker"
                            style={{ left: `${dueMarkerLeft}%` }}
                            title={t("gantt.dodCommitmentTitle", { date: d.due_date })}
                            aria-label={t("gantt.commitmentDateAria", { date: d.due_date })}
                          >
                            <span className="results-gantt-due-flag" aria-hidden="true">
                              ◆
                            </span>
                          </div>
                        )}
                        {tooltip?.id === d.id && (
                          <GanttTooltip
                            data={tooltip.data}
                            anchorLeftPct={tooltip.anchorLeftPct}
                            placement={tooltip.placement}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {viewScope === "all" &&
                    !isCollapsed &&
                    group.activities.map((entry, idx) => renderActivityRow(entry, true, groupIdx + idx + 1, d.title))}
                </div>
              );
            })
          ) : (
            entries.map((entry, idx) => renderActivityRow(entry, false, idx))
          )}

          {orphanActivities.length > 0 && viewScope === "all" && (
            <div className="results-gantt-deliverable-block">
              <div className="results-gantt-row results-gantt-row-deliverable">
                <div className="results-gantt-rail">
                  <div className="results-gantt-rail-col-expand" />
                  <div className="results-gantt-rail-col-text">
                    <div className="results-gantt-rail-main">
                      <ClipboardList size={14} aria-hidden="true" />
                      <span className="results-gantt-title font-bold text-kmx-gray-600">
                        {t("gantt.orphanActivities")}
                      </span>
                    </div>
                  </div>
                  <div className="results-gantt-rail-col-action" />
                </div>
                <div className="results-gantt-track-cell">
                  <div className="results-gantt-track" style={{ minWidth: timelineMinWidth }} />
                </div>
              </div>
              {orphanActivities.map((entry, idx) => renderActivityRow(entry, true, idx + 1))}
            </div>
          )}
        </div>
      </div>

      {/* Leyenda operativa */}
      <div className="results-gantt-legend">
        <span>
          <i className="results-legend-swatch is-deliverable" aria-hidden="true" /> {t("gantt.legendDeliverable")}
        </span>
        <span>
          <i className="results-legend-swatch is-activity" aria-hidden="true" /> {t(canPlan ? "gantt.legendActivityInteractive" : "gantt.legendActivity")}
        </span>
        <span>
          <i className="results-legend-swatch is-done" aria-hidden="true" /> {t("gantt.legendDone")}
        </span>
        <span>
          <i className="results-legend-swatch is-risk" aria-hidden="true" /> {t("gantt.legendRisk")}
        </span>
        <span>
          <strong className="results-gantt-due-flag" aria-hidden="true">◆</strong> {t("gantt.legendDod")}
        </span>
        {todayLeftPct !== null && (
          <span>
            <i className="results-legend-swatch is-today" aria-hidden="true" /> {t("timeline.today")}
          </span>
        )}
      </div>
    </div>
  );
}
