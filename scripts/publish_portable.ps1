<# Publica el último ejecutable portable de release en la carpeta compartida sin tocar datos ni llaves. #>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$InstallationFile = (Join-Path $env:LOCALAPPDATA 'EasyFAB\installation.json'),
    [string]$SharedRoot,
    [string]$Portable,
    [switch]$Build,
    [switch]$SkipDocsAndContracts
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if ([string]::IsNullOrWhiteSpace($Portable)) {
    $Portable = Join-Path $repoRoot 'src-tauri\target\release\easyfab.exe'
}

if ($Build) {
    Push-Location $repoRoot
    try {
        & npm.cmd run tauri -- build
        if ($LASTEXITCODE -ne 0) {
            throw 'Falló la compilación release de EasyFAB (npm run tauri -- build).'
        }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path -LiteralPath $Portable -PathType Leaf)) {
    throw "No se encontró el ejecutable compilado en '$Portable'. Compila primero con 'npm.cmd run tauri -- build' o usa -Build."
}

$sourceExe = (Resolve-Path -LiteralPath $Portable).Path
if ([IO.Path]::GetExtension($sourceExe) -ine '.exe') {
    throw "El archivo origen debe ser un ejecutable (.exe): '$sourceExe'."
}
if ($sourceExe -match '[\\/]debug[\\/]') {
    throw "No se permite publicar un ejecutable de depuración: '$sourceExe'."
}

$layoutPath = Join-Path $repoRoot 'contracts\v1\workspace.layout.json'
$layout = Get-Content -LiteralPath $layoutPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($layout.version -ne 1 -or -not $layout.folder -or -not $layout.executable -or -not $layout.backups) {
    throw 'Layout de espacio incompatible en contracts/v1/workspace.layout.json.'
}

$expectedWorkspaceId = $null
if ($PSBoundParameters.ContainsKey('SharedRoot') -and -not [string]::IsNullOrWhiteSpace($SharedRoot)) {
    if (-not (Test-Path -LiteralPath $SharedRoot -PathType Container)) {
        throw "La raíz compartida indicada no existe: '$SharedRoot'."
    }
    $resolvedRoot = (Resolve-Path -LiteralPath $SharedRoot).Path
} else {
    if (-not (Test-Path -LiteralPath $InstallationFile -PathType Leaf)) {
        throw "No se encontró la referencia de instalación '$InstallationFile'. Indica -InstallationFile o -SharedRoot."
    }
    $reference = Get-Content -LiteralPath $InstallationFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($reference.version -ne 1 -or [string]::IsNullOrWhiteSpace($reference.workspace_root) -or [string]::IsNullOrWhiteSpace($reference.workspace_id)) {
        throw 'Referencia de instalación incompatible.'
    }
    if (-not (Test-Path -LiteralPath $reference.workspace_root -PathType Container)) {
        throw "La raíz compartida configurada no es accesible: '$($reference.workspace_root)'."
    }
    $resolvedRoot = (Resolve-Path -LiteralPath $reference.workspace_root).Path
    $expectedWorkspaceId = [string]$reference.workspace_id
}

$spacePath = [IO.Path]::GetFullPath((Join-Path $resolvedRoot $layout.folder))
if (-not (Test-Path -LiteralPath $spacePath -PathType Container)) {
    throw "No existe la carpeta del espacio '$spacePath'."
}
if ((Get-Item -LiteralPath $spacePath).LinkType) {
    throw 'La carpeta del espacio no debe ser un enlace simbólico.'
}

$manifestPath = Join-Path $spacePath $layout.manifest
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Falta el manifiesto del espacio: '$manifestPath'."
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.version -ne 1 -or [string]::IsNullOrWhiteSpace($manifest.id)) {
    throw 'Manifiesto del espacio inválido o versión incompatible.'
}
if ($expectedWorkspaceId -and $manifest.id -cne $expectedWorkspaceId) {
    throw "La identidad del espacio no coincide (esperado: $expectedWorkspaceId, encontrado: $($manifest.id))."
}
if ($manifest.maintenance -eq $true) {
    throw 'El espacio está marcado en mantenimiento; publicación cancelada.'
}

