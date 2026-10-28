//! Mutaciones exclusivas del Admin sobre team.json; nunca escribir perfiles ajenos.
use super::{
    credentials::{issue_temporary, revalidate},
    crypto::*,
    directory::*,
    models::*,
};
use std::path::Path;

fn require_admin(session: &Session) -> Result<(), String> {
    if session.user.role != "admin" || session.user.must_change_password {
        return Err("Se requiere sesión normal de administrador.".into());
    }
    Ok(())
}
fn context(dir: &Path, session: &Session) -> Result<(Team, Vec<u8>), String> {
    require_admin(session)?;
    revalidate(dir, session)?;
    let team = team(dir)?;
    let key = read_key()?;
    if team
        .members
        .iter()
        .any(|m| !verify_role(&m.id, &m.role, &m.status, &m.role_signature, &key))
    {
        return Err(
            "El directorio contiene roles alterados. Requiere revisión administrativa.".into(),
        );
    }
    Ok((team, key))
}
fn save(dir: &Path, session: &Session, mut team: Team) -> Result<(), String> {
    revalidate(dir, session)?;
    team.updated_at = chrono::Utc::now().to_rfc3339();
    atomic_json(
        &dir.join("team.json"),
        &serde_json::to_value(team).map_err(|e| e.to_string())?,
    )
}
pub fn list_users(dir: &Path, session: &Session) -> Result<Vec<DirectoryUser>, String> {
    let (team, _) = context(dir, session)?;
    Ok(team
        .members
        .into_iter()
        .map(|m| DirectoryUser {
            id: m.id,
            name: m.name,
            role: m.role,
            status: m.status,
        })
        .collect())
}
fn insert_member(
    team: &mut Team,
    input: NewUser,
    key: &[u8],
    allowed_roles: &[&str],
) -> Result<String, String> {
    let id = input.id.trim().to_string();
    let name = input.name.trim().to_string();
    if id.is_empty()
        || id.len() > 64
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err("ID: usa hasta 64 letras sin acentos, números, guion o guion bajo.".into());
    }
    if name.is_empty() || name.chars().count() > 100 || name.chars().any(char::is_control) {
        return Err("Escribe un nombre de hasta 100 caracteres.".into());
    }
    validate_profile_key(&id)?;
    if !allowed_roles.contains(&input.role.as_str()) {
        return Err("Elige ingeniero o supervisor.".into());
    }
    if team.members.iter().any(|m| m.id.eq_ignore_ascii_case(&id)) {
        return Err("El ID ya está registrado, incluso en cuentas inactivas.".into());
    }
    let mut member = Member {
        id,
        name,
        role: input.role,
        area: "10.FAB".into(),
        password_hash: String::new(),
        role_signature: String::new(),
        status: "active".into(),
        credential_revision: String::new(),
        temporary_expires_at: String::new(),
        credential_signature: String::new(),
    };
    member.role_signature = sign_role(&member.id, &member.role, &member.status, key);
    let temporary = issue_temporary(&mut member, key)?;
    team.members.push(member);
    Ok(temporary)
}
pub fn create_user(dir: &Path, session: &Session, input: NewUser) -> Result<String, String> {
    let (mut team, key) = context(dir, session)?;
    let temporary = insert_member(&mut team, input, &key, &["engineer", "supervisor"])?;
    save(dir, session, team)?;
    Ok(temporary)
}
fn change_status(
    team: &mut Team,
    target: &str,
    active: bool,
    key: &[u8],
) -> Result<Option<String>, String> {
    let member = team
        .members
        .iter_mut()
        .find(|m| m.id == target)
        .ok_or("Usuario no encontrado.")?;
    if member.role == "admin" {
        return Err("El administrador no se modifica desde este directorio.".into());
    }
    let status = if active { "active" } else { "inactive" };
    if member.status == status {
        return Err("La cuenta ya tiene ese estado.".into());
    }
    member.status = status.into();
    member.role_signature = sign_role(&member.id, &member.role, &member.status, key);
    // Cada transición invalida la revisión anterior; activar exige nueva contraseña.
    let temporary = issue_temporary(member, key)?;
    Ok(if active { Some(temporary) } else { None })
}
pub fn set_user_active(
    dir: &Path,
    session: &Session,
    target: &str,
    active: bool,
) -> Result<Option<String>, String> {
    let (mut team, key) = context(dir, session)?;
    let temporary = change_status(&mut team, target, active, &key)?;
    save(dir, session, team)?;
    Ok(temporary)
}

#[cfg(test)]
#[path = "user_tests.rs"]
mod tests;

pub fn provision_initial_admin(dir: &Path, id: String, name: String) -> Result<String, String> {
    let mut directory = team(dir)?;
    if !directory.members.is_empty() {
        return Err("El administrador inicial ya existe. Ingresa o solicita recuperación.".into());
    }
    let local = std::path::PathBuf::from(
        std::env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA no disponible.")?,
    )
    .join("EasyFAB");
    std::fs::create_dir_all(&local).map_err(|e| e.to_string())?;
    let key_path = local.join("master.key");
    if !key_path.exists() {
        create_master_key(&key_path)?;
    }
    let key = read_key()?;
    let temporary = insert_member(
        &mut directory,
        NewUser {
            id,
            name,
            role: "admin".into(),
        },
        &key,
        &["admin"],
    )?;
    if !team(dir)?.members.is_empty() {
        return Err("El directorio cambió; vuelve a abrir el acceso.".into());
    }
    directory.updated_at = chrono::Utc::now().to_rfc3339();
    atomic_json(
        &dir.join("team.json"),
        &serde_json::to_value(directory).map_err(|e| e.to_string())?,
    )?;
    Ok(temporary)
}
