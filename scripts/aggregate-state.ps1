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

    V4 (issue #216 S70):
      - README.md + docs/INDEX.md: AGGREGATE-PROGRESS-*
        Indicatore di avanzamento: percentuale di implementazione (story e
        pesata per effort), story completate su totale, step rimanenti,
        tabella per EPIC, gate di testabilita' e analisi della sessione
        corrente. Il denominatore e' il catalogo completo delle story
        dichiarate in docs/11-BACKLOG.md; lo stato di ciascuna story arriva
        dai file in docs/state/stories/.

    Modalita d'uso:
      (default)        Scrive i blocchi aggregati nei marker designati (idempotente)
      --check          Confronta lo stato calcolato con i marker esistenti; exit 0 se allineato, 1 se drift
      --dry-run        Calcola ma non scrive; stampa il diff previsto
      --list           Lista i file sorgente e i blocchi target
      --progress       Stampa l'indicatore di avanzamento senza scrivere nulla
      --help           Mostra questo help

.EXAMPLE
    pwsh scripts/aggregate-state.ps1                 # aggiorna tutti i target V1+V2+V4
    pwsh scripts/aggregate-state.ps1 --check         # CI gate: --check exit 0
    pwsh scripts/aggregate-state.ps1 --dry-run       # preview senza scrivere
    pwsh scripts/aggregate-state.ps1 --list           # audit: cosa verrebbe letto/scritto?
    pwsh scripts/aggregate-state.ps1 --progress       # "a che punto siamo?" senza toccare il repo

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

    In `README.md` e `docs/INDEX.md`:
        <!-- AGGREGATE-PROGRESS-START -->
        ... indicatore di avanzamento (percentuale, X/Y, Z rimanenti) ...
        <!-- AGGREGATE-PROGRESS-END -->

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
    [switch]$Progress,
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

# === Indipendenza dal sistema operativo e dalla locale (issue #284) ===
#
# Il requisito e' che le automazioni producano gli stessi byte su Windows,
# Linux e macOS. Tre dipendenze storiche lo impedivano:
#
#   1. **Versione del motore**: l'output dipende da PowerShell (issue #104: il
#      binding dei parametri e `StringBuilder.AppendLine` cambiano fra 5.1 e
#      7). Il baseline del repo e' pwsh 7 (AGENTS.md F9): qui la guardia
#      diventa fail-closed invece che solo documentale.
#   2. **Locale**: l'interpolazione di un numero usa la locale corrente
#      (separatore decimale `,` su it-IT, `.` su en-US): lo stesso input
#      produceva blocchi DIVERSI su due macchine. `InvariantCulture` rende
#      il rendering indipendente dalla lingua del runner.
#   3. **Fuso orario**: il timestamp usava l'ora locale del runner (UTC sui
#      runner GitHub, locale sulla macchina dello sviluppatore).
#
# La prova che l'obiettivo e' raggiunto e' il gate di portabilita'
# `scripts/check-generators-portable.mjs`, che rigenera i file su
# `ubuntu-latest` e `windows-latest` e confronta i byte.
if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host "[FAIL] Serve PowerShell 7+ (baseline del repo, AGENTS.md F9): trovato $($PSVersionTable.PSVersion)." -ForegroundColor Red
    Write-Host "       L'output dei generatori non e' identico su Windows PowerShell 5.1 (issue #104, #284)." -ForegroundColor Yellow
    exit 2
}
$InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture

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
# V3 (ADR-0008 V3, issue #127): blocco "Prossima story" sul README.md per
# prevenire il drift della stringa "Prossima sbloccata" (chiuse con story 0.2
# gia' nel 2026-10-17, vedi PR #4). La stringa e' ora derivata da
# `docs/state/stories/*.md` (frontmatter `status`).
$markerNextStepStart       = "${lt}${bangs} AGGREGATE-NEXT-STEP-START --${gt}"
$markerNextStepEnd         = "${lt}${bangs} AGGREGATE-NEXT-STEP-END --${gt}"
# V4 (ADR-0008 V4, issue #216): blocco "Indicatore di avanzamento" con la
# percentuale di implementazione, il conteggio delle story completate e
# rimanenti, i gate di testabilita' e l'analisi della sessione corrente.
# Denominatore: il catalogo completo delle story dichiarate in
# `docs/11-BACKLOG.md` (non solo le story con state file).
$markerProgressStart       = "${lt}${bangs} AGGREGATE-PROGRESS-START --${gt}"
$markerProgressEnd         = "${lt}${bangs} AGGREGATE-PROGRESS-END --${gt}"

$targets = @(
    @{ Path = "docs/SESSIONS.md";   Start = $markerSessionsStart;        End = $markerSessionsEnd },
    @{ Path = "docs/11-BACKLOG.md"; Start = $markerStoriesStart;         End = $markerStoriesEnd },
    @{ Path = "docs/INDEX.md";      Start = $markerIndexStatusStart;     End = $markerIndexStatusEnd },
    @{ Path = "docs/INDEX.md";      Start = $markerIndexRoadmapStart;    End = $markerIndexRoadmapEnd },
    @{ Path = "docs/BUNDLE.md";     Start = $markerBundleInventoryStart; End = $markerBundleInventoryEnd },
    @{ Path = "README.md";          Start = $markerNextStepStart;        End = $markerNextStepEnd },
    @{ Path = "README.md";          Start = $markerProgressStart;        End = $markerProgressEnd },
    @{ Path = "docs/INDEX.md";      Start = $markerProgressStart;        End = $markerProgressEnd }
)

# === Helpers ===

# PERF (Sessione 73, issue #224): cache per-process delle sorgenti di stato.
#
# Lo script era 2,09 s perche' leggeva gli stessi file piu' volte:
#   - i file di sessione venivano letti 4 volte (Build-Block-Sessions,
#     Build-Block-IndexStatus, Build-Block-IndexRoadmap, Find-DuplicateSessionNumbers)
#   - i file di story venivano letti 3 volte (Build-Block-Stories,
#     Build-Block-IndexStatus, Build-Block-NextStep)
#   - ogni file veniva anche ri-parsato dal frontmatter a ogni passaggio
# Le tre cache qui sotto eliminano le letture ripetute: il contenuto dei file
# in docs/state/ non cambia durante una singola esecuzione, quindi la cache
# e' coerente per costruzione (e `Apply-Blocks` non scrive mai i file di
# state/, solo i target aggregati).
$script:stateSessionFileCache = $null
$script:stateStoryFileCache   = $null
$script:stateContentCache     = @{}
$script:stateParsedCache      = @{}

# Ordinamento TOTALE, indipendente dal filesystem e dalla locale (issue #284).
#
# `Sort-Object` ordina le stringhe con la collazione della LOCALE corrente e
# non e' garantito stabile: a parita' di chiave l'ordine finale dipendeva
# dall'ordine di enumerazione di `Get-ChildItem`, che e' diverso su Windows e
# Linux (il caso reale: `0.3, 0.5, 0.6` su Linux e `0.6, 0.5, 0.3` su
# Windows, issue #79). Qui il confronto e' esplicito e la chiave secondaria e'
# il nome del file, confrontato in modo ORDINALE: la coppia (chiave, nome) e'
# univoca, quindi l'ordinamento e' totale e riproducibile su ogni OS.
function Sort-StateFiles {
    param(
        [object[]]$Items,
        [scriptblock]$KeySelector,
        [scriptblock]$TieBreakSelector
    )
    $array = [object[]]$Items
    if ($array.Length -le 1) { return $array }
    $comparison = [System.Comparison[object]] {
        param($a, $b)
        $ka = & $KeySelector $a
        $kb = & $KeySelector $b
        if ($ka -is [version]) {
            $c = $ka.CompareTo($kb)
        } else {
            $c = ([int]$ka).CompareTo([int]$kb)
        }
        if ($c -ne 0) { return $c }
        return [string]::CompareOrdinal((& $TieBreakSelector $a), (& $TieBreakSelector $b))
    }
    [System.Array]::Sort($array, $comparison)
    return $array
}

function Get-StateSessionFiles {
    if ($null -ne $script:stateSessionFileCache) { return $script:stateSessionFileCache }
    if (-not (Test-Path $stateSessionsDir)) { $script:stateSessionFileCache = @(); return $script:stateSessionFileCache }
    $script:stateSessionFileCache = @(Get-ChildItem -Path $stateSessionsDir -Filter "*.md" | ForEach-Object {
        $number = ($_.BaseName -split '-')[0]
        [PSCustomObject]@{
            Number = [int]$number
            Path   = $_.FullName
            Base   = $_.BaseName
        }
    })
    # Ordinamento totale (issue #284): numero crescente, nome del file come
    # chiave secondaria ORDINALE.
    $script:stateSessionFileCache = @(Sort-StateFiles -Items $script:stateSessionFileCache `
        -KeySelector { param($x) $x.Number } -TieBreakSelector { param($x) $x.Base })
    return $script:stateSessionFileCache
}

function Get-StateStoryFiles {
    if ($null -ne $script:stateStoryFileCache) { return $script:stateStoryFileCache }
    if (-not (Test-Path $stateStoriesDir)) { $script:stateStoryFileCache = @(); return $script:stateStoryFileCache }
    $script:stateStoryFileCache = @(Get-ChildItem -Path $stateStoriesDir -Filter "*.md" | ForEach-Object {
        $id = ($_.BaseName -split '-')[0]
        [PSCustomObject]@{
            Id   = $id
            Path = $_.FullName
            Base = $_.BaseName
        }
    })
    # NB: serve `$_.Id` esplicito, NON `$Id` shorthand. Con `[version]` come
    # primo token, la forma abbreviata non viene espansa da PowerShell 5.1:
    # tutti gli item hanno sort key `$null`, l'ordine degenera a quello di
    # `Get-ChildItem` (filesystem-dipendente). Vedi issue #79 e il gate
    # `scripts/test-aggregate-determinism.sh` (T1+T2).
    #
    # Issue #284: l'ordinamento e' reso TOTALE (chiave secondaria ORDINALE sul
    # nome del file): con `Sort-Object` una chiave di versione uguale lasciava
    # l'ordine finale dipendente dall'enumerazione del filesystem.
    $script:stateStoryFileCache = @(Sort-StateFiles -Items $script:stateStoryFileCache `
        -KeySelector { param($x) [version]$x.Id } -TieBreakSelector { param($x) $x.Base })
    return $script:stateStoryFileCache
}

# Contenuto di un file di state/, letto una sola volta per esecuzione.
function Get-StateContent {
    param([string]$Path)
    if (-not $script:stateContentCache.ContainsKey($Path)) {
        # PERF: `ReadAllText` al posto di `Get-Content -Raw`: stessa
        # decodifica UTF-8 (BOM rilevato e consumato) senza l'overhead del
        # cmdlet di PowerShell.
        $script:stateContentCache[$Path] = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    }
    return $script:stateContentCache[$Path]
}

