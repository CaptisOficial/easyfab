import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

export type Destination = "home" | "projects" | "settings";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: Destination;
  onNavigate: (destination: Destination) => void;
  projectsAvailable: boolean;
}
export function WorkspaceMenu({ open, onOpenChange, destination, onNavigate, projectsAvailable }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!open) { if (restoreFocus.current) { restoreFocus.current = false; trigger.current?.focus(); } return; }
    const background = trigger.current?.closest("header")?.parentElement;
    const previouslyInert = background?.hasAttribute("inert");
    background?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); restoreFocus.current = true; onOpenChange(false); }
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
    }
    function containFocus(event: FocusEvent) {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) panel.current?.focus();
    }
    document.addEventListener("keydown", keyboard);
    document.addEventListener("focusin", containFocus);
    return () => { if (!previouslyInert) background?.removeAttribute("inert"); document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keyboard); document.removeEventListener("focusin", containFocus); };
  }, [open, onOpenChange]);
  function dismiss() { restoreFocus.current = true; onOpenChange(false); }
  function navigate(next: Destination) { onNavigate(next); onOpenChange(false); }
  return <>
    <button ref={trigger} type="button" aria-label="Abrir menú" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => onOpenChange(!open)} className="flex h-10 w-10 items-center justify-center border border-kmx-border-dark focus-visible:outline-2 focus-visible:outline-kmx-lime"><Menu aria-hidden="true" size={20} /></button>
    {open && createPortal(<div className="fixed inset-0 z-50 bg-black/60" onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <div ref={panel} id={id} role="dialog" aria-modal="true" aria-label="Menú de EasyFAB" tabIndex={-1}
        className="flex h-dvh w-[min(280px,100vw)] flex-col overflow-y-auto border-r border-kmx-gray-300 bg-white text-kmx-carbon shadow-xl outline-none">
        <div className="flex items-center justify-between border-b border-kmx-gray-300 p-4"><strong>EasyFAB</strong><button type="button" aria-label="Cerrar menú" onClick={dismiss} className="p-2"><X aria-hidden="true" size={20} /></button></div>
        <nav aria-label="Navegación principal" className="space-y-2 p-4">
          <button className="block w-full p-2 text-left aria-[current=page]:border-l-4 aria-[current=page]:border-kmx-lime aria-[current=page]:bg-kmx-gray-100 aria-[current=page]:font-bold" aria-current={destination === "home" ? "page" : undefined} onClick={() => navigate("home")}>Inicio</button>
          {projectsAvailable && <button className="block w-full p-2 text-left aria-[current=page]:border-l-4 aria-[current=page]:border-kmx-lime aria-[current=page]:bg-kmx-gray-100 aria-[current=page]:font-bold" aria-current={destination === "projects" ? "page" : undefined} onClick={() => navigate("projects")}>Proyectos</button>}
          <p className="p-2 text-sm text-kmx-gray-600">Problemas de línea · Próximamente</p>
        </nav>
        <div className="mt-auto border-t border-kmx-gray-300 p-4">
          <button className="w-full p-2 text-left font-bold aria-[current=page]:border-l-4 aria-[current=page]:border-kmx-lime aria-[current=page]:bg-kmx-gray-100" aria-current={destination === "settings" ? "page" : undefined} onClick={() => navigate("settings")}>Configuración</button>
        </div>
      </div>
    </div>, document.body)}
  </>;
}
