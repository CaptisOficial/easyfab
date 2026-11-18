import { useEffect, useRef, useState } from "react";
import { resetUserPreferences, saveUserPreferences, userPreferences, type PreferencesView, type UserPreferences } from "../../lib/api";
import { extractErrorMessage } from "../../lib/errors";
import { useI18n, type Lang } from "../../lib/i18n";

export function Preferences({ visible }: { visible: boolean }) {
  const { lang, setLang, t, tError } = useI18n();
  const langRef = useRef(lang);
  langRef.current = lang;
  const [data, setData] = useState<PreferencesView | null>(null);
  const [theme, setTheme] = useState<UserPreferences["theme"]>("light");
  const [scale, setScale] = useState<UserPreferences["ui_scale"]>("standard");
  const [selectedLang, setSelectedLang] = useState<Lang>(lang);
  const [error, setError] = useState(""); const [noticeKey, setNoticeKey] = useState<"prefs.saved" | "prefs.resetDone" | "">(""); const [busy, setBusy] = useState(false); const sending = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    setSelectedLang(lang);
  }, [lang]);
  useEffect(() => {
    let active = true;
    const mountLang = langRef.current;
    userPreferences().then(v => {
      if (!active) return;
      setData(v);
      setTheme(v.preferences.theme);
      setScale(v.preferences.ui_scale);
      if (v.revision !== null && !v.warning && langRef.current === mountLang) {
        const savedLang = v.preferences.language ?? "es";
        setSelectedLang(savedLang);
        setLang(savedLang);
      } else {
        setSelectedLang(langRef.current);
      }
    }).catch(e => { if (active) setError(extractErrorMessage(e)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    function apply() { document.documentElement.dataset.theme = data?.preferences.theme === "dark" || (data?.preferences.theme === "system" && media?.matches) ? "dark" : "light"; document.documentElement.dataset.scale = data?.preferences.ui_scale ?? "standard"; }
    apply(); media?.addEventListener("change", apply);
    return () => { media?.removeEventListener("change", apply); delete document.documentElement.dataset.theme; delete document.documentElement.dataset.scale; };
  }, [data]);
  async function commit(reset: boolean) {
    if (sending.current || !data) return;
    sending.current = true; setBusy(true); setError(""); setNoticeKey("");
    try {
      const result = reset
        ? await resetUserPreferences()
        : await saveUserPreferences({ theme, ui_scale: scale, language: selectedLang, expected_revision: data.revision });
      if (!mountedRef.current) return;
      setData(result);
      setTheme(result.preferences.theme);
      setScale(result.preferences.ui_scale);
      const nextLang = result.preferences.language ?? "es";
      setSelectedLang(nextLang);
      setLang(nextLang);
      setNoticeKey(reset ? "prefs.resetDone" : "prefs.saved");
    } catch (e) {
      if (mountedRef.current) setError(extractErrorMessage(e));
    } finally {
      sending.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }
  return <section hidden={!visible} className="space-y-3 border-t pt-4" aria-label={t("prefs.title")}><h3 className="font-bold">{t("prefs.title")}</h3><p className="text-sm">{t("prefs.subtitle")}</p>{error && <p role="alert">{tError(error)}</p>}{data?.warning && <p role="status">{tError(data.warning)}</p>}{noticeKey && <p role="status">{t(noticeKey)}</p>}
    <fieldset disabled={busy || !data} className="flex flex-wrap items-end gap-3">
      <label className="field">{t("prefs.theme")}<select value={theme} onChange={e => setTheme(e.target.value as UserPreferences["theme"])}><option value="light">{t("prefs.theme.light")}</option><option value="dark">{t("prefs.theme.dark")}</option><option value="system">{t("prefs.theme.system")}</option></select></label>
      <label className="field">{t("prefs.scale")}<select value={scale} onChange={e => setScale(e.target.value as UserPreferences["ui_scale"])}><option value="standard">{t("prefs.scale.standard")}</option><option value="large">{t("prefs.scale.large")}</option></select></label>
      <label className="field">{t("prefs.language")}<select value={selectedLang} onChange={e => { const next = e.target.value as Lang; setSelectedLang(next); setLang(next); }}><option value="es">{t("prefs.language.es")}</option><option value="en">{t("prefs.language.en")}</option></select></label>
      <button className="btn-primary" disabled={!!data?.warning} onClick={() => void commit(false)}>{t("prefs.save")}</button>
      <button className="action" onClick={() => void commit(true)}>{t("prefs.reset")}</button>
    </fieldset>
  </section>;
}
