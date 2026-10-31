---
number: 72
title: "Audit delle procedure automatiche: tempi reali, correttezza e confine di encoding di pwsh"
date: 2026-10-31
state: 🟢
merged: true
merged_commit: aa6100f
merged_date: 2026-10-31
branch: docs/4.4-post-merge-sync
pr: 223
claim: kilo-HP-ELITEBOOK-ced9
cross_refs: [63, 104, 218, 43]
tags: [devops, docs, audit]
---

# Sessione 72 — Audit delle procedure automatiche: tempi reali, correttezza e confine di encoding di `pwsh`

## Sintesi

Audit delle **procedure automatiche** del repo: 6 workflow GitHub Actions, 3 git hook
versionati, 25 script in `scripts/` (13 suite di test), i task Turborepo e i 13 script di
verifica eseguiti da `ci.yml` (di cui 8 suite di test). Obiettivo:
misurare i tempi reali di esecuzione e verificare che le procedure siano corrette (exit code
atteso, fail-closed, effetti collaterali).

Il secondo filone della sessione è nato dalla domanda del project owner «perché `pwsh` 7 è
installata?». La risposta: **è il baseline dichiarato dalla Sessione 71** (issue #218, PR #219,
mergiata il 2026-10-31), installato come pacchetto **MSIX/Store** — non un MSI — e visibile
anche da Git Bash. Ma la verifica ha scoperto che il baseline era dichiarato solo a metà: la
**provenienza** dell'installazione non era documentata e, soprattutto, il **confine** oltre il
quale l'ambiente non è più sicuro non era scritto da nessuna parte.

Misurato (dev machine Windows, `pwsh` 7.6.9):

| Comando | Esito | Tempo |
|---|---|---|
| `pwsh scripts/aggregate-state.ps1 -Check` | exit 0 (in sync) | 2,09 s |
| `powershell scripts/aggregate-state.ps1 -Check` | **exit 1** — drift spurio (attesi 620 char, trovati 616) | 1,81 s |
| `pwsh scripts/generate-bundle.ps1 -Check` | exit 0 (126 file) | 1,79 s |
| `powershell scripts/generate-bundle.ps1 -Check` | exit 0 (immune) | 2,43 s |

