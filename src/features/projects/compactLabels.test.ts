import { describe, expect, it } from "vitest";
import { compactArea, durationDays, formatStackedGroup, toInitials } from "./compactLabels";

describe("compactLabels", () => {
  it("convierte nombres completos e IDs a iniciales compactas", () => {
    expect(toInitials("Juan Pérez")).toBe("JP");
    expect(toInitials("María del Carmen López")).toBe("ML");
    expect(toInitials("Engineer Test")).toBe("ET");
    expect(toInitials("eng2")).toBe("ENG2");
    expect(toInitials("alberto")).toBe("ALB");
    expect(toInitials("")).toBe("?");
  });

  it("compacta áreas largas preservando áreas cortas", () => {
    expect(compactArea("FAB")).toBe("FAB");
    expect(compactArea("Chasis")).toBe("Chasis");
    expect(compactArea("Soldadura de Cuadros")).toBe("SC");
    expect(compactArea("Frame and Body Welding")).toBe("FBW");
    expect(compactArea("EnsamblajeFinal")).toBe("Ensamb…");
  });

  it("agrupa hasta 2 elementos visibles y calcula overflow +N", () => {
    const result = formatStackedGroup([
      { id: "1", label: "Juan Pérez" },
      { id: "2", label: "Ana López" },
      { id: "3", label: "Carlos Ruiz" },
      { id: "4", label: "Sofía Díaz" },
    ], 2);

    expect(result.visible).toEqual([
      { id: "1", label: "Juan Pérez", compact: "JP" },
      { id: "2", label: "Ana López", compact: "AL" },
    ]);
    expect(result.overflowCount).toBe(2);
    expect(result.fullText).toBe("Juan Pérez, Ana López, Carlos Ruiz, Sofía Díaz");
  });

  it("calcula duración inclusiva en días", () => {
    expect(durationDays("2026-10-29", "2026-10-29")).toBe(1);
    expect(durationDays("2026-10-29", "2026-11-10")).toBe(13);
    expect(durationDays("invalida", "2026-11-10")).toBeNull();
  });
});
