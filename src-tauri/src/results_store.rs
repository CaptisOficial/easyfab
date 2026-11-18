//! Signed immutable per-entity revisions. The active project is never mirrored to profiles.
use crate::{
    activities, auth, data_store as store, project_results as domain, projects, workspace,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

fn nullable<'de, D, T>(d: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(d)
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CommitmentDraft {
    pub final_outcome: String,
    pub scope: String,
    pub start_date: String,
    pub target_date: String,
    pub engineer_ids: Vec<String>,
    pub deliverables: Vec<domain::Deliverable>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommitmentInput {
    pub project_id: String,
    #[serde(deserialize_with = "nullable")]
    pub expected_revision: Option<String>,
    pub commitment: CommitmentDraft,
    pub change_reason: String,
    #[serde(deserialize_with = "nullable")]
    pub legacy_deliverable_id: Option<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActivityInput {
    pub project_id: String,
    #[serde(deserialize_with = "nullable")]
    pub expected_revision: Option<String>,
    pub activity: domain::Activity,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BlockerInput {
    pub project_id: String,
    #[serde(deserialize_with = "nullable")]
    pub blocker_id: Option<String>,
    #[serde(deserialize_with = "nullable")]
    pub expected_revision: Option<String>,
    pub activity_id: String,
    pub reason: String,
    pub help_needed: String,
    pub action: String,
    pub comment: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewInput {
    pub project_id: String,
    pub deliverable_id: String,
    #[serde(deserialize_with = "nullable")]
    pub expected_revision: Option<String>,
    pub action: domain::ReviewAction,
    pub criteria: Vec<domain::CriterionResult>,
    pub comment: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClosureInput {
    pub project_id: String,
    #[serde(deserialize_with = "nullable")]
    pub expected_revision: Option<String>,
    pub closed: bool,
    pub confirm_final_outcome: bool,
    pub comment: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResolveInput {
    pub project_id: String,
    pub stream: String,
    pub expected_revisions: Vec<String>,
    pub keep_revision: String,
    pub comment: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActivityRevisionInput {
    pub project_id: String,
    pub activity_id: String,
    pub expected_revision: String,
    pub comment: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AttachmentInput {
    pub project_id: String,
    pub activity_id: String,
    pub expected_revision: String,
    pub name: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActivityEntry {
    pub revision: String,
    pub created_by: String,
    pub edited_by: String,
    pub recorded_at: String,
    pub activity: domain::Activity,
    pub evidence: Vec<activities::Evidence>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BlockerEntry {
    pub revision: String,
    pub reported_by: String,
    pub edited_by: String,
    pub recorded_at: String,
    pub blocker: domain::Blocker,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewEntry {
    pub revision: String,
    pub deliverable_id: String,
    pub commitment_revision: String,
    pub status: domain::ReviewStatus,
    pub submission: Option<domain::Submission>,
    pub decision: Option<domain::Decision>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Closure {
    pub revision: String,
    pub closed: bool,
    pub commitment_revision: String,
    pub recorded_at: String,
    pub author_id: String,
    pub comment: String,
}
#[derive(Serialize)]
pub struct HistoryEntry {
    pub revision: String,
    pub stream: String,
    pub author_id: String,
    pub recorded_at: String,
    pub action: String,
    pub summary: String,
}
#[derive(Serialize)]
pub struct ConflictVariant {
    pub revision: String,
    pub author_id: String,
    pub recorded_at: String,
    pub summary: String,
}
#[derive(Serialize)]
pub struct Conflict {
    pub stream: String,
    pub revisions: Vec<ConflictVariant>,
}
#[derive(Serialize)]
pub struct Detail {
    pub project: projects::Project,
    pub commitment: Option<domain::Commitment>,
    pub baseline: Option<domain::Commitment>,
    pub activities: Vec<ActivityEntry>,
    pub blockers: Vec<BlockerEntry>,
    pub reviews: Vec<ReviewEntry>,
    pub closure: Option<Closure>,
    pub capabilities: domain::Capabilities,
    pub history: Vec<HistoryEntry>,
    pub conflicts: Vec<Conflict>,
    pub legacy_entries: Vec<activities::Entry>,
    pub plan_issues: Vec<String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ActivityData {
    created_by: String,
    activity: domain::Activity,
    evidence: Vec<activities::Evidence>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct BlockerData {
    reported_by: String,
    blocker: domain::Blocker,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ReviewData {
    deliverable_id: String,
    commitment_revision: String,
    status: domain::ReviewStatus,
    #[serde(deserialize_with = "nullable")]
    submission: Option<domain::Submission>,
    #[serde(deserialize_with = "nullable")]
    decision: Option<domain::Decision>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ClosureData {
    closed: bool,
    commitment_revision: String,
    review_revisions: Vec<String>,
    comment: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    content = "value",
    rename_all = "snake_case",
    deny_unknown_fields
)]
enum Payload {
    Commitment(domain::Commitment),
    Activity(ActivityData),
    Blocker(BlockerData),
    Review(ReviewData),
    Closure(ClosureData),
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Event {
    version: u8,
    id: String,
    project_id: String,
    stream: String,
    parents: Vec<String>,
    author_id: String,
    author_role: String,
    recorded_at: String,
    action: String,
    comment: String,
    #[serde(deserialize_with = "nullable")]
    base_commitment: Option<String>,
    payload: Payload,
    signature: String,
}
#[derive(Clone, Default)]
struct Graph {
    events: BTreeMap<String, Event>,
    order: Vec<String>,
    leaves: BTreeMap<String, Vec<String>>,
}

fn valid_id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn valid_revision(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn project_root(dir: &Path, project_id: &str) -> Result<PathBuf, String> {
    if !valid_id(project_id) {
        return Err("ID de proyecto inválido.".into());
    }
    let path = workspace::results_path(dir, project_id)?;
    store::contained(dir, &path)?;
    Ok(path)
}
fn payload_stream(payload: &Payload) -> Result<String, String> {
    Ok(match payload {
        Payload::Commitment(_) => "commitment".into(),
        Payload::Activity(v) if valid_id(&v.activity.id) => format!("activity/{}", v.activity.id),
        Payload::Blocker(v) if valid_id(&v.blocker.id) => format!("blocker/{}", v.blocker.id),
        Payload::Review(v) if valid_id(&v.deliverable_id) => format!("review/{}", v.deliverable_id),
        Payload::Closure(_) => "closure".into(),
        _ => return Err("Entidad con ID inválido.".into()),
    })
}
fn unsigned(event: &Event) -> Result<String, String> {
    let mut copy = event.clone();
    copy.signature.clear();
    serde_json::to_string(&copy).map_err(|e| format!("No se pudo procesar el archivo JSON: {e}"))
}
fn decision_unsigned(decision: &domain::Decision) -> Result<String, String> {
    let mut copy = decision.clone();
    copy.signature.clear();
    serde_json::to_string(&copy).map_err(|e| format!("No se pudo procesar el archivo JSON: {e}"))
}
fn verify_event(event: &Event, project_id: &str, key: &[u8]) -> Result<(), String> {
    if event.version != 1
        || event.project_id != project_id
        || !valid_revision(&event.id)
        || !valid_id(&event.author_id)
        || event.stream != payload_stream(&event.payload)?
        || chrono::DateTime::parse_from_rfc3339(&event.recorded_at).is_err()
        || !auth::verify_role(
            "results-event-v1",
            &unsigned(event)?,
            "sealed",
            &event.signature,
            key,
        )
    {
        return Err("Revisión de proyecto inválida o alterada.".into());
    }
    let valid_action = match &event.payload {
        Payload::Commitment(_) => {
            ["activate", "change_commitment", "resolve"].contains(&event.action.as_str())
        }
        Payload::Activity(_) => [
            "migrate",
            "save_activity",
            "request_activity_revision",
            "attach",
            "resolve",
        ]
        .contains(&event.action.as_str()),
        Payload::Blocker(_) => {
            ["report", "attend", "resolve_blocker", "resolve"].contains(&event.action.as_str())
        }
        Payload::Review(_) => [
            "submit", "withdraw", "accept", "return", "revise", "resolve",
        ]
        .contains(&event.action.as_str()),
        Payload::Closure(_) => ["close", "reopen", "resolve"].contains(&event.action.as_str()),
    };
    if !valid_action {
        return Err("Acción incompatible con la revisión de proyecto.".into());
    }
    let supervisor_only = matches!(event.payload, Payload::Commitment(_) | Payload::Closure(_))
        || [
            "resolve",
            "migrate",
            "request_activity_revision",
            "accept",
            "return",
            "revise",
            "attend",
            "resolve_blocker",
        ]
        .contains(&event.action.as_str());
    if (supervisor_only && event.author_role != "supervisor")
        || (!supervisor_only && !["engineer", "supervisor"].contains(&event.author_role.as_str()))
    {
        return Err("Revisión con autoridad inválida.".into());
    }
    match &event.payload {
        Payload::Commitment(c) if c.revision != event.id => {
            return Err("Revisión de compromiso inconsistente.".into())
        }
        Payload::Review(r) => {
            if let Some(d) = &r.decision {
                if !auth::verify_role(
                    "results-decision-v1",
                    &decision_unsigned(d)?,
                    "sealed",
                    &d.signature,
                    key,
                ) {
                    return Err("Decisión de cierre alterada.".into());
                }
            }
        }
        _ => {}
    }
    Ok(())
}
fn read_graph_at(dir: &Path, root: &Path, project_id: &str) -> Result<Graph, String> {
    if !root.exists() {
        return Ok(Graph::default());
    }
    store::contained(dir, root)?;
    verify_manifest(dir, root, project_id)?;
    let folder = root.join("events");
    store::contained(dir, &folder)?;
    if !folder.is_dir() {
        return Err("Proyecto por resultados incompleto; requiere restauración.".into());
    }
    let key = auth::read_key()?;
    let mut graph = Graph::default();
    for item in fs::read_dir(&folder).map_err(|e| format!("No se pudo leer la carpeta: {e}"))? {
        let path = item
            .map_err(|e| format!("No se pudo leer la carpeta: {e}"))?
            .path();
        store::contained(dir, &path)?;
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let event: Event = serde_json::from_slice(
            &fs::read(&path).map_err(|e| format!("No se pudo leer el archivo: {e}"))?,
        )
        .map_err(|_| "Revisión JSON inválida; no se reinicializó.")?;
        verify_event(&event, project_id, &key)?;
        if path.file_stem().and_then(|s| s.to_str()) != Some(&event.id)
            || graph.events.contains_key(&event.id)
        {
            return Err("Identidad de revisión duplicada o renombrada.".into());
        }
        graph.events.insert(event.id.clone(), event);
    }
    let mut referenced = HashSet::new();
    for event in graph.events.values() {
        if let Some(base) = &event.base_commitment {
            if !valid_revision(base) || base == &event.id {
                return Err("Referencia de compromiso inválida.".into());
            }
            let commitment = graph
                .events
                .get(base)
                .ok_or("Sincronización incompleta: falta el compromiso de la revisión.")?;
            if !matches!(commitment.payload, Payload::Commitment(_)) {
                return Err("La referencia de compromiso apunta a otra entidad.".into());
            }
        } else if event.stream != "commitment" && event.action != "migrate" {
            return Err("La revisión no identifica el compromiso evaluado.".into());
        }
        let mut seen = HashSet::new();
        for parent in &event.parents {
            if !valid_revision(parent) || !seen.insert(parent) || parent == &event.id {
                return Err("Relación de revisiones inválida.".into());
            }
            let p = graph
                .events
                .get(parent)
                .ok_or("Sincronización incompleta: falta una revisión anterior.")?;
            if p.stream != event.stream {
                return Err("La revisión anterior pertenece a otra entidad.".into());
            }
            referenced.insert(parent.clone());
        }
    }
    let mut pending: BTreeSet<_> = graph.events.keys().cloned().collect();
    let mut emitted = HashSet::new();
    while !pending.is_empty() {
        let mut ready: Vec<_> = pending
            .iter()
            .filter(|id| {
                graph.events[*id]
                    .parents
                    .iter()
                    .all(|p| emitted.contains(p))
                    && graph.events[*id]
                        .base_commitment
                        .as_ref()
                        .map_or(true, |base| emitted.contains(base))
            })
            .cloned()
            .collect();
        if ready.is_empty() {
            return Err("Relaciones circulares entre revisiones.".into());
        }
        ready.sort_by(|a, b| {
            (&graph.events[a].recorded_at, a).cmp(&(&graph.events[b].recorded_at, b))
        });
        for id in ready {
            pending.remove(&id);
            emitted.insert(id.clone());
            graph.order.push(id);
        }
    }
    for event in graph.events.values() {
        if !referenced.contains(&event.id) {
            graph
                .leaves
                .entry(event.stream.clone())
                .or_default()
                .push(event.id.clone());
        }
    }
    validate_projection(&graph, project_id)?;
    Ok(graph)
}
fn validate_projection(graph: &Graph, project_id: &str) -> Result<(), String> {
    if !graph.leaves.contains_key("commitment") {
        return Ok(());
    }
    // Offline writes to different streams can each be valid when authored but
    // inconsistent when merged. Validate intrinsic fields against their original
    // commitment here; surface aggregate planning issues through the read model.
    // That keeps authenticated correction possible instead of making reads fail.
    for event in graph.events.values() {
        if let Payload::Activity(data) = &event.payload {
            let authored = event
                .base_commitment
                .as_ref()
                .and_then(|id| graph.events.get(id))
                .or_else(|| {
                    graph
                        .events
                        .values()
                        .find(|e| e.stream == "commitment" && e.parents.is_empty())
                });
            let Some(Payload::Commitment(commitment)) = authored.map(|e| &e.payload) else {
                return Err("Falta compromiso de la actividad.".into());
            };
            let mut activity = data.activity.clone();
            activity.dependency_ids.clear();
            domain::Plan {
                version: 1,
                project_id: project_id.into(),
                commitment: commitment.clone(),
                activities: vec![activity],
            }
            .validate()?;
        }
    }
    if graph
        .leaves
        .get("commitment")
        .is_some_and(|leaves| leaves.len() != 1)
    {
        return Ok(());
    }
    let plan = graph.plan(project_id)?;
    let mut commitment_only = plan.clone();
    commitment_only.activities.clear();
    commitment_only.validate()?;
    let mut evidence_ids = HashSet::new();
    for event in graph.events.values() {
        if let Payload::Activity(data) = &event.payload {
            for evidence in &data.evidence {
                if !valid_revision(&evidence.id) || !valid_revision(&evidence.sha256) {
                    return Err("Referencia de evidencia inválida.".into());
                }
                evidence_ids.insert(evidence.id.clone());
            }
        }
    }
    for (stream, leaves) in &graph.leaves {
        if leaves.len() != 1 {
            continue;
        }
        match &graph.events[&leaves[0]].payload {
            Payload::Blocker(data) => data.blocker.validate(&plan)?,
            Payload::Review(data) if data.commitment_revision == plan.commitment.revision => {
                if !plan
                    .commitment
                    .deliverables
                    .iter()
                    .any(|d| d.id == data.deliverable_id)
                {
                    return Err("Revisión de entregable inexistente.".into());
                }
                if let Some(submission) = &data.submission {
                    commitment_only.validate_submission(submission, &evidence_ids)?;
                    if let Some(decision) = &data.decision {
                        plan.validate_decision(submission, decision)?;
                    }
                } else if matches!(
                    data.status,
                    domain::ReviewStatus::Submitted
                        | domain::ReviewStatus::Accepted
                        | domain::ReviewStatus::Returned
                ) {
                    return Err("Revisión sin solicitud inmutable.".into());
                }
                if data.status == domain::ReviewStatus::Accepted
                    && !data.decision.as_ref().is_some_and(|d| d.accepted)
                {
                    return Err("Entregable aceptado sin decisión verificable.".into());
                }
            }
            _ => {
                let _ = stream;
            }
        }
    }
    Ok(())
}
fn read_graph(dir: &Path, project_id: &str) -> Result<Graph, String> {
    read_graph_at(dir, &project_root(dir, project_id)?, project_id)
}
impl Graph {
    fn plan_issues(&self, project_id: &str) -> Vec<String> {
        if !self.leaves.contains_key("commitment")
            || self.leaves.iter().any(|(stream, leaves)| {
                (stream == "commitment" || stream.starts_with("activity/")) && leaves.len() != 1
            })
        {
            return vec![];
        }
        let mut issues = match self.plan(project_id).and_then(|plan| plan.validate()) {
            Ok(()) => vec![],
            Err(issue) => vec![issue],
        };
        if let Some(issue) = self.stale_closure_issue() {
            issues.push(issue);
        }
        issues
    }
    fn stale_closure_issue(&self) -> Option<String> {
        let closure = self.current("closure").ok().flatten()?;
        let Payload::Closure(data) = &closure.payload else {
            return None;
        };
        if !data.closed {
            return None;
        }
        let commitment = self.commitment().ok().flatten()?;
        if data.commitment_revision != commitment.revision {
            return Some("El cierre recibido corresponde a un compromiso anterior. El Supervisor debe reabrir y validar el compromiso vigente.".into());
        }
        None
    }
    fn current(&self, stream: &str) -> Result<Option<&Event>, String> {
        match self.leaves.get(stream).map(Vec::as_slice).unwrap_or(&[]) {
            [] => Ok(None),
            [id] => Ok(self.events.get(id)),
            _ => Err("Hay revisiones concurrentes; el Supervisor debe resolverlas.".into()),
        }
    }
    fn expected(&self, stream: &str, expected: Option<&str>) -> Result<Vec<String>, String> {
        let current = self.current(stream)?;
        if current.map(|e| e.id.as_str()) != expected {
            return Err("La información cambió. Actualiza antes de guardar.".into());
        }
        Ok(current.into_iter().map(|e| e.id.clone()).collect())
    }
    fn commitment(&self) -> Result<Option<domain::Commitment>, String> {
        self.current("commitment")?
            .map(|e| match &e.payload {
                Payload::Commitment(c) => Ok(c.clone()),
                _ => Err("Compromiso inválido.".into()),
            })
            .transpose()
    }
    fn plan(&self, project_id: &str) -> Result<domain::Plan, String> {
        let commitment = self
            .commitment()?
            .ok_or("El Supervisor debe definir el DoD del proyecto.")?;
        let mut activities = vec![];
        for (stream, leaves) in &self.leaves {
            if stream.starts_with("activity/") {
                // A candidate is used only for cross-reference validation, never presented
                // as a winner. Mutations touching an ambiguous dependency are rejected.
                if let Payload::Activity(data) = &self.events[&leaves[0]].payload {
                    activities.push(data.activity.clone());
                }
            }
        }
        Ok(domain::Plan {
            version: 1,
            project_id: project_id.into(),
            commitment,
            activities,
        })
    }
    fn closed(&self) -> Result<bool, String> {
        Ok(self
            .current("closure")?
            .is_some_and(|e| matches!(&e.payload, Payload::Closure(c) if c.closed)))
    }
    fn ensure_open(&self) -> Result<(), String> {
        if self.closed()? {
            Err("Reabre el proyecto antes de modificarlo.".into())
        } else {
            Ok(())
        }
    }
}

fn context(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
) -> Result<(projects::Project, domain::Capabilities), String> {
    let project = projects::authorized(dir, session, workspace_id, project_id)?;
    let graph = read_graph(dir, project_id)?;
    if session.user.role == "engineer"
        && graph.leaves.get("commitment").is_some_and(|v| v.len() != 1)
    {
        return Err("Compromiso en conflicto; el Supervisor debe resolverlo.".into());
    }
    let supervisor =
        session.user.role == "supervisor" && projects::require_supervisor(dir, session).is_ok();
    let capabilities = domain::Capabilities {
        can_plan_activities: (session.user.role == "engineer"
            && project.engineer_ids.contains(&session.user.id))
            || supervisor,
        can_change_commitment: supervisor,
        can_review_deliverables: supervisor,
        can_resolve_blockers: supervisor,
    };
    Ok((project, capabilities))
}
fn require(allowed: bool) -> Result<(), String> {
    if allowed {
        Ok(())
    } else {
        Err("Operación no autorizada para esta sesión.".into())
    }
}
fn new_event(
    session: &auth::Session,
    project_id: &str,
    parents: Vec<String>,
    action: &str,
    payload: Payload,
) -> Result<Event, String> {
    let id = match &payload {
        Payload::Commitment(c) => c.revision.clone(),
        _ => auth::revision(),
    };
    let mut event = Event {
        version: 1,
        id,
        project_id: project_id.into(),
        stream: payload_stream(&payload)?,
        parents,
        author_id: session.user.id.clone(),
        author_role: session.user.role.clone(),
        recorded_at: chrono::Utc::now().to_rfc3339(),
        action: action.into(),
        comment: String::new(),
        base_commitment: None,
        payload,
        signature: String::new(),
    };
    event.signature = auth::sign_role(
        "results-event-v1",
        &unsigned(&event)?,
        "sealed",
        &auth::read_key()?,
    );
    Ok(event)
}
fn annotate(
    mut event: Event,
    base_commitment: Option<&str>,
    comment: &str,
) -> Result<Event, String> {
    event.base_commitment = base_commitment.map(str::to_string);
    event.comment = comment.trim().to_string();
    event.signature = auth::sign_role(
        "results-event-v1",
        &unsigned(&event)?,
        "sealed",
        &auth::read_key()?,
    );
    Ok(event)
}
fn publish_at(
    dir: &Path,
    root: &Path,
    event: &Event,
    check: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let folder = root.join("events");
    store::contained(dir, &folder)?;
    fs::create_dir_all(&folder).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    let path = folder.join(format!("{}.json", event.id));
    store::publish(
        &path,
        &serde_json::to_vec_pretty(event)
            .map_err(|e| format!("No se pudo procesar el archivo JSON: {e}"))?,
        None,
        || {
            store::contained(dir, &path)?;
            check()
        },
    )
}
fn publish(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    event: &Event,
) -> Result<(), String> {
    let root = project_root(dir, &event.project_id)?;
    let parents = event.parents.clone();
    let stream = event.stream.clone();
    publish_at(dir, &root, event, || {
        let (_, c) = context(dir, session, workspace_id, &event.project_id)?;
        let supervisor = matches!(event.payload, Payload::Commitment(_) | Payload::Closure(_))
            || [
                "resolve",
                "accept",
                "return",
                "revise",
                "attend",
                "resolve_blocker",
            ]
            .contains(&event.action.as_str());
        require(if supervisor {
            c.can_change_commitment
        } else {
            c.can_plan_activities
        })?;
        let graph = read_graph(dir, &event.project_id)?;
        if event.stream != "commitment"
            && event.base_commitment.as_deref()
                != graph.commitment()?.as_ref().map(|c| c.revision.as_str())
        {
            return Err("El compromiso cambió antes de publicar; actualiza el proyecto.".into());
        }
        let actual = graph.leaves.get(&stream).cloned().unwrap_or_default();
        if actual.iter().collect::<BTreeSet<_>>() != parents.iter().collect::<BTreeSet<_>>() {
            return Err("La información cambió antes de publicarse.".into());
        }
        if !matches!(&event.payload,Payload::Closure(c)if !c.closed) {
            graph.ensure_open()?;
        }
        let mut proposed = graph.clone();
        proposed.events.insert(event.id.clone(), event.clone());
        proposed
            .leaves
            .insert(event.stream.clone(), vec![event.id.clone()]);
        match &event.payload {
            Payload::Commitment(c) => {
                check_assignments(dir, &c.engineer_ids)?;
                proposed.plan(&event.project_id)?.validate()?;
            }
            Payload::Activity(_) => proposed.plan(&event.project_id)?.validate()?,
            Payload::Blocker(b) => b.blocker.validate(&proposed.plan(&event.project_id)?)?,
            Payload::Review(r) => {
                let plan = proposed.plan(&event.project_id)?;
                if r.commitment_revision != plan.commitment.revision {
                    return Err("El compromiso cambió antes de publicar la revisión.".into());
                }
                if let Some(s) = &r.submission {
                    plan.validate_submission(
                        s,
                        &evidence_set(dir, &event.project_id, &proposed, &requested_evidence(s))?,
                    )?;
                    if let Some(d) = &r.decision {
                        plan.validate_decision(s, d)?;
                    }
                }
            }
            Payload::Closure(c) if c.closed => {
                verify_closure(dir, &event.project_id, &proposed, c)?
            }
            _ => {}
        }
        Ok(())
    })
}
fn summary(event: &Event) -> String {
    let label: String = match &event.payload {
        Payload::Commitment(c) => format!(
            "{} · Alcance: {} · {} → {} · Ingenieros: {} · {}",
            c.final_outcome,
            c.scope,
            c.start_date,
            c.target_date,
            c.engineer_ids.join(", "),
            c.deliverables
                .iter()
                .map(|d| format!(
                    "{} ({}): {}",
                    d.title,
                    d.due_date,
                    d.criteria
                        .iter()
                        .map(|criterion| criterion.description.as_str())
                        .collect::<Vec<_>>()
                        .join("; ")
                ))
                .collect::<Vec<_>>()
                .join(" || ")
        ),
        Payload::Activity(a) => format!(
            "{} · {} % · {} → {} · Responsable: {} · Nota: {} · Evidencias: {}",
            a.activity.title,
            a.activity.progress,
            a.activity.forecast_start,
            a.activity.forecast_due,
            a.activity.responsible_id,
            a.activity.note.as_deref().unwrap_or("Sin nota"),
            if a.evidence.is_empty() {
                "Sin adjuntos".into()
            } else {
                a.evidence
                    .iter()
                    .map(|e| e.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            }
        ),
        Payload::Blocker(b) => format!(
            "{} · Ayuda requerida: {} · {}",
            b.blocker.reason,
            b.blocker.help_needed,
            if b.blocker.resolved_at.is_some() {
                "Resuelto"
            } else if b.blocker.first_attention_at.is_some() {
                "En atención"
            } else {
                "Sin atención"
            }
        ),
        Payload::Review(r) => format!(
            "{} · {} · {}",
            r.deliverable_id,
            match r.status {
                domain::ReviewStatus::Preparing => "En preparación",
                domain::ReviewStatus::Submitted => "En revisión",
                domain::ReviewStatus::Returned => "Devuelto",
                domain::ReviewStatus::Accepted => "Aceptado",
                domain::ReviewStatus::Withdrawn => "Solicitud retirada",
            },
            r.decision
                .as_ref()
                .map(|d| d.comment.as_str())
                .unwrap_or("Sin decisión")
        ),
        Payload::Closure(c) => {
            if c.closed {
                "Cierre del proyecto".into()
            } else {
                "Reapertura del proyecto".into()
            }
        }
    };
    if event.comment.is_empty() {
        label
    } else {
        format!("{label} · {}", event.comment)
    }
}
fn activity_entry(event: &Event, data: &ActivityData) -> ActivityEntry {
    ActivityEntry {
        revision: event.id.clone(),
        created_by: data.created_by.clone(),
        edited_by: event.author_id.clone(),
        recorded_at: event.recorded_at.clone(),
        activity: data.activity.clone(),
        evidence: data.evidence.clone(),
    }
}
fn review_entry(
    event: &Event,
    data: &ReviewData,
    commitment: Option<&domain::Commitment>,
) -> ReviewEntry {
    let outdated = commitment.is_some_and(|c| c.revision != data.commitment_revision);
    ReviewEntry {
        revision: event.id.clone(),
        deliverable_id: data.deliverable_id.clone(),
        commitment_revision: commitment
            .map(|c| c.revision.clone())
            .unwrap_or_else(|| data.commitment_revision.clone()),
        status: if outdated {
            domain::ReviewStatus::Preparing
        } else {
            data.status
        },
        submission: if outdated {
            None
        } else {
            data.submission.clone()
        },
        decision: if outdated {
            None
        } else {
            data.decision.clone()
        },
    }
}
fn archived_entries(
    dir: &Path,
    project_id: &str,
) -> Result<Option<Vec<activities::Entry>>, String> {
    let path = project_root(dir, project_id)?.join("legacy.json");
    store::contained(dir, &path)?;
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(path).map_err(|e| format!("No se pudo leer el archivo: {e}"))?;
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|_| "Archivo histórico inválido.".into())
}

pub fn detail(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
) -> Result<Detail, String> {
    let (project, capabilities) = context(dir, session, workspace_id, project_id)?;
    let graph = read_graph(dir, project_id)?;
    let commitment = graph.commitment().ok().flatten();
    let roots: Vec<_> = graph
        .events
        .values()
        .filter(|e| e.stream == "commitment" && e.parents.is_empty())
        .collect();
    let baseline = if roots.len() == 1 {
        match &roots[0].payload {
            Payload::Commitment(c) => Some(c.clone()),
            _ => None,
        }
    } else {
        None
    };
    let mut activity_rows = vec![];
    let mut blockers = vec![];
    let mut reviews = vec![];
    let mut closure = None;
    let mut conflicts = vec![];
    for (stream, leaves) in &graph.leaves {
        if leaves.len() != 1 {
            conflicts.push(Conflict {
                stream: stream.clone(),
                revisions: leaves
                    .iter()
                    .map(|id| {
                        let e = &graph.events[id];
                        ConflictVariant {
                            revision: e.id.clone(),
                            author_id: e.author_id.clone(),
                            recorded_at: e.recorded_at.clone(),
                            summary: summary(e),
                        }
                    })
                    .collect(),
            });
            continue;
        }
        let event = &graph.events[&leaves[0]];
        match &event.payload {
            Payload::Activity(data) => activity_rows.push(activity_entry(event, data)),
            Payload::Blocker(data) => blockers.push(BlockerEntry {
                revision: event.id.clone(),
                reported_by: data.reported_by.clone(),
                edited_by: event.author_id.clone(),
                recorded_at: event.recorded_at.clone(),
                blocker: data.blocker.clone(),
            }),
            Payload::Review(data) => reviews.push(review_entry(event, data, commitment.as_ref())),
            Payload::Closure(data) => {
                closure = Some(Closure {
                    revision: event.id.clone(),
                    closed: data.closed,
                    commitment_revision: data.commitment_revision.clone(),
                    recorded_at: event.recorded_at.clone(),
                    author_id: event.author_id.clone(),
                    comment: data.comment.clone(),
                })
            }
            _ => {}
        }
    }
    let legacy_entries = match archived_entries(dir, project_id)? {
        Some(v) => v,
        None => activities::legacy_detail(dir, session, workspace_id, project_id)?.entries,
    };
    let history = graph
        .order
        .iter()
        .map(|id| {
            let e = &graph.events[id];
            HistoryEntry {
                revision: e.id.clone(),
                stream: e.stream.clone(),
                author_id: e.author_id.clone(),
                recorded_at: e.recorded_at.clone(),
                action: e.action.clone(),
                summary: summary(e),
            }
        })
        .collect();
    Ok(Detail {
        project,
        commitment,
        baseline,
        activities: activity_rows,
        blockers,
        reviews,
        closure,
        capabilities,
        history,
        conflicts,
        legacy_entries,
        plan_issues: graph.plan_issues(project_id),
    })
}

pub fn is_active(dir: &Path, project_id: &str) -> Result<bool, String> {
    let root = project_root(dir, project_id)?;
    if !root.exists() {
        return Ok(false);
    }
    let graph = read_graph_at(dir, &root, project_id)?;
    if !graph.leaves.contains_key("commitment") {
        return Err("Activación incompleta; restaura el proyecto.".into());
    }
    Ok(true)
}
fn common_commitment(graph: &Graph) -> Option<domain::Commitment> {
    let leaves = graph.leaves.get("commitment")?;
    let ancestors = |start: &String| {
        let mut result = HashSet::new();
        let mut pending = vec![start.clone()];
        while let Some(id) = pending.pop() {
            if result.insert(id.clone()) {
                pending.extend(graph.events[&id].parents.iter().cloned());
            }
        }
        result
    };
    let mut common = ancestors(&leaves[0]);
    for id in leaves.iter().skip(1) {
        let a = ancestors(id);
        common.retain(|v| a.contains(v));
    }
    let maximal: Vec<_> = common
        .iter()
        .filter(|id| {
            !common
                .iter()
                .any(|other| other != *id && ancestors(other).contains(*id))
        })
        .collect();
    if maximal.len() != 1 {
        return None;
    }
    match &graph.events[maximal[0]].payload {
        Payload::Commitment(c) => Some(c.clone()),
        _ => None,
    }
}
pub fn project_projection(dir: &Path, project: &mut projects::Project) -> Result<(), String> {
    if !is_active(dir, &project.id)? {
        return Ok(());
    }
    let graph = read_graph(dir, &project.id)?;
    // Historic activity approvals never become acceptance of the new results.
    if project.status == "Completed" {
        project.status = "In Progress".into();
    }
    if let Some(commitment) = graph
        .commitment()
        .ok()
        .flatten()
        .or_else(|| common_commitment(&graph))
    {
        project.start_date = commitment.start_date;
        project.target_date = commitment.target_date;
        project.engineer_ids = commitment.engineer_ids;
    }
    if graph.leaves.values().any(|v| v.len() != 1) {
        project.status = "On Hold".into();
        return Ok(());
    }
    if !graph.plan_issues(&project.id).is_empty() {
        project.status = "On Hold".into();
        return Ok(());
    }
    if let Some(e) = graph.current("closure")? {
        if let Payload::Closure(c) = &e.payload {
            if c.closed {
                verify_closure(dir, &project.id, &graph, c)?;
                project.status = "Completed".into();
                return Ok(());
            } else {
                project.status = "In Progress".into();
            }
        }
    }
    let started=graph.events.values().any(|e|matches!(&e.payload,Payload::Activity(a)if a.activity.progress>0||a.activity.hours_spent.is_some_and(|h|h>0.0)));
    if project.status == "Not Started" && started {
        project.status = "In Progress".into();
    }
    Ok(())
}

// Mutation implementations follow; each publishes a fresh immutable event.

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StorageManifest {
    version: u8,
    project_id: String,
    legacy_sha256: String,
    signature: String,
}
fn manifest_payload(m: &StorageManifest) -> String {
    format!("{}:{}:{}", m.version, m.project_id, m.legacy_sha256)
}
fn verify_manifest(dir: &Path, root: &Path, project_id: &str) -> Result<(), String> {
    let path = root.join("storage.json");
    store::contained(dir, &path)?;
    let m: StorageManifest = serde_json::from_slice(
        &fs::read(&path).map_err(|_| "Falta manifiesto del proyecto por resultados.")?,
    )
    .map_err(|_| "Manifiesto del proyecto inválido.")?;
    if m.version != 1
        || m.project_id != project_id
        || !valid_revision(&m.legacy_sha256)
        || !auth::verify_role(
            "results-storage-v1",
            &manifest_payload(&m),
            "sealed",
            &m.signature,
            &auth::read_key()?,
        )
    {
        return Err("Versión o firma del almacenamiento incompatible.".into());
    }
    let legacy = root.join("legacy.json");
    store::contained(dir, &legacy)?;
    if store::hash(&fs::read(legacy).map_err(|_| "Falta archivo histórico del proyecto.")?)
        != m.legacy_sha256
    {
        return Err("El archivo histórico cambió; requiere restauración.".into());
    }
    Ok(())
}
fn check_assignments(dir: &Path, ids: &[String]) -> Result<(), String> {
    let team = auth::team(dir)?;
    let key = auth::read_key()?;
    for id in ids {
        if !team.members.iter().any(|m| {
            m.id == *id && m.role == "engineer" && m.status == "active" && auth::trusted(m, &key)
        }) {
            return Err("Selecciona ingenieros activos y autorizados.".into());
        }
    }
    Ok(())
}
fn make_commitment(draft: CommitmentDraft) -> domain::Commitment {
    domain::Commitment {
        revision: auth::revision(),
        final_outcome: draft.final_outcome.trim().into(),
        scope: draft.scope.trim().into(),
        start_date: draft.start_date,
        target_date: draft.target_date,
        engineer_ids: draft.engineer_ids,
        deliverables: draft.deliverables,
    }
}
fn safe_evidence_path(
    dir: &Path,
    root: &Path,
    e: &activities::Evidence,
) -> Result<PathBuf, String> {
    let extension = e.relative_path.rsplit('.').next().unwrap_or("");
    if !valid_revision(&e.id)
        || !valid_revision(&e.sha256)
        || e.size == 0
        || e.size > 20 * 1024 * 1024
        || !["pdf", "png", "jpg"].contains(&extension)
        || e.relative_path != format!("evidence/{}.{}", e.id, extension)
    {
        return Err("Referencia de evidencia inválida.".into());
    }
    let path = root.join(&e.relative_path);
    store::contained(dir, &path)?;
    Ok(path)
}
fn verified_bytes(dir: &Path, root: &Path, e: &activities::Evidence) -> Result<Vec<u8>, String> {
    let path = safe_evidence_path(dir, root, e)?;
    if fs::metadata(&path)
        .map_err(|_| "Evidencia todavía no disponible.")?
        .len()
        != e.size as u64
    {
        return Err("La evidencia cambió o está incompleta.".into());
    }
    let bytes = fs::read(path).map_err(|_| {
        "Evidencia todavía no disponible; espera la sincronización o restaura la copia."
    })?;
    if bytes.len() != e.size || store::hash(&bytes) != e.sha256 {
        return Err("La evidencia cambió o está incompleta.".into());
    }
    Ok(bytes)
}
fn requested_evidence(submission: &domain::Submission) -> HashSet<String> {
    submission
        .criteria
        .iter()
        .flat_map(|criterion| criterion.evidence_ids.iter().cloned())
        .collect()
}
fn evidence_set(
    dir: &Path,
    project_id: &str,
    graph: &Graph,
    requested: &HashSet<String>,
) -> Result<HashSet<String>, String> {
    let root = project_root(dir, project_id)?;
    let mut definitions: HashMap<String, &activities::Evidence> = HashMap::new();
    for event in graph.events.values() {
        if let Payload::Activity(activity) = &event.payload {
            for evidence in &activity.evidence {
                if !requested.contains(&evidence.id) {
                    continue;
                }
                if let Some(previous) = definitions.insert(evidence.id.clone(), evidence) {
                    if previous.sha256 != evidence.sha256
                        || previous.size != evidence.size
                        || previous.relative_path != evidence.relative_path
                    {
                        return Err(
                            "Identidad de evidencia duplicada con contenido distinto.".into()
                        );
                    }
                }
            }
        }
    }
    for id in requested {
        let evidence = definitions
            .get(id)
            .ok_or("Evidencia no autorizada o inexistente para este proyecto.")?;
        verified_bytes(dir, &root, evidence)?;
    }
    Ok(requested.clone())
}
fn verify_closure(
    _dir: &Path,
    project_id: &str,
    graph: &Graph,
    closure: &ClosureData,
) -> Result<(), String> {
    if graph.leaves.values().any(|v| v.len() != 1) {
        return Err("Resuelve los conflictos antes de cerrar.".into());
    }
    let plan = graph.plan(project_id)?;
    if closure.commitment_revision != plan.commitment.revision {
        return Err("El cierre corresponde a otro compromiso.".into());
    }
    plan.validate_closure(&[], &HashSet::new(), true)
}
fn initialize(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: CommitmentInput,
    commitment: domain::Commitment,
) -> Result<Detail, String> {
    let (project, caps) = context(dir, session, workspace_id, &input.project_id)?;
    require(caps.can_change_commitment)?;
    let legacy = activities::legacy_detail(dir, session, workspace_id, &input.project_id)?.entries;
    if !legacy.is_empty()
        && !input
            .legacy_deliverable_id
            .as_ref()
            .is_some_and(|id| commitment.deliverables.iter().any(|d| &d.id == id))
    {
        return Err("Selecciona explícitamente el entregable que recibirá las actividades históricas antes de activar.".into());
    }
    let target = project_root(dir, &input.project_id)?;
    if target.exists() {
        return Err("El proyecto ya fue activado o requiere restauración.".into());
    }
    let parent = target.parent().ok_or("Ruta inválida.")?;
    store::contained(dir, parent)?;
    fs::create_dir_all(parent).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    let staging = parent.join(format!(".activation-{}", auth::revision()));
    store::contained(dir, &staging)?;
    fs::create_dir(&staging).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    let result = (|| {
        fs::create_dir(staging.join("events"))
            .map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
        fs::create_dir(staging.join("evidence"))
            .map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
        let legacy_bytes = serde_json::to_vec_pretty(&legacy)
            .map_err(|e| format!("No se pudo procesar el archivo JSON: {e}"))?;
        store::publish(&staging.join("legacy.json"), &legacy_bytes, None, || {
            store::contained(dir, &staging)
        })?;
        let mut manifest = StorageManifest {
            version: 1,
            project_id: input.project_id.clone(),
            legacy_sha256: store::hash(&legacy_bytes),
            signature: String::new(),
        };
        manifest.signature = auth::sign_role(
            "results-storage-v1",
            &manifest_payload(&manifest),
            "sealed",
            &auth::read_key()?,
        );
        store::publish(
            &staging.join("storage.json"),
            &serde_json::to_vec(&manifest)
                .map_err(|e| format!("No se pudo procesar el archivo JSON: {e}"))?,
            None,
            || store::contained(dir, &staging),
        )?;
        let mut imported = vec![];
        let mut ids = HashSet::new();
        for entry in &legacy {
            let old = &entry.activity;
            if !ids.insert(old.id.clone()) {
                return Err(
                    "Actividades históricas con IDs duplicados; integra antes de migrar.".into(),
                );
            }
            let activity = domain::Activity {
                id: old.id.clone(),
                deliverable_id: input
                    .legacy_deliverable_id
                    .clone()
                    .ok_or("Falta entregable de migración.")?,
                title: old.task_title.clone(),
                responsible_id: entry.owner_id.clone(),
                forecast_start: old.start_date.clone(),
                forecast_due: old.due_date.clone(),
                dependency_ids: vec![],
                status: if old.milestone_gate == 100 {
                    domain::ActivityStatus::Done
                } else if old.milestone_gate > 0 || old.hours_spent.is_some_and(|h| h > 0.0) {
                    domain::ActivityStatus::InProgress
                } else {
                    domain::ActivityStatus::NotStarted
                },
                progress: old.milestone_gate,
                at_risk: old.status == "At Risk",
                hours_spent: old.hours_spent,
                note: None,
            };
            for e in &old.evidence {
                let bytes = activities::evidence_bytes(
                    dir,
                    session,
                    workspace_id,
                    &input.project_id,
                    &entry.owner_id,
                    &old.id,
                    &e.id,
                )?;
                if bytes.len() != e.size || store::hash(&bytes) != e.sha256 {
                    return Err("Evidencia histórica inválida.".into());
                }
                let path = safe_evidence_path(dir, &staging, e)?;
                if path.exists() {
                    if fs::read(&path).map_err(|e| format!("No se pudo leer el archivo: {e}"))?
                        != bytes
                    {
                        return Err("Evidencia histórica duplicada con contenido diferente.".into());
                    }
                } else {
                    store::publish(&path, &bytes, None, || store::contained(dir, &path))?;
                }
            }
            imported.push(activity.clone());
            let event = new_event(
                session,
                &input.project_id,
                vec![],
                "migrate",
                Payload::Activity(ActivityData {
                    created_by: entry.owner_id.clone(),
                    activity,
                    evidence: old.evidence.clone(),
                }),
            )?;
            publish_at(dir, &staging, &event, || {
                projects::require_supervisor(dir, session)
            })?;
        }
        domain::Plan {
            version: 1,
            project_id: project.id.clone(),
            commitment: commitment.clone(),
            activities: imported,
        }
        .validate()?;
        let event = annotate(
            new_event(
                session,
                &input.project_id,
                vec![],
                "activate",
                Payload::Commitment(commitment),
            )?,
            None,
            &input.change_reason,
        )?;
        publish_at(dir, &staging, &event, || {
            projects::require_supervisor(dir, session)
        })?;
        workspace::enable_results_version(dir, workspace_id, || {
            projects::require_supervisor(dir, session)
        })?;
        context(dir, session, workspace_id, &input.project_id)?;
        check_assignments(
            dir,
            &match &event.payload {
                Payload::Commitment(c) => c.engineer_ids.clone(),
                _ => unreachable!(),
            },
        )?;
        if target.exists() {
            return Err("Otra activación se publicó; actualiza el proyecto.".into());
        }
        fs::rename(&staging, &target)
            .map_err(|e| format!("No se pudo activar el proyecto: {e}"))?;
        detail(dir, session, workspace_id, &input.project_id)
    })();
    if staging.exists()
        && staging.parent() == Some(parent)
        && store::contained(dir, &staging).is_ok()
    {
        let _ = fs::remove_dir_all(staging);
    }
    result
}

pub fn save_commitment(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: CommitmentInput,
) -> Result<Detail, String> {
    let (_, caps) = context(dir, session, workspace_id, &input.project_id)?;
    require(caps.can_change_commitment)?;
    if input.change_reason.trim().is_empty() {
        return Err("Describe el motivo del compromiso.".into());
    }
    check_assignments(dir, &input.commitment.engineer_ids)?;
    let commitment = make_commitment(input.commitment.clone());
    if !is_active(dir, &input.project_id)? {
        if input.expected_revision.is_some() {
            return Err("Un compromiso nuevo no tiene revisión anterior.".into());
        }
        return initialize(dir, session, workspace_id, input, commitment);
    }
    if input.change_reason.trim().is_empty() {
        return Err("Describe el motivo del cambio de compromiso.".into());
    }
    let graph = read_graph(dir, &input.project_id)?;
    graph.ensure_open()?;
    let parents = graph.expected("commitment", input.expected_revision.as_deref())?;
    let mut plan = graph.plan(&input.project_id)?;
    plan.commitment = commitment.clone();
    plan.validate()?;
    let event = annotate(
        new_event(
            session,
            &input.project_id,
            parents,
            "change_commitment",
            Payload::Commitment(commitment),
        )?,
        Some(&graph.commitment()?.ok_or("Falta compromiso.")?.revision),
        &input.change_reason,
    )?;
    publish(dir, session, workspace_id, &event)?;
    detail(dir, session, workspace_id, &input.project_id)
}
pub fn save_activity(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: ActivityInput,
) -> Result<Detail, String> {
    let (_, caps) = context(dir, session, workspace_id, &input.project_id)?;
    require(caps.can_plan_activities)?;
    let graph = read_graph(dir, &input.project_id)?;
    graph.ensure_open()?;
    let stream = format!("activity/{}", input.activity.id);
    let parents = graph.expected(&stream, input.expected_revision.as_deref())?;
    for dependency in &input.activity.dependency_ids {
        if graph
            .leaves
            .get(&format!("activity/{dependency}"))
            .is_some_and(|v| v.len() != 1)
        {
            return Err(
                "Resuelve la dependencia en conflicto antes de planear esta actividad.".into(),
            );
        }
    }
    let previous = graph.current(&stream)?;
    let (created_by, evidence) = match previous.map(|e| &e.payload) {
        Some(Payload::Activity(a)) => (a.created_by.clone(), a.evidence.clone()),
        None => (session.user.id.clone(), vec![]),
        _ => return Err("Actividad inválida.".into()),
    };
    let mut plan = graph.plan(&input.project_id)?;
    plan.activities.retain(|a| a.id != input.activity.id);
    plan.activities.push(input.activity.clone());
    plan.validate()?;
    let event = annotate(
        new_event(
            session,
            &input.project_id,
            parents,
            "save_activity",
            Payload::Activity(ActivityData {
                created_by,
                activity: input.activity,
                evidence,
            }),
        )?,
        Some(&graph.commitment()?.ok_or("Falta compromiso.")?.revision),
        "",
    )?;
    publish(dir, session, workspace_id, &event)?;
    detail(dir, session, workspace_id, &input.project_id)
}
pub fn save_blocker(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: BlockerInput,
) -> Result<Detail, String> {
    let (_, caps) = context(dir, session, workspace_id, &input.project_id)?;
    let graph = read_graph(dir, &input.project_id)?;
    graph.ensure_open()?;
    let now = chrono::Utc::now().to_rfc3339();
    let plan = graph.plan(&input.project_id)?;
    let (data, parents, action) = match input.action.as_str() {
        "report" => {
            require(caps.can_plan_activities)?;
            if input.blocker_id.is_some() || input.expected_revision.is_some() {
                return Err("Un bloqueo nuevo no tiene revisión anterior.".into());
            }
            (
                BlockerData {
                    reported_by: session.user.id.clone(),
                    blocker: domain::Blocker {
                        id: auth::revision(),
                        activity_id: input.activity_id,
                        reason: input.reason.trim().into(),
                        help_needed: input.help_needed.trim().into(),
                        reported_at: now.clone(),
                        first_attention_at: None,
                        resolved_at: None,
                        resolution_note: None,
                    },
                },
                vec![],
                "report",
            )
        }
        "attend" | "resolve" => {
            require(caps.can_resolve_blockers)?;
            let id = input.blocker_id.as_ref().ok_or("Selecciona el bloqueo.")?;
            let stream = format!("blocker/{id}");
            let parents = graph.expected(&stream, input.expected_revision.as_deref())?;
            let event = graph.current(&stream)?.ok_or("Bloqueo inexistente.")?;
            let Payload::Blocker(old) = &event.payload else {
                return Err("Bloqueo inválido.".into());
            };
            if old.blocker.resolved_at.is_some() {
                return Err("El bloqueo ya está resuelto.".into());
            }
            if input.comment.trim().is_empty() {
                return Err("Describe la atención o resolución del bloqueo.".into());
            }
            let mut data = old.clone();
            if data.blocker.first_attention_at.is_none() {
                data.blocker.first_attention_at = Some(now.clone())
            }
            if input.action == "resolve" {
                data.blocker.resolved_at = Some(now.clone());
                data.blocker.resolution_note = Some(input.comment.trim().into())
            }
            (
                data,
                parents,
                if input.action == "resolve" {
                    "resolve_blocker"
                } else {
                    "attend"
                },
            )
        }
        _ => return Err("Acción de bloqueo inválida.".into()),
    };
    data.blocker.validate(&plan)?;
    let event = annotate(
        new_event(
            session,
            &input.project_id,
            parents,
            action,
            Payload::Blocker(data),
        )?,
        Some(&plan.commitment.revision),
        &input.comment,
    )?;
    publish(dir, session, workspace_id, &event)?;
    detail(dir, session, workspace_id, &input.project_id)
}
pub fn review(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: ReviewInput,
) -> Result<Detail, String> {
    let (_, caps) = context(dir, session, workspace_id, &input.project_id)?;
    let graph = read_graph(dir, &input.project_id)?;
    graph.ensure_open()?;
    let plan = graph.plan(&input.project_id)?;
    plan.validate()?;
    if !plan
        .commitment
        .deliverables
        .iter()
        .any(|d| d.id == input.deliverable_id)
    {
        return Err("Entregable inexistente.".into());
    }
    let stream = format!("review/{}", input.deliverable_id);
    let parents = graph.expected(&stream, input.expected_revision.as_deref())?;
    let previous = graph.current(&stream)?.and_then(|e| {
        if let Payload::Review(r) = &e.payload {
            Some(r)
        } else {
            None
        }
    });
    let old = previous.filter(|r| r.commitment_revision == plan.commitment.revision);
    let old_status = old
        .map(|r| r.status)
        .unwrap_or(domain::ReviewStatus::Preparing);
    let status = domain::transition(old_status, input.action, &caps, Some(&input.comment))?;
    let mut data = ReviewData {
        deliverable_id: input.deliverable_id,
        commitment_revision: plan.commitment.revision.clone(),
        status,
        submission: old.and_then(|r| r.submission.clone()),
        decision: old.and_then(|r| r.decision.clone()),
    };
    use domain::ReviewAction::*;
    let action = match input.action {
        Submit => {
            let submission = domain::Submission {
                id: auth::revision(),
                deliverable_id: data.deliverable_id.clone(),
                commitment_revision: plan.commitment.revision.clone(),
                criteria: input.criteria,
            };
            plan.validate_submission(
                &submission,
                &evidence_set(
                    dir,
                    &input.project_id,
                    &graph,
                    &requested_evidence(&submission),
                )?,
            )?;
            data.submission = Some(submission);
            data.decision = None;
            "submit"
        }
        Withdraw => {
            data.decision = None;
            "withdraw"
        }
        Accept | Return => {
            let submission = data
                .submission
                .as_ref()
                .ok_or("Falta solicitud de revisión.")?;
            plan.validate_submission(
                submission,
                &evidence_set(
                    dir,
                    &input.project_id,
                    &graph,
                    &requested_evidence(submission),
                )?,
            )?;
            let mut decision = domain::Decision {
                id: auth::revision(),
                project_id: input.project_id.clone(),
                deliverable_id: data.deliverable_id.clone(),
                submission_id: submission.id.clone(),
                commitment_revision: plan.commitment.revision.clone(),
                accepted: input.action == Accept,
                comment: input.comment.trim().into(),
                supervisor_id: session.user.id.clone(),
                recorded_at: chrono::Utc::now().to_rfc3339(),
                signature: String::new(),
            };
            decision.signature = auth::sign_role(
                "results-decision-v1",
                &decision_unsigned(&decision)?,
                "sealed",
                &auth::read_key()?,
            );
            plan.validate_decision(submission, &decision)?;
            data.decision = Some(decision);
            if input.action == Accept {
                "accept"
            } else {
                "return"
            }
        }
        Revise => {
            if input.comment.trim().is_empty() {
                return Err("Describe el motivo de reapertura del entregable.".into());
            }
            data.submission = None;
            data.decision = None;
            "revise"
        }
    };
    let event = annotate(
        new_event(
            session,
            &input.project_id,
            parents,
            action,
            Payload::Review(data),
        )?,
        Some(&plan.commitment.revision),
        &input.comment,
    )?;
    publish(dir, session, workspace_id, &event)?;
    detail(dir, session, workspace_id, &input.project_id)
}
pub fn request_activity_revision(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: ActivityRevisionInput,
) -> Result<Detail, String> {
    let (_, caps) = context(dir, session, workspace_id, &input.project_id)?;
    require(caps.can_change_commitment)?;
    let graph = read_graph(dir, &input.project_id)?;
    if graph.closed()? {
        return Err("El proyecto está cerrado. Reábrelo para solicitar revisiones.".into());
    }
    if input.comment.trim().is_empty() {
        return Err("Describe el motivo de la revisión solicitada.".into());
    }
    let mut plan = graph.plan(&input.project_id)?;
    let stream = format!("activity/{}", input.activity_id);
    let parents = graph.expected(&stream, Some(&input.expected_revision))?;
    let event = graph.current(&stream)?.ok_or("Actividad inexistente.")?;
    let Payload::Activity(old) = &event.payload else {
        return Err("Actividad inválida.".into());
    };
    if old.activity.status != domain::ActivityStatus::Done {
        return Err("Solo puedes solicitar revisión de actividades marcadas como finalizadas.".into());
    }
    let mut data = old.clone();
    data.activity.status = domain::ActivityStatus::InProgress;
    data.activity.progress = 75;
    data.activity.note = Some(format!("[Revisión solicitada]: {}", input.comment.trim()));
    if let Some(slot) = plan
        .activities
        .iter_mut()
        .find(|item| item.id == data.activity.id)
    {
        *slot = data.activity.clone();
    }
    plan.validate()?;
    let event = annotate(
        new_event(
            session,
            &input.project_id,
            parents,
            "request_activity_revision",
            Payload::Activity(data),
        )?,
        Some(&plan.commitment.revision),
        &input.comment,
    )?;
    publish(dir, session, workspace_id, &event)?;
    detail(dir, session, workspace_id, &input.project_id)
}
pub fn set_closure(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: ClosureInput,
) -> Result<Detail, String> {
    let (_, caps) = context(dir, session, workspace_id, &input.project_id)?;
    require(caps.can_change_commitment)?;
    let graph = read_graph(dir, &input.project_id)?;
    let plan = graph.plan(&input.project_id)?;
    let parents = graph.expected("closure", input.expected_revision.as_deref())?;
    if graph.closed()? == input.closed {
        return Err("El proyecto ya tiene ese estado de cierre.".into());
    }
    if input.closed && !input.confirm_final_outcome {
        return Err("Confirma que se cumple el estado final acordado.".into());
    }
    if !input.closed && input.comment.trim().is_empty() {
        return Err("Describe el motivo de reapertura del proyecto.".into());
    }
    let closure = ClosureData {
        closed: input.closed,
        commitment_revision: plan.commitment.revision.clone(),
        review_revisions: vec![],
        comment: input.comment.trim().into(),
    };
    if closure.closed {
        verify_closure(dir, &input.project_id, &graph, &closure)?;
    }
    let event = annotate(
        new_event(
            session,
            &input.project_id,
            parents,
            if input.closed { "close" } else { "reopen" },
            Payload::Closure(closure),
        )?,
        Some(&plan.commitment.revision),
        &input.comment,
    )?;
    publish(dir, session, workspace_id, &event)?;
    detail(dir, session, workspace_id, &input.project_id)
}
pub fn resolve(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: ResolveInput,
) -> Result<Detail, String> {
    let (_, caps) = context(dir, session, workspace_id, &input.project_id)?;
    require(caps.can_change_commitment)?;
    if input.comment.trim().is_empty() {
        return Err("Describe cómo se resolvió el conflicto.".into());
    }
    let graph = read_graph(dir, &input.project_id)?;
    let actual = graph
        .leaves
        .get(&input.stream)
        .ok_or("Conflicto inexistente.")?;
    let expected: BTreeSet<_> = input.expected_revisions.iter().collect();
    if actual.len() < 2
        || expected.len() != input.expected_revisions.len()
        || actual.iter().collect::<BTreeSet<_>>() != expected
        || !actual.contains(&input.keep_revision)
    {
        return Err("El conflicto cambió; revisa todas las alternativas actuales.".into());
    }
    let mut payload = graph.events[&input.keep_revision].payload.clone();
    if let Payload::Commitment(c) = &mut payload {
        c.revision = auth::revision();
    }
    let base = graph.commitment().ok().flatten();
    if let (Payload::Review(review), Some(commitment)) = (&mut payload, &base) {
        if review.commitment_revision != commitment.revision {
            review.commitment_revision = commitment.revision.clone();
            review.status = domain::ReviewStatus::Preparing;
            review.submission = None;
            review.decision = None;
        }
    }
    let event = annotate(
        new_event(
            session,
            &input.project_id,
            actual.clone(),
            "resolve",
            payload,
        )?,
        base.as_ref().map(|c| c.revision.as_str()),
        &input.comment,
    )?;
    let mut proposed = graph.clone();
    proposed.events.insert(event.id.clone(), event.clone());
    proposed
        .leaves
        .insert(event.stream.clone(), vec![event.id.clone()]);
    // A selected snapshot is validated before publication. Originals remain intact.
    match &event.payload {
        Payload::Commitment(c) => {
            check_assignments(dir, &c.engineer_ids)?;
            proposed.plan(&input.project_id)?.validate()?;
        }
        Payload::Activity(_) => {
            proposed.plan(&input.project_id)?.validate()?;
        }
        Payload::Blocker(b) => {
            b.blocker.validate(&proposed.plan(&input.project_id)?)?;
        }
        Payload::Review(r) => {
            if let Some(s) = &r.submission {
                let p = proposed.plan(&input.project_id)?;
                if r.commitment_revision == p.commitment.revision {
                    p.validate_submission(
                        s,
                        &evidence_set(dir, &input.project_id, &proposed, &requested_evidence(s))?,
                    )?;
                    if let Some(d) = &r.decision {
                        p.validate_decision(s, d)?;
                    }
                }
            }
        }
        Payload::Closure(c) if c.closed => verify_closure(dir, &input.project_id, &proposed, c)?,
        _ => {}
    }
    publish(dir, session, workspace_id, &event)?;
    detail(dir, session, workspace_id, &input.project_id)
}
fn attachment_type(name: &str, bytes: &[u8]) -> Result<&'static str, String> {
    if name.trim().is_empty()
        || name.contains(['/', '\\', ':'])
        || name.chars().any(char::is_control)
    {
        return Err("Nombre de evidencia inválido.".into());
    }
    if bytes.is_empty() || bytes.len() > 20 * 1024 * 1024 {
        return Err("El archivo debe contener datos y no superar 20 MB.".into());
    }
    match name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "pdf" if bytes.starts_with(b"%PDF-") => Ok("pdf"),
        "png" if bytes.starts_with(b"\x89PNG\r\n\x1a\n") => Ok("png"),
        "jpg" | "jpeg" if bytes.starts_with(b"\xff\xd8\xff") => Ok("jpg"),
        _ => Err("Solo PDF, PNG o JPG con contenido válido.".into()),
    }
}
pub fn attach(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    input: AttachmentInput,
) -> Result<Detail, String> {
    let (_, caps) = context(dir, session, workspace_id, &input.project_id)?;
    require(caps.can_plan_activities)?;
    let graph = read_graph(dir, &input.project_id)?;
    graph.ensure_open()?;
    let stream = format!("activity/{}", input.activity_id);
    let parents = graph.expected(&stream, Some(&input.expected_revision))?;
    let previous = graph.current(&stream)?.ok_or("Actividad inexistente.")?;
    let Payload::Activity(old) = &previous.payload else {
        return Err("Actividad inválida.".into());
    };
    let extension = attachment_type(&input.name, &input.bytes)?;
    let id = auth::revision();
    let evidence = activities::Evidence {
        id: id.clone(),
        name: input.name,
        size: input.bytes.len(),
        sha256: store::hash(&input.bytes),
        relative_path: format!("evidence/{id}.{extension}"),
    };
    let root = project_root(dir, &input.project_id)?;
    let path = safe_evidence_path(dir, &root, &evidence)?;
    store::publish(&path, &input.bytes, None, || {
        let (_, c) = context(dir, session, workspace_id, &input.project_id)?;
        require(c.can_plan_activities)?;
        store::contained(dir, &path)
    })?;
    let mut data = old.clone();
    data.evidence.push(evidence);
    let event = annotate(
        new_event(
            session,
            &input.project_id,
            parents,
            "attach",
            Payload::Activity(data),
        )?,
        Some(&graph.commitment()?.ok_or("Falta compromiso.")?.revision),
        "",
    )?;
    publish(dir, session, workspace_id, &event)?;
    detail(dir, session, workspace_id, &input.project_id)
}
pub fn evidence_asset(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
    evidence_id: &str,
) -> Result<(activities::Evidence, Vec<u8>), String> {
    context(dir, session, workspace_id, project_id)?;
    if !valid_revision(evidence_id) {
        return Err("ID de evidencia inválido.".into());
    }
    let graph = read_graph(dir, project_id)?;
    let mut found = None;
    for event in graph.events.values() {
        if let Payload::Activity(a) = &event.payload {
            for e in &a.evidence {
                if e.id == evidence_id {
                    if found.as_ref().is_some_and(|old: &activities::Evidence| {
                        old.sha256 != e.sha256 || old.relative_path != e.relative_path
                    }) {
                        return Err("Identidad de evidencia ambigua.".into());
                    }
                    found = Some(e.clone());
                }
            }
        }
    }
    let evidence = found.ok_or("Evidencia no autorizada o inexistente.")?;
    let bytes = verified_bytes(dir, &project_root(dir, project_id)?, &evidence)?;
    Ok((evidence, bytes))
}
pub fn evidence_bytes(
    dir: &Path,
    session: &auth::Session,
    workspace_id: &str,
    project_id: &str,
    evidence_id: &str,
) -> Result<Vec<u8>, String> {
    evidence_asset(dir, session, workspace_id, project_id, evidence_id).map(|(_, bytes)| bytes)
}

#[cfg(test)]
mod tests;
