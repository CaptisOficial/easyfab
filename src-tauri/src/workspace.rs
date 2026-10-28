//! Una sola raíz y un layout compartido; las rutas absolutas son locales a la instalación.
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Component, Path, PathBuf},
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Layout {
    version: u32,
    folder: String,
    manifest: String,
    data: String,
    docs: String,
    contracts: String,
    software: String,
    exports: String,
    backups: String,
    executable: String,
}
fn layout() -> Result<Layout, String> {
    let value: Layout =
        serde_json::from_str(include_str!("../../contracts/v1/workspace.layout.json"))
            .map_err(|e| e.to_string())?;
    for path in [
        &value.folder,
        &value.manifest,
        &value.data,
        &value.docs,
        &value.contracts,
        &value.software,
        &value.exports,
        &value.backups,
        &value.executable,
    ] {
        if path.is_empty()
            || !Path::new(path)
                .components()
                .all(|c| matches!(c, Component::Normal(_)))
        {
            return Err("El layout contiene una ruta no relativa.".into());
        }
    }
    if value.version != 1 {
        return Err("Versión de layout no compatible.".into());
    }
    Ok(value)
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    version: u32,
    id: String,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Installation {
    version: u32,
    workspace_root: String,
    workspace_id: String,
}
#[derive(Clone, Serialize)]
pub struct WorkspaceInfo {
    pub id: String,
    pub root: String,
    pub path: String,
    pub data_dir: String,
    pub docs_dir: String,
    pub contracts_dir: String,
    pub software_dir: String,
    pub exports_dir: String,
    pub backups_dir: String,
    pub executable: String,
}
#[derive(Serialize)]
pub struct WorkspaceStatus {
    pub phase: String,
    pub candidate_root: Option<String>,
    pub workspace: Option<WorkspaceInfo>,
    pub message: Option<String>,
}
fn display(path: &Path) -> String {
    let text = path.to_string_lossy();
    if let Some(network) = text.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{}", network);
    }
    text.strip_prefix(r"\\?\").unwrap_or(&text).to_string()
}
fn validate_root(input: &Path) -> Result<PathBuf, String> {
    if !input.is_absolute() || !input.is_dir() {
        return Err("Elige una carpeta compartida existente con ruta absoluta.".into());
    }
    input
        .canonicalize()
        .map_err(|e| format!("No se puede acceder a la carpeta: {e}"))
}
fn valid_id(id: &str) -> bool {
    id.len() == 32
        && id
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn nonce() -> String {
    let mut bytes = [0u8; 16];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
fn read_json<T: for<'a> Deserialize<'a>>(path: &Path) -> Result<T, String> {
    serde_json::from_slice(
        &fs::read(path).map_err(|e| format!("No se puede leer {}: {e}", path.display()))?,
    )
    .map_err(|_| format!("Archivo de configuración inválido: {}", path.display()))
}
fn write_json(path: &Path, value: &impl Serialize, replace: bool) -> Result<(), String> {
    let target = if replace {
        path.with_extension(format!("{}.tmp", nonce()))
    } else {
        path.to_path_buf()
    };
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|e| e.to_string())?;
    file.write_all(&serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    if replace {
        fs::rename(target, path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn open(root: &Path, expected_id: Option<&str>) -> Result<WorkspaceInfo, String> {
    let root = validate_root(root)?;
    let l = layout()?;
    let path = root.join(&l.folder);
    let manifest: Manifest = read_json(&path.join(&l.manifest))?;
    if manifest.version != 1
        || !valid_id(&manifest.id)
        || expected_id.is_some_and(|id| id != manifest.id)
    {
        return Err(
            "La identidad del espacio no coincide. Selecciona explícitamente el espacio correcto."
                .into(),
        );
    }
    let data = path.join(&l.data);
    for name in [
        "team.json",
        "projects.json",
        "issues.json",
        "config_plant.json",
    ] {
        if !data.join(name).is_file() {
            return Err(format!("El espacio está incompleto ({name}). Restaura sus datos; no se creará otro directorio vacío."));
        }
    }
    Ok(WorkspaceInfo {
        id: manifest.id,
        root: display(&root),
        path: display(&path),
        data_dir: display(&data),
        docs_dir: display(&path.join(l.docs)),
        contracts_dir: display(&path.join(l.contracts)),
        software_dir: display(&path.join(l.software)),
        exports_dir: display(&path.join(l.exports)),
        backups_dir: display(&path.join(l.backups)),
        executable: display(&path.join(l.executable)),
    })
}
pub fn initialize(root: &Path, local_dir: &Path) -> Result<WorkspaceInfo, String> {
    let root = validate_root(root)?;
    let l = layout()?;
    let path = root.join(&l.folder);
    if !path.join(&l.manifest).exists() {
        if root.join("Management/Data/team.json").exists() {
            return Err("Hay datos EasyFAB previos en Management/Data. Trasládalos antes de crear el espacio para conservar una sola fuente de datos.".into());
        }
        for relative in [&l.data, &l.docs, &l.software, &l.exports, &l.backups] {
            fs::create_dir_all(path.join(relative)).map_err(|e| e.to_string())?;
        }
        crate::bootstrap::bootstrap(&path.join(&l.data))?;
        crate::workspace_assets::install(&path.join(&l.docs), &path.join(&l.contracts))?;
        let manifest = Manifest {
            version: 1,
            id: nonce(),
        };
        write_json(&path.join(&l.manifest), &manifest, false)?;
    }
    let info = open(&root, None)?;
    fs::create_dir_all(local_dir).map_err(|e| e.to_string())?;
    write_json(
        &local_dir.join("installation.json"),
        &Installation {
            version: 1,
            workspace_root: info.root.clone(),
            workspace_id: info.id.clone(),
        },
        true,
    )?;
    Ok(info)
}
fn ready(info: WorkspaceInfo) -> WorkspaceStatus {
    WorkspaceStatus {
        phase: "ready".into(),
        candidate_root: Some(info.root.clone()),
        workspace: Some(info),
        message: None,
    }
}
fn unavailable(root: Option<String>, message: String) -> WorkspaceStatus {
    WorkspaceStatus {
        phase: "unavailable".into(),
        candidate_root: root,
        workspace: None,
        message: Some(message),
    }
}
pub fn status_for(info: &WorkspaceInfo) -> WorkspaceStatus {
    match open(Path::new(&info.root), Some(&info.id)) {
        Ok(value) => ready(value),
        Err(error) => unavailable(Some(info.root.clone()), error),
    }
}
pub fn probe(local_dir: &Path, executable: &Path, candidate: Option<String>) -> WorkspaceStatus {
    let saved = local_dir.join("installation.json");
    if saved.exists() {
        let config: Installation = match read_json(&saved) {
            Ok(value) => value,
            Err(error) => return unavailable(None, error),
        };
        if config.version != 1 || !valid_id(&config.workspace_id) {
            return unavailable(
                Some(config.workspace_root),
                "Referencia de instalación inválida.".into(),
            );
        }
        return match open(
            Path::new(&config.workspace_root),
            Some(&config.workspace_id),
        ) {
            Ok(info) => ready(info),
            Err(error) => unavailable(Some(config.workspace_root), error),
        };
    }
    // El portable puede encontrar su espacio por posición; no depende del nombre del perfil Windows.
    if let Ok(l) = layout() {
        if let Some(root) = executable
            .parent()
            .and_then(Path::parent)
            .and_then(Path::parent)
        {
            if executable.ends_with(Path::new(&l.folder).join(&l.executable)) {
                return match open(root, None) {
                    Ok(info) => ready(info),
                    Err(error) => unavailable(Some(display(root)), error),
                };
            }
        }
    }
    WorkspaceStatus {
        phase: "unconfigured".into(),
        candidate_root: candidate,
        workspace: None,
        message: None,
    }
}
#[cfg(test)]
#[path = "workspace_tests.rs"]
mod tests;