# Frontmatter di un file di state/, parsato una sola volta per esecuzione.
function Get-StateParsed {
    param([string]$Path)
    if (-not $script:stateParsedCache.ContainsKey($Path)) {
        $script:stateParsedCache[$Path] = Parse-Frontmatter (Get-StateContent $Path)
    }
    return $script:stateParsedCache[$Path]
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
        # NB: il placeholder DEVE essere compreso tra i marker, altrimenti la
        # prima esecuzione "strippa" i marker vuoti dal file target e il successivo
        # --check fallisce con "marker assente" (visto per la prima volta durante
        # T10, issue #127, dove docs/state/sessions/ era vuoto). Mantenere i
        # marker sempre presenti garantisce idempotenza su qualsiasi stato
        # iniziale del repository.
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.AppendLine($markerSessionsStart)
        [void]$sb.AppendLine('_Nessuna sessione migrata in `docs/state/sessions/`._')
        [void]$sb.AppendLine($markerSessionsEnd)
        return ($sb.ToString().TrimEnd([char]10, [char]13)) -replace "`r`n", "`n"
    }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append($markerSessionsStart + "`n")
    [void]$sb.Append("" + "`n")
    [void]$sb.Append('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` leggendo `' + 'docs/state/sessions/*.md' + '`.' + "`n")
    [void]$sb.Append('> Rigenerare con `' + 'pwsh scripts/aggregate-state.ps1' + '`. NON editare a mano.' + "`n")
    [void]$sb.Append("> Aggregator version: 1 (ADR-0008, S25)." + "`n")
    [void]$sb.Append("" + "`n")
    foreach ($f in $files) {
        $parsed  = Get-StateParsed $f.Path
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
        # Placeholder compreso tra i marker (vedi nota in Build-Block-Sessions).
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.AppendLine($markerStoriesStart)
        [void]$sb.AppendLine('_Nessuna story migrata in `docs/state/stories/`._')
        [void]$sb.AppendLine($markerStoriesEnd)
        return ($sb.ToString().TrimEnd([char]10, [char]13)) -replace "`r`n", "`n"
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
        $parsed  = Get-StateParsed $f.Path
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
    if ($Start -eq $markerNextStepStart)        { return Build-Block-NextStep }
    if ($Start -eq $markerProgressStart)        { return Build-Block-Progress }
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
        $p = Get-StateParsed $f.Path
        if ($p.Frontmatter['merged'] -eq 'true') {
            $mergedSessions++
        }
    }

    # Latest migrated session
    $latestSession = $null
    if ($sessionCount -gt 0) { $latestSession = $sessions[-1] }
    $latestSessionInfo = ""
    if ($latestSession) {
        $parsed = Get-StateParsed $latestSession.Path
        $n = $parsed.Frontmatter['number']
        $t = $parsed.Frontmatter['title']
        $latestSessionInfo = "Ultima sessione migrata: **S$n** - $t"
    }

    # Stories per status
    $doneStories = @()
    foreach ($f in $stories) {
        $p = Get-StateParsed $f.Path
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
        # Placeholder compreso tra i marker (vedi Build-Block-Sessions).
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.AppendLine($markerIndexRoadmapStart)
        [void]$sb.AppendLine('_Nessuna sessione migrata in `docs/state/sessions/`._')
        [void]$sb.AppendLine($markerIndexRoadmapEnd)
        return ($sb.ToString().TrimEnd([char]10, [char]13)) -replace "`r`n", "`n"
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
        $parsed  = Get-StateParsed $f.Path
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
    # BACKLOG/BUNDLE), quindi oscilla di 1-2 run dopo ogni merge. Escludiamo i file
    # aggregator-managed dal calcolo della dimensione: il totale cosi ottenuto e stabile
    # e coincidente con la somma reale dei rimanenti file. Conteggi per categoria
    # invariati (i file sono ancora inclusi nel `Totale file` e nelle sottocategorie).
    # V3 (ADR-0008 V3, issue #127): README.md e' aggregator-managed dal blocco
    # NEXT-STEP e va escluso come gli altri (Story 1.1: senza esclusione il
    # totale oscillava di 1 run dopo ogni cambio di stato di una story).
    $aggregatorManaged = @('docs/SESSIONS.md', 'docs/INDEX.md', 'docs/11-BACKLOG.md', 'docs/BUNDLE.md', 'README.md')
    # Set per il lookup O(1) e codifica condivisa (PERF, Sessione 73).
    $managedSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$aggregatorManaged)
    $utf8 = [System.Text.Encoding]::UTF8

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
        if (-not [System.IO.File]::Exists($fullPath)) { continue }
        if ($managedSet.Contains($f)) {
            # PERF (Sessione 73, issue #224): per i file aggregator-managed la
            # dimensione calcolata veniva **scartata** (issue #86, opt A: sono
            # esclusi dal totale). Leggerli era quindi lavoro inutile:
            # `docs/SESSIONS.md` (504 KB), `docs/11-BACKLOG.md` (98 KB) e
            # `docs/INDEX.md` (30 KB) venivano letti e decodificati solo per
            # buttare il risultato.
            $excludedSizeFiles++
            continue
        }
        # Issue #88: usare la dimensione del contenuto normalizzato a LF invece
        # di (Get-Item).Length, perche' con `core.autocrlf=true` su Windows 14
        # file di testo vengono serviti CRLF sul disco e il check su origin/main
        # (committed LF) generava un drift spurio cross-platform (~2.3 KB).
        # Il valore cosi ottenuto coincide con `git cat-file -s HEAD:<file>` ed e
        # quindi identico su Windows / Linux / macOS.
        #
        # PERF: `ReadAllText` + conteggio CRLF senza allocare una seconda
        # stringa, al posto di `Get-Content -Raw` + `-replace` (che allocava
        # una copia di ~2,4 MB solo per normalizzare i line ending).
        $fileText = $null
        try { $fileText = [System.IO.File]::ReadAllText($fullPath, $utf8) } catch { $fileText = $null }
        if ($null -ne $fileText) {
            $crlf = 0
            $idx = 0
            while (($idx = $fileText.IndexOf("`r`n", $idx)) -ge 0) { $crlf++; $idx += 2 }
            # Ogni CRLF -> LF rimuove esattamente un byte.
            $size = $utf8.GetByteCount($fileText) - $crlf
        } else {
            # File binario o illeggibile come UTF-8: usa la dimensione raw.
            $size = (Get-Item -LiteralPath $fullPath).Length
        }
        $totalSize += $size
    }

    $totalKB = [math]::Round($totalSize / 1KB, 1)
    # Issue #284: il rendering del numero usa la locale INVARIANTE: con la
    # locale corrente lo stesso input produceva "716,6 KB" su it-IT e
    # "716.6 KB" su en-US — due blocchi diversi per lo stesso stato. Il
    # formato (`.ToString(culture)`) preserva la resa attuale ("716" per un
    # valore intero) e cambia solo il separatore decimale.
    $totalKBText = $totalKB.ToString($InvariantCulture)
    # UTC + locale invariante: il timestamp non dipende ne' dal fuso orario del
    # runner ne' dalla sua lingua.
    $timestamp = [DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm', $InvariantCulture)

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
    } else { " (nessuno escluso dal calcolo: i file aggregator-managed non sono in `$files)" }
    [void]$sb.AppendLine("- Dimensione totale: $totalKBText KB$excludedNote")
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

# === V3 (ADR-0008 V3, issue #127) ===
# Blocco "Prossima story" sul README.md: sostituisce la stringa manuale
# "Prossima sbloccata" che era andata in drift silenzioso (Story 0.2 chiuse
# gia' con PR #4 merge `fa09b06` 2026-10-17 ma il README continuava a
# dichiararla come prossima). Sorgente di verita' = `docs/state/stories/*.md`
# (frontmatter `status`). L'agregator:
#   1. elenca tutti i file in docs/state/stories/
#   2. filtra quelli con status != done (incluse le entry mancanti, trattate come todo)
#   3. ordina per Id via `[version]` (tie-break su Base) per determinismo
#   4. emette il primo id come prossima story + l'elenco dei successivi
# Fallback graceful: se non ci sono entry non-done, emette un messaggio esplicito.
#
# Issue #182: il blocco indica **la prossima story da implementare**, quindi
# esclude anche le story che non sono lavorabili:
#   - `blocked` (STOP): bloccata da una dipendenza esterna (es. Story 2.1,
#     che aspetta le audio features dell'EPIC 4.1);
#   - `wontdo` (NO): PR rifiutata o scope cancellato.
# Restano elencate `todo` (TODO), `in_progress` (IN PROGRESS) e `in_review`
# (IN REVIEW): sono in lavorazione, non bloccate, e il blocco ricorda comunque
# come filtrare le candidate libere (`gh issue list --label agent-ready
# --state open`).
function Build-Block-NextStep {
    $files = @(Get-StateStoryFiles)
    $candidates = New-Object System.Collections.Generic.List[object]
    foreach ($f in $files) {
        $p = Get-StateParsed $f.Path
        if ($null -eq $p) { continue }
        $status = $p.Frontmatter['status']
        # Non sono "da implementare": gia' fatte, bloccate o annullate.
        if ($status -eq 'done' -or $status -eq 'blocked' -or $status -eq 'wontdo') { continue }
        $priority = if ($p.Frontmatter['priority']) { $p.Frontmatter['priority'] } else { 'I' }
        $id = if ($p.Frontmatter['id']) { $p.Frontmatter['id'] } else { $f.Base }
        $title = if ($p.Frontmatter['title']) { $p.Frontmatter['title'] } else { $f.Base }
        [void]$candidates.Add([PSCustomObject]@{
            Id       = $id
            Title    = $title
            Priority = $priority
            Base     = $f.Base
        })
    }
    # NB: `Sort-Object { [version]$_.Id }` e' obbligatorio per il determinismo
    # cross-platform (Windows vs Linux enumerano docs/state/stories/ in ordine
    # diverso senza sort per valore). Tie-break su Base (gia' univoco qui
    # perche' i path sono distinti). Vedi issue #70 + T1/T2 del test.
    $sorted = @($candidates | Sort-Object { [version]$_.Id })

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine($markerNextStepStart)
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` (V3, ADR-0008, issue #127).')
    [void]$sb.AppendLine('> Rigenerare con `' + 'pwsh scripts/aggregate-state.ps1' + '`. NON editare a mano.')
    [void]$sb.AppendLine('')
    if ($sorted.Count -eq 0) {
        [void]$sb.AppendLine('_Nessuna story non-done e non bloccata migrata in `' + 'docs/state/stories/' + '`._')
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine('Vedi `' + 'docs/11-BACKLOG.md' + '` per la roadmap completa e `' + 'docs/state/_index.md' + '` per la procedura di migration.')
    } else {
        $top = $sorted[0]
        [void]$sb.AppendLine('**Prossima story da implementare**: **' + $top.Id + '** — ' + $top.Title + ' (priority `' + $top.Priority + '`, vedi `' + 'docs/11-BACKLOG.md' + '`).')
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine('Sorgente: `' + 'docs/state/stories/' + $top.Base + '.md' + '`. Issue candidabile: filtra con `' + 'gh issue list --label agent-ready --state open' + '` (vedi `' + 'docs/11-BACKLOG.md' + '` §"Priorità di lavorazione per agenti").')
        if ($sorted.Count -gt 1) {
            $restIds = (($sorted | Select-Object -Skip 1) | ForEach-Object { "$($_.Id)" }) -join ', '
            [void]$sb.AppendLine('')
            [void]$sb.AppendLine('Altre non-done e non bloccate in ordine di priorita backlog (id): ' + $restIds + '.')
        }
    }
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine($markerNextStepEnd)
    return ($sb.ToString().TrimEnd([char]10, [char]13)) -replace "`r`n", "`n"
}

