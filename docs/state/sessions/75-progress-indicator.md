---
number: 75
title: "Indicatore di avanzamento automatico (issue #216)"
date: 2026-10-31
state: 🟢
merged: true
merged_commit: "4e8cd4b8efe307f0d6bd20b23531d1d578bd5051"
merged_date: "2026-10-31T21:08:45Z"
branch: feat/216-progress-indicator
pr: 230
claim: kilo-HPELITEBOOK-w0pl
cross_refs: [216, 127, 52, 24]
tags: [devops, tooling, adr-0008]
---

# Sessione 75 — Indicatore di avanzamento automatico (issue #216)

## Sintesi

Il project owner chiede un indicatore che dica, **in qualsiasi momento e senza
intervento manuale**, "a che punto siamo": percentuale di implementazione,
step completati su totale, step rimanenti, e un'analisi del tipo di quella
redatta a mano a fine sessione.

La risposta e' un'estensione di ADR-0008 (V4): `scripts/aggregate-state.ps1`
genera un nuovo blocco `<!-- AGGREGATE-PROGRESS-START/END -->` in `README.md` e
`docs/INDEX.md` con

- la **percentuale di implementazione** (in story e pesata per effort),
- il conteggio **X story completate su Y** e gli **Z step rimanenti**,
- la **tabella per EPIC** con la percentuale di ciascuno,
- l'**elenco degli step ancora da implementare**,
- i **gate di testabilita'** (test end-to-end dell'app, motore di analisi,
  test con dati personali reali),
- l'**analisi della sessione corrente**, resa dalla sezione
  `## Analisi di avanzamento` di questo file.

