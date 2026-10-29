use super::*;
use std::{fs, path::PathBuf, process::Command};

#[test]
fn project_journey_isolated() {
    let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join(format!("projects-{}", auth::revision()));
    fs::create_dir_all(&base).unwrap();
    let result = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "projects::tests::isolated_project_journey",
            "--nocapture",
        ])
        .env("EASYFAB_PROJECT_FIXTURE", &base)
        .env("LOCALAPPDATA", base.join("local"))
        .output()
        .unwrap();
    fs::remove_dir_all(base).unwrap();
    assert!(
        result.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
}
fn input() -> NewProject {
    NewProject {
        wbs: " FÁB-01 ".into(),
        name: " Synthetic project ".into(),
        process_area: " FAB ".into(),
        lead_engineer_id: "engineer".into(),
        start_date: "2026-10-28".into(),
        target_date: "2026-11-01".into(),
    }
}
#[test]
fn isolated_project_journey() {
    let Some(base) = std::env::var_os("EASYFAB_PROJECT_FIXTURE") else {
        return;
    };
    let base = PathBuf::from(base);
    let root = base.join("shared");
    fs::create_dir_all(&root).unwrap();
    let info = workspace::initialize(&root, &base.join("local/EasyFAB")).unwrap();
    let dir = PathBuf::from(&info.data_dir);
    let temp =
        auth::provision_initial_admin(&dir, "admin".into(), "Synthetic Admin".into()).unwrap();
    let restricted = auth::authenticate(&dir, "admin", &temp).unwrap();
    assert!(overview(&dir, &restricted, &info.id).is_err());
    assert!(create(&dir, &restricted, &info.id, input())
        .unwrap_err()
        .contains("sesión normal"));
    assert!(create(&dir, &restricted, &info.id, input()).is_err());
    auth::change_password(&dir, &restricted, "Admin123").unwrap();
    let admin = auth::authenticate(&dir, "admin", "Admin123").unwrap();
    let mut sessions = Vec::new();
    for role in ["engineer", "supervisor"] {
        let temp = auth::create_user(
            &dir,
            &admin,
            auth::NewUser {
                id: role.into(),
                name: role.into(),
                role: role.into(),
            },
        )
        .unwrap();
        let s = auth::authenticate(&dir, role, &temp).unwrap();
        assert!(overview(&dir, &s, &info.id).is_err());
        assert!(create(&dir, &s, &info.id, input()).is_err());
        auth::change_password(&dir, &s, "User1234").unwrap();
        sessions.push(auth::authenticate(&dir, role, "User1234").unwrap());
    }
    assert!(!overview(&dir, &admin, &info.id).unwrap().can_create);
    let temp = auth::create_user(
        &dir,
        &admin,
        auth::NewUser {
            id: "engineer2".into(),
            name: "Second Engineer".into(),
            role: "engineer".into(),
        },
    )
    .unwrap();
    let second_engineer = auth::authenticate(&dir, "engineer2", &temp).unwrap();
    auth::change_password(&dir, &second_engineer, "User5678").unwrap();
    assert_eq!(auth::team(&dir).unwrap().members.len(), 4);
    assert!(overview(&dir, &sessions[1], &info.id).unwrap().can_create);
    let original = fs::read(dir.join("projects.json")).unwrap();
    let key = fs::read(base.join("local/EasyFAB/master.key")).unwrap();
    assert!(overview(&dir, &sessions[0], &info.id).unwrap().projects.is_empty());
    assert!(overview(&dir, &sessions[0], "wrong-workspace").is_err());
    assert!(create(&dir, &sessions[0], &info.id, input())
        .unwrap_err()
        .contains("sesión normal"));
    assert!(create(&dir, &sessions[0], &info.id, input()).is_err());
    assert!(overview(&dir, &sessions[1], &info.id)
        .unwrap()
        .projects
        .is_empty());
    assert!(create(&dir, &sessions[1], "wrong-workspace", input()).is_err());
    assert!(create(&dir, &admin, &info.id, input()).is_err()); // Admin manages accounts; Supervisor registers projects.
    for field in [
        "lead",
        "supervisor",
        "admin",
        "date",
        "order",
        "name",
        "wbs",
        "area",
    ] {
        let mut bad = input();
        match field {
            "lead" => bad.lead_engineer_id = "missing".into(),
            "supervisor" => bad.lead_engineer_id = "supervisor".into(),
            "admin" => bad.lead_engineer_id = "admin".into(),
            "date" => bad.start_date = "2026-02-30".into(),
            "order" => bad.target_date = "2026-01-01".into(),
            "name" => bad.name = "  ".into(),
            "wbs" => bad.wbs = "bad\ncode".into(),
            _ => bad.process_area = "".into(),
        }
        assert!(create(&dir, &sessions[1], &info.id, bad).is_err());
    }
    assert_eq!(fs::read(dir.join("projects.json")).unwrap(), original);
    let first = create(&dir, &sessions[1], &info.id, input()).unwrap();
    assert_eq!(first.name, "Synthetic project");
    assert_eq!(first.status, "Not Started");
    assert_eq!(first.id.len(), 68);
    assert!(create(&dir, &sessions[1], &info.id, input()).is_err());
    let mut duplicate = input();
    duplicate.wbs = "fáb-01".into();
    assert!(create(&dir, &sessions[1], &info.id, duplicate).is_err());
    // Existing fields on both document and project survive future appends.
    let path = dir.join("projects.json");
    let mut value: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    value["legacy_metadata"] = serde_json::json!({"keep": true});
    value["projects"][0]["legacy_note"] = "keep".into();
    fs::write(&path, serde_json::to_vec(&value).unwrap()).unwrap();
    let mut second = input();
    second.wbs = "FAB-02".into();
    second.lead_engineer_id = "engineer2".into();
    let second = create(&dir, &sessions[1], &info.id, second).unwrap();
    assert_ne!(first.id, second.id);
    let own = overview(&dir, &sessions[0], &info.id).unwrap();
    assert_eq!(own.projects.len(), 1);
    assert_eq!(own.projects[0].id, first.id);
    assert!(!own.can_create);
    assert_eq!(own.leads.len(), 1);
    assert_eq!(own.leads[0].id, "engineer");
    let fresh_engineer = auth::authenticate(&dir, "engineer2", "User5678").unwrap();
    let own = overview(&dir, &fresh_engineer, &info.id).unwrap();
    assert_eq!(own.projects.len(), 1);
    assert_eq!(own.projects[0].id, second.id);
    // Fresh authentication and workspace opening model restart, no cached list.
    let reopened = workspace::open(&root, Some(&info.id)).unwrap();
    let fresh = auth::authenticate(&dir, "admin", "Admin123").unwrap();
    assert_eq!(
        overview(&dir, &fresh, &reopened.id).unwrap().projects.len(),
        2
    );
    let saved = fs::read(&path).unwrap();
    let value: serde_json::Value = serde_json::from_slice(&saved).unwrap();
    assert_eq!(value["legacy_metadata"]["keep"], true);
    assert_eq!(value["projects"][0]["legacy_note"], "keep");
    // Fault at publication boundary preserves original bytes and cleans staging.
    let (doc, bytes) = storage::read(&dir).unwrap();
    // A locally observed intervening change must never be overwritten.
    let mut changed = saved.clone();
    changed.push(b'\n');
    assert!(storage::save(&dir, &doc, &bytes, || {
        fs::write(&path, &changed).unwrap();
        Ok(())
    })
    .is_err());
    assert_eq!(fs::read(&path).unwrap(), changed);
    fs::write(&path, &saved).unwrap();
    assert!(storage::save(&dir, &doc, &bytes, || Err("Synthetic write failure".into())).is_err());
    assert_eq!(fs::read(&path).unwrap(), saved);
    assert!(!fs::read_dir(&dir).unwrap().any(|p| p
        .unwrap()
        .path()
        .extension()
        .is_some_and(|e| e == "tmp")));
    // Actual OS replacement failure: read-only destination on Windows.
    #[cfg(windows)]
    {
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();
        assert!(storage::save(&dir, &doc, &bytes, || Ok(())).is_err());
        assert_eq!(fs::read(&path).unwrap(), saved);
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();
    }
    fs::write(&path, b"{broken").unwrap();
    assert!(overview(&dir, &admin, &info.id).is_err());
    assert!(overview(&dir, &sessions[0], &info.id).is_err());
    let mut third = input();
    third.wbs = "FAB-03".into();
    assert!(create(&dir, &sessions[1], &info.id, third.clone()).is_err());
    assert_eq!(fs::read(&path).unwrap(), b"{broken");
    fs::write(&path, &saved).unwrap();
    for corrupt in [
        serde_json::json!({"version": 2, "projects": []}),
        serde_json::json!({"version": 1, "projects": [{"id": "missing-fields"}]}),
        {
            let mut duplicate = value.clone();
            let first = duplicate["projects"][0].clone();
            duplicate["projects"].as_array_mut().unwrap().push(first);
            duplicate
        },
    ] {
        let corrupt = serde_json::to_vec(&corrupt).unwrap();
        fs::write(&path, &corrupt).unwrap();
        assert!(overview(&dir, &admin, &info.id).is_err());
        assert!(create(&dir, &sessions[1], &info.id, third.clone()).is_err());
        assert_eq!(fs::read(&path).unwrap(), corrupt);
    }
    fs::write(&path, &saved).unwrap();
    auth::set_user_active(&dir, &admin, "engineer", false).unwrap();
    assert!(overview(&dir, &sessions[0], &info.id).is_err());
    auth::reset_password(&dir, &admin, "engineer2").unwrap();
    assert!(overview(&dir, &fresh_engineer, &info.id).is_err());
    assert!(create(&dir, &sessions[1], &info.id, third.clone()).is_err());
    auth::create_user(
        &dir,
        &admin,
        auth::NewUser {
            id: "extra_supervisor".into(),
            name: "Invalid Team Configuration".into(),
            role: "supervisor".into(),
        },
    )
    .unwrap();
    assert!(!overview(&dir, &sessions[1], &info.id).unwrap().can_create);
    assert!(create(&dir, &sessions[1], &info.id, third.clone()).is_err());
    auth::set_user_active(&dir, &admin, "extra_supervisor", false).unwrap();
    auth::reset_password(&dir, &admin, "supervisor").unwrap();
    assert!(overview(&dir, &sessions[1], &info.id).is_err());
    assert!(create(&dir, &sessions[1], &info.id, third).is_err());
    assert_eq!(fs::read(&path).unwrap(), saved);
    assert_eq!(
        fs::read(base.join("local/EasyFAB/master.key")).unwrap(),
        key
    );
}

