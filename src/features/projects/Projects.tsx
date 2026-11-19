import { useEffect, useRef, useState, type FormEvent } from "react";
import { createProject, deleteProject, plantCatalogs, projectsOverview, reorderProjects, type CatalogItem, type NewProject, type Project, type ProjectsOverview } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { saveResultsCommitment, saveResultsActivity, type ResultsDeliverable } from "../../lib/results-api";
import { ProjectTimeline } from "./ProjectTimeline";
import { ResultsWork } from "./ResultsWork";
import { ResultsModal } from "./ResultsWorkModal";
import { commitmentError, emptyCommitment } from "./CommitmentEditor";
import { ActivityGrid, emptyRow as emptyActivityRow, type ActivityRow } from "./ActivityGrid";
import "./results-work.css";

const empty: NewProject = { wbs: "", name: "", process_area: "", engineer_ids: [], start_date: "", target_date: "" };
export function Projects() {
  const { lang, t, pick, tError } = useI18n();
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
      .catch(e => { if (active) setError(tError(e)); })
      .finally(() => { if (active) setLoading(false); });
    plantCatalogs().then(cat => {
      if (active) setLines(cat.config.lines.filter(l => l.active));
    }).catch(() => { });
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
    catch (e) { setError(tError(e)); }
    finally { setLoading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !data?.can_create) return;
    if (!input.engineer_ids.length) { setError(t("projects.error.noEngineer")); return; }
    if (!commitment.final_outcome.trim()) { setError(t("commitment.error.noOutcome")); return; }

    const validRows = activityRows.filter(r => r.title.trim().length > 0);
    if (!validRows.length) {
      setError(t("projects.error.noActivities"));
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
    const validation = commitmentError(draft, lang);
    if (validation) { setError(validation); return; }
    sending.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const project = createdProject ?? await createProject(input);
      if (!createdProject) {
        setCreatedProject(project);
        setData(current => current ? { ...current, projects: [...current.projects.filter(p => p.id !== project.id), project] } : current);
      }
      await saveResultsCommitment({ project_id: project.id, expected_revision: null, commitment: draft, change_reason: t("projects.initialDefinitionReason"), legacy_deliverable_id: null });
      for (const [idx, row] of validRows.entries()) {
        const assignedEngineerId = row.responsible_id && input.engineer_ids.includes(row.responsible_id)
          ? row.responsible_id
          : input.engineer_ids[idx % input.engineer_ids.length];
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
        } catch { }
      }

      setCreatedProject(null); setInput(empty); setCommitment(emptyCommitment()); setActivityRows([emptyActivityRow()]); setShowCreate(false);
      setNotice(t("projects.savedNotice"));
    } catch (e) { setError(tError(e)); }
    finally { sending.current = false; setSaving(false); }
  }
  function field(key: Exclude<keyof NewProject, "engineer_ids">, label: string, type = "text", wide = false) {
    return <label className={wide ? "field project-form-wide" : "field"}>{label}<input className="mt-1 block w-full border p-2" required type={type}
      value={input[key]} onChange={e => setInput({ ...input, [key]: e.target.value })} /></label>;
  }
  function closeDetail() { if (!detailBusy) { setSelected(null); void reload(); } }
  async function handleReorder(projectIds: string[]) {
    if (!data?.can_create || saving) return;
    setSaving(true); setError("");
    try {
      const updated = await reorderProjects(projectIds);
      setData(updated);
      setNotice(t("projects.reorderedNotice"));
    } catch (e) {
      setError(tError(e));
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete(projectId: string) {
    if (!data?.can_create) return;
    const updated = await deleteProject(projectId);
    setData(updated);
    setSelected(null);
    setNotice(t("projects.deletedNotice"));
  }
  const toolbarActions = (
    <>
      <button className="action" disabled={loading || saving} onClick={reload} aria-label={t("projects.refresh")} title={t("projects.refresh")}><span aria-hidden="true">⟳</span></button>
      {data?.can_create && <button className="btn-primary" disabled={loading || saving} onClick={() => { setShowCreate(true); setError(""); }}><span aria-hidden="true">+ </span>{t("projects.new")}</button>}
    </>
  );
  return <>
    <section className="min-w-0 w-full mx-auto space-y-3" aria-labelledby="projects-title">
      <h3 id="projects-title" className="sr-only">{t("projects.title")}</h3>
      {!data && <div className="flex items-center justify-end gap-2">{toolbarActions}</div>}
      {loading && <p role="status">{t("projects.loading")}</p>}
      {error && !showCreate && <p role="alert" className="text-kmx-red">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {data && <>
        {!data.can_create && data.write_message && <p className="text-sm text-kmx-gray-600">{tError(data.write_message)}</p>}
        <ProjectTimeline data={data} onOpen={setSelected} onReorder={data.can_create ? handleReorder : undefined} actions={toolbarActions} />
      </>}
    </section>
    {showCreate && data?.can_create && <ResultsModal title={t("projects.registerTitle")} closeLabel={t("projects.closeRegister")} busy={saving} onClose={() => setShowCreate(false)} wide>
      {error && <p role="alert" className="results-error">{error}</p>}
      {createdProject && <p className="results-warning">{t("projects.createdPendingClosure")}</p>}
      <form onSubmit={submit} className="space-y-6">
        <div className="space-y-4">
          <p className="results-help">{t("projects.bilingualHint")}</p>
          <fieldset disabled={saving || !!createdProject} className="project-create-grid">
            {field("name", t("projects.field.title"), "text", true)}
            <label className="field project-form-wide">
              {t("projects.field.objective")}
              <textarea
                aria-label={t("commitment.outcomeScope")}
                className="mt-1 block w-full border p-2"
                required
                rows={3}
                placeholder={t("projects.field.objectivePlaceholder")}
                value={commitment.final_outcome}
                onChange={e => {
                  const val = e.target.value;
                  setCommitment(c => ({ ...c, final_outcome: val, scope: val }));
                }}
              />
            </label>
            <label className="field">{t("projects.field.processArea")}
              <select className="mt-1 block w-full border p-2" required value={input.process_area}
                onChange={e => setInput({ ...input, process_area: e.target.value })}>
                <option value="">{t("projects.field.selectLine")}</option>
                {lines.map(line => <option key={line.id} value={line.name}>{pick(line.name)}</option>)}
                {input.process_area && !lines.some(line => line.name === input.process_area) && (
                  <option value={input.process_area}>{pick(input.process_area)}</option>
                )}
              </select>
              {!lines.length && <span className="results-help">{t("projects.field.noActiveLines")}</span>}
            </label>
            <fieldset className="space-y-2 min-w-0 border border-kmx-gray-300 p-3">
              <legend className="px-1 text-sm font-bold">{t("projects.field.owners")}</legend>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {data.leads.map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={input.engineer_ids.includes(m.id)}
                      onChange={e => {
                        const checked = e.target.checked;
                        setInput(current => ({
                          ...current,
                          engineer_ids: checked
                            ? [...current.engineer_ids, m.id]
                            : current.engineer_ids.filter(id => id !== m.id),
                        }));
                        if (!checked) {
                          setActivityRows(rows => rows.map(r => (r.responsible_id === m.id ? { ...r, responsible_id: undefined } : r)));
                        }
                      }}
                    />
                    {m.name} · {m.id}
                  </label>
                ))}
              </div>
            </fieldset>
            {field("start_date", t("projects.field.startDate"), "date")}
            {field("target_date", t("projects.field.targetDate"), "date")}
          </fieldset>

          <ActivityGrid
            rows={activityRows}
            onChange={setActivityRows}
            disabled={saving}
            engineers={data.leads.filter(l => input.engineer_ids.includes(l.id))}
            embedDeliverable
            defaultStartDate={input.start_date}
            defaultDueDate={input.target_date}
          />
        </div>

        <div className="results-modal-sticky-actions">
          <button disabled={saving || !data.leads.length} className="btn-primary">{saving ? t("common.saving") : createdProject ? t("projects.retryClosure") : t("projects.save")}</button>
        </div>
      </form>
    </ResultsModal>}
    {selected && <ResultsModal title={(() => { const found = data?.projects.find(p => p.id === selected); return found ? pick(found.name) : t("projects.detail"); })()} busy={detailBusy} onClose={closeDetail} wide hideHeader>
      <ResultsWork
        key={selected}
        projectId={selected}
        onBack={closeDetail}
        onBusyChange={setDetailBusy}
        onDelete={data?.can_create ? () => handleDelete(selected) : undefined}
      />
    </ResultsModal>}
  </>;
}
