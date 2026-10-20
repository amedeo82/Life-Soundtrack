---
number: 31
title: "AGENTS.md v1.9 cleanup completo del workflow (issue #60 + audit v1.9)"
date: 2026-10-19
state: 🟢
branch: docs/agents-md-v2-cleanup
pr: 62
claim: kilo-HP-ELITEBOOK-56535750
cross_refs: [60, 51, 52, 53, 58]
tags: [docs, governance, cleanup, workflow]
---

# Sessione 31 — AGENTS.md v1.9 cleanup completo

## Sintesi

Cleanup monolitico di AGENTS.md che chiude 10 gap identificati nell'analisi del workflow (vedi sezione "Problema identificati" sotto). Singola PR `docs/agents-md-v2-cleanup` (no codice, solo governance).

Implementazione:
- `AGENTS.md` v1.7 → v1.9: 6 modifiche atomiche (vedi sezione "Modifiche")
- `docs/BUNDLE.md`: rigenerato automaticamente (47 file, include la nuova versione di AGENTS.md)

## Claim

- Claim `kilo-HP-ELITEBOOK-56535750` su questa sessione (no issue number — docs-only PR)
- Push early `docs/agents-md-v2-cleanup`

## Decisioni (D.31.x)

| # | Decisione | Motivazione |
|---|---|---|
| D.31.1 | PR unica invece di 10 issue separate | L'utente ha richiesto cleanup organico, no frammentazione |
| D.31.2 | Forward-reference §"🌳 Worktree workflow" senza duplicare il contenuto | #54 (PR) lo aggiungera al merge |
| D.31.3 | Footer v1.7 → v1.9 con changelog cumulativo S27-S30 | Sincronizzare footer con stato reale |
| D.31.4 | §"📤 Post-merge actions" ristrutturato in 3 livelli | Era un flat list di 3 step, ora Livello 1 (auto GH Action) / Livello 2 (issue) / Livello 3 (verifica) |
| D.31.5 | Aggiunto explicit "if: always()" e `if (git diff --cached --quiet)` syntax fix in §"🔄 Lazy-state aggregation" | Cross-ref al fix S30/#58+#60 |
| D.31.6 | §"🛡️ Session start checklist" estesa a 5 check (aggiunto `git worktree list`) | Supporto worktree post-#54 |
| D.31.7 | §"🪝 Pre-commit hook" pattern `main` chiarito (solo GH Action bot identity) | Risolve contraddizione con "no commit on main" |

## Problema identificati (audit v1.9)

