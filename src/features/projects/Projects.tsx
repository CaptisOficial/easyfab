import { useEffect, useRef, useState, type FormEvent } from "react";
import { createProject, plantCatalogs, projectsOverview, type CatalogItem, type NewProject, type Project, type ProjectsOverview } from "../../lib/api";
import { saveResultsCommitment, saveResultsActivity, type ResultsDeliverable } from "../../lib/results-api";
import { ProjectTimeline } from "./ProjectTimeline";
import { ResultsWork } from "./ResultsWork";
import { ResultsModal } from "./ResultsWorkModal";
import { commitmentError, emptyCommitment } from "./CommitmentEditor";
import { ActivityGrid, emptyRow as emptyActivityRow, type ActivityRow } from "./ActivityGrid";
import "./results-work.css";

const empty: NewProject = { wbs: "", name: "", process_area: "", engineer_ids: [], start_date: "", target_date: "" };
export function Projects() {
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [data, setData] = useState<ProjectsOverview | null>(null);
  const [lines, setLines] = useState<CatalogItem[]>([]);
  const [input, setInput] = useState(empty);
  const [commitment, setCommitment] = useState(emptyCommitment());
const [activityRows, setActivityRows] = useState<ActivityRow[]>([emptyActivityRow()]);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const sending = useRef(false);
  useEffect(() => {
    let active = true;
    projectsOverview().then(value => { if (active) setData(value); })
      .catch(e => { if (active) setError(String(e)); })
      .finally(() => { if (active) setLoading(false); });
    plantCatalogs().then(cat => {
      if (active) setLines(cat.config.lines.filter(l => l.active));
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function reload() {
    setLoading(true); setError("");
    try {
      const [pData, catData] = await Promise.all([
        projectsOverview(),
        plantCatalogs().catch(() => null),
      ]);
      setData(pData);
      if (catData) setLines(catData.config.lines.filter(l => l.active));
    }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !data?.can_create) return;
    if (!input.engineer_ids.length) { setError("Selecciona al menos un ingeniero responsable."); return; }
    if (!commitment.final_outcome.trim()) { setError("Define el resultado esperado y alcance del proyecto."); return; }

    const validRows = activityRows.filter(r => r.title.trim().length > 0);
    if (!validRows.length) {
      setError("Registra al menos una subactividad o entregable para el plan.");
      return;
    }

    // Cada subactividad embebe su entregable y condición de cierre verificable
    const deliverables: ResultsDeliverable[] = validRows.map(row => ({
      id: row.deliverable_id || `deliv_${row.id}`,
      title: row.title.trim(),
      due_date: row.due_date || input.target_date,
      criteria: [
        {
          id: `crit_${row.id}`,
          description: (row.criterion || row.title).trim(),
          evidence_required: row.evidence_required ?? true,
        },
      ],
    }));

    const draft = {
      final_outcome: commitment.final_outcome.trim(),
      scope: commitment.scope.trim() || commitment.final_outcome.trim(),
      start_date: input.start_date,
      target_date: input.target_date,
      engineer_ids: input.engineer_ids,
      deliverables,
    };
    const validation = commitmentError(draft);
    if (validation) { setError(validation); return; }
    sending.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const project = createdProject ?? await createProject(input);
      if (!createdProject) {
        setCreatedProject(project);
        setData(current => current ? { ...current, projects: [...current.projects.filter(p => p.id !== project.id), project] } : current);
      }
      await saveResultsCommitment({ project_id: project.id, expected_revision: null, commitment: draft, change_reason: "Definición inicial del proyecto", legacy_deliverable_id: null });
      for (const [idx, row] of validRows.entries()) {
        const assignedEngineerId = input.engineer_ids[idx % input.engineer_ids.length];
        const deliverableId = deliverables[idx].id;
        try {
          await saveResultsActivity({
            project_id: project.id,
            expected_revision: null,
            activity: {
              id: row.id,
              deliverable_id: deliverableId,
              title: row.title.trim(),
              responsible_id: assignedEngineerId,
              forecast_start: row.start_date || input.start_date,
              forecast_due: row.due_date || input.target_date,
              dependency_ids: [],
              status: row.status,
              progress: 0,
              at_risk: row.at_risk,
              hours_spent: null,
              note: null,
            },
          });
        } catch {}
      }

      setCreatedProject(null); setInput(empty); setCommitment(emptyCommitment()); setActivityRows([emptyActivityRow()]); setShowCreate(false);
      setNotice("Proyecto guardado con condiciones de cierre.");
    } catch (e) { setError(String(e)); }
    finally { sending.current = false; setSaving(false); }
  }
  function field(key: Exclude<keyof NewProject, "engineer_ids">, label: string, type = "text", wide = false) {
    return <label className={wide ? "field project-form-wide" : "field"}>{label}<input className="mt-1 block w-full border p-2" required type={type}
      value={input[key]} onChange={e => setInput({ ...input, [key]: e.target.value })} /></label>;
  }
  function closeDetail() { if (!detailBusy) { setSelected(null); void reload(); } }
  return <>
    <section className="min-w-0 w-full mx-auto space-y-4" aria-labelledby="projects-title">
      <div className="flex items-center justify-between gap-3"><h3 id="projects-title" className="sr-only">Proyectos FAB</h3>
        <button className="border px-3 py-2" disabled={loading || saving} onClick={reload} aria-label="Actualizar proyectos"><span aria-hidden="true">⟳</span></button>
{data?.can_create && <button className="btn-primary" disabled={loading || saving} onClick={() => { setShowCreate(true); setError(""); }}><span aria-hidden="true">+ </span>Nuevo proyecto</button>}
      </div>
      {loading && <p role="status">Cargando proyectos…</p>}
      {error && !showCreate && <p role="alert" className="text-kmx-red">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {data && <><p className="text-sm">{data.write_message}</p><ProjectTimeline data={data} onOpen={setSelected} /></>}
    </section>
    {showCreate && data?.can_create && <ResultsModal title="Registrar proyecto" closeLabel="Cerrar registro de proyecto" busy={saving} onClose={() => setShowCreate(false)} wide>
      {error && <p role="alert" className="results-error">{error}</p>}
      {createdProject && <p className="results-warning">El proyecto ya se registró. Completa o reintenta guardar su definición de cierre; no se creará otro proyecto.</p>}
      <form onSubmit={submit} className="space-y-6">
        {/* Sección 1: Datos Generales y Objetivo */}
        <section className="results-panel space-y-3" aria-labelledby="section-project-title">
          <div className="border-b pb-2">
            <h4 id="section-project-title" className="text-sm font-bold uppercase tracking-wider text-kmx-carbon flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-kmx-carbon text-white text-xs">1</span>
              Datos generales y objetivo del proyecto
            </h4>
            <p className="text-xs text-kmx-gray-500">Título, objetivo y alcance global, línea de proceso, fechas y equipo asignado.</p>
          </div>
          <fieldset disabled={saving || !!createdProject} className="project-create-grid">
            {field("name", "Título del proyecto", "text", true)}
            <label className="field project-form-wide">
              Objetivo global y alcance
              <textarea
                aria-label="Resultado esperado y alcance"
                className="mt-1 block w-full border p-2"
                required
                rows={3}
                placeholder="Describe el objetivo general y alcance del proyecto..."
                value={commitment.final_outcome}
                onChange={e => {
                  const val = e.target.value;
                  setCommitment(c => ({ ...c, final_outcome: val, scope: val }));
                }}
              />
              <span className="results-help">
                El objetivo engloba los alcances y el resultado final verificable del proyecto.
              </span>
            </label>
            <label className="field">Área de proceso
              <select className="mt-1 block w-full border p-2" required value={input.process_area}
                onChange={e => setInput({ ...input, process_area: e.target.value })}>
                <option value="">Selecciona línea de proceso</option>
                {lines.map(line => <option key={line.id} value={line.name}>{line.name}</option>)}
                {input.process_area && !lines.some(line => line.name === input.process_area) && (
                  <option value={input.process_area}>{input.process_area}</option>
                )}
              </select>
              {!lines.length && <span className="results-help">No hay líneas activas registradas en Catálogos FAB.</span>}
            </label>
            <fieldset className="space-y-2 min-w-0 border border-kmx-gray-300 p-3">
              <legend className="px-1 text-sm font-bold">Ingenieros responsables</legend>
              <p className="text-xs text-kmx-gray-500">Selecciona los ingenieros asignados. Las subactividades se distribuirán de forma equitativa entre ellos.</p>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {data.leads.map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={input.engineer_ids.includes(m.id)}
                      onChange={e => setInput(current => ({
                        ...current,
                        engineer_ids: e.target.checked
                          ? [...current.engineer_ids, m.id]
                          : current.engineer_ids.filter(id => id !== m.id),
                      }))}
                    />
                    {m.name} · {m.id}
                  </label>
                ))}
              </div>
            </fieldset>
            {field("start_date", "Fecha de inicio", "date")}
            {field("target_date", "Fecha objetivo", "date")}
          </fieldset>
        </section>

        {/* Sección 2: Subactividades de Trabajo y Entregables de Cierre (DoD embebido) */}
        <section className="results-panel space-y-3" aria-labelledby="section-activities-title">
          <div className="border-b pb-2">
            <h4 id="section-activities-title" className="text-sm font-bold uppercase tracking-wider text-kmx-carbon flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-kmx-carbon text-white text-xs">2</span>
              Subactividades y entregables de cierre (Sprints / Historias)
            </h4>
            <p className="text-xs text-kmx-gray-500">
              Plan inicial de trabajo. Cada subactividad representa un sprint o historia y embebe su entregable y condición de cierre verificable (DoD).
            </p>
          </div>
          <ActivityGrid
            rows={activityRows}
            onChange={setActivityRows}
            disabled={saving}
            embedDeliverable
            defaultStartDate={input.start_date}
            defaultDueDate={input.target_date}
          />
        </section>

        <p className="results-help">Los ingenieros asignados podrán planear y actualizar sus actividades sin aprobación cotidiana.</p>
        <div className="results-modal-sticky-actions">
          <button disabled={saving || !data.leads.length} className="btn-primary">{saving ? "Guardando…" : createdProject ? "Reintentar definición de cierre" : "Guardar proyecto"}</button>
        </div>
      </form>
    </ResultsModal>}
    {selected && <ResultsModal title="Detalle del proyecto" busy={detailBusy} onClose={closeDetail} wide>
      <ResultsWork key={selected} projectId={selected} onBack={closeDetail} onBusyChange={setDetailBusy} />
    </ResultsModal>}
  </>;
}
