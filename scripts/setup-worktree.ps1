<#
.SYNOPSIS
    Crea una worktree isolata per lavorare su una issue, secondo ADR-0006 + D.20.2.

.DESCRIPTION
    scripts/setup-worktree.ps1 crea una worktree Git dedicata per l'issue indicata,
    seguendo il protocollo multi-agente definito in AGENTS.md:

      1. Verifica che l'issue esista su GitHub (via `gh`) e sia candidabile
         (label `agent-ready`, niente `in-progress` o `status:*`).
      2. Crea una directory di lavoro in ../ls-<N>-<slug> partendo dal base branch
         (default: origin/main), con un branch `feat/<N>-<slug>` (push early D.20.2).
      3. Configura core.hooksPath = .githooks nella worktree (gli hook funzionano anche li).
      4. Stampa il comando successivo (`cd ../ls-<N>-<slug>`) per l'agente.

    Vantaggi rispetto al modello "working copy condivisa" (D.20.1, superato):
      - Isolamento: il WIP di un agente non e toccabile dalle operazioni di un altro
        agente (`git checkout main`, `git reset --hard`, ecc. — vedi issue #45 DATA-LOSS).
      - Nessuna contesa su file locali: piu agenti su issue diverse lavorano in directory
        separate senza interferenze.
      - Cleanup esplicito: `git worktree remove ../ls-<N>-<slug>` dopo il merge.

.PARAMETER IssueNumber
    Numero della issue GitHub (es. 53). Obbligatorio.

.PARAMETER Slug
    Slug descrittivo per la worktree (es. "worktree-default").
    Default: derivato dal titolo della issue (kebab-case, max 40 caratteri).

.PARAMETER BaseBranch
    Branch base da cui creare la worktree. Default: origin/main.

.PARAMETER BranchName
    Nome del branch di lavoro. Default: feat/<N>-<slug> (o fix/<N>-<slug> se il titolo
    della issue contiene "fix" o "bug").

.PARAMETER WorktreePath
    Path della worktree. Default: ../ls-<N>-<slug> (un livello sopra la repo corrente).

.PARAMETER SkipGhCheck
    Salta la verifica dell'issue via `gh` (per test o modalita dry-run).

.PARAMETER NoPush
    Non eseguire il push early (D.20.2). Default: false (push early abilitato).

.PARAMETER Help
    Mostra questo help.

.EXAMPLE
    pwsh scripts/setup-worktree.ps1 53
    pwsh scripts/setup-worktree.ps1 53 -Slug "custom-fix"
    pwsh scripts/setup-worktree.ps1 53 -BaseBranch origin/feat/0.3-adapter-spotify
    pwsh scripts/setup-worktree.ps1 53 -SkipGhCheck  # per test
    pwsh scripts/setup-worktree.ps1 53 -NoPush        # non pushare il branch

.NOTES
    Dopo aver creato la worktree, l'agente deve:
      1. Spostarsi nella worktree: `cd <WorktreePath>`
      2. Claimare l'issue (ADR-0006): `gh issue edit <N> --add-label in-progress`
      3. Lavorare sul branch (gia pushato)
      4. Aprire PR con `Closes #N` nel body
      5. Dopo merge: `git worktree remove <WorktreePath>` (policy §"Pulizia branch post-merge")

    See AGENTS.md §"Primo task" (post-merge questa PR) per il flusso completo.
#>

param(
    [Parameter(Position = 0, Mandatory = $true)]
    [int]$IssueNumber,

    [string]$Slug,

    [string]$BaseBranch = "origin/main",

    [string]$BranchName,

    [string]$WorktreePath,

    [switch]$SkipGhCheck,

    [switch]$NoPush,

    [switch]$Help
)

$helpRequested = $Help -or ($args -contains '-h') -or ($args -contains '--help')
if ($helpRequested) {
    Get-Help $MyInvocation.MyCommand.Path -Full | Out-String | Write-Host
    exit 0
}

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Step {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "[setup-worktree] $Message" -ForegroundColor $Color
}

function Write-Err {
    param([string]$Message)
    Write-Host "[setup-worktree] ERRORE: $Message" -ForegroundColor Red
}

# === Preflight: verifica ambiente ===
if (-not (Test-Path ".git")) {
    Write-Err "questa directory non e un repo git (manca .git). Esegui da dentro la repo."
    exit 2
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Err "git non trovato nel PATH."
    exit 2
}

# === 1. Validazione issue via gh (a meno di -SkipGhCheck) ===
$issueLabels = @()
$issueTitle = ""
$issueState = ""

if (-not $SkipGhCheck) {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Err "gh CLI non trovato nel PATH. Installa GitHub CLI oppure usa -SkipGhCheck."
        exit 2
    }

    Write-Step "Verifica issue #$IssueNumber via gh..."
    try {
        $issueJson = gh issue view $IssueNumber --json state,title,labels 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Err "impossibile leggere issue #$IssueNumber. Esiste? PAT con scope 'issues: read' configurato?"
            exit 3
        }
        $issue = $issueJson | ConvertFrom-Json
        $issueState = $issue.state
        $issueTitle = $issue.title
        $issueLabels = @($issue.labels | ForEach-Object { $_.name })
    } catch {
        Write-Err "fallimento lettura issue #$IssueNumber : $_"
        exit 3
    }

    if ($issueState -ne "OPEN") {
        Write-Err "issue #$IssueNumber e in stato '$issueState' (non OPEN). Solo issue aperte sono candidabili."
        exit 3
    }

    if (-not ($issueLabels -contains "agent-ready")) {
        Write-Err "issue #$IssueNumber non ha label 'agent-ready' (labels: $($issueLabels -join ', ')). Non candidabile."
        exit 3
    }

    if ($issueLabels | Where-Object { $_ -like "status:*" }) {
        Write-Err "issue #$IssueNumber ha label 'status:*' (labels: $($issueLabels -join ', ')). Esclusa da claim (ADR-0007)."
        exit 3
    }

    if ($issueLabels -contains "in-progress") {
        Write-Err "issue #$IssueNumber ha label 'in-progress' (gia claimata da un altro agente)."
        exit 3
    }
} else {
    Write-Step "Salto verifica issue (SkipGhCheck attivo)." -ForegroundColor Yellow
    $issueTitle = "test-issue-$IssueNumber"
}

# === 2. Derivazione slug (se non fornito) ===
if ([string]::IsNullOrWhiteSpace($Slug)) {
    $Slug = ($issueTitle.ToLower()) -replace '[^a-z0-9\-]+', '-' -replace '-+', '-' -replace '^-|-$', ''
    if ($Slug.Length -gt 40) { $Slug = $Slug.Substring(0, 40).TrimEnd('-') }
    Write-Step "Slug derivato dal titolo: '$Slug'"
}

# === 3. Derivazione BranchName (se non fornito) ===
if ([string]::IsNullOrWhiteSpace($BranchName)) {
    $prefix = if ($issueTitle -match "(?i)\b(fix|bug)\b") { "fix" } else { "feat" }
    $BranchName = "$prefix/$IssueNumber-$Slug"
    Write-Step "BranchName derivato: '$BranchName'"
}

# === 4. Configurazione WorktreePath (se non fornito) ===
if ([string]::IsNullOrWhiteSpace($WorktreePath)) {
    $repoRoot = (git rev-parse --show-toplevel).Trim()
    $parent = Split-Path -Parent $repoRoot
    $WorktreePath = Join-Path $parent "ls-$IssueNumber-$Slug"
    Write-Step "WorktreePath derivato: '$WorktreePath'"
}

Write-Step ""
Write-Step "Configurazione:"
Write-Step "  Issue:           #$IssueNumber $(if ($issueTitle) { "- $issueTitle" })"
Write-Step "  Slug:            $Slug"
Write-Step "  Base branch:     $BaseBranch"
Write-Step "  Branch di lavoro:$BranchName"
Write-Step "  Worktree path:   $WorktreePath"
Write-Step ""

