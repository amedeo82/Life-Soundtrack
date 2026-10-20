---
number: 35
title: "Automazioni post-merge: chiude i buchi di auto-status-done, release e cleanup (issue #73)"
date: 2026-10-20
state: 🟡
branch: fix/73-post-merge-automations
pr: 0
claim: kilo-HP-ELITEBOOK-post-merge-review
cross_refs: [51, 63, 66, 68, 69, 70, 73]
tags: [docs, devops, automation, post-merge, adr-0006, adr-0007]
---

# Sessione 35 — Automazioni post-merge

## Sintesi

La catena post-merge dipendeva da tre passi manuali che gli agenti dimenticano, e aveva un buco che rompeva un invariante documentato. Questa sessione chiude i tre passi con automazioni conservative (guard esplicite, idempotenti, mai distruttive su casi ambigui) e aggiunge un validatore che intercetta gli errori JS dei workflow **prima** del merge.

## Trigger

Il project owner, dopo il merge di #69: *"controlla anche le azioni automatiche che avvengono dopo il merge della pr, controlla se è possibile automatizzare altro per evitare errori, controlla gli step post merge della pr e gli step di risoluzione della issue"*.

## I 4 buchi trovati

| # | Buco | Conseguenza |
|---|------|-------------|
| 1 | `auto-status-done` non rimuoveva `agent-ready` | al merge l'issue restava `agent-ready + status:done`: stato **non previsto** dalla macchina a stati (che li vuole mutuamente esclusivi, ADR-0007) e, soprattutto, l'issue **restava nella query dei candidati**: un altro agente poteva claimare un lavoro già completato |
| 2 | Commento `release:` manuale | passo obbligatorio in AGENTS.md, ma saltato di frequente → rilascio della claim non tracciato, TTL 12h ambiguo |
| 3 | Cancellazione del branch remoto manuale | è il passo post-merge più dimenticato; i branch stale sono la principale fonte di "ho lavorato sul branch sbagliato" |
| 4 | TTL 12h di ADR-0006 mai applicato | le claim stantie restavano `in-progress` indefinitamente e bloccavano la candidatura |

## Decisioni (D.35.x)

| # | Decisione | Motivazione |
|---|---|---|
| D.35.1 | `auto-status-done` rimuove `agent-ready` insieme alle altre | ripristina l'invariante ADR-0007 ed evita la ri-candidatura di lavoro completato |
| D.35.2 | Il `release:` automatico estrae l'agent-id dal commento `claim:` | l'informazione esiste già sull'issue; non serve inventare un canale nuovo |
| D.35.3 | `release:` idempotente (marker `PR #N merged` già presente → skip) | un rerun del workflow non deve duplicare commenti |
| D.35.4 | `auto-branch-cleanup` elimina **solo il ref remoto** | branch locali e worktree sono possesso dell'agente: il bot non deve toccare il filesystem di nessuno |
| D.35.5 | Guard di `auto-branch-cleanup`: skip su `main`/`release/*`/`hotfix/*`, su fork, su branch fuori pattern, e su branch usato come base di un'altra PR aperta | l'eliminazione è distruttiva: ogni caso ambiguo deve essere skip, non "probabilmente va bene" |
| D.35.6 | `stale-claim-sweeper` è **advisory**: commenta, non rimuove la label | un agente che lavora da >12h su un task pesante non deve perdere la claim per merito del timer; il rilascio spetta a chi subentra (`stale-release:`) |
| D.35.7 | Validatore dei workflow in CI | un errore JS in un `github-script` si scopre a runtime, **dopo** il merge: troppo tardi |
| D.35.8 | Il validatore emula il wrapper async di `github-script` | senza, i `return` a livello top-level (usati per gli early-exit dei guard) venivano segnalati come errori: falso positivo che avrebbe fatto ignorare il gate |

## Modifiche

