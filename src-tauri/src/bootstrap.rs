//! Auto-bootstrap de `easy-fab/data`.
//!
//! Regla: crear únicamente lo que falta. Nunca sobrescribir un archivo existente
//! (se usa `create_new`, que falla si el archivo ya existe).

use chrono::Utc;
use serde::Serialize;
use serde_json::json;
use std::fs::OpenOptions;
use std::io::{ErrorKind, Write};
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct BootstrapReport {
    pub data_dir: String,
    pub created: Vec<String>,
    pub existing: Vec<String>,
}

/// Archivos iniciales: (nombre relativo, contenido JSON).
fn seed_files() -> Vec<(&'static str, serde_json::Value)> {
    let now = Utc::now().to_rfc3339();
    vec![
        (
            "team.json",
            json!({ "version": 1, "updated_at": now, "members": [] }),
        ),
        ("projects.json", json!({ "version": 1, "projects": [] })),
        ("issues.json", json!({ "version": 1, "issues": [] })),
        (
            "config_plant.json",
            json!({ "version": 1, "machines": [], "lines": [], "failure_types": [] }),
        ),
    ]
}

pub fn bootstrap(data_dir: &Path) -> Result<BootstrapReport, String> {
    let mut created = Vec::new();
    let mut existing = Vec::new();

    for dir in [data_dir.to_path_buf(), data_dir.join("engineers")] {
        let label = if dir == data_dir {
            "easy-fab/data/".to_string()
        } else {
            "engineers/".to_string()
        };
        if dir.is_dir() {
            existing.push(label);
        } else {
            std::fs::create_dir_all(&dir)
                .map_err(|e| format!("No se pudo crear {}: {e}", dir.display()))?;
            created.push(label);
        }
    }

    for (name, content) in seed_files() {
        let path = data_dir.join(name);
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut f) => {
                let body = serde_json::to_string_pretty(&content).map_err(|e| e.to_string())?;
                f.write_all(body.as_bytes())
                    .and_then(|_| f.write_all(b"\n"))
                    .map_err(|e| format!("No se pudo escribir {}: {e}", path.display()))?;
                created.push(name.to_string());
            }
            Err(e) if e.kind() == ErrorKind::AlreadyExists => existing.push(name.to_string()),
            Err(e) => return Err(format!("No se pudo crear {}: {e}", path.display())),
        }
    }

    Ok(BootstrapReport {
        data_dir: data_dir.to_string_lossy().to_string(),
        created,
        existing,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_then_preserves() {
        let dir = std::env::temp_dir().join(format!("easyfab-boot-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);

        let first = bootstrap(&dir).unwrap();
        assert_eq!(first.created.len(), 6);

        // Modificar un archivo y comprobar que el segundo bootstrap no lo toca.
        std::fs::write(dir.join("projects.json"), "{\"user\":\"data\"}").unwrap();
        let second = bootstrap(&dir).unwrap();
        assert!(second.created.is_empty());
        assert_eq!(
            std::fs::read_to_string(dir.join("projects.json")).unwrap(),
            "{\"user\":\"data\"}"
        );

        let _ = std::fs::remove_dir_all(dir);
    }
}
