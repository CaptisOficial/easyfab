import { useEffect, useState, type FormEvent } from "react";
import { workspaceStatus, configureWorkspace, runningInTauri, type WorkspaceInfo } from "../lib/api";
import { Login } from "./Login";

export function WorkspaceSetup() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [root, setRoot] = useState("");
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    workspaceStatus().then(status => {
      if (!active) return;
      setWorkspace(status.workspace); setRoot(status.candidate_root ?? "");
      setError(status.message ?? "");
    }).catch(e => { if (active) setError(String(e)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { setWorkspace(await configureWorkspace(root)); setEditing(false); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  return <>
    <section className="space-y-4 rounded-sm border border-kmx-gray-300 bg-white p-5" aria-labelledby="workspace-title">
      <h2 id="workspace-title" className="font-bold">Espacio de trabajo EasyFAB</h2>
      {busy && <p role="status">Verificando el espacio…</p>}
      {error && <p role="alert" className="text-kmx-red">{error}</p>}
      {workspace && !editing ? <>
        <p className="font-bold">Espacio listo</p>
        <dl className="space-y-3 text-sm">
          {([
            ["Carpeta compartida", workspace.root], ["Espacio del sistema", workspace.path],
            ["Datos", workspace.data_dir], ["Documentación", workspace.docs_dir],
            ["Ejecutable portable", workspace.executable],
          ] as const).map(([label, path]) => <div key={label}><dt className="font-bold">{label}</dt><dd className="break-all font-mono text-xs">{path}</dd></div>)}
        </dl>
        <button disabled={signedIn || busy} className="border px-3 py-2 disabled:opacity-50" onClick={() => setEditing(true)}>Cambiar carpeta compartida</button>
        {signedIn && <p className="text-sm">Cierra sesión para cambiar de espacio.</p>}
      </> : <form onSubmit={submit} className="space-y-3">
        <p>Elige la carpeta compartida del área. EasyFAB organizará sus datos, documentación, reportes, respaldos y portable dentro de ella.</p>
        <label className="block font-bold">Carpeta compartida corporativa
          <input required disabled={busy || !runningInTauri()} value={root} onChange={e => setRoot(e.target.value)}
            placeholder="C:\...\ENGINEERING FILES - 10.FAB" className="mt-1 block w-full border p-2 font-normal" />
        </label>
        <p className="text-sm">Abre un espacio existente o crea uno nuevo. Cambiar la ubicación conecta otro espacio; no traslada ni mezcla sus datos.</p>
        <button disabled={busy || !root.trim() || !runningInTauri()} className="bg-kmx-carbon px-4 py-2 text-white disabled:opacity-50">Crear o abrir espacio</button>
        {workspace && <button type="button" disabled={busy} onClick={() => { setEditing(false); setRoot(workspace.root); }} className="ml-3 border px-3 py-2">Cancelar</button>}
      </form>}
    </section>
    {workspace && !editing && <Login key={workspace.id} onSessionChange={setSignedIn} />}
  </>;
}
