use serde::{Deserialize, Serialize};
#[derive(Deserialize, Serialize)]
pub struct Team {
    pub version: u32,
    pub updated_at: String,
    pub members: Vec<Member>,
}
#[derive(Deserialize, Serialize)]
pub struct Member {
    pub id: String,
    pub name: String,
    pub role: String,
    pub area: String,
    pub password_hash: String,
    pub role_signature: String,
    pub status: String,
    pub credential_revision: String,
    pub temporary_expires_at: String,
    pub credential_signature: String,
}
#[derive(Clone, Serialize)]
pub struct User {
    pub id: String,
    pub name: String,
    pub role: String,
    pub must_change_password: bool,
}
#[derive(Serialize)]
pub struct Choice {
    pub id: String,
    pub name: String,
}
#[derive(Clone)]
pub struct Session {
    pub user: User,
    pub fingerprint: String,
}
#[derive(Serialize, Deserialize)]
pub struct Credential {
    pub revision: String,
    pub password_hash: String,
    pub signature: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NewUser {
    pub id: String,
    pub name: String,
    pub role: String,
}
#[derive(Serialize)]
pub struct DirectoryUser {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
}

#[derive(Serialize)]
pub struct LoginDirectory {
    pub users: Vec<Choice>,
    pub requires_admin: bool,
}
