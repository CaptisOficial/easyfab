import { useEffect, useState, type FormEvent } from "react";
import { plantCatalogs, requestId, savePlantCatalogs, type CatalogItem, type PlantCatalogs, type PlantConfig } from "../../lib/api";

const kinds = [["lines", "Líneas"], ["machines", "Equipos"], ["failure_types", "Tipos de falla"]] as const;
type KindKey = typeof kinds[number][0];

export function PlantCatalog() {
  const [data, setData] = useState<PlantCatalogs | null>(null);
  const [draft, setDraft] = useState<PlantConfig | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState({ lines: "", machines: "", failure_types: "" });
  const [line, setLine] = useState("");

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

  const hasUnsavedChanges = !!data && !!draft && JSON.stringify(data.config) !== JSON.stringify(draft);

  return (
    <section aria-label="Catálogos FAB" className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Catálogos FAB</h3>
          <p className="text-sm">Desactiva entradas que ya no se usan. Sus referencias e historial se conservan.</p>
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
        <fieldset disabled={busy || !data?.can_edit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {kinds.map(([key, label]) => (
              <div className="work-card space-y-3" key={key}>
                <h4 className="font-bold">{label}</h4>
                {!draft[key].length && <p className="text-sm">Sin registros.</p>}
                {draft[key].map(item => (
                  <div key={item.id} className="space-y-2 border-b pb-3">
                    <label className="field">
                      Nombre de {label}
                      <input
                        aria-label={`Nombre de ${item.name}`}
                        value={item.name}
                        onChange={e => {
                          setNotice("");
                          setDraft({
                            ...draft,
                            [key]: draft[key].map(i => i.id === item.id ? { ...i, name: e.target.value } : i)
                          });
                        }}
                      />
                    </label>
                    {key === "machines" && (
                      <label className="field">
                        Línea de {item.name}
                        <select
                          aria-label={`Línea de ${item.name}`}
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
                      </label>
                    )}
                    <label className="flex items-center gap-2">
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
                      {item.name} activo
                    </label>
                  </div>
                ))}

                <form onSubmit={e => void handleAdd(key, e)} className="space-y-2 pt-2">
                  <label className="field">
                    Nuevo registro: {label}
                    <input
                      value={names[key]}
                      onChange={e => setNames({ ...names, [key]: e.target.value })}
                      placeholder={`Nombre de ${key === "lines" ? "línea" : label.toLowerCase()}...`}
                    />
                  </label>
                  {key === "machines" && (
                    <label className="field">
                      Línea del equipo
                      <select value={line} onChange={e => setLine(e.target.value)}>
                        <option value="">Sin línea</option>
                        {draft.lines.filter(l => l.active).map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    className="action"
                    type="submit"
                    disabled={busy || !names[key].trim()}
                  >
                    Añadir a {label}
                  </button>
                </form>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <button className="btn-primary" disabled={busy} onClick={() => void save()}>
              {busy ? "Guardando…" : "Guardar catálogos"}
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
