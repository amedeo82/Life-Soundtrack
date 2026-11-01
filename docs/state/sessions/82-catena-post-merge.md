---
number: 82
title: "La catena post-merge si auto-ripara: concurrency group propri, advisory e verifica finale (issue #251)"
date: 2026-11-01
state: 🟡
merged: false
branch: feat/251-catena-post-merge
pr: 0
claim: kilo-hp-elitebook-1c9d
tags: [devops, governance, tooling]
---

# Sessione 82 — La catena post-merge si auto-ripara (issue #251)

> **Issue di tracking**: #251. **Branch**: `feat/251-catena-post-merge`.
> Lotto indipendente dell'epic #248: chiude il difetto della **catena di automazione post-merge**,
> scoperto misurando i run del merge della PR #249.

## Sintesi

Tre workflow scrivono su `main` dopo ogni merge: `auto-session-merge-state` (chiude la sessione),
`auto-state-aggregate` (rigenera i blocchi `AGGREGATE-*`), `auto-bundle` (rigenera il contenuto
FILE del bundle). I tre condividevano il concurrency group `post-merge-main`, e la semantica
documentata di GitHub è stata letta male per mesi:

> con `cancel-in-progress: false`, GitHub **non accoda** i run in attesa: li **cancella**
> (*«any previously pending job or workflow in the concurrency group will be cancelled»*).

Il group, quindi, non serializzava i tre writer: ne **annullava** due. Misurato nel merge della
PR #249 (`2478a9a`, 2026-11-01T14:55:28Z):

| run | workflow | esito | durata |
|-----|----------|-------|--------|
| `41318575856` | `auto-bundle` | success | 19 s |
| `41318575925` | `auto-state-aggregate` | **cancelled** | **1 s** |
| `41318576222` | `auto-session-merge-state` | **cancelled** | **4 s** |

I due run annullati non avevano **nessun job**: erano stati cancellati in attesa. Conseguenza
misurata: il frontmatter della Sessione 79 restò `merged: false` per una PR già mergiata, e il
gate bloccante `check-merge-state.mjs` **fallì su `main`**.

Il difetto è stato **confermato tre volte** (merge #249, #253, #255): a ogni merge uno dei tre
writer viene annullato. La catena funzionava **per caso**, non per progetto.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-82.1 | Ogni writer ha il **proprio** concurrency group (`post-merge-session`, `post-merge-aggregate`, `post-merge-bundle`) | Con group separati non c'è più competizione: nessun writer può annullare un altro. L'**ordinamento** non dipende dal group ma dalla **catena dei push** (merge → sessione → aggregate → bundle): l'ultimo run arriva sullo stato finale |
| D-82.2 | `apply-merge-state.mjs` esce **0 con un warning** quando nessun file di sessione corrisponde alla PR | Una PR **senza** sessione (una `fix`, o una PR che non scrive `pr:`) non ha niente da chiudere: fallire rendeva rosso il workflow post-merge per un motivo che non è un errore (misurato: issue #254) |
| D-82.3 | `auto-bundle.yml` chiude la catena con una **verifica e auto-riparazione** (2 tentativi) | L'ultimo writer garantisce che `main` sia coerente: se i check non passano, rigenera e committa. La catena si **auto-ripara** invece di lasciare lo stato stale in silenzio |
| D-82.4 | `post-merge.ps1` stampa il numero della **PR** (non dell'issue) nel comando `apply-merge-state` | I due numeri coincidono solo per convenzione: il suggerimento era **non eseguibile** quando differivano (misurato: issue #252 → PR #253). Ora il numero della PR viene letto dalla verifica di merge già presente |
| D-82.5 | Il comportamento di `-Check` di `apply-merge-state.mjs` resta **fail-closed** quando un file di sessione esiste ma non dichiara la PR | La precondizione `pr: N` resta verificata: è `agent-pr.ps1` (Sessione 81) a scriverla, non l'agente a mano |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **75%** (21 story completate su 28, effort 77%), restano
**7 step**. Lavoro di **governance** su un'issue dedicata, non story di backlog.

**Cosa è pronto.** Tre concurrency group separati; `apply-merge-state.mjs` advisory quando non c'è
sessione; step di verifica e auto-riparazione in `auto-bundle.yml`; `post-merge.ps1` che stampa il
numero della PR; i commenti dei tre workflow e di `ci.yml` allineati alla semantica reale.

**Cosa manca.** Il lotto **I3** dell'epic #248 (rifinitura di `AGENTS.md` a ~400 righe con 77
anchor invariati). Nessun altro difetto noto della catena post-merge.

**Salute tecnica.** Worktree attiva su `feat/251-catena-post-merge`. Claim riverificato sull'issue
#251 (commento `6560302917`, unico claim). Nessun blocco `AGGREGATE-*` modificato a mano.

**Gate di testabilità.** `node scripts/validate-workflows.mjs .github/workflows` → 0 fallimenti ·
`bash scripts/test-post-merge.sh` → 47 assert, 0 falliti ·
`bash scripts/test-workflow-writer-ordering.sh` → 6/0 ·
`bash scripts/test-workflow-git-add-coverage.sh` → 8/0 ·
`bash scripts/test-workflow-push-sync.sh` → 15/0 ·
`node scripts/apply-merge-state.mjs --pr 9999` → exit 0 con warning ·
`pwsh scripts/aggregate-state.ps1 -Check` → exit 0 · `pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| La semantica di `cancel-in-progress: false` è stata letta al contrario per mesi: il group **non accodava**, **annullava** | Un'impostazione di 2 righe con una semantica opposta a quella documentata è un difetto di **specifica**, non di codice. La lezione non è «leggere la documentazione»: è **misurare il comportamento** (i run cancellati duravano 1 s e 4 s senza un solo job: il dato era lì) |
| Il group era stato introdotto per **serializzare** i writer (issue #115) e per un anno ha fatto il contrario di quello che serviva | Una misura che protegge una cosa e ne rompe un'altra va guardata **per ciò che protegge**, non per ciò che intende proteggere |
| Un errore di *rumore* (workflow rosso per una PR che non ha sessione) ha fatto perdere più tempo di un errore di *danno* | Il fail-closed va applicato **dove il fallo è un fallo**: l'assenza di una sessione è un fatto, non un errore |
| Il numero della PR e il numero dell'issue sono numeri diversi, e il protocollo li usava come se fossero lo stesso | Ogni comando che accetta un identificatore deve dichiarare ** quale accetta. Il suggerimento stampato da `post-merge.ps1` era semplicemente non eseguibile |

## Documenti aggiornati

- `.github/workflows/auto-session-merge-state.yml`, `auto-state-aggregate.yml`, `auto-bundle.yml`:
  concurrency group propri + nota di-header sul perché
- `.github/workflows/auto-bundle.yml`: step «Verifica e auto-riparazione dello stato (issue #251)»
- `scripts/apply-merge-state.mjs`: assenza di sessione → advisory (exit 0)
- `scripts/post-merge.ps1`: il numero della PR nel comando `apply-merge-state`
- `AGENTS.md` v1.36 → v1.37: la sezione §"📤 Post-merge actions" allineata alla semantica reale
- `docs/12-DEVOPS.md §9.10` + `docs/18-DEV-LOG.md` §48 · `docs/INDEX.md`
- `scripts/generate-bundle.ps1`: `$files` += la sessione 82
