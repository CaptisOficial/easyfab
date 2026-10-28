use super::*;
use std::{fs, path::PathBuf, process::Command};

// A child process gets its own LOCALAPPDATA; parallel tests never mutate the host environment.
#[test]
fn first_access_from_empty_workspace_to_personal_profiles() {
    let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join(format!("onboarding-{}", revision()));
    fs::create_dir_all(&base).unwrap();
    let result = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "auth::onboarding_tests::isolated_first_access",
            "--nocapture",
        ])
        .env("EASYFAB_ONBOARDING_FIXTURE", &base)
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

#[test]
fn isolated_first_access() {
    let Some(base) = std::env::var_os("EASYFAB_ONBOARDING_FIXTURE") else {
        return;
    };
    let base = PathBuf::from(base);
    let local = base.join("local/EasyFAB");
    assert_eq!(
        PathBuf::from(std::env::var_os("LOCALAPPDATA").unwrap()),
        base.join("local")
    );
    let root = base.join("shared");
    fs::create_dir_all(&root).unwrap();
    let workspace = crate::workspace::initialize(&root, &local).unwrap();
    let dir = PathBuf::from(workspace.data_dir);
    assert!(team(&dir).unwrap().members.is_empty());
    assert!(!local.join("master.key").exists());
    let temporary =
        provision_initial_admin(&dir, "admin_test".into(), "Admin Test".into()).unwrap();
    let original_key = fs::read(local.join("master.key")).unwrap();
    let restricted = authenticate(&dir, "admin_test", &temporary).unwrap();
    assert!(restricted.user.must_change_password);
    assert!(list_users(&dir, &restricted).is_err());
    assert!(create_user(
        &dir,
        &restricted,
        models::NewUser {
            id: "denied".into(),
            name: "Denied".into(),
            role: "engineer".into(),
        }
    )
    .is_err());
    change_password(&dir, &restricted, "Admin123").unwrap();
    assert!(authenticate(&dir, "admin_test", &temporary).is_err());
    let admin = authenticate(&dir, "admin_test", "Admin123").unwrap();
    assert!(!admin.user.must_change_password);
    assert!(provision_initial_admin(&dir, "another".into(), "Another".into()).is_err());
    assert_eq!(fs::read(local.join("master.key")).unwrap(), original_key);
    let admin_profile = fs::read(dir.join("engineers/admin_test/profile.json")).unwrap();
    for role in ["engineer", "supervisor"] {
        let temporary = create_user(
            &dir,
            &admin,
            models::NewUser {
                id: role.into(),
                name: "Same Display Name".into(),
                role: role.into(),
            },
        )
        .unwrap();
        let personal_path = dir.join(format!("engineers/{role}/profile.json"));
        assert!(!personal_path.exists()); // Admin never writes another person's profile.
        let session = authenticate(&dir, role, &temporary).unwrap();
        assert!(session.user.must_change_password);
        assert!(list_users(&dir, &session).is_err());
        assert!(change_password(&dir, &session, "short").is_err());
        assert!(!personal_path.exists());
        change_password(&dir, &session, "User1234").unwrap();
        assert!(dir.join(format!("engineers/{role}/evidence")).is_dir());
        assert!(authenticate(&dir, role, &temporary).is_err());
        let session = authenticate(&dir, role, "User1234").unwrap();
        assert_eq!(session.user.role, role);
        assert!(!session.user.must_change_password);
        assert!(list_users(&dir, &session).is_err());
        assert!(set_user_active(&dir, &session, "admin_test", false).is_err());
        let profile: serde_json::Value =
            serde_json::from_slice(&fs::read(personal_path).unwrap()).unwrap();
        assert_eq!(profile["engineer_id"], role);
        assert_eq!(
            fs::read(dir.join("engineers/admin_test/profile.json")).unwrap(),
            admin_profile
        );
    }
    assert_eq!(list_users(&dir, &admin).unwrap().len(), 3);
    assert_eq!(
        crate::workspace::initialize(&root, &local).unwrap().id,
        workspace.id
    );
    assert_eq!(team(&dir).unwrap().members.len(), 3);
}
