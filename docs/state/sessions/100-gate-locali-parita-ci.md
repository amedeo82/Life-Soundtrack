---
number: 100
title: "I gate locali coprono i gate della CI: la worktree ha le dipendenze, agent-pr.ps1 verifica prima di aprire la PR (issue #306)"
date: 2026-11-04
state: 🟡
merged: false
branch: feat/306-gate-locali-parita-ci
pr: 307
claim: kilo-hp-elitebook-93a9
tags: [protocol, ci, devops, testing]
---

## Sintesi

L'issue **#306** nasce dalla diagnosi di due gate rossi sulla PR #305 (Sessione 99):
`gates-protocol` (Conventional Commits: `body-max-line-length` violato in due body di
commit) e `gates-workflows` (il test del writer post-merge falliva per un **numero di
sessione duplicato** creato dal suo stesso fixture). Entrambi i difetti erano **rilevabili
in locale, prima che la PR venisse aperta**, e nessuno dei due lo era: la batteria locale
di `agent-pr.ps1` copriva 4 controlli su 7, e l'hook `commit-msg` che doveva verificare i
messaggi di commit **saltava in silenzio** perché la worktree non aveva `node_modules`.

Questa sessione chiude il divario tra ciò che la CI verifica e ciò che l'agente vede
localmente. Tre interventi, ciascuno con il proprio test di regressione:

1. **`setup-worktree.ps1` installa le dipendenze nella worktree nuova**
   (`pnpm install --frozen-lockfile`, passo 9, `-SkipInstall` per disattivarlo). L'hook
   `commit-msg` verifica davvero Conventional Commits al momento del commit.
2. **`agent-pr.ps1` esegue i gate che la CI esegue**: Conventional Commits sul range della
   PR (`commitlint --from origin/<base> --to HEAD`), validatore dei workflow, sintassi dei
   blocchi `run:` e il test funzionale del writer post-merge. I tre esiti — fallito,
   saltato, verde — sono distinti: un gate non eseguibile viene **dichiarato**, non
   passato in silenzio.
3. **`post-merge.ps1` rende la rimozione della worktree robusta con `node_modules`**: il
   livello **L0** rimuove `node_modules` prima di `git worktree remove` (è la **causa** dei
   path > `MAX_PATH`, non una conseguenza), il livello **L4** gestisce il **residuo** post-
   «Result too large» (git ha già rimosso la registrazione: il path veniva comunque da
   `git worktree list` di questo repo, catturato prima del tentativo).

