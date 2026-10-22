---
number: 46
title: "Idempotenza dell'aggregator non implementata nel path di scrittura: T3 falliva a intermittenza (issue #142)"
date: 2026-10-22
state: 🟢
merged: false
merged_commit: ""
merged_date: ""
branch: fix/142-aggregator-timestamp-reuse
pr: 143
claim: kilo-hp-elitebook-gq0i
cross_refs: [142, 141, 140, 70, 104, 115, 63]
tags: [devops, ci, bug, lazy-state]
---

# Sessione 46 — La garanzia di idempotenza esisteva solo in `-Check`

## Sintesi

Il gate bloccante `Aggregator deterministico` (#70) è fallito sul run di PR #141
(2026-10-22T16:56:00Z, run `39818043647`):

```
[FAIL] secondo run ha prodotto un diff (commit-rumore)
  docs/BUNDLE.md | 2 +-
[FAIL] timestamp cambiato: '- Ultima aggregazione: 2026-10-22 16:55' -> '- Ultima aggregazione: 2026-10-22 16:56'
Risultati: 28 passati, 2 falliti
```

Il sintomo sembrava un difetto della Sessione 45, ma non lo era: è un **flake
preesistente** emerso solo perché i due run dell'aggregator nella fixture hanno
strappato il confine di minuto (16:55 → 16:56). Lo stesso run su `main`, partito
pochi minuti dopo, è passato per fortuna.

## Causa radice

La garanzia «il timestamp `Ultima aggregazione` viene **riusato** quando il blocco
non cambia altro» era documentata (`AGENTS.md` §"Determinismo e idempotenza", issue
#70) e **verificata solo in `-Check`**, dove la normalizzazione maschera il campo.
Nel path di scrittura il timestamp veniva ristampato a ogni run:

- `Build-Block-BundleInventory` (`scripts/aggregate-state.ps1:497`) stampa sempre
  `$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm'`
- `Apply-Blocks` (`:582`) scriveva il blocco calcolato senza confrontarlo con quello
  già su disco
- la normalizzazione esiste solo in `Test-Blocks` (`:673`)

Con granularità al minuto, due run ravvicinati che strappano il confine producono
un diff di una riga: esattamente il «commit-rumore su `main`» che la garanzia
prometteva di eliminare. La probabilità di fallimento per run era dell'ordine del
5-10%: abbastanza per far fallire un PR su un motivo non riproducibile in locale,
non abbastanza per essere notata prima.

Il difetto è quindi **del test solo per metà**: T3 asseriva giustamente che due run
devono produrre output identico, e il codice non lo garantiva. Il test ha ragione,
l'implementazione no.

## Difetto gemello: `> Data:` di `generate-bundle.ps1`

Lo stesso difetto nel generatore del bundle, con un sintomo più rumoroso e nessun
gate che lo intercettasse:

- `Build-Bundle` (`scripts/generate-bundle.ps1:216`) ha già un parametro
  `[string]$Timestamp` pensato per il riuso, ma `:262` chiama `Build-Bundle` senza
  argomenti
- il path di scrittura ristampa `Get-Date`
- `-Check` normalizza (`:312`), quindi il gate resta verde

Conseguenza: `auto-bundle` committava un nuovo `> Data:` **dopo ogni merge** che
tocca un path di `$files`, anche a contenuto identico — la lunga catena di commit
`chore(bundle): auto-regen BUNDLE.md` in `main`.

## Cosa è stato fatto

| # | Azione | Perché |
|---|--------|--------|
| 1 | `Get-NormalizedBlock` + `Sync-MutableTimestamp` in `aggregate-state.ps1`; `Apply-Blocks` riusa il valore su disco quando il blocco è identico a meno del timestamp | realizza la garanzia documentata; normalizzazione e riuso condividono la stessa funzione, così le due copie del confronto non possono divergere |
| 2 | `Test-Blocks` riusa `Get-NormalizedBlock` | una sola definizione della normalizzazione |
| 3 | `generate-bundle.ps1`: riuso di `> Data:` prima della scrittura | uccide il commit-rumore di `auto-bundle` |
| 4 | **T11** in `test-aggregate-determinism.sh`: sentinel seminato nella riga del timestamp | rende la garanzia verificabile **senza orologio**: con il riuso assente fallisce sempre |
| 5 | **T7** in `test-bundle-check-idempotent.sh`: stesso probe per `> Data:` | copre il difetto gemello |
| 6 | `ps_path` in `test-bundle-check-idempotent.sh` | T4-T6 fallivano su Windows per un path POSIX non risolto da pwsh: con la normalizzazione passano (3 assert recuperati) |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.46.1 | Il **confronto** usa tutto il blocco/bundle, la **sostituzione** solo la prima occorrenza del campo | la prima versione confrontava solo l'header del bundle: il riuso scattava anche quando un file incluso era cambiato, e la contro-prova di T7 lo ha intercettato. Confronto largo, sostituzione stretta |
| D.46.2 | Sostituzione limitata alla prima riga `> Data:` | i documenti inclusi possono avere una riga `> Data:` propria (`docs/AUDIT-2026-10-15.md`): una sostituzione globale ne avrebbe riscritto il contenuto — danno peggiore del commit-rumore eliminato |
| D.46.3 | T11 con **sentinel** invece di "prima/dopo" | con granularità al minuto, due run ravvicinati possono produrre lo stesso valore: un test basato sul valore non distinguerebbe «riusato» da «riscritto nello stesso minuto» |
| D.46.4 | Contro-prova in entrambi i test (contenuto cambiato → il campo si aggiorna) | un riuso cieco passerebbe la metà «felice» e congelerebbe il campo su un blocco stale (lesson 44-4: un gate che blocca anche i casi legittimi viene spento) |
| D.46.5 | Fix del path nei test del bundle, pur essendo fuori scope | T7 non era verificabile senza: lo stesso `-NoProfile -Command "& '<path>'"` falliva su Windows. Tre assert preesistenti recuperati, comportamento Linux invariato (`cygpath` non esiste) |

## Difetti trovati lungo il percorso

**La prima implementazione del riuso confrontava solo l'header** del bundle
(`Documenti/Documenti`): il file incluso che cambiava non veniva rilevato e la
data restava congelata. Me lo ha segnalato la contro-prova di T7, non il
ragionamento a tavolino — che è esattamente il motivo per cui la contro-prova
esiste (lesson 44-4).

**La prima stesura di T11 era essa stessa dipendente dall'orologio**: confrontava
`SEEDED` e `NOW` e dava per scontato che i due run cadessero in minuti diversi.
Nella contro-prova i due run sono caduti nello stesso minuto e il test ha
segnalato un falso «riuso cieco».

**Il T11 nella versione iniziale non committava il sentinel prima di `git diff`**,
così il diff misurava la modifica del test invece dell'output dell'agregator: un
asserzione che passava per il motivo sbagliato.

**Un `git checkout -- scripts/aggregate-state.ps1` eseguito per ripristinare il
file dopo il controllo negativo ha cancellato il fix non ancora committato**
(l'ho perso e riapplicato). La lezione è quella di D.26.4 applicata alle mie
azioni: il checkout ripristina da `HEAD`, non dal lavoro non committato; per
verificare una mutazione in un file di lavoro il file va **copiato fuori**, non
ripristinato.

## Verifica

- `bash scripts/test-aggregate-determinism.sh` → **34/34** (30 precedenti + 4 di T11)
- Controllo negativo T11: con `aggregate-state.ps1` a `HEAD` (senza riuso) → **32/34**, con `[FAIL] timestamp riscritto (riuso assente in Apply-Blocks)` — il test intercetta il bug
- `bash scripts/test-bundle-check-idempotent.sh` → **12/12** (prima: 9/12 con T4-T6 rotti per l'ambiente)
- Controllo negativo T7: con `generate-bundle.ps1` a `HEAD` → **10/12**, con `[FAIL] \`> Data:\` riscritta (riuso assente)`
- `pwsh scripts/aggregate-state.ps1` ×2 → hash di `docs/BUNDLE.md` invariato
- `pwsh scripts/generate-bundle.ps1` ×2 → `Data di generazione riusata` su entrambe le esecuzioni
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0 · `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `bash scripts/test-workflow-push-sync.sh` 15/15 · `test-workflow-permission-scopes.sh` 15/15 · `test-workflow-git-add-coverage.sh` 8/8 · `test-issue-76-residue.sh` 9/9 · `test-post-merge.sh` 29/29 · `validate-workflows.mjs` exit 0

**Test non eseguiti, e perché**: `pnpm run lint` / `typecheck` / `test` / `build`
non girano: nessun file applicativo è stato toccato e la worktree non ha
`node_modules`.

## Lesson learned

| # | Osservazione |
|---|--------------|
| 46-1 | **Una garanzia verificata solo in `-Check` non è implementata.** La normalizzazione in modalità check nasconde esattamente il campo che il path di scrittura continua a ristampare: il check verde e la doc che promette il riuso convivevano con il commit-rumore reale |
| 46-2 | **Un test basato sull'orologio è un test flaky, e la sua firma è quella di un difetto di concurrency.** T3 falliva solo quando i due run strappavano il minuto: facile attribuirlo al cambiamento sotto test (come è successo qui) invece che al test |
| 46-3 | **Il probe migliore di un invariante temporale è un valore seminato, non un valore osservato.** Con granularità al minuto, «prima» e «dopo» possono coincidere; un sentinel del 2001 non può |
| 46-4 | **La contro-prova vale quanto il test.** «Il campo viene riusato» e «il campo viene riusato solo quando il blocco non è cambiato» sono due invarianti diverse, e solo la seconda è quella giusta |
| 46-5 | Un difetto gemello quasi sempre esiste dove il primo è stato fixato: `Build-Bundle -Timestamp` esisteva già, non usato, con la normalizzazione gemella già scritta a due righe più in basso. La firma del difetto («parametro per il riuso, mai passato») era già nel codice |
| 46-6 | Per verificare una mutazione in un file **non committato**, il file va copiato fuori: `git checkout --` ripristina da `HEAD` e cancella il lavoro (è la stessa classe di E3/E4/E5 di D.26.4, applicata all'operatore) |

## Documenti aggiornati

- `scripts/aggregate-state.ps1` — `Get-NormalizedBlock`, `Sync-MutableTimestamp`, riuso in `Apply-Blocks`, `Test-Blocks` sulla normalizzazione condivisa
- `scripts/generate-bundle.ps1` — riuso di `> Data:` (confronto ampio, sostituzione solo sull'header)
- `scripts/test-aggregate-determinism.sh` — **T11** (4 assert) + header
- `scripts/test-bundle-check-idempotent.sh` — **T7** (5 assert), `ps_path` per Windows, header
- `docs/12-DEVOPS.md` — §9.11 (nuova) + changelog 0.7
- `AGENTS.md` — v1.24 → v1.25: la riga di idempotenza nella tabella delle garanzie e il footer
- `docs/state/sessions/46-timestamp-reuse.md` (**nuova**) — questa entry
- `docs/BUNDLE.md` — rigenerato

## Note operative

- Nessun blocco `<!-- AGGREGATE-* -->` modificato a mano: output di
  `aggregate-state.ps1` e `generate-bundle.ps1` eseguiti in locale (D.21.1).
- Il fallimento che ha aperto la sessione era su `main` o sulla PR? Sulla **PR**
  (`39818043647`). Il run di `main` (`39818444761`) è passato, e
  `auto-state-aggregate` è tornato `success` con il push di `4e19b7f`: la Sessione 45
  è quindi confermata end-to-end.

## Cross-refs

- **#142** — il bug; chiuso da PR #143
- **#141** — PR che ha applicato il fix #140 e sul cui run è emerso il flake
- **#70** — il gate `Aggregator deterministico` e la garanzia che il fix rende vera
- **#104** — stesso `generate-bundle.ps1`, altro difetto (fail-closed sui flag); il suo test è quello in cui ho aggiunto T7
- **#63** — warning residuo PS 5.1 vs 7 sui due check `-Check` (warning-only in CI)