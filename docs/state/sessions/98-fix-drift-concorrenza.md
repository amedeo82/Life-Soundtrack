---
number: 98
title: "Correzione dei drift di concorrenza (claim, NEXT-STEP, prosa README)"
date: 2026-11-04
state: 🟢
merged: true
merged_commit: "82c57cf33929bc471a85e17dade5675765dda54a"
merged_date: "2026-11-04T10:51:33Z"
branch: fix/302-fix-protocol-il-claim-perdente-ruba-la-l
pr: 303
claim: kilo-hp-elitebook-a7c7
tags: [docs, protocol, concurrency, claim]
---

## Sintesi

Audit del protocollo di workflow richiesto dal project owner: «controlla se la
concorrenza è gestita in modo corretto, senza che agenti paralleli lavorino
alle stesse issue perché il README riporta il blocco next story non aggiornato
fino al merge». L'audit ha **confermato la correttezza strutturale** della
coordinazione (la selezione passa dalle label live su GitHub e dal claim
atomico ADR-0006, non dal README) e ha trovato **4 drift**, tutti corretti in
questa sessione:

| # | Drift | Correzione |
|---|-------|------------|
| A | `scripts/agent-claim.ps1` rimuoveva la label `in-progress` nel ramo di riverifica persa, contro §"Procedura di claim" punto 4 («Non rimuovere la label: serve al vincitore») | lo script posta `yield:` ed esce 4 **senza** rimuovere la label; `AGENTS.md` §"Primo task" (che descriveva il comportamento errato) corretto |
| B | Il blocco `AGGREGATE-NEXT-STEP-*` del README era sul fallback «nessuna story migrata» da Sessione 87: nessuna delle 8 story rimanenti aveva un state file, e l'eccezione documentata «state file alla ratifica della spec» non era mai stata applicata al lotto della Sessione 86 | creati i file di stato di **3.3, 3.5, 4.3, 5.1, 5.2** (`todo`); il blocco indicherà la **3.3** e resterà significativo anche ai merge successivi. **4.2 e 6.1 restano senza file**: nessuna spec ratificata (P2 e post-impl, D.10.2). La **3.2** non ha bisogno di file locale: è stata mergiata (PR #301) mentre la sessione era aperta, e il suo file è già su `main` con `status: done` |
| C | La prosa del README sotto il blocco citava la coppia 3.4/4.4 come esempio vivo di dipendenza, ma la tranche geo è chiusa (Sessione 76, issue #231) | prosa riscritta: regola valida + esempio dichiarato passato + esplicitazione che il blocco **non conosce né dipendenze né claim** e che la selezione non avviene mai da lì |
| D | Il takeover di un claim scaduto (TTL 12 ore) era impossibile via script (la validazione rifiutava l'issue `in-progress`), costringendo a comandi `gh` manuali | `agent-claim.ps1 -Stale`: verifica dell'ultima attività (>12 ore: commenti che citano l'agente, PR aperta per l'issue), `stale-release:` atomico citando l'agente del claim scaduto, poi claim + riverifica; exit 5 se il claim non è ancora scaduto |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-98.1 | Il perdente della riverifica **non tocca** la label `in-progress` | La regola esisteva in `AGENTS.md` (ADR-0006, regola 4) ma lo script la violava: l'issue ricompariva "libera" e ogni contendente ripeteva validate+worktree+claim+yield a vuoto. La riverifica reggeva comunque (niente doppio lavoro), ma il rumore e il costo erano evitabili |
| D-98.2 | Il takeover dei claim stantii diventa un flag atomico (`-Stale`) | Un takeover fattibile solo con comandi `gh` manuali è la stessa occasione di dimenticanza del protocollo che la Sessione 81 ha chiuso con `agent-claim.ps1`. La verifica dell'età (>12 ore su commenti + PR aperta) rende il TTL applicabile senza giudizio a mano |
| D-98.3 | State file **solo** per le story con specifica ratificata (3.3, 3.5, 4.3, 5.1, 5.2) | L'eccezione documentata in `docs/state/_index.md` («crea il file alla ratifica della spec») serve a mantenere il blocco NEXT-STEP significativo. 4.2 (P2) e 6.1 (post-impl, D.10.2) non hanno spec: un file per loro sarebbe una promessa non lavorabile nel blocco |
| D-98.4 | La prosa del README dichiara esplicitamente che il blocco non è la fonte di selezione | La domanda del project owner («agenti che lavorano la stessa story per il blocco non aggiornato») aveva una risposta strutturale già presente (query live + claim) ma non scritta nel posto dove un lettore cerca la risposta: il README. Scrivere la regola lì chiude la classe di fraintendimento |
| D-98.5 | La sessione è la **98**, non la 97 | La Sessione 97 è stata assegnata alla Story 3.2 (PR #301) ed è finita su `main` mentre questa sessione era aperta: il numero è stato ricalcolato con la procedura di `docs/state/_index.md` §"Allocazione del numero di sessione" (massimo su `origin/main` + 1) e il file rinominato di conseguenza |
| D-98.6 | Nessun blocco `AGGREGATE-*` viene toccato nella PR | Regola V1 di ADR-0008: i blocchi si aggiornano da soli post-merge (writer unico, ADR-0013). La PR porta solo le **fonti** (file di stato, prosa legacy, protocollo) e il bundle rigenerato |

## Analisi di avanzamento

**Numeri.** Nessuna story implementata: è lavoro di **protocollo e stato**. La
percentuale resta **77%** (23 story completate su 30, effort pesato 80%, 7 step
rimanenti): la Story 3.2 è stata mergiata durante la sessione (PR #301), e le
cinque story con state file nuovo (3.3, 3.5, 4.3, 5.1, 5.2) sono tutte `todo`.

**Cosa è pronto.** La catena di coordinamento del parallelismo è **coerente
front-to-back**: selezione (query live su GitHub) → claim atomico con
riverifica deterministica (`agent-claim.ps1`, yield senza rubare la label) →
takeover dei claim stantii atomico (`-Stale`, TTL 12 ore) → macchina a stati
post-claim (ADR-0007) → writer unico post-merge (ADR-0013). Il blocco
NEXT-STEP tornerà a indicare una story reale (la 3.3) e resterà significativo
anche dopo i merge delle prossime story.

**Cosa manca.** Il merge di questa sessione (PR da aprire), e i due punti fuori
perimetro dichiarati in Sessione 96 (chiavi i18n `insight.mood.*` in stash;
post-merge cleanup dei residui della Sessione 94). Inoltre `agent-claim.ps1` e
`agent-pr.ps1` restano **senza suite di test** (sono network-bound): le
regressioni come quella dello yield sono oggi intercettabili solo dalla
riverifica stessa.

**Salute tecnica.** `scripts/agent-claim.ps1` ASCII-only (F9-bis), parsing
verificato (0 errori). Nessun blocco `AGGREGATE-*` toccato a mano: le fonti sono
state file e prosa legacy; bundle rigenerato dopo l'aggregator (ordine
aggregator → bundle).

**Gate di testabilità (comandi).** `node scripts/check-protocol-consistency.mjs`
→ 6 check · `node scripts/check-aggregate-blocks.mjs --base origin/main --head HEAD`
→ 0 violazioni · `node scripts/check-encoding.mjs` → 0 errori ·
`node scripts/check-readme-facts.mjs` → 15 check · `node scripts/check-merge-state.mjs`
→ confronti · `pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Uno script che implementa una regola può **contraddirla** se nessun test lo esercita | Lo yield di `agent-claim.ps1` rimuoveva la label che §"Procedura di claim" ordina di preservare: la regola era scritta due volte (ADR-0006 + AGENTS.md) e nessuna delle due copie veniva eseguita |
| Il fallback del blocco NEXT-STEP non è una anomalia: è il **sintomo** di state file mancanti | Il fallback era «corretto» (lo dichiarava anche il backlog), ma persistente dal 2026-11-02: l'eccezione «file alla ratifica della spec» andava applicata al lotto S86 e non lo fu |
| La prosa che spiega un blocco auto-generato **invecchia più veloce del blocco** | L'esempio 3.4/4.4 era vero alla Sessione 73 ed è morto alla 76: gli esempi vivi nella prosa vanno marcati come tali o sostituiti da regole |
| Il **numero di sessione** va ricalcolato al rebase, non fissato all'inizio | La 97 è stata presa dalla Story 3.2 durante la sessione: il file rinominato (98) e i riferimenti corretti sono l'unica forma di difesa — `aggregate-state.ps1` segnalerebbe il duplicato solo dopo il merge |
| Un `main` locale stale fa scrivere **prosa di stato sbagliata** | Il blocco PROGRESS locale contava la 3.2 come «in corso» mentre su `main` era già `done`: la working copy principale va allineata con `origin/main` prima di qualunque lavoro di stato |

## Documenti aggiornati

- `scripts/agent-claim.ps1`: yield senza rimozione label + modalità `-Stale` (TTL takeover) + exit code 5 documentato
- `AGENTS.md` **v1.45**: §"Primo task" (yield corretto + `-Stale`), §"Mantenere il claim" (invocazione `-Stale`), versione
- `docs/INDEX.md`: riga `../AGENTS.md` a v1.45 (gate C1)
- `docs/18-DEV-LOG.md`: changelog del protocollo v1.45
- `README.md`: prosa sotto il blocco NEXT-STEP (dipendenze + claim, selezione mai dal blocco)
- `docs/state/stories/`: nuovi `3.3-esplora-analisi.md`, `3.5-anteprima-onboarding-demo.md`, `4.3-artwork-enrichment.md`, `5.1-privacy-spec-finale.md`, `5.2-export-purge.md` (`todo`)
- `scripts/generate-bundle.ps1`: i 6 nuovi file di stato registrati in `$files` (stato del bundle = contenuto dei file in elenco)
- `docs/BUNDLE.md`: rigenerato dopo l'aggregator (ordine aggregator → bundle)
- `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`, `README.md`: blocchi aggregati **non** toccati (regola V1 di ADR-0008): li riscrive il writer post-merge
