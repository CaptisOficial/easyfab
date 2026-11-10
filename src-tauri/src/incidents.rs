use crate::{auth, data_store as store, plant};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    path::Path,
};
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Issue {
    pub part_number: String,
    pub description: String,
    pub machine_station: String,
    pub occurrence_date: String,
    pub target_due_date: String,
    pub downtime_hours: f64,
    pub scrap_pieces: u32,
    pub impact_level: String,
    pub status: String,
    pub root_cause_containment: String,
    pub failure_type_id: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Event {
    pub id: String,
    pub issue_id: String,
    pub supersedes: Vec<String>,
    pub reported_by: String,
    pub author_id: String,
    pub recorded_at: String,
    pub issue: Issue,
    pub signature: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    pub request_id: String,
    pub issue_id: Option<String>,
    pub supersedes: Vec<String>,
    pub issue: Issue,
}
#[derive(Serialize)]
pub struct Record {
    pub issue_id: String,
    pub leaves: Vec<Event>,
    pub history: Vec<Event>,
    pub can_correct: bool,
}
#[derive(Serialize)]
pub struct Overview {
    pub records: Vec<Record>,
    pub legacy: Vec<serde_json::Value>,
    pub catalogs: plant::Config,
}
fn valid_id(id: &str) -> bool {
    id.len() == 64
        && id
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn validate(issue: &Issue) -> Result<(), String> {
    if [
        &issue.part_number,
        &issue.description,
        &issue.machine_station,
        &issue.impact_level,
    ]
    .iter()
    .any(|s| s.trim().is_empty() || s.chars().any(char::is_control))
        || !issue.downtime_hours.is_finite()
        || issue.downtime_hours < 0.0
        || !["Open", "In Progress", "Contained", "Resolved"].contains(&issue.status.as_str())
    {
        return Err("Revisa descripción, equipo, impacto, paro y estado.".into());
    }
    crate::projects::validate_dates(
        &issue.occurrence_date,
        if issue.target_due_date.is_empty() {
            &issue.occurrence_date
        } else {
            &issue.target_due_date
        },
    )
}
fn read_events(dir: &Path) -> Result<Vec<Event>, String> {
    let folder = dir.join("issue_events");
    store::contained(dir, &folder)?;
    if !folder.exists() {
        return Ok(vec![]);
    }
    let key = auth::read_key()?;
    let mut result = vec![];
    let mut ids = HashSet::new();
    for author in fs::read_dir(&folder).map_err(|e| e.to_string())? {
        let author = author.map_err(|e| e.to_string())?.path();
        store::contained(dir, &author)?;
        if !author.is_dir() {
            continue;
        }
        for item in fs::read_dir(&author).map_err(|e| e.to_string())? {
            let path = item.map_err(|e| e.to_string())?.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            store::contained(dir, &path)?;
            let mut event: Event =
                serde_json::from_slice(&fs::read(&path).map_err(|e| e.to_string())?)
                    .map_err(|_| "Evento de incidencia inválido.")?;
            let signature = event.signature.clone();
            event.signature.clear();
            if !auth::verify_role(
                "issue-event-v1",
                &serde_json::to_string(&event).map_err(|e| e.to_string())?,
                "sealed",
                &signature,
                &key,
            ) || !valid_id(&event.id)
                || !valid_id(&event.issue_id)
                || !ids.insert(event.id.clone())
            {
                return Err("Evento alterado o duplicado; revisa la sincronización.".into());
            }
            validate(&event.issue)?;
            event.signature = signature;
            result.push(event);
        }
    }
    result.sort_by(|a, b| (&a.recorded_at, &a.id).cmp(&(&b.recorded_at, &b.id)));
    Ok(result)
}
fn project(events: Vec<Event>, s: &auth::Session) -> Result<Vec<Record>, String> {
    let mut groups: BTreeMap<String, Vec<Event>> = BTreeMap::new();
    for event in events {
        groups
            .entry(event.issue_id.clone())
            .or_default()
            .push(event);
    }
    let mut records = vec![];
    for (issue_id, history) in groups {
        let roots: Vec<_> = history.iter().filter(|e| e.supersedes.is_empty()).collect();
        if roots.len() != 1 || roots[0].id != issue_id {
            return Err(
                "Historial incompleto; espera la sincronización del evento inicial.".into(),
            );
        }
        let reporter = roots[0].reported_by.clone();
        let mut replaced = HashSet::new();
        for event in &history {
            for parent in &event.supersedes {
                let prior = history
                    .iter()
                    .find(|e| &e.id == parent)
                    .ok_or("Falta un evento anterior. Comprueba la sincronización.")?;
                if prior.id == event.id
                    || prior.recorded_at > event.recorded_at
                    || event.reported_by != reporter
                {
                    return Err("Historial de incidencia inconsistente.".into());
                }
                replaced.insert(parent.clone());
            }
        }
        let leaves = history
            .iter()
            .filter(|e| !replaced.contains(&e.id))
            .cloned()
            .collect();
        records.push(Record {
            issue_id,
            leaves,
            history,
            can_correct: s.user.id == reporter || s.user.role == "supervisor",
        });
    }
    Ok(records)
}
pub fn overview(dir: &Path, s: &auth::Session, id: &str) -> Result<Overview, String> {
    plant::context(dir, s, id)?;
    let legacy_path = dir.join("issues.json");
    store::contained(dir, &legacy_path)?;
    let legacy: serde_json::Value =
        serde_json::from_slice(&fs::read(legacy_path).map_err(|e| e.to_string())?)
            .map_err(|_| "issues.json inválido; no se reinicializó.")?;
    if legacy["version"] != 1 || !legacy["issues"].is_array() {
        return Err("Incidencias legacy incompatibles.".into());
    }
    Ok(Overview {
        records: project(read_events(dir)?, s)?,
        legacy: legacy["issues"].as_array().unwrap().clone(),
        catalogs: plant::read(dir)?.0,
    })
}
pub fn save(dir: &Path, s: &auth::Session, id: &str, input: Input) -> Result<Overview, String> {
    let current = overview(dir, s, id)?;
    validate(&input.issue)?;
    if !valid_id(&input.request_id) {
        return Err("Identificador de solicitud inválido.".into());
    }
    let key = auth::read_key()?;
    let existing = current
        .records
        .iter()
        .flat_map(|r| &r.history)
        .find(|e| e.id == input.request_id);
    if let Some(existing) = existing {
        if existing.author_id == s.user.id
            && existing.issue_id
                == input
                    .issue_id
                    .clone()
                    .unwrap_or_else(|| input.request_id.clone())
            && serde_json::to_value(&existing.issue).unwrap()
                == serde_json::to_value(&input.issue).unwrap()
            && existing.supersedes == input.supersedes
        {
            return Ok(current);
        }
        return Err("La solicitud ya existe con otro contenido.".into());
    }
    let (issue_id, reported_by) = if let Some(issue_id) = &input.issue_id {
        let record = current
            .records
            .iter()
            .find(|r| &r.issue_id == issue_id)
            .ok_or("Incidencia no encontrada.")?;
        if !record.can_correct {
            return Err("Solo el reportante o Supervisor corrige esta incidencia.".into());
        }
        let expected: HashSet<_> = record.leaves.iter().map(|e| &e.id).collect();
        let submitted: HashSet<_> = input.supersedes.iter().collect();
        if expected != submitted || submitted.len() != input.supersedes.len() {
            return Err(
                "La incidencia cambió. Actualiza e integra todas las versiones antes de corregir."
                    .into(),
            );
        }
        (
            issue_id.clone(),
            record
                .history
                .iter()
                .find(|e| e.supersedes.is_empty())
                .unwrap()
                .reported_by
                .clone(),
        )
    } else {
        if !input.supersedes.is_empty() {
            return Err("Una incidencia nueva no corrige eventos anteriores.".into());
        }
        (input.request_id.clone(), s.user.id.clone())
    };
    if !current
        .catalogs
        .machines
        .iter()
        .any(|m| m.id == input.issue.machine_station && m.active)
    {
        return Err("Selecciona un equipo activo del catálogo.".into());
    }
    if let Some(failure) = &input.issue.failure_type_id {
        if !current
            .catalogs
            .failure_types
            .iter()
            .any(|f| &f.id == failure && f.active)
        {
            return Err("Selecciona un tipo de falla activo.".into());
        }
    }
    let mut event = Event {
        id: input.request_id,
        issue_id,
        reported_by,
        author_id: s.user.id.clone(),
        supersedes: input.supersedes,
        recorded_at: chrono::Utc::now().to_rfc3339(),
        issue: input.issue,
        signature: String::new(),
    };
    event.signature = auth::sign_role(
        "issue-event-v1",
        &serde_json::to_string(&event).map_err(|e| e.to_string())?,
        "sealed",
        &key,
    );
    let user_key: String = s
        .user
        .id
        .as_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    let folder = dir.join("issue_events").join(user_key);
    store::contained(dir, &folder)?;
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let path = folder.join(format!("{}.json", event.id));
    store::publish(
        &path,
        &serde_json::to_vec_pretty(&event).map_err(|e| e.to_string())?,
        None,
        || {
            plant::context(dir, s, id)?;
            store::contained(dir, &path)
        },
    )?;
    overview(dir, s, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn issue() -> Issue {
        Issue {
            part_number: "part".into(),
            description: "Synthetic".into(),
            machine_station: "m".into(),
            occurrence_date: "2026-10-29".into(),
            target_due_date: String::new(),
            downtime_hours: 1.5,
            scrap_pieces: 2,
            impact_level: "FAB".into(),
            status: "Open".into(),
            root_cause_containment: String::new(),
            failure_type_id: None,
        }
    }
    #[test]
    fn branching_preserves_conflicts_until_explicit_merge() {
        let s = auth::Session {
            user: auth::User {
                id: "eng".into(),
                name: "Engineer".into(),
                role: "engineer".into(),
                must_change_password: false,
            },
            fingerprint: String::new(),
        };
        let root = Event {
            id: "a".into(),
            issue_id: "a".into(),
            supersedes: vec![],
            reported_by: "eng".into(),
            author_id: "eng".into(),
            recorded_at: "2026-10-29T10:00:00Z".into(),
            issue: issue(),
            signature: String::new(),
        };
        let mut first = root.clone();
        first.id = "b".into();
        first.supersedes = vec!["a".into()];
        let mut second = first.clone();
        second.id = "c".into();
        let records = project(vec![root.clone(), first.clone(), second.clone()], &s).unwrap();
        assert_eq!(records[0].leaves.len(), 2);
        let mut merge = first.clone();
        merge.id = "d".into();
        merge.supersedes = vec!["b".into(), "c".into()];
        let records = project(vec![root, first, second, merge], &s).unwrap();
        assert_eq!(records[0].leaves.len(), 1);
        assert_eq!(records[0].history.len(), 4);
        let mut invalid = issue();
        invalid.downtime_hours = -1.0;
        assert!(validate(&invalid).is_err());
        invalid = issue();
        invalid.scrap_pieces = 0;
        assert!(validate(&invalid).is_ok());
    }
}
