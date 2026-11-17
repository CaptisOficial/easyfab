//! Thin IPC boundary. Identity, workspace and publication authorization stay in Rust.
use crate::{auth_commands::data_path, project_commands::workspace_id, results_store, AppState};
use tauri::State;

#[tauri::command]
pub(crate) fn results_detail(state: State<'_, AppState>, project_id: String) -> Result<results_store::Detail, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    let session = guard.as_ref().ok_or("Ingresa primero.")?;
    results_store::detail(&data_path(&state)?, session, &workspace_id(&state)?, &project_id)
}

macro_rules! command {
    ($name:ident, $input:ty, $operation:ident) => {
        #[tauri::command]
        pub(crate) fn $name(state: State<'_, AppState>, input: $input) -> Result<results_store::Detail, String> {
            let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
            let session = guard.as_ref().ok_or("Ingresa primero.")?;
            results_store::$operation(&data_path(&state)?, session, &workspace_id(&state)?, input)
        }
    };
}
command!(results_save_commitment, results_store::CommitmentInput, save_commitment);
command!(results_save_activity, results_store::ActivityInput, save_activity);
command!(results_save_blocker, results_store::BlockerInput, save_blocker);
command!(results_request_activity_revision, results_store::ActivityRevisionInput, request_activity_revision);
command!(results_review, results_store::ReviewInput, review);
command!(results_set_closure, results_store::ClosureInput, set_closure);
command!(results_resolve, results_store::ResolveInput, resolve);
command!(results_attach_evidence, results_store::AttachmentInput, attach);

#[tauri::command]
pub(crate) fn results_read_evidence(state: State<'_, AppState>, project_id: String, evidence_id: String) -> Result<Vec<u8>, String> {
    let guard = state.session.lock().map_err(|_| "Estado no disponible.")?;
    let session = guard.as_ref().ok_or("Ingresa primero.")?;
    results_store::evidence_bytes(&data_path(&state)?, session, &workspace_id(&state)?, &project_id, &evidence_id)
}

#[cfg(test)]
mod tests {
    use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets};
    #[test]
    fn result_detail_wire_fields_match_canonical_operations() {
        let schema: serde_json::Value = serde_json::from_str(include_str!("../../contracts/v1/project_results_operations.schema.json")).unwrap();
        let project = serde_json::from_value(serde_json::json!({"id":"project_1","wbs":"1","name":"Synthetic","process_area":"FAB","engineer_ids":["eng"],"start_date":"2026-10-26","target_date":"2026-11-06","status":"Not Started"})).unwrap();
        let detail = crate::results_store::Detail { project, commitment:None, baseline:None,
            activities:vec![], blockers:vec![], reviews:vec![], closure:None, history:vec![], conflicts:vec![],
            legacy_entries:vec![], plan_issues:vec![], capabilities:crate::project_results::Capabilities {
                can_plan_activities:false, can_change_commitment:true, can_review_deliverables:true, can_resolve_blockers:true,
            } };
        let value = serde_json::to_value(detail).unwrap();
        let mut actual:Vec<_> = value.as_object().unwrap().keys().map(String::as_str).collect();
        let mut required:Vec<_> = schema["$defs"]["detail"]["required"].as_array().unwrap().iter().map(|v|v.as_str().unwrap()).collect();
        actual.sort(); required.sort(); assert_eq!(actual,required);
    }
    #[test]
    fn result_commands_are_registered_and_require_normal_session() {
        let app = crate::app_builder(mock_builder()).build(mock_context(noop_assets())).unwrap();
        let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
        for (command, body) in [
            ("results_detail", serde_json::json!({"projectId":"project_1"})),
            ("results_read_evidence", serde_json::json!({"projectId":"project_1","evidenceId":"a".repeat(64)})),
        ] {
            let response = get_ipc_response(&window, tauri::webview::InvokeRequest { cmd: command.into(), callback: tauri::ipc::CallbackFn(0), error: tauri::ipc::CallbackFn(1), url: "http://tauri.localhost".parse().unwrap(), body: tauri::ipc::InvokeBody::Json(body), headers: Default::default(), invoke_key: tauri::test::INVOKE_KEY.into() });
            assert_eq!(response.err().unwrap(), serde_json::json!("Ingresa primero."));
        }
        // Each mutating endpoint rejects malformed payloads before any filesystem access.
        for command in ["results_save_commitment", "results_save_activity", "results_save_blocker", "results_request_activity_revision", "results_review", "results_set_closure", "results_resolve", "results_attach_evidence"] {
            let response = get_ipc_response(&window, tauri::webview::InvokeRequest { cmd: command.into(), callback: tauri::ipc::CallbackFn(0), error: tauri::ipc::CallbackFn(1), url: "http://tauri.localhost".parse().unwrap(), body: tauri::ipc::InvokeBody::Json(serde_json::json!({"input":{}})), headers: Default::default(), invoke_key: tauri::test::INVOKE_KEY.into() });
            let error = response.err().unwrap();
            assert!(error.as_str().unwrap().contains("invalid args"), "{command}: {error}");
        }
    }
}
