---
number: 59
title: "Ratifica della spec dell'analisi (04-ANALYSIS-ALGORITHMS.md) e apertura delle story 2.4 / 2.1"
date: 2026-10-28
state: 🟡
merged: false
merged_commit: ""
merged_date: ""
branch: feat/178-epic2-analysis-ratification
pr: 0
claim: kilo-hp-elitebook-41xb
cross_refs: [178, 179, 180]
tags: [docs, spec, analysis, phase-2]
---

# Sessione 59 — Ratifica di `04-ANALYSIS-ALGORITHMS.md` (issue #178)

## Sintesi

Ratifica della **spec dell'EPIC 2**: `docs/04-ANALYSIS-ALGORITHMS.md` passa da
🟡 DRAFT v0.2 a **🟢 APPROVED v1.0**, con le cinque decisioni aperte chiuse come
proposte (D-A.1…D-A.5, §11).

Lo schema era **già pronto** (`02§4`: `InsightType`, `MemoryPayload`, `Insight.derivedVersion`;
`02§6`: tabelle `sessions` e `insights`), e i fixture di scenario esistevano:
questa ratifica non ha dovuto toccare `02`, che resta 🟢 APPROVED **v1.6**.

La conseguenza operativa è la divisione delle due story dell'EPIC 2:

| Storia | Esito | Issue |
|--------|-------|-------|
| **2.4 — Memory Engine** | ✅ **implementabile subito** | **#179** (`agent-ready`, `size:M`) |
| **2.1 — Mood Tracker** | ⛔ **bloccata** dalle audio features (EPIC 4.1) | **#180** (`needs-spec`) |

## Trigger

