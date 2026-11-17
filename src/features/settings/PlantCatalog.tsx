import { useEffect, useState, type FormEvent } from "react";
import { plantCatalogs, requestId, savePlantCatalogs, type CatalogItem, type PlantCatalogs, type PlantConfig } from "../../lib/api";

const kinds = [["lines", "Líneas"], ["machines", "Equipos"], ["failure_types", "Tipos de falla"]] as const;
type KindKey = typeof kinds[number][0];
type TabKey = "all" | KindKey;

export function PlantCatalog() {
  const [data, setData] = useState<PlantCatalogs | null>(null);
  const [draft, setDraft] = useState<PlantConfig | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
    }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, []);

  async function save(customDraft?: PlantConfig) {
    const configToSave = customDraft ?? draft;
    if (!data || !configToSave || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await savePlantCatalogs({ config: configToSave, expected_revision: data.revision });
      setData(result);
      setDraft(result.config);
      setNotice("Catálogos guardados.");
      return result;
    } catch (e) {
      setError(String(e));
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
      const label = kinds.find(k => k[0] === key)?.[1] ?? key;
      setNotice(`Registro añadido y guardado en ${label}.`);
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
    setNotice("");
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
          const matched = draft.lines.find(l => l.name.toLowerCase() === parts[1].toLowerCase());
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
    setNotice(`Se importaron ${newItems.length} filas en borrador para ${kinds.find(k => k[0] === key)?.[1] ?? key}. Revisa y haz clic en "Guardar catálogos" para persistir.`);
  }

  const hasUnsavedChanges = !!data && !!draft && JSON.stringify(data.config) !== JSON.stringify(draft);

  const visibleKinds = kinds.filter(([key]) => activeTab === "all" || activeTab === key);

  return (
    <section aria-label="Catálogos FAB" className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold">Catálogos FAB</h3>
          <p className="text-sm text-kmx-gray-600">
            Administra líneas de producción, equipos y tipos de falla en formato de tabla interactiva.
          </p>
        </div>
      </div>

      {hasUnsavedChanges && (
        <p className="results-warning" role="status">
          Hay cambios en los nombres o estados sin guardar en disco. Haz clic en "Guardar catálogos" para persistirlos.
        </p>
      )}

      {error && <p role="alert" className="text-kmx-red">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {!draft ? (
        <p role="status">Cargando catálogos…</p>
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
              <span>Todos los catálogos</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "all" ? "bg-kmx-carbon text-white" : "bg-kmx-gray-100 text-kmx-gray-600"}`}>
                {draft.lines.length + draft.machines.length + draft.failure_types.length}
              </span>
            </button>

            {kinds.map(([key, label]) => {
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
          {visibleKinds.map(([key, label]) => {
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
                      {key === "lines"
                        ? "Líneas de producción de la planta FAB para proyectos y actividades."
                        : key === "machines"
                        ? "Equipos y estaciones de trabajo vinculados a líneas de producción."
                        : "Clasificación de fallas operativas e incidencias no programadas."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="search"
                      className="p-1.5 border rounded text-xs min-w-[170px]"
                      placeholder={`Buscar ${label.toLowerCase()}...`}
                      value={search}
                      onChange={e => setSearchQueries({ ...searchQueries, [key]: e.target.value })}
                      aria-label={`Buscar ${label}`}
                    />

                    {key === "machines" && (
                      <select
                        className="p-1.5 border rounded text-xs"
                        value={filterLineId}
                        onChange={e => setFilterLineId(e.target.value)}
                        aria-label="Filtrar por línea"
                      >
                        <option value="">Todas las líneas</option>
                        <option value="none">Sin línea asignada</option>
                        {draft.lines.map(l => (
                          <option key={l.id} value={l.id}>{l.name}{!l.active ? " (inactiva)" : ""}</option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      className="action text-xs"
                      onClick={() => setPasteOpen({ ...pasteOpen, [key]: !isOpenPaste })}
                    >
                      {isOpenPaste ? "Ocultar pegado" : "Pegar desde Excel…"}
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs px-3 py-1.5"
                      onClick={() => handleAddEmptyRow(key)}
                    >
                      + Añadir fila a {label}
                    </button>
                  </div>
                </div>

                {/* Panel de importación TSV */}
                {isOpenPaste && (
                  <div className="p-3 bg-kmx-gray-50 border border-kmx-gray-300 rounded space-y-2">
                    <label className="text-xs font-semibold block text-kmx-carbon">
                      Pegar filas desde Excel para {label} (separadas por Tabulador)
                      <textarea
                        className="mt-1 border p-2 w-full text-xs font-mono rounded bg-white"
                        rows={3}
                        value={pasteBuffers[key]}
                        onChange={e => setPasteBuffers({ ...pasteBuffers, [key]: e.target.value })}
                        placeholder={
                          key === "machines"
                            ? "Pega aquí filas copiadas de Excel (Nombre de equipo [Tab] Nombre de línea)..."
                            : `Pega aquí filas copiadas de Excel (Nombre de ${key === "lines" ? "línea" : "falla"})...`
                        }
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
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn-primary text-xs px-3 py-1"
                        disabled={!pasteBuffers[key].trim()}
                        onClick={() => handlePasteText(key)}
                      >
                        Importar filas
                      </button>
                    </div>
                  </div>
                )}

                {/* Tabla de registros estilo ActivityGrid */}
                <div className="border border-kmx-gray-200 rounded overflow-x-auto shadow-sm">
                  <table className="results-table w-full">
                    <thead>
                      <tr className="bg-kmx-gray-50 text-left text-xs font-semibold text-kmx-gray-600 border-b">
                        <th className="p-2 w-12 text-center" title="Número correlativo">#</th>
                        <th className="p-2 min-w-[220px]">
                          {key === "lines" ? "Nombre de la línea" : key === "machines" ? "Nombre del equipo / estación" : "Nombre del tipo de falla"}
                        </th>
                        {key === "lines" && (
                          <th className="p-2 w-36 text-center">Equipos asignados</th>
                        )}
                        {key === "machines" && (
                          <th className="p-2 min-w-[200px]">Línea asignada</th>
                        )}
                        <th className="p-2 w-28 text-center">Estado</th>
                        <th className="p-2 w-24 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!filtered.length ? (
                        <tr>
                          <td colSpan={key === "lines" || key === "machines" ? 5 : 4} className="p-4 text-center text-xs text-kmx-gray-500">
                            Sin registros en {label}. Pulsa "+ Añadir fila a {label}" o "Pegar desde Excel…" para comenzar.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((item, idx) => {
                          const isNewUnsaved = !data?.config[key]?.some(saved => saved.id === item.id);
                          const machineCount = key === "lines"
                            ? draft.machines.filter(m => m.line_id === item.id).length
                            : 0;

                          return (
                            <tr key={item.id} className="border-b last:border-b-0 hover:bg-kmx-gray-50/50 align-middle">
                              <td className="p-2 text-center">
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-kmx-gray-100 text-kmx-carbon border">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="p-2">
                                <input
                                  aria-label={`Nombre de ${item.name || "nuevo registro"}`}
                                  className="w-full p-1.5 border rounded text-xs bg-white"
                                  value={item.name}
                                  placeholder="Escribe el nombre..."
                                  onChange={e => {
                                    setNotice("");
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
                                    {machineCount} {machineCount === 1 ? "equipo" : "equipos"}
                                  </span>
                                </td>
                              )}

                              {key === "machines" && (
                                <td className="p-2">
                                  <select
                                    aria-label={`Línea de ${item.name || "nuevo equipo"}`}
                                    className="w-full p-1.5 border rounded text-xs bg-white"
                                    value={item.line_id ?? ""}
                                    onChange={e => {
                                      setNotice("");
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
                                    <option value="">Sin línea</option>
                                    {draft.lines.filter(l => l.active || l.id === item.line_id).map(l => (
                                      <option key={l.id} value={l.id}>{l.name}{!l.active ? " (inactiva)" : ""}</option>
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
                                      setNotice("");
                                      setDraft({
                                        ...draft,
                                        [key]: draft[key].map(i => i.id === item.id ? { ...i, active: e.target.checked } : i)
                                      });
                                    }}
                                  />
                                  <span>{item.name} activo</span>
                                </label>
                              </td>

                              <td className="p-2 text-center">
                                {isNewUnsaved ? (
                                  <button
                                    type="button"
                                    className="action text-xs text-kmx-red px-2 py-1"
                                    title="Descartar fila nueva"
                                    onClick={() => {
                                      setDraft({
                                        ...draft,
                                        [key]: draft[key].filter(i => i.id !== item.id)
                                      });
                                    }}
                                  >
                                    Quitar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="action text-xs px-2 py-1"
                                    title={item.active ? "Desactivar" : "Reactivar"}
                                    onClick={() => {
                                      setDraft({
                                        ...draft,
                                        [key]: draft[key].map(i => i.id === item.id ? { ...i, active: !i.active } : i)
                                      });
                                    }}
                                  >
                                    {item.active ? "Desactivar" : "Activar"}
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
                    Nuevo registro: {label}
                    <input
                      className="p-1.5 border rounded text-xs bg-white"
                      value={names[key]}
                      onChange={e => setNames({ ...names, [key]: e.target.value })}
                      placeholder={`Nombre de ${key === "lines" ? "línea" : label.toLowerCase()}...`}
                    />
                  </label>
                  {key === "machines" && (
                    <label className="field text-xs min-w-[150px]">
                      Línea del equipo
                      <select
                        className="p-1.5 border rounded text-xs bg-white"
                        value={line}
                        onChange={e => setLine(e.target.value)}
                      >
                        <option value="">Sin línea</option>
                        {draft.lines.filter(l => l.active).map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
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
                      Añadir a {label}
                    </button>
                  </div>
                </form>
              </section>
            );
          })}

          {/* Barra inferior de guardado */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-kmx-gray-500">
              Total: {draft.lines.length} líneas · {draft.machines.length} equipos · {draft.failure_types.length} tipos de falla.
            </span>
            <button className="btn-primary" disabled={busy} onClick={() => void save()}>
              {busy ? "Guardando…" : "Guardar catálogos"}
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