# === 5. Validazione branch base ===
git rev-parse --verify "$BaseBranch" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Err "branch base '$BaseBranch' non trovato. Fetch + retry: git fetch origin"
    exit 4
}

# === 6. Validazione worktree path non esistente ===
if (Test-Path $WorktreePath) {
    Write-Err "percorso '$WorktreePath' gia esistente."
    Write-Host "  Per rimuovere una worktree esistente:" -ForegroundColor Yellow
    Write-Host "    git worktree remove --force $WorktreePath" -ForegroundColor Yellow
    Write-Host "  Per listare worktree:" -ForegroundColor Yellow
    Write-Host "    git worktree list" -ForegroundColor Yellow
    exit 5
}

# === 7. Creazione worktree ===
Write-Step "Creazione worktree..."
git worktree add -b $BranchName $WorktreePath $BaseBranch | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Err "creazione worktree fallita (exit=$LASTEXITCODE)"
    exit 6
}
Write-Step "Worktree creata: $WorktreePath" -ForegroundColor Green

# === 8. Setup hooks nella worktree ===
Write-Step "Configurazione core.hooksPath nella worktree..."
Push-Location $WorktreePath
try {
    git config core.hooksPath .githooks | Out-Null
    # Verifica che i file hook siano presenti
    if (Test-Path ".githooks/pre-commit") {
        Write-Step "Hooks configurati (.githooks/pre-commit, pre-push, post-checkout)" -ForegroundColor Green
    } else {
        Write-Step "ATTENZIONE: .githooks/pre-commit non trovato nella worktree. Hook potrebbe non funzionare." -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

# === 9. Push early (D.20.2) ===
if (-not $NoPush) {
    Write-Step "Push early (D.20.2)..."
    git push -u origin $BranchName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "push fallito (exit=$LASTEXITCODE)"
        Write-Host "  Per riprovare manualmente:" -ForegroundColor Yellow
        Write-Host "    cd $WorktreePath" -ForegroundColor Yellow
        Write-Host "    git push -u origin $BranchName" -ForegroundColor Yellow
        exit 7
    }
    Write-Step "Branch pushato: origin/$BranchName" -ForegroundColor Green
} else {
    Write-Step "Push early SKIPPATO (NoPush attivo)." -ForegroundColor Yellow
}

# === 10. Output finale ===
Write-Step ""
Write-Step "==============================================" -ForegroundColor Green
Write-Step "Worktree pronta. Prossimi passi:" -ForegroundColor Green
Write-Step "==============================================" -ForegroundColor Green
Write-Step ""
$cdCmd = "    cd " + $WorktreePath
Write-Host $cdCmd -ForegroundColor Cyan
Write-Step ""
if (-not $SkipGhCheck) {
    Write-Step "Quindi claim (ADR-0006):"
    Write-Host "    gh issue edit $IssueNumber --add-label in-progress" -ForegroundColor Cyan
    $claimCmd = '    gh issue comment ' + $IssueNumber + ' --body "claim: <AGENT-ID> (UTC <timestamp>) -- worktree: ' + $WorktreePath + '"'
    Write-Host $claimCmd -ForegroundColor Cyan
    Write-Step ""
}
Write-Step "Ricordati di:"
Write-Step "  - doc-sync IN PR (D.21.1): modifica solo docs/state/<propria>/*"
Write-Step "  - Closes #N nel body PR"
$cleanupCmd = "  - Dopo il merge: git worktree remove --force " + $WorktreePath + " (policy post-merge cleanup)"
Write-Step $cleanupCmd
Write-Step "  - AGENTS.md sezione Primo task per il flusso completo"

exit 0