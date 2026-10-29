import { useEffect, useRef, useState, type FormEvent } from "react";
import { workspaceStatus, configureWorkspace, runningInTauri, type SessionUser, type WorkspaceInfo } from "../lib/api";
import { Login, type LoginHandle } from "./Login";
import { TopNav } from "./TopNav";
import { WorkspaceMenu, type Destination } from "./WorkspaceMenu";

export function WorkspaceSetup() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [root, setRoot] = useState("");
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const loginRef = useRef<LoginHandle>(null);
  const signedIn = session !== null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [destination, setDestination] = useState<Destination>("home");
  const heading = useRef<HTMLHeadingElement>(null);
  function navigate(next: Destination) { setDestination(next); requestAnimationFrame(() => heading.current?.focus()); }
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    workspaceStatus().then(status => {
      if (!active) return;
      setWorkspace(status.workspace);
      setRoot(status.workspace?.root ?? status.candidate_root ?? "");
      setError(status.message ?? "");
      if (!status.workspace) setDestination("settings");
    }).catch(e => {
      if (active) { setError(String(e)); setDestination("settings"); }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || signedIn) return;
    setBusy(true); setError("");
    try {
      const selected = await configureWorkspace(root);
      setWorkspace(selected); setRoot(selected.root); setEditing(false); setSettingsOpen(false); setDestination("home");
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  return <div className="flex min-h-full flex-col">
    <TopNav user={session} logoutDisabled={sessionBusy} onLogout={() => { void loginRef.current?.logout(); }} settings={<WorkspaceMenu open={settingsOpen} onOpenChange={setSettingsOpen} destination={destination} onNavigate={navigate} projectsAvailable={!!session && !session.must_change_password}>
    </WorkspaceMenu>} />
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <h2 ref={heading} tabIndex={-1} className="mb-4 font-bold outline-none">{destination === "settings" ? "Configuración" : destination === "projects" ? "Proyectos" : "Inicio"}</h2>
      <div hidden={destination !== "settings"}>
      <section className="space-y-4" aria-labelledby="workspace-title">
        <h3 id="workspace-title" className="font-bold">Carpeta activa</h3>
        {busy && <p role="status">Verificando el espacio…</p>}
        {error && <p role="alert" className="text-kmx-red">{error}</p>}
        {workspace && !editing ? <>
          <p className="flex items-center gap-2 text-sm font-bold"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-kmx-lime" />Espacio listo</p>
          <dl className="space-y-2 text-sm">
            <div><dt className="font-bold">Carpeta compartida</dt><dd className="mt-1 break-all rounded-sm bg-kmx-gray-50 p-3 font-mono text-xs">{workspace.root}</dd></div>
          </dl>
          <details className="text-sm">
            <summary className="cursor-pointer font-bold">Ubicaciones del espacio</summary>
            <dl className="mt-3 space-y-3">
              {([
                ["Espacio del sistema", workspace.path], ["Datos", workspace.data_dir],
                ["Documentación", workspace.docs_dir], ["Ejecutable portable", workspace.executable],
              ] as const).map(([label, path]) => <div key={label}><dt className="font-bold">{label}</dt><dd className="break-all font-mono text-xs">{path}</dd></div>)}
            </dl>
          </details>
          <button disabled={signedIn || busy} className="border px-3 py-2 disabled:opacity-50" onClick={() => setEditing(true)}>Cambiar carpeta compartida</button>
          {signedIn && <p className="text-sm">Cierra sesión para cambiar de espacio.</p>}
        </> : <form onSubmit={submit} className="space-y-3">
          <p className="text-sm">Selecciona la carpeta compartida del área para comenzar.</p>
          <label className="block text-sm font-bold">Carpeta compartida corporativa
            <input required disabled={busy || signedIn || !runningInTauri()} value={root} onChange={e => setRoot(e.target.value)}
              placeholder="C:\...\ENGINEERING FILES - 10.FAB" className="mt-1 block w-full border p-2 font-normal" />
          </label>
          <p className="text-sm">Abre un espacio existente o crea uno nuevo. Cambiar la ubicación conecta otro espacio; no traslada ni mezcla sus datos.</p>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy || signedIn || !root.trim() || !runningInTauri()} className="bg-kmx-carbon px-4 py-2 text-sm text-white disabled:opacity-50">Crear o abrir espacio</button>
            {workspace && <button type="button" disabled={busy} onClick={() => { setEditing(false); setRoot(workspace.root); setError(""); }} className="border px-3 py-2 text-sm">Cancelar</button>}
          </div>
        </form>}
      </section>
      </div>
      {workspace && !editing ? <Login key={workspace.id} ref={loginRef} headerInTopNav destination={destination} onSessionChange={user => { setSession(user); setDestination("home"); }} onBusyChange={setSessionBusy} /> : <section className="py-10 text-center">
        <h2 className="font-bold">Espacio de trabajo EasyFAB</h2>
        <p role={busy ? "status" : undefined} className="mt-2 text-sm text-kmx-gray-600">{busy ? "Verificando el espacio…" : editing ? "Selecciona la carpeta desde Configuración." : "Configura la carpeta compartida para ingresar."}</p>
        <button type="button" className="mt-4 border px-4 py-2 text-sm" onClick={() => navigate("settings")}>Abrir configuración</button>
      </section>}
    </main>
  </div>;
}
