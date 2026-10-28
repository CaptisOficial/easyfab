use super::*;

#[test]
fn temporary_normal_reset_expiry_and_tampering() {
    let dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join(format!("easyfab-auth-{}", revision()));
    fs::create_dir_all(dir.join("engineers")).unwrap();
    let key = [42; 32];
    let mut m = Member {
        id: "test".into(),
        name: "Test".into(),
        role: "engineer".into(),
        area: "10.FAB".into(),
        password_hash: hash_password("ABCD2345").unwrap(),
        role_signature: sign_role("test", "engineer", "active", &key),
        status: "active".into(),
        credential_revision: revision(),
        temporary_expires_at: (chrono::Utc::now() + chrono::Duration::hours(24)).to_rfc3339(),
        credential_signature: String::new(),
    };
    seal_temporary(&mut m, &key);
    assert!(effective(&dir, &m, &key).unwrap().1);
    let mut c = Credential {
        revision: m.credential_revision.clone(),
        password_hash: hash_password("NEWP2345").unwrap(),
        signature: String::new(),
    };
    c.signature = seal(&credential_payload(&m.id, &c), &key);
    let profile = own_path(&dir, &m).unwrap();
    atomic_json(&profile, &serde_json::json!({"credential":c})).unwrap();
    let (hash, restricted, _) = effective(&dir, &m, &key).unwrap();
    assert!(!restricted);
    assert!(verify_password("NEWP2345", &hash));
    assert!(!verify_password("ABCD2345", &hash));
    // Un reset Admin cambia revision; el perfil anterior ya no concede acceso normal.
    m.credential_revision = revision();
    seal_temporary(&mut m, &key);
    assert!(effective(&dir, &m, &key).unwrap().1);
    m.temporary_expires_at = (chrono::Utc::now() - chrono::Duration::seconds(1)).to_rfc3339();
    seal_temporary(&mut m, &key);
    assert!(effective(&dir, &m, &key).is_err());
    m.temporary_expires_at = (chrono::Utc::now() + chrono::Duration::hours(24)).to_rfc3339();
    assert!(effective(&dir, &m, &key).is_err()); // fecha sin firma
    seal_temporary(&mut m, &key);
    m.role = "admin".into();
    assert!(effective(&dir, &m, &key).is_err());
    fs::remove_file(profile).unwrap();
    fs::remove_dir(dir.join("engineers")).unwrap();
    fs::remove_dir(dir).unwrap();
}

#[test]
fn password_policy_and_temporary_length() {
    assert!(hash_password("1234567").is_err());
    assert!(hash_password("123456789").is_err());
    for _ in 0..20 {
        let p = temporary_password();
        assert_eq!(p.len(), 8);
        assert!(p
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()));
    }
}
