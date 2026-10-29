#requires -Version 7.0
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$schema = Join-Path $PSScriptRoot '../contracts/v1/user_preferences.schema.json'
$fixture = @{
    version = 1
    workspace_id = '0123456789abcdef0123456789abcdef'
    user_id = 'Engineer_01'
    theme = 'light'
    ui_scale = 'standard'
}
$cases = 0
function Assert-Document($document, [bool]$expected, [string]$name) {
    $json = ConvertTo-Json -InputObject $document -Depth 10 -Compress
    $actual = Test-Json -Json $json -SchemaFile $schema -ErrorAction SilentlyContinue
    if ($actual -ne $expected) { throw "Preference contract: $name expected $expected, got $actual" }
    $script:cases++
}
foreach ($theme in @('light', 'dark', 'system')) {
    foreach ($scale in @('standard', 'large')) {
        $document = $fixture.Clone(); $document.theme = $theme; $document.ui_scale = $scale
        Assert-Document $document $true "$theme/$scale"
    }
}
foreach ($field in @('version', 'workspace_id', 'user_id', 'theme', 'ui_scale')) {
    $document = $fixture.Clone(); $document.Remove($field)
    Assert-Document $document $false "missing $field"
    $document = $fixture.Clone(); $document[$field] = $null
    Assert-Document $document $false "null $field"
}
foreach ($case in @(
    @('version', 0), @('version', 2), @('version', '1'),
    @('workspace_id', ''), @('workspace_id', '../escape'), @('workspace_id', ('A' * 32)),
    @('workspace_id', ('a' * 31)), @('workspace_id', ('a' * 33)),
    @('user_id', ''), @('user_id', '../admin'), @('user_id', 'a/b'),
    @('user_id', ('a' * 65)), @('user_id', "user`n"),
    @('theme', 'automatic'), @('theme', 1), @('ui_scale', 'compact'), @('ui_scale', 1)
)) {
    $document = $fixture.Clone(); $document[$case[0]] = $case[1]
    Assert-Document $document $false "invalid $($case[0]): $($case[1])"
}
foreach ($id in @('a', ('a' * 64), 'Admin', 'admin', 'CON', 'a-b_2')) {
    $document = $fixture.Clone(); $document.user_id = $id
    Assert-Document $document $true 'valid ID (path encoding required by consumer)'
}
foreach ($field in @('role', 'permissions', 'password', 'master_key', 'workspace_root', 'filters', 'extra')) {
    $document = $fixture.Clone(); $document[$field] = 'forbidden'
    Assert-Document $document $false "extra $field"
}
Assert-Document @() $false 'array root'
Assert-Document 'invalid' $false 'string root'
$definition = Get-Content -Raw -Encoding utf8 $schema | ConvertFrom-Json
foreach ($field in @('theme', 'ui_scale')) {
    if ($definition.properties.$field.default -cne $fixture[$field]) { throw "Unexpected default: $field" }
}
Write-Host "PASS: $cases preference schema cases and presentation defaults. No persistence or IPC exercised."
