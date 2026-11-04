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
      2. esegue i gate locali bloccanti (issue #306: la batteria copre i gate
         che la CI esegue — Conventional Commits sul range della PR e gate dei
         workflow — perche' l'agente veda il verdetto PRIMA di aprire la PR)
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
#
# La batteria locale deve coprire i gate che la CI esegue: e' l'unico punto
# in cui l'agente vede il verdetto PRIMA di aprire la PR. Con 4 controlli
# (precedenti) la PR #305 e' passata "gate locali verdi" e la CI l'ha poi
# resa rossa su due job (`gates-protocol` e `gates-workflows`): due round-
# trip sprecati, e un difetto che l'agente non aveva modo di vedere.
#
# I gate locali hanno tre esiti, distinti perche' i tre hanno effetti diversi:
#   fallito  -> BLOCCA l'apertura della PR (il gate era eseguibile e ha
#               trovato un difetto: e' esattamente il caso da intercettare)
#   saltato  -> NON blocca, ma viene DICHIARATO nel riepilogo: il gate non era
#               eseguibile in questo ambiente (es. `bash` assente), e la CI
#               lo eseguira' comunque. Un salto silenzioso sarebbe un gate
#               che "passa sempre" (lesson 43-1)
#   eseguito -> verde
if (-not $SkipChecks) {
    Say "eseguo i gate locali..." "Cyan"
    $failures = @()
    $skipped = @()
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

    # --- Conventional Commits sul range della PR (job `gates-protocol`) ---
    # Stesso comando del gate bloccante della CI: `commitlint --from <base>
    # --to <head>`. La convenzione e' normativa (AGENTS.md, "Git workflow").
    #
    # Il range va letto contro `origin/$Base` ACCURATO: senza un fetch il
    # ref puo' essere stale e il controllo girerebbe su un range sbagliato.
    $global:LASTEXITCODE = 0
    & git fetch origin --quiet 2>$null
    $baseRef = "origin/$Base"
    & git rev-parse --verify --quiet $baseRef | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[agent-pr] ERRORE: il ref $baseRef non esiste: il range dei commit non e' verificabile." -ForegroundColor Red
        Write-Host "[agent-pr]   Risolvilo con: git fetch origin" -ForegroundColor Yellow
        $failures += "commitlint (ref $baseRef non trovato)"
    }
    elseif (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Say "commitlint: saltato (pnpm non nel PATH): la CI lo eseguira'" "Yellow"
        $skipped += "commitlint (pnpm assente)"
    }
    elseif (-not (Test-Path (Join-Path $repoRoot "node_modules/.bin"))) {
        # L'hook `commit-msg` salta commitlint quando `node_modules` non
        # esiste, e la worktree appena creata NON lo aveva (issue #306): la
        # convenzione non veniva verificata al momento del commit. Qui il
        # controllo non e' "non eseguibile per assenza di tool": e' eseguibile
        # e va eseguito, quindi BLOCCA finche' l'agente non installa.
        Write-Host "[agent-pr] ERRORE: node_modules assente: commitlint non puo' girare." -ForegroundColor Red
        Write-Host "[agent-pr]   Risolvilo con: pnpm install --frozen-lockfile" -ForegroundColor Yellow
        $failures += "commitlint (node_modules assente)"
    }
    else {
        & pnpm exec commitlint --from $baseRef --to HEAD | Out-Host
        if ($LASTEXITCODE -ne 0) { $failures += "commitlint (Conventional Commits)" }
    }

    # --- Gate dei workflow (job `gates-workflows`) ---
    # Validatore dei workflow e sintassi dei blocchi `run:`: moduli built-in di
    # node, sempre eseguibili.
    & $node (Join-Path $repoRoot "scripts/validate-workflows.mjs") ".github/workflows" | Out-Host
    if ($LASTEXITCODE -ne 0) { $failures += "validate-workflows.mjs" }

    & $node (Join-Path $repoRoot "scripts/check-workflow-syntax.mjs") | Out-Host
    if ($LASTEXITCODE -ne 0) { $failures += "check-workflow-syntax.mjs" }

    # Test FUNZIONALE del writer post-merge: e' il gate che ha reso rossa la
    # PR #305 (un numero di sessione duplicato nel fixture faceva fallire
    # `aggregate-state.ps1 -Check` dentro il clone temporaneo del test).
    $writerTest = Join-Path $repoRoot "scripts/test-post-merge-writer.sh"
    if (Test-Path $writerTest) {
        # `bash` puo' essere uno stub non funzionante (WindowsApps): la
        # disponibilita' si verifica PROBANDOLO, non guardando il PATH.
        $global:LASTEXITCODE = 0
        & bash -c "exit 0" 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Say "test-post-merge-writer.sh: saltato (bash non utilizzabile): la CI lo eseguira'" "Yellow"
            $skipped += "test-post-merge-writer.sh (bash non utilizzabile)"
        }
        else {
            & bash $writerTest | Out-Host
            if ($LASTEXITCODE -ne 0) { $failures += "test-post-merge-writer.sh" }
        }
    }

    if ($skipped.Count -gt 0) {
        Say "gate saltati (non eseguibili in questo ambiente, li eseguira' la CI): $($skipped -join ', ')" "Yellow"
    }
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
    $bundleScript = Join-Path $repoRoot "scripts/generate-bundle.ps1"
    if (Test-Path $bundleScript) {
        & pwsh -NoProfile -File $bundleScript | Out-Null
        if ($LASTEXITCODE -eq 0) {
            & git diff --quiet -- docs/BUNDLE.md
            if ($LASTEXITCODE -ne 0) { $bundleChanged = $true }
        }
    }
    if ($bundleChanged) {
        & git add docs/BUNDLE.md | Out-Null
        # Il commit del bundle porta con sé **solo** il bundle: senza l'elenco
        # esplicito dei path, `git commit` committa TUTTO l'index — quindi
        # anche il file di sessione appena modificato, che ha ancora `pr: 0`.
        # Il commit successivo (quello della sessione) resterebbe senza nulla
        # da committare e il comando uscirebbe 1, **dopo** aver creato la PR:
        # la PR restava con `pr: 0` e il workflow post-merge non trovava il
        # file di sessione (issue #306, Sessione 100).
        & git commit -q -m "chore(bundle): regen BUNDLE.md dopo modifica a docs/" -- docs/BUNDLE.md | Out-Null
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
Write-Host "  1. attendi la review (CI: 17 check)"
Write-Host "  2. al merge: pwsh scripts/post-merge.ps1 -Branch $branch -IssueNumber $IssueNumber"
Write-Host ""
exit 0
