use crate::{activities, auth, data_store as store, incidents, plant, projects, results_store};
use serde::Serialize;
use std::{fs, path::Path};

#[cfg(test)]
const BILINGUAL_SEPARATOR: &str = " | ";

#[cfg(test)]
pub(crate) fn pick_bilingual(raw: &str, lang: &str) -> String {
    match raw.find(BILINGUAL_SEPARATOR) {
        Some(idx) => {
            let es = raw[..idx].trim();
            let en = raw[idx + BILINGUAL_SEPARATOR.len()..].trim();
            if lang == "en" && !en.is_empty() {
                en.to_string()
            } else {
                es.to_string()
            }
        }
        None => raw.trim().to_string(),
    }
}

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
        for entry in fs::read_dir(dir).map_err(|e| format!("No se pudo leer la carpeta: {e}"))? {
            let p = entry
                .map_err(|e| format!("No se pudo leer la carpeta: {e}"))?
                .path();
            store::contained(base, &p)?;
            if p.is_dir() {
                walk(base, &p, parts)?;
            } else if p.extension().and_then(|s| s.to_str()) == Some("json") {
                parts.push((
                    p.strip_prefix(base)
                        .map_err(|e| format!("No se pudo completar la operación: {e}"))?
                        .to_string_lossy()
                        .into_owned(),
                    store::hash(
                        &fs::read(p).map_err(|e| format!("No se pudo leer el archivo: {e}"))?,
                    ),
                ));
            }
        }
        Ok(())
    }
    let mut parts = vec![];
    walk(dir, dir, &mut parts)?;
    parts.sort();
    Ok(store::hash(
        &serde_json::to_vec(&parts)
            .map_err(|e| format!("No se pudo procesar el archivo JSON: {e}"))?,
    ))
}
pub fn snapshot(dir: &Path, s: &auth::Session, id: &str, date: &str) -> Result<Snapshot, String> {
    plant::context(dir, s, id)?;
    if !["admin", "supervisor"].contains(&s.user.role.as_str()) {
        return Err("El reporte del área corresponde a Supervisor o Admin.".into());
    }
    projects::validate_dates(date, date)?;
    let selected = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| "Formato de fecha inválido.".to_string())?;
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
    fs::create_dir_all(&folder).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    let request = auth::revision();
    let staging = folder.join(format!(".weekly-{request}"));
    fs::create_dir(&staging).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    let result = (|| {
        let script = staging.join("export.ps1");
        let template = staging.join("template.xlsx");
        let data = staging.join("snapshot.json");
        let output = staging.join("report.xlsx");
        // BOM is necessary for Windows PowerShell 5.1 UTF-8 source and JSON.
        let mut script_bytes = vec![0xef, 0xbb, 0xbf];
        script_bytes.extend_from_slice(include_bytes!("../resources/export_weekly.ps1"));
        fs::write(&script, script_bytes)
            .map_err(|e| format!("No se pudo escribir el archivo: {e}"))?;
        fs::write(
            &template,
            include_bytes!("../resources/weekly-template.xlsx"),
        )
        .map_err(|e| format!("No se pudo escribir el archivo: {e}"))?;
        fs::write(
            &data,
            serde_json::to_vec(&snapshot)
                .map_err(|e| format!("No se pudo procesar el archivo JSON: {e}"))?,
        )
        .map_err(|e| format!("No se pudo escribir el archivo: {e}"))?;
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
        let bytes =
            fs::read(&output).map_err(|e| format!("No se pudo leer el archivo: {e}"))?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn pick_bilingual_matches_frontend_contract() {
        assert_eq!(pick_bilingual("Soldadura | Welding", "es"), "Soldadura");
        assert_eq!(pick_bilingual("Soldadura | Welding", "en"), "Welding");
        assert_eq!(pick_bilingual("  Línea 1  |  Line 1  ", "es"), "Línea 1");
        assert_eq!(pick_bilingual("  Línea 1  |  Line 1  ", "en"), "Line 1");
        assert_eq!(pick_bilingual("Solo español", "es"), "Solo español");
        assert_eq!(pick_bilingual("Solo español", "en"), "Solo español");
        assert_eq!(pick_bilingual("Solo español |   ", "en"), "Solo español");
        assert_eq!(pick_bilingual(" | Only English", "es"), "");
        assert_eq!(pick_bilingual(" | Only English", "en"), "Only English");
        assert_eq!(pick_bilingual("A | B | C", "es"), "A");
        assert_eq!(pick_bilingual("A | B | C", "en"), "B | C");
        assert_eq!(pick_bilingual("A|B", "en"), "A|B");
    }

    #[test]
    fn embedded_template_has_two_self_contained_bilingual_sheets() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target/test-data")
            .join(format!("easyfab-template-{}", auth::revision()));
        fs::create_dir_all(&dir).unwrap();
        let template_path = dir.join("weekly-template.xlsx");
        fs::write(
            &template_path,
            include_bytes!("../resources/weekly-template.xlsx"),
        )
        .unwrap();

        let probe_path = dir.join("verify_template.ps1");
        let probe_script = r#"
param([string]$TemplatePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($TemplatePath)
try {
    function Read-Xml([string]$entryName) {
        $e = $zip.GetEntry($entryName)
        if (-not $e) { throw "Missing zip entry: $entryName" }
        $sr = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8)
        $xml = [xml]$sr.ReadToEnd()
        $sr.Dispose()
        return $xml
    }
    $wb = Read-Xml 'xl/workbook.xml'
    $sheets = @($wb.workbook.sheets.sheet)
    if ($sheets.Count -ne 2) { throw "Expected 2 sheets, got $($sheets.Count)" }
    if ($sheets[0].name -ne 'Reporte Semanal (ES)') { throw "Unexpected sheet 1: $($sheets[0].name)" }
    if ($sheets[1].name -ne 'Weekly Report (EN)') { throw "Unexpected sheet 2: $($sheets[1].name)" }

    $sstXml = Read-Xml 'xl/sharedStrings.xml'
    $sst = @($sstXml.sst.si | ForEach-Object { $_.t })

    $stylesRaw = (Read-Xml 'xl/styles.xml').OuterXml
    if ($stylesRaw -notmatch '\[\$-es-MX\]d\\-mmm') { throw 'Missing [$-es-MX]d-mmm format in styles.xml' }
    if ($stylesRaw -notmatch '\[\$-en-US\]d\\-mmm') { throw 'Missing [$-en-US]d-mmm format in styles.xml' }
    if ($stylesRaw -notmatch 'pzas') { throw 'Missing pzas format in styles.xml' }

    $t1 = Read-Xml 'xl/tables/table1.xml'
    $t2 = Read-Xml 'xl/tables/table2.xml'
    $t3 = Read-Xml 'xl/tables/table3.xml'
    $t4 = Read-Xml 'xl/tables/table4.xml'
    $names = @($t1.table.name, $t2.table.name, $t3.table.name, $t4.table.name)
    if (($names -join ',') -ne 'tbl_Subactivities_ES,tbl_Issues_ES,tbl_Subactivities_EN,tbl_Issues_EN') {
        throw "Unexpected table names: $($names -join ',')"
    }

    $s1Raw = (Read-Xml 'xl/worksheets/sheet1.xml').OuterXml
    $s2Raw = (Read-Xml 'xl/worksheets/sheet2.xml').OuterXml
    if ($s1Raw -match "'[^']+!'") { throw 'Cross-sheet reference found in sheet1.xml' }
    if ($s2Raw -match "'[^']+!'") { throw 'Cross-sheet reference found in sheet2.xml' }
    if ($s1Raw -match 'tbl_Subactivities_EN|tbl_Issues_EN') { throw 'EN table referenced in ES sheet1.xml' }
    if ($s2Raw -match 'tbl_Subactivities_ES|tbl_Issues_ES') { throw 'ES table referenced in EN sheet2.xml' }
    if ($s1Raw -notmatch '\[\$-es-MX\]mmmm') { throw 'Missing [$-es-MX]mmmm in sheet1.xml' }
    if ($s2Raw -notmatch '\[\$-en-US\]mmmm') { throw 'Missing [$-en-US]mmmm in sheet2.xml' }
    if ($s1Raw -notmatch 'Abierta' -or $s1Raw -notmatch 'Contenida') { throw 'Missing Spanish COUNTIF statuses in sheet1.xml' }
    if ($s2Raw -notmatch 'Open' -or $s2Raw -notmatch 'Contained') { throw 'Missing English COUNTIF statuses in sheet2.xml' }

    function Check-TableHeaders($sheetXml, [int]$rowNum, $tableXml) {
        $row = $sheetXml.worksheet.sheetData.row | Where-Object { [int]$_.r -eq $rowNum }
        $cellTexts = @($row.c | ForEach-Object { $sst[[int]$_.v] })
        $colNames = @($tableXml.table.tableColumns.tableColumn | ForEach-Object { $_.name })
        if (($cellTexts -join '|') -ne ($colNames -join '|')) {
            throw "Header mismatch on row ${rowNum}: cells=($($cellTexts -join '|')) vs table=($($colNames -join '|'))"
        }
    }
    $s1 = Read-Xml 'xl/worksheets/sheet1.xml'
    $s2 = Read-Xml 'xl/worksheets/sheet2.xml'
    Check-TableHeaders $s1 26 $t1
    Check-TableHeaders $s1 32 $t2
    Check-TableHeaders $s2 26 $t3
    Check-TableHeaders $s2 32 $t4
    Write-Output 'TEMPLATE_OK'
} finally {
    $zip.Dispose()
}
"#;
        let mut script_bytes = vec![0xef, 0xbb, 0xbf];
        script_bytes.extend_from_slice(probe_script.as_bytes());
        fs::write(&probe_path, script_bytes).unwrap();

        let output = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(&probe_path)
            .arg("-TemplatePath")
            .arg(&template_path)
            .output()
            .unwrap();
        let _ = fs::remove_dir_all(&dir);
        assert!(
            output.status.success(),
            "Template verification failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "TEMPLATE_OK");
    }

    #[test]
    fn export_script_resolves_bilingual_fields_and_statuses() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target/test-data")
            .join(format!("easyfab-export-ps1-{}", auth::revision()));
        fs::create_dir_all(&dir).unwrap();
        let script_path = dir.join("export_weekly.ps1");
        let mut script_bytes = vec![0xef, 0xbb, 0xbf];
        script_bytes.extend_from_slice(include_bytes!("../resources/export_weekly.ps1"));
        fs::write(&script_path, script_bytes).unwrap();

        let harness_path = dir.join("harness.ps1");
        let harness = format!(
            r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
. '{}' -SnapshotPath 'noop' -TemplatePath 'noop' -OutputPath 'noop'

$checks = @(
    ((Pick-Bilingual 'Troquelado | Stamping' 'es') -eq 'Troquelado'),
    ((Pick-Bilingual 'Troquelado | Stamping' 'en') -eq 'Stamping'),
    ((Pick-Bilingual 'Solo Español' 'en') -eq 'Solo Español'),
    ((Pick-Bilingual 'Solo Español |   ' 'en') -eq 'Solo Español'),
    ((Translate-WorkStatus 'Not Started' 'es') -eq 'Sin iniciar'),
    ((Translate-WorkStatus 'In Progress' 'es') -eq 'En curso'),
    ((Translate-WorkStatus 'At Risk' 'es') -eq 'En riesgo'),
    ((Translate-WorkStatus 'Completed' 'es') -eq 'Completado'),
    ((Translate-WorkStatus 'On Hold' 'es') -eq 'En pausa'),
    ((Translate-WorkStatus 'Pending review' 'es') -eq 'Pendiente de revisión'),
    ((Translate-WorkStatus 'In Progress' 'en') -eq 'In Progress'),
    ((Translate-IncidentStatus 'Open' 'es') -eq 'Abierta'),
    ((Translate-IncidentStatus 'In Progress' 'es') -eq 'En atención'),
    ((Translate-IncidentStatus 'Contained' 'es') -eq 'Contenida'),
    ((Translate-IncidentStatus 'Resolved' 'es') -eq 'Resuelta'),
    ((Translate-IncidentStatus 'Open' 'en') -eq 'Open')
)
if ($checks -contains $false) {{ throw "Check failed: $($checks -join ',')" }}

$taskResults = [pscustomobject]@{{
    entry = [pscustomobject]@{{
        activity = [pscustomobject]@{{ milestone_gate = 50; supervisor_approved = $false; hours_spent = 3.5 }}
        decision = $null
    }}
}}
$remEs = Format-TaskRemarks $taskResults $true 'es'
$remEn = Format-TaskRemarks $taskResults $true 'en'
if ($remEs -ne '3.5 h invertidas. Avance de ejecución; la aceptación se controla por entregable.') {{ throw "Unexpected ES remark: $remEs" }}
if ($remEn -ne '3.5 h invested. Execution progress; acceptance is tracked by deliverable.') {{ throw "Unexpected EN remark: $remEn" }}

$taskRejected = [pscustomobject]@{{
    entry = [pscustomobject]@{{
        activity = [pscustomobject]@{{ milestone_gate = 100; supervisor_approved = $false; hours_spent = $null }}
        decision = [pscustomobject]@{{ accepted = $false; comment = 'Falta plano | Missing drawing' }}
    }}
}}
if ((Format-TaskRemarks $taskRejected $false 'es') -ne 'Falta plano') {{ throw 'Failed ES rejected remark' }}
if ((Format-TaskRemarks $taskRejected $false 'en') -ne 'Missing drawing') {{ throw 'Failed EN rejected remark' }}

$specs = Get-SheetSpecs
if ($specs.Count -ne 2 -or $specs[0].SheetName -ne 'Reporte Semanal (ES)' -or $specs[1].SheetName -ne 'Weekly Report (EN)') {{
    throw 'Invalid sheet specs'
}}
Write-Output 'HARNESS_OK'
"#,
            script_path.display()
        );
        let mut harness_bytes = vec![0xef, 0xbb, 0xbf];
        harness_bytes.extend_from_slice(harness.as_bytes());
        fs::write(&harness_path, harness_bytes).unwrap();

        let output = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(&harness_path)
            .output()
            .unwrap();
        let _ = fs::remove_dir_all(&dir);
        assert!(
            output.status.success(),
            "PowerShell harness failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "HARNESS_OK");
    }
}
