import { useState, type FormEvent } from "react";
import { provisionInitialAdmin } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

export function InitialAdminForm({ onReady }: { onReady: () => Promise<void> }) {
  const { t, tError } = useI18n();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [temporary, setTemporary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { setTemporary(await provisionInitialAdmin(id, name)); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  }
  async function proceed() {
    setBusy(true); setError(null);
    try { await onReady(); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  }
  const errorText = error !== null && error !== "" ? tError(error) : "";
  return <div className="space-y-3">
    <h3 className="font-bold">{t("auth.initialAdmin.title")}</h3>
    <p>{t("auth.initialAdmin.subtitle")}</p>
    {errorText && <p role="alert" className="text-kmx-red">{errorText}</p>}
    {temporary ? <div role="status" className="space-y-3">
      <p>{t("auth.initialAdmin.created", { id: id.trim() })}</p>
      <output className="block font-mono">{temporary}</output>
      <p>{t("auth.initialAdmin.nextStep")}</p>
      <button disabled={busy} onClick={proceed} className="border px-4 py-2">{t("auth.initialAdmin.continue")}</button>
    </div> : <form onSubmit={submit} className="space-y-3">
      <label className="block">{t("auth.initialAdmin.userId")}<input required disabled={busy} maxLength={64} pattern="[A-Za-z0-9_-]+"
        value={id} onChange={e => setId(e.target.value)} className="block w-full border p-2" /></label>
      <label className="block">{t("auth.fullName")}<input required disabled={busy} maxLength={100}
        value={name} onChange={e => setName(e.target.value)} className="block w-full border p-2" /></label>
      <button disabled={busy} className="bg-kmx-carbon px-4 py-2 text-white">{busy ? t("common.creating") : t("auth.initialAdmin.submit")}</button>
    </form>}
  </div>;
}
