---
number: 93
title: "Gli hook del repository non giravano: `core.hooksPath` era preso da husky"
date: 2026-11-03
state: 🟡
merged: false
branch: feat/290-hooks-wiring
pr: 0
claim: kilo-hp-elitebook-7c3f
tags: [devops, protocollo, hook, ci]
---

# Sessione 93 — gli hook del repository non giravano (issue #290)

> **Oggetto**: durante la issue #283 (PR #289, merged) è saltato fuori che l'auto-regen del
> bundle del `pre-push` non era mai scattato. La causa è più profonda di un singolo hook:
> **`core.hooksPath` era puntato su `.husky/_` e i tre hook del repository non sono mai stati
> eseguiti**. La stessa verifica ha trovato che il catalogo dei gate (`docs/12-DEVOPS.md §9.10`)
> era indietro di due job.

## Sintesi

`scripts/setup-hooks.js` (script `postinstall` di `package.json`) imposta
`core.hooksPath = .githooks` — ma `package.json` dichiarava anche `"prepare": "husky"`, e
husky v9 scrive `core.hooksPath = .husky/_` nel suo lifecycle `prepare`, che pnpm esegue
**dopo** `postinstall`.

Dopo ogni `pnpm install` il percorso degli hook era quindi `.husky/_`: i tre hook del
repository — `.githooks/pre-commit`, `.githooks/pre-push`, `.githooks/post-checkout` — **non
sono mai stati eseguiti**. Le difese documentate in `AGENTS.md` (F1/F7 pattern del branch,
D.4/G.4 bundle auto-regenerato al push, F5 advisory sul working tree) erano scritte ma mai
esercitate.

La regressione è più grave di quanto sembri: l'ordine dei lifecycle script è stabile, quindi
esiste **dal monorepo init** (Story 0.1, commit `66cbc72`: husky). `setup-hooks.js` è arrivato
dopo (Sessione 20) e non ha mai vinto. Nessuno se n'è accorto perché **un hook che non gira non
produce rumore**: il difetto si vede solo quando manca.

Con il path corretto sono emersi **due difetti latenti** nel `.githooks/pre-commit`, invisibili
finché l'hook non girava: il blocco encoding chiudeva l'hook con `exit 0` **prima** dei
controlli successivi, quindi

- il gate anti-mojibake della issue #277 non poteva **bloccare** un commit (usciva con 0);
- l'invariante del branch (F1/F7) non veniva **mai** verificato.

Misurato con la contro-prova: l'hook di `main` esce **0** dove deve uscire **1** (scenari H8/H9
del test esteso).

