use super::*;
fn add_member(team: &mut Team, input: NewUser, key: &[u8]) -> Result<String, String> {
    insert_member(team, input, key, &["engineer", "supervisor"])
}

fn empty_team() -> Team {
    Team {
        version: 1,
        updated_at: chrono::Utc::now().to_rfc3339(),
        members: vec![],
    }
}
fn input(id: &str) -> NewUser {
    NewUser {
        id: id.into(),
        name: "Test Engineer".into(),
        role: "engineer".into(),
    }
}
#[test]
fn only_normal_admin_can_manage_users() {
    let mut session = Session {
        user: User {
            id: "admin".into(),
            name: "Admin".into(),
            role: "admin".into(),
            must_change_password: false,
        },
        fingerprint: String::new(),
    };
    assert!(require_admin(&session).is_ok());
    session.user.must_change_password = true;
    assert!(require_admin(&session).is_err());
    session.user.must_change_password = false;
    for role in ["engineer", "supervisor"] {
        session.user.role = role.into();
        assert!(require_admin(&session).is_err());
    }
}
#[test]
fn creation_rejects_collisions_and_invalid_inputs() {
    let mut team = empty_team();
    let key = [9; 32];
    let temporary = add_member(&mut team, input("engineer"), &key).unwrap();
    assert_eq!(temporary.len(), 8);
    assert!(verify_password(&temporary, &team.members[0].password_hash));
    assert!(trusted(&team.members[0], &key));
    assert!(add_member(&mut team, input("ENGINEER"), &key).is_err());
    for id in ["../id", "name.", "", "with space"] {
        assert!(add_member(&mut team, input(id), &key).is_err());
    }
    let mut admin = input("other");
    admin.role = "admin".into();
    assert!(add_member(&mut team, admin, &key).is_err());
    assert_eq!(team.members.len(), 1);
}
#[test]
fn deactivate_reactivate_revokes_previous_credentials() {
    let mut team = empty_team();
    let key = [9; 32];
    let old = add_member(&mut team, input("engineer"), &key).unwrap();
    let previous_revision = team.members[0].credential_revision.clone();
    assert!(change_status(&mut team, "engineer", false, &key)
        .unwrap()
        .is_none());
    assert!(!trusted(&team.members[0], &key));
    assert!(add_member(&mut team, input("ENGINEER"), &key).is_err());
    assert!(change_status(&mut team, "engineer", false, &key).is_err());
    let new = change_status(&mut team, "engineer", true, &key)
        .unwrap()
        .unwrap();
    assert_ne!(previous_revision, team.members[0].credential_revision);
    assert!(!verify_password(&old, &team.members[0].password_hash));
    assert!(verify_password(&new, &team.members[0].password_hash));
    let nonexistent = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join(revision());
    std::fs::create_dir_all(nonexistent.join("data")).unwrap();
    std::fs::write(
        nonexistent.join("workspace.json"),
        r#"{"version":1,"id":"00000000000000000000000000000001"}"#,
    )
    .unwrap();
    assert!(
        super::super::credentials::effective(&nonexistent.join("data"), &team.members[0], &key)
            .unwrap()
            .1
    );
    team.members[0].role = "admin".into();
    assert!(change_status(&mut team, "engineer", false, &key).is_err());
}
#[test]
fn directory_response_matches_contract_and_excludes_secrets() {
    let value = serde_json::to_value(DirectoryUser {
        id: "e".into(),
        name: "E".into(),
        role: "engineer".into(),
        status: "active".into(),
    })
    .unwrap();
    let schema: serde_json::Value =
        serde_json::from_str(include_str!("../../../contracts/v1/auth.schema.json")).unwrap();
    let mut actual: Vec<_> = value
        .as_object()
        .unwrap()
        .keys()
        .map(|k| k.as_str())
        .collect();
    let mut required: Vec<_> = schema["$defs"]["directory_user"]["required"]
        .as_array()
        .unwrap()
        .iter()
        .map(|k| k.as_str().unwrap())
        .collect();
    actual.sort();
    required.sort();
    assert_eq!(actual, required);
    assert!(value.get("password_hash").is_none());
    assert!(value.get("role_signature").is_none());
}
#[test]
fn accounts_are_independent_of_windows_and_have_distinct_profiles() {
    let mut team = empty_team();
    let key = [9; 32];
    add_member(&mut team, input("engineer"), &key).unwrap();
    let mut supervisor = input("supervisor");
    supervisor.role = "supervisor".into();
    add_member(&mut team, supervisor, &key).unwrap();
    let base = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join(revision());
    let dir = &base.join("data");
    std::fs::create_dir_all(dir).unwrap();
    std::fs::write(
        base.join("workspace.json"),
        r#"{"version":1,"id":"00000000000000000000000000000001"}"#,
    )
    .unwrap();
    assert_eq!(
        own_path(dir, &team.members[0]).unwrap(),
        dir.join("engineers/engineer.json")
    );
    assert_eq!(
        own_path(dir, &team.members[1]).unwrap(),
        dir.join("engineers/supervisor.json")
    );
    let serialized = serde_json::to_value(&team).unwrap();
    assert!(serialized["members"][0].get("windows_username").is_none());
    let restored: Team = serde_json::from_value(serialized).unwrap();
    assert_eq!(restored.members[0].id, "engineer");
    for id in ["CON", "nul", "COM1", "LPT9"] {
        assert!(add_member(&mut team, input(id), &key).is_err());
    }
}
#[test]
fn initial_admin_is_rejected_before_touching_local_keys_if_directory_is_not_empty() {
    let mut directory = empty_team();
    let key = [8; 32];
    add_member(&mut directory, input("existing"), &key).unwrap();
    let dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join(revision());
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(
        dir.join("team.json"),
        serde_json::to_vec(&directory).unwrap(),
    )
    .unwrap();
    assert!(provision_initial_admin(&dir, "admin".into(), "Admin".into()).is_err());
    let after: Team =
        serde_json::from_slice(&std::fs::read(dir.join("team.json")).unwrap()).unwrap();
    assert_eq!(after.members.len(), 1);
    assert_eq!(after.members[0].id, "existing");
}
