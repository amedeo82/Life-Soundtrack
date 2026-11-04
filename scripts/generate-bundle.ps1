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

# === Indipendenza dal sistema operativo e dalla locale (issue #284) ===
#
# 1. PowerShell 7+ obbligatorio (baseline del repo, AGENTS.md F9): l'output
#    dipende dal motore (issue #104). Guardia fail-closed, non solo documentale.
# 2. Timestamp in UTC con locale invariante: l'ora locale del runner (UTC su
#    GitHub, locale sul PC dello sviluppatore) rendeva il bundle non
#    riproducibile.
if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host "[FAIL] Serve PowerShell 7+ (baseline del repo, AGENTS.md F9): trovato $($PSVersionTable.PSVersion)." -ForegroundColor Red
    Write-Host "       L'output del generatore non e' identico su Windows PowerShell 5.1 (issue #104, #284)." -ForegroundColor Yellow
    exit 2
}
$InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture

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
    "docs/state/sessions/65-mood-by-genre-ratifica.md",
    "docs/state/sessions/66-csp-terzo-host-itunes.md",
    "docs/state/sessions/67-ratifica-geo-licenza-agpl.md",
    "docs/state/sessions/68-geo-foundation.md",
    "docs/state/sessions/69-era-detector.md",
    "docs/state/sessions/70-event-detector.md",
    "docs/state/sessions/71-powershell-7-baseline.md",
    "docs/state/sessions/72-audit-procedure-automatiche-pwsh-encoding.md",
    "docs/state/sessions/73-perf-procedure-automatiche.md",
    "docs/state/sessions/74-ci-merge-once.md",
    "docs/state/sessions/75-progress-indicator.md",
    "docs/state/sessions/76-nastro-contesto.md",
    "docs/state/sessions/77-home-timeline.md",
    "docs/state/sessions/78-post-merge-long-paths.md",
    "docs/state/sessions/79-protocollo-contratto-verificato.md",
    "docs/state/sessions/80-gate-protocollo-coerenza.md",
    "docs/state/sessions/81-claim-atomico.md",
    "docs/state/sessions/82-catena-post-merge.md",
    "docs/state/sessions/83-rifinitura-agents.md",
    "docs/state/sessions/84-push-race-retry.md",
    "docs/state/sessions/85-competitive-positioning.md",
    "docs/state/sessions/86-implementation-specs.md",
    "docs/state/sessions/87-encoding-remediation.md",
    "docs/state/sessions/88-post-merge-recovery.md",
    # Sessione 90 (issue #284): automazioni post-merge deterministiche
    # (writer unico, CI post-writer, generatori portabili).
    "docs/state/sessions/90-automazioni-post-merge-definitive.md",
    # Sessione 91 (issue #287): il messaggio di commit del writer senza escape
    # PowerShell rotti, e il test funzionale che lo tiene a posto.
    "docs/state/sessions/91-post-merge-messaggio-commit.md",
    "docs/state/sessions/92-node24-actions.md",
    # Sessione 93 (issue #290): gli hook del repository non giravano
    # (core.hooksPath preso da husky) + i due gate che leggevano file grandi
    # da git fallivano in silenzio.
    "docs/state/sessions/93-hook-wiring.md",
    # Sessione 94 (issue #292): numeri e diagnostiche riallineati dopo la #290,
    # e chiuso il fail-open del gate sul wiring (i contatori degli assert
    # vivevano in variabili di shell e non attraversavano la subshell).
    "docs/state/sessions/94-hook-numbers.md",
    # Sessione 95 (issue #266): lo stato di merge della Story 2.5 allineato
    # dopo la PR #295, e il gap scoperto (le story non hanno un writer di
    # stato di merge: apply-merge-state.mjs scrive solo sulle sessioni).
    "docs/state/sessions/95-story-2-5-merge-state.md",
    # Sessione 96 (issue #297): il writer e il gate coprono anche il perimetro
    # `docs/state/stories/` — il gap aperto dalla Sessione 95 e' chiuso, e i 6
    # drift di merge preesistenti sulle story sono allineati.
    "docs/state/sessions/96-story-merge-state-writer.md",
    # Sessione 97 (issue #241): la Story 3.2 — il feed dei ricordi, il
    # ShareSheet e il tagging manuale.
    "docs/state/sessions/97-ricordi-share.md",
    # Sessione 98: i drift di concorrenza del protocollo (yield che rubava la
    # label, fallback del blocco NEXT-STEP, prosa README, takeover dei claim
    # scaduti).
    "docs/state/sessions/98-fix-drift-concorrenza.md",
    # Sessione 99 (issue #304): la spec della suite di test offline degli
    # script di protocollo (ADR-0014).
    "docs/state/sessions/99-test-suite-protocol-scripts.md",
    "docs/state/stories/1.3-adapter-lastfm-listenbrainz.md",
    "docs/state/stories/1.6-geo-foundation.md",
    "docs/state/stories/1.4-dedup-promotion.md",
    "docs/state/stories/1.5-scrobbling-hub.md",
    "docs/state/stories/2.1-mood-tracker.md",
    "docs/state/stories/2.2-era-detector.md",
    "docs/state/stories/2.3-event-detector.md",
    "docs/state/stories/2.4-memory-engine.md",
    # Story 2.5 (issue #266, PR #295): il collegamento del pipeline di analisi
    # all'app. Il file era stato creato dalla PR #295 ma non era mai stato
    # registrato in `$files`: il bundle ne copiava il contenuto solo per
    # caso (tramite `docs/BUNDLE.md` ↔ `docs/state/`), e il gate
    # `generate-bundle.ps1 -Check` non se ne accorgeva.
    "docs/state/stories/2.5-analysis-pipeline-link.md",
    "docs/state/stories/3.4-context-ribbon.md",
    "docs/state/stories/3.1-home-timeline.md",
    # Story 3.2 (issue #241): Ricordi + Share.
    "docs/state/stories/3.2-ricordi-share.md",
    # Story 3.3, 3.5, 4.3, 5.1, 5.2: i file di stato creati alla ratifica delle
    # specifiche (Sessione 98) — senza questi il blocco NEXT-STEP cadeva sul
    # fallback «nessuna story migrata».
    "docs/state/stories/3.3-esplora-analisi.md",
    "docs/state/stories/3.5-anteprima-onboarding-demo.md",
    "docs/state/stories/4.3-artwork-enrichment.md",
    "docs/state/stories/5.1-privacy-spec-finale.md",
    "docs/state/stories/5.2-export-purge.md",
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
    "docs/13-ADR/0012-agent-protocol-contract.md",
    "docs/14-GLOSSARY.md",
    "docs/15-DESIGN-SYSTEM.md",
    "docs/16-OPERATIONS.md",
    "docs/19-GEO-CONTEXT.md",
    "docs/20-SCROBBLING-HUB.md",
    "docs/21-AUDIO-FEATURES.md",
    "docs/22-COMPETITIVE-POSITIONING.md",
    "docs/23-ANALYSIS-PIPELINE.md",
    "docs/24-ARTWORK-ENRICHMENT.md",
    "docs/25-MEMORIES-SHARE-EXPLORE.md",
    "docs/26-ONBOARDING-DEMO.md",
    "docs/27-PRIVACY-DATA-SETTINGS.md",
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
    # Test di regressione del WIRING degli hook (Sessione 93 / issue #290):
    # verifica (a) che `core.hooksPath` punti su `.githooks` e che nessun
    # lifecycle script possa sovrascriverlo, (b) con un `git commit` REALE in
    # un repo temporaneo, che l'hook abortisca un branch non conforme e
    # lasci passare un branch conforme. 13 assert.
    "scripts/test-hook-wiring.sh",
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
    # Script di supporto per le transizioni tra branch (issue #49): wrappa
    # `git checkout` con lo stesso safety check dello hook post-checkout
    # (stash -u automatico su tracked dirty + verifica post-checkout degli
    # untracked). Test con 3 scenari (pulito / tracked dirty / untracked dirty).
    # Sessione 73 (issue #224): la suite e' stata aggiunta ai gate di CI e il
    # suo conteggio degli assert e' stato riportato fuori dalle subshell
    # (prima era fail-open: riportava "0 passati, 0 falliti").
    "scripts/safe-branch-switch.ps1",
    "scripts/test-safe-branch-switch.sh",
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
    # Gate sulla validita' YAML dei file workflow (Sessione 74): uno scalare
    # semplice (non quotato) che contiene ": " rende il file non valido per
    # GitHub, che lo rifiuta in fase di validazione: la run si chiude `failure`
    # a 0 secondi con `jobs: 0`, nessun log e nessuna annotazione via API —
    # la stessa firma del failure mode dell'issue #135. Il gate intercetta
    # anche i file CRLF (i controlli con regex ancorate a `$` fallivano in
    # silenzio per il `\r` finale).
    "scripts/test-workflow-yaml-scalars.sh",
    # Gate "nessuna action su node20" (Sessione 92 / issue #283): Node 20 e'
    # stato rimosso dai runner GitHub il 2026-09-23, quindi le action che
    # dichiarano `using: 'node20'` girano fuori supporto. Il gate vive in
    # validate-workflows.mjs ed e' fail-closed (mappa NODE24_ACTIONS): questo
    # test ne verifica lo scenario negativo (T1..T6, 19 assert).
    "scripts/test-workflow-node24-actions.sh",
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
    # Gate "encoding dei file tracciati" (Sessione 87 / issue #277): intercetta la
    # corruzione SILENZIOSA che Windows PowerShell 5.1 introduce riscrivendo i file
    # (doppia codifica = mojibake, BOM UTF-8, UTF-8 non valido). Nella Sessione 85
    # due file di sessione erano stati riscritti in ANSI e il danno era finito in
    # `main` senza che un comando fallisse. READ-ONLY in modalita' verifica;
    # `--fix` ripara solo quando l'inversione e' inequivocabile. Gate bloccante in
    # CI (job `gates-docs`) e nel pre-commit hook (INVARIANTE 3).
    "scripts/check-encoding.mjs",
    # Test di regressione del gate "encoding" (issue #277, T1..T7): file pulito
    # (nessun falso positivo sugli accenti), BOM, mojibake, riparazione col --fix,
    # UTF-8 non valido, allowlist e modo `--staged`.
    "scripts/test-encoding-gate.mjs",
    # Allowlist del gate "encoding": i file che documentano esempi di mojibake
    # sono in WARN, non in errore (rimuoverli significherebbe cancellare la lezione).
    "scripts/encoding-allowlist.txt",
    # Test di regressione di apply-merge-state.mjs (issue #275): una PR puo'
    # consegnare piu' file di sessione e lo stato di merge deve essere applicato
    # a TUTTI (prima abortava: le sessioni restavano «non ancora mergiato»).
    "scripts/test-apply-merge-state.mjs",
    # Gate "sintassi dei blocchi run: dei workflow" (Sessione 88 / issue #279):
    # uno step che dichiara `shell: pwsh` ma contiene sintassi bash fallisce a
    # RUNTIME (ParserError) e lascia `main` rotto — misurato lo stesso giorno su
    # auto-state-aggregate.yml e auto-bundle.yml, i due writer della catena.
    # Qui ogni blocco `run:` e' syntax-checked con il parser dello shell
    # dichiarato; le espressioni `${{ ... }}` sono neutralizzate (GitHub le
    # interpola prima dell'esecuzione).
    "scripts/check-workflow-syntax.mjs",
    # Gate di PORTABILITA' dei generatori (issue #284): rigenera i file
    # aggregati e confronta i byte con lo stato committato. Il job
    # `gates-portability` lo esegue su due sistemi operativi reali: e' la
    # prova empirica che l'output dei generatori non dipende dal SO.
    "scripts/check-generators-portable.mjs",
    # Test di regressione del gate di portabilita' (issue #284): scenario
    # negativo in un worktree temporaneo (un generatore alterato deve essere
    # intercettato).
    "scripts/test-generators-portable.sh",
    "scripts/portability-normalize.mjs",
    # Modulo con la normalizzazione dei campi mutabili (usato dal gate di
    # portabilita' e dal suo test di regressione).
    # Test FUNZIONALE del writer post-merge (issue #284, #287): esegue i passi
    # del writer in un clone locale con un remoto finto e verifica il
    # risultato (stato applicato, un solo commit, push, idempotenza,
    # messaggio di commit senza escape PowerShell rotti).
    "scripts/test-post-merge-writer.sh",
    # ADR-0013: automazioni post-merge deterministiche (writer unico, CI
    # post-writer, generatori portabili).
    "docs/13-ADR/0013-post-merge-automation.md",
    # ADR-0014: copertura di test offline degli script di protocollo
    # (issue #304, Sessione 99) — mock di `gh` su PATH, suite per
    # `agent-claim.ps1` e `agent-pr.ps1`.
    "docs/13-ADR/0014-test-suite-protocol-scripts.md",
    # Gate "coerenza del protocollo" (Sessione 80 / issue #248, ADR-0012): confronta
    # i fatti normativi di AGENTS.md con la realta' del repository (6 check: versione
    # dichiarata, tabella label, tabella exit code, integrita' degli anchor,
    # esistenza di script e flag citati, checklist unica). READ-ONLY. Gate
    # bloccante in CI (job `gates-protocol`).
    "scripts/check-protocol-consistency.mjs",
    # Gate "blocchi aggregati intoccabili" (Sessione 80 / issue #248): confronta i
    # blocchi `<!-- AGGREGATE-* -->` della PR con quelli della base. Il controllo e'
    # TESTUALE, quindi immune all'incompatibilita' PS 5.1 / PS 7 che tiene
    # warning-only il check aggregatore: puo' essere bloccante (regola V1 di ADR-0008).
    "scripts/check-aggregate-blocks.mjs",
    # Test di regressione del gate "coerenza del protocollo" (T1..T8): ogni check ha
    # uno scenario che lo fa fallire, piu' il caso positivo. Un gate che passa
    # sempre non e' un gate (lesson 43-1).
    "scripts/test-protocol-consistency.sh",
    # Test di regressione del gate "blocchi aggregati" (T1..T6): blocco modificato,
    # aggiunto, rimosso (falliscono) e blocco esente (passa).
    "scripts/test-aggregate-blocks.sh",
    # Claim atomico (Sessione 81 / issue #256, ADR-0012 regola 5): worktree +
    # label + commento di claim + riverifica deterministica (vince l'id numerico
    # REST piu' basso) + file di stato, in sequenza atomica con rollback.
    "scripts/agent-claim.ps1",
    # Apertura verificata della PR (Sessione 81 / issue #256): verifica i gate
    # locali, crea la PR, transiziona le label e scrive `pr: N` nel file di
    # sessione (chiude la precondizione che faceva fallire il workflow
    # post-merge `auto-session-merge-state.yml`).
    "scripts/agent-pr.ps1",
    # Gate "coerenza claim/issue/branch" (Sessione 81 / issue #256): rende
    # verificabili le 8 regole vincolanti di ADR-0006 (che erano solo prosa) e
    # vieta che una branch `docs/*` porti con se' il codice di un altro task.
    "scripts/check-claim-state.mjs",
    # Test di regressione del gate "coerenza del claim" (T1..T11): ogni
    # controllo ha il suo scenario negativo.
    "scripts/test-claim-state.sh",
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
    # IL writer unico post-merge (issue #284): applica lo stato di merge,
    # rigenera i blocchi aggregati e il bundle, e committa UNA volta. Sostituisce
    # i tre writer precedenti (`auto-bundle`, `auto-session-merge-state`,
    # `auto-state-aggregate`), che concorrevano sugli stessi file generati.
    ".github/workflows/post-merge.yml",
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
        [string]$Timestamp = [DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm', $InvariantCulture)
    )
    $fileCount = $files.Count
    $missing = New-Object System.Collections.Generic.List[string]

    $header = "# BUNDLE CONTENUTO`n`n"
    $header += "> Generato automaticamente da scripts/generate-bundle.ps1`n"
    $header += "> Data: $Timestamp`n"
    $header += "> Totale file: $fileCount`n"

    # PERF: `StringBuilder` invece della concatenazione `$bundle += ...`.
    # La concatenazione con `+=` ricopia l'intera stringa a ogni iterazione:
    # con ~2,4 MB di contenuto e 126 file l'operazione e' O(n^2) e da' circa
    # 150 MB di copie. Il `StringBuilder` e' O(n) e produce lo stesso byte
    # (la concatenazione PowerShell e' puramente additiva).
    $sb = [System.Text.StringBuilder]::new($header.Length + (1MB))
    [void]$sb.Append($header)
    $included = New-Object System.Collections.Generic.List[string]
    $utf8 = [System.Text.UTF8Encoding]::new($false)

    foreach ($file in $files) {
        # PERF: `[System.IO.File]::Exists` al posto del cmdlet `Test-Path`:
        # 126 chiamate in meno al provider di PowerShell, e il path viene
        # trattato come path letterale (nessuna interpretazione di wildcard).
        if ([System.IO.File]::Exists($file)) {
            # PERF: `ReadAllText` al posto di `Get-Content -Raw`: stessa
            # decodifica UTF-8 con rilevamento del BOM, senza l'overhead del
            # cmdlet. Stesso contenuto, byte per byte.
            $content = [System.IO.File]::ReadAllText($file, $utf8)
            # Issue #284: normalizzazione dei line ending del contenuto
            # incorporato. Il repo ha `.gitattributes` con `* text=auto eol=lf`
            # (il checkout e' LF su ogni OS), ma la normalizzazione e' qui la
            # DIFESA DI SECONDO LIVELLO: se un file arrivasse con CRLF (un
            # `.gitattributes` modificato, un file generato da un tool
            # esterno, una copia manuale), il bundle riprodurrebbe byte
            # diversi su macchine diverse.
            if ($null -ne $content) { $content = $content.Replace("`r`n", "`n") }
            [void]$sb.Append("`n`n===== FILE: $file =====`n`n")
            if ($null -ne $content) { [void]$sb.Append($content) }
            [void]$sb.Append("`n")
            $included.Add($file)
        } else {
            $missing.Add($file)
        }
    }

    return @{
        Bundle   = $sb.ToString()
        Included = $included.ToArray()
        Missing  = $missing.ToArray()
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
    # Normalizza timestamp E line endings (CRLF vs LF) per confronto deterministico.
    # PERF: `.Replace()` al posto di `-replace` per il CRLF: il pattern e' un
    # letterale (nessun metacarattere di regex), quindi il risultato e' identico,
    # ma l'operazione e' un confronto ordinale invece di una scansione regex
    # su ~2,4 MB.
    $existing = [regex]::Replace($existing, '(?m)^> Data: .+$', '> Data: 0000-00-00 00:00').Replace("`r`n", "`n")
    $newNormalized = [regex]::Replace($newBundle, '(?m)^> Data: .+$', '> Data: 0000-00-00 00:00').Replace("`r`n", "`n")
    if ($existing -eq $newNormalized) {
        Write-Host "`n[OK] $outputFile e in sync con la lista corrente ($($files.Count) file)." -ForegroundColor Green
        exit 0
    } else {
        # Calcola differenza
        # Issue #284: ordinamento ORDINALE dei nomi dei file. `Sort-Object`
        # usa la collazione della locale corrente: due runner con locale
        # diverse potrebbero elencare i file in ordine diverso e il diff
        # "da aggiungere / da rimuovere" diventerebbe rumore.
        $existingFiles = [string[]]@([regex]::Matches($existing, '(?m)^===== FILE: (.+?) =====$') |
            ForEach-Object { $_.Groups[1].Value })
        $expectedFiles = [string[]]$files
        [System.Array]::Sort($existingFiles, [System.StringComparer]::Ordinal)
        [System.Array]::Sort($expectedFiles, [System.StringComparer]::Ordinal)
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
$newBundle = $newBundle.Replace("`r`n", "`n")

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
    $existingBundleLF = (Get-Content $outputFile -Raw -Encoding UTF8).Replace("`r`n", "`n")
    $oldStamp = [regex]::Match($existingBundleLF, '(?m)^> Data: (.+)$')
    if ($oldStamp.Success) {
        $stamp = $oldStamp.Groups[1].Value.Trim()
        $newNorm = [regex]::Replace($newBundle, '(?m)^> Data: .+$', '> Data: 0000-00-00 00:00')
        $oldNorm = [regex]::Replace($existingBundleLF, '(?m)^> Data: .+$', '> Data: 0000-00-00 00:00')
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
