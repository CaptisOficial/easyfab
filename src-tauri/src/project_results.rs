//! Result-planning domain contract. No storage, migration or review authority here.
//! results_store verifies revisions, sessions and signed decisions before publication.
use chrono::{DateTime, NaiveDate};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

// Option fields are nullable but required by the canonical wire contract.
fn nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer)
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Criterion {
    pub id: String,
    pub description: String,
    pub evidence_required: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Deliverable {
    pub id: String,
    pub title: String,
    pub due_date: String,
    pub criteria: Vec<Criterion>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Commitment {
    pub revision: String,
    pub final_outcome: String,
    pub scope: String,
    pub start_date: String,
    pub target_date: String,
    pub engineer_ids: Vec<String>,
    pub deliverables: Vec<Deliverable>,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActivityStatus {
    NotStarted,
    InProgress,
    Done,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewStatus {
    Preparing,
    Submitted,
    Returned,
    Accepted,
    Withdrawn,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewAction {
    Submit,
    Withdraw,
    Accept,
    Return,
    Revise,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Activity {
    pub id: String,
    pub deliverable_id: String,
    pub title: String,
    pub responsible_id: String,
    pub forecast_start: String,
    pub forecast_due: String,
    pub dependency_ids: Vec<String>,
    pub status: ActivityStatus,
    pub progress: u8,
    pub at_risk: bool,
    #[serde(deserialize_with = "nullable")]
    pub hours_spent: Option<f64>,
    #[serde(deserialize_with = "nullable")]
    pub note: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Plan {
    pub version: u8,
    pub project_id: String,
    pub commitment: Commitment,
    pub activities: Vec<Activity>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CriterionResult {
    pub criterion_id: String,
    pub fulfilled: bool,
    pub evidence_ids: Vec<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Submission {
    pub id: String,
    pub deliverable_id: String,
    pub commitment_revision: String,
    pub criteria: Vec<CriterionResult>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Decision {
    pub id: String,
    pub project_id: String,
    pub deliverable_id: String,
    pub submission_id: String,
    pub commitment_revision: String,
    pub accepted: bool,
    pub comment: String,
    pub supervisor_id: String,
    pub recorded_at: String,
    pub signature: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Blocker {
    pub id: String,
    pub activity_id: String,
    pub reason: String,
    pub help_needed: String,
    pub reported_at: String,
    #[serde(deserialize_with = "nullable")]
    pub first_attention_at: Option<String>,
    #[serde(deserialize_with = "nullable")]
    pub resolved_at: Option<String>,
    #[serde(deserialize_with = "nullable")]
    pub resolution_note: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Capabilities {
    pub can_plan_activities: bool,
    pub can_change_commitment: bool,
    pub can_review_deliverables: bool,
    pub can_resolve_blockers: bool,
}

/// Read-only policy, never lasting authorization for a later write.
pub(crate) fn capabilities(
    dir: &std::path::Path,
    session: &crate::auth::Session,
    workspace_id: &str,
    project_id: &str,
) -> Result<Capabilities, String> {
    // overview verifies active workspace, normal session, current credentials,
    // role signatures and project visibility. Never accept identity from input.
    let project = crate::projects::authorized(dir, session, workspace_id, project_id)?;
    let supervisor = session.user.role == "supervisor"
        && crate::projects::require_supervisor(dir, session).is_ok();
    Ok(Capabilities {
        can_plan_activities: (session.user.role == "engineer"
            && project.engineer_ids.contains(&session.user.id))
            || supervisor,
        can_change_commitment: supervisor,
        can_review_deliverables: supervisor,
        can_resolve_blockers: supervisor,
    })
}
fn id(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn revision(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn date(value: &str) -> Result<NaiveDate, String> {
    let parsed = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| "Fecha inválida.")?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err("Fecha inválida.".into());
    }
    Ok(parsed)
}
fn unique_ids<'a>(values: impl Iterator<Item = &'a str>) -> bool {
    let mut seen = HashSet::new();
    values.into_iter().all(|v| id(v) && seen.insert(v))
}
impl Plan {
    pub fn validate(&self) -> Result<(), String> {
        let c = &self.commitment;
        if self.version != 1
            || !id(&self.project_id)
            || !revision(&c.revision)
            || c.final_outcome.trim().is_empty()
            || c.scope.trim().is_empty()
            || c.engineer_ids.is_empty()
            || !unique_ids(c.engineer_ids.iter().map(String::as_str))
            || c.deliverables.is_empty()
            || !unique_ids(c.deliverables.iter().map(|d| d.id.as_str()))
        {
            return Err("Compromiso inválido o duplicado.".into());
        }
        let start = date(&c.start_date)?;
        let target = date(&c.target_date)?;
        if start > target {
            return Err("El inicio supera la fecha compromiso.".into());
        }
        for d in &c.deliverables {
            let due = date(&d.due_date)?;
            if due < start
                || due > target
                || d.title.trim().is_empty()
                || d.criteria.is_empty()
                || !unique_ids(d.criteria.iter().map(|v| v.id.as_str()))
                || d.criteria.iter().any(|v| v.description.trim().is_empty())
            {
                return Err("Entregable sin criterios válidos o fuera del compromiso.".into());
            }
        }
        if !unique_ids(self.activities.iter().map(|a| a.id.as_str())) {
            return Err("Actividades inválidas o duplicadas.".into());
        }
        let activities: BTreeMap<_, _> =
            self.activities.iter().map(|a| (a.id.as_str(), a)).collect();
        for a in &self.activities {
            if a.title.trim().is_empty()
                || !c.engineer_ids.contains(&a.responsible_id)
                || !c.deliverables.iter().any(|d| d.id == a.deliverable_id)
                || ![0, 25, 50, 75, 100].contains(&a.progress)
                || a.hours_spent.is_some_and(|h| !h.is_finite() || h < 0.0)
                || !unique_ids(a.dependency_ids.iter().map(String::as_str))
            {
                return Err("Actividad sin referencia, responsable o avance válido.".into());
            }
            match a.status {
                ActivityStatus::NotStarted
                    if a.progress != 0 || a.hours_spent.is_some_and(|h| h > 0.0) =>
                {
                    return Err("Una actividad con trabajo no puede estar sin iniciar.".into())
                }
                ActivityStatus::Done if a.progress != 100 => {
                    return Err("Terminar requiere 100 %.".into())
                }
                ActivityStatus::InProgress if a.progress == 100 => {
                    return Err("100 % corresponde a actividad terminada, sin aprobación.".into())
                }
                _ => {}
            }
            let forecast_start = date(&a.forecast_start)?;
            let forecast_due = date(&a.forecast_due)?;
            if forecast_start > forecast_due {
                return Err("Previsión de fechas invertida.".into());
            }
            // Forecasts may exceed the commitment: expose lateness rather than moving the baseline.
            for dependency in &a.dependency_ids {
                let predecessor = activities
                    .get(dependency.as_str())
                    .ok_or("Dependencia inexistente.")?;
                if dependency == &a.id || date(&predecessor.forecast_due)? > forecast_start {
                    return Err(
                        "Dependencia propia o previsión anterior al fin de su dependencia.".into(),
                    );
                }
            }
        }
        // Kahn traversal detects even zero-duration cycles without recursion.
        let mut pending: HashSet<&str> = activities.keys().copied().collect();
        while !pending.is_empty() {
            let ready: Vec<_> = pending
                .iter()
                .copied()
                .filter(|key| {
                    activities[key]
                        .dependency_ids
                        .iter()
                        .all(|d| !pending.contains(d.as_str()))
                })
                .collect();
            if ready.is_empty() {
                return Err("Dependencias circulares.".into());
            }
            for key in ready {
                pending.remove(key);
            }
        }
        Ok(())
    }
    /// Evidence IDs must come from authorized, hash-verified immutable evidence in R2.
    pub fn validate_submission(
        &self,
        submission: &Submission,
        verified_evidence_ids: &HashSet<String>,
    ) -> Result<(), String> {
        self.validate()?;
        if !revision(&submission.id) || submission.commitment_revision != self.commitment.revision {
            return Err("Solicitud sobre un compromiso distinto o inválido.".into());
        }
        let d = self
            .commitment
            .deliverables
            .iter()
            .find(|d| d.id == submission.deliverable_id)
            .ok_or("Entregable inexistente.")?;
        if submission.criteria.len() != d.criteria.len()
            || !unique_ids(submission.criteria.iter().map(|r| r.criterion_id.as_str()))
        {
            return Err("La solicitud debe cubrir cada criterio una sola vez.".into());
        }
        for criterion in &d.criteria {
            let result = submission
                .criteria
                .iter()
                .find(|r| r.criterion_id == criterion.id)
                .ok_or("Falta un criterio de aceptación.")?;
            let unique: HashSet<_> = result.evidence_ids.iter().collect();
            if !result.fulfilled
                || (criterion.evidence_required && result.evidence_ids.is_empty())
                || unique.len() != result.evidence_ids.len()
                || result
                    .evidence_ids
                    .iter()
                    .any(|v| !revision(v) || !verified_evidence_ids.contains(v))
            {
                return Err("Criterio incumplido o evidencia no verificada.".into());
            }
        }
        Ok(())
    }

    /// Checks binding only. R2 must authenticate the signature and select current,
    /// conflict-free decisions before calling this function. Client flags never count.
    pub fn validate_decision(
        &self,
        submission: &Submission,
        decision: &Decision,
    ) -> Result<(), String> {
        if !revision(&decision.id)
            || !revision(&decision.signature)
            || !id(&decision.supervisor_id)
            || DateTime::parse_from_rfc3339(&decision.recorded_at).is_err()
            || decision.project_id != self.project_id
            || decision.deliverable_id != submission.deliverable_id
            || decision.submission_id != submission.id
            || decision.commitment_revision != self.commitment.revision
            || submission.commitment_revision != self.commitment.revision
            || (!decision.accepted && decision.comment.trim().is_empty())
        {
            return Err("Decisión inválida, sin motivo o ligada a otra revisión.".into());
        }
        Ok(())
    }

    /// Pure closure precondition, not a persisted approval. Deliverables are evaluated
    /// during project closure rather than individually beforehand.
    pub fn validate_closure(
        &self,
        reviews: &[(Submission, Decision)],
        verified_evidence_ids: &HashSet<String>,
        final_outcome_verified: bool,
    ) -> Result<(), String> {
        self.validate()?;
        if !final_outcome_verified {
            return Err("Falta comprobar el estado final y los entregables al cierre.".into());
        }
        if !reviews.is_empty() {
            if !unique_ids(reviews.iter().map(|(s, _)| s.deliverable_id.as_str())) {
                return Err("Revisiones duplicadas en el cierre.".into());
            }
            for (submission, decision) in reviews {
                self.validate_submission(submission, verified_evidence_ids)?;
                self.validate_decision(submission, decision)?;
                if !decision.accepted {
                    return Err("Hay entregables sin aceptación.".into());
                }
            }
        }
        Ok(())
    }
}
impl Blocker {
    pub fn validate(&self, plan: &Plan) -> Result<(), String> {
        if !id(&self.id)
            || !plan.activities.iter().any(|a| a.id == self.activity_id)
            || self.reason.trim().is_empty()
            || self.help_needed.trim().is_empty()
        {
            return Err("Bloqueo sin actividad, impedimento o ayuda requerida.".into());
        }
        let parse =
            |v: &str| DateTime::parse_from_rfc3339(v).map_err(|_| "Fecha de bloqueo inválida.");
        let reported = parse(&self.reported_at)?;
        let attention = self.first_attention_at.as_deref().map(parse).transpose()?;
        let resolved = self.resolved_at.as_deref().map(parse).transpose()?;
        if attention.is_some_and(|v| v < reported)
            || resolved.is_some_and(|v| v < reported)
            || matches!((attention, resolved), (Some(a), Some(r)) if r < a)
            || (resolved.is_some()
                && (attention.is_none()
                    || !self
                        .resolution_note
                        .as_ref()
                        .is_some_and(|v| !v.trim().is_empty())))
            || (resolved.is_none() && self.resolution_note.is_some())
        {
            return Err("Seguimiento de bloqueo inconsistente.".into());
        }
        Ok(())
    }
}
/// Capabilities must be computed from a revalidated session, never from caller fields.
pub fn transition(
    status: ReviewStatus,
    action: ReviewAction,
    permissions: &Capabilities,
    comment: Option<&str>,
) -> Result<ReviewStatus, String> {
    use ReviewAction::*;
    use ReviewStatus::*;
    let allowed = match action {
        Submit | Withdraw => permissions.can_plan_activities,
        Accept | Return => permissions.can_review_deliverables,
        Revise => permissions.can_change_commitment,
    };
    if !allowed {
        return Err("Operación no autorizada.".into());
    }
    match (status, action) {
        (Preparing | Returned | Withdrawn, Submit) => Ok(Submitted),
        (Submitted, Withdraw) => Ok(Withdrawn),
        (Submitted, Accept) => Ok(Accepted),
        (Submitted, Return) if comment.is_some_and(|s| !s.trim().is_empty()) => Ok(Returned),
        (_, Revise) => Ok(Preparing),
        _ => Err("Transición inválida o falta motivo de devolución.".into()),
    }
}

#[cfg(test)]
mod tests;
