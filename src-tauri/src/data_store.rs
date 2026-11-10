//! Local publication with optimistic conflict detection; no distributed locks.
use sha2::{Digest, Sha256};
use std::{fs, io::Write, path::Path};
pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn contained(base: &Path, path: &Path) -> Result<(), String> {
    let base = base.canonicalize().map_err(|e| e.to_string())?;
    let mut current = path;
    loop {
        if let Ok(metadata) = fs::symlink_metadata(current) {
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if metadata.file_attributes() & 0x400 != 0 {
                    return Err("No se permiten enlaces en la ruta de datos.".into());
                }
            }
            if metadata.file_type().is_symlink() {
                return Err("No se permiten enlaces en la ruta de datos.".into());
            }
        }
        if current.exists()
            && !current
                .canonicalize()
                .map_err(|e| e.to_string())?
                .starts_with(&base)
        {
            return Err("Ruta fuera del directorio autorizado.".into());
        }
        if current == base || current.canonicalize().ok().as_ref() == Some(&base) {
            break;
        }
        current = current
            .parent()
            .ok_or("Ruta fuera del directorio autorizado.")?;
    }
    Ok(())
}
pub fn publish(
    path: &Path,
    bytes: &[u8],
    previous: Option<&[u8]>,
    check: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let tmp = path.with_extension(format!("{}.tmp", crate::auth::revision()));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp)
            .map_err(|e| e.to_string())?;
        file.write_all(bytes)
            .and_then(|_| file.sync_all())
            .map_err(|e| e.to_string())?;
        drop(file);
        check()?;
        match (previous, fs::read(path)) {
            (Some(expected), Ok(actual)) if expected == actual => (),
            (None, Err(error)) if error.kind() == std::io::ErrorKind::NotFound => (),
            _ => return Err("Los datos cambiaron. Actualiza antes de reintentar.".into()),
        }
        fs::rename(&tmp, path).map_err(|e| format!("No se pudo publicar el archivo: {e}"))
    })();
    if result.is_err() {
        let _ = fs::remove_file(tmp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn replacement_and_changes_during_validation() {
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target/test-data")
            .join(format!("easyfab-store-{}", crate::auth::revision()));
        fs::create_dir_all(&base).unwrap();
        let path = base.join("record.json");
        publish(&path, b"first", None, || Ok(())).unwrap();
        publish(&path, b"second", Some(b"first"), || Ok(())).unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"second");
        assert!(publish(&path, b"overwrite", None, || Ok(())).is_err());
        assert!(publish(&path, b"overwrite", Some(b"second"), || {
            fs::write(&path, b"concurrent").map_err(|e| e.to_string())
        }).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"concurrent");
        let new_path = base.join("new.json");
        assert!(publish(&new_path, b"overwrite", None, || {
            fs::write(&new_path, b"created concurrently").map_err(|e| e.to_string())
        }).is_err());
        assert_eq!(fs::read(&new_path).unwrap(), b"created concurrently");
        assert_eq!(fs::read_dir(&base).unwrap().count(), 2);
        fs::remove_dir_all(&base).unwrap();
    }
    #[test]
    fn failed_validation_does_not_create_destination() {
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target/test-data")
            .join(format!("easyfab-store-{}", crate::auth::revision()));
        fs::create_dir_all(&base).unwrap();
        let path = base.join("record.json");
        assert!(publish(&path, b"data", None, || Err("revoked".into())).is_err());
        assert!(!path.exists());
        assert_eq!(fs::read_dir(&base).unwrap().count(), 0);
        fs::remove_dir_all(&base).unwrap();
    }
    #[test]
    fn conflict_and_failed_publication_preserve_data() {
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target/test-data")
            .join(format!("easyfab-store-{}", crate::auth::revision()));
        fs::create_dir_all(&base).unwrap();
        let path = base.join("record.json");
        publish(&path, b"first", None, || Ok(())).unwrap();
        assert!(publish(&path, b"second", Some(b"stale"), || Ok(())).is_err());
        assert!(publish(&path, b"second", Some(b"first"), || Err("fault".into())).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"first");
        assert_eq!(fs::read_dir(&base).unwrap().count(), 1);
        assert!(contained(&base, &base.join("future/file")).is_ok());
        assert!(contained(&base, &base.join("../outside")).is_err());
        fs::remove_dir_all(&base).unwrap();
    }
}
