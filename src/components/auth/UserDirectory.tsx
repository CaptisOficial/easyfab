import { useEffect, useState } from "react";
import { listUsers, setUserActive, type DirectoryUser } from "../../lib/api";
import { NewUserForm } from "./NewUserForm";
import { RecoveryForm } from "./RecoveryForm";

const roleNames = { admin: "Administrador", engineer: "Ingeniero", supervisor: "Supervisor" };

export function UserDirectory() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [temporary, setTemporary] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() { setUsers(await listUsers()); }
  useEffect(() => {
    let active = true;
    listUsers().then(items => { if (active) setUsers(items); })
      .catch(e => { if (active) setError(String(e)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function changeStatus(user: DirectoryUser) {
    setBusy(true); setError(""); setTemporary(""); setNotice("");
    try {
      const active = user.status === "inactive";
      setTemporary(await setUserActive(user.id, active) ?? "");
      setNotice(`${user.name}: cuenta ${active ? "activada; entrega la nueva temporal" : "desactivada"}.`);
      setConfirmation("");
      await refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  return <section className="space-y-4 border-t pt-4" aria-labelledby="directory-title">
    <h2 id="directory-title" className="font-bold">Gestión de usuarios</h2>
    {busy && <p role="status">Actualizando directorio…</p>}
    {error && <p role="alert" className="text-kmx-red">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {temporary && <div><p>Temporal válida 24 horas:</p><output className="font-mono">{temporary}</output>
      <button type="button" onClick={() => setTemporary("")} className="ml-3 border px-3 py-1">Ocultar temporal</button></div>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Directorio de usuarios y estado de acceso</caption>
      <thead><tr>{["Nombre / ID", "Rol", "Estado", "Acción"].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
      <tbody>{users.map(user => <tr key={user.id} className="border-t">
        <th scope="row" className="p-2 font-normal">{user.name}<span className="block text-xs">{user.id}</span></th>
        <td className="p-2">{roleNames[user.role]}</td>
        <td className="p-2">{user.status === "active" ? "Activo" : "Inactivo"}</td>
        <td className="p-2">{user.role === "admin" ? "Cuenta protegida" : confirmation === user.id
          ? <><p>¿Desactivar a {user.name}?</p><button disabled={busy} onClick={() => changeStatus(user)} className="border p-1">Confirmar</button>
            <button disabled={busy} onClick={() => setConfirmation("")} className="ml-2 border p-1">Cancelar</button></>
          : <button disabled={busy} className="border p-1" onClick={() => user.status === "active" ? setConfirmation(user.id) : changeStatus(user)}>
            {user.status === "active" ? "Desactivar" : "Activar y generar temporal"}</button>}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="text-sm">Desactivar conserva el historial. Reactivar exige nueva contraseña. Los cambios de acceso llegan a otros equipos al sincronizar OneDrive.</p>
    <NewUserForm onCreated={refresh} />
    <RecoveryForm users={users.filter(user => user.status === "active")} />
  </section>;
}
