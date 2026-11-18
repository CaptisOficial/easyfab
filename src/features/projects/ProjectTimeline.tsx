import { useState } from "react";
import type { ProjectsOverview } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { compactArea, formatStackedGroup } from "./compactLabels";
import { GanttTooltip, type GanttTooltipData } from "./GanttTooltip";
import { movePeriod, overlaps, periodRange, todayKey, type Period } from "./timeline";

type StatusFilter = "active" | "in_progress" | "completed";
const statuses = {
  "Not Started": "Sin iniciar",
  "In Progress": "En curso",
  Completed: "Completado",
  "On Hold": "En pausa",
};
const statusFilterLabels: Record<StatusFilter, string> = {
  active: "activos",
  in_progress: "en curso",
  completed: "completados",
};

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
  const { pick } = useI18n();
  const [period, setPeriod] = useState<Period>("week");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [anchor, setAnchor] = useState(todayKey);
  const [hoveredBar, setHoveredBar] = useState<HoveredProjectBar | null>(null);
  const range = periodRange(anchor, period);
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
        <div role="group" aria-label="Periodo del cronograma" className="schedule-periods">
          {(
            [
              ["week", "Semana"],
              ["month", "Mes"],
              ["year", "Año"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filtrar proyectos por estado" className="schedule-periods">
          {(
            [
              ["active", "Activos"],
              ["in_progress", "En curso"],
              ["completed", "Completados"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="schedule-navigation">
          <button className="action" aria-label="Periodo anterior" onClick={() => setAnchor(movePeriod(anchor, period, -1))}>
            ←
          </button>
          <button className="action" onClick={() => setAnchor(todayKey())}>
            Hoy
          </button>
          <button className="action" aria-label="Periodo siguiente" onClick={() => setAnchor(movePeriod(anchor, period, 1))}>
            →
          </button>
          <label>
            Fecha de referencia{" "}
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
        {range.start} — {range.end} · {projects.length} de {statusProjects.length} proyectos {statusFilterLabels[statusFilter]} en el periodo
      </p>

      {data.projects.length === 0 ? (
        <p className="empty-state">No hay proyectos registrados.</p>
      ) : statusProjects.length === 0 ? (
        <p className="empty-state">No hay proyectos {statusFilterLabels[statusFilter]}.</p>
      ) : projects.length === 0 ? (
        <p className="empty-state">No hay proyectos planificados en este periodo.</p>
      ) : (
        <div className="schedule-scroll" tabIndex={0} role="region" aria-label="Cronograma de proyectos; desplaza para ver todas las fechas">
          <table className="schedule-table">
            <caption className="sr-only">
              Proyectos y mejoras de línea, del {range.start} al {range.end}
            </caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>
                  Prioridad
                </th>
                <th scope="col" rowSpan={2}>
                  WBS / Proyecto
                </th>
                <th scope="col" rowSpan={2}>
                  Área
                </th>
                <th scope="col" rowSpan={2}>
                  Fechas
                </th>
                <th scope="col" rowSpan={2}>
                  Estado
                </th>
                <th scope="col" rowSpan={2}>
                  Resp.
                </th>
                <th scope="colgroup" colSpan={range.columns.length} className="schedule-range">
                  {period === "year"
                    ? anchor.slice(0, 4)
                    : new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(
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
                  .map(s => s.trim())
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
                  endLabel: "Objetivo",
                  area: p.process_area,
                  people: peopleList.map(item => item.label),
                  actionHint: "Clic en el proyecto para ver actividades",
                };

                const activeFlags = range.columns.map(c => overlaps(p.start_date, p.target_date, c.start, c.end));

                return (
                  <tr key={p.id}>
                    <td className="schedule-priority whitespace-nowrap tabular-nums">
                      <span
                        className="font-semibold text-xs px-1.5 py-0.5 rounded bg-kmx-gray-100 text-kmx-carbon border border-kmx-gray-300"
                        title={`Prioridad activa #${rank}`}
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
                            aria-label={`Subir prioridad de ${p.wbs}`}
                            title="Subir prioridad"
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
                            aria-label={`Bajar prioridad de ${p.wbs}`}
                            title="Bajar prioridad"
                            className="px-1 py-0.5 text-xs border rounded hover:bg-kmx-gray-100 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            ▼
                          </button>
                        </span>
                      )}
                    </td>

                    <th scope="row">
                      <button onClick={() => onOpen(p.id)} title={`Abrir ${p.wbs} · ${displayName}`}>
                        {p.wbs} · {displayName}
                      </button>
                    </th>

                    <td className="schedule-compact-cell" aria-label={p.process_area} title={p.process_area}>
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

                    <td className="schedule-dates-cell tabular-nums" title={`Inicio: ${p.start_date} · Objetivo: ${p.target_date}`}>
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
                          aria-label={`${c.label}: ${active ? "Planificado" : "Sin planificación"}`}
                        >
                          {active && (
                            <span
                              tabIndex={0}
                              className={`schedule-bar ${p.status === "Completed" ? "is-complete" : p.status === "On Hold" ? "is-paused" : ""} ${
                                !prevActive ? "is-start" : ""
                              } ${!nextActive ? "is-end" : ""}`}
                              aria-label={`${displayName}: ${p.start_date} a ${p.target_date}`}
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
        <span /> Periodo planificado entre inicio y objetivo (pasa el mouse o enfoca la barra para ver fechas exactas) · Selecciona un proyecto para consultar actividades.
        {data.can_create && " · Usa ▲ y ▼ para ajustar la prioridad activa del área."}
      </p>
    </div>
  );
}
