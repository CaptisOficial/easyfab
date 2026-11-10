// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { TopNav } from "./TopNav";
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("muestra fecha de México y la actualiza al cambiar de día sin recargar", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T05:59:30Z"));
  render(<TopNav user={null} logoutDisabled={false} onLogout={() => {}} settings={<button>Configuración</button>} />);
  const time = screen.getByRole("banner").querySelector("time")!;
  const format = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" });
  expect(time.textContent).toBe(format.format(new Date("2026-10-28T12:00:00Z")));
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(time.textContent).toBe(format.format(new Date("2026-10-29T12:00:00Z")));
  expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
});

it("identifica la página activa en la barra superior y actualiza el encabezado", () => {
  const props = { user: null, logoutDisabled: false, onLogout: () => {}, settings: null };
  const view = render(<TopNav {...props} pageTitle="Inicio" />);
  const header = screen.getByRole("banner");
  expect(header.contains(screen.getByRole("heading", { name: "Inicio" }))).toBe(true);
  view.rerender(<TopNav {...props} pageTitle="Proyectos" />);
  const heading = screen.getByRole("heading", { name: "Proyectos" });
  expect(header.contains(heading)).toBe(true);
  expect(heading.getAttribute("tabindex")).toBe("-1");
  expect(screen.queryByRole("heading", { name: "Inicio" })).toBeNull();
});
