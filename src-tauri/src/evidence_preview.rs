//! Apertura segura de evidencias adjuntas mediante copia temporal y visor del sistema operativo.
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
};

use crate::activities::Evidence;

const PREVIEW_DIR: &str = "easyfab-evidence";

/// Sanitiza el nombre original del archivo conservando una extensión segura.
pub(crate) fn sanitize_filename(name: &str, relative_path: &str) -> String {
    let base = Path::new(name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("evidencia");
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches(|c| c == '.' || c == '_');
    let fallback_ext = Path::new(relative_path)
        .extension()
        .and_then(|s| s.to_str())
        .filter(|ext| !ext.is_empty() && ext.chars().all(|c| c.is_ascii_alphanumeric()))
        .unwrap_or("bin");

    if trimmed.is_empty() {
        return format!("evidencia.{fallback_ext}");
    }
    if Path::new(trimmed).extension().is_none() {
        return format!("{trimmed}.{fallback_ext}");
    }
    trimmed.to_string()
}

/// Escribe los bytes verificados en un archivo temporal aislado para abrirlo con el visor del SO.
pub(crate) fn write_temp_preview(
    temp_root: &Path,
    evidence: &Evidence,
    bytes: &[u8],
) -> Result<PathBuf, String> {
    fs::create_dir_all(temp_root)
        .map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    let safe_name = sanitize_filename(&evidence.name, &evidence.relative_path);
    let id_prefix: String = evidence
        .id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(12)
        .collect();
    let file_name = if id_prefix.is_empty() {
        safe_name
    } else {
        format!("{id_prefix}_{safe_name}")
    };
    let target = temp_root.join(file_name);
    let mut file = fs::File::create(&target)
        .map_err(|e| format!("No se pudo crear el archivo: {e}"))?;
    file.write_all(bytes)
        .map_err(|e| format!("No se pudo escribir el archivo: {e}"))?;
    file.sync_all()
        .map_err(|e| format!("No se pudo guardar el archivo: {e}"))?;
    Ok(target)
}

fn open_with_os(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let status = Command::new("explorer.exe").arg(path).spawn();

    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(path).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open").arg(path).spawn();

    status
        .map(|_| ())
        .map_err(|e| format!("No se pudo abrir el documento adjunto: {e}"))
}

pub(crate) fn open_evidence_bytes(evidence: &Evidence, bytes: &[u8]) -> Result<(), String> {
    let temp_root = std::env::temp_dir().join(PREVIEW_DIR);
    let target = write_temp_preview(&temp_root, evidence, bytes)?;
    open_with_os(&target)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_filename_strips_traversal_and_keeps_extension() {
        assert_eq!(
            sanitize_filename("../../secreto/acta final (1).pdf", "evidence/abc.pdf"),
            "acta_final__1_.pdf"
        );
        assert_eq!(
            sanitize_filename("sin_extension", "evidence/abc.png"),
            "sin_extension.png"
        );
        assert_eq!(
            sanitize_filename("...", "evidence/abc.jpg"),
            "evidencia.jpg"
        );
    }

    #[test]
    fn write_temp_preview_creates_isolated_file_with_exact_bytes() {
        let dir = std::env::temp_dir().join(format!(
            "easyfab-preview-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let evidence = Evidence {
            id: "abcdef1234567890".into(),
            name: "../evidencia prueba.pdf".into(),
            relative_path: "evidence/abcdef1234567890.pdf".into(),
            sha256: "0".repeat(64),
            size: 4,
        };
        let path = write_temp_preview(&dir, &evidence, b"%PDF").unwrap();
        assert!(path.starts_with(&dir));
        assert_eq!(
            path.file_name().and_then(|s| s.to_str()),
            Some("abcdef123456_evidencia_prueba.pdf")
        );
        assert_eq!(fs::read(&path).unwrap(), b"%PDF");
        let _ = fs::remove_dir_all(&dir);
    }
}
