---
number: 61
title: "Story 2.4 — Memory Engine: i 5 tipi di ricordo e il feed per rilevanza (issue #179)"
date: 2026-10-28
state: 🟡
merged: false
merged_commit: ""
merged_date: ""
branch: feat/179-memory-engine
pr: 185
claim: kilo-hp-elitebook-hj59
cross_refs: [179, 178, 180]
tags: [analysis, phase-2]
---

# Sessione 61 — Story 2.4: il Memory Engine (issue #179)

## Sintesi

Prima implementazione dell'**EPIC 2**: il pacchetto
`packages/core/src/analysis/` non esisteva, e ora c'è. Il memory engine
genera i **cinque** tipi di ricordo della spec `04-ANALYSIS-ALGORITHMS.md`
v1.0 🟢 (§7), li ordina per **rilevanza** (§7.4) e li persiste come insight di
tipo `memory` con la `derivedVersion` calcolata dai parametri (§9).

Il testo del ricordo è una **stringa resa** (D-A.4): nel core non c'è nessuna
stringa italiana, solo la chiave i18n (`insight.memory.*`) e i suoi parametri.
L'app inietta il resolver (i18next), il core non conosce i18next.

## Trigger

Issue **#179** (`agent-ready`, `size:M`, `area:analysis`), aperta nella Sessione
59 dopo la ratifica della spec dell'analisi (issue #178). Claim
`kilo-hp-elitebook-hj59` (unico claim, riverificato).

## Cosa è stato consegnato

| Deliverable | Dove |
|-------------|------|
| I 5 generatori (`on_this_day`, `first_time`, `milestone`, `return`, `seasonal`) | `packages/core/src/analysis/memory/` |
| Il ranking (`baseScore × relevance × recency`) | `packages/core/src/analysis/memory/ranking.ts` |
| La persistenza degli insight `memory` con `derivedVersion` | `packages/core/src/analysis/` + `packages/core/src/db/insights.ts` |
| Il testo reso dal resolver i18n | `packages/core/src/analysis/memory/i18n.ts` + `apps/web/src/i18n/translator.ts` |
| L'orchestratore minimale della tranche | `packages/core/src/analysis/pipeline.ts` |
| I template `memory.*` nei locale `it`/`en` | `apps/web/src/i18n/locales/{it,en}.json` |
| I test (spec + fixture di scenario) | `packages/core/src/analysis/__tests__/` |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.61.1 | Il config object contiene **anche** `milestoneHours` e `milestoneArtists` | Il trigger di `04§7.2` elenca tre famiglie di milestone (eventi, ore, artisti) e `08§2.15` dichiara i template `.events`, `.hours` e `.artists`; il registro `04§9` ne elenca sei. Le due soglie in più sono **versionate insieme** alle altre (`04§1.1`: il config contiene *tutti* i parametri): un parametro che cambia il risultato ma non il `derivedVersion` romperebbe MIG-3. È un allargamento **dichiarato** del registro, non una sostituzione: se il Boss preferisce il perimetro strettamente ratificato, basta togliere le due soglie (gli insight vecchi diventano `stale` e vengono ricalcolati) |
| D.61.2 | `on_this_day` confronta **anno, mese e giorno** | La prosa del trigger dice "nella stessa data (mese+giorno) di N anni fa": confrontare solo mese+giorno (come suggerirebbe il nome `isSameDayMonth` del pseudocodice) matcherebbe eventi di **anni diversi** e renderebbe `yearsAgo` falso |
| D.61.3 | `relevance` e `recency` sono definiti sul **batch del giorno** | La mediana dei `trackCount` è una statistica del batch, e il feed mostra "i top N score per giorno" (`04§7.4`): la normalizzazione è relativa ai ricordi dello stesso giorno |
| D.61.4 | La rilevanza ordinata vive in `Insight.confidence` | `MemoryPayload` (`02§4`) è **chiuso**: non ha un campo score e non si modifica. `confidence` (0..1) è l'unico campo libero dell'insight: il suo valore è lo score normalizzato sul batch del giorno |
| D.61.5 | L'id dell'insight è **deterministico** (`mem-<giorno>-<kind>-<soggetto>`) | Ricalcolare lo stesso giorno non deve creare un duplicato: con un UUID casuale ogni run ripetuto aggiungerebbe righe. Il ricalcolo è idempotente per costruzione |
| D.61.6 | Il confine temporale è il **giorno UTC** | `ListenEvent.day` è 'YYYY-MM-DD' **UTC** (`02§3.2`) e `04§7` non introduce un fuso utente (il `userTimezone` compare solo nel pattern analyzer, `04§4.2`) |
| D.61.7 | Il core **non** conosce i18next: la porta `Translator` è iniettata | `05§9`: `@ls/core/analysis` è puro TypeScript e gira nel Web Worker. L'app passa `i18n.t` (`apps/web/src/i18n/translator.ts`) |

## Difetti trovati lungo il percorso

**Il `text` del ricordo non può stare in un campo chiuso senza perdere il
ranking**: `MemoryPayload` (`02§4`) non ha un campo score, e non si modifica. La
prima implementazione aveva finito per *aggiungere* `score` al payload — che
avrebbe violato una spec APPROVED. La soluzione è `Insight.confidence`: il
payload resta chiuso e il feed resta ordinabile (D.61.4).

