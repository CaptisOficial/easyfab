//! EasyFAB - núcleo Tauri v2.
//!
//! Fase 1: detección de OneDrive y auto-bootstrap de `Management/Data`.

mod auth;
mod auth_commands;
mod bootstrap;
mod onedrive;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// Estado de la app: la ruta de datos la decide el backend (no el frontend),
/// para que la UI no pueda dirigir escrituras a rutas arbitrarias.
#[derive(Default)]
pub(crate) struct AppState {
    data_dir: Mutex<Option<PathBuf>>,
    session: Mutex<Option<auth::Session>>,
    session_epoch: std::sync::atomic::AtomicU64,
    attempts: Mutex<(u32, Option<std::time::Instant>)>,
}

#[tauri::command]
fn detect_onedrive_path(state: State<'_, AppState>) -> onedrive::OneDriveDetection {
    let det = onedrive::detect();
    *state.data_dir.lock().expect("estado envenenado") = det.data_dir.as_ref().map(PathBuf::from);
    det
}

#[tauri::command]
fn bootstrap_data_dir(state: State<'_, AppState>) -> Result<bootstrap::BootstrapReport, String> {
    let dir = state
        .data_dir
        .lock()
        .map_err(|_| "estado envenenado".to_string())?
        .clone()
        .ok_or_else(|| "Primero se debe detectar la carpeta de OneDrive.".to_string())?;
    bootstrap::bootstrap(&dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            detect_onedrive_path,
            bootstrap_data_dir,
            auth_commands::list_login_users,
            auth_commands::login,
            auth_commands::logout,
            auth_commands::change_password,
            auth_commands::reset_password
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar EasyFAB");
}
