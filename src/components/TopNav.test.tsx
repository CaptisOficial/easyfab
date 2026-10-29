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
