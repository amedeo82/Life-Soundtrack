---
number: 65
title: "Ratifica del fallback mood-by-genre: il fallback non esiste (issue #193)"
date: 2026-10-30
state: 🟡
merged: false
branch: feat/193-mood-genre
pr: 203
claim: kilo-HP-EliteBook-f1a7
cross_refs: [193, 178, 187, 188, 180]
tags: [analysis, phase-2]
---

# Sessione 65 — La ratifica del fallback mood-by-genre (issue #193)

## Sintesi

Due documenti 🟢 APPROVED dicevano cose diverse sullo stesso caso: «senza
audio features». `04§1.4` prescriveva un *fallback* mood-by-genre (una mappa
`genre → valence/energy` «di default»), `21§12` (punto 3) diceva che
l'analisi «degrada a mood-by-genre». Il codice non faceva nessuna delle due
cose: restituiva `null` sotto `minEventsPerPeriod` (D.63.4).

Il **project owner** ha ratificato il 2026-10-30 l'**opzione B**: **il
fallback mood-by-genre non esiste**. La decisione è chiusa come proposta nella
spec (`04§11.1`, **D-A.6**) ed è ratificata dal merge della PR, come D-A.1…D-A.5.

La conseguenza operativa è che il mood resta un **dato raro**: nessun insight
senza feature misurate o manuali. Il segnale che copre il vuoto è il
**warning aggregato per periodo** dichiarato da `04§1.4` e mai emesso: è
quello che questa sessione ha implementato.

## Trigger

Issue **#193** (`size:S`, `agent-ready`, `area:analysis`, `priority:important`),
aperta dalla Sessione 63 come `needs-spec` (la mappa `genre → valence/energy`
non era ratificata in nessun documento). Claim `kilo-HP-EliteBook-f1a7`
(unico claim, riverificato). Worktree `ls-193-mood-genre`, branch
`feat/193-mood-genre`.

Il **project owner** ha scelto l'opzione B fra tre (A: ratificare la mappa
esistente; B: nessun fallback; C: un insight di stima separato) e ha chiesto
che il **warning aggregato** fosse implementato nel codice.

PR **#203** (branch `feat/193-mood-genre`, worktree `ls-193-mood-genre`).

## Cosa è stato consegnato

| Deliverable | Dove |
|-------------|------|
| Il **warning aggregato per periodo** («X eventi senza audio features», solo conteggi) | `packages/core/src/analysis/mood/engine.ts` |
| Il `logger` **opzionale** sul motore e sulla pipeline | `packages/core/src/analysis/mood/engine.ts`, `packages/core/src/analysis/pipeline.ts` |
| I **6 test** del warning aggregato | `packages/core/src/analysis/__tests__/mood-engine.test.ts` |
| `04§1.4` riscritta + `04§11.1` (la decisione **D-A.6**) + `04§8.1` + `04§12` | `docs/04-ANALYSIS-ALGORITHMS.md` (v1.1) |
| `21§12` (punto 3), `21§8.2`, `21§18`, changelog | `docs/21-AUDIO-FEATURES.md` (v1.1) |
| `05§6` (punto 5) e `05§6.2` | `docs/05-ARCHITECTURE.md` (v1.5) |
| Il changelog del backlog (v1.6.27) e le righe legacy dell'indice | `docs/11-BACKLOG.md`, `docs/INDEX.md` |
| Lo state file della story 2.1 allineato alla decisione | `docs/state/stories/2.1-mood-tracker.md` |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-A.6 | **Il fallback mood-by-genre non esiste.** `04§1.4` è riscritta sul comportamento reale (nessun insight senza feature misurate o manuali, nessun proxy sul genere) e `21§12` (punto 3) è allineata: la feature `heuristic`, per l'analisi, è come se non esistesse | La mappa `genre → valence/energy` non era ratificata in **nessun** documento: `04§1.4` la nominava dal 2026-10-14 (Sessione 4) e la ratifica della Sessione 59 non l'ha aggiunta. Inventarla sarebbe il «segnale inventato» che la D-A.1 esclude (*«la vision promette letture vere»*). Le opzioni A e C avrebbero richiesto un campo che marcasse la stima in `MoodPeriodPayload` (`02§4`, **chiuso**): un mood stimato sarebbe indistinguibile da uno misurato nel dato persistito |
| D.65.1 | Il warning è **aggregato per periodo** e contiene **solo conteggi** (eventi senza feature, eventi totali) | `04§1.4` prescrive la forma esatta; un warning per evento o con dati di brano sarebbe rumore e un costo di log |
| D.65.2 | Il `logger` è **opzionale** nel motore e nella pipeline | Nessuna dipendenza nuova e nessun cambiamento di contratto per i chiamanti esistenti: senza logger il motore funziona come prima, semplicemente senza warning |
| D.65.3 | Il warning è emesso **anche quando il periodo non produce insight** (copertura sotto soglia) | Il warning dice «quanta copertura manca», non «quanti insight ho perso»: leggerlo solo quando c'è un insight nasconderebbe proprio il caso peggiore (periodi interi senza feature) |
| D.65.4 | Il **calcolo del mood non cambia** | Sotto `minEventsPerPeriod` il motore restituiva già `null` (D.63.4): la modifica del comportamento è il warning, non la formula |

