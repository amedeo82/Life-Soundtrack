---
number: 33
title: "Procedura canonica post-merge (review: mancava l'aggiornamento di `main` prima del delete branch)"
date: 2026-10-20
state: 🟡
branch: docs/33-post-merge-procedure
pr: 0
claim: kilo-HP-ELITEBOOK-post-merge-review
cross_refs: [39, 40, 65, 68]
tags: [docs, post-merge, hard-procedure, git-workflow]
---

# Sessione 33 — Procedura canonica post-merge

## Sintesi

Il Boss, durante una review, ha identificato un gap critico in `AGENTS.md` §"♻️ Pulizia branch post-merge": **la procedura non aggiornava `main` prima di eliminare i branch**, e usava `git branch -r --merged main` (locale, stale) invece di `origin/main` (fonte di verità post-merge via GitHub UI). Risultato: `git branch -d` rifiutava con `not fully merged`, `git checkout main` poteva fallire, le worktree rimanevano registrate.

Questa sessione sostituisce le 4 istruzioni manuali con una procedura canonica **automatizzata e testata**:

- **`scripts/post-merge.ps1`** — 7 passi con safety guard (zero-WIP, worktree prima, fetch, allineamento main, verifica merge robusta al squash, delete locale con fallback `git cherry`, prune)
- **`scripts/test-post-merge.sh`** — 9 scenari (T1..T9) su repo git temporanei: merge commit + worktree, HEAD sul branch, WIP, squash, main divergente, audit, idempotenza, exec da worktree

## Trigger

Review Boss: *"secondo me manca un passaggio, dopo il merge della pr su main manca l'aggiornamento del main prima della eliminazione dei branch locali e remoti usati per creare la pr. verifica e dimmi se mi sbaglio"*. Verifica confermava il gap, più 2 difetti correlati:

1. `git branch -d` confronta contro **HEAD** (non contro main); con main stale o con il branch ancora checked-out → rifiuto
2. `git branch -r --merged main` confronta contro il **main locale**, stale dopo un merge via GitHub UI → falso negativo
3. (flusso worktree) `git branch -d` fallisce sempre finché la worktree non è stata smontata, ma l'elenco metteva `branch -d` **prima** di `worktree remove`

## Claim

Issue **#68** creata per questo lavoro (non esisteva una story `agent-ready` dedicata: è un bug di governance del workflow, segnalato dal Boss in review).

