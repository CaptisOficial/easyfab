import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Clock, Hammer, HelpCircle, Pause, type LucideIcon } from "lucide-react";
import type { Project, ProjectsOverview } from "../../lib/api";
import { localeForLang, useI18n } from "../../lib/i18n";
import { compactArea, formatStackedGroup, toInitials } from "./compactLabels";
import { GanttTooltip, type GanttTooltipData } from "./GanttTooltip";
import { ResultsModal } from "./ResultsWorkModal";
import { movePeriod, overlaps, periodRange, todayKey, type Period } from "./timeline";

type StatusFilter = "active" | "in_progress" | "completed";

const STATUS_META: Record<Project["status"], { Icon: LucideIcon; className: string }> = {
  "Not Started": { Icon: Clock, className: "is-not-started" },
  "In Progress": { Icon: Hammer, className: "is-in-progress" },
  Completed: { Icon: Check, className: "is-completed" },
  "On Hold": { Icon: Pause, className: "is-on-hold" },
};

function formatCompactDate(iso: string, locale: string, referenceYear: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/\./g, "");
  const year = iso.slice(0, 4);
  return year !== referenceYear ? `${formatted} '${year.slice(2)}` : formatted;
}

interface PriorityTarget {
  id: string;
  wbs: string;
  name: string;
  rank: number;
}

interface HoveredProjectBar {
  projectId: string;
  colIndex: number;
  rowIndex: number;
  data: GanttTooltipData;
}