**Il drift del catalogo**: `docs/12-DEVOPS.md §9.10` si dichiara «l'elenco autorevole dei gate»
e dichiarava «12 job» / «33 step», mentre `ci.yml` ha **15 job**: i due `gates-portability*`
(introdotti dalla issue #284, Sessione 90) non avevano una riga. Un elenco autorevole sbagliato
è peggio di un elenco assente.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-93.1 | `.githooks/` è **l'unico** hooks path: `husky` esce da `package.json` e la cartella `.husky/` è rimossa | Due sistemi di hook sono una fonte di verità in più: chi scrive `core.hooksPath` vince, e il vincitore era quello sbagliato |
| D-93.2 | Le due responsabilità di husky passano in `.githooks/`: `lint-staged` dentro `pre-commit`, `commitlint` in `commit-msg` | Niente di quanto funzionava va perso: il `commit-msg` era l'unico controllo che il repository eseguiva davvero |
| D-93.3 | `setup-hooks.js` **rilegge** `core.hooksPath` dopo averlo scritto e avvisa se il valore è diverso; segnala anche la cartella `.husky/` | Scrivere il valore non basta: è stato il punto cieco per anni. Il sintomo (cartella `.husky/`) viene segnalato esplicitamente |
| D-93.4 | Il gate è un **test di comportamento**, non una grep: `test-hook-wiring.sh` esegue un `git commit` reale in un repo temporaneo | Il difetto era esattamente «i file ci sono, ma non vengono eseguiti»: un controllo sui file non lo avrebbe visto |
| D-93.5 | Il catalogo §9.10 viene allineato a **39 righe** (38 gate + l'agregatore `quality`) e i conteggi in `AGENTS.md` a **15 job, 38 step** | Le sezioni legacy vanno allineate quando la PR cambia i fatti che dichiarano (D.38.1): un catalogo autorevole sbagliato è peggio di un catalogo assente |

## Analisi di avanzamento

**Numeri.** Nessun codice applicativo toccato: la percentuale di implementazione delle story
resta **70%** (21 su 30, effort 72%), **9 step** rimanenti. Il lavoro è di **devops**.

**Cosa è pronto.**

- Il percorso degli hook è `.githooks` e **non può più essere sovrascritto**: nessun lifecycle
  script lo tocca, e `setup-hooks.js` rilegge il valore per accorgersi se qualcun altro lo fa.
- I quattro hook del repository girano davvero: `pre-commit` (pattern del branch + encoding +
  lint-staged), `commit-msg` (commitlint), `pre-push` (bundle + base-stale), `post-checkout`
  (advisory).
- Il `pre-commit` è stato riordinato: l'invariante del branch e il gate encoding sono **prima**
  di qualunque uscita, e i due difetti latenti sono chiusi.
- `scripts/test-hook-wiring.sh` (nuovo, 13 assert): 9 verifiche statiche sul wiring + 4
  comportamentali su un `git commit` reale.
- `scripts/test-pre-commit-clean-check.sh`: 4 scenari nuovi (H7..H10) che coprono il **percorso
  encoding** — quello del repository vero, mai coperto prima perché il path non esisteva in
  quel ramo del test.
- `docs/12-DEVOPS.md §9.10`: le 3 righe dei gate di portabilità mancanti, la nuova riga del
  gate sul wiring, e i conteggi allineati (15 job, 38 step).

**Cosa manca.** Niente sul piano funzionale. La protezione contro la regressione è di **indole
strutturale**, non solo documentale: il gate verifica il comportamento, e `setup-hooks.js` si
accorge da solo se qualcuno scrive il path.

**Salute tecnica.** Nessun blocco `AGGREGATE-*` toccato a mano. Il test del wiring non scrive
nulla nel repository: lavora in una directory temporanea con un `git init` di prova.

**Gate di testabilità.** `bash scripts/test-hook-wiring.sh` → 13/13 ·
`bash scripts/test-pre-commit-clean-check.sh` → 18/18 (H7..H10 nuovi) ·
`node scripts/check-protocol-consistency.mjs` → 0 falliti ·
`node scripts/validate-workflows.mjs .github/workflows` → 0 fallimenti ·
`node scripts/check-encoding.mjs` → 0 errori ·
`node scripts/check-aggregate-blocks.mjs --base origin/main --head HEAD` → 0 violazioni ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Un hook che non gira **non produce rumore**: il difetto è invisibile finché manca | Il gate di un hook deve essere **comportamentale** (un `git commit` reale), non una verifica che i file esistano |
| Due sistemi di hook nella stessa repository sono una fonte di verità in più | Il secondo scriveva `core.hooksPath` **dopo** il primo: vinceva il meno nobile, e vinceva in silenzio |
| L'ordine dei lifecycle script di pnpm (`postinstall` → `prepare`) è stabile e deterministico | Una regressione nata dal monorepo init è rimasta **anni** senza che nessun test la vedesse |
| Un `exit 0` di troppo in un hook disabilita tutti i controlli successivi | Due invarianti (branch ed encoding) erano morte dentro l'hook: il test le copriva solo perché il path non esisteva in quel ramo |
| Un catalogo che si dichiara «autorevole» e sbaglia è peggio di un catalogo assente | Il drift sui due job di portabilità è nato da un merge (#284) che non ha aggiornato §9.10: nessun gate lo collega |

## Documenti aggiornati

- `.githooks/pre-commit` (riordinato), `.githooks/commit-msg` (nuovo), `.githooks/README.md`
- `package.json` (via `prepare`/`husky`), `pnpm-lock.yaml`
- `scripts/setup-hooks.js` (verifica post-scrittura), `scripts/test-hook-wiring.sh` (nuovo),
  `scripts/test-pre-commit-clean-check.sh` (H7..H10), `scripts/generate-bundle.ps1` (`$files`)
- `.github/workflows/ci.yml` (step «Wiring degli hook» nel job `gates-procedure`)
- `docs/12-DEVOPS.md` (§9.10: righe e conteggi), `docs/05-ARCHITECTURE.md`, `docs/17-DEV-NOTES.md`,
  `docs/INDEX.md` (v1.42), `AGENTS.md` (v1.42)
- `docs/state/sessions/93-hook-wiring.md` (questo file)
