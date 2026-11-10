import type { OperationsCommitmentDraft, ResultsCriterion, ResultsDeliverable } from "../../lib/results-api";

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

export function newDeliverable(dueDate = ""): ResultsDeliverable {
  return { id: id("delivery"), title: "", due_date: dueDate, criteria: [{ id: id("criterion"), description: "", evidence_required: true }] };
}

export function emptyCommitment(): OperationsCommitmentDraft {
  return { final_outcome: "", scope: "", start_date: "", target_date: "", engineer_ids: [], deliverables: [newDeliverable()] };
}

export function commitmentError(value: OperationsCommitmentDraft): string | null {
  if (!value.final_outcome.trim() || !value.scope.trim()) return "Define el resultado esperado y alcance del proyecto.";
  if (!value.deliverables.length || value.deliverables.some(d => !d.title.trim() || !d.due_date || !d.criteria.length || d.criteria.some(c => !c.description.trim()))) return "Completa los entregables, sus fechas y criterios de aceptación.";
  return null;
}

export function CommitmentEditor({ value, onChange, disabled = false, defaultDueDate = "", showSchedule = true }: {
  value: OperationsCommitmentDraft;
  onChange: (value: OperationsCommitmentDraft) => void;
  disabled?: boolean;
  defaultDueDate?: string;
  showSchedule?: boolean;
}) {
  function updateDeliverable(index: number, patch: Partial<ResultsDeliverable>) {
    onChange({ ...value, deliverables: value.deliverables.map((d, i) => i === index ? { ...d, ...patch } : d) });
  }

  function addDeliverable() {
    onChange({ ...value, deliverables: [...value.deliverables, newDeliverable(value.target_date || defaultDueDate)] });
  }

  function removeDeliverable(index: number) {
    const next = value.deliverables.filter((_, i) => i !== index);
    onChange({ ...value, deliverables: next.length ? next : [newDeliverable(value.target_date || defaultDueDate)] });
  }

  function updateCriterion(dIndex: number, cIndex: number, patch: Partial<ResultsCriterion>) {
    const d = value.deliverables[dIndex];
    if (!d) return;
    const updatedCriteria = d.criteria.map((c, i) => i === cIndex ? { ...c, ...patch } : c);
    updateDeliverable(dIndex, { criteria: updatedCriteria });
  }

  function addCriterion(dIndex: number) {
    const d = value.deliverables[dIndex];
    if (!d) return;
    const newCriterion = { id: id("criterion"), description: "", evidence_required: true };
    updateDeliverable(dIndex, { criteria: [...d.criteria, newCriterion] });
  }

  function removeCriterion(dIndex: number, cIndex: number) {
    const d = value.deliverables[dIndex];
    if (!d || d.criteria.length <= 1) return;
    const updatedCriteria = d.criteria.filter((_, i) => i !== cIndex);
    updateDeliverable(dIndex, { criteria: updatedCriteria });
  }

  const outcomeScopeValue = value.final_outcome === value.scope
    ? value.final_outcome
    : (value.final_outcome && value.scope ? `${value.final_outcome}\n${value.scope}` : value.final_outcome || value.scope);

  return (
    <fieldset className="results-commitment-editor space-y-4" disabled={disabled}>
      <legend className="sr-only">Definición de cierre · DoD</legend>
      <p className="results-help">
        Describe el resultado final verificable y el alcance que debe alcanzarse. Los ingenieros desarrollarán las actividades para conseguirlo.
      </p>

      {/* Consolidación de Resultado esperado y Alcance en un solo campo */}
      <label className="field">
        Resultado esperado y alcance
        <textarea
          required
          rows={3}
          value={outcomeScopeValue}
          placeholder="Describe el resultado final verificable y el alcance general del proyecto..."
          onChange={e => {
            const val = e.target.value;
            onChange({ ...value, final_outcome: val, scope: val });
          }}
        />
      </label>

      {showSchedule && (
        <div className="results-fields-row">
          <label className="field">
            Inicio comprometido
            <input
              required
              type="date"
              value={value.start_date}
              onChange={e => onChange({ ...value, start_date: e.target.value })}
            />
          </label>
          <label className="field">
            Fecha compromiso
            <input
              required
              type="date"
              value={value.target_date}
              onChange={e => onChange({ ...value, target_date: e.target.value })}
            />
          </label>
        </div>
      )}

      {/* Rejilla de entregables y criterios, análoga a la rejilla de subactividades */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-kmx-gray-500">
              Entregables y criterios de aceptación ({value.deliverables.length})
            </span>
            <p className="results-help">
              Cada entregable define un resultado verificable con fecha límite y sus criterios de aceptación.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary text-xs px-3 py-1.5"
            disabled={disabled}
            onClick={addDeliverable}
          >
            + Añadir entregable
          </button>
        </div>

        <div className="border border-kmx-gray-200 rounded overflow-x-auto shadow-sm">
          <table className="results-table w-full">
            <thead>
              <tr className="bg-kmx-gray-50 text-left text-xs font-semibold text-kmx-gray-600 border-b">
                <th className="p-2 w-12 text-center" title="Número de entregable">#</th>
                <th className="p-2 min-w-[200px]">Nombre del entregable</th>
                <th className="p-2 min-w-[260px]">Criterio de aceptación</th>
                <th className="p-2 w-36">Fecha límite</th>
                <th className="p-2 w-28 text-center">Evidencia</th>
                <th className="p-2 w-16 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {value.deliverables.map((d, index) => (
                <tr key={d.id} className="border-b last:border-b-0 hover:bg-kmx-gray-50/50 align-top">
                  <td className="p-2 text-center align-middle">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-kmx-gray-100 text-kmx-carbon border"
                      title={`Entregable ${index + 1}`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      aria-label={`Nombre del entregable ${index + 1}`}
                      disabled={disabled}
                      required
                      className="w-full p-1.5 border rounded text-xs"
                      placeholder="Nombre del entregable..."
                      value={d.title}
                      onChange={e => updateDeliverable(index, { title: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <div className="space-y-2">
                      {d.criteria.map((c, ci) => (
                        <div key={c.id} className="space-y-1">
                          {d.criteria.length > 1 && (
                            <div className="flex items-center justify-between text-[11px] text-kmx-gray-500">
                              <span>Criterio {index + 1}.{ci + 1}</span>
                              <button
                                type="button"
                                disabled={disabled}
                                className="text-kmx-red hover:underline text-[11px]"
                                onClick={() => removeCriterion(index, ci)}
                              >
                                Quitar
                              </button>
                            </div>
                          )}
                          <textarea
                            aria-label={`Criterio ${index + 1}.${ci + 1}`}
                            disabled={disabled}
                            required
                            rows={2}
                            className="w-full p-1.5 border rounded text-xs resize-y"
                            placeholder="Criterio verificable de aceptación..."
                            value={c.description}
                            onChange={e => updateCriterion(index, ci, { description: e.target.value })}
                          />
                          {d.criteria.length > 1 && (
                            <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer">
                              <input
                                type="checkbox"
                                aria-label={`Evidencia requerida para criterio ${index + 1}.${ci + 1}`}
                                disabled={disabled}
                                checked={c.evidence_required}
                                onChange={e => updateCriterion(index, ci, { evidence_required: e.target.checked })}
                              />
                              <span>Evidencia requerida</span>
                            </label>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        disabled={disabled}
                        className="text-[11px] text-kmx-carbon font-semibold hover:underline block"
                        onClick={() => addCriterion(index)}
                      >
                        + Añadir criterio al entregable {index + 1}
                      </button>
                    </div>
                  </td>
                  <td className="p-2">
                    <input
                      type="date"
                      aria-label={`Fecha del entregable ${index + 1}`}
                      disabled={disabled}
                      required
                      className="p-1 border rounded text-xs w-full"
                      value={d.due_date || defaultDueDate}
                      onChange={e => updateDeliverable(index, { due_date: e.target.value })}
                    />
                  </td>
                  <td className="p-2 text-center align-middle">
                    {d.criteria.length === 1 ? (
                      <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          aria-label={`Evidencia requerida para criterio ${index + 1}.1`}
                          disabled={disabled}
                          checked={d.criteria[0]?.evidence_required ?? true}
                          onChange={e => updateCriterion(index, 0, { evidence_required: e.target.checked })}
                        />
                        <span className={d.criteria[0]?.evidence_required ? "text-kmx-carbon font-medium" : "text-kmx-gray-500"}>
                          Requerida
                        </span>
                      </label>
                    ) : (
                      <span className="text-[11px] text-kmx-gray-500">
                        {d.criteria.filter(c => c.evidence_required).length}/{d.criteria.length} req.
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center align-middle">
                    <button
                      type="button"
                      disabled={disabled || value.deliverables.length <= 1}
                      className="text-kmx-red hover:underline text-xs disabled:opacity-30 disabled:no-underline"
                      onClick={() => removeDeliverable(index)}
                      title="Quitar entregable"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </fieldset>
  );
}
