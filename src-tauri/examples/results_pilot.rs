//! Native QA harness using real domain/IPC and exclusively synthetic target data.
//! Not registered in the product executable and never bypasses a product login.
#[path = "../src/auth.rs"]
#[allow(dead_code, unused_imports)]
mod auth;
#[path = "../src/auth_commands.rs"]
#[allow(dead_code)]
mod auth_commands;
#[path = "../src/bootstrap.rs"]
mod bootstrap;
#[path = "../src/data_store.rs"]
#[allow(dead_code)]
mod data_store;
#[path = "../src/workspace.rs"]
#[allow(dead_code)]
mod workspace;
#[path = "../src/workspace_assets.rs"]
mod workspace_assets;
#[path = "../src/projects/mod.rs"]
#[allow(dead_code)]
mod projects;
#[path = "../src/project_results.rs"]
#[allow(dead_code)]
mod project_results;
#[path = "../src/activities.rs"]
#[allow(dead_code)]
mod activities;
#[path = "../src/results_store.rs"]
#[allow(dead_code)]
mod results_store;
#[path = "../src/project_commands.rs"]
#[allow(dead_code)]
mod project_commands;
#[path = "../src/results_commands.rs"]
mod results_commands;
use std::{fs, path::PathBuf, sync::{Mutex, atomic::AtomicU64}};
use tauri::Manager;
#[derive(Default)]
pub(crate) struct AppState {
    workspace: Mutex<Option<workspace::WorkspaceInfo>>,
    session: Mutex<Option<auth::Session>>,
    session_epoch: AtomicU64,
    attempts: Mutex<(u32, Option<std::time::Instant>)>,
}
fn synthetic_pdf() -> Vec<u8> {
    let content = "BT /F1 12 Tf 40 750 Td (Synthetic QA capacity evidence - no operational actuals) Tj ET";
    let objects = [
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>".to_string(),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
        format!("<< /Length {} >>\nstream\n{content}\nendstream", content.len()),
    ];
    let mut bytes = b"%PDF-1.4\n".to_vec(); let mut offsets = vec![0];
    for (index, object) in objects.iter().enumerate() {
        offsets.push(bytes.len()); bytes.extend_from_slice(format!("{} 0 obj\n{object}\nendobj\n", index + 1).as_bytes());
    }
    let start = bytes.len(); bytes.extend_from_slice(b"xref\n0 6\n0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) { bytes.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes()); }
    bytes.extend_from_slice(format!("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n").as_bytes()); bytes
}
fn main() -> Result<(), String> {
    let target = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target");
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    let base = PathBuf::from(std::env::args().nth(1).ok_or("Indica target/results-pilot-<id>.")?);
    if base.parent().and_then(|p| p.canonicalize().ok()) != target.canonicalize().ok()
        || !base.file_name().and_then(|v| v.to_str()).is_some_and(|v| v.starts_with("results-pilot-")) {
        return Err("El piloto solo admite una carpeta sintética directa de target/results-pilot-<id>.".into());
    }
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    if !base.canonicalize().map_err(|e| e.to_string())?.starts_with(target.canonicalize().map_err(|e| e.to_string())?) {
        return Err("Destino fuera del área de pruebas.".into());
    }
    let role = std::env::args().nth(2).unwrap_or_else(|| "supervisor".into());
    if !["supervisor", "engineer", "engineer2", "admin"].contains(&role.as_str()) { return Err("Rol sintético inválido.".into()); }
    let shared = base.join("shared"); let local = base.join("local");
    fs::create_dir_all(&shared).map_err(|e| e.to_string())?;
    // Only this child process sees the isolated LocalAppData.
    std::env::set_var("LOCALAPPDATA", &local);
    let info = workspace::initialize(&shared, &local.join("EasyFAB"))?;
    let dir = PathBuf::from(&info.data_dir);
    if auth::team(&dir)?.members.is_empty() {
        let temporary = auth::provision_initial_admin(&dir, "admin".into(), "QA Admin sintético".into())?;
        let restricted = auth::authenticate(&dir, "admin", &temporary)?;
        auth::change_password(&dir, &restricted, "Qa123456")?;
        let admin = auth::authenticate(&dir, "admin", "Qa123456")?;
        for (id, role) in [("supervisor", "supervisor"), ("engineer", "engineer"), ("engineer2", "engineer")] {
            let temporary = auth::create_user(&dir, &admin, auth::NewUser { id: id.into(), name: format!("QA {id} sintético"), role: role.into() })?;
            let restricted = auth::authenticate(&dir, id, &temporary)?;
            auth::change_password(&dir, &restricted, "Qa123456")?;
        }
    }
    if auth::team(&dir)?.members.iter().any(|m| !["admin", "supervisor", "engineer", "engineer2"].contains(&m.id.as_str())) {
        return Err("El destino contiene usuarios ajenos al piloto; no se modificó.".into());
    }
    let supervisor = auth::authenticate(&dir, "supervisor", "Qa123456")?;
    let overview = projects::overview(&dir, &supervisor, &info.id)?;
    let project = if let Some(project) = overview.projects.first() { project.clone() } else {
        projects::create(&dir, &supervisor, &info.id, projects::NewProject { wbs: String::new(), name: "Piloto · Estación disponible para producción".into(), process_area: "FAB sintético".into(), engineer_ids: vec!["engineer".into(), "engineer2".into()], start_date: "2026-10-26".into(), target_date: "2026-11-06".into() })?
    };
    if !results_store::is_active(&dir, &project.id)? {
        let mut draft: results_store::CommitmentDraft = serde_json::from_value(serde_json::json!({
            "final_outcome":"Estación instalada, validada y transferida a operación",
            "scope":"Piloto sintético de instalación, pruebas y transferencia",
            "start_date":"2026-10-26","target_date":"2026-11-06","engineer_ids":["engineer","engineer2"],
            "deliverables":[
                {"id":"installation","title":"Equipo instalado","due_date":"2026-10-30","criteria":[{"id":"installation_check","description":"Instalación comprobada contra especificación acordada","evidence_required":false}]},
                {"id":"validation","title":"Desempeño y transferencia","due_date":"2026-11-06","criteria":[{"id":"capacity","description":"Capacidad de prueba alcanzada y operación transferida","evidence_required":true}]}
            ]
        })).map_err(|e| e.to_string())?;
        draft.engineer_ids = project.engineer_ids.clone();
        results_store::save_commitment(&dir, &supervisor, &info.id, results_store::CommitmentInput { project_id: project.id.clone(), expected_revision: None, commitment: draft, change_reason: "Piloto aislado autorizado para QA".into(), legacy_deliverable_id: None })?;
        let engineer = auth::authenticate(&dir, "engineer", "Qa123456")?;
        for (id, delivery, title, start, end, progress) in [
            ("installation_task","installation","Instalar y comprobar el equipo","2026-10-26","2026-10-30",50),
            ("validation_task","validation","Probar desempeño y transferir operación","2026-10-30","2026-11-06",0),
        ] {
            results_store::save_activity(&dir, &engineer, &info.id, results_store::ActivityInput { project_id: project.id.clone(), expected_revision: None,
                activity: project_results::Activity { id:id.into(), deliverable_id:delivery.into(), title:title.into(), responsible_id:if progress==0{"engineer2".into()}else{"engineer".into()}, forecast_start:start.into(), forecast_due:end.into(), dependency_ids:if progress==0{vec!["installation_task".into()]}else{vec![]}, status:if progress==0{project_results::ActivityStatus::NotStarted}else{project_results::ActivityStatus::InProgress}, progress, at_risk:false, hours_spent:None, note:None } })?;
        }
        let state = results_store::detail(&dir, &engineer, &info.id, &project.id)?;
        let task = state.activities.iter().find(|entry| entry.activity.id == "validation_task").ok_or("Falta actividad sintética de validación")?;
        results_store::attach(&dir, &engineer, &info.id, results_store::AttachmentInput {
            project_id: project.id.clone(), activity_id: task.activity.id.clone(), expected_revision: task.revision.clone(),
            name: "capacidad-qa.pdf".into(), bytes: synthetic_pdf(),
        })?;
        results_store::save_blocker(&dir, &engineer, &info.id, results_store::BlockerInput { project_id:project.id.clone(), blocker_id:None, expected_revision:None, activity_id:"installation_task".into(), reason:"Pendiente acceso al área de instalación".into(), help_needed:"Coordinar acceso para terminar la instalación".into(), action:"report".into(), comment:String::new() })?;
    }
    let session = auth::authenticate(&dir, &role, "Qa123456")?;
    let url: tauri::Url = format!("http://tauri.localhost/qa/results-pilot.html?projectId={}&role={}", project.id, role).parse().map_err(|e|format!("URL de QA inválida: {e}"))?;
    let state = AppState::default();
    *state.workspace.lock().map_err(|_|"Estado inválido")? = Some(info);
    *state.session.lock().map_err(|_|"Estado inválido")? = Some(session);
    tauri::Builder::default().manage(state).invoke_handler(tauri::generate_handler![
        results_commands::results_detail, results_commands::results_save_commitment,
        results_commands::results_save_activity, results_commands::results_save_blocker,
        results_commands::results_review, results_commands::results_set_closure,
        results_commands::results_resolve, results_commands::results_attach_evidence,
        results_commands::results_read_evidence,
    ]).setup(move |app| {
        let window = app.get_webview_window("main").ok_or("Falta ventana de QA")?;
        window.set_title(&format!("EasyFAB · QA sintético · {role}"))?;
        window.navigate(url)?;
        window.show()?;
        Ok(())
    }).run(tauri::generate_context!("tauri.pilot.conf.json")).map_err(|e| e.to_string())
}
