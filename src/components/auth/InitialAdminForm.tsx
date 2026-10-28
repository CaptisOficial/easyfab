import { useState, type FormEvent } from "react";
import { provisionInitialAdmin } from "../../lib/api";

export function InitialAdminForm({ onReady }: { onReady: () => Promise<void> }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [temporary, setTemporary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { setTemporary(await provisionInitialAdmin(id, name)); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  async function proceed() {
    setBusy(true); setError("");
    try { await onReady(); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <h3 className="font-bold">Crear administrador inicial</h3>
    <p>Este espacio todavía no tiene usuarios. El responsable del área debe crear la primera cuenta.</p>
    {error && <p role="alert" className="text-kmx-red">{error}</p>}
    {temporary ? <div role="status" className="space-y-3">
      <p>Admin creado: {id.trim()}. Guarda esta contraseña temporal; vence en 24 horas:</p>
      <output className="block font-mono">{temporary}</output>
      <p>Ingresa con ella y cámbiala por tu contraseña de 8 caracteres.</p>
      <button disabled={busy} onClick={proceed} className="border px-4 py-2">Continuar al acceso</button>
    </div> : <form onSubmit={submit} className="space-y-3">
      <label className="block">Usuario EasyFAB<input required disabled={busy} maxLength={64} pattern="[A-Za-z0-9_-]+"
        value={id} onChange={e => setId(e.target.value)} className="block w-full border p-2" /></label>
      <label className="block">Nombre completo<input required disabled={busy} maxLength={100}
        value={name} onChange={e => setName(e.target.value)} className="block w-full border p-2" /></label>
      <button disabled={busy} className="bg-kmx-carbon px-4 py-2 text-white">{busy ? "Creando…" : "Crear administrador"}</button>
    </form>}
  </div>;
}