1. **`.github/workflows/auto-status-done.yml`** — `labelsToRemove` esteso a `agent-ready`; estrazione agent-id dall'ultimo claim; commento `release:` idempotente con istruzioni per la cleanup locale
2. **`.github/workflows/auto-branch-cleanup.yml`** (nuovo) — eliminazione del branch remoto post-merge con 5 guard
3. **`.github/workflows/stale-claim-sweeper.yml`** (nuovo) — cron giornaliero 07:00 UTC + `workflow_dispatch`; rileva claim >12h usando l'ultimo commento `claim|release|stale-release|progress` (non `updated_at`, che si muove anche per commenti non di claim); segnala anche le claim già rilasciate con label ancora presente
4. **`scripts/validate-workflows.mjs`** (nuovo) — estrae i blocchi `script: |` dai `.yml`, avvolge il codice come fa `github-script`, esegue `node --check`; segnala anche tab nell'indentazione YAML (illegali)
5. **`.github/workflows/ci.yml`** — step bloccante "Workflow Actions validi (issue #73)"
6. **`AGENTS.md`** v1.10 → v1.12 — Livello 1 riscritto come tabella dei 4 workflow con trigger/effetto/motivazione; Livello 2 ridotto alla pulizia git locale; §"♻️" dichiara cosa è automatico e cosa resta all'agente
7. **`scripts/generate-bundle.ps1`** — `$files` += `scripts/validate-workflows.mjs`
8. `docs/BUNDLE.md`, `docs/SESSIONS.md`, `docs/INDEX.md` rigenerati

## Verifica

```bash
node scripts/validate-workflows.mjs .github/workflows   → 3 blocchi script, 0 fallimenti
pwsh scripts/generate-bundle.ps1 --check               → exit 0
pwsh scripts/aggregate-state.ps1 --check               → exit 0
```

Le API Actions usate sono state verificate a mano: `github.core.notice` / `github.core.summary` **non esistono** (esistono `core.notice` / `core.summary`) — errore corretto prima del commit. Permissions esplicite: `contents: write` + `pull-requests: read` per il cleanup, `issues: write` per gli altri.

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 35-1 | Un workflow può essere "verde" e violare un invariante: `auto-status-done` passava da 3 sessioni senza che nessuno notasse la `agent-ready` residua | ✅ rimossa. **Regola**: ogni label elencata in una macchina a stati va rimossa da chi applica le transizioni, non solo "aggiunta" |
| 35-2 | Gli early-exit dei guard (`return` top-level) sono illegali in JS ma validi dentro il wrapper di `github-script` | ✅ validatore che emula il wrapper. **Regola**: i validatori statici devono replicare il contesto di esecuzione reale |
| 35-3 | `github.core.*` non esiste: `github` è l'Octokit, `core` è `@actions/core` | ✅ corretto. Lo scopo del validatore è proprio prendere questi errori prima del merge |
| 35-4 | `updated_at` non è "ultima attività della claim": basta un commento non di claim per farlo avanzare | ✅ lo sweeper usa l'ultimo commento `claim|release|stale-release|progress` |
| 35-5 | Automatizzare il `release:` evita anche che l'agent-id venga scritto a mano e sbagliato | ✅ estratto dalla claim |

## Note reviewer

- **Conflitto atteso in `AGENTS.md`** se la PR #72 (v1.11) viene mergiata per prima: entrambe toccano header e footer. Risolvere tenendo `v1.12` e la entry `v1.11` come "Precedente".
- Nessun file JS/TS applicativo toccato: `lint`/`typecheck`/`test`/`build` invariati (`validate-workflows.mjs` è tooling CI come gli altri `scripts/*.mjs`).
- Worktree isolata: la working copy principale era occupata su `feat/66-aggregate-state-nodejs`.

## Cross-refs

- **#73** — issue di questo lavoro (chiusa dalla PR)
- **#70** — determinismo aggregator (Sessione 34): insieme a questa PR chiude il ciclo "parallelismo senza errori"
- **#68 / #69** — Sessione 33, dove il drift è stato scoperto e da cui sono nate entrambe le sessioni
- **ADR-0006** — TTL 12h delle claim, ora applicato da `stale-claim-sweeper`
- **ADR-0007** — macchina a stati, mutua esclusività `agent-ready` ∩ `status:*` = ∅, ora garantita dall'azione
- **#66** — rewrite Node.js dell'aggregator, da mantenere coerente con le garanzie di #70