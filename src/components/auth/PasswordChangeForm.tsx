import { useState, type FormEvent } from "react";
import { changePassword } from "../../lib/api";

export function PasswordChangeForm({ onChanged }: { onChanged: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePassword(password);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setPassword("");
      setConfirmation("");
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-3">
    <p role="status">Cambia tu contraseña temporal para acceder al sistema.</p>
    {error && <p role="alert" className="text-kmx-red">{error}</p>}
    <label className="block">Nueva contraseña (8 caracteres)
      <input type="password" autoComplete="new-password" minLength={8} maxLength={8}
        required disabled={busy} value={password} onChange={e => setPassword(e.target.value)}
        className="block w-full border p-2" />
    </label>
    <label className="block">Confirmar contraseña
      <input type="password" autoComplete="new-password" minLength={8} maxLength={8}
        required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)}
        className="block w-full border p-2" />
    </label>
    <button disabled={busy} className="bg-kmx-carbon px-4 py-2 text-white">
      {busy ? "Guardando…" : "Guardar y volver a ingresar"}
    </button>
  </form>;
}
