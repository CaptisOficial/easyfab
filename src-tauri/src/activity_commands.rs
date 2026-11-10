use crate::{activities, auth_commands::data_path, project_commands::workspace_id, AppState};
use tauri::State;
#[tauri::command]
pub(crate) fn set_project_progress(
    state: State<'_, AppState>,
    input: activities::ProgressInput,
) -> Result<activities::Detail, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    activities::set_progress(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        input,
    )
}
#[tauri::command]
pub(crate) fn project_detail(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<activities::Detail, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    activities::detail(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        &project_id,
    )
}
#[tauri::command]
pub(crate) fn save_activity(
    state: State<'_, AppState>,
    input: activities::ActivityInput,
) -> Result<activities::Detail, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    activities::save(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        input,
    )
}
#[tauri::command]
pub(crate) fn attach_evidence(
    state: State<'_, AppState>,
    input: activities::AttachmentInput,
) -> Result<activities::Detail, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    activities::attach(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        input,
    )
}
#[tauri::command]
pub(crate) fn read_evidence(
    state: State<'_, AppState>,
    project_id: String,
    owner_id: String,
    activity_id: String,
    evidence_id: String,
) -> Result<Vec<u8>, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    activities::evidence_bytes(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        &project_id,
        &owner_id,
        &activity_id,
        &evidence_id,
    )
}
#[tauri::command]
pub(crate) fn review_activity(
    state: State<'_, AppState>,
    input: activities::ReviewInput,
) -> Result<activities::Detail, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    activities::review(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        input,
    )
}
