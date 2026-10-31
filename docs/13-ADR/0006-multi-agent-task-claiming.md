# ADR-0006 — Presa in carico delle story (task claiming) per agenti paralleli

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 18 (2026-10-17)
> Decisioni approvate dal project owner in sessione interattiva (meccanismo, TTL, documentazione).

## Contesto

Il workflow del progetto prevede che più coding agenti (Claude Code, Cursor, Copilot, Kilo, …) lavorino in parallelo sulle issue `agent-ready`. Fino alla Sessione 17 la selezione del lavoro era **deterministica e non coordinata**:

- `AGENTS.md` §"Primo task di un agente" diceva: *"Cerca la prima story ⬚ TODO con label `agent-ready`"*
- `11-BACKLOG.md` §"Priorità di lavorazione per agenti" fissava un ordine unico di lavorazione

Conseguenza strutturale: N agenti lanciati in parallelo seguivano tutti lo stesso percorso e convergevano **tutti sulla stessa story**, duplicando l'implementazione. La race condition ha quattro cause, tutte nella documentazione e nessuna nel comportamento dei singoli agenti:

1. Nessun segnale condiviso di "presa in carico" visibile al momento della selezione (le issue non avevano né assignee né label di stato)
2. Nessuna operazione atomica di claim
3. Lo stato delle story nei documenti (`11-BACKLOG`) si aggiorna solo al merge: per tutta la durata del volo di una story, la fotografia è stantia
4. Nessuna istruzione di verificare claim altrui (nemmeno l'esistenza di un branch remoto era un segnale interpretato)

## Decisione

Adottiamo un protocollo di **self-claim su GitHub Issues**, con le seguenti regole vincolanti:

1. **Nessun agente lavora una story senza claim valido.** Il claim è il primo gesto operativo, prima di leggere la spec dettagliata e creare il branch.
2. **Il claim è composto da**: label `in-progress` sull'issue **+** commento di claim che inizia con `claim:` e contiene l'identificativo univoco dell'agente (`<tool>-<hostname>-<random>`).
3. **Discriminatore del vincitore**: in caso di claim concorrenti sulla stessa issue, vince il commento di claim con **ID GitHub più basso** (pubblicato per primo). Gli ID dei commenti sono monotonici e forniscono un ordine totale deterministico.
4. **Riverifica obbligatoria**: dopo il claim, l'agente scarica i commenti di claim e verifica di aver vinto. Chi perde lascia un commento `yield:` e **passa alla prossima issue candidabile** (cascata secondo l'ordine di priorità del backlog). Non rimuove la label: serve al vincitore.
5. **TTL del claim: 12 ore.** Un claim senza attività (commit pushato, PR aperta, commento di progresso) per 12 ore è considerato abbandonato. Qualsiasi agente può dichiararlo stantio con un commento `stale-release:` e prendere possesso con la procedura di claim normale.
6. **Rilascio obbligatorio**: al merge o rifiuto della PR, in caso di abbandono, o se la spec collegata torna 🟡 DRAFT. Rilascio = commento `release:` + rimozione della label `in-progress`. Mai lasciare claim orfani: sono falsi blocchi che solo il TTL può pulire.
7. **Assegnazione esplicita** (opzionale, complementare): il project owner può indicare la issue nell'initial prompt dell'agente (es. worktree Agent Manager dedicato). L'agente esegue comunque claim + riverifica, così la presa in carico resta visibile agli altri agenti.
8. **Un agente = una story alla volta.** Nessun claim multiplo simultaneo.

La procedura operativa con i comandi `gh` è normata in `AGENTS.md` §"🎫 Presa in carico delle story (claim)"; questo ADR ne fissa le regole e la loro motivazione.

### Perché il discriminatore non è l'assignee

Gli agenti di sviluppo condividono **lo stesso PAT del project owner** (AGENTS.md §Handoff): `@me` risolve allo stesso utente GitHub per tutti. Due agenti che si autoassegnano produrrebbero un solo assignee e nessun conflitto rilevabile — l'assignee non discrimina. Per questo il discriminatore è il **commento di claim** (con ID agente nel corpo), ordinato dall'ID commento GitHub. Il protocollo funziona identico con identità GitHub distinte o condivise.

## Alternative considerate

- **Assegnazione esplicita del project owner (sola)**: race eliminata per costruzione, ma richiede che ogni lancio specifichi la issue. Scartata come meccanismo *primario* perché il project owner lancia agenti con prompt generici ("procedi col prossimo step previsto"): la disambiguazione deve avvenire dentro il protocollo. Resta come opzione (regola 7).
- **Assignee GitHub come claim**: scartata — vedi §"Perché il discriminatore non è l'assignee".
- **Lock via branch push** (push del branch `feat/<issue>-…` come mutex: il secondo push riceve reject non-fast-forward): atomico davvero e compatibile con PAT `contents`-only, ma genera branch-spazzatura da claim falliti e abbandonati, richiede regole di pulizia dedicate, e il claim non sarebbe visibile nella UI delle issue. Scartata; il branch resta un segnale secondario (un branch orfano su issue non claimata va segnalato, non interpretato come lock).
- **Board file nel repo** (`CLAIMS.md` versionato su `main`): richiede commit (e review/merge) per claimare, sporca `git status` (che il protocollo vuole pulito agli handoff), e crea conflitti tra worktree. Scartata.

## Conseguenze attese

- **Positive**: la selezione del lavoro è disambiguata per costruzione anche con prompt generici; il claim è visibile nella UI GitHub (label + commenti) senza toccare `main`; la cascata distribuisce gli agenti su story diverse automaticamente; il TTL 12h recupera i claim di agenti morti; la stessa issue mantiene lo storico completo di claim/yield/release (audit trail).
- **Negative**: finestra di race residua (secondi) tra il controllo delle candidate e la riverifica — chiusa deterministicamente dalla regola dell'ID commento più basso; richiede lo scope PAT `issues: read/write` per gli agenti di sviluppo; richiede che gli agenti seguano la procedura alla lettera (da qui la normativa in `AGENTS.md`, primo file letto).
- **Mitigazioni**: la procedura è il passo 1 del "Primo task di un agente"; il check `-Check` del bundle non è toccato; nessun impatto su codice o schema dati.

## Riferimenti

- `AGENTS.md` §"🎫 Presa in carico delle story (claim)" (procedura operativa, comandi `gh`)
- `AGENTS.md` §"🚀 Primo task di un agente" (claim-first)
- `docs/11-BACKLOG.md` §"Priorità di lavorazione per agenti" (ordine di tentativo + regola claim-first) e §"Stato di una Story" (🟡 = `in-progress`)
- Issue #11 (accettazione di questo ADR), Sessione 18 in `docs/SESSIONS.md`

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 18 (2026-10-17) | Primo rilascio: self-claim via label `in-progress` + commento `claim:`, vince l'ID commento più basso, riverifica obbligatoria, cascata per priorità, TTL 12h, rilascio obbligatorio, assegnazione esplicita opzionale |