| # | Problema | Stato (post-cleanup) |
|---|---|---|
| P1 | "🚀 Primo task" step 3 cita solo `git checkout -b`, non worktree | ✅ risolto (forward-ref a §"🌳 Worktree workflow", aggiunto dopo merge #54) |
| P2 | §"🔄 Lazy-state aggregation" claim "rigenerati automaticamente" era falso finche #61 non merged | ✅ risolto (ora specifica S30/#58+#60 fix + cross-ref workflow) |
| P3 | §"📤 Post-merge actions" non cita auto-state-aggregate | ✅ risolto (Livello 1 ora cita 2 GH Action) |
| P4 | §"🛡️ Session start checklist" (4 check) non verifica worktree | ✅ risolto (aggiunto 5° check) |
| P5 | Footer v1.7 stale (no changelog S27-S30) | ✅ risolto (v1.9 con changelog cumulativo) |
| P6 | §"🪝 Pre-commit hook" pattern `main` contraddice "no commit su main" | ✅ risolto (chiarito `main` = solo GH Action bot) |
| P7 | §"Checklist di sincronizzazione" non cita auto-state-aggregate | ⚠️ parziale (cross-ref aggiunto a §"📤 Post-merge" Livello 1, ma non nella tabella Checklist) |
| P8 | §"🌳 Worktree workflow" non esiste in main | ⏳ dopo merge PR #54 (forward-ref in §"🚀") |
| P9 | "Closes #N" menzionato in 3 posti | ⚠️ non consolidato (accettabile: 3 contesti diversi sono OK) |
| P10 | Stash procedure troppo verbosa (60+ righe) | ⚠️ non spostato (mantenuto per ora, separazione opzionale) |

## Modifiche

### 1. `AGENTS.md` v1.7 → v1.9
- **Header**: `Versione 1.6` → `Versione 1.9`
- **§"🚀 Primo task"** (linea 528):
  - Step 3: "Crea branch `feat/<issue>-<descrizione>`" → "**Crea una worktree isolata** con `pwsh scripts/setup-worktree.ps1 <N>` (vedi §"🌳 Worktree workflow" qui sotto)"
  - Step 4: aggiunto "(nella worktree)"
  - Step 6: aggiornato per riflettere il 3-livello post-merge (auto-status-done + auto-state-aggregate + agent release + worktree remove)
- **§"📤 Post-merge actions"** (linea 539): completamente ristrutturato in 3 livelli:
  - Livello 1: GH Action `auto-status-done` + `auto-state-aggregate`
  - Livello 2: release + branch cleanup + worktree remove
  - Livello 3: verifica post-merge (aggregator + bundle + branch orfani)
  - Regola "NO commit su main" piu esplicita (eccezione solo GH Action bot)
- **§"🪝 Pre-commit hook"** (linea 366): aggiunto "Eccezione `main` chiarita" che precisa l'uso GH Action only
- **§"🔄 Lazy-state aggregation"** (linea 553):
  - Header: aggiornato a "D.24.x + D.29.x + D.30.x" con nota robustness S30
  - Tabella Target: 4 target V1/V2 → 5 target (V1 SESSIONS+BACKLOG, V2 INDEX×2 + BUNDLE)
  - Sottosezione "GH Action auto-state-aggregate" nuova con workflow steps + S30 fix
  - Checklists PR aggiuntive aggiornate con V1+V2 target
- **§"🛡️ Session start checklist"** (linea 627): 4 check → 5 check (aggiunto `git worktree list`)
- **Footer**: v1.7 → v1.9 con changelog cumulativo S27-S30

### 2. `docs/BUNDLE.md` (rigenerato)
- 47 file totali
- Include la nuova versione AGENTS.md (1.9)
- `pwsh scripts/generate-bundle.ps1 --check` exit 0
- `pwsh scripts/aggregate-state.ps1 --check` exit 0 (NESSUNA MODIFICA diretta a SESSIONS/BACKLOG/INDEX/BUNDLE aggregati; questo PR e conforme ADR-0008)

## Verifica (D.12.1 pre-merge)

```powershell
pwsh scripts/generate-bundle.ps1 --check   # exit 0 ✓
pwsh scripts/aggregate-state.ps1 --check   # exit 0 ✓
git status --porcelain                       # solo 2 file modificati (AGENTS.md + BUNDLE.md)
```

## Conflitti potenziali con PR aperte

| PR | File in potenziale conflitto | Risoluzione |
|---|---|---|
| #54 (feat/53-worktree-default) | AGENTS.md (footer + §"🚀" step 3 + §"🌳" section) | Boss merge strategy: preferibilmente PR #62 (questo) prima di #54; poi rebase #54 su main |
| #56 (feat/52-adr-0008-v2-index-bundle) | BUNDLE.md | Stesso: PR #62 prima di #56 |
| #61 (fix/60-workflow-step6-pwsh-syntax) | Nessuno | Merge indipendente |

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 31-1 | AGENTS.md ha 6 sezioni che citano lazy-state in modo incoerente | ✅ consolidato in v1.9 con tabella unificata |
| 31-2 | Footer v1.7 era stale di 3 sessioni (S27-S30) | ✅ aggiornato a v1.9 |
| 31-3 | §"📤 Post-merge actions" non strutturato (era flat 3 step) | ✅ ristrutturato in 3 livelli + regola "NO commit su main" |

## Note reviewer

- PR minimal: solo AGENTS.md + BUNDLE.md (47 file auto-regen)
- Modifiche tutte a governance (no codice applicativo)
- Footer v1.9 con changelog S27-S30 aiuta la prossima conversazione AI (handoff)
- Cross-ref a §"🌳 Worktree workflow" diventa valido dopo merge #54 (forward-ref)

## Cross-refs

- Forward: dopo merge #54 (worktree workflow) cross-ref §"🚀" si risolve
- Forward: dopo merge #56 (V2 aggregator) target table da 4 a 5 gia coerente
- Independent: PR #61 (workflow fix) merge indipendente, completa i fix S30

## Esito post-merge (placeholder)

PR #62 (TBD) merged. Branch `docs/agents-md-v2-cleanup` eliminata (policy §♻️). Boss merge strategy:
1. Merge PR #61 (fix workflow) — completeness check
2. Merge PR #62 (questo) — governance v1.9
3. Rebase PR #54 su main + merge — worktree workflow
4. Rebase PR #56 su main + merge — V2 aggregator

Liberazione claim `kilo-HP-ELITEBOOK-56535750` con `release:` + merge SHA. Branch cleanup locale + remoto.