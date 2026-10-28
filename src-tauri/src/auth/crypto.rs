use argon2::{
    password_hash::{
        rand_core::{OsRng, RngCore},
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
    },
    Argon2,
};
use hmac::{Hmac, Mac};
use sha2::Sha256;
#[allow(dead_code)]
pub fn hash_password(pin: &str) -> Result<String, String> {
    if pin.chars().count() != 8 {
        return Err("La contraseña debe tener exactamente 8 caracteres.".into());
    }
    Argon2::default()
        .hash_password(pin.as_bytes(), &SaltString::generate(&mut OsRng))
        .map(|h| h.to_string())
        .map_err(|_| "No se pudo proteger la credencial.".into())
}
pub fn verify_password(pin: &str, hash: &str) -> bool {
    if pin.len() > 128 {
        return false;
    }
    PasswordHash::new(hash)
        .ok()
        .filter(|h| h.algorithm.as_str() == "argon2id")
        .map(|h| {
            Argon2::default()
                .verify_password(pin.as_bytes(), &h)
                .is_ok()
        })
        .unwrap_or(false)
}
fn role_mac(id: &str, role: &str, status: &str, key: &[u8]) -> Hmac<Sha256> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts any key size");
    mac.update(format!("{id}:{role}:{status}").as_bytes());
    mac
}
#[allow(dead_code)]
pub fn sign_role(id: &str, role: &str, status: &str, key: &[u8]) -> String {
    role_mac(id, role, status, key)
        .finalize()
        .into_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}
pub fn verify_role(id: &str, role: &str, status: &str, signature: &str, key: &[u8]) -> bool {
    if signature.len() != 64 || !signature.is_ascii() || id.contains(':') {
        return false;
    }
    let bytes: Option<Vec<u8>> = (0..64)
        .step_by(2)
        .map(|i| u8::from_str_radix(&signature[i..i + 2], 16).ok())
        .collect();
    bytes
        .map(|b| role_mac(id, role, status, key).verify_slice(&b).is_ok())
        .unwrap_or(false)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn credentials() {
        let h = hash_password("12345678").unwrap();
        assert!(verify_password("12345678", &h));
        assert!(!verify_password("87654321", &h));
        assert!(!verify_password("12345678", "invalid"));
        assert_ne!(h, hash_password("12345678").unwrap());
    }
    #[test]
    fn tampering() {
        let k = [7; 32];
        let s = sign_role("a", "engineer", "active", &k);
        assert!(verify_role("a", "engineer", "active", &s, &k));
        for (id, role, status) in [
            ("b", "engineer", "active"),
            ("a", "admin", "active"),
            ("a", "engineer", "inactive"),
        ] {
            assert!(!verify_role(id, role, status, &s, &k));
        }
        assert!(!verify_role("a", "engineer", "active", &s, &[8; 32]));
        assert!(!verify_role("a", "engineer", "active", "ðŸ’¥", &k));
    }
}

pub fn revision() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
/// 32 simbolos sin caracteres ambiguos; 5 bits por caracter, muestreo uniforme.
pub fn temporary_password() -> String {
    const ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut bytes = [0u8; 8];
    OsRng.fill_bytes(&mut bytes);
    bytes
        .iter()
        .map(|b| ALPHABET[(b & 31) as usize] as char)
        .collect()
}
