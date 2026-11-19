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
pub(crate) fn require_supervisor(dir: &Path, session: &auth::Session) -> Result<(), String> {
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
pub(crate) fn active(dir: &Path, expected: &str) -> Result<(), String> {
    let root = dir
        .parent()
        .and_then(Path::parent)
        .ok_or("Espacio inválido.")?;
    let info = workspace::open(root, Some(expected))?;
    if Path::new(&info.data_dir)
        .canonicalize()
        .map_err(|e| format!("No se puede acceder a la carpeta: {e}"))?
        != dir
            .canonicalize()
            .map_err(|e| format!("No se puede acceder a la carpeta: {e}"))?
    {
        return Err("Datos fuera del espacio activo.".into());
    }
    Ok(())
}
pub(crate) use storage::dates as validate_dates;

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TargetInput {
    pub project_id: String,
    pub target_hours: f64,
    pub expected_target_hours: Option<f64>,
}
pub fn set_target(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: TargetInput,
) -> Result<Project, String> {
    active(dir, workspace_id)?;
    require_supervisor(dir, session)?;
    if !input.target_hours.is_finite() || input.target_hours <= 0.0 {
        return Err("Las horas objetivo deben ser mayores que cero.".into());
    }
    let (mut doc, previous) = storage::read(dir)?;
    let project = doc
        .projects
        .iter_mut()
        .find(|p| p.id == input.project_id)
        .ok_or("Proyecto no encontrado.")?;
    if project.extra.get("target_hours").and_then(|v| v.as_f64()) != input.expected_target_hours {
        return Err("El objetivo cambió. Actualiza el proyecto.".into());
    }
    project
        .extra
        .insert("target_hours".into(), serde_json::json!(input.target_hours));
    let project = project.clone();
    storage::save(dir, &doc, &previous, || {
        active(dir, workspace_id)?;
        require_supervisor(dir, session)
    })?;
    Ok(project)
}
fn with_priority(mut projects: Vec<Project>) -> Vec<Project> {
    for (idx, p) in projects.iter_mut().enumerate() {
        if p.priority.is_none() {
            p.priority = Some((idx + 1) as u32);
        }
    }
    projects
}

fn with_work_status(dir: &Path, mut project: Project) -> Result<Project, String> {
    if crate::results_store::is_active(dir, &project.id)? {
        crate::results_store::project_projection(dir, &mut project)?;
        return Ok(project);
    }
    if project.status == "Not Started" && crate::activities::has_started(dir, &project)? {
        project.status = "In Progress".into();
    }
    Ok(project)
}

/// Authorize one project without projecting unrelated project histories.
/// Capturing work must not require reading every other project's event graph.
pub(crate) fn authorized(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
) -> Result<Project, String> {
    active(dir, workspace_id)?;
    if session.user.must_change_password || !["admin", "supervisor", "engineer"].contains(&session.user.role.as_str()) {
        return Err("Se requiere sesión normal.".into());
    }
    auth::revalidate(dir, session)?;
    let (doc, _) = storage::read(dir)?;
    let project = doc.projects.into_iter().find(|p| p.id == project_id)
        .ok_or("Proyecto no autorizado o inexistente.")?;
    let project = with_work_status(dir, project)?;
    if session.user.role == "engineer" && !project.engineer_ids.contains(&session.user.id) {
        return Err("Proyecto no autorizado o inexistente.".into());
    }
    Ok(project)
}
pub fn overview(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
) -> Result<Overview, String> {
    active(dir, workspace_id)?;
    if session.user.role == "engineer" {
        if session.user.must_change_password {
            return Err("Se requiere sesión normal de Engineer.".into());
        }
        auth::revalidate(dir, session)?;
        let (doc, _) = storage::read(dir)?;
        let projects = with_priority(doc.projects)
            .into_iter()
            .map(|project| with_work_status(dir, project))
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|project| project.engineer_ids.contains(&session.user.id))
            .collect();
        return Ok(Overview {
            projects,
            leads: vec![models::Lead {
                id: session.user.id.clone(),
                name: session.user.name.clone(),
            }],
            can_create: false,
            write_message: "Consulta los proyectos donde estás asignado.".into(),
        });
    }
    let leads = context(dir, session)?;
    let (doc, _) = storage::read(dir)?;
    let projects = with_priority(doc.projects)
        .into_iter()
        .map(|project| with_work_status(dir, project))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Overview {
        projects,
        leads,
        can_create: require_supervisor(dir, session).is_ok(),
        write_message: if session.user.role == "supervisor" {
            match require_supervisor(dir, session) {
                Ok(()) => "Registra el proyecto y selecciona a los ingenieros responsables.".into(),
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
    if input.engineer_ids.is_empty() || input.engineer_ids.iter().any(|id| !leads.iter().any(|m| &m.id == id)) {
        return Err("Selecciona ingenieros activos del equipo.".into());
    }
    let (mut doc, previous) = storage::read(dir)?;
    // Auto‑generate the project WBS if the client did not supply one.
    // Existing numeric WBS values are parsed as i32; the next free integer is used.
    let generated_wbs = if input.wbs.trim().is_empty() {
        let mut max = 0i32;
        for p in &doc.projects {
            if let Ok(num) = p.wbs.parse::<i32>() {
                if num > max { max = num; }
            }
        }
        (max + 1).to_string()
    } else {
        input.wbs.trim().to_string()
    };
    let next_priority = (doc.projects.len() + 1) as u32;
    let mut project = Project {
        id: String::new(),
        wbs: generated_wbs,
        name: input.name.trim().into(),
        process_area: input.process_area.trim().into(),
        engineer_ids: input.engineer_ids,
        start_date: input.start_date,
        target_date: input.target_date,
        status: "Not Started".into(),
        priority: Some(next_priority),
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
        if project.engineer_ids.iter().any(|id| !leads.iter().any(|m| &m.id == id)) {
            return Err("Un ingeniero asignado ya no está activo.".into());
        }
        Ok(())
    })?;
    Ok(project)
}

pub fn reorder(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_ids: Vec<String>,
) -> Result<Overview, String> {
    active(dir, workspace_id)?;
    require_supervisor(dir, session)?;
    let (mut doc, previous) = storage::read(dir)?;
    if project_ids.len() != doc.projects.len() {
        return Err("La lista de proyectos para reordenar no coincide con el total de proyectos.".into());
    }
    let mut seen = std::collections::HashSet::new();
    for id in &project_ids {
        if !seen.insert(id.to_lowercase()) {
            return Err("Lista de proyectos contiene identificadores duplicados.".into());
        }
    }
    for project in &doc.projects {
        if !seen.contains(&project.id.to_lowercase()) {
            return Err("Faltan proyectos existentes en el reordenamiento.".into());
        }
    }
    doc.projects.sort_by_key(|p| {
        project_ids
            .iter()
            .position(|id| id.eq_ignore_ascii_case(&p.id))
            .unwrap_or(usize::MAX)
    });
    for (idx, p) in doc.projects.iter_mut().enumerate() {
        p.priority = Some((idx + 1) as u32);
    }
    storage::save(dir, &doc, &previous, || {
        active(dir, workspace_id)?;
        require_supervisor(dir, session)
    })?;
    overview(dir, session, workspace_id)
}

pub fn delete(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
) -> Result<Overview, String> {
    active(dir, workspace_id)?;
    require_supervisor(dir, session)?;
    let (mut doc, previous) = storage::read(dir)?;
    let before = doc.projects.len();
    doc.projects.retain(|p| p.id != project_id);
    if doc.projects.len() == before {
        return Err("Proyecto no encontrado.".into());
    }
    for (idx, p) in doc.projects.iter_mut().enumerate() {
        p.priority = Some((idx + 1) as u32);
    }
    storage::save(dir, &doc, &previous, || {
        active(dir, workspace_id)?;
        require_supervisor(dir, session)
    })?;
    overview(dir, session, workspace_id)
}

#[cfg(test)]
mod tests;