# === ADR-0008 V4 (issue #216) — indicatore di avanzamento ===

# Pesi di effort per la percentuale pesata: i tag `[SIZE:...]` vivono negli
# heading `### Story` di `docs/11-BACKLOG.md` (le Story 5.1 e 5.2 non hanno il
# tag: default M, dichiarato qui perche' il default e' una decisione, non un
# accidento del parser).
$ProgressSizeWeights = @{ 'S' = 1; 'M' = 2; 'L' = 3; 'XL' = 4 }
$ProgressDefaultSize = 'M'

# Gate di testabilita': milestone che il project owner vuole poter verificare.
# Un gate e' soddisfatto quando TUTTE le story indicate sono `done`.
# Dichiarati qui (unico posto) perche' il blocco li rende leggibili senza
# doverli ricalcolare a mano a ogni sessione.
$ProgressGates = @(
    @{ Label = "Test end-to-end dell'app";       Epic = '3' },
    @{ Label = "Motore di analisi completo";     Epic = '2' },
    @{ Label = "Test con dati personali reali";  Stories = @('5.2') }
)

function Get-SizeWeight {
    param([string]$Size)
    if ($Size -and $ProgressSizeWeights.ContainsKey($Size)) { return $ProgressSizeWeights[$Size] }
    return $ProgressSizeWeights[$ProgressDefaultSize]
}

function Get-Percent {
    param([double]$Value)
    # MidpointRounding.AwayFromZero: il default di [math]::Round in PowerShell
    # e' il bankers' rounding (0.5 -> 0), mentre la lettura umana di una
    # percentuale arrotonda .5 per eccesso (e `Math.round` in JavaScript
    # fa lo stesso). Senza l'esplicito, lo stesso input produceva percentuali
    # diverse a seconda del linguaggio che leggeva il blocco.
    return [int][math]::Round($Value, 0, [System.MidpointRounding]::AwayFromZero)
}

function Get-RoadmapCatalogue {
    # Catalogo delle story: letto dagli heading "### Story <id> ..." di
    # `docs/11-BACKLOG.md`.
    #
    # Perche' il backlog e non `docs/state/stories/`: i state file esistono
    # solo per le story gia' claimate (20 su 28 al 2026-10-31). Calcolare la
    # percentuale su quella sola fonte darebbe un denominatore falsato: il
    # 100% sarebbe raggiunto con 8 story mai scritte. Il backlog e' la roadmap
    # APPROVED e dichiara TUTTE le story, quindi e' il denominatore giusto; lo
    # stato di ciascuna story arriva dai state file (ASSR-0008: la sorgente
    # atomica dello stato resta `docs/state/`).
    $backlog = Join-Path $repoRoot "docs/11-BACKLOG.md"
    if (-not (Test-Path $backlog)) { return @() }
    $text = Get-Content -LiteralPath $backlog -Raw -Encoding UTF8

    $epicNames = @{}
    foreach ($m in [regex]::Matches($text, '(?m)^##\s+EPIC\s+(?<id>\d+)\s+[-\u2013\u2014]\s*(?<name>[^\r\n(]+)')) {
        $epicNames[$m.Groups['id'].Value] = $m.Groups['name'].Value.Trim()
    }

    $items = New-Object System.Collections.Generic.List[object]
    foreach ($m in [regex]::Matches($text, '(?m)^###\s+Story\s+(?<id>\d+\.\d+)\s+[-\u2013\u2014]\s*(?<rest>[^\r\n]*)$')) {
        $id   = $m.Groups['id'].Value
        $rest = $m.Groups['rest'].Value
        # Il titolo finisce dove iniziano i tag `[PHASE-...]`.
        $cut = $rest.IndexOf('`[')
        $title = if ($cut -ge 0) { $rest.Substring(0, $cut).Trim() } else { $rest.Trim() }
        $sizeMatch = [regex]::Match($rest, '\[SIZE:(?<size>[A-Za-z]+)\]')
        $size = if ($sizeMatch.Success) { $sizeMatch.Groups['size'].Value.ToUpperInvariant() } else { $ProgressDefaultSize }
        $epic = ($id -split '\.')[0]
        $epicName = if ($epicNames.ContainsKey($epic)) { $epicNames[$epic] } else { "EPIC $epic" }
        [void]$items.Add([PSCustomObject]@{
            Id       = $id
            Title    = $title
            Epic     = $epic
            EpicName = $epicName
            Size     = $size
        })
    }
    # NB: senza il wrapper `,` l'array viene enumerato dal pipeline e il
    # chiamante riceve gli elementi uno a uno (con `@(...)` tornano gli item).
    # Con il wrapper, `@(...)` avrebbe un unico elemento (l'array) e il
    # conteggio delle story sarebbe 1: il denominatore falsato.
    return $items.ToArray()
}

