// Development-only native harness. Real Tauri IPC; never bundled as the application entry.
import { createRoot } from "react-dom/client";
import { ResultsWork } from "../src/features/projects/ResultsWork";
import "../src/index.css";
const query = new URLSearchParams(location.search);
const projectId = query.get("projectId");
if (!projectId) throw new Error("Falta el proyecto sintético.");
createRoot(document.getElementById("root")!).render(<main className="p-4 space-y-4">
  <header><h1 className="font-bold">EasyFAB · Piloto sintético · {query.get("role")}</h1><p>Datos aislados de pruebas. La ventana utiliza los servicios y permisos reales de Rust.</p><div className="flex gap-2"><button className="action" onClick={() => { document.documentElement.dataset.theme = "light"; }}>Vista clara de QA</button><button className="action" onClick={() => { document.documentElement.dataset.theme = "dark"; }}>Vista oscura de QA</button></div></header>
  <ResultsWork projectId={projectId} onBack={() => location.reload()} />
</main>);
