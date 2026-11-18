import { useState } from "react";
import type { ProjectsOverview } from "../../lib/api";
import { localeForLang, useI18n } from "../../lib/i18n";
import { compactArea, formatStackedGroup } from "./compactLabels";
import { GanttTooltip, type GanttTooltipData } from "./GanttTooltip";
import { movePeriod, overlaps, periodRange, todayKey, type Period } from "./timeline";

type StatusFilter = "active" | "in_progress" | "completed";

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
}: {
  data: ProjectsOverview;
  onOpen: (id: string) => void;
  onReorder?: (projectIds: string[]) => void;
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
  const range = periodRange(anchor, period, locale);
  const today = todayKey();
  const statusProjects = data.projects.filter(p => {
    if (statusFilter === "in_progress") return p.status === "In Progress";
    if (statusFilter === "completed") return p.status === "Completed";
    return p.status !== "Completed";
  });
  const projects = statusProjects.filter(p => overlaps(p.start_date, p.target_date, range.start, range.end));

  function moveProject(id: string, delta: number) {
    if (!onReorder) return;
    const currentIndex = data.projects.findIndex(p => p.id === id);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= data.projects.length) return;
    const reordered = [...data.projects];
    const [removed] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, removed);
    onReorder(reordered.map(p => p.id));
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
      </div>

      <p className="schedule-summary tabular-nums" role="status">
        {t("timeline.summary", { start: range.start, end: range.end, shown: projects.length, total: statusProjects.length, status: statusFilterLabels[statusFilter] })}
      </p>

      {data.projects.length === 0 ? (
        <p className="empty-state">{t("timeline.emptyAll")}</p>
      ) : statusProjects.length === 0 ? (
        <p className="empty-state">{t("timeline.emptyFiltered", { status: statusFilterLabels[statusFilter] })}</p>
      ) : projects.length === 0 ? (
        <p className="empty-state">{t("timeline.emptyPeriod")}</p>
      ) : (
        <div className="schedule-scroll" tabIndex={0} role="region" aria-label={t("timeline.regionLabel")}>
          <table className="schedule-table">
            <caption className="sr-only">
              {t("timeline.caption", { start: range.start, end: range.end })}
            </caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>
                  {t("timeline.col.priority")}
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
                <th scope="col" rowSpan={2}>
                  {t("common.status")}
                </th>
                <th scope="col" rowSpan={2}>
                  {t("timeline.col.ownerShort")}
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
                {range.columns.map(c => (
                  <th scope="col" key={c.start} className={overlaps(c.start, c.end, today, today) ? "schedule-today" : ""}>
                    {c.label}
                  </th>
                ))}
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

                return (
                  <tr key={p.id}>
                    <td className="schedule-priority whitespace-nowrap tabular-nums">
                      <span
                        className="font-semibold text-xs px-1.5 py-0.5 rounded bg-kmx-gray-100 text-kmx-carbon border border-kmx-gray-300"
                        title={t("timeline.activePriorityTitle", { rank })}
                      >
                        #{rank}
                      </span>
                      {onReorder && data.can_create && (
                        <span className="inline-flex items-center gap-0.5 ml-1.5">
                          <button
                            type="button"
                            disabled={globalIndex === 0}
                            onClick={e => {
                              e.stopPropagation();
                              moveProject(p.id, -1);
                            }}
                            aria-label={t("timeline.movePriorityUpAria", { wbs: p.wbs })}
                            title={t("timeline.movePriorityUp")}
                            className="px-1 py-0.5 text-xs border rounded hover:bg-kmx-gray-100 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={globalIndex === data.projects.length - 1}
                            onClick={e => {
                              e.stopPropagation();
                              moveProject(p.id, 1);
                            }}
                            aria-label={t("timeline.movePriorityDownAria", { wbs: p.wbs })}
                            title={t("timeline.movePriorityDown")}
                            className="px-1 py-0.5 text-xs border rounded hover:bg-kmx-gray-100 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            ▼
                          </button>
                        </span>
                      )}
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

                    <td className="schedule-dates-cell tabular-nums" title={t("timeline.datesTitle", { start: p.start_date, target: p.target_date })}>
                      <div className="schedule-dates-stack">
                        <span>{p.start_date}</span>
                        <span className="schedule-date-end">{p.target_date}</span>
                      </div>
                    </td>

                    <td>
                      <span className="schedule-status">{statuses[p.status]}</span>
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
                          className={`schedule-day ${overlaps(c.start, c.end, today, today) ? "schedule-today" : ""}`}
                          aria-label={t(active ? "timeline.cellScheduled" : "timeline.cellUnscheduled", { label: c.label })}
                        >
                          {active && (
                            <span
                              tabIndex={0}
                              className={`schedule-bar ${p.status === "Completed" ? "is-complete" : p.status === "On Hold" ? "is-paused" : ""} ${
                                !prevActive ? "is-start" : ""
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

      <p className="schedule-legend">
        <span /> {t("timeline.legendBase")}
        {data.can_create && t("timeline.legendReorder")}
      </p>
    </div>
  );
}
