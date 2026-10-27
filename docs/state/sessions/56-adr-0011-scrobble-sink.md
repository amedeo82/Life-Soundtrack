---
number: 56
title: "ADR-0011 — contratto di scrittura negli hub (ScrobbleSink)"
date: 2026-10-27
state: 🟡
merged: false
merged_commit: ""
merged_date: ""
branch: feat/168-adr-0011-scrobble-sink
pr: 170
claim: kilo-hp-elitebook-41xb
cross_refs: [168, 164, 148]
tags: [docs, adr, adapter, phase-1]
---

# Sessione 56 — ADR-0011: il contratto di scrittura negli hub (issue #168)

## Sintesi

Scrittura di `docs/13-ADR/0011-scrobble-sink.md` v0.1 (🟡 DRAFT): la decisione
architetturale su **dove vive il contratto di scrittura** verso i hub di scrobbling,
con la ratifica dentro `05-ARCHITECTURE.md` §4 (🟢 APPROVED, che per contratto
richiede un ADR).

È il terzo pezzo della Story 1.5 dopo il canale di **lettura** (Story 1.3: gli
adapter `lastfm` e `listenbrainz`, entrambe 🟢 v1.0) e il contratto remoto del
percorso di lettura (ADR-0010, 🟢 v1.0): il lato **scrittura**.

La decisione è **A1**: l'interfaccia `ScrobbleSink` è **separata** da
`PlatformAdapter`, con la stessa forma di `parseRemote?()`. `PlatformAdapter` non
cambia, nessun adapter esistente è toccato, e i vincoli V1-V10 sono ratificati in
`05§4.2`.

## Trigger

Issue #168 (`needs-spec`, `size:M`, `area:adapter`): la Story 1.5 non era
implementabile perché il contratto di scrittura non aveva una casa. La spec della
Story 1.5 (`docs/20-SCROBBLING-HUB.md` v0.1, Sessione 55, issue #164) ne aveva
definito il **contenuto** (D-SH.7, §4) e dichiarato l'ADR come la via per recepirlo
in `05§4` (`20§18` punto 1). Assegnazione esplicita del project owner.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.56.1 | Il contratto di scrittura è un'interfaccia **dedicata** `ScrobbleSink`, separata da `PlatformAdapter` | `PlatformAdapter` descrive la **lettura**; i due insiemi non coincidono (`maloja`/`subsonic`/`roon` sono client di scrobbling, non fonti: `01§3.9`). Alternativa A2 (metodo `scrobble?()` su `PlatformAdapter`) scartata: obbligherebbe ogni adapter a dichiarare la scrittura, per convenzione e non per tipo |
| D.56.2 | Il contratto **riusa la forma** di `parseRemote?()`: una libreria separata, non un quinto metodo del factory degli adapter | Simmetria con ADR-0010: opzionalità e segregazione del protocollo, che è la forma che ha già retto un ciclo di release |
| D.56.3 | `ScrobbleError` **dedicato**, con `recoverable` = "si può ritentare lo stesso invio" | `AdapterError.recoverable` significa "gli eventi validi **sono stati persistiti**": riusarlo per un invio darebbe all'utente una remediation sbagliata (la lezione che ha prodotto `SOURCE_UNREACHABLE` in ADR-0010) |
| D.56.4 | `ScrobbleHubId` **dedicato**: `PrivacySettings.scrobbleHubs` non è `PlatformId[]` | Il tipo attuale non può rappresentare i client di scrobbling; il tipo dedicato rende il toggle per-hub verificabile a compile time |
| D.56.5 | Il **payload è chiuso per costruzione**: nessun campo per contesto, device, IP o insight | G-SH.6 della spec: una regola "non inviare l'IP" è una promessa che un refactor dimentica; un campo inesistente non può essere inviato per errore |
| D.56.6 | Il **rate limiting sta nel sink**, non nel core (V2 = V7 di ADR-0010) | Last.fm ~5 req/s (batch ≤ 50) e ListenBrainz 1 req/s (`X-RateLimit-*`) hanno limiti incompatibili: se il core decidesse il batch dovrebbe conoscere i due protocolli |
| D.56.7 | L'**idempotenza è locale e verificabile**: chiave unica `hub\|eventKey` sulla coda, con scrittura write-ahead | Nessuna delle due API espone una chiave di deduplica lato server: l'unica garanzia possibile è locale. Il write-ahead dichiara il caso residuo (doppio scrobble possibile) invece di nasconderlo |
| D.56.8 | Il percorso **incrementale** ListenBrainz resta sul contratto di **lettura** (`parseRemote?()`) | La sync continua va dalla hub al DB locale: è lettura. L'ADR non crea un terzo contratto |
| D.56.9 | L'ADR **dichiara** l'elenco dei documenti da aggiornare e **il momento**: `05§4.2` in questa PR, `02§3.8`/`§6`, `09§3.3`/`§4` e `08-COPY-I18N.md` alla ratifica della spec | I documenti 🟢 APPROVED non si modificano sulla base di una spec 🟡 DRAFT: le due ratifiche sono atti distinti (come per ADR-0010 e per `03-ADAPTERS/lastfm.md`) |
| D.56.10 | Il **now playing** resta fuori perimetro | Non è un ascolto finito: non ha regola di maturità né semantica di `timestamp`. Se entrerà, avrà bisogno di un contratto proprio — l'ADR va esteso, non stirato |

## Difetti trovati lungo il percorso

**Il file `05-ARCHITECTURE.md` aveva l'header rotto.** La riga di changelog della
v1.2 (Sessione 53, `rekey()`) era stata **appesa in cima al file**, prima del titolo,
invece che inserita nella tabella: l'header dichiarava `Versione: 1.1` mentre
`INDEX.md` dichiarava "v1.2" — due versioni diverse per lo stesso documento. Lo
stesso difetto, in scala minore, sull'header di `18-DEV-LOG.md` (v2.0 con changelog
alla 2.1). Nessun gate controlla che il changelog stia nella tabella, e il conteggio
delle versioni è un dato **copiato a mano** in due posti.

