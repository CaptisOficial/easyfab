//! Engineer-owned work, immutable evidence and Supervisor decisions bound to content.
use crate::{auth, data_store as store, projects, workspace};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Serialize, Deserialize)]
pub struct Evidence {
    pub id: String,
    pub name: String,
    pub relative_path: String,
    pub sha256: String,
    pub size: usize,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: String,
    pub project_id: String,
    pub wbs: String,
    pub task_title: String,
    pub start_date: String,
    pub due_date: String,
    pub milestone_gate: u8,
    pub status: String,
    pub supervisor_approved: bool,
    #[serde(default)]
    pub hours_spent: Option<f64>,
    #[serde(default)]
    pub evidence: Vec<Evidence>,
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
// The `wbs` field is kept for API compatibility but is generated internally.
// Prevent the dead_code warning because the value is intentionally ignored.
#[allow(dead_code)]
pub struct ActivityInput {
    pub id: Option<String>,
    pub expected_revision: Option<String>,
    pub project_id: String,
    pub wbs: String,
    pub task_title: String,
    pub start_date: String,
    pub due_date: String,
    pub milestone_gate: u8,
    pub at_risk: bool,
    #[serde(default)]
    pub hours_spent: Option<f64>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Entry {
    pub owner_id: String,
    pub owner_name: String,
    pub revision: String,
    pub activity: Activity,
    pub decision: Option<Decision>,
}
#[derive(Serialize)]
pub struct Detail {
    pub project: projects::Project,
    pub entries: Vec<Entry>,
    pub can_edit: bool,
    pub can_review: bool,
    pub declared_progress: Option<u8>,
    pub engineer_progress: Vec<EngineerProgress>,
    pub hours_spent: Option<f64>,
}
#[derive(Serialize)]
pub struct EngineerProgress {
    pub engineer_id: String,
    pub engineer_name: String,
    pub progress: Option<u8>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProgressInput {
    pub project_id: String,
    pub progress: u8,
    pub expected_progress: Option<u8>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Decision {
    pub id: String,
    pub project_id: String,
    pub owner_id: String,
    pub activity_id: String,
    pub revision: String,
    pub accepted: bool,
    pub comment: String,
    pub supervisor_id: String,
    pub recorded_at: String,
    pub signature: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewInput {
    pub project_id: String,
    pub owner_id: String,
    pub activity_id: String,
    pub revision: String,
    pub accepted: bool,
    pub comment: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AttachmentInput {
    pub project_id: String,
    pub activity_id: String,
    pub revision: String,
    pub name: String,
    pub bytes: Vec<u8>,
}

fn revision(activity: &Activity) -> String {
    let mut value = activity.clone();
    value.supervisor_approved = false;
    store::hash(&serde_json::to_vec(&value).expect("serializable activity"))
}
fn normal(dir: &Path, session: &auth::Session, workspace_id: &str) -> Result<(), String> {
    projects::active(dir, workspace_id)?;
    if session.user.must_change_password {
        return Err("Completa el cambio de contraseña primero.".into());
    }
    auth::revalidate(dir, session)
}
fn profile(dir: &Path, owner: &str) -> Result<(PathBuf, Value, Vec<u8>, Vec<Activity>), String> {
    let path = workspace::profile_path(dir, owner)?;
    store::contained(dir, &path)?;
    let bytes = fs::read(&path).map_err(|e| format!("No se pudo leer el perfil: {e}"))?;
    let value: Value =
        serde_json::from_slice(&bytes).map_err(|_| "Perfil inválido; no se reinicializó.")?;
    if value["engineer_id"].as_str() != Some(owner) {
        return Err("Perfil de otro propietario.".into());
    }
    let activities: Vec<Activity> = serde_json::from_value(
        value
            .get("subactivities")
            .cloned()
            .ok_or("Faltan actividades del perfil.")?,
    )
    .map_err(|_| "Actividades inválidas.")?;
    if let Some(markers) = value.get("started_projects") {
        let markers = markers.as_object().ok_or("Registro de inicio inválido.")?;
        if markers.values().any(|v| v.as_bool() != Some(true)) {
            return Err("Registro de inicio inválido.".into());
        }
    }
    let mut ids = HashSet::new();
    for activity in &activities {
        validate(activity)?;
        if !ids.insert(&activity.id) {
            return Err("Actividades duplicadas.".into());
        }
    }
    Ok((path, value, bytes, activities))
}
// Persisted with the work itself: no second shared-file write or read-side effects.
fn mark_started(value: &mut Value, project_id: &str) -> Result<(), String> {
    if value.get("started_projects").is_none() { value["started_projects"] = json!({}); }
    if !value["started_projects"].is_object() { return Err("Registro de inicio inválido; no se reinicializó.".into()); }
    value["started_projects"][project_id] = json!(true);
    Ok(())
}
pub(crate) fn has_started(dir: &Path, project: &projects::Project) -> Result<bool, String> {
    let mut started = false;
    for id in &project.engineer_ids {
    let path = workspace::profile_path(dir, id)?;
    if !path.exists() { continue; }
    let (_, value, _, activities) = profile(dir, id)?;
    started |= value.get("started_projects").and_then(|v| v.get(&project.id)).and_then(Value::as_bool) == Some(true)
        || value.get("project_progress").and_then(|v| v.get(&project.id)).and_then(Value::as_u64).is_some_and(|p| p > 0)
        || activities.iter().any(|a| a.project_id == project.id && (a.milestone_gate > 0 || a.hours_spent.is_some_and(|h| h > 0.0)));
    }
    Ok(started)
}
fn validate(activity: &Activity) -> Result<(), String> {
    if activity
        .hours_spent
        .is_some_and(|h| !h.is_finite() || h < 0.0)
    {
        return Err("El tiempo invertido debe ser un número de horas no negativo.".into());
    }
    if [
        &activity.id,
        &activity.project_id,
        &activity.wbs,
        &activity.task_title,
    ]
    .iter()
    .any(|s| s.trim().is_empty() || s.chars().any(char::is_control))
        || ![0, 25, 50, 75, 100].contains(&activity.milestone_gate)
        || !["Not Started", "In Progress", "At Risk", "Completed"]
            .contains(&activity.status.as_str())
    {
        return Err("Revisa título, WBS, estado e hito de la actividad.".into());
    }
    projects::validate_dates(&activity.start_date, &activity.due_date)
}
fn authorized_project(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    id: &str,
) -> Result<projects::Project, String> {
    normal(dir, session, workspace_id)?;
    projects::authorized(dir, session, workspace_id, id)
}
fn decisions(dir: &Path) -> Result<Vec<Decision>, String> {
    let path = dir.join("reviews");
    store::contained(dir, &path)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let key = auth::read_key()?;
    let mut result = vec![];
    for item in fs::read_dir(path).map_err(|e| e.to_string())? {
        let path = item.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|v| v.to_str()) != Some("json") {
            continue;
        }
        store::contained(dir, &path)?;
        let mut d: Decision = serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
            .map_err(|_| "Revisión inválida.")?;
        let signature = d.signature.clone();
        d.signature.clear();
        let payload = serde_json::to_string(&d).map_err(|e| e.to_string())?;
        if !auth::verify_role("review-v1", &payload, "sealed", &signature, &key) {
            return Err("Revisión alterada.".into());
        }
        d.signature = signature;
        result.push(d);
    }
    result.sort_by(|a, b| (&a.recorded_at, &a.id).cmp(&(&b.recorded_at, &b.id)));
    Ok(result)
}
pub fn detail(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
) -> Result<Detail, String> {
    if !crate::results_store::is_active(dir, project_id)? {
        return legacy_detail(dir, session, workspace_id, project_id);
    }
    let data = crate::results_store::detail(dir, session, workspace_id, project_id)?;
    if !data.conflicts.is_empty() || !data.plan_issues.is_empty() {
        return Err("Hay versiones concurrentes o relaciones de planificación pendientes. Resuélvelas antes de consolidar el reporte.".into());
    }
    let entries: Vec<Entry> = data.activities.into_iter().enumerate().map(|(index, entry)| Entry {
        owner_id: entry.created_by.clone(),
        owner_name: entry.created_by,
        revision: entry.revision,
        activity: Activity {
            id: entry.activity.id,
            project_id: project_id.into(),
            wbs: (index + 1).to_string(),
            task_title: entry.activity.title,
            start_date: entry.activity.forecast_start,
            due_date: entry.activity.forecast_due,
            milestone_gate: entry.activity.progress,
            status: match entry.activity.status {
                crate::project_results::ActivityStatus::NotStarted => "Not Started",
                crate::project_results::ActivityStatus::InProgress => "In Progress",
                crate::project_results::ActivityStatus::Done => "Completed",
            }.into(),
            // Acceptance belongs to deliverables, never an editable activity flag.
            supervisor_approved: false,
            hours_spent: entry.activity.hours_spent,
            evidence: entry.evidence,
            extra: BTreeMap::new(),
        },
        decision: None,
    }).collect();
    let hours_spent = if entries.is_empty() || entries.iter().any(|e| e.activity.hours_spent.is_none()) {
        None
    } else { Some(entries.iter().filter_map(|e| e.activity.hours_spent).sum()) };
    Ok(Detail { project: data.project, entries, can_edit: false, can_review: false,
        declared_progress: None, engineer_progress: vec![], hours_spent })
}

fn require_legacy(dir: &Path, project_id: &str) -> Result<(), String> {
    if crate::results_store::is_active(dir, project_id)? {
        return Err("Este proyecto usa entregables. Actualiza desde su tabla de actividades; el historial anterior es de solo lectura.".into());
    }
    Ok(())
}

pub fn legacy_detail(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
) -> Result<Detail, String> {
    let project = authorized_project(dir, session, workspace_id, project_id)?;
    let reviews = decisions(dir)?;
    let team = auth::team(dir)?;
    let mut entries = vec![];
    for member in team.members.iter().filter(|m| {
        m.role == "engineer" && (session.user.role != "engineer" || m.id == session.user.id)
    }) {
        let path = workspace::profile_path(dir, &member.id)?;
        if !path.exists() {
            continue;
        }
        let (_, _, _, activities) = profile(dir, &member.id)?;
        for mut activity in activities
            .into_iter()
            .filter(|a| a.project_id == project.id)
        {
            let revision = revision(&activity);
            let decision = reviews
                .iter()
                .rev()
                .find(|d| {
                    d.owner_id == member.id
                        && d.activity_id == activity.id
                        && d.project_id == project.id
                        && d.revision == revision
                })
                .cloned();
            activity.supervisor_approved = decision.as_ref().is_some_and(|d| d.accepted);
            entries.push(Entry {
                owner_id: member.id.clone(),
                owner_name: member.name.clone(),
                revision,
                activity,
                decision,
            });
        }
    }
    let can_review = projects::require_supervisor(dir, session).is_ok();
    let mut engineer_progress = vec![];
    for id in &project.engineer_ids {
        if session.user.role == "engineer" && id != &session.user.id { continue; }
        let path = workspace::profile_path(dir, id)?;
        let progress = if path.exists() {
        let (_, value, _, _) = profile(dir, id)?;
        match value
            .get("project_progress")
            .and_then(|v| v.get(&project.id))
        {
            Some(value) => Some(
                value
                    .as_u64()
                    .filter(|p| [0, 25, 50, 75, 100].contains(p))
                    .ok_or("Avance general inválido.")? as u8,
            ),
            None => None,
        }
    } else {
        None
    };
        engineer_progress.push(EngineerProgress {
            engineer_id: id.clone(),
            engineer_name: team.members.iter().find(|m| &m.id == id).map(|m| m.name.clone()).unwrap_or_else(|| id.clone()),
            progress,
        });
    }
    // Each declaration belongs to its author. No aggregate is inferred from several engineers.
    let declared_progress = if engineer_progress.len() == 1 { engineer_progress[0].progress } else { None };
    let hours_spent =
        if entries.is_empty() || entries.iter().any(|e| e.activity.hours_spent.is_none()) {
            None
        } else {
            Some(
                entries
                    .iter()
                    .map(|e| e.activity.hours_spent.unwrap())
                    .sum(),
            )
        };
    Ok(Detail {
        project,
        entries,
        can_edit: session.user.role == "engineer" || session.user.role == "supervisor",
        can_review,
        declared_progress,
        engineer_progress,
        hours_spent,
    })
}
pub fn set_progress(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: ProgressInput,
) -> Result<Detail, String> {
    authorized_project(dir, session, workspace_id, &input.project_id)?;
    require_legacy(dir, &input.project_id)?;
    if session.user.role != "engineer" || ![0, 25, 50, 75, 100].contains(&input.progress) {
        return Err("Solo un ingeniero asignado declara su avance válido.".into());
    }
    let (path, mut value, previous, _) = profile(dir, &session.user.id)?;
    if value
        .get("project_progress")
        .and_then(|v| v.get(&input.project_id))
        .and_then(Value::as_u64)
        .map(|v| v as u8)
        != input.expected_progress
    {
        return Err("El avance general cambió. Actualiza el proyecto.".into());
    }
    if value.get("project_progress").is_none() {
        value["project_progress"] = json!({});
    }
    if !value["project_progress"].is_object() {
        return Err("Avances generales inválidos; no se reinicializaron.".into());
    }
    if input.progress > 0 || has_started(dir, &authorized_project(dir, session, workspace_id, &input.project_id)?)? { mark_started(&mut value, &input.project_id)?; }
    value["project_progress"][&input.project_id] = json!(input.progress);
    value["last_synced"] = json!(chrono::Utc::now().to_rfc3339());
    store::publish(
        &path,
        &serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?,
        Some(&previous),
        || {
            authorized_project(dir, session, workspace_id, &input.project_id)?;
            store::contained(dir, &path)
        },
    )?;
    detail(dir, session, workspace_id, &input.project_id)
}
fn save_profile(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
    path: &Path,
    mut value: Value,
    previous: &[u8],
    activities: &[Activity],
) -> Result<(), String> {
    let project = authorized_project(dir, session, workspace_id, project_id)?;
    if session.user.role == "engineer" && project.engineer_ids.contains(&session.user.id)
        && (has_started(dir, &project)? || activities.iter().any(|a| a.project_id == project_id && (a.milestone_gate > 0 || a.hours_spent.is_some_and(|h| h > 0.0)))) {
        mark_started(&mut value, project_id)?;
    }
    value["subactivities"] = serde_json::to_value(activities).map_err(|e| e.to_string())?;
    value["last_synced"] = json!(chrono::Utc::now().to_rfc3339());
    store::publish(
        path,
        &serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?,
        Some(previous),
        || {
            authorized_project(dir, session, workspace_id, project_id)?;
            store::contained(dir, path)
        },
    )
}
pub fn save(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: ActivityInput,
) -> Result<Detail, String> {
    authorized_project(dir, session, workspace_id, &input.project_id)?;
    require_legacy(dir, &input.project_id)?;
    // Engineer and Supervisor can register activities
    if session.user.role != "engineer" && session.user.role != "supervisor" {
        return Err("Solo Engineer o Supervisor pueden registrar actividades.".into());
    }
    let (path, value, previous, mut activities) = profile(dir, &session.user.id)?;
    let existing = input
        .id
        .as_ref()
        .map(|id| {
            activities
                .iter()
                .position(|a| &a.id == id && a.project_id == input.project_id)
                .ok_or("Actividad propia no encontrada.")
        })
        .transpose()?;
    if let Some(index) = existing {
        if input.expected_revision.as_deref() != Some(revision(&activities[index]).as_str()) {
            return Err("La actividad cambió. Actualiza antes de guardar.".into());
        }
    } else if input.expected_revision.is_some() {
        return Err("Una actividad nueva no tiene revisión anterior.".into());
    }
    let mut activity = existing.map(|i| activities[i].clone()).unwrap_or(Activity {
        id: format!("ACT-{}", auth::revision()),
        project_id: input.project_id.clone(),
        wbs: String::new(),
        task_title: String::new(),
        start_date: String::new(),
        due_date: String::new(),
        milestone_gate: 0,
        status: String::new(),
        supervisor_approved: false,
        hours_spent: None,
        evidence: vec![],
        extra: BTreeMap::new(),
    });
    // Auto-generate WBS if creating a new activity; preserve existing WBS on updates.
    if existing.is_some() {
        // keep existing WBS (already in activity)
    } else {
        // Determine next integer WBS within this project for this user.
        let mut max = 0i32;
        for a in &activities {
            if a.project_id == input.project_id {
                if let Ok(num) = a.wbs.parse::<i32>() {
                    if num > max { max = num; }
                }
            }
        }
        activity.wbs = (max + 1).to_string();
    }
    activity.task_title = input.task_title.trim().into();
    activity.start_date = input.start_date;
    activity.due_date = input.due_date;
    activity.milestone_gate = input.milestone_gate;
    activity.status = if input.at_risk {
        "At Risk"
    } else if input.milestone_gate == 0 && !input.hours_spent.is_some_and(|h| h > 0.0) {
        "Not Started"
    } else {
        "In Progress"
    }
    .into();
    activity.supervisor_approved = false;
    activity.hours_spent = input.hours_spent;
    // Each edit creates a distinct review identity even if fields are reverted later.
    activity
        .extra
        .insert("revision_id".into(), json!(auth::revision()));
    validate(&activity)?;
    if let Some(i) = existing {
        activities[i] = activity;
    } else {
        activities.push(activity);
    }
    save_profile(
        dir,
        session,
        workspace_id,
        &input.project_id,
        &path,
        value,
        &previous,
        &activities,
    )?;
    detail(dir, session, workspace_id, &input.project_id)
}
fn attachment_type(name: &str, bytes: &[u8]) -> Result<&'static str, String> {
    if bytes.is_empty() || bytes.len() > 20 * 1024 * 1024 {
        return Err("El archivo debe contener datos y no superar 20 MB.".into());
    }
    let ext = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "pdf" if bytes.starts_with(b"%PDF-") => Ok("pdf"),
        "png" if bytes.starts_with(b"\x89PNG\r\n\x1a\n") => Ok("png"),
        "jpg" | "jpeg" if bytes.starts_with(b"\xff\xd8\xff") => Ok("jpg"),
        _ => Err("Solo PDF, PNG o JPG con contenido válido.".into()),
    }
}
pub fn attach(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: AttachmentInput,
) -> Result<Detail, String> {
    authorized_project(dir, session, workspace_id, &input.project_id)?;
    require_legacy(dir, &input.project_id)?;
    if session.user.role != "engineer" {
        return Err("Solo Engineer adjunta evidencia propia.".into());
    }
    if input.name.is_empty()
        || input.name.contains(['/', '\\', ':'])
        || input.name.chars().any(char::is_control)
    {
        return Err("Nombre de archivo inválido.".into());
    }
    let ext = attachment_type(&input.name, &input.bytes)?;
    let (path, value, previous, mut activities) = profile(dir, &session.user.id)?;
    let activity = activities
        .iter_mut()
        .find(|a| a.id == input.activity_id && a.project_id == input.project_id)
        .ok_or("Actividad propia no encontrada.")?;
    if revision(activity) != input.revision {
        return Err("La actividad cambió. Actualiza antes de adjuntar.".into());
    }
    let parent = path.parent().ok_or("Perfil inválido.")?;
    if path.file_name().and_then(|s| s.to_str()) != Some("profile.json") {
        return Err(
            "Los adjuntos requieren el cambio explícito a carpetas personales layout 2.".into(),
        );
    }
    let id = auth::revision();
    let relative_path = format!("evidence/{id}.{ext}");
    let target = parent.join(&relative_path);
    store::contained(parent, &target)?;
    fs::create_dir_all(parent.join("evidence")).map_err(|e| e.to_string())?;
    store::publish(&target, &input.bytes, None, || {
        normal(dir, session, workspace_id)?;
        store::contained(parent, &target)
    })?;
    activity.evidence.push(Evidence {
        id,
        name: input.name,
        relative_path,
        sha256: store::hash(&input.bytes),
        size: input.bytes.len(),
    });
    activity.supervisor_approved = false;
    // On profile publication failure, the complete immutable file is retained as an
    // unreferenced orphan. It is never presented as attached or silently deleted.
    save_profile(
        dir,
        session,
        workspace_id,
        &input.project_id,
        &path,
        value,
        &previous,
        &activities,
    )?;
    detail(dir, session, workspace_id, &input.project_id)
}
pub fn evidence_bytes(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
    owner_id: &str,
    activity_id: &str,
    evidence_id: &str,
) -> Result<Vec<u8>, String> {
    if crate::results_store::is_active(dir, project_id)? {
        return crate::results_store::evidence_bytes(dir, session, workspace_id, project_id, evidence_id);
    }
    let detail = detail(dir, session, workspace_id, project_id)?;
    let entry = detail
        .entries
        .iter()
        .find(|e| e.owner_id == owner_id && e.activity.id == activity_id)
        .ok_or("Actividad no autorizada.")?;
    let evidence = entry
        .activity
        .evidence
        .iter()
        .find(|e| e.id == evidence_id)
        .ok_or("Evidencia no encontrada.")?;
    let profile = workspace::profile_path(dir, owner_id)?;
    let parent = profile.parent().ok_or("Perfil inválido.")?;
    let relative = Path::new(&evidence.relative_path);
    if !relative
        .components()
        .all(|c| matches!(c, std::path::Component::Normal(_)))
        || !evidence.relative_path.starts_with("evidence/")
    {
        return Err("Referencia de evidencia inválida.".into());
    }
    let target = parent.join(relative);
    store::contained(parent, &target)?;
    let metadata = fs::metadata(&target)
        .map_err(|_| "Evidencia no disponible. Comprueba la sincronización.")?;
    if metadata.len() > 20 * 1024 * 1024 {
        return Err("Evidencia supera el límite.".into());
    }
    let bytes = fs::read(target).map_err(|e| e.to_string())?;
    if store::hash(&bytes) != evidence.sha256 || bytes.len() != evidence.size {
        return Err("Evidencia incompleta o alterada.".into());
    }
    Ok(bytes)
}
pub fn review(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: ReviewInput,
) -> Result<Detail, String> {
    authorized_project(dir, session, workspace_id, &input.project_id)?;
    require_legacy(dir, &input.project_id)?;
    let snapshot = detail(dir, session, workspace_id, &input.project_id)?;
    projects::require_supervisor(dir, session)?;
    let entry = snapshot
        .entries
        .iter()
        .find(|e| e.owner_id == input.owner_id && e.activity.id == input.activity_id)
        .ok_or("Actividad no encontrada.")?;
    if entry.revision != input.revision || entry.activity.milestone_gate != 100 {
        return Err("La revisión cambió o no solicita cierre al 100%.".into());
    }
    if input.comment.trim().is_empty() && !input.accepted {
        return Err("Indica el motivo de devolución.".into());
    }
    if input.accepted {
        if entry.activity.evidence.is_empty() {
            return Err("El cierre requiere evidencia.".into());
        }
        for evidence in &entry.activity.evidence {
            evidence_bytes(
                dir,
                session,
                workspace_id,
                &input.project_id,
                &input.owner_id,
                &input.activity_id,
                &evidence.id,
            )?;
        }
    }
    let mut decision = Decision {
        id: auth::revision(),
        project_id: input.project_id.clone(),
        owner_id: input.owner_id.clone(),
        activity_id: input.activity_id.clone(),
        revision: input.revision.clone(),
        accepted: input.accepted,
        comment: input.comment.trim().into(),
        supervisor_id: session.user.id.clone(),
        recorded_at: chrono::Utc::now().to_rfc3339(),
        signature: String::new(),
    };
    let key = auth::read_key()?;
    decision.signature = auth::sign_role(
        "review-v1",
        &serde_json::to_string(&decision).map_err(|e| e.to_string())?,
        "sealed",
        &key,
    );
    let folder = dir.join("reviews");
    store::contained(dir, &folder)?;
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let path = folder.join(format!("{}.json", decision.id));
    store::publish(
        &path,
        &serde_json::to_vec_pretty(&decision).map_err(|e| e.to_string())?,
        None,
        || {
            let current = detail(dir, session, workspace_id, &input.project_id)?;
            projects::require_supervisor(dir, session)?;
            if !current.entries.iter().any(|e| {
                e.owner_id == input.owner_id
                    && e.activity.id == input.activity_id
                    && e.revision == input.revision
            }) {
                return Err("La revisión cambió antes de guardar.".into());
            }
            store::contained(dir, &path)
        },
    )?;
    detail(dir, session, workspace_id, &input.project_id)
}

#[cfg(test)]
#[path = "activities_tests.rs"]
mod tests;
