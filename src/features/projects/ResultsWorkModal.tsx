import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ResultsModal({ title, busy, onClose, children, wide = false, closeLabel, hideHeader = false }: { title: string; busy: boolean; onClose: () => void; children: ReactNode; wide?: boolean; closeLabel?: string; hideHeader?: boolean }) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy); busyRef.current = busy;
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = dialog.current?.parentElement;
    const backgrounds = Array.from(document.body.children).filter(element => element !== container) as HTMLElement[];
    const previous = backgrounds.map(element => ({ element, inert: element.inert }));
    backgrounds.forEach(element => { element.inert = true; });
    const first = dialog.current?.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), summary, [tabindex='0']");
    (first ?? dialog.current)?.focus();
    return () => { previous.forEach(({ element, inert }) => { element.inert = inert; }); if (opener?.isConnected) opener.focus(); };
  }, []);
  return createPortal(<div className="results-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busyRef.current) closeRef.current(); }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={hideHeader ? undefined : titleId} aria-label={hideHeader ? title : undefined} className={`results-modal ${wide ? "results-modal-wide" : ""}`} onKeyDown={e => {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); if (!busyRef.current) closeRef.current(); }
      if (e.key === "Tab") {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex='0']") ?? []).filter(element => !element.closest("details:not([open])") || element.tagName === "SUMMARY");
        if (!elements.length) { e.preventDefault(); dialog.current?.focus(); return; }
        const first = elements[0]; const last = elements[elements.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}>
      {!hideHeader && <header className="results-modal-header"><h4 id={titleId}>{title}</h4><button type="button" className="action" aria-label={closeLabel ?? `Cerrar ${title.toLowerCase()}`} disabled={busy} onClick={onClose}>✕</button></header>}
      <div className="results-modal-body">{children}</div>
    </div>
  </div>, document.body);
}
