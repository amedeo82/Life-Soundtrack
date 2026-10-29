---
number: 63
title: "Story 2.1 — Mood Tracker: il mood di giorno, settimana e mese (issue #180)"
date: 2026-10-29
state: 🟢
merged: false
merged_commit: ""
merged_date: ""
branch: feat/180-mood-tracker
pr: 192
claim: kilo-HP-ELITEBOOK-cbd0dc
cross_refs: [180, 188, 187, 178]
tags: [analysis, phase-2]
---

# Sessione 63 — Story 2.1: il Mood Tracker (issue #180)

## Sintesi

Il **mood tracker** calcola il mood dominante di un periodo (giorno,
settimana, mese) dalla valence e dall'energy media degli ascolti, e lo
persiste come `Insight` di tipo `mood_day` / `mood_week` / `mood_month`
(`04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §3, `02-DATA-SCHEMA.md` §4).

La story era **bloccata**: senza audio features il motore non produceva
niente (decisione **D-A.1**, `04§11`). Il **project owner** ha invertito
l'ordine il 2026-10-29 ("prendi in carico la issue 180 e procediamo a
lavorare su di essa"): il motore è consegnato **completo**, e consuma le
feature **già persistite** nella tabella `features`. Ciò che manca non è il
codice del mood tracker, ma il **riempimento** della tabella: quello resta
alla Story 4.1 (issue #188).

Il motore **non inventa segnali**: sotto la soglia di eventi con feature non
produce nessun insight, e le feature **euristiche** (stime) non sono
visibili al layer di analisi (`21-AUDIO-FEATURES.md` §12, D-AF.4).

## Trigger

Issue **#180** (`size:M`, `area:analysis`), aperta nella Sessione 59 dopo la
ratifica della spec dell'analisi (issue #178) e bloccata dalle audio features
(EPIC 4.1). Claim `kilo-HP-ELITEBOOK-cbd0dc` (unico claim, riverificato), su
assegnazione esplicita del project owner.

## Cosa è stato consegnato

| Deliverable | Dove |
|-------------|------|
| Il motore del mood (periodi, media ponderata, classificazione) | `packages/core/src/analysis/mood/` |
| Il filtro delle sorgenti (solo feature misurate o manuali) | `packages/core/src/analysis/mood/features.ts` |
| Il plug-in dell'orchestratore (`createMoodGenerator`) | `packages/core/src/analysis/pipeline.ts` |
| Il ricalcolo batch degli insight (`replaceInsightsOfType`) | `packages/core/src/db/insights.ts` |
| Il vocabolario temporale condiviso (confine UTC) | `packages/core/src/analysis/datetime.ts` |
| I test (classificazione, periodi, persistenza, fixture di scenario) | `packages/core/src/analysis/__tests__/` |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.63.1 | La Story 2.1 si implementa **prima** della 4.1 | Ordine invertito dal project owner il 2026-10-29. La D-A.1 (`04§11`) diceva "la 2.1 aspetta l'EPIC 4.1" per non consegnare una story che non produce nulla: qui il motore è consegnato **completo** e la catena diventa **4.1 (dati) → 2.1 (letture)**, implementabili in parallelo. Il percorso dati resta dichiarato: senza la 4.1 la tabella `features` è vuota e il mood tracker non ha nulla su cui leggere |
| D.63.2 | Il **filtro per sorgente** vive nel layer di analisi, non nel motore | `21§12` (punto 1-3) è un contratto fra la pipeline di arricchimento e l'analisi: vale per qualunque generatore che legga le feature, non solo per il mood tracker. Il file `analysis/mood/features.ts` lo applica a ogni riga, e la regola che ne deriva è una riga: **il mood tracker vede solo le feature misurate o manuali** |
| D.63.3 | `weekStartDay` (lunedì, ISO-8601) è un **parametro versionato** | `04§3.3` parla di "periodo (giorno/settimana/mese)" ma non dice da quando comincia la settimana. Il parametro è nel config object, quindi versionato come tutti gli altri (`04§1.1`): senza, un cambio di convenzione non renderebbe `stale` gli insight già prodotti (MIG-3). Allargamento **dichiarato** del registro `04§9`, come D.61.1 per il memory engine |
| D.63.4 | Il fallback **mood-by-genre** di `04§1.4` **non** è implementato | La mappa genere→valence/energy "di default" non è ratificata in nessun documento: inventarla sarebbe esattamente il "segnale inventato" che la D-A.1 esclude. Aperta issue `needs-spec` per la mappa; il comportamento dichiarato (nessun insight senza feature) è quello che `04§3.3` prescrive (`if valences.length < 3: return null`) |
| D.63.5 | Un ascolto è utilizzabile solo se ha **valence ed energy** | `02§3.4` dichiara entrambi nullable; il pseudocodice di `04§3.3` controlla solo `valence` e pusherebbe un `energy` `null` nella media, producendo `NaN` e violando l'invariante `avgEnergy ∈ [0, 1]` (`04§3.6`) |
| D.63.6 | Il peso dell'ascolto è `durationMs / 240000`; la media ponderata restituisce `null` se il peso totale è zero | `04§3.3` fissa i 4 minuti come riferimento. Il `null` (anziché `NaN`) evita un insight con medie non finite quando tutti gli ascolti hanno durata zero |
| D.63.7 | `eventCount` è il numero di **tutti** gli ascolti del periodo | È what `04§3.3` scrive (`eventCount: events.length`): dice quanta attività copre il mood, non quanta è stata misurata. La copertura sta in `Insight.confidence` |
| D.63.8 | La `confidence` dell'insight è la **copertura dei dati** (quota di ascolti con feature utilizzabili) | `MoodPeriodPayload` (`02§4`) è **chiuso**: non ha un campo score e non si modifica. `confidence` (0..1) è l'unico campo libero, e il dato disponibile è quanto del periodo il mood copre. Come D.61.4 per il memory engine |
| D.63.9 | L'id dell'insight è **deterministico** (`mood-<period>-<chiave>`) | Ricalcolare un periodo non deve creare un duplicato: con un UUID casuale ogni run ripetuto aggiungerebbe righe. Il ricalcolo è idempotente per costruzione (come `mem-…`, D.61.5) |
| D.63.10 | Il confine è **UTC** e l'istante è l'**inizio** dell'ascolto (`startedAt`, o la fine se `startedAt` è `null`) | Coerente con `ListenEvent.day` (`02§3.2`) e con il memory engine (D.61.6): i due moduli concordano su quale giorno è un ascolto |
| D.63.11 | `replaceInsightsOfType` per il **ricalcolo batch** | Il mood calcola tutti i periodi coperti dagli ascolti in una passata: `replaceInsights` (una transazione per periodo) aprirebbe una transazione per ogni giorno. La variante batch cancella gli insight **stale** (MIG-3) e quelli dei periodi ricalcolati, e lascia intatti gli altri periodi dello stesso tipo (ricalcolo incrementale, `04§1.2`) |
| D.63.12 | Le feature dei **fixture di scenario** sono sintetiche e deterministiche | La pipeline di arricchimento (EPIC 4.1) non è implementata: nessun provider scrive feature vere. I test generano feature deterministiche (seme FNV-1a dell'id del brano + mulberry32, come il generatore dei fixture) dal profilo di mood dello scenario, e verificano il risultato contro il mood dominante **dichiarato** dal fixture (`_metadata.expectedInsights.dominantMood`) |

## Difetti trovati lungo il percorso

**L'esempio numerico di `04§3.5` non torna**: con i suoi stessi input (pesi
0.83 / 1.0 / 0.75 / 1.25 / 0.92, somma 4.75) la media ponderata della
valence è **0.570** e quella dell'energy **0.667**, non 0.585 e 0.675 come
scritto. La **conclusione** (happy) è corretta e il codice la reproduce: è
l'aritmetica dell'esempio ad avere l'errore. Aperta issue `docs` per la
correzione: `04` è APPROVED e non si modifica da un agente.

**La fascia neutra sovrascrive `angry`**: la tabella di `04§3.2` mette
`angry` per valence < 0.5 ed energy ≥ 0.5, ma la nota dice che `neutral`
sovrascrive le quattro classi "se entrambe le coordinate sono nella fascia
[0.4, 0.6]": `0.49 / 0.50` è dentro la fascia, quindi il risultato è
`neutral`, non `angry`. Il codice segue il **pseudocodice** di `04§3.3`, che
controlla la fascia neutra per prima — è l'unico dei due criteri che non
richiede di scegliere.

## Verifica

- `pnpm run lint` → verde
- `pnpm run typecheck` → verde
- `pnpm run test` → **348** test in `@ls/core` (**51** nuovi: 31 motore e
  orchestratore, 9 periodi, 6 persistenza, 5 fixture di scenario) + **2** test
  di performance, tutti verdi; **93** in `@ls/web`, verdi
- `pnpm run build` → verde
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0 (sessione `63`
  pre-allocata con la procedura di `docs/state/_index.md`)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 63-1 | **Un blocco dichiarato dalla spec può essere una scelta di sequencing, non un blocco di codice.** La D-A.1 diceva "la 2.1 aspetta la 4.1" per non consegnare una story che non produce nulla. Il codice del mood tracker, però, era già interamente specificato (`04§3`): ciò che mancava era il **riempimento** della tabella `features`, non la lettura. Separare le due cose (D.63.1) rende le due story parallele invece che sequenziali — e il rischio del "falso verde" si neutralizza da solo: senza feature il motore **non produce niente**, ed è un comportamento testato, non un'omissione |
| 63-2 | **Il contratto fra due moduli va codificato dove può valere per entrambi.** Il filtro per sorgente (`21§12`) è una regola fra la pipeline e l'analisi: metterla dentro il motore del mood l'avrebbe resa una peculiarità di un solo generatore, e il generatore successivo (l'era detector) avrebbe potuto leggerla diversamente. In `analysis/mood/features.ts` il filtro è una funzione riutilizzabile |
| 63-3 | **Una spec APPROVED può avere un errore aritmetico: il codice giusto e la segnalazione giusta.** L'esempio di `04§3.5` dà 0.585/0.675 dove il calcolo dà 0.570/0.667. Il codice implementa la **formula** (la conclusione dell'esempio è giusta) e la difformità va **segnalata** in un'issue: `04` è APPROVED, correggerlo è un atto del Boss, non dell'agente |
| 63-4 | **Le feature sintetiche dei test sono un trucco, non un falso green — se sono dichiarate.** I fixture di scenario dichiarano il mood dominante atteso (`_metadata.expectedInsights`); le feature che lo rendono osservabile sono sintetiche e deterministiche, generate dal profilo dello scenario. Il test verifica il calcolo del motore, non la pipeline di arricchimento (che è un'altra story) |

## Documenti aggiornati

- `packages/core/src/analysis/mood/` — **nuovo**: `types.ts` (config e
  periodi), `classify.ts` (la mappa dei sei quadranti e la media ponderata),
  `period.ts` (confini UTC di giorno, settimana e mese), `features.ts` (il
  filtro per sorgente), `derivedVersion.ts`, `engine.ts`, `index.ts`
- `packages/core/src/analysis/datetime.ts` — **nuovo**: il vocabolario
  temporale condiviso (spostato da `analysis/memory/datetime.ts`, che lo
  riusa)
- `packages/core/src/analysis/pipeline.ts` — `AnalysisInput.features` (opzionale)
  e il plug-in `createMoodGenerator`
- `packages/core/src/analysis/index.ts`, `packages/core/src/index.ts` — gli
  export del modulo mood
- `packages/core/src/db/insights.ts` — `replaceInsightsOfType` (ricalcolo
  batch) · `packages/core/src/db/index.ts` — il suo export
- `packages/core/src/analysis/__tests__/` — `mood-engine.test.ts`,
  `mood-periods.test.ts`, `mood-persistence.test.ts`, `mood-scenarios.test.ts`
  e gli helper (`syntheticFeaturesFor`, `moodPayloadOf`)
- `docs/state/stories/2.1-mood-tracker.md` — `status: in_review`, branch, AC
  verificati, scelte di implementazione
- `docs/state/sessions/63-story-2-1-mood-tracker.md` — **nuovo**
- `docs/11-BACKLOG.md` — sezione Story 2.1 (`**Stato**:` e AC), lista di
  priorità degli agenti, changelog v1.6.23
- `docs/18-DEV-LOG.md` — §29 + changelog
- `docs/INDEX.md` — la riga di `04`, la riga di `11-BACKLOG.md` e il
  "Prossimo passo tecnico"
- `scripts/generate-bundle.ps1` — `$files`: la sessione 63
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#180** — la Story 2.1 (claim `kilo-HP-ELITEBOOK-cbd0dc`, PR #192)
- **#188** — la Story 4.1 (pipeline audio features): **ancora da fare**, è
  ciò che popola la tabella `features` (`agent-ready`, `size:L`)
- **#187** — la spec dell'EPIC 4.1 ratificata (`21-AUDIO-FEATURES.md` v1.0 🟢),
  da cui viene il contratto `getAudioFeatures` filtrato per sorgente (§12)
- **#178** — la ratifica della spec dell'analisi (`04` v1.0 🟢, D-A.1…D-A.5)

## Stato al termine della sessione

Il motore del mood tracker è consegnato e testato; la PR è in attesa di
review. Il percorso dati completo (feature vere nella tabella `features`)
resta alla Story 4.1 (#188): fino a quel momento il mood tracker produce
**nulla** in un'installazione reale, ed è il comportamento dichiarato e
testato, non un difetto.