La sessione ha anche **scoperto e corretto un difetto distruttivo preesistente** in
`scripts/test-agent-pr.sh`: la `trap cleanup EXIT` rimuoveva `$TMPDIR` quando era già
stato ripristinato sul valore **originale** — la directory temporanea di sistema. Su
Windows il `rm -rf` ha cancellato la `%TEMP%` dell'utente (i file in uso resistono, il
resto no). La suite ora rimuove **solo** la directory che ha creato.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-100.1 | `setup-worktree.ps1` esegue `pnpm install --frozen-lockfile` nella worktree, e l'installazione **non è fatale** | senza `node_modules` l'hook `commit-msg` salta commitlint con un WARN ed esce 0: la convenzione Conventional Commits non veniva verificata *al momento del commit*. Un fallimento dell'installazione non deve rendere inutilizzabile la worktree |
| D-100.2 | I gate locali di `agent-pr.ps1` hanno **tre esiti**: fallito (blocca), saltato (dichiarato, non blocca), verde | un gate non eseguibile non è un gate verde: dichiararlo evita sia il falso allarme sia il falso silenzio (lesson 43-1) |
| D-100.3 | Se `pnpm` c'è ma `node_modules` manca, il gate **blocca** invece di saltare | il problema è risolvibile dall'agente in pochi secondi ed è esattamente il difetto che la worktree senza dipendenze produce: saltarlo lascerebbe passare proprio il caso che la sessione vuole chiudere |
| D-100.4 | La disponibilità di `bash` si verifica **probandolo** (`bash -c "exit 0"`), non guardando il `PATH` | su Windows `bash` può essere uno stub non funzionante (`WindowsApps`): la verifica sul `PATH` direbbe "disponibile" e il gate fallirebbe per il motivo sbagliato |
| D-100.5 | `post-merge.ps1` rimuove `node_modules` **prima** di `git worktree remove` (L0) | `node_modules` non è mai tracciato da git (è in `.gitignore`), quindi non può contenere lavoro da perdere; i suoi path sono la causa del fallimento «Result too large». Eliminare la causa a valle è più semplice e affidabile di ogni fallback long-path |
| D-100.6 | Il fallback **L4** rimuove il residuo quando il path proveniva da `git worktree list` **prima** del tentativo | è la prova che la directory residua è una worktree di questo repo. La working copy principale e i suoi antenati restano esclusi dalla guardia: la difesa non si indebolisce, si affina |
| D-100.7 | Il cleanup di `test-agent-pr.sh` rimuove **solo** `TEST_TMPDIR` | la `trap` di uscita agiva su `$TMPDIR` **originale** (= `%TEMP%` su Windows): il `rm -rf` ha cancellato la directory temporanea di sistema dell'utente |
| D-100.8 | Nessun gate **statico** dedicato ai numeri di sessione hardcodati nei test | la protezione **dinamica** è più forte: `test-post-merge-writer.sh` gira sul contenuto **reale** del repository a ogni PR e, con il numero allocato dinamicamente, non può più collidere. Un gate statico sui numeri letterali avrebbe falsi positivi sui test che costruiscono repository temporanei |
| D-100.9 | La versione del protocollo sale a **v1.46** (gate C1) | due regole nuove nella tabella regola ⟺ gate di `AGENTS.md`: la worktree con le dipendenze installate e i gate locali allineati alla CI |
| D-100.10 | Il commit del bundle in `agent-pr.ps1` porta con sé **solo** `docs/BUNDLE.md` (elenco esplicito dei path) | senza l'elenco, `git commit` committa **tutto** l'index: il file di sessione (appena modificato con `pr: N`) veniva inghiottato dal commit del bundle, il commit successivo non aveva nulla da committare e il comando usciva **1 dopo aver creato la PR** — la PR restava con `pr: 0` e il workflow post-merge non trovava il file di sessione |

## Analisi di avanzamento

**Numeri.** Nessuna story implementata: è lavoro di **protocollo e CI**. La percentuale di
avanzamento resta **77%** (23 story completate su 30, effort pesato 80%, 7 step rimanenti):
nessuna state file di story è stata creata o modificata in questa sessione.

