---
number: 95
title: "Dopo la #295: lo stato di merge della Story 2.5 allineato, e il gap dei writer scoperto"
date: 2026-11-03
state: 🟡
merged: false
merged_commit: ""
merged_date: ""
branch: fix/297-story-merge-state-writer
pr: 0
claim: kilo-HP-ELITEBOOK-2x9k
tags: [docs, stato, story, protocollo, devops]
---

# Sessione 95 — lo stato di merge della Story 2.5 (issue #266)

> **Oggetto**: la Story 2.5 (collegamento del pipeline di analisi all'app) è **mergata in `main`**
> (PR #295, merge commit `265fa50`), ma il suo file di stato ne dichiarava ancora `status: in-review`
> con un numero di PR **inesistente** (`267`). Il blocco `AGGREGATE-NEXT-STEP-*` del README
> continuava quindi a indicare la 2.5 come «prossima story da implementare», e le sezioni legacy
> del backlog la dichiaravano `⬚ TODO — pronta al claim`.

## Sintesi

Il sintomo — «la prossima story è ancora quella che ho appena finito» — è un **drift di stato**, e
la causa non è la PR #295 ma un **gap di copertura** fra i writer e i gate.

`scripts/apply-merge-state.mjs` (issue #239) scrive lo stato di merge **solo** sui file di
`docs/state/sessions/`: la sua directory di ricerca è `sessionsDir` e i campi che aggiorna sono
`state`, `merged`, `merged_commit`, `merged_date` — il **formato delle sessioni**. Il formato delle
story è diverso (`status`, e `merged`/`merged_commit` non ci sono). Lo stesso vale per il gate
bloccante `scripts/check-merge-state.mjs`, che confronta **solo** le sessioni con lo stato reale
delle PR.

La PR #295 non aveva un file di sessione in `docs/state/sessions/`: `apply-merge-state.mjs` ha
quindi stampato «nessun file di sessione corrisponde alla PR #295: niente da applicare» ed è uscito
**0**. È il comportamento corretto per il suo contratto — l'assenza di una sessione è un *fatto*,
non un errore (fail-closed selettivo, Sessione 82) — ma lascia un buco: **una story mergiata non
ha nessun writer che aggiorni il suo stato di merge, e nessun gate che se ne accorga.**

La conseguenza è che lo stato delle story mergiate dipende da un **doc-sync manuale** in una PR
`docs:` dedicata. È il pattern consolidato del repository (`2f5c1c2 docs: post-merge sync story
4.4 (pr 222)`), ma è un costo che nessuna regola dichiara e che solo l'elenco delle story
mergiate rende visibile a posteriori.

## Cosa è stato fatto

- **`docs/state/stories/2.5-analysis-pipeline-link.md`**: `status: in-review` → `done`, `pr: 267`
  → `295` (la PR reale), `merged_commit` e `merged_date` compilati; la sezione `## Stato` e la
  sezione `## Esito post-merge` riscritte (la seconda riporta la causa strutturale, non solo
  l'esito).
- **`docs/11-BACKLOG.md`**: `**Stato**:` da `⬚ TODO — pronta al claim` a `✅ DONE — mergiata in
  main`; i **7 acceptance criteria** spuntati; la riga della tabella «Stato di avanzamento»
  aggiornata; l'entry #15 della lista di priorità riscritta; l'header di versione (1.6.34 →
  1.6.35) e una nota di allineamento che dichiara il nuovo ordine di lavorazione.
- **`README.md`**: la riga di roadmap «Collegamento del pipeline di analisi (EPIC 2, Story 2.5) …
  non sono ancora eseguiti dall'app» rimossa: la capability è **implementata**, e la regola del
  README vuole le capability non ancora implementate **solo** nella sezione roadmap.
- **`docs/18-DEV-LOG.md`**: nuova §51 con i tre sintomi, la causa e la lezione.

I blocchi `AGGREGATE-*` sono stati rigenerati dall'aggregator (non a mano): l'indicatore di
avanzamento passa a **73%** (22 story su 30, effort 76%, 8 step rimanenti) e l'**EPIC 2** diventa
**completo (5/5)**.

## Analisi di avanzamento

**Numeri.** Nessun codice applicativo toccato: il lavoro è di **stato e documentazione**. La
percentuale di implementazione delle story passa da **70%** (21 su 30, effort 72%, 9 step) a
**73%** (22 su 30, effort 76%, **8 step** rimanenti): l'**EPIC 2** (Analisi) diventa **completo
(5/5)** e il gate di testabilità «Motore di analisi completo» passa da «4/5 - in corso» a
**«5/5 - soddisfatto»**.

**Cosa è pronto.**

- Lo stato di merge della Story 2.5 è allineato in tutti e quattro i documenti che lo dichiarano:
  `docs/state/stories/2.5-*.md` (fonte), `docs/11-BACKLOG.md` (sezione legacy + blocco
  aggregato), `docs/INDEX.md` (blocchi aggregati) e `README.md` (prosa + blocco aggregato).
- Il blocco `AGGREGATE-NEXT-STEP-*` del README **non indica più** la 2.5: con tutte le 22 story
  migrate in `done` il blocco mostra correttamente il fallback «Nessuna story non-done e non
  bloccata migrata in `docs/state/stories/`» — le 8 story rimanenti (3.2, 3.3, 3.5, 4.2, 4.3,
  5.1, 5.2, 6.1) non hanno ancora un state file e lo riceveranno al claim.
- I **7 acceptance criteria** della Story 2.5 sono spuntati nella sezione legacy del backlog, e
  la riga `**Stato**:` dichiara PR, merge commit e data: la sezione legacy non è più una copia
  stantia dello stato reale.
- Il **gap strutturale** è documentato (§51 del DEV-LOG): `docs/state/stories/*.md` non ha un
  writer di stato di merge e non è coperto dal gate `check-merge-state.mjs`.

**Cosa manca.** Il gap strutturale è **aperto**: le story continuano a non avere un writer di
stato di merge. La correzione naturale è estendere `apply-merge-state.mjs` al formato delle story
(`status: done` invece di `state: <chiuso>`) e estendere `check-merge-state.mjs` al perimetro
`docs/state/stories/`: le due modifiche sono nella stessa direzione e chiudono la **classe** di
drift, non il caso. Non sono state applicate qui perché toccano il **writer unico di `main`**
(ADR-0013) e il gate bloccante che ne verifica il perimetro: è lavoro da issue dedicata, non da
doc-sync. Il gap è tracciato dall'**issue #297**, aperta in questa sessione.

Nota: i file `docs/SESSIONS.md`, `docs/INDEX.md`, `docs/11-BACKLOG.md` e `docs/BUNDLE.md` hanno
**blocchi aggregati** e **prosa legacy**: in questa PR ho toccato la prosa (che è di mia
competenza); i blocchi si aggiornano da soli dopo il merge.

**Salute tecnica.** Nessun blocco `AGGREGATE-*` toccato a mano (il gate
`check-aggregate-blocks.mjs` → 0 violazioni). Il bundle è stato rigenerato dopo le modifiche
documentali (`generate-bundle.ps1` dopo `aggregate-state.ps1`, l'ordine vincolante della
Sessione 73).

**Gate di testabilità.** `node scripts/check-merge-state.mjs` → 70 confronti, 0 falliti ·
`node scripts/check-aggregate-blocks.mjs --base origin/main --head HEAD` → 0 violazioni ·
`node scripts/check-readme-facts.mjs` → 15 check, 0 falliti · `node scripts/check-encoding.mjs` →
544 file, 0 errori · `node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti ·
`pwsh scripts/aggregate-state.ps1 -Progress` → 73%, 22 story su 30, 8 step rimanenti ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.
