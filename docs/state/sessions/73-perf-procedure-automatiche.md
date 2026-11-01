---
number: 73
title: "Procedure automatiche: profilo, parallelizzazione dei gate e correzione dei difetti di copertura"
date: 2026-10-31
state: 🟢
merged: true
merged_commit: "c705cd19290563f9bce2e30af1a32c032d75ef19"
merged_date: "2026-10-31T17:13:09Z"
branch: docs/224-audit-procedure-automatiche
pr: 225
claim: kilo-HP-ELITEBOOK-perf73
cross_refs: [224, 63, 104, 218, 43, 73, 53, 49, 58]
tags: [devops, performance, ci, audit]
---

# Sessione 73 — Procedure automatiche: profilo, parallelizzazione dei gate e correzione dei difetti di copertura

## Sintesi

La Sessione 72 (issue #224) aveva **misurato** le procedure automatiche del repo ma le aveva
solo **documentate**: nessuna correzione, perché «aggiungere step alla CI e modificare la
semantica di un gate sono decisioni sul test strategy» (D.72.5). Il project owner ha chiesto
esplicitamente di «controllare tutte le procedure automatiche e renderle il più veloci possibili»:
l'audit è stato quindi **chiuso con le correzioni**.

Il dato di partenza è il tempo pareggio **reale** del job `quality` di `ci.yml`, ricavato
dall'API GitHub (run `41212641314`, 2026-10-31): **172 s**, in un **unico job** con 18 step in
sequenza.

## Cosa è stato misurato (e da dove)

| Sorgile | Dato |
|---|---|
| API GitHub, run `41212641314` | job `quality` = **172 s** (1 job, 18 step) |
| API GitHub, run `41212641340` / `41212688495` | `auto-bundle` su `push` = 20 s, su `workflow_run` = 22 s ⇒ **2 run per merge** |
| API GitHub, run `41212641429` | `auto-state-aggregate` = 38 s |
| Dev machine (Windows, `pwsh` 7.6.9, Git Bash) | profilo dei singoli script e delle suite |
| Profilo dei processi figli | `seed_repo_files` = **256 spawn per repo** = **9,5 s per repo** |

## Il risultato

| Procedura | Prima | Dopo | Δ |
|---|---:|---:|---:|
| **Tempo pareggio della pipeline CI** | **172 s** | **73 s** | **−58 %** |
| `test-bundle-check-idempotent.sh` | 53,0 s | 11,9 s | −77 % |
| `test-aggregate-determinism.sh` | 48,2 s | 39,7 s | −18 % |
| `test-issue-76-residue.sh` | 16,1 s | 11,5 s | −29 % |
| `test-post-merge.sh` | 52,4 s | 39,3 s | −25 % |
| `pwsh scripts/aggregate-state.ps1 -Check` | 1,23 s | 0,91 s | −26 % |
| `pwsh scripts/generate-bundle.ps1 -Check` | 1,37 s | 1,05 s | −23 % |
| 4 task turbo sequenziali | 52,7 s | 52,7 s | invariato — la forma parallela (32,8 s) **rompeva il gate**, vedi «Il parallelismo ha un costo» |
| `auto-bundle` per merge che tocca `docs/state/` | 2 run (20 s + 22 s) | 1 run | −22 s di latenza |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.73.1 | La **CI passa da 1 job sequenziale a 11 job** (10 in parallelo + `quality` aggregatore) | Il tempo pareggio era la **somma** di lavoro indipendente. I 18 gate restano 18, con la stessa semantica bloccante/non-bloccante: nessun gate rimosso, indebolito o reso non-bloccante |
| D.73.2 | `quality` conserva il **nome** del check ed è **fail-closed** | Senza il controllo esplicito sui risultati dei job dipendenti, `needs:` renderebbe `quality` *skipped* quando un job fallisce, e la branch protection può interpretare un check saltato come successo. Il nome invariato evita di dover cambiare la branch protection |
| D.73.3 | I **5 job di gate non installano le dipendenze npm** | `scripts/validate-*.mjs` e `scripts/check-readme-facts.mjs` usano **solo i moduli built-in di node**; le suite bash usano `git` + `bash` + `pwsh`, tutti preinstallati sui runner GitHub. Installare npm in 5 job che non ne hanno bisogno era costo puro |
| D.73.4 | I 4 task turbo restano **sequenziali**; la forma parallela (`turbo run lint typecheck test build`, 32,8 s) è stata implementata e poi **revertita** | Sul runner a 2 vCPU, `build` in concorrenza con `test` fa scadere per timeout i 2 test di integrazione del fixture `db-seed/medium.json`: è la classe del lesson 30-1, e la soglia di un test time-sensitive è un **acceptance criterion** |
| D.73.5 | Le **5 suite** che la CI non eseguiva sono **aggiunte alla CI**, dopo aver corretto i loro difetti | La procedura più distruttiva del repo (`post-merge.ps1`: `git push origin --delete`, `git branch -D`) non aveva copertura. Il project owner ha chiesto di «controllare tutte le procedure automatiche»: controllare una procedura significa che la sua verifica gira |
| D.73.6 | Il contatore degli assert delle suite in subshell passa su un **file di risultati condiviso** | I contatori in memoria di una subshell non arrivano al padre: `test-safe-branch-switch.sh` riportava «0 passati, 0 falliti» e usciva 0 **sempre** (lesson 43-1) |
| D.73.7 | Il run di `auto-bundle` su `workflow_run` viene **saltato** se l'aggregator non ha prodotto un commit | Il secondo run serve solo se l'aggregator ha committato. Il controllo è esatto (`workflow_run.head_sha` vs `origin/main`), non prudenziale. Se l'aggregator è **fallito** si rigenera comunque |
| D.73.8 | Il **typecheck duplicato**, il **doppio startup di vitest**, la **CI sui push del bot** e la **parallelizzazione interna delle suite** restano **fuori perimetro** | Sono modifiche alla *definizione* di un task o del *trigger* della CI: decisioni sul test strategy che spettano al project owner (D.71.4). Sono documentati con la misura in `12-DEVOPS.md §9.14.9` |
| D.73.9 | `git init` nelle suite dichiara **esplicitamente** il branch iniziale (`-b main`) | `init.defaultBranch` è una configurazione **di macchina**: la dev machine ha `main`, il runner GitHub ha `master`. Con `master`, `git clone` del bare repo non fa il checkout di nessun branch e `git push origin main` fallisce: il test era verde solo in locale |

## I tre difetti che la misura ha smascherato

1. **`test-safe-branch-switch.sh` era fail-open**: riportava «0 passati, 0 falliti» e usciva 0
   **sempre** (i contatori vivevano dentro subshell). Ora gli assert scrivono su un file di
   risultati condiviso: **11 assert** contati. In CI (job `gates-procedure`).
2. **`test-setup-worktree.sh` falliva su *ogni* piattaforma**, non solo su Windows — la Sessione 72
   concludeva che «su `ubuntu-latest` passerebbe», ed era **falso**: `mktemp` onora `TMPDIR` anche su
   Linux, e `cleanup_mock_env` cancellava `TMPDIR` senza ripristinarlo ⇒ lo scenario successivo
   ereditava una directory già cancellata. Corretti anche il path POSIX passato a `pwsh` (ora
   convertito con `cygpath -w`) e il mock `gh` (script bash, non eseguibile dal `pwsh` nativo su
   Windows: aggiunto un wrapper `gh.cmd`). In CI, **8 assert**.
3. **`test-appendline-lf-fix.ps1` aveva S3 stale** (pretendeva che `aggregate-state.ps1` non
   contenesse `AppendLine`: ne ha 64, e sono la forma *corretta* del fix dell'issue #58) e **S5
   mutava il working tree** (`git checkout -- docs/SESSIONS.md` + run dell'agregator). Ora S3
   verifica l'invariante reale («normalizza CRLF→LF in scrittura») e S5 gira su un **fixture
   temporaneo**. In CI.

## Il parallelismo ha un costo: il gate che misura il tempo

Una delle ottimizzazioni proposte — una **sola** invocazione `turbo run lint typecheck test build`
invece di 4 sequenziali (52,7 s → 32,8 s) — è stata implementata, **pubblicata sulla PR**, e poi
**revertita** perché sul runner **rompeva un gate**.

Il runner GitHub ha **2 vCPU**. Con i 4 task in un'unica invocazione, turbo esegue `build`
(`vite build` + `tsc`) **in concorrenza** con `test`, e il vitest riceve meno CPU: i 2 test di
integrazione del fixture `db-seed/medium.json` (5000 eventi) sono scadati con «Test timed out in
5000ms».

È **esattamente** la classe del lesson 30-1: «il test di performance misurava il **carico del
runner**, non il layer DB […] il test gira ora in una **run separata**, con la soglia dell'AC
invariata». La soglia **non** si tocca: è un acceptance criterion.

**Regola generale**: «parallelizzare» (a livello di **job**, dove i gate sono processi separati) e
«aumentare il parallelismo interno di un gate» (a livello di **task runner**, che condivide il
processore) sono due ottimizzazioni **indipendenti**, e la seconda può invalidare la prima quando
un gate è **time-sensitive**.

## Un test verde in locale non è un test verde ovunque

`test-post-merge.sh` è fallito sul runner con «error: src refspec main does not match any» **solo
su Linux**. La causa: la dev machine ha `init.defaultBranch = main` in
`C:\Program Files\Git\etc\gitconfig`, il runner GitHub ha il default di git, `master`.

La meccanica: `git init --bare` crea un bare repo con `HEAD → refs/heads/<init.defaultBranch>`;
`git clone` di quel repo, se `HEAD` punta a un branch **inesistente**, avvisa «remote HEAD refers
to nonexistent ref» e **non fa il checkout di nessun branch**; il successivo `git push origin main`
fallisce.

Correzione: **`git init -q --bare -b main`** in tutte e tre le suite che creano un bare repo
(`test-post-merge.sh`, `test-issue-76-residue.sh`, `test-setup-worktree.sh`).
`init.defaultBranch` è una configurazione **di macchina**, non del progetto.

**Regola generale**: un test che crea repository git temporanei deve dichiarare **esplicitamente**
il branch iniziale: la CI ha una configurazione git diversa da qualunque dev machine, e un test che
passa in locale non è un test che passa ovunque.

## Il costo nascosto: i processi figli

Il singolo costo più alto della sessione non era nella logica, era nel **numero di processi**.
`seed_repo_files` creava 128 stub chiamando `dirname` + `mkdir -p` + `touch` **una volta per
file**: 256 processi per repo, **9,5 s per repo**, ~38 s dei 53 s della suite. Risolto con le
**builtin** del shell (`${f%/*}` al posto di `dirname`, `: > "$f"` al posto di `touch`, `mkdir -p`
una volta per directory distinta) e con le **env var** git al posto di `git config`
(`GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `GIT_CONFIG_COUNT/KEY_n/VALUE_n`).

In PowerShell: `StringBuilder` al posto di `$bundle += ...` (O(n²) → O(n) su ~2,4 MB),
`[System.IO.File]::ReadAllText` al posto di `Get-Content -Raw`, `.Replace("`r`n","`n")` al posto
di `-replace "`r`n", "`n"` (pattern letterale ⇒ risultato identico, ma confronto ordinale invece
di scansione regex).

## Lesson learned

| # | Osservazione | Azione |
|---|--------------|--------|
| 73-1 | **Il tempo pareggio è la somma, non il massimo**: 18 gate indipendenti in un solo job costavano 172 s anche se il lavoro utile era ~89 s | `ci.yml` a 11 job; `quality` aggregatore fail-closed con il nome invariato |
| 73-2 | **Il costo più alto era nel numero di processi, non nell'algoritmo**: 256 spawn per repo = 9,5 s, e nessun profiler di linguaggio lo avrebbe mostrato | `docs/17-DEV-NOTES.md` **P13**; suite riscritte con le builtin |
| 73-3 | **Una suite che non può fallire costa anche quando non fallisce**: `test-safe-branch-switch.sh` consumava 6,7 s per niente, perché riportava «0 passati, 0 falliti» e usciva 0 sempre | Contatori su file condiviso; ora 11 assert e in CI |
| 73-4 | **L'audit precedente aveva diagnosticato la piattaforma invece del difetto**: «su `ubuntu-latest` passerebbe» era falso — `mktemp` onora `TMPDIR` su ogni OS | Il difetto era il *cleanup*; la correzione è cross-platform e la suite ora gira ovunque |
| 73-5 | **Il bundle rigenerava due volte per merge**: il secondo run (22 s) era pensato per l'ordinamento (issue #149) ma girava anche quando l'aggregator non aveva prodotto nulla | Skip esatto via `workflow_run.head_sha` vs `origin/main`; se l'aggregator è fallito si rigenera comunque |
| 73-6 | **La concatenazione con `+=` in PowerShell è O(n²)**: costruire ~2,4 MB con `$bundle += $content` ricopia l'intera stringa a ogni iterazione | `StringBuilder`; output byte-identico (SHA-256 verificato sullo stesso albero) |
| 73-7 | **Le misure vanno fatte sulla macchina e sull'ambiente giusti**: il `bash` di default su questa macchina è lo stub WSL (`bash.exe` → «non è installata una distribuzione Linux»), non Git Bash | I benchmark vanno eseguiti con `C:\Program Files\Git\bin\bash.exe`; i tempi misurati altrimenti non sono quelli del repo |
| 73-8 | **Parallelizzare i job e parallelizzare i task interni sono due cose diverse**: i 4 task turbo in un'unica invocazione facevano scadere per timeout un test time-sensitive sul runner a 2 vCPU | I 4 task restano sequenziali; il parallelismo si Decide a livello di **job** (`docs/12-DEVOPS.md §9.14.7`) |
| 73-9 | **`init.defaultBranch` è una configurazione di macchina, non del progetto**: la dev machine aveva `main`, il runner `master`, e `test-post-merge.sh` era verde solo in locale | `git init -b main` esplicito in tutte le suite che creano repository (`docs/12-DEVOPS.md §9.14.8`) |
| 73-10 | **La prima CI della PR vale come test**: la pipeline parallela ha rivelato in 90 secondi due difetti che 14 suite in locale non potevano mostrare (il timeout del test perf e il `git init` con branch implicito) | I due difetti sono corretti e riprodotti localmente simulando il runner (`init.defaultBranch=master`) |

## Documenti aggiornati

- `AGENTS.md` (v1.30 → **v1.31**): nuova sezione **§"🏎️ La CI: 11 job in parallelo"**, nota sullo
  skip del secondo run di `auto-bundle`, footer v1.31
- `docs/12-DEVOPS.md` (v1.4 → **1.5**): **§9.10** riscritta (26 gate su 11 job), **§9.13** *Chiusura
  dell'audit*, **§9.14** (nuova) *Prestazioni delle procedure automatiche* — profilo, costo dei
  processi figli, tabella dei risultati, equivalenza dimostrata, il costo del parallelismo
  (§9.14.7), il `git init` con branch implicito (§9.14.8) e ciò che non è stato fatto (§9.14.9);
  changelog 1.5
- `docs/17-DEV-NOTES.md` (v0.5 → **0.6**): **P13** (nuova) — il costo delle procedure automatiche
  è quasi sempre nei processi figli
- `docs/18-DEV-LOG.md`: **§40**
- `docs/BUNDLE.md`: rigenerato (`pwsh scripts/generate-bundle.ps1`) perché i file sopra sono in `$files`;
  `$files` += `scripts/safe-branch-switch.ps1` e `scripts/test-safe-branch-switch.sh`
- `package.json`: nuovo script `verify` (`turbo run lint && turbo run typecheck && turbo run test && turbo run build`)

## Verifica

- `pnpm run verify` → exit 0 (lint + typecheck + test + build)
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (129 file)
- `node scripts/validate-workflows.mjs .github/workflows` → exit 0
- `node scripts/check-readme-facts.mjs` → exit 0
- 14 suite di test locali → tutte exit 0 (37 + 12 + 9 + 29 + 8 + 11 + 8 + 5 assert sulle procedure,
  più le 6 suite sui workflow)
- **Equivalenza dimostrata**: il bundle generato dal generatore nuovo e da quello vecchio sullo
  stesso albero ha **SHA-256 identico**; l'aggregator nuovo e quello vecchio producono output
  identico a parità del campo mutabile (`Ultima aggregazione`)
- **Riproduzione locale dei difetti del runner**: con `init.defaultBranch=master` (il default del
  runner GitHub) le 3 suite che creano repository temporanei passano tutte e 3; senza il fix
  `test-post-merge.sh` falliva con «src refspec main does not match any»

## Link utili

- `docs/12-DEVOPS.md` §9.14 — prestazioni, profilo e misure
- `docs/12-DEVOPS.md` §9.13 — audit della copertura CI e la sua chiusura
- `docs/17-DEV-NOTES.md` P13 — il costo dei processi figli
- Sessione 72 (`72-audit-procedure-automatiche-pwsh-encoding.md`) — l'audit che questa sessione chiude
- Issue #224, #73 (parallelizzazione dei gate), #43 (lesson 43-1), #149 (ordinamento dei writer)
