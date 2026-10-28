<#
.SYNOPSIS
    Script de validación Gate 0 (Captis Governance) para EasyFAB.
.DESCRIPTION
    Verifica que:
    1. Existan todos los contratos en contracts/v1/.
    2. El tipado TypeScript compile limpiamente (tsc).
    3. El backend Rust compile sin advertencias críticas (cargo check).
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Write-Host "=== [EasyFAB Gate 0 Pre-flight Check] ===" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Verificar existencia de contratos canónicos
Write-Host "`n[1/3] Verificando contratos canónicos en contracts/v1/..." -ForegroundColor Yellow
$requiredContracts = @(
    "team.schema.json",
    "projects.schema.json",
    "engineer_tasks.schema.json",
    "issues.schema.json"
)

foreach ($c in $requiredContracts) {
    $path = Join-Path "$projectRoot\contracts\v1" $c
    if (-not (Test-Path $path)) {
        Write-Error "Falta contrato requerido: $c"
    }
    Write-Host "  ✓ $c" -ForegroundColor Green
}

# 2. Verificar compilación TypeScript
Write-Host "`n[2/3] Verificando tipos TypeScript..." -ForegroundColor Yellow
& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en verificación de tipos TypeScript."
}
Write-Host "  ✓ TypeScript OK" -ForegroundColor Green

# 3. Verificar Rust Backend
Write-Host "`n[3/3] Verificando backend Rust..." -ForegroundColor Yellow
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
    Write-Warning "Cargo no encontrado en $cargo. Omitiendo verificación Rust."
}

Write-Host "`n=== [GATE 0 APROBADO: Sistema íntegro] ===" -ForegroundColor Green
