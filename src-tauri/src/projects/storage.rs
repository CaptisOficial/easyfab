//! Validates the whole document before appending; never resets invalid data.
use super::models::{Project, Projects};
use std::{collections::HashSet, fs, io::Write, path::Path};

pub(super) fn text(value: &str) -> bool {
    !value.trim().is_empty() && !value.chars().any(char::is_control)
}
pub(super) fn dates(start: &str, target: &str) -> Result<(), String> {
    fn parse(value: &str) -> Result<chrono::NaiveDate, String> {
        let date = chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d")
            .map_err(|_| "Usa fechas válidas con formato AAAA-MM-DD.".to_string())?;
        if date.format("%Y-%m-%d").to_string() != value || value.len() != 10 {
            return Err("Usa fechas válidas con formato AAAA-MM-DD.".into());
        }
        Ok(date)
    }
    if parse(start)? > parse(target)? {
        return Err("La fecha objetivo no puede ser anterior al inicio.".into());
    }
    Ok(())
}
pub(super) fn validate(project: &Project) -> Result<(), String> {
    if [
        &project.id,
        &project.wbs,
        &project.name,
        &project.process_area,
        &project.lead_engineer_id,
    ]
    .iter()
    .any(|v| !text(v))
        || !["Not Started", "In Progress", "Completed", "On Hold"]
            .contains(&project.status.as_str())
    {
        return Err("Proyecto inválido: revisa campos obligatorios y estado.".into());
    }
    dates(&project.start_date, &project.target_date)
}
pub(super) fn read(dir: &Path) -> Result<(Projects, Vec<u8>), String> {
    let path = dir.join("projects.json");
    let canonical = path
        .canonicalize()
        .map_err(|_| "No se pudo leer projects.json.")?;
    if !canonical.starts_with(dir.canonicalize().map_err(|e| e.to_string())?) {
        return Err("projects.json está fuera del espacio activo.".into());
    }
    let bytes = fs::read(&path).map_err(|_| "No se pudo leer projects.json.")?;
    let doc: Projects = serde_json::from_slice(&bytes)
        .map_err(|_| "projects.json inválido; requiere revisión, no se reinicializó.")?;
    if doc.version != 1 {
        return Err("Versión de proyectos incompatible.".into());
    }
    let mut ids = HashSet::new();
    let mut codes = HashSet::new();
    for project in &doc.projects {
        validate(project)?;
        if !ids.insert(project.id.to_lowercase())
            || !codes.insert(project.wbs.trim().to_lowercase())
        {
            return Err("Proyectos con identidad o WBS duplicados; requiere revisión.".into());
        }
    }
    Ok((doc, bytes))
}
// Local staging + atomic replacement. Does not claim exclusion across OneDrive PCs.
pub(super) fn save(
    dir: &Path,
    doc: &Projects,
    previous: &[u8],
    before_publish: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let path = dir.join("projects.json");
    let tmp = dir.join(format!("projects.{}.tmp", crate::auth::revision()));
    let result = (|| {
        let bytes = serde_json::to_vec_pretty(doc).map_err(|e| e.to_string())?;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp)
            .map_err(|e| format!("No se pudo preparar el guardado: {e}"))?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|e| format!("No se pudo guardar: {e}"))?;
        drop(file);
        before_publish()?;
        if read(dir)?.1 != previous {
            return Err("Los proyectos cambiaron. Actualiza antes de reintentar.".into());
        }
        fs::rename(&tmp, &path).map_err(|e| format!("No se pudo publicar el proyecto: {e}"))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}
