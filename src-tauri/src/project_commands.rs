//! IPC keeps the session locked through the operation, serializing local creates.
use crate::{auth_commands::data_path, projects, AppState};
use tauri::State;
fn workspace_id(state: &AppState) -> Result<String, String> {
    state
        .workspace
        .lock()
        .map_err(|_| "Estado no disponible.")?
        .as_ref()
        .map(|w| w.id.clone())
        .ok_or("Configura el espacio primero.".into())
}
#[tauri::command]
pub(crate) fn projects_overview(state: State<'_, AppState>) -> Result<projects::Overview, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    let session = guard.as_ref().ok_or("Ingresa primero.")?;
    projects::overview(&data_path(&state)?, session, &workspace_id(&state)?)
}
#[tauri::command]
pub(crate) fn create_project(
    state: State<'_, AppState>,
    input: projects::NewProject,
) -> Result<projects::Project, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    let session = guard.as_ref().ok_or("Ingresa primero.")?;
    projects::create(&data_path(&state)?, session, &workspace_id(&state)?, input)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets};
    #[test]
    fn registered_commands_reject_absent_session_and_invalid_payload() {
        let app = crate::app_builder(mock_builder())
            .build(mock_context(noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        let call = |cmd: &str, body: serde_json::Value| {
            get_ipc_response(
                &webview,
                tauri::webview::InvokeRequest {
                    cmd: cmd.into(),
                    callback: tauri::ipc::CallbackFn(0),
                    error: tauri::ipc::CallbackFn(1),
                    url: "http://tauri.localhost".parse().unwrap(),
                    body: tauri::ipc::InvokeBody::Json(body),
                    headers: Default::default(),
                    invoke_key: tauri::test::INVOKE_KEY.into(),
                },
            )
        };
        let read = call("projects_overview", serde_json::json!({}));
        assert_eq!(read.err().unwrap(), serde_json::json!("Ingresa primero."));
        let input = serde_json::json!({"wbs":"FAB-1","name":"Fixture","process_area":"FAB","lead_engineer_id":"eng","start_date":"2026-10-28","target_date":"2026-10-29"});
        assert_eq!(
            call("create_project", serde_json::json!({"input":input}))
                .err()
                .unwrap(),
            serde_json::json!("Ingresa primero.")
        );
        let error = call(
            "create_project",
            serde_json::json!({"input":{"id":"caller-selected"}}),
        )
        .err()
        .unwrap();
        assert!(error.as_str().unwrap().contains("invalid args"));
    }
}
