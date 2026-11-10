import { useId, useRef, useState, type FormEvent } from "react";
import { resetPassword, type LoginChoice } from "../../lib/api";

export function RecoveryForm({ user }: { user: LoginChoice }) {
  const [open, setOpen] = useState(false);
  const sending = useRef(false);
  const id = useId();
  const [temporary, setTemporary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setTemporary("");
    try {
      setTemporary(await resetPassword(user.id));
    } catch (e) {
      setError(String(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <div>
    <button type="button" disabled={busy} aria-expanded={open} aria-controls={open ? id : undefined} className="border px-3 py-1" onClick={() => { setOpen(!open); setTemporary(""); setError(""); }}>Recuperar contraseña</button>
    {open && <form id={id} aria-label={`Recuperar contraseña de ${user.name}`} onSubmit={submit} className="mt-2 space-y-3 border p-3">
    <p>Generar una contraseña temporal para {user.name} ({user.id}).</p>
    <p className="text-sm">La temporal vence en 24 horas. La revocación del acceso anterior depende de la sincronización de OneDrive. Entrégala al titular por el canal corporativo autorizado.</p>
    {error && <p role="alert" className="text-kmx-red">{error}</p>}
    <button disabled={busy} className="border px-4 py-2">
      {busy ? "Generando…" : "Emitir contraseña temporal"}
    </button>
    {temporary && <div role="status">
      <p>Temporal generada. Se muestra solo en esta sesión:</p>
      <output className="block font-mono">{temporary}</output>
      <button type="button" className="border px-3 py-1" onClick={() => setTemporary("")}>Ocultar temporal</button>
    </div>}
  </form>}</div>;
}
