import { Login } from "./components/Login";
import { useEffect, useState } from "react";
import { CheckCircle2, FolderSearch, HardDrive, Loader2, TriangleAlert } from "lucide-react";
import { KawasakiLogo } from "./components/branding/KawasakiLogo";
import {
  bootstrapDataDir,
  detectOneDrivePath,
  runningInTauri,
  type BootstrapReport,
  type OneDriveDetection,
} from "./lib/api";

type Phase = "detecting" | "ready" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("detecting");
  const [detection, setDetection] = useState<OneDriveDetection | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const det = await detectOneDrivePath();
        if (cancelled) return;
        setDetection(det);
        if (det.found) {
          const rep = await bootstrapDataDir();
          if (!cancelled) setBootstrap(rep);
        }
        if (!cancelled) setPhase("ready");
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Command Bar: carbono con línea inferior lima de 2px */}
      <header className="flex items-center gap-4 border-b-2 border-kmx-lime bg-kmx-carbon px-4 py-2 text-white">
        <KawasakiLogo className="h-8 w-auto" theme="dark" />
        <div className="h-6 w-px bg-kmx-border-dark" />
        <h1 className="text-sm font-extrabold uppercase tracking-wider">
          Easy<span className="text-kmx-lime">FAB</span>
        </h1>
        <span className="ml-auto font-mono text-xs text-kmx-gray-300">10.FAB · Fabrication</span>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <section className="rounded-sm border border-kmx-gray-300 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-kmx-gray-600">
            <FolderSearch size={16} /> Conexión con OneDrive corporativo
          </h2>

          {phase === "detecting" && (
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="animate-spin" size={16} /> Buscando ENGINEERING FILES - 10.FAB…
            </p>
          )}

          {phase === "error" && (
            <p className="flex items-start gap-2 rounded-sm bg-kmx-red-tint p-3 text-sm text-kmx-red">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          {phase === "ready" && detection && !detection.found && (
            <div className="rounded-sm bg-kmx-amber-tint p-3 text-sm">
              <p className="flex items-center gap-2 font-bold">
                <TriangleAlert size={16} className="text-kmx-amber" />
                {runningInTauri()
                  ? "No se encontró la carpeta ENGINEERING FILES - 10.FAB."
                  : "Vista previa en navegador: la detección de OneDrive requiere la app de escritorio."}
              </p>
              {detection.candidates_checked.length > 0 && (
                <ul className="mt-2 space-y-0.5 font-mono text-xs text-kmx-gray-600">
                  {detection.candidates_checked.map((c) => (
                    <li key={c}>✗ {c}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {phase === "ready" && detection?.found && (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 rounded-sm bg-kmx-lime-tint p-3 font-bold">
                <CheckCircle2 size={16} className="text-kmx-lime" /> Carpeta detectada
                <span className="ml-auto font-mono text-xs font-normal text-kmx-gray-600">
                  vía {detection.source}
                </span>
              </p>
              <p className="flex items-center gap-2 break-all font-mono text-xs">
                <HardDrive size={14} className="shrink-0" /> {detection.data_dir}
              </p>
              {bootstrap && (
                <table className="w-full text-xs">
                  <tbody>
                    {bootstrap.created.map((f) => (
                      <tr key={f} className="border-t border-kmx-gray-100">
                        <td className="px-3 py-1.5 font-mono">{f}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-kmx-lime">CREADO</td>
                      </tr>
                    ))}
                    {bootstrap.existing.map((f) => (
                      <tr key={f} className="border-t border-kmx-gray-100">
                        <td className="px-3 py-1.5 font-mono">{f}</td>
                        <td className="px-3 py-1.5 text-right text-kmx-gray-600">EXISTENTE</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
        {phase === "ready" && detection?.found && <Login />}
      </main>
    </div>
  );
}