- Claim `kilo-HP-ELITEBOOK-post-merge-review` (comment ID `6287410309`, 2026-10-20T09:03:08Z, unico claim → vincitore per unanimità)
- Branch `docs/33-post-merge-procedure` in worktree `../ls-33-post-merge-procedure` (creata da `origin/main` = `1edf8a8`, merge PR #67)
- Working copy principale lasciata intatta: era su `feat/66-aggregate-state-nodejs` (lavoro di un altro agente), quindi le modifiche sono state spostate in worktree **prima** di ogni commit — questo evita la categoria E3/E4/E5 (vedi D.26.4)

## Decisioni (D.33.x)

| # | Decisione | Motivazione |
|---|---|---|
| D.33.1 | Script + test invece di sola prosa | "Procedura di lavoro completa e corretta che impedisca rotture" → automazione + 9 scenari su repo temporanei > checklist testuale |
| D.33.2 | Script da working copy principale, exit 15 se da worktree | Refuse invece di improvise (evita `git branch -d` su branch checked-out) |
| D.33.3 | Verifica merge via `gh pr list` come fonte autorevole, fallback `git merge-base` ancestrale, advisory `git branch -r --merged` | Il fallback ancestrale mente sui merge squash; gh API è robusta a qualsiasi strategy |
| D.33.4 | Fallback `git cherry <base> <branch>` per `git branch -d` rifiutato | Con squash il branch non è antenato di base, ma se `git cherry` non rileva `+`, allora il contenuto è già in base → `-D` sicuro |
| D.33.5 | Test in bash con `pwsh/powershell` come dipendenza | Coerente con gli altri test del repo (`test-safe-branch-switch.sh`, `test-setup-worktree.sh`) |
| D.33.6 | Zero-WIP guard al passo 0 | Defensive contro E3/E4/E5 (story #45); `-Stash` salva, altrimenti stop con exit 10 |
| D.33.7 | `-Check` come audit read-only, exit 14 con residui | Gate CI/CLI: rileva branch merged-orfani, worktree attive, main locale stale |
| D.33.8 | `-AllowUnmerged` come via di fuga documentata, non default | Fail-closed: meglio chiedere conferma scritta che perdere un branch con contenuto nuovo |

## Modifiche

### 1. `AGENTS.md` (v1.9 → v1.10)
- **§"♻️ Pulizia branch post-merge"**: completamente ristrutturata come procedura canonica vincolante
  - Tabella 8 passi (zero-WIP → worktree → fetch → allineamento main → verifica merge → delete remoto → delete locale → prune) con failure mode E/F
  - Sottosezione "Esecuzione (comando unico)" con `pwsh scripts/post-merge.ps1 -Branch ... -IssueNumber ...`
  - "Equivalente manuale" (preservato per ambienti senza pwsh)
  - "Regole di sicurezza" + tabella exit code
  - "Copertura dei test" (T1..T9)
- **§"📤 Post-merge actions" Livello 2/3**: ora puntano allo script
- **§"📝 Checklist auto-check post-merge"**: `git branch -r --merged main` (stale!) → `post-merge.ps1 -Check`
- **§"🚀 Primo task" step 6**: reference al nuovo script
- **§"🌳 Worktree workflow"**: subsection "Cleanup della worktree (post-merge)" — spiega exit 15
- **§"🛡️ Session start checklist"**: aggiunto audit opzionale (`post-merge.ps1 -Check`)
- **Repo structure tree**: aggiunti i 2 nuovi script
- **Footer changelog**: aggiornato a v1.10

### 2. `scripts/post-merge.ps1` (nuovo, 510 righe)
- Comment-based help con `.EXAMPLE` x3 e tabella exit code
- Helper `Invoke-Git`/`Invoke-Exe` (exit code driven, nessun `throw` su stderr nativo)
- 7 passi + audit `-Check`
- Link a `gh` come fonte autorevole quando disponibile

### 3. `scripts/test-post-merge.sh` (nuovo, 9 scenari su repo `git init` temporanei)
- T1, T2b: main allineato + worktree rimossa + branch eliminati
- T3: branch non mergato preservato (exit 12)
- T4: WIP tracked → exit 10; con `-Stash` → exit 0 + stash creato
- T5: merge squash → exit 12 senza verifica, exit 0 con `-AllowUnmerged` + fallback cherry
- T6: main locale divergente → exit 11, branch intatto
- T7: `-Check` exit 14 con residui, exit 0 a residuo zero
- T8: idempotenza della procedura
- T9: esecuzione da dentro la worktree → exit 15

### 4. `scripts/generate-bundle.ps1` ($files)
- Aggiunto `scripts/post-merge.ps1` e `scripts/test-post-merge.sh` (51 file totali)

### 5. `docs/BUNDLE.md` (rigenerato)
- Include v1.10 di AGENTS.md + i 2 nuovi script
- `pwsh scripts/generate-bundle.ps1 --check` exit 0

### 6. `docs/13-ADR/` + nuovo ADR (TBD)
- L'eventuale decisione "post-merge script vs procedura manuale" può essere promossa a ADR retrospettiva; per ora documentata in questa sessione

## Verifica (D.12.1 pre-merge)

```powershell
bash scripts/test-post-merge.sh                  # 29/29 PASS
pwsh scripts/post-merge.ps1 -Check               # exit 14 con 3 worktree attive altrove (atteso)
pwsh scripts/post-merge.ps1 -Branch feat/66 -DryRun  # elenca i passi senza modificare
pwsh scripts/generate-bundle.ps1 --check         # exit 0
pwsh scripts/aggregate-state.ps1 --check         # exit 0
git status --porcelain                            # M AGENTS.md, M docs/BUNDLE.md, ?? scripts/{post-merge.ps1,test-post-merge.sh}
```

## Conflitti potenziali

| File | Rischio | Risoluzione |
|---|---|---|
| `AGENTS.md` | Conflitto con `feat/66-aggregate-state-nodejs` (parallela) | Branch non mergato, rischio basso; Boss decide sequenza merge |
| `docs/BUNDLE.md` | Auto-regen post-merge (V2) | Standard |
| `scripts/post-merge.ps1` + `test-post-merge.sh` | Nuovi, nessuna PR aperta li tocca | OK |

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 33-1 | `git branch -d` confronta contro HEAD, non contro main | ✅ fixato: script forza `git checkout main` + `merge --ff-only origin/main` PRIMA di step 6 |
| 33-2 | `git branch -r --merged main` usa main locale stale | ✅ fixato: script e docs ora `origin/main` |
| 33-3 | Worktree non rimossa prima di `branch -d` | ✅ fixato: passo 1 sposta `worktree remove` prima del passo 6 |
| 33-4 | Merge squash → `branch -d` rifiutato con contenuto già in base | ✅ fixato: fallback `git cherry` + `-D` condizionato |
| 33-5 | Script eseguibile da worktree → `branch -d` fallisce | ✅ fixato: refuse esplicito (exit 15) con comando corretto stampato |
| 33-6 | Main divergente → `merge --ff-only` rifiutato, agent potrebbe forzare reset | ✅ fixato: exit 11 esplicito, nessuna azione distruttiva |
| 33-7 | WIP dirty durante la procedura → rischio E3/E4/E5 (story #45) | ✅ fixato: zero-WIP guard al passo 0 con exit 10; `-Stash` per recupero |
| 33-8 | Esecuzione non idempotente (eseguito 2×) | ✅ fixato: test T8 esplicito |

## Note reviewer

- Script `pwsh` (compatibile 5.1+ e 7+). Test in bash con fallback automatico: usa `pwsh` se presente, altrimenti `powershell`.
- File di scope del bundle: dopo la modifica a `scripts/generate-bundle.ps1 $files`, `docs/BUNDLE.md` rigenerato in sync.
- **Issue #68**: creata in questa sessione, claim attivo, chiusa dalla PR via `Closes #68`.
- Working copy principale intatta: nessuna modifica lasciata sul branch di altri agenti.

## Cross-refs

- **Issue #65** (ultima PR mergata + audit v1.9): il contesto "sessioni di governance"
- **Story #39** (`feat/39-story-0-7-operations-runbook-manutenzion`): la worktree attiva è sua, NON toccata da questa sessione
- **Story #40** (`feat/40-story-0-4-ui-import-onboarding-benvenuto`): altra worktree attiva, NON toccata