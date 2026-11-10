param([Parameter(Mandatory=$true)][string]$SnapshotPath,[Parameter(Mandatory=$true)][string]$TemplatePath,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
$snapshot = Get-Content -LiteralPath $SnapshotPath -Raw -Encoding UTF8 | ConvertFrom-Json
$excel = $null; $book = $null
function Write-Text($sheet, [int]$row, [int]$column, $value) {
    $cell = $sheet.Cells.Item($row,$column)
    $cell.NumberFormat = '@'
    $cell.Value2 = [string]$value
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($cell)
}
function Write-Number($sheet,[int]$row,[int]$column,$value) {
    $cell=$sheet.Cells.Item($row,$column)
    if ($null -eq $value -or ($value -is [string] -and $value -eq '')) { $cell.ClearContents() } else { $cell.Value2=[double]$value }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($cell)
}
function Write-Date($sheet,[int]$row,[int]$column,$value) {
    if (-not $value) { Write-Number $sheet $row $column $null; return }
    Write-Number $sheet $row $column ([datetime]::ParseExact($value,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture).ToOADate())
}
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.AskToUpdateLinks = $false
    $excel.AutomationSecurity = 3
    $book = $excel.Workbooks.Open($TemplatePath,0,$true)
    $master=$book.Worksheets.Item('Master Gantt'); $tasks=$book.Worksheets.Item('Subactivity Details'); $issues=$book.Worksheets.Item('Issues & Risks')
    $projects=@($snapshot.projects); $events=@($snapshot.incidents.records | ForEach-Object { $_.leaves })
    $resultIds=@{}; foreach($result in @($snapshot.result_projects)) { if($result){$resultIds[$result.project.id]=$true} }
    $allTasks=@($projects | ForEach-Object { $projectName=$_.project.name; $projectId=$_.project.id; $_.entries | ForEach-Object { [pscustomobject]@{ project_name=$projectName; project_id=$projectId; entry=$_ } } })
    $taskTable=$tasks.ListObjects.Item('tbl_Subactivities'); $issueTable=$issues.ListObjects.Item('tbl_Issues')
    $taskTable.DataBodyRange.ClearContents(); $issueTable.DataBodyRange.ClearContents()
    $taskTable.Resize($tasks.Range('B6:L' + [math]::Max(7,6+$allTasks.Count)))
    $issueTable.Resize($issues.Range('B6:M' + [math]::Max(7,6+$events.Count)))
    $r=7
    foreach($task in $allTasks) {
        $a=$task.entry.activity
        Write-Text $tasks $r 2 $a.wbs; Write-Text $tasks $r 3 $task.project_name; Write-Text $tasks $r 4 $a.task_title; Write-Text $tasks $r 5 $task.entry.owner_name
        Write-Date $tasks $r 6 $a.start_date; Write-Date $tasks $r 7 $a.due_date
        # Project budgets are not task weights; do not invent a weighting model.
        Write-Number $tasks $r 8 $null
        Write-Number $tasks $r 9 ([double]$a.milestone_gate/100)
        $isResults=$resultIds.ContainsKey($task.project_id)
        $state = if($isResults){$a.status}elseif($a.supervisor_approved){'Completed'}elseif($a.milestone_gate -eq 100){'Pending review'}else{$a.status}
        Write-Text $tasks $r 10 $state
        Write-Text $tasks $r 11 (($a.evidence | ForEach-Object {$_.name}) -join '; ')
        $remarks=if($isResults){'Execution progress; acceptance is tracked by deliverable.'}elseif($task.entry.decision -and -not $task.entry.decision.accepted){$task.entry.decision.comment}elseif($a.milestone_gate -eq 100 -and -not $a.supervisor_approved){'Closure requested; Supervisor approval pending'}else{''}
        if($null -ne $a.hours_spent){$remarks=([string]$a.hours_spent+' h invested. '+$remarks)}
        Write-Text $tasks $r 12 $remarks; $r++
    }
    $r=7
    foreach($event in $events) {
        $a=$event.issue
        Write-Text $issues $r 2 $event.issue_id; Write-Text $issues $r 3 $a.part_number; Write-Text $issues $r 4 $a.description
        Write-Date $issues $r 5 $a.occurrence_date; Write-Date $issues $r 6 $a.target_due_date; Write-Number $issues $r 7 $a.downtime_hours; Write-Number $issues $r 8 $a.scrap_pieces
        $machine=@($snapshot.incidents.catalogs.machines | Where-Object id -eq $a.machine_station | Select-Object -First 1)
        Write-Text $issues $r 9 $(if($machine.Count){$machine[0].name}else{$a.machine_station})
        Write-Text $issues $r 10 $a.impact_level; Write-Text $issues $r 11 $a.status; Write-Text $issues $r 12 $a.root_cause_containment; Write-Text $issues $r 13 $event.reported_by; $r++
    }
    # Excel expands references, merged regions, styles and print settings natively.
    $extraProjects=[math]::Max(0,$projects.Count-5)
    if($extraProjects -gt 0){ $master.Rows.Item('15:'+(14+$extraProjects)).Insert(-4121) | Out-Null; $master.Range('B14:AD14').Copy($master.Range('B15:AD'+(14+$extraProjects))) }
    $firstIssue=20+$extraProjects
    $extraIssues=[math]::Max(0,$events.Count-5)
    if($extraIssues -gt 0){$insert=25+$extraProjects;$master.Rows.Item("${insert}:"+($insert+$extraIssues-1)).Insert(-4121)|Out-Null;$master.Range('B'+($firstIssue+4)+':AD'+($firstIssue+4)).Copy($master.Range('B'+($firstIssue+5)+':AD'+($firstIssue+4+$extraIssues)))}
    Write-Text $master 5 3 $snapshot.prepared_by; Write-Date $master 5 9 $snapshot.reporting_date
    for($i=0;$i -lt [math]::Max(5,$projects.Count);$i++) {
        $row=10+$i
        if($i -lt $projects.Count) {
            $p=$projects[$i].project; Write-Text $master $row 2 $p.wbs;Write-Text $master $row 3 $p.name;Write-Text $master $row 4 $p.process_area;Write-Text $master $row 8 $p.status;Write-Text $master $row 9 ($p.engineer_ids -join ', ')
        }else{foreach($col in @(2,3,4,8,9)){Write-Text $master $row $col ''}}
        # Project progress is the responsible Engineer's explicit declaration.
        if($i -lt $projects.Count -and $null -ne $projects[$i].declared_progress){Write-Number $master $row 7 ([double]$projects[$i].declared_progress/100)}else{Write-Number $master $row 7 $null}
    }
    for($i=0;$i -lt [math]::Max(5,$events.Count);$i++) {
        $row=$firstIssue+$i; $n=$i+1
        foreach($mapping in @(@(2,'Issue ID'),@(3,'Part No / Component'),@(4,'Issue Description'),@(5,'Downtime (Hrs)'),@(6,'Scrap (Pcs)'),@(7,'Occurrence Date'),@(8,'Target Due Date'),@(9,'Status'))) {
            $master.Cells.Item($row,[int]$mapping[0]).Formula='=IFERROR(INDEX(tbl_Issues['+$mapping[1]+'],'+$n+'),"")'
        }
    }
    $tasks.Rows.AutoFit() | Out-Null; $issues.Rows.AutoFit() | Out-Null
    $excel.CalculateFullRebuild()
    foreach($sheet in @($master,$tasks,$issues)) {
        $errors=$null
        try{$errors=$sheet.UsedRange.SpecialCells(-4123,16)}catch{}
        if($errors){throw ('Excel devolvió errores de fórmula en '+$sheet.Name)}
    }
    $book.SaveAs($OutputPath,51)
    $book.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($book);$book=$null
    # Reopen the saved file: verify the native tables and the report date survived.
    $book=$excel.Workbooks.Open($OutputPath,0,$true)
    if($book.Worksheets.Count -ne 3 -or $book.Worksheets.Item('Subactivity Details').ListObjects.Item('tbl_Subactivities').ListRows.Count -ne [math]::Max(1,$allTasks.Count) -or $book.Worksheets.Item('Issues & Risks').ListObjects.Item('tbl_Issues').ListRows.Count -ne [math]::Max(1,$events.Count)){throw 'La estructura del reporte exportado no coincide con el snapshot.'}
} finally {
    if($book){$book.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($book)}
    if($excel){$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)}
    [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
