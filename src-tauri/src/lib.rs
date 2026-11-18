//! EasyFAB - núcleo Tauri v2.
//!
//! Espacio configurable validado antes de habilitar acceso y operaciones.

mod activities;
mod activity_commands;
mod auth;
mod auth_commands;
mod bootstrap;
mod data_store;
mod evidence_preview;
mod incidents;
mod onedrive;
mod operations_commands;
mod plant;
mod preferences;
mod project_commands;
pub mod project_results;
mod projects;
mod reporting;
mod results_commands;
mod results_store;
mod user_commands;
mod workspace;
mod workspace_assets;
mod workspace_commands;

use std::sync::Mutex;

/// Estado de la app: la ruta de datos la decide el backend (no el frontend),
/// para que la UI no pueda dirigir escrituras a rutas arbitrarias.
#[derive(Default)]
pub(crate) struct AppState {
    workspace: Mutex<Option<workspace::WorkspaceInfo>>,
    session: Mutex<Option<auth::Session>>,
    session_epoch: std::sync::atomic::AtomicU64,
    attempts: Mutex<(u32, Option<std::time::Instant>)>,
}

fn app_builder<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            workspace_commands::workspace_status,
            workspace_commands::configure_workspace,
            auth_commands::list_login_users,
            auth_commands::login,
            auth_commands::logout,
            auth_commands::change_password,
            user_commands::provision_initial_admin,
            user_commands::list_users,
            user_commands::create_user,
            user_commands::set_user_active,
            project_commands::projects_overview,
            project_commands::project_results_capabilities,
            results_commands::results_detail,
            results_commands::results_save_commitment,
            results_commands::results_save_activity,
            results_commands::results_save_blocker,
            results_commands::results_request_activity_revision,
            results_commands::results_review,
            results_commands::results_set_closure,
            results_commands::results_resolve,
            results_commands::results_attach_evidence,
            results_commands::results_read_evidence,
            results_commands::results_open_evidence,
            project_commands::create_project,
            project_commands::reorder_projects,
            project_commands::set_project_target,
            activity_commands::set_project_progress,
            activity_commands::project_detail,
            activity_commands::save_activity,
            activity_commands::attach_evidence,
            activity_commands::read_evidence,
            activity_commands::open_evidence,
            activity_commands::review_activity,
            operations_commands::plant_catalogs,
            operations_commands::save_plant_catalogs,
            operations_commands::incidents_overview,
            operations_commands::save_incident,
            operations_commands::user_preferences,
            operations_commands::save_user_preferences,
            operations_commands::reset_user_preferences,
            operations_commands::weekly_snapshot,
            operations_commands::export_weekly,
            auth_commands::reset_password
        ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app_builder(tauri::Builder::default())
        .run(tauri::generate_context!())
        .expect("error al iniciar EasyFAB");
}
