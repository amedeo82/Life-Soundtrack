---
number: 55
title: "Spec Story 1.5 — Scrobbling hub (invio, sync continua, toggle)"
date: 2026-10-27
state: 🟡
merged: false
branch: feat/164-scrobbling-hub-spec
pr: 167
claim: kilo-HP-ELITEBOOK-bmyx
cross_refs: [164, 155, 144, 145, 148]
tags: [docs, spec, adapter, privacy, phase-1]
---

# Sessione 55 — Spec Story 1.5 — Scrobbling hub (issue #164)

## Sintesi

Scrittura di `docs/20-SCROBBLING-HUB.md` v0.1 (🟡 DRAFT): la specifica del
**protocollo di scrittura** verso i hub di scrobbling, il terzo pezzo della Story 1.5
dopo il canale di lettura (Story 1.3, `03-ADAPTERS/lastfm.md` e
`03-ADAPTERS/listenbrainz.md`, entrambe 🟢 v1.0) e il contratto remoto
(ADR-0010, 🟢 v1.0).

L'issue #164 chiedeva cinque decisioni prima di scrivere la spec. La spec le
risponde tutte (D-SH.1…D-SH.10) e ne aggiunge una che l'issue non sapeva di
dover chiedere: **da dove arrivano gli eventi da scrobblare**. Una PWA non
osserva la riproduzione di altre applicazioni — non esiste un bridge "ascolto in
corso" fra il sistema operativo e una web app — quindi la prima tranche non può
essere uno scrobbling *live*: è uno **specchio fedele e idempotente dello
storico locale** verso i hub che l'utente abilita. La story, come era scritta,
presupponeva una capacità che la piattaforma non ha.

## Trigger

Issue #164 (`needs-spec`, `size:L`, `area:adapter`): la Story 1.5 era ridimensionata
in Sessione 47 a *invio scrobble + sync continua + toggle*, ma nessuno dei tre
aveva una specifica. L'AC della story dipendeva già da ADR-0010 (ratificata in
Sessione 49); mancava il lato **scrittura**, che per contratto 🟢 APPROVED
(`05-ARCHITECTURE.md` §4) richiede un ADR dedicato.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.55.1 | La spec vive in `docs/20-SCROBBLING-HUB.md`, **non** in `03-ADAPTERS/` | L'oggetto è il protocollo di scrittura verso più piattaforme; le `03-ADAPTERS` descrivono la *lettura* di una piattaforma. Numero libero: `00`…`19` occupati |
| D.55.2 | Hub della prima tranche: **Last.fm + ListenBrainz**; Maloja in Fase 2 | I due hub Tier S del perimetro; Maloja è self-hosted e ha un protocollo proprio (T1.5.3) |
| D.55.3 | `md5` in **JS puro** nel repo, nessuna dipendenza nuova (E.LF.21) | `Web Crypto` non supporta md5; una dipendenza per ~4 KB di bundle PWA è un costo sproporzionato; il repo ha già la policy "nessuna dipendenza nuova" (`03-ADAPTERS/lastfm.md` §10) |
| D.55.4 | `ScrobbleSink` **dedicato**, non un metodo su `PlatformAdapter` | `PlatformAdapter` descrive la lettura; non ogni piattaforma è un hub e un hub non è una piattaforma sorgente. La ratifica dentro `05§4` è il compito di ADR-0011 |
| D.55.5 | `ScrobbleError` separato da `AdapterError` | I codici di `AdapterError` sono orientati al parsing (`INVALID_FORMAT`, `TRUNCATED`): riusarli per un invio darebbe all'utente una remediation sbagliata — la stessa lezione che ha prodotto `SOURCE_UNREACHABLE` in ADR-0010 |
| D.55.6 | Coda in una **tabella Dexie nuova** (`scrobbleOutbox`, schema v5), chiave unica `hub\|eventKey` | `settings` è per impostazioni, non per code; l'idempotenza deve essere locale e verificabile, perché nessuna delle due API ha una chiave di deduplica lato server |
| D.55.7 | Scrittura **write-ahead**: la riga passa a `in_flight` prima della richiesta | Un crash fra la richiesta e la conferma lascia una riga `in_flight` che **non** viene ritentata in automatico: il caso residuo è un doppio scrobble dichiarato, non una perdita |
| D.55.8 | Consenso **per-hub**, default `[]`, indipendente dagli altri toggle | Ogni hub ha credenziali proprie; `09-PRIVACY-SECURITY.md` §3.3 scrive già "brano + timestamp" come l'unico contenuto inviato |
| D.55.9 | Il toggle `scrobbleHubs` va tipizzato `ScrobbleHubId[]`, non `PlatformId[]` | `maloja`/`subsonic`/`roon` non sono piattaforme sorgente (`01-PLATFORMS.md` §3.9): il tipo attuale non può rappresentarli |
| D.55.10 | Rate limit **per-hub**, nel client del sink; nessun limite condiviso | I due hub hanno limiti e semantica diversi (ADR-0010 V7); un limite globale sarebbe la media dei due. Last.fm in batch (≤ 50), ListenBrainz guidato dagli header `X-RateLimit-*` |
| D.55.11 | Su ListenBrainz si usa `listen_type: import`, non `single` | I nostri eventi sono storici (D.55.12): `single` significa "l'utente ha appena finito di ascoltare". Il limite dei 5 s per ascolto vale per i client che inviano un ascolto per richiesta: con il batch diventa irrilevante |
| D.55.12 | La prima tranche è uno **specchio dello storico locale**, non uno scrobbling live | Una PWA non osserva la riproduzione di altre app: `navigator.mediaSession` governa il media di una pagina, non quello di altre app. Il percorso live è differito (punto aperto) |
| D.55.13 | Timestamp inviato = `startedAt` in **secondi** UTC; la normalizzazione al minuto **non** si applica | D-LF.7 normalizza al minuto la *chiave di dedup* del percorso di lettura: applicarla all'invio renderebbe indistinguibili due scrobble distinti dello stesso brano in due minuti diversi |
| D.55.14 | Il proxy dell'utente (D-LF.0) è il trasporto della **scrittura** su Last.fm, ma con contratto esteso (POST con body + CORS) | L'API Last.fm non emette CORS: senza un proxy che inoltra POST la scrittura è impossibile. Molti proxy "JSON" inoltrano solo GET: va detto all'utente (E.SH.7) |

## Difetti trovati lungo il percorso

**La story descriveva una capacità che la piattaforma non ha.** "Sorgente continua
di ascolti tramite hub di scrobbling" e `01-PLATFORMS.md` §3.9 (che colloca
l'app accanto a Navidrome, Plex e Roon) presuppongono un processo che osserva la
riproduzione in tempo reale. Una web app non ha quell'accesso: non esiste un
bridge standard fra la sessione media del sistema operativo e una pagina web.
Scrivere la spec senza accorgersene avrebbe prodotto un documento che descrive
un sistema irrealizzabile — il caso peggiore per una spec: descrivere bene
qualcosa che non esiste.

**La granularità del timestamp è un artefatto, non una semantica.** La
normalizzazione al minuto (D-LF.7) serve a far convergere la chiave di dedup fra
il percorso API e quello file. Riutilizzarla per l'invio avrebbe fatto
perdere la distinzione fra due scrobble distinti dello stesso brano — la
conclusione è opposta a quella della spec Last.fm, e per la stessa ragione.

**L'ordinamento dei parametri della firma non è numerico.** `api_sig` firma i
parametri ordinati **per nome**, e i nomi sono indicizzati (`artist[10]`,
`artist[2]`): l'ordinamento lessicografico delle stringhe non coincide con
quello numerico. Su un batch da ≥ 10 scrobble la differenza produce una firma
rifiutata (errore 13) — un difetto che non si manifesta nei test con 2-3
elementi.

## Verifica

- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (dopo rigenerazione)
- `pwsh scripts/aggregate-state.ps1 -Check` → drift atteso sui blocchi aggregati
  (li rigenera `auto-state-aggregate` post-merge)
- `pnpm run lint` / `typecheck` / `test` / `build` → verdi
- `node scripts/check-readme-facts.mjs` → exit 0 (la PR non tocca le piattaforme
  importabili né le capability dichiarate)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 55-1 | **Una spec che descrive un sistema non esistente è peggio di nessuna spec**: è un documento che passa la review formale e fallisce alla prima implementazione. Il primo esercizio di una spec non è scrivere il contratto, è verificare che il sistema sia realizzabile nella piattaforma scelta |
| 55-2 | **Il backlog descrive l'intenzione, la piattaforma decide la fattibilità.** "Sorgente continua di ascolti" era la formulazione di un client nativo, copiata in una PWA senza chiedersi se la PWA può osservare la riproduzione. La domanda giusta, prima di scrivere la spec, è "da dove arriva il dato" — non "che forma ha il dato" |
| 55-3 | **Un artefatto di normalizzazione non diventa una semantica.** Il minuto (D-LF.7) è una chiave di dedup; riportarlo nel payload di invio avrebbe fatto perdere informazione. Le semantiche vanno dichiarate per il canale che le usa, non ereditate dal canale vicino |
| 55-4 | **Un limite numerico del protocollo è un test, non una nota.** `artist[10]` prima di `artist[2]` nell'ordinamento della firma: il difetto emerge solo con 10+ elementi in un lotto, cioè esattamente il caso che i test piccoli non coprono |
| 55-5 | **La coda va nel posto giusto anche quando "il posto giusto" costa una migrazione.** `settings` era l'unica tabella chiave/valore disponibile e sembrava sufficiente: ma una coda ha stato per elemento, tentativi e indice unico, e un indice unico è *la* garanzia di idempotenza. Il costo (schema Dexie v5) è una migrazione; il costo dell'alternativa è l'idempotenza non garantita |

## Documenti aggiornati

- `docs/20-SCROBBLING-HUB.md` — **nuovo**: la spec (v0.1 🟡 DRAFT)
- `docs/state/sessions/55-scrobbling-hub-spec.md` — **nuovo**
- `docs/state/_index.md` — riga della Sessione 55 nella tabella della migration
- `docs/11-BACKLOG.md` — Story 1.5: `**Stato**:` e `**Spec**:` allineati, riga
  roadmap, changelog 1.6.13
- `docs/INDEX.md` — riga del documento 20, conteggi legacy, "Prossimo step tecnico"
- `docs/18-DEV-LOG.md` — §21 (nuova) + changelog 2.1
- `scripts/generate-bundle.ps1` — `$files`: il documento 20 + la sessione 55
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#164** — issue di questa sessione (claim `kilo-HP-ELITEBOOK-bmyx`), chiusa con
  `status:done` al merge della PR di spec
- **#155** — implementazione della Story 1.3: i due adapter (`lastfm`,
  `listenbrainz`) che questa spec estende sul lato della scrittura
- **#144** / **#145** — le spec dei due adapter (lettura), da cui derivano
  `api_sig`, rate limit, User Token e la semantica temporale
- **#148** — ADR-0010: il precedente remoto, il cui "punto aperto" sui token è
  qui chiuso (rinnovo manuale)
- `docs/13-ADR/0010-remote-source-adapter.md` — il contratto `parseRemote?()` che
  il percorso incrementale di ListenBrainz deve implementare
