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

  Se il branch non matcha, il commit viene abortito con un messaggio esplicitivo.
  Verifica inoltre l'encoding dei file staged (gate anti-mojibake della issue #277) e
  esegue `lint-staged` (lint + format dei file staged).

- **`commit-msg`**: Conventional Commits (`pnpm exec commitlint --edit "$1"`).

- **`pre-push`**: rigenera `docs/BUNDLE.md` se `docs/` è cambiato, e avvisa se il branch è >5 commit dietro `origin/main`.

- **`post-checkout`**: **advisory** — avvisa se un checkout tra branch ha lasciato modifiche tracked nella working tree (mitiga E3/E4/E5, issue #45).

## Un solo hooks path *(Sessione 93, issue #290)*

`.githooks/` è **l'unico** percorso degli hook. La regola è fragile: `core.hooksPath` è un'impostazione di git, e **chiunque scriva in quel campo senza saperlo spegne tutti gli hook del repository**.

È successo per anni. `package.json` dichiarava `postinstall` (che imposta `.githooks` via `scripts/setup-hooks.js`) **e** `prepare: husky`: husky v9 scrive `core.hooksPath = .husky/_` nel suo lifecycle `prepare`, che pnpm esegue **dopo** `postinstall`. Risultato: dopo ogni `pnpm install` il path era `.husky/_` e i tre hook di questa cartella **non hanno mai girato** — le difese F1/F7 (pattern del branch), D.4/G.4 (bundle auto-regenerato al push) e F5 (advisory sul working tree) erano documentate e mai esercitate.

Con il path corretto sono emersi due difetti latenti nel `pre-commit`, entrambi invisibili finché l'hook non ha girato: il blocco encoding chiudeva l'hook con `exit 0` **prima** dei controlli successivi, quindi (a) il gate anti-mojibake non poteva bloccare un commit e (b) l'invariante del branch non veniva mai verificato.

Oggi:

- `package.json` **non** dichiara `prepare` e **non** dipende da husky: nessun lifecycle script può sovrascrivere il path;
- `scripts/setup-hooks.js` **rilegge** `core.hooksPath` dopo averlo scritto e avvisa se il valore è diverso, e segnala la cartella `.husky/` (il sintomo del difetto);
- `scripts/test-hook-wiring.sh` (13 assert) verifica il wiring statico **ed esegue un `git commit` reale** in un repository temporaneo con `core.hooksPath = .githooks`: un branch non conforme deve essere abortito, un branch conforme deve passare.

Un hook che non gira non produce rumore: è un difetto che si vede solo quando manca.

## Invariante vs igiene *(Sessione 79, issue #248, ADR-0012 D-79.6)*

Il `pre-commit` distingue due classi di controllo:

| Tipo | Controllo | Esito |
|------|-----------|-------|
| **Invariante** | pattern del branch (F1, F7) | **bloccante** (abort) |
| **Igiene** | working tree senza modifiche unstaged / file untracked (F5) | **advisory** (warning, il commit passa) |

**Perché la classe "igiene" è passata da bloccante a advisory**: il check impediva anche i **commit parziali** (committare un sottoinsieme di file), e l'unica via d'uscita era `--no-verify`, che **disabilita anche il check del branch** — un agente che voleva committare due file finiva per perdere la protezione che conta. La funzione del check (F5, collisione di stash) è mitigata **strutturalmente** dalla worktree, che è il default dal 2026-10-17 (issue #53).

Il comportamento bloccante resta disponibile:

```bash
LIFE_SOUNDTRACK_STRICT_CLEAN=1 git commit -m "..."   # il check "clean tree" torna bloccante
```

## Bypass (emergenza)

```bash
git commit --no-verify                           # salta il pre-commit una volta
LIFE_SOUNDTRACK_SKIP_HOOKS=1 git commit ...     # salta via env var (CI, cherry-pick)
```

Usare il bypass solo in caso di emergenza (cherry-pick, hotfix, fix urgente). Documentare la ragione nel messaggio di commit.

> Attenzione: `--no-verify` disabilita **tutti** i check del `pre-commit`, incluso l'invariante sul branch. Se serve solo saltare l'igiene, si può — ma il branch deve essere comunque conforme.

## PowerShell 7 obbligatorio *(Sessione 79, ADR-0012 D-79.7)*

Il `pre-push` **non usa** Windows PowerShell 5.1 come fallback per rigenerare il bundle: sotto 5.1 il *parsing* dei `.ps1` UTF-8 senza BOM sovradecodifica (F9-bis, `docs/12-DEVOPS.md §9.12`) e il mojibake verrebbe **scritto in `docs/BUNDLE.md`** e committato — l'hook che esiste per prevenire il drift lo causava. Se `pwsh` 7 non è disponibile, il bundle **non** viene rigenerato: l'hook avvisa e prosegue.

```bash
pwsh -NoProfile -c '$PSVersionTable.PSVersion.Major'   # deve stampare 7 o maggiore
```

## Failure mode coperti

- **F1**: commit accidentale su `main` → abort (invariante)
- **F7**: commit su branch dopo merge (l'agente dimentica di fare `git checkout main && git pull`) → abort (invariante)
- **F5** (parziale, ora advisory): modifiche unstaged o file untracked nella working tree prima del commit → warning. **Importante**: il check rileva solo **unstaged tracked** (`git diff`) e **untracked non esclusi da .gitignore** (`git ls-files --others --exclude-standard`). Le **staged changes** sono il payload del commit e passano il check. Fix Sessione 23 / issue #20; comportamento reso advisory nella Sessione 79 (issue #248).

## Failure mode NON coperti (vedi AGENTS.md §"🛡️ Hardening multi-agente")

- **F3**: file conflict in working copy (richiede worktree, scelta NO)
- **F5** (residuo): stash collision nella working copy condivisa — mitigato dal default "worktree" (issue #53)
- **F8**: force push accidentale (mitigato da "no force push" in AGENTS.md §"🌳 Git workflow")
