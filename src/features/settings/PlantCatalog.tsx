import { useEffect, useState, type FormEvent } from "react";
import { plantCatalogs, requestId, savePlantCatalogs, type CatalogItem, type PlantCatalogs, type PlantConfig } from "../../lib/api";
import { parseBilingual } from "../../lib/bilingual";
import { extractErrorMessage } from "../../lib/errors";
import { useI18n, type MessageKey } from "../../lib/i18n";

const kinds = [
  ["lines", "catalogs.kind.lines"],
  ["machines", "catalogs.kind.machines"],
  ["failure_types", "catalogs.kind.failureTypes"],
] as const satisfies ReadonlyArray<readonly [string, MessageKey]>;
type KindKey = typeof kinds[number][0];
type TabKey = "all" | KindKey;
type NoticeState =
  | { key: "catalogs.notice.saved" }
  | { key: "catalogs.notice.added"; kindKey: MessageKey }
  | { key: "catalogs.notice.imported"; count: number; kindKey: MessageKey }
  | null;

export function PlantCatalog() {
  const { lang, t, pick, tError } = useI18n();
  const [data, setData] = useState<PlantCatalogs | null>(null);
  const [draft, setDraft] = useState<PlantConfig | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [names, setNames] = useState({ lines: "", machines: "", failure_types: "" });
  const [line, setLine] = useState("");
  const [pasteOpen, setPasteOpen] = useState<Record<KindKey, boolean>>({ lines: false, machines: false, failure_types: false });
  const [pasteBuffers, setPasteBuffers] = useState<Record<KindKey, string>>({ lines: "", machines: "", failure_types: "" });
  const [filterLineId, setFilterLineId] = useState("");
  const [searchQueries, setSearchQueries] = useState<Record<KindKey, string>>({ lines: "", machines: "", failure_types: "" });

  useEffect(() => {
    let active = true;
    plantCatalogs().then(value => {
      if (active) { setData(value); setDraft(value.config); }
    }).catch(e => { if (active) setError(extractErrorMessage(e)); });
    return () => { active = false; };
  }, []);

  async function save(customDraft?: PlantConfig) {
    const configToSave = customDraft ?? draft;
    if (!data || !configToSave || busy) return;
    setBusy(true); setError(""); setNotice(null);
    try {
      const result = await savePlantCatalogs({ config: configToSave, expected_revision: data.revision });
      setData(result);
      setDraft(result.config);
      setNotice({ key: "catalogs.notice.saved" });
      return result;
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(key: KindKey, e?: FormEvent) {
    if (e) e.preventDefault();
    const name = names[key].trim();
    if (!name || !draft || !data || busy) return;
    const newItem: CatalogItem = {
      id: requestId(),
      name,
      active: true,
      ...(key === "machines" && line ? { line_id: line } : {}),
    };
    const nextConfig: PlantConfig = {
      ...draft,
      [key]: [...draft[key], newItem],
    };
    setDraft(nextConfig);
    setNames({ ...names, [key]: "" });
    if (key === "machines") setLine("");
    const result = await save(nextConfig);
    if (result) {
      const kindKey = kinds.find(k => k[0] === key)?.[1];
      if (kindKey) {
        setNotice({ key: "catalogs.notice.added", kindKey });
      }
    }
  }

  function handleAddEmptyRow(key: KindKey) {
    if (!draft) return;
    const newItem: CatalogItem = {
      id: requestId(),
      name: "",
      active: true,
      ...(key === "machines" && filterLineId && filterLineId !== "none" ? { line_id: filterLineId } : {}),
    };
    setDraft({
      ...draft,
      [key]: [...draft[key], newItem],
    });
    setNotice(null);
  }

  function handlePasteText(key: KindKey) {
    if (!draft) return;
    const text = pasteBuffers[key] || "";
    const rawLines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!rawLines.length) return;

    const newItems: CatalogItem[] = [];
    for (const rawLine of rawLines) {
      const parts = rawLine.split("\t").map(p => p.trim());
      const itemName = parts[0] || "";
      if (!itemName) continue;

      let itemLineId: string | undefined = undefined;
      if (key === "machines") {
        if (parts[1]) {
          const target = parts[1].trim().toLowerCase();
          const matched = draft.lines.find(l => {
            if (l.name.trim().toLowerCase() === target) return true;
            const { es, en } = parseBilingual(l.name);
            return es.toLowerCase() === target || (en.length > 0 && en.toLowerCase() === target);
          });
          if (matched) itemLineId = matched.id;
        } else if (filterLineId && filterLineId !== "none") {
          itemLineId = filterLineId;
        }
      }

      newItems.push({
        id: requestId(),
        name: itemName,
        active: true,
        ...(itemLineId ? { line_id: itemLineId } : {}),
      });
    }

    if (!newItems.length) return;

    setDraft({
      ...draft,
      [key]: [...draft[key], ...newItems],
    });
    setPasteBuffers({ ...pasteBuffers, [key]: "" });
    setPasteOpen({ ...pasteOpen, [key]: false });
    const kindKey = kinds.find(k => k[0] === key)?.[1];
    if (kindKey) {
      setNotice({ key: "catalogs.notice.imported", count: newItems.length, kindKey });
    }
  }

  const hasUnsavedChanges = !!data && !!draft && JSON.stringify(data.config) !== JSON.stringify(draft);

  const visibleKinds = kinds.filter(([key]) => activeTab === "all" || activeTab === key);
  const errorText = error ? tError(error) : "";
  const noticeText = notice
    ? notice.key === "catalogs.notice.saved"
      ? t("catalogs.notice.saved")
      : notice.key === "catalogs.notice.added"
        ? t("catalogs.notice.added", { kind: t(notice.kindKey) })
        : t("catalogs.notice.imported", { count: notice.count, kind: t(notice.kindKey) })
    : "";

  return (
    <section aria-label={t("catalogs.title")} className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold">{t("catalogs.title")}</h3>
          <p className="text-sm text-kmx-gray-600">
            {t("catalogs.subtitle")}
          </p>
          <p className="text-xs text-kmx-gray-500">
            {t("common.bilingualHint")}
          </p>
        </div>
      </div>

      {hasUnsavedChanges && (
        <p className="results-warning" role="status">
          {t("catalogs.unsavedWarning")}
        </p>
      )}

      {errorText && <p role="alert" className="text-kmx-red">{errorText}</p>}
      {noticeText && <p role="status">{noticeText}</p>}

      {!draft ? (
        <p role="status">{t("catalogs.loading")}</p>
      ) : (
        <fieldset disabled={busy || !data?.can_edit} className="space-y-6 min-w-0">
          {/* Navegación por pestañas análoga a la jerarquía de proyectos */}
          <div className="flex border-b border-kmx-gray-200 gap-2 flex-wrap" role="tablist">
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "all"}
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                activeTab === "all"
                  ? "border-kmx-carbon text-kmx-carbon font-bold"
                  : "border-transparent text-kmx-gray-500 hover:text-kmx-carbon"
              }`}
            >
              <span>{t("catalogs.tabAll")}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "all" ? "bg-kmx-carbon text-white" : "bg-kmx-gray-100 text-kmx-gray-600"}`}>
                {draft.lines.length + draft.machines.length + draft.failure_types.length}
              </span>
            </button>

            {kinds.map(([key, labelKey]) => {
              const label = t(labelKey);
              const count = draft[key].length;
              const isSelected = activeTab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                    isSelected
                      ? "border-kmx-carbon text-kmx-carbon font-bold"
                      : "border-transparent text-kmx-gray-500 hover:text-kmx-carbon"
                  }`}
                >
                  <span>{label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? "bg-kmx-carbon text-white" : "bg-kmx-gray-100 text-kmx-gray-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Renderizado de cada catálogo en formato de tabla interactiva */}
          {visibleKinds.map(([key, labelKey]) => {
            const label = t(labelKey);
            const items = draft[key];
            const search = searchQueries[key];
            const filtered = items.filter(item => {
              if (search.trim() && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
              if (key === "machines") {
                if (filterLineId === "none" && item.line_id) return false;
                if (filterLineId && filterLineId !== "none" && item.line_id !== filterLineId) return false;
              }
              return true;
            });
            const isOpenPaste = pasteOpen[key];

            return (
              <section key={key} aria-label={label} className="work-card space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap border-b pb-2">
                  <div>
                    <h4 className="font-bold flex items-center gap-2">
                      <span>{label}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-kmx-gray-100 border text-kmx-carbon">
                        {items.length}
                      </span>
                    </h4>
                    <p className="text-xs text-kmx-gray-500">
                      {t(
                        key === "lines"
                          ? "catalogs.desc.lines"
                          : key === "machines"
                            ? "catalogs.desc.machines"
                            : "catalogs.desc.failureTypes"
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="search"
                      className="p-1.5 border rounded text-xs min-w-[170px]"
                      placeholder={t("catalogs.searchPlaceholder", { kind: label.toLowerCase() })}
                      value={search}
                      onChange={e => setSearchQueries({ ...searchQueries, [key]: e.target.value })}
                      aria-label={t("catalogs.searchAria", { kind: label })}
                    />

                    {key === "machines" && (
                      <select
                        className="p-1.5 border rounded text-xs"
                        value={filterLineId}
                        onChange={e => setFilterLineId(e.target.value)}
                        aria-label={t("catalogs.filterByLine")}
                      >
                        <option value="">{t("catalogs.allLines")}</option>
                        <option value="none">{t("catalogs.noAssignedLine")}</option>
                        {draft.lines.map(l => (
                          <option key={l.id} value={l.id}>{pick(l.name)}{!l.active ? t("catalogs.inactiveSuffix") : ""}</option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      className="action text-xs"
                      onClick={() => setPasteOpen({ ...pasteOpen, [key]: !isOpenPaste })}
                    >
                      {isOpenPaste ? t("common.hidePaste") : t("common.pasteFromExcel")}
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs px-3 py-1.5"
                      onClick={() => handleAddEmptyRow(key)}
                    >
                      {t("catalogs.addRow", { kind: label })}
                    </button>
                  </div>
                </div>

                {/* Panel de importación TSV */}
                {isOpenPaste && (
                  <div className="p-3 bg-kmx-gray-50 border border-kmx-gray-300 rounded space-y-2">
                    <label className="text-xs font-semibold block text-kmx-carbon">
                      {t("catalogs.pasteLabel", { kind: label })}
                      <textarea
                        className="mt-1 border p-2 w-full text-xs font-mono rounded bg-white"
                        rows={3}
                        value={pasteBuffers[key]}
                        onChange={e => setPasteBuffers({ ...pasteBuffers, [key]: e.target.value })}
                        placeholder={t(
                          key === "machines"
                            ? "catalogs.pastePlaceholder.machines"
                            : key === "lines"
                              ? "catalogs.pastePlaceholder.lines"
                              : "catalogs.pastePlaceholder.failureTypes"
                        )}
                      />
                    </label>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="action text-xs"
                        onClick={() => {
                          setPasteBuffers({ ...pasteBuffers, [key]: "" });
                          setPasteOpen({ ...pasteOpen, [key]: false });
                        }}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        className="btn-primary text-xs px-3 py-1"
                        disabled={!pasteBuffers[key].trim()}
                        onClick={() => handlePasteText(key)}
                      >
                        {t("common.importRows")}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tabla de registros estilo ActivityGrid */}
                <div className="results-table-scroll">
                  <table className="results-table w-full">
                    <thead>
                      <tr className="bg-kmx-gray-50 text-left text-xs font-semibold text-kmx-gray-600 border-b">
                        <th className="p-2 w-12 text-center" title={t("catalogs.col.numberTitle")}>#</th>
                        <th className="p-2 min-w-[220px]">
                          {t(
                            key === "lines"
                              ? "catalogs.col.lineName"
                              : key === "machines"
                                ? "catalogs.col.machineName"
                                : "catalogs.col.failureTypeName"
                          )}
                        </th>
                        {key === "lines" && (
                          <th className="p-2 w-36 text-center">{t("catalogs.col.assignedMachines")}</th>
                        )}
                        {key === "machines" && (
                          <th className="p-2 min-w-[200px]">{t("catalogs.col.assignedLine")}</th>
                        )}
                        <th className="p-2 w-28 text-center">{t("common.status")}</th>
                        <th className="p-2 w-24 text-center">{t("common.action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!filtered.length ? (
                        <tr>
                          <td colSpan={key === "lines" || key === "machines" ? 5 : 4} className="p-4 text-center text-xs text-kmx-gray-500">
                            {t("catalogs.emptyKind", { kind: label })}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((item, idx) => {
                          const isNewUnsaved = !data?.config[key]?.some(saved => saved.id === item.id);
                          const machineCount = key === "lines"
                            ? draft.machines.filter(m => m.line_id === item.id).length
                            : 0;
                          const displayName = pick(item.name) || item.name.trim();

                          return (
                            <tr key={item.id} className="border-b last:border-b-0 hover:bg-kmx-gray-50/50 align-middle">
                              <td className="p-2 text-center">
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-kmx-gray-100 text-kmx-carbon border">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="p-2">
                                <input
                                  aria-label={t("catalogs.itemNameAria", { name: displayName || t("catalogs.newRecord") })}
                                  className="w-full p-1.5 border rounded text-xs bg-white"
                                  value={item.name}
                                  placeholder={t("catalogs.namePlaceholder")}
                                  onChange={e => {
                                    setNotice(null);
                                    setDraft({
                                      ...draft,
                                      [key]: draft[key].map(i => i.id === item.id ? { ...i, name: e.target.value } : i)
                                    });
                                  }}
                                />
                              </td>

                              {key === "lines" && (
                                <td className="p-2 text-center">
                                  <span className="inline-block px-2 py-0.5 rounded text-xs bg-kmx-gray-50 border text-kmx-gray-700">
                                    {t(machineCount === 1 ? "catalogs.machineCountSingle" : "catalogs.machineCountPlural", { count: machineCount })}
                                  </span>
                                </td>
                              )}

                              {key === "machines" && (
                                <td className="p-2">
                                  <select
                                    aria-label={t("catalogs.machineLineAria", { name: displayName || t("catalogs.newMachine") })}
                                    className="w-full p-1.5 border rounded text-xs bg-white"
                                    value={item.line_id ?? ""}
                                    onChange={e => {
                                      setNotice(null);
                                      setDraft({
                                        ...draft,
                                        machines: draft.machines.map(i => {
                                          if (i.id !== item.id) return i;
                                          const { line_id: _previous, ...rest } = i;
                                          return e.target.value ? { ...rest, line_id: e.target.value } : rest;
                                        })
                                      });
                                    }}
                                  >
                                    <option value="">{t("catalogs.noLine")}</option>
                                    {draft.lines.filter(l => l.active || l.id === item.line_id).map(l => (
                                      <option key={l.id} value={l.id}>{pick(l.name)}{!l.active ? t("catalogs.inactiveSuffix") : ""}</option>
                                    ))}
                                  </select>
                                </td>
                              )}

                              <td className="p-2 text-center">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs">
                                  <input
                                    type="checkbox"
                                    checked={item.active}
                                    onChange={e => {
                                      setNotice(null);
                                      setDraft({
                                        ...draft,
                                        [key]: draft[key].map(i => i.id === item.id ? { ...i, active: e.target.checked } : i)
                                      });
                                    }}
                                  />
                                  <span>{t("catalogs.itemActiveLabel", { name: displayName || t("catalogs.newRecord") })}</span>
                                </label>
                              </td>

                              <td className="p-2 text-center">
                                {isNewUnsaved ? (
                                  <button
                                    type="button"
                                    className="action text-xs text-kmx-red px-2 py-1"
                                    title={t("catalogs.discardNewRowTitle")}
                                    onClick={() => {
                                      setDraft({
                                        ...draft,
                                        [key]: draft[key].filter(i => i.id !== item.id)
                                      });
                                    }}
                                  >
                                    {t("common.remove")}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="action text-xs px-2 py-1"
                                    title={t(item.active ? "common.deactivate" : "common.reactivate")}
                                    onClick={() => {
                                      setDraft({
                                        ...draft,
                                        [key]: draft[key].map(i => i.id === item.id ? { ...i, active: !i.active } : i)
                                      });
                                    }}
                                  >
                                    {t(item.active ? "common.deactivate" : "common.activate")}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Formulario de adición rápida individual con persistencia inmediata */}
                <form onSubmit={e => void handleAdd(key, e)} className="flex items-center gap-2 flex-wrap pt-2">
                  <label className="field flex-1 min-w-[200px] text-xs">
                    {t("catalogs.quickAddLabel", { kind: label })}
                    <input
                      className="p-1.5 border rounded text-xs bg-white"
                      value={names[key]}
                      onChange={e => setNames({ ...names, [key]: e.target.value })}
                      placeholder={
                        key === "lines"
                          ? t("catalogs.quickAddPlaceholder.line")
                          : t("catalogs.quickAddPlaceholder.other", { kind: lang === "en" ? label : label.toLowerCase() })
                      }
                    />
                  </label>
                  {key === "machines" && (
                    <label className="field text-xs min-w-[150px]">
                      {t("catalogs.machineLineLabel")}
                      <select
                        className="p-1.5 border rounded text-xs bg-white"
                        value={line}
                        onChange={e => setLine(e.target.value)}
                      >
                        <option value="">{t("catalogs.noLine")}</option>
                        {draft.lines.filter(l => l.active).map(l => (
                          <option key={l.id} value={l.id}>{pick(l.name)}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="self-end pb-0.5">
                    <button
                      className="action text-xs px-3 py-1.5"
                      type="submit"
                      disabled={busy || !names[key].trim()}
                    >
                      {t("catalogs.quickAddBtn", { kind: label })}
                    </button>
                  </div>
                </form>
              </section>
            );
          })}

          {/* Barra inferior de guardado */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-kmx-gray-500">
              {t("catalogs.totals", {
                lines: draft.lines.length,
                machines: draft.machines.length,
                failureTypes: draft.failure_types.length,
              })}
            </span>
            <button className="btn-primary" disabled={busy} onClick={() => void save()}>
              {t(busy ? "common.saving" : "catalogs.save")}
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