La causa è il **parsing del sorgente**, non la logica: `scripts/aggregate-state.ps1` è UTF-8
**senza BOM** e contiene 9 righe con letterali non-ASCII; Windows PowerShell 5.1 lo legge come
ANSI (Windows-1252) e trasforma `—` in `â€”` (3 caratteri invece di 1). Lo scarto di 4
caratteri è esattamente `—` (+2), `§` (+1), `à` (+1). In **modalità scrittura** quegli stessi
letterali corrotti verrebbero **scritti** nei file globali.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.72.1 | Il **parsing** dei `.ps1` è version-dipendente e va trattato come parte del vincolo «encoding» | Il vincolo ASCII-only di ADR-0008 copriva solo la **scrittura** (indipendente dalla versione grazie a `WriteAllText` + `UTF8Encoding($false)`). Ma un sorgente `.ps1` **senza BOM** è interpretato come ANSI da 5.1 e come UTF-8 da 7: i letterali non-ASCII nel sorgente sono corrotti **prima** di eseguire qualsiasi logica |
| D.72.2 | **`powershell` (5.1) non è un fallback accettabile per i `.ps1` del repo**: è un rischio di corruzione | Non è solo il fail-open del doppio trattino (issue #104): è drift spurio in `-Check` **e** scrittura di mojibake nei file globali. Il fallback del `.githooks/pre-push` (`pwsh` → `powershell`) è innocuo perché il bundle rigenera contenuto identico, ma per l'aggregator no |
| D.72.3 | La **provenienza** dell'installazione di `pwsh` viene documentata, non solo la sua presenza | Un runtime installato ma non riproducibile non è un toolchain documentato (lesson 71-1): `winget list --id Microsoft.PowerShell` restituisce 7.6.9, `Get-AppxPackage` conferma `SignatureKind: Store`, `C:\Program Files\PowerShell\7` non esiste e il registro non ha voci di disinstallazione → l'installazione attiva è il pacchetto MSIX/Store, non l'MSI citato da lesson 42-1 |
| D.72.4 | Il **fix** dello script (rimuovere i 9 letterali non-ASCII, oppure aggiungere il BOM) **non** viene applicato in questa sessione | Modificare `scripts/aggregate-state.ps1` è manutenzione dello script, e cambiare la semantica dei gate è una decisione sul test strategy che il protocollo riserva al project owner (D.71.4). Il difetto è **segnalato** con misura e causa; la decisione è del Boss |
| D.72.5 | Le 5 suite di test **non eseguite da `ci.yml`** vengono documentate, non aggiunte alla pipeline | Aggiungere step alla CI e cambiare la semantica di un gate (da assente a bloccante) sono decisioni sul test strategy (D.71.4). L'audit produce l'inventario con tempi e difetti, che è l'input per la decisione |
| D.72.6 | Il **costo** della pipeline viene quantificato per distinguere il lavoro necessario da quello ripetuto | I due gate più pesanti (`test-aggregate-determinism.sh` 56,0 s + `test-bundle-check-idempotent.sh` 60,4 s) valgono 116,4 s dei ~213 s di gate sequenziali e sono indipendenti ⇒ parallelizzabili |

## Audit: procedure automatiche

### Tempi misurati (dev machine, `pnpm exec turbo run <task> --force` = cache disabilitato, come in CI)

| Procedura | Tempo | Note |
|---|---:|---|
| `turbo run lint` | 11,43 s | 3 task |
| `turbo run typecheck` | 10,22 s | 3 task |
| `turbo run test` | 29,19 s | 2 task (`@ls/core` lancia vitest **due volte**: suite senza `perf.test.ts`, poi `perf.test.ts`) |
| `turbo run build` | 22,85 s | `apps/web` esegue `tsc --noEmit` **una seconda volta** (è già il `typecheck`) |
| `node scripts/validate-workflows.mjs` | 0,36 s | 4 sub-gate |
| `node scripts/check-readme-facts.mjs` | 0,35 s | 15 check |
| `node scripts/validate-labels.mjs` | 0,69 s | richiede `GH_TOKEN` |
| `test-workflow-git-add-coverage.sh` | 1,98 s | |
| `test-workflow-permission-scopes.sh` | 3,01 s | |
| `test-workflow-push-sync.sh` | 2,72 s | |
| `test-workflow-writer-ordering.sh` | 2,09 s | |
| `test-issue-76-residue.sh` | 16,09 s | |
| `test-readme-facts-gate.sh` | 3,71 s | |
| `test-aggregate-determinism.sh` | 56,02 s | 37 assert — il più pesante |
| `test-bundle-check-idempotent.sh` | 60,44 s | 12 assert — il più pesante |
| `test-post-merge.sh` | 52,44 s | **non in CI** |
| `test-setup-worktree.sh` | 2,93 s | **non in CI** — exit 1 su Windows |
| `test-safe-branch-switch.sh` | 6,74 s | **non in CI** — fail-open |
| `test-pre-commit-clean-check.sh` | 4,73 s | **non in CI** |
| `test-appendline-lf-fix.ps1` | 6,06 s | **non in CI** — exit 1 (S3 stale) |

### Difetti rilevati

1. **`test-safe-branch-switch.sh` è fail-open**: i tre scenari girano dentro subshell `( … )`,
   quindi gli incrementi di `pass`/`fail` non arrivano al processo padre e la condizione finale
   `[ "$fail" -eq 0 ]` è **sempre** vera. Misurato: «Risultati: 0 passati, 0 falliti» con exit 0.
   Il gate non può mai fallire — lesson 43-1.
2. **`test-appendline-lf-fix.ps1` ha un'aspettativa superata** (S3: «`aggregate-state.ps1` non
   usa `AppendLine`» → ne ha 64) e **muta il working tree** (S5: `git checkout -- docs/SESSIONS.md`
   + run dell'aggregator). Non è in CI, quindi nessuno se ne accorge.
3. **`test-setup-worktree.sh` non gira su Windows/Git Bash**: S1 (il mock `gh` non viene
   intercettato ⇒ lo script non fallisce come deve) e S2 (path POSIX `mktemp` non risolto).
4. **La procedura più distruttiva del repo non ha copertura CI**: `post-merge.ps1` (che esegue
   `git push origin --delete` e `git branch -D`) è coperto da `test-post-merge.sh`, che la CI
   **non** esegue.
5. **Typecheck duplicato in CI**: `pnpm run typecheck` e poi `pnpm run build`, il cui script di
   `apps/web` è `node generate-version.mjs && tsc -p tsconfig.json --noEmit && vite build` ⇒ il
   `tsc --noEmit` gira due volte.
6. **`@ls/core` avvia vitest due volte** (`vitest run --exclude '**/perf.test.ts' && vitest run
   src/db/__tests__/perf.test.ts`): doppio startup, doppio parsing della config.
7. **Gate sequenziali**: i 13 gate di `ci.yml` stanno in un solo job in sequenza; i quattro più
   pesanti sono indipendenti e potrebbero girare in parallelo (o in job separati) — risparmio
   atteso ≈ 2 minuti di pareggio.
8. **`ci.yml` gira anche sui push del bot**: il merge su `main` genera un commit di
   `auto-state-aggregate`/`auto-bundle`, che a sua volta fa scattare `ci.yml` di nuovo
   (trigger `push: branches: [main]` senza filtro sui path): ogni merge costa **due** run
   complete di CI. Il ciclo termina perché il guard idempotente del bundle non committa nulla
   quando il contenuto non cambia.

## Lesson learned

| # | Osservazione | Azione |
|---|--------------|--------|
| 72-1 | **Un baseline dichiarato senza il confine è a metà**: la Sessione 71 ha dichiarato «`pwsh` è il baseline» senza dire (a) da dove viene l'installazione e (b) cosa succede quando si usa 5.1 per sbaglio | `docs/12-DEVOPS.md §9.12` (provenienza + matrice misurata), `docs/17-DEV-NOTES.md` P12, **F9-bis** nella session start checklist di `AGENTS.md` |
| 72-2 | **Il drift spurio si distingue dal drift reale per la sua ampiezza**: 4 caratteri su un blocco da 616 non sono un documento cambiato, sono 4 letterali sovradecodificati (`—` +2, `§` +1, `à` +1) | Il delta è esattamente la somma delle sovradecodifiche UTF-8→CP1252: la misura ha localizzato la causa senza bisogno di un debugger |
| 72-3 | **Un test che non può fallire è più pericoloso di un test assente**: `test-safe-branch-switch.sh` riporta «0 passati, 0 falliti» ed esce 0 — sembra un test che non ha scenario, ed è invece un test che non ha contatori | Segnalato con evidenza; il fix (contatori riportati fuori dalle subshell) è una PR di manutenzione separata (D.72.5) |
| 72-4 | **La copertura dichiarata e la copertura eseguita sono due elenchi distinti**: `AGENTS.md` e `docs/12-DEVOPS.md` descrivono la copertura di `post-merge`, `setup-worktree` e `safe-branch-switch`; la CI non esegue nessuna delle tre | `docs/12-DEVOPS.md §9.13` — l'inventario che confronta i due elenchi, con i tempi misurati |
| 72-5 | **Misurare costa meno che supporre**: «le procedure sono lente» era un'impressione; il dato mostra che i 116 s dei due gate più pesanti sono in test indipendenti, e che il typecheck è eseguito due volte | Il report distingue il lavoro necessario (lint/typecheck/test/build ≈ 74 s) da quello ripetuto o non eseguito |

## Documenti aggiornati

- `AGENTS.md` (v1.29 → **v1.30**): **F9-bis** nella session start checklist (5.1 non è un fallback
  ma un rischio di corruzione; `pwsh` per esteso; i nuovi `.ps1` ASCII-only), footer v1.30
- `docs/12-DEVOPS.md` (v1.3 → **1.4**): **§9.12** (nuova) ambiente PowerShell locale — provenienza,
  verifiche, matrice PS7 vs PS5.1, confine di encoding; **§9.13** (nuova) copertura CI delle suite
  locali; changelog 1.4
- `docs/17-DEV-NOTES.md` (v0.4 → **0.5**): **P12** (nuova) — provenienza di `pwsh` e confine di
  encoding dei `.ps1`
- `docs/13-ADR/0008-lazy-state-aggregation.md`: il vincolo «ASCII-only nel codice PowerShell» viene
  corretto — riguarda il **parsing** del sorgente, non solo la scrittura; stato misurato del
  `aggregate-state.ps1` (9 righe non-ASCII, nessun BOM)
- `docs/INDEX.md` (sezioni legacy allineate): `12-DEVOPS.md` → Sessione 72 (v1.4), `AGENTS.md` →
  v1.30, `17-DEV-NOTES.md` → v0.5
- `docs/BUNDLE.md`: rigenerato (`pwsh scripts/generate-bundle.ps1`) perché i file sopra sono in `$files`

## Come è finita su `main`

Il contenuto della sessione è arrivato su `main` **dentro il commit di doc-sync di un altro
agente** (`2f5c1c2`, "docs: post-merge sync story 4.4 (pr 222)"), che ha incluso i file di
documentazione non committati presenti nella working copy condivisa; la PR **#223**
(`aa6100f`) li ha portati su `main`. Il frontmatter riflette quel percorso reale
(`pr: 223`, `merged_commit: aa6100f`), non una PR dedicata.

La PR **#224** (`docs/224-audit-procedure-automatiche`) contiene il **solo allineamento dei
metadati** di questa sessione (frontmatter + rigenerazione di `SESSIONS.md` e `BUNDLE.md`),
come il precedente "docs(state): allinea la Sessione 71 al numero di PR" della Sessione 71.

**Lesson 72-6**: in una working copy condivisa, un `git add -A` dell'agente successivo può
portare su `main` il lavoro documentale di un altro agente **senza messaggio di commit
coerente**: il contenuto arriva, la tracciabilità no. Il rimedio non è evitare il
doc-sync (che è il meccanismo voluto, ADR-0008) ma **non lasciare il WIP nella working copy
condivisa**: la worktree dedicata (`setup-worktree.ps1`) è l'unico modo per tenere il confine
fra il lavoro proprio e quello altrui.

## Verifica

- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `node scripts/check-readme-facts.mjs` → exit 0
- `node scripts/validate-workflows.mjs .github/workflows` → exit 0
- `pwsh -NoProfile -c '$PSVersionTable.PSVersion'` → 7.6.9 (Core)
- `powershell scripts/aggregate-state.ps1 -Check` → exit 1 (drift spurio: **atteso**, è il difetto
  documentato in §9.12)

## Link utili

- `docs/12-DEVOPS.md` §9.12 e §9.13 — ambiente PowerShell e copertura CI
- `docs/17-DEV-NOTES.md` P12 — il pitfall del confine di encoding
- `docs/13-ADR/0008-lazy-state-aggregation.md` §"Script aggregator" — i vincoli implementativi
- Sessione 71 (`71-powershell-7-baseline.md`) — la dichiarazione del baseline
- Issue #63 (byte-per-byte), #104 (fail-closed sui flag), #218 (baseline pwsh)
