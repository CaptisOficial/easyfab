use super::*;
use serde_json::{json, Value};

fn fixture() -> Plan {
    serde_json::from_str(include_str!(
        "../../../contracts/fixtures/project_results.valid.json"
    ))
    .unwrap()
}
fn engineer() -> Capabilities {
    Capabilities {
        can_plan_activities: true,
        can_change_commitment: false,
        can_review_deliverables: false,
        can_resolve_blockers: false,
    }
}
fn supervisor() -> Capabilities {
    Capabilities {
        can_plan_activities: true,
        can_change_commitment: true,
        can_review_deliverables: true,
        can_resolve_blockers: true,
    }
}
fn submission() -> Submission {
    Submission {
        id: "b".repeat(64),
        deliverable_id: "delivery_1".into(),
        commitment_revision: "a".repeat(64),
        criteria: vec![CriterionResult {
            criterion_id: "capacity".into(),
            fulfilled: true,
            evidence_ids: vec!["c".repeat(64)],
        }],
    }
}
fn decision() -> Decision {
    Decision {
        id: "d".repeat(64),
        project_id: "project_1".into(),
        deliverable_id: "delivery_1".into(),
        submission_id: "b".repeat(64),
        commitment_revision: "a".repeat(64),
        accepted: true,
        comment: String::new(),
        supervisor_id: "supervisor".into(),
        recorded_at: "2026-10-29T12:00:00-06:00".into(),
        signature: "e".repeat(64),
    }
}
fn blocker() -> Blocker {
    Blocker {
        id: "blocker_1".into(),
        activity_id: "task_1".into(),
        reason: "Waiting for access".into(),
        help_needed: "Coordinate access".into(),
        reported_at: "2026-10-29T10:00:00-06:00".into(),
        first_attention_at: None,
        resolved_at: None,
        resolution_note: None,
    }
}

#[test]
fn snapshot_round_trip_preserves_contract_and_nullable_fields() {
    let value: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/project_results.valid.json"
    ))
    .unwrap();
    let plan = fixture();
    plan.validate().unwrap();
    assert_eq!(serde_json::to_value(&plan).unwrap(), value);
    for field in ["note", "hours_spent"] {
        let mut missing = value.clone();
        missing["activities"][0]
            .as_object_mut()
            .unwrap()
            .remove(field);
        assert!(serde_json::from_value::<Plan>(missing).is_err());
    }
    let mut injected = value;
    injected["activities"][0]["supervisor_approved"] = json!(true);
    assert!(serde_json::from_value::<Plan>(injected).is_err());
}

#[test]
fn validates_commitment_references_dates_and_work_states() {
    let cases: Vec<fn(&mut Plan)> = vec![
        |p| p.version = 2,
        |p| p.project_id = "../escape".into(),
        |p| p.commitment.revision = "A".repeat(64),
        |p| p.commitment.final_outcome = " ".into(),
        |p| p.commitment.scope.clear(),
        |p| p.commitment.engineer_ids.clear(),
        |p| p.commitment.engineer_ids.push("engineer".into()),
        |p| p.commitment.deliverables.clear(),
        |p| {
            p.commitment
                .deliverables
                .push(p.commitment.deliverables[0].clone())
        },
        |p| p.commitment.start_date = "2026-02-30".into(),
        |p| p.commitment.start_date = "2026-1-01".into(),
        |p| p.commitment.target_date = "2026-01-01".into(),
        |p| p.commitment.deliverables[0].due_date = "2027-01-01".into(),
        |p| p.commitment.deliverables[0].criteria.clear(),
        |p| {
            let c = p.commitment.deliverables[0].criteria[0].clone();
            p.commitment.deliverables[0].criteria.push(c);
        },
        |p| p.activities[0].responsible_id = "admin".into(),
        |p| p.activities[0].deliverable_id = "missing".into(),
        |p| p.activities[0].title = " ".into(),
        |p| p.activities[0].progress = 23,
        |p| p.activities[0].hours_spent = Some(-0.1),
        |p| p.activities[0].hours_spent = Some(f64::NAN),
        |p| p.activities[0].status = ActivityStatus::Done,
        |p| p.activities[0].status = ActivityStatus::NotStarted,
        |p| p.activities[0].progress = 100,
        |p| p.activities[0].forecast_due = "2026-01-01".into(),
        |p| p.activities[0].dependency_ids.push("missing".into()),
        |p| p.activities[0].dependency_ids.push("task_1".into()),
        |p| p.activities[1].dependency_ids.push("task_1".into()),
        |p| p.activities[1].forecast_start = "2026-11-09".into(),
    ];
    for (i, change) in cases.into_iter().enumerate() {
        let mut plan = fixture();
        change(&mut plan);
        assert!(plan.validate().is_err(), "invalid case {i}");
    }
    let mut cycle = fixture();
    for a in &mut cycle.activities {
        a.forecast_start = "2026-11-10".into();
        a.forecast_due = "2026-11-10".into();
    }
    cycle.activities[0].dependency_ids = vec!["task_2".into()];
    assert!(cycle.validate().unwrap_err().contains("circulares"));
}

