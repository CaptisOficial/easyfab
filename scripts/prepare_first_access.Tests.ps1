$ErrorActionPreference = 'Stop'
$fixtureParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\src-tauri\target'))
$fixturePath = Join-Path $fixtureParent ('easyfab-first-access-' + [Guid]::NewGuid().ToString('N'))
$sharedPath = Join-Path $fixturePath 'shared'
$spacePath = Join-Path $sharedPath 'easy-fab'
$localPath = Join-Path $fixturePath 'local'
foreach ($folder in @('data\engineers', 'software', 'backups')) {
    New-Item -ItemType Directory -Path (Join-Path $spacePath $folder) -Force | Out-Null
}
New-Item -ItemType Directory -Path $localPath | Out-Null
$encoding = [Text.UTF8Encoding]::new($false)
function Write-Fixture([string]$Path, [object]$Value) {
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 10), $encoding)
}
$referenceFile = Join-Path $localPath 'installation.json'
Write-Fixture $referenceFile @{version=1;workspace_root=$sharedPath;workspace_id='synthetic-space'}
Write-Fixture (Join-Path $spacePath 'workspace.json') @{version=1;id='synthetic-space'}
Write-Fixture (Join-Path $spacePath 'data\team.json') @{version=1;members=@(@{id='synthetic'})}
Write-Fixture (Join-Path $spacePath 'data\engineers\synthetic.json') @{engineer_id='synthetic'}
[IO.File]::WriteAllText((Join-Path $spacePath 'data\projects.json'), 'synthetic-projects', $encoding)
[IO.File]::WriteAllText((Join-Path $localPath 'master.key'), 'synthetic-key', $encoding)
$portableFile = Join-Path $fixturePath 'pilot.exe'
[IO.File]::WriteAllText($portableFile, 'synthetic-binary', $encoding)
$beforeReference = (Get-FileHash -LiteralPath $referenceFile).Hash
try {
    & (Join-Path $PSScriptRoot 'prepare_first_access.ps1') -InstallationFile $referenceFile -Portable $portableFile -ResetTestUsers
    $after = Get-Content -LiteralPath (Join-Path $spacePath 'data\team.json') -Raw | ConvertFrom-Json
    if (@($after.members).Count -ne 0) { throw 'Debe quedar sin usuarios.' }
    if (@(Get-ChildItem -LiteralPath (Join-Path $spacePath 'data\engineers')).Count -ne 0) { throw 'Perfil anterior sigue activo.' }
    if ((Get-FileHash -LiteralPath $referenceFile).Hash -ne $beforeReference) { throw 'Cambió referencia local.' }
    if ((Get-Content -LiteralPath (Join-Path $localPath 'master.key') -Raw) -ne 'synthetic-key') { throw 'Cambió llave.' }
    if ((Get-Content -LiteralPath (Join-Path $spacePath 'data\projects.json') -Raw) -ne 'synthetic-projects') { throw 'Cambió proyectos.' }
    $backup = @(Get-ChildItem -LiteralPath (Join-Path $spacePath 'backups'))
    if ($backup.Count -ne 1 -or -not (Test-Path -LiteralPath (Join-Path $backup[0].FullName 'data\engineers\synthetic.json'))) { throw 'Falta respaldo.' }
    Write-Fixture (Join-Path $spacePath 'workspace.json') @{version=1;id='other-space'}
    $rejected = $false
    try { & (Join-Path $PSScriptRoot 'prepare_first_access.ps1') -InstallationFile $referenceFile -Portable $portableFile -ResetTestUsers }
    catch { $rejected = $true }
    if (-not $rejected) { throw 'Debe rechazar otro espacio.' }
    if (@(Get-ChildItem -LiteralPath (Join-Path $spacePath 'backups')).Count -ne 1) { throw 'Escribió antes de validar identidad.' }
    Write-Output 'PASS: preparación aislada, respaldo, preservación local e identidad.'
} finally {
    $resolvedFixture = [IO.Path]::GetFullPath($fixturePath)
    $expectedParent = $fixtureParent.TrimEnd('\') + '\'
    if ($resolvedFixture.StartsWith($expectedParent, [StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedFixture).StartsWith('easyfab-first-access-')) {
        Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
    }
}
