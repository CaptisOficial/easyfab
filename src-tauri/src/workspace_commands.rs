use crate::{workspace, AppState};
use std::{
    path::{Path, PathBuf},
    sync::atomic::Ordering,
};
use tauri::State;

fn local_dir() -> Result<PathBuf, String> {
    std::env::var_os("LOCALAPPDATA")
        .map(|root| PathBuf::from(root).join("EasyFAB"))
        .ok_or("No se encontró la carpeta local de instalación.".into())
}
#[tauri::command]
pub(crate) fn workspace_status(
    state: State<'_, AppState>,
) -> Result<workspace::WorkspaceStatus, String> {
    let mut active = state
        .workspace
        .lock()
        .map_err(|_| "Estado no disponible.")?;
    if let Some(info) = active.as_ref() {
        return Ok(workspace::status_for(info));
    }
    let status = workspace::probe(
        &local_dir()?,
        &std::env::current_exe().map_err(|e| e.to_string())?,
        crate::onedrive::detect().engineering_root,
    );
    if let Some(info) = status.workspace.as_ref() {
        *active = Some(info.clone());
    }
    Ok(status)
}
#[tauri::command]
pub(crate) fn configure_workspace(
    state: State<'_, AppState>,
    root: String,
) -> Result<workspace::WorkspaceInfo, String> {
    let session = state.session.lock().map_err(|_| "Estado no disponible.")?;
    if session.is_some() {
        return Err("Cierra tu sesión antes de cambiar el espacio.".into());
    }
    let info = workspace::initialize(Path::new(root.trim()), &local_dir()?)?;
    state.session_epoch.fetch_add(1, Ordering::SeqCst);
    *state
        .workspace
        .lock()
        .map_err(|_| "Estado no disponible.")? = Some(info.clone());
    Ok(info)
}
