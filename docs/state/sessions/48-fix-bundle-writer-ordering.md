---
number: 48
title: "Fix race fra i due writer di main (issue #149)"
date: 2026-10-26
state: 🟢
merged: true
merged_commit: "d155799014e1ee9617cdee2b040afb18180187c9"
merged_date: "2026-10-26T15:35:29Z"
branch: fix/149-bundle-writer-ordering
pr: 151
claim: kilo-HP-ELITEBOOK-lb47
cross_refs: [149]
tags: [devops, bug, fix]
---

# Sessione 48 — Fix race fra i due writer di `main` (issue #149)

## Sintesi

Correzione strutturale della race che, nel merge della PR #147, aveva lasciato
`docs/BUNDLE.md` stale di 6 righe. La diagnosi completa è in `docs/12-DEVOPS.md`
§9.8e; qui il resoconto del fix.

Il punto: i due writer di `main` (`auto-bundle.yml` e `auto-state-aggregate.yml`)
condividono il concurrency group `post-merge-main`, che **serializza** i run ma
**non ne impone l'ordine**. Finora l'ordine era irrilevante perché i due producevano
contenuti indipendenti. Con `auto-bundle.yml` (issue #115) è tornato essenziale:
`auto-bundle` **copia** il contenuto dei file che `auto-state-aggregate` **modifica**.

## Trigger

Il merge della PR #147 (doc-sync della Story 1.3) ha lasciato il bundle stale. La
diagnosi e l'issue #149 sono di questa sessione; il Boss ha scelto l'opzione A
(trigger `workflow_run`).

## Decisione

**Opzione A (Boss, Sessione 48)** — `auto-bundle.yml` dichiara un secondo trigger:

```yaml
workflow_run:
  workflows: ["auto-state-aggregate"]
  types: [completed]
```

`workflow_run` è agganciato alla **conclusione** del workflow, non a un push:
sopravvive alla soppressione del GITHUB_TOKEN (che vale solo per gli eventi
`push`/`pull_request` generati dal token stesso) ed è il workaround documentato per
i workflow che si innescano a vicenda. Con esso il bundle rigenera **sempre** una
seconda volta dopo che l'aggregate ha committato i blocchi: la copia embedded è
allineata ai sorgente, indipendentemente dall'ordine di scheduling.

Le altre opzioni scartate (nell'issue #149): B (`workflow_dispatch` + dispatch
esplicito), C (unificare i due writer in uno solo), D (solo gate bloccante, che non
risolve la causa).

Il trigger `push` resta invariato: da solo copre i merge che toccano i path di
`$files` senza toccare `docs/state/**` — in quel caso `auto-state-aggregate` non
parte e il bundle deve comunque rigenerarsi.

## Il fix

| File | Cosa fa |
|------|---------|
| `.github/workflows/auto-bundle.yml` | Aggiunge il trigger `workflow_run` su `auto-state-aggregate`, con nota di-header che spiega la meccanica |
| `scripts/validate-workflows.mjs` | Quinto controllo `checkWriterOrdering`: verifica la presenza del trigger **e** che il nome in `workflows:` combaci con il `name:` reale del producer |
| `scripts/test-workflow-writer-ordering.sh` | Test di regressione T1..T5 (6 assert), con scenario negativo |
| `.github/workflows/ci.yml` | Nuovo step bloccante in posizione 13 |
| `scripts/generate-bundle.ps1` | `$files` += il nuovo test |
| `docs/12-DEVOPS.md` | §9.8e nuova (sequenza, meccanismo, regola generale), §9.10 a 16 step, changelog 0.8 |
| `AGENTS.md` | v1.25 → v1.26: riga `auto-bundle` in §"📤 Post-merge actions", validatore a cinque controlli, footer cumulativo |

## Difetti trovati lungo il percorso

**Il gate era scritto ma mai chiamato.** La prima stesura di `checkWriterOrdering`
inseriva la chiamata `failures += checkWriterOrdering(dir)` a metà del file, prima
della dichiarazione di `const WRITER_ORDERING`. In JavaScript `const` non è
hoisted: il modulo si rompeva con `ReferenceError: Cannot access
'WRITER_ORDERING' before initialization` — un errore che **non** produce un
`[FAIL]` del gate ma un crash dello script, e quindi nessun messaggio utile.
Corretto spostando la chiamata in fondo al file, dopo le dichiarazioni.

**Il test non poteva usare `python3`.** La prima stesura di T2 manipolava la
fixture con uno script Python inline. Su Windows `python3` non esiste (l'alias
della Microsoft Store occupa il nome e fallisce), quindi il test non poteva
girare in locale. Sostituito con `sed`, disponibile in Git Bash, WSL e Linux: la
CI gira su Ubuntu, ma il test deve essere eseguibile anche dal dev Windows.

**`bash` su Windows non è WSL.** `bash` nel `PATH` di Windows è lo stub della
Microsoft Store, che fallisce con un messaggio su WSL. Il Git Bash
(`C:\Program Files\Git\bin\bash.exe`) è la shell utilizzabile. Nota operativa per
i futuri agenti: i test `scripts/test-*.sh` si eseguono in locale con il Git Bash,
non con il `bash` del `PATH`.

## Verifica

- `node scripts/validate-workflows.mjs .github/workflows` → exit 0 (5 controlli, 2 writer di `main`)
- `bash scripts/test-workflow-writer-ordering.sh` → **6 ok, 0 fallimenti**
- `bash scripts/test-workflow-push-sync.sh` → 15 passati, 0 falliti (non regresso)
- `pwsh scripts/generate-bundle.ps1 --check` → exit 0 (74 file)
- Rigenerazione del bundle **idempotente** (due run consecutivi → hash identico)
- `pwsh scripts/aggregate-state.ps1 --check` → drift **atteso** sul solo blocco
  `AGGREGATE-BUNDLE-INVENTORY` (74 file invece di 72: i due nuovi file della PR):
  lo rigenera `auto-state-aggregate` post-merge

## Lesson learned

| # | Osservazione |
|---|----------------|
| 48-1 | **La serializzazione non è l'ordinamento.** Un concurrency group con `cancel-in-progress: false` garantisce che due run non si sovrappongano: non dice *quale* parte prima. Quando i due workflow producevano artefatti indipendenti la differenza era invisibile; è diventata un bug quando il secondo ha cominciato a **leggere** ciò che il primo **scrive**. La lezione è sulla forma dei dati, non sul meccanismo: due writer sullo stesso ref sono due problemi distinti (*chi pusha per primo*, §9.8d) e, quando condividono un artefatto logico, un terzo (*chi produce prima*) |
| 48-2 | **Un commit fatto col GITHUB_TOKEN non innesca workflow.** Il push del bot toccava tutti i path di `auto-bundle` e la run non partiva: GitHub sopprime i workflow run innescati dal proprio token (anti-ricorsione; sole eccezioni documentate: `workflow_dispatch`, `repository_dispatch`). Il meccanismo di auto-guarimento era quindi spento per definizione, e il drift poteva solo essere corretto a mano. `workflow_run` aggganciato alla *conclusione* del workflow aggira la soppressione — è la leva giusta quando un workflow deve poter svegliarne un altro |
| 48-3 | **Un gate che non gira non è un gate.** Il check era implementato ma la chiamata era finita sopra la dichiarazione: crash con `ReferenceError` invece di un `[FAIL]` leggibile. La lezione è operativa, non concettuale: un gate va eseguito **almeno una volta** su un caso che lo dovrebbe far fallire, ed è esattamente ciò che fa `test-workflow-writer-ordering.sh` T2 |
| 48-4 | **I test di regressione devono girare dove gira il dev.** Un test che usa `python3` è green su CI Linux e non eseguibile su Windows: la copertura si applica solo metà delle volte. Gli strumenti disponibili ovunque (`sed`, `awk`, `grep`) sono preferibili a quelli comodi in un solo ambiente |

## Documenti aggiornati

- `.github/workflows/auto-bundle.yml` — trigger `workflow_run` + nota di-header
- `scripts/validate-workflows.mjs` — quinto controllo `checkWriterOrdering`
- `scripts/test-workflow-writer-ordering.sh` — **nuovo** (T1..T5, 6 assert)
- `.github/workflows/ci.yml` — step bloccante in posizione 13
- `scripts/generate-bundle.ps1` — `$files` += il nuovo test
- `docs/12-DEVOPS.md` — §9.8e nuova, §9.10 a 16 step, changelog 0.8
- `AGENTS.md` — v1.25 → v1.26, riga `auto-bundle`, validatore a cinque controlli, footer
- `docs/state/sessions/48-fix-bundle-writer-ordering.md` — **nuovo**
- `docs/BUNDLE.md` — rigenerato (74 file)

## Cross-refs

- **#149** — issue del bug strutturale, chiusa da questa PR
- `docs/12-DEVOPS.md` §9.8e — la diagnosi completa con la sequenza temporale
- `docs/12-DEVOPS.md` §9.8d — il problema affine del sync con `origin/main` (#140)
- Prossima story lavorabile: **1.3** — ADR-0010 (issue #148) e spec Last.fm (issue #144)
