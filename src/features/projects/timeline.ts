export type Period = "week" | "month" | "year";
const day = 86400000;
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function periodRange(anchor: string, period: Period, locale = "es-MX") {
  const start = new Date(`${anchor}T00:00:00Z`);
  if (period === "week") start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  else { start.setUTCDate(1); if (period === "year") start.setUTCMonth(0); }
  const end = new Date(start);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 7);
  else if (period === "month") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  const columns: { start: string; end: string; label: string }[] = [];
  for (let cursor = new Date(start); cursor < end;) {
    const next = new Date(cursor);
    if (period === "year") next.setUTCMonth(next.getUTCMonth() + 1);
    else next.setUTCDate(next.getUTCDate() + 1);
    columns.push({ start: dateKey(cursor), end: dateKey(new Date(next.getTime() - day)), label: new Intl.DateTimeFormat(locale, period === "year" ? { month: "short", timeZone: "UTC" } : { weekday: "short", day: "2-digit", timeZone: "UTC" }).format(cursor) });
    cursor = next;
  }
  return { start: dateKey(start), end: dateKey(new Date(end.getTime() - day)), columns };
}
export function movePeriod(anchor: string, period: Period, direction: number) {
  const date = new Date(`${periodRange(anchor, period).start}T00:00:00Z`);
  if (period === "week") date.setUTCDate(date.getUTCDate() + 7 * direction);
  else if (period === "month") date.setUTCMonth(date.getUTCMonth() + direction);
  else date.setUTCFullYear(date.getUTCFullYear() + direction);
  return dateKey(date);
}
export const overlaps = (start: string, end: string, from: string, to: string) => start <= to && end >= from;
