[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cargo = Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe'
$previousConfig = $env:TAURI_CONFIG
Push-Location $root
try {
    & node node_modules/vite/bin/vite.js build --config qa/vite.config.ts
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación de la interfaz de QA.' }
    # This process-only merge selects embedded QA assets; no localhost server required.
    $env:TAURI_CONFIG = Get-Content -LiteralPath src-tauri/tauri.pilot.conf.json -Raw
    & $cargo build --manifest-path src-tauri/Cargo.toml --example results_pilot --features tauri/custom-protocol
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación nativa de QA.' }
    Write-Host 'PASS: piloto nativo compilado en src-tauri/target/debug/examples/results_pilot.exe. Datos exclusivamente en target/results-pilot-<id>.'
} finally {
    $env:TAURI_CONFIG = $previousConfig
    Pop-Location
}
