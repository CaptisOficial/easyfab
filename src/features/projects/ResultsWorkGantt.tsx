import type { OperationsActivityEntry } from "../../lib/results-api";
const day = (value: string) => Date.parse(`${value}T00:00:00Z`) / 86400000;
export function ResultsGantt({ entries }: { entries: OperationsActivityEntry[] }) {
  if (!entries.length) return <p className="results-help">El Gantt aparecerá al planear la primera actividad.</p>;
  const start = Math.min(...entries.map(e => day(e.activity.forecast_start)));
  const end = Math.max(...entries.map(e => day(e.activity.forecast_due)));
  const span = Math.max(1, end - start + 1);
  return <div className="results-gantt-scroll" role="region" aria-label="Gantt de actividades" tabIndex={0}>
    <div className="results-gantt" style={{ minWidth: Math.min(1800, Math.max(500, span * 6)) }}>
      <div className="results-gantt-axis">{Array.from({ length: 5 }, (_, i) => <span key={i}>{new Date((start + Math.round((span - 1) * i / 4)) * 86400000).toISOString().slice(0, 10)}</span>)}</div>
      {entries.map(({ activity: a }) => <div className="results-gantt-row" key={a.id}>
        <span className="results-gantt-title">{a.title}</span>
        <div className="results-gantt-track"><div className={`results-gantt-bar ${a.status === "done" ? "is-done" : ""}`} style={{ left: `${100 * (day(a.forecast_start) - start) / span}%`, width: `${Math.max(0.8, 100 * (day(a.forecast_due) - day(a.forecast_start) + 1) / span)}%` }} title={`${a.title}: ${a.forecast_start} → ${a.forecast_due} · ${a.progress}%`}>
          <span className="results-gantt-progress" style={{ width: `${a.progress}%` }} /><span>{a.progress}%</span>
        </div></div>
      </div>)}
    </div>
  </div>;
}