export function ProjectTimeline({
  data,
  onOpen,
  onReorder,
  actions,
}: {
  data: ProjectsOverview;
  onOpen: (id: string) => void;
  onReorder?: (projectIds: string[]) => void;
  actions?: ReactNode;
}) {
  const { lang, t, pick } = useI18n();
  const locale = localeForLang(lang);
  const statuses = {
    "Not Started": t("common.status.notStarted"),
    "In Progress": t("common.status.inProgress"),
    Completed: t("common.status.completed"),
    "On Hold": t("common.status.onHold"),
  };
  const statusFilterLabels: Record<StatusFilter, string> = {
    active: t("timeline.filterLabel.active"),
    in_progress: t("timeline.filterLabel.inProgress"),
    completed: t("timeline.filterLabel.completed"),
  };
  const [period, setPeriod] = useState<Period>("week");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [anchor, setAnchor] = useState(todayKey);
  const [hoveredBar, setHoveredBar] = useState<HoveredProjectBar | null>(null);
  const [showPriorityTooltip, setShowPriorityTooltip] = useState(false);
  const [showStatusTooltip, setShowStatusTooltip] = useState(false);
  const [showOwnersTooltip, setShowOwnersTooltip] = useState(false);
  const [priorityModal, setPriorityModal] = useState<PriorityTarget | null>(null);
  const [priorityValue, setPriorityValue] = useState("");
  const range = periodRange(anchor, period, locale);
  const today = todayKey();
  const anchorYear = anchor.slice(0, 4);
  const canReorder = Boolean(onReorder && data.can_create && data.projects.length > 1);
  const statusProjects = data.projects.filter(p => {
    if (statusFilter === "in_progress") return p.status === "In Progress";
    if (statusFilter === "completed") return p.status === "Completed";
    return p.status !== "Completed";
  });
  const projects = statusProjects.filter(p => overlaps(p.start_date, p.target_date, range.start, range.end));
  const ownerReference = Array.from(
    new Map(
      [
        ...data.leads.map(l => [l.id, l.name] as const),
        ...data.projects.flatMap(p => p.engineer_ids.map(id => [id, data.leads.find(l => l.id === id)?.name ?? id] as const)),
      ]
    ).entries()
  ).map(([id, name]) => ({ id, name, initials: toInitials(name) }));

  function openPriorityModal(target: PriorityTarget) {
    if (!canReorder) return;
    setPriorityModal(target);
    setPriorityValue(String(target.rank));
  }

  function movePriorityTo(targetIndex: number) {
    if (!priorityModal || !onReorder) return;
    const currentIndex = data.projects.findIndex(p => p.id === priorityModal.id);
    if (currentIndex === -1) {
      setPriorityModal(null);
      return;
    }
    const clamped = Math.max(0, Math.min(data.projects.length - 1, targetIndex));
    if (clamped !== currentIndex) {
      const reordered = [...data.projects];
      const [removed] = reordered.splice(currentIndex, 1);
      reordered.splice(clamped, 0, removed);
      onReorder(reordered.map(p => p.id));
    }
    setPriorityModal(null);
  }

  function submitPriority(event: FormEvent) {
    event.preventDefault();
    const parsed = Number.parseInt(priorityValue, 10);
    if (!Number.isFinite(parsed)) return;
    movePriorityTo(parsed - 1);
  }

  return (
    <div className="project-schedule">
      <div className="schedule-toolbar">
        <div role="group" aria-label={t("timeline.periodGroupLabel")} className="schedule-periods">
          {(
            [
              ["week", t("timeline.period.week")],
              ["month", t("timeline.period.month")],
              ["year", t("timeline.period.year")],
            ] as const
          ).map(([value, label]) => (
            <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t("timeline.statusFilterGroupLabel")} className="schedule-periods">
          {(
            [
              ["active", t("timeline.filter.active")],
              ["in_progress", t("common.status.inProgress")],
              ["completed", t("timeline.filter.completed")],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="schedule-navigation">
          <button className="action" aria-label={t("timeline.prevPeriod")} onClick={() => setAnchor(movePeriod(anchor, period, -1))}>
            ←
          </button>
          <button className="action" onClick={() => setAnchor(todayKey())}>
            {t("timeline.today")}
          </button>
          <button className="action" aria-label={t("timeline.nextPeriod")} onClick={() => setAnchor(movePeriod(anchor, period, 1))}>
            →
          </button>
          <label>
            {t("timeline.referenceDate")}{" "}
            <input
              type="date"
              value={anchor}
              onChange={e => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setAnchor(e.target.value);
              }}
            />
          </label>
        </div>
        {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
      </div>

      {data.projects.length === 0 ? (
        <p className="empty-state">{t("timeline.emptyAll")}</p>
      ) : statusProjects.length === 0 ? (
        <p className="empty-state">{t("timeline.emptyFiltered", { status: statusFilterLabels[statusFilter] })}</p>
      ) : projects.length === 0 ? (
        <p className="empty-state">{t("timeline.emptyPeriod")}</p>
      ) : (
        <div className="schedule-scroll" tabIndex={0} role="region" aria-label={t("timeline.regionLabel")}>
          <table className={`schedule-table ${period === "month" ? "is-month" : ""}`}>
            <caption className="sr-only">
              {t("timeline.caption", { start: range.start, end: range.end })}
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  rowSpan={2}
                  className="schedule-status-th"
                  title={!canReorder ? t("timeline.col.priorityTitle") : undefined}
                  onMouseEnter={canReorder ? () => setShowPriorityTooltip(true) : undefined}
                  onMouseLeave={canReorder ? () => setShowPriorityTooltip(false) : undefined}
                >
                  {canReorder ? (
                    <>
                      <button
                        type="button"
                        className="schedule-status-help-trigger"
                        aria-label={t("timeline.col.priorityTitle")}
                        onFocus={() => setShowPriorityTooltip(true)}
                        onBlur={() => setShowPriorityTooltip(false)}
                        onClick={() => setShowPriorityTooltip(open => !open)}
                      >
                        <span>{t("timeline.col.priority")}</span>
                        <HelpCircle size={12} aria-hidden="true" />
                      </button>
                      {showPriorityTooltip && (
                        <div className="schedule-status-tooltip is-left" role="tooltip">
                          <p className="schedule-status-tooltip-title">{t("timeline.col.priorityTitle")}</p>
                          <p className="m-0">{t("timeline.legendReorder").replace(/^\s*·\s*/, "")}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    t("timeline.col.priority")
                  )}
                </th>
                <th scope="col" rowSpan={2}>
                  {t("timeline.col.wbsProject")}
                </th>
                <th scope="col" rowSpan={2}>
                  {t("timeline.col.area")}
                </th>
                <th scope="col" rowSpan={2}>
                  {t("timeline.col.dates")}
                </th>
                <th
                  scope="col"
                  rowSpan={2}
                  className="schedule-status-th"
                  onMouseEnter={() => setShowStatusTooltip(true)}
                  onMouseLeave={() => setShowStatusTooltip(false)}
                >
                  <button
                    type="button"
                    className="schedule-status-help-trigger"
                    aria-label={t("common.status")}
                    onFocus={() => setShowStatusTooltip(true)}
                    onBlur={() => setShowStatusTooltip(false)}
                    onClick={() => setShowStatusTooltip(open => !open)}
                  >
                    <span>{t("timeline.col.statusShort")}</span>
                    <HelpCircle size={12} aria-hidden="true" />
                  </button>
                  {showStatusTooltip && (
                    <div className="schedule-status-tooltip" role="tooltip">
                      <p className="schedule-status-tooltip-title">{t("common.status")}</p>
                      <ul className="schedule-status-tooltip-list">
                        {(["Not Started", "In Progress", "Completed", "On Hold"] as const).map(status => {
                          const StatusIcon = STATUS_META[status].Icon;
                          return (
                            <li key={status}>
                              <span className={`schedule-status-badge ${STATUS_META[status].className}`} aria-hidden="true">
                                <StatusIcon size={12} strokeWidth={2.25} />
                              </span>
                              <span>{statuses[status]}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </th>
                <th
                  scope="col"
                  rowSpan={2}
                  className="schedule-status-th"
                  onMouseEnter={ownerReference.length ? () => setShowOwnersTooltip(true) : undefined}
                  onMouseLeave={ownerReference.length ? () => setShowOwnersTooltip(false) : undefined}
                >
                  {ownerReference.length ? (
                    <>
                      <button
                        type="button"
                        className="schedule-status-help-trigger"
                        aria-label={t("common.responsible")}
                        onFocus={() => setShowOwnersTooltip(true)}
                        onBlur={() => setShowOwnersTooltip(false)}
                        onClick={() => setShowOwnersTooltip(open => !open)}
                      >
                        <span>{t("timeline.col.ownerShort")}</span>
                        <HelpCircle size={12} aria-hidden="true" />
                      </button>
                      {showOwnersTooltip && (
                        <div className="schedule-status-tooltip" role="tooltip">
                          <p className="schedule-status-tooltip-title">{t("common.responsible")}</p>
                          <ul className="schedule-status-tooltip-list">
                            {ownerReference.map(owner => (
                              <li key={owner.id}>
                                <span className="schedule-compact-pill is-person" aria-hidden="true">
                                  {owner.initials}
                                </span>
                                <span>{owner.name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    t("timeline.col.ownerShort")
                  )}
                </th>
                <th scope="colgroup" colSpan={range.columns.length} className="schedule-range">
                  {period === "year"
                    ? anchor.slice(0, 4)
                    : new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
                      new Date(`${anchor}T00:00:00Z`)
                    )}
                </th>
              </tr>
              <tr>
                {range.columns.map(c => {
                  const isToday = overlaps(c.start, c.end, today, today);
                  return (
                    <th
                      scope="col"
                      key={c.start}
                      title={period === "month" ? c.fullLabel : undefined}
                      className={`${c.isWeekend ? "schedule-weekend" : ""} ${isToday ? "schedule-today" : ""}`.trim()}
                    >
                      {c.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, rowIndex) => {
                const globalIndex = data.projects.findIndex(item => item.id === p.id);
                const rank = p.priority ?? globalIndex + 1;
                const peopleList = p.engineer_ids.map(id => {
                  const lead = data.leads.find(l => l.id === id);
                  return { id, label: lead?.name ?? id };
                });
                const stackedPeople = formatStackedGroup(peopleList, 2);
                const areaItems = p.process_area
                  .split(/[,;/]+/)
                  .map(s => pick(s.trim()))
                  .filter(Boolean)
                  .map((area, idx) => ({ id: `${p.id}-area-${idx}`, label: area, compact: compactArea(area) }));
                const stackedAreas = formatStackedGroup(areaItems, 2);

                const displayName = pick(p.name);
                const tooltipData: GanttTooltipData = {
                  kindLabel: p.wbs,
                  title: displayName,
                  statusLabel: statuses[p.status],
                  startDate: p.start_date,
                  endDate: p.target_date,
                  endLabel: t("timeline.targetLabel"),
                  area: stackedAreas.fullText || pick(p.process_area),
                  people: peopleList.map(item => item.label),
                  actionHint: t("timeline.tooltipHint"),
                };

                const activeFlags = range.columns.map(c => overlaps(p.start_date, p.target_date, c.start, c.end));

                const statusMeta = STATUS_META[p.status];
                const compactStart = formatCompactDate(p.start_date, locale, anchorYear);
                const compactTarget = formatCompactDate(p.target_date, locale, anchorYear);

                return (
                  <tr key={p.id}>
                    <td
                      className={`schedule-priority schedule-compact-cell whitespace-nowrap tabular-nums ${canReorder ? "is-reorderable" : ""}`}
                      onContextMenu={canReorder ? e => {
                        e.preventDefault();
                        openPriorityModal({ id: p.id, wbs: p.wbs, name: displayName, rank });
                      } : undefined}
                      title={canReorder ? t("timeline.priorityContextTitle", { rank }) : t("timeline.activePriorityTitle", { rank })}
                    >
                      <span className="schedule-compact-pill">#{rank}</span>
                    </td>

                    <th scope="row">
                      <button onClick={() => onOpen(p.id)} title={t("timeline.openProjectTitle", { wbs: p.wbs, name: displayName })}>
                        {p.wbs} · {displayName}
                      </button>
                    </th>

                    <td className="schedule-compact-cell" aria-label={stackedAreas.fullText || pick(p.process_area)} title={stackedAreas.fullText || pick(p.process_area)}>
                      <div className="schedule-stacked-list">
                        {stackedAreas.visible.map(item => (
                          <span key={item.id} className="schedule-compact-pill">
                            {item.compact}
                          </span>
                        ))}
                        {stackedAreas.overflowCount > 0 && (
                          <span className="schedule-compact-pill is-overflow" title={stackedAreas.fullText}>
                            +{stackedAreas.overflowCount}
                          </span>
                        )}
                      </div>
                    </td>

                    <td
                      className="schedule-dates-cell tabular-nums"
                      aria-label={t("timeline.datesTitle", { start: p.start_date, target: p.target_date })}
                      title={t("timeline.datesTitle", { start: p.start_date, target: p.target_date })}
                    >
                      <div className="schedule-dates-stack">
                        <span>{compactStart}</span>
                        <span className="schedule-date-end">{compactTarget}</span>
                      </div>
                    </td>

                    <td className="schedule-compact-cell">
                      <span
                        className={`schedule-status-badge ${statusMeta.className}`}
                        role="img"
                        aria-label={statuses[p.status]}
                        title={statuses[p.status]}
                      >
                        <statusMeta.Icon size={13} strokeWidth={2.25} aria-hidden="true" />
                      </span>
                    </td>

                    <td className="schedule-compact-cell" aria-label={stackedPeople.fullText} title={stackedPeople.fullText}>
                      <div className="schedule-stacked-list">
                        {stackedPeople.visible.map(person => (
                          <span key={person.id} className="schedule-compact-pill is-person" title={person.label}>
                            {person.compact}
                          </span>
                        ))}
                        {stackedPeople.overflowCount > 0 && (
                          <span className="schedule-compact-pill is-overflow" title={stackedPeople.fullText}>
                            +{stackedPeople.overflowCount}
                          </span>
                        )}
                      </div>
                    </td>

                    {range.columns.map((c, colIndex) => {
                      const active = activeFlags[colIndex];
                      const prevActive = colIndex > 0 && activeFlags[colIndex - 1];
                      const nextActive = colIndex < activeFlags.length - 1 && activeFlags[colIndex + 1];
                      const isHovered = hoveredBar?.projectId === p.id && hoveredBar?.colIndex === colIndex;

                      return (
                        <td
                          key={c.start}
                          className={`schedule-day ${c.isWeekend ? "schedule-weekend" : ""} ${overlaps(c.start, c.end, today, today) ? "schedule-today" : ""}`.trim()}
                          aria-label={t(active ? "timeline.cellScheduled" : "timeline.cellUnscheduled", { label: c.fullLabel })}
                        >
                          {active && (
                            <span
                              tabIndex={0}
                              className={`schedule-bar ${p.status === "Completed" ? "is-complete" : p.status === "On Hold" ? "is-paused" : ""} ${!prevActive ? "is-start" : ""
                                } ${!nextActive ? "is-end" : ""}`}
                              aria-label={t("timeline.barAriaLabel", { name: displayName, start: p.start_date, end: p.target_date })}
                              onMouseEnter={() =>
                                setHoveredBar({ projectId: p.id, colIndex, rowIndex, data: tooltipData })
                              }
                              onMouseLeave={() =>
                                setHoveredBar(curr =>
                                  curr?.projectId === p.id && curr?.colIndex === colIndex ? null : curr
                                )
                              }
                              onFocus={() =>
                                setHoveredBar({ projectId: p.id, colIndex, rowIndex, data: tooltipData })
                              }
                              onBlur={() =>
                                setHoveredBar(curr =>
                                  curr?.projectId === p.id && curr?.colIndex === colIndex ? null : curr
                                )
                              }
                            />
                          )}
                          {isHovered && (
                            <GanttTooltip
                              data={tooltipData}
                              anchorLeftPct={50}
                              placement={rowIndex === 0 ? "bottom" : "top"}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="schedule-legend">
        <span className="schedule-legend-bar" aria-hidden="true" />
        <span>{t("timeline.legendBase")}</span>
      </div>

      {priorityModal && (() => {
        const currentIndex = data.projects.findIndex(p => p.id === priorityModal.id);
        const lastIndex = data.projects.length - 1;
        return (
          <ResultsModal
            title={t("timeline.priorityModalTitle")}
            busy={false}
            onClose={() => setPriorityModal(null)}
          >
            <form onSubmit={submitPriority} className="space-y-4">
              <p className="text-sm text-kmx-gray-600">
                {t("timeline.priorityModalCurrent", {
                  wbs: priorityModal.wbs,
                  name: priorityModal.name,
                  rank: priorityModal.rank,
                })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="action text-xs"
                  disabled={currentIndex <= 0}
                  onClick={() => movePriorityTo(0)}
                >
                  ⤒ {t("timeline.priorityQuickFirst")}
                </button>
                <button
                  type="button"
                  className="action text-xs"
                  disabled={currentIndex <= 0}
                  onClick={() => movePriorityTo(currentIndex - 1)}
                >
                  ↑ {t("timeline.priorityQuickUp")}
                </button>
                <button
                  type="button"
                  className="action text-xs"
                  disabled={currentIndex === -1 || currentIndex >= lastIndex}
                  onClick={() => movePriorityTo(currentIndex + 1)}
                >
                  ↓ {t("timeline.priorityQuickDown")}
                </button>
                <button
                  type="button"
                  className="action text-xs"
                  disabled={currentIndex === -1 || currentIndex >= lastIndex}
                  onClick={() => movePriorityTo(lastIndex)}
                >
                  ⤓ {t("timeline.priorityQuickLast", { max: data.projects.length })}
                </button>
              </div>
              <label className="field">
                {t("timeline.priorityModalLabel", { max: data.projects.length })}
                <input
                  type="number"
                  min={1}
                  max={data.projects.length}
                  required
                  value={priorityValue}
                  onChange={e => setPriorityValue(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="action" onClick={() => setPriorityModal(null)}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className="btn-primary">
                  {t("timeline.priorityModalSave")}
                </button>
              </div>
            </form>
          </ResultsModal>
        );
      })()}
    </div>
  );
}
