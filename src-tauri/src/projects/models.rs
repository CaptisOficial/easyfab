//! Project contract types. Unknown persisted fields survive read/append/write.
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Project {
    pub id: String,
    pub wbs: String,
    pub name: String,
    pub process_area: String,
    pub lead_engineer_id: String,
    pub start_date: String,
    pub target_date: String,
    pub status: String,
    #[serde(flatten)]
    pub extra: BTreeMap<String, serde_json::Value>,
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
    pub lead_engineer_id: String,
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
