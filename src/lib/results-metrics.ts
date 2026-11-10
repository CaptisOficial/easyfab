import type { ResultsDetail, OperationsHistoryEntry, OperationsReviewEntry } from "./results-api";

const DAY_MS = 86_400_000;
const MX_ZONE = "America/Mexico_City";
const mxDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: MX_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export interface ResultsMetricRatio {
  accepted: number;
  rate: number | null;
}
export interface ResultsMetrics {
  reportingDate: string;
  weekStart: string;
  weekEnd: string;
  periodComplete: boolean;
  acceptedCount: number;
  totalDeliverables: number;
  acceptanceComplete: boolean;
  openBlockers: Array<{
    id: string;
    activityId: string;
    reason: string;
    ageDays: number;
    firstAttentionHours: number | null;
  }>;
  onTime: ResultsMetricRatio & {
    due: number;
    missingBaseline: number;
    unmeasurable: number;
    notYetDue: number;
  };
  firstPass: ResultsMetricRatio & {
    reviewed: number;
    pending: number;
    unmeasurable: number;
    pendingUnmeasurable: number;
  };
  conflictCount: number;
  excludedStreams: string[];
  caveats: string[];
}

function civilDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const instant = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== value) return null;
  return instant / DAY_MS;
}
function dayString(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}
function timestamp(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  if (civilDay(value.slice(0, 10)) === null) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : null;
}
function mexicoDay(instant: number): string {
  const parts = mxDate.formatToParts(instant);
  const part = (name: string) => parts.find(value => value.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Project-scoped operating measures, not individual scores or causal claims.
 * History is supplied in authenticated parent-before-child order by Rust. Dates
 * use Mexico City civil days; a selected date is an inclusive end-of-day cutoff.
 * The utility never turns absent observations or conflicts into a measured zero rate.
 */
export function summarizeResults(detail: ResultsDetail, reportingDate = mexicoDay(Date.now())): ResultsMetrics {
  const cutoff = civilDay(reportingDate);
  if (cutoff === null) throw new Error("Usa una fecha de corte válida con formato AAAA-MM-DD.");
  const weekday = new Date(cutoff * DAY_MS).getUTCDay();
  const firstDay = cutoff - ((weekday + 6) % 7);
  const lastDay = firstDay + 6;
  const weekStart = dayString(firstDay);
  const weekEnd = dayString(lastDay);
  const caveats = new Set<string>();
  if (detail.plan_issues?.length) caveats.add("El plan tiene relaciones pendientes de corregir; los indicadores no acreditan que el proyecto pueda cerrarse.");
  const excludedStreams = [...new Set(detail.conflicts.map(conflict => conflict.stream))].sort();
  const conflicts = new Set(excludedStreams);
  const commitmentConflict = conflicts.has("commitment");
  if (excludedStreams.length) caveats.add("Las versiones en conflicto se excluyen de los indicadores; los conteos confirmados pueden ser parciales.");
  if (reportingDate < weekEnd) caveats.add("Semana en curso: el corte es parcial y todavía hay fechas del periodo por vencer.");
  if (!detail.commitment) caveats.add("El proyecto todavía no tiene un compromiso definido.");
  if (detail.baseline && detail.commitment && detail.baseline.revision !== detail.commitment.revision) {
    caveats.add("El compromiso cambió: se conserva la fecha de la línea base y no se mezclan aceptaciones de revisiones distintas.");
  }

  function eventDay(value: string): string | null {
    const instant = timestamp(value);
    if (instant === null) { caveats.add("Hay marcas de tiempo no válidas; las observaciones afectadas no se consideran mediciones completas."); return null; }
    return mexicoDay(instant);
  }
  function inWeek(day: string): boolean { return day >= weekStart && day <= weekEnd; }
  function recordedByCutoff(entry: OperationsHistoryEntry): boolean {
    const day = eventDay(entry.recorded_at);
    return day !== null && day <= reportingDate;
  }

  const currentDeliverables = detail.commitment?.deliverables ?? [];
  const currentIds = new Set(currentDeliverables.map(deliverable => deliverable.id));
  const currentReviews = new Map<string, OperationsReviewEntry>();
  for (const review of detail.reviews) {
    if (currentReviews.has(review.deliverable_id)) {
      // A projection with duplicate heads is incomplete even if its conflict list is missing.
      conflicts.add(`review/${review.deliverable_id}`);
      caveats.add("La proyección contiene más de una revisión vigente para un entregable; se excluye ese entregable.");
    } else currentReviews.set(review.deliverable_id, review);
  }
  const liveReviews = [...currentReviews.values()].filter(review =>
    !commitmentConflict && !conflicts.has(`review/${review.deliverable_id}`)
    && currentIds.has(review.deliverable_id)
    && review.commitment_revision === detail.commitment?.revision);
  const acceptedCount = liveReviews.filter(review => review.status === "accepted"
    && review.decision?.accepted === true
    && review.decision.commitment_revision === detail.commitment?.revision).length;

  const history = detail.history.filter(recordedByCutoff);
  const historyIds = new Set<string>();
  const distinctHistory = history.filter(entry => {
    if (historyIds.has(entry.revision)) return false;
    historyIds.add(entry.revision);
    return true;
  });
  const byReview = new Map<string, OperationsHistoryEntry[]>();
  for (const entry of distinctHistory) {
    if (!entry.stream.startsWith("review/")) continue;
    const deliverableId = entry.stream.slice("review/".length);
    if (!currentIds.has(deliverableId) || conflicts.has(entry.stream) || commitmentConflict) continue;
    const entries = byReview.get(deliverableId) ?? [];
    entries.push(entry);
    byReview.set(deliverableId, entries);
  }

  const firstPass: ResultsMetrics["firstPass"] = { accepted: 0, reviewed: 0, pending: 0, unmeasurable: 0, pendingUnmeasurable: 0, rate: null };
  for (const deliverableId of currentIds) {
    if (commitmentConflict || conflicts.has(`review/${deliverableId}`)) continue;
    const entries = byReview.get(deliverableId) ?? [];
    const firstDecision = entries.find(entry => entry.action === "accept" || entry.action === "return");
    if (firstDecision) {
      const day = eventDay(firstDecision.recorded_at);
      if (day !== null && inWeek(day)) {
        firstPass.reviewed++;
        if (firstDecision.action === "accept") firstPass.accepted++;
      }
    } else {
      const decision = currentReviews.get(deliverableId)?.decision;
      const decisionDay = decision ? eventDay(decision.recorded_at) : null;
      if (decision && (decisionDay === null || decisionDay <= reportingDate)) {
        firstPass.unmeasurable++;
        caveats.add("Falta historial para establecer la primera decisión de algunos entregables; la tasa de primera aceptación queda sin determinar.");
      }
    }
    const last = entries.at(-1);
    if (last?.action === "submit") {
      const day = eventDay(last.recorded_at);
      if (day !== null && inWeek(day)) firstPass.pending++;
    } else if (!entries.length && currentReviews.get(deliverableId)?.status === "submitted") {
      firstPass.pendingUnmeasurable++;
      caveats.add("Hay solicitudes pendientes sin fecha de solicitud en el historial; no pueden asignarse a una semana.");
    }
  }
  if (firstPass.reviewed > 0 && firstPass.unmeasurable === 0 && !commitmentConflict
    && ![...conflicts].some(stream => stream.startsWith("review/"))) {
    firstPass.rate = firstPass.accepted / firstPass.reviewed;
  }

  const onTime: ResultsMetrics["onTime"] = { accepted: 0, due: 0, missingBaseline: 0, unmeasurable: 0, notYetDue: 0, rate: null };
  const baselineIds = new Set(detail.baseline?.deliverables.map(deliverable => deliverable.id) ?? []);
  onTime.missingBaseline = currentDeliverables.filter(deliverable => !baselineIds.has(deliverable.id)).length;
  if (!detail.baseline) caveats.add("Sin línea base no puede medirse cumplimiento de la fecha comprometida.");
  if (onTime.missingBaseline) caveats.add("Hay entregables sin referencia en la línea base; se muestran aparte del cumplimiento comprometido.");
  for (const deliverable of detail.baseline?.deliverables ?? []) {
    if (civilDay(deliverable.due_date) === null) {
      onTime.missingBaseline++;
      caveats.add("Hay fechas de línea base inválidas; no se pueden asignar al periodo.");
      continue;
    }
    if (!inWeek(deliverable.due_date)) continue;
    onTime.due++;
    if (deliverable.due_date > reportingDate) { onTime.notYetDue++; continue; }
    if (commitmentConflict || conflicts.has(`review/${deliverable.id}`) || !currentIds.has(deliverable.id)) {
      onTime.unmeasurable++; continue;
    }
    const sameCommitment = detail.baseline?.revision === detail.commitment?.revision;
    if (sameCommitment) {
      const firstAcceptance = byReview.get(deliverable.id)?.find(entry => entry.action === "accept");
      if (firstAcceptance) {
        const day = eventDay(firstAcceptance.recorded_at);
        if (day === null) onTime.unmeasurable++;
        else if (day <= deliverable.due_date) onTime.accepted++;
      } else if (currentReviews.get(deliverable.id)?.decision?.accepted) {
        // A current signed decision establishes at least one timely acceptance,
        // but a late current decision cannot prove that no earlier one existed.
        const day = eventDay(currentReviews.get(deliverable.id)!.decision!.recorded_at);
        if (day !== null && day <= deliverable.due_date && day <= reportingDate) onTime.accepted++;
        else if (day === null || day <= reportingDate) onTime.unmeasurable++;
      }
    } else {
      const decision = currentReviews.get(deliverable.id)?.decision;
      const day = decision ? eventDay(decision.recorded_at) : null;
      if (decision?.accepted && decision.commitment_revision === detail.baseline?.revision
        && day !== null && day <= deliverable.due_date && day <= reportingDate) onTime.accepted++;
      else onTime.unmeasurable++;
    }
  }
  if (onTime.unmeasurable) caveats.add("No puede ligarse toda la aceptación histórica a la revisión de la línea base; el cumplimiento de ese periodo queda sin determinar.");
  if (onTime.due > 0 && onTime.unmeasurable === 0 && onTime.notYetDue === 0) onTime.rate = onTime.accepted / onTime.due;

  const openBlockers: ResultsMetrics["openBlockers"] = [];
  for (const entry of detail.blockers) {
    const blocker = entry.blocker;
    if (conflicts.has(`blocker/${blocker.id}`)) continue;
    const reported = timestamp(blocker.reported_at);
    const reportDay = eventDay(blocker.reported_at);
    if (reported === null || reportDay === null || reportDay > reportingDate) continue;
    const resolvedDay = blocker.resolved_at ? eventDay(blocker.resolved_at) : null;
    if (blocker.resolved_at && resolvedDay === null) continue;
    if (resolvedDay !== null && resolvedDay <= reportingDate) continue;
    const attention = blocker.first_attention_at ? timestamp(blocker.first_attention_at) : null;
    if (blocker.first_attention_at && attention === null) eventDay(blocker.first_attention_at);
    const attentionDay = attention === null ? null : mexicoDay(attention);
    let firstAttentionHours: number | null = null;
    if (attention !== null && attentionDay !== null && attentionDay <= reportingDate && attention >= reported) {
      firstAttentionHours = (attention - reported) / 3_600_000;
    } else if (attention !== null && attention < reported) caveats.add("Hay una primera atención anterior al reporte; ese tiempo no se interpreta como medición válida.");
    openBlockers.push({ id: blocker.id, activityId: blocker.activity_id, reason: blocker.reason,
      ageDays: Math.max(0, cutoff - civilDay(reportDay)!), firstAttentionHours });
  }
  openBlockers.sort((a, b) => b.ageDays - a.ageDays || a.id.localeCompare(b.id));

  return {
    reportingDate, weekStart, weekEnd, periodComplete: reportingDate === weekEnd,
    acceptedCount, totalDeliverables: currentDeliverables.length,
    acceptanceComplete: !commitmentConflict && ![...conflicts].some(stream => stream.startsWith("review/")),
    openBlockers, onTime, firstPass, conflictCount: detail.conflicts.length,
    excludedStreams: [...conflicts].sort(), caveats: [...caveats],
  };
}
