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

# === Fail-closed param guard (issue #104) ===
# Vedi la nota in scripts/generate-bundle.ps1: in PS 5.1 con `&`,
# `--check` viene interpretato come fine-dei-parametri + token posizionale
# `check` che NON si lega a $Check. Senza questo guard lo script ricade
# silenziosamente in modalita' default e aggiorna i blocchi aggregati
# mentre l'utente pensa di star solo verificando. Stessa logica applicata
# a tutti gli script con switch di gate: un -Check fail-silently su un
# aggregator che scrive SESSIONS/BACKLOG/INDEX/BUNDLE e' anche peggio che
# sul bundle, perche' puo' "verificare" con successo uno stato che lo
# stesso check ha appena creato.
$flagLike = @()
foreach ($a in @($args)) { if ($a -is [string] -and $a -match '^-') { $flagLike += $a } }
foreach ($u in @($MyInvocation.UnboundArguments)) { if ($u -is [string] -and $u -match '^-') { $flagLike += $u } }
if ($flagLike.Count -gt 0) {
    Write-Host "[FAIL] Parametro sconosciuto: $($flagLike -join ' ')" -ForegroundColor Red
    Write-Host "PowerShell 5.1 non mappa '--' su '-': usare il trattino singolo." -ForegroundColor Yellow
    Write-Host "  ERRATO:   scripts/aggregate-state.ps1 --check" -ForegroundColor Yellow
    Write-Host "  CORRETTO: scripts/aggregate-state.ps1 -Check" -ForegroundColor Green
    Write-Host "Vedi issue #104 e AGENTS.md §Lazy-state aggregation." -ForegroundColor Yellow
    exit 2
}

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
    # NB: serve `$_.Id` esplicito, NON `$Id` shorthand. Con `[version]` come
    # primo token, la forma abbreviata non viene espansa da PowerShell 5.1:
    # tutti gli item hanno sort key `$null`, l'ordine degenera a quello di
    # `Get-ChildItem` (filesystem-dipendente). Vedi issue #79 e il gate
    # `scripts/test-aggregate-determinism.sh` (T1+T2).
    } | Sort-Object { [version]$_.Id }
}

