# 📦 state/ — Sorgenti atomiche per la sincronizzazione lazy

> Status: 🟢 LIVE · Introdotto in Sessione 25 (2026-10-18), ADR-0008
> Scopo: separare le **informazioni atomiche di stato** (story, sessioni) dai **file di stato globale** (`docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`) per eliminare i conflitti di merge generati da agenti paralleli che fanno doc-sync IN PR (D.21.1 di Sessione 21).

---

## Regola d'oro

**I file qui dentro sono editati dalle PR delle singole story / sessioni.** I file in `docs/` (a parte `INDEX.md`/`SESSIONS.md`/`BUNDLE.md`/`11-BACKLOG.md` che vengono **rigenerati**) **non sono più toccati manualmente dalle PR di implementazione**.

| Tipo di PR | Cosa può modificare |
|---|---|
| PR di **implementazione** (story, bug fix) | solo i file nelle rispettive aree + `docs/state/<propria-story>/` + `state/<propria-sessione>/` (se rilevante) |
| PR di **aggregazione** (manutenzione state) | `scripts/aggregate-state.ps1`, `docs/13-ADR/*`, questo README |
| PR di **introduzione policy** (S25) | tutto (necessario per la migration iniziale) |

L'eccezione "PR di introduzione policy" si applica **solo a questa PR** (PR #24 / `feat/24-lazy-state-aggregation`). Vedi ADR-0008 §"Conseguenze".

---

## Layout

```
docs/state/
├── _index.md                    ← questo file (README della gerarchia)
├── sessions/
│   ├── 22-pwa.md                ← frontmatter + body della Sessione 22
│   ├── 23-fix-hook.md
│   └── 24-i18n.md
└── stories/
    ├── 0.5-pwa.md               ← stato atomico + log delle lesson per Story 0.5
    └── 0.6-i18n.md
```

### Convenzione di naming

- `sessions/<N>-<slug>.md` — `N` = numero sessione (zero-padded a 2 cifre), `slug` = kebab-case del titolo
- `stories/<id>-<slug>.md` — `id` = `0.5` / `1.2` / `2.1` (story-id), `slug` = kebab-case del titolo

### Allocazione del numero di sessione *(vincolante, issue #105)*

`N` in `sessions/<N>-<slug>.md` **deve essere univoco** nel momento in cui la PR viene aperta. Una collisione (due agenti paralleli scelgono lo stesso `N`) genera due righe "Sessione N" in `SESSIONS.md` + `docs/INDEX.md` (la tabella diventa formalmente in sync con se stessa ma semanticamente sbagliata) ed esce da `pwsh scripts/aggregate-state.ps1 -Check` con exit 0 = **fail-open**.

**Procedura di pre-check obbligatoria prima di creare il file** (incluso il primo commit della worktree, vedi `scripts/setup-worktree.ps1` step 5):

```powershell
# 1. fetch + lookup del massimo N attualmente su origin/main
git fetch origin

$N = (git ls-tree --name-only origin/main docs/state/sessions/ |
      ForEach-Object { Split-Path $_ -Leaf } |
      Where-Object { $_ -match '^[0-9]+-' } |
      ForEach-Object { [int]($_ -split '-')[0] } |
      Measure-Object -Maximum).Maximum + 1

# 2. sanity: lookup locale per evitare collisioni con file appena creati ma
#    non ancora pushati (raro in pratica ma difesa in profondita)
$NLocal = (Get-ChildItem docs/state/sessions/*.md |
           ForEach-Object { [int]($_.BaseName -split '-')[0] } |
           Measure-Object -Maximum).Maximum
if ($NLocal -ge $N) { $N = $NLocal + 1 }

Write-Host "Prossimo numero di sessione disponibile: $N"
```

**Difesa di seconda linea (rilevamento, non prevenzione)**: `aggregate-state.ps1` (issue #105) include `Find-DuplicateSessionNumbers`. In modalita' `-Check` se rileva due file con lo stesso `Number` emette:

```
[FAIL] 1 numeri di sessione duplicati (issue #105):
  - Number=41:
      docs/state/sessions/41-geo-context-spec.md
      docs/state/sessions/41-alias.md
  Rinumerare uno dei file (es. <N+1>-<slug>.md) e rieseguire il check.
```

…ed esce con codice 1. In modalita' default (apply) emette `[WARN]` ma continua a scrivere, perche' il drift a quel punto e' gia' su `main` e deve essere risolto da un intervento umano.

Storia: il caso reale e' la **Sessione 41** (2026-10-21): l'agente su #98 (spec Apple Music) e l'agente su #99 (geo & contesto) hanno entrambi scelto `40` come numero di sessione. La PR #100 dell'altro agente e' stata mergiata mentre la #99 era in lavorazione; a meta' sessione `main` conteneva `40-apple-music-adapter-spec.md` e `40-geo-context-spec.md`. La collisione e' stata rilevata durante `git rebase` (lesson 41-4) e risolta rinumerando quest'ultimo a `41-geo-context-spec.md` + rebase manuale.

---

## Schema frontmatter

### `state/sessions/<N>-<slug>.md`

```markdown
---
number: 22                          # numero sessione (intero)
title: "..."                         # titolo breve della sessione
date: 2026-10-18                     # data ISO
state: 🟡 | 🟢                       # stato lavoro: 🟡 = in corso, 🟢 = chiuso (opzione C, issue #106)
merged: true | false                 # se la PR/la sessione è stata mergiata (opzione C, issue #106)
merged_commit: "sha"                 # merge commit SHA (post-merge, solo se merged=true)
merged_date: "2026-10-21T15:35:48Z"  # data merge (post-merge, solo se merged=true)
branch: feat/...                     # branch usato
pr: 19                               # numero PR (0 se nessuna aperta)
claim: kilo-...                      # agent-ID che ha fatto claim
---

## Sintesi
[1-2 paragrafi]

## Decisioni
[tabella D.X.Y — Motivazione]

## Analisi di avanzamento
[analisi dello stato del progetto: numeri, cosa è pronto, cosa manca, salute tecnica]

## Lesson learned
[tabella osservazioni]

## Documenti aggiornati
[bullet list file modificati]
```

### `state/stories/<id>-<slug>.md`

```markdown
---
id: "0.5"                            # story-id (stringa con punto)
title: "PWA e service worker"
phase: 0                             # numero fase
area: devops                         # area:adapter / area:devops / area:ui / area:db / ...
status: done                         # todo / in_progress / in_review / done / blocked / wontdo (vedi 11-BACKLOG §"Stato di una Story")
priority: B                          # B=blocker / I=important / L=later
depends_on: ["0.1"]                  # lista story-ids prerequisite
branch: feat/7-pwa-and-service-worker
pr: 19
merged_commit: "3fa3c0d"             # merge commit SHA (post-merge)
merged_date: 2026-10-18              # data merge
---

## Descrizione
[testo della story, spec rilevante]

## Task
- [x] T<id>.1 — ...
- [x] T<id>.2 — ...

## Acceptance criteria
- [x] AC 1 — ...
- [x] AC 2 — ...

## Lesson learned
[timeline errori/fix]

## Documenti aggiornati
[bullet]
```

---

## Aggregazione

Eseguita da `scripts/aggregate-state.ps1`:

```powershell
pwsh scripts/aggregate-state.ps1          # rigenera SESSIONS.md, 11-BACKLOG.md "Stato di avanzamento"
pwsh scripts/aggregate-state.ps1 -Check   # verifica sync (CI gate)
pwsh scripts/aggregate-state.ps1 -List    # lista file sorgente
pwsh scripts/aggregate-state.ps1 -Progress # stampa l'indicatore di avanzamento (non scrive)
```

Trigger automatico via GH Action `.github/workflows/auto-state-aggregate.yml` su `push: branches: [main]` (non-bloccante: committa direttamente eventuali diff di INDEX/SESSIONS/BACKLOG/BUNDLE).

### Indicatore di avanzamento (V4, issue #216)

Il blocco `<!-- AGGREGATE-PROGRESS-* -->` (in `README.md` e `docs/INDEX.md`) rende
la percentuale di implementazione, il conteggio `X/Y`, gli step rimanenti, la
tabella per EPIC, i gate di testabilità e **l'analisi della sessione corrente**.

**Il denominatore è il catalogo del backlog** (gli heading `### Story <id> …`
di `docs/11-BACKLOG.md`), non i soli state file: questi ultimi esistono solo per
le story claimate, e calcolare su quelli darebbe ~90% con 8 story mai scritte.
Lo **stato** di ciascuna story resta nei state file (questa directory).

**La sezione `## Analisi di avanzamento`** di un file di sessione è resa dentro
il blocco: è il posto dove l'agente scrive, a fine implementazione, l'analisi
narrativa dello stato del progetto (numeri, cosa è pronto, cosa manca, salute
tecnica). I numeri del blocco sono calcolati; l'analisi è scritta. Insieme danno
"l'analisi + i numeri" nello stesso posto, senza doppio lavoro.

```powershell
pwsh scripts/aggregate-state.ps1 -Progress   # read-only: stampa l'indicatore
pnpm run progress                             # stesso, via npm script
```

Un state file che descrive una story **assente dal backlog** fa fallire
l'aggregazione (exit 2, prima di qualsiasi scrittura): una percentuale falsa è
peggio di nessuna percentuale.

---

## Stato della migration (S25)

| File | Stato | Note |
|------|-------|------|
| `state/sessions/22-pwa.md` | ✅ migrata da SESSIONS.md | entry S22 |
| `state/sessions/23-fix-hook.md` | ✅ migrata | entry S23 (issue #20) |
| `state/sessions/24-i18n.md` | ✅ migrata | entry S24 (issue #5 / Story 0.6) |
| `state/sessions/27-worktree-default.md` | ✅ migrata | entry S27 (issue #53, worktree-as-default) |
| `state/sessions/28-pr-template-and-branch-protection.md` | ✅ migrata | entry S28 (issue #51, PR template + branch protection) |
| `state/sessions/30-crlf-and-workflow-fix.md` | ✅ migrata | entry S30 (issue #58, CRLF + workflow if:always) |
| `state/sessions/31-agents-md-cleanup.md` | ✅ migrata | entry S31 (cleanup AGENTS.md v1.9, audit workflow) |
| `state/stories/0.1-monorepo-setup.md` | ✅ migrata | da Story 0.1 BACKLOG + 18-DEV-LOG §4 (issue #127, ADR-0008 V3) |
| `state/stories/0.2-schema-db-dexie.md` | ✅ migrata | da Story 0.2 BACKLOG + 18-DEV-LOG §6 (issue #127, ADR-0008 V3) |
| `state/stories/0.5-pwa.md` | ✅ migrata | da Story 0.5 BACKLOG + 18-DEV-LOG §11 |
| `state/stories/0.6-i18n.md` | ✅ migrata | da Story 0.6 BACKLOG + 18-DEV-LOG §12 |
| `state/stories/0.4-ui-import.md` | ✅ migrata | da PR #71 (Sessione 37, issue #84) |
| `state/stories/1.1-adapter-youtube-music.md` | ✅ creata | da `11-BACKLOG.md` §"Story 1.1" (issue #127, ADR-0008 V3): prima non-done, alimenta il blocco `AGGREGATE-NEXT-STEP-*` del README |
| `state/stories/1.2-adapter-apple-music.md` | ✅ creata | da `11-BACKLOG.md` §"Story 1.2" (Sessione 42, issue #132, PR #134): `status: todo`, riattiva `AGGREGATE-NEXT-STEP-*` dopo il fallback dovuto al merge della 1.1 |
| `state/sessions/42-approve-apple-music-spec.md` | ✅ creata | Sessione 42 (PR #134): approvazione spec Apple Music |
| `state/sessions/43-readme-next-step-git-add.md` | ✅ creata | Sessione 43 (issue #136): fix dello staging di `README.md` in `auto-state-aggregate.yml` + gate di copertura `git add` vs `$targets` |
| `state/stories/1.3-adapter-lastfm-listenbrainz.md` | ✅ creata | da `11-BACKLOG.md` §"Story 1.3" (Sessione 47, issue #145): prima non-done della 1.3, `status: in_progress` |
| `state/sessions/47-listenbrainz-lastfm-adapter-spec.md` | ✅ creata | Sessione 47 (issue #145, #144): spec adapter ListenBrainz + Last.fm, Story 1.3 perimetro corretto, Story 1.5 ridimensionata |
| `state/sessions/48-fix-bundle-writer-ordering.md` | ✅ creata | Sessione 48 (issue #149): fix race fra i due writer di `main` — trigger `workflow_run` in `auto-bundle.yml` + quinto gate di `validate-workflows.mjs` |
| `state/sessions/49-adr-0010-remote-source.md` | ✅ creata | Sessione 49 (issue #148): ADR-0010 — sorgenti remote nel contratto `PlatformAdapter` (`parseRemote?()` + `RemoteSource`), `05§4.1` |
| `state/sessions/50-lastfm-adapter-spec.md` | ✅ creata | Sessione 50 (issue #144): spec adapter Last.fm — percorso API via proxy CORS + percorso file, `eventKey` al minuto |
| `state/sessions/51-lastfm-spec-approval.md` | ✅ creata | Sessione 51 (issue #144): promozione spec Last.fm a 🟢 APPROVED v1.0 + apertura dell'issue di implementazione della Story 1.3 (#155) |
| `state/sessions/52-story-1-3-implementation.md` | ✅ creata | Sessione 52 (issue #155): implementazione degli adapter Last.fm + ListenBrainz (Story 1.3) |
| `state/sessions/53-story-1-4-rekey.md` | ✅ creata | Sessione 53 (issue #160): `rekey()` — promozione dedup post-enrichment (Story 1.4) |
| `state/sessions/54-readme-maintenance.md` | ✅ creata | Sessione 54 (issue #161): gate read-only "fatti del README" (prosa confrontata con il codice) + ownership del `README.md` (`AGENTS.md` D.161.1) |
| `state/sessions/55-scrobbling-hub-spec.md` | ✅ creata | Sessione 55 (issue #164): spec della Story 1.5 "Scrobbling hub" (`docs/20-SCROBBLING-HUB.md` v0.1 🟡 DRAFT) — contratto di scrittura `ScrobbleSink`, coda `scrobbleOutbox`, consenso per-hub |
| `state/sessions/56-adr-0011-scrobble-sink.md` | ✅ creata | Sessione 56 (issue #168): ADR-0011 — il **contratto di scrittura** negli hub (`ScrobbleSink` separato da `PlatformAdapter`, vincoli V1-V10), ratificato in `05§4.2` — **merged** (PR #170, `8900c3b`), ADR 🟢 APPROVED v1.0 |
| `state/sessions/57-scrobbling-hub-spec-approval.md` | ✅ creata | Sessione 57 (issue #172): **ratifica della spec `20-SCROBBLING-HUB.md`** (v1.0 🟢 APPROVED) con le quattro decisioni chiuse (D-SH.11…D-SH.14) + allineamento dei documenti toccati + apertura dell'issue di implementazione **#173** — **merged** (PR #174, `4abb73e`), issue #172 chiusa con `status:done` |
| `state/sessions/58-scrobbling-hub-implementation.md` | ✅ creata | Sessione 58 (issue #173): **implementazione della Story 1.5** — contratto `ScrobbleSink`, coda `scrobbleOutbox` (schema Dexie v5), sink Last.fm e ListenBrainz, filtro di eleggibilità (D-SH.13), sync incrementale, web auth, pannello UI e i 31 casi di test della spec |
| `state/sessions/59-epic2-analysis-ratification.md` | ✅ creata | Sessione 59 (issue #178): **ratifica della spec dell'analisi** (`04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 APPROVED) con le cinque decisioni chiuse (D-A.1…D-A.5) + apertura delle issue **#179** (Story 2.4, `agent-ready`) e **#180** (Story 2.1, bloccata dalle audio features EPIC 4.1) |
| `state/sessions/60-next-step-skip-blocked.md` | ✅ creata | Sessione 60 (issue #182): il blocco NEXT-STEP del README indica solo story **lavorabili** (esclude `done`, `blocked`, `wontdo`) — il puntatore è passato dalla 2.1 bloccata alla 2.4 implementabile |
| `state/sessions/61-story-2-4-memory-engine.md` | ✅ creata | Sessione 61 (issue #179): **implementazione della Story 2.4** (Memory Engine) — i 5 generatori, il ranking per rilevanza, la persistenza degli insight `memory` con `derivedVersion` (MIG-3) e l'orchestratore minimale; PR #185 (merge `40ad0b7`) |
| `state/sessions/62-epic-4-1-audio-features-spec.md` | ✅ creata | Sessione 62 (issue #187): **spec e ratifica dell'EPIC 4.1** (`21-AUDIO-FEATURES.md` v1.0 🟢 APPROVED) con le nove decisioni chiuse (D-AF.1…D-AF.9) + allineamento dei documenti toccati + apertura dell'issue di implementazione **#188** (`agent-ready`) — **merged** (PR #190, `b1dd83e`), issue #187 chiusa con `status:done` |
| `state/sessions/69-era-detector.md` | ✅ creata | Sessione 69 (issue #211): **implementazione della Story 2.2** (Era Detector) — le firme settimanali, la similarità (cosine + Jaccard + distanza normalizzata), il **change point detection**, la persistenza delle ere con `derivedVersion` (MIG-3) e il fixture di scenario `era-shift.json` |
| `state/stories/1.5-scrobbling-hub.md` | ✅ creata | Story 1.5 (Scrobbling hub) — ✅ **done** (Sessione 58, issue #173): contratto `ScrobbleSink`, coda `scrobbleOutbox`, sink Last.fm/ListenBrainz, filtro di eleggibilità, sync incrementale, pannello UI, 31 casi di test |
| `state/stories/2.1-mood-tracker.md` | ✅ creata | Story 2.1 (Mood Tracker) — ⛔ **blocked**: senza le audio features dell'EPIC 4.1 il mood tracker non produce insight (decisione D-A.1); issue #180 (`needs-spec`) |
| `state/stories/2.4-memory-engine.md` | ✅ creata | Story 2.4 (Memory Engine) — ✅ **done** (Sessione 61, issue #179, PR #185, merge `40ad0b7`): i 5 tipi di ricordo (`04§7.2`), il feed per rilevanza (`04§7.4`), la `derivedVersion` calcolata dai parametri (`04§9`) e il testo reso dal resolver i18n (D-A.4) |
| `state/stories/2.2-era-detector.md` | ✅ creata | Story 2.2 (Era Detector) — ✅ **done** (Sessione 69, issue #211): **change point detection** su firme settimanali (`04§5`, nessun clustering non supervisionato), il mood dominante classificato dal **classificatore del mood tracker** (D.69.2), la label resa dal resolver i18n (`insight.era.*`) e il ricalcolo che sostituisce **l'insieme** delle ere (D.69.8) |
| `state/sessions/70-event-detector.md` | ✅ creata | Sessione 70 (issue #214): **implementazione della Story 2.3** (Event Detector) — il detector a **z-score** su griglia settimanale, il detector a **quota** per `spike_artist`/`spike_genre`, i detector specialistici per `silence` ed `exploration`, il dedupe per tipo e soggetto, la persistenza degli eventi con `derivedVersion` (MIG-3) e il fixture di scenario `listening-spike.json`. **Merged** il 2026-10-31T11:18:48Z (PR #215, merge commit `5149b2c`) |
| `state/sessions/71-powershell-7-baseline.md` | ✅ creata | Sessione 71: **baseline PowerShell 7 (`pwsh`)** per gli script in `scripts/*.ps1` — la documentazione era rimasta ancorata al world di PS 5.1 anche se `pwsh` era disponibile dal 2026-10-21 (lesson 42-1) e la CI usa `shell: pwsh` da sempre. Forma canonica dei flag a singolo trattino (`-Check`), `AGENTS.md` v1.29 con la session start checklist a 6 check (F9: versione di PowerShell), rimosso il riferimento al flag `-Strict` (che non esiste in `aggregate-state.ps1`), `12-DEVOPS.md` v1.3 e `17-DEV-NOTES.md` v0.4 con il nuovo P11 |
| `state/sessions/73-perf-procedure-automatiche.md` | ✅ creata | Sessione 73 (issue #224): **procedure automatiche misurate e velocizzate** — `ci.yml` da 1 job sequenziale (18 step, **172 s**) a **11 job** (10 in parallelo + `quality` aggregatore fail-closed con il nome invariato), `pnpm run verify` (i 4 gate del CI in una sola invocazione locale), `generate-bundle.ps1` con `StringBuilder` (O(n²)→O(n), output byte-identico), `aggregate-state.ps1` con cache dei file di stato, le **5 suite** che la CI non eseguiva ora in CI (con i difetti corretti: `test-safe-branch-switch.sh` fail-open, `test-appendline-lf-fix.ps1` S3 stale, `test-setup-worktree.sh` falliva su ogni piattaforma) e il secondo run di `auto-bundle` saltato quando l'aggregator non ha prodotto un commit. `12-DEVOPS.md` v1.5 (nuova **§9.14**), `17-DEV-NOTES.md` v0.6 (nuovo **P13**), `AGENTS.md` v1.31 |
| state/sessions/74-ci-merge-once.md | ✅ creata | Sessione 74: **la CI girava 4 volte per ogni merge** — il trigger push: branches: [main] senza filtro rieseguiva l'intera pipeline su alberi già validati dalla PR, e il doc-sync PR (che porta pr: e merged_commit:, noti solo dopo il merge) girava l'intera pipeline su file **solo .md**. Ora il trigger push è **filtrato per path** sui 5 file dei writer automatici (gli unici commit che arrivano su main senza passare da una PR), su push girano **solo i job leggeri** (~21 s invece di ~73 s), e il job detect-code fa saltare i gate sul codice quando la PR tocca solo .md (regola conservativa e fail-safe: detector rotto ⇒ i gate girano comunque). In più alidate-workflows.mjs ora **valida la sintassi YAML** (uno scalare semplice con :  rende il file irifiutabile da GitHub: run con jobs: 0 e ailure a 0 s, la firma dell'issue #135) e **normalizza il fine-riga**: i controlli con regex ancorate fallivano in silenzio sui file CRLF. 12-DEVOPS.md §9.14.10-11, AGENTS.md v1.31 |
| `state/sessions/75-progress-indicator.md` | ✅ creata | Sessione 75 (issue #216): **indicatore di avanzamento automatico** — `scripts/aggregate-state.ps1` V4 genera il blocco `<!-- AGGREGATE-PROGRESS-* -->` in `README.md` e `docs/INDEX.md` con la percentuale di implementazione (in story e **pesata per effort**: S=1, M=2, L=3, XL=4), il conteggio `X/Y`, gli **Z step rimanenti**, la tabella per EPIC, i **gate di testabilità** e l'analisi della sessione corrente (`## Analisi di avanzamento` nel file di sessione). Il **denominatore** è il catalogo del backlog (`docs/11-BACKLOG.md`, 28 story), non i soli state file (che esistono solo per le story claimate): **fail-closed** se uno state file descrive una story assente dal backlog (exit 2, prima di scrivere qualsiasi blocco). Modalità read-only `-Progress` (`pnpm run progress`); il workflow `auto-state-aggregate` rigenera il blocco a ogni merge (i trigger `paths:` includono `docs/11-BACKLOG.md`) e il sesto sub-gate di `validate-workflows.mjs` verifica che i trigger coprano tutti gli input del blocco. Test `test-aggregate-determinism.sh` T12/T12b/T13/T14. Sessione rinumerata da 71 a **75** (nel frattempo `main` aveva preso la 71, la 72, la 73 e la 74) |
| `state/stories/2.3-event-detector.md` | ✅ creata | Story 2.3 (Event Detector) — ✅ **done** (Sessione 70, issue #214, PR #215, merge `5149b2c`): gli **otto** tipi di evento di `02§4` (`04§6`), il plug-in dell'orchestratore (`04§8.1`), la descrizione resa dal resolver i18n (`insight.event.*`, D-A.4) e il ricalcolo che sostituisce **l'insieme** degli eventi |
| `state/stories/4.1-audio-features.md` | ✅ creata | Story 4.1 (Pipeline audio features) — ⬚ **todo** (Sessione 62, issue #187): la spec `21-AUDIO-FEATURES.md` è **v1.0 🟢 APPROVED** (ratificata al merge della PR di ratifica), le nove decisioni D-AF.1…D-AF.9 sono ratificate e l'issue di implementazione **#188** è `agent-ready`. `status: todo` ⇒ il blocco NEXT-STEP del README punta alla 4.1, primo anello della catena 4.1 → 2.1 → 2.2/2.3 |
| Sessioni 0..21, 25, 26 | ⬚ TODO (migration incrementale) | restano in `docs/SESSIONS.md` legacy fino a V2 |
| Stories 0.1, 0.2 | ✅ migrate | chiuse con #127, ADR-0008 V3 (2026-10-21) |
| Stories 1.x+ | ⬚ TODO (migration incrementale) | la 1.1 e la 1.2 hanno state file (per `AGGREGATE-NEXT-STEP-*`); la 1.2 è stata creata **all'approvazione della spec** e non al claim, eccezione motivata nella Sessione 42. La 1.3+ seguirà il pattern "crea lo state file al primo claim `agent-ready`" — con l'eccezione delle story **create alla ratifica della spec** (la 2.1 nella Sessione 59, la 2.4 nella Sessione 61, la **4.1 nella Sessione 62**): il file serve al blocco NEXT-STEP, e senza la 4.1 il puntatore ricadrebbe sul fallback "nessuna story non-done e non bloccata migrata" |

> **Nota (Sessione 37, issue #84)**: le 7 story della Fase 0 sono tutte `done` e 6/7 hanno state file (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7 — la 0.7 e 0.5/0.6/0.4 sono pre-V3, 0.1/0.2 aggiunte con issue #127, ADR-0008 V3, per alimentare il blocco `AGGREGATE-NEXT-STEP-*` del README).
>
> Story 1.1 ha il primo state file di una story non-done: serve ad alimentare il blocco `AGGREGATE-NEXT-STEP-*` introdotto con ADR-0008 V3 (issue #127). Le altre 1.x+ seguiranno il pattern "crea lo state file al primo claim `agent-ready`" (migration incrementale).
>
> **Nota (Sessione 42, issue #132)**: la 1.2 anticipa il pattern — il suo state file nasce all'**approvazione della spec** (PR #134) e non al claim, perché è la story che il blocco `AGGREGATE-NEXT-STEP-*` deve indicare come prossima: senza di esso il README resta sul fallback "Nessuna story non-done migrata" per un'intera sessione dopo ogni merge. Il costo (un file da aggiornare in più se lo scope cambia) è minore del beneficio.

Vedi ADR-0008 §"Piano di rollout" per la migration V2 (futuro).

---

## Riferimenti

- **ADR-0008** (`docs/13-ADR/0008-lazy-state-aggregation.md`) 🟢 APPROVED — spec completa
- **Issue #24** — contenitore del lavoro, claim `kilo-HP-ELITEBOOK-hjoe`
- **AGENTS.md** §"📤 Post-merge actions" → sezione §"🔄 Lazy-state aggregation (D.24.x)" aggiornata
- **PR #19** (`feat/7-pwa-and-service-worker`) — primo caso sintomatico
- **17-DEV-NOTES.md** P10 (nuovo) — lessons stabilizzate per future migration
