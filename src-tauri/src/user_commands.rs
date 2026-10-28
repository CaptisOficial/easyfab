use crate::{auth, auth_commands::data_path, AppState};
use tauri::State;

#[tauri::command]
pub(crate) fn list_users(state: State<'_, AppState>) -> Result<Vec<auth::DirectoryUser>, String> {
    let dir = data_path(&state)?;
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    auth::list_users(&dir, guard.as_ref().ok_or("Ingresa primero.")?)
}
#[tauri::command]
pub(crate) fn create_user(
    state: State<'_, AppState>,
    input: auth::NewUser,
) -> Result<String, String> {
    let dir = data_path(&state)?;
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    auth::create_user(&dir, guard.as_ref().ok_or("Ingresa primero.")?, input)
}
#[tauri::command]
pub(crate) fn set_user_active(
    state: State<'_, AppState>,
    user_id: String,
    active: bool,
) -> Result<Option<String>, String> {
    let dir = data_path(&state)?;
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    auth::set_user_active(
        &dir,
        guard.as_ref().ok_or("Ingresa primero.")?,
        &user_id,
        active,
    )
}

#[tauri::command]
pub(crate) fn provision_initial_admin(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<String, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    if guard.is_some() {
        return Err("Cierra sesión antes del alta inicial.".into());
    }
    let dir = data_path(&state)?;
    auth::provision_initial_admin(&dir, id, name)
}
