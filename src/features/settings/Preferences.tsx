import { useEffect, useRef, useState } from "react";
import { resetUserPreferences, saveUserPreferences, userPreferences, type PreferencesView, type UserPreferences } from "../../lib/api";
export function Preferences({ visible }: { visible: boolean }) {
  const [data, setData] = useState<PreferencesView | null>(null); const [theme, setTheme] = useState<UserPreferences["theme"]>("light"); const [scale, setScale] = useState<UserPreferences["ui_scale"]>("standard");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const sending = useRef(false);
  useEffect(() => { let active = true; userPreferences().then(v => { if (active) { setData(v); setTheme(v.preferences.theme); setScale(v.preferences.ui_scale); } }).catch(e => { if (active) setError(String(e)); }); return () => { active = false; }; }, []);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    function apply() { document.documentElement.dataset.theme = data?.preferences.theme === "dark" || (data?.preferences.theme === "system" && media?.matches) ? "dark" : "light"; document.documentElement.dataset.scale = data?.preferences.ui_scale ?? "standard"; }
    apply(); media?.addEventListener("change", apply);
    return () => { media?.removeEventListener("change", apply); delete document.documentElement.dataset.theme; delete document.documentElement.dataset.scale; };
  }, [data]);
  async function commit(reset: boolean) { if (sending.current || !data) return; sending.current = true; setBusy(true); setError(""); setNotice(""); try { const result = reset ? await resetUserPreferences() : await saveUserPreferences({ theme, ui_scale: scale, expected_revision: data.revision }); setData(result); setTheme(result.preferences.theme); setScale(result.preferences.ui_scale); setNotice(reset ? "Preferencias restablecidas." : "Preferencias guardadas."); } catch (e) { setError(String(e)); } finally { sending.current = false; setBusy(false); } }
  return <section hidden={!visible} className="space-y-3 border-t pt-4" aria-label="Preferencias personales"><h3 className="font-bold">Preferencias personales</h3><p className="text-sm">Se guardan en este equipo para tu cuenta y espacio.</p>{error && <p role="alert">{error}</p>}{data?.warning && <p role="status">{data.warning}</p>}{notice && <p role="status">{notice}</p>}
    <fieldset disabled={busy || !data} className="flex flex-wrap items-end gap-3"><label className="field">Tema<select value={theme} onChange={e => setTheme(e.target.value as UserPreferences["theme"])}><option value="light">Claro</option><option value="dark">Oscuro</option><option value="system">Según el sistema</option></select></label><label className="field">Tamaño de interfaz<select value={scale} onChange={e => setScale(e.target.value as UserPreferences["ui_scale"])}><option value="standard">Estándar</option><option value="large">Grande</option></select></label><button className="btn-primary" disabled={!!data?.warning} onClick={() => void commit(false)}>Guardar preferencias</button><button className="action" onClick={() => void commit(true)}>Restablecer preferencias</button></fieldset>
  </section>;
}
