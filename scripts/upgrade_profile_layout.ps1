<# Cambio explícito de perfiles. Cerrar EasyFAB en TODOS los equipos antes de usar. #>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$InstallationFile,
    [ValidateSet('Upgrade','Rollback')][string]$Mode = 'Upgrade',
    [string]$Backup
)
$ErrorActionPreference = 'Stop'
$reference = Get-Content -LiteralPath $InstallationFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ($reference.version -ne 1 -or $reference.workspace_id -cnotmatch '^[0-9a-f]{32}$') { throw 'Referencia incompatible.' }
$root = (Resolve-Path -LiteralPath $reference.workspace_root).Path
$space = [IO.Path]::GetFullPath((Join-Path $root 'easy-fab'))
$targetExe = Join-Path $space 'software\easyfab.exe'
if (Get-Process easyfab -ErrorAction SilentlyContinue | Where-Object { -not $_.Path -or $_.Path -ieq $targetExe }) {
    throw 'Cierra EasyFAB antes del mantenimiento de este espacio.'
}
$manifestPath = Join-Path $space 'workspace.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.version -ne 1 -or $manifest.id -cne $reference.workspace_id) { throw 'Identidad incompatible.' }
$profiles = [IO.Path]::GetFullPath((Join-Path $space 'data\engineers'))
if ((Get-Item -LiteralPath $profiles).LinkType) { throw 'La carpeta de perfiles no debe ser un enlace.' }
$teamPath = Join-Path $space 'data\team.json'
$layout = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\contracts\v1\workspace.layout.json') -Raw | ConvertFrom-Json
if ($layout.profiles -ne 'engineers' -or $layout.profile -ne 'profile.json' -or $layout.evidence -ne 'evidence') { throw 'Layout de herramienta incompatible.' }
$encoding = [Text.UTF8Encoding]::new($false)
function Hash([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
function Write-Manifest([object]$Value) {
    $staged = Join-Path $space ('workspace-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    [IO.File]::WriteAllText($staged, ($Value | ConvertTo-Json -Depth 10), $encoding)
    [IO.File]::Replace($staged, $manifestPath, (Join-Path $Backup ('manifest-' + [Guid]::NewGuid().ToString('N') + '.json')))
}
function Safe-Path([string]$Relative) {
    $target = [IO.Path]::GetFullPath((Join-Path $profiles $Relative))
    if (-not $target.StartsWith($profiles + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta fuera de perfiles.' }
    $target
}
if ($Mode -eq 'Upgrade') {
    if ($manifest.maintenance) { throw 'Cambio interrumpido: restaurar con -Mode Rollback -Backup <respaldo>.' }
    if ($manifest.profile_layout_version -eq 2) {
        if (@(Get-ChildItem -LiteralPath $profiles -File -Force).Count) { throw 'Hay perfiles legacy inesperados.' }
        Write-Output 'Layout 2 ya activo; no se modificaron datos.'
        return
    }
    if ($manifest.profile_layout_version -and $manifest.profile_layout_version -ne 1) { throw 'Version incompatible.' }
    if (@(Get-ChildItem -LiteralPath $profiles -Directory -Force).Count) { throw 'Existen carpetas personales inesperadas; revisar antes de cambiar.' }
    $team = Get-Content -LiteralPath $teamPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $inventory = @()
    foreach ($file in @(Get-ChildItem -LiteralPath $profiles -File -Force)) {
        if ($file.LinkType) { throw 'El perfil no debe ser un enlace.' }
        $id = [IO.Path]::GetFileNameWithoutExtension($file.Name)
        if ($file.Extension -ne '.json' -or $id.Length -gt 64 -or $id -notmatch '^[A-Za-z0-9_.-]+$' -or $id.Contains('..')) { throw 'Archivo no reconocido en perfiles.' }
        $member = @($team.members | Where-Object { $_.id -ceq $id })
        $profile = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($member.Count -ne 1 -or $profile.engineer_id -cne $id) { throw 'Propietario de perfil inconsistente.' }
        $inventory += @{id=$id; hash=(Hash $file.FullName)}
    }
    $Backup = Join-Path $space ('backups\profile-layout-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $Backup | Out-Null
    Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $Backup 'workspace.json')
    Copy-Item -LiteralPath $profiles -Destination (Join-Path $Backup 'engineers') -Recurse
    foreach ($item in $inventory) {
        if ((Hash (Join-Path $Backup ('engineers\' + $item.id + '.json'))) -ne $item.hash) { throw 'Respaldo incompleto; no iniciar mantenimiento.' }
    }
    $record = @{version=1; workspace_id=$manifest.id; team_hash=(Hash $teamPath); profiles=@($inventory)}
    [IO.File]::WriteAllText((Join-Path $Backup 'record.json'), ($record | ConvertTo-Json -Depth 10), $encoding)
    Write-Output "Respaldo de cambio: $Backup"
    $manifest | Add-Member -NotePropertyName maintenance -NotePropertyValue $true -Force
    Write-Manifest $manifest
    foreach ($item in $inventory) {
        $source = Safe-Path ($item.id + '.json')
        if ((Hash $source) -ne $item.hash) { throw 'Perfil cambio durante mantenimiento.' }
        $folder = Safe-Path $item.id
        New-Item -ItemType Directory -Path (Join-Path $folder 'evidence') | Out-Null
        $target = Join-Path $folder 'profile.json'
        Copy-Item -LiteralPath $source -Destination $target
        if ((Hash $target) -ne $item.hash) { throw 'Copia no coincide.' }
    }
    if ((Hash $teamPath) -ne $record.team_hash) { throw 'Directorio cambio durante mantenimiento.' }
    foreach ($item in $inventory) { Remove-Item -LiteralPath (Safe-Path ($item.id + '.json')) }
    $manifest | Add-Member -NotePropertyName profile_layout_version -NotePropertyValue 2 -Force
    $manifest.maintenance = $false
    Write-Manifest $manifest
    Write-Output 'Layout 2 activo. Credenciales e historial conservados byte por byte.'
} else {
    if (-not $Backup) { throw 'Indica -Backup para restaurar.' }
    $Backup = [IO.Path]::GetFullPath($Backup)
    if (-not $Backup.StartsWith((Join-Path $space 'backups') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Respaldo fuera del espacio.' }
    $record = Get-Content -LiteralPath (Join-Path $Backup 'record.json') -Raw | ConvertFrom-Json
    if ($record.version -ne 1 -or $record.workspace_id -cne $manifest.id -or (Hash $teamPath) -ne $record.team_hash) { throw 'Respaldo incompatible o directorio modificado; no restaurar datos antiguos.' }
    $originalManifest = Get-Content -LiteralPath (Join-Path $Backup 'workspace.json') -Raw | ConvertFrom-Json
    if ($originalManifest.id -cne $reference.workspace_id -or $originalManifest.version -ne 1 -or $originalManifest.profile_layout_version -eq 2 -or $originalManifest.maintenance) { throw 'Manifiesto original incompatible.' }
    $allowed = @()
    foreach ($item in $record.profiles) {
        if ($item.id.Length -gt 64 -or $item.id -notmatch '^[A-Za-z0-9_.-]+$' -or $item.id.Contains('..')) { throw 'Inventario invalido.' }
        $allowed += $item.id + '.json'; $allowed += $item.id + '\profile.json'
        $original = Join-Path $Backup ('engineers\' + $item.id + '.json')
        if ((Hash $original) -ne $item.hash) { throw 'Respaldo alterado.' }
        foreach ($relative in @(($item.id + '.json'), ($item.id + '\profile.json'))) {
            $path = Safe-Path $relative
            if ((Test-Path -LiteralPath $path) -and (Hash $path) -ne $item.hash) { throw 'Perfil modificado; requiere recuperacion sin perder cambios.' }
        }
    }
    foreach ($file in @(Get-ChildItem -LiteralPath $profiles -File -Recurse -Force)) {
        $relative = $file.FullName.Substring($profiles.Length + 1)
        if ($allowed -cnotcontains $relative) { throw 'Hay archivos nuevos; rollback automatico rechazado.' }
    }
    $manifest | Add-Member -NotePropertyName maintenance -NotePropertyValue $true -Force
    Write-Manifest $manifest
    foreach ($item in $record.profiles) {
        Copy-Item -LiteralPath (Join-Path $Backup ('engineers\' + $item.id + '.json')) -Destination (Safe-Path ($item.id + '.json')) -Force
        $current = Safe-Path ($item.id + '\profile.json')
        if (Test-Path -LiteralPath $current) { Remove-Item -LiteralPath $current }
        foreach ($relative in @(($item.id + '\evidence'), $item.id)) {
            $folder = Safe-Path $relative
            if ((Test-Path -LiteralPath $folder) -and @(Get-ChildItem -LiteralPath $folder -Force).Count -eq 0) { Remove-Item -LiteralPath $folder }
        }
    }
    Write-Manifest $originalManifest
    Write-Output 'Rollback completado. Layout original restaurado.'
}
