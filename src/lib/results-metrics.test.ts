import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultsDetail, OperationsHistoryEntry, OperationsReviewEntry } from "./results-api";
import { summarizeResults } from "./results-metrics";

const REVISION = "a".repeat(64);
function fixture(): ResultsDetail {
  const commitment = { revision: REVISION, final_outcome: "Station in operation", scope: "Synthetic project",
    start_date: "2026-10-01", target_date: "2026-11-15", engineer_ids: ["engineer"],
    deliverables: [{ id: "d1", title: "Installed station", due_date: "2026-11-01",
      criteria: [{ id: "c1", description: "Synthetic agreed capacity", evidence_required: true }] }] };
  return {
    project: { id: "p1", wbs: "1", name: "Synthetic", process_area: "FAB", engineer_ids: ["engineer"],
      start_date: "2026-10-01", target_date: "2026-11-15", status: "In Progress" },
    commitment, baseline: structuredClone(commitment), activities: [], blockers: [], reviews: [],
    closure: null, capabilities: { can_plan_activities: true, can_change_commitment: false, can_review_deliverables: false, can_resolve_blockers: false },
    history: [], conflicts: [], plan_issues: [], legacy_entries: [],
  };
}
function event(action: string, at: string, revision = action, deliverable = "d1"): OperationsHistoryEntry {
  return { revision, stream: `review/${deliverable}`, author_id: "synthetic", recorded_at: at, action, summary: action };
}
function acceptedReview(at = "2026-10-30T12:00:00-06:00", revision = REVISION): OperationsReviewEntry {
  return { revision: "r1", deliverable_id: "d1", commitment_revision: revision, status: "accepted", submission: null,
    decision: { id: "decision", project_id: "p1", deliverable_id: "d1", submission_id: "submission",
      commitment_revision: revision, accepted: true, comment: "", supervisor_id: "supervisor", recorded_at: at, signature: "s".repeat(64) } };
}
function addBlocker(detail: ResultsDetail, id: string, report: string, attention: string | null = null, resolved: string | null = null) {
  detail.blockers.push({ revision: id, reported_by: "engineer", edited_by: "engineer", recorded_at: report,
    blocker: { id, activity_id: "task1", reason: "Awaiting access", help_needed: "Coordinate access", reported_at: report,
      first_attention_at: attention, resolved_at: resolved, resolution_note: resolved ? "Access granted" : null } });
}
afterEach(() => vi.useRealTimers());

