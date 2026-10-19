---
number: 32
title: "Cleanup cumulativo issue needs-spec non-Story (#41, #45, #47) — verifica obsolescenza"
date: 2026-10-19
state: 🟡
branch: docs/41-45-47-issue-cleanup
pr: 0
claim: kilo-HP-ELITEBOOK-cumulativo
cross_refs: [41, 45, 47, 53, 10]
tags: [docs, cleanup, issue-cleanup, wontdo]
---

# Sessione 32 — Cleanup cumulativo issue needs-spec non-Story

## Sintesi

Verifica di obsolescenza delle 3 issue non-Story rimaste `OPEN` con label `needs-spec` (#41 semantica bundle-check, #45 DATA-LOSS `db/index.ts`, #47 worktree opzionale housekeeping). Tutte e 3 risultano **auto-risolt** o **superseded** rispetto alla codebase attuale (2026-10-19T14:47Z). PR cumulativa unica `docs/41-45-47-issue-cleanup` con `Closes #41 #45 #47` per chiuderle tutte al merge (GitHub auto-close + `status:wontdo` pre-apertura).

## Trigger

Il project owner ha richiesto: "analizzare e risolvere tutte le issue presenti nel repo tranne quelle relative alle Story, preparare una pr cumulativa per il loro fix". Il filtro "non-Story" esclude le 3 issue `agent-ready` relative a Story 0.4 (#40) e Story 0.7 (#39), oltre a #43 (Story 0.4 needs-spec). Restano 3 issue aperte non-Story, tutte bloccate da `needs-spec`.

## Verifica obsolescenza (2026-10-19T14:47Z)

| # | Issue | Verifica | Esito |
|---|-------|----------|-------|
| #47 | Worktree opzionale housekeeping | Boss ha già autorizzato chiusura come `wontdo` (commento `6267833783` del 2026-10-19T13:01:46Z: "superseded dalla issue #53 ... Si consiglia di chiudere #47 come wontdo con cross-ref a #53"). Issue #53 è ora DONE (PR #54 merged `8bc20a4` in `dda9e15`). | **OBIETTIVO** |
| #45 | DATA-LOSS `db/index.ts` post-merge PR #44 | (a) `db/index.ts` attuale (44 righe) typecheck passa (confermato Boss, commento `6264419455`); (b) modifica persa non necessaria per compilazione; (c) mitigazione strutturale merged in #53 (worktree elimina E3/E4/E5); (d) `feat/39-operations-runbook` ha `maintenance.ts` + `maintenance.test.ts` untracked per recovery. | **OBIETTIVO** |
| #41 | Semantica `generate-bundle --check` come gate CI | (a) opzione A di #10 (superseded) GIÀ implementata in `scripts/generate-bundle.ps1:232-233` (normalizzazione timestamp + line endings); (b) semantica GIÀ documentata in `docs/12-DEVOPS.md §9.7 "Determinismo del --check"`; (c) gate CI attivo in `.github/workflows/ci.yml:44`. Mancava solo formalizzazione esplicita come "gate CI". | **OBIETTIVO** |

## Claim

- Claim cumulativo `kilo-HP-ELITEBOOK-cumulativo` (non claim singolo per issue — nessuna delle 3 ha `agent-ready`)
- Branch `docs/41-45-47-issue-cleanup` creato manualmente via `git worktree add` (lo script `setup-worktree.ps1` richiede `agent-ready`, non applicabile qui)

## Decisioni (D.32.x)

| # | Decisione | Motivazione |
|---|---|---|
| D.32.1 | PR cumulativa invece di 3 PR singole | Le 3 issue sono tutte chiuse come `wontdo` + cross-ref; il lavoro è atomico (1 file AGENTS.md + 1 file 12-DEVOPS.md) |
| D.32.2 | `status:wontdo` applicato PRIMA dell'apertura PR | La GH Action `auto-status-done` applicherebbe `status:done` se la issue fosse aperta con `agent-ready`; qui vogliamo `status:wontdo` esplicito |
| D.32.3 | Worktree manuale (`git worktree add`) invece di `setup-worktree.ps1` | Lo script valida `agent-ready` obbligatorio; per docs-only cleanup di needs-spec lo script blocca. Bypass documentato |
| D.32.4 | D.45.1 aggiunto ad AGENTS.md anche se issue #45 chiusa wontdo | La lesson "recovery automatico da DATA-LOSS tramite test come spec implicita" è trasferibile a futuri agenti Story 0.7 + prevenzione generale |
| D.32.5 | §9.8 nuovo in 12-DEVOPS.md con tabella esiti gate CI | Formalizzazione richiesta da #41; opzione A già implementata ma mai esplicitata come "fail-fast gate CI semantica" |

## Modifiche

### 1. `AGENTS.md` (v1.9 → v1.9.1)
- **§"🔀 Transizioni tra branch"** (dopo D.26.4, prima di §"🪝 Pre-commit hook"):
  - Nuova subsection **"Lezione operativa D.45.1"**: procedura di recovery automatico di un delta perso, basata sull'osservazione che i test untracked sono la migliore spec implicita del barrel
  - Auto-check preventivo (dump `git diff --name-only HEAD > /tmp/pre-transition-tracked.txt`) per ridurre il rischio di DATA-LOSS futuro
  - Cross-ref a issue #45 chiusa come `wontdo`

### 2. `docs/12-DEVOPS.md` (v0.2 → v0.3)
- **§9.7 "Determinismo del `--check`"** invariato (già documenta la normalizzazione)
- **§9.8 "Semantica come gate CI"** (nuovo): tabella esiti (exit code 0/1/2) + 5 garanzie semantiche (determinismo cross-platform, cross-tempo, zero falsi positivi, rilevamento drift reale, fail-fast) + procedura di recovery per l'agente

### 3. `docs/state/sessions/32-issue-cleanup-cumulativo.md` (questo file)
- Frontmatter `number: 32`, `cross_refs: [41, 45, 47, 53, 10]`

### 4. `docs/BUNDLE.md` (rigenerato)
- Include AGENTS.md v1.9.1 + 12-DEVOPS.md v0.3
- `pwsh scripts/generate-bundle.ps1 --check` exit 0

## Verifica (D.12.1 pre-merge)

```powershell
pwsh scripts/generate-bundle.ps1 --check   # exit 0
pwsh scripts/aggregate-state.ps1 --check   # exit 0 (aggiunto state/sessions/32-*.md)
git status --porcelain                       # 4 file modificati (AGENTS.md, 12-DEVOPS.md, BUNDLE.md, state/sessions/32-*.md)
```

## Conflitti potenziali

| File | Rischio | Risoluzione |
|---|---|---|
| `AGENTS.md` | Possibile conflitto con `feat/39-operations-runbook` se riapre Story 0.7 | Branch attivo non mergato → no conflitto immediato |
| `docs/12-DEVOPS.md` | Basso (nessuna PR aperta tocca §9) | OK |
| `docs/BUNDLE.md` | Auto-regen, conflitti rari | Standard §"📤 Post-merge actions" |

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 32-1 | `setup-worktree.ps1` richiede `agent-ready` — blocca attività di docs-only cleanup su issue `needs-spec` | ⚠️ noto: per issue non-`agent-ready` usare `git worktree add` manuale (D.32.3) |
| 32-2 | 3 issue needs-spec rimanenti: la maggior parte delle "needs-spec" croniche sono auto-risolte da merge recenti | ✅ questo PR le chiude tutte in cumulative; lezione per futuri agenti: PRIMA di issue needs-spec, verificare obsolescenza |
| 32-3 | "Closes #N" con `status:wontdo` pre-applicato è la sequenza corretta per chiudere issue needs-spec obsolete | ✅ D.32.2 |

## Note reviewer

- PR cumulativa 3-in-1 (`Closes #41 #45 #47`); ogni issue chiusa con motivazione dedicata via `status:wontdo` comment
- Modifiche tutte a governance (no codice applicativo)
- Nessun branch stale da pulire (unica feature branch `feat/39-operations-runbook` non toccata da questo PR)
- Branch `docs/41-45-47-issue-cleanup` da eliminare post-merge (policy §♻️)
- Worktree `../ls-47-issue-cleanup` da rimuovere post-merge

## Cross-refs

- **#41** → semantica bundle-check: implementata come §9.8 formale
- **#45** → DATA-LOSS: lesson D.45.1 in AGENTS.md + recovery demandato Story 0.7
- **#47** → worktree opzionale: superseded da #53 (DONE) + AGENTS.md v1.9 §"🌳 Worktree workflow"
- **#53** → mitigation strutturale per #47+#45 (worktree come default)
- **#10** → originaria segnalazione non-determinismo, chiusa S17; opzione A ora §9.8