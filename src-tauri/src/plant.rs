use crate::{auth, data_store as store, projects};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, path::Path};
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub active: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_id: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub version: u8,
    pub machines: Vec<Item>,
    pub lines: Vec<Item>,
    pub failure_types: Vec<Item>,
}
#[derive(Serialize)]
pub struct View {
    pub config: Config,
    pub revision: String,
    pub can_edit: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    pub config: Config,
    pub expected_revision: String,
}
pub fn context(dir: &Path, s: &auth::Session, id: &str) -> Result<(), String> {
    projects::active(dir, id)?;
    if s.user.must_change_password {
        return Err("Completa el cambio de contraseña primero.".into());
    }
    auth::revalidate(dir, s)
}
pub fn validate(config: &Config) -> Result<(), String> {
    if config.version != 1 {
        return Err("Versión de catálogos incompatible.".into());
    }
    for items in [&config.lines, &config.machines, &config.failure_types] {
        let mut ids = HashSet::new();
        let mut names = HashSet::new();
        for item in items {
            if item.id.is_empty()
                || item.name.trim().is_empty()
                || item.name.chars().any(char::is_control)
                || !ids.insert(&item.id)
                || !names.insert(item.name.trim().to_lowercase())
            {
                return Err("Catálogo con nombres vacíos o duplicados.".into());
            }
        }
    }
    if config
        .lines
        .iter()
        .chain(&config.failure_types)
        .any(|i| i.line_id.is_some())
    {
        return Err("Solo los equipos tienen una referencia de línea.".into());
    }
    for machine in &config.machines {
        if let Some(id) = &machine.line_id {
            if !config
                .lines
                .iter()
                .any(|l| &l.id == id && (!machine.active || l.active))
            {
                return Err("Un equipo activo requiere una línea activa y existente.".into());
            }
        }
    }
    Ok(())
}
pub fn read(dir: &Path) -> Result<(Config, Vec<u8>), String> {
    let path = dir.join("config_plant.json");
    store::contained(dir, &path)?;
    let bytes = fs::read(path).map_err(|e| format!("No se pudo leer el archivo: {e}"))?;
    let config: Config = serde_json::from_slice(&bytes)
        .map_err(|_| "Catálogos inválidos; no se reinicializaron.")?;
    validate(&config)?;
    Ok((config, bytes))
}
pub fn view(dir: &Path, s: &auth::Session, id: &str) -> Result<View, String> {
    context(dir, s, id)?;
    let (config, bytes) = read(dir)?;
    Ok(View {
        config,
        revision: store::hash(&bytes),
        can_edit: s.user.role == "admin",
    })
}
pub fn save(dir: &Path, s: &auth::Session, id: &str, input: Input) -> Result<View, String> {
    context(dir, s, id)?;
    if s.user.role != "admin" {
        return Err("Solo Admin mantiene los catálogos.".into());
    }
    validate(&input.config)?;
    let (previous, bytes) = read(dir)?;
    if store::hash(&bytes) != input.expected_revision {
        return Err("El catálogo cambió. Actualiza antes de guardar.".into());
    }
    // IDs cannot disappear or change meaning. Logical deactivation preserves references.
    for (old, new) in [
        (&previous.lines, &input.config.lines),
        (&previous.machines, &input.config.machines),
        (&previous.failure_types, &input.config.failure_types),
    ] {
        if old.iter().any(|item| !new.iter().any(|n| n.id == item.id)) {
            return Err("No se eliminan entradas: desactívalas para conservar referencias.".into());
        }
    }
    let path = dir.join("config_plant.json");
    store::publish(
        &path,
        &serde_json::to_vec_pretty(&input.config)
            .map_err(|e| format!("No se pudo procesar el archivo JSON: {e}"))?,
        Some(&bytes),
        || {
            context(dir, s, id)?;
            store::contained(dir, &path)
        },
    )?;
    view(dir, s, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_consistent_catalog_references() {
        let line = Item {
            id: "l".into(),
            name: "Line".into(),
            active: true,
            line_id: None,
        };
        let mut c = Config {
            version: 1,
            lines: vec![line.clone()],
            machines: vec![Item {
                id: "m".into(),
                name: "Machine".into(),
                active: true,
                line_id: Some("l".into()),
            }],
            failure_types: vec![],
        };
        assert!(validate(&c).is_ok());
        c.lines[0].active = false;
        assert!(validate(&c).is_err());
        c.machines[0].active = false;
        assert!(validate(&c).is_ok());
        c.lines.push(line);
        assert!(validate(&c).is_err());
    }
}
