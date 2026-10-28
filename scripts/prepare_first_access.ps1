<# Preparación manual del piloto: solo ejecutar sobre datos de prueba autorizados. #>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$InstallationFile,
    [Parameter(Mandatory = $true)][string]$Portable,
    [Parameter(Mandatory = $true)][switch]$ResetTestUsers
)
$ErrorActionPreference = 'Stop'
if (-not $ResetTestUsers) { throw 'Se requiere -ResetTestUsers explícito.' }
if (Get-Process easyfab -ErrorAction SilentlyContinue) { throw 'Cierra EasyFAB antes de preparar el piloto.' }
$reference = Get-Content -LiteralPath $InstallationFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ($reference.version -ne 1) { throw 'Referencia de instalación incompatible.' }
$sharedRoot = (Resolve-Path -LiteralPath $reference.workspace_root).Path
$spacePath = [IO.Path]::GetFullPath((Join-Path $sharedRoot 'easy-fab'))
$manifest = Get-Content -LiteralPath (Join-Path $spacePath 'workspace.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.version -ne 1 -or $manifest.id -cne $reference.workspace_id) { throw 'La identidad del espacio no coincide.' }
$sourceExe = (Resolve-Path -LiteralPath $Portable).Path
if ([IO.Path]::GetExtension($sourceExe) -ne '.exe') { throw 'Indica el portable compilado.' }
$dataPath = [IO.Path]::GetFullPath((Join-Path $spacePath 'data'))
$profilesPath = [IO.Path]::GetFullPath((Join-Path $dataPath 'engineers'))
$targetExe = [IO.Path]::GetFullPath((Join-Path $spacePath 'software\easyfab.exe'))
$backupPath = [IO.Path]::GetFullPath((Join-Path $spacePath ('backups\first-access-' + [Guid]::NewGuid().ToString('N'))))
foreach ($targetPath in @($dataPath, $profilesPath, $targetExe, $backupPath)) {
    if (-not $targetPath.StartsWith($spacePath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Destino fuera del espacio validado.'
    }
}
$teamPath = Join-Path $dataPath 'team.json'
$directory = Get-Content -LiteralPath $teamPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($directory.version -ne 1) { throw 'Directorio incompatible.' }
New-Item -ItemType Directory -Path $backupPath | Out-Null
Copy-Item -LiteralPath $dataPath -Destination (Join-Path $backupPath 'data') -Recurse
if (Test-Path -LiteralPath $targetExe) { Copy-Item -LiteralPath $targetExe -Destination (Join-Path $backupPath 'easyfab.exe') }
# Retirar las credenciales personales únicamente después de respaldar. Ninguna llave local se copia.
if (Test-Path -LiteralPath $profilesPath) {
    Move-Item -LiteralPath $profilesPath -Destination (Join-Path $backupPath 'retired-engineers')
}
New-Item -ItemType Directory -Path $profilesPath | Out-Null
$emptyTeam = @{ version = 1; updated_at = [DateTime]::UtcNow.ToString('o'); members = @() } | ConvertTo-Json
$stagedTeam = Join-Path $dataPath ('team-' + [Guid]::NewGuid().ToString('N') + '.tmp')
[IO.File]::WriteAllText($stagedTeam, $emptyTeam, [Text.UTF8Encoding]::new($false))
[IO.File]::Replace($stagedTeam, $teamPath, (Join-Path $backupPath 'retired-team.json'))
Copy-Item -LiteralPath $sourceExe -Destination $targetExe -Force
if ((Get-FileHash -LiteralPath $sourceExe).Hash -ne (Get-FileHash -LiteralPath $targetExe).Hash) { throw 'Portable publicado no coincide.' }
$after = Get-Content -LiteralPath $teamPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (@($after.members).Count -ne 0) { throw 'El directorio no quedó vacío.' }
Write-Output "Piloto listo para crear Admin. Portable: $targetExe"
Write-Output "Respaldo de prueba: $backupPath"
