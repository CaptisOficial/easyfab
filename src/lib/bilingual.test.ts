import { describe, expect, it } from "vitest";
import { formatBilingual, parseBilingual, pickBilingual } from "./bilingual";

describe("bilingual", () => {
  it("parses Spanish-only legacy text with empty English fallback", () => {
    expect(parseBilingual("Soporte de soldadura A/B")).toEqual({
      es: "Soporte de soldadura A/B",
      en: "",
    });
    expect(pickBilingual("Soporte de soldadura A/B", "es")).toBe("Soporte de soldadura A/B");
    expect(pickBilingual("Soporte de soldadura A/B", "en")).toBe("Soporte de soldadura A/B");
  });

  it("parses and selects Spanish first, English second with ' | '", () => {
    const raw = "Diseño de herramental | Tooling design";
    expect(parseBilingual(raw)).toEqual({
      es: "Diseño de herramental",
      en: "Tooling design",
    });
    expect(pickBilingual(raw, "es")).toBe("Diseño de herramental");
    expect(pickBilingual(raw, "en")).toBe("Tooling design");
  });

  it("falls back to Spanish in English mode when English side is blank", () => {
    expect(pickBilingual("Diseño de herramental |   ", "en")).toBe("Diseño de herramental");
  });

  it("formats Spanish and optional English cleanly", () => {
    expect(formatBilingual("  Diseño ", " Design ")).toBe("Diseño | Design");
    expect(formatBilingual("  Diseño ", "")).toBe("Diseño");
  });
});
