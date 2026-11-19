import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import type { ResultsDeliverable } from "../../lib/results-api";
import { useI18n } from "../../lib/i18n";

export interface ActivityRow {
  id: string;
  wbs: string;
  title: string;
  deliverable_id: string;
  responsible_id?: string;
  criterion?: string;
  evidence_required?: boolean;
  start_date: string;
  due_date: string;
  status: "not_started" | "in_progress" | "done";
  at_risk: boolean;
}

export interface ActivityEngineerOption {
  id: string;
  name: string;
}

export function autoGenerateWbs(
  index: number,
  deliverableId: string,
  deliverables?: ResultsDeliverable[]
): string {
  if (deliverables && deliverables.length > 0 && deliverableId) {
    const dIdx = deliverables.findIndex(d => d.id === deliverableId);
    if (dIdx >= 0) {
      return `${dIdx + 1}.${index + 1}`;
    }
  }
  return `${index + 1}`;
}

export function refreshRowWbs(
  rows: ActivityRow[],
  deliverables?: ResultsDeliverable[],
  embedDeliverable = false
): ActivityRow[] {
  if (embedDeliverable || !deliverables || deliverables.length === 0) {
    return rows.map((row, idx) => ({ ...row, wbs: `${idx + 1}` }));
  }
  const deliverableCounts: Record<string, number> = {};
  return rows.map((row, idx) => {
    let wbs: string;
    if (row.deliverable_id) {
      const dIdx = deliverables.findIndex(d => d.id === row.deliverable_id);
      if (dIdx >= 0) {
        const count = (deliverableCounts[row.deliverable_id] || 0) + 1;
        deliverableCounts[row.deliverable_id] = count;
        wbs = `${dIdx + 1}.${count}`;
      } else {
        wbs = `${idx + 1}`;
      }
    } else {
      wbs = `${idx + 1}`;
    }
    return { ...row, wbs };
  });
}

export const emptyRow = (
  deliverableId = "",
  defaultStartDate = "",
  defaultDueDate = ""
): ActivityRow => ({
  id: `act_${crypto.randomUUID().replaceAll("-", "")}`,
  wbs: "1",
  title: "",
  deliverable_id: deliverableId,
  criterion: "",
  evidence_required: true,
  start_date: defaultStartDate,
  due_date: defaultDueDate,
  status: "not_started",
  at_risk: false,
});

