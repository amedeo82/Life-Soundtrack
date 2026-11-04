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
    scaduto (-Stale).

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

.PARAMETER DryRun
    Stampa cosa farebbe, senza toccare GitHub ne il filesystem.

.EXAMPLE
    pwsh scripts/agent-claim.ps1 256
    pwsh scripts/agent-claim.ps1 256 -DryRun
    pwsh scripts/agent-claim.ps1 283 -Stale   # claim senza attivita' da >12h
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [int]$IssueNumber,
    [string]$Slug = "",
    [string]$AgentId = "",
    [switch]$SkipWorktree,
    [switch]$Stale,
    [switch]$DryRun
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

# --- agent id ---------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($AgentId)) {
    $hostName = $env:COMPUTERNAME.ToLowerInvariant()
    $AgentId = "kilo-$hostName-$([guid]::NewGuid().ToString('N').Substring(0,4))"
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
$state | ConvertTo-Json | Set-Content -Path $stateFile -Encoding utf8
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
