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

# === Fail-closed param guard (issue #104) ===
# In Windows PowerShell 5.1, with `&`, the operator treats `--check` as the
# end-of-parameters marker (`--`) plus the positional `check` token. The
# positional token is silently appended to $args and never bound to $Check,
# so the script falls through to the default WRITE mode while the user
# believes they are running a check. Result: silent rewrite + exit 0 = fail-open.
# PowerShell 7 (pwsh) normalises --foo to -foo before binding, so the
# fallback only kicks in on PS 5.1 — exactly the environment issue #104 cites.
#
# Mitigation: scan $args and $MyInvocation.UnboundArguments for anything that
# *looks* like an unknown switch (starts with `-` / `--`) and reject the
# invocation with exit code 2 + a redirect to the correct single-dash form.
# This converts the silent `--check` rewrite into a loud, actionable error.
$flagLike = @()
foreach ($a in @($args)) { if ($a -is [string] -and $a -match '^-') { $flagLike += $a } }
foreach ($u in @($MyInvocation.UnboundArguments)) { if ($u -is [string] -and $u -match '^-') { $flagLike += $u } }
if ($flagLike.Count -gt 0) {
    Write-Host "[FAIL] Parametro sconosciuto: $($flagLike -join ' ')" -ForegroundColor Red
    Write-Host "PowerShell 5.1 non mappa '--' su '-': usare il trattino singolo." -ForegroundColor Yellow
    Write-Host "  ERRATO:   scripts/generate-bundle.ps1 --check" -ForegroundColor Yellow
    Write-Host "  CORRETTO: scripts/generate-bundle.ps1 -Check" -ForegroundColor Green
    Write-Host "Vedi issue #104 e AGENTS.md §Manutenzione del bundle script." -ForegroundColor Yellow
    exit 2
}

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
    "docs/state/stories/0.7-operations-runbook.md",
    "docs/state/stories/0.4-ui-import.md",
    "docs/state/sessions/38-doc-sync-legacy.md",
    "docs/state/sessions/41-geo-context-spec.md",
    "docs/state/sessions/47-listenbrainz-lastfm-adapter-spec.md",
    "docs/state/sessions/48-fix-bundle-writer-ordering.md",
    "docs/state/sessions/49-adr-0010-remote-source.md",
    "docs/state/sessions/50-lastfm-adapter-spec.md",
    "docs/state/sessions/51-lastfm-spec-approval.md",
    "docs/state/sessions/52-story-1-3-implementation.md",
    "docs/state/sessions/53-story-1-4-rekey.md",
    "docs/state/sessions/54-readme-maintenance.md",
    "docs/state/sessions/55-scrobbling-hub-spec.md",
    "docs/state/sessions/56-adr-0011-scrobble-sink.md",
    "docs/state/sessions/57-scrobbling-hub-spec-approval.md",
    "docs/state/sessions/58-scrobbling-hub-implementation.md",
    "docs/state/sessions/59-epic2-analysis-ratification.md",
    "docs/state/sessions/60-next-step-skip-blocked.md",
    "docs/state/sessions/61-story-2-4-memory-engine.md",
    "docs/state/sessions/62-epic-4-1-audio-features-spec.md",
    "docs/state/sessions/63-story-2-1-mood-tracker.md",
    "docs/state/sessions/64-audio-features-pipeline.md",
    "docs/state/sessions/66-csp-terzo-host-itunes.md",
    "docs/state/sessions/67-ratifica-geo-licenza-agpl.md",
    "docs/state/stories/1.3-adapter-lastfm-listenbrainz.md",
    "docs/state/stories/1.6-geo-foundation.md",
    "docs/state/stories/1.4-dedup-promotion.md",
    "docs/state/stories/1.5-scrobbling-hub.md",
    "docs/state/stories/2.1-mood-tracker.md",
    "docs/state/stories/2.2-era-detector.md",
    "docs/state/stories/2.3-event-detector.md",
    "docs/state/stories/2.4-memory-engine.md",
    "docs/state/stories/3.4-context-ribbon.md",
    "docs/state/stories/4.1-audio-features.md",
    "docs/state/stories/4.4-db-ip-city.md",
    "scripts/aggregate-state.ps1",
    # Documenti fondamentali (docs/INDEX.md §Documenti fondamentali, ordine 00..15)
    "docs/00-VISION.md",
    "docs/01-PLATFORMS.md",
    "docs/02-DATA-SCHEMA.md",
    "docs/03-ADAPTERS/SPEC-TEMPLATE.md",
    "docs/03-ADAPTERS/spotify.md",
    "docs/03-ADAPTERS/youtube-music.md",
    "docs/03-ADAPTERS/apple-music.md",
    "docs/03-ADAPTERS/listenbrainz.md",
    "docs/03-ADAPTERS/lastfm.md",
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
    "docs/13-ADR/0009-local-ip-geolocation.md",
    "docs/13-ADR/0010-remote-source-adapter.md",
    "docs/13-ADR/0011-scrobble-sink.md",
    "docs/14-GLOSSARY.md",
    "docs/15-DESIGN-SYSTEM.md",
    "docs/16-OPERATIONS.md",
    "docs/19-GEO-CONTEXT.md",
    "docs/20-SCROBBLING-HUB.md",
    "docs/21-AUDIO-FEATURES.md",
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
    # Procedura canonica post-merge (Sessione 33 / Sessione 32 review): script che
    # automatizza i 7 passi di AGENTS.md §"Pulizia branch post-merge" (zero-WIP,
    # worktree, fetch, allineamento main, verifica merge, delete remoto, delete locale,
    # prune). Test associato con 9 scenari (T1..T9) su repo temporanei.
    "scripts/post-merge.ps1",
    "scripts/test-post-merge.sh",
    # Test dei residui post-merge (Sessione 36 / issue #76): rilevamento dei branch
    # LOCALI orfani in post-merge.ps1 -Check (incluso il caso di sicurezza: un branch
    # con lavoro non pushato non deve MAI essere segnalato) e fetch obbligatorio in
    # setup-worktree.ps1 prima di validare il branch base. Gate bloccante in CI.
    "scripts/test-issue-76-residue.sh",
    # Test di regressione per il determinismo dell'aggregator (issue #70): ordinamento
    # per valore, idempotenza byte-identica, round-trip --check. Gate bloccante in CI.
    "scripts/test-aggregate-determinism.sh",
    # Test fail-closed dei flag in generate-bundle.ps1 (issue #104): in PowerShell 5.1
    # con `&`, `--check` ricadeva silenziosamente in modalita' WRITING (fail-open)
    # riscrivendo docs/BUNDLE.md invece di verificarla. Lo script esce ora 2 con
    # messaggio esplicito quando `--*` viene passato per sbaglio. Gate bloccante in CI.
    "scripts/test-bundle-check-idempotent.sh",
    # Validatore dei workflow GitHub Actions (Sessione 35 / issue #73): estrae i
    # blocchi `script:` di github-script e ne verifica la sintassi JS con node,
    # emulando il wrapper async reale. Gate bloccante in CI: un errore JS in un
    # workflow si scoprirebbe altrimenti solo a runtime, dopo il merge.
    "scripts/validate-workflows.mjs",
    # Test di regressione del gate di copertura `git add` vs $targets
    # dell'aggregator (issue #136). T1..T4: lo scenario negativo reintroduce
    # il bug in una fixture e verifica che il gate esca 1.
    "scripts/test-workflow-git-add-coverage.sh",
    # Test di regressione del gate sulle scope di `permissions:` (issue #135).
    # T1..T5: lo scenario negativo reintroduce `metadata: read` — che GitHub
    # rifiuta in fase di validazione del workflow, con 0 job e run a 0s — e
    # verifica che il gate esca 1.
    "scripts/test-workflow-permission-scopes.sh",
    # Test di regressione del gate sul sync con origin/main dei writer di `main`
    # (issue #140). T1..T5: lo scenario negativo rimuove lo step di sync da
    # auto-state-aggregate.yml (il push verrebbe rifiutato come non-fast-forward
    # quando l'altra workflow ha gia' pushato sullo stesso merge commit) e
    # verifica che il gate esca 1; un caso verifica che l'ordine conti.
    "scripts/test-workflow-push-sync.sh",
    # Test di regressione del gate sull'ordinamento fra i due writer di `main`
    # (issue #149). T1..T5: lo scenario negativo rimuove il trigger
    # `workflow_run` da auto-bundle.yml (i due writer restano serializzati ma
    # non ordinati: il bundle puo' copiare blocchi aggregati stale) e verifica
    # che il gate esca 1; un caso verifica che il nome dichiarato nel trigger
    # combaci con il `name:` reale del producer.
    "scripts/test-workflow-writer-ordering.sh",
    # Gate "fatti del README" (Sessione 54 / issue #161): confronta la prosa del
    # README con il codice (ACTIVE_PLATFORMS + ADAPTER_FACTORIES + le classi in
    # packages/core/src/adapters), vieta le capability non implementate fuori dalla
    # sezione roadmap e vieta i conteggi duplicati in prosa. READ-ONLY: il README
    # e' gia' target di aggregate-state.ps1, e un secondo writer riprodurrebbe la
    # race fra i writer di main risolta dal #149. Gate bloccante in CI.
    "scripts/check-readme-facts.mjs",
    # Test di regressione del gate "fatti del README" (issue #161). T1..T9: lo
    # scenario negativo reintroduce il drift in una fixture e verifica che il
    # gate esca 1; un caso verifica che la capability nella roadmap non sia un
    # falso positivo e uno che il file mancante dia exit 2 (errore di ambiente).
    "scripts/test-readme-facts-gate.sh",
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
    # Workflow post-merge che rigenera il contenuto FILE di docs/BUNDLE.md
    # quando $files o un file coperto da esso cambia (issue #115 follow-up
    # di PR #113). Companion di auto-state-aggregate.yml.
    ".github/workflows/auto-bundle.yml",
    "fixtures/synthetic-history/spotify-sample.json",
    "fixtures/synthetic-history/youtube-sample.json",
    "fixtures/synthetic-history/apple-music-sample.csv",
    # Fixture adapter Last.fm + ListenBrainz (Story 1.3): export JSONL, risposte
    # API e i due formati CSV degli export di terze parti.
    "fixtures/synthetic-history/listenbrainz-sample.jsonl",
    "fixtures/synthetic-history/lastfm-scrobbles-sample.json",
    "fixtures/synthetic-history/scrobble-hub-sample.json",
    "fixtures/synthetic-history/scrobble-payloads-sample.json",
    "fixtures/synthetic-history/lastfm-page2-sample.json",
    "fixtures/synthetic-history/lastfm-export-ghanl-sample.csv",
    "fixtures/synthetic-history/lastfm-export-4col-sample.csv",
    "fixtures/synthetic-history/lastfm-export-sample.json",
    "fixtures/db-seed/minimal.json",
    # Fixture delle API esterne della pipeline delle audio features (Story 4.1,
    # issue #188): le risposte di iTunes Search e di AcousticBrainz, usate dai
    # test della pipeline senza mai chiamare la rete (10-TESTING.md §8).
    "fixtures/api-mocks/itunes/search-preview.json",
    "fixtures/api-mocks/itunes/search-no-match.json",
    "fixtures/api-mocks/acousticbrainz/high-level-happy.json",
    "fixtures/api-mocks/acousticbrainz/headers-rate-limit.json"
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
    # Issue #117 (D.117.1): guard esplicito PRIMA della seconda IndexOf.
    # Senza questo, se il marker AGGREGATE-BUNDLE-INVENTORY-START non e'
    # ancora presente (es. fresh run su repo nuovo, prima che
    # aggregate-state.ps1 abbia iniettato il blocco), $sIdx = -1 e la
    # chiamata IndexOf(..., -1) lancia "Parameter 'startIndex' out of range".
    if ($sIdx -ge 0) {
        $eIdx = $existingBundle.IndexOf($bundleInventoryEnd, $sIdx)
        if ($eIdx -ge 0) {
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

# Issue #142: riuso di `> Data:` quando il bundle non cambia per il resto.
# Difetto gemello di quello chiuso in aggregate-state.ps1: `Build-Bundle` accetta
# gia' un parametro `-Timestamp` pensato per il riuso, ma veniva chiamato senza,
# e il path di scrittura ristampava `Get-Date` a ogni esecuzione. `-Check`
# normalizzava il campo, quindi il difetto non faceva fallire nessun gate:
# si manifestava come commit a vuoto — `auto-bundle` committava un nuovo
# `> Data:` dopo ogni merge che toccava un path di `$files`, anche quando il
# contenuto dei file era identico.
#
# Il confronto usa TUTTO il bundle (a parita' di `> Data:`), cosi' che il riuso
# scatti solo quando l'unica differenza e' la data; la sostituzione riguarda
# invece la PRIMA riga `> Data:`, quella dell'header. I documenti inclusi che ne
# contengono una propria (nel repo reale `docs/AUDIT-2026-10-15.md` ha
# `> Data: 2026-10-15`) non devono essere toccati: corromperli sarebbe un danno
# peggiore del commit-rumore che si vuole eliminare.
if (Test-Path $outputFile) {
    $existingBundleLF = (Get-Content $outputFile -Raw -Encoding UTF8) -replace "`r`n", "`n"
    $oldStamp = [regex]::Match($existingBundleLF, '(?m)^> Data: (.+)$')
    if ($oldStamp.Success) {
        $stamp = $oldStamp.Groups[1].Value.Trim()
        $newNorm = $newBundle -replace '(?m)^> Data: .+$', '> Data: 0000-00-00 00:00'
        $oldNorm = $existingBundleLF -replace '(?m)^> Data: .+$', '> Data: 0000-00-00 00:00'
        if (-not [string]::IsNullOrWhiteSpace($stamp) -and $newNorm -eq $oldNorm) {
            $newStamp = [regex]::Match($newBundle, '(?m)^> Data: (.+)$')
            if ($newStamp.Success) {
                $newBundle = $newBundle.Substring(0, $newStamp.Index) +
                             "> Data: $stamp" +
                             $newBundle.Substring($newStamp.Index + $newStamp.Length)
                Write-Host "Data di generazione riusata (contenuto invariato): $stamp" -ForegroundColor DarkGray
            }
        }
    }
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$outPath = if (Test-Path $outputFile) { (Resolve-Path $outputFile).Path } else { Join-Path (Get-Location) $outputFile }
[System.IO.File]::WriteAllText($outPath, $newBundle, $utf8NoBom)
Write-Host "`nBundle generato in $outputFile ($($files.Count) file)" -ForegroundColor Cyan
