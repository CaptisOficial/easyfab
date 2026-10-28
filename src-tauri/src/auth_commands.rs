use crate::{auth, AppState};
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use tauri::State;

pub(crate) fn data_path(state: &AppState) -> Result<PathBuf, String> {
    let guard = state
        .workspace
        .lock()
        .map_err(|_| "Estado no disponible.")?;
    let info = guard
        .as_ref()
        .ok_or("Configura el espacio EasyFAB primero.")?;
    let current = crate::workspace::open(std::path::Path::new(&info.root), Some(&info.id))?;
    Ok(PathBuf::from(current.data_dir))
}
#[tauri::command]
pub(crate) fn list_login_users(state: State<'_, AppState>) -> Result<auth::LoginDirectory, String> {
    let team = auth::team(&data_path(&state)?)?;
    if team.members.is_empty() {
        return Ok(auth::LoginDirectory {
            users: vec![],
            requires_admin: true,
        });
    }
    let key = auth::read_key()?;
    Ok(auth::LoginDirectory {
        users: team
            .members
            .iter()
            .filter(|m| auth::trusted(m, &key))
            .map(|m| auth::Choice {
                id: m.id.clone(),
                name: m.name.clone(),
            })
            .collect(),
        requires_admin: false,
    })
}
#[tauri::command]
pub(crate) async fn login(
    state: State<'_, AppState>,
    user_id: String,
    pin: String,
) -> Result<auth::User, String> {
    let ticket = {
        let mut session = state.session.lock().map_err(|_| "Estado no disponible.")?;
        *session = None;
        state.session_epoch.fetch_add(1, Ordering::SeqCst) + 1
    };
    {
        let mut attempts = state.attempts.lock().map_err(|_| "Estado no disponible.")?;
        if let Some(until) = attempts.1 {
            if until.elapsed().as_secs() < 30 {
                return Err("Espera 30 segundos antes de intentar de nuevo.".into());
            }
            *attempts = (0, None);
        }
        attempts.0 += 1;
        if attempts.0 >= 5 {
            attempts.1 = Some(std::time::Instant::now());
        }
    }
    let dir = data_path(&state)?;
    let user =
        tauri::async_runtime::spawn_blocking(move || auth::authenticate(&dir, &user_id, &pin))
            .await
            .map_err(|_| "No se pudo verificar el acceso.")??;
    let mut session = state.session.lock().map_err(|_| "Estado no disponible.")?;
    if state.session_epoch.load(Ordering::SeqCst) != ticket {
        return Err("Intento de acceso cancelado.".into());
    }
    *session = Some(user.clone());
    *state.attempts.lock().map_err(|_| "Estado no disponible.")? = (0, None);
    Ok(user.user)
}
#[tauri::command]
pub(crate) fn logout(state: State<'_, AppState>) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|_| "Estado no disponible.")?;
    state.session_epoch.fetch_add(1, Ordering::SeqCst);
    *session = None;
    Ok(())
}

#[tauri::command]
pub(crate) fn change_password(state: State<'_, AppState>, new_pin: String) -> Result<(), String> {
    let dir = data_path(&state)?;
    let mut guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    let session = guard.as_ref().ok_or("Ingresa primero.")?;
    auth::change_password(&dir, session, &new_pin)?;
    state.session_epoch.fetch_add(1, Ordering::SeqCst);
    *guard = None;
    Ok(())
}
#[tauri::command]
pub(crate) fn reset_password(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<String, String> {
    let dir = data_path(&state)?;
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    let session = guard.as_ref().ok_or("Ingresa primero.")?;
    auth::reset_password(&dir, session, &user_id)
}
