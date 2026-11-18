import { useState, type FormEvent } from "react";
import { changePassword } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

type PasswordError = { kind: "mismatch" } | { kind: "ipc"; raw: unknown } | null;

export function PasswordChangeForm({ onChanged }: { onChanged: () => void }) {
  const { t, tError } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PasswordError>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError({ kind: "mismatch" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(password);
      onChanged();
    } catch (e) {
      setError({ kind: "ipc", raw: e });
    } finally {
      setPassword("");
      setConfirmation("");
      setBusy(false);
    }
  }

  const errorText = error === null ? "" : error.kind === "mismatch" ? t("auth.passwordChange.mismatch") : tError(error.raw);

  return <form onSubmit={submit} className="space-y-3">
    <p role="status">{t("auth.passwordChange.prompt")}</p>
    {errorText && <p role="alert" className="text-kmx-red">{errorText}</p>}
    <label className="block">{t("auth.passwordChange.newLabel")}
      <input type="password" autoComplete="new-password" minLength={8} maxLength={8}
        required disabled={busy} value={password} onChange={e => setPassword(e.target.value)}
        className="block w-full border p-2" />
    </label>
    <label className="block">{t("auth.passwordChange.confirmLabel")}
      <input type="password" autoComplete="new-password" minLength={8} maxLength={8}
        required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)}
        className="block w-full border p-2" />
    </label>
    <button disabled={busy} className="bg-kmx-carbon px-4 py-2 text-white">
      {busy ? t("common.saving") : t("auth.passwordChange.submit")}
    </button>
  </form>;
}