**Il bundle del test leggeva i locale dell'app**: il test del resolver non può
copiare i template in una fixture — copierebbe la chiave e perderebbe il
contratto. I test del core leggono `apps/web/src/i18n/locales/*.json` (come
`db/__tests__/helpers.ts` già fa con `fixtures/db-seed/`): se l'app perde una
chiave `insight.memory.*`, il test del core fallisce.

**Il bundle del bundle**: `Insight.payload` è l'unione discriminata di `02§4`,
quindi `payload.text` non compila in TypeScript senza restringere il tipo. I
test usano `memoryPayloadOf(insight)`, che verifica il `kind` e restituisce il
`MemoryPayload`: un narrowing che fallisce sul posto giusto.

## Verifica

- `pnpm run lint` → verde
- `pnpm run typecheck` → verde
- `pnpm run test` → **297** test in `@ls/core` (27 nuovi) + **93** in `@ls/web`
  (5 nuovi), tutti verdi
- `pnpm run build` → verde
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0 (nessun numero di sessione
  duplicato: `61` pre-allocato con la procedura di `docs/state/_index.md`)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 61-1 | **Una spec APPROVED che elenca un trigger in prosa e un parametro in tabella non è una contraddizione: è un invites a dichiarare.** Il trigger dei `milestone` elenca tre famiglie, il registro dei parametri ne elenca sei. La lettura che rispetta entrambi (implementare le tre famiglie e versionare le due soglie in più) è dichiarabile; quella che ne implementa una sola nasconde il conflitto. Dichiarare l'allargamento (D.61.1) costa una riga nel doc di stato; tacere costa un `derivedVersion` che non copre un parametro |
| 61-2 | **Il payload chiuso (`02§4`) non è un ostacolo: è una pista.** Il ranking aveva bisogno di un campo che il payload non ha; la risposta non è aprire il payload ma trovare il campo giusto fuori (`Insight.confidence`). Un vincolo di schema che sembra un blocco spesso indica *dove* mettere la cosa |
| 61-3 | **Il test che legge il contratto vero vale più del test che lo ricopia.** I 27 test del core risolvono le chiavi `insight.memory.*` sui **locale reali dell'app**: una chiave spostata o cancellata nell'app fallisce il test del core, non viceversa. Una copia dei template nel test avrebbe passato mentre l'app era rotta |
| 61-4 | **Il confine del giorno è una decisione, non un dettaglio.** `04§7` non parla di fuso: il codice usa il giorno UTC, coerente con `ListenEvent.day` (`02§3.2`). Dichiararlo (D.61.6) evita che il primo agente che legge il codice lo legga come un bug invece di una scelta |
| 61-5 | **I fixture di scenario coprono mesi, i trigger dei ricordi coprono anni.** I tre fixture di `fixtures/scenarios/` (lockdown, litigio, viaggio estivo) non producono ricordi al giorno dell'ultimo ascolto: i trigger sono anniversari e soglie. Il caso noto si osserva spostando "oggi" di un anno avanti (`on_this_day`) o fermandosi sul giorno in cui la soglia è stata raggiunta (`milestone` dei 5000 ascolti del `summer-roadtrip`). Un fixture che "non produce nulla" può essere un fixture che non è mai stato guardato |

## Documenti aggiornati

- `packages/core/src/analysis/` — **nuovo** pacchetto: `memory/` (i 5
  generatori, il ranking, il resolver i18n, la `derivedVersion`), `pipeline.ts`
  (orchestratore minimale), `index.ts` (barrel)
- `packages/core/src/db/insights.ts` — **nuovo**: persistenza degli insight,
  rilevamento degli insight `stale` (MIG-3), `replaceInsights` transazionale
- `packages/core/src/db/index.ts`, `packages/core/src/index.ts`,
  `packages/core/package.json` — gli export del nuovo modulo (`@ls/core/analysis`)
- `apps/web/src/i18n/translator.ts` — **nuovo**: l'adattatore i18next → porta
  `Translator` del core
- `apps/web/src/i18n/locales/{it,en}.json` — la chiave
  `insight.memory.milestone.artists` (mancava; le altre `memory.*` esistevano già
  da `08§2.15`)
- `docs/state/stories/2.4-memory-engine.md` — `status: in_review`, `pr: 185`,
  task e AC verificati, scelte di implementazione
- `docs/state/sessions/61-story-2-4-memory-engine.md` — **nuovo**
- `docs/11-BACKLOG.md` — sezione Story 2.4 (`**Stato**:`), lista di priorità
  degli agenti, changelog v1.6.20
- `docs/18-DEV-LOG.md` — §27 + changelog 2.12
- `docs/INDEX.md` — "Prossimo passo tecnico" e la riga di `11-BACKLOG.md`
- `scripts/generate-bundle.ps1` — `$files`: la sessione 61
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#179** — la Story 2.4 (claim `kilo-hp-elitebook-hj59`, PR #185)
- **#178** — la ratifica della spec dell'analisi (`04` v1.0 🟢), Sessione 59
- **#180** — la Story 2.1, **bloccata** dalle audio features dell'EPIC 4.1
  (D-A.1): resta la prossima candidate dopo la 2.4
