---
number: 23
title: "🪝 Fix bug pre-commit hook (D3 staged-vs-unstaged, issue #20)"
date: 2026-10-18
state: 🟢
merged: true
merged_commit: 8a48e24e8c9d03c7272d1daa0e6d914b0a610f40
merged_date: 2026-10-18T09:54:10Z
branch: fix/20-pre-commit-unstaged-only-check
pr: 21
issue: 20
claim: kilo-HP-ELITEBOOK-hc0f
---

## Sintesi

Il check pre-commit introdotto in S21 (D.21.3 + D3) bloccava ogni commit normale con `git diff HEAD`, costringendo all'uso di `--no-verify`. Fix minimale: `git diff` (unstaged-only) + `git ls-files --others --exclude-standard` (untracked). 8/8 scenari di test passati.

## Claim

- Claim `kilo-HP-ELITEBOOK-hc0f` (UTC 2026-10-18T09:00:14Z) su issue #20
- Comment ID GitHub `6247976214`, vincitore (un solo claim)
- Push early `fix/20-pre-commit-unstaged-only-check` (D.20.2)

## Decisioni (D.23.1-D.23.5)

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.23.1 | Check `git diff --quiet` (no args) come cuore della fix | `git diff HEAD` mescola staged + working tree; `git diff` è la correzione minimale |
| D.23.2 | Aggiungere `git ls-files --others --exclude-standard` per copertura untracked | `git diff` copre solo tracked; F5 stash collision include `git stash -u` |
| D.23.3 | Test bash `scripts/test-pre-commit-clean-check.sh` con 8 scenari in repo tmp | Test del solo check expression (no recursive hook); confronto OLD vs NEW |
| D.23.4 | Lesson 23-6: ogni nuovo check in `.githooks/*` deve avere un test in `scripts/test-*.sh` | D3 era concettualmente giusto ma `git diff HEAD` invece di `git diff` è typo invisibile senza test |
| D.23.5 | Doc-sync IN PR (D.21.1) e via pre-push auto-regen BUNDLE (D4) | Continuità del protocollo S21; nessun commit separato su `main` per la doc-sync |

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 23-1 | `git diff HEAD` blocca `git add && git commit` (caso normale) | ✅ risolto (`git diff --quiet`) |
| 23-2 | untracked file `git add`-ati poi scoperti non come "working tree sporco" | ✅ risolto (`ls-files --others --exclude-standard`) |
| 23-3 | test del check hook con commit ricorsivo = recursive hook | ✅ documentato (repo tmp `mktemp -d`) |

## Documenti aggiornati (doc-sync IN PR, D.21.1)

- `.githooks/pre-commit` (D3 fix)
- `.githooks/README.md` (§"Failure mode coperti" + nota F5)
- `scripts/test-pre-commit-clean-check.sh` (**nuovo**, ~90 righe bash)
- `docs/INDEX.md` (Roadmap S23 + §"Stato del progetto" S23 entry)
- `docs/SESSIONS.md` (entry S23 + changelog v1.6)
- `docs/18-DEV-LOG.md` (§11 S23 + 6 lesson 23-1..6)
- `docs/BUNDLE.md` (auto-regen via pre-push D4)
- `scripts/generate-bundle.ps1` (`$files` include `scripts/test-pre-commit-clean-check.sh`)

## Esito post-merge

PR #21 merged `8a48e24e8c9d03c7272d1daa0e6d914b0a610f40` (2026-10-18T09:54:10Z, squash da `c81a1c2`). Branch eliminata. GH Action `auto-status-done` ha applicato `status:done` a #20. Smoke-test reale: `git commit` con sole staged changes passa senza `--no-verify`.