function Get-ProgressModel {
    # Il modello viene calcolato una volta per run: la verifica di coerenza
    # (fail-closed sul catalogo) deve scattare PRIMA delle scritture, quindi
    # viene calcolata in preflight e riusata dal report.
    if ($null -ne $script:ProgressModelCache) { return $script:ProgressModelCache }

    $catalogue = @(Get-RoadmapCatalogue)

    # Stato delle story migrate: frontmatter `status` dei file in
    # `docs/state/stories/`. Una story senza state file non e' mai stata
    # claimata: vale `todo`.
    $states = @{}
    foreach ($f in @(Get-StateStoryFiles)) {
        $content = Get-Content -LiteralPath $f.Path -Raw -Encoding UTF8
        $parsed = Parse-Frontmatter $content
        if ($null -eq $parsed) { continue }
        $id = if ($parsed.Frontmatter['id']) { $parsed.Frontmatter['id'] } else { $f.Base }
        $status = if ($parsed.Frontmatter['status']) { $parsed.Frontmatter['status'] } else { 'todo' }
        $states[$id] = [PSCustomObject]@{ Status = $status; Base = $f.Base }
    }

    if ($catalogue.Count -eq 0) {
        # Nessun catalogo (backlog assente): il blocco resta un placeholder
        # invece di far fallire l'aggregazione. Nel repo reale il backlog
        # esiste sempre: questa via serve ai repo di test.
        $script:ProgressModelCache = [PSCustomObject]@{ Available = $false; Total = 0; Rows = @() }
        return $script:ProgressModelCache
    }

    # Fail-closed (issue #216, AC3): uno state file che descrive una story
    # assente dal backlog rende il denominatore sbagliato, e una percentuale
    # falsa e' peggio di nessuna percentuale. Interrompe l'aggregazione con
    # un messaggio che dice cosa riallineare.
    $catalogueIds = @{}
    foreach ($c in $catalogue) { $catalogueIds[$c.Id] = $true }
    $orphans = @()
    foreach ($id in @($states.Keys | Sort-Object)) {
        if (-not $catalogueIds.ContainsKey($id)) { $orphans += $id }
    }
    if ($orphans.Count -gt 0) {
        # Fail-closed esplicito: `exit 2` termina lo script con codice non-zero
        # e il messaggio dice cosa riallineare. Una `throw` lascerebbe l'errore
        # al wrapping di PowerShell (exit 1 + stack trace): il codice non-zero
        # ci sarebbe, ma il messaggio utile no.
        Write-Host ("[FAIL] $($orphans.Count) state file di story che il backlog non dichiara: " +
                    ($orphans -join ', ') +
                    ". Il denominatore della percentuale sarebbe sbagliato: riallineare docs/11-BACKLOG.md e docs/state/stories/ (issue #216, AC3).") -ForegroundColor Red
        exit 2
    }

    $rows = New-Object System.Collections.Generic.List[object]
    $done = 0; $inProgress = 0; $todo = 0; $blocked = 0; $wontdo = 0
    $weightDone = 0; $weightTotal = 0
    foreach ($c in $catalogue) {
        $status = if ($states.ContainsKey($c.Id)) { $states[$c.Id].Status } else { 'todo' }
        $w = Get-SizeWeight $c.Size
        $weightTotal += $w
        if ($status -eq 'done') { $done++; $weightDone += $w }
        elseif ($status -eq 'in_progress' -or $status -eq 'in_review') { $inProgress++ }
        elseif ($status -eq 'blocked') { $blocked++ }
        elseif ($status -eq 'wontdo') { $wontdo++ }
        else { $todo++ }
        [void]$rows.Add([PSCustomObject]@{
            Id       = $c.Id
            Title    = $c.Title
            Epic     = $c.Epic
            EpicName = $c.EpicName
            Size     = $c.Size
            Status   = $status
            Weight   = $w
        })
    }

    $total = $catalogue.Count
    $percent = if ($total -gt 0) { Get-Percent (100.0 * $done / $total) } else { 0 }
    $percentWeighted = if ($weightTotal -gt 0) { Get-Percent (100.0 * $weightDone / $weightTotal) } else { 0 }

    # Raggruppamento per EPIC (ordinamento numerico: 0, 1, 2, ... e non
    # lessicografico, che metterebbe "10" prima di "2").
    $epics = New-Object System.Collections.Generic.List[object]
    foreach ($grp in @($rows | Group-Object -Property Epic | Sort-Object { [int]$_.Name })) {
        $epicDone = @($grp.Group | Where-Object { $_.Status -eq 'done' }).Count
        $epicRows = @($grp.Group)
        $epicTotal = $epicRows.Count
        $epicPercent = if ($epicTotal -gt 0) { Get-Percent (100.0 * $epicDone / $epicTotal) } else { 0 }
        $epicName = $epicRows[0].EpicName
        [void]$epics.Add([PSCustomObject]@{
            Epic     = $grp.Name
            EpicName = $epicName
            Done     = $epicDone
            Total    = $epicTotal
            Percent  = $epicPercent
        })
    }

    $model = [PSCustomObject]@{
        Available       = $true
        Total           = $total
        Done            = $done
        InProgress      = $inProgress
        Todo            = $todo
        Blocked         = $blocked
        Wontdo          = $wontdo
        Remaining       = $total - $done - $wontdo
        Percent         = $percent
        PercentWeighted = $percentWeighted
        WeightDone      = $weightDone
        WeightTotal     = $weightTotal
        Rows            = $rows.ToArray()
        Epics           = $epics.ToArray()
    }
    $script:ProgressModelCache = $model
    return $model
}

function Get-StatusLabel {
    param([string]$Status)
    switch ($Status) {
        'done'        { return 'completata' }
        'in_progress' { return 'in corso' }
        'in_review'   { return 'in review' }
        'blocked'     { return 'bloccata' }
        'wontdo'      { return 'annullata' }
        default       { return 'da fare' }
    }
}

