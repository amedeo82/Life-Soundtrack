---
number: 44
title: "ci.yml non esegue piu' nessun job: `metadata: read` non e' una scope dichiarabile (issue #135)"
date: 2026-10-22
state: 🟢
merged: false
merged_commit: ""
merged_date: ""
branch: fix/135-ci-permissions-metadata-scope
pr: 138
claim: kilo-HP-ELITEBOOK-f0mj
cross_refs: [120, 136, 73, 63, 86]
tags: [devops, ci, bug, blocker]
---

# Sessione 44 — `ci.yml` non eseguiva più alcun job (issue #135)

## Sintesi

Dal `2026-10-21T16:21:35Z` al merge di PR #138, ogni run di `ci.yml` è stata
creata e ha chiuso `failure` **in 0 secondi con 0 job**: nessun log, nessuna
annotazione, nessuna unità di lavoro. Tutti i gate bloccanti del repository
erano fuori esecuzione — `lint`/`typecheck`/`test`/`build`, i due check `-Check`
del bundle e dell'aggregator, il validatore dei workflow, il gate di copertura
`git add` vs `$targets`, il test dei residui post-merge, il check delle label.

La causa era **una riga**: `metadata: read` nel blocco `permissions:` del job
`quality` (commit `43d982d`, introdotto per la issue #120). `metadata` **non è
una scope dichiarabile** della `GITHUB_TOKEN`: è sempre concessa implicitamente
e non è fra le scope elencate in "Workflow syntax for GitHub Actions" →
`permissions`. GitHub risponde `Unexpected value 'metadata'` e **rifiuta
l'intero file in fase di validazione**.

Il punto che rende questa classe di bug insidiosa è che il fallimento non
produce un job che fallisce: produce un workflow che non parte.

## Trigger

Domanda del project owner: «il problema potrebbe derivare dal fatto che il mio
account GitHub è gratuito, con utilizzo limitato di risorse e servizi?».

L'ipotesi era **plausibile** — il repository è privato e l'account è su GitHub
Free — ma **falsa**, e la verifica ha prodotto la diagnosi.

## Diagnosi: perché non era il billing

La firma (run creata → 0 job → fallimento immediato) è condivisa da almeno tre
cause: quota esaurita, blocco di pagamento, rifiuto del file in validazione.
Il discriminante è **transversale**: negli stessi minuti, sugli stessi runner e
sullo stesso account, gli altri cinque workflow del repository andavano verdi.

| Workflow | Ultimo run verde | Stato |
|----------|------------------|-------|
| `auto-bundle` | `2026-10-22T13:41:28Z` (success) | ✅ |
| `auto-state-aggregate` | `2026-10-22T13:41:27Z` (success) | ✅ |
| `auto-status-done` | `2026-10-22T13:41:26Z` (success) | ✅ |
| `auto-branch-cleanup` | `2026-10-22T13:41:26Z` (success) | ✅ |
| `stale-claim-sweeper` | attivo, `state: active` | ✅ |
| **`ci.yml`** | `2026-10-21T15:14:18Z` | ❌ **solo questo** |

Una quota esaurita o un blocco di billing fermano **tutti** i workflow del
proprietario del repository, non uno. Inoltre i run falliti non hanno consumato
minuti: 0 job avviati significa 0 minuti addebitati, quindi la quota non si è
avvicinata nemmeno al limite durante le 22 ore di blackout.

Il dato che ha chiuso la diagnosi è la tabella `jobs` × `conclusion` dei 60 run di
`ci.yml`:

| Run | Timestamp | `conclusion` | `jobs` |
|-----|-----------|--------------|--------|
| merge PR #103 | `2026-10-21T13:41:17Z` | success | 1 |
| merge PR #111 | `2026-10-21T15:16:34Z` | failure | 1 |
| merge PR #119 | `2026-10-21T16:17:23Z` | failure | **1** (gate `validate-labels`, exit 2) |
| commit `43d982d` | `2026-10-21T16:21:35Z` | failure | **0** ← rottura |
| merge PR #121 | `2026-10-21T16:22:55Z` | failure | 0 |
| … 40 run successivi | fino a `2026-10-22T14:44:30Z` | failure | 0 |

Il salto `jobs: 1 → jobs: 0` cade esattamente sul commit che introduce
`metadata: read`. Prima di quel commit i fallimenti erano **fallimenti veri**
(un gate che esce 2, con log e con job): la confusione è nata perché la issue
#135 li leggeva come un unico fenomeno. La verifica con
`gh run view` (`This run likely failed because of a workflow file issue`) e la
conferma che `ci.yml` era l'unico workflow con quella scope chiudono il caso.

## Perché nessun controllo esistente lo vedeva

| Controllo | Perché passa |
|-----------|--------------|
| Parser YAML (`js-yaml`, `actionlint`) | `metadata: read` è **sintatticamente lecito**. È la *schema* GitHub a rifiutare la chiave, non la sintassi |
| `GET /actions/workflows/ci.yml` | Risponde `state: active`: la registrazione è valida, solo l'esecuzione è rifiutata |
| Check-suite GitHub | Esiste e finisce `completed`/`failure`, ma contiene **0 check-run**: non c'è nulla a cui attaccare un'annotazione |
| `gh pr checks` | Mostra solo GitGuardian e i check esterni: un gate che non produce job è **indistinguibile da un gate verde** |
| `validate-workflows.mjs` (#73) | Fino a Sessione 43 validava solo la sintassi JS dei blocchi `script:` |

Quinto elemento, il più importante: **l'errore di validazione non è esposto da
nessun endpoint REST**. Non esiste un'API che restituisca l'annotazione di un
workflow rifiutato, perché non esiste un check-run. L'unica lettura possibile è
`gh run view`, che restituisce un banner generico.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.44.1 | Fix di **una riga** (`metadata: read` rimossa), non di un rollback del commit `43d982d` | `43d982d` risolveva la #120 (`gh label list` senza `GH_TOKEN`): la sua impostazione `issues: read` + `env: GH_TOKEN` è corretta e va conservata. Solo la riga `metadata` era spuria — e non serviva a nulla, perché `metadata` è già concessa |
| D.44.2 | Gate nello **stesso file** che già è bloccante in CI (`validate-workflows.mjs`) | Coerente con D.43.2: nessuna nuova dipendenza, nessun nuovo script che un agente possa dimenticare di eseguire. Il validatore è già cablato come step di `ci.yml` dal #73 |
| D.44.3 | Validazione per **whitelist** di scope, non per pattern o lista nera | Una lista nera (`metadata`) coprirebbe solo il bug noto. La whitelist elenca le 17 scope documentate: cattura anche il typo (`issue: read` invece di `issues: read`), che è la regressione più probale |
| D.44.4 | Forme compatte `{}` / `read-all` / `write-all` **accettate** esplicitamente | Un gate che segnala anche le forme valide diventa un falso positivo bloccante, e un gate urlabile viene bypassato. Il test T4 copre esplicitamente questo caso |
| D.44.5 | Test di regressione con **5 scenari**, non 4 | T2 (bug), T3 (valore), T4 (falsi positivi sulle forme brevi), T5 (typo): T4 e T5 non servono a dimostrare che il gate «cattura» il bug — servono a dimostrare che non rumora. Un gate che blocca per forme valide viene disattivato al primo falso positivo |
| D.44.6 | Elenco autorevole dei gate in `12-DEVOPS.md` §9.10 | Acceptance criterion della #135 ("i gate elencati corrispondano a quelli effettivamente in `ci.yml`"). §2.1 mostrava uno YAML di progetto con `codecov` e `upload-artifact` inesistenti: dichiararlo esplicitamente uno scheleto è più onesto e meno invasivo che riscriverlo |

## Difetti trovati lungo il percorso

**La issue #135 attribuiva il fallimento a 43 run consecutivi a 0s.** I run da
`15:16:34Z` a `16:17:23Z` avevano invece **1 job** e un fallimento reale (il gate
`validate-labels`, che la #120 correggeva). La finestra del blackout è di 22 ore
e 40 run, non 43: il conteggio includeva i fallimenti legittimi precedenti. Il
"sospetto primario" era corretto nel merito (è `43d982d`) ma la misura era
sovrastimata, perché i due fenomeni erano stati fusi in uno.

**Il messaggio di default del token citava `Metadata: read`.** Il commento
nell'originale `permissions` elencava `Contents: read`, `Metadata: read`,
`Packages: read` come scope *di default*: la descrizione era corretta (il default
le concede) ma leggerne una riga sotto il blocco `permissions:` ha reso
`metadata` una chiave che sembrava dover essere ripetuta. Il commento è stato
riscritto per nominare la trappola invece di repeating.

**Il blocco `permissions` di `auto-bundle.yml` è `contents: write  # commento`.**
Il primo prototipo del gate lo ignorava: la riga con commento in coda non
matchava `scope: valore`. Tutte le scope di quel file sarebbero state silenziosamente
saltate — cioè il gate sarebbe passato senza verificare niente, il fall-open peggiore
(lesson 43-2). Il pattern accetta ora `(?: #.*)?$` in coda, e T1 verifica il
conteggio di scope effettivamente controllate (9 su 6 blocchi).

## Verifica

- `node scripts/validate-workflows.mjs .github/workflows` → exit 0, 9 scope verificate in 6 blocchi
- `bash scripts/test-workflow-permission-scopes.sh` → **15/15** (T1 reale, T2 reintroduzione di `metadata: read` → exit 1 con file:riga, T3 valore inesistente → exit 1, T4 `read-all` → exit 0, T5 typo di scope → exit 1)
- `bash scripts/test-workflow-git-add-coverage.sh` → 8/8 (gate #136 invariato dopo l'estensione del validatore)
- `bash scripts/test-aggregate-determinism.sh` → 30/30 (invariato: `aggregate-state.ps1` non è stato toccato)
- `bash scripts/test-issue-76-residue.sh` → 9/9 · `bash scripts/test-post-merge.sh` → 29/29 · `bash scripts/test-pre-commit-clean-check.sh` → 8/8 (invariati)
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0 su tutti e 6 i blocchi

**Test non eseguiti, e perché**: `bash scripts/test-bundle-check-idempotent.sh`
(3 passati, 4 falliti) e `bash scripts/test-setup-worktree.sh` (errore `mktemp`
annidato) falliscono **identici sul `main` della working copy principale**, senza
le modifiche di PR #138: sono limiti dell'ambiente Windows/Git Bash (PowerShell
5.1 e `mktemp` annidato), non regressioni.
`pnpm run lint` / `typecheck` / `test` / `build` non sono stati eseguiti: la
worktree non ha `node_modules` (vivono nella working copy principale) e **nessun
file applicativo è stato toccato** — PR #138 non contiene codice in `apps/` o
`packages/`.

## Lesson learned

| # | Osservazione |
|---|--------------|
| 44-1 | **Non ogni fallimento di CI è un job fallito.** Esiste una classe di errori che non produce *nessuna* unità di lavoro: il workflow viene rifiutato prima di creare i job. La firma è `run_started_at == created_at`, `jobs: 0`, e l'assenza di log. Ogni diagnosi di "Actions rotta" deve partire dal **numero di job**, non dal `conclusion` |
| 44-2 | **La firma `0 job` è ambigua per costruzione**: quota esaurita, blocco di pagamento e file rifiutato producono la stessa immagine. Il discriminante non è il singolo run, è la **trasversale**: se gli altri workflow dello stesso account e della stessa finestra sono verdi, il billing è escluso. Il controllo da fare per primo costa una query, non un'ipotesi |
| 44-3 | **Uno schema applicativo non è uno schema YAML.** `metadata: read` è YAML perfettamente valido: la chiave è lacitamente lecita e il valore pure. Solo la conoscenza della schema GitHub lo rende un errore. Per tutto ciò che GitHub valida oltre la sintassi — scope di `permissions`, chiavi di `on`, contesti disponibili in `if:` — il parser non è un controllo, è un pre-requisito |
| 44-4 | **Un gate che segnala anche le forme valide viene spento al primo falso positivo.** Da qui i casi T4 (forme compatte) e T5 (typo): non dimostrano che il gate cattura il bug, dimostrano che non rumora. Un gate rumoroso è un gate che verrà bypassato |
| 44-5 | **Un check-suite con 0 check-run non è un check che passa**: è un check che non è mai partito. La differenza è invisibile in `gh pr checks` ed è l'intera classe di danno di questa issue — 22 ore di "CI verde" dichiarato e non eseguito |
| 44-6 | Il commento che *descrive* una riga di codice può diventare l'istruzione per riprodurla. `Metadata: read` nella prosa accanto al blocco `permissions:` ha reso la scope spuria legittima a chi legge. I commenti che descrivono un default vanno tenuti separati dal codice che li esplicita |

## Documenti aggiornati

- `.github/workflows/ci.yml` — `metadata: read` rimossa, commento riscritto, step bloccante `Scope permissions: valide (issue #135)`
- `scripts/validate-workflows.mjs` — validazione scope `permissions:` + riepilogo nel footer
- `scripts/test-workflow-permission-scopes.sh` (**nuovo**) — T1..T5 con scenari positivi e negativi
- `scripts/generate-bundle.ps1` — `$files` += il nuovo test
- `docs/12-DEVOPS.md` — §9.9 (nuova), §9.10 (nuova, elenco autorevole dei 14 gate), nota in §2.1, changelog 0.5
- `AGENTS.md` — v1.22 → v1.23: i tre controlli del validatore elencati per nome, footer cumulativo
- `docs/BUNDLE.md` — rigenerato
- `docs/state/sessions/44-ci-permissions-metadata-scope.md` (**nuovo**) — questa entry

## Note operative

- Nessun blocco `<!-- AGGREGATE-* -->` modificato a mano: `docs/SESSIONS.md`,
  `docs/INDEX.md` e `docs/BUNDLE.md` sono **output** dell'agregator e del
  generatore di bundle, eseguiti in locale per lasciare i due gate `-Check` verdi
  nella stessa PR (D.21.1). L'aggregator è idempotente, quindi la run
  post-merge di `auto-state-aggregate` produrrà zero diff.
- L'issue #135 non aveva la label `agent-ready`: è un blocker aperto dal
  project owner senza passaggio dalla macchina degli stati. Aggiunta
  `agent-ready` + `in-progress` al momento del claim (assegnazione esplicita del
  Boss), poi `status:in-review` all'apertura della PR.
- Il branch è nato come `feat/135-…` perché `setup-worktree.ps1` con
  `-SkipGhCheck` deriva lo slug dal titolo dell'issue e, senza `gh`, cade sul
  default `test-issue-135`. Rinominato in `fix/135-…` subito dopo: la issue è un
  bug.
- **Il ripristino di `ci.yml` è la precondizione di tutti i gate.** Fino al merge
  di PR #138 nessun controllo bloccante del repository gira, incluse le difese
  di #70, #73, #76, #104, #110 e #136. Dopo il merge il primo run utile è quello
  di `pull_request` su PR #138.

## Cross-refs

- **#135** — il bug; chiuso da PR #138
- **#120** — il commit `43d982d` che ha introdotto `metadata: read` per risolverla (la sua impostazione `issues: read` + `GH_TOKEN` è corretta ed è conservata)
- **#73** — `validate-workflows.mjs`, il file in cui è stato cablato il gate di scope
- **#136** — Sessione 43, il gate di copertura `git add` vs `$targets`: stesso file, stessa lezione (un gate che passa sempre non è un gate)
- **#70 / #76 / #104 / #110** — gli altri gate rimasti sospesi per le 22 ore del blackout