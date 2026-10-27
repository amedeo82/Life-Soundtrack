---
number: 57
title: "Ratifica della spec Scrobbling hub + issue di implementazione (Story 1.5)"
date: 2026-10-27
state: 🟡
merged: false
merged_commit: ""
merged_date: ""
branch: feat/172-scrobbling-hub-spec-approval
pr: 0
claim: kilo-hp-elitebook-41xb
cross_refs: [172, 164, 168, 173]
tags: [docs, spec, adapter, phase-1]
---

# Sessione 57 — Ratifica di `20-SCROBBLING-HUB.md` (issue #172)

## Sintesi

Ratifica della spec della Story 1.5 (`docs/20-SCROBBLING-HUB.md`): da 🟡 DRAFT
v0.2 a **🟢 APPROVED v1.0**, con le **quattro decisioni aperte** chiuse come
proposte (**D-SH.11…D-SH.14**) e l'allineamento dei documenti che la spec
tocca — atto che l'ADR-0011 aveva dichiarato e differito.

A differenza della promozione dell'ADR-0011 (PR #171), qui la ratifica **non è
una promozione senza contenuto**: chiudere i punti aperti **modifica** regole
normative (T-SH.3, T-SH.4, E.SH.10, E.SH.11, la finestra di candidatura, la
modalità del proxy). Le modifiche sono in §2.1 (le quattro decisioni) e nei
punti che esse toccano.

Apre anche l'**issue di implementazione #173** (`agent-ready`, `size:L`),
come fu fatto per la Story 1.3 con #155.

## Trigger

Issue #172 (`needs-spec` → `agent-ready`, `size:M`, `area:adapter`), aperta a
sua volta nella Sessione 56 quando la coda delle issue è rimasta vuota: le
quattro decisioni di **protocollo** della spec (punti 2-5 di `20§18`) non
esistevano, e la regola d'oro del protocollo è *non inventare*: si apre una
issue `needs-spec` con le opzioni e si propone. Le risposte sono arrivate
dall'assegnazione esplicita del project owner ("procediamo con il prossimo
step"), che ha ratificato le proposte.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.57.1 | Le quattro decisioni si chiudono **come proposte** (D-SH.11…D-SH.14), non come decisioni prese in autonomia | È il pattern delle spec già ratificate: le decisioni D1-D7 della spec ListenBrainz (Sessione 47) e D1-D7 della spec Last.fm (Sessione 50) sono state "chiuse come proposte" nella spec e ratificate dal Boss al merge. La ratifica è l'atto del Boss, non una decisione dell'agente |
| D.57.2 | **D-SH.11** — md5 in **JS puro** (`crypto.ts`), nessuna dipendenza nuova | `Web Crypto` non supporta md5; `hash-wasm` aggiungerebbe ~30 KB di wasm al bundle PWA contro ~4 KB di codice proprio; il rischio della scrittura a mano è contenuto dai vettori RFC 1321 (caso di test n. 23). Conferma D-SH.2 |
| D.57.3 | **D-SH.12** — finestra di candidatura a **7 giorni**, con azione esplicita per tutta la cronologia | 24 h non è uno "specchio dello storico"; un default illimitato fa uscire tutto lo storico al primo abilitamento senza che l'utente lo chieda. 7 giorni copre l'uso tipico con poche richieste; il caso "voglio tutto" diventa un'azione, non un default |
| D.57.4 | **D-SH.13** — durata ignota: soglia dei **4 minuti sul tempo trascorso**, con **fiducia nella fonte** per gli eventi importati da un hub | La regola precedente escludeva la **maggior parte** degli ascolti degli utenti Last.fm/ListenBrainz (durata `0`): la story non avrebbe nulla da inviare. La soglia dei 4 minuti mantiene un minimo di prudenza; per gli eventi importati da un hub la maturità è già garantita dalla fonte (Last.fm registra lo scrobble solo dopo la propria regola). Il bias residuo (ascolto di 30 s di un brano di 4 minuti) resta **dichiarato** |
| D.57.5 | **D-SH.14** — **modalità del proxy dichiarata dall'utente** (`solo lettura` / `lettura + scrittura`, default `solo lettura`) | Molti proxy "JSON" inoltrano solo GET: senza dichiarazione l'utente scoprirebbe il limite al primo errore (E.SH.7) invece che prima (U-SH.2). Coerente con il consenso per-hub e con `isConfigured()` |
| D.57.6 | I documenti 🟢 APPROVED che la spec tocca (`02`, `03-ADAPTERS/*`) vengono allineati **in questa PR**, non prima | È quanto dichiarato dall'ADR-0011 §"Documenti da aggiornare": un documento APPROVED non si modifica sulla base di una spec DRAFT. La ratifica è l'atto che li rende coerenti |

## Difetti trovati lungo il percorso

**`02-DATA-SCHEMA.md` aveva lo stesso header rotto di `05-ARCHITECTURE.md`** (difetto
22-1, Sessione 56): la riga di changelog della v1.5 (Sessione 53, `rekey()`) era
**appesa in cima al file**, prima del titolo, e l'header dichiarava `Versione: 1.3`
mentre il changelog era già alla 1.4. È l'**unico** altro file con questo difetto:
la scansione di tutti i `.md` di `docs/` (prima riga che comincia con `| <version> |`)
ne ha trovato uno solo. Corretto: riga riposizionata nella tabella, header alla
v1.6.

**Tre header dichiaravano una versione più vecchia del loro changelog**:
`09-PRIVACY-SECURITY.md` (v0.2 al Sessione 6, changelog alla 0.4),
`08-COPY-I18N.md` (v0.2 al Sessione 9, changelog alla 0.4),
`03-ADAPTERS/lastfm.md` (v1.0 al Sessione 51, changelog alla 1.1) e
`03-ADAPTERS/listenbrainz.md` (v1.0 al Sessione 47, changelog alla 1.1),
`01-PLATFORMS.md` (v0.2 al Sessione 9, changelog alla 0.6). Tutti allineati: la
versione dichiarata nell'header è una **seconda fonte di verità** che invecchia
in silenzio, perché nessun gate la confronta con il changelog.

## Verifica

- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → drift atteso sui blocchi aggregati (li rigenera `auto-state-aggregate` post-merge)
- `pnpm run lint` / `typecheck` / `test` / `build` → verdi (nessun file applicativo toccato)
- `node scripts/check-readme-facts.mjs` → exit 0
- Nessuna modifica ai blocchi `<!-- AGGREGATE-* -->` (ADR-0008)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 57-1 | **Ratificare una spec non è promuoverla.** La promozione dell'ADR-0011 (PR #171) è stata una promozione *senza contenuto*; chiudere i punti aperti di una spec *modifica regole normative*. Il pericolo è scambiare i due gesti: una promozione "senza modifiche" che in realtà cambia una regola would violare la regola che le specifiche DRAFT non modificano i documenti APPROVED — qui la modifica è **legittima** perché nasce dalla ratifica stessa, ma va dichiarata (cambio di T-SH.3, E.SH.10, E.SH.11, finestra e modalità proxy) e non presentata come "solo stato" |
| 57-2 | **Una decisione di default è una decisione sul comportamento reale.** La finestra di candidatura e la soglia di maturità non sono dettagli di configurazione: determinano *quanti* scrobble escono e *quali*. La regola precedente (durata ignota → non maturo) era difendibile a tavolino e **inutile nel mondo**: escludeva la maggior parte degli ascolti degli utenti Last.fm/ListenBrainz. Il test di una regola di maturità è "quanti utenti reali superano il filtro", non "è conservativa?" |
| 57-3 | **La fiducia nella fonte è una forma di inferenza che va dichiarata.** Per gli eventi importati da un hub la maturità è garantita dalla fonte: dichiararlo come regola (T-SH.3) è più onesto che fingere di rivalutarla, e rende il comportamento spiegabile all'utente |
| 57-4 | **Il default conservativo e l'esplicità non sono in contraddizione.** 7 giorni + azione "tutta la cronologia" copre entrambi i bisogni: il default non fa mai uscire uno storico non richiesto, l'azione copre il caso "voglio tutto". Un default che serve solo un caso forza la scelta fra due insoddisfacenti |
| 57-5 | **L'header di un documento è una seconda fonte di verità.** Cinque documenti del progetto dichiaravano una versione più vecchia del proprio changelog, e `02-DATA-SCHEMA.md` aveva una riga di changelog **prima del titolo**: entrambe le cose sono invisibili a qualsiasi gate, perché i gate confrontano blocchi aggregati, non l'header con il changelog. La scansione "la prima riga del file comincia con `| <version> |`" costa un comando e trova la classe di difetto in un colpo solo |

## Documenti aggiornati

- `docs/20-SCROBBLING-HUB.md` — **v1.0 🟢 APPROVED**: §2.1 (D-SH.11…D-SH.14), §5
  (finestra), §6.1 e §13.1 (modalità proxy), §7 (T-SH.3, T-SH.4, bias), §12
  (E.SH.10, E.SH.11), §14.3 (31 casi), §17, §18, changelog 1.0
- `docs/02-DATA-SCHEMA.md` — §3.8 (`ScrobbleHubId`), §6.2 (`scrobbleOutbox`,
  schema v5), header v1.6, changelog 1.5 (riposizionata) + 1.6
- `docs/09-PRIVACY-SECURITY.md` — §3.3 (payload esatto), §4 (inventario), header v0.5
- `docs/08-COPY-I18N.md` — §1 (namespace), §2.16 (15 codici), header v0.5
- `docs/03-ADAPTERS/lastfm.md` — §4 E.LF.21, §10 (proxy in scrittura), header v1.2
- `docs/03-ADAPTERS/listenbrainz.md` — D-LB.5, §3.4, header v1.2
- `docs/01-PLATFORMS.md` — §3.7, §3.8, §3.9, header v0.7
- `docs/11-BACKLOG.md` — Story 1.5 (`**Stato**:`/AC/`**Spec**:`/`**Issue**:`),
  riga roadmap, changelog 1.6.16
- `docs/INDEX.md` — righe 01, 02, 08, 09, 11, 20, 13-ADR, conteggi legacy, "Prossimo step tecnico"
- `docs/18-DEV-LOG.md` — §23 (nuova) + changelog 2.4
- `docs/state/stories/1.5-scrobbling-hub.md` — **nuovo**
- `docs/state/sessions/57-scrobbling-hub-spec-approval.md` — **nuovo**
- `docs/state/_index.md` — righe della Sessione 57 e della Story 1.5
- `scripts/generate-bundle.ps1` — `$files`: i due file nuovi
- `docs/BUNDLE.md` — rigenerato
- Issue **#173** — implementazione della Story 1.5 (`agent-ready`, `size:L`)

## Cross-refs

- **#172** — le quattro decisioni aperte (claim `kilo-hp-elitebook-41xb`): chiuse
  alla ratifica, issue chiusa con `status:done` al merge della PR
- **#164** — spec della Story 1.5: da cui nascono le quattro decisioni
- **#168** — ADR-0011: il contratto di scrittura, ratificato nella Sessione 56
- **#173** — issue di implementazione della Story 1.5, aperta in questa sessione