#[test]
fn dates_and_contract_input_are_strict() {
    for (a, b) in [
        ("2025-02-29", "2026-01-01"),
        ("2026-1-01", "2026-01-02"),
        ("2026-10-29", "2026-10-28"),
    ] {
        assert!(storage::dates(a, b).is_err());
    }
    assert!(storage::dates("2024-02-29", "2024-02-29").is_ok());
    let mut value = serde_json::to_value(input()).unwrap();
    value["status"] = "Completed".into();
    assert!(serde_json::from_value::<NewProject>(value).is_err());
}

#[test]
fn published_contract_matches_project_and_ipc_fields() {
    let schema: serde_json::Value =
        serde_json::from_str(include_str!("../../../contracts/v1/projects.schema.json")).unwrap();
    let ipc: serde_json::Value = serde_json::from_str(include_str!(
        "../../../contracts/v1/project_registration.schema.json"
    ))
    .unwrap();
    let input = serde_json::to_value(input()).unwrap();
    let required = ipc["$defs"]["new_project"]["required"].as_array().unwrap();
    assert_eq!(input.as_object().unwrap().len(), required.len());
    for key in required {
        assert!(input.get(key.as_str().unwrap()).is_some());
    }
    for state in ["Not Started", "In Progress", "Completed", "On Hold"] {
        assert!(schema["$defs"]["project"]["properties"]["status"]["enum"]
            .as_array()
            .unwrap()
            .contains(&serde_json::json!(state)));
    }
    assert_eq!(
        schema["properties"]["projects"]["items"]["$ref"],
        "#/$defs/project"
    );
}
