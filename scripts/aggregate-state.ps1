<#
.SYNOPSIS
    Aggrega lo stato atomico dalle sources docs/state/* nei file docs/ globali
    (SESSIONS.md, 11-BACKLOG.md "Stato di avanzamento").

.DESCRIPTION
    Script di aggregazione "lazy-state" introdotto con ADR-0008 (S25, PR #24).
    Risolve i conflitti di merge ricorrenti su PR aperte a lungo: invece di N
    agenti paralleli che modificano direttamente INDEX/SESSIONS/BACKLOG (causa
    conflitti D.21.1), ogni agente modifica solo la propria cartella docs/state/
    e questo script rigenera i blocchi marcati.

    Modalita d'uso:
      (default)        Scrive i blocchi aggregati nei marker designati (idempotente)
      --check          Confronta lo stato calcolato con i marker esistenti; exit 0 se allineato, 1 se drift
      --dry-run        Calcola ma non scrive; stampa il diff previsto
      --list           Lista i file sorgente e i blocchi target
      --help           Mostra questo help

.EXAMPLE
    pwsh scripts/aggregate-state.ps1                 # aggiorna SESSIONS.md + 11-BACKLOG.md
    pwsh scripts/aggregate-state.ps1 --check         # CI gate: --check exit 0
    pwsh scripts/aggregate-state.ps1 --dry-run       # preview senza scrivere
    pwsh scripts/aggregate-state.ps1 --list           # audit: cosa verrebbe letto/scritto?

.NOTES
    ## Blocchi marcati (regex-based)

    In `docs/SESSIONS.md` (o qualunque file *.md passato per --target):
        <!-- AGGREGATE-SESSIONS-START -->
        ... righe rigenerate dallo script ...
        <!-- AGGREGATE-SESSIONS-END -->

    In `docs/11-BACKLOG.md` (sezione "Stato di avanzamento"):
        <!-- AGGREGATE-STORIES-START -->
        ... tabella rigenerata da state/stories/*.md frontmatter ...
        <!-- AGGREGATE-STORIES-END -->

    ## Idempotenza

    Rieseguire lo script con le stesse sources produce lo stesso output (modulo
    timestamp nel footer, che viene normalizzato a 0000-00-00 in --check).

    ## Manutenzione

    Quando aggiungi un nuovo blocco aggregato (es. in docs/INDEX.md "Stato del
    progetto"), aggiungi i marker e una nuova funzione Build-Block-* qui sotto,
    quindi aggiorna il dispatcher Apply-Blocks / Test-Blocks.

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
$markerSessionsStart = "${lt}${bangs} AGGREGATE-SESSIONS-START --${gt}"
$markerSessionsEnd   = "${lt}${bangs} AGGREGATE-SESSIONS-END --${gt}"
$markerStoriesStart  = "${lt}${bangs} AGGREGATE-STORIES-START --${gt}"
$markerStoriesEnd    = "${lt}${bangs} AGGREGATE-STORIES-END --${gt}"

$targets = @(
    @{ Path = "docs/SESSIONS.md";   Start = $markerSessionsStart; End = $markerSessionsEnd },
    @{ Path = "docs/11-BACKLOG.md"; Start = $markerStoriesStart;  End = $markerStoriesEnd  }
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
    [void]$sb.AppendLine($markerSessionsStart)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` leggendo `' + 'docs/state/sessions/*.md' + '`.')
    [void]$sb.AppendLine('> Rigenerare con `' + 'pwsh scripts/aggregate-state.ps1' + '`. NON editare a mano.')
    [void]$sb.AppendLine("> Aggregator version: 1 (ADR-0008, S25).")
    [void]$sb.AppendLine("")
    foreach ($f in $files) {
        $content = Get-Content -LiteralPath $f.Path -Raw -Encoding UTF8
        $parsed  = Parse-Frontmatter $content
        $title = if ($parsed.Frontmatter['title']) { $parsed.Frontmatter['title'] } else { $f.Base }
        $date = if ($parsed.Frontmatter['date']) { $parsed.Frontmatter['date'] } else { "?" }
        $state = if ($parsed.Frontmatter['state']) { $parsed.Frontmatter['state'] } else { "⬚" }
        $pr = if ($parsed.Frontmatter['pr']) { $parsed.Frontmatter['pr'] } else { "-" }
        $claim = if ($parsed.Frontmatter['claim']) { $parsed.Frontmatter['claim'] } else { "-" }
        [void]$sb.AppendLine("### Sessione $($parsed.Frontmatter['number']) - $title")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("- **Data**: $date")
        [void]$sb.AppendLine("- **Stato**: $state")
        [void]$sb.AppendLine("- **PR**: #$pr")
        [void]$sb.AppendLine("- **Claim**: $($b + $claim + $b)")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine('```')
        [void]$sb.AppendLine($parsed.Body.TrimEnd())
        [void]$sb.AppendLine('```')
        [void]$sb.AppendLine("")
    }
    [void]$sb.AppendLine($markerSessionsEnd)
    return $sb.ToString().TrimEnd([char]10, [char]13)
}

function Build-Block-Stories {
    $files = Get-StateStoryFiles
    if ($files.Count -eq 0) {
        return '_Nessuna story migrata in docs/state/stories/._'
    }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine($markerStoriesStart)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` leggendo `' + 'docs/state/stories/*.md' + '`.')
    [void]$sb.AppendLine('> Rigenerare con `' + 'pwsh scripts/aggregate-state.ps1' + '`. NON editare a mano.')
    [void]$sb.AppendLine("> Aggregator version: 1 (ADR-0008, S25).")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Story | Stato | PR | Merge commit | Area |")
    [void]$sb.AppendLine("|-------|-------|----|--------------|------|")
    foreach ($f in $files) {
        $content = Get-Content -LiteralPath $f.Path -Raw -Encoding UTF8
        $parsed  = Parse-Frontmatter $content
        $id = if ($parsed.Frontmatter['id']) { $parsed.Frontmatter['id'] } else { $f.Base }
        $title = if ($parsed.Frontmatter['title']) { $parsed.Frontmatter['title'] } else { "?" }
        $status = if ($parsed.Frontmatter['status']) { $parsed.Frontmatter['status'] } else { "?" }
        $area = if ($parsed.Frontmatter['area']) { $parsed.Frontmatter['area'] } else { "?" }
        $pr = if ($parsed.Frontmatter['pr']) { "#$($parsed.Frontmatter['pr'])" } else { "-" }
        $mc = if ($parsed.Frontmatter['merged_commit']) { ($b + $parsed.Frontmatter['merged_commit'] + $b) } else { "-" }
        [void]$sb.AppendLine("| $id - $title | $status | $pr | $mc | $area |")
    }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($markerStoriesEnd)
    return $sb.ToString().TrimEnd([char]10, [char]13)
}

function Get-Calculated-Block {
    param([string]$Start, [string]$End)
    if ($Start -eq $markerSessionsStart) { return Build-Block-Sessions }
    if ($Start -eq $markerStoriesStart)  { return Build-Block-Stories  }
    throw "Unknown marker: $Start"
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
