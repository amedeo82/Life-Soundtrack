# `.githooks/` — Git hooks per il workflow agenti

Questi hook sono committati nel repo e propagati a tutti gli agenti che lavorano sul progetto. Servono a far rispettare la convenzione di branching anche in assenza di worktree (vedi `AGENTS.md` §"🛡️ Hardening multi-agente").

## Setup (una tantum per clone)

### Automatico (consigliato)

Il setup è automatico via `postinstall` di `package.json`. Dopo `pnpm install`, eseguire `git config core.hooksPath .githooks` viene tentato automaticamente (non-fatal se git non disponibile).

### Manuale (fallback)

```bash
git config core.hooksPath .githooks
```

Da quel momento tutti i commit passano attraverso `pre-commit`.

## Hook attivi

- **`pre-commit`**: verifica che il branch corrente sia valido per il workflow. Pattern ammessi:
  - `main` (solo per admin / doc-sync)
  - `docs/<desc>` (branch di documentazione)
  - `feat/<N>-<desc>` o `fix/<N>-<desc>` (per issue con numero)
  
  Se il branch non matcha, il commit viene abortito con un messaggio esplicativo.

## Bypass (emergenza)

```bash
git commit --no-verify                           # salta il pre-commit una volta
LIFE_SOUNDTRACK_SKIP_HOOKS=1 git commit ...     # salta via env var (CI, cherry-pick)
```

Usare il bypass solo in caso di emergenza (cherry-pick, hotfix, fix urgente). Documentare la ragione nel messaggio di commit.

## Failure mode coperti

- **F1**: commit accidentale su `main` → abort
- **F7**: commit su branch dopo merge (l'agente dimentica di fare `git checkout main && git pull`) → abort
- **F5** (parziale): modifiche unstaged o file untracked nella working tree prima del commit → abort. **Importante**: il check rileva solo **unstaged tracked** (`git diff`) e **untracked non esclusi da .gitignore** (`git ls-files --others --exclude-standard`). Le **staged changes** sono il payload del commit e passano il check. Fix Sessione 23 / issue #20.

## Failure mode NON coperti (vedi AGENTS.md §"🛡️ Hardening multi-agente")

- **F3**: file conflict in working copy (richiede worktree, scelta NO)
- **F5**: stash collision (mitigato indirettamente da `git status` clean check nella session-start checklist)
- **F8**: force push accidentale (mitigato da "no force push" in AGENTS.md §"🌳 Git workflow")
