# Adapter ListenBrainz

> Status: 🟢 APPROVED · Versione 1.0 · Ultima modifica: Sessione 47 (2026-10-26)
> Piattaforma: ListenBrainz (MetaBrainz, no-profit)
> Sede legale: USA
> Tier: **S** · Priorità MVP: **sì**
> Spec collegata a: Story 1.3 (`11-BACKLOG.md`), `01-PLATFORMS.md` §3.8

**Decisioni chiuse** (Boss, Sessione 47 — issue #145):

| # | Decisione | Sintesi |
|---|-----------|---------|
| D-LB.1 | Canale dello storico | **Export API** (ZIP con JSONL), non paginazione `/listens` (§1, §2.1) |
| D-LB.2 | `eventKey` | `listenbrainz:<listened_at>\|<recording_msid>` — il msid **non** è univoco per ascolto (§3.1) |
| D-LB.3 | Semantica temporale | `timestamp = startedAt = listened_at*1000`, `durationMs = 0` — semantica **uniforme** (§5) |
| D-LB.4 | Percorso di import | **Opzione A**: l'utente scarica l'archivio, l'app lo importa. L'adapter è **file-only** (§2.1) |
| D-LB.5 | User Token | Uso **solo in lettura**; **non richiesto** per l'import dell'archivio (§7) |

**Decisioni aperte** (chiuse in v1.0 con l'approvazione del Boss — Sessione 47, issue #145):

| # | Decisione | Proposta |
|---|-----------|----------|
| D1 | `spotify_id` / `youtube_id` / `origin_url` | **ignorati**: nessuna dipendenza da ID di terze parti, nessuna chiamata secondaria (§3.1, E.LB.12) |
| D2 | MBID: `additional_info` o `mbid_mapping`? | **`mbid_mapping`** (dato risolto dal server) vince in conflitto (§3.1.1, E.LB.4) |
| D3 | Parsing JSONL | Scanner **dedicato** in `packages/core/src/adapters/`, streaming, bounded memory (§10) |
| D4 | `duration_ms` → `Track.durationMs` | Sì, come proxy di durata catalogo; **mai** sull'evento (§3.1.1) |
| D5 | Durata della Story 1.3 | `L` |
| D6 | Percorso `/listens` nella 1.3 | **No**: materiale della Story 1.5 (§3.4) |
| D7 | Bucket DEDUP-3 per questa fonte | **Sempre 0**; la durata resta un hint sulla `Track`, fuori dal `canonicalKey` (§3.3, §6, E.LB.2) |

---

## 1. Metodi di accesso

| Canale | Disponibile | Formato output | Frequenza | Note |
|--------|:-----------:|----------------|-----------|------|
| Export GDPR | ✅ | ZIP con JSONL (export API ListenBrainz) | Manuale | `POST /1/export/` → poll → download; l'utente lo scarica dal sito e lo carica nell'app (D-LB.4) |
| API pubblica | ✅ | REST JSON | Real-time | `/1/user/{username}/listens` per query incrementali — **non** per lo storico completo (D-LB.1) |
| Scrobbling (Last.fm/Maloja) | ✅ | — | Continuo | i client scrobbano su LB; l'export è il canale di import |
| File utente diretto | ✅ | JSONL dentro ZIP | Manuale | l'archivio export è un file → il contratto `05§4` (`parse(input: Blob)`) **non viene toccato** |

**Canale principale MVP**: l'archivio export. La doc ufficiale prescrive esplicitamente il suo uso per lo storico completo:

> "To retrieve a user's entire listening history, use the **export API**. **Do not scrape or paginate through the user's entire history using the listens endpoint.** Use that endpoint for recent listens, bounded queries, and incremental updates after importing an export."

**Cosa offre l'export** — a differenza di Spotify, YouTube e Apple, ListenBrainz è l'unica fonte del perimetro con **identificativi MusicBrainz nativi**: `recording_mbid`, `artist_mbids[]`, `release_mbid`, `release_group_mbid` e `isrc`. Questo la rende l'unico adapter che può produrre **DEDUP-1** e **DEDUP-2** alla prima importazione, senza attendere l'enrichment, e la fonte che alimenta `rekey()` (Story 1.4) con dati reali.

**Cosa non offre**: durata ascoltata (c'è `duration_ms`, ma è la durata *catalogo* del brano e solo se il client l'ha inviata), contesto (nessun dispositivo, nessun IP, nessun paese), informazioni di skip o shuffle.

**CORS**: verificato sul sorgente. `listenbrainz/webserver/views/export_api.py` applica `@crossdomain` a **tutti** gli endpoint del blueprint, incluso `download_export_archive`. L'export API è quindi utilizzabile da una PWA. La scelta di non orchestrarlo dall'app (D-LB.4) è per ergonomia e rate limit, **non** per un blocco tecnico.

**HTTPS only**: la doc dichiara esplicitamente *"All ListenBrainz services are only available on HTTPS!"*.

**User-Agent obbligatorio**: *"Requests without a valid user agent may be blocked without further notice as collateral damage in our fight against scrapers and botnets."* Formato richiesto: `NomeApp/<version> ( url-contatto )`. Nel percorso export l'app non effettua richieste, ma il vincolo resta dichiarato per il percorso `/listens` della Story 1.5.

## 2. Flusso di import

[Utente scarica l'archivio] → [Rilevamento formato] → [Estrazione ZIP] → [Parsing streaming JSONL] → [Normalizzazione] → [Upsert DB]

### 2.1 Come l'utente procura il file (D-LB.4, opzione A)

1. `listenbrainz.org` → login con l'account MusicBrainz
2. **Settings → Export** → richiedere l'export dei dati ascoltati
3. Attendere: il job è asincrono lato server (stati `waiting` → `in_progress` → `completed`); l'utente riceve un'**email** quando l'archivio è pronto
4. Scaricare lo ZIP (`export-<username>-<id>.zip`)

L'utente **non** deve eseguire alcun polling dall'app: l'export resta valido **30 giorni** (`available_until` nell'oggetto export).

Struttura dell'archivio (verificata sulla doc dell'export API, 2026-10-26):

```
export-<username>-<id>.zip
  user.json                  # id e username dell'account
  listens/<mese>.jsonl       # cronologia: un oggetto JSON per riga; i mesi senza ascolti sono omessi
  feedback.jsonl             # love/hate (quando presente) — fuori scope MVP (E.LB.16)
  pinned_recording.jsonl     # (quando presente) — fuori scope MVP (E.LB.16)
```

**Vincoli dell'export API** (rilevanti per la futura Story 1.5, che userà il percorso `/listens`):

| Vincolo | Valore | Conseguenza per l'app |
|---------|--------|------------------------|
| Export pending | **uno solo per utente**, indipendentemente dal range | un secondo POST → `400` |
| Range temporale | `POST /1/export/` con body opzionale `{start_time, end_time}` (UNIX secondi UTC, inclusivi) | un export per finestra |
| Download | **non resumable**: un'interruzione riavvia lo stesso `export_id` | non creare un job nuovo |
| Snapshot | *"generated asynchronously from live data, rather than an atomic snapshot"* | il re-import può vedere dati diversi → riconciliazione via `eventKey` (E.LB.15) |

### 2.2 Rilevamento formato (`detect`)

- **ZIP**: si legge il **central directory** (`listZipEntries` di `adapters/zip.ts`) e si cercano voci il cui path corrisponde a `listens/*.jsonl`. La presenza di **almeno un** file `listens/*.jsonl` **e** di `user.json` è il criterio di riconoscimento
- **JSONL non impacchettato** (lo stesso contenuto estratto a mano): accettato se la **prima riga** è un oggetto JSON valido con `listened_at` e `track_metadata` — utile per il debug e per i test
- **Rifiuta**: archivi senza `listens/*.jsonl` (es. un export parziale, o un export di un altro servizio) → `detect.fail` con guida
- La detection è **statica** (nessuna decompressione): si legge solo il central directory, come per gli altri adapter ZIP

### 2.3 Parsing

- **JSONL, non JSON array**: ogni riga è un oggetto JSON indipendente. Il `JsonArrayScanner` esistente (`adapters/jsonStream.ts`) **non** è adatto: è uno scanner di array JSON. Serve uno **scanner JSONL dedicato** (D3), con memoria limitata a una riga
- **Estrazione ZIP**: `fflate` (già dipendenza di `@ls/core` per gli ZIP Spotify/Apple), con `unzip` filtrato per entry: si estrae **un file per volta** e lo si consuma prima di passare al successivo, così la memoria di picco resta limitata a un mese di ascolti
- **Ordine dei file**: i mesi sono in ordine cronologico ma l'adapter **non deve assumerlo** (E.LB.14: i mesi vuoti sono omessi, quindi la sequenza ha buchi). L'ordine finale degli eventi è determinato dal `listened_at`, non dalla posizione nel file
- **Encoding**: UTF-8, senza BOM (i file generati dal server sono JSON puro). Tolleranza al BOM sul primo file, per robustezza

## 3. Mapping campi sorgente → unificato

> **Schema di riferimento**: `02-DATA-SCHEMA.md` v1.1 — `ListenEvent` **piatto** con `trackId` come FK; i metadati del brano vivono sull'entità `Track` separata.
>
> **Semantica temporale**: `listened_at` è l'**inizio** dell'ascolto (*"This should be set to playback start time of the submitted track"*), coerente con la riga `02§2`. La regola `02§2` (`timestamp = listened_at*1000 + durationMs`) **non** è applicabile letteralmente perché `duration_ms` è opzionale: quando è presente dà la fine dell'ascolto, quando è assente dà l'inizio. Applicarla alla lettera produrrebbe **due semantiche temporali diverse nello stesso import**. La scelta (D-LB.3) è una semantica **uniforme**; la riga `02§2` viene aggiornata in questa PR.

### 3.1 ListenEvent (top-level, piatto — vedi `02§3.2`)

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `eventKey` | `listened_at` + `recording_msid` | int + uuid | `'listenbrainz:' + listened_at + '\|' + recording_msid` | **D-LB.2** — replica la tupla di dedup lato server `(listened_at, user_id, recording_msid)`. Fallback (msid assente): `sha1(recording_mbid + '\|' + listened_at)` |
| `platform` | (fisso) | `PlatformId` | `'listenbrainz'` | — |
| `importId` | (interno) | uuid | generato al parse | FK a `imports` |
| `timestamp` | `listened_at` | int (UNIX s) | `listened_at * 1000` | **Inizio** dell'ascolto (D-LB.3) |
| `startedAt` | `listened_at` | int (UNIX s) | `listened_at * 1000` | Non distinguibile da `timestamp` (stesso predecessente di E.YT.5) |
| `durationMs` | — | — | `0` (costante) | La durata **ascoltata** è sconosciuta: `duration_ms` è la durata *catalogo* e non è sempre presente (E.LB.1, E.LB.2). `0` = "durata ignota", non "ascolto nullo" |
| `trackId` | (interno) | uuid | **risolto dal core via DEDUP** (`02§5`) | adapter emette metadati §3.1.1 |
| `completed` | — | — | `false` (costante) | Non calcolabile senza durata ascoltata |
| `skipped` | — | — | `null` | Nessun segnale di interruzione in un export |
| `shuffle` | — | — | `null` | Assente |
| `offline` | — | — | `null` | Assente |
| `incognito` | — | — | `null` | Assente |
| `reasonStart` | — | — | `null` | Assente |
| `reasonEnd` | — | — | `null` | Assente |
| `deviceType` | — | — | `'unknown'` | Nessun campo dispositivo |
| `deviceDetail` | `additional_info.media_player` / `additional_info.submission_client` | string \| null | raw | Il client che ha scrobbato, non il dispositivo. Conservato come stringa informativa grezza |
| `ip` | — | — | `null` | Nessun IP nell'export; il toggle `retainIp` **non è applicabile** (niente da conservare) |
| `country` | — | — | `null` | Nessun campo paese; l'IP non c'è, quindi nessuna derivazione possibile |
| `day` | (derivato) | `YYYY-MM-DD` | da `timestamp` UTC | indice critico |

**Campi del payload mai persistiti**: `inserted_at` (momento di inserimento nel DB — non è un tempo di ascolto), `user_name` (identifica l'account, non l'ascolto), `mbid_mapping.url_rels[]` (link verso Spotify/Deezer/Tidal), `mbid_mapping.caa_id` / `caa_release_mbid` (id Cover Art Archive), `additional_info.origin_url` / `spotify_id` / `youtube_id` (D1), `additional_info.tags[]` (tag utente, non generi), `additional_info.submission_client_version`, `additional_info.tracknumber` (il numero di traccia non è modellato in `02§3.3`).

### 3.1.1 Track (entità separata — vedi `02§3.3`)

| Campo Track | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-------------|----------------|---------------|----------------|------|
| `name` | `track_metadata.track_name` | string | `normalize(name)` (`02§5`); vuota → **skip evento** con warning | — |
| `artistId` | `track_metadata.artist_name` | string | risolto da `artists` (dedup per nome normalizzato) | L'artista **multi-artista** è una stringa già joined dal client (es. "Artist A & Artist B"): vedi §3.1.2 |
| `albumId` | `track_metadata.release_name` | string \| null | risolto da `albums` (dedup per nome+artistId); null se assente | — |
| `durationMs` | `additional_info.duration_ms` | int \| null | diretto, **solo come hint** (D7) | Proxy di durata catalogo (come `ms_played` in Spotify). **Non** entra nel calcolo del `canonicalKey` |
| `isrc` | `additional_info.isrc` | string \| null | upper-case | Se presente → **DEDUP-1** (prioritaria su DEDUP-2) |
| `mbid` | `mbid_mapping.recording_mbid` → `additional_info.recording_mbid` | string \| null | diretto | **DEDUP-2**. D2: in caso di conflitto vince il `mbid_mapping` (dato risolto dal server) |
| `genres` | — | — | `[]` | `additional_info.tags[]` sono tag utente, non generi: non usati. Geni via enrichment (Story 4.2) |
| `artworkUrl` | — | — | `null` | `caa_id` non è un URL; artwork via enrichment (Story 4.3) |
| `platformIds` | — | — | `{}` (vuoto) | Nessun ID traccia nativo: `recording_msid` è un hash dei metadati, non un ID di registrazione (E.LB.13) |

### 3.1.2 Artist / Album (entità separate — vedi `02§3.3`)

L'adapter emette `{name, mbid?}` per Artist e `{name, artistId, mbid: null, platformIds: {}}` per Album quando `release_name` è presente. Il core fa upsert con dedup per nome normalizzato (Artist) o nome+artistId (Album).

**Artista multi-artista (E.LB.11)**: `track_metadata.artist_name` è una **singola stringa** già joinata dal client, con forme variabili (`"A & B"`, `"A feat. B"`, `"A, B"`, `"A and B"`). La regola:

1. Se `mbid_mapping.artists[]` è presente, i suoi `artist_credit_name` sono le credit unità **canoniche** → l'adapter emette **una sola** Artist con nome = `join_phrase` dei credit unità (ricostruzione esatta, es. `"Artist A & Artist B"`)
2. Altrimenti si usa `track_metadata.artist_name` **grezzo** (nessuna divisione: dividere per `&` produrrebbe artisti fantasma e frammenterebbe la dedup)
3. Il `normalize()` di `02§5` rimuove `feat./ft./with` → `"A feat. B"` e `"A"` collassano sulla stessa chiave. È il comportamento **desiderato**: il brano è lo stesso

Il `mbid` dell'artista: `mbid_mapping.artist_mbids[0]` (il primo) → `Artist.mbid`. In caso di più artisti, si emette l'artista joinata con il **primo** mbid (gli altri andrebbero in una relazione many-to-many che `02§3.3` non modella).

### 3.1.3 I due campi che il contratto non aveva (Sessione 52)

`05§3.1` (`RawListenEvent`) non prevedeva due dati che questa spec richiede: senza
di essi il valore della spec sarebbe andato perso, senza degrado.

| Campo | Va a | Perché serve |
|-------|------|--------------|
| `sourceArtistMbid` (opzionale) | `Artist.mbid` | §3.1.2: `mbid_mapping.artist_mbids[0]` — "dato utile e attivo, più affidabile del mbid del brano" |
| `sourceTrackDurationMs` (opzionale) | `Track.durationMs` (hint) | §3.1.1: `additional_info.duration_ms` è durata **catalogo**, non durata dell'ascolto |

Il secondo è la distinzione che rende D7 implementabile: il **bucket** DEDUP-3 usa
la durata dell'evento (`sourceDurationMs`, che per ListenBrainz è **sempre 0**),
mentre la durata catalogo resta un hint sulla `Track`. Se la durata catalogo
entrasse nel bucket, uno stesso brano ascoltato una volta con e una volta senza
il dato finirebbe in **due `Track` distinte** — l'esatto opposto di ciò che la
dedup persegue (E.LB.2).

Entrambi i campi sono **additivi e opzionali**: gli altri quattro adapter non li
valorizzano e il loro comportamento non cambia.

### 3.2 Library / Playlist (vedi `02§3.7`)

**Fuori scope adapter MVP**:

| Entità | Sorgente | Blocco tecnico |
|--------|----------|----------------|
| LibraryItem `saved_track` | — | L'export non contiene la libreria salvata |
| Playlist / PlaylistItem | — | L'export non contiene le playlist; esistono endpoint dedicati (`/1/user/{u}/playlists`) fuori scope |
| Feedback love/hate | `feedback.jsonl` | Nessun campo love/hate in `02§3.3` (E.LB.16) |
| Pinned recording | `pinned_recording.jsonl` | Nessun modello per i pinned (E.LB.16) |

Segnalazione: `info.libraryDeferred`.

### 3.3 Filtro eventi

Un export contiene **solo** ascolti già validati dal server: ogni riga è un ascolto scrobbato. Non esistono righe da scartare per tipo di evento (a differenza dell'event stream Apple). Il filtro riguarda solo i **casi limite**:

```
isCandidateRow(r):
  1. r.listened_at assente o non intero          → scartata + warning malformedSkipped
  2. r.listened_at < LISTEN_MINIMUM_TS (1033430400, 2001-12-03) → scartata + warning tooOldSkipped
  3. r.track_metadata assente                     → scartata + warning malformedSkipped
  4. r.track_metadata.track_name assente o vuota  → scartata + warning noTitleSkipped
  5. r.recording_msid assente E r.track_metadata.recording_mbid assente
     E mbid_mapping.recording_mbid assente        → evento **senza** sourceEventId → fallback sha1 (§3.1)
  6. altrimenti                                    → ListenEvent
```

Il punto 5 **non** scarta: un ascolto senza identificativi è comunque un ascolto valido (nome + artista bastano per DEDUP-3). L'adapter emette l'evento con `sourceEventId = null` e il core calcola il fallback SHA-1.

**Bias dichiarato (E.LB.2)**: `duration_ms` è opzionale → lo stesso brano può cadere in **bucket DEDUP-3 diversi** a seconda della completezza del `additional_info` del singolo ascolto. La risposta strutturale è in D7: il bucket DEDUP-3 di ListenBrainz è **sempre 0** (il dedup primario è DEDUP-1/2 via MBID/ISRC), quindi il problema **non si manifesta**. La durata resta un dato disponibile, memorizzato sulla Track.

### 3.4 Il percorso `/listens` (fuori scope della 1.3)

Il percorso di query incrementale (`GET /1/user/{username}/listens?max_ts=…&count=…`) **non** è implementato nella Story 1.3:

- la doc ne sconsiglia l'uso per lo storico completo
- è materiale della **Story 1.5** (sync continua), dove il User Token è comunque necessario
- l'adapter è progettato per essere **esteso** in quel senso senza modificare il contratto: il percorso file produce gli stessi `RawListenEvent`

L'endpoint `/1/user/{username}/listens` con `MAX_ITEMS_PER_GET = 1000` e rate limit 1 req/s (più alto con token valido) è la sorgente dei dati per la 1.5.

## 4. Edge case noti

Copia da `01-PLATFORMS.md` §5 (piattaforma ListenBrainz) + edge case specifici emersi in Sessione 47.

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E.LB.1 | `additional_info` assente | Niente `duration_ms`, niente `isrc`, niente MBID | Degrado a DEDUP-3 bucket 0; `durationMs` = 0 sull'evento (E.LB.2) |
| E.LB.2 | `duration_ms` presente solo su alcuni ascolti dello stesso brano | Due bucket DEDUP-3 diversi → **due Track** per lo stesso brano | **Non si manifesta**: il bucket DEDUP-3 di LB è sempre 0 (D7). La durata è solo hint sulla Track |
| E.LB.3 | Token non valido / scaduto (`401`) | Le query `/listens` falliscono | `AdapterError` non recuperabile + guida al reset, **mai** retry loop. Nel percorso export (1.3) il token **non** è usato |
| E.LB.4 | `additional_info.recording_mbid` assente ma `mbid_mapping.recording_mbid` presente | DEDUP-2 raggiungibile anche senza MBID dal client | Usare il `mbid_mapping` (D2) |
| E.LB.5 | `429` con header `X-RateLimit-Reset-In` | Throttling | Attesa **tramite gli header**, non stimata. Non applicabile al percorso file (1.3) |
| E.LB.6 | `count` = 0 o pagina vuota a metà storico | Loop infinito di paginazione | Stop pulito. Non applicabile al percorso file (1.3); da applicare in 1.5 |
| E.LB.7 | Cursore `max_ts` e ultimo `listened_at` coincidenti | Loop infinito | `max_ts = ultimoTs - 1` (anti-loop). Percorso 1.5 |
| E.LB.8 | Stesso `recording_msid` con `listened_at` diverse | Falsi duplicati se si usa il solo msid | `eventKey` = `listened_at + '\|' + recording_msid` (D-LB.2): eventi distinti, chiavi distinte |
| E.LB.9 | `404` (username inesistente) | Import vuoto | `AdapterError` + guida. Percorso 1.5 |
| E.LB.10 | Listen database offline (`503`) | Import parziale | `recoverable: true` con `partialEvents`. Percorso 1.5 |
| E.LB.11 | `track_metadata` con artisti multipli | Artisti frammentati o fantasma | §3.1.2: `mbid_mapping.artists[]` se presente, altrimenti stringa grezza; mai divisione per `&` |
| E.LB.12 | `origin_url` / `spotify_id` / `youtube_id` presenti | Tentazione di dedup cross-piattaforma via ID terzi | **Ignorati** con nota in spec (D2): nessuna chiamata di rete secondaria, nessun enrichment implicito |
| E.LB.13 | Stesso brano scrobbato da client diversi → `recording_msid` diversi | Due eventi per lo stesso brano | **Corretto**: sono due ascolti distinti (D-LB.2 li separa). Stessa **Track** via DEDUP-1/2/3. Dichiarato: `recording_msid` non è identità di brano |
| E.LB.14 | Mesi senza ascolti omessi dall'archivio | Sequenza di file irregolare | Il parser non assume un file per mese né un ordine cronologico (E.LB.14) |
| E.LB.15 | Export non atomico (*"generated asynchronously from live data"*) | Il re-import vede dati diversi | Riconciliazione via `eventKey`: nessun duplicato, ma un export successivo può **aggiungere** eventi e non rimuovere quelli cancellati lato server |
| E.LB.16 | `feedback.jsonl` / `pinned_recording.jsonl` presenti | Dati non modellati | Scartati con warning `info.libraryDeferred`; **mai** importati come `ListenEvent` |
| E.LB.17 | `listened_at` < `LISTEN_MINIMUM_TS` (1033430400 = 2001-12-03) | Ascolti pre-2001 (import backdated) | Scartati con contatore |
| E.LB.18 | User-Agent assente o malformato | La piattaforma può bloccare **senza preavviso** | Header statico obbligatorio, mai disattivabile (percorso 1.5) |
| E.LB.19 | `inserted_at` molto successivo a `listened_at` (import backdated) | `inserted_at` fuorviante | `inserted_at` **mai** usato come tempo dell'evento; il tempo è `listened_at` |
| E10 | Fusi orari | Timeline sfalsata | `listened_at` è UNIX UTC: nessun fuso da gestire; `day` derivato da `timestamp` UTC |

## 5. Semantica temporale

- `listened_at` = **inizio** dell'ascolto (*"This should be set to playback start time of the submitted track"*), in UNIX secondi UTC
- `inserted_at` = momento in cui l'ascolto è stato **inserito nel database** dal server → **non** è un tempo di ascolto, **mai** usato (E.LB.19)
- `timestamp` (unificato) = `listened_at * 1000` (D-LB.3)
- `startedAt` = `listened_at * 1000` — indistinguibile da `timestamp`, come in YouTube Music (E.YT.5)
- `durationMs` = `0` (costante): la durata **ascoltata** è sconosciuta. `additional_info.duration_ms` è la durata **catalogo** e va sulla `Track` come hint (D7), non sull'evento

**Perché non `timestamp = listened_at + duration_ms`** (la lettera di `02§2`): `duration_ms` è **opzionale**. Con la regola letterale, un export con dati completi avrebbe eventi collocati alla **fine** dell'ascolto e un export con dati incompleti alla **fine**… no, all'**inizio**: due semantiche diverse nello stesso dataset, aggregati per ora del giorno non confrontabili, e il confine `day` spostato per una parte degli eventi.

La regola `02§2` dice inoltre che *"le analisi temporali usano `startedAt` quando disponibile"*: con `startedAt` sempre valorizzato all'inizio reale, l'analisi resta corretta indipendentemente dal bias. Precedente identico: YouTube Music §5 (`timestamp = time`, `durationMs = 0`, bias dichiarato).

**Bias dichiarato**: l'evento è collocato all'inizio dell'ascolto anziché alla fine; errore medio ~3-4 min, trascurabile per aggregazioni giorno/mese/era, non trascurabile per l'analisi di singolo evento.

**Correzione futura** (fuori adapter MVP, contratto): quando l'enrichment (Story 4.2) popola `Track.durationMs`, un job di normalizzazione può riallineare `timestamp = startedAt + durationMs`. È possibile **senza rompere l'idempotenza** perché l'`eventKey` è derivato dai soli dati grezzi `listened_at + recording_msid` (§3.1).

## 6. Dedup tracce

- **DEDUP-1** (`isrc` presente) → `isrc:<ISRC upper>`: attivabile direttamente dall'export, senza attese
- **DEDUP-2** (`recording_mbid` presente, no ISRC) → `mbid:<mbid>`: **prioritario** per questa piattaforma. La sorgente preferita è `mbid_mapping.recording_mbid` (dato risolto dal server, D2), con `additional_info.recording_mbid` come fallback
- **DEDUP-3** (nessuno dei due) → `fuzzy:<sha1(normalize(name) + '|' + normalize(artistPrincipal) + '|' + durationBucketMs)>` con **`durationBucketMs = 0`**: il bucket non discrimina fra radio edit / album version / live di omonimi

**Il bucket sempre 0 è una scelta, non un degrado** (D7): a differenza di YouTube (E.YT.5, dove la durata non esiste affatto), qui la durata **potrebbe** esistere ma non è affidabile. Usarla nel bucket produrrebbe **E.LB.2**: lo stesso brano presente in un ascolto con `duration_ms` e in uno senza finirebbe in **due `Track` distinte** — esattamente ciò che l'intero sistema di dedup vuole evitare. Preferire la Track sbagliata (una) all'evento frammentato (due).

La priorità DEDUP-1/2 compensa ampiamente: è l'unica fonte del perimetro che espone gli identificativi nativi, e la maggior parte degli ascolti su un hub di scrobbling porta MBID (i client come Navidrome/Picard li inviano).

- `artist_mbids[]` → `Artist.mbid`: consente la risoluzione di artisti omonimi via MBID dopo l'enrichment
- `recording_msid` **non** è usato come identità di **brano**: è un hash dei metadati, quindi cambia se un client invia lo stesso brano con dettagli diversi (un player invia `tracknumber`, un altro no) → E.LB.13. È usato solo come parte dell'`eventKey`
- Promozione post-enrichment: job `rekey()` (Story 1.4) quando MusicBrainz trova ISRC/MBID su un brano importato da un'altra fonte

## 7. Comportamento privacy

| Dato sensibile | Default | Note |
|----------------|---------|------|
| IP address | **non presente** nell'export | Il toggle `retainIp` non è applicabile: non c'è nulla da conservare. `ip` = `null` sempre |
| `country` | `null` | Nessun campo paese e nessun IP → nessuna derivazione possibile |
| Coordinate GPS | mai raccolte | — |
| `user_name` | **mai persistito** | Identifica l'account, non l'ascolto. Esiste solo in `user.json`, che non viene importato |
| `inserted_at` | **mai persistito** | Non è un tempo di ascolto (E.LB.19) |
| `additional_info.media_player` / `submission_client` | conservato in `deviceDetail` | Stringa grezza del client che ha scrobbato. Non è un identificatore di persona, ma **non è** un dispositivo: dichiarato come tale in `deviceDetail` |
| `additional_info.tags[]` | **mai persistiti** | Tag inseriti dall'utente, non generi del brano |
| `mbid_mapping.url_rels[]` | **mai persistiti** | Link a Spotify/Deezer/Tidal: nessuna chiamata secondaria (E.LB.12) |
| User Token | **non richiesto** per l'import dell'archivio (D-LB.4) | Se presente (percorso 1.5): storage **locale** (Dexie), mai nei log, mai nelle fixture, mai nei bundle. Usato **solo in lettura**: il token dà anche accesso in scrittura a `/1/submit-listens` e la 1.3 non scrobba |

**Il file export contiene dati personali dell'utente** (l'intero storico di ascolto). Come per gli altri adapter, il file resta la fonte di verità e **non viene persistito** (ADR-0003: il payload raw non è salvato nel DB). L'app importa, scrive gli eventi normalizzati, e **non conserva l'archivio**.

## 8. Test — fixture attese

File atteso: `fixtures/synthetic-history/listenbrainz-sample.jsonl` (**creato nella Story 1.3**, generato in modo deterministico secondo `10-TESTING.md` §3.5).

Il fixture è il **contenuto JSONL** (la concatenazione dei file `listens/<mese>.jsonl`); il test costruisce l'archivio ZIP in memoria a partire dal fixture, così il repository resta testuale e git-friendly (come per `apple-music-sample.csv`). Lo ZIP è deterministico (`fflate.zipSync` con data fissa).

Convenzione `10-TESTING.md` §3.1: ogni riga porta `_case` (descrizione dello scenario) e `_expectedOutput` (valori attesi). `_case` e `_expectedOutput` **non** sono campi del payload reale: l'adapter li ignora.

Casi di test minimi:

1. **Happy path**: 3 righe ben formate → 3 `ListenEvent`, 3 track, `timestamp = listened_at * 1000`
2. **Idempotenza**: re-import dello stesso archivio → `eventsDuplicated = 3` (via `eventKey` D-LB.2)
3. **E.LB.8**: stesso `recording_msid` con `listened_at` diverse → **due** eventi distinti
4. **E.LB.13**: stesso brano, `recording_msid` diversi (client diversi) → due eventi, **una** Track
5. **DEDUP-1**: riga con `additional_info.isrc` → `canonicalKey` = `isrc:<ISRC>`
6. **DEDUP-2**: riga con `mbid_mapping.recording_mbid` → `canonicalKey` = `mbid:<mbid>`; conflitto con `additional_info` → vince il mapping (D2)
7. **E.LB.4**: riga senza MBID client ma con `mbid_mapping` → DEDUP-2 raggiunto
8. **E.LB.11**: riga con `mbid_mapping.artists[]` (2 artisti con `join_phrase`) → **una** Artist col nome ricostruito; riga senza mapping → stringa grezza, nessuna divisione per `&`
9. **E.LB.1 / E.LB.2**: righe con e senza `additional_info.duration_ms` → **stessa** Track (bucket 0), `durationMs` evento = 0, `Track.durationMs` popolata solo dove il dato c'è (D7)
10. **E.LB.14**: archivio con `listens/2025-01.jsonl` e `listens/2025-03.jsonl` (febbraio assente) → tutti gli eventi importati, nessun errore
11. **E.LB.16**: archivio con `feedback.jsonl` e `pinned_recording.jsonl` → scartati con warning, nessun `ListenEvent` in più
12. **E.LB.17**: riga con `listened_at` < 1033430400 → scartata con contatore
13. **Malformata**: riga senza `listened_at` o senza `track_metadata` → scartata con warning
14. **noTitleSkipped**: riga con `track_name` vuota → scartata con warning
15. **Senza msid**: riga senza `recording_msid` e senza MBID → importata con `sourceEventId = null` → fallback SHA-1
16. **E.LB.19**: riga con `inserted_at` molto successivo a `listened_at` → il tempo dell'evento è `listened_at`
17. **Privacy**: `user_name` e `inserted_at` assenti dal DB; `ip`/`country` null; `tags[]` e `url_rels[]` non persistiti
18. **Detection**: ZIP senza `listens/*.jsonl` → `detect` ko; JSONL sciolto con prima riga valida → `detect` ok
19. **E10**: eventi a cavallo di mezzanotte UTC → `day` UTC corretto
20. **DEDUP-3**: due righe con lo stesso brano, nessun identificativo → una sola Track (bucket 0)

## 9. Segnalazione all'utente

Codici i18n (`08-COPY-I18N.md`) usati dall'adapter — namespace `adapter.listenbrainz.*` (allineato a `PlatformId`; le chiavi vanno aggiunte in `08§2.12c`):

| Codice i18n | Messaggio (IT) | Quando |
|-------------|----------------|--------|
| `adapter.listenbrainz.detect.success` | "Archivio ListenBrainz riconosciuto" | detect ok |
| `adapter.listenbrainz.detect.fail` | "File non riconosciuto come export ListenBrainz (manca la cartella `listens/`)" | detect ko |
| `adapter.listenbrainz.warn.malformedSkipped` | "{count} righe non leggibili esclusi" | filtro §3.3, punto 1/3 |
| `adapter.listenbrainz.warn.tooOldSkipped` | "{count} ascolti anteriori al 2001 esclusi" | E.LB.17 |
| `adapter.listenbrainz.warn.noTitleSkipped` | "{count} ascolti senza titolo esclusi" | filtro §3.3, punto 4 |
| `adapter.listenbrainz.warn.durationMissing` | "{count} ascolti senza durata: il brano non è distinguibile dalle sue versioni alternative" | E.LB.1, aggregato |
| `adapter.listenbrainz.info.libraryDeferred` | "I tuoi like e le registrazioni fissate non sono inclusi in questo import (in arrivo)" | E.LB.16 |
| `adapter.listenbrainz.info.exportNotSnapshot` | "L'export di ListenBrainz è generato in modo asincronico: un import successivo può aggiungere ascolti, ma non rimuove quelli che hai cancellato sul sito" | E.LB.15, fine import |
| `adapter.listenbrainz.info.complete` | "Import completato: {events} eventi, {tracks} brani unici" | fine import |

## 10. Note di implementazione

- **Scanner JSONL dedicato** (D3): il `JsonArrayScanner` esistente (`adapters/jsonStream.ts`) è uno scanner di **array JSON** e non va bene per JSONL. Serve un nuovo modulo in `packages/core/src/adapters/` con:
  - memoria limitata a **una riga** (basta un buffer incrementale finché la riga è completa)
  - gestione di righe vuote e di un eventuale BOM sul primo file
  - tolleranza a una riga JSON malformata: **non** deve abortire lo stream — la riga viene scartata con warning e il parsing continua (un export con una riga corrotta non deve perdere tutto lo storico)
  - `end()` coerente: righe rimaste nel buffer senza terminatore → `AdapterError` `TRUNCATED`, `recoverable: true`
- **Estrazione ZIP**: `fflate` (già dipendenza di `@ls/core`). Pattern degli adapter esistenti: `listZipEntries` per la detection (solo central directory, nessuna decompressione) e `extractZipEntry` per il contenuto, **un file per volta** → memoria di picco limitata a un mese di ascolti
- **Nessuna dipendenza nuova**: a differenza di `papaparse` per Apple (D5 di `apple-music.md` v1.0), qui il formato è JSONL e lo scanner è fatto in casa — stessa scelta di `jsonStream.ts` per Story 1.1
- **Costanti**: `LISTEN_MINIMUM_TS = 1033430400` (2001-12-03, dalla costante `LISTEN_MINIMUM_TS` del server)
- **Nessuna chiamata di rete**: l'adapter è **file-only** nella 1.3. Nessun rate limit applicabile, nessun User-Agent, nessun token
- **`fflate` per lo ZIP**: la ricostruzione dell'archivio in memoria nei test usa `fflate.zipSync` con date fisse → archivio deterministico
- **Estensione futura (Story 1.5)**: il percorso `/listens` con `max_ts` produrrà gli stessi `RawListenEvent`; servirà un metodo `parseRemote?()` sul contratto adapter (`05§4`) — **decisione D-LF.8 di `03-ADAPTERS/lastfm.md`**, che richiede un ADR-0010. Finché l'ADR non esiste, la 1.5 non può implementare il percorso `/listens`
- **Enrichment**: fuori adapter. La 1.3 produce `Track.mbid` e `Track.isrc` nativi → l'enrichment (Story 4.2) potrà arricchire i brani che restano senza identificativo

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 47 (2026-10-26) | Prima stesura (issue #145). Decisioni D-LB.1…D-LB.5 chiuse con il Boss; API e formato export verificati su sorgente e doc ufficiali. Correzione di una premessa errata: `recording_msid` **non** è un identificativo univoco per singolo ascolto (è un hash dei metadati) → l'`eventKey` include `listened_at` (D-LB.2). Canale di storico = **export API** (ZIP/JSONL), non paginazione `/listens`: la doc ne sconsiglia l'uso per lo storico completo e il contratto `05§4` resta invariato (D-LB.4) |
| 1.0 | Sessione 47 (2026-10-26) | 🟢 APPROVED · promozione al merge della PR #146 (approvazione Boss) — decisioni D1-D7 chiuse come proposte, nessuna modifica di contenuto |
| 1.1 | Sessione 52 (2026-10-26, issue #155) | **§3.1.3 (nuova)**: i due campi che il contratto `RawListenEvent` non prevedeva e che questa spec richiede — `sourceArtistMbid` (→ `Artist.mbid`, §3.1.2) e `sourceTrackDurationMs` (durata catalogo, **solo hint** sulla `Track`: il bucket DEDUP-3 continua a usare la durata dell'evento, sempre 0, altrimenti uno stesso brano finirebbe in due `Track` distinte, E.LB.2). Entrambi **additivi e opzionali**. Nessuna modifica alle decisioni D-LB.* né alle restanti parti della spec |
