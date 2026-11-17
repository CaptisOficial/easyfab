//! Project contract types. Unknown persisted fields survive read/append/write.
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(try_from = "StoredProject")]
pub struct Project {
    pub id: String,
    pub wbs: String,
    pub name: String,
    pub process_area: String,
    pub engineer_ids: Vec<String>,
    pub start_date: String,
    pub target_date: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    #[serde(flatten)]
    pub extra: BTreeMap<String, serde_json::Value>,
}
#[derive(Deserialize)]
struct StoredProject {
    id: String,
    wbs: String,
    name: String,
    process_area: String,
    #[serde(default)]
    engineer_ids: Option<Vec<String>>,
    #[serde(default)]
    lead_engineer_id: Option<String>,
    start_date: String,
    target_date: String,
    status: String,
    #[serde(default)]
    priority: Option<u32>,
    #[serde(flatten)]
    extra: BTreeMap<String, serde_json::Value>,
}
impl TryFrom<StoredProject> for Project {
    type Error = String;
    fn try_from(value: StoredProject) -> Result<Self, String> {
        let engineer_ids = match (value.engineer_ids, value.lead_engineer_id) {
            (Some(ids), None) => ids,
            (None, Some(id)) => vec![id],
            _ => return Err("Asignación ausente o ambigua en el proyecto.".into()),
        };
        Ok(Self {
            id: value.id, wbs: value.wbs, name: value.name,
            process_area: value.process_area, engineer_ids,
            start_date: value.start_date, target_date: value.target_date,
            status: value.status, priority: value.priority, extra: value.extra,
        })
    }
}
#[derive(Deserialize, Serialize)]
pub(super) struct Projects {
    pub version: u32,
    pub projects: Vec<Project>,
    #[serde(flatten)]
    pub extra: BTreeMap<String, serde_json::Value>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NewProject {
    pub wbs: String,
    pub name: String,
    pub process_area: String,
    pub engineer_ids: Vec<String>,
    pub start_date: String,
    pub target_date: String,
}
#[derive(Serialize)]
pub struct Lead {
    pub id: String,
    pub name: String,
}
#[derive(Serialize)]
pub struct Overview {
    pub projects: Vec<Project>,
    pub leads: Vec<Lead>,
    pub can_create: bool,
    pub write_message: String,
}
