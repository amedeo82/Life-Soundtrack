<#
.SYNOPSIS
    Presa in carico atomica di una story: worktree + label + claim + riverifica.

.DESCRIPTION
    ADR-0006 ha 8 regole VINCOLANTI sul claim, ma fino alla Sessione 80 non
    aveva alcun enforcement: la presa in carico era prosa, e due agenti
    potevano implementare la stessa story senza che nulla se ne accorgesse.

    Questo script esegue la presa in carico come sequenza atomica:

      1. valida l'issue (esiste, aperta, `agent-ready`, NON `in-progress`)
      2. crea la worktree isolata (delega a scripts/setup-worktree.ps1)
      3. aggiunge la label `in-progress`
      4. posta il commento `claim: <agent-id> (UTC <ts>) -- worktree: <path>`
      5. RIVERIFICA: scarica i commenti di claim e verifica che il proprio
         abbia l'ID NUMERICO (API REST) piu' basso: vince chi ha commentato
         per primo. Il discriminatore e' l'id numerico, non il node_id GraphQL
         e non created_at (vedi AGENTS.md §"Presa in carico delle story").
      6. scrive il file di stato dell'agente (usato da hook e script)
      7. in caso di perdita: rimuove la label, posta `yield:` ed esce

    Il file di stato vive FUORI dal working tree (nella directory git della
    worktree): non e' un file untracked, quindi non confonde l'hook
    pre-commit, e sparisce con la worktree.

.PARAMETER IssueNumber
    Numero dell'issue da prendere in carico.

.PARAMETER Slug
    Slug del branch (default: derivato dal titolo dell'issue).

.PARAMETER AgentId
    Identificatore dell'agente (default: <tool>-<hostname>-<4 caratteri>).

.PARAMETER SkipWorktree
    Non creare la worktree (l'agente lavora gia' in una worktree).

.PARAMETER DryRun
    Stampa cosa farebbe, senza toccare GitHub ne il filesystem.

.EXAMPLE
    pwsh scripts/agent-claim.ps1 256
    pwsh scripts/agent-claim.ps1 256 -DryRun
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [int]$IssueNumber,
    [string]$Slug = "",
    [string]$AgentId = "",
    [switch]$SkipWorktree,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$repoSlug = (& gh repo view --json nameWithOwner --jq .nameWithOwner).Trim()
$repoApi = "repos/$repoSlug"

function Say([string]$msg, [string]$color = "Gray") { Write-Host "[agent-claim] $msg" -ForegroundColor $color }
function Die([int]$code, [string]$msg) { Write-Host "[agent-claim] ERRORE: $msg" -ForegroundColor Red; exit $code }

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
if ($labels -contains "in-progress") { Die 3 "issue #$IssueNumber ha gia' la label 'in-progress': qualcun altro l'ha presa in carico" }
if ($labels -match '^status:') { Die 3 "issue #$IssueNumber ha gia' una label status:* ($($labels -join ', '))" }

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

Say "aggiungo la label 'in-progress' ..." "Cyan"
& gh issue edit $IssueNumber --add-label "in-progress" | Out-Null
if ($LASTEXITCODE -ne 0) { Die 1 "impossibile aggiungere la label 'in-progress'" }

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$claimBody = "claim: $AgentId (UTC $timestamp) -- worktree: $worktreePath"
Say "posterei il commento di claim" "Cyan"
& gh issue comment $IssueNumber --body $claimBody | Out-Null
if ($LASTEXITCODE -ne 0) { Die 1 "impossibile postare il commento di claim" }

# --- 5. riverifica (deterministica) ----------------------------------------
Say "riverifico i claim..." "Cyan"
$commentsRaw = & gh api "$repoApi/issues/$IssueNumber/comments" 2>$null
if ($LASTEXITCODE -ne 0) { Die 2 "impossibile leggere i commenti dell'issue" }
$allComments = @($commentsRaw | ConvertFrom-Json)

# Un claim RILASCIATO non conta nella riverifica. AGENTS.md (sezione
# "Procedura di claim", punto 4) confronta l'ID piu' basso "tra i claim NON
# ANCORA RILASCIATI"; un claim e' rilasciato da un commento `release:` /
# `stale-release:` SUCCESSIVO che ne cita l'agente.
#
# Senza questo filtro la presa in carico di una claim STANTIA (TTL 12 ore di
# ADR-0006) sarebbe impossibile: il vecchio claim ha sempre l'ID piu' basso, e
# l'agente che subentra farebbe `yield:` pur avendo legittimamente preso
# l'issue. E' il caso verificato con la claim di `kilo-hp-elitebook-457a`
# sull'issue #283 (16 ore senza attivita', TTL 12 ore).
function Get-ClaimAgent([object]$comment) {
    $m = [regex]::Match([string]$comment.body, '^\s*claim:\s*(\S+)')
    if ($m.Success) { return $m.Groups[1].Value }
    return ""
}
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
    & gh issue edit $IssueNumber --remove-label "in-progress" | Out-Null
    & gh issue comment $IssueNumber --body "yield: l'agente $AgentId ha rinunciato (claim $mineId, ID piu' basso in carico: $lowestId)" | Out-Null
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
