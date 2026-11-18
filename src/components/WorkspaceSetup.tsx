import { useEffect, useRef, useState, type FormEvent } from "react";
import { workspaceStatus, configureWorkspace, runningInTauri, type SessionUser, type WorkspaceInfo } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { Login, type LoginHandle } from "./Login";
import { TopNav } from "./TopNav";
import { WorkspaceMenu, type Destination } from "./WorkspaceMenu";

export function WorkspaceSetup() {
  const { t, tError } = useI18n();
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
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    workspaceStatus().then(status => {
      if (!active) return;
      setWorkspace(status.workspace);
      setRoot(status.workspace?.root ?? status.candidate_root ?? "");
      setError(status.message ?? null);
      if (!status.workspace) setDestination("settings");
    }).catch(e => {
      if (active) { setError(e); setDestination("settings"); }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || signedIn) return;
    setBusy(true); setError(null);
    try {
      const selected = await configureWorkspace(root);
      setWorkspace(selected); setRoot(selected.root); setEditing(false); setSettingsOpen(false); setDestination("home");
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }

  const errorText = error !== null && error !== "" ? tError(error) : "";

  return <div className="flex min-h-full flex-col">
    <TopNav pageTitle={destination === "users" ? t("nav.users") : destination === "catalogs" ? t("nav.catalogs") : destination === "settings" ? t("nav.settings") : destination === "projects" ? t("nav.projects") : destination === "incidents" ? t("nav.incidents") : t("nav.home")} headingRef={heading} user={session} logoutDisabled={sessionBusy} onLogout={() => { void loginRef.current?.logout(); }} settings={<WorkspaceMenu open={settingsOpen} onOpenChange={setSettingsOpen} destination={destination} onNavigate={navigate} adminAvailable={session?.role === "admin" && !session.must_change_password} projectsAvailable={!!session && !session.must_change_password}>
    </WorkspaceMenu>} />
    <main className={`mx-auto min-w-0 w-full flex-1 p-3 sm:p-4 ${workspace && !editing && !signedIn && destination === "home" ? "flex flex-col justify-center" : ""} ${destination === "projects" ? "max-w-none" : "max-w-6xl"}`}>
      <div hidden={destination !== "settings"}>
      <section className="space-y-4" aria-labelledby="workspace-title">
        <h3 id="workspace-title" className="font-bold">{t("workspace.activeFolder")}</h3>
        {busy && <p role="status">{t("workspace.checking")}</p>}
        {errorText && <p role="alert" className="text-kmx-red">{errorText}</p>}
        {workspace && !editing ? <>
          <p className="flex items-center gap-2 text-sm font-bold"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-kmx-lime" />{t("workspace.ready")}</p>
          <dl className="space-y-2 text-sm">
            <div><dt className="font-bold">{t("workspace.sharedFolder")}</dt><dd className="mt-1 break-all rounded-sm bg-kmx-gray-50 p-3 font-mono text-xs">{workspace.root}</dd></div>
          </dl>
          <details className="text-sm">
            <summary className="cursor-pointer font-bold">{t("workspace.locations")}</summary>
            <dl className="mt-3 space-y-3">
              {([
                ["system", t("workspace.systemPath"), workspace.path], ["data", t("workspace.dataDir"), workspace.data_dir],
                ["docs", t("workspace.docsDir"), workspace.docs_dir], ["executable", t("workspace.portableExecutable"), workspace.executable],
              ] as const).map(([key, label, path]) => <div key={key}><dt className="font-bold">{label}</dt><dd className="break-all font-mono text-xs">{path}</dd></div>)}
            </dl>
          </details>
          <button disabled={signedIn || busy} className="border px-3 py-2 disabled:opacity-50" onClick={() => setEditing(true)}>{t("workspace.changeFolder")}</button>
          {signedIn && <p className="text-sm">{t("workspace.logoutToChange")}</p>}
        </> : <form onSubmit={submit} className="space-y-3">
          <p className="text-sm">{t("workspace.selectFolderPrompt")}</p>
          <label className="block text-sm font-bold">{t("workspace.corporateFolder")}
            <input required disabled={busy || signedIn || !runningInTauri()} value={root} onChange={e => setRoot(e.target.value)}
              placeholder={t("workspace.folderPlaceholder")} className="mt-1 block w-full border p-2 font-normal" />
          </label>
          <p className="text-sm">{t("workspace.openOrCreateHelp")}</p>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy || signedIn || !root.trim() || !runningInTauri()} className="bg-kmx-carbon px-4 py-2 text-sm text-white disabled:opacity-50">{t("workspace.openOrCreate")}</button>
            {workspace && <button type="button" disabled={busy} onClick={() => { setEditing(false); setRoot(workspace.root); setError(null); }} className="border px-3 py-2 text-sm">{t("common.cancel")}</button>}
          </div>
        </form>}
      </section>
      </div>
      {workspace && !editing ? <Login key={workspace.id} ref={loginRef} headerInTopNav destination={destination} onSessionChange={user => { setSession(user); setDestination("home"); }} onBusyChange={setSessionBusy} /> : <section className="py-10 text-center">
        <h2 className="font-bold">{t("workspace.heading")}</h2>
        <p role={busy ? "status" : undefined} className="mt-2 text-sm text-kmx-gray-600">{busy ? t("workspace.checking") : editing ? t("workspace.selectFromSettings") : t("workspace.configureToEnter")}</p>
        <button type="button" className="mt-4 border px-4 py-2 text-sm" onClick={() => navigate("settings")}>{t("workspace.openSettings")}</button>
      </section>}
    </main>
  </div>;
}
