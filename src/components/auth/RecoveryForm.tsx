import { useState, type FormEvent } from "react";
import { resetPassword, type LoginChoice } from "../../lib/api";

export function RecoveryForm({ users }: { users: LoginChoice[] }) {
  const [target, setTarget] = useState("");
  const [temporary, setTemporary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setTemporary("");
    try {
      setTemporary(await resetPassword(target));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-3 border-t pt-4">
    <label className="block">Recuperación: usuario
      <select required disabled={busy} value={target} className="block w-full border p-2"
        onChange={e => { setTarget(e.target.value); setTemporary(""); }}>
        <option value="">Selecciona usuario</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </label>
    <p className="text-sm">La temporal vence en 24 horas. La revocación del acceso anterior depende de la sincronización de OneDrive. Entrégala al titular por el canal corporativo autorizado.</p>
    {error && <p role="alert" className="text-kmx-red">{error}</p>}
    <button disabled={busy || !target} className="border px-4 py-2">
      {busy ? "Generando…" : "Emitir contraseña temporal"}
    </button>
    {temporary && <div role="status">
      <p>Temporal generada. Se muestra solo en esta sesión:</p>
      <output className="block font-mono">{temporary}</output>
      <button type="button" className="border px-3 py-1" onClick={() => setTemporary("")}>Ocultar temporal</button>
    </div>}
  </form>;
}
