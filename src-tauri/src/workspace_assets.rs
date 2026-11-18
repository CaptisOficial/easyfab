//! Documentación y contratos de la versión publicada, embebidos en el portable.
use std::{
    fs,
    io::{ErrorKind, Write},
    path::Path,
};
fn publish(dir: &Path, files: &[(&str, &str)]) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    for (name, body) in files {
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(dir.join(name))
        {
            Ok(mut file) => file
                .write_all(body.as_bytes())
                .and_then(|_| file.sync_all())
                .map_err(|e| format!("No se pudo escribir el archivo: {e}"))?,
            Err(error) if error.kind() == ErrorKind::AlreadyExists => (),
            Err(error) => return Err(format!("No se pudo crear el archivo: {error}")),
        }
    }
    Ok(())
}
pub fn install(docs: &Path, contracts: &Path) -> Result<(), String> {
    publish(
        &docs.join("architecture"),
        &[
            (
                "espacio-de-trabajo.md",
                include_str!("../../docs/architecture/espacio-de-trabajo.md"),
            ),
            ("auth.md", include_str!("../../docs/architecture/auth.md")),
            (
                "invariantes-arquitectura.md",
                include_str!("../../docs/architecture/invariantes-arquitectura.md"),
            ),
        ],
    )?;
    publish(
        &contracts.join("v1"),
        &[
            (
                "profile_upgrade.schema.json",
                include_str!("../../contracts/v1/profile_upgrade.schema.json"),
            ),
            (
                "workspace.layout.json",
                include_str!("../../contracts/v1/workspace.layout.json"),
            ),
            (
                "workspace.schema.json",
                include_str!("../../contracts/v1/workspace.schema.json"),
            ),
            (
                "installation.schema.json",
                include_str!("../../contracts/v1/installation.schema.json"),
            ),
            (
                "team.schema.json",
                include_str!("../../contracts/v1/team.schema.json"),
            ),
            (
                "auth.schema.json",
                include_str!("../../contracts/v1/auth.schema.json"),
            ),
            (
                "project_registration.schema.json",
                include_str!("../../contracts/v1/project_registration.schema.json"),
            ),
            (
                "projects.schema.json",
                include_str!("../../contracts/v1/projects.schema.json"),
            ),
            (
                "engineer_tasks.schema.json",
                include_str!("../../contracts/v1/engineer_tasks.schema.json"),
            ),
            (
                "activity_operations.schema.json",
                include_str!("../../contracts/v1/activity_operations.schema.json"),
            ),
            (
                "project_results.schema.json",
                include_str!("../../contracts/v1/project_results.schema.json"),
            ),
            (
                "project_results_operations.schema.json",
                include_str!("../../contracts/v1/project_results_operations.schema.json"),
            ),
            (
                "project_results_storage.schema.json",
                include_str!("../../contracts/v1/project_results_storage.schema.json"),
            ),
            (
                "issues.schema.json",
                include_str!("../../contracts/v1/issues.schema.json"),
            ),
            (
                "config_plant.schema.json",
                include_str!("../../contracts/v1/config_plant.schema.json"),
            ),
        ],
    )
}
