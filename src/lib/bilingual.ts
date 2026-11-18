export type Lang = "es" | "en";

export const BILINGUAL_SEPARATOR = " | ";

/**
 * Splits a single stored string formatted as `"Español | English"`.
 * Projects registered before bilingual support only have Spanish text and
 * return `{ es: raw.trim(), en: "" }` so callers fall back to Spanish.
 */
export function parseBilingual(raw: string): { es: string; en: string } {
  const idx = raw.indexOf(BILINGUAL_SEPARATOR);
  if (idx === -1) {
    return { es: raw.trim(), en: "" };
  }
  return {
    es: raw.slice(0, idx).trim(),
    en: raw.slice(idx + BILINGUAL_SEPARATOR.length).trim(),
  };
}

/**
 * Formats Spanish and optional English text into the canonical single-field
 * `"Español | English"` representation (Spanish first, English second).
 */
export function formatBilingual(es: string, en?: string): string {
  const cleanEs = es.trim();
  const cleanEn = en?.trim() ?? "";
  return cleanEn ? `${cleanEs}${BILINGUAL_SEPARATOR}${cleanEn}` : cleanEs;
}

/**
 * Returns the text for the active language, falling back to Spanish when no
 * English translation is present.
 */
export function pickBilingual(raw: string, lang: Lang): string {
  const { es, en } = parseBilingual(raw);
  return lang === "en" ? (en || es) : es;
}