La procedura e' **veloce** (legge ~30 file markdown, scrive 2 blocchi: meno di
un secondo) ed **automatica**: il workflow `auto-state-aggregate` rigenera il
blocco a ogni merge su `main`, e il gate CI `aggregate-state.ps1 -Check`
verifica che il blocco a mano sia allineato (fail-closed). In locale:
`pnpm run progress` stampa l'indicatore senza scrivere nulla.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.71.1 | Il **denominatore** e' il catalogo completo delle story dichiarate in `docs/11-BACKLOG.md` (28 story), non i soli state file (20) | I state file esistono solo per le story claimate: calcolare la percentuale su quella fonte darebbe 100% con 8 story mai scritte. Il backlog e' la roadmap APPROVED ed e' l'unica fonte che dichiara tutte le story; lo **stato** di ciascuna resta nei state file (ADR-0008: la sorgente atomica dello stato e' `docs/state/`) |
| D.71.2 | Percentuale **pesata per effort** con pesi S=1, M=2, L=3, XL=4, letti dal tag `[SIZE:...]` degli heading `### Story` | Una story `XL` (3.1 Home + Timeline) non vale una `S`: senza il peso, la percentuale dichiara "quasi finito" mentre manca il pezzo piu' grosso. Le Story 5.1 e 5.2 non hanno il tag: default `M`, dichiarato nel codice |
| D.71.3 | **Fail-closed**: uno state file che descrive una story assente dal backlog interrompe l'aggregazione con un codice di uscita non-zero | Una percentuale falsa e' peggio di nessuna percentuale: il denominatore sbagliato produrrebbe un indicatore verde mentre il lavoro manca. Il messaggio dice cosa riallineare |
| D.71.4 | L'analisi narrativa vive nella **sezione `## Analisi di avanzamento`** del file di sessione ed e' resa dal blocco | Il report finale e' "la mia analisi + i numeri" senza doppio lavoro: l'agente scrive l'analisi a fine implementazione (dove la scrive oggi), l'agregator la rende accanto ai numeri calcolati |
| D.71.5 | I **gate di testabilita'** sono dichiarati nel codice (`$ProgressGates`), non dedotti | Il project owner vuole sapere *quando puo' testare l'app*: "EPIC 3 completo" e' una milestone che va detta, non dedotta da una euristica |
| D.71.6 | Il sorgente dello script resta **ASCII**: lettere accentate e caratteri della barra costruiti a runtime | PS 5.1 su file UTF-8 senza BOM legge i non-ASCII con la codepage ANSI (issue #63): i caratteri costruiti a runtime sono immuni |
| D.71.7 | Il blocco e' scritto in **due target** (`README.md` e `docs/INDEX.md`) con lo stesso contenuto | Il README e' la porta d'ingresso per l'owner; l'INDEX e' lo stato canonico del progetto. Due marker distinti, un solo generatore: nessun secondo writer (la race fra i writer di `main` e' chiusa dall'issue #149) |

## Analisi di avanzamento

### Numeri

- **Implementazione: 68%** — 19 story completate su 28 · effort pesato 68% · **mancano 9 step**
- EPIC 0 (Fondamenta) 7/7 · EPIC 1 (Import core) 6/6 · EPIC 2 (Analisi) 4/4 · EPIC 3 (UI/UX) 0/4 · EPIC 4 (Arricchimento) 2/4 · EPIC 5 (Privacy e legale) 0/2 · EPIC 6 (Stack) 0/1

### Cosa e' pronto e cosa manca

- **Il motore e' completo**: ingest da 5 piattaforme, dedup post-enrichment, scrobbling hub con coda e retry, pipeline audio features, mood tracker, era detector, memory engine, event detector, fondazione geo e il DB IP→citta' (4.4). Tutto coperto da test e verde.
- **Manca la UI (EPIC 3, 0/4)**: Home + Timeline, Ricordi + Share, Esplora + Analisi, nastro contesto. Finche' EPIC 3 e' vuota l'app e' solo onboarding/import: si puo' testare il motore, non l'esperienza "colonna sonora della tua vita". **Questo e' il gate che blocca il test end-to-end.**
- **Mancano 4.2/4.3** (lookup MusicBrainz, artwork) e **5.1/5.2** (privacy spec finale, export & purge): senza export/purge non e' prudente testare con dati personali reali.
- **6.1** (upgrade a ultime major) e' schedulata a fine implementazione per policy (D.10.2).

> I numeri sopra sono quelli **calcolati** dal blocco al momento della stesura (dopo il merge che
> ha chiuso la 4.4): se il blocco e l'analisi divergono, il primo e' la fonte di verita' — la
> percentuale e' un dato calcolato, la prosa e' un commento.

### Salute tecnica (verificata su `main`)

`typecheck` ✅ · `lint` ✅ · `build` ✅ (PWA generata, 13 asset in precache) · `test` ✅ **686 test** (574 `@ls/core` + 112 `@ls/web`) + 2 test di performance (10k eventi < 500 ms) · **e2e: un solo smoke test** (`apps/web/e2e/smoke.spec.ts`).

### Procedura introdotta con questa sessione

1. `scripts/aggregate-state.ps1` calcola l'indicatore (catalogo del backlog + stato dei state file) e lo scrive in `README.md` e `docs/INDEX.md`.
2. Il workflow `auto-state-aggregate` lo rigenera a **ogni merge** su `main` (i trigger `paths:` ora includono anche `docs/11-BACKLOG.md`: il catalogo delle story e' un input del blocco).
3. Il gate CI `aggregate-state.ps1 -Check` verifica l'allineamento e **fallisce** se il blocco e' stale.
4. `scripts/validate-workflows.mjs` (nuovo sesto controllo) verifica che i `paths:` del workflow coprano **tutti** gli input del blocco: senza, una story nuova nel backlog lascerebbe l'indicatore fermo senza che nessuno se ne accorga.
5. `pnpm run progress` stampa l'indicatore a richiesta, senza scrivere nulla.

## Lesson learned

- **Il denominatore era il vero buco, non la percentuale**: la prima versione calcolava sui 20 state file e l'indicatore sarebbe stato "86% completato" mentre mancano 10 story. La domanda "quanto manca" si risponde solo con un catalogo completo.
- **`return , $array` dentro una funzione che il chiamante avvolge in `@(...)` produce un array di un elemento**: il conteggio delle story risultava 1 e ogni state file risultava "orfano". Il wrapper serve quando il chiamante NON racchiude in `@()`.
- Il fail-closed sul catalogo ha trasformato un errore silenzioso (percentuale falsa) in un errore rumoroso e localizzato.

## Documenti aggiornati

- `scripts/aggregate-state.ps1` — V4: catalogo, modello di avanzamento, report, blocco `AGGREGATE-PROGRESS-*`, modalita' `-Progress`
- `.github/workflows/auto-state-aggregate.yml` — trigger `paths:` esteso a `docs/11-BACKLOG.md`; messaggio di commit aggiornato
- `scripts/validate-workflows.mjs` — sesto controllo: copertura dei trigger rispetto agli input del blocco
- `scripts/test-aggregate-determinism.sh` — T12/T13/T14 (percentuali, fail-closed, idempotenza del blocco)
- `README.md`, `docs/INDEX.md` — marker del nuovo blocco (README e' anche il posto dove l'owner legge l'indicatore)
- `package.json` — script `progress`
- `docs/12-DEVOPS.md`, `docs/state/_index.md`, `AGENTS.md` — sezione del blocco, schema, obbligo di scrivere l'analisi a fine sessione
- `docs/BUNDLE.md` — rigenerato