function Assert-InsideSpace {
    param([string]$CandidatePath)
    $full = [IO.Path]::GetFullPath($CandidatePath)
    $prefix = $spacePath.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Destino fuera del espacio validado: '$full'."
    }
    if ((Test-Path -LiteralPath $full) -and (Get-Item -LiteralPath $full).LinkType) {
        throw "El destino no debe ser un enlace simbólico: '$full'."
    }
    return $full
}

$softwareDir = Assert-InsideSpace (Join-Path $spacePath $layout.software)
$targetExe = Assert-InsideSpace (Join-Path $spacePath $layout.executable)
$backupsRoot = Assert-InsideSpace (Join-Path $spacePath $layout.backups)
$docsArchDir = Assert-InsideSpace (Join-Path $spacePath (Join-Path $layout.docs 'architecture'))
$contractsV1Dir = Assert-InsideSpace (Join-Path $spacePath (Join-Path $layout.contracts 'v1'))

$running = Get-Process easyfab -ErrorAction SilentlyContinue | Where-Object {
    -not $_.Path -or $_.Path -ieq $targetExe
}
if ($running) {
    throw "Cierra EasyFAB antes de publicar el ejecutable en '$targetExe'."
}

$sourceItem = Get-Item -LiteralPath $sourceExe
$sourceHash = (Get-FileHash -LiteralPath $sourceExe -Algorithm SHA256).Hash
$backupFile = $null

if ($PSCmdlet.ShouldProcess($targetExe, "Publicar portable EasyFAB (SHA-256: $sourceHash)")) {
    if (-not (Test-Path -LiteralPath $softwareDir -PathType Container)) {
        New-Item -ItemType Directory -Path $softwareDir -Force | Out-Null
    }

    if (Test-Path -LiteralPath $targetExe -PathType Leaf) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupDir = Assert-InsideSpace (Join-Path $backupsRoot ("portable-publish-$stamp-" + [Guid]::NewGuid().ToString('N').Substring(0, 8)))
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        $backupFile = Join-Path $backupDir ([IO.Path]::GetFileName($targetExe))
        Copy-Item -LiteralPath $targetExe -Destination $backupFile -Force
    }

    $stagedExe = Join-Path $softwareDir ('easyfab-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    try {
        Copy-Item -LiteralPath $sourceExe -Destination $stagedExe -Force
        if ((Get-FileHash -LiteralPath $stagedExe -Algorithm SHA256).Hash -ne $sourceHash) {
            throw 'La copia temporal no coincide con el hash del ejecutable origen.'
        }
        Move-Item -LiteralPath $stagedExe -Destination $targetExe -Force
    } finally {
        if (Test-Path -LiteralPath $stagedExe -PathType Leaf) {
            Remove-Item -LiteralPath $stagedExe -Force -ErrorAction SilentlyContinue
        }
    }

    $publishedHash = (Get-FileHash -LiteralPath $targetExe -Algorithm SHA256).Hash
    if ($publishedHash -ne $sourceHash) {
        throw 'El ejecutable publicado no coincide con el hash del compilado origen.'
    }

    if (-not $SkipDocsAndContracts) {
        New-Item -ItemType Directory -Path $docsArchDir -Force | Out-Null
        New-Item -ItemType Directory -Path $contractsV1Dir -Force | Out-Null
        Copy-Item -Path (Join-Path $repoRoot 'docs\architecture\*.md') -Destination $docsArchDir -Force
        Copy-Item -Path (Join-Path $repoRoot 'contracts\v1\*') -Destination $contractsV1Dir -Force
    }
}

[PSCustomObject]@{
    SourceExe      = $sourceExe
    SourceModified = $sourceItem.LastWriteTime
    TargetExe      = $targetExe
    Sha256         = $sourceHash
    BackupExe      = $backupFile
    DocsSynced     = (-not $SkipDocsAndContracts)
}