describe("result-planning operating measures", () => {
  it("uses Mexico City civil date and Monday–Sunday boundaries at UTC midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T02:00:00Z")); // Still Sunday in Mexico City.
    const metrics = summarizeResults(fixture());
    expect(metrics.reportingDate).toBe("2026-11-01");
    expect([metrics.weekStart, metrics.weekEnd]).toEqual(["2026-10-26", "2026-11-01"]);
    expect(metrics.periodComplete).toBe(true);
    vi.setSystemTime(new Date("2026-11-02T06:00:00Z"));
    expect(summarizeResults(fixture()).weekStart).toBe("2026-11-02");
  });

  it("rejects invalid civil cutoffs instead of normalizing them", () => {
    for (const value of ["2026-02-30", "2026-1-01", "invalid", "2026-13-01"]) {
      expect(() => summarizeResults(fixture(), value)).toThrow("fecha de corte válida");
    }
  });

  it("keeps zero denominators unmeasured and distinguishes no commitment from zero acceptance", () => {
    const detail = fixture(); detail.commitment = null; detail.baseline = null;
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.totalDeliverables).toBe(0);
    expect(metrics.onTime).toMatchObject({ accepted: 0, due: 0, rate: null });
    expect(metrics.firstPass).toMatchObject({ accepted: 0, reviewed: 0, pending: 0, rate: null });
    expect(metrics.caveats.some(value => value.includes("todavía no tiene"))).toBe(true);
  });

  it("counts baseline commitments due in the selected week and first acceptance against the civil due date", () => {
    const detail = fixture();
    detail.history = [event("submit", "2026-10-30T09:00:00-06:00"), event("accept", "2026-11-02T05:30:00Z")];
    detail.reviews = [acceptedReview("2026-11-02T05:30:00Z")]; // Sunday 23:30 Mexico City.
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.onTime).toMatchObject({ accepted: 1, due: 1, rate: 1, unmeasurable: 0 });
    expect(metrics.firstPass).toMatchObject({ accepted: 1, reviewed: 1, rate: 1 });
    expect(metrics.acceptedCount).toBe(1);
  });

  it("does not count a Monday acceptance into the previous Sunday cohort's on-time result", () => {
    const detail = fixture();
    detail.history = [event("submit", "2026-10-30T09:00:00-06:00"), event("accept", "2026-11-02T06:30:00Z")];
    detail.reviews = [acceptedReview("2026-11-02T06:30:00Z")];
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.onTime).toMatchObject({ accepted: 0, rate: 0, unmeasurable: 0 });
    expect(metrics.firstPass).toMatchObject({ reviewed: 0, unmeasurable: 0 });
    expect(metrics.firstPass.pending).toBe(1);
  });

  it("preserves the original deadline after reprogramming and refuses to infer old-revision acceptance", () => {
    const detail = fixture();
    detail.commitment!.revision = "b".repeat(64);
    detail.commitment!.deliverables[0].due_date = "2026-11-15";
    detail.reviews = [acceptedReview("2026-11-10T12:00:00-06:00", "b".repeat(64))];
    detail.history = [event("accept", "2026-11-10T12:00:00-06:00")];
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.onTime).toMatchObject({ due: 1, accepted: 0, unmeasurable: 1, rate: null });
    expect(metrics.caveats.some(value => value.includes("compromiso cambió"))).toBe(true);
    expect(metrics.caveats.some(value => value.includes("aceptación histórica"))).toBe(true);
  });

  it("can confirm a timely baseline acceptance only when its decision explicitly binds to that revision", () => {
    const detail = fixture(); detail.commitment!.revision = "b".repeat(64);
    detail.reviews = [acceptedReview()]; // Old baseline decision retained in projection, not current acceptance.
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.acceptedCount).toBe(0);
    expect(metrics.onTime).toMatchObject({ accepted: 1, due: 1, rate: 1 });
    expect(metrics.firstPass.rate).toBeNull();
  });

  it("does not double-count returns and resubmissions and reports pending requests separately", () => {
    const detail = fixture();
    detail.history = [event("submit", "2026-10-28T09:00:00-06:00", "s1"), event("return", "2026-10-29T09:00:00-06:00", "r1"),
      event("submit", "2026-10-30T09:00:00-06:00", "s2")];
    detail.reviews = [{ ...acceptedReview(), status: "submitted", decision: null }];
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.firstPass).toMatchObject({ accepted: 0, reviewed: 1, pending: 1, rate: 0 });
    detail.history.push(event("accept", "2026-10-31T09:00:00-06:00", "a1"));
    expect(summarizeResults(detail, "2026-11-01").firstPass).toMatchObject({ accepted: 0, reviewed: 1, pending: 0 });
  });

  it("does not move a first review into a later reporting week or duplicate repeated history entries", () => {
    const detail = fixture();
    const original = event("return", "2026-10-23T09:00:00-06:00", "r1");
    detail.history = [original, original, event("submit", "2026-10-30T09:00:00-06:00", "s2"), event("accept", "2026-10-31T09:00:00-06:00", "a1")];
    expect(summarizeResults(detail, "2026-11-01").firstPass).toMatchObject({ reviewed: 0, accepted: 0, rate: null });
  });

  it("marks missing first-decision and submission dates as unmeasurable instead of borrowing current state", () => {
    const detail = fixture();
    detail.reviews = [acceptedReview()];
    let metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.firstPass).toMatchObject({ reviewed: 0, unmeasurable: 1, rate: null });
    detail.reviews = [{ ...acceptedReview(), status: "submitted", decision: null }];
    metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.firstPass).toMatchObject({ pending: 0, pendingUnmeasurable: 1 });
  });

  it("separates attention from resolution and uses civil days for oldest open blockers", () => {
    const detail = fixture();
    addBlocker(detail, "b1", "2026-10-30T23:30:00-06:00", "2026-10-31T01:00:00-06:00");
    addBlocker(detail, "b2", "2026-10-29T10:00:00-06:00", "2026-10-29T11:00:00-06:00", "2026-10-30T12:00:00-06:00");
    addBlocker(detail, "b3", "2026-10-28T10:00:00-06:00");
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.openBlockers.map(value => value.id)).toEqual(["b3", "b1"]);
    expect(metrics.openBlockers[0]).toMatchObject({ ageDays: 4, firstAttentionHours: null });
    expect(metrics.openBlockers[1]).toMatchObject({ ageDays: 2, firstAttentionHours: 1.5 });
  });

  it("keeps blockers open at an earlier cutoff even if resolved later, and excludes future reports", () => {
    const detail = fixture();
    addBlocker(detail, "b1", "2026-10-30T10:00:00-06:00", "2026-11-02T10:00:00-06:00", "2026-11-02T12:00:00-06:00");
    addBlocker(detail, "b2", "2026-11-02T10:00:00-06:00");
    expect(summarizeResults(detail, "2026-11-01").openBlockers).toMatchObject([{ id: "b1", firstAttentionHours: null }]);
  });

  it("excludes conflicted review/blocker streams and does not publish a complete rate", () => {
    const detail = fixture();
    detail.reviews = [acceptedReview()];
    detail.history = [event("accept", "2026-10-30T12:00:00-06:00")];
    addBlocker(detail, "b1", "2026-10-30T10:00:00-06:00");
    detail.conflicts = [{ stream: "review/d1", revisions: [] }, { stream: "blocker/b1", revisions: [] }];
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.acceptedCount).toBe(0);
    expect(metrics.acceptanceComplete).toBe(false);
    expect(metrics.openBlockers).toHaveLength(0);
    expect(metrics.onTime).toMatchObject({ due: 1, accepted: 0, unmeasurable: 1, rate: null });
    expect(metrics.firstPass.rate).toBeNull();
    expect(metrics.conflictCount).toBe(2);
  });

  it("does not score future deadlines as misses during an incomplete week", () => {
    const metrics = summarizeResults(fixture(), "2026-10-29");
    expect(metrics.periodComplete).toBe(false);
    expect(metrics.onTime).toMatchObject({ due: 1, notYetDue: 1, rate: null });
  });

  it("reports new deliverables without baseline separately and invalid timing without inventing durations", () => {
    const detail = fixture();
    detail.commitment!.deliverables.push({ ...detail.commitment!.deliverables[0], id: "d2" });
    addBlocker(detail, "invalid", "2026-02-30T09:00:00-06:00");
    addBlocker(detail, "bad-attention", "2026-10-30T10:00:00-06:00", "2026-10-29T10:00:00-06:00");
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.onTime).toMatchObject({ missingBaseline: 1, due: 1 });
    expect(metrics.openBlockers).toMatchObject([{ id: "bad-attention", firstAttentionHours: null }]);
    expect(metrics.caveats.some(value => value.includes("marcas de tiempo"))).toBe(true);
    expect(metrics.caveats.some(value => value.includes("anterior al reporte"))).toBe(true);
  });

  it("treats duplicate current review heads as incomplete instead of counting both", () => {
    const detail = fixture();
    detail.reviews = [acceptedReview(), { ...acceptedReview(), revision: "another-head" }];
    detail.history = [event("accept", "2026-10-30T12:00:00-06:00")];
    const metrics = summarizeResults(detail, "2026-11-01");
    expect(metrics.acceptedCount).toBe(0);
    expect(metrics.acceptanceComplete).toBe(false);
    expect(metrics.firstPass.rate).toBeNull();
    expect(metrics.excludedStreams).toContain("review/d1");
  });

  it("translates cutoff errors and all 14 caveats into English when lang = 'en'", () => {
    expect(() => summarizeResults(fixture(), "invalid", "en")).toThrow(
      "Use a valid cutoff date in YYYY-MM-DD format.",
    );

    const noCommitment = fixture();
    noCommitment.commitment = null;
    noCommitment.baseline = null;
    noCommitment.plan_issues = ["Issue 1"];
    noCommitment.conflicts = [{ stream: "commitment", revisions: [] }];
    const noCommitMetrics = summarizeResults(noCommitment, "2026-10-29", "en");
    expect(noCommitMetrics.caveats).toEqual(
      expect.arrayContaining([
        "The plan has unresolved relationship issues; metrics do not certify that the project can be closed.",
        "Conflicting versions are excluded from metrics; confirmed counts may be partial.",
        "Current week in progress: the cutoff is partial and period deadlines are still upcoming.",
        "The project does not have a defined commitment yet.",
        "Without a baseline, compliance with the committed date cannot be measured.",
      ]),
    );

    const complex = fixture();
    complex.commitment!.revision = "b".repeat(64);
    complex.commitment!.deliverables.push(
      { id: "d2", title: "D2", due_date: "2026-11-01", criteria: [{ id: "c2", description: "C2", evidence_required: false }] },
      { id: "d3", title: "D3", due_date: "2026-11-01", criteria: [{ id: "c3", description: "C3", evidence_required: false }] },
    );
    complex.baseline!.deliverables.push({
      id: "d-bad-date",
      title: "Bad date",
      due_date: "2026-02-30",
      criteria: [{ id: "c4", description: "C4", evidence_required: false }],
    });
    complex.reviews = [
      acceptedReview("2026-10-30T12:00:00-06:00", "b".repeat(64)),
      { ...acceptedReview("2026-10-30T12:00:00-06:00", "b".repeat(64)), revision: "dup" },
      { ...acceptedReview("2026-10-30T12:00:00-06:00", "b".repeat(64)), deliverable_id: "d2", revision: "r2" },
      { revision: "r3", deliverable_id: "d3", commitment_revision: "b".repeat(64), status: "submitted", submission: null, decision: null },
    ];
    addBlocker(complex, "invalid-ts", "2026-02-30T09:00:00-06:00");
    addBlocker(complex, "early-attention", "2026-10-30T10:00:00-06:00", "2026-10-29T10:00:00-06:00");

    const complexMetrics = summarizeResults(complex, "2026-11-01", "en");
    expect(complexMetrics.caveats).toEqual(
      expect.arrayContaining([
        "The commitment changed: the baseline date is preserved and acceptances from different revisions are not mixed.",
        "There are invalid timestamps; affected observations are not counted as complete measurements.",
        "The projection contains more than one active review head for a deliverable; that deliverable is excluded.",
        "History is missing to establish the first decision for some deliverables; the first-pass acceptance rate remains undetermined.",
        "There are pending requests without a submission date in history; they cannot be assigned to a week.",
        "There are deliverables without a baseline reference; they are shown separately from committed compliance.",
        "There are invalid baseline dates; they cannot be assigned to the period.",
        "Not all historical acceptances can be linked to the baseline revision; on-time compliance for that period remains undetermined.",
        "A first-attention timestamp precedes the report; that duration is not interpreted as a valid measurement.",
      ]),
    );
  });
});