function Get-LatestSessionAnalysis {
    # Analisi narrativa dell'ultima sessione: sezione "## Analisi di avanzamento"
    # dentro `docs/state/sessions/<N>-*.md`. E' il posto dove l'agente scrive
    # l'analisi di fine implementazione: l'aggregator la rende accanto ai
    # numeri, cosi' il report finale e' "la mia analisi + i numeri" senza
    # doppio lavoro manuale.
    $sessions = @(Get-StateSessionFiles)
    if ($sessions.Count -eq 0) { return $null }
    $latest = $sessions[-1]
    $content = Get-Content -LiteralPath $latest.Path -Raw -Encoding UTF8
    $m = [regex]::Match($content, '(?ms)^##\s+Analisi di avanzamento\s*\r?\n(.*?)(?=^##\s|\z)')
    if (-not $m.Success) { return $null }
    $text = $m.Groups[1].Value.Trim()
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    $parsed = Parse-Frontmatter $content
    $number = if ($parsed -and $parsed.Frontmatter['number']) { $parsed.Frontmatter['number'] } else { '?' }
    return [PSCustomObject]@{ Number = $number; Text = $text }
}

function Get-ProgressReport {
    # Corpo del report (senza marker): numeri, tabella per EPIC, story
    # rimanenti, gate di testabilita' e analisi della sessione corrente.
    #
    # Le lettere accentate sono costruite a runtime: il sorgente resta ASCII
    # (PS 5.1 su file UTF-8 senza BOM legge i non-ASCII con la codepage ANSI,
    # vedi issue #63).
    $accA = [char]0x00E0   # a con accento grave
    $accE = [char]0x00E8   # e con accento grave
    $model = Get-ProgressModel
    $sb = New-Object System.Text.StringBuilder
    if (-not $model.Available) {
        [void]$sb.AppendLine('_Catalogo delle story non disponibile: `docs/11-BACKLOG.md` non e'' leggibile._')
        return ($sb.ToString().TrimEnd([char]10, [char]13)) -replace "`r`n", "`n"
    }

    # Barra di avanzamento: 30 celle, caratteri costruiti a runtime per non
    # introdurre byte non-ASCII nel sorgente (PS 5.1 su file UTF-8 senza BOM
    # legge i non-ASCII con la codepage ANSI: vedi issue #63).
    $barWidth = 30
    $filled = [int][math]::Round($barWidth * $model.Percent / 100.0)
    if ($filled -lt 0) { $filled = 0 }
    if ($filled -gt $barWidth) { $filled = $barWidth }
    $bar = ([string][char]0x2588) * $filled + ([string][char]0x2591) * ($barWidth - $filled)

    [void]$sb.AppendLine("**Implementazione: $($model.Percent)%** - $($model.Done) story completate su $($model.Total) - effort pesato $($model.PercentWeighted)% - **mancano $($model.Remaining) step**")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("``$bar`` $($model.Percent)%")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('| EPIC | Completate | Totale | % | Stato |')
    [void]$sb.AppendLine('|------|-----------|--------|---|-------|')
    foreach ($e in $model.Epics) {
        $state = if ($e.Done -eq $e.Total) { 'completo' } elseif ($e.Done -gt 0) { 'in corso' } else { 'da fare' }
        [void]$sb.AppendLine("| EPIC $($e.Epic) - $($e.EpicName) | $($e.Done) | $($e.Total) | $($e.Percent)% | $state |")
    }
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("**Distribuzione**: $($model.Done) `done` - $($model.InProgress) in corso - $($model.Todo) da fare - $($model.Blocked) bloccate - $($model.Wontdo) annullate")
    [void]$sb.AppendLine('')

    $remaining = @($model.Rows | Where-Object { $_.Status -ne 'done' -and $_.Status -ne 'wontdo' })
    if ($remaining.Count -eq 0) {
        [void]$sb.AppendLine("**Step ancora da implementare**: nessuno - il piano del backlog $accE completo.")
    } else {
        [void]$sb.AppendLine("**Step ancora da implementare** ($($remaining.Count)):")
        foreach ($r in $remaining) {
            [void]$sb.AppendLine("- $($r.Id) $($r.Title) - $(Get-StatusLabel $r.Status) (size $($r.Size))")
        }
    }
    [void]$sb.AppendLine('')

    [void]$sb.AppendLine("**Gate di testabilit$accA**")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('| Gate | Requisito | Stato |')
    [void]$sb.AppendLine('|------|-----------|-------|')
    foreach ($g in $ProgressGates) {
        if ($g.Epic) {
            $rows = @($model.Rows | Where-Object { $_.Epic -eq $g.Epic })
            $done = @($rows | Where-Object { $_.Status -eq 'done' }).Count
            $total = $rows.Count
            $req = "EPIC $($g.Epic) ($total story)"
        } else {
            $rows = @($model.Rows | Where-Object { $g.Stories -contains $_.Id })
            $done = @($rows | Where-Object { $_.Status -eq 'done' }).Count
            $total = $rows.Count
            $req = ($g.Stories -join ', ')
        }
        $state = if ($total -gt 0 -and $done -eq $total) { 'soddisfatto' } elseif ($done -gt 0) { 'in corso' } else { 'non ancora' }
        [void]$sb.AppendLine("| $($g.Label) | $req | $done/$total - $state |")
    }
    [void]$sb.AppendLine('')

    $analysis = Get-LatestSessionAnalysis
    if ($analysis) {
        [void]$sb.AppendLine("**Analisi della sessione corrente** (S$($analysis.Number))")
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine($analysis.Text)
    } else {
        [void]$sb.AppendLine('**Analisi della sessione corrente**: non ancora registrata (sezione `## Analisi di avanzamento` nel file di sessione).')
    }

    return ($sb.ToString().TrimEnd([char]10, [char]13)) -replace "`r`n", "`n"
}