Issue **#178** (`needs-spec` → `agent-ready`, `size:M`, `area:analysis`): aperta
nella Sessione 58 quando la coda delle issue è rimasta vuota, con le cinque
decisioni che la spec lasciava aperte. Il precedente è il ciclo della Story 1.5
(issue #164 → #168 → #172 → #173).

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.59.1 | Le cinque decisioni si chiudono **come proposte** (D-A.1…D-A.5 in `04§11`) | Pattern delle spec già ratificate (D1-D7 della spec ListenBrainz, D-SH.11…14 della spec Scrobbling hub): la ratifica è l'atto del Boss, non una decisione dell'agente |
| D.59.2 | La **Story 2.1 aspetta l'EPIC 4.1**; la **2.4 parte subito** (D-A.1) | `04§3.3` legge `getAudioFeatures(e.trackId)` e restituisce `null` sotto i 3 eventi con valence: senza feature il mood tracker non produce nulla. Consegnare la 2.1 sarebbe un falso verde (lesson 58-4) |
| D.59.3 | `return` e `seasonal` sono **specificati** in `04§7.2` (D-A.2) | L'AC della 2.4 chiede i 5 tipi e due avevano il pseudocodice `...`: ridurli a 3 riscriverebbe l'AC |
| D.59.4 | `first_time` passa a **5 brani distinti** (`firstTimeMinTracks`, D-A.3) | L'AC dice "brani", il pseudocodice contava gli ascolti: un artista con un solo brano ascoltato 5 volte non è "significativo" |
| D.59.5 | Il `text` del ricordo è una **stringa resa** alla generazione, con i template i18n **già dichiarati** in `08§2.15` (D-A.4) | `MemoryPayload.text` è APPROVED e non viene toccato; il ricordo è uno snapshot e la lingua in cui è stato scritto è parte della memoria. La generazione resta i18n: nessuna stringa inline |
| D.59.6 | L'orchestratore è **minimale ed estensibile** (`04§8.1`, D-A.5) | Le Story 2.2/2.3 hanno AC e issue proprie; implementarle qui le renderebbe implicite. Pattern: il registry dei sink della Story 1.5 |
| D.59.7 | Il ricordo stagionale è **per genere**, non per artista | I template i18n esistenti (`memory.seasonal` = "Come ogni {month}, è tornato il periodo {genre}") descrivono un **genere**: la specifica originale diceva "artista/genere". Il payload (`02§4`) non ha un campo `genre`: l'informazione vive nel testo reso |

## Difetti trovati lungo il percorso

**I template i18n dei ricordi esistevano già**: `08§2.15` dichiarava da tempo
`memory.on_this_day`, `memory.first_time`, `memory.milestone.events`,
`memory.milestone.hours`, `memory.return` e `memory.seasonal`. La prima stesura
di `04§7.3.1` li **rinominava** (`insight.memory.*`) con parametri diversi
(`gapDays` invece di `months`, `artist` invece di `genre`): la ratifica avrebbe
**rotto** un contratto i18n già dichiarato. Le formule sono state riallineate
alle chiavi esistenti e manca solo `memory.milestone.artists` (le soglie
"artisti unici" sono nella spec §7.2 ma non avevano un template).

**`08-COPY-I18N.md` aveva già un §2.13**: la sezione dei template dei ricordi
è stata prima inserita come §2.13, in collisione con `error.*` (§2.13) e con
`insight.*` (§2.15) che li dichiarava già. La sezione è stata rimossa e la
nota di vincolanza è stata messa dentro §2.15, dove stanno già le chiavi.

**Le sezioni legacy di `08` avevano versioni indipendenti**: `§2.12f` e `§2.12g`
(aggiunti nella Sessione 58) stanno **dopo** il §2.16: l'ordine delle sezioni
non è più quello delle versioni, e un lettore che cerca "l'ultima sezione
aggiunta" la trova prima. Le sezioni esistenti hanno mantenuto la loro
posizione (l'ordine è storico, non cronologico).

## Verifica

- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → drift atteso sui blocchi aggregati (la Sessione 59 e le story 2.1/2.4 li aggiornano)
- `pnpm run lint` / `typecheck` / `test` / `build` → verdi (nessun file applicativo toccato)
- `node scripts/check-readme-facts.mjs` → exit 0
- Nessuna modifica ai blocchi `<!-- AGGREGATE-* -->` (ADR-0008)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 59-1 | **Una spec che ratifica non può rinominare un contratto già dichiarato.** I template i18n dei ricordi esistevano dal bootstrap (`08§2.15`): la ratifica li avrebbe spostati su nomi nuovi, e chi implementa avrebbe trovato due famiglie di chiavi incompatibili. La regola operativa: quando una spec ratifica, **prima** si cerca se il contratto che sta per dichiarare esiste già in un altro documento — e se esiste, la spec si allinea a lui |
| 59-2 | **Uno spec non allineato non è uno spec neutro: è uno spec rotto.** Il caso dei ricordi stagionali mostra il doppio costo: la formula (artista) e il template (genere) dicevano cose diverse, e nessuno dei due gate se ne accorgeva. Le decisioni D-A.1…D-A.5 sono state scritte proprio per colmare questi buchi, e il costo è stato leggerle una per una |
| 59-3 | **Una story bloccata va bloccata per iscritto, non per implicazione.** La 2.1 dipendeva dalle audio features (EPIC 4.1) senza che nessun documento lo dicesse: il backlog dichiarava solo `DEP:0.2`. Dopo la ratifica la dipendenza è in `04§12`, nel backlog, e nell'issue #180: un agente che la prende in carico la vede prima di scrivere codice |
| 59-4 | **Il precedente del ciclo ratifica → implementazione è il modello del progetto.** La Story 1.5 ha avuto quattro issue (spec, ADR, decisioni, implementazione) e tre PR; l'EPIC 2 ha lo stesso schema con una spec in meno (l'ADR-0011 è servito solo perché la scrittura toccava `05§4`, che è APPROVED: qui `04` **è** la spec, e l'analysis non tocca `05§4`). Non ogni decisione architetturale ha bisogno di un ADR |

## Documenti aggiornati

- `docs/04-ANALYSIS-ALGORITHMS.md` — **v1.0 🟢 APPROVED**: §7.2 (`return`,
  `seasonal`, `first_time`), §7.3 (parametri), §7.3.1 (il testo dei ricordi e le
  chiavi), §8.1 (perimetro della tranche), §9 (registro), §11 (le decisioni),
  §12 (perimetro e dipendenze), changelog 1.0
- `docs/08-COPY-I18N.md` — §2.15: i template `memory.*` dichiarati **vincolanti** +
  la chiave `memory.milestone.artists`; v0.7
- `docs/11-BACKLOG.md` — Story 2.1 (bloccata, con la ragione) e 2.4 (implementabile),
  lista di priorità degli agenti, header v1.6.18, changelog 1.6.18
- `docs/INDEX.md` — riga 04 (v1.0 🟢), conteggi legacy APPROVED/DRAFT, riga 11,
  riga 18, riga 08, "Prossimo step tecnico"
- `docs/18-DEV-LOG.md` — §25 (nuova) + changelog 2.7
- `docs/state/sessions/59-epic2-analysis-ratification.md` — **nuovo**
- `docs/state/stories/2.1-mood-tracker.md` — **nuovo** (`status: blocked`,
  issue #180)
- `docs/state/stories/2.4-memory-engine.md` — **nuovo** (`status: todo`, issue #179)
- `docs/state/_index.md` — righe della Sessione 59 e delle story 2.1/2.4
- `scripts/generate-bundle.ps1` + `docs/BUNDLE.md` — i tre file nuovi
- Issue **#179** (implementazione della 2.4, `agent-ready`) e **#180** (la 2.1,
  `needs-spec`)

## Cross-refs

- **#178** — le cinque decisioni di ratifica (claim `kilo-hp-elitebook-41xb`)
- **#179** — implementazione della Story 2.4 (Memory Engine)
- **#180** — la Story 2.1, bloccata dalle audio features dell'EPIC 4.1
- **#164** — il precedente del ciclo ratifica → implementazione (Story 1.5)
