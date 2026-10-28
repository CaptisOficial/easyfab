use super::{crypto::*, directory::*, models::*};
use std::{fs, path::Path};
fn seal(payload: &str, key: &[u8]) -> String {
    sign_role("credential-v1", payload, "sealed", key)
}
fn valid_seal(payload: &str, signature: &str, key: &[u8]) -> bool {
    verify_role("credential-v1", payload, "sealed", signature, key)
}
pub fn temporary_payload(m: &Member) -> String {
    serde_json::to_string(&(
        &m.id,
        &m.password_hash,
        &m.credential_revision,
        &m.temporary_expires_at,
    ))
    .unwrap()
}
pub fn seal_temporary(m: &mut Member, key: &[u8]) {
    m.credential_signature = seal(&temporary_payload(m), key);
}
fn credential_payload(id: &str, c: &Credential) -> String {
    serde_json::to_string(&(id, &c.revision, &c.password_hash)).unwrap()
}
pub fn effective(dir: &Path, m: &Member, key: &[u8]) -> Result<(String, bool, String), String> {
    if !trusted(m, key) || !valid_seal(&temporary_payload(m), &m.credential_signature, key) {
        return Err("Acceso rechazado.".into());
    }
    let path = own_path(dir, m)?;
    if path.exists() {
        let value: serde_json::Value =
            serde_json::from_slice(&fs::read(path).map_err(|_| "No se pudo leer perfil.")?)
                .map_err(|_| "Perfil invalido.")?;
        if let Some(value) = value.get("credential") {
            let c: Credential =
                serde_json::from_value(value.clone()).map_err(|_| "Credencial invalida.")?;
            if c.revision == m.credential_revision {
                if !valid_seal(&credential_payload(&m.id, &c), &c.signature, key) {
                    return Err("Credencial alterada.".into());
                }
                return Ok((c.password_hash.clone(), false, c.signature));
            }
        }
    }
    let expires = chrono::DateTime::parse_from_rfc3339(&m.temporary_expires_at)
        .map_err(|_| "Temporal invalida.")?;
    if expires <= chrono::Utc::now() {
        return Err("Contraseña temporal vencida. Solicita otra al administrador.".into());
    }
    Ok((
        m.password_hash.clone(),
        true,
        m.credential_signature.clone(),
    ))
}
pub fn authenticate(dir: &Path, id: &str, pin: &str) -> Result<Session, String> {
    let team = team(dir)?;
    let key = read_key()?;
    let m = team
        .members
        .iter()
        .find(|m| m.id == id)
        .ok_or("Acceso rechazado.")?;
    let (hash, restricted, fingerprint) = effective(dir, m, &key)?;
    if !verify_password(pin, &hash) {
        return Err("Acceso rechazado.".into());
    }
    Ok(Session {
        user: User {
            id: m.id.clone(),
            name: m.name.clone(),
            role: m.role.clone(),
            must_change_password: restricted,
        },
        fingerprint,
    })
}
pub fn revalidate(dir: &Path, session: &Session) -> Result<(), String> {
    let team = team(dir)?;
    let key = read_key()?;
    let m = team
        .members
        .iter()
        .find(|m| m.id == session.user.id)
        .ok_or("Sesion revocada.")?;
    let (_, restricted, fingerprint) = effective(dir, m, &key)?;
    if fingerprint != session.fingerprint
        || restricted != session.user.must_change_password
        || m.role != session.user.role
    {
        return Err("Sesion revocada. Ingresa otra vez.".into());
    }
    Ok(())
}
pub fn change_password(dir: &Path, session: &Session, new_pin: &str) -> Result<(), String> {
    revalidate(dir, session)?;
    let team = team(dir)?;
    let key = read_key()?;
    let m = team
        .members
        .iter()
        .find(|m| m.id == session.user.id)
        .ok_or("Sesion revocada.")?;
    let (old, _, _) = effective(dir, m, &key)?;
    if verify_password(new_pin, &old) {
        return Err("Elige una contraseña diferente a la anterior.".into());
    }
    let mut c = Credential {
        revision: m.credential_revision.clone(),
        password_hash: hash_password(new_pin)?,
        signature: String::new(),
    };
    c.signature = seal(&credential_payload(&m.id, &c), &key);
    let path = own_path(dir, m)?;
    let mut value: serde_json::Value = if path.exists() {
        serde_json::from_slice(&fs::read(&path).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?
    } else {
        serde_json::json!({"engineer_id":m.id,"last_synced":chrono::Utc::now().to_rfc3339(),"subactivities":[]})
    };
    if value.get("engineer_id").and_then(|v| v.as_str()) != Some(m.id.as_str()) {
        return Err("Perfil no corresponde al usuario.".into());
    }
    value["credential"] = serde_json::to_value(c).map_err(|e| e.to_string())?;
    value["last_synced"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
    revalidate(dir, session)?;
    atomic_json(&path, &value)
}
pub fn reset_password(dir: &Path, session: &Session, target: &str) -> Result<String, String> {
    revalidate(dir, session)?;
    if session.user.must_change_password || session.user.role != "admin" {
        return Err("Se requiere sesion normal de administrador.".into());
    }
    let mut team = team(dir)?;
    let key = read_key()?;
    let m = team
        .members
        .iter_mut()
        .find(|m| m.id == target && m.status == "active")
        .ok_or("Usuario activo no encontrado.")?;
    if !trusted(m, &key) {
        return Err("Rol alterado.".into());
    }
    let temporary = issue_temporary(m, &key)?;
    team.updated_at = chrono::Utc::now().to_rfc3339();
    revalidate(dir, session)?;
    atomic_json(
        &dir.join("team.json"),
        &serde_json::to_value(team).map_err(|e| e.to_string())?,
    )?;
    Ok(temporary)
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;

pub(super) fn issue_temporary(member: &mut Member, key: &[u8]) -> Result<String, String> {
    let temporary = temporary_password();
    member.password_hash = hash_password(&temporary)?;
    member.credential_revision = revision();
    member.temporary_expires_at = (chrono::Utc::now() + chrono::Duration::hours(24)).to_rfc3339();
    seal_temporary(member, key);
    Ok(temporary)
}