export function ActivityGrid({
  rows,
  onChange,
  disabled = false,
  deliverables = [],
  engineers = [],
  embedDeliverable = false,
  defaultStartDate = "",
  defaultDueDate = "",
}: {
  rows: ActivityRow[];
  onChange: (rows: ActivityRow[]) => void;
  disabled?: boolean;
  deliverables?: ResultsDeliverable[];
  engineers?: ActivityEngineerOption[];
  embedDeliverable?: boolean;
  defaultStartDate?: string;
  defaultDueDate?: string;
}) {
  const { t, pick } = useI18n();
  const [pasteBuffer, setPasteBuffer] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const showResponsible = engineers.length > 1;

  function updateRow(index: number, patch: Partial<ActivityRow>) {
    const updated = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(refreshRowWbs(updated, deliverables, embedDeliverable));
  }

  function addRow() {
    const defaultDeliv = deliverables[0]?.id ?? "";
    const created = emptyRow(defaultDeliv, defaultStartDate, defaultDueDate);
    onChange(refreshRowWbs([...rows, created], deliverables, embedDeliverable));
  }

  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    onChange(refreshRowWbs(next.length ? next : [emptyRow(deliverables[0]?.id ?? "", defaultStartDate, defaultDueDate)], deliverables, embedDeliverable));
  }

  function handlePasteText(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (!lines.length) return;

    const defaultDeliv = deliverables[0]?.id ?? "";
    const newRows: ActivityRow[] = lines.map(line => {
      const parts = line.split("\t").map(p => p.trim());
      let title = parts[0] || "";
      let start = defaultStartDate;
      let due = defaultDueDate;
      let criterion = "";

      // Si la primera columna parece un número o código WBS previo (ej: "1", "1.1", "WBS-1"), usar la segunda como título
      if (/^(\d+(\.\d+)*|[A-Z]+-\d+)$/i.test(parts[0]) && parts.length > 1) {
        title = parts[1] || "";
        if (parts[2]) start = parts[2];
        if (parts[3]) due = parts[3];
        if (parts[4]) criterion = parts[4];
      } else {
        if (parts[1]) start = parts[1];
        if (parts[2]) due = parts[2];
        if (parts[3]) criterion = parts[3];
      }

      return {
        id: `act_${crypto.randomUUID().replaceAll("-", "")}`,
        wbs: "",
        title,
        deliverable_id: defaultDeliv,
        criterion,
        evidence_required: true,
        start_date: start,
        due_date: due,
        status: "not_started",
        at_risk: false,
      };
    });

    const combined = rows.length === 1 && !rows[0].title.trim() ? newRows : [...rows, ...newRows];
    onChange(refreshRowWbs(combined, deliverables, embedDeliverable));
    setPasteBuffer("");
    setShowPaste(false);
  }

  function handleRowKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!disabled && index === rows.length - 1 && rows[index]?.title.trim()) {
      addRow();
    }
  }

  function handleTitlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    handlePasteText(text);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="action text-xs"
            disabled={disabled}
            onClick={() => setShowPaste(open => !open)}
          >
            {showPaste ? t("common.hidePaste") : t("common.pasteFromExcel")}
          </button>
          <button
            type="button"
            className="btn-primary text-xs px-3 py-1.5"
            disabled={disabled}
            onClick={addRow}
          >
            {t("activityGrid.addRow")}
          </button>
        </div>
      </div>

      {showPaste && (
        <div className="p-3 bg-kmx-gray-50 border border-kmx-gray-300 rounded space-y-2">
          <label className="text-xs font-semibold block text-kmx-carbon">
            {t("activityGrid.pasteLabel")}
            <textarea
              className="mt-1 border p-2 w-full text-xs font-mono rounded"
              rows={3}
              value={pasteBuffer}
              onChange={e => setPasteBuffer(e.target.value)}
              placeholder={t("activityGrid.pastePlaceholder")}
              disabled={disabled}
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="action text-xs"
              onClick={() => { setPasteBuffer(""); setShowPaste(false); }}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn-primary text-xs px-3 py-1"
              disabled={disabled || !pasteBuffer.trim()}
              onClick={() => handlePasteText(pasteBuffer)}
            >
              {t("common.importRows")}
            </button>
          </div>
        </div>
      )}

      <div className="results-table-scroll">
        <table className="results-table activity-grid-table w-full">
          <thead>
            <tr className="bg-kmx-gray-50 text-left text-xs font-semibold text-kmx-gray-600 border-b">
              <th className="p-2 w-12 text-center" title={t("activityGrid.col.numberTitle")}>#</th>
              <th className="p-2 min-w-[200px]">{embedDeliverable ? t("activityGrid.col.embeddedTitle") : t("activityGrid.col.title")}</th>
              {embedDeliverable ? (
                <th className="p-2 min-w-[240px]">{t("activityGrid.col.criterion")}</th>
              ) : (
                deliverables.length > 0 && <th className="p-2 min-w-[180px]">{t("activityGrid.col.deliverable")}</th>
              )}
              {showResponsible && <th className="p-2 min-w-[150px]">{t("common.responsible")}</th>}
              <th className="p-2 min-w-[220px]">{t("activityGrid.col.dates")}</th>
              <th className="p-2 w-28">{t("common.status")}</th>
              <th className="p-2 w-20 text-center">{t("activityGrid.risk")}</th>
              <th className="p-2 w-16 text-center">{t("common.action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-b last:border-b-0 hover:bg-kmx-gray-50/50 align-top">
                <td className="p-2 text-center align-middle" data-label={t("activityGrid.dataLabel.number")}>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-kmx-gray-100 text-kmx-carbon border"
                    title={t("activityGrid.numberTitle", { wbs: row.wbs })}
                  >
                    {row.wbs}
                  </span>
                </td>
                <td className="p-2 align-middle" data-label={embedDeliverable ? t("activityGrid.dataLabel.embedded") : t("activityGrid.dataLabel.title")}>
                  <input
                    type="text"
                    disabled={disabled}
                    required
                    aria-label={t("commitment.deliverableNameAria", { index: idx + 1 })}
                    className="w-full p-1.5 border rounded text-xs"
                    placeholder={embedDeliverable ? t("activityGrid.placeholder.embedded") : t("activityGrid.placeholder.title")}
                    value={row.title}
                    onChange={e => updateRow(idx, { title: e.target.value })}
                    onKeyDown={e => handleRowKeyDown(idx, e)}
                    onPaste={handleTitlePaste}
                  />
                </td>
                {embedDeliverable ? (
                  <td className="p-2 align-middle" data-label={t("activityGrid.col.criterion")}>
                    <div className="space-y-1">
                      <input
                        type="text"
                        disabled={disabled}
                        aria-label={t("commitment.criterionLabel", { dIndex: idx + 1, cIndex: 1 })}
                        className="w-full p-1.5 border rounded text-xs"
                        placeholder={t("activityGrid.criterionPlaceholder")}
                        value={row.criterion ?? ""}
                        onChange={e => updateRow(idx, { criterion: e.target.value })}
                        onKeyDown={e => handleRowKeyDown(idx, e)}
                      />
                      <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer text-kmx-gray-600 select-none">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          aria-label={t("commitment.evidenceRequiredAria", { dIndex: idx + 1, cIndex: 1 })}
                          checked={row.evidence_required ?? true}
                          onChange={e => updateRow(idx, { evidence_required: e.target.checked })}
                        />
                        <span>{t("common.evidenceRequired")}</span>
                      </label>
                    </div>
                  </td>
                ) : (
                  deliverables.length > 0 && (
                    <td className="p-2 align-middle" data-label={t("activityGrid.col.deliverable")}>
                      <select
                        disabled={disabled}
                        className="w-full p-1.5 border rounded text-xs"
                        value={row.deliverable_id}
                        onChange={e => updateRow(idx, { deliverable_id: e.target.value })}
                      >
                        <option value="">{t("activityGrid.selectDeliverable")}</option>
                        {deliverables.map((d, dIdx) => (
                          <option key={d.id} value={d.id}>
                            {t("activityGrid.deliverableOption", { index: dIdx + 1, title: pick(d.title) || t("activityGrid.untitledDeliverable") })}
                          </option>
                        ))}
                      </select>
                    </td>
                  )
                )}
                {showResponsible && (
                  <td className="p-2 align-middle" data-label={t("common.responsible")}>
                    <select
                      disabled={disabled}
                      aria-label={t("activityGrid.ownerAria", { index: idx + 1 })}
                      className="w-full p-1.5 border rounded text-xs"
                      value={row.responsible_id ?? ""}
                      onChange={e => updateRow(idx, { responsible_id: e.target.value || undefined })}
                    >
                      <option value="">{t("activityGrid.ownerAuto")}</option>
                      {engineers.map(eng => (
                        <option key={eng.id} value={eng.id}>
                          {eng.name} · {eng.id}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="p-2 align-middle" data-label={t("activityGrid.col.dates")}>
                  <div className="activity-grid-dates-cell flex items-center gap-1.5">
                    <input
                      type="date"
                      disabled={disabled}
                      className="p-1 border rounded text-xs w-full"
                      value={row.start_date || defaultStartDate}
                      title={t("activityGrid.forecastStartTitle")}
                      onChange={e => updateRow(idx, { start_date: e.target.value })}
                    />
                    <span className="text-kmx-gray-400 text-xs">→</span>
                    <input
                      type="date"
                      disabled={disabled}
                      required
                      aria-label={t("commitment.deliverableDueAria", { index: idx + 1 })}
                      className="p-1 border rounded text-xs w-full"
                      value={row.due_date || defaultDueDate}
                      title={t("activityGrid.forecastEndTitle")}
                      onChange={e => updateRow(idx, { due_date: e.target.value })}
                    />
                  </div>
                </td>
                <td className="p-2 align-middle" data-label={t("common.status")}>
                  <select
                    disabled={disabled}
                    className="w-full p-1.5 border rounded text-xs"
                    value={row.status}
                    onChange={e => updateRow(idx, { status: e.target.value as ActivityRow["status"] })}
                  >
                    <option value="not_started">{t("common.status.notStarted")}</option>
                    <option value="in_progress">{t("common.status.inProgress")}</option>
                  </select>
                </td>
                <td className="p-2 text-center align-middle" data-label={t("activityGrid.risk")}>
                  <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={row.at_risk}
                      onChange={e => updateRow(idx, { at_risk: e.target.checked })}
                    />
                    <span className={row.at_risk ? "text-kmx-red font-semibold" : "text-kmx-gray-600"}>
                      {t("activityGrid.risk")}
                    </span>
                  </label>
                </td>
                <td className="p-2 text-center align-middle" data-label={t("common.action")}>
                  <button
                    type="button"
                    disabled={disabled || rows.length <= 1}
                    className="text-kmx-red hover:underline text-xs disabled:opacity-30 disabled:no-underline"
                    onClick={() => removeRow(idx)}
                    title={t("activityGrid.removeRowTitle")}
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
  );
}
