import { KawasakiLogo } from "./components/branding/KawasakiLogo";
import { WorkspaceSetup } from "./components/WorkspaceSetup";

export default function App() {
  return <div className="flex min-h-full flex-col">
    <header className="flex items-center gap-4 border-b-2 border-kmx-lime bg-kmx-carbon px-4 py-2 text-white">
      <KawasakiLogo className="h-8 w-auto" theme="dark" />
      <div className="h-6 w-px bg-kmx-border-dark" />
      <h1 className="text-sm font-extrabold uppercase tracking-wider">Easy<span className="text-kmx-lime">FAB</span></h1>
      <span className="ml-auto font-mono text-xs text-kmx-gray-300">10.FAB · Fabrication</span>
    </header>
    <main className="mx-auto w-full max-w-3xl flex-1 p-6"><WorkspaceSetup /></main>
  </div>;
}