function Build-Block-Progress {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine($markerProgressStart)
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('> Blocco auto-generato da `' + 'scripts/aggregate-state.ps1' + '` (V4, ADR-0008, issue #216).')
    [void]$sb.AppendLine('> Rigenerare con `' + 'pwsh scripts/aggregate-state.ps1' + '`. NON editare a mano.')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine((Get-ProgressReport))
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine($markerProgressEnd)
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

function Get-NormalizedBlock {
    # Issue #142: normalizza i campi mutabili (l'unico oggi e' "Ultima aggregazione")
    # per poter confrontare due blocchi a parita' di contenuto.
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Text)
    return ($Text -replace '(?m)^- Ultima aggregazione: .+$', '- Ultima aggregazione: 0000-00-00 00:00') -replace "`r`n", "`n"
}

function Sync-MutableTimestamp {
    # Issue #142: riusa del valore gia' presente nel blocco su disco invece di
    # ristamparlo a ogni run.
    #
    # La garanzia "il timestamp viene riusato quando il blocco non cambia altro"
    # (issue #70, AGENTS.md -> Determinismo e idempotenza) era documentata e
    # verificata solo in -Check, dove la normalizzazione maschera il campo: nel
    # path di scrittura il timestamp veniva ristampato a ogni run. Con
    # granularita' al minuto, due run ravvicinati che strappano il confine di
    # minuto producevano un diff di una riga: era cioe' esattamente il
    # "commit-rumore su main" che la garanzia prometteva di eliminare, e rendeva
    # T3 di test-aggregate-determinism.sh dipendente dall'orologio.
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string]$Calculated,
        [Parameter(Mandatory)][AllowEmptyString()][string]$Existing
    )
    $m = [regex]::Match($Existing, '(?m)^- Ultima aggregazione: (.+)$')
    if (-not $m.Success) { return $Calculated }
    $stamp = $m.Groups[1].Value.Trim()
    if ([string]::IsNullOrWhiteSpace($stamp)) { return $Calculated }
    return $Calculated -replace '(?m)^- Ultima aggregazione: .+$', "- Ultima aggregazione: $stamp"
}

function Apply-Blocks {
    # Issue #216: il fail-closed del denominatore (state file che il backlog non
    # dichiara) deve scattare PRIMA di scrivere qualsiasi blocco: se scattasse
    # dentro il ciclo, il run avrebbe gia' riscritto i primi target e poi
    # abbandonerebbe il repo a meta' (blocchi aggiornati, blocco progress
    # assente). La validazione costa una decina di file: e' trascurabile.
    $null = Get-ProgressModel

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
        $content = [System.IO.File]::ReadAllText((Join-Path $repoRoot $path), [System.Text.Encoding]::UTF8)
        $found = Find-Block $content $start $end
        if ($null -eq $found) {
            Write-Host "[INSERT] $path - marker non presente, append in fondo" -ForegroundColor Cyan
            $separator = [char]10 + [char]10
            $new = $content.TrimEnd() + $separator + $calculated
        } else {
            # Issue #142: se il blocco non cambia nulla tranne il timestamp, riusa
            # quello gia' su disco: due run consecutivi producono allora zero diff
            # e `auto-state-aggregate` non committa a vuoto su `main`.
            if ((Get-NormalizedBlock $found.Block) -eq (Get-NormalizedBlock $calculated)) {
                $calculated = Sync-MutableTimestamp -Calculated $calculated -Existing $found.Block
            }
            $new = $content.Substring(0, $found.StartIndex) + $calculated + $content.Substring($found.EndIndex)
        }
        if ($DryRun) {
            Write-Host "[DRY] $path - $($calculated.Length) chars calcolati" -ForegroundColor Cyan
        } else {
            # Issue #58: WriteAllText con UTF-8 no BOM. Il -replace CRLF, LF e
            # l'uso di Append(... + "`n") invece di AppendLine garantiscono LF uniforme
            # su Windows (che altrimenti userebbe CRLF default).
            # PERF (Sessione 73): `.Replace()` al posto di `-replace`: il pattern
            # e' un letterale (nessun metacarattere di regex), quindi il risultato
            # e' identico, ma l'operazione passa da una scansione regex a un
            # confronto ordinale. Su `docs/BUNDLE.md` (2,4 MB) la differenza si
            # misura in decine di millisecondi per run.
            $new = $new.Replace("`r`n", "`n")
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

    # Issue #216: lo stesso fail-closed del denominatore scatta in --check: uno
    # state file che il backlog non dichiara rende il denominatore sbagliato e
    # il check deve dirlo invece di passare su un blocco formalmente "in sync".
    $null = Get-ProgressModel

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
        $content = [System.IO.File]::ReadAllText((Join-Path $repoRoot $path), [System.Text.Encoding]::UTF8)
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
        # Issue #142: la stessa normalizzazione e' ora in Get-NormalizedBlock, usata
        # anche dal path di scrittura (Apply-Blocks) per il riuso del valore.
        $existingNorm = Get-NormalizedBlock $existing
        $calculatedNorm = Get-NormalizedBlock $calculated
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

# === Progress mode (issue #216) ===
#
# Stampa l'indicatore di avanzamento senza scrivere nulla: il project owner
# puo' chiedere "a che punto siamo" in qualunque momento senza toccare il
# repo. Stessa sorgente di verita' del blocco aggregato: catalogo del
# backlog + stato dei state file.

if ($Progress) {
    Write-Host ""
    Write-Host (Get-ProgressReport) -ForegroundColor Cyan
    Write-Host ""
    exit 0
}

# === Main dispatch ===

if ($Check) { Test-Blocks }

Apply-Blocks
exit 0
