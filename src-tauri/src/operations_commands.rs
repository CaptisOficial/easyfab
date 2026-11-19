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
        use std::sync::atomic::Ordering;
        let (session, dir, id, epoch) = {
            let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
            (
                guard.as_ref().ok_or("Ingresa primero.")?.clone(),
                data_path(&state)?,
                workspace_id(&state)?,
                state.session_epoch.load(Ordering::SeqCst),
            )
        };
        crate::reporting::export(
            &dir,
            &session,
            &id,
            &reporting_date,
            |target, bytes| {
                // Excel never holds the global session lock. Publication does.
                let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
                let current = guard.as_ref().ok_or("Ingresa primero.")?;
                if state.session_epoch.load(Ordering::SeqCst) != epoch
                    || current.user.id != session.user.id
                    || current.fingerprint != session.fingerprint
                    || workspace_id(&state)? != id
                    || data_path(&state)? != dir
                {
                    return Err("La sesión cambió durante la exportación. Vuelve a generar el reporte.".into());
                }
                crate::data_store::publish(target, bytes, None, || {
                    plant::context(&dir, current, &id)?;
                    crate::data_store::contained(dir.parent().ok_or("Espacio inválido.")?, target)
                })
            },
        )
    })
    .await
    .map_err(|e| format!("No se pudo completar la operación: {e}"))?
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
