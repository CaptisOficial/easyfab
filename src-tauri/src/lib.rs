//! EasyFAB - núcleo Tauri v2.
//!
//! Espacio configurable validado antes de habilitar acceso y operaciones.

mod auth;
mod auth_commands;
mod bootstrap;
mod onedrive;
mod project_commands;
mod projects;
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
            project_commands::create_project,
            auth_commands::reset_password
        ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app_builder(tauri::Builder::default())
        .run(tauri::generate_context!())
        .expect("error al iniciar EasyFAB");
}
