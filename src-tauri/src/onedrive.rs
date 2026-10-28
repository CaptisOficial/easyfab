//! Auto-detección de la carpeta `ENGINEERING FILES - 10.FAB` dentro de OneDrive corporativo.
//!
//! Orden de búsqueda (sin pedir rutas al usuario):
//! 1. Variable de entorno `OneDriveCommercial` (y `OneDrive` como respaldo).
//! 2. Registro: `HKCU\Software\Microsoft\OneDrive\Accounts\Business1..9\UserFolder`.
//! 3. Registro: `HKCU\Software\SyncEngines\Providers\OneDrive\*\MountPoint`
//!    (bibliotecas de SharePoint sincronizadas o accesos directos).
//! 4. Escaneo de `%USERPROFILE%\OneDrive - *`.
//!
//! En cada raíz se busca `ENGINEERING FILES - 10.FAB` directamente y un nivel por debajo.

use serde::Serialize;
use std::path::{Path, PathBuf};

pub const ENGINEERING_DIR: &str = "ENGINEERING FILES - 10.FAB";

#[derive(Debug, Clone, Serialize)]
pub struct OneDriveDetection {
    pub found: bool,
    pub engineering_root: Option<String>,
    pub data_dir: Option<String>,
    pub source: Option<String>,
    pub candidates_checked: Vec<String>,
}

/// Raíz candidata de OneDrive con el origen que la reportó.
#[derive(Debug, Clone)]
pub struct RootCandidate {
    pub path: PathBuf,
    pub source: String,
}

/// Ruta de datos relativa a la raíz de ingeniería.
pub fn data_dir_for(engineering_root: &Path) -> PathBuf {
    engineering_root.join("Management").join("Data")
}

/// Reúne raíces de OneDrive candidatas, sin duplicados y en orden de prioridad.
pub fn collect_root_candidates() -> Vec<RootCandidate> {
    let mut out: Vec<RootCandidate> = Vec::new();

    for var in ["OneDriveCommercial", "OneDrive"] {
        if let Ok(v) = std::env::var(var) {
            if !v.trim().is_empty() {
                push_unique(&mut out, PathBuf::from(v), format!("env:{var}"));
            }
        }
    }

    for (p, src) in registry_candidates() {
        push_unique(&mut out, p, src);
    }

    if let Ok(profile) = std::env::var("USERPROFILE") {
        if let Ok(entries) = std::fs::read_dir(&profile) {
            for e in entries.flatten() {
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with("OneDrive - ") && e.path().is_dir() {
                    push_unique(&mut out, e.path(), "scan:USERPROFILE".to_string());
                }
            }
        }
    }

    out
}

fn push_unique(out: &mut Vec<RootCandidate>, path: PathBuf, source: String) {
    let key = normalize(&path);
    if !out.iter().any(|c| normalize(&c.path) == key) {
        out.push(RootCandidate { path, source });
    }
}

fn normalize(p: &Path) -> String {
    p.to_string_lossy()
        .trim_end_matches(['\\', '/'])
        .to_lowercase()
}

#[cfg(windows)]
fn registry_candidates() -> Vec<(PathBuf, String)> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let mut out = Vec::new();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    for i in 1..=9 {
        let key = format!(r"Software\Microsoft\OneDrive\Accounts\Business{i}");
        if let Ok(k) = hkcu.open_subkey(&key) {
            if let Ok(folder) = k.get_value::<String, _>("UserFolder") {
                out.push((PathBuf::from(folder), format!("reg:Business{i}")));
            }
        }
    }

    if let Ok(providers) = hkcu.open_subkey(r"Software\SyncEngines\Providers\OneDrive") {
        for name in providers.enum_keys().flatten() {
            if let Ok(k) = providers.open_subkey(&name) {
                if let Ok(mp) = k.get_value::<String, _>("MountPoint") {
                    out.push((PathBuf::from(mp), "reg:SyncEngines".to_string()));
                }
            }
        }
    }
    out
}

#[cfg(not(windows))]
fn registry_candidates() -> Vec<(PathBuf, String)> {
    Vec::new()
}

/// Busca la carpeta de ingeniería en las raíces indicadas.
pub fn find_engineering_root(candidates: &[RootCandidate]) -> OneDriveDetection {
    let mut checked = Vec::new();

    for c in candidates {
        // Caso 1: <raíz>\ENGINEERING FILES - 10.FAB
        let direct = c.path.join(ENGINEERING_DIR);
        checked.push(direct.to_string_lossy().to_string());
        if direct.is_dir() {
            return found(direct, &c.source, checked);
        }
        // Caso 2: la raíz ya es la carpeta de ingeniería (montaje de SharePoint).
        if c.path
            .file_name()
            .map(|n| n.to_string_lossy().eq_ignore_ascii_case(ENGINEERING_DIR))
            .unwrap_or(false)
            && c.path.is_dir()
        {
            return found(c.path.clone(), &c.source, checked);
        }
        // Caso 3: un nivel por debajo (bibliotecas compartidas).
        if let Ok(entries) = std::fs::read_dir(&c.path) {
            for e in entries.flatten() {
                let nested = e.path().join(ENGINEERING_DIR);
                if nested.is_dir() {
                    checked.push(nested.to_string_lossy().to_string());
                    return found(nested, &format!("{}+nested", c.source), checked);
                }
            }
        }
    }

    OneDriveDetection {
        found: false,
        engineering_root: None,
        data_dir: None,
        source: None,
        candidates_checked: checked,
    }
}

fn found(root: PathBuf, source: &str, checked: Vec<String>) -> OneDriveDetection {
    OneDriveDetection {
        found: true,
        data_dir: Some(data_dir_for(&root).to_string_lossy().to_string()),
        engineering_root: Some(root.to_string_lossy().to_string()),
        source: Some(source.to_string()),
        candidates_checked: checked,
    }
}

pub fn detect() -> OneDriveDetection {
    find_engineering_root(&collect_root_candidates())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("easyfab-test-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&p);
        std::fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn detects_direct_child() {
        let root = tmp("direct");
        std::fs::create_dir_all(root.join(ENGINEERING_DIR)).unwrap();
        let det = find_engineering_root(&[RootCandidate {
            path: root.clone(),
            source: "test".into(),
        }]);
        assert!(det.found);
        assert!(det.data_dir.unwrap().ends_with(r"Management\Data") || cfg!(not(windows)));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn detects_nested_library() {
        let root = tmp("nested");
        std::fs::create_dir_all(root.join("Shared Library").join(ENGINEERING_DIR)).unwrap();
        let det = find_engineering_root(&[RootCandidate {
            path: root.clone(),
            source: "test".into(),
        }]);
        assert!(det.found);
        assert_eq!(det.source.as_deref(), Some("test+nested"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn reports_not_found() {
        let root = tmp("missing");
        let det = find_engineering_root(&[RootCandidate {
            path: root.clone(),
            source: "test".into(),
        }]);
        assert!(!det.found);
        assert_eq!(det.candidates_checked.len(), 1);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn dedupes_case_and_trailing_slash() {
        let mut v = Vec::new();
        push_unique(&mut v, PathBuf::from(r"C:\A\OneDrive - X"), "a".into());
        push_unique(&mut v, PathBuf::from(r"c:\a\onedrive - x\"), "b".into());
        assert_eq!(v.len(), 1);
    }
}
