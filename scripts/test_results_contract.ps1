#requires -Version 7.0
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$schemaPath = Join-Path $PSScriptRoot '../contracts/v1/project_results.schema.json'
$fixturePath = Join-Path $PSScriptRoot '../contracts/fixtures/project_results.valid.json'
$definition = Get-Content -LiteralPath $schemaPath -Raw | ConvertFrom-Json -AsHashtable
$fixture = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json -AsHashtable
$cases = 0
function Copy-Document($document) { ConvertFrom-Json -AsHashtable -InputObject (ConvertTo-Json -InputObject $document -Depth 30 -Compress) }
function Assert-Document($document, [bool]$expected, [string]$name, [string]$def = '') {
    $json = ConvertTo-Json -InputObject $document -Depth 30 -Compress
    if ($def) {
        $wrapper = @{ '$schema' = $definition.'$schema'; '$defs' = $definition.'$defs'; '$ref' = "#/`$defs/$def" }
        $actual = Test-Json -Json $json -Schema (ConvertTo-Json $wrapper -Depth 30) -ErrorAction SilentlyContinue
    } else {
        $actual = Test-Json -Json $json -SchemaFile $schemaPath -ErrorAction SilentlyContinue
    }
    if ($actual -ne $expected) { throw "Results contract: $name expected $expected, got $actual" }
    $script:cases++
}
Assert-Document $fixture $true 'valid two-engineer plan'
foreach ($field in $definition.required) {
    $bad = Copy-Document $fixture; $bad.Remove($field)
    Assert-Document $bad $false "missing $field"
}
foreach ($field in $definition.'$defs'.commitment.required) {
    $bad = Copy-Document $fixture; $bad.commitment.Remove($field)
    Assert-Document $bad $false "missing commitment $field"
}
foreach ($field in $definition.'$defs'.activity.required) {
    $bad = Copy-Document $fixture; $bad.activities[0].Remove($field)
    Assert-Document $bad $false "missing activity $field"
}
foreach ($change in @(
    @{ field='version'; value=2 },
    @{ field='project_id'; value='../escape' }
)) {
    $bad = Copy-Document $fixture; $bad[$change.field] = $change.value
    Assert-Document $bad $false "invalid root $($change.field)"
}
foreach ($change in @(
    @{ field='status'; value='approved' },
    @{ field='progress'; value=23 },
    @{ field='hours_spent'; value=-1 },
    @{ field='dependency_ids'; value=@('task_2','task_2') },
    @{ field='supervisor_approved'; value=$true }
)) {
    $bad = Copy-Document $fixture; $bad.activities[0][$change.field] = $change.value
    Assert-Document $bad $false "invalid activity $($change.field)"
}
$bad = Copy-Document $fixture; $bad.commitment.engineer_ids = @('engineer','engineer')
Assert-Document $bad $false 'duplicate engineer assignment'
$bad = Copy-Document $fixture; $bad.commitment.deliverables[0].criteria = @()
Assert-Document $bad $false 'missing acceptance criteria'
$bad = Copy-Document $fixture; $bad.commitment.final_outcome = '   '
Assert-Document $bad $false 'blank final outcome'
foreach ($hours in @(0, 2.5, $null)) {
    $valid = Copy-Document $fixture; $valid.activities[0].hours_spent = $hours
    Assert-Document $valid $true 'known or unknown hours'
}
$submission = @{ id=('b' * 64); deliverable_id='delivery_1'; commitment_revision=('a' * 64); criteria=@(@{ criterion_id='capacity'; fulfilled=$true; evidence_ids=@('c' * 64) }) }
Assert-Document $submission $true 'valid submission' 'submission'
$bad = Copy-Document $submission; $bad.criteria[0].fulfilled = $false
Assert-Document $bad $false 'unfulfilled criterion' 'submission'
$bad = Copy-Document $submission; $bad.criteria[0].evidence_ids = @('bad-hash')
Assert-Document $bad $false 'invalid evidence reference' 'submission'
$blocker = @{ id='blocker_1'; activity_id='task_1'; reason='Awaiting access'; help_needed='Coordinate access'; reported_at='2026-10-29T10:00:00-06:00'; first_attention_at=$null; resolved_at=$null; resolution_note=$null }
Assert-Document $blocker $true 'open blocker' 'blocker'
$bad = Copy-Document $blocker; $bad.help_needed = ' '
Assert-Document $bad $false 'blank help request' 'blocker'
foreach ($status in @('preparing','submitted','returned','accepted','withdrawn')) {
    Assert-Document $status $true "review $status" 'review_status'
}
Assert-Document 'completed' $false 'activity status cannot be acceptance status' 'review_status'
$decision = @{ id=('d' * 64); project_id='project_1'; deliverable_id='delivery_1'; submission_id=('b' * 64); commitment_revision=('a' * 64); accepted=$true; comment=''; supervisor_id='supervisor'; recorded_at='2026-10-29T12:00:00-06:00'; signature=('e' * 64) }
Assert-Document $decision $true 'decision envelope (signature shape does not prove authenticity)' 'decision'
$bad = Copy-Document $decision; $bad.signature = 'not-a-signature'
Assert-Document $bad $false 'invalid decision signature shape' 'decision'
# Regression: the active closed save_input must accept the hours already sent by React/Rust.
$active = Get-Content (Join-Path $PSScriptRoot '../contracts/v1/activity_operations.schema.json') -Raw | ConvertFrom-Json -AsHashtable
$activeSchema = @{ '$schema'=$active.'$schema'; '$defs'=$active.'$defs'; '$ref'='#/$defs/save_input' } | ConvertTo-Json -Depth 30
$inputFixture = @{ id=$null; expected_revision=$null; project_id='project_1'; wbs='FAB-1'; task_title='Synthetic'; start_date='2026-10-29'; due_date='2026-11-30'; milestone_gate=25; at_risk=$false; hours_spent=2.5 }
foreach ($hours in @(0, 2.5, $null, -1)) {
    $inputFixture.hours_spent = $hours
    $actual = Test-Json -Json (ConvertTo-Json $inputFixture) -Schema $activeSchema -ErrorAction SilentlyContinue
    if ($actual -ne ($null -eq $hours -or $hours -ge 0)) { throw 'Active hours contract regression' }
    $cases++
}
$inputFixture.hours_spent = 0; $inputFixture.wbs = ''
if (-not (Test-Json -Json (ConvertTo-Json $inputFixture) -Schema $activeSchema)) { throw 'Rust-generated WBS contract regression' }
$cases++
& node (Join-Path $PSScriptRoot 'generate_results_types.mjs') --check
if ($LASTEXITCODE -ne 0) { throw 'Results bindings drift' }
& node (Join-Path $PSScriptRoot 'generate_results_types.mjs') --operations --check
if ($LASTEXITCODE -ne 0) { throw 'Results operation bindings drift' }
Write-Host "PASS: $cases result-planning schema cases. Cross-field rules and permissions are verified in Rust; no storage migration performed."
