<#
.SYNOPSIS
    Script de validación Gate 0 (Captis Governance) para EasyFAB.
.DESCRIPTION
    Verifica que:
    1. Existan todos los contratos en contracts/v1/.
    2. El tipado TypeScript compile limpiamente (tsc).
    3. El backend Rust compile sin advertencias críticas (cargo check).
    4. Las suites frontend y Rust aprueben.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Write-Host "=== [EasyFAB Gate 0 Pre-flight Check] ===" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Verificar existencia de contratos canónicos
Write-Host "`n[1/4] Verificando contratos canónicos en contracts/v1/..." -ForegroundColor Yellow
$requiredContracts = @(
    "team.schema.json",
    "projects.schema.json",
    "project_registration.schema.json",
    "engineer_tasks.schema.json",
    "issues.schema.json",
    "auth.schema.json",
    "config_plant.schema.json",
    "workspace.schema.json",
    "workspace.layout.json",
    "installation.schema.json"
    "profile_upgrade.schema.json",
    "user_preferences.schema.json"
)

foreach ($c in $requiredContracts) {
    $path = Join-Path "$projectRoot\contracts\v1" $c
    if (-not (Test-Path $path)) {
        Write-Error "Falta contrato requerido: $c"
    }
    $null = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Host "  ✓ $c" -ForegroundColor Green
}

# 2. Verificar compilación TypeScript
Write-Host "`n[2/4] Verificando tipos TypeScript..." -ForegroundColor Yellow
& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en verificación de tipos TypeScript."
}
Write-Host "  ✓ TypeScript OK" -ForegroundColor Green

# 3. Verificar Rust Backend
Write-Host "`n[3/4] Verificando backend Rust..." -ForegroundColor Yellow
$cargo = "$env:USERPROFILE\.cargo\bin\cargo.exe"
if (Test-Path $cargo) {
    Push-Location "$projectRoot\src-tauri"
    try {
        & $cargo check --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Fallo en cargo check."
        }
        Write-Host "  ✓ Cargo check OK" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
} else {
    Write-Error "Cargo no encontrado en $cargo. Gate 0 requiere verificar Rust."
}

Write-Host "`n[4/4] Ejecutando pruebas frontend y Rust..." -ForegroundColor Yellow
& npm.cmd run test:contracts
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en pruebas de contratos de preferencias."
}
& npm.cmd run test:frontend
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en pruebas frontend."
}
& $cargo test --manifest-path "$projectRoot\src-tauri\Cargo.toml"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en pruebas Rust."
}

& powershell -NoProfile -ExecutionPolicy Bypass -File "$projectRoot\scripts\upgrade_profile_layout.Tests.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en pruebas de cambio de layout."
}
Write-Host "`n=== [GATE 0 APROBADO: Sistema íntegro] ===" -ForegroundColor Green

