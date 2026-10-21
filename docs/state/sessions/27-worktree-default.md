---
number: 27
title: "Adozione worktree come default per agenti paralleli"
date: 2026-10-19
state: 🟢
merged: true
merged_commit: 8bc20a4
merged_date: 2026-10-19T16:24:57+02:00
branch: feat/53-worktree-default
pr: 54
claim: kilo-HP-ELITEBOOK-56535750
closes_issue: 53
supersedes_issue: 47
cross_refs: [45, 47]
tags: [worktree, governance, devops, hook]
---

# Sessione 27 — Adozione worktree come default per agenti paralleli

## Sintesi

Inversione di D.20.1 (S20): la worktree diventa il **default** per ogni agente che claima una issue, non più un'opzione. La worktree elimina per costruzione i failure mode E3/E4/E5 (DATA-LOSS documentato in issue #45) che le difese hook/.githooks/post-checkout + scripts/safe-branch-switch.ps1 mitigavano solo parzialmente.

Implementazione:
- `scripts/setup-worktree.ps1` (nuovo, ~270 righe PowerShell): crea worktree in `../ls-<N>-<slug>` da `origin/main`, push early (D.20.2), configura `core.hooksPath`
- `scripts/test-setup-worktree.sh` (nuovo, ~190 righe bash): 8 scenari (issue missing, slug derivato/esplicito, path esistente, branch base mancante, idempotenza, -NoPush, -SkipGhCheck)
- `AGENTS.md` v1.8: nuova sezione "🌳 Worktree workflow"; §"🚀 Primo task" step 3 aggiornato

## Claim

- Claim `kilo-HP-ELITEBOOK-56535750` (UTC 2026-10-19T13:08:00Z) su issue #53
- Push early `feat/53-worktree-default` (D.20.2)
- Branch protetto: pre-commit hook D3 unstaged-only

## Decisioni (D.27.x)

| # | Decisione | Motivazione |
|---|---|---|
| D.27.1 | Worktree come default (inversione D.20.1) | Issue #45 (DATA-LOSS) ha dimostrato che hook advisory non bastano; serve isolamento fisico della working copy |
| D.27.2 | Script `setup-worktree.ps1` invece di documentare `git worktree add` | Idempotente, validazioni strutturate (issue candidate, branch base, path duplicato), output user-friendly |
| D.27.3 | Slug derivato dal titolo issue (kebab-case, max 40 char) | Auto-discovery: l'agente non deve inventare lo slug; max 40 char evita nomi eccessivi |
| D.27.4 | Branch `fix/<N>-<slug>` se titolo contiene "fix" o "bug" | Convenzione pre-commit hook; minimizza friction |
| D.27.5 | Worktree path = `../ls-<N>-<slug>` (un livello sopra la repo) | Stessa convenzione di S20 "worktree-pool"; visibile e pulito |
| D.27.6 | Configurazione `core.hooksPath` nella worktree | Gli hook (.githooks/pre-commit, pre-push, post-checkout) funzionano anche nella worktree |
| D.27.7 | `-SkipGhCheck` per i test | I test non possono dipendere da gh autenticato; il flag permette dry-run |
| D.27.8 | Mantieni `.githooks/post-checkout` + `scripts/safe-branch-switch.ps1` come advisory | Non-breaking change per agenti che non usano worktree; safety net ridondante ma utile |

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 27-1 | `2>&1` su `git worktree add` causa `$LASTEXITCODE` ambiguo in PowerShell 5.1 | ✅ risolto (`| Out-Null` invece di `2>&1`) |
| 27-2 | Backtick in stringa doppia PowerShell = escape char (rompe il parse) | ✅ risolto (rimozione backtick o concatenazione variabili) |
| 27-3 | `pwsh` (PowerShell Core) non disponibile in questo env | ⚠️ test eseguibile solo in CI; documentato in PR |
| 27-4 | `bash -n` non funziona senza WSL installato | ⚠️ test eseguibile solo in CI; script sintassi verificata via reading |

## Documenti aggiornati

- `AGENTS.md` v1.8: nuova sezione "🌳 Worktree workflow"; §"🚀 Primo task" step 3-6 aggiornati
- `scripts/setup-worktree.ps1` (nuovo, ~270 righe)
- `scripts/test-setup-worktree.sh` (nuovo, 8 scenari bash)
- `scripts/generate-bundle.ps1` `$files` include i 2 nuovi script
- Issue #47 (riapertura D.20.1): cross-ref "superseded by #53" (chiusura post-merge)
- Issue #45 (DATA-LOSS): cross-ref "mitigazione strutturale in corso" (commento di stato)

## File NON modificati (per backward compatibility)

- `.githooks/post-checkout` (S26 D.26.4) — resta come safety net advisory
- `scripts/safe-branch-switch.ps1` (S26) — resta come wrapper opzionale per chi non usa worktree

## Esito post-merge (placeholder)

PR #54 (TBD) merged. Branch `feat/53-worktree-default` eliminata (policy §♻️). Claim `kilo-HP-ELITEBOOK-56535750` rilasciato con `release:` + merge SHA. GH Action `auto-status-done` applica `status:done` a #53. Issue #47 chiusa come `wontdo` con cross-ref a #53. Issue #45 commento di stato aggiornato ("mitigazione strutturale completata").
