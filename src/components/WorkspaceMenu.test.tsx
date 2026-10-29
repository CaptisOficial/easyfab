// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { WorkspaceMenu, type Destination } from "./WorkspaceMenu";
afterEach(cleanup);
function Harness({ projects = true }: { projects?: boolean }) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<Destination>("home");
  return <div><header><WorkspaceMenu open={open} onOpenChange={setOpen} destination={destination} onNavigate={setDestination} projectsAvailable={projects} /></header><main><h2>{destination}</h2><input aria-label="Borrador" /></main></div>;
}
it("contiene el foco, bloquea el fondo y restaura foco y captura al descartar", async () => {
 const user = userEvent.setup(); const { container } = render(<Harness />);
 const draft = screen.getByLabelText("Borrador") as HTMLInputElement;
 await user.type(draft, "avance pendiente");
 const trigger = screen.getByRole("button", { name: "Abrir menú" });
 await user.click(trigger);
 const panel = screen.getByRole("dialog");
 expect(panel.getAttribute("aria-modal")).toBe("true");
 expect(container.firstElementChild!.hasAttribute("inert")).toBe(true);
 await user.tab({ shift: true });
 expect(document.activeElement).toBe(screen.getByRole("button", { name: "Configuración" }));
 await user.tab();
 expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar menú" }));
 await user.click(screen.getByRole("button", { name: "Cerrar menú" }));
 expect(document.activeElement).toBe(trigger);
 expect(draft.value).toBe("avance pendiente");
 expect(container.firstElementChild!.hasAttribute("inert")).toBe(false);
 await user.click(trigger); await user.click(screen.getByRole("dialog").parentElement!);
 expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
});
it("cierra al elegir destino y distingue activo de previsto sin habilitar funciones pendientes", async () => {
 const user = userEvent.setup(); render(<Harness />);
 await user.click(screen.getByRole("button", { name: "Abrir menú" }));
 expect(screen.getByRole("button", { name: "Inicio" }).getAttribute("aria-current")).toBe("page");
 expect(screen.queryByRole("button", { name: /Problemas de línea/ })).toBeNull();
 await user.click(screen.getByRole("button", { name: "Proyectos" }));
 expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.getByRole("heading").textContent).toBe("projects");
 await user.click(screen.getByRole("button", { name: "Abrir menú" }));
 expect(screen.getByRole("button", { name: "Proyectos" }).getAttribute("aria-current")).toBe("page");
 await user.keyboard("{Escape}");
 await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Abrir menú" })));
});
it("omite proyectos cuando la sesión no tiene acceso", async () => {
 const user = userEvent.setup(); render(<Harness projects={false} />);
 await user.click(screen.getByRole("button", { name: "Abrir menú" }));
 expect(screen.queryByRole("button", { name: "Proyectos" })).toBeNull();
 expect(screen.getByRole("button", { name: "Configuración" })).toBeTruthy();
});
