use super::*;
use std::process::Command;
#[test]
fn work_journey_isolated() {
    let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join(format!("work-{}", auth::revision()));
    fs::create_dir_all(&base).unwrap();
    let result = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "activities::tests::isolated_work_journey",
            "--nocapture",
        ])
        .env("EASYFAB_WORK_FIXTURE", &base)
        .env("LOCALAPPDATA", base.join("local"))
        .output()
        .unwrap();
    fs::remove_dir_all(&base).unwrap();
    assert!(
        result.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
}
fn input(project_id: &str) -> ActivityInput {
    ActivityInput {
        id: None,
        expected_revision: None,
        project_id: project_id.into(),
        wbs: "FAB-1.1".into(),
        task_title: "Synthetic work".into(),
        start_date: "2026-10-29".into(),
        due_date: "2026-11-01".into(),
        milestone_gate: 25,
        at_risk: false,
        hours_spent: Some(2.5),
    }
}
fn review_input(entry: &Entry, accepted: bool) -> ReviewInput {
    ReviewInput {
        project_id: entry.activity.project_id.clone(),
        owner_id: entry.owner_id.clone(),
        activity_id: entry.activity.id.clone(),
        revision: entry.revision.clone(),
        accepted,
        comment: "Synthetic decision".into(),
    }
}
#[test]
fn isolated_work_journey() {
    let Some(base) = std::env::var_os("EASYFAB_WORK_FIXTURE") else {
        return;
    };
    let base = PathBuf::from(base);
    let root = base.join("shared");
    fs::create_dir_all(&root).unwrap();
    let info = workspace::initialize(&root, &base.join("local/EasyFAB")).unwrap();
    let dir = PathBuf::from(&info.data_dir);
    let temp =
        auth::provision_initial_admin(&dir, "admin".into(), "Synthetic Admin".into()).unwrap();
    let s = auth::authenticate(&dir, "admin", &temp).unwrap();
    auth::change_password(&dir, &s, "Admin123").unwrap();
    let admin = auth::authenticate(&dir, "admin", "Admin123").unwrap();
    let mut users = vec![];
    for (id, role) in [
        ("engineer", "engineer"),
        ("engineer2", "engineer"),
        ("supervisor", "supervisor"),
    ] {
        let temp = auth::create_user(
            &dir,
            &admin,
            auth::NewUser {
                id: id.into(),
                name: id.into(),
                role: role.into(),
            },
        )
        .unwrap();
        let s = auth::authenticate(&dir, id, &temp).unwrap();
        assert!(save(&dir, &s, &info.id, input("unknown")).is_err());
        auth::change_password(&dir, &s, "User1234").unwrap();
        users.push(auth::authenticate(&dir, id, "User1234").unwrap());
    }
    let project = projects::create(
        &dir,
        &users[2],
        &info.id,
        projects::NewProject {
            wbs: "FAB-1".into(),
            name: "Synthetic project".into(),
            process_area: "FAB".into(),
            engineer_ids: vec!["engineer".into()],
            start_date: "2026-10-29".into(),
            target_date: "2026-11-01".into(),
        },
    )
    .unwrap();
    // Isolated lifecycle regressions, including all readers and persisted re-entry.
    for trigger in ["hours", "activity", "general"] {
        let p = projects::create(&dir, &users[2], &info.id, projects::NewProject {
            wbs: String::new(), name: format!("Lifecycle {trigger}"), process_area: "FAB".into(),
            engineer_ids: vec!["engineer".into()], start_date: "2026-10-29".into(), target_date: "2026-11-01".into(),
        }).unwrap();
        let shared_path = dir.join("projects.json");
        let shared_before = fs::read(&shared_path).unwrap();
        let mut empty = input(&p.id); empty.milestone_gate = 0; empty.hours_spent = Some(0.0);
        let initial = save(&dir, &users[0], &info.id, empty).unwrap();
        assert_eq!(initial.project.status, "Not Started");
        assert!(set_progress(&dir, &users[1], &info.id, ProgressInput { project_id: p.id.clone(), progress: 25, expected_progress: None }).is_err());
        let mut work = input(&p.id);
        work.id = Some(initial.entries[0].activity.id.clone()); work.expected_revision = Some(initial.entries[0].revision.clone());
        work.milestone_gate = if trigger == "activity" { 25 } else { 0 };
        work.hours_spent = Some(if trigger == "hours" { 0.5 } else { 0.0 });
        let started = if trigger == "general" {
            set_progress(&dir, &users[0], &info.id, ProgressInput { project_id: p.id.clone(), progress: 25, expected_progress: None }).unwrap()
        } else { save(&dir, &users[0], &info.id, work).unwrap() };
        assert_eq!(started.project.status, "In Progress");
        let mut reset = input(&p.id); reset.id = Some(started.entries[0].activity.id.clone());
        reset.expected_revision = Some(started.entries[0].revision.clone()); reset.milestone_gate = 0; reset.hours_spent = Some(0.0);
        save(&dir, &users[0], &info.id, reset).unwrap();
        if trigger == "general" { set_progress(&dir, &users[0], &info.id, ProgressInput { project_id: p.id.clone(), progress: 0, expected_progress: Some(25) }).unwrap(); }
        for reader in [&users[0], &users[2], &admin] {
            let overview = projects::overview(&dir, reader, &info.id).unwrap();
            assert_eq!(overview.projects.iter().find(|item| item.id == p.id).unwrap().status, "In Progress");
        }
        let fresh = auth::authenticate(&dir, "engineer", "User1234").unwrap();
        assert_eq!(detail(&dir, &fresh, &info.id, &p.id).unwrap().project.status, "In Progress");
        assert_eq!(fs::read(&shared_path).unwrap(), shared_before);
        for status in ["On Hold", "Completed"] {
            let mut doc: Value = serde_json::from_slice(&fs::read(&shared_path).unwrap()).unwrap();
            for item in doc["projects"].as_array_mut().unwrap() { if item["id"] == p.id { item["status"] = json!(status); } }
            fs::write(&shared_path, serde_json::to_vec(&doc).unwrap()).unwrap();
            assert_eq!(detail(&dir, &fresh, &info.id, &p.id).unwrap().project.status, status);
        }
    }
    let profile_path = workspace::profile_path(&dir, "engineer").unwrap();
    let mut original: Value = serde_json::from_slice(&fs::read(&profile_path).unwrap()).unwrap();
    original["legacy_metadata"] = json!({"keep":true});
    fs::write(&profile_path, serde_json::to_vec(&original).unwrap()).unwrap();
    let other_path = workspace::profile_path(&dir, "engineer2").unwrap();
    let other_bytes = fs::read(&other_path).unwrap();
    assert!(save(&dir, &admin, &info.id, input(&project.id)).is_err());
    // Supervisor can now add activities to a project
    assert!(save(&dir, &users[2], &info.id, input(&project.id)).is_ok());
    assert!(save(&dir, &users[1], &info.id, input(&project.id)).is_err());
    assert!(save(&dir, &users[0], "wrong", input(&project.id)).is_err());
    for bad in [101, 1, 99] {
        let mut v = input(&project.id);
        v.milestone_gate = bad;
        assert!(save(&dir, &users[0], &info.id, v).is_err());
    }
    let mut bad = input(&project.id);
    bad.due_date = "2026-02-30".into();
    assert!(save(&dir, &users[0], &info.id, bad).is_err());
    let result = save(&dir, &users[0], &info.id, input(&project.id)).unwrap();
    let first = &result.entries[0];
    assert_eq!(first.activity.milestone_gate, 25);
    assert!(!first.activity.supervisor_approved);
    let mut update = input(&project.id);
    update.id = Some(first.activity.id.clone());
    update.expected_revision = Some("stale".into());
    assert!(save(&dir, &users[0], &info.id, update).is_err());
    assert!(review(&dir, &users[2], &info.id, review_input(first, true)).is_err());
    let fresh = auth::authenticate(&dir, "engineer", "User1234").unwrap();
    let restored = detail(&dir, &fresh, &info.id, &project.id).unwrap();
    assert_eq!(restored.entries[0].revision, first.revision);
    let mut update = input(&project.id);
    update.id = Some(first.activity.id.clone());
    update.expected_revision = Some(first.revision.clone());
    update.milestone_gate = 100;
    let result = save(&dir, &fresh, &info.id, update).unwrap();
    let requested = &result.entries[0];
    assert!(!requested.activity.supervisor_approved);
    assert_eq!(requested.activity.status, "In Progress");
    assert_eq!(result.project.status, "In Progress");
    assert!(review(&dir, &users[2], &info.id, review_input(requested, true)).is_err());
    let attachment = || AttachmentInput {
        project_id: project.id.clone(),
        activity_id: requested.activity.id.clone(),
        revision: requested.revision.clone(),
        name: "synthetic.pdf".into(),
        bytes: b"%PDF-1.4\nSynthetic fixture".to_vec(),
    };
    let mut bad = attachment();
    bad.name = "../outside.pdf".into();
    assert!(attach(&dir, &fresh, &info.id, bad).is_err());
    let mut bad = attachment();
    bad.bytes = b"not a pdf".to_vec();
    assert!(attach(&dir, &fresh, &info.id, bad).is_err());
    let result = attach(&dir, &fresh, &info.id, attachment()).unwrap();
    let attached = &result.entries[0];
    assert!(attach(&dir, &fresh, &info.id, attachment()).is_err());
    let e = &attached.activity.evidence[0];
    assert_eq!(
        evidence_bytes(
            &dir,
            &users[2],
            &info.id,
            &project.id,
            "engineer",
            &attached.activity.id,
            &e.id
        )
        .unwrap(),
        b"%PDF-1.4\nSynthetic fixture"
    );
    assert!(evidence_bytes(
        &dir,
        &users[1],
        &info.id,
        &project.id,
        "engineer",
        &attached.activity.id,
        &e.id
    )
    .is_err());
    assert!(review(&dir, &admin, &info.id, review_input(attached, true)).is_err());
    assert!(review(&dir, &fresh, &info.id, review_input(attached, true)).is_err());
    let result = review(&dir, &users[2], &info.id, review_input(attached, true)).unwrap();
    assert!(result.entries[0].activity.supervisor_approved);
    // Approval is projected from signed Supervisor records, never the profile flag.
    let mut value: Value = serde_json::from_slice(&fs::read(&profile_path).unwrap()).unwrap();
    value["subactivities"][0]["supervisor_approved"] = json!(true);
    fs::write(&profile_path, serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(
        detail(&dir, &fresh, &info.id, &project.id).unwrap().entries[0]
            .activity
            .supervisor_approved
    );
    let mut update = input(&project.id);
    update.id = Some(attached.activity.id.clone());
    update.expected_revision = Some(attached.revision.clone());
    update.task_title = "Revised work".into();
    update.milestone_gate = 100;
    let changed = save(&dir, &fresh, &info.id, update).unwrap();
    assert!(!changed.entries[0].activity.supervisor_approved);
    assert!(changed.entries[0].decision.is_none());
    let result = review(
        &dir,
        &users[2],
        &info.id,
        review_input(&changed.entries[0], false),
    )
    .unwrap();
    assert!(!result.entries[0].decision.as_ref().unwrap().accepted);
    // All unrelated profile content and the other account are preserved.
    let value: Value = serde_json::from_slice(&fs::read(&profile_path).unwrap()).unwrap();
    assert_eq!(value["credential"], original["credential"]);
    assert_eq!(value["legacy_metadata"], original["legacy_metadata"]);
    assert_eq!(fs::read(other_path).unwrap(), other_bytes);
    let evidence_path = profile_path.parent().unwrap().join(&e.relative_path);
    fs::write(&evidence_path, b"changed").unwrap();
    assert!(review(
        &dir,
        &users[2],
        &info.id,
        review_input(&changed.entries[0], true)
    )
    .is_err());
    let saved = fs::read(&profile_path).unwrap();
    fs::write(&profile_path, b"{broken").unwrap();
    assert!(detail(&dir, &fresh, &info.id, &project.id).is_err());
    assert!(save(&dir, &fresh, &info.id, input(&project.id)).is_err());
    assert_eq!(fs::read(&profile_path).unwrap(), b"{broken");
    fs::write(&profile_path, saved).unwrap();
    auth::reset_password(&dir, &admin, "engineer").unwrap();
    assert!(detail(&dir, &fresh, &info.id, &project.id).is_err());
}
#[test]
fn upload_limits_and_untrusted_fields() {
    assert!(attachment_type("x.pdf", b"").is_err());
    assert!(attachment_type("x.exe", b"%PDF-").is_err());
    assert!(attachment_type("x.pdf", &vec![0; 20 * 1024 * 1024 + 1]).is_err());
    let mut value = serde_json::to_value(json!({"id":null,"expected_revision":null,"project_id":"p","wbs":"w","task_title":"t","start_date":"2026-10-29","due_date":"2026-10-30","milestone_gate":25,"at_risk":false})).unwrap();
    value["supervisor_approved"] = json!(true);
    assert!(serde_json::from_value::<ActivityInput>(value).is_err());
}
