import { describe, expect, it } from "vitest";
import {
  BACKEND_ERRORS,
  BACKEND_ERROR_PATTERNS,
  extractErrorMessage,
  formatBackendError,
  translateActivityNote,
  translateBackendSummary,
} from "./errors";

describe("errors SSOT mapper", () => {
  it("extracts error messages cleanly from unknown thrown values", () => {
    expect(extractErrorMessage("  Ingresa primero.  ")).toBe("Ingresa primero.");
    expect(extractErrorMessage(new Error("  Ruta inválida. "))).toBe("Ruta inválida.");
    expect(extractErrorMessage({ message: "Acceso rechazado." })).toBe("Acceso rechazado.");
    expect(extractErrorMessage({ error: "Estado no disponible." })).toBe("Estado no disponible.");
    expect(extractErrorMessage(null)).toBe("");
    expect(extractErrorMessage(undefined)).toBe("");
    expect(extractErrorMessage(404)).toBe("404");
  });

  it("translates every static BACKEND_ERRORS entry to English and normalizes pre-N4 Spanish", () => {
    for (const [esText, enText] of Object.entries(BACKEND_ERRORS)) {
      expect(enText.trim().length, `empty EN for ${esText}`).toBeGreaterThan(0);
      expect(formatBackendError(esText, "en")).toBe(enText);
      const normalizedEs = formatBackendError(esText, "es");
      expect(normalizedEs.trim().length).toBeGreaterThan(0);
    }

    expect(formatBackendError("Perfil invalido.", "es")).toBe("Perfil inválido.");
    expect(formatBackendError("Sesion revocada. Ingresa otra vez.", "es")).toBe("Sesión revocada. Ingresa otra vez.");
    expect(formatBackendError("Falta la llave de confianza. Solicita provision al administrador.", "es")).toBe(
      "Falta la llave de confianza. Solicita provisión al administrador.",
    );
    expect(formatBackendError("No se pudo leer perfil", "es")).toBe("No se pudo leer perfil.");
  });

  it("handles Error: prefix fallback and unknown errors gracefully", () => {
    expect(formatBackendError("Error: Ingresa primero.", "en")).toBe("Sign in first.");
    expect(formatBackendError(new Error("Ingresa primero."), "en")).toBe("Sign in first.");
    expect(formatBackendError("Unexpected failure X", "en")).toBe("Unexpected failure X");
    expect(formatBackendError(null, "en")).toBe("");
  });

  it("matches every BACKEND_ERROR_PATTERNS rule including Windows C:\\ paths, multiline Excel stderr, nested errors, and invalid args", () => {
    expect(BACKEND_ERROR_PATTERNS.length).toBeGreaterThanOrEqual(24);

    // Named file/profile wrappers (must precede generic leer)
    expect(formatBackendError("No se pudo leer el perfil: C:\\Users\\fab\\p.json: missing", "en")).toBe(
      "Could not read profile: C:\\Users\\fab\\p.json: missing",
    );
    expect(formatBackendError("No se pudo leer el archivo: C:\\Data\\projects.json: denied", "en")).toBe(
      "Could not read file: C:\\Data\\projects.json: denied",
    );
    expect(formatBackendError("No se pudo leer la carpeta: C:\\Data: access denied", "en")).toBe(
      "Could not read folder: C:\\Data: access denied",
    );
    expect(formatBackendError("No se pudo escribir el archivo: disk full", "en")).toBe(
      "Could not write file: disk full",
    );
    expect(formatBackendError("No se pudo guardar el archivo: readonly", "en")).toBe(
      "Could not save file: readonly",
    );
    expect(formatBackendError("No se pudo crear el archivo: exists", "en")).toBe(
      "Could not create file: exists",
    );
    expect(formatBackendError("No se pudo crear la carpeta: denied", "en")).toBe(
      "Could not create folder: denied",
    );
    expect(formatBackendError("No se pudo procesar el archivo JSON: EOF at line 1", "en")).toBe(
      "Could not process JSON file: EOF at line 1",
    );
    expect(formatBackendError("Error de formato JSON: trailing comma", "en")).toBe(
      "JSON format error: trailing comma",
    );

    // Recursive wrapped errors
    expect(formatBackendError("No se pudo completar la operación: Ruta inválida.", "en")).toBe(
      "Could not complete the operation: Invalid path.",
    );
    expect(formatBackendError("No se pudo activar el proyecto: Ruta inválida.", "en")).toBe(
      "Could not activate project: Invalid path.",
    );
    expect(formatBackendError("No se pudo activar el proyecto: Perfil invalido.", "es")).toBe(
      "No se pudo activar el proyecto: Perfil inválido.",
    );

    // Generic path-capturing wrappers preserving Windows drive colons `C:\...`
    expect(formatBackendError("No se puede acceder a la carpeta: C:\\Shared\\FAB", "en")).toBe(
      "Cannot access folder: C:\\Shared\\FAB",
    );
    expect(formatBackendError("No se puede leer C:\\Shared\\workspace.json: permission denied", "en")).toBe(
      "Cannot read C:\\Shared\\workspace.json: permission denied",
    );
    expect(formatBackendError("No se pudo leer C:\\Shared\\file.json: IO error", "en")).toBe(
      "Could not read C:\\Shared\\file.json: IO error",
    );
    expect(formatBackendError("No se pudo escribir C:\\Shared\\file.json: IO error", "en")).toBe(
      "Could not write C:\\Shared\\file.json: IO error",
    );
    expect(formatBackendError("No se pudo crear C:\\Shared\\dir: IO error", "en")).toBe(
      "Could not create C:\\Shared\\dir: IO error",
    );
    expect(formatBackendError("Archivo de configuración inválido: C:\\Shared\\workspace.json", "en")).toBe(
      "Invalid configuration file: C:\\Shared\\workspace.json",
    );
    expect(
      formatBackendError(
        "El espacio está incompleto (FAB-10). Restaura sus datos; no se creará otro directorio vacío.",
        "en",
      ),
    ).toBe("The workspace is incomplete (FAB-10). Restore its data; a new empty directory will not be created.");

    // Domain wrappers
    expect(formatBackendError("No se pudo publicar el archivo: lock held", "en")).toBe(
      "Could not publish file: lock held",
    );
    expect(formatBackendError("No se pudo abrir el documento adjunto: missing", "en")).toBe(
      "Could not open attached document: missing",
    );
    expect(formatBackendError("No se pudieron leer preferencias: IO error", "en")).toBe(
      "Could not read preferences: IO error",
    );
    expect(formatBackendError("No se pudieron restablecer preferencias: IO error", "en")).toBe(
      "Could not reset preferences: IO error",
    );

    // Excel reporting & multiline stderr
    expect(formatBackendError("No se pudo iniciar la exportación Excel: COM failed", "en")).toBe(
      "Could not start Excel export: COM failed",
    );
    expect(formatBackendError("Excel devolvió errores de fórmula en Master Gantt", "en")).toBe(
      "Excel returned formula errors in Master Gantt.",
    );
    expect(
      formatBackendError(
        "Excel no completó el reporte. Revisa que Microsoft Excel esté instalado y disponible.\nLa estructura del reporte exportado no coincide con el snapshot.\nExcel devolvió errores de fórmula en Subactivity Details",
        "en",
      ),
    ).toBe(
      "Excel did not complete the report. Check that Microsoft Excel is installed and available. The exported report structure does not match the snapshot.\nExcel returned formula errors in Subactivity Details",
    );

    // Tauri invalid args
    expect(formatBackendError("invalid args `root` for command `configure_workspace`: missing field", "es")).toBe(
      "Los datos enviados no tienen el formato esperado.",
    );
    expect(formatBackendError("invalid args `root` for command `configure_workspace`: missing field", "en")).toBe(
      "The submitted data does not have the expected format.",
    );
  });

  it("translates activity notes with [Revisión solicitada]: prefix and bilingual body", () => {
    expect(translateActivityNote("[Revisión solicitada]: Falta evidencia | Missing evidence", "es")).toBe(
      "[Revisión solicitada]: Falta evidencia",
    );
    expect(translateActivityNote("[Revisión solicitada]: Falta evidencia | Missing evidence", "en")).toBe(
      "[Revision requested]: Missing evidence",
    );
    expect(translateActivityNote("[Revision requested]: Solo español", "es")).toBe(
      "[Revisión solicitada]: Solo español",
    );
    expect(translateActivityNote("Avance normal | Normal progress", "en")).toBe("Normal progress");
    expect(translateActivityNote("   ", "en")).toBe("");
  });

  it("translates all 5 HistoryEntry / ConflictVariant summary kinds preserving multi-deliverable ' | ' boundaries", () => {
    const commitmentSummary =
      "Estación operativa | Station operational · Alcance: Línea A | Line A · 2026-11-01 → 2026-11-30 · Ingenieros: eng1, eng2 · Diseño | Design (2026-11-10): Criterio 1 | Criterion 1; Criterio 2 | Criterion 2 | Pruebas | Testing (2026-11-20): Sin fallas | Zero defects · Motivo inicial | Initial reason";

    expect(translateBackendSummary(commitmentSummary, "es")).toBe(
      "Estación operativa · Alcance: Línea A · 2026-11-01 → 2026-11-30 · Ingenieros: eng1, eng2 · Diseño (2026-11-10): Criterio 1; Criterio 2 | Pruebas (2026-11-20): Sin fallas · Motivo inicial",
    );
    expect(translateBackendSummary(commitmentSummary, "en")).toBe(
      "Station operational · Scope: Line A · 2026-11-01 → 2026-11-30 · Engineers: eng1, eng2 · Design (2026-11-10): Criterion 1; Criterion 2 | Testing (2026-11-20): Zero defects · Initial reason",
    );

    // Spanish-only multi-deliverable fallback must NOT truncate deliverable 2
    const legacyMultiDeliverable =
      "Resultado · Alcance: Planta · 2026-11-01 → 2026-11-30 · Ingenieros: eng1 · Entrega 1 (2026-11-10): Crit 1 | Entrega 2 (2026-11-20): Crit 2";
    expect(translateBackendSummary(legacyMultiDeliverable, "en")).toBe(
      "Resultado · Scope: Planta · 2026-11-01 → 2026-11-30 · Engineers: eng1 · Entrega 1 (2026-11-10): Crit 1 | Entrega 2 (2026-11-20): Crit 2",
    );

    // Mixed monolingual-then-bilingual legacy " | " deliverables (oddMonoThenBilingual)
    const oddMonoThenBilingual =
      "Resultado | Result · Alcance: Planta | Plant · 2026-01-01 → 2026-02-01 · Ingenieros: a · Entregable 1 mono (2026-01-15): Crit 1 mono | Entregable 2 ES | Entregable 2 EN (2026-01-30): Crit 2 ES | Crit 2 EN";
    expect(translateBackendSummary(oddMonoThenBilingual, "en")).toBe(
      "Result · Scope: Plant · 2026-01-01 → 2026-02-01 · Engineers: a · Entregable 1 mono (2026-01-15): Crit 1 mono | Entregable 2 EN (2026-01-30): Crit 2 EN",
    );
    expect(translateBackendSummary(oddMonoThenBilingual, "es")).toBe(
      "Resultado · Alcance: Planta · 2026-01-01 → 2026-02-01 · Ingenieros: a · Entregable 1 mono (2026-01-15): Crit 1 mono | Entregable 2 ES (2026-01-30): Crit 2 ES",
    );

    // Mixed bilingual-criterion-then-monolingual-title legacy " | " deliverables (oddBilingualCritThenMonoTitle)
    const oddBilingualCritThenMonoTitle =
      "Resultado | Result · Alcance: Planta | Plant · 2026-01-01 → 2026-02-01 · Ingenieros: a · Entregable 1 ES | Entregable 1 EN (2026-01-15): Crit 1 ES | Crit 1 EN | Entregable 2 mono (2026-01-30): Crit 2 mono";
    expect(translateBackendSummary(oddBilingualCritThenMonoTitle, "en")).toBe(
      "Result · Scope: Plant · 2026-01-01 → 2026-02-01 · Engineers: a · Entregable 1 EN (2026-01-15): Crit 1 EN | Entregable 2 mono (2026-01-30): Crit 2 mono",
    );
    expect(translateBackendSummary(oddBilingualCritThenMonoTitle, "es")).toBe(
      "Resultado · Alcance: Planta · 2026-01-01 → 2026-02-01 · Ingenieros: a · Entregable 1 ES (2026-01-15): Crit 1 ES | Entregable 2 mono (2026-01-30): Crit 2 mono",
    );

    // Multi-criteria mixed monolingual/bilingual legacy " | " deliverables (multiCritMixed)
    const multiCritMixed =
      "Res ES | Res EN · Alcance: S ES | S EN · 2026-01-01 → 2026-02-01 · Ingenieros: a · D1 mono (2026-01-10): C1a ES | C1a EN; C1b mono | D2 ES | D2 EN (2026-01-20): C2 ES | C2 EN";
    expect(translateBackendSummary(multiCritMixed, "en")).toBe(
      "Res EN · Scope: S EN · 2026-01-01 → 2026-02-01 · Engineers: a · D1 mono (2026-01-10): C1a EN; C1b mono | D2 EN (2026-01-20): C2 EN",
    );
    expect(translateBackendSummary(multiCritMixed, "es")).toBe(
      "Res ES · Alcance: S ES · 2026-01-01 → 2026-02-01 · Ingenieros: a · D1 mono (2026-01-10): C1a ES; C1b mono | D2 ES (2026-01-20): C2 ES",
    );

    // Semicolon inside deliverable title on legacy " | " summaries (semiInTitle)
    const semiInTitle =
      "Res ES | Res EN · Alcance: S ES | S EN · 2026-01-01 → 2026-02-01 · Ingenieros: e1 · D1 ES | D1 EN (2026-01-10): C1 ES | C1 EN | Fase A; Fase B ES | Phase A; Phase B EN (2026-01-20): C2 ES | C2 EN";
    expect(translateBackendSummary(semiInTitle, "en")).toBe(
      "Res EN · Scope: S EN · 2026-01-01 → 2026-02-01 · Engineers: e1 · D1 EN (2026-01-10): C1 EN | Phase A; Phase B EN (2026-01-20): C2 EN",
    );
    expect(translateBackendSummary(semiInTitle, "es")).toBe(
      "Res ES · Alcance: S ES · 2026-01-01 → 2026-02-01 · Ingenieros: e1 · D1 ES (2026-01-10): C1 ES | Fase A; Fase B ES (2026-01-20): C2 ES",
    );
    const semiInMonoTitle =
      "Res · Alcance: S · 2026-01-01 → 2026-02-01 · Ingenieros: e1 · D1 (2026-01-10): C1 | Fase A; Fase B (2026-01-20): C2";
    expect(translateBackendSummary(semiInMonoTitle, "en")).toBe(
      "Res · Scope: S · 2026-01-01 → 2026-02-01 · Engineers: e1 · D1 (2026-01-10): C1 | Fase A; Fase B (2026-01-20): C2",
    );

    // Unambiguous " || " deliverable delimiter (N4 format) with mixed bilingual/monolingual and semicolons in titles
    const doublePipeDeliverables =
      "Res ES | Res EN · Alcance: S ES | S EN · 2026-01-01 → 2026-02-01 · Ingenieros: e1 · D1 mono (2026-01-10): C1a ES | C1a EN; C1b mono || Fase A; Fase B ES | Phase A; Phase B EN (2026-01-20): C2 ES | C2 EN || D3 ES | D3 EN (2026-01-30): C3 mono";
    expect(translateBackendSummary(doublePipeDeliverables, "en")).toBe(
      "Res EN · Scope: S EN · 2026-01-01 → 2026-02-01 · Engineers: e1 · D1 mono (2026-01-10): C1a EN; C1b mono | Phase A; Phase B EN (2026-01-20): C2 EN | D3 EN (2026-01-30): C3 mono",
    );
    expect(translateBackendSummary(doublePipeDeliverables, "es")).toBe(
      "Res ES · Alcance: S ES · 2026-01-01 → 2026-02-01 · Ingenieros: e1 · D1 mono (2026-01-10): C1a ES; C1b mono | Fase A; Fase B ES (2026-01-20): C2 ES | D3 ES (2026-01-30): C3 mono",
    );

    // Activity summary with Sin nota / Sin adjuntos and with revision note
    const activitySummary =
      "Montaje | Assembly · 50 % · 2026-11-01 → 2026-11-05 · Responsable: eng1 · Nota: Sin nota · Evidencias: Sin adjuntos";
    expect(translateBackendSummary(activitySummary, "en")).toBe(
      "Assembly · 50 % · 2026-11-01 → 2026-11-05 · Owner: eng1 · Note: No note · Evidence: No attachments",
    );
    const activityRevision =
      "Montaje | Assembly · 100 % · 2026-11-01 → 2026-11-05 · Responsable: eng1 · Nota: [Revisión solicitada]: Corregir plano | Fix drawing · Evidencias: plano.pdf";
    expect(translateBackendSummary(activityRevision, "en")).toBe(
      "Assembly · 100 % · 2026-11-01 → 2026-11-05 · Owner: eng1 · Note: [Revision requested]: Fix drawing · Evidence: plano.pdf",
    );

    // Blocker summary
    expect(
      translateBackendSummary("Falta material | Missing material · Ayuda requerida: Comprar | Purchase · En atención", "en"),
    ).toBe("Missing material · Help needed: Purchase · Being addressed");
    expect(translateBackendSummary("Motivo · Ayuda requerida: Aprobación · Resuelto", "en")).toBe(
      "Motivo · Help needed: Aprobación · Resolved",
    );
    expect(translateBackendSummary("Motivo · Ayuda requerida: Aprobación · Sin atención", "en")).toBe(
      "Motivo · Help needed: Aprobación · Pending attention",
    );

    // Review summary (all 5 statuses)
    expect(translateBackendSummary("d1 · En preparación · Sin decisión", "en")).toBe("d1 · Preparing · No decision");
    expect(translateBackendSummary("d1 · En revisión · Sin decisión", "en")).toBe("d1 · Under review · No decision");
    expect(translateBackendSummary("d1 · Devuelto · Falta firma | Missing signature", "en")).toBe(
      "d1 · Returned · Missing signature",
    );
    expect(translateBackendSummary("d1 · Aceptado · Aprobado | Approved", "en")).toBe("d1 · Accepted · Approved");
    expect(translateBackendSummary("d1 · Solicitud retirada · Sin decisión", "en")).toBe("d1 · Withdrawn · No decision");

    // Closure summary
    expect(translateBackendSummary("Cierre del proyecto · Todo listo | All done", "en")).toBe(
      "Project closure · All done",
    );
    expect(translateBackendSummary("Reapertura del proyecto", "en")).toBe("Project reopened");
  });
});
