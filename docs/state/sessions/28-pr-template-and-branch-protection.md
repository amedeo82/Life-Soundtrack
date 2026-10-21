---
number: 28
title: "GitHub PR template + branch protection enforcement (forza gate CI per BUNDLE, state, Closes #N)"
date: 2026-10-19
state: 🟢
merged: true
merged_commit: 11897fb
merged_date: 2026-10-19T15:23:07+02:00
branch: feat/51-pr-template-and-branch-protection
pr: 55
claim: kilo-HP-ELITEBOOK-56535750
closes_issue: 51
cross_refs: [35, 41]
tags: [governance, ci, devops, github, enforcement]
---

# Sessione 28 — GitHub PR template + branch protection enforcement

## Sintesi

Forza la procedura multi-agente **a monte** (PR template interattivo + CODEOWNERS) e **a valle** (CI gate `aggregate-state --check` bloccante). Riduce le dimenticanze degli agenti (BUNDLE, `Closes #N`, label transitions) documentate nelle lezioni D.21.1 e D.26.3.

Implementazione:
- `.github/pull_request_template.md` (nuovo): checklist interattiva con tutte le AC di AGENTS.md
- `.github/CODEOWNERS` (nuovo): governance file → review Boss obbligatoria
- `.github/workflows/ci.yml` (esteso): step `aggregate-state --check` come gate bloccante
- `AGENTS.md` v1.8: §"📝 Checklist di auto-revisione PR" aggiornata (cross-ref al template)
- `scripts/generate-bundle.ps1` `$files`: include i 3 nuovi `.github/*` file

**Branch protection** (richiede admin Boss): verra applicato dal Boss post-merge via repo settings.

## Claim

- Claim `kilo-HP-ELITEBOOK-56535750` (UTC 2026-10-19T13:30:00Z) su issue #51
- Push early `feat/51-pr-template-and-branch-protection` (D.20.2)
- Branch protetto: pre-commit hook D3 unstaged-only

## Decisioni (D.28.x)

| # | Decisione | Motivazione |
|---|---|---|
| D.28.1 | PR template con checkboxes interattive | Le caselle non spuntate sono blocker per il merge; forza la riflessione a monte del push |
| D.28.2 | `.github/CODEOWNERS` con Boss default owner | Tutti i file richiedono review Boss di default; agenti non possono auto-approvare |
| D.28.3 | Step CI `aggregate-state --check` bloccante | Chiude il loop ADR-0008 V1 enforcement (V2 in issue #52 aggiungera INDEX/BUNDLE) |
| D.28.4 | Branch protection rimandato al Boss | Richiede admin repo; non eseguibile dall'agente |
| D.28.5 | Quality step esistente `bundle --check` invariato | Gia attivo in ci.yml dall'introduzione del bundle script |
| D.28.6 | 3 file `.github/*` aggiunti al bundle (`pull_request_template.md`, `CODEOWNERS`, `ci.yml`) | Governance file rilevanti per handoff AI |

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 28-1 | Branch ricreato su commit sbagliato (incluso #53) per fretta | ✅ risolto (force delete + recreate da main) |
| 28-2 | Glob non trova `.github/workflows/*` (case sensitivity) | ⚠️ documentato (usare Get-ChildItem -Force) |

## Documenti aggiornati

- `.github/pull_request_template.md` (nuovo, ~60 righe markdown)
- `.github/CODEOWNERS` (nuovo, governance file)
- `.github/workflows/ci.yml` (esteso con step `aggregate-state --check`)
- `AGENTS.md` v1.8: §"📝 Checklist di auto-revisione PR" aggiornata
- `scripts/generate-bundle.ps1` `$files`: include i 3 nuovi file
- `docs/BUNDLE.md`: rigenerato (46 file)

## File NON modificati (per backward compatibility)

- `AGENTS.md` sezione "🌳 Worktree workflow" (introdotta in #53, gia presente)
- `.githooks/*` (invariati; pre-commit D3 + pre-push D4/D5 gia attivi)

## Action item Boss (post-merge)

Dopo il merge di questa PR, il Boss deve applicare manualmente le seguenti impostazioni su GitHub repo settings → Branches → main → Branch protection rules:

1. ✅ Require linear history (squash merge o rebase)
2. ✅ Require status checks: `quality` (lint + typecheck + test + build + bundle + aggregate-state)
3. ✅ Require pull request reviews before merging: 1 approvazione
4. ✅ Dismiss stale pull request approvals when new commits are pushed
5. ✅ Require review from Code Owners (riferimento a `.github/CODEOWNERS`)
6. ❌ Allow force pushes (NO)
7. ❌ Allow deletions (NO)

Vedi [GitHub docs: Managing branch protection rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

## Esito post-merge (placeholder)

PR #55 (TBD) merged. Branch `feat/51-pr-template-and-branch-protection` eliminata (policy §♻️). Claim `kilo-HP-ELITEBOOK-56535750` rilasciato con `release:` + merge SHA. GH Action `auto-status-done` applica `status:done` a #51. Issue #41 (chiusura semantica bundle-check) cross-ref "risolto da #51".