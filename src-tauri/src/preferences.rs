use crate::{auth, data_store as store, plant};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};
fn default_language() -> String {
    let schema: serde_json::Value = serde_json::from_str(include_str!(
        "../../contracts/v1/user_preferences.schema.json"
    ))
    .expect("embedded schema");
    schema["properties"]["language"]["default"]
        .as_str()
        .unwrap()
        .into()
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Preferences {
    pub version: u8,
    pub workspace_id: String,
    pub user_id: String,
    pub theme: String,
    pub ui_scale: String,
    #[serde(default = "default_language")]
    pub language: String,
}
#[derive(Serialize)]
pub struct View {
    pub preferences: Preferences,
    pub revision: Option<String>,
    pub warning: Option<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    pub theme: String,
    pub ui_scale: String,
    #[serde(default = "default_language")]
    pub language: String,
    pub expected_revision: Option<String>,
}
fn defaults(workspace_id: &str, user_id: &str) -> Preferences {
    let schema: serde_json::Value = serde_json::from_str(include_str!(
        "../../contracts/v1/user_preferences.schema.json"
    ))
    .expect("embedded schema");
    Preferences {
        version: 1,
        workspace_id: workspace_id.into(),
        user_id: user_id.into(),
        theme: schema["properties"]["theme"]["default"]
            .as_str()
            .unwrap()
            .into(),
        ui_scale: schema["properties"]["ui_scale"]["default"]
            .as_str()
            .unwrap()
            .into(),
        language: schema["properties"]["language"]["default"]
            .as_str()
            .unwrap()
            .into(),
    }
}
fn validate(p: &Preferences, workspace_id: &str, user_id: &str) -> Result<(), String> {
    if p.version != 1
        || p.workspace_id != workspace_id
        || p.user_id != user_id
        || !["light", "dark", "system"].contains(&p.theme.as_str())
        || !["standard", "large"].contains(&p.ui_scale.as_str())
        || !["es", "en"].contains(&p.language.as_str())
    {
        return Err("Preferencias incompatibles o de otro propietario.".into());
    }
    Ok(())
}
fn path(local: &Path, workspace_id: &str, user_id: &str) -> Result<PathBuf, String> {
    if workspace_id.len() != 32
        || !workspace_id
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
        || user_id.is_empty()
        || user_id.len() > 64
        || !user_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    {
        return Err("Identidad de preferencias inválida.".into());
    }
    let key: String = user_id
        .as_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    let target = local
        .join("preferences")
        .join(workspace_id)
        .join(format!("{key}.json"));
    store::contained(local, &target)?;
    Ok(target)
}
fn read_local(local: &Path, workspace_id: &str, user_id: &str) -> Result<View, String> {
    let target = path(local, workspace_id, user_id)?;
    let default = defaults(workspace_id, user_id);
    let bytes = match fs::read(&target) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(View {
                preferences: default,
                revision: None,
                warning: None,
            })
        }
        Err(e) => return Err(format!("No se pudieron leer preferencias: {e}")),
    };
    let revision = Some(store::hash(&bytes));
    match serde_json::from_slice::<Preferences>(&bytes).ok().filter(|p|validate(p,workspace_id,user_id).is_ok()) {
        Some(preferences)=>Ok(View{preferences,revision,warning:None}),None=>Ok(View{preferences:default,revision,warning:Some("Preferencias inválidas. Se usan valores predeterminados; restablece para guardar de nuevo.".into())})
    }
}
fn local() -> Result<PathBuf, String> {
    Ok(
        PathBuf::from(std::env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA no disponible.")?)
            .join("EasyFAB"),
    )
}
pub fn view(dir: &Path, s: &auth::Session, id: &str) -> Result<View, String> {
    plant::context(dir, s, id)?;
    read_local(&local()?, id, &s.user.id)
}
pub fn save(dir: &Path, s: &auth::Session, id: &str, input: Input) -> Result<View, String> {
    plant::context(dir, s, id)?;
    let local = local()?;
    let current = read_local(&local, id, &s.user.id)?;
    if current.warning.is_some() {
        return Err("Restablece explícitamente el archivo inválido antes de guardar.".into());
    }
    if current.revision != input.expected_revision {
        return Err("Las preferencias cambiaron. Vuelve a abrir Configuración.".into());
    }
    let mut preferences = defaults(id, &s.user.id);
    preferences.theme = input.theme;
    preferences.ui_scale = input.ui_scale;
    preferences.language = input.language;
    validate(&preferences, id, &s.user.id)?;
    let target = path(&local, id, &s.user.id)?;
    fs::create_dir_all(target.parent().ok_or("Ruta inválida.")?)
        .map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    store::contained(&local, &target)?;
    let previous = if current.revision.is_some() {
        Some(
            fs::read(&target)
                .map_err(|e| format!("No se pudo leer el archivo: {e}"))?,
        )
    } else {
        None
    };
    if previous.as_ref().map(|b| store::hash(b)) != current.revision {
        return Err("Las preferencias cambiaron. Actualiza antes de guardar.".into());
    }
    store::publish(
        &target,
        &serde_json::to_vec_pretty(&preferences)
            .map_err(|e| format!("No se pudo procesar el archivo JSON: {e}"))?,
        previous.as_deref(),
        || {
            plant::context(dir, s, id)?;
            store::contained(&local, &target)
        },
    )?;
    read_local(&local, id, &s.user.id)
}
pub fn reset(dir: &Path, s: &auth::Session, id: &str) -> Result<View, String> {
    plant::context(dir, s, id)?;
    let local = local()?;
    let target = path(&local, id, &s.user.id)?;
    match fs::remove_file(target) {
        Ok(()) => (),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
        Err(e) => return Err(format!("No se pudieron restablecer preferencias: {e}")),
    };
    read_local(&local, id, &s.user.id)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ownership_case_isolation_invalid_recovery_and_defaults() {
        let base = std::env::temp_dir().join(format!("easyfab-preferences-{}", auth::revision()));
        fs::create_dir_all(&base).unwrap();
        let id = "0123456789abcdef0123456789abcdef";
        let a = path(&base, id, "User").unwrap();
        let b = path(&base, id, "user").unwrap();
        assert_ne!(a, b);
        assert!(!a.exists());
        assert_eq!(
            read_local(&base, id, "User").unwrap().preferences.theme,
            "light"
        );
        assert!(!a.exists());
        fs::create_dir_all(a.parent().unwrap()).unwrap();
        fs::write(&a, b"{broken").unwrap();
        assert!(read_local(&base, id, "User").unwrap().warning.is_some());
        assert_eq!(fs::read(&a).unwrap(), b"{broken");
        let wrong = defaults(id, "user");
        fs::write(&a, serde_json::to_vec(&wrong).unwrap()).unwrap();
        assert!(read_local(&base, id, "User").unwrap().warning.is_some());
        assert!(read_local(&base, id, "user").unwrap().warning.is_none());
        let other = path(&base, "1123456789abcdef0123456789abcdef", "User").unwrap();
        assert_ne!(a, other);
        assert!(path(&base, id, "../admin").is_err());
        let mut future = defaults(id, "User");
        future.version = 2;
        fs::write(&a, serde_json::to_vec(&future).unwrap()).unwrap();
        assert!(read_local(&base, id, "User").unwrap().warning.is_some());
        fs::remove_dir_all(base).unwrap();
    }
}
