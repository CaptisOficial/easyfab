import { AlertTriangle, Calendar, Clock, User } from "lucide-react";
import { durationDays } from "./compactLabels";
import { useI18n } from "../../lib/i18n";

export interface GanttTooltipData {
  kindLabel: string;
  title: string;
  statusLabel?: string;
  atRisk?: boolean;
  startDate: string;
  endDate: string;
  endLabel?: string;
  progress?: number;
  people?: string[];
  area?: string;
  actionHint?: string;
}

export function GanttTooltip({
  data,
  anchorLeftPct = 50,
  placement = "top",
}: {
  data: GanttTooltipData;
  anchorLeftPct?: number;
  placement?: "top" | "bottom";
}) {
  const { t } = useI18n();
  const days = durationDays(data.startDate, data.endDate);
  const clampedLeft = Math.max(12, Math.min(88, anchorLeftPct));

  return (
    <div
      role="tooltip"
      className={`gantt-tooltip ${placement === "bottom" ? "is-bottom" : "is-top"}`}
      style={{ left: `${clampedLeft}%` }}
    >
      <div className="gantt-tooltip-header">
        <span className="gantt-tooltip-kind">{data.kindLabel}</span>
        <div className="gantt-tooltip-badges">
          {data.statusLabel && <span className="gantt-tooltip-badge">{data.statusLabel}</span>}
          {data.atRisk && (
            <span className="gantt-tooltip-badge is-risk">
              <AlertTriangle size={11} aria-hidden="true" />
              <span>{t("common.atRisk")}</span>
            </span>
          )}
        </div>
      </div>

      <p className="gantt-tooltip-title">{data.title}</p>

      <dl className="gantt-tooltip-dates">
        <div>
          <dt>
            <Calendar size={12} aria-hidden="true" />
            <span>{t("gantt.tooltip.start")}</span>
          </dt>
          <dd className="tabular-nums">{data.startDate || "—"}</dd>
        </div>
        <div>
          <dt>
            <Calendar size={12} aria-hidden="true" />
            <span>{data.endLabel ?? t("gantt.tooltip.end")}</span>
          </dt>
          <dd className="tabular-nums">{data.endDate || "—"}</dd>
        </div>
        {days !== null && (
          <div>
            <dt>
              <Clock size={12} aria-hidden="true" />
              <span>{t("gantt.tooltip.duration")}</span>
            </dt>
            <dd className="tabular-nums">
              {days} {days === 1 ? t("gantt.tooltip.day") : t("gantt.tooltip.days")}
            </dd>
          </div>
        )}
      </dl>

      {(data.progress !== undefined || (data.people && data.people.length > 0) || data.area) && (
        <div className="gantt-tooltip-meta">
          {data.progress !== undefined && (
            <span>
              {t("results.col.progress")}: <strong className="tabular-nums">{data.progress}%</strong>
            </span>
          )}
          {data.area && (
            <span>
              {t("timeline.col.area")}: <strong>{data.area}</strong>
            </span>
          )}
          {data.people && data.people.length > 0 && (
            <span className="gantt-tooltip-people">
              <User size={12} aria-hidden="true" />
              <span>{data.people.join(", ")}</span>
            </span>
          )}
        </div>
      )}

      {data.actionHint && <p className="gantt-tooltip-hint">{data.actionHint}</p>}
    </div>
  );
}
