import { useEffect, useRef, useState, type FormEvent } from "react";
import { createProject, projectsOverview, type NewProject, type ProjectsOverview } from "../../lib/api";

const empty: NewProject = { wbs: "", name: "", process_area: "", lead_engineer_id: "", start_date: "", target_date: "" };
const statuses = { "Not Started": "Sin iniciar", "In Progress": "En curso", Completed: "Completado", "On Hold": "En pausa" };
export function Projects() {
  const [data, setData] = useState<ProjectsOverview | null>(null);
  const [input, setInput] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const sending = useRef(false);
  useEffect(() => {
    let active = true;
    projectsOverview().then(value => { if (active) setData(value); })
      .catch(e => { if (active) setError(String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function reload() {
    setLoading(true); setError(""); setData(null);
    try { setData(await projectsOverview()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !data?.can_create) return;
    sending.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const project = await createProject(input);
      setData(current => current ? { ...current, projects: [...current.projects, project] } : current);
      setInput(empty); setNotice(`Proyecto ${project.wbs} guardado.`);
    } catch (e) { setError(String(e)); }
    finally { sending.current = false; setSaving(false); }
  }
  function field(key: keyof NewProject, label: string, type = "text") {
    return <label className="block">{label}<input className="mt-1 block w-full border p-2" required type={type}
      value={input[key]} onChange={e => setInput({ ...input, [key]: e.target.value })} /></label>;
  }
  return <section className="space-y-4 border-t border-kmx-gray-300 pt-4" aria-labelledby="projects-title">
    <div className="flex items-center justify-between gap-3"><h3 id="projects-title" className="font-bold">Proyectos FAB</h3>
      <button className="border px-3 py-2" disabled={loading || saving} onClick={reload}>Actualizar proyectos</button></div>
    {loading && <p role="status">Cargando proyectos…</p>}
    {error && <p role="alert" className="text-kmx-red">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {data && <>
      <p className="text-sm">{data.write_message}</p>
      {!data.projects.length ? <p>No hay proyectos registrados.</p> : <ul className="space-y-3" aria-label="Proyectos registrados">
        {data.projects.map(p => <li key={p.id} className="border p-3">
          <p className="font-bold">{p.wbs} · {p.name}</p><p>{p.process_area} · {statuses[p.status]}</p>
          <p>Responsable: {data.leads.find(m => m.id === p.lead_engineer_id)?.name ?? p.lead_engineer_id}</p>
          <p>Inicio: {p.start_date} · Objetivo: {p.target_date}</p>
        </li>)}
      </ul>}
      <form onSubmit={submit} className="space-y-3">
        <h4 className="font-bold">Registrar proyecto</h4>
        <fieldset disabled={saving || !data.can_create} className="space-y-3">
          {field("wbs", "Código WBS")}{field("name", "Título del proyecto")}{field("process_area", "Área de proceso")}
          <label className="block">Responsable<select className="mt-1 block w-full border p-2" required value={input.lead_engineer_id}
            onChange={e => setInput({ ...input, lead_engineer_id: e.target.value })}>
            <option value="">Selecciona una persona activa</option>{data.leads.map(m => <option key={m.id} value={m.id}>{m.name} · {m.id}</option>)}
          </select></label>
          {field("start_date", "Fecha de inicio", "date")}{field("target_date", "Fecha objetivo", "date")}
          <p className="text-sm">Estado inicial: Sin iniciar</p>
          <button disabled={!data.leads.length} className="bg-kmx-carbon px-4 py-2 text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar proyecto"}</button>
        </fieldset>
      </form>
    </>}
  </section>;
}
