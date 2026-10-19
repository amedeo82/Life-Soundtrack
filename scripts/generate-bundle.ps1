<#
.SYNOPSIS
    Genera docs/BUNDLE.md: snapshot di tutti i file del progetto in un unico markdown.

.DESCRIPTION
    Il bundle è usato come contesto compatto per handoff con AI che non hanno accesso
    al repository (es. chat esterne, prompt di re-attivazione). Contiene la specifica
    completa in un unico file Markdown.

    Modalità d'uso:
      (default)   Genera docs/BUNDLE.md sovrascrivendo l'esistente
      --check     Verifica che BUNDLE.md sia in sync con lo script; exit code 0 se sì, 1 se no (per CI)
      --list      Stampa la lista dei file che verrebbero inclusi, senza generare nulla
      --help      Mostra questo help

.EXAMPLE
    pwsh scripts/generate-bundle.ps1                # genera BUNDLE.md
    pwsh scripts/generate-bundle.ps1 --check        # CI: fallisce se BUNDLE.md è stale
    pwsh scripts/generate-bundle.ps1 --list         # audit: cosa verrebbe incluso?

.NOTES
    ## Manutenzione dell'elenco file

    Quando aggiungi, rinomini o rimuovi un file del progetto che fa parte della specifica
    (AGENTS.md, README.md, LICENSE, docs/*, fixtures/*), devi aggiornare l'array $files
    qui sotto seguendo queste regole:

    1. **Ordine**: rispetta l'ordine della sezione "Documenti fondamentali" di docs/INDEX.md
       (00..15, 13-ADR, 14, 15) + documenti di supporto (INDEX, SESSIONS, AUDIT) + LICENSE
       + fixtures. Vedi l'array qui sotto per l'ordine canonico.
    2. **Esclusione**: NON includere BUNDLE.md stesso (altrimenti si auto-include) né
       eventuali file generati o di build (dist/, node_modules/, .git/).
    3. **Scoperta automatica** (futuro): se l'elenco diventa ingestibile, sostituire con una
       funzione di discovery basata su `Get-ChildItem -Recurse docs | Where-Object {...}`.
       Per ora l'elenco esplicito è più leggibile e fail-safe.
    4. **Verifica automatica**: il workflow CI esegue `generate-bundle.ps1 --check` ad ogni
       PR; se BUNDLE.md non è in sync, il check fallisce.
    5. **PR checklist**: quando apri una PR che aggiunge/sposta documentazione, includi
       anche l'aggiornamento di questo script + la rigenerazione di BUNDLE.md nella stessa PR.

    Vedi anche:
    - docs/12-DEVOPS.md §9 "Bundle script maintenance"
    - AGENTS.md §Checklist di auto-revisione PR (punto su BUNDLE.md)
#>

param(
    [switch]$Check,
    [switch]$List,
    [switch]$Help
)

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Full | Out-String | Write-Host
    exit 0
}

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$outputFile = "docs/BUNDLE.md"

# === Elenco canonico dei file da includere nel bundle ===
# Regole di manutenzione: vedi commento .NOTES sopra + docs/12-DEVOPS.md §9 + AGENTS.md.
# Quando modifichi questo array, rigenera il bundle e committa nella stessa PR.
$files = @(
    # File di root
    "AGENTS.md",
    "README.md",
    "LICENSE",
    # Documenti di supporto (docs/INDEX.md §Documenti di supporto)
    "docs/INDEX.md",
    "docs/SESSIONS.md",
    "docs/AUDIT-2026-10-15.md",
    # Note di sviluppo (pitfalls toolchain, Story 0.1)
    "docs/17-DEV-NOTES.md",
    # Diario di sviluppo cronologico (problemi/fix/lesson per implementazione)
    "docs/18-DEV-LOG.md",
    # Lazy-state aggregation (ADR-0008, S25): sorgenti atomiche per doc-sync fuori PR
    "docs/state/_index.md",
    "scripts/aggregate-state.ps1",
    # Documenti fondamentali (docs/INDEX.md §Documenti fondamentali, ordine 00..15)
    "docs/00-VISION.md",
    "docs/01-PLATFORMS.md",
    "docs/02-DATA-SCHEMA.md",
    "docs/03-ADAPTERS/SPEC-TEMPLATE.md",
    "docs/03-ADAPTERS/spotify.md",
    "docs/04-ANALYSIS-ALGORITHMS.md",
    "docs/05-ARCHITECTURE.md",
    "docs/06-UX-FLOWS-STATES.md",
    "docs/07-UI-SPEC.md",
    "docs/08-COPY-I18N.md",
    "docs/09-PRIVACY-SECURITY.md",
    "docs/10-TESTING.md",
    "docs/11-BACKLOG.md",
    "docs/12-DEVOPS.md",
    "docs/13-ADR/0001-pwa-first.md",
    "docs/13-ADR/0002-local-first.md",
    "docs/13-ADR/0003-adapter-pattern.md",
    "docs/13-ADR/0005-sync-cloud.md",
    "docs/13-ADR/0006-multi-agent-task-claiming.md",
    "docs/13-ADR/0007-issue-state-machine.md",
    "docs/13-ADR/0008-lazy-state-aggregation.md",
    "docs/14-GLOSSARY.md",
    "docs/15-DESIGN-SYSTEM.md",
    # Fixture (small/foundational) — i file di grandi dimensioni (medium/large/scenarios/demo-user)
    # sono generati da scripts/generate-fixtures.mjs su richiesta, e NON inclusi nel bundle
    # (vedi 10-TESTING §3.5). Lo script generator è incluso.
    "scripts/generate-fixtures.mjs",
    # Generator icone PWA (Story 0.5): produce i 4 PNG in apps/web/public/icons/
    # senza dipendenze esterne (solo zlib built-in di node).
    "scripts/generate-pwa-icons.mjs",
    # Test script per il check D3 di .githooks/pre-commit (Sessione 23 / issue #20).
    # Bash portabile (funziona su WSL, Git Bash, Linux, macOS) — NON incluso nel pre-push hook
    # perché eseguito solo in dev/CI; il check è cross-platform.
    "scripts/test-pre-commit-clean-check.sh",
    # Test per fix AppendLine LF (issue #58): 5 scenari pwsh, verificano che
    # StringBuilder.AppendLine aggiunge CRLF su Windows e che il fix
    # (Append + "n" esplicito) produce LF-only.
    "scripts/test-appendline-lf-fix.ps1",
    # Setup-worktree script (Sessione 27 / issue #53): crea worktree isolata per claim
    # dell'agente, secondo ADR-0006 + D.20.2 push early. Default path ../ls-<N>-<slug>.
    "scripts/setup-worktree.ps1",
    # Test per setup-worktree.ps1 (8 scenari bash, mock gh in tmpdir).
    "scripts/test-setup-worktree.sh",
    # Setup hooks (postinstall idempotente che imposta core.hooksPath = .githooks).
    # Vedi .githooks/README.md + D.20.2 push early.
    "scripts/setup-hooks.js",
    # Hook di Git versionati (vedi AGENTS.md §"Pre-commit hook" + §"Transizioni tra branch").
    # Tutti gli hook risiedono in .githooks/ e sono installati via scripts/setup-hooks.js.
    ".githooks/pre-commit",
    ".githooks/pre-push",
    ".githooks/post-checkout",
    ".githooks/README.md",
    # GitHub config (issue #51, P2 PR template + branch protection):
    # template PR interattivo, CODEOWNERS per review obbligatoria, workflow CI esteso.
    ".github/pull_request_template.md",
    ".github/CODEOWNERS",
    ".github/workflows/ci.yml",
    "fixtures/synthetic-history/spotify-sample.json",
    "fixtures/db-seed/minimal.json"
)

# === Costruzione del bundle (in memoria) ===
function Build-Bundle {
    param(
        [string]$Timestamp = (Get-Date -Format 'yyyy-MM-dd HH:mm')
    )
    $fileCount = $files.Count
    $missing = @()

    $header = "# BUNDLE CONTENUTO`n`n"
    $header += "> Generato automaticamente da scripts/generate-bundle.ps1`n"
    $header += "> Data: $Timestamp`n"
    $header += "> Totale file: $fileCount`n"

    $bundle = $header
    $included = @()

    foreach ($file in $files) {
        if (Test-Path $file) {
            $content = Get-Content $file -Raw -Encoding UTF8
            $bundle += "`n`n===== FILE: $file =====`n`n"
            $bundle += $content
            $bundle += "`n"
            $included += $file
        } else {
            $missing += $file
        }
    }

    return @{
        Bundle   = $bundle
        Included = $included
        Missing  = $missing
    }
}

# === Modalità --list: solo stampa, niente scrittura ===
if ($List) {
    Write-Host "File che verrebbero inclusi nel bundle:" -ForegroundColor Cyan
    foreach ($file in $files) {
        $status = if (Test-Path $file) { "[OK]" } else { "[MISSING]" }
        $color  = if (Test-Path $file) { "Green" } else { "Yellow" }
        Write-Host "  $status $file" -ForegroundColor $color
    }
    exit 0
}

# === Esecuzione principale ===
$result = Build-Bundle
$newBundle = $result.Bundle
$included  = $result.Included
$missing   = $result.Missing

# === Preserva blocco AGGREGATE-BUNDLE-INVENTORY-* (issue #52, ADR-0008 V2) ===
# L'aggregator scrive un blocco di metadata in cima a BUNDLE.md. generate-bundle.ps1
# rigenera il file da zero (file contents) ma DEVE preservare il blocco aggregator.
# Senza questa preservazione, --check fallirebbe dopo ogni rigenerazione.
$bundleInventoryStart = "<!-- AGGREGATE-BUNDLE-INVENTORY-START -->"
$bundleInventoryEnd   = "<!-- AGGREGATE-BUNDLE-INVENTORY-END -->"
if (Test-Path $outputFile) {
    $existingBundle = Get-Content $outputFile -Raw -Encoding UTF8
    $sIdx = $existingBundle.IndexOf($bundleInventoryStart)
    $eIdx = $existingBundle.IndexOf($bundleInventoryEnd, $sIdx)
    if ($sIdx -ge 0 -and $eIdx -ge 0) {
        $preservedBlock = $existingBundle.Substring($sIdx, $eIdx - $sIdx + $bundleInventoryEnd.Length)
        # Inserisci il blocco preservato subito dopo l'header (dopo "> Totale file: ...").
        $headerEnd = $newBundle.IndexOf("`n", $newBundle.IndexOf("> Totale file:"))
        if ($headerEnd -lt 0) { $headerEnd = $newBundle.IndexOf("`n`n") + 1 }
        if ($headerEnd -gt 0) {
            $preservedBlockText = "`n`n" + $preservedBlock + "`n"
            $newBundle = $newBundle.Substring(0, $headerEnd) + $preservedBlockText + $newBundle.Substring($headerEnd)
        }
    }
}

# Log colorato
foreach ($f in $included) { Write-Host "[OK] $f" -ForegroundColor Green }
foreach ($f in $missing)  { Write-Host "[MISSING] $f" -ForegroundColor Yellow }

# === Modalità --check: verifica sync senza scrivere ===
if ($Check) {
    if ($missing.Count -gt 0) {
        Write-Host "`n[FAIL] $((@($missing)).Count) file dichiarati non esistono." -ForegroundColor Red
        exit 2
    }
    if (-not (Test-Path $outputFile)) {
        Write-Host "`n[FAIL] $outputFile non esiste. Esegui 'generate-bundle.ps1' senza --check per generarlo." -ForegroundColor Red
        exit 1
    }
    $existing = Get-Content $outputFile -Raw -Encoding UTF8
    # Normalizza timestamp E line endings (CRLF vs LF) per confronto deterministico
    $existing = $existing -replace '(?m)^> Data: .+$', '> Data: 0000-00-00 00:00' -replace "`r`n", "`n"
    $newNormalized = $newBundle -replace '(?m)^> Data: .+$', '> Data: 0000-00-00 00:00' -replace "`r`n", "`n"
    if ($existing -eq $newNormalized) {
        Write-Host "`n[OK] $outputFile e in sync con la lista corrente ($($files.Count) file)." -ForegroundColor Green
        exit 0
    } else {
        # Calcola differenza
        $existingFiles = [regex]::Matches($existing, '(?m)^===== FILE: (.+?) =====$') |
            ForEach-Object { $_.Groups[1].Value } | Sort-Object
        $expectedFiles = $files | Sort-Object
        $added   = Compare-Object -ReferenceObject $existingFiles -DifferenceObject $expectedFiles |
            Where-Object { $_.SideIndicator -eq "=>" } | ForEach-Object { $_.InputObject }
        $removed = Compare-Object -ReferenceObject $existingFiles -DifferenceObject $expectedFiles |
            Where-Object { $_.SideIndicator -eq "<=" } | ForEach-Object { $_.InputObject }

        Write-Host "`n[FAIL] $outputFile non è in sync." -ForegroundColor Red
        if ($added)   { Write-Host "  Da aggiungere al bundle: $($added -join ', ')" -ForegroundColor Yellow }
        if ($removed) { Write-Host "  Da rimuovere dal bundle: $($removed -join ', ')" -ForegroundColor Yellow }
        if (-not $added -and -not $removed) {
            Write-Host "  Lista file identica, ma contenuto cambiato (modifica uno o piu file doc)." -ForegroundColor Yellow
        }
        Write-Host "`nEsegui 'pwsh scripts/generate-bundle.ps1' per risyncronizzare." -ForegroundColor Cyan
        exit 1
    }
}

# === Default: scrivi BUNDLE.md ===
# Usa UTF-8 senza BOM per stabilita cross-platform e per --check deterministico.
# FORZA LF (issue #58): WriteAllText con UTF-8 no BOM usa line endings OS-default
# (CRLF su Windows, LF su Linux/macOS). Git memorizza LF. -replace CRLF, LF normalizza.
$newBundle = $newBundle -replace "`r`n", "`n"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$outPath = if (Test-Path $outputFile) { (Resolve-Path $outputFile).Path } else { Join-Path (Get-Location) $outputFile }
[System.IO.File]::WriteAllText($outPath, $newBundle, $utf8NoBom)
Write-Host "`nBundle generato in $outputFile ($($files.Count) file)" -ForegroundColor Cyan
