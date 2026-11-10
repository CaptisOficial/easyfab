import { useState } from "react";
import type { ProjectsOverview } from "../../lib/api";
import { movePeriod, overlaps, periodRange, todayKey, type Period } from "./timeline";

const statuses = { "Not Started": "Sin iniciar", "In Progress": "En curso", Completed: "Completado", "On Hold": "En pausa" };
export function ProjectTimeline({ data, onOpen }: { data: ProjectsOverview; onOpen: (id: string) => void }) {
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(todayKey);
  const range = periodRange(anchor, period);
  const today = todayKey();
  const projects = data.projects.filter(p => overlaps(p.start_date, p.target_date, range.start, range.end));
  return <div className="project-schedule">
    <div className="schedule-toolbar">
      <div role="group" aria-label="Periodo del cronograma" className="schedule-periods">{([["week", "Semana"], ["month", "Mes"], ["year", "Año"]] as const).map(([value, label]) => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div>
      <div className="schedule-navigation"><button className="action" aria-label="Periodo anterior" onClick={() => setAnchor(movePeriod(anchor, period, -1))}>←</button><button className="action" onClick={() => setAnchor(todayKey())}>Hoy</button><button className="action" aria-label="Periodo siguiente" onClick={() => setAnchor(movePeriod(anchor, period, 1))}>→</button><label>Fecha de referencia <input type="date" value={anchor} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setAnchor(e.target.value); }} /></label></div>
    </div>
    <p className="schedule-summary" role="status">{range.start} — {range.end} · {projects.length} de {data.projects.length} proyectos en el periodo</p>
    {data.projects.length === 0 ? <p className="empty-state">No hay proyectos registrados.</p> : projects.length === 0 ? <p className="empty-state">No hay proyectos planificados en este periodo.</p> : <div className="schedule-scroll" tabIndex={0} role="region" aria-label="Cronograma de proyectos; desplaza para ver todas las fechas">
      <table className="schedule-table"><caption className="sr-only">Proyectos y mejoras de línea, del {range.start} al {range.end}</caption>
        <thead><tr><th scope="col" rowSpan={2}>WBS / Proyecto</th><th scope="col" rowSpan={2}>Proceso / Área</th><th scope="col" rowSpan={2}>Inicio</th><th scope="col" rowSpan={2}>Objetivo</th><th scope="col" rowSpan={2}>Estado</th><th scope="col" rowSpan={2}>Responsables</th><th scope="colgroup" colSpan={range.columns.length} className="schedule-range">{period === "year" ? anchor.slice(0, 4) : new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${anchor}T00:00:00Z`))}</th></tr>
        <tr>{range.columns.map(c => <th scope="col" key={c.start} className={overlaps(c.start, c.end, today, today) ? "schedule-today" : ""}>{c.label}</th>)}</tr></thead>
        <tbody>{projects.map(p => <tr key={p.id}><th scope="row"><button onClick={() => onOpen(p.id)} title={`Abrir ${p.wbs}`}>{p.wbs} · {p.name}</button></th><td>{p.process_area}</td><td>{p.start_date}</td><td>{p.target_date}</td><td><span className="schedule-status">{statuses[p.status]}</span></td><td>{p.engineer_ids.map(id => data.leads.find(l => l.id === id)?.name ?? id).join(", ")}</td>{range.columns.map(c => {
          const active = overlaps(p.start_date, p.target_date, c.start, c.end);
          return <td key={c.start} className={`schedule-day ${overlaps(c.start, c.end, today, today) ? "schedule-today" : ""}`} aria-label={`${c.label}: ${active ? "Planificado" : "Sin planificación"}`}>{active && <span className={`schedule-bar ${p.status === "Completed" ? "is-complete" : p.status === "On Hold" ? "is-paused" : ""}`} title={`${p.name}: ${p.start_date} — ${p.target_date}`} />}</td>;
        })}</tr>)}</tbody>
      </table>
    </div>}
    <p className="schedule-legend"><span /> Periodo planificado entre inicio y objetivo · Selecciona un proyecto para consultar actividades y avance.</p>
  </div>;
}
