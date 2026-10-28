//! Operational pilot boundary, not a distributed lock or hardware authentication.
use crate::auth::Session;

pub(super) struct Writer<'a> {
    pub workspace: Option<&'a str>,
    pub user: Option<&'a str>,
    pub host: Option<&'a str>,
}
impl Writer<'_> {
    pub fn compiled() -> Self {
        Self {
            workspace: option_env!("EASYFAB_PROJECT_WRITER_WORKSPACE"),
            user: option_env!("EASYFAB_PROJECT_WRITER_USER"),
            host: option_env!("EASYFAB_PROJECT_WRITER_HOST"),
        }
    }
    pub fn allows(&self, workspace: &str, session: &Session, host: &str) -> bool {
        !workspace.is_empty()
            && !host.is_empty()
            && self.workspace == Some(workspace)
            && self.user == Some(session.user.id.as_str())
            && self
                .host
                .is_some_and(|h| !h.is_empty() && h.eq_ignore_ascii_case(host))
    }
}
pub(super) const WRITE_MESSAGE: &str = "Alta bloqueada: requiere autorización del equipo y usuario escritor del piloto. Solicita al administrador revisar la habilitación.";