## Difetti trovati lungo il percorso

**La contraddizione era in due punti, non in uno.** La issue #193 segnalava
`04§1.4`; il punto gemello era `21§12` (punto 3), che ripeteva la stessa
degradazione. Correggere il primo avrebbe lasciato il secondo a dichiarare un
comportamento inesistente: i due documenti sono stati allineati nella stessa
PR.

**Un documento APPROVED che cita un altro documento APPROVED è una catena di
riferimenti, non un fatto.** `21§10.4` riportava la frase di `05§6.2` alla
lettera («le analisi degradano a mood-by-genre»): la correzione di `04` non
bastava, perché la citazione era ancorata in un terzo documento. La verifica
finale è stata una ricerca testuale di `mood-by-genre` in tutto `docs/`.

**Le opzioni A e C non sono solo documentali.** `MoodPeriodPayload` (`02§4`)
è **chiuso**: nessun campo marca la stima. Ratificare la mappa (A) o
separare l'insight stimato (C) avrebbe significato aprire lo schema dati dei
insight — un atto molto più grosso di una riga di spec.

## Verifica

- `pnpm --filter @ls/core exec vitest run src/analysis/__tests__/mood-engine.test.ts`
  → **37** test verdi (6 nuovi sul warning aggregato)
- `pnpm run lint` → verde
- `pnpm run typecheck` → verde
- `pnpm run test` → verde
- `pnpm run build` → verde
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → drift **atteso** nei blocchi
  aggregati (SESSIONS/BACKLOG/INDEX/BUNDLE): li rigenera
  `auto-state-aggregate` post-merge (ADR-0008); nessun numero di sessione
  duplicato (`65` pre-allocato con la procedura di `docs/state/_index.md`)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 65-1 | **Una specifica che nomina una mappa senza darle contenuto è una specifica incompleta, non una feature.** Per mesi `04§1.4` ha descritto un fallback che nessuno sapeva implementare: la frase «mapping genre→valence/energy di default» sembrava una prescrizione, ma non c'era nessun "default" da cui leggerlo. Il costo dell'ambiguità non è stato un bug: è stato un issue aperto e una decisione di design rimandata per tre sessioni |
| 65-2 | **Il codice che non fa una cosa che la spec prescrive è spesso il codice giusto.** Il mood tracker non ha mai degradato a mood-by-genre, e la D-A.1 già vietava i segnali inventati: la contraddizione era solo fra documenti. Verificare il codice prima di modificare la spec ha evitato di "implementare" un fallback che nessuno voleva |
| 65-3 | **Un warning che serve a misurare una copertura va emesso anche quando la copertura è zero.** Emetterlo solo quando si produce un output nasconde il caso peggiore (il periodo interamente coperto di feature mancanti): il segnale di qualità è più utile del segnale di successo |
| 65-4 | **Riferimenti fra documenti APPROVED vanno cercati per nome, non per numero di sezione.** `mood-by-genre` era citato in `04`, `05`, `21` e nei changelog di `11-BACKLOG` e `18-DEV-LOG`: una ricerca testuale sull'intera cartella `docs/` ha trovato cinque occorrenze che la navigazione per sezione non mostrava |

## Documenti aggiornati

- `packages/core/src/analysis/mood/engine.ts` — il `logger` opzionale e il
  warning aggregato per periodo
- `packages/core/src/analysis/pipeline.ts` — `MoodGeneratorOptions.logger`
  inoltrato al motore
- `packages/core/src/analysis/__tests__/mood-engine.test.ts` — 6 test nuovi
- `docs/04-ANALYSIS-ALGORITHMS.md` — v1.1: `§1.4`, `§8.1`, `§11.1` (nuova),
  `§12`, changelog
- `docs/21-AUDIO-FEATURES.md` — v1.1: `§8.2`, `§10.4`, `§12`, `§18`, changelog
- `docs/05-ARCHITECTURE.md` — v1.5: `§6` (punto 5), `§6.2`, changelog
- `docs/11-BACKLOG.md` — changelog v1.6.27
- `docs/INDEX.md` — le righe legacy di `04`, `05`, `11`, `21` e il «prossimo
  passo tecnico»
- `docs/state/stories/2.1-mood-tracker.md` — la scelta D.63.4 allineata alla
  D-A.6
- `docs/state/sessions/65-mood-by-genre-ratifica.md` — **nuovo**
- `scripts/generate-bundle.ps1` — `$files`: il nuovo state file
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#193** — la ratifica del fallback mood-by-genre (claim
  `kilo-HP-EliteBook-f1a7`)
- **#178** — la ratifica della spec dell'analisi (`04` v1.0 🟢 APPROVED),
  Sessione 59: le decisioni D-A.1…D-A.5
- **#187** — la ratifica della spec delle audio features (`21` v1.0 🟢
  APPROVED), Sessione 62: la D-AF.4 (l'euristico non alimenta il mood tracker)
- **#188** — la Story 4.1 (Pipeline audio features), completata nella Sessione
  64: è la pipeline che popola la tabella `features` da cui il mood tracker
  legge
- **#180** — la Story 2.1 (Mood Tracker), completata nella Sessione 63: il
  codice che questa sessione ha modificato
