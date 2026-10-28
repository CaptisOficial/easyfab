use super::*;
fn fixture() -> (PathBuf, PathBuf) {
    let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join(format!("workspace-test-{}", nonce()));
    let root = base.join("shared");
    fs::create_dir_all(&root).unwrap();
    (root, base.join("local"))
}
#[test]
fn initialize_has_one_relative_layout_and_preserves_existing_data() {
    let (root, local) = fixture();
    let first = initialize(&root, &local).unwrap();
    assert!(Path::new(&first.executable).ends_with("easy-fab/software/easyfab.exe"));
    let project = Path::new(&first.data_dir).join("projects.json");
    fs::write(&project, b"{\"version\":1,\"projects\":[]}").unwrap();
    let before = fs::read(&project).unwrap();
    let again = initialize(&root, &local).unwrap();
    assert_eq!(first.id, again.id);
    assert_eq!(fs::read(project).unwrap(), before);
    let manifest = fs::read_to_string(Path::new(&first.path).join("workspace.json")).unwrap();
    assert!(!manifest.contains(&first.root));
    assert!(Path::new(&first.docs_dir).is_dir());
    assert!(Path::new(&first.backups_dir).is_dir());
    assert_eq!(probe(&local, Path::new("dev.exe"), None).phase, "ready");
}
#[test]
fn discovery_is_read_only_and_missing_saved_root_never_creates_a_new_space() {
    let (root, local) = fixture();
    let proposal = probe(&local, Path::new("dev.exe"), Some(display(&root)));
    assert_eq!(proposal.phase, "unconfigured");
    assert!(!local.exists());
    assert!(!root.join("easy-fab").exists());
    let info = initialize(&root, &local).unwrap();
    fs::rename(&root, root.with_extension("offline")).unwrap();
    let other = local.parent().unwrap().join("other");
    fs::create_dir_all(&other).unwrap();
    let status = probe(&local, Path::new("dev.exe"), Some(display(&other)));
    assert_eq!(status.phase, "unavailable");
    assert_eq!(status.candidate_root, Some(info.root));
    assert!(!other.join("easy-fab").exists());
}
#[test]
fn manifest_identity_and_missing_data_fail_closed() {
    let (root, local) = fixture();
    let info = initialize(&root, &local).unwrap();
    assert!(open(&root, Some("00000000000000000000000000000000")).is_err());
    let issues = Path::new(&info.data_dir).join("issues.json");
    fs::remove_file(&issues).unwrap();
    assert!(initialize(&root, &local).is_err());
    assert!(!issues.exists());
}
#[test]
fn legacy_data_requires_explicit_transfer() {
    let (root, local) = fixture();
    fs::create_dir_all(root.join("Management/Data")).unwrap();
    fs::write(root.join("Management/Data/team.json"), b"{}").unwrap();
    assert!(initialize(&root, &local).is_err());
    assert!(!root.join("easy-fab").exists());
}
#[test]
fn configured_root_precedes_portable_location() {
    let (root, local) = fixture();
    let first = initialize(&root, &local).unwrap();
    let other = root.parent().unwrap().join("other");
    fs::create_dir_all(&other).unwrap();
    let configured = initialize(&other, &local).unwrap();
    let status = probe(&local, Path::new(&first.executable), None);
    assert_eq!(status.workspace.unwrap().id, configured.id);
    let fresh_local = local.with_extension("fresh");
    let first_open = probe(&fresh_local, Path::new(&first.executable), None);
    assert_eq!(first_open.workspace.unwrap().id, first.id);
    assert!(!fresh_local.exists());
}
#[test]
fn workspace_info_matches_the_ipc_contract() {
    let (root, local) = fixture();
    let info = initialize(&root, &local).unwrap();
    let value = serde_json::to_value(info).unwrap();
    let schema: serde_json::Value =
        serde_json::from_str(include_str!("../../contracts/v1/workspace.schema.json")).unwrap();
    let mut keys: Vec<_> = value
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    let mut required: Vec<_> = schema["$defs"]["info"]["required"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap())
        .collect();
    keys.sort();
    required.sort();
    assert_eq!(keys, required);
}

#[test]
fn profile_layout_is_explicit_and_never_falls_back_to_another_profile() {
    let (root, local) = fixture();
    let info = initialize(&root, &local).unwrap();
    let data = Path::new(&info.data_dir);
    let manifest_path = Path::new(&info.path).join("workspace.json");
    let mut manifest: serde_json::Value = read_json(&manifest_path).unwrap();
    assert_eq!(manifest["profile_layout_version"], 2);
    let path = profile_path(data, "engineer").unwrap();
    assert_eq!(path, data.join("engineers/engineer/profile.json"));
    prepare_profile_directory(data, "engineer").unwrap();
    assert!(data.join("engineers/engineer/evidence").is_dir());
    assert!(!data.join("engineers/another").exists());
    fs::write(data.join("engineers/engineer.json"), b"{}").unwrap();
    assert!(profile_path(data, "engineer").is_err());
    manifest
        .as_object_mut()
        .unwrap()
        .remove("profile_layout_version");
    fs::write(&manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();
    assert_eq!(
        profile_path(data, "engineer").unwrap(),
        data.join("engineers/engineer.json")
    );
    prepare_profile_directory(data, "profile").unwrap();
    assert!(!data.join("engineers/evidence").exists());
    fs::write(&path, b"{}").unwrap();
    assert!(profile_path(data, "engineer").is_err());
    for id in ["../other", "C:\\other", "other/file", "."] {
        assert!(profile_path(data, id).is_err());
    }
    manifest["profile_layout_version"] = serde_json::json!(3);
    fs::write(&manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();
    assert!(open(&root, Some(&info.id)).is_err());
    manifest["profile_layout_version"] = serde_json::json!(2);
    manifest["maintenance"] = serde_json::json!(true);
    fs::write(&manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();
    assert!(open(&root, Some(&info.id)).is_err());
    assert!(profile_path(data, "engineer").is_err());
    fs::remove_file(manifest_path).unwrap();
    assert!(profile_path(data, "engineer").is_err());
}