**L'issue era sbloccata ma non candidabile.** #168 aveva `needs-spec` senza
`agent-ready`: la macchina a stati (ADR-0007) la rendeva non lavorabile da un
agente, anche se la specifica che sblocca la decisione era già stata mergiata
(PR #167). La label è stata transitata (`needs-spec` → `agent-ready`) prima del
claim, con claim commentato e riverifica: l'assegnazione esplicita del project owner
rende visibile la presa in carico anche quando la label non era pronta.

## Verifica

- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (dopo rigenerazione)
- `pwsh scripts/aggregate-state.ps1 -Check` → drift atteso sui blocchi aggregati
  (li rigenera `auto-state-aggregate` post-merge) — **post-merge: exit 0**
- `pnpm run lint` / `typecheck` / `test` / `build` → verdi
- `node scripts/check-readme-facts.mjs` → exit 0
- Nessuna modifica ai blocchi `<!-- AGGREGATE-* -->` (ADR-0008): le sezioni legacy
  di `INDEX.md` e `11-BACKLOG.md` sono state allineate a mano, i blocchi restano
  al generatore

## Lesson learned

| # | Osservazione |
|---|----------------|
| 56-1 | **Un ADR che dichiara *dove vive* un contratto e una spec che dichiara *cosa contiene* un protocollo non sono lo stesso atto.** Il primo è architetturale (`05§4` è APPROVED → serve ADR), il secondo è di protocollo (🟡 DRAFT → serve ratifica). Confonderli produce un blocco: finché la spec è DRAFT, i documenti APPROVED che essa tocca non si possono modificare — e l'ADR deve *dichiarare* l'elenco dei documenti da aggiornare senza toccarli |
| 56-2 | **La simmetria con il precedente ADR è la leva della decisione.** `parseRemote?()` ha risolto "l'adapter non ha un file" con un metodo opzionale; "l'hub non è un adapter" si risolve con un'interfaccia dedicata — stessa forma, opposta direzione. Un precedente ben risolto è la forma più economica di argomentazione |
| 56-3 | **`recoverable` non è un nome neutro.** La stessa bandiera booleana con due semantiche diverse è un errore di remediation, non un dettaglio di naming: le classi di errore vanno nominate e tipizzate per il dominio che descrivono |
| 56-4 | **Il payload chiuso dal tipo è la forma forte di una promessa di privacy.** "Non inviare l'IP" è una policy che un refactor dimentica; un campo inesistente non può essere inviato per errore |
| 56-5 | **Una riga di changelog fuori dalla tabella non è un difetto di formattazione**: è un documento con l'header rotto, e i gate che contano le versioni non lo vedono. Il versione dichiarata in due posti è una seconda fonte di verità |

## Documenti aggiornati

- `docs/13-ADR/0011-scrobble-sink.md` — **nuovo**: l'ADR (v0.1 🟡 DRAFT)
- `docs/05-ARCHITECTURE.md` — §4.2 "Contratto di scrittura (`ScrobbleSink`)"
  nuova; header (v1.1 → **v1.3**) e riga di changelog v1.2 riposizionata nella tabella
- `docs/11-BACKLOG.md` — Story 1.5: `**Stato**:` (dipendenza ADR-0011 soddisfatta
  nel contenuto), AC della dipendenza, `**Spec**:` e `**Issue**:`; riga roadmap;
  changelog 1.6.14
- `docs/INDEX.md` — righe `05`, `13`, `18-DEV-LOG`; conteggi legacy dei documenti
  APPROVED/DRAFT; "Prossimo step tecnico"
- `docs/18-DEV-LOG.md` — §22 (nuova) + changelog 2.2
- `docs/state/sessions/56-adr-0011-scrobble-sink.md` — **nuovo**
- `docs/state/_index.md` — riga della Sessione 56 nella tabella della migration
- `scripts/generate-bundle.ps1` — `$files`: l'ADR 0011 + la sessione 56
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#168** — issue di questa sessione (claim `kilo-hp-elitebook-41xb`): l'ADR
  richiesta dalla spec della Story 1.5, chiusa con `status:done` al merge della PR
- **#164** — spec della Story 1.5 (`docs/20-SCROBBLING-HUB.md` v0.1): la §4 definisce
  il contenuto del contratto, la §18 punto 1 demandava questo ADR
- **#148** — ADR-0010: il precedente percorso di **lettura**, il cui modello
  (metodo/libreria separata, protocollo segregato, `recoverable` con semantica
  propria) questo ADR replica sulla direzione opposta
- `docs/13-ADR/0010-remote-source-adapter.md` — il contratto `parseRemote?()` che il
  percorso incrementale ListenBrainz deve implementare
