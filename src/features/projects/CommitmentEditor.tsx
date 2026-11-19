import type { OperationsCommitmentDraft, ResultsCriterion, ResultsDeliverable } from "../../lib/results-api";
import { translateMessage, useI18n, type Lang } from "../../lib/i18n";

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

export function newDeliverable(dueDate = ""): ResultsDeliverable {
  return { id: id("delivery"), title: "", due_date: dueDate, criteria: [{ id: id("criterion"), description: "", evidence_required: true }] };
}

export function emptyCommitment(): OperationsCommitmentDraft {
  return { final_outcome: "", scope: "", start_date: "", target_date: "", engineer_ids: [], deliverables: [newDeliverable()] };
}

export function commitmentError(value: OperationsCommitmentDraft, lang: Lang = "es"): string | null {
  if (!value.final_outcome.trim() || !value.scope.trim()) return translateMessage("commitment.error.noOutcome", lang);
  if (!value.deliverables.length || value.deliverables.some(d => !d.title.trim() || !d.due_date || !d.criteria.length || d.criteria.some(c => !c.description.trim()))) return translateMessage("commitment.error.incompleteDeliverables", lang);
  return null;
}

export function CommitmentEditor({ value, onChange, disabled = false, defaultDueDate = "", showSchedule = true, activityStartDates, onActivityStartDateChange }: {
  value: OperationsCommitmentDraft;
  onChange: (value: OperationsCommitmentDraft) => void;
  disabled?: boolean;
  defaultDueDate?: string;
  showSchedule?: boolean;
  activityStartDates?: Record<string, string>;
  onActivityStartDateChange?: (deliverableId: string, startDate: string) => void;
}) {
  const { t } = useI18n();
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
      <legend className="sr-only">{t("commitment.legend")}</legend>
      <p className="results-help">
        {t("commitment.help")}
      </p>

      {/* Consolidación de Resultado esperado y Alcance en un solo campo */}
      <label className="field">
        {t("commitment.outcomeScope")}
        <textarea
          required
          rows={3}
          value={outcomeScopeValue}
          placeholder={t("commitment.outcomeScopePlaceholder")}
          onChange={e => {
            const val = e.target.value;
            onChange({ ...value, final_outcome: val, scope: val });
          }}
        />
      </label>

      {showSchedule && (
        <div className="results-fields-row">
          <label className="field">
            {t("commitment.committedStart")}
            <input
              required
              type="date"
              value={value.start_date}
              onChange={e => onChange({ ...value, start_date: e.target.value })}
            />
          </label>
          <label className="field">
            {t("commitment.targetDate")}
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
              {t("commitment.deliverablesHeading", { count: value.deliverables.length })}
            </span>
            <p className="results-help">
              {t("commitment.deliverablesHelp")}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary text-xs px-3 py-1.5"
            disabled={disabled}
            onClick={addDeliverable}
          >
            {t("commitment.addDeliverable")}
          </button>
        </div>

        <div className="results-table-scroll">
          <table className="results-table w-full">
            <thead>
              <tr className="bg-kmx-gray-50 text-left text-xs font-semibold text-kmx-gray-600 border-b">
                <th className="p-2 w-12 text-center" title={t("commitment.col.numberTitle")}>#</th>
                <th className="p-2 min-w-[200px]">{t("commitment.col.deliverableName")}</th>
                <th className="p-2 min-w-[260px]">{t("commitment.col.criterion")}</th>
                <th className={onActivityStartDateChange ? "p-2 min-w-[220px]" : "p-2 w-36"}>
                  {onActivityStartDateChange ? t("commitment.col.datesRange") : t("commitment.col.dueDate")}
                </th>
                <th className="p-2 w-28 text-center">{t("commitment.col.evidence")}</th>
                <th className="p-2 w-16 text-center">{t("common.action")}</th>
              </tr>
            </thead>
            <tbody>
              {value.deliverables.map((d, index) => (
                <tr key={d.id} className="border-b last:border-b-0 hover:bg-kmx-gray-50/50 align-top">
                  <td className="p-2 text-center align-middle">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-kmx-gray-100 text-kmx-carbon border"
                      title={t("commitment.deliverableNumber", { index: index + 1 })}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      aria-label={t("commitment.deliverableNameAria", { index: index + 1 })}
                      disabled={disabled}
                      required
                      className="w-full p-1.5 border rounded text-xs"
                      placeholder={t("commitment.deliverableNamePlaceholder")}
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
                              <span>{t("commitment.criterionLabel", { dIndex: index + 1, cIndex: ci + 1 })}</span>
                              <button
                                type="button"
                                disabled={disabled}
                                className="text-kmx-red hover:underline text-[11px]"
                                onClick={() => removeCriterion(index, ci)}
                              >
                                {t("common.remove")}
                              </button>
                            </div>
                          )}
                          <textarea
                            aria-label={t("commitment.criterionLabel", { dIndex: index + 1, cIndex: ci + 1 })}
                            disabled={disabled}
                            required
                            rows={2}
                            className="w-full p-1.5 border rounded text-xs resize-y"
                            placeholder={t("commitment.criterionPlaceholder")}
                            value={c.description}
                            onChange={e => updateCriterion(index, ci, { description: e.target.value })}
                          />
                          {d.criteria.length > 1 && (
                            <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer">
                              <input
                                type="checkbox"
                                aria-label={t("commitment.evidenceRequiredAria", { dIndex: index + 1, cIndex: ci + 1 })}
                                disabled={disabled}
                                checked={c.evidence_required}
                                onChange={e => updateCriterion(index, ci, { evidence_required: e.target.checked })}
                              />
                              <span>{t("common.evidenceRequired")}</span>
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
                        {t("commitment.addCriterion", { index: index + 1 })}
                      </button>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className={onActivityStartDateChange ? "activity-grid-dates-cell flex items-center gap-1.5" : undefined}>
                      {onActivityStartDateChange && (
                        <>
                          <input
                            type="date"
                            aria-label={t("commitment.deliverableStartAria", { index: index + 1 })}
                            disabled={disabled}
                            className="p-1 border rounded text-xs w-full"
                            title={t("commitment.activityStartTitle")}
                            value={activityStartDates?.[d.id] ?? value.start_date}
                            onChange={e => onActivityStartDateChange(d.id, e.target.value)}
                          />
                          <span className="text-kmx-gray-400 text-xs">→</span>
                        </>
                      )}
                      <input
                        type="date"
                        aria-label={t("commitment.deliverableDueAria", { index: index + 1 })}
                        disabled={disabled}
                        required
                        className="p-1 border rounded text-xs w-full"
                        title={t("commitment.deliverableDueTitle")}
                        value={d.due_date || defaultDueDate}
                        onChange={e => updateDeliverable(index, { due_date: e.target.value })}
                      />
                    </div>
                  </td>
                  <td className="p-2 text-center align-middle">
                    {d.criteria.length === 1 ? (
                      <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          aria-label={t("commitment.evidenceRequiredAria", { dIndex: index + 1, cIndex: 1 })}
                          disabled={disabled}
                          checked={d.criteria[0]?.evidence_required ?? true}
                          onChange={e => updateCriterion(index, 0, { evidence_required: e.target.checked })}
                        />
                        <span className={d.criteria[0]?.evidence_required ? "text-kmx-carbon font-medium" : "text-kmx-gray-500"}>
                          {t("commitment.requiredShort")}
                        </span>
                      </label>
                    ) : (
                      <span className="text-[11px] text-kmx-gray-500">
                        {t("commitment.requiredRatio", { required: d.criteria.filter(c => c.evidence_required).length, total: d.criteria.length })}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center align-middle">
                    <button
                      type="button"
                      disabled={disabled || value.deliverables.length <= 1}
                      className="text-kmx-red hover:underline text-xs disabled:opacity-30 disabled:no-underline"
                      onClick={() => removeDeliverable(index)}
                      title={t("commitment.removeDeliverableTitle")}
                    >
                      {t("common.remove")}
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
