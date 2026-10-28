import { useEffect, useState, type FormEvent } from "react";
import { listLoginUsers, login, logout, type LoginChoice, type SessionUser } from "../lib/api";
import { PasswordChangeForm } from "./auth/PasswordChangeForm";
import { RecoveryForm } from "./auth/RecoveryForm";

export function Login() {
  const [users, setUsers] = useState<LoginChoice[]>([]);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    listLoginUsers().then(items => {
      if (active) { setUsers(items); setUserId(items[0]?.id ?? ""); }
    }).catch(e => { if (active) setError(String(e)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try { setUser(await login(userId, pin)); }
    catch (e) { setError(String(e)); }
    finally { setPin(""); setBusy(false); }
  }

  async function exit() {
    setBusy(true);
    setError("");
    try { await logout(); setUser(null); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  return <section className="mt-5 rounded-sm border border-kmx-gray-300 bg-white p-5" aria-labelledby="login-title">
    <h2 id="login-title" className="mb-4 font-bold">Acceso a EasyFAB</h2>
    {notice && <p role="status" className="mb-3">{notice}</p>}
    {error && <p role="alert" className="mb-3 text-kmx-red">{error}</p>}
    {user ? <div className="space-y-4">
      <p>Sesión de {user.name} · {({ admin: "Administrador", supervisor: "Supervisor", engineer: "Ingeniero" })[user.role]}</p>
      {user.must_change_password
        ? <PasswordChangeForm onChanged={() => {
          setUser(null);
          setNotice("Contraseña actualizada. Ingresa con tu nueva contraseña.");
        }} />
        : <>
          <p className="text-sm">Acceso normal verificado. Las vistas de trabajo se incorporan en la fase 3.</p>
          {user.role === "admin" && <RecoveryForm users={users} />}
        </>}
      <button disabled={busy} onClick={exit} className="border px-4 py-2">Cerrar sesión</button>
    </div> : <form onSubmit={submit} className="space-y-4">
      {busy && <p role="status">Verificando…</p>}
      {!busy && !users.length && !error && <p>El directorio no contiene usuarios habilitados. Solicita al administrador el alta y la provisión de confianza del equipo.</p>}
      <label className="block">Usuario
        <select className="mt-1 block w-full border p-2" value={userId} required
          onChange={e => setUserId(e.target.value)} disabled={busy || !users.length}>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      <label className="block">Contraseña (8 caracteres)
        <input className="mt-1 block w-full border p-2" type="password" autoComplete="current-password"
          value={pin} minLength={8} maxLength={8} onChange={e => setPin(e.target.value)}
          disabled={busy || !users.length} required />
      </label>
      <button className="bg-kmx-carbon px-5 py-2 font-bold text-white disabled:opacity-50"
        disabled={busy || !userId || !pin}>Ingresar</button>
    </form>}
  </section>;
}
