import { Projects } from "../features/projects/Projects";
import { PlantCatalog } from "../features/settings/PlantCatalog";
import { Incidents } from "../features/incidents/Incidents";
import { Preferences } from "../features/settings/Preferences";
import { WeeklyReport } from "../features/home/WeeklyReport";
import type { Destination } from "./WorkspaceMenu";
import { InitialAdminForm } from "./auth/InitialAdminForm";
import { useEffect, useImperativeHandle, useState, type FormEvent, type Ref } from "react";
import { listLoginUsers, login, logout, type LoginChoice, type SessionUser } from "../lib/api";
import { PasswordChangeForm } from "./auth/PasswordChangeForm";
import { UserDirectory } from "./auth/UserDirectory";

export interface LoginHandle { logout: () => Promise<void> }
interface LoginProps {
  onSessionChange?: (user: SessionUser | null) => void;
  onBusyChange?: (busy: boolean) => void;
  headerInTopNav?: boolean;
  ref?: Ref<LoginHandle>;
  destination?: Destination;
}
export function Login({ onSessionChange, onBusyChange, headerInTopNav = false, ref, destination }: LoginProps) {
  const [requiresAdmin, setRequiresAdmin] = useState(false);
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
      if (active) { setUsers(items.users); setUserId(items.users[0]?.id ?? ""); setRequiresAdmin(items.requires_admin); }
    }).catch(e => { if (active) setError(String(e)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try { const authenticated = await login(userId, pin); setUser(authenticated); onSessionChange?.(authenticated); }
    catch (e) { setError(String(e)); }
    finally { setPin(""); setBusy(false); }
  }

  async function exit() {
    setBusy(true);
    setError("");
    try {
      await logout(); setUser(null); onSessionChange?.(null);
      const choices = await listLoginUsers();
      setUsers(choices.users); setUserId(choices.users[0]?.id ?? ""); setRequiresAdmin(choices.requires_admin);
    }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  useImperativeHandle(ref, () => ({ logout: exit }));
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  return <section hidden={!user && destination !== undefined && destination !== "home"} className={`rounded-sm border border-kmx-gray-300 bg-surface p-5 ${!user ? "mx-auto w-full max-w-md" : ""}`} aria-labelledby={user && headerInTopNav ? undefined : "login-title"} aria-label={user && headerInTopNav ? "Área de trabajo" : undefined}>
    {!(user && headerInTopNav) && <h2 id="login-title" className="mb-4 font-bold">Acceso a EasyFAB</h2>}
    {notice && <p role="status" className="mb-3">{notice}</p>}
    {error && <p role="alert" className="mb-3 text-kmx-red">{error}</p>}
    {user ? <div className="space-y-4">
      {!headerInTopNav && <><p>Sesión de {user.name} · {({ admin: "Administrador", supervisor: "Supervisor", engineer: "Ingeniero" })[user.role]}</p>
      <p className="text-sm">Usuario EasyFAB: {user.id}</p></>}
      {user.must_change_password
        ? <PasswordChangeForm onChanged={() => {
          setUser(null); onSessionChange?.(null);
          setNotice("Contraseña actualizada. Ingresa con tu nueva contraseña.");
        }} />
        : <>
          {user.role === "admin" && <div hidden={destination !== undefined && destination !== "users"}><UserDirectory /></div>}
          <div hidden={destination !== undefined && destination !== "projects"}><Projects /></div>
          {user.role === "admin" && <div hidden={destination !== undefined && destination !== "catalogs"}><PlantCatalog /></div>}
          {destination === "incidents" && <Incidents />}
          <Preferences key={user.id} visible={destination === "settings"} />
          {destination === "home" && user.role !== "engineer" && <WeeklyReport />}
          {destination === "home" && user.role === "engineer" && <p className="empty-state">Abre Proyectos desde el menú para consultar tus asignaciones y registrar el trabajo diario.</p>}
        </>}
      {!headerInTopNav && <button disabled={busy} onClick={exit} className="border px-4 py-2">Cerrar sesión</button>}
    </div> : !busy && requiresAdmin && !error ? <InitialAdminForm onReady={async () => {
      const choices=await listLoginUsers(); setUsers(choices.users); setUserId(choices.users[0]?.id ?? ""); setRequiresAdmin(choices.requires_admin);
    }} /> : <form onSubmit={submit} className="space-y-4">
      {busy && <p role="status">Verificando…</p>}
      {!busy && !users.length && !requiresAdmin && !error && <p>No hay usuarios habilitados. Solicita al administrador revisar el acceso.</p>}
      <label className="block">Usuario
        <select className="mt-1 block w-full border p-2" value={userId} required
          onChange={e => setUserId(e.target.value)} disabled={busy || !users.length}>
          {users.map(u => <option key={u.id} value={u.id}>{u.name} · {u.id}</option>)}
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

