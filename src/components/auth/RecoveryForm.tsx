import { useId, useRef, useState, type FormEvent } from "react";
import { resetPassword, type LoginChoice } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

export function RecoveryForm({ user }: { user: LoginChoice }) {
  const { t, tError } = useI18n();
  const [open, setOpen] = useState(false);
  const sending = useRef(false);
  const id = useId();
  const [temporary, setTemporary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setTemporary("");
    try {
      setTemporary(await resetPassword(user.id));
    } catch (e) {
      setError(e);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const errorText = error !== null && error !== "" ? tError(error) : "";

  return <div>
    <button type="button" disabled={busy} aria-expanded={open} aria-controls={open ? id : undefined} className="border px-3 py-1" onClick={() => { setOpen(!open); setTemporary(""); setError(null); }}>{t("auth.recovery.open")}</button>
    {open && <form id={id} aria-label={t("auth.recovery.formLabel", { name: user.name })} onSubmit={submit} className="mt-2 space-y-3 border p-3">
    <p>{t("auth.recovery.prompt", { name: user.name, id: user.id })}</p>
    <p className="text-sm">{t("auth.recovery.help")}</p>
    {errorText && <p role="alert" className="text-kmx-red">{errorText}</p>}
    <button disabled={busy} className="border px-4 py-2">
      {busy ? t("common.generating") : t("auth.recovery.submit")}
    </button>
    {temporary && <div role="status">
      <p>{t("auth.recovery.generated")}</p>
      <output className="block font-mono">{temporary}</output>
      <button type="button" className="border px-3 py-1" onClick={() => setTemporary("")}>{t("common.hideTemporary")}</button>
    </div>}
  </form>}</div>;
}
