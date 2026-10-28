//! Acceso local: criptografia, almacenamiento y ciclo de credenciales.
#[path = "auth/credentials.rs"]
mod credentials;
#[path = "auth/crypto.rs"]
mod crypto;
#[path = "auth/directory.rs"]
mod directory;
#[path = "auth/models.rs"]
mod models;

pub use credentials::{authenticate, change_password, reset_password};
pub use directory::{read_key, team, trusted};
pub use models::{Choice, Session, User};
// API exclusiva de la herramienta local de provision, nunca expuesta por IPC.
#[allow(unused_imports)]
pub use credentials::seal_temporary;
#[allow(unused_imports)]
pub use crypto::{hash_password, revision, sign_role};
#[allow(unused_imports)]
pub use directory::create_master_key;
#[allow(unused_imports)]
pub use models::Member;

#[path = "auth/users.rs"]
mod users;
pub use models::{DirectoryUser, NewUser};
pub use users::{create_user, list_users, set_user_active};

pub use users::provision_initial_admin;

pub use models::LoginDirectory;

#[cfg(test)]
mod onboarding_tests;
