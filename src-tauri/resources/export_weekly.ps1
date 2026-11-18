param([Parameter(Mandatory=$true)][string]$SnapshotPath,[Parameter(Mandatory=$true)][string]$TemplatePath,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'

$script:BilingualSeparator = ' | '

function Pick-Bilingual($raw, [string]$lang) {
    if ($null -eq $raw) { return '' }
    $text = [string]$raw
    $idx = $text.IndexOf($script:BilingualSeparator, [System.StringComparison]::Ordinal)
    if ($idx -lt 0) {
        return $text.Trim()
    }
    $es = $text.Substring(0, $idx).Trim()
    $en = $text.Substring($idx + $script:BilingualSeparator.Length).Trim()
    if ($lang -eq 'en' -and $en -ne '') {
        return $en
    }
    return $es
}

function Translate-WorkStatus($status, [string]$lang) {
    if ($null -eq $status) { return '' }
    $raw = ([string]$status).Trim()
    if ($lang -eq 'es') {
        switch ($raw) {
            'Not Started'    { return 'Sin iniciar' }
            'In Progress'    { return 'En curso' }
            'At Risk'        { return 'En riesgo' }
            'Completed'      { return 'Completado' }
            'On Hold'        { return 'En pausa' }
            'Pending review' { return 'Pendiente de revisión' }
            'Pending'        { return 'Pendiente' }
            'Delayed'        { return 'Retrasado' }
            default          { return (Pick-Bilingual $raw 'es') }
        }
    }
    return (Pick-Bilingual $raw 'en')
}

function Translate-IncidentStatus($status, [string]$lang) {
    if ($null -eq $status) { return '' }
    $raw = ([string]$status).Trim()
    if ($lang -eq 'es') {
        switch ($raw) {
            'Open'        { return 'Abierta' }
            'In Progress' { return 'En atención' }
            'Contained'   { return 'Contenida' }
            'Resolved'    { return 'Resuelta' }
            'Closed'      { return 'Cerrada' }
            default       { return (Pick-Bilingual $raw 'es') }
        }
    }
    return (Pick-Bilingual $raw 'en')
}

function Format-TaskRemarks($task, [bool]$isResults, [string]$lang) {
    $a = $task.entry.activity
    $remarks = if ($isResults) {
        if ($lang -eq 'es') { 'Avance de ejecución; la aceptación se controla por entregable.' }
        else { 'Execution progress; acceptance is tracked by deliverable.' }
    } elseif ($task.entry.decision -and -not $task.entry.decision.accepted) {
        Pick-Bilingual $task.entry.decision.comment $lang
    } elseif ($a.milestone_gate -eq 100 -and -not $a.supervisor_approved) {
        if ($lang -eq 'es') { 'Cierre solicitado; aprobación del Supervisor pendiente' }
        else { 'Closure requested; Supervisor approval pending' }
    } else {
        ''
    }
    if ($null -ne $a.hours_spent) {
        $unit = if ($lang -eq 'es') { ' h invertidas. ' } else { ' h invested. ' }
        $remarks = ([string]$a.hours_spent + $unit + $remarks)
    }
    return $remarks
}

function Get-SheetSpecs() {
    return @(
        [pscustomobject]@{
            Lang        = 'es'
            SheetName   = 'Reporte Semanal (ES)'
            SubTable    = 'tbl_Subactivities_ES'
            IssueTable  = 'tbl_Issues_ES'
            IssueIdCol  = 'ID Incidencia'
            IssueMap    = @(
                @(2, 'ID Incidencia'),
                @(3, 'No. Parte / Componente'),
                @(4, 'Descripción del Problema'),
                @(5, 'Paro (Hrs)'),
                @(6, 'Scrap (Pzas)'),
                @(7, 'Fecha de Ocurrencia'),
                @(8, 'Fecha Compromiso'),
                @(9, 'Estado')
            )
        },
        [pscustomobject]@{
            Lang        = 'en'
            SheetName   = 'Weekly Report (EN)'
            SubTable    = 'tbl_Subactivities_EN'
            IssueTable  = 'tbl_Issues_EN'
            IssueIdCol  = 'Issue ID'
            IssueMap    = @(
                @(2, 'Issue ID'),
                @(3, 'Part No / Component'),
                @(4, 'Issue Description'),
                @(5, 'Downtime (Hrs)'),
                @(6, 'Scrap (Pcs)'),
                @(7, 'Occurrence Date'),
                @(8, 'Target Due Date'),
                @(9, 'Status')
            )
        }
    )
}

function Write-Text($sheet, [int]$row, [int]$column, $value) {
    $cell = $sheet.Cells.Item($row, $column)
    $cell.NumberFormat = '@'
    $cell.Value2 = [string]$value
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($cell)
}

function Write-Number($sheet, [int]$row, [int]$column, $value) {
    $cell = $sheet.Cells.Item($row, $column)
    if ($null -eq $value -or ($value -is [string] -and $value -eq '')) {
        $cell.ClearContents()
    } else {
        $cell.Value2 = [double]$value
    }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($cell)
}

function Write-Date($sheet, [int]$row, [int]$column, $value) {
    if (-not $value) {
        Write-Number $sheet $row $column $null
        return
    }
    Write-Number $sheet $row $column ([datetime]::ParseExact($value, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture).ToOADate())
}

if ($MyInvocation.InvocationName -ne '.') {
    $snapshot = Get-Content -LiteralPath $SnapshotPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $excel = $null
    $book = $null
    try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $excel.AskToUpdateLinks = $false
        $excel.AutomationSecurity = 3
        $book = $excel.Workbooks.Open($TemplatePath, 0, $true)
        $projects = @($snapshot.projects)
        $events = @($snapshot.incidents.records | ForEach-Object { $_.leaves })
        $resultIds = @{}
        foreach ($result in @($snapshot.result_projects)) {
            if ($result) { $resultIds[$result.project.id] = $true }
        }
        $allTasks = @(
            $projects | ForEach-Object {
                $projectName = $_.project.name
                $projectId = $_.project.id
                $_.entries | ForEach-Object {
                    [pscustomobject]@{
                        project_name = $projectName
                        project_id   = $projectId
                        entry        = $_
                    }
                }
            }
        )
        $specs = Get-SheetSpecs
        foreach ($spec in $specs) {
            $sheet = $book.Worksheets.Item($spec.SheetName)
            $lang = $spec.Lang

            # 1. Header metadata
            Write-Text $sheet 5 3 (Pick-Bilingual $snapshot.prepared_by $lang)
            Write-Date $sheet 5 9 $snapshot.reporting_date

            # 2. Section 1: Projects & Line Improvements (5 base rows 10..14)
            $extraProjects = [math]::Max(0, $projects.Count - 5)
            if ($extraProjects -gt 0) {
                $sheet.Rows.Item('15:' + (14 + $extraProjects)).Insert(-4121) | Out-Null
                $sheet.Range('B14:AD14').Copy($sheet.Range('B15:AD' + (14 + $extraProjects)))
            }
            for ($i = 0; $i -lt [math]::Max(5, $projects.Count); $i++) {
                $row = 10 + $i
                if ($i -lt $projects.Count) {
                    $p = $projects[$i].project
                    Write-Text $sheet $row 2 $p.wbs
                    Write-Text $sheet $row 3 (Pick-Bilingual $p.name $lang)
                    Write-Text $sheet $row 4 (Pick-Bilingual $p.process_area $lang)
                    Write-Text $sheet $row 8 (Translate-WorkStatus $p.status $lang)
                    Write-Text $sheet $row 9 ($p.engineer_ids -join ', ')
                } else {
                    foreach ($col in @(2, 3, 4, 8, 9)) { Write-Text $sheet $row $col '' }
                }
                if ($i -lt $projects.Count -and $null -ne $projects[$i].declared_progress) {
                    Write-Number $sheet $row 7 ([double]$projects[$i].declared_progress / 100)
                } elseif ($i -ge $projects.Count) {
                    Write-Number $sheet $row 7 $null
                }
            }

            # 3. Section 2: Active Issues Summary (5 base rows starting at 18 + $extraProjects)
            $firstIssue = 18 + $extraProjects
            $extraIssues = [math]::Max(0, $events.Count - 5)
            if ($extraIssues -gt 0) {
                $insert = 23 + $extraProjects
                $sheet.Rows.Item("${insert}:" + ($insert + $extraIssues - 1)).Insert(-4121) | Out-Null
                $sheet.Range('B' + ($firstIssue + 4) + ':AD' + ($firstIssue + 4)).Copy($sheet.Range('B' + ($firstIssue + 5) + ':AD' + ($firstIssue + 4 + $extraIssues)))
            }
            for ($i = 0; $i -lt [math]::Max(5, $events.Count); $i++) {
                $row = $firstIssue + $i
                $n = $i + 1
                foreach ($mapping in $spec.IssueMap) {
                    $colIdx = [int]$mapping[0]
                    $colName = $mapping[1]
                    $sheet.Cells.Item($row, $colIdx).Formula = '=IF(IFERROR(INDEX(' + $spec.IssueTable + '[' + $spec.IssueIdCol + '],' + $n + '),"")="","",IFERROR(INDEX(' + $spec.IssueTable + '[' + $colName + '],' + $n + '),""))'
                }
            }

            # 4. Section 3: Subactivity Details ListObject (insert rows before Resize so Section 4 shifts cleanly)
            $taskTable = $sheet.ListObjects.Item($spec.SubTable)
            $taskTable.DataBodyRange.ClearContents()
            $subHeaderRow = $taskTable.HeaderRowRange.Row
            $subDataRow = $subHeaderRow + 1
            $subRowCount = [math]::Max(1, $allTasks.Count)
            if ($subRowCount -gt 1) {
                $insertStart = $subDataRow + 1
                $insertEnd = $subDataRow + $subRowCount - 1
                $sheet.Rows.Item("${insertStart}:${insertEnd}").Insert(-4121) | Out-Null
                $sheet.Range("B${subDataRow}:L${subDataRow}").Copy($sheet.Range("B${insertStart}:L${insertEnd}"))
                $sheet.Range("B${insertStart}:L${insertEnd}").ClearContents()
            }
            $taskTable.Resize($sheet.Range("B${subHeaderRow}:L" + ($subHeaderRow + $subRowCount)))
            $r = $subDataRow
            foreach ($task in $allTasks) {
                $a = $task.entry.activity
                Write-Text $sheet $r 2 $a.wbs
                Write-Text $sheet $r 3 (Pick-Bilingual $task.project_name $lang)
                Write-Text $sheet $r 4 (Pick-Bilingual $a.task_title $lang)
                Write-Text $sheet $r 5 (Pick-Bilingual $task.entry.owner_name $lang)
                Write-Date $sheet $r 6 $a.start_date
                Write-Date $sheet $r 7 $a.due_date
                Write-Number $sheet $r 8 $null
                Write-Number $sheet $r 9 ([double]$a.milestone_gate / 100)
                $isResults = $resultIds.ContainsKey($task.project_id)
                $rawState = if ($isResults) { $a.status } elseif ($a.supervisor_approved) { 'Completed' } elseif ($a.milestone_gate -eq 100) { 'Pending review' } else { $a.status }
                Write-Text $sheet $r 10 (Translate-WorkStatus $rawState $lang)
                Write-Text $sheet $r 11 (($a.evidence | ForEach-Object { $_.name }) -join '; ')
                Write-Text $sheet $r 12 (Format-TaskRemarks $task $isResults $lang)
                $r++
            }
            $taskTable.DataBodyRange.Rows.AutoFit() | Out-Null

            # 5. Section 4: Issues & Risks ListObject (bottom-most table on sheet)
            $issueTable = $sheet.ListObjects.Item($spec.IssueTable)
            $issueTable.DataBodyRange.ClearContents()
            $issueHeaderRow = $issueTable.HeaderRowRange.Row
            $issueDataRow = $issueHeaderRow + 1
            $issueRowCount = [math]::Max(1, $events.Count)
            if ($issueRowCount -gt 1) {
                $copyStart = $issueDataRow + 1
                $copyEnd = $issueDataRow + $issueRowCount - 1
                $sheet.Range("B${issueDataRow}:M${issueDataRow}").Copy($sheet.Range("B${copyStart}:M${copyEnd}"))
                $sheet.Range("B${copyStart}:M${copyEnd}").ClearContents()
            }
            $issueTable.Resize($sheet.Range("B${issueHeaderRow}:M" + ($issueHeaderRow + $issueRowCount)))
            $r = $issueDataRow
            foreach ($event in $events) {
                $a = $event.issue
                Write-Text $sheet $r 2 $event.issue_id
                Write-Text $sheet $r 3 (Pick-Bilingual $a.part_number $lang)
                Write-Text $sheet $r 4 (Pick-Bilingual $a.description $lang)
                Write-Date $sheet $r 5 $a.occurrence_date
                Write-Date $sheet $r 6 $a.target_due_date
                Write-Number $sheet $r 7 $a.downtime_hours
                Write-Number $sheet $r 8 $a.scrap_pieces
                $machine = @($snapshot.incidents.catalogs.machines | Where-Object id -eq $a.machine_station | Select-Object -First 1)
                $machineRaw = if ($machine.Count) { $machine[0].name } else { $a.machine_station }
                Write-Text $sheet $r 9 (Pick-Bilingual $machineRaw $lang)
                Write-Text $sheet $r 10 (Pick-Bilingual $a.impact_level $lang)
                Write-Text $sheet $r 11 (Translate-IncidentStatus $a.status $lang)
                Write-Text $sheet $r 12 (Pick-Bilingual $a.root_cause_containment $lang)
                Write-Text $sheet $r 13 (Pick-Bilingual $event.reported_by $lang)
                $r++
            }
            $issueTable.DataBodyRange.Rows.AutoFit() | Out-Null
        }

        $excel.CalculateFullRebuild()
        foreach ($spec in $specs) {
            $sheet = $book.Worksheets.Item($spec.SheetName)
            $errors = $null
            try { $errors = $sheet.UsedRange.SpecialCells(-4123, 16) } catch {}
            if ($errors) { throw ('Excel devolvió errores de fórmula en ' + $sheet.Name) }
        }
        $book.Worksheets.Item(1).Activate()
        $book.SaveAs($OutputPath, 51)
        $book.Close($false)
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book)
        $book = $null

        # Reopen the saved file: verify the 2 self-contained bilingual sheets and all 4 native tables survived.
        $book = $excel.Workbooks.Open($OutputPath, 0, $true)
        $expectedTaskRows = [math]::Max(1, $allTasks.Count)
        $expectedIssueRows = [math]::Max(1, $events.Count)
        if ($book.Worksheets.Count -ne 2) {
            throw 'La estructura del reporte exportado no coincide con el snapshot.'
        }
        foreach ($spec in $specs) {
            $sheet = $book.Worksheets.Item($spec.SheetName)
            if ($sheet.ListObjects.Item($spec.SubTable).ListRows.Count -ne $expectedTaskRows -or
                $sheet.ListObjects.Item($spec.IssueTable).ListRows.Count -ne $expectedIssueRows) {
                throw 'La estructura del reporte exportado no coincide con el snapshot.'
            }
        }
    } finally {
        if ($book) { $book.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book) }
        if ($excel) { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }
}
