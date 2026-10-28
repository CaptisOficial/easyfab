import { useState, type FormEvent } from "react";
import { createUser, type NewUser } from "../../lib/api";

const emptyUser: NewUser = { id: "", name: "", role: "engineer" };

export function NewUserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [input, setInput] = useState<NewUser>(emptyUser);
  const [temporary, setTemporary] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setTemporary("");
    try {
      setTemporary(await createUser(input));
      setCreatedId(input.id.trim());
      setInput(emptyUser);
      await onCreated();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="space-y-3 border-t pt-4">
    <h3 className="font-bold">Crear usuario</h3>
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
      <label>ID de usuario<input required maxLength={64} pattern="[A-Za-z0-9_-]+"
        value={input.id} onChange={e => setInput({ ...input, id: e.target.value })}
        className="block w-full border p-2" /></label>
      <label>Nombre completo<input required maxLength={100} value={input.name}
        onChange={e => setInput({ ...input, name: e.target.value })} className="block w-full border p-2" /></label>
      <label>Rol<select value={input.role} className="block w-full border p-2"
        onChange={e => setInput({ ...input, role: e.target.value as NewUser["role"] })}>
        <option value="engineer">Ingeniero</option><option value="supervisor">Supervisor</option>
      </select></label>
    </fieldset>
    <p className="text-sm">El usuario y la contraseña de EasyFAB permiten acceder desde los equipos habilitados del área.</p>
    {error && <p role="alert" className="text-kmx-red">{error}</p>}
    <button disabled={busy} className="bg-kmx-carbon px-4 py-2 text-white">{busy ? "Creando…" : "Crear y generar temporal"}</button>
    {temporary && <div role="status">
      <p>Usuario creado: {createdId}. Temporal de 8 caracteres, válida 24 horas:</p>
      <output className="block font-mono">{temporary}</output>
      <p className="text-sm">Entrégala al titular por el canal corporativo autorizado. Deberá cambiarla al ingresar.</p>
      <p className="text-sm">Para probar el acceso: guarda la temporal, cierra tu sesión de Admin y elige este usuario. Después de cambiar la contraseña, vuelve a ingresar con la nueva.</p>
      <button type="button" onClick={() => setTemporary("")} className="border px-3 py-1">Ocultar temporal</button>
    </div>}
  </form>;
}