**Cosa è pronto.** Il divario fra i gate locali e i gate della CI è chiuso: la worktree
nasce con `node_modules` (l'hook `commit-msg` smette di saltare commitlint), e
`agent-pr.ps1` verifica Conventional Commits e i gate dei workflow **prima** di aprire la
PR. Il cleanup post-merge è robusto con `node_modules` presente (L0 + L4). I test di
regressione coprono i tre script: `test-setup-worktree.sh` (11 scenari, S9..S11 nuovi),
`test-post-merge.sh` (16 scenari, T15 e T16 nuovi), `test-agent-pr.sh` (6 scenari, T3 e T4
nuovi).

**Cosa manca.** La suite offline degli script di protocollo (`agent-claim.ps1`,
`agent-pr.ps1`) è ancora quella dell'ADR-0014 (🟡 DRAFT, issue #304): i gate aggiunti qui
sono **verificati da test con mock**, non dalla suite offline col mock di `gh` su PATH. La
ratifica dell'ADR-0014 resta al project owner.

**Salute tecnica.** Nessun blocco `AGGREGATE-*` toccato a mano: le fonti sono il file di
sessione e la prosa legacy (`AGENTS.md`, `docs/INDEX.md`, `docs/12-DEVOPS.md`). Il bundle
è stato rigenerato dopo l'agregator (ordine aggregator → bundle).

**Gate di testabilità (comandi).** `node scripts/check-protocol-consistency.mjs` → 6 check,
0 falliti · `node scripts/check-encoding.mjs` → 0 errori · `pwsh scripts/generate-bundle.ps1
-Check` → exit 0 · `node scripts/check-aggregate-blocks.mjs --base origin/main --head HEAD`
→ 0 violazioni · `bash scripts/test-setup-worktree.sh` → 11/11 ·
`bash scripts/test-post-merge.sh` → 56 assert, 0 falliti ·
`bash scripts/test-agent-pr.sh` → 6/6.

## Lesson learned

| Osservazione | Conseguenza |
|-------------|-------------|
| Un gate che l'agente **non esegue** è un gate che non esiste: la convenzione Conventional Commits era "verificata" da un hook che saltava in silenzio | la regola e il gate devono stare nella stessa esecuzione: se il gate può saltare, il gate va dichiarato come saltato, non dato per passato |
| La batteria locale più stretta della CI è un difetto **architetturale**, non un caso: l'agente ha visto «gate locali verdi» e la CI ha reso la PR rossa | la batteria locale deve coprire i gate della CI; il costo (secondi) è incomparabile con il costo di due round-trip |
| Il «silenzio» di un gate non eseguibile è più pericoloso di un gate che fallisce | un fallimento dice "c'è un difetto"; un salto non dichiarato dice "tutto va bene" quando nessuno ha guardato |
| Installare le dipendenze in una worktree **cambia il terreno** della rimozione: `node_modules` introduce i path > `MAX_PATH` che facevano fallire `git worktree remove` | ogni misura ha un effetto collaterale: la prevenzione ne ha generato uno, e la correzione va progettata **insieme** alla prevenzione, non dopo |
| Un `cleanup` che rimuove `$TMPDIR` invece della directory creata dal test è un `rm -rf` sulla directory temporanea **di sistema** | i test che creano directory temporanei devono ricordare **quella** che hanno creato; la `trap` di uscita è il posto peggiore in cui fidarsi di una variabile d'ambiente |
| Un riferimento `#NNN` nel **body** di un messaggio di commit fa sì che `conventional-commits-parser` tratti tutto ciò che segue come **footer**, e commitlint segnala «footer must have leading blank line» su un messaggio corretto | nel body scrivere «la PR 305», non «la PR #305»; il titolo accetta il riferimento (`(issue #306)`). La regola è ora in AGENTS.md §"Git workflow" |
| Un `git commit` senza elenco di path committa **tutto** l'index, e in un flusso a due commit il primo si mangia il secondo | ogni commit che deve portare **un solo** file lo dichiara esplicitamente (`git commit -- <path>`): il flusso "rigenera il bundle, poi committa la sessione" produceva una PR con `pr: 0` e un exit 1 **dopo** la PR aperta |
| Il difetto più costoso non è quello che un gate intercetta, ma quello che **nessun gate guarda** | il numero di sessione hardcodato in un test era una mina armata: nessun gate lo poteva vedere, perché il difetto si manifestava solo dentro una directory temporanea |

## Documenti aggiornati

- `AGENTS.md` (v1.45 → **v1.46**): due righe nella tabella regola ⟺ gate, la sezione
  «La worktree ha le dipendenze installate», la sezione «I gate locali coprono i gate
  della CI», il parametro `-SkipInstall`, la rete di rimozione L0→L1→L2→L3→L4, i casi
  T15/T16 e la regola «nessun riferimento `#NNN` nel body dei messaggi di commit»
- `docs/INDEX.md`: versione di `AGENTS.md` (gate C1) e prosa della v1.46
- `docs/12-DEVOPS.md`: **§9.15** (nuova) «Parità fra i gate locali e i gate della CI» e
  riga 1.8 del changelog del documento
- `scripts/setup-worktree.ps1`: passo 9 (install delle dipendenze) e flag `-SkipInstall`
- `scripts/agent-pr.ps1`: batteria locale allineata alla CI (commitlint + gate dei
  workflow) con i tre esiti distinti, e il commit del bundle limitato a `docs/BUNDLE.md`
  (D-100.10)
- `scripts/post-merge.ps1`: livelli **L0** (rimozione preventiva di `node_modules`) e
  **L4** (residuo post-«Result too large»)
- `scripts/test-setup-worktree.sh`: scenari S9..S11 + mock `pnpm`
- `scripts/test-post-merge.sh`: scenari T15 e T16 + shim di `git` che deregistra
- `scripts/test-agent-pr.sh`: scenari T3, T4 e T5 + mock `pnpm`/`bash` + **correzione del
  `cleanup` distruttivo**
- `docs/state/sessions/100-gate-locali-parita-ci.md` (questo file)
