$ErrorActionPreference = 'Stop'

$fixtureParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\src-tauri\target'))
$fixturePath = Join-Path $fixtureParent ('easyfab-publish-test-' + [Guid]::NewGuid().ToString('N'))
$sharedPath = Join-Path $fixturePath 'shared'
$spacePath = Join-Path $sharedPath 'easy-fab'
$localPath = Join-Path $fixturePath 'local'

foreach ($folder in @('data\engineers', 'software', 'backups')) {
    New-Item -ItemType Directory -Path (Join-Path $spacePath $folder) -Force | Out-Null
}
New-Item -ItemType Directory -Path $localPath -Force | Out-Null

$encoding = [Text.UTF8Encoding]::new($false)
function Write-Fixture([string]$Path, [object]$Value) {
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 10), $encoding)
}

$referenceFile = Join-Path $localPath 'installation.json'
Write-Fixture $referenceFile @{
    version        = 1
    workspace_root = $sharedPath
    workspace_id   = '0123456789abcdef0123456789abcdef'
}
Write-Fixture (Join-Path $spacePath 'workspace.json') @{
    version = 1
    id      = '0123456789abcdef0123456789abcdef'
}
[IO.File]::WriteAllText((Join-Path $spacePath 'data\projects.json'), 'synthetic-projects', $encoding)
[IO.File]::WriteAllText((Join-Path $localPath 'master.key'), 'synthetic-key', $encoding)
[IO.File]::WriteAllText((Join-Path $spacePath 'software\easyfab.exe'), 'old-portable-binary', $encoding)

$releaseDir = Join-Path $fixturePath 'release'
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
$portableFile = Join-Path $releaseDir 'easyfab.exe'
[IO.File]::WriteAllText($portableFile, 'new-release-binary-v2', $encoding)

$debugDir = Join-Path $fixturePath 'debug'
New-Item -ItemType Directory -Path $debugDir -Force | Out-Null
$debugFile = Join-Path $debugDir 'easyfab.exe'
[IO.File]::WriteAllText($debugFile, 'debug-binary', $encoding)

$scriptPath = Join-Path $PSScriptRoot 'publish_portable.ps1'

try {
    # 1. Publicación normal con respaldo del binario anterior y preservación de datos/llave
    $result = & $scriptPath -InstallationFile $referenceFile -Portable $portableFile
    $expectedHash = (Get-FileHash -LiteralPath $portableFile -Algorithm SHA256).Hash
    $targetExe = Join-Path $spacePath 'software\easyfab.exe'
    if ((Get-FileHash -LiteralPath $targetExe -Algorithm SHA256).Hash -ne $expectedHash) {
        throw 'El binario publicado no coincide con el origen.'
    }
    if (-not $result.BackupExe -or -not (Test-Path -LiteralPath $result.BackupExe)) {
        throw 'No se creó respaldo del ejecutable anterior.'
    }
    if ((Get-Content -LiteralPath $result.BackupExe -Raw) -ne 'old-portable-binary') {
        throw 'El respaldo no conserva el ejecutable anterior.'
    }
    if ((Get-Content -LiteralPath (Join-Path $spacePath 'data\projects.json') -Raw) -ne 'synthetic-projects') {
        throw 'Se modificaron datos operativos.'
    }
    if ((Get-Content -LiteralPath (Join-Path $localPath 'master.key') -Raw) -ne 'synthetic-key') {
        throw 'Se modificó la llave local.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $spacePath 'docs\architecture\espacio-de-trabajo.md'))) {
        throw 'No se publicaron documentos de arquitectura.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $spacePath 'contracts\v1\workspace.layout.json'))) {
        throw 'No se publicaron contratos v1.'
    }

    # 2. Rechazar ejecutable de depuración
    $debugRejected = $false
    try {
        & $scriptPath -InstallationFile $referenceFile -Portable $debugFile | Out-Null
    } catch {
        $debugRejected = $true
    }
    if (-not $debugRejected) {
        throw 'Debe rechazar ejecutables de depuración.'
    }

    # 3. Rechazar espacio con identidad distinta
    Write-Fixture (Join-Path $spacePath 'workspace.json') @{
        version = 1
        id      = 'fedcba9876543210fedcba9876543210'
    }
    $idRejected = $false
    try {
        & $scriptPath -InstallationFile $referenceFile -Portable $portableFile | Out-Null
    } catch {
        $idRejected = $true
    }
    if (-not $idRejected) {
        throw 'Debe rechazar un espacio con ID distinto.'
    }

    # 4. Verificar que -Portable por defecto se resuelva sin error de $PSScriptRoot vacío en PowerShell 5.1
    Write-Fixture (Join-Path $spacePath 'workspace.json') @{
        version = 1
        id      = '0123456789abcdef0123456789abcdef'
    }
    $whatIfResult = & $scriptPath -InstallationFile $referenceFile -WhatIf
    if ([IO.Path]::GetFileName($whatIfResult.SourceExe) -ne 'easyfab.exe') {
        throw 'No resolvió el ejecutable release por defecto.'
    }

    Write-Output 'PASS: publicación portable aislada, respaldo, documentos/contratos y validaciones de seguridad.'
} finally {
    $resolvedFixture = [IO.Path]::GetFullPath($fixturePath)
    $expectedParent = $fixtureParent.TrimEnd('\') + '\'
    if ($resolvedFixture.StartsWith($expectedParent, [StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedFixture).StartsWith('easyfab-publish-test-')) {
        Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
    }
}
