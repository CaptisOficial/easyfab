#requires -Version 7.0
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$contract = Join-Path $PSScriptRoot '../contracts/v1/project_results_operations.schema.json'
# Resolve only local canonical references, then validate with Test-Json offline.
function Expand-Node($node, [string]$source) {
    if ($node -is [System.Collections.IDictionary]) {
        if ($node.Contains('$ref')) {
            $parts = $node.'$ref'.Split('#', 2)
            $path = if ($parts[0]) { Join-Path (Split-Path -Parent $source) $parts[0] } else { $source }
            if ($path -match '://') { throw 'Remote schema references are not supported.' }
            $value = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json -AsHashtable
            foreach ($key in $parts[1].TrimStart('/').Split('/')) { $value = $value[$key] }
            return Expand-Node $value $path
        }
        $result = @{}
        foreach ($key in $node.Keys) { $result[$key] = Expand-Node $node[$key] $source }
        return $result
    }
    if ($node -is [array]) {
        $result = @($node | ForEach-Object { Expand-Node $_ $source })
        return ,$result
    }
    return $node
}
$definition = Get-Content -LiteralPath $contract -Raw | ConvertFrom-Json -AsHashtable
$schemas = @{}
$cases = 0
function Assert-Contract($value, [string]$name, [bool]$expected, [string]$label) {
    if (-not $schemas.ContainsKey($name)) {
        $schemas[$name] = Expand-Node $definition.'$defs'[$name] $contract | ConvertTo-Json -Depth 100 -Compress
    }
    $valid = Test-Json -Json (ConvertTo-Json -InputObject $value -Depth 60 -Compress) -Schema $schemas[$name] -ErrorAction SilentlyContinue
    if ($valid -ne $expected) { throw "Operation $name/$label expected $expected, got $valid" }
    $script:cases++
}
function Copy-Document($value) { ConvertFrom-Json -AsHashtable -InputObject (ConvertTo-Json -InputObject $value -Depth 60 -Compress) }
$fixture = Get-Content (Join-Path $PSScriptRoot '../contracts/fixtures/project_results.valid.json') -Raw | ConvertFrom-Json -AsHashtable
$draft = Copy-Document $fixture.commitment; $draft.Remove('revision')
$revision = 'a' * 64
$inputs = @{
    commitment_input = @{ project_id='project_1'; expected_revision=$null; commitment=$draft; change_reason='Compromiso inicial'; legacy_deliverable_id=$null }
    activity_input = @{ project_id='project_1'; expected_revision=$null; activity=$fixture.activities[0] }
    blocker_input = @{ project_id='project_1'; blocker_id=$null; expected_revision=$null; activity_id='task_1'; reason='Sin acceso'; help_needed='Autorizar'; action='report'; comment='' }
    review_input = @{ project_id='project_1'; deliverable_id='delivery_1'; expected_revision=$null; action='submit'; criteria=@(@{ criterion_id='capacity'; fulfilled=$true; evidence_ids=@($revision) }); comment='' }
    closure_input = @{ project_id='project_1'; expected_revision=$null; closed=$true; confirm_final_outcome=$true; comment='Resultado verificado' }
    resolve_input = @{ project_id='project_1'; stream='activity/task_1'; expected_revisions=@($revision, ('b' * 64)); keep_revision=$revision; comment='Integro alternativas' }
    attachment_input = @{ project_id='project_1'; activity_id='task_1'; expected_revision=$revision; name='prueba.pdf'; bytes=@(37,80,68,70,45) }
}
foreach ($name in $inputs.Keys) {
    $value = $inputs[$name]
    Assert-Contract $value $name $true 'valid'
    foreach ($field in $definition.'$defs'[$name].required) {
        $bad = Copy-Document $value; $bad.Remove($field)
        Assert-Contract $bad $name $false "missing $field"
    }
    foreach ($field in @('author_id','workspace_root','role','signature')) {
        $bad = Copy-Document $value; $bad[$field] = 'forbidden'
        Assert-Contract $bad $name $false "caller $field"
    }
}
$bad = Copy-Document $inputs.activity_input; $bad.activity.hours_spent = -1
Assert-Contract $bad 'activity_input' $false 'negative hours'
$bad = Copy-Document $inputs.blocker_input; $bad.action = 'approve'
Assert-Contract $bad 'blocker_input' $false 'invalid blocker action'
$bad = Copy-Document $inputs.review_input; $bad.action = 'complete'
Assert-Contract $bad 'review_input' $false 'completion is not acceptance'
$bad = Copy-Document $inputs.attachment_input; $bad.bytes = @(256)
Assert-Contract $bad 'attachment_input' $false 'invalid byte'
$bad = Copy-Document $inputs.attachment_input; $bad.bytes = @()
Assert-Contract $bad 'attachment_input' $false 'empty attachment'
$contract = Join-Path $PSScriptRoot '../contracts/v1/project_results_storage.schema.json'
$definition = Get-Content -LiteralPath $contract -Raw | ConvertFrom-Json -AsHashtable
$schemas = @{}
$event = @{ version=1; id=$revision; project_id='project_1'; stream='activity/task_1'; parents=@(); author_id='engineer'; author_role='engineer'; recorded_at='2026-10-30T12:00:00-06:00'; action='save_activity'; comment='Avance guardado'; base_commitment=('b' * 64); payload=@{ kind='activity'; value=@{ created_by='engineer'; activity=$fixture.activities[0]; evidence=@() } }; signature=('c' * 64) }
Assert-Contract $event 'event' $true 'valid signed envelope shape (not signature verification)'
foreach ($field in $definition.'$defs'.event.required) {
    $bad = Copy-Document $event; $bad.Remove($field)
    Assert-Contract $bad 'event' $false "missing signed $field"
}
$bad = Copy-Document $event; $bad.parents = @($revision, $revision)
Assert-Contract $bad 'event' $false 'duplicate parents'
$bad = Copy-Document $event; $bad.stream = '../escape'
Assert-Contract $bad 'event' $false 'unsafe stream'
$bad = Copy-Document $event; $bad.author_role = 'admin'
Assert-Contract $bad 'event' $false 'admin cannot author work events'
$manifest = @{ version=1; project_id='project_1'; legacy_sha256=$revision; signature=('d' * 64) }
Assert-Contract $manifest 'manifest' $true 'project storage manifest'
$bad = Copy-Document $manifest; $bad.version = 2
Assert-Contract $bad 'manifest' $false 'unknown project storage version'
$workspaceSchema = Join-Path $PSScriptRoot '../contracts/v1/workspace.schema.json'
foreach ($version in @(1, 2)) {
    $workspace = @{ version=1; id=('a' * 32); profile_layout_version=2; project_results_version=$version }
    $valid = Test-Json -Json (ConvertTo-Json $workspace) -SchemaFile $workspaceSchema -ErrorAction SilentlyContinue
    if ($valid -ne ($version -eq 1)) { throw 'Workspace results format version regression' }
    $cases++
}
Write-Host "PASS: $cases result-operation/storage payload cases using local canonical references. Authorization and persistence are tested in Rust."