#[test]
fn completion_and_late_forecast_do_not_approve_or_move_commitment() {
    let mut plan = fixture();
    let commitment = serde_json::to_value(&plan.commitment).unwrap();
    plan.activities[1].progress = 100;
    plan.activities[1].status = ActivityStatus::Done;
    plan.activities[1].forecast_due = "2027-01-01".into();
    plan.activities[1].at_risk = true;
    plan.validate().unwrap();
    assert_eq!(serde_json::to_value(&plan.commitment).unwrap(), commitment);
    assert!(transition(
        ReviewStatus::Preparing,
        ReviewAction::Accept,
        &engineer(),
        None
    )
    .is_err());
    assert!(transition(
        ReviewStatus::Preparing,
        ReviewAction::Accept,
        &supervisor(),
        None
    )
    .is_err());
}

#[test]
fn submission_requires_exact_revision_all_criteria_and_verified_evidence() {
    let plan = fixture();
    let verified = HashSet::from(["c".repeat(64)]);
    plan.validate_submission(&submission(), &verified).unwrap();
    assert!(plan
        .validate_submission(&submission(), &HashSet::new())
        .is_err());
    let cases: Vec<fn(&mut Submission)> = vec![
        |s| s.commitment_revision = "d".repeat(64),
        |s| s.deliverable_id = "missing".into(),
        |s| s.criteria.clear(),
        |s| s.criteria.push(s.criteria[0].clone()),
        |s| s.criteria[0].criterion_id = "other".into(),
        |s| s.criteria[0].fulfilled = false,
        |s| s.criteria[0].evidence_ids.clear(),
        |s| s.criteria[0].evidence_ids.push("c".repeat(64)),
    ];
    for change in cases {
        let mut s = submission();
        change(&mut s);
        assert!(plan.validate_submission(&s, &verified).is_err());
    }
    let mut optional = fixture();
    optional.commitment.deliverables[0].criteria[0].evidence_required = false;
    let mut no_attachment = submission();
    no_attachment.criteria[0].evidence_ids.clear();
    optional
        .validate_submission(&no_attachment, &HashSet::new())
        .unwrap();
}

#[test]
fn review_policy_exhaustively_rejects_unauthorized_transitions() {
    use ReviewAction::*;
    use ReviewStatus::*;
    let none = Capabilities {
        can_plan_activities: false,
        can_change_commitment: false,
        can_review_deliverables: false,
        can_resolve_blockers: false,
    };
    for status in [Preparing, Submitted, Returned, Accepted, Withdrawn] {
        for action in [Submit, Withdraw, Accept, Return, Revise] {
            assert!(transition(status, action, &none, Some("Reason")).is_err());
            let expected_engineer = matches!(
                (status, action),
                (Preparing | Returned | Withdrawn, Submit) | (Submitted, Withdraw)
            );
            let expected_supervisor =
                action == Revise || matches!((status, action), (Preparing | Returned | Withdrawn, Submit) | (Submitted, Withdraw | Accept | Return));
            assert_eq!(
                transition(status, action, &engineer(), Some("Reason")).is_ok(),
                expected_engineer
            );
            assert_eq!(
                transition(status, action, &supervisor(), Some("Reason")).is_ok(),
                expected_supervisor
            );
        }
    }
    assert!(transition(Submitted, Return, &supervisor(), Some(" ")).is_err());
    assert_eq!(
        transition(Submitted, Accept, &supervisor(), None).unwrap(),
        Accepted
    );
    assert_eq!(
        transition(Accepted, Revise, &supervisor(), None).unwrap(),
        Preparing
    );
    assert_eq!(
        transition(Submitted, Withdraw, &engineer(), None).unwrap(),
        Withdrawn
    );
}

#[test]
fn blocker_tracks_attention_separately_from_resolution_and_progress() {
    let plan = fixture();
    let before = serde_json::to_value(&plan).unwrap();
    let mut b = blocker();
    b.validate(&plan).unwrap();
    b.first_attention_at = Some("2026-10-29T11:00:00-06:00".into());
    b.validate(&plan).unwrap(); // attention is not resolution
    b.resolved_at = Some("2026-10-29T12:00:00-06:00".into());
    assert!(b.validate(&plan).is_err());
    b.resolution_note = Some("Access granted".into());
    b.validate(&plan).unwrap();
    b.resolved_at = Some("2026-10-29T10:30:00-06:00".into());
    assert!(b.validate(&plan).is_err());
    b = blocker();
    b.activity_id = "missing".into();
    assert!(b.validate(&plan).is_err());
    b = blocker();
    b.reason = " ".into();
    assert!(b.validate(&plan).is_err());
    b = blocker();
    b.first_attention_at = Some("2026-10-29T09:00:00-06:00".into());
    assert!(b.validate(&plan).is_err());
    assert_eq!(serde_json::to_value(&plan).unwrap(), before);
}

#[test]
fn closure_requires_valid_plan_and_final_outcome_without_individual_reviews() {
    let plan = fixture();
    let verified = HashSet::from(["c".repeat(64)]);
    // Deliverables are evaluated at closure, so empty per-deliverable reviews are allowed.
    plan.validate_closure(&[], &verified, true).unwrap();
    assert!(plan.validate_closure(&[], &verified, false).is_err());

    let reviews = vec![(submission(), decision())];
    plan.validate_closure(&reviews, &verified, true).unwrap();
    assert!(plan.validate_closure(&reviews, &verified, false).is_err());
    assert!(plan
        .validate_closure(&[reviews[0].clone(), reviews[0].clone()], &verified, true)
        .is_err());
    let mut changed_commitment = fixture();
    changed_commitment.commitment.revision = "f".repeat(64);
    assert!(changed_commitment
        .validate_closure(&reviews, &verified, true)
        .is_err());
    let mut returned = decision();
    returned.accepted = false;
    assert!(plan.validate_decision(&submission(), &returned).is_err());
    returned.comment = "Capacity evidence does not satisfy criterion".into();
    plan.validate_decision(&submission(), &returned).unwrap();
    assert!(plan
        .validate_closure(&[(submission(), returned)], &verified, true)
        .is_err());
}

#[test]
fn rust_enum_serialization_matches_canonical_schema() {
    let schema: Value = serde_json::from_str(include_str!(
        "../../../contracts/v1/project_results.schema.json"
    ))
    .unwrap();
    assert_eq!(
        json!([
            ActivityStatus::NotStarted,
            ActivityStatus::InProgress,
            ActivityStatus::Done
        ]),
        schema["$defs"]["activity_status"]["enum"]
    );
    assert_eq!(
        json!([
            ReviewStatus::Preparing,
            ReviewStatus::Submitted,
            ReviewStatus::Returned,
            ReviewStatus::Accepted,
            ReviewStatus::Withdrawn
        ]),
        schema["$defs"]["review_status"]["enum"]
    );
    assert_eq!(
        json!([
            ReviewAction::Submit,
            ReviewAction::Withdraw,
            ReviewAction::Accept,
            ReviewAction::Return,
            ReviewAction::Revise
        ]),
        schema["$defs"]["review_action"]["enum"]
    );
}
