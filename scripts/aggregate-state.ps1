<#
.SYNOPSIS
    Aggrega lo stato atomico dalle sources docs/state/* nei file docs/ globali
    (SESSIONS.md, 11-BACKLOG.md, INDEX.md, BUNDLE.md).

.DESCRIPTION
    Script di aggregazione "lazy-state" introdotto con ADR-0008 (S25, PR #24) e
    esteso a V2 con issue #52 (P3). Risolve i conflitti di merge ricorrenti su
    PR aperte a lungo: invece di N agenti paralleli che modificano direttamente
    INDEX/SESSIONS/BACKLOG (causa conflitti D.21.1), ogni agente modifica solo
    la propria cartella docs/state/ e questo script rigenera i blocchi marcati.

    V1 (ADR-0008 S25):
      - docs/SESSIONS.md: AGGREGATE-SESSIONS-* (sessioni migrate)
      - docs/11-BACKLOG.md: AGGREGATE-STORIES-* (story migrate)

    V2 (issue #52 S29):
      - docs/INDEX.md: AGGREGATE-INDEX-STATUS-* + AGGREGATE-INDEX-ROADMAP-*
      - docs/BUNDLE.md: AGGREGATE-BUNDLE-INVENTORY-*

    Modalita d'uso:
      (default)        Scrive i blocchi aggregati nei marker designati (idempotente)
      --check          Confronta lo stato calcolato con i marker esistenti; exit 0 se allineato, 1 se drift
      --dry-run        Calcola ma non scrive; stampa il diff previsto
      --list           Lista i file sorgente e i blocchi target
      --help           Mostra questo help

.EXAMPLE
    pwsh scripts/aggregate-state.ps1                 # aggiorna tutti i target V1+V2
    pwsh scripts/aggregate-state.ps1 --check         # CI gate: --check exit 0
    pwsh scripts/aggregate-state.ps1 --dry-run       # preview senza scrivere
    pwsh scripts/aggregate-state.ps1 --list           # audit: cosa verrebbe letto/scritto?

.NOTES
    ## Blocchi marcati (regex-based)

    In `docs/SESSIONS.md`:
        <!-- AGGREGATE-SESSIONS-START -->
        ... righe rigenerate dallo script ...
        <!-- AGGREGATE-SESSIONS-END -->

    In `docs/11-BACKLOG.md` (sezione "Stato di avanzamento"):
        <!-- AGGREGATE-STORIES-START -->
        ... tabella rigenerata da state/stories/*.md frontmatter ...
        <!-- AGGREGATE-STORIES-END -->

    In `docs/INDEX.md` (sezione "Stato del progetto"):
        <!-- AGGREGATE-INDEX-STATUS-START -->
        ... bullet list stato aggregato ...
        <!-- AGGREGATE-INDEX-STATUS-END -->

    In `docs/INDEX.md` (sezione "Roadmap Sessioni"):
        <!-- AGGREGATE-INDEX-ROADMAP-START -->
        ... tabella sessioni migrate ...
        <!-- AGGREGATE-INDEX-ROADMAP-END -->

    In `docs/BUNDLE.md` (in cima):
        <!-- AGGREGATE-BUNDLE-INVENTORY-START -->
        ... inventario file + timestamp ...
        <!-- AGGREGATE-BUNDLE-INVENTORY-END -->

    ## Idempotenza

    Rieseguire lo script con le stesse sources produce lo stesso output (modulo
    timestamp nel footer, che viene normalizzato a 0000-00-00 in --check).

    ## Manutenzione

    Quando aggiungi un nuovo blocco aggregato, aggiungi i marker e una nuova
    funzione Build-Block-* qui sotto, quindi aggiorna il dispatcher
    Apply-Blocks / Test-Blocks.

    Vedi: docs/13-ADR/0008-lazy-state-aggregation.md
          docs/state/_index.md
          AGENTS.md §"Post-merge actions" → §"Lazy-state aggregation"
#>

param(
    [switch]$Check,
    [switch]$DryRun,
    [switch]$List,
    [switch]$Help
)

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Full | Out-String | Write-Host
    exit 0
}

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repoRoot = (Get-Location).Path
$stateSessionsDir = Join-Path $repoRoot "docs/state/sessions"
$stateStoriesDir  = Join-Path $repoRoot "docs/state/stories"
$lt = [char]60    # '<'
$gt = [char]62    # '>'
$b = [char]96     # '`' (backtick) — serve a emettere `path` in markdown
$bangs = '!--'
$markerSessionsStart       = "${lt}${bangs} AGGREGATE-SESSIONS-START --${gt}"
$markerSessionsEnd         = "${lt}${bangs} AGGREGATE-SESSIONS-END --${gt}"
$markerStoriesStart        = "${lt}${bangs} AGGREGATE-STORIES-START --${gt}"
$markerStoriesEnd          = "${lt}${bangs} AGGREGATE-STORIES-END --${gt}"
$markerIndexStatusStart    = "${lt}${bangs} AGGREGATE-INDEX-STATUS-START --${gt}"
$markerIndexStatusEnd      = "${lt}${bangs} AGGREGATE-INDEX-STATUS-END --${gt}"
$markerIndexRoadmapStart   = "${lt}${bangs} AGGREGATE-INDEX-ROADMAP-START --${gt}"
$markerIndexRoadmapEnd     = "${lt}${bangs} AGGREGATE-INDEX-ROADMAP-END --${gt}"
$markerBundleInventoryStart = "${lt}${bangs} AGGREGATE-BUNDLE-INVENTORY-START --${gt}"
$markerBundleInventoryEnd   = "${lt}${bangs} AGGREGATE-BUNDLE-INVENTORY-END --${gt}"

$targets = @(
    @{ Path = "docs/SESSIONS.md";   Start = $markerSessionsStart;        End = $markerSessionsEnd },
    @{ Path = "docs/11-BACKLOG.md"; Start = $markerStoriesStart;         End = $markerStoriesEnd },
    @{ Path = "docs/INDEX.md";      Start = $markerIndexStatusStart;     End = $markerIndexStatusEnd },
    @{ Path = "docs/INDEX.md";      Start = $markerIndexRoadmapStart;    End = $markerIndexRoadmapEnd },
    @{ Path = "docs/BUNDLE.md";     Start = $markerBundleInventoryStart; End = $markerBundleInventoryEnd }
)

# === Helpers ===

function Get-StateSessionFiles {
    if (-not (Test-Path $stateSessionsDir)) { return @() }
    Get-ChildItem -Path $stateSessionsDir -Filter "*.md" | ForEach-Object {
        $number = ($_.BaseName -split '-')[0]
        [PSCustomObject]@{
            Number = [int]$number
            Path   = $_.FullName
            Base   = $_.BaseName
        }
    } | Sort-Object Number
}

function Get-StateStoryFiles {
    if (-not (Test-Path $stateStoriesDir)) { return @() }
    Get-ChildItem -Path $stateStoriesDir -Filter "*.md" | ForEach-Object {
        $id = ($_.BaseName -split '-')[0]
        [PSCustomObject]@{
            Id   = $id
            Path = $_.FullName
            Base = $_.BaseName
        }
    } | Sort-Object { [version]$Id  }
}

function Parse-Frontmatter {
    param([string]$Content)
    if ($Content -notmatch '(?s)\A---\r?\n(.+?)\r?\n---\r?\n(.*)$') { return $null }
    $yaml = $matches[1]
    $body = $matches[2]
    $fm = @{}
    foreach ($line in $yaml -split "`n") {
        if ($line -match '^\s*([A-Za-z0-9_-]+):\s*(.*)$') {
            $key = $matches[1]
            $val = $matches[2].Trim()
            # Strip surrounding quotes if present
            if ($val -match '^"(.*)"$') { $val = $matches[1] }
            $fm[$key] = $val
        }
    }
    return [PSCustomObject]@{ Frontmatter = $fm; Body = $body }
}

function Build-Block-Sessions {
    $files = Get-StateSessionFiles
    if ($files.Count -eq 0) {
        return '_Nessuna sessione migrata in docs/state/sessions/._'
    }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append($markerSessionsStart + "`n")
    [void]$sb.Append("" + "`n")
    [void]$sb.Append('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` leggendo `' + 'docs/state/sessions/*.md' + '`.' + "`n")
    [void]$sb.Append('> Rigenerare con `' + 'pwsh scripts/aggregate-state.ps1' + '`. NON editare a mano.' + "`n")
    [void]$sb.Append("> Aggregator version: 1 (ADR-0008, S25)." + "`n")
    [void]$sb.Append("" + "`n")
    foreach ($f in $files) {
        $content = Get-Content -LiteralPath $f.Path -Raw -Encoding UTF8
        $parsed  = Parse-Frontmatter $content
        $title = if ($parsed.Frontmatter['title']) { $parsed.Frontmatter['title'] } else { $f.Base }
        $date = if ($parsed.Frontmatter['date']) { $parsed.Frontmatter['date'] } else { "?" }
        $state = if ($parsed.Frontmatter['state']) { $parsed.Frontmatter['state'] } else { "â¬š" }
        $pr = if ($parsed.Frontmatter['pr']) { $parsed.Frontmatter['pr'] } else { "-" }
        $claim = if ($parsed.Frontmatter['claim']) { $parsed.Frontmatter['claim'] } else { "-" }
        [void]$sb.Append("### Sessione $($parsed.Frontmatter['number']) - $title" + "`n")
        [void]$sb.Append("" + "`n")
        [void]$sb.Append("- **Data**: $date" + "`n")
        [void]$sb.Append("- **Stato**: $state" + "`n")
        [void]$sb.Append("- **PR**: #$pr" + "`n")
        [void]$sb.Append("- **Claim**: $($b + $claim + $b)" + "`n")
        [void]$sb.Append("" + "`n")
        [void]$sb.Append('```' + "`n")
        [void]$sb.Append($parsed.Body.TrimEnd() + "`n")
        [void]$sb.Append('```' + "`n")
        [void]$sb.Append("" + "`n")
    }
    [void]$sb.Append($markerSessionsEnd + "`n")
    return $sb.ToString().TrimEnd([char]10, [char]13)
}

function Build-Block-Stories {
    $files = Get-StateStoryFiles
    if ($files.Count -eq 0) {
        return '_Nessuna story migrata in docs/state/stories/._'
    }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append($markerStoriesStart + "`n")
    [void]$sb.Append("" + "`n")
    [void]$sb.Append('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` leggendo `' + 'docs/state/stories/*.md' + '`.' + "`n")
    [void]$sb.Append('> Rigenerare con `' + 'pwsh scripts/aggregate-state.ps1' + '`. NON editare a mano.' + "`n")
    [void]$sb.Append("> Aggregator version: 1 (ADR-0008, S25)." + "`n")
    [void]$sb.Append("" + "`n")
    [void]$sb.Append("| Story | Stato | PR | Merge commit | Area |" + "`n")
    [void]$sb.Append("|-------|-------|----|--------------|------|" + "`n")
    foreach ($f in $files) {
        $content = Get-Content -LiteralPath $f.Path -Raw -Encoding UTF8
        $parsed  = Parse-Frontmatter $content
        $id = if ($parsed.Frontmatter['id']) { $parsed.Frontmatter['id'] } else { $f.Base }
        $title = if ($parsed.Frontmatter['title']) { $parsed.Frontmatter['title'] } else { "?" }
        $status = if ($parsed.Frontmatter['status']) { $parsed.Frontmatter['status'] } else { "?" }
        $area = if ($parsed.Frontmatter['area']) { $parsed.Frontmatter['area'] } else { "?" }
        $pr = if ($parsed.Frontmatter['pr']) { "#$($parsed.Frontmatter['pr'])" } else { "-" }
        $mc = if ($parsed.Frontmatter['merged_commit']) { ($b + $parsed.Frontmatter['merged_commit'] + $b) } else { "-" }
        [void]$sb.Append("| $id - $title | $status | $pr | $mc | $area |" + "`n")
    }
    [void]$sb.Append("" + "`n")
    [void]$sb.Append($markerStoriesEnd + "`n")
    return $sb.ToString().TrimEnd([char]10, [char]13)
}

function Get-Calculated-Block {
    param([string]$Start, [string]$End)
    if ($Start -eq $markerSessionsStart)        { return Build-Block-Sessions }
    if ($Start -eq $markerStoriesStart)         { return Build-Block-Stories  }
    if ($Start -eq $markerIndexStatusStart)     { return Build-Block-IndexStatus }
    if ($Start -eq $markerIndexRoadmapStart)    { return Build-Block-IndexRoadmap }
    if ($Start -eq $markerBundleInventoryStart) { return Build-Block-BundleInventory }
    throw "Unknown marker: $Start"
}

function Build-Block-IndexStatus {
    $sessions = @(Get-StateSessionFiles)
    $stories  = @(Get-StateStoryFiles)
    $sessionCount = $sessions.Count
    $storyCount = $stories.Count

    # Latest migrated session
    $latestSession = $null
    if ($sessionCount -gt 0) { $latestSession = $sessions[-1] }
    $latestSessionInfo = ""
    if ($latestSession) {
        $content = Get-Content -LiteralPath $latestSession.Path -Raw -Encoding UTF8
        $parsed = Parse-Frontmatter $content
        $n = $parsed.Frontmatter['number']
        $t = $parsed.Frontmatter['title']
        $latestSessionInfo = "Ultima sessione migrata: **S$n** - $t"
    }

    # Stories per status
    $doneStories = @()
    foreach ($f in $stories) {
        $c = Get-Content -LiteralPath $f.Path -Raw -Encoding UTF8
        $p = Parse-Frontmatter $c
        if ($p.Frontmatter['status'] -eq 'done') {
            $doneStories += $p.Frontmatter['id']
        }
    }

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine($markerIndexStatusStart)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` (V2, ADR-0008, issue #52).')
    [void]$sb.AppendLine('> Rigenerare con `' + 'pwsh scripts/aggregate-state.ps1' + '`. NON editare a mano.')
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("- Sessioni migrate in state/sessions: **$sessionCount**")
    [void]$sb.AppendLine("- Stories migrate in state/stories: **$storyCount** (done: $($doneStories.Count))")
    if ($latestSessionInfo) {
        [void]$sb.AppendLine("- $latestSessionInfo")
    }
    if ($doneStories.Count -gt 0) {
        [void]$sb.AppendLine("- Stories done: $($doneStories -join ', ')")
    }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine('> Per il dettaglio completo (incluse sessioni legacy 0-21), vedi sezione "Stato del progetto (legacy)" sotto questo blocco.')
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($markerIndexStatusEnd)
    return $sb.ToString().TrimEnd([char]10, [char]13)
}

function Build-Block-IndexRoadmap {
    $files = Get-StateSessionFiles
    if ($files.Count -eq 0) {
        return '_Nessuna sessione migrata in docs/state/sessions/._'
    }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine($markerIndexRoadmapStart)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` (V2, ADR-0008, issue #52).')
    [void]$sb.AppendLine('> Rigenerare con `' + 'pwsh scripts/aggregate-state.ps1' + '`. NON editare a mano.')
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Sessione | Nome | Stato | PR |")
    [void]$sb.AppendLine("|----------|------|-------|----|")
    foreach ($f in $files) {
        $content = Get-Content -LiteralPath $f.Path -Raw -Encoding UTF8
        $parsed  = Parse-Frontmatter $content
        $n = $parsed.Frontmatter['number']
        $title = if ($parsed.Frontmatter['title']) { $parsed.Frontmatter['title'] } else { $f.Base }
        $state = if ($parsed.Frontmatter['state']) { $parsed.Frontmatter['state'] } else { "?" }
        $pr = if ($parsed.Frontmatter['pr'] -and $parsed.Frontmatter['pr'] -ne '0') { "#$($parsed.Frontmatter['pr'])" } else { "-" }
        [void]$sb.AppendLine("| $n | $title | $state | $pr |")
    }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine('> Per le sessioni 0-21 (legacy, pre ADR-0008), vedi `docs/SESSIONS.md` legacy fino alla migration V2.1.')
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($markerIndexRoadmapEnd)
    return $sb.ToString().TrimEnd([char]10, [char]13)
}

function Build-Block-BundleInventory {
    # Parse the bundle script's $files array
    $bundleScript = Join-Path $repoRoot "scripts/generate-bundle.ps1"
    $files = @()
    if (Test-Path $bundleScript) {
        $content = Get-Content -LiteralPath $bundleScript -Raw -Encoding UTF8
        # Extract lines like:    "AGENTS.md",
        $matches = [regex]::Matches($content, '(?m)^\s*"([^"]+)",\s*$')
        foreach ($m in $matches) { $files += $m.Groups[1].Value }
    }

    # Categorize files
    $categories = @{ 'docs/' = 0; 'scripts/' = 0; 'fixtures/' = 0; '.githooks/' = 0; '.github/' = 0; 'root/' = 0 }
    $totalSize = 0
    foreach ($f in $files) {
        $matched = $false
        foreach ($cat in @('docs/', 'scripts/', 'fixtures/', '.githooks/', '.github/')) {
            if ($f.StartsWith($cat)) { $categories[$cat]++; $matched = $true; break }
        }
        if (-not $matched) { $categories['root/']++ }
        $fullPath = Join-Path $repoRoot $f
        if (Test-Path $fullPath) {
            $size = (Get-Item $fullPath).Length
            $totalSize += $size
        }
    }

    $totalKB = [math]::Round($totalSize / 1KB, 1)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm'

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine($markerBundleInventoryStart)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` (V2, ADR-0008, issue #52).')
    [void]$sb.AppendLine('> Il contenuto del bundle (sezioni FILE) e generato da `' + 'scripts/generate-bundle.ps1' + '` separatamente.')
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("- Totale file: $($files.Count)")
    [void]$sb.AppendLine("- Dimensione totale: $totalKB KB")
    [void]$sb.AppendLine("- Ultima aggregazione: $timestamp")
    [void]$sb.AppendLine("- Generatori: `'scripts/aggregate-state.ps1`' (V2) + `'scripts/generate-bundle.ps1`' (content)")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Categoria | File |")
    [void]$sb.AppendLine("|-----------|------|")
    foreach ($cat in @('docs/', 'scripts/', 'fixtures/', '.githooks/', '.github/', 'root/')) {
        [void]$sb.AppendLine("| $cat | $($categories[$cat]) |")
    }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($markerBundleInventoryEnd)
    return $sb.ToString().TrimEnd([char]10, [char]13)
}

function Find-Block {
    param([string]$Content, [string]$Start, [string]$End)
    $sIdx = $Content.IndexOf($Start)
    if ($sIdx -lt 0) { return $null }
    $eIdx = $Content.IndexOf($End, $sIdx + $Start.Length)
    if ($eIdx -lt 0) { return $null }
    return @{ StartIndex = $sIdx; EndIndex = $eIdx + $End.Length; Block = $Content.Substring($sIdx, $eIdx - $sIdx + $End.Length) }
}

function Apply-Blocks {
    foreach ($t in $targets) {
        $path = $t.Path
        $start = $t.Start
        $end = $t.End
        $calculated = Get-Calculated-Block $start $end
        if (-not (Test-Path $path)) {
            Write-Host "[SKIP] $path non esiste" -ForegroundColor Yellow
            continue
        }
        $content = Get-Content -LiteralPath $path -Raw -Encoding UTF8
        $found = Find-Block $content $start $end
        if ($null -eq $found) {
            Write-Host "[INSERT] $path - marker non presente, append in fondo" -ForegroundColor Cyan
            $separator = [char]10 + [char]10
            $new = $content.TrimEnd() + $separator + $calculated
        } else {
            $new = $content.Substring(0, $found.StartIndex) + $calculated + $content.Substring($found.EndIndex)
        }
        if ($DryRun) {
            Write-Host "[DRY] $path - $($calculated.Length) chars calcolati" -ForegroundColor Cyan
        } else {
            # Issue #58: WriteAllText con UTF-8 no BOM. Il -replace CRLF, LF e
            # l'uso di Append(... + "`n") invece di AppendLine garantiscono LF uniforme
            # su Windows (che altrimenti userebbe CRLF default).
            $new = $new -replace "`r`n", "`n"
            $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
            [System.IO.File]::WriteAllText((Join-Path $repoRoot $path), $new, $utf8NoBom)
            Write-Host "[WRITE] $path - $($calculated.Length) chars applicati" -ForegroundColor Green
        }
    }
}

function Test-Blocks {
    $drift = $false
    foreach ($t in $targets) {
        $path = $t.Path
        $start = $t.Start
        $end = $t.End
        $calculated = Get-Calculated-Block $start $end
        if (-not (Test-Path $path)) {
            Write-Host "[FAIL] $path non esiste" -ForegroundColor Red
            $drift = $true
            continue
        }
        $content = Get-Content -LiteralPath $path -Raw -Encoding UTF8
        $found = Find-Block $content $start $end
        if ($null -eq $found) {
            Write-Host "[FAIL] $path - marker $start assente" -ForegroundColor Red
            $drift = $true
            continue
        }
        $existing = $found.Block
        if ($existing -eq $calculated) {
            Write-Host "[OK] $path - blocco in sync ($($calculated.Length) chars)" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] $path - blocco drift" -ForegroundColor Red
            Write-Host "  Atteso: $($calculated.Length) chars, Trovato: $($existing.Length) chars" -ForegroundColor Yellow
            $drift = $true
        }
    }
    if ($drift) { exit 1 } else { exit 0 }
}

# === List mode ===

if ($List) {
    Write-Host "State sources:" -ForegroundColor Cyan
    Write-Host "  sessions/: $stateSessionsDir" -ForegroundColor Cyan
    foreach ($f in Get-StateSessionFiles) { Write-Host "    [$($f.Number)] $($f.Base)" -ForegroundColor DarkGray }
    Write-Host "  stories/:  $stateStoriesDir"  -ForegroundColor Cyan
    foreach ($f in Get-StateStoryFiles) { Write-Host "    [$($f.Id)] $($f.Base)" -ForegroundColor DarkGray }
    Write-Host ""
    Write-Host "Target files (blocchi gestiti):" -ForegroundColor Cyan
    foreach ($t in $targets) { Write-Host "  $($t.Path)  markers=[$($t.Start) ... $($t.End)]" -ForegroundColor Cyan }
    exit 0
}

# === Main dispatch ===

if ($Check) { Test-Blocks }

Apply-Blocks
exit 0
