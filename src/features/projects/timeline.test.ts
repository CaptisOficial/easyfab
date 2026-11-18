import { expect, it } from "vitest";
import { movePeriod, overlaps, periodRange } from "./timeline";

it("encuadra semanas de lunes a domingo incluso entre años", () => {
  const range = periodRange("2027-01-01", "week");
  expect([range.start, range.end, range.columns.length]).toEqual(["2026-12-28", "2027-01-03", 7]);
});
it("incluye febrero bisiesto y los doce meses del año", () => {
  expect(periodRange("2028-02-29", "month").columns).toHaveLength(29);
  const range = periodRange("2028-02-29", "year");
  expect(range.columns).toHaveLength(12);
  expect(range.columns[1].end).toBe("2028-02-29");
  expect(range.end).toBe("2028-12-31");
});
it("navega meses sin saltar febrero desde el día 31", () => {
  expect(movePeriod("2026-01-31", "month", 1)).toBe("2026-02-01");
  expect(movePeriod("2026-12-31", "year", 1)).toBe("2027-01-01");
});
it("incluye extremos, proyectos de un día y planes que atraviesan el periodo", () => {
  expect(overlaps("2026-10-29", "2026-10-29", "2026-10-29", "2026-10-29")).toBe(true);
  expect(overlaps("2025-01-01", "2027-01-01", "2026-10-01", "2026-10-31")).toBe(true);
  expect(overlaps("2026-11-01", "2026-11-02", "2026-10-01", "2026-10-31")).toBe(false);
});
it("formatea etiquetas de columnas según el locale del idioma", () => {
  const esYear = periodRange("2026-01-15", "year", "es-MX");
  const enYear = periodRange("2026-01-15", "year", "en-US");
  expect(esYear.columns[0].label.toLowerCase()).toContain("ene");
  expect(enYear.columns[0].label.toLowerCase()).toContain("jan");
});
