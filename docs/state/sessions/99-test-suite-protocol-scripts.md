---
number: 99
title: "Spec delle suite di test offline per gli script di protocollo (ADR-0014)"
date: 2026-11-04
state: 🟡
merged: false
branch: feat/304-test-suite-protocol-scripts
pr: 0
claim: kilo-amedeovecchiemilcoms-304a
tags: [protocol, testing, ci, devops]
---

## Sintesi

L'issue **#304** chiedeva due suite di test per gli script di protocollo che
parlano con GitHub (`scripts/agent-claim.ps1`, `scripts/agent-pr.ps1`) e non
ne avevano alcuna: la regressione **#302** — il ramo di riverifica persa che
rimuoveva la label `in-progress`, contro ADR-0006 regola 4 — era passata in
`main` con la CI verde, perché la regola era scritta due volte (ADR-0006 e
`AGENTS.md`) e **nessuna delle due copie veniva eseguita**.

L'issue era bloccata (`needs-spec`) su due punti: la strategia di mock e
l'inventario delle funzioni da coprire. Il project owner ha ratificato in
questa sessione la strategia (**mock di `gh` a livello di PATH, offline**) e ha
chiesto che la spec scritta fosse approvata **prima** dell'implementazione.

Questa sessione scrive dunque la **spec**, non il codice:
[`docs/13-ADR/0014-test-suite-protocol-scripts.md`](../13-ADR/0014-test-suite-protocol-scripts.md)
(🟡 DRAFT) fissa il contratto del mock (le 9 invocazioni intercettate, lo
stato iniettato, l'orologio deterministico), l'inventario dei casi per i due
script (T1..T7 per il claim, T1..T7 per la PR) e il piano di implementazione.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-99.1 | Il mock di `gh` è **un eseguibile sul PATH, offline e stateful** | è l'unica strategia compatibile con l'AC «senza rete e senza dipendenze native di `gh`»; è il pattern già in uso e collaudato in `test-setup-worktree.sh` e `test-agent-pr.sh` |
| D-99.2 | Il mock è **stateful** (stato su JSON) e registra ogni invocazione | la riverifica deve vedere il commento appena postato; le asserzioni devono poter verificare *quali* comandi sono stati eseguiti (es. «nessuna `--remove-label`»), non solo lo stato finale |
| D-99.3 | L'orologio del mock è **iniettato** (`created_at` derivato da un `now` nello stato) | i casi di TTL diventano deterministici: nessun test dipende dall'orologio della macchina (la classe di difetto reso flaky dal test `T3` dell'agregator, issue #142) |
| D-99.4 | Il mock **fallisce su ogni invocazione non prevista** (exit 1 con messaggio) | un mock che risponde `exit 0` a tutto può mascherare una chiamata non prevista: lo stesso principio del gate «un gate che passa sempre non è un gate» (lesson 43-1) |
| D-99.5 | Un **file solo** per il mock (`scripts/mock/gh.ps1`), con i launcher generati dal driver | due copie divergono: è la classe di drift che il repository ha già imparato a costo |
| D-99.6 | La copertura è per **comportamento osservabile** (exit code, chiamate a `gh`, file prodotti), non per riga | un refactor interno degli script non deve rompere la suite; un cambio di comportamento sì |
| D-99.7 | Le suite girano nel job `gates-procedure` di `ci.yml` | il job è già nell'elenco `needs:` dell'aggregatore `quality`, che è fail-closed: una suite che fallisce rende la PR rossa |
| D-99.8 | L'ADR-0014 resta **🟡 DRAFT** finché il project owner non lo ratifica | il protocollo riserva al project owner le decisioni sulla strategia di test; l'ADR-0012 (contratto del protocollo) impone che la regola e il gate nascano nello stesso commit |

## Analisi di avanzamento

**Numeri.** Nessuna story implementata: è lavoro di **protocollo e test**. La
percentuale di avanzamento resta **77%** (23 story completate su 30, effort
pesato 80%, 7 step rimanenti): nessuna state file di story è stata creata o
modificata in questa sessione.

**Cosa è pronto.** La specifica della copertura mancante è scritta e verificabile:
il mock (cosa intercetta, come muta lo stato, come fallisce su una chiamata
non prevista), i casi per entrambi gli script (con l'expected e l'exit code),
il wiring in CI e il mapping con gli AC dell'issue. La issue #304 è passata da
`needs-spec` a `agent-ready` (la strategia è stata ratificata dal project
owner) ed è claimata.

**Cosa manca.** La ratifica dell'ADR-0014 (🟡 → 🟢) e quindi l'implementazione:
`scripts/mock/gh.ps1`, `scripts/test-agent-claim.sh`, l'estensione di
`scripts/test-agent-pr.sh`, i due step in `gates-procedure`, la riga nella
tabella regola ⟺ gate di `AGENTS.md` (che richiede il bump di versione in
`AGENTS.md` e `docs/INDEX.md`, gate C1) e l'aggiornamento di §9.10 e §9.13 di
`docs/12-DEVOPS.md`.

**Salute tecnica.** Nessun blocco `AGGREGATE-*` toccato a mano: le fonti sono
il file di sessione e la prosa legacy (`docs/INDEX.md`, `docs/12-DEVOPS.md`).
Il bundle è stato rigenerato dopo l'aggregator (ordine aggregator → bundle).

**Gate di testabilità (comandi).** `node scripts/check-protocol-consistency.mjs`
→ 6 check, 0 falliti · `node scripts/check-encoding.mjs` → 0 errori ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (192 file) ·
`node scripts/check-aggregate-blocks.mjs --base origin/main --head HEAD` → 0
violazioni (i blocchi `AGGREGATE-*` **non** sono stati toccati a mano: li
riscrive il writer post-merge, ADR-0008 V1) · `pwsh scripts/aggregate-state.ps1
-Check` → **exit 1 atteso**: il nuovo file di sessione cambia i blocchi
aggregati, che per contratto vengono applicati dal writer post-merge (gate
warning-only in CI, come per la Sessione 98).

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Una issue `needs-spec` può essere sbloccata da una **decisione del project owner presa in sessione**, non solo da un documento già scritto | la spec si scrive *dopo* la decisione strategica e ne formalizza i contenuti: il rischio è invertire l'ordine e scrivere una spec che il project owner non voleva |
| «Lo script implementa una regola» non basta: senza un test, lo script può **contraddirla** in silenzio | la regola del claim (label `in-progress` conservata) era in ADR-0006 e in `AGENTS.md`; nessuna delle due copie era eseguita (#302) |
| Un mock che risponde `exit 0` a tutto è un **mock che può mascare** una chiamata non prevista | il mock fallisce su ogni invocazione fuori contratto: l'errore è visibile nel momento in cui gli script crescono |
| I casi di TTL sono deterministici solo se l'orologio è iniettato | un test che usa `Get-Date` è flaky per costruzione (lezione dell'aggregator, issue #142): il `now` sta nello stato del mock |
| Verificare *quali* comandi sono stati eseguiti è più forte che verificare lo stato finale | «la label `in-progress` c'è» non distingue «conservata» da «rimossa e riapplicata»: il log delle invocazioni lo distingue |

## Documenti aggiornati

- `docs/13-ADR/0014-test-suite-protocol-scripts.md` (nuovo, 🟡 DRAFT): la spec
  della copertura di test offline degli script di protocollo
- `docs/INDEX.md`: riga `13-ADR/` (ADR-0013 e 0014) e conteggio degli ADR nella
  sezione legacy «Dettaglio»
- `docs/12-DEVOPS.md`: §9.13 — nuova sottosezione «Copertura degli script di
  protocollo (`agent-claim.ps1`, `agent-pr.ps1`)» con il rimando all'ADR-0014
- `scripts/generate-bundle.ps1`: `docs/13-ADR/0014-test-suite-protocol-scripts.md`
  registrato in `$files`
- `docs/BUNDLE.md`: rigenerato dopo l'aggregator (ordine aggregator → bundle)
- `docs/state/sessions/99-test-suite-protocol-scripts.md` (questo file)
