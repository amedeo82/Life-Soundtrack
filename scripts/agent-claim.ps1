<#
.SYNOPSIS
    Presa in carico atomica di una story: worktree + label + claim + riverifica.

.DESCRIPTION
    ADR-0006 ha 8 regole VINCOLANTI sul claim, ma fino alla Sessione 80 non
    aveva alcun enforcement: la presa in carico era prosa, e due agenti
    potevano implementare la stessa story senza che nulla se ne accorgesse.

    Questo script esegue la presa in carico come sequenza atomica:

      1. valida l'issue (esiste, aperta, `agent-ready`, NON `in-progress`
         -- salvo modalita' -Stale, vedi sotto)
      2. crea la worktree isolata (delega a scripts/setup-worktree.ps1)
      3. aggiunge la label `in-progress` (se non gia' presente)
      4. posta il commento `claim: <agent-id> (UTC <ts>) -- worktree: <path>`
      5. RIVERIFICA: scarica i commenti di claim e verifica che il proprio
         abbia l'ID NUMERICO (API REST) piu' basso: vince chi ha commentato
         per primo. Il discriminatore e' l'id numerico, non il node_id GraphQL
         e non created_at (vedi AGENTS.md §"Presa in carico delle story").
      6. scrive il file di stato dell'agente (usato da hook e script)
      7. in caso di perdita: posta `yield:` ed esce SENZA rimuovere la label
         `in-progress`: serve al vincitore (ADR-0006, regola 4; AGENTS.md
         sezione "Procedura di claim", punto 4). Rimuoverla faceva ricomparire
         l'issue come "libera" nelle query degli altri agenti.

    TAKEOVER DI CLAIM SCADUTO (-Stale, ADR-0006 regola 5, TTL 12 ore):
    un claim senza attivita' per oltre 12 ore e' abbandonato. Con -Stale lo
    script accetta un'issue gia' `in-progress` a UNA condizione verificata:
    l'ultima attivita' del claim attivo (claim, commenti `progress:`,
    PR aperta per l'issue) risale a piu' di 12 ore fa. Allora posta
    `stale-release: <agente-del-claim> -- claim scaduto, ultima attivita'
    >12h` e prosegue con claim + riverifica (il filtro dei claim rilasciati
    esclude il claim stantio). Se il claim NON e' ancora scaduto, esce 5
    senza toccare nulla.

    Il file di stato vive FUORI dal working tree (nella directory git della
    worktree): non e' un file untracked, quindi non confonde l'hook
    pre-commit, e sparisce con la worktree.

    Exit code: 0 ok - 1 errore git/worktree - 2 errore ambiente/API - 3
    validazione issue - 4 riverifica persa (yield) - 5 claim non ancora
    scaduto (-Stale) - 6 worktree posseduta da un altro agente (issue #319).

.PARAMETER IssueNumber
    Numero dell'issue da prendere in carico.

.PARAMETER Slug
    Slug del branch (default: derivato dal titolo dell'issue).

.PARAMETER AgentId
    Identificatore dell'agente (default: <tool>-<hostname>-<4 caratteri>).

.PARAMETER SkipWorktree
    Non creare la worktree (l'agente lavora gia' in una worktree).

.PARAMETER Stale
    Consente la presa in carico di un claim SCADUTO (TTL 12 ore, ADR-0006
    regola 5): verifica l'eta' dell'ultima attivita' del claim attivo e, se
    supera le 12 ore, posta `stale-release:` e prosegue con claim + riverifica.

.PARAMETER Auto
    Procedura di ARBITRAGGIO (issue #319): invece di prendere in carico
    l'issue indicata, prende la prima issue CANDIDABILE **libera** secondo
    l'ordine di `docs/11-BACKLOG.md` (sezione "Priorita' di lavorazione per
    agenti"). La selezione smette di essere una scelta dell'agente: con lo
    stesso prompt, due agenti convergevano sulla stessa story; con `-Auto` il
    tentativo e' in ordine e la riverifica decide. Se l'issue candidata non e'
    piu' libera (exit 3), se il claim viene perso (exit 4) o se la worktree
    appartiene a un altro agente (exit 6), si passa alla successiva.

.PARAMETER DryRun
    Stampa cosa farebbe, senza toccare GitHub ne il filesystem.

.EXAMPLE
    pwsh scripts/agent-claim.ps1 256
    pwsh scripts/agent-claim.ps1 256 -DryRun
    pwsh scripts/agent-claim.ps1 283 -Stale   # claim senza attivita' da >12h
    pwsh scripts/agent-claim.ps1 -Auto       # prima issue libera in ordine di backlog
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [int]$IssueNumber = 0,
    [string]$Slug = "",
    [string]$AgentId = "",
    [switch]$SkipWorktree,
    [switch]$Stale,
    [switch]$DryRun,
    [switch]$Auto
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$repoSlug = (& gh repo view --json nameWithOwner --jq .nameWithOwner).Trim()
$repoApi = "repos/$repoSlug"

function Say([string]$msg, [string]$color = "Gray") { Write-Host "[agent-claim] $msg" -ForegroundColor $color }
function Die([int]$code, [string]$msg) { Write-Host "[agent-claim] ERRORE: $msg" -ForegroundColor Red; exit $code }

# Agente di un commento di claim: il primo token dopo il marker `claim:`.
function Get-ClaimAgent([object]$comment) {
    $m = [regex]::Match([string]$comment.body, '^\s*claim:\s*(\S+)')
    if ($m.Success) { return $m.Groups[1].Value }
    return ""
}

# Un claim RILASCIATO non conta nella riverifica ne' nella verifica di stantia'.
# AGENTS.md (sezione "Procedura di claim", punto 4) confronta l'ID piu' basso
# "tra i claim NON ANCORA RILASCIATI"; un claim e' rilasciato da un commento
# `release:` / `stale-release:` SUCCESSIVO che ne cita l'agente.
#
# Senza questo filtro la presa in carico di una claim STANTIA (TTL 12 ore di
# ADR-0006) sarebbe impossibile: il vecchio claim ha sempre l'ID piu' basso, e
# l'agente che subentra farebbe `yield:` pur avendo legittimamente preso
# l'issue. E' il caso verificato con la claim di `kilo-hp-elitebook-457a`
# sull'issue #283 (16 ore senza attivita', TTL 12 ore).
function Test-ClaimReleased([object]$claim, [object[]]$releases) {
    $claimAgent = Get-ClaimAgent $claim
    if ([string]::IsNullOrWhiteSpace($claimAgent)) { return $false }
    foreach ($rel in $releases) {
        # il rilascio deve essere SUCCESSIVO al claim che rilascia
        if ([int64]$rel.id -le [int64]$claim.id) { continue }
        if ([string]$rel.body -like "*$claimAgent*") { return $true }
    }
    return $false
}

# Takeover di claim scaduto (ADR-0006, regola 5: TTL 12 ore; AGENTS.md
# sezione "Mantenere il claim"). Verifica che l'ultima attivita' del claim attivo
# risalga a oltre 12 ore fa e restituisce l'agente del claim stantio.
# Attivita' che resetta il TTL: commit pushato, PR aperta, commento di
# progresso. Rilevabile qui: l'ultimo commento pertinente sull'issue (claim,
# `progress:`) e una PR APERTA il cui branch cita il numero dell'issue.
function Assert-ClaimStale {
    param([int]$IssueNumber)
    $ttlHours = 12
    $commentsRaw = & gh api "$repoApi/issues/$IssueNumber/comments" 2>$null
    if ($LASTEXITCODE -ne 0) { Die 2 "impossibile leggere i commenti dell'issue" }
    $allComments = @($commentsRaw | ConvertFrom-Json)
    $releaseComments = @($allComments | Where-Object { [string]$_.body -match '^\s*(release|stale-release)\s*:' })
    $active = @(@($allComments | Where-Object { $_.body -like "claim:*" } | Sort-Object { [int64]$_.id }) |
        Where-Object { -not (Test-ClaimReleased $_ $releaseComments) })
    if ($active.Count -eq 0) { Die 2 "nessun claim attivo trovato: la label 'in-progress' e' orfana, rilancia senza -Stale" }
    $claim = $active[0]   # la riverifica assegna l'issue all'ID piu' basso: vale anche qui
    $agent = Get-ClaimAgent $claim
    $lastActivity = [datetimeoffset]::Parse([string]$claim.created_at).UtcDateTime
    foreach ($c in $allComments) {
        if ([int64]$c.id -le [int64]$claim.id) { continue }
        $body = [string]$c.body
        $isRelease = $body -match '^\s*(release|stale-release)\s*:'
        if ((-not $isRelease) -and ($body -like "*$agent*")) {
            $t = [datetimeoffset]::Parse([string]$c.created_at).UtcDateTime
            if ($t -gt $lastActivity) { $lastActivity = $t }
        }
    }
    $prJson = & gh pr list --state open --limit 100 --json number,headRefName,updatedAt 2>$null
    if ($LASTEXITCODE -eq 0 -and $prJson) {
        foreach ($pr in @($prJson | ConvertFrom-Json)) {
            if ("$($pr.headRefName)" -match "^(feat|fix)/$IssueNumber-") {
                $t = [datetimeoffset]::Parse([string]$pr.updatedAt).UtcDateTime
                if ($t -gt $lastActivity) { $lastActivity = $t }
            }
        }
    }
    $ageHours = ((Get-Date).ToUniversalTime() - $lastActivity).TotalHours
    if ($ageHours -le $ttlHours) {
        Die 5 ("claim di {0} non ancora scaduto: ultima attivita' {1:N1} ore fa (TTL {2} ore)" -f $agent, $ageHours, $ttlHours)
    }
    Say ("claim di {0} inattivo da {1:N1} ore (> TTL {2}h): takeover ammesso" -f $agent, $ageHours, $ttlHours) "Yellow"
    return $agent
}

# --- claim attivo sull'issue (issue #319) --------------------------------------
# Il claim vincente e' quello con l'id NUMERICO piu' basso fra i claim non
# ancora rilasciati. Serve al lock di proprieta' della worktree: l'owner
# locale (`agent-state.json`) deve coincidere con il vincitore.
function Get-ActiveClaimWinner([int]$issue) {
    $raw = & gh api "$repoApi/issues/$issue/comments" 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    $all = @($raw | ConvertFrom-Json)
    $releases = @($all | Where-Object { [string]$_.body -match '^\s*(release|stale-release)\s*:' })
    $active = @(@($all | Where-Object { $_.body -like "claim:*" } | Sort-Object { [int64]$_.id }) |
        Where-Object { -not (Test-ClaimReleased $_ $releases) })
    if ($active.Count -eq 0) { return $null }
    $c = $active[0]
    return [pscustomobject]@{ id = [int64]$c.id; agent = (Get-ClaimAgent $c) }
}

# --- lock di proprieta' della worktree (issue #319) ---------------------------
# ADR-0006 blocca l'ISSUE, non la directory: il path della worktree e'
# deterministico (`ls-<N>-<slug>`), quindi due agenti che puntano alla stessa
# story finiscono nella stessa cartella. Qui la worktree esistente viene
# confrontata con il claim attivo:
#   - owner diverso dal claim vincente -> exit 6 (nessuna scrittura su GitHub)
#   - owner uguale al claim vincente   -> la worktree e' gia' nostra
#   - nessun owner (orfana)             -> adottabile dal vincitore
function Assert-WorktreeOwnership([string]$path) {
    $wtState = $null
    $gitDir = (& git -C $path rev-parse --absolute-git-dir 2>$null)
    if ($LASTEXITCODE -eq 0 -and $gitDir) {
        $statePath = Join-Path $gitDir.Trim() "agent-state.json"
        if (Test-Path $statePath) {
            try { $wtState = (Get-Content $statePath -Raw | ConvertFrom-Json) } catch { $wtState = $null }
        }
    }
    if (-not $wtState) {
        Say "worktree senza stato (orfana): nessun owner dichiarato" "Yellow"
        $dirty = (& git -C $path status --porcelain 2>$null)
        if ($dirty) {
            Say "ATTENZIONE: la worktree orfana ha modifiche non committate: verifica prima di adottarla" "Yellow"
        }
        return
    }
    $owner = [string]$wtState.agent_id
    if ([string]::IsNullOrWhiteSpace($owner)) { return }
    $winner = Get-ActiveClaimWinner $IssueNumber
    if ($winner -and $winner.agent -ne $owner) {
        Die 6 ("la worktree '$path' appartiene all'agente $($winner.agent) (claim $($winner.id) attivo sull'issue #$IssueNumber): non puoi lavorarci. Scegli un'altra issue.")
    }
    if ($winner) {
        Say "la worktree e' gia' di questo agente ($owner, claim $($winner.id))" "Green"
        return
    }
    Say "worktree orfana (nessun claim attivo): adottabile" "Yellow"
}

# --- ordine di backlog (issue #319) -------------------------------------------
# L'ordine di tentativo delle story e' quello di `docs/11-BACKLOG.md`, sezione
# "Priorita' di lavorazione per agenti": la lista numerata delle story.
function Get-BacklogStoryOrder {
    $backlog = Join-Path $repoRoot "docs/11-BACKLOG.md"
    if (-not (Test-Path $backlog)) { return @() }
    $text = [System.IO.File]::ReadAllText($backlog)
    $ids = @()
    foreach ($m in [regex]::Matches($text, '(?m)^\s*\d+\.\s+\*\*([^*]+)\*\*')) {
        foreach ($idm in [regex]::Matches($m.Groups[1].Value, '\d+\.\d+')) {
            $ids += $idm.Value
        }
    }
    return $ids
}

# Mappa story id -> numero issue, dai file di stato delle story.
function Get-StoryIssueMap {
    $map = @{}
    $dir = Join-Path $repoRoot "docs/state/stories"
    if (-not (Test-Path $dir)) { return $map }
    foreach ($f in Get-ChildItem $dir -Filter "*.md" -File) {
        $t = [System.IO.File]::ReadAllText($f.FullName)
        $idm = [regex]::Match($t, '(?m)^id:\s*"?([0-9.]+)"?\s*$')
        $issm = [regex]::Match($t, '(?m)^issue:\s*([0-9]+)\s*$')
        if ($idm.Success -and $issm.Success) {
            $map[$idm.Groups[1].Value] = [int]$issm.Groups[1].Value
        }
    }
    return $map
}

# Issue candidabili LIBERE, ordinate per priorita' di backlog.
function Get-CandidateIssues {
    $json = & gh issue list --state open --label agent-ready --limit 50 --json number,title,labels
    if ($LASTEXITCODE -ne 0) { Die 2 "impossibile leggere le issue candidabili" }
    $free = @(@($json | ConvertFrom-Json) | Where-Object {
        $names = @($_.labels | ForEach-Object { $_.name })
        -not ($names -contains 'in-progress') -and -not ($names -match '^status:')
    })
    if ($free.Count -eq 0) { return @() }
    $order = @(Get-BacklogStoryOrder)
    $map = Get-StoryIssueMap
    $rank = @{}
    for ($i = 0; $i -lt $order.Count; $i++) {
        $sid = $order[$i]
        if ($map.ContainsKey($sid)) {
            $issueNum = [int]$map[$sid]
            if (-not $rank.ContainsKey($issueNum)) { $rank[$issueNum] = $i }
        }
    }
    $tail = $order.Count + 1
    return @($free | Sort-Object `
        @{ Expression = { if ($rank.ContainsKey([int]$_.number)) { $rank[[int]$_.number] } else { $tail } } }, `
        @{ Expression = { [int]$_.number } })
}

# --- agent id ---------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($AgentId)) {
    $hostName = $env:COMPUTERNAME.ToLowerInvariant()
    $AgentId = "kilo-$hostName-$([guid]::NewGuid().ToString('N').Substring(0,4))"
}

# --- arbitraggio automatico (-Auto, issue #319) -------------------------------
# Con lo stesso prompt, due agenti avviati a pochi secondi di distanza
# convergevano sulla stessa story (il blocco NEXT-STEP e la query live delle
# issue libere indicano la stessa prima story). `-Auto` toglie la scelta
# all'agente: il tentativo e' in ordine di backlog, e la riverifica decide.
if ($Auto) {
    Say "modalita' -Auto: prendo in carico la prima issue libera in ordine di backlog" "Cyan"
    $candidates = @(Get-CandidateIssues)
    if ($candidates.Count -eq 0) {
        Die 3 "nessuna issue agent-ready libera: apri una issue needs-spec e termina la sessione"
    }
    $names = @($candidates | ForEach-Object { "#$($_.number)" })
    Say "candidati liberi, in ordine di tentativo: $($names -join ', ')" "DarkGray"
    if ($DryRun) {
        Say "[DRY-RUN] prenderei in carico $($names[0])" "Yellow"
        exit 0
    }
    foreach ($cand in $candidates) {
        $n = [int]$cand.number
        Say "provo #$n ($($cand.title))" "DarkGray"
        $childArgs = @("-NoProfile", "-File", $PSCommandPath, "$n", "-AgentId", $AgentId)
        if ($SkipWorktree) { $childArgs += "-SkipWorktree" }
        if ($Stale) { $childArgs += "-Stale" }
        & pwsh @childArgs | Out-Host
        $childExit = $LASTEXITCODE
        if ($childExit -eq 0) {
            Say "claim acquisito su #$n" "Green"
            exit 0
        }
        if ($childExit -in @(3, 4, 5, 6)) {
            Say "#$n non ottenibile (exit $childExit): passo alla successiva" "Yellow"
            continue
        }
        Die $childExit "il tentativo su #$n e' fallito (exit $childExit)"
    }
    Die 3 "nessuna issue ottenibile: apri una issue needs-spec e termina la sessione"
}

if ($IssueNumber -le 0) {
    Die 2 "manca il numero dell'issue (oppure usa -Auto per l'arbitraggio automatico)"
}

# --- 1. validazione dell'issue --------------------------------------------
Say "issue #$IssueNumber ..." "Cyan"
$issueRaw = & gh issue view $IssueNumber --json number,title,state,labels 2>$null
if ($LASTEXITCODE -ne 0) { Die 2 "issue #$IssueNumber non trovata o non accessibile" }
$issue = $issueRaw | ConvertFrom-Json
if ($issue.state -ne "OPEN") { Die 3 "issue #$IssueNumber non e' aperta (stato: $($issue.state))" }
$labels = @($issue.labels | ForEach-Object { $_.name })
if ($labels -notcontains "agent-ready") { Die 3 "issue #$IssueNumber non ha la label 'agent-ready' (labels: $($labels -join ', '))" }
if ($labels -match '^status:') { Die 3 "issue #$IssueNumber ha gia' una label status:* ($($labels -join ', '))" }

# Claim gia' attivo: ammesso solo in modalita' -Stale (takeover di claim
# scaduto, ADR-0006 regola 5 -- AGENTS.md sezione "Mantenere il claim").
$staleAgent = ""
if ($labels -contains "in-progress") {
    if (-not $Stale) {
        Die 3 "issue #$IssueNumber ha gia' la label 'in-progress': qualcun altro l'ha presa in carico (per un claim senza attivita' da oltre 12 ore, rilancia con -Stale)"
    }
    $staleAgent = Assert-ClaimStale $IssueNumber
}

$title = $issue.title
Say "titolo: $title" "DarkGray"

if ([string]::IsNullOrWhiteSpace($Slug)) {
    $base = ($title.ToLower() -replace '[^a-z0-9\-]+', '-') -replace '^-+|-+$', ''
    if ($base.Length -gt 40) { $base = $base.Substring(0, 40).TrimEnd('-') }
    $Slug = $base
}

# --- 2. worktree ------------------------------------------------------------
$worktreePath = $repoRoot
if (-not $SkipWorktree) {
    $worktreeParent = Split-Path -Parent $repoRoot
    $wtName = "ls-$IssueNumber-$Slug"
    $worktreePath = Join-Path $worktreeParent $wtName
    if (Test-Path $worktreePath) {
        Say "worktree gia' presente: $worktreePath" "Yellow"
        # Lock di proprieta' (issue #319): la worktree ha un path deterministico,
        # quindi due agenti sulla stessa story finiscono nella stessa cartella.
        # Qui la proprieta' viene confrontata con il claim attivo: se e' di un
        # altro agente, si esce con 6 **senza** toccare GitHub.
        Assert-WorktreeOwnership $worktreePath
    }
    else {
        Say "creo la worktree: $worktreePath" "Cyan"
        if (-not $DryRun) {
            & pwsh -NoProfile -File (Join-Path $PSScriptRoot "setup-worktree.ps1") $IssueNumber -Slug $Slug | Out-Host
            if ($LASTEXITCODE -ne 0) { Die 1 "setup-worktree.ps1 e' fallito (exit $LASTEXITCODE)" }
        }
    }
}

# --- 3./4. label e commento di claim ---------------------------------------
if ($DryRun) {
    Say "[DRY-RUN] aggiungerei 'in-progress' e posterei il commento di claim" "Yellow"
    Say "[DRY-RUN] farei la riverifica e scriverei il file di stato" "Yellow"
    exit 0
}

if ($labels -notcontains "in-progress") {
    Say "aggiungo la label 'in-progress' ..." "Cyan"
    & gh issue edit $IssueNumber --add-label "in-progress" | Out-Null
    if ($LASTEXITCODE -ne 0) { Die 1 "impossibile aggiungere la label 'in-progress'" }
}
else {
    Say "label 'in-progress' gia' presente (takeover -Stale): resta all'issue" "DarkGray"
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
if ($staleAgent) {
    # ADR-0006, regola 5: il commento `stale-release:` DEVE citare l'agente del
    # claim scaduto (e' il marker che la riverifica cerca per escluderlo).
    Say "posto il commento 'stale-release:' per il claim di $staleAgent ..." "Cyan"
    & gh issue comment $IssueNumber --body "stale-release: $staleAgent -- claim scaduto, ultima attivita' >12h (presa in carico: $AgentId)" | Out-Null
    if ($LASTEXITCODE -ne 0) { Die 1 "impossibile postare il commento stale-release" }
}
$claimBody = "claim: $AgentId (UTC $timestamp) -- worktree: $worktreePath"
Say "posto il commento di claim" "Cyan"
& gh issue comment $IssueNumber --body $claimBody | Out-Null
if ($LASTEXITCODE -ne 0) { Die 1 "impossibile postare il commento di claim" }

# --- 5. riverifica (deterministica) ----------------------------------------
Say "riverifico i claim..." "Cyan"
$commentsRaw = & gh api "$repoApi/issues/$IssueNumber/comments" 2>$null
if ($LASTEXITCODE -ne 0) { Die 2 "impossibile leggere i commenti dell'issue" }
$allComments = @($commentsRaw | ConvertFrom-Json)

$releaseComments = @($allComments | Where-Object { [string]$_.body -match '^\s*(release|stale-release)\s*:' })

$claims = @($allComments | Where-Object { $_.body -like "claim:*" } | Sort-Object { [int64]$_.id })
$activeClaims = @($claims | Where-Object { -not (Test-ClaimReleased $_ $releaseComments) })
if ($activeClaims.Count -eq 0) { Die 2 "nessun commento di claim ATTIVO trovato dopo la propria presa in carico" }
$mine = @($activeClaims | Where-Object { $_.body -like "*$AgentId*" })
if ($mine.Count -eq 0) { Die 2 "il proprio commento di claim non e' stato trovato fra i commenti" }
$mineId = [int64]$mine[0].id
$lowestId = [int64]($activeClaims | ForEach-Object { [int64]$_.id } | Measure-Object -Minimum).Minimum

if ($mineId -ne $lowestId) {
    Say "RIVERIFICA PERSA: un altro claim ha un ID piu' basso ($lowestId < $mineId) -> yield" "Red"
    # ADR-0006, regola 4 (AGENTS.md sezione "Procedura di claim", punto 4): il perdente
    # NON rimuove la label `in-progress` -- serve al vincitore. Rimuoverla faceva
    # ricomparire l'issue come "libera" nelle query degli altri contendenti.
    & gh issue comment $IssueNumber --body "yield: $AgentId -- riverifica persa (claim $mineId; ID piu' basso in carico: $lowestId)" | Out-Null
    Say "ABANDONA la worktree ${worktreePath}: il suo owner e' il vincitore della riverifica" "Red"
    Say "Non scrivere in quella directory e non rimuovere la label 'in-progress': passi alla prossima issue candidabile." "Red"
    exit 4
}
Say "riverifica OK: il claim $mineId e' il piu' basso" "Green"

# --- 6. file di stato dell'agente ------------------------------------------
$gitDir = (& git -C $worktreePath rev-parse --absolute-git-dir).Trim()
$stateDir = $gitDir
$stateFile = Join-Path $stateDir "agent-state.json"
$branch = (& git -C $worktreePath rev-parse --abbrev-ref HEAD).Trim()
$state = [ordered]@{
    issue       = $IssueNumber
    agent_id    = $AgentId
    branch      = $branch
    worktree    = $worktreePath
    claimed_at  = $timestamp
    claim_id    = $mineId
    pr          = $null
    session     = $null
}
# Scrittura ATOMICA del file di stato (issue #319): il file e' il lock della
# worktree, e due agenti che lo scrivono nello stesso momento non possono
# produrre un JSON troncato. Si scrive su un file temporaneo e si rinomina:
# la rinomina e' atomica sullo stesso volume.
$tmpState = "$stateFile.tmp"
[System.IO.File]::WriteAllText($tmpState, ($state | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
Move-Item -LiteralPath $tmpState -Destination $stateFile -Force
Say "file di stato: $stateFile" "DarkGray"

# --- 7. prossimi passi ------------------------------------------------------
Say "claim acquisito su #$IssueNumber (branch $branch)" "Green"
Write-Host ""
Write-Host "[agent-claim] prossimi passi:" -ForegroundColor Cyan
Write-Host "  1. cd `"$worktreePath`""
Write-Host "  2. implementa la story"
Write-Host "  3. pwsh scripts/agent-pr.ps1 -IssueNumber $IssueNumber   (apre la PR e scrive 'pr:' nella sessione)"
Write-Host ""
exit 0
