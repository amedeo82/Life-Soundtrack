---
number: 81
title: "Claim atomico, apertura PR verificata e gate di coerenza claim↔issue↔branch (I2-c)"
date: 2026-11-01
state: 🟢
merged: true
merged_commit: "f6fb8c056d9f69ba196b4443c79e98040bbeaab1"
merged_date: "2026-11-01T15:56:50Z"
branch: feat/256-claim-atomico
pr: 257
claim: kilo-hp-elitebook-7f3c
tags: [devops, governance, tooling]
---

# Sessione 81 — Claim atomico, apertura PR verificata e gate di coerenza claim↔issue↔branch (I2-c)

> **Issue di tracking**: #256 (lotto I2-c dell'epic #248). **Branch**: `feat/256-claim-atomico`.
>
> Terzo lotto dell'epic #248: rende **verificabile** il protocollo di claim (ADR-0006), che
> aveva 8 regole *vincolanti* e **zero** enforcement.

## Sintesi

ADR-0006 dichiara di aver chiuso la race «due agenti sulla stessa story» prescrivendo un claim con una riverifica. Ma il claim era **solo prosa**: nessun comando lo eseguiva, nessun gate lo verificava. La sequenza reale era: lanciare `setup-worktree.ps1`, **copiare a mano** due comandi `gh` (label + commento), poi **interpretare a mano** la riverifica («vince chi ha l'ID più basso»). Tre occasioni di dimenticanza, e la conseguenza — due agenti che implementano la stessa story — non era rilevabile da nessuna parte.

Questa sessione chiude il buco con tre artefatti:

| Artefatto | Ruolo |
|-----------|-------|
| `scripts/agent-claim.ps1` | presa in carico **atomica**: validazione, worktree, label, commento, **riverifica deterministica**, file di stato; con rollback e `yield:` se si perde |
| `scripts/agent-pr.ps1` | apertura **verificata**: gate locali, una sola keyword di chiusura nuda, creazione della PR, transizione delle label, **scrittura di `pr: N` nella sessione** |
| `scripts/check-claim-state.mjs` | gate CI **bloccante**: la PR è coerente con branch, issue, keyword, stato dell'issue e claim |

Il terzo è la parte che chiude la classe di difetto, perché verifica in CI quello che prima era un promemoria: *una PR senza claim è una PR che non doveva esistere*.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-81.1 | Il claim è **una sequenza atomica** con exit code distinti (3 = già claimata, 4 = persa la riverifica) | La riverifica manuale era il punto più fragile: l'agente doveva confrontare gli ID a mano. Ora è codice: l'ID **numerico REST** più basso vince (non il `node_id` GraphQL, non `created_at`) |
| D-81.2 | In caso di perdita della riverifica: si **rimuove** la label `in-progress` e si posta `yield:` | Il claim non deve lasciare l'issue bloccata: un lose deve restituire l'issue alla pool, non tenerla in ostaggio |
| D-81.3 | Il file di stato dell'agente vive nella **directory git della worktree**, non nel working tree | Così non è un file untracked (non confonde l'hook `pre-commit`), non serve `.gitignore`, e sparisce con la worktree |
| D-81.4 | `agent-pr.ps1` **scrive `pr: N` nel file di sessione e lo pusha** | La precondizione del workflow `auto-session-merge-state.yml` (un file di sessione che dichiari `pr: <N>`) era fragile: l'ho fatta fallire due volte in due merge (Sessione 80, issue #254). Ora è **automatico** e non può dimenticarsi |
| D-81.5 | `agent-pr.ps1` verifica i gate locali **prima** di aprire la PR | La checklist della PR era 22 voci manuali: la parte che si può automatizzare (gate locali, keyword di chiusura, transizione label) non deve dipendere dalla memoria dell'agente |
| D-81.6 | Una **branch `docs/*` tocca solo file sotto `docs/`** (gate C4) | Nel merge della PR #249 due script di un altro task erano finiti in una PR di doc-sync: un `git add -A` nella working copy condivisa aveva preso i file non tracciati. Il gate rende la classe impossibile, non solo sgradita |
| D-81.7 | Il gate è **read-only** e non scrive su GitHub | Un gate che modifica lo stato è un secondo scrittore: la stessa lezione di ADR-0008 e di ADR-0003 (i due writer di `main`) |
| D-81.8 | Il gate accetta i dati da **file JSON** (`--pr-json` ecc.) oltre che da `gh` | Un mock `gh` in bash non è eseguibile su Windows senza estensione, e il PATH finirebbe per chiamare il `gh` vero: i test devono essere identici su Windows e Linux |
| D-81.9 | Su una PR **chiusa o mergiata** il gate non si applica | Lo stato dell'issue cambia al merge (`status:done`): il gate vale per le PR aperte |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **75%** (21 story completate su 28, effort pesato 77%), restano **7 step** (3.2 Ricordi + Share · 3.3 Esplora + Analisi · 4.2 MusicBrainz lookup · 4.3 Artwork enrichment · 5.1 Privacy spec finale · 5.2 Export e purge · 6.1 Upgrade toolchain). Lavoro di **governance** su un'epic (#248), non story di backlog.

**Il numero che conta.** Il protocollo agenti passa da **2** gate (Sessione 80) a **3**, e per la prima volta il **claim** è verificato: `in-progress`, `claim:` e `status:in-review` non sono più solo parole in un file, sono condizioni che un gate blocca. Con il lotto I3 la ristrutturazione di `AGENTS.md` potrà procedere perché ogni riferimento interno è sotto gate.

**Cosa è pronto.** I due script (`agent-claim.ps1`, `agent-pr.ps1`), il gate (`check-claim-state.mjs`) con **11 scenari** di test (T1..T11, uno per controllo più il caso non applicabile), il wiring CI (2 step nel job `gates-protocol`), la sezione §"✅ Il contratto del protocollo" aggiornata con la riga del gate del claim, e la procedura di §"🌳 Worktree workflow" che indica i due comandi.

**Cosa manca.** Il lotto **I3** (rifinitura di `AGENTS.md` a ~400 righe con 77 anchor invariati — il gate C4 di `check-protocol-consistency.mjs` ne è la rete di sicurezza) e l'issue **#251** (la catena post-merge si annulla da sola: il concurrency group `post-merge-main` *cancella* i run in attesa invece di accodarli; e il workflow `auto-session-merge-state.yml` fallisce quando la PR non ha un file di sessione).

**Salute tecnica.** Worktree attiva su `feat/256-claim-atomico`. Claim riverificato sull'issue #256 (commento `6560178971`, unico claim). Nessun blocco `AGGREGATE-*` modificato a mano. `pwsh` 7.6.9.

**Gate di testabilità.** `node scripts/check-claim-state.mjs` → 0 violazioni · `bash scripts/test-claim-state.sh` → 11 scenari, 0 falliti · `node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti · `node scripts/check-aggregate-blocks.mjs` → 0 violazioni · `node scripts/check-merge-state.mjs` → 0 falliti · `pwsh scripts/generate-bundle.ps1 -Check` → exit 0 · `node scripts/validate-workflows.mjs .github/workflows` → 0 falliti.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Il test con il **mock `gh` in bash** non girava: su Windows un file senza estensione non è eseguibile, e `execFileSync` trovava il `gh` vero nel PATH → il test passava sui dati reali del repository | Il gate accetta i dati da **file JSON**: i test sono identici su Windows e Linux e non dipendono da come il sistema operativo risolve un eseguibile. *Un test che non può fallire è peggio di nessun test: dà una falsa garanzia* |
| La precondizione `pr: N` del workflow post-merge è fallita **due volte** in due merge (Sessione 80 e issue #254): entrambe le volte per un `pr: 0` | La verifica non va delegata a chi deve ricordarsi di scrivere un campo: va **fatta dall'azione stessa**. `agent-pr.ps1` scrive `pr: N` e lo pusha — il campo non può più mancare |
| Il claim manuale era una catena di **tre** occasioni di dimenticanza (comando, comando, interpretazione) | Ogni occasione di dimenticanza è un bug in attesa. La sequenza va resa **atomica** e il suo esito **verificabile**, non affidata alla memoria |
| Il leak della PR #250 (file di un altro task in una PR di doc-sync) è nato da una causa **meccanica**, non da distrazione: `git add -A` in una working copy condivisa | La prevenzione non è «stai attento»: è una **regola verificabile**. La regola «una branch `docs/*` tocca solo `docs/`» è banale da verificare e chiude la classe |

## Documenti aggiornati

- `scripts/agent-claim.ps1` (nuovo) · `scripts/agent-pr.ps1` (nuovo) · `scripts/check-claim-state.mjs` (nuovo) · `scripts/test-claim-state.sh` (nuovo)
- `.github/workflows/ci.yml`: 2 step nel job `gates-protocol` (claim gate + suite)
- `AGENTS.md` v1.35 → v1.36: la riga del gate del claim nella tabella del contratto, la procedura di worktree/claim/PR con i due comandi
- `docs/12-DEVOPS.md §9.10`: catalogo dei gate (13 job, 33 step)
- `docs/18-DEV-LOG.md` §47
- `scripts/generate-bundle.ps1`: `$files` += i 4 nuovi script + la sessione 81
- `docs/INDEX.md`: versione di `AGENTS.md`, riga `18-DEV-LOG.md`
