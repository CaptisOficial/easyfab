use crate::{activities, auth, data_store as store, incidents, plant, projects, results_store};
use serde::Serialize;
use std::{fs, path::Path};
#[derive(Serialize)]
pub struct Snapshot {
    pub generated_at: String,
    pub reporting_date: String,
    pub prepared_by: String,
    pub projects: Vec<activities::Detail>,
    pub result_projects: Vec<results_store::Detail>,
    pub incidents: incidents::Overview,
}
#[derive(Serialize)]
pub struct Export {
    pub path: String,
    pub sha256: String,
}
fn fingerprint(dir: &Path) -> Result<String, String> {
    fn walk(base: &Path, dir: &Path, parts: &mut Vec<(String, String)>) -> Result<(), String> {
        store::contained(base, dir)?;
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let p = entry.map_err(|e| e.to_string())?.path();
            store::contained(base, &p)?;
            if p.is_dir() {
                walk(base, &p, parts)?;
            } else if p.extension().and_then(|s| s.to_str()) == Some("json") {
                parts.push((
                    p.strip_prefix(base)
                        .map_err(|e| e.to_string())?
                        .to_string_lossy()
                        .into_owned(),
                    store::hash(&fs::read(p).map_err(|e| e.to_string())?),
                ));
            }
        }
        Ok(())
    }
    let mut parts = vec![];
    walk(dir, dir, &mut parts)?;
    parts.sort();
    Ok(store::hash(
        &serde_json::to_vec(&parts).map_err(|e| e.to_string())?,
    ))
}
pub fn snapshot(dir: &Path, s: &auth::Session, id: &str, date: &str) -> Result<Snapshot, String> {
    plant::context(dir, s, id)?;
    if !["admin", "supervisor"].contains(&s.user.role.as_str()) {
        return Err("El reporte del área corresponde a Supervisor o Admin.".into());
    }
    projects::validate_dates(date, date)?;
    let selected =
        chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    use chrono::Datelike;
    let start = selected - chrono::Duration::days(selected.weekday().num_days_from_monday() as i64);
    let end = start + chrono::Duration::days(6);
    let before = fingerprint(dir)?;
    let mut details = vec![];
    let mut result_projects = vec![];
    for project in projects::overview(dir, s, id)?.projects {
        let mut detail = activities::detail(dir, s, id, &project.id)?;
        detail.entries.retain(|entry| {
            entry.activity.start_date <= end.to_string()
                && entry.activity.due_date >= start.to_string()
        });
        if !detail.entries.is_empty()
            || (project.start_date <= end.to_string() && project.target_date >= start.to_string())
        {
            if results_store::is_active(dir, &project.id)? {
                result_projects.push(results_store::detail(dir, s, id, &project.id)?);
            }
            details.push(detail);
        }
    }
    let mut incidents = incidents::overview(dir, s, id)?;
    if !incidents.legacy.is_empty() {
        return Err("El reporte requiere convertir explícitamente las incidencias anteriores a eventos antes de consolidar.".into());
    }
    if incidents.records.iter().any(|r| r.leaves.len() != 1) {
        return Err("Integra las versiones concurrentes de incidencias antes de exportar.".into());
    }
    incidents.records.retain(|r| {
        r.leaves.iter().any(|e| {
            e.issue.occurrence_date <= end.to_string()
                && (e.issue.status != "Resolved" || e.issue.occurrence_date >= start.to_string())
        })
    });
    plant::context(dir, s, id)?;
    if fingerprint(dir)? != before {
        return Err("Los datos cambiaron durante la lectura. Actualiza el reporte.".into());
    }
    Ok(Snapshot {
        generated_at: chrono::Utc::now().to_rfc3339(),
        reporting_date: date.into(),
        prepared_by: s.user.name.clone(),
        projects: details,
        result_projects,
        incidents,
    })
}
pub fn export(dir: &Path, s: &auth::Session, id: &str, date: &str) -> Result<Export, String> {
    let snapshot = snapshot(dir, s, id, date)?;
    let folder = dir.parent().ok_or("Espacio inválido.")?.join("exports");
    let base = dir.parent().unwrap();
    store::contained(base, &folder)?;
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let request = auth::revision();
    let staging = folder.join(format!(".weekly-{request}"));
    fs::create_dir(&staging).map_err(|e| e.to_string())?;
    let result = (|| {
        let script = staging.join("export.ps1");
        let template = staging.join("template.xlsx");
        let data = staging.join("snapshot.json");
        let output = staging.join("report.xlsx");
        // BOM is necessary for Windows PowerShell 5.1 UTF-8 source and JSON.
        let mut script_bytes = vec![0xef, 0xbb, 0xbf];
        script_bytes.extend_from_slice(include_bytes!("../resources/export_weekly.ps1"));
        fs::write(&script, script_bytes).map_err(|e| e.to_string())?;
        fs::write(
            &template,
            include_bytes!("../resources/weekly-template.xlsx"),
        )
        .map_err(|e| e.to_string())?;
        fs::write(
            &data,
            serde_json::to_vec(&snapshot).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        let mut command = std::process::Command::new("powershell.exe");
        command
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(&script)
            .arg("-SnapshotPath")
            .arg(&data)
            .arg("-TemplatePath")
            .arg(&template)
            .arg("-OutputPath")
            .arg(&output);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let status = command
            .output()
            .map_err(|e| format!("No se pudo iniciar la exportación Excel: {e}"))?;
        if !status.status.success() {
            return Err(format!("Excel no completó el reporte. Revisa que Microsoft Excel esté instalado y disponible. {}",String::from_utf8_lossy(&status.stderr)));
        }
        plant::context(dir, s, id)?;
        store::contained(base, &output)?;
        let bytes = fs::read(&output).map_err(|e| e.to_string())?;
        let target = folder.join(format!("KMX-FW-{date}-{}.xlsx", &request[..12]));
        store::publish(&target, &bytes, None, || {
            plant::context(dir, s, id)?;
            store::contained(base, &target)
        })?;
        Ok(Export {
            path: target.to_string_lossy().into_owned(),
            sha256: store::hash(&bytes),
        })
    })();
    // The resolved staging directory is always an immediate child of exports.
    if staging.parent() == Some(folder.as_path()) && store::contained(base, &staging).is_ok() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}
