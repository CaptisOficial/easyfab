use super::{
    crypto::{revision, verify_role},
    models::*,
};
use argon2::password_hash::rand_core::{OsRng, RngCore};
use std::{
    fs,
    io::{Read, Write},
    path::Path,
};
// Missing keys are never regenerated for an existing directory: fail closed.
pub fn read_key() -> Result<Vec<u8>, String> {
    let root = std::env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA no disponible.")?;
    let mut key = Vec::new();
    fs::File::open(std::path::PathBuf::from(root).join("EasyFAB/master.key"))
        .and_then(|f| f.take(33).read_to_end(&mut key))
        .map_err(|_| {
            "Falta la llave de confianza. Solicita provision al administrador.".to_string()
        })?;
    if key.len() != 32 {
        return Err("Llave de confianza invalida.".into());
    }
    Ok(key)
}
/// Only for an explicit, local administrator provisioning tool; never an IPC command.
#[allow(dead_code)]
pub fn create_master_key(path: &Path) -> Result<(), String> {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())
}
pub fn team(dir: &Path) -> Result<Team, String> {
    let team: Team = serde_json::from_slice(
        &fs::read(dir.join("team.json")).map_err(|_| "No se pudo leer team.json.")?,
    )
    .map_err(|_| "Directorio invalido.")?;
    if team.version != 1 || chrono::DateTime::parse_from_rfc3339(&team.updated_at).is_err() {
        return Err("Version o fecha de directorio invalida.".into());
    }
    let mut ids = std::collections::HashSet::new();
    if team.members.iter().any(|m| {
        m.id.is_empty()
            || m.id.contains(':')
            || !ids.insert(&m.id)
            || !["admin", "supervisor", "engineer"].contains(&m.role.as_str())
            || !["active", "inactive"].contains(&m.status.as_str())
    }) {
        return Err("Directorio invalido o IDs duplicados.".into());
    }
    Ok(team)
}
pub fn trusted(m: &Member, key: &[u8]) -> bool {
    m.status == "active" && verify_role(&m.id, &m.role, &m.status, &m.role_signature, key)
}
/// La particion pertenece al usuario autenticado de EasyFAB.
pub(super) fn own_path(dir: &Path, m: &Member) -> Result<std::path::PathBuf, String> {
    validate_profile_key(&m.id)?;
    crate::workspace::profile_path(dir, &m.id)
}
pub(super) fn atomic_json(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    let tmp = path.with_extension(format!("{}.tmp", revision()));
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp)
        .map_err(|e| format!("No se pudo preparar el archivo: {e}"))?;
    f.write_all(
        serde_json::to_string_pretty(value)
            .map_err(|e| e.to_string())?
            .as_bytes(),
    )
    .and_then(|_| f.sync_all())
    .map_err(|e| format!("No se pudo guardar el archivo: {e}"))?;
    drop(f);
    fs::rename(&tmp, path).map_err(|e| format!("No se pudo publicar el archivo: {e}"))
}

pub(super) fn validate_profile_key(username: &str) -> Result<(), String> {
    if username.is_empty()
        || !username
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-' || b == b'.')
        || username.contains("..")
    {
        return Err("Identificador de perfil inválido.".into());
    }
    if username.ends_with('.') || username.len() > 64 {
        return Err("Identificador de perfil inválido.".into());
    }
    let stem = username
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    if ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
    {
        return Err("Este identificador está reservado; elige otro usuario.".into());
    }
    Ok(())
}
