//! Minimal project creation/listing; no capacity, scheduling or approval rules.
mod models;
mod storage;

use crate::{auth, workspace};
pub use models::{NewProject, Overview, Project};
use std::path::Path;
const WRITE_MESSAGE: &str =
    "El Supervisor registra los proyectos. Admin administra las cuentas y consulta los proyectos.";

fn context(dir: &Path, session: &auth::Session) -> Result<Vec<models::Lead>, String> {
    if session.user.must_change_password
        || !["admin", "supervisor"].contains(&session.user.role.as_str())
    {
        return Err("Se requiere sesión normal de Supervisor o Admin.".into());
    }
    auth::revalidate(dir, session)?;
    let team = auth::team(dir)?;
    let key = auth::read_key()?;
    // A forged active member must never become an assignment choice.
    let mut leads = Vec::new();
    for member in team.members {
        if member.status == "active" {
            if !auth::trusted(&member, &key) {
                return Err("Directorio con roles alterados.".into());
            }
            if member.role == "engineer" {
                leads.push(models::Lead {
                    id: member.id,
                    name: member.name,
                });
            }
        }
    }
    Ok(leads)
}
// The confirmed team has one Supervisor. Fail closed if the directory no longer
// matches that operating scope instead of enabling several shared-file writers.
fn require_supervisor(dir: &Path, session: &auth::Session) -> Result<(), String> {
    context(dir, session)?;
    let team = auth::team(dir)?;
    let supervisors: Vec<_> = team
        .members
        .iter()
        .filter(|m| m.status == "active" && m.role == "supervisor")
        .collect();
    if session.user.role != "supervisor"
        || supervisors.len() != 1
        || supervisors[0].id != session.user.id
    {
        return Err(
            "El registro corresponde a la única cuenta Supervisor activa del equipo.".into(),
        );
    }
    Ok(())
}
fn active(dir: &Path, expected: &str) -> Result<(), String> {
    let root = dir
        .parent()
        .and_then(Path::parent)
        .ok_or("Espacio inválido.")?;
    let info = workspace::open(root, Some(expected))?;
    if Path::new(&info.data_dir)
        .canonicalize()
        .map_err(|e| e.to_string())?
        != dir.canonicalize().map_err(|e| e.to_string())?
    {
        return Err("Datos fuera del espacio activo.".into());
    }
    Ok(())
}
pub fn overview(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
) -> Result<Overview, String> {
    active(dir, workspace_id)?;
    let leads = context(dir, session)?;
    let (doc, _) = storage::read(dir)?;

    Ok(Overview {
        projects: doc.projects,
        leads,
        can_create: require_supervisor(dir, session).is_ok(),
        write_message: if session.user.role == "supervisor" {
            match require_supervisor(dir, session) {
                Ok(()) => "Registra el proyecto y selecciona al ingeniero responsable.".into(),
                Err(error) => error,
            }
        } else {
            WRITE_MESSAGE.into()
        },
    })
}
pub fn create(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: NewProject,
) -> Result<Project, String> {
    active(dir, workspace_id)?;
    require_supervisor(dir, session)?;
    let leads = context(dir, session)?;
    if !leads.iter().any(|m| m.id == input.lead_engineer_id) {
        return Err("Selecciona un responsable activo del equipo.".into());
    }
    let (mut doc, previous) = storage::read(dir)?;
    let mut project = Project {
        id: String::new(),
        wbs: input.wbs.trim().into(),
        name: input.name.trim().into(),
        process_area: input.process_area.trim().into(),
        lead_engineer_id: input.lead_engineer_id,
        start_date: input.start_date,
        target_date: input.target_date,
        status: "Not Started".into(),
        extra: Default::default(),
    };
    // 256 random bits, and verify against the current document before insertion.
    loop {
        project.id = format!("PRJ-{}", auth::revision());
        if !doc
            .projects
            .iter()
            .any(|p| p.id.eq_ignore_ascii_case(&project.id))
        {
            break;
        }
    }
    storage::validate(&project)?;
    if doc
        .projects
        .iter()
        .any(|p| p.wbs.trim().to_lowercase() == project.wbs.to_lowercase())
    {
        return Err("La WBS ya está registrada.".into());
    }
    doc.projects.push(project.clone());
    storage::save(dir, &doc, &previous, || {
        active(dir, workspace_id)?;
        require_supervisor(dir, session)?;
        let leads = context(dir, session)?;
        if !leads.iter().any(|m| m.id == project.lead_engineer_id) {
            return Err("El responsable ya no está activo.".into());
        }
        Ok(())
    })?;
    Ok(project)
}
#[cfg(test)]
mod tests;