# === Issue #105 — guard anti-collisione sui numeri di sessione ===
# Due agenti paralleli possono scegliere lo stesso `Number` per i loro file
# `docs/state/sessions/<N>-<slug>.md` (lesson 41-4: S41 vs S40 dell'altro agente).
# Senza un check esplicito l'aggregator ordina per `Number` e usa `Base` come
# tie-break: il risultato e' che in SESSIONS.md e INDEX-roadmap compaiono
# due righe "Sessione 40" senza nessun warning, e `aggregate-state.ps1 -Check`
# esce 0 (perche' la tabella e' "in sync" con se' stessa). La collisione
# e' solo visibile guardando i due frontmatter `number:` identici.
#
# Questa funzione rileva i duplicati e ritorna un array di oggetti
# `{Number, Paths[]}` con **solo** i numeri che hanno piu' di un file.
# L'output viene consumato sia da `Apply-Blocks` (WARN visibile in modalita'
# default/dry-run, NON blocca perche' il drift e' gia' su `main`) che da
# `Test-Blocks` (exit non-zero per il fail-closed del gate CI).
#
# NB: ritornare sempre un array (anche vuoto) - PS 5.1 unwrappa un singolo
# oggetto in array di 1 elemento, ma `@()` resta vuoto. Per coerenza
# normale il risultato a un `[object[]]` esplicito, cosi' `$dupes.Count`
# funziona in modo predicibile dal chiamante.
function Find-DuplicateSessionNumbers {
    $files = @(Get-StateSessionFiles)
    if ($files.Count -eq 0) { return , @() }
    $groups = @($files | Group-Object -Property Number | Where-Object { $_.Count -gt 1 })
    $dupes = New-Object System.Collections.Generic.List[object]
    foreach ($g in $groups) {
        $paths = New-Object System.Collections.Generic.List[string]
        foreach ($f in $g.Group) {
            [void]$paths.Add($f.Path)
        }
        [void]$dupes.Add([PSCustomObject]@{
            Number = $g.Name
            Paths  = $paths.ToArray()
        })
    }
    return , $dupes.ToArray()
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
        $state = if ($parsed.Frontmatter['state']) { $parsed.Frontmatter['state'] } else { "?" }
        $pr = if ($parsed.Frontmatter['pr']) { $parsed.Frontmatter['pr'] } else { "-" }
        $claim = if ($parsed.Frontmatter['claim']) { $parsed.Frontmatter['claim'] } else { "-" }
        $merged = if ($parsed.Frontmatter['merged'] -eq 'true') { $true } else { $false }
        $merged_commit = if ($parsed.Frontmatter['merged_commit']) { $parsed.Frontmatter['merged_commit'] } else { "-" }
        $merged_date = if ($parsed.Frontmatter['merged_date']) { $parsed.Frontmatter['merged_date'] } else { "-" }
        [void]$sb.Append("### Sessione $($parsed.Frontmatter['number']) - $title" + "`n")
        [void]$sb.Append("" + "`n")
        [void]$sb.Append("- **Data**: $date" + "`n")
        [void]$sb.Append("- **Stato**: $state" + "`n")
        if ($merged) {
            [void]$sb.Append("- **Merged**: ✅ PR #$pr ($merged_commit, $merged_date)" + "`n")
        } else {
            [void]$sb.Append("- **Merged**: ❌ non ancora mergiato (PR #$pr)" + "`n")
        }
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

    # Sessions per merge status
    $mergedSessions = 0
    foreach ($f in $sessions) {
        $c = Get-Content -LiteralPath $f.Path -Raw -Encoding UTF8
        $p = Parse-Frontmatter $c
        if ($p.Frontmatter['merged'] -eq 'true') {
            $mergedSessions++
        }
    }

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
    [void]$sb.AppendLine("- Sessioni migrate in state/sessions: **$sessionCount** (merge: $mergedSessions)")
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
    return ($sb.ToString().TrimEnd([char]10, [char]13)) -replace "`r`n", "`n"
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
    [void]$sb.AppendLine("| Sessione | Nome | Stato | Merged | PR |")
    [void]$sb.AppendLine("|----------|------|-------|--------|----|")
    foreach ($f in $files) {
        $content = Get-Content -LiteralPath $f.Path -Raw -Encoding UTF8
        $parsed  = Parse-Frontmatter $content
        $n = $parsed.Frontmatter['number']
        $title = if ($parsed.Frontmatter['title']) { $parsed.Frontmatter['title'] } else { $f.Base }
        $state = if ($parsed.Frontmatter['state']) { $parsed.Frontmatter['state'] } else { "?" }
        $merged = if ($parsed.Frontmatter['merged'] -eq 'true') { "✅" } else { "❌" }
        $pr = if ($parsed.Frontmatter['pr'] -and $parsed.Frontmatter['pr'] -ne '0') { "#$($parsed.Frontmatter['pr'])" } else { "-" }
        [void]$sb.AppendLine("| $n | $title | $state | $merged | $pr |")
    }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine('> Per le sessioni 0-21 (legacy, pre ADR-0008), vedi `docs/SESSIONS.md` legacy fino alla migration V2.1.')
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($markerIndexRoadmapEnd)
    return ($sb.ToString().TrimEnd([char]10, [char]13)) -replace "`r`n", "`n"
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

    # Issue #86 (opzione A): la "Dimensione totale" e calcolata sullo stato pre-write
    # dell'aggregator (questo script misura i file _prima_ di riscrivere SESSIONS/INDEX/
    # BACKLOG/BUNDLE), quindi oscilla di 1-2 run dopo ogni merge. Escludiamo i 4 file
    # aggregator-managed dal calcolo della dimensione: il totale cosi ottenuto e stabile
    # e coincidente con la somma reale dei rimanenti file. Conteggi per categoria
    # invariati (i 4 file sono ancora inclusi nel `Totale file` e nelle sottocategorie).
    $aggregatorManaged = @('docs/SESSIONS.md', 'docs/INDEX.md', 'docs/11-BACKLOG.md', 'docs/BUNDLE.md')

    # Categorize files
    $categories = @{ 'docs/' = 0; 'scripts/' = 0; 'fixtures/' = 0; '.githooks/' = 0; '.github/' = 0; 'root/' = 0 }
    $totalSize = 0
    $excludedSizeFiles = 0
    foreach ($f in $files) {
        $matched = $false
        foreach ($cat in @('docs/', 'scripts/', 'fixtures/', '.githooks/', '.github/')) {
            if ($f.StartsWith($cat)) { $categories[$cat]++; $matched = $true; break }
        }
        if (-not $matched) { $categories['root/']++ }
        $fullPath = Join-Path $repoRoot $f
        if (Test-Path $fullPath) {
            # Issue #88: usare la dimensione del contenuto normalizzato a LF invece
            # di (Get-Item).Length, perche' con `core.autocrlf=true` su Windows 14
            # file di testo vengono serviti CRLF sul disco e il check su origin/main
            # (committed LF) generava un drift spurio cross-platform (~2.3 KB).
            # Il valore cosi ottenuto coincide con `git cat-file -s HEAD:<file>` ed e
            # quindi identico su Windows / Linux / macOS.
            $fileText = Get-Content -LiteralPath $fullPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            if ($null -ne $fileText) {
                $lfText = $fileText -replace "`r`n", "`n"
                $size = [System.Text.Encoding]::UTF8.GetByteCount($lfText)
            } else {
                # File binario o illeggibile come UTF-8: usa la dimensione raw.
                $size = (Get-Item $fullPath).Length
            }
            if ($aggregatorManaged -contains $f) {
                $excludedSizeFiles++
            } else {
                $totalSize += $size
            }
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
    [void]$sb.AppendLine("- Totale file: $($files.Count) (incluso $excludedSizeFiles file aggregator-managed)")
    $excludedNote = if ($excludedSizeFiles -gt 0) {
        $excludedNames = ($files | Where-Object { $aggregatorManaged -contains $_ }) -join ', '
        " (esclusi dal calcolo: $excludedNames)"
    } else { " (nessuno escluso dal calcolo: i 4 file aggregator-managed non sono in `$files)" }
    [void]$sb.AppendLine("- Dimensione totale: $totalKB KB$excludedNote")
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
    return ($sb.ToString().TrimEnd([char]10, [char]13)) -replace "`r`n", "`n"
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
    # Issue #105: avvisa SEMPRE di eventuali collisioni di `Number` tra i file
    # state/sessions/, anche se l'applicazione dei blocchi va a buon fine (il
    # drift e' gia' su `main`, l'allineamento non lo risolve - serve un
    # intervento umano che rinumera uno dei due file).
    $dupes = Find-DuplicateSessionNumbers
    if ($dupes.Count -gt 0) {
        Write-Host "[WARN] $($dupes.Count) numeri di sessione duplicati in docs/state/sessions/ (issue #105):" -ForegroundColor Yellow
        foreach ($d in $dupes) {
            Write-Host "  - Number=$($d.Number):" -ForegroundColor Yellow
            foreach ($p in $d.Paths) {
                Write-Host "      $p" -ForegroundColor Yellow
            }
        }
        Write-Host "  Rinominare uno dei file in <N+1>-<slug>.md e rieseguire." -ForegroundColor Yellow
    }

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
    # Issue #105: in --check una collisione di Number E' di per se' un drift
    # semantico, anche se il blocco aggregato e' formalmente in sync (l'output
    # contiene due righe "Sessione N" - sintomo del drift, non "in sync").
    # Il check deve uscire non-zero per rendere il problema visibile al
    # gate CI e al `auto-state-aggregate` workflow.
    $drift = $false

    $dupes = Find-DuplicateSessionNumbers
    if ($dupes.Count -gt 0) {
        Write-Host "[FAIL] $($dupes.Count) numeri di sessione duplicati (issue #105):" -ForegroundColor Red
        foreach ($d in $dupes) {
            Write-Host "  - Number=$($d.Number):" -ForegroundColor Red
            foreach ($p in $d.Paths) {
                Write-Host "      $p" -ForegroundColor Red
            }
        }
        Write-Host "  Rinumerare uno dei file (es. <N+1>-<slug>.md) e rieseguire il check." -ForegroundColor Yellow
        $drift = $true
    }

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
        # Normalizza i timestamp mutabili (es. "Ultima aggregazione") prima del
        # confronto, per garantire idempotenza del --check (analogo al fix
        # S30/S31 applicato su generate-bundle.ps1 per la riga "> Data:").
        $existingNorm = $existing -replace '(?m)^- Ultima aggregazione: .+$', '- Ultima aggregazione: 0000-00-00 00:00'
        $calculatedNorm = $calculated -replace '(?m)^- Ultima aggregazione: .+$', '- Ultima aggregazione: 0000-00-00 00:00'
        if ($existingNorm -eq $calculatedNorm) {
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
    # Issue #105: --list evidenzia eventuali collisioni di Number.
    $dupes = Find-DuplicateSessionNumbers
    if ($dupes.Count -gt 0) {
        Write-Host ""
        Write-Host "[WARN] $($dupes.Count) numeri di sessione duplicati (issue #105):" -ForegroundColor Yellow
        foreach ($d in $dupes) {
            Write-Host "  Number=$($d.Number):" -ForegroundColor Yellow
            foreach ($p in $d.Paths) {
                Write-Host "    $p" -ForegroundColor Yellow
            }
        }
    }
    Write-Host ""
    Write-Host "Target files (blocchi gestiti):" -ForegroundColor Cyan
    foreach ($t in $targets) { Write-Host "  $($t.Path)  markers=[$($t.Start) ... $($t.End)]" -ForegroundColor Cyan }
    exit 0
}

# === Main dispatch ===

if ($Check) { Test-Blocks }

Apply-Blocks
exit 0
