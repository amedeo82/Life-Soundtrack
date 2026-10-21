---
number: 30
title: "Fix CRLF drift in aggregator + generate-bundle + workflow if:always (issue #58)"
date: 2026-10-19
state: 🟢
merged: true
merged_commit: 58a42aa
merged_date: 2026-10-19T15:44:47+02:00
branch: fix/58-crlf-and-workflow
pr: 59
claim: kilo-HP-ELITEBOOK-56535750
closes_issue: 58
cross_refs: [35, 45]
tags: [bugfix, governance, devops, encoding, ci]
---

# Sessione 30 — Fix CRLF + workflow hardening (issue #58)

## Sintesi

Fix strutturale per eliminare la classe di drift ricorrenti su `docs/SESSIONS.md` e `docs/BUNDLE.md` causata da:

1. **Bug CRLF in `scripts/aggregate-state.ps1`**: `StringBuilder.AppendLine()` su Windows aggiunge `\r\n` (CRLF) invece di `\n` (LF), producendo blocchi aggregator 50 chars più lunghi rispetto alla versione LF attesa da git. Drift permanente tra main (LF) e working tree (CRLF).
2. **Bug workflow `.github/workflows/auto-state-aggregate.yml`**: step 3 (`--check`) non termina con `exit 0` esplicito dopo il warning, GitHub segnala il job come `failure`. Step 5 (`Check git diff`) e step 6 (`Commit and push`) non hanno `if: always()` → vengono skipped quando step 3 fallisce. Risultato: l'aggregator gira ma il diff non viene committato.

Entrambi i bug composti hanno causato il drift osservato in #55 + #57 (workaround manuale).

## Claim

- Claim `kilo-HP-ELITEBOOK-56535750` (UTC 2026-10-19T13:35:00Z) su issue #58
- Push early `fix/58-crlf-and-workflow` (D.20.2)
- Branch protetto: pre-commit hook D3 unstaged-only

## Decisioni (D.30.x)

| # | Decisione | Motivazione |
|---|---|---|
| D.30.1 | Sostituire `AppendLine($x)` con `Append($x + \`n)` ovunque (24 occorrenze in Build-Block-Sessions, 5 con nested parens aggiustate manualmente) | `StringBuilder.AppendLine` su Windows aggiunge `\r\n`; il fix forza LF |
| D.30.2 | `-replace \`r\`n, \`n` prima di WriteAllText in `Apply-Blocks` (defense in depth) | Doppio check LF anche se il builder e pulito |
| D.30.3 | `-replace \`r\`n, \`n` prima di WriteAllText in `generate-bundle.ps1` main | Stesso pattern CRLF in generate-bundle |
| D.30.4 | Aggiungere `exit 0` esplicito dopo warning in step 3 del workflow | GitHub segnala correttamente il job come success quando il warning e atteso |
| D.30.5 | Aggiungere `if: always()` a step 5 (`Check git diff`) | Anche se step 3 fallisce, il diff check deve girare |
| D.30.6 | Test `scripts/test-appendline-lf-fix.ps1` con 5 scenari | Regression test: AppendLine + CRLF detection + LF-only block + bundle -replace + end-to-end |
| D.30.7 | Rigenerazione BUNDLE.md con il fix (47 file, include nuovo test) | Chiude il drift preesistente |
| D.30.8 | Branch con prefisso `fix/N-` (no issue number) | Per fix strutturali senza spec dedicata |

## Lesson learned (debug del bug)

| # | Sintomo | Stato |
|---|---------|-------|
| 30-1 | `StringBuilder.AppendLine` su Windows aggiunge `\r\n`, drift su blocchi aggregator | ✅ risolto (24 fix in Build-Block-Sessions + 5 fix manuali per nested parens) |
| 30-2 | `pwsh` (PowerShell Core) non disponibile in questo env (solo powershell 5.1) | ⚠️ documentato (test usa fallback Get-Command pwsh) |
| 30-3 | `--replace \`r\`n, \`n` su stringa PowerShell normalizza correttamente | ✅ confermato (test S2) |
| 30-4 | sed-like regex `[void]$sb.AppendLine\(([^()]+)\)` non gestisce nested parens | ✅ risolto (5 casi aggiustati manualmente dopo il bulk replace) |
| 30-5 | `WriteAllText` con UTF-8 no BOM scrive byte esatti della stringa (no auto-CRLF) | ✅ confermato (test S1 + S2) |

## Test eseguiti

- `pwsh scripts/test-appendline-lf-fix.ps1`: **5/5 PASS**
  - S1: AppendLine aggiunge CRLF su Windows
  - S2: Append + LF produce solo LF
  - S3: aggregate-state.ps1 non contiene AppendLine in codice
  - S4: generate-bundle.ps1 ha -replace CRLF, LF
  - S5: aggregator end-to-end produce block LF-only
- `pwsh scripts/aggregate-state.ps1 --check`: **PASS** (SESSIONS + BACKLOG in sync)
- `pwsh scripts/generate-bundle.ps1 --check`: **PASS** (47 file in sync)

## Documenti aggiornati

- `scripts/aggregate-state.ps1` (24 fix in Build-Block-Sessions + 5 fix manuali; debug e -replace CRLF, LF)
- `scripts/generate-bundle.ps1` (`-replace \`r\`n, \`n` prima di WriteAllText; $files include nuovo test)
- `.github/workflows/auto-state-aggregate.yml` (exit 0 esplicito + `if: always()` su step 5)
- `docs/BUNDLE.md` (rigenerato, 47 file, in sync)
- `scripts/test-appendline-lf-fix.ps1` (nuovo, 5 scenari pwsh)
- `docs/state/sessions/30-crlf-and-workflow-fix.md` (questo file)

## File NON modificati (per backward compatibility)

- Tutti i workflow (auto-status-done.yml) invariati (gia funzionanti)
- Tutti gli state/ file invariati
- `docs/SESSIONS.md` invariato (gia in sync dopo fix)
- `docs/11-BACKLOG.md` invariato

## Esito post-merge (placeholder)

PR #59 (TBD) merged. Branch `fix/58-crlf-and-workflow` eliminata (policy §♻️). Claim `kilo-HP-ELITEBOOK-56535750` rilasciato con `release:` + merge SHA. GH Action `auto-status-done` applica `status:done` a #58. Issue cross-ref: #45 (DATA-LOSS) workflow mitigation + #35 (drift doc) prevention.

## Cross-refs con altre PR aperte

- **#53 (PR #54, worktree)**: dopo merge di #58, il worktree default + LF-only scripts riducono a ~0 i failure mode E3/E4/E5 (data loss) e drift CRLF
- **#52 (PR #56, ADR-0008 V2)**: dopo merge di #58, l'aggregator V2 (5 target) funziona correttamente senza drift CRLF; la GH Action auto-state-aggregate non fallira piu al diff check
