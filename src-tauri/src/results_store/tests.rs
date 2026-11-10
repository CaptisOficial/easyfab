use super::*;
use std::process::Command;

#[test]
fn storage_serialization_matches_canonical_boundary() {
    let schema: serde_json::Value = serde_json::from_str(include_str!(
        "../../../contracts/v1/project_results_storage.schema.json"
    ))
    .unwrap();
    let compare = |name: &str, value: serde_json::Value| {
        let actual: BTreeSet<_> = value
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        let expected: BTreeSet<_> = schema["$defs"][name]["required"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap())
            .collect();
        assert_eq!(actual, expected, "{name}");
    };
    let activity = ActivityData {
        created_by: "engineer".into(),
        activity: task("task_1", "delivery_1"),
        evidence: vec![],
    };
    let blocker = BlockerData {
        reported_by: "engineer".into(),
        blocker: domain::Blocker {
            id: "block_1".into(),
            activity_id: "task_1".into(),
            reason: "Waiting".into(),
            help_needed: "Coordinate".into(),
            reported_at: "2026-10-30T10:00:00-06:00".into(),
            first_attention_at: None,
            resolved_at: None,
            resolution_note: None,
        },
    };
    let review = ReviewData {
        deliverable_id: "delivery_1".into(),
        commitment_revision: "a".repeat(64),
        status: domain::ReviewStatus::Preparing,
        submission: None,
        decision: None,
    };
    let closure = ClosureData {
        closed: false,
        commitment_revision: "a".repeat(64),
        review_revisions: vec![],
        comment: "Reopen".into(),
    };
    compare("activity_data", serde_json::to_value(&activity).unwrap());
    compare("blocker_data", serde_json::to_value(&blocker).unwrap());
    compare("review_data", serde_json::to_value(&review).unwrap());
    for missing in ["submission", "decision"] {
        let mut value = serde_json::to_value(&review).unwrap();
        value.as_object_mut().unwrap().remove(missing);
        assert!(serde_json::from_value::<ReviewData>(value).is_err());
    }
    compare("closure_data", serde_json::to_value(&closure).unwrap());
    let payloads = [
        Payload::Activity(activity),
        Payload::Blocker(blocker),
        Payload::Review(review),
        Payload::Closure(closure),
    ];
    for payload in payloads {
        let serialized = serde_json::to_value(&payload).unwrap();
        let actual: BTreeSet<_> = serialized
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        assert_eq!(actual, BTreeSet::from(["kind", "value"]));
        let mut injected = serialized.clone();
        injected["extra"] = true.into();
        assert!(serde_json::from_value::<Payload>(injected).is_err());
        assert!(schema["$defs"]["payload"]["oneOf"]
            .as_array()
            .unwrap()
            .iter()
            .any(|variant| variant["properties"]["kind"]["const"] == serialized["kind"]));
    }
    let event = Event {
        version: 1,
        id: "b".repeat(64),
        project_id: "project_1".into(),
        stream: "closure".into(),
        parents: vec![],
        author_id: "supervisor".into(),
        author_role: "supervisor".into(),
        recorded_at: "2026-10-30T10:00:00-06:00".into(),
        action: "reopen".into(),
        comment: "Reason".into(),
        base_commitment: Some("a".repeat(64)),
        payload: Payload::Closure(ClosureData {
            closed: false,
            commitment_revision: "a".repeat(64),
            review_revisions: vec![],
            comment: "Reason".into(),
        }),
        signature: "c".repeat(64),
    };
    let mut serialized_event = serde_json::to_value(event).unwrap();
    compare("event", serialized_event.clone());
    serialized_event
        .as_object_mut()
        .unwrap()
        .remove("base_commitment");
    assert!(serde_json::from_value::<Event>(serialized_event).is_err());
    compare(
        "manifest",
        serde_json::to_value(StorageManifest {
            version: 1,
            project_id: "project_1".into(),
            legacy_sha256: "d".repeat(64),
            signature: "e".repeat(64),
        })
        .unwrap(),
    );
}

#[test]
fn result_journey_isolated() {
    let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join(format!("results-{}", auth::revision()));
    fs::create_dir_all(&base).unwrap();
    let output = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "results_store::tests::isolated_result_journey",
            "--nocapture",
        ])
        .env("EASYFAB_RESULTS_FIXTURE", &base)
        .env("LOCALAPPDATA", base.join("local"))
        .output()
        .unwrap();
    fs::remove_dir_all(&base).unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}
struct Fixture {
    dir: PathBuf,
    id: String,
    admin: auth::Session,
    supervisor: auth::Session,
    engineer: auth::Session,
    colleague: auth::Session,
}
fn setup(base: &Path) -> Fixture {
    let root = base.join("shared");
    fs::create_dir_all(&root).unwrap();
    let info = workspace::initialize(&root, &base.join("local/EasyFAB")).unwrap();
    let dir = PathBuf::from(&info.data_dir);
    let temp =
        auth::provision_initial_admin(&dir, "admin".into(), "Synthetic Admin".into()).unwrap();
    let s = auth::authenticate(&dir, "admin", &temp).unwrap();
    auth::change_password(&dir, &s, "Admin123").unwrap();
    let admin = auth::authenticate(&dir, "admin", "Admin123").unwrap();
    let create = |id: &str, role: &str| {
        let temp = auth::create_user(
            &dir,
            &admin,
            auth::NewUser {
                id: id.into(),
                name: format!("Synthetic {id}"),
                role: role.into(),
            },
        )
        .unwrap();
        let s = auth::authenticate(&dir, id, &temp).unwrap();
        assert!(detail(&dir, &s, &info.id, "missing").is_err());
        auth::change_password(&dir, &s, "User1234").unwrap();
        auth::authenticate(&dir, id, "User1234").unwrap()
    };
    let supervisor = create("supervisor", "supervisor");
    let engineer = create("engineer", "engineer");
    let colleague = create("engineer2", "engineer");
    Fixture {
        dir,
        id: info.id,
        admin,
        supervisor,
        engineer,
        colleague,
    }
}
fn project(f: &Fixture, ids: Vec<String>) -> projects::Project {
    projects::create(
        &f.dir,
        &f.supervisor,
        &f.id,
        projects::NewProject {
            wbs: String::new(),
            name: "Synthetic result project".into(),
            process_area: "FAB".into(),
            engineer_ids: ids,
            start_date: "2026-10-29".into(),
            target_date: "2026-11-30".into(),
        },
    )
    .unwrap()
}
fn initial(p: &projects::Project) -> CommitmentInput {
    CommitmentInput {
        project_id: p.id.clone(),
        expected_revision: None,
        change_reason: "Initial synthetic agreement".into(),
        legacy_deliverable_id: None,
        commitment: CommitmentDraft {
            final_outcome: "Synthetic station available".into(),
            scope: "Install and validate".into(),
            start_date: p.start_date.clone(),
            target_date: p.target_date.clone(),
            engineer_ids: p.engineer_ids.clone(),
            deliverables: (1..=2)
                .map(|i| domain::Deliverable {
                    id: format!("delivery_{i}"),
                    title: format!("Result {i}"),
                    due_date: p.target_date.clone(),
                    criteria: vec![domain::Criterion {
                        id: format!("quality_{i}"),
                        description: "Agreed synthetic result".into(),
                        evidence_required: true,
                    }],
                })
                .collect(),
        },
    }
}
fn task(id: &str, d: &str) -> domain::Activity {
    domain::Activity {
        id: id.into(),
        deliverable_id: d.into(),
        title: format!("Synthetic {id}"),
        responsible_id: "engineer".into(),
        forecast_start: "2026-10-29".into(),
        forecast_due: "2026-11-01".into(),
        dependency_ids: vec![],
        status: domain::ActivityStatus::InProgress,
        progress: 25,
        at_risk: false,
        hours_spent: Some(1.5),
        note: None,
    }
}
fn row<'a>(d: &'a Detail, id: &str) -> &'a ActivityEntry {
    d.activities.iter().find(|e| e.activity.id == id).unwrap()
}
fn save(f: &Fixture, s: &auth::Session, d: &Detail, a: domain::Activity) -> Result<Detail, String> {
    save_activity(
        &f.dir,
        s,
        &f.id,
        ActivityInput {
            project_id: d.project.id.clone(),
            expected_revision: d
                .activities
                .iter()
                .find(|e| e.activity.id == a.id)
                .map(|e| e.revision.clone()),
            activity: a,
        },
    )
}
fn review_input(
    d: &Detail,
    id: &str,
    action: domain::ReviewAction,
    evidence: Option<String>,
) -> ReviewInput {
    ReviewInput {
        project_id: d.project.id.clone(),
        deliverable_id: id.into(),
        expected_revision: d
            .reviews
            .iter()
            .find(|r| r.deliverable_id == id)
            .map(|r| r.revision.clone()),
        action,
        criteria: d
            .commitment
            .as_ref()
            .unwrap()
            .deliverables
            .iter()
            .find(|r| r.id == id)
            .unwrap()
            .criteria
            .iter()
            .map(|c| domain::CriterionResult {
                criterion_id: c.id.clone(),
                fulfilled: true,
                evidence_ids: evidence.clone().into_iter().collect(),
            })
            .collect(),
        comment: "Synthetic review reason".into(),
    }
}
fn act(
    f: &Fixture,
    s: &auth::Session,
    d: &Detail,
    id: &str,
    action: domain::ReviewAction,
    evidence: Option<String>,
) -> Result<Detail, String> {
    review(&f.dir, s, &f.id, review_input(d, id, action, evidence))
}
fn close_input(d: &Detail, closed: bool) -> ClosureInput {
    ClosureInput {
        project_id: d.project.id.clone(),
        expected_revision: d.closure.as_ref().map(|c| c.revision.clone()),
        closed,
        confirm_final_outcome: true,
        comment: if closed {
            "Final state verified"
        } else {
            "Synthetic project reopened"
        }
        .into(),
    }
}
fn upload(f: &Fixture, d: &Detail, id: &str) -> Detail {
    attach(
        &f.dir,
        &f.engineer,
        &f.id,
        AttachmentInput {
            project_id: d.project.id.clone(),
            activity_id: id.into(),
            expected_revision: row(d, id).revision.clone(),
            name: "synthetic.pdf".into(),
            bytes: b"%PDF-synthetic evidence".to_vec(),
        },
    )
    .unwrap()
}
fn blocker_input(d: &Detail, action: &str) -> BlockerInput {
    let b = &d.blockers[0];
    BlockerInput {
        project_id: d.project.id.clone(),
        blocker_id: Some(b.blocker.id.clone()),
        expected_revision: Some(b.revision.clone()),
        activity_id: b.blocker.activity_id.clone(),
        reason: b.blocker.reason.clone(),
        help_needed: b.blocker.help_needed.clone(),
        action: action.into(),
        comment: format!("Synthetic {action} note"),
    }
}

#[test]
fn isolated_result_journey() {
    let Some(base) = std::env::var_os("EASYFAB_RESULTS_FIXTURE") else {
        return;
    };
    let f = setup(&PathBuf::from(base));
    full_flow(&f);
    conflicts_and_integrity(&f);
    cross_stream_planning_recovery(&f);
    outdated_review_conflict_recovery(&f);
    immutable_submission_evidence_survives_branch_selection(&f);
    stale_closure_can_be_reopened(&f);
    unrelated_corruption_does_not_block_target(&f);
    legacy_activation(&f);
    let p = project(&f, vec!["engineer2".into()]);
    assert!(detail(&f.dir, &f.engineer, &f.id, &p.id).is_err());
    auth::set_user_active(&f.dir, &f.admin, "engineer", false).unwrap();
    assert!(detail(&f.dir, &f.engineer, &f.id, &p.id).is_err());
}
fn full_flow(f: &Fixture) {
    let p = project(f, vec!["engineer".into(), "engineer2".into()]);
    let profiles: Vec<_> = ["engineer", "engineer2"]
        .iter()
        .map(|id| {
            let path = workspace::profile_path(&f.dir, id).unwrap();
            let bytes = fs::read(&path).unwrap();
            (path, bytes)
        })
        .collect();
    let original_projects = fs::read(f.dir.join("projects.json")).unwrap();
    assert!(save_commitment(&f.dir, &f.engineer, &f.id, initial(&p)).is_err());
    assert!(save_commitment(&f.dir, &f.admin, &f.id, initial(&p)).is_err());
    let mut bad = initial(&p);
    bad.commitment.deliverables.clear();
    assert!(save_commitment(&f.dir, &f.supervisor, &f.id, bad).is_err());
    assert!(!is_active(&f.dir, &p.id).unwrap());
    let mut d = save_commitment(&f.dir, &f.supervisor, &f.id, initial(&p)).unwrap();
    assert!(is_active(&f.dir, &p.id).unwrap());
    assert!(d
        .history
        .iter()
        .any(|e| e.summary.contains("Initial synthetic agreement")));
    assert_eq!(d.project.status, "Not Started");
    assert!(detail(&f.dir, &f.engineer, "wrong-space", &p.id).is_err());
    assert!(save(f, &f.supervisor, &d, task("task_1", "delivery_1")).is_err());
    d = save(f, &f.engineer, &d, task("task_1", "delivery_1")).unwrap();
    let stale = row(&d, "task_1").revision.clone();
    let mut completed = row(&d, "task_1").activity.clone();
    completed.progress = 100;
    completed.status = domain::ActivityStatus::Done;
    d = save(f, &f.colleague, &d, completed.clone()).unwrap();
    assert_eq!(row(&d, "task_1").created_by, "engineer");
    assert_eq!(row(&d, "task_1").edited_by, "engineer2");
    assert!(d.reviews.is_empty());
    assert_eq!(d.project.status, "In Progress");
    assert!(save_activity(
        &f.dir,
        &f.engineer,
        &f.id,
        ActivityInput {
            project_id: p.id.clone(),
            expected_revision: Some(stale),
            activity: completed
        }
    )
    .is_err());
    d = save(f, &f.colleague, &d, task("task_2", "delivery_2")).unwrap();
    assert!(set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, true)).is_err());
    assert!(activities::save(
        &f.dir,
        &f.engineer,
        &f.id,
        activities::ActivityInput {
            id: None,
            expected_revision: None,
            project_id: p.id.clone(),
            wbs: String::new(),
            task_title: "legacy bypass".into(),
            start_date: p.start_date.clone(),
            due_date: p.target_date.clone(),
            milestone_gate: 25,
            at_risk: false,
            hours_spent: Some(1.0)
        }
    )
    .is_err());
    assert!(activities::set_progress(
        &f.dir,
        &f.engineer,
        &f.id,
        activities::ProgressInput {
            project_id: p.id.clone(),
            progress: 100,
            expected_progress: None
        }
    )
    .is_err());
    assert!(activities::attach(
        &f.dir,
        &f.engineer,
        &f.id,
        activities::AttachmentInput {
            project_id: p.id.clone(),
            activity_id: "task_1".into(),
            revision: row(&d, "task_1").revision.clone(),
            name: "x.pdf".into(),
            bytes: b"%PDF-x".to_vec()
        }
    )
    .is_err());
    assert!(activities::review(
        &f.dir,
        &f.supervisor,
        &f.id,
        activities::ReviewInput {
            project_id: p.id.clone(),
            owner_id: "engineer".into(),
            activity_id: "task_1".into(),
            revision: row(&d, "task_1").revision.clone(),
            accepted: true,
            comment: "bypass".into()
        }
    )
    .is_err());
    let compatibility = activities::detail(&f.dir, &f.supervisor, &f.id, &p.id).unwrap();
    assert!(!compatibility.can_edit && !compatibility.can_review);
    assert!(compatibility
        .entries
        .iter()
        .all(|e| !e.activity.supervisor_approved));
    let snapshot = crate::reporting::snapshot(&f.dir, &f.supervisor, &f.id, "2026-10-29").unwrap();
    assert!(snapshot
        .result_projects
        .iter()
        .any(|d| d.project.id == p.id));
    assert!(snapshot
        .projects
        .iter()
        .flat_map(|d| &d.entries)
        .all(|e| !e.activity.supervisor_approved));
    for name in ["../proof.pdf", "bad\nproof.pdf", "proof.jpg"] {
        assert!(attach(
            &f.dir,
            &f.engineer,
            &f.id,
            AttachmentInput {
                project_id: p.id.clone(),
                activity_id: "task_1".into(),
                expected_revision: row(&d, "task_1").revision.clone(),
                name: name.into(),
                bytes: b"%PDF-x".to_vec()
            }
        )
        .is_err());
    }
    d = upload(f, &d, "task_1");
    let e1 = row(&d, "task_1").evidence[0].id.clone();
    assert_eq!(
        evidence_bytes(&f.dir, &f.colleague, &f.id, &p.id, &e1).unwrap(),
        b"%PDF-synthetic evidence"
    );
    d = save_blocker(
        &f.dir,
        &f.engineer,
        &f.id,
        BlockerInput {
            project_id: p.id.clone(),
            blocker_id: None,
            expected_revision: None,
            activity_id: "task_1".into(),
            reason: "Waiting for access".into(),
            help_needed: "Coordinate access".into(),
            action: "report".into(),
            comment: "Synthetic report note".into(),
        },
    )
    .unwrap();
    assert!(save_blocker(&f.dir, &f.colleague, &f.id, blocker_input(&d, "attend")).is_err());
    d = save_blocker(&f.dir, &f.supervisor, &f.id, blocker_input(&d, "attend")).unwrap();
    assert!(d.blockers[0].blocker.first_attention_at.is_some());
    assert!(d.blockers[0].blocker.resolved_at.is_none());
    let mut independent = row(&d, "task_2").activity.clone();
    independent.progress = 50;
    d = save(f, &f.colleague, &d, independent).unwrap();
    assert!(d
        .history
        .iter()
        .any(|e| e.summary.contains("Synthetic attend note")));
    d = save_blocker(&f.dir, &f.supervisor, &f.id, blocker_input(&d, "resolve")).unwrap();
    assert!(d.blockers[0].blocker.resolved_at.is_some());
    assert_eq!(
        d.blockers[0].blocker.resolution_note.as_deref(),
        Some("Synthetic resolve note")
    );
    assert!(act(
        f,
        &f.engineer,
        &d,
        "delivery_1",
        domain::ReviewAction::Submit,
        None
    )
    .is_err());
    d = act(
        f,
        &f.engineer,
        &d,
        "delivery_1",
        domain::ReviewAction::Submit,
        Some(e1.clone()),
    )
    .unwrap();
    assert!(act(
        f,
        &f.engineer,
        &d,
        "delivery_1",
        domain::ReviewAction::Accept,
        None
    )
    .is_err());
    assert!(act(
        f,
        &f.admin,
        &d,
        "delivery_1",
        domain::ReviewAction::Accept,
        None
    )
    .is_err());
    let mut no_reason = review_input(&d, "delivery_1", domain::ReviewAction::Return, None);
    no_reason.comment.clear();
    assert!(review(&f.dir, &f.supervisor, &f.id, no_reason).is_err());
    d = act(
        f,
        &f.supervisor,
        &d,
        "delivery_1",
        domain::ReviewAction::Return,
        None,
    )
    .unwrap();
    d = act(
        f,
        &f.colleague,
        &d,
        "delivery_1",
        domain::ReviewAction::Submit,
        Some(e1.clone()),
    )
    .unwrap();
    d = act(
        f,
        &f.engineer,
        &d,
        "delivery_1",
        domain::ReviewAction::Withdraw,
        None,
    )
    .unwrap();
    d = act(
        f,
        &f.colleague,
        &d,
        "delivery_1",
        domain::ReviewAction::Submit,
        Some(e1),
    )
    .unwrap();
    d = act(
        f,
        &f.supervisor,
        &d,
        "delivery_1",
        domain::ReviewAction::Accept,
        None,
    )
    .unwrap();
    assert!(set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, true)).is_err());
    d = upload(f, &d, "task_2");
    let e2 = row(&d, "task_2").evidence[0].clone();
    d = act(
        f,
        &f.colleague,
        &d,
        "delivery_2",
        domain::ReviewAction::Submit,
        Some(e2.id.clone()),
    )
    .unwrap();
    d = act(
        f,
        &f.supervisor,
        &d,
        "delivery_2",
        domain::ReviewAction::Accept,
        None,
    )
    .unwrap();
    let path = project_root(&f.dir, &p.id).unwrap().join(&e2.relative_path);
    let bytes = fs::read(&path).unwrap();
    fs::write(&path, b"tampered").unwrap();
    assert!(set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, true)).is_err());
    fs::write(&path, &bytes).unwrap();
    assert!(set_closure(&f.dir, &f.engineer, &f.id, close_input(&d, true)).is_err());
    let mut no_confirm = close_input(&d, true);
    no_confirm.confirm_final_outcome = false;
    assert!(set_closure(&f.dir, &f.supervisor, &f.id, no_confirm).is_err());
    d = set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, true)).unwrap();
    assert_eq!(d.project.status, "Completed");
    assert!(save(f, &f.engineer, &d, row(&d, "task_2").activity.clone()).is_err());
    let fresh = auth::authenticate(&f.dir, "engineer2", "User1234").unwrap();
    assert_eq!(
        detail(&f.dir, &fresh, &f.id, &p.id).unwrap().project.status,
        "Completed"
    );
    let graph = read_graph(&f.dir, &p.id).unwrap();
    let current = graph.current("activity/task_2").unwrap().unwrap();
    let base = graph.commitment().unwrap().unwrap().revision;
    let late_branch = || {
        annotate(
            new_event(
                &f.engineer,
                &p.id,
                vec![current.id.clone()],
                "save_activity",
                current.payload.clone(),
            )
            .unwrap(),
            Some(&base),
            "Late offline branch",
        )
        .unwrap()
    };
    let first = late_branch();
    let second = late_branch();
    let root = project_root(&f.dir, &p.id).unwrap();
    for event in [&first, &second] {
        publish_at(&f.dir, &root, event, || Ok(())).unwrap();
    }
    assert!(resolve(
        &f.dir,
        &f.supervisor,
        &f.id,
        ResolveInput {
            project_id: p.id.clone(),
            stream: "activity/task_2".into(),
            expected_revisions: vec![first.id.clone(), second.id.clone()],
            keep_revision: first.id.clone(),
            comment: "Must reopen first".into()
        }
    )
    .is_err());
    for event in [&first, &second] {
        fs::remove_file(root.join("events").join(format!("{}.json", event.id))).unwrap();
    }
    d = set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, false)).unwrap();
    d = act(
        f,
        &f.supervisor,
        &d,
        "delivery_1",
        domain::ReviewAction::Revise,
        None,
    )
    .unwrap();
    assert!(set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, true)).is_err());
    let baseline = d.baseline.as_ref().unwrap().revision.clone();
    let mut change = initial(&p);
    change.expected_revision = Some(d.commitment.as_ref().unwrap().revision.clone());
    change.change_reason = "Synthetic scope refinement".into();
    change.commitment.final_outcome = "Refined final state".into();
    d = save_commitment(&f.dir, &f.supervisor, &f.id, change).unwrap();
    assert_ne!(d.commitment.as_ref().unwrap().revision, baseline);
    assert_eq!(d.baseline.as_ref().unwrap().revision, baseline);
    assert!(d
        .reviews
        .iter()
        .all(|r| r.status == domain::ReviewStatus::Preparing && r.decision.is_none()));
    assert!(d
        .history
        .iter()
        .any(|e| e.summary.contains("Synthetic scope refinement")));
    assert_eq!(
        fs::read(f.dir.join("projects.json")).unwrap(),
        original_projects
    );
    for (path, bytes) in profiles {
        assert_eq!(fs::read(path).unwrap(), bytes)
    }
}
fn conflicts_and_integrity(f: &Fixture) {
    let p = project(f, vec!["engineer".into(), "engineer2".into()]);
    let mut d = save_commitment(&f.dir, &f.supervisor, &f.id, initial(&p)).unwrap();
    save(f, &f.engineer, &d, task("fork_task", "delivery_1")).unwrap();
    let graph = read_graph(&f.dir, &p.id).unwrap();
    let original = graph.current("activity/fork_task").unwrap().unwrap();
    let base = graph.commitment().unwrap().unwrap().revision;
    let branch = |s: &auth::Session, progress: u8, note: &str| {
        let Payload::Activity(mut a) = original.payload.clone() else {
            panic!()
        };
        a.activity.progress = progress;
        a.activity.note = Some(note.into());
        annotate(
            new_event(
                s,
                &p.id,
                vec![original.id.clone()],
                "save_activity",
                Payload::Activity(a),
            )
            .unwrap(),
            Some(&base),
            "",
        )
        .unwrap()
    };
    let left = branch(&f.engineer, 50, "Left offline note");
    let right = branch(&f.colleague, 75, "Right offline note");
    publish(&f.dir, &f.engineer, &f.id, &left).unwrap();
    assert!(publish(&f.dir, &f.colleague, &f.id, &right).is_err());
    let root = project_root(&f.dir, &p.id).unwrap();
    publish_at(&f.dir, &root, &right, || Ok(())).unwrap();
    d = detail(&f.dir, &f.engineer, &f.id, &p.id).unwrap();
    assert_eq!(d.conflicts.len(), 1);
    assert!(d.activities.is_empty());
    assert_ne!(
        d.conflicts[0].revisions[0].summary,
        d.conflicts[0].revisions[1].summary
    );
    assert!(activities::detail(&f.dir, &f.supervisor, &f.id, &p.id).is_err());
    d = save(f, &f.engineer, &d, task("independent", "delivery_2")).unwrap();
    assert_eq!(d.conflicts.len(), 1);
    let input = || ResolveInput {
        project_id: p.id.clone(),
        stream: "activity/fork_task".into(),
        expected_revisions: vec![left.id.clone(), right.id.clone()],
        keep_revision: right.id.clone(),
        comment: "Synthetic conflict resolution retained".into(),
    };
    assert!(resolve(&f.dir, &f.engineer, &f.id, input()).is_err());
    d = resolve(&f.dir, &f.supervisor, &f.id, input()).unwrap();
    assert!(d.conflicts.is_empty());
    assert_eq!(row(&d, "fork_task").activity.progress, 75);
    assert!(d
        .history
        .iter()
        .any(|e| e.summary.contains("Synthetic conflict resolution retained")));
    for id in [&left.id, &right.id] {
        assert!(root.join("events").join(format!("{id}.json")).exists())
    }
    let graph = read_graph(&f.dir, &p.id).unwrap();
    let current = graph.current("activity/independent").unwrap().unwrap();
    let pending = annotate(
        new_event(
            &f.engineer,
            &p.id,
            vec![current.id.clone()],
            "save_activity",
            current.payload.clone(),
        )
        .unwrap(),
        Some(&base),
        "",
    )
    .unwrap();
    let mut change = initial(&p);
    change.expected_revision = Some(base);
    change.change_reason = "New committed revision".into();
    d = save_commitment(&f.dir, &f.supervisor, &f.id, change).unwrap();
    assert!(publish(&f.dir, &f.engineer, &f.id, &pending).is_err());
    let graph = read_graph(&f.dir, &p.id).unwrap();
    let current = graph.current("activity/independent").unwrap().unwrap();
    let missing = annotate(
        new_event(
            &f.engineer,
            &p.id,
            vec![current.id.clone()],
            "save_activity",
            current.payload.clone(),
        )
        .unwrap(),
        Some(&"f".repeat(64)),
        "",
    )
    .unwrap();
    publish_at(&f.dir, &root, &missing, || Ok(())).unwrap();
    assert!(detail(&f.dir, &f.supervisor, &f.id, &p.id)
        .err()
        .unwrap()
        .contains("Sincronización incompleta"));
    fs::remove_file(root.join("events").join(format!("{}.json", missing.id))).unwrap();
    let missing_parent = annotate(
        new_event(
            &f.engineer,
            &p.id,
            vec!["e".repeat(64)],
            "save_activity",
            current.payload.clone(),
        )
        .unwrap(),
        Some(&d.commitment.as_ref().unwrap().revision),
        "",
    )
    .unwrap();
    publish_at(&f.dir, &root, &missing_parent, || Ok(())).unwrap();
    assert!(read_graph(&f.dir, &p.id)
        .err()
        .unwrap()
        .contains("Sincronización incompleta"));
    fs::remove_file(
        root.join("events")
            .join(format!("{}.json", missing_parent.id)),
    )
    .unwrap();
    let Payload::Activity(mut invalid) = current.payload.clone() else {
        panic!()
    };
    invalid.activity.responsible_id = "not_assigned".into();
    let invalid = annotate(
        new_event(
            &f.engineer,
            &p.id,
            vec![current.id.clone()],
            "save_activity",
            Payload::Activity(invalid),
        )
        .unwrap(),
        Some(&d.commitment.as_ref().unwrap().revision),
        "",
    )
    .unwrap();
    publish_at(&f.dir, &root, &invalid, || Ok(())).unwrap();
    assert!(detail(&f.dir, &f.supervisor, &f.id, &p.id).is_err());
    fs::remove_file(root.join("events").join(format!("{}.json", invalid.id))).unwrap();
    let path = root.join("events").join(format!("{}.json", left.id));
    let bytes = fs::read(&path).unwrap();
    let mut forged: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    forged["comment"] = "forged".into();
    fs::write(&path, serde_json::to_vec(&forged).unwrap()).unwrap();
    assert!(detail(&f.dir, &f.supervisor, &f.id, &p.id).is_err());
    fs::write(path, bytes).unwrap();
    detail(&f.dir, &f.supervisor, &f.id, &p.id).unwrap();
}
fn legacy_activation(f: &Fixture) {
    let p = project(f, vec!["engineer".into(), "engineer2".into()]);
    let old = activities::save(
        &f.dir,
        &f.engineer,
        &f.id,
        activities::ActivityInput {
            id: None,
            expected_revision: None,
            project_id: p.id.clone(),
            wbs: String::new(),
            task_title: "Historic synthetic work".into(),
            start_date: p.start_date.clone(),
            due_date: p.target_date.clone(),
            milestone_gate: 100,
            at_risk: false,
            hours_spent: Some(3.0),
        },
    )
    .unwrap();
    let entry = &old.entries[0];
    let old = activities::attach(
        &f.dir,
        &f.engineer,
        &f.id,
        activities::AttachmentInput {
            project_id: p.id.clone(),
            activity_id: entry.activity.id.clone(),
            revision: entry.revision.clone(),
            name: "historic.pdf".into(),
            bytes: b"%PDF-historic".to_vec(),
        },
    )
    .unwrap();
    let entry = &old.entries[0];
    activities::review(
        &f.dir,
        &f.supervisor,
        &f.id,
        activities::ReviewInput {
            project_id: p.id.clone(),
            owner_id: entry.owner_id.clone(),
            activity_id: entry.activity.id.clone(),
            revision: entry.revision.clone(),
            accepted: true,
            comment: "Historic acceptance".into(),
        },
    )
    .unwrap();
    let profile = workspace::profile_path(&f.dir, "engineer").unwrap();
    let bytes = fs::read(&profile).unwrap();
    assert!(save_commitment(&f.dir, &f.supervisor, &f.id, initial(&p)).is_err());
    assert!(!is_active(&f.dir, &p.id).unwrap());
    let mut input = initial(&p);
    input.legacy_deliverable_id = Some("delivery_1".into());
    let d = save_commitment(&f.dir, &f.supervisor, &f.id, input).unwrap();
    assert_eq!(d.activities.len(), 1);
    assert_eq!(d.legacy_entries.len(), 1);
    assert!(d.legacy_entries[0].activity.supervisor_approved);
    assert_eq!(d.activities[0].activity.id, entry.activity.id);
    assert_eq!(d.activities[0].created_by, "engineer");
    assert!(d.reviews.is_empty());
    assert_ne!(d.project.status, "Completed");
    assert_eq!(
        evidence_bytes(
            &f.dir,
            &f.colleague,
            &f.id,
            &p.id,
            &entry.activity.evidence[0].id
        )
        .unwrap(),
        b"%PDF-historic"
    );
    assert_eq!(fs::read(profile).unwrap(), bytes);
}

fn cross_stream_planning_recovery(f: &Fixture) {
    let p = project(f, vec!["engineer".into(), "engineer2".into()]);
    let mut d = save_commitment(&f.dir, &f.supervisor, &f.id, initial(&p)).unwrap();
    let mut a = task("predecessor", "delivery_1");
    a.forecast_due = "2026-11-02".into();
    d = save(f, &f.engineer, &d, a).unwrap();
    let mut b = task("successor", "delivery_2");
    b.forecast_start = "2026-11-04".into();
    b.forecast_due = "2026-11-10".into();
    b.dependency_ids = vec!["predecessor".into()];
    save(f, &f.colleague, &d, b).unwrap();
    let graph = read_graph(&f.dir, &p.id).unwrap();
    let base = graph.commitment().unwrap().unwrap().revision;
    let old_a = graph.current("activity/predecessor").unwrap().unwrap();
    let old_b = graph.current("activity/successor").unwrap().unwrap();
    let Payload::Activity(mut a) = old_a.payload.clone() else {
        panic!()
    };
    a.activity.forecast_due = "2026-11-03".into();
    let Payload::Activity(mut b) = old_b.payload.clone() else {
        panic!()
    };
    b.activity.forecast_start = "2026-11-02".into();
    let left = annotate(
        new_event(
            &f.engineer,
            &p.id,
            vec![old_a.id.clone()],
            "save_activity",
            Payload::Activity(a),
        )
        .unwrap(),
        Some(&base),
        "",
    )
    .unwrap();
    let right = annotate(
        new_event(
            &f.colleague,
            &p.id,
            vec![old_b.id.clone()],
            "save_activity",
            Payload::Activity(b),
        )
        .unwrap(),
        Some(&base),
        "",
    )
    .unwrap();
    publish(&f.dir, &f.engineer, &f.id, &left).unwrap();
    publish_at(
        &f.dir,
        &project_root(&f.dir, &p.id).unwrap(),
        &right,
        || Ok(()),
    )
    .unwrap();
    d = detail(&f.dir, &f.engineer, &f.id, &p.id).unwrap();
    assert!(!d.plan_issues.is_empty());
    assert!(d.conflicts.is_empty());
    assert_eq!(d.project.status, "On Hold");
    assert!(set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, true)).is_err());
    let mut corrected = row(&d, "successor").activity.clone();
    corrected.forecast_start = "2026-11-03".into();
    d = save(f, &f.colleague, &d, corrected).unwrap();
    assert!(d.plan_issues.is_empty());
    assert_eq!(d.project.status, "In Progress");
}

fn outdated_review_conflict_recovery(f: &Fixture) {
    let p = project(f, vec!["engineer".into(), "engineer2".into()]);
    let mut input = initial(&p);
    for d in &mut input.commitment.deliverables {
        d.criteria[0].evidence_required = false;
    }
    let mut d = save_commitment(&f.dir, &f.supervisor, &f.id, input).unwrap();
    d = act(
        f,
        &f.engineer,
        &d,
        "delivery_1",
        domain::ReviewAction::Submit,
        None,
    )
    .unwrap();
    let graph = read_graph(&f.dir, &p.id).unwrap();
    let submitted = graph.current("review/delivery_1").unwrap().unwrap().clone();
    let c1 = graph.commitment().unwrap().unwrap().revision;
    d = act(
        f,
        &f.supervisor,
        &d,
        "delivery_1",
        domain::ReviewAction::Return,
        None,
    )
    .unwrap();
    let returned = d.reviews[0].revision.clone();
    let Payload::Review(mut withdrawn) = submitted.payload.clone() else {
        panic!()
    };
    withdrawn.status = domain::ReviewStatus::Withdrawn;
    withdrawn.decision = None;
    let withdrawal = annotate(
        new_event(
            &f.engineer,
            &p.id,
            vec![submitted.id.clone()],
            "withdraw",
            Payload::Review(withdrawn),
        )
        .unwrap(),
        Some(&c1),
        "",
    )
    .unwrap();
    publish_at(
        &f.dir,
        &project_root(&f.dir, &p.id).unwrap(),
        &withdrawal,
        || Ok(()),
    )
    .unwrap();
    let mut changed = initial(&p);
    for d in &mut changed.commitment.deliverables {
        d.criteria[0].evidence_required = false;
    }
    changed.expected_revision = Some(c1);
    changed.change_reason = "Refine commitment with review conflict".into();
    d = save_commitment(&f.dir, &f.supervisor, &f.id, changed).unwrap();
    assert_eq!(d.conflicts.len(), 1);
    d = resolve(
        &f.dir,
        &f.supervisor,
        &f.id,
        ResolveInput {
            project_id: p.id.clone(),
            stream: "review/delivery_1".into(),
            expected_revisions: vec![returned.clone(), withdrawal.id.clone()],
            keep_revision: withdrawal.id.clone(),
            comment: "Reconcile old review under new commitment".into(),
        },
    )
    .unwrap();
    assert!(d.conflicts.is_empty());
    let r = &d.reviews[0];
    assert_eq!(r.status, domain::ReviewStatus::Preparing);
    assert_eq!(
        r.commitment_revision,
        d.commitment.as_ref().unwrap().revision
    );
    assert!(r.submission.is_none() && r.decision.is_none());
    d = act(
        f,
        &f.colleague,
        &d,
        "delivery_1",
        domain::ReviewAction::Submit,
        None,
    )
    .unwrap();
    assert_eq!(d.reviews[0].status, domain::ReviewStatus::Submitted);
    let root = project_root(&f.dir, &p.id).unwrap();
    for id in [returned, withdrawal.id] {
        assert!(root.join("events").join(format!("{id}.json")).exists());
    }
}

fn immutable_submission_evidence_survives_branch_selection(f: &Fixture) {
    let p = project(f, vec!["engineer".into(), "engineer2".into()]);
    let mut input = initial(&p);
    input.commitment.deliverables[1].criteria[0].evidence_required = false;
    let mut d = save_commitment(&f.dir, &f.supervisor, &f.id, input).unwrap();
    d = save(f, &f.engineer, &d, task("evidence_task", "delivery_1")).unwrap();
    let graph = read_graph(&f.dir, &p.id).unwrap();
    let original = graph
        .current("activity/evidence_task")
        .unwrap()
        .unwrap()
        .clone();
    let base = graph.commitment().unwrap().unwrap().revision;
    d = upload(f, &d, "evidence_task");
    let attachment_revision = row(&d, "evidence_task").revision.clone();
    let evidence = row(&d, "evidence_task").evidence[0].clone();
    // A missing optional attachment elsewhere must not block this delivery.
    d = save(f, &f.colleague, &d, task("optional_task", "delivery_2")).unwrap();
    d = upload(f, &d, "optional_task");
    let unrelated = row(&d, "optional_task").evidence[0].clone();
    let root = project_root(&f.dir, &p.id).unwrap();
    let unrelated_path = root.join(&unrelated.relative_path);
    let unrelated_bytes = fs::read(&unrelated_path).unwrap();
    fs::remove_file(&unrelated_path).unwrap();
    d = act(
        f,
        &f.engineer,
        &d,
        "delivery_1",
        domain::ReviewAction::Submit,
        Some(evidence.id.clone()),
    )
    .unwrap();
    d = act(
        f,
        &f.supervisor,
        &d,
        "delivery_1",
        domain::ReviewAction::Accept,
        None,
    )
    .unwrap();
    d = act(
        f,
        &f.colleague,
        &d,
        "delivery_2",
        domain::ReviewAction::Submit,
        None,
    )
    .unwrap();
    act(
        f,
        &f.supervisor,
        &d,
        "delivery_2",
        domain::ReviewAction::Accept,
        None,
    )
    .unwrap();
    let alternative = annotate(
        new_event(
            &f.colleague,
            &p.id,
            vec![original.id.clone()],
            "save_activity",
            original.payload.clone(),
        )
        .unwrap(),
        Some(&base),
        "Offline snapshot before attachment",
    )
    .unwrap();
    publish_at(&f.dir, &root, &alternative, || Ok(())).unwrap();
    d = resolve(
        &f.dir,
        &f.supervisor,
        &f.id,
        ResolveInput {
            project_id: p.id.clone(),
            stream: "activity/evidence_task".into(),
            expected_revisions: vec![attachment_revision, alternative.id.clone()],
            keep_revision: alternative.id,
            comment: "Select alternate work snapshot; evidence stays immutable".into(),
        },
    )
    .unwrap();
    assert!(row(&d, "evidence_task").evidence.is_empty());
    assert_eq!(
        d.reviews
            .iter()
            .find(|r| r.deliverable_id == "delivery_1")
            .unwrap()
            .status,
        domain::ReviewStatus::Accepted
    );
    assert_eq!(
        evidence_bytes(&f.dir, &f.engineer, &f.id, &p.id, &evidence.id).unwrap(),
        b"%PDF-synthetic evidence"
    );
    d = set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, true)).unwrap();
    assert_eq!(d.project.status, "Completed");
    fs::write(unrelated_path, unrelated_bytes).unwrap();
}

fn stale_closure_can_be_reopened(f: &Fixture) {
    let p = project(f, vec!["engineer".into(), "engineer2".into()]);
    let mut input = initial(&p);
    for d in &mut input.commitment.deliverables {
        d.criteria[0].evidence_required = false;
    }
    let mut d = save_commitment(&f.dir, &f.supervisor, &f.id, input).unwrap();
    for id in ["delivery_1", "delivery_2"] {
        d = act(f, &f.engineer, &d, id, domain::ReviewAction::Submit, None).unwrap();
        d = act(f, &f.supervisor, &d, id, domain::ReviewAction::Accept, None).unwrap();
    }
    d = set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, true)).unwrap();
    let graph = read_graph(&f.dir, &p.id).unwrap();
    let closed = graph.current("closure").unwrap().unwrap().payload.clone();
    let c1 = graph.commitment().unwrap().unwrap().revision;
    d = set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, false)).unwrap();
    let reopen_revision = d.closure.as_ref().unwrap().revision.clone();
    let late = annotate(
        new_event(&f.supervisor, &p.id, vec![reopen_revision], "close", closed).unwrap(),
        Some(&c1),
        "Late closure from prior commitment",
    )
    .unwrap();
    let mut change = initial(&p);
    for d in &mut change.commitment.deliverables {
        d.criteria[0].evidence_required = false;
    }
    change.expected_revision = Some(c1);
    change.change_reason = "Current commitment changed before offline closure arrived".into();
    save_commitment(&f.dir, &f.supervisor, &f.id, change).unwrap();
    publish_at(&f.dir, &project_root(&f.dir, &p.id).unwrap(), &late, || {
        Ok(())
    })
    .unwrap();
    d = detail(&f.dir, &f.supervisor, &f.id, &p.id).unwrap();
    assert!(d.conflicts.is_empty());
    assert!(!d.plan_issues.is_empty());
    assert_eq!(d.project.status, "On Hold");
    assert!(d.closure.as_ref().unwrap().closed);
    assert!(set_closure(&f.dir, &f.engineer, &f.id, close_input(&d, false)).is_err());
    d = set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, false)).unwrap();
    assert!(d.plan_issues.is_empty());
    assert!(!d.closure.as_ref().unwrap().closed);
    assert_eq!(d.project.status, "In Progress");
    assert!(d.history.iter().any(|e| e.revision == late.id));
    assert!(set_closure(&f.dir, &f.supervisor, &f.id, close_input(&d, true)).is_err());
}

fn unrelated_corruption_does_not_block_target(f: &Fixture) {
    let bad = project(f, vec!["engineer".into(), "engineer2".into()]);
    let bad_detail = save_commitment(&f.dir, &f.supervisor, &f.id, initial(&bad)).unwrap();
    let good = project(f, vec!["engineer".into(), "engineer2".into()]);
    let mut good_detail = save_commitment(&f.dir, &f.supervisor, &f.id, initial(&good)).unwrap();
    let path = project_root(&f.dir, &bad.id)
        .unwrap()
        .join("events")
        .join(format!(
            "{}.json",
            bad_detail.commitment.as_ref().unwrap().revision
        ));
    let bytes = fs::read(&path).unwrap();
    fs::write(&path, b"{invalid JSON").unwrap();
    assert!(detail(&f.dir, &f.supervisor, &f.id, &bad.id).is_err());
    good_detail = save(
        f,
        &f.engineer,
        &good_detail,
        task("isolated_work", "delivery_1"),
    )
    .unwrap();
    assert_eq!(good_detail.activities.len(), 1);
    assert_eq!(
        detail(&f.dir, &f.colleague, &f.id, &good.id)
            .unwrap()
            .activities
            .len(),
        1
    );
    fs::write(path, bytes).unwrap();
}
