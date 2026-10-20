<#
.SYNOPSIS
    Procedura canonica post-merge: allinea `main`, verifica il merge, elimina branch/worktree locali e remoti.

.DESCRIPTION
    scripts/post-merge.ps1 esegue l'unica procedura di cleanup post-merge ammessa dal repo
    (AGENTS.md sezione "Pulizia branch post-merge"), in modo idempotente e difensivo.

    Ordine obbligatorio dei passi (ognuno e' una difesa contro una classe di errore nota):

      0. Zero-WIP guard        -> evita E3/E4/E5 (transizioni distruttive con working tree sporco)
      1. Worktree PRIMA       -> `git branch -d` fallisce se il branch e' checked-out in una worktree
      2. fetch --prune        -> `origin/main` deve contenere il merge commit, altrimenti i check mentono
      3. allineamento `main`   -> `git checkout main` + `git merge --ff-only origin/main`
      4. verifica merge       -> contro `origin/main` e/o via `gh` (robusta al merge squash)
      5. delete remoto        -> `git push origin --delete <branch>`
      6. delete locale        -> `git branch -d` con fallback `git cherry` per merge squash
      7. prune + audit        -> `git remote prune`, `git worktree prune`, `--check` finale

    Lo script NON esegue mai operazioni distruttive irreversibili su dati non committati:
    in assenza di -Stash/-Force si ferma con exit 10 se trova lavoro non committato.

.PARAMETER Branch
    Branch della PR mergata (es. feat/53-worktree-default). Obbligatorio salvo il solo uso di -Check.

.PARAMETER IssueNumber
    Numero della issue associata. Se `gh` e' disponibile, viene usato per verificare in modo
    autorevole (via GitHub API) che esista una PR MERGED con questa head, e per stampare il
    merge commit SHA da usare nel commento `release:`.

.PARAMETER WorktreePath
    Percorso della worktree da rimuovere (default ../ls-<N>-<slug>). Se omesso, viene
    auto-rilevato da `git worktree list`.

.PARAMETER Remote
    Nome del remote. Default: origin.

.PARAMETER BaseBranch
    Branch base su cui la PR e' stata mergata. Default: main.

.PARAMETER Check
    Modalita' audit: non modifica nulla, elenca i branch/worktree stale e le deriva' stato.
    Exit 1 se c'e' qualcosa da pulire, 0 se tutto e' pulito. Usabile come gate locale/CI.

.PARAMETER DryRun
    Stampa i comandi che verrebbero eseguiti senza eseguirli.

.PARAMETER Stash
    Se il working tree ha modifiche tracked, esegue `git stash push -u` invece di abortire.

.PARAMETER Force
    Procede anche con WIP non committato (NON consigliato) e con `git branch -D` quando
    `git branch -d` viene rifiutato ma il contenuto risulta gia' in base.

.PARAMETER AllowUnmerged
    Salta la verifica di merge (solo con giustifica scritta: merge manuale, PR chiusa senza
    merge, rollback). Il default e' fallire: cancellare un branch non mergato perde lavoro.

.PARAMETER SkipPrune
    Salta `git remote prune` / `git worktree prune` (solo debug).

.PARAMETER Help
    Mostra questo help.

.EXAMPLE
    pwsh scripts/post-merge.ps1 -Branch feat/53-worktree-default -IssueNumber 53 -WorktreePath ../ls-53-worktree-default

.EXAMPLE
    pwsh scripts/post-merge.ps1 -Branch feat/49-safe-branch-switch -DryRun

.EXAMPLE
    pwsh scripts/post-merge.ps1 -Check
    # audit: exit 1 se ci sono branch merged-orfani, worktree attive, o main locale stale

.NOTES
    Exit code:
      0  successo (o audit pulito)
      2  errore di ambiente (non repo git, git mancante, parametri invalidi)
      10 WIP non committato rilevato (fix: -Stash, oppure stash manuale)
      11 `main` locale non allineabile a `origin/main` (divergente): nessuna azione distruttiva
      12 merge non verificato (branch non e' un antenato di origin/main e nessuna PR merged trovata)
      13 `git branch -d` rifiutato e contenuto non riconosciuto come gia' presente in base
      14 `-Check` ha trovato residui post-merge da pulire
      15 esecuzione tentata da dentro una worktree invece che dalla working copy principale

    Compatibilita': PowerShell 5.1+ (Windows PowerShell) e PowerShell 7+.
#>

param(
    [Parameter(Position = 0)]
    [string]$Branch,

    [int]$IssueNumber,

    [string]$WorktreePath,

    [string]$Remote = "origin",

    [string]$BaseBranch = "main",

    [switch]$Check,

    [switch]$DryRun,

    [switch]$Stash,

    [switch]$Force,

    [switch]$AllowUnmerged,

    [switch]$SkipPrune,

    [switch]$Help
)

$helpRequested = $Help -or ($args -contains '-h') -or ($args -contains '--help')
if ($helpRequested) {
    Get-Help $MyInvocation.MyCommand.Path -Full | Out-String | Write-Host
    exit 0
}

# Continue: gli errori dei comandi nativi (git/gh) arrivano come ErrorRecord su stderr e
# vengono gestiti tramite gli exit code, non tramite le eccezioni PowerShell.
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Step { param([string]$Message, [string]$Color = "Cyan"); Write-Host "[post-merge] $Message" -ForegroundColor $Color }
function Write-Ok   { param([string]$Message); Write-Host "[post-merge]   OK   $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message); Write-Host "[post-merge]   WARN $Message" -ForegroundColor Yellow }
function Write-Err  { param([string]$Message); Write-Host "[post-merge]   ERR  $Message" -ForegroundColor Red }
function Write-Cmd  { param([string]$Message); Write-Host "[post-merge]   >    $Message" -ForegroundColor DarkGray }

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string[]]$GitArgs,
        [switch]$AllowFail,
        [switch]$Quiet
    )

    $cmd = ($GitArgs -join ' ')
    if (-not $Quiet) { Write-Cmd "git $cmd" }

    if ($script:DryRun) {
        return [pscustomobject]@{ ExitCode = 0; Output = ""; Lines = @() }
    }

    $global:LASTEXITCODE = 0
    $raw = & git @GitArgs 2>&1
    $code = $LASTEXITCODE
    $text = (($raw | Out-String) -replace "`r", "").Trim()
    $lines = @()
    if ($text) { $lines = @($text -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }

    if ($code -ne 0 -and -not $AllowFail) {
        throw "git $cmd -> exit $code`n$text"
    }

    return [pscustomobject]@{ ExitCode = $code; Output = $text; Lines = $lines }
}

function Invoke-Exe {
    param(
        [Parameter(Mandatory = $true)][string]$Exe,
        [string[]]$ExeArgs = @(),
        [switch]$AllowFail
    )

    if ($script:DryRun) { return [pscustomobject]@{ ExitCode = 0; Output = "" } }

    $global:LASTEXITCODE = 0
    $raw = & $Exe @ExeArgs 2>&1
    $code = $LASTEXITCODE
    $text = (($raw | Out-String) -replace "`r", "").Trim()

    if ($code -ne 0 -and -not $AllowFail) {
        throw "$Exe $($ExeArgs -join ' ') -> exit $code`n$text"
    }

    return [pscustomobject]@{ ExitCode = $code; Output = $text }
}

function Get-TrackedDirty {
    $res = Invoke-Git -GitArgs @("status", "--porcelain") -Quiet
    # Una riga tracked e' qualsiasi riga che non inizia con '??' (untracked).
    return @($res.Lines | Where-Object { $_ -notmatch '^\?\?' })
}

function Get-Worktrees {
    $res = Invoke-Git -GitArgs @("worktree", "list", "--porcelain") -Quiet -AllowFail
    $items = @()
    $cur = $null
    foreach ($line in $res.Lines) {
        if ($line -like "worktree *") {
            $cur = [pscustomobject]@{ Path = $line.Substring(9); Branch = $null; Main = ($items.Count -eq 0) }
            $items += $cur
        } elseif ($line -like "branch refs/heads/*" -and $null -ne $cur) {
            $cur.Branch = $line.Substring(18)
        }
    }
    return $items
}

function Normalize-Path {
    param([string]$Path)
    if (-not $Path) { return "" }
    return ($Path -replace '\\', '/').TrimEnd('/').ToLowerInvariant()
}

# === Preflight ===
if (-not (Test-Path ".git")) {
    Write-Err "questa directory non e' un repo git (manca .git). Esegui da dentro la repo."
    exit 2
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Err "git non trovato nel PATH."
    exit 2
}

if (-not $Check -and [string]::IsNullOrWhiteSpace($Branch)) {
    Write-Err "specificare -Branch <branch> (oppure usare -Check per l'audit)."
    Write-Host "Uso: pwsh scripts/post-merge.ps1 -Branch feat/53-x [-IssueNumber 53] [-DryRun] [-Check]" -ForegroundColor Cyan
    exit 2
}

$script:DryRun = [bool]$DryRun
$repoRoot = (Invoke-Git -GitArgs @("rev-parse", "--show-toplevel") -Quiet).Output
if ($script:DryRun) { $repoRoot = (Get-Location).Path }
$currentBranch = (Invoke-Git -GitArgs @("branch", "--show-current") -Quiet).Output
if ($script:DryRun) { $currentBranch = (git branch --show-current).Trim() }

Write-Step "repo=$repoRoot branch=$currentBranch base=$BaseBranch remote=$Remote"

# Guard: la procedura gira SEMPRE dalla working copy principale. Da dentro una worktree
# il branch non puo' essere cancellato (`git branch -d` fallisce: branch checked out) e
# `git checkout main` puo' fallire (main gia' checked-out altrove): refuse instead of improvise.
$worktrees = Get-Worktrees
$mainWorktree = $worktrees | Where-Object { $_.Main } | Select-Object -First 1
$isLinkedWorktree = $null -ne $mainWorktree -and (Normalize-Path $mainWorktree.Path) -ne (Normalize-Path $repoRoot)

if ($isLinkedWorktree) {
    if ($Check) {
        Write-Warn "esecuzione da dentro una worktree: l'audit puo' segnalare falsi positivi (vedi la worktree corrente)"
    } else {
        Write-Err "questa e' una worktree collegata, non la working copy principale."
        Write-Host "[post-merge]   La procedura post-merge va eseguita dalla working copy principale, altrimenti:" -ForegroundColor Yellow
        Write-Host "[post-merge]     - git branch -d fallisce (branch checked-out nella worktree)" -ForegroundColor DarkGray
        Write-Host "[post-merge]     - git checkout main puo' fallire (main checked-out nella working copy principale)" -ForegroundColor DarkGray
        Write-Host "[post-merge]   Rilancia da:" -ForegroundColor Yellow
        Write-Host "[post-merge]     pwsh scripts/post-merge.ps1 -Branch $Branch -WorktreePath <worktree> $(if ($IssueNumber -gt 0) { "-IssueNumber $IssueNumber" })" -ForegroundColor Cyan
        Write-Host "[post-merge]   (cwd: $($mainWorktree.Path))" -ForegroundColor Cyan
        exit 15
    }
}

# =====================================================================
# MODALITA' CHECK - audit read-only
# =====================================================================
if ($Check) {
    Write-Step "AUDIT post-merge (read-only)"
    $residui = 0

    Invoke-Git -GitArgs @("fetch", $Remote, "--prune") -Quiet -AllowFail | Out-Null

    # (a) main locale stale
    $behind = (Invoke-Git -GitArgs @("rev-list", "--count", "$BaseBranch..$Remote/$BaseBranch") -Quiet -AllowFail).Output
    if ($behind -and $behind -ne "0") {
        Write-Warn "$BaseBranch locale e' $behind commit indietro rispetto a $Remote/$BaseBranch"
        Write-Host "[post-merge]         git checkout $BaseBranch ; git merge --ff-only $Remote/$BaseBranch" -ForegroundColor DarkGray
        $residui++
    } else {
        Write-Ok "$BaseBranch locale allineato a $Remote/$BaseBranch"
    }

    # (b) branch remoti merged-orfani (advisory: ancestry-based, vale solo per merge non-squash)
    $mergedRemote = (Invoke-Git -GitArgs @("branch", "-r", "--merged", "$Remote/$BaseBranch") -Quiet -AllowFail).Lines
    $stale = @($mergedRemote | Where-Object { $_ -match "^\s*$Remote/(feat|fix)/" })
    foreach ($b in $stale) {
        Write-Warn "branch merged-orfano: $($b.Trim())"
        $residui++
    }

    # (c) worktree attive
    $worktrees = Get-Worktrees
    foreach ($wt in $worktrees) {
        if ((Normalize-Path $wt.Path) -ne (Normalize-Path $repoRoot)) {
            Write-Warn "worktree attiva: $($wt.Path) (branch=$($wt.Branch))"
            $residui++
        }
    }

    # (d) branch LOCALI orfani (issue #76)
    # Un branch locale e' orfano se: (1) segue il pattern del workflow agenti,
    # (2) non e' il branch base, (3) non e' checked-out in nessuna worktree
    # (altrimenti e' lavoro attivo di un agente), (4) ha ZERO commit unici
    # rispetto a origin/main -> tutto il suo contenuto e' gia' merged.
    # Il check su (4) e' la garanzia: un branch con anche un solo commit non
    # presente in main e' lavoro in corso e NON viene mai segnalato.
    $checkedOut = @($worktrees | Where-Object { $_.Branch } | ForEach-Object { $_.Branch })
    $localBranches = (Invoke-Git -GitArgs @("for-each-ref", "--format=%(refname:short)", "refs/heads") -Quiet -AllowFail).Lines
    foreach ($lb in $localBranches) {
        if ($lb -eq $BaseBranch) { continue }
        if ($lb -notmatch '^(feat|fix|docs)/[0-9A-Za-z._-]+$') { continue }
        if ($checkedOut -contains $lb) {
            Write-Host "[post-merge]   OK   branch '$lb' in uso (worktree attiva): non e' orfano" -ForegroundColor Green
            continue
        }
        $unique = (Invoke-Git -GitArgs @("rev-list", "--count", "$Remote/$BaseBranch..$lb") -Quiet -AllowFail).Output
        if ($unique -eq "0") {
            Write-Warn "branch LOCALE orfano: $lb (0 commit unici, non checked-out)"
            Write-Host "[post-merge]         git branch -d $lb" -ForegroundColor DarkGray
            $residui++
        }
    }

    if ($residui -eq 0) {
        Write-Ok "nessun residuo post-merge"
        exit 0
    }

    Write-Step "residui rilevati: $residui (vedi AGENTS.md sezione 'Pulizia branch post-merge')" -ForegroundColor Yellow
    exit 14
}

# =====================================================================
# PROCEDURA CANONICA
# =====================================================================

# --- PASSO 0: zero-WIP guard (E3/E4/E5) ---
Write-Step "0/7 Zero-WIP guard"
$dirty = Get-TrackedDirty
if ($dirty.Count -gt 0) {
    if ($Stash) {
        $subject = "pre-post-merge $Branch ($(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'))"
        Write-Warn "WIP tracked rilevato ($($dirty.Count) file): eseguo git stash push -u"
        Invoke-Git -GitArgs @("stash", "push", "-u", "-m", $subject) | Out-Null
        Write-Ok "stash creato: $subject (recuperabile con git stash pop)"
    } elseif ($Force) {
        Write-Warn "WIP tracked presente ($($dirty.Count) file) ma -Force attivo: procedo senza stash (rischio DATA-LOSS)"
        $dirty | ForEach-Object { Write-Host "[post-merge]         $_" -ForegroundColor DarkGray }
    } else {
        Write-Err "WIP non committato rilevato: la procedura si ferma (E3/E4/E5)."
        $dirty | ForEach-Object { Write-Host "[post-merge]         $_" -ForegroundColor DarkGray }
        Write-Host "[post-merge]   Risolvi con una di queste:" -ForegroundColor Yellow
        $stamp = Get-Date -Format 'yyyy-MM-dd'
        Write-Host "[post-merge]     pwsh scripts/post-merge.ps1 -Branch $Branch -Stash" -ForegroundColor Cyan
        Write-Host "[post-merge]     git stash push -u -m wip-$stamp" -ForegroundColor Cyan
        exit 10
    }
} else {
    Write-Ok "working tree pulito (nessun tracked dirty)"
}

# --- PASSO 1: worktree PRIMA (git branch -d fallisce se il branch e' checked-out li) ---
Write-Step "1/7 Worktree"
$targetWt = $worktrees | Where-Object { $_.Branch -eq $Branch -and -not $_.Main } | Select-Object -First 1

if ($targetWt) {
    $wtPath = if ($WorktreePath) { $WorktreePath } else { $targetWt.Path }
    $wtDirty = @()
    if (-not $script:DryRun -and (Test-Path -LiteralPath $wtPath)) {
        $global:LASTEXITCODE = 0
        $raw = & git -C $wtPath status --porcelain 2>&1
        $wtDirty = @(($raw | Out-String) -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^\?\?' })
    }

    if ($wtDirty.Count -gt 0 -and -not $Force) {
        Write-Err "worktree '$wtPath' ha modifiche non committate: non la rimuovo (potrebbe contenere WIP)."
        $wtDirty | ForEach-Object { Write-Host "[post-merge]         $_" -ForegroundColor DarkGray }
        Write-Host "[post-merge]   Se il lavoro e' gia' stato pushato/commitato altrove, usa -Force." -ForegroundColor Yellow
        exit 10
    }

    Write-Warn "branch '$Branch' e' checked-out nella worktree '$wtPath': la rimuovo PRIMA del delete locale"
    Invoke-Git -GitArgs @("worktree", "remove", "--force", $wtPath) | Out-Null
    Write-Ok "worktree rimossa: $wtPath"
} elseif ($WorktreePath -and (Test-Path -LiteralPath $WorktreePath)) {
    Write-Step "rimozione worktree esplicita: $WorktreePath"
    Invoke-Git -GitArgs @("worktree", "remove", "--force", $WorktreePath) | Out-Null
} else {
    Write-Ok "nessuna worktree associata a '$Branch'"
}

# --- PASSO 2: fetch (origin/main deve contenere il merge commit) ---
Write-Step "2/7 Fetch"
Invoke-Git -GitArgs @("fetch", $Remote, "--prune") | Out-Null
Write-Ok "refs aggiornate da $Remote (prune incluso)"

# --- PASSO 3: allineamento main (checkout + merge --ff-only, mai pull) ---
Write-Step "3/7 Allineamento $BaseBranch"

Invoke-Git -GitArgs @("rev-parse", "--verify", "refs/heads/$BaseBranch") -Quiet -AllowFail | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "$BaseBranch locale non esiste: lo creo da $Remote/$BaseBranch"
    Invoke-Git -GitArgs @("checkout", "-b", $BaseBranch, "$Remote/$BaseBranch") | Out-Null
}

if ($currentBranch -ne $BaseBranch) {
    Write-Step "checkout $BaseBranch (da '$currentBranch')"
    Invoke-Git -GitArgs @("checkout", $BaseBranch) | Out-Null
}

$ff = Invoke-Git -GitArgs @("merge", "--ff-only", "$Remote/$BaseBranch") -AllowFail -Quiet
if ($ff.ExitCode -ne 0) {
    $counts = (Invoke-Git -GitArgs @("rev-list", "--left-right", "--count", "$BaseBranch...$Remote/$BaseBranch") -Quiet -AllowFail).Output
    Write-Err "$BaseBranch locale non e' fast-forwardable verso $Remote/$BaseBranch (divergente o locale avanti)."
    Write-Host "[post-merge]         ahead/behind: $counts" -ForegroundColor DarkGray
    Write-Host "[post-merge]   Nessuna azione distruttiva eseguita. Risolvi manualmente:" -ForegroundColor Yellow
    Write-Host "[post-merge]     git log --oneline --left-right $BaseBranch...$Remote/$BaseBranch" -ForegroundColor Cyan
    exit 11
}
$head = (Invoke-Git -GitArgs @("rev-parse", "--short", "HEAD") -Quiet).Output
Write-Ok "$BaseBranch allineato a $Remote/$BaseBranch (HEAD=$head)"

$aheadCount = (Invoke-Git -GitArgs @("rev-list", "--count", "$Remote/$BaseBranch..$BaseBranch") -Quiet -AllowFail).Output
if ($aheadCount -and $aheadCount -ne "0") {
    Write-Warn "$BaseBranch locale ha $aheadCount commit non presenti in $Remote/$BaseBranch (commit locale non pushato)."
    Write-Host "[post-merge]         Se non e' intenzionale, il prossimo lavoro partira' da una base sbagliata." -ForegroundColor DarkGray
}

# --- PASSO 4: verifica merge ---
Write-Step "4/7 Verifica merge di '$Branch'"

$mergeCommitOid = $null
$verified = $false
$verifySource = ""

# (a) fonte autorevole: GitHub API (robusta a squash/rebase/merge-commit)
if ($IssueNumber -gt 0 -and (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Step "verifica via gh (PR merged con head='$Branch')"
    $gh = Invoke-Exe -Exe "gh" -ExeArgs @("pr", "list", "--head", $Branch, "--state", "merged", "--json", "number,mergeCommit,mergedAt", "--limit", "1") -AllowFail
    if ($gh.ExitCode -eq 0 -and $gh.Output) {
        try {
            $prs = @($gh.Output | ConvertFrom-Json)
            if ($prs.Count -gt 0) {
                $verified = $true
                $verifySource = "gh: PR #$($prs[0].number) merged il $($prs[0].mergedAt)"
                $mergeCommitOid = $prs[0].mergeCommit.oid
            }
        } catch {
            Write-Warn "output gh non parsabile: $($_.Exception.Message)"
        }
    }
}

# (b) fallback: ancestralita' (vale solo per merge non-squash)
if (-not $verified) {
    $localExists = (Invoke-Git -GitArgs @("rev-parse", "--verify", "--quiet", "refs/heads/$Branch") -Quiet -AllowFail).ExitCode -eq 0
    $remoteExists = (Invoke-Git -GitArgs @("rev-parse", "--verify", "--quiet", "refs/remotes/$Remote/$Branch") -Quiet -AllowFail).ExitCode -eq 0

    if ($localExists -or $remoteExists) {
        $ref = if ($localExists) { $Branch } else { "$Remote/$Branch" }
        $anc = Invoke-Git -GitArgs @("merge-base", "--is-ancestor", $ref, "$Remote/$BaseBranch") -AllowFail -Quiet
        if ($anc.ExitCode -eq 0) {
            $verified = $true
            $verifySource = "git merge-base --is-ancestor $ref $Remote/$BaseBranch"
        }
    } else {
        $verified = $true
        $verifySource = "branch gia' assente localmente e su $Remote (nessun lavoro da perdere)"
    }
}

if (-not $verified) {
    if ($AllowUnmerged) {
        Write-Warn "merge NON verificato ma -AllowUnmerged attivo: procedo (documenta la giustifica nel PR/issue)"
    } else {
        Write-Err "non riesco a verificare che '$Branch' sia mergato in $Remote/$BaseBranch."
        Write-Host "[post-merge]   Se la PR e' stata mergata con SQUASH, l'antenato non coincide: usa -IssueNumber <N>" -ForegroundColor Yellow
        Write-Host "[post-merge]   (la verifica via GitHub API e' l'unica affidabile in quel caso)." -ForegroundColor Yellow
        Write-Host "[post-merge]   Se il merge e' avvenuto ma non e' ancora pushato: git fetch $Remote --prune" -ForegroundColor Cyan
        Write-Host "[post-merge]   Solo con giustifica scritta: -AllowUnmerged" -ForegroundColor Cyan
        exit 12
    }
} else {
    Write-Ok "merge verificato ($verifySource)"
}

if ($mergeCommitOid) {
    Write-Ok "merge commit: $mergeCommitOid"
}

# Advisory: `git branch -r --merged origin/main` NON elenca i branch squash-merged.
$inMergedList = (Invoke-Git -GitArgs @("branch", "-r", "--merged", "$Remote/$BaseBranch") -Quiet -AllowFail).Lines |
    Where-Object { $_.Trim() -eq "$Remote/$Branch" }
if ($inMergedList) {
    Write-Ok "presente nell'elenco git branch -r --merged $Remote/$BaseBranch"
} else {
    Write-Warn "non elencato da git branch -r --merged $Remote/$BaseBranch (normale se il merge e' squash)"
}

# --- PASSO 5: delete remoto ---
Write-Step "5/7 Delete remoto"
$delRemote = Invoke-Git -GitArgs @("push", $Remote, "--delete", $Branch) -AllowFail
if ($delRemote.ExitCode -ne 0) {
    if ($delRemote.Output -match "remote ref does not exist|unable to delete") {
        Write-Ok "$Remote/$Branch gia' assente (idempotente)"
    } else {
        Write-Err "delete remoto fallito: $($delRemote.Output)"
        exit 13
    }
} else {
    Write-Ok "$Remote/$Branch eliminato"
}

# --- PASSO 6: delete locale ---
Write-Step "6/7 Delete locale"
$localRef = Invoke-Git -GitArgs @("rev-parse", "--verify", "--quiet", "refs/heads/$Branch") -Quiet -AllowFail
if ($localRef.ExitCode -ne 0) {
    Write-Ok "$Branch non esiste piu' in locale (idempotente)"
} else {
    $delLocal = Invoke-Git -GitArgs @("branch", "-d", $Branch) -AllowFail
    if ($delLocal.ExitCode -eq 0) {
        Write-Ok "$Branch eliminato in locale (branch -d, merge sicuro)"
    } else {
        # Caso squash/rebase: i commit non sono antenati di base, ma il contenuto puo' esserci gia'.
        $cherry = (Invoke-Git -GitArgs @("cherry", $BaseBranch, $Branch) -Quiet -AllowFail).Lines
        $plusLines = @($cherry | Where-Object { $_ -match '^\+' })
        if ($cherry.Count -eq 0 -or $plusLines.Count -eq 0) {
            Write-Warn "git branch -d rifiutato (merge squash/rebase), ma git cherry $BaseBranch $Branch non rileva contenuto nuovo: uso -D"
            Invoke-Git -GitArgs @("branch", "-D", $Branch) | Out-Null
            Write-Ok "$Branch eliminato in locale (branch -D, contenuto gia' in $BaseBranch)"
        } elseif ($Force) {
            Write-Warn "-Force attivo: elimino $Branch anche se git cherry rileva $($plusLines.Count) commit non presenti in $BaseBranch"
            Invoke-Git -GitArgs @("branch", "-D", $Branch) | Out-Null
        } else {
            Write-Err "git branch -d rifiutato e git cherry rileva $($plusLines.Count) commit NON presenti in $BaseBranch."
            $plusDump = ($plusLines -join "`n")
            Write-Host "[post-merge]         $plusDump" -ForegroundColor DarkGray
            Write-Host "[post-merge]   Il branch NON e' stato perso. Ispeziona e poi scegli:" -ForegroundColor Yellow
            Write-Host "[post-merge]     git log --oneline $BaseBranch..$Branch" -ForegroundColor Cyan
            Write-Host "[post-merge]     git branch -D $Branch    # solo se il lavoro e' altrove" -ForegroundColor Cyan
            exit 13
        }
    }
}

# --- PASSO 7: prune + riepilogo ---
Write-Step "7/7 Prune e riepilogo"
if (-not $SkipPrune) {
    Invoke-Git -GitArgs @("remote", "prune", $Remote) -Quiet | Out-Null
    Invoke-Git -GitArgs @("worktree", "prune") -Quiet | Out-Null
    Write-Ok "ref remoti e worktree stale ripuliti"
}

if ($IssueNumber -gt 0) {
    Write-Step ""
    Write-Host "[post-merge] ==============================================" -ForegroundColor Green
    Write-Host "[post-merge] Post-merge PR #${IssueNumber}: branch '$Branch' eliminato" -ForegroundColor Green
    Write-Host "[post-merge] ==============================================" -ForegroundColor Green
    $sha = if ($mergeCommitOid) { $mergeCommitOid } else { "<merge-commit-sha>" }
    Write-Host "[post-merge]   gh issue comment $IssueNumber --body `"release: <AGENT-ID> - PR mergata ($sha)`"" -ForegroundColor Cyan
    Write-Host "[post-merge]   pwsh scripts/aggregate-state.ps1 --check    # stato doc (exit 0 = in sync)" -ForegroundColor Cyan
    Write-Host "[post-merge]   pwsh scripts/generate-bundle.ps1 --check   # bundle (exit 0 = in sync)" -ForegroundColor Cyan
} else {
    Write-Step ""
    Write-Host "[post-merge] Branch '$Branch' eliminato (locale + remoto). Ricorda il commento release: sull'issue." -ForegroundColor Green
}

exit 0