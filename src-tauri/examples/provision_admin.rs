// Ejecutar localmente por Admin: cargo run --example provision_admin -- <Management/Data>
// Credencial por stdin; no se pasa por argumentos ni se imprime.
#[path = "../src/auth.rs"]
mod auth;
use std::{
    fs,
    io::{self, Write},
    path::PathBuf,
};
fn main() -> Result<(), String> {
    let data = PathBuf::from(std::env::args().nth(1).ok_or("Indica Management/Data.")?);
    let team = auth::team(&data)?;
    if !team.members.is_empty() {
        return Err("El alta inicial solo admite directorio vacio.".into());
    }
    let root = PathBuf::from(std::env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA requerido.")?)
        .join("EasyFAB");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    if !root.join("master.key").exists() {
        auth::create_master_key(&root.join("master.key"))?;
    }
    let key = auth::read_key()?;
    eprintln!("ID del administrador (sin dos puntos):");
    let mut id = String::new();
    io::stdin().read_line(&mut id).map_err(|e| e.to_string())?;
    let id = id.trim();
    if id.is_empty() || id.contains(':') {
        return Err("ID invalido.".into());
    }
    eprintln!("Nombre:");
    let mut name = String::new();
    io::stdin()
        .read_line(&mut name)
        .map_err(|e| e.to_string())?;
    eprintln!("PIN (entrada visible: usa una terminal privada):");
    let mut pin = String::new();
    io::stdin().read_line(&mut pin).map_err(|e| e.to_string())?;
    let hash = auth::hash_password(pin.trim_end_matches(['\r', '\n']))?;
    let signature = auth::sign_role(id, "admin", "active", &key);
    let mut member = auth::Member {
        id: id.into(),
        name: name.trim().into(),
        role: "admin".into(),
        area: "10.FAB".into(),
        windows_username: std::env::var("USERNAME").map_err(|e| e.to_string())?,
        password_hash: hash,
        role_signature: signature,
        status: "active".into(),
        credential_revision: auth::revision(),
        temporary_expires_at: (chrono::Utc::now() + chrono::Duration::hours(24)).to_rfc3339(),
        credential_signature: String::new(),
    };
    auth::seal_temporary(&mut member, &key);
    let body = serde_json::json!({"version":1,"updated_at":chrono::Utc::now().to_rfc3339(),"members":[member]});
    // Unico escritor Admin. Revalidar antes de publicar; preservar el original en backup create_new.
    if !auth::team(&data)?.members.is_empty() {
        return Err("Directorio modificado; operacion cancelada.".into());
    }
    let original = fs::read(data.join("team.json")).map_err(|e| e.to_string())?;
    let mut backup = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(data.join("team.pre-auth.json"))
        .map_err(|e| e.to_string())?;
    backup
        .write_all(&original)
        .and_then(|_| backup.sync_all())
        .map_err(|e| e.to_string())?;
    let tmp = data.join("team.auth.tmp");
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp)
        .map_err(|e| e.to_string())?;
    f.write_all(serde_json::to_string_pretty(&body).unwrap().as_bytes())
        .and_then(|_| f.sync_all())
        .map_err(|e| e.to_string())?;
    drop(f);
    fs::rename(tmp, data.join("team.json")).map_err(|e| e.to_string())?;
    eprintln!("Administrador provisionado.");
    Ok(())
}
