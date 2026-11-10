use crate::{auth_commands::data_path, incidents, plant, project_commands::workspace_id, AppState};
use tauri::State;
#[tauri::command]
pub(crate) fn weekly_snapshot(
    state: State<'_, AppState>,
    reporting_date: String,
) -> Result<crate::reporting::Snapshot, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    crate::reporting::snapshot(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        &reporting_date,
    )
}
#[tauri::command]
pub(crate) async fn export_weekly<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    reporting_date: String,
) -> Result<crate::reporting::Export, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use tauri::Manager;
        let state = app.state::<AppState>();
        let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
        crate::reporting::export(
            &data_path(&state)?,
            guard.as_ref().ok_or("Ingresa primero.")?,
            &workspace_id(&state)?,
            &reporting_date,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) fn user_preferences(
    state: State<'_, AppState>,
) -> Result<crate::preferences::View, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    crate::preferences::view(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
    )
}
#[tauri::command]
pub(crate) fn save_user_preferences(
    state: State<'_, AppState>,
    input: crate::preferences::Input,
) -> Result<crate::preferences::View, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    crate::preferences::save(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        input,
    )
}
#[tauri::command]
pub(crate) fn reset_user_preferences(
    state: State<'_, AppState>,
) -> Result<crate::preferences::View, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    crate::preferences::reset(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
    )
}
#[tauri::command]
pub(crate) fn plant_catalogs(state: State<'_, AppState>) -> Result<plant::View, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    plant::view(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
    )
}
#[tauri::command]
pub(crate) fn save_plant_catalogs(
    state: State<'_, AppState>,
    input: plant::Input,
) -> Result<plant::View, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    plant::save(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        input,
    )
}
#[tauri::command]
pub(crate) fn incidents_overview(
    state: State<'_, AppState>,
) -> Result<incidents::Overview, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    incidents::overview(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
    )
}
#[tauri::command]
pub(crate) fn save_incident(
    state: State<'_, AppState>,
    input: incidents::Input,
) -> Result<incidents::Overview, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    incidents::save(
        &data_path(&state)?,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &workspace_id(&state)?,
        input,
    )
}
