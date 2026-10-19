<#
.SYNOPSIS
    Wrapper di `git checkout <branch>` con safety check sul working tree.

.DESCRIPTION
    scripts/safe-branch-switch.ps1 esegue il cambio di branch proteggendo il lavoro
    non committato dell'operatore, seguendo AGENTS.md §"Transizioni tra branch".

    Comportamento:
    1. Verifica se il working tree ha modifiche TRACKED sporche (staged o unstaged).
       - Se sporco: esegue automaticamente `git stash push -u` (include untracked)
         con subject descrittivo, PRIMA del checkout.
    2. Esegue `git checkout <branch>`.
    3. Post-checkout: verifica che gli untracked dell'operatore originale siano
       preservati (nello stash se erano presenti) e stampa output strutturato per audit.
    4. Output user-friendly: "switched from X to Y" + diff riassuntivo.

.PARAMETER Branch
    Nome del branch di destinazione (es. main, feat/49-safe-branch-switch).

.PARAMETER Help
    Mostra questo help.

.EXAMPLE
    pwsh scripts/safe-branch-switch.ps1 main
    pwsh scripts/safe-branch-switch.ps1 feat/42-nuova-feature -h

.NOTES
    Restituisce exit code 0 in caso di successo, diverso da 0 se il checkout fallisce.
#>

param(
    [Parameter(Position = 0)]
    [string]$Branch,

    [switch]$Help
)

# Supporta -h, --help, -Help, --Help oltre a -Help dello switch
$helpRequested = $Help -or ($args -contains '-h') -or ($args -contains '--help') -or ($args -contains '-Help') -or ($args -contains '--Help')

if ($helpRequested) {
    Get-Help $MyInvocation.MyCommand.Path -Full | Out-String | Write-Host
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Branch)) {
    Write-Host "[safe-branch-switch] ERRORE: specificare il branch di destinazione." -ForegroundColor Red
    Write-Host "Uso: pwsh scripts/safe-branch-switch.ps1 <branch> [-h|--help]"
    exit 1
}

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "[safe-branch-switch] Branch corrente: $(git branch --show-current)" -ForegroundColor Cyan

# --- 1. Verifica tracked dirty ---
# Riga tracked = prima colonna qualsiasi, seconda colonna diversa da '?' (ignora untracked '??')
# Esempi match: ' M', 'M ', 'AM', 'MM'. Non match: '??' (untracked).
$dirtyTracked = git status --porcelain | Select-String '^.[^\?]'

$stashed = $false
$stashSubject = "auto-stash before switching to $Branch ($(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'))"

if ($dirtyTracked) {
    Write-Host "[safe-branch-switch] Working tree SPORCO (tracked): eseguo git stash push -u prima del checkout." -ForegroundColor Yellow
    git stash push -u -m $stashSubject | Out-Null
    $stashed = $true
    Write-Host "[safe-branch-switch] Stash creato: $stashSubject" -ForegroundColor Green
} else {
    Write-Host "[safe-branch-switch] Working tree pulito: nessun tracked dirty, proseguo diretto al checkout." -ForegroundColor Green
}

# --- Memorizza branch di origine e untracked pre-checkout (per audit) ---
$fromBranch = git branch --show-current
$untrackedBefore = @(git ls-files --others --exclude-standard)

# --- 2. Esegui checkout ---
git checkout $Branch | Out-Null

# --- 3. Verifica post-checkout untracked preservati ---
$untrackedAfter = @(git ls-files --others --exclude-standard)

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "safe-branch-switch: switched from $fromBranch to $Branch" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan

if ($stashed) {
    Write-Host "Stash automatico: ESEGUITO (`"$stashSubject`")" -ForegroundColor Yellow
    Write-Host "  I file untracked dell'operatore originale sono PRESERVATI nello stash."
    Write-Host "  Per recuperarli: git stash pop"
} else {
    Write-Host "Stash automatico: non necessario (working tree pulito)." -ForegroundColor Green
}

if ($untrackedBefore.Count -gt 0) {
    Write-Host "Untracked pre-checkout ($($untrackedBefore.Count)):"
    $untrackedBefore | ForEach-Object { Write-Host "  - $_" }
    if ($stashed) {
        Write-Host "  -> inclusi nello stash -u, recuperabili con 'git stash pop'."
    } else {
        Write-Host "  -> preservati nel working tree (checkout non rimuove gli untracked)."
    }
} else {
    Write-Host "Nessun file untracked prima del checkout."
}

# --- Diff riassuntivo tra branch di origine e destinazione ---
Write-Host ""
try {
    $diffStat = git diff --stat $fromBranch HEAD
    if ($diffStat) {
        Write-Host "Diff riassuntivo ($fromBranch -> $Branch):" -ForegroundColor Cyan
        $diffStat | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "Nessuna differenza di contenuto tra $fromBranch e $Branch." -ForegroundColor Green
    }
} catch {
    Write-Host "Diff riassuntivo non disponibile." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Branch attuale: $(git branch --show-current)" -ForegroundColor Cyan
exit 0
