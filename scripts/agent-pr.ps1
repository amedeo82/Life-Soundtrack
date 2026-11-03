<#
.SYNOPSIS
    Apertura verificata di una pull request (claim -> PR in modo deterministico).

.DESCRIPTION
    Apre la PR della story che l'agente ha claimato, dopo aver verificato che
    lo stato locale sia coerente. Sostituisce la sequenza manuale
    "apri la PR -> togli agent-ready -> metti status:in-review -> ricordati di
    scrivere `pr: N` nella sessione", che era la fonte di due difetti:

      * la transizione delle label era spesso dimenticata;
      * il file di sessione restava con `pr: 0`, e il workflow post-merge
        `auto-session-merge-state.yml` falliva perche' non trovava nessun
        file di sessione corrispondente alla PR (misurato due volte).

    Sequenza:
      1. legge il file di stato dell'agente e verifica la branch
      2. esegue i gate locali bloccanti
      3. verifica che il body contenga UNA sola keyword di chiusura, nuda
      4. crea la PR
      5. transiziona le label (`agent-ready` -> `status:in-review`)
      6. scrive `pr: N` nel file di sessione e lo pusha  <-- chiude la
         precondizione del workflow post-merge

.PARAMETER IssueNumber
    Numero dell'issue (deve coincidere con la branch e con la keyword di chiusura).

.PARAMETER Title
    Titolo della PR (default: "<tipo>: <titolo issue> (#N)").

.PARAMETER BodyFile
    File con il body della PR (default: .github/pull_request_template.md).

.PARAMETER Base
    Branch di base (default: main).

.PARAMETER SkipChecks
    Salta i gate locali (emergenza).

.PARAMETER DryRun
    Verifica e stampa, senza creare nulla.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [int]$IssueNumber,
    [string]$Title = "",
    [string]$BodyFile = "",
    [string]$Base = "main",
    [switch]$SkipChecks,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$repoSlug = (& gh repo view --json nameWithOwner --jq .nameWithOwner).Trim()

function Say([string]$msg, [string]$color = "Gray") { Write-Host "[agent-pr] $msg" -ForegroundColor $color }
function Die([int]$code, [string]$msg) { Write-Host "[agent-pr] ERRORE: $msg" -ForegroundColor Red; exit $code }

# --- 1. stato dell'agente e branch ------------------------------------------
$gitDir = (& git rev-parse --absolute-git-dir).Trim()
$stateFile = Join-Path $gitDir "agent-state.json"
if (-not (Test-Path $stateFile)) {
    Die 3 "nessun file di stato dell'agente ($stateFile): la worktree non e' stata creata da agent-claim.ps1"
}
$state = (Get-Content $stateFile -Raw | ConvertFrom-Json)
if ([int]$state.issue -ne $IssueNumber) {
    Die 3 "il file di stato dichiara l'issue #$($state.issue), non #$IssueNumber"
}
$branch = $state.branch
if ($branch -notmatch "^(feat|fix)/$IssueNumber-") {
    Die 3 "la branch '$branch' non corrisponde all'issue #$IssueNumber (atteso feat/$IssueNumber-... o fix/$IssueNumber-...)"
}
Say "issue #$IssueNumber, branch $branch, agent $($state.agent_id)" "DarkGray"

# --- 2. gate locali bloccanti ----------------------------------------------
if (-not $SkipChecks) {
    Say "eseguo i gate locali..." "Cyan"
    $failures = @()
    $node = "node"

    & $node (Join-Path $repoRoot "scripts/check-protocol-consistency.mjs") | Out-Host
    if ($LASTEXITCODE -ne 0) { $failures += "check-protocol-consistency.mjs" }

    & $node (Join-Path $repoRoot "scripts/check-merge-state.mjs") | Out-Host
    if ($LASTEXITCODE -ne 0) { $failures += "check-merge-state.mjs" }

    & $node (Join-Path $repoRoot "scripts/check-aggregate-blocks.mjs") --base "origin/$Base" --head HEAD | Out-Host
    if ($LASTEXITCODE -ne 0) { $failures += "check-aggregate-blocks.mjs" }

    # il bundle deve essere in sync nella stessa PR (regola D.26.3)
    & pwsh -NoProfile -File (Join-Path $repoRoot "scripts/generate-bundle.ps1") -Check | Out-Host
    if ($LASTEXITCODE -ne 0) { $failures += "generate-bundle.ps1 -Check" }

    if ($failures.Count -gt 0) {
        Write-Host "[agent-pr] ERRORE: gate locali falliti: $($failures -join ', ')" -ForegroundColor Red
        exit 1
    }
    Say "gate locali verdi" "Green"
}

# --- 3. body e keyword di chiusura ------------------------------------------
if ([string]::IsNullOrWhiteSpace($BodyFile)) {
    $BodyFile = Join-Path $repoRoot ".github/pull_request_template.md"
}
if (-not (Test-Path $BodyFile)) { Die 2 "file del body non trovato: $BodyFile" }
$body = Get-Content $BodyFile -Raw

$naked = @([regex]::Matches($body, "(?m)^\s*(Closes|Fixes|Resolves)\s+#(\d+)\s*$"))
$allKeywords = @([regex]::Matches($body, "(?i)\b(Closes|Fixes|Resolves)\s+#(\d+)"))
if ($naked.Count -ne 1) {
    Die 1 "il body deve contenere UNA sola keyword di chiusura nuda (trovate $($naked.Count)); una keyword dentro backtick o una casella di checklist non chiude l'issue"
}
$closedIssue = [int]$naked[0].Groups[2].Value
if ($closedIssue -ne $IssueNumber) {
    Die 1 "la keyword di chiusura punta a #$closedIssue ma l'issue in carico e' #$IssueNumber"
}
if ($allKeywords.Count -ne $naked.Count) {
    Die 1 "la keyword di chiusura compare $($allKeywords.Count) volte in tutto e $($naked.Count) volte nuda: le occorrenze dentro backtick vanno rimosse"
}
Say "keyword di chiusura: #$closedIssue (nuda, unica)" "Green"

if ([string]::IsNullOrWhiteSpace($Title)) {
    $issueTitle = (& gh issue view $IssueNumber --json title --jq .title).Trim()
    $kind = if ($branch -like "fix/*") { "fix" } else { "feat" }
    $Title = "$kind`: $issueTitle (#$IssueNumber)"
}

if ($DryRun) {
    Say "[DRY-RUN] aprirei la PR '$Title' verso $Base" "Yellow"
    exit 0
}

# --- 4. creazione della PR --------------------------------------------------
Say "creo la PR..." "Cyan"
$prUrl = (& gh pr create --base $Base --head $branch --title $Title --body-file $BodyFile | Select-Object -Last 1).Trim()
if ($LASTEXITCODE -ne 0) { Die 1 "gh pr create e' fallito" }
if ($prUrl -notmatch "/pull/(\d+)") { Die 1 "impossibile ricavare il numero della PR dall'output: $prUrl" }
$prNumber = [int]$Matches[1]
Say "PR #$prNumber aperta: $prUrl" "Green"

# --- 5. transizione delle label ---------------------------------------------
Say "transizione delle label: agent-ready -> status:in-review" "Cyan"
& gh issue edit $IssueNumber --remove-label "agent-ready" --add-label "status:in-review" | Out-Null
if ($LASTEXITCODE -ne 0) { Die 1 "impossibile transizionare le label dell'issue #$IssueNumber" }

# --- 6. scrivere `pr: N` nel file di sessione -------------------------------
# Il workflow post-merge `auto-session-merge-state.yml` cerca un file di
# sessione che dichiari `pr: <N>`: senza questo passaggio il workflow
# fallisce (precondizione non soddisfatta) e la sessione resta aperta.
$sessionFile = $null
if ($state.PSObject.Properties.Name -contains "session" -and $state.session) {
    $candidate = Join-Path $repoRoot $state.session
    if (Test-Path $candidate) { $sessionFile = $candidate }
}
if (-not $sessionFile) {
    # `@(...)`: con un SOLO file di sessione per questa branch, la pipeline
    # restituisce un oggetto e non un array: sotto `Set-StrictMode -Version
    # Latest` l'accesso a `.Count` su uno scalare fallisce con "Non e' possibile
    # trovare la proprieta' 'Count'". Il wrapping lo rende sempre un array.
    $candidates = @(Get-ChildItem (Join-Path $repoRoot "docs/state/sessions") -Filter "*.md" -File |
        Where-Object { (Get-Content $_.FullName -Raw) -match "(?m)^branch:\s*$([regex]::Escape($branch))\s*$" })
    if ($candidates.Count -eq 1) { $sessionFile = $candidates[0].FullName }
}

if ($sessionFile) {
    $relative = $sessionFile.Replace((Resolve-Path $repoRoot).Path + "\", "").Replace("\", "/")
    Say "scrivo 'pr: $prNumber' in $relative" "Cyan"
    $content = Get-Content $sessionFile -Raw
    if ($content -match "(?m)^pr:\s*\d+\s*$") {
        $content = $content -replace "(?m)^pr:\s*\d+\s*$", "pr: $prNumber"
    }
    else {
        $content = $content -replace "(?m)^(merged:\s*.*)$", "`$1`npr: $prNumber"
    }
    $content | Set-Content -Path $sessionFile -Encoding utf8 -NoNewline
    & git add $relative | Out-Null

    # La sessione e' un file del catalogo del bundle ($files): scrivendo `pr: N`
    # il bundle va rigenerato PRIMA del commit, altrimenti il branch remoto
    # resta con un bundle stale e la CI lo segnala ("docs/BUNDLE.md non e' in
    # sync"). Il `pre-push` hook rigenera e committa da solo quando il bundle
    # e' da rifare, ma BLOCCA il push (git calcola i ref da inviare prima di
    # eseguire l'hook): qui lo facciamo prima, quindi il push passa pulito.
    $bundleChanged = $false
    & pwsh -NoProfile -File (Join-Path $repoRoot "scripts/generate-bundle.ps1") | Out-Null
    if ($LASTEXITCODE -eq 0) {
        & git diff --quiet -- docs/BUNDLE.md
        if ($LASTEXITCODE -ne 0) { $bundleChanged = $true }
    }
    if ($bundleChanged) {
        & git add docs/BUNDLE.md | Out-Null
        & git commit -q -m "chore(bundle): regen BUNDLE.md dopo modifica a docs/" | Out-Null
        if ($LASTEXITCODE -ne 0) { Die 1 "impossibile committare il bundle rigenerato" }
        Say "bundle rigenerato e committato" "Cyan"
    }

    & git commit -q -m "docs(state): scrive 'pr: $prNumber' nella sessione ($relative)" | Out-Null
    if ($LASTEXITCODE -ne 0) { Die 1 "impossibile committare l'aggiornamento della sessione" }
    & git push | Out-Null
    if ($LASTEXITCODE -ne 0) { Die 1 "impossibile pushare l'aggiornamento della sessione" }
    Say "sessione aggiornata e pushata" "Green"
}
else {
    Say "NESSUN file di sessione per questa branch: la PR non avra' una sessione (il workflow post-merge lo segnalera' come assente)" "Yellow"
}

# --- 7. prossimi passi ------------------------------------------------------
Write-Host ""
Write-Host "[agent-pr] prossimi passi:" -ForegroundColor Cyan
Write-Host "  1. attendi la review (CI: 13 check)"
Write-Host "  2. al merge: pwsh scripts/post-merge.ps1 -Branch $branch -IssueNumber $IssueNumber"
Write-Host ""
exit 0
