---
number: 68
title: "Story 1.6 — Fondazione geo e contesto di ascolto (delta su 02 v1.7 e classificatore L1) (issue #205)"
date: 2026-10-31
state: 🟢
merged: true
merged_commit: 68c27e5
merged_date: 2026-10-31
branch: feat/205-geo-context-foundation
pr: 209
claim: kilo-HP-ELITEBOOK-q7v2
cross_refs: [205, 201, 108, 109]
tags: [privacy, db, analysis, phase-2]
---

# Sessione 68 — Story 1.6: fondazione geo e contesto di ascolto (issue #205)

## Sintesi

La Story 1.6 applica il **delta ratificato nella Sessione 67** (`19-GEO-CONTEXT.md`
v1.0 🟢 APPROVED): lo schema passa a **v1.7** (Dexie **v5→v6**) e nasce il
**classificatore L1** del contesto di ascolto.

Due deliverable distinti:

- **il delta su `02-DATA-SCHEMA.md`**: i tre campi derivati `city`/`citySource`/
  `cityConfidence` su `ListenEvent`, l'entità derivata `ContextPeriod` con la
  tassonomia vincolante `CONTEXT_KINDS`, i toggle `retainCountry`/
  `retainCity`/`retainDeviceType`/`retainDeviceDetail`/`deriveContext`, la
  tabella `contexts` (schema Dexie v6) e la politica **MIG-5** (il ricalcolo del
  contesto è esplicito e non azzera i campi già persistiti);
- **il classificatore L1** in `packages/core/src/context/`: le regole R1..R7
  nell'ordine dichiarato, la soglia di aggregazione 0.5, i parametri
  versionati (D-B.3) e la persistenza dei periodi con `recompute()` e
  verdetto utente (`userLabel`).

## Trigger

Issue **#205** (`size:L`, `agent-ready`, `area:db`, `area:analysis`,
`phase-2`), aperta dopo la ratifica della Sessione 67. La claim precedente
(`kilo-HP-ELITEBOOK-fa3c`, 2026-10-30T21:21Z) era **abbandonata** — worktree
pulita, zero commit, zero WIP, nessun processo né sessione attiva — e il TTL
di 12 ore non era ancora scaduto: il takeover è documentato in issue con
`stale-release:` (con l'evidenza) e poi `claim:` (`kilo-HP-ELITEBOOK-q7v2`),
riverificato come unico claim attivo. Worktree `ls-205-geo-context-foundation`,
branch `feat/205-geo-context-foundation` (ripresa della worktree abbandonata:
non c'era WIP da preservare).

## Cosa è stato consegnato

- **Schema (`packages/core/src/schema/`)**: `ListenEvent.city*`, `PrivacySettings`
  con i 5 toggle nuovi, `ContextPeriod` + `CONTEXT_KINDS`/`ContextKind`.
- **DB (`packages/core/src/db/`)**: `DB_SCHEMA_V6` con la tabella `contexts`,
  migrazione non distruttiva (upgrade che azzera i campi città sugli ascolti
  esistenti), `loadUserTimezone`/`saveUserTimezone` (chiave `app.timezone`).
- **Classificatore (`packages/core/src/context/`)**: `classifier.ts` (sessioni
  derivate, slot = giorno locale × dispositivo, paese di riferimento, indice di
  ricorrenza settimanale, R1..R7), `engine.ts` (periodi deterministici, id
  `ctx-<kind>-<startTime>`), `storage.ts` (persistenza + verdetto utente),
  `recompute.ts` (orchestratore), `localTime.ts` (ora locale via `Intl`, senza
  dipendenze), `derivedVersion.ts` e `types.ts` (i parametri ratificati).
- **Pipeline (`packages/core/src/adapters/pipeline.ts`)**: i toggle sono
  applicati **in scrittura** (`applyDeviceTypeConsent`), il `country` resta
  conservato indipendentemente da `retainIp` (issue #108).
- **Fixture**: `fixtures/scenarios/geo-context.json`, generato da
  `scripts/generate-fixtures.mjs geo` — 4 settimane di cronologia composta
  (casa serale, lavoro diurno, spostamenti brevi, 3 giorni di viaggio in
  Germania, una serata in auto).
- **39 test** nuovi: regole R1..R7 una per una, fixture di scenario,
  persistenza (`recompute()`, `stale`, verdetto utente, toggle
  `deriveContext`, fuso) e toggle privacy nell'import.

## Scelte dichiarate

Sette scelte che la spec non explicita sono dichiarate in
`docs/state/stories/1.6-geo-foundation.md` (S1..S7): `away` come complemento
di R1, R4 vincolata alla durata delle sessioni (25 minuti) perché uno
spostamento ricorrente non venga classificato `home`, il viaggio riconosciuto
sull'intero *run* di giorni esteri, il modulo in `context/` (il layer
`analysis` è puro e non ha dipendenze dal DB), il fuso come dato in
`settings`, l'id deterministico del periodo e la forma del modulo.

## Discrepanza rilevata

L'AC del backlog e il state file citavano «**E22**» per la soglia di
aggregazione, ma `19-GEO-CONTEXT.md` §10 (🟢 APPROVED) dichiara **E19**
(«nessun cluster dominante»): la numerazione del documento ratificato vince e
l'AC è stato allineato a **E19** nel backlog e nello state file.

## Fuori perimetro e dichiarato

- **L2 (città)**: la derivazione dal database MMDB on-demand è la Story 4.4;
  questa story fissa solo il **contratto** (i campi esistono e sono nullable).
- **UI dei toggle**: Story 3.x. I toggle esistono nello schema e sono applicati
  in scrittura; l'interfaccia che li espone è un'altra tranche.
- **Il nastro contesto**: Story 3.4 (consuma i `ContextPeriod`).

## Esito post-merge

La PR **#209** è **merged** in `main` il 2026-10-31T08:40:45Z (merge commit
`68c27e5`), CI verde (job `quality`: lint, typecheck, test, build e i gate su
bundle, aggregator, workflow e README; GitGuardian). L'issue **#205** è chiusa
con `status:done` (applicato da `auto-status-done`), le label `agent-ready` /
`in-progress` / `status:in-review` sono rimosse e il commento `release:` è
automatico (`release: kilo-HP-ELITEBOOK-q7v2 - PR #209 merged (68c27e5…)`).

La **pulizia git locale** è stata eseguita con `scripts/post-merge.ps1`:
`git worktree remove` ha di nuovo fallito con **Result too large** (path lunghi
con `node_modules` su Windows) e la rimozione è passata con `rd /s /q` e
prefisso `\\?\` — il **fallimento noto**, non una regressione. I passi
restanti sono passati: `main` allineato a `origin/main` (`68c27e5`), merge
verificato via `gh`, branch remoto già assente (eliminato da
`auto-branch-cleanup`), branch locale eliminato con `git branch -d`, prune +
audit finale (`post-merge.ps1 -Check` esce 0, nessun residuo).

Automazioni post-merge: `auto-status-done`, `auto-branch-cleanup`,
`auto-state-aggregate` e `auto-bundle`. Il presente doc-sync di chiusura è in
una PR `docs:` separata: il merge commit si conosce solo dopo il merge.

