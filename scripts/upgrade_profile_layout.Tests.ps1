$ErrorActionPreference = 'Stop'
$fixtureParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\src-tauri\target'))
$fixture = Join-Path $fixtureParent ('profile-layout-test-' + [Guid]::NewGuid().ToString('N'))
$root = Join-Path $fixture 'shared'
$space = Join-Path $root 'easy-fab'
$profiles = Join-Path $space 'data\engineers'
New-Item -ItemType Directory -Path $profiles -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $space 'backups') | Out-Null
$encoding = [Text.UTF8Encoding]::new($false)
function Write-Json([string]$Path, [object]$Value) { [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 10), $encoding) }
function Check([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$reference = Join-Path $fixture 'installation.json'
Write-Json $reference @{version=1;workspace_root=$root;workspace_id='00000000000000000000000000000001'}
$manifestPath = Join-Path $space 'workspace.json'
Write-Json $manifestPath @{version=1;id='00000000000000000000000000000001'}
$teamPath = Join-Path $space 'data\team.json'
Write-Json $teamPath @{version=1;members=@(@{id='admin'},@{id='engineer'},@{id='pending'})}
foreach ($id in @('admin','engineer')) {
    Write-Json (Join-Path $profiles ($id + '.json')) @{engineer_id=$id;credential=@{revision='synthetic';password_hash='synthetic';signature='synthetic'};subactivities=@(@{id='historical'})}
}
$before = @{}
foreach ($id in @('admin','engineer')) { $before[$id] = (Get-FileHash -LiteralPath (Join-Path $profiles ($id + '.json'))).Hash }
$teamHash = (Get-FileHash -LiteralPath $teamPath).Hash
$script = Join-Path $PSScriptRoot 'upgrade_profile_layout.ps1'
try {
    & $script -InstallationFile $reference
    $backup = @(Get-ChildItem -LiteralPath (Join-Path $space 'backups'))[0].FullName
    foreach ($id in @('admin','engineer')) {
        Check ((Get-FileHash -LiteralPath (Join-Path $profiles ($id + '\profile.json'))).Hash -eq $before[$id]) 'Credenciales/historial cambiaron.'
        Check (-not (Test-Path -LiteralPath (Join-Path $profiles ($id + '.json')))) 'Quedo perfil legacy activo.'
        Check (Test-Path -LiteralPath (Join-Path $profiles ($id + '\evidence'))) 'Falta evidence.'
    }
    Check (-not (Test-Path -LiteralPath (Join-Path $profiles 'pending'))) 'Invento perfil sin credencial definitiva.'
    Check ((Get-FileHash -LiteralPath $teamPath).Hash -eq $teamHash) 'Cambio team.'
    & $script -InstallationFile $reference
    Check (@(Get-ChildItem -LiteralPath (Join-Path $space 'backups')).Count -eq 1) 'Upgrade repetido no es idempotente.'
    $schema = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\contracts\v1\profile_upgrade.schema.json') -Raw | ConvertFrom-Json
    $record = Get-Content -LiteralPath (Join-Path $backup 'record.json') -Raw | ConvertFrom-Json
    Check ((@($record.PSObject.Properties.Name | Sort-Object) -join ',') -eq (@($schema.required | Sort-Object) -join ',')) 'Contrato de inventario distinto.'
    $changedProfile = Join-Path $profiles 'engineer\profile.json'
    $originalBytes = [IO.File]::ReadAllBytes($changedProfile)
    [IO.File]::AppendAllText($changedProfile, ' ', $encoding)
    $rejected = $false
    try { & $script -InstallationFile $reference -Mode Rollback -Backup $backup } catch { $rejected=$true }
    Check $rejected 'Rollback perderia cambio de perfil o contrasena.'
    [IO.File]::WriteAllBytes($changedProfile, $originalBytes)
    # Rechazar rollback con nueva evidencia sin tocar la version activa.
    $newFile = Join-Path $profiles 'engineer\evidence\new.pdf'
    [IO.File]::WriteAllText($newFile, 'synthetic-new-data', $encoding)
    [IO.File]::SetAttributes($newFile, [IO.FileAttributes]::Hidden)
    $rejected = $false
    try { & $script -InstallationFile $reference -Mode Rollback -Backup $backup } catch { $rejected=$true }
    Check $rejected 'Rollback perderia evidencia nueva.'
    Remove-Item -LiteralPath $newFile -Force
    & $script -InstallationFile $reference -Mode Rollback -Backup $backup
    & $script -InstallationFile $reference -Mode Rollback -Backup $backup
    foreach ($id in @('admin','engineer')) { Check ((Get-FileHash -LiteralPath (Join-Path $profiles ($id + '.json'))).Hash -eq $before[$id]) 'Rollback altero perfil.' }
    # Interrupcion durante copia: mantenimiento bloquea; rollback restaura una sola autoridad.
    & $script -InstallationFile $reference
    $latest = Get-ChildItem -LiteralPath (Join-Path $space 'backups') | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $manifest.maintenance = $true; $manifest.profile_layout_version = 1
    Write-Json $manifestPath $manifest
    $rejected=$false
    try { & $script -InstallationFile $reference } catch { $rejected=$true }
    Check $rejected 'Reanudo implicitamente un cambio incompleto.'
    & $script -InstallationFile $reference -Mode Rollback -Backup $latest.FullName
    Write-Output 'PASS: upgrade, rollback, reintentos, corte interrumpido y datos nuevos protegidos.'
} finally {
    $resolved = [IO.Path]::GetFullPath($fixture)
    if ($resolved.StartsWith($fixtureParent + '\', [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved).StartsWith('profile-layout-test-')) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
