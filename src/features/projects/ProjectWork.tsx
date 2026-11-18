import { useEffect, useRef, useState, type FormEvent } from "react";
import { attachEvidence, openEvidence, projectDetail, reviewActivity, saveActivity, setProjectProgress, setProjectTarget, type ActivityEntry, type ActivityInput, type ProjectDetail } from "../../lib/api";

function blank(projectId: string): ActivityInput { return { id: null, expected_revision: null, project_id: projectId, wbs: "", task_title: "", start_date: "", due_date: "", milestone_gate: 0, at_risk: false, hours_spent: null }; }
export function ProjectWork({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [input, setInput] = useState(() => blank(projectId));
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false); const sending = useRef(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [target, setTarget] = useState(""); const [progress, setProgress] = useState(0);
  useEffect(() => { let active = true; projectDetail(projectId).then(value => { if (active) setData(value); }).catch(e => { if (active) setError(String(e)); }); return () => { active = false; }; }, [projectId]);
  async function perform(action: () => Promise<ProjectDetail>, message: string) {
    if (sending.current) return false;
    sending.current = true; setBusy(true); setError(""); setNotice("");
    try { setData(await action()); setNotice(message); return true; }
    catch (e) { setError(String(e)); return false; }
    finally { sending.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) { event.preventDefault(); if (await perform(() => saveActivity(input), "Actividad guardada.")) setInput(blank(projectId)); }
  function edit(entry: ActivityEntry) { const a = entry.activity; setInput({ id: a.id, expected_revision: entry.revision, project_id: projectId, wbs: a.wbs, task_title: a.task_title, start_date: a.start_date, due_date: a.due_date, milestone_gate: a.milestone_gate, at_risk: a.status === "At Risk", hours_spent: a.hours_spent }); }
  async function upload(entry: ActivityEntry, file: File | undefined) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024 || !file.size) { setError("El archivo debe contener datos y no superar 20 MB."); return; }
    await perform(async () => attachEvidence({ project_id: projectId, activity_id: entry.activity.id, revision: entry.revision, name: file.name, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) }), "Evidencia guardada.");
  }
  async function download(entry: ActivityEntry, id: string, _name: string) {
    if (sending.current) return; sending.current = true; setBusy(true); setError("");
    try {
      await openEvidence(projectId, entry.owner_id, entry.activity.id, id);
    } catch (e) { setError(String(e)); } finally { sending.current = false; setBusy(false); }
  }
  function field(key: "wbs" | "task_title" | "start_date" | "due_date", label: string, type = "text") { return <label className="field">{label}<input required type={type} value={input[key]} onChange={e => setInput({ ...input, [key]: e.target.value })} /></label>; }
  return <section className="space-y-5" aria-label="Trabajo del proyecto">
    <div className="flex flex-wrap justify-between gap-3"><button className="action" onClick={onBack} disabled={busy}>Volver a proyectos</button><button className="action" disabled={busy} onClick={() => void perform(() => projectDetail(projectId), "Proyecto actualizado.")}>Actualizar trabajo</button></div>
    {error && <p role="alert" className="text-kmx-red">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!data ? <p role="status">Cargando trabajo del proyecto…</p> : <>
      <div className="work-heading"><p className="eyebrow">{data.project.wbs} · {data.project.process_area}</p><h3>{data.project.name}</h3><p>{data.project.start_date} → {data.project.target_date}</p></div>
      <div className="work-card space-y-3"><div className="grid gap-3 sm:grid-cols-3"><p>Objetivo del Supervisor<br /><strong>{data.project.target_hours == null ? "Sin definir" : `${data.project.target_hours} h`}</strong></p><p>Tiempo invertido acumulado<br /><strong>{data.hours_spent == null ? "Sin datos completos" : `${data.hours_spent} h`}</strong></p><p>Avance declarado por ingeniero<br /><strong>{data.engineer_progress.map(p => `${p.engineer_name}: ${p.progress == null ? "Sin declarar" : `${p.progress}%`}`).join(" · ")}</strong></p></div>
      {data.project.target_hours != null && data.hours_spent != null && <p className="text-sm">Horas consumidas: {(100 * data.hours_spent / data.project.target_hours).toFixed(1)}% del objetivo · Diferencia: {(data.hours_spent - data.project.target_hours).toFixed(2)} h</p>}
      {data.can_review && <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void perform(async () => { await setProjectTarget({ project_id: projectId, target_hours: Number(target), expected_target_hours: data.project.target_hours ?? null }); return projectDetail(projectId); }, "Objetivo de horas guardado."); }}><label className="field">Horas objetivo del proyecto<input required type="number" min="0.01" step="0.01" value={target} onChange={e => setTarget(e.target.value)} disabled={busy} /></label><button className="action" disabled={busy}>Establecer objetivo</button></form>}
      {data.can_edit && !data.can_review && <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void perform(() => setProjectProgress({ project_id: projectId, progress, expected_progress: data.declared_progress }), "Avance guardado."); }}><label className="field">Declarar mi avance<select value={progress} disabled={busy} onChange={e => setProgress(Number(e.target.value))}>{[0,25,50,75,100].map(p => <option key={p} value={p}>{p}%</option>)}</select></label><button className="action" disabled={busy}>Guardar mi avance</button><p className="text-sm">Es una declaración de avance; los cierres se aprueban por actividad.</p></form>}
      </div>
      <div className={`work-grid project-work-grid ${data.can_edit ? "has-editor" : ""}`}><div className="space-y-4"><h4 className="font-bold">Actividades y avances</h4>
      {!data.entries.length && <p className="empty-state">Todavía no hay actividades en este proyecto.</p>}
      {data.entries.map(entry => { const a = entry.activity; const key = `${entry.owner_id}/${a.id}`; return <article className="work-card space-y-3" key={key}>
        <div className="flex justify-between gap-3"><div><p className="eyebrow">{a.wbs} · {entry.owner_name}</p><h5 className="font-bold">{a.task_title}</h5></div><strong className="milestone">{a.milestone_gate}%</strong></div>
        <progress aria-label={`Avance de ${a.task_title}`} max={100} value={a.milestone_gate} className="w-full" />
        <p className="text-sm">{a.start_date} → {a.due_date}{a.status === "At Risk" ? " · En riesgo" : ""}</p>
        <p className="text-sm">Tiempo invertido: {a.hours_spent == null ? "Sin registrar" : `${a.hours_spent} h acumuladas`}</p>
        <p className="text-sm font-bold">{a.supervisor_approved ? "Cierre aprobado" : entry.decision && !entry.decision.accepted ? `Devuelta: ${entry.decision.comment}` : a.milestone_gate === 100 ? "Cierre solicitado · pendiente de revisión" : "Trabajo en curso"}</p>
        {data.can_edit && <button className="action" disabled={busy} onClick={() => edit(entry)}>Editar {a.wbs}</button>}
        <ul aria-label={`Evidencias de ${a.task_title}`}>{a.evidence.map(file => <li key={file.id}><button className="text-sm underline" disabled={busy} onClick={() => void download(entry, file.id, file.name)}>{file.name} ({Math.ceil(file.size / 1024)} KB)</button></li>)}</ul>
        {data.can_edit && <label className="field text-sm">Adjuntar evidencia a {a.wbs}<input disabled={busy} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => { void upload(entry, e.target.files?.[0]); e.target.value = ""; }} /><span>PDF, PNG o JPG · hasta 20 MB · se conserva el archivo</span></label>}
        {data.can_review && a.milestone_gate === 100 && <fieldset disabled={busy} className="space-y-2 border-t pt-3"><label className="field">Comentario para {a.wbs}<textarea value={comments[key] ?? ""} onChange={e => setComments({ ...comments, [key]: e.target.value })} /></label><div className="flex gap-2">{[true, false].map(accepted => <button className={accepted ? "btn-primary" : "action"} key={String(accepted)} onClick={() => void perform(() => reviewActivity({ project_id: projectId, owner_id: entry.owner_id, activity_id: a.id, revision: entry.revision, accepted, comment: comments[key] ?? "" }), accepted ? "Cierre aprobado." : "Actividad devuelta.")}>{accepted ? "Aprobar cierre" : "Devolver actividad"}</button>)}</div></fieldset>}
      </article>; })}</div>
      {data.can_edit && <form className="work-card space-y-3 self-start" onSubmit={submit}><h4 className="font-bold">{input.id ? "Actualizar actividad" : "Registrar actividad"}</h4><fieldset disabled={busy} className="space-y-3">
        {field("wbs", "WBS de actividad")}{field("task_title", "Descripción del trabajo")}
        <div className="grid gap-3 sm:grid-cols-2">{field("start_date", "Inicio de actividad", "date")}{field("due_date", "Entrega de actividad", "date")}</div>
        <label className="field">Hito de avance<select value={input.milestone_gate} onChange={e => setInput({ ...input, milestone_gate: Number(e.target.value) })}>{[0, 25, 50, 75, 100].map(gate => <option key={gate} value={gate}>{gate}%{gate === 100 ? " · Solicitar cierre" : ""}</option>)}</select></label>
        <label className="field">Horas invertidas acumuladas<input type="number" min="0" step="0.01" value={input.hours_spent ?? ""} onChange={e => setInput({ ...input, hours_spent: e.target.value === "" ? null : e.target.valueAsNumber })} /><span>Actualiza el total de esta actividad; no se suma de nuevo en cada guardado.</span></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={input.at_risk} onChange={e => setInput({ ...input, at_risk: e.target.checked })} />Actividad en riesgo</label>
        <p className="text-sm">El 100% solicita revisión. El Supervisor aprueba el cierre con evidencia.</p>
        <div className="flex gap-2"><button className="btn-primary">{busy ? "Guardando…" : "Guardar actividad"}</button>{input.id && <button type="button" className="action" onClick={() => setInput(blank(projectId))}>Cancelar edición</button>}</div>
      </fieldset></form>}</div>
    </>}
  </section>;
}
