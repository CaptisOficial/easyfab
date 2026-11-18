import { Plus } from "lucide-react";
import type {
  OperationsActivityEntry,
  OperationsReviewEntry,
  ResultsDeliverable,
} from "../../lib/results-api";
import { translateMessage, useI18n, type Lang } from "../../lib/i18n";

export const reviewLabel: Record<string, string> = {
  preparing: "En preparación",
  submitted: "En revisión",
  returned: "Devuelto",
  accepted: "Aceptado",
  withdrawn: "Solicitud retirada",
};

export const activityStatusLabel: Record<string, string> = {
  not_started: "Sin iniciar",
  in_progress: "En curso",
  done: "Cumplida",
};

export function getReviewLabel(status: string, lang: Lang = "es"): string {
  const keys: Record<string, "results.review.preparing" | "results.review.submitted" | "results.review.returned" | "results.review.accepted" | "results.review.withdrawn"> = {
    preparing: "results.review.preparing",
    submitted: "results.review.submitted",
    returned: "results.review.returned",
    accepted: "results.review.accepted",
    withdrawn: "results.review.withdrawn",
  };
  return keys[status] ? translateMessage(keys[status], lang) : (reviewLabel[status] ?? status);
}

export function getActivityStatusLabel(status: string, lang: Lang = "es"): string {
  const keys: Record<string, "common.status.notStarted" | "common.status.inProgress" | "common.status.done"> = {
    not_started: "common.status.notStarted",
    in_progress: "common.status.inProgress",
    done: "common.status.done",
  };
  return keys[status] ? translateMessage(keys[status], lang) : (activityStatusLabel[status] ?? status);
}

export interface DeliverableGroup {
  deliverable: ResultsDeliverable;
  activities: OperationsActivityEntry[];
  status: string;
  progress: number;
  doneCount: number;
  totalCount: number;
  startDay: number;
  endDay: number;
  startIso: string;
  endIso: string;
  dueDay: number;
}

const day = (value: string) => {
  const ts = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ts) ? 0 : ts / 86400000;
};

export function groupDeliverables(
  entries: OperationsActivityEntry[],
  deliverables: ResultsDeliverable[],
  reviews: OperationsReviewEntry[],
  commitmentRevision: string | undefined,
  fallbackStartDay: number,
  fallbackEndDay: number,
): DeliverableGroup[] {
  return deliverables.map(deliv => {
    const dActivities = entries.filter(e => e.activity.deliverable_id === deliv.id);
    const review = reviews.find(
      r =>
        r.deliverable_id === deliv.id &&
        (commitmentRevision === undefined || r.commitment_revision === commitmentRevision),
    );
    const status = review?.status ?? "preparing";
    const doneCount = dActivities.filter(
      e => e.activity.status === "done" || e.activity.progress === 100,
    ).length;
    const progress =
      dActivities.length > 0
        ? Math.round((doneCount / dActivities.length) * 100)
        : status === "accepted"
          ? 100
          : 0;

    const actStarts = dActivities.map(e => day(e.activity.forecast_start)).filter(d => d > 0);
    const actEnds = dActivities.map(e => day(e.activity.forecast_due)).filter(d => d > 0);
    const delivDueDay = day(deliv.due_date);

    const dStart = actStarts.length
      ? Math.min(...actStarts)
      : delivDueDay > 0
        ? delivDueDay
        : fallbackStartDay;
    const dEnd = actEnds.length
      ? Math.max(...actEnds)
      : delivDueDay > 0
        ? delivDueDay
        : fallbackEndDay;
    const resolvedEnd = Math.max(dStart, delivDueDay > 0 ? delivDueDay : dEnd);

    return {
      deliverable: deliv,
      activities: dActivities,
      status,
      progress,
      doneCount,
      totalCount: dActivities.length,
      startDay: dStart,
      endDay: resolvedEnd,
      startIso: new Date(dStart * 86400000).toISOString().slice(0, 10),
      endIso: new Date(resolvedEnd * 86400000).toISOString().slice(0, 10),
      dueDay: delivDueDay,
    };
  });
}

export interface DeliverableActionsProps {
  deliverable: ResultsDeliverable;
  canPlan: boolean;
  disabled?: boolean;
  onAddActivity?: (deliverable: ResultsDeliverable) => void;
}

export function DeliverableActions({
  deliverable,
  canPlan,
  disabled = false,
  onAddActivity,
}: DeliverableActionsProps) {
  const { t, pick } = useI18n();
  const showAdd = canPlan && Boolean(onAddActivity);
  const displayTitle = pick(deliverable.title);

  if (!showAdd) {
    return null;
  }

  return (
    <div className="results-deliverable-actions-grid">
      {showAdd && (
        <button
          type="button"
          className="action results-icon-btn"
          disabled={disabled}
          aria-label={t("results.addActivityInDeliverable", { title: displayTitle })}
          title={t("results.addActivityInDeliverable", { title: displayTitle })}
          onClick={() => onAddActivity?.(deliverable)}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
