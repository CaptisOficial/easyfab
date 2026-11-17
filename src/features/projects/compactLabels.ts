export interface CompactItem {
  id: string;
  label: string;
  compact: string;
}

const IGNORED_PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e"]);

/** Convierte un nombre completo o identificador en iniciales compactas (máx. 4 caracteres en fallback). */
export function toInitials(nameOrId: string): string {
  const cleaned = nameOrId.trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const significant = words.filter(w => !IGNORED_PARTICLES.has(w.toLowerCase()));
    const source = significant.length >= 2 ? significant : words;
    const first = source[0]?.[0] ?? "";
    const last = source[source.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }
  const single = words[0];
  if (single.length <= 4) return single.toUpperCase();
  return single.slice(0, 3).toUpperCase();
}

/** Compacta un nombre de área de proceso preservando su legibilidad en celdas angostas. */
export function compactArea(area: string, maxChars = 7): string {
  const cleaned = area.trim();
  if (!cleaned) return "—";
  if (cleaned.length <= maxChars) return cleaned;
  const words = cleaned.split(/[\s/_-]+/).filter(Boolean);
  if (words.length >= 2) {
    const acronym = words
      .filter(w => !IGNORED_PARTICLES.has(w.toLowerCase()))
      .map(w => w[0])
      .join("")
      .toUpperCase();
    if (acronym.length >= 2 && acronym.length <= maxChars) return acronym;
  }
  return `${cleaned.slice(0, maxChars - 1)}…`;
}

/** Agrupa elementos para apilarlos verticalmente con un límite visible y contador +N. */
export function formatStackedGroup(
  items: { id: string; label: string; compact?: string }[],
  maxVisible = 2
): {
  visible: CompactItem[];
  overflowCount: number;
  overflowItems: CompactItem[];
  fullText: string;
} {
  const normalized: CompactItem[] = items.map(item => ({
    id: item.id,
    label: item.label,
    compact: item.compact ?? toInitials(item.label),
  }));
  const limit = Math.max(1, maxVisible);
  const visible = normalized.slice(0, limit);
  const overflowItems = normalized.slice(limit);
  return {
    visible,
    overflowCount: overflowItems.length,
    overflowItems,
    fullText: normalized.map(i => i.label).join(", "),
  };
}

/** Calcula la duración inclusiva en días entre dos fechas YYYY-MM-DD. */
export function durationDays(startDate: string, endDate: string): number | null {
  const s = Date.parse(`${startDate}T00:00:00Z`);
  const e = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}
