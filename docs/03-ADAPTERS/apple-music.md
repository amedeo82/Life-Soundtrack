# Adapter Apple Music

> Status: 🟡 DRAFT · Versione 0.1 · Ultima modifica: Sessione 40 (2026-10-21)
> Piattaforma: Apple Music (Apple Inc.)
> Sede legale: USA
> Tier: **A** · Priorità MVP: **sì**
> Spec collegata a: Story 1.2 (`11-BACKLOG.md`), `01-PLATFORMS.md` §3.3

---

## 1. Metodi di accesso

| Canale | Disponibile | Formato output | Frequenza | Note |
|--------|:-----------:|----------------|-----------|------|
| Export GDPR | ✅ | CSV in ZIP (Apple Privacy Portal) | Manuale | "Apple Media Services information" → cartella `Apple Music Activity/` |
| API pubblica | ❌ | — | — | MusicKit: nessun accesso alla cronologia di ascolto |
| Scrobbling LB/L.fm | ✅ | — | Continuo | via scrobbler di terze parti; gestito da Story 1.5 |

**Canale principale MVP**: Apple Privacy Portal. Non esiste alcun canale API per la cronologia di ascolto.

**Cosa offre l'export 2026** (schema `2026.2`, ~143 colonne in `Apple Music Play Activity.csv`) — **molto più ricco di quanto censito in `01-PLATFORMS.md` §3.3 v0.2**: durata ascoltata (`Play Duration Milliseconds`), durata catalogo (`Media Duration In Milliseconds`), motivo fine (`End Reason Type`), shuffle/offline (`Shuffle Play`/`Offline`), dispositivo (`Device Type`, `Build Version`), Event ID stabile. **Cosa non offre**: ISRC/MBID, ID traccia stabile; la colonna `Artist Name` è **assente** negli export 2026 (presente nei legacy).

## 2. Flusso di import

[Stato iniziale] → [Rilevamento formato] → [Parsing streaming CSV] → [Filtro eventi (scrub/<30s/senza titolo)] → [Normalizzazione] → [Upsert DB]

### 2.1 Come l'utente procura il file

1. `privacy.apple.com` → **Get a copy of your data**
2. Selezionare **"Apple Media Services information"** (le altre categorie non servono e gonfiano l'export)
3. Confermare → attesa da 1 giorno a ~1 settimana (email con link)
4. Scaricare **tutte le parti ZIP** se Apple divide l'archivio ("… Part 1 of N.zip")

Struttura dell'archivio (i nomi sono stabili in inglese, verificato 2026):

```
<ZIP esterno>
  Apple_Media_Services.zip          ← ZIP annidato, da espandere ricorsivamente (≤5 livelli)
    Apple Media Activity/           ← denominazione varia per data di export
      Apple Music Play Activity.csv                 ← log eventi (fonte primaria)
      Apple Music - Play History Daily Tracks.csv   ← aggregato giornaliero (fonte secondaria, D1)
      Apple Music - Track Play History.csv
      Apple Music - Recently Played Tracks.csv
      Apple Music Library Tracks.json.zip           ← libreria (fuori scope MVP)
      Apple Music Likes and Dislikes.csv / …
```

### 2.2 Rilevamento formato (`detect`)

- **ZIP (uno o più parti)**: fusione in memoria degli archivi, **espansione ricorsiva dei ZIP annidati** (fino a 5 livelli — Apple incapsula spesso `Apple_Media_Services.zip`), poi ricerca per **filename case-insensitive** a qualsiasi profondità:
  - `Apple Music Play Activity.csv` → **richiesto** (fonte primaria)
  - `Apple Music - Play History Daily Tracks.csv` → opzionale (fonte secondaria, §3.4)
- **CSV singolo**: accettato se l'header contiene il sottoinsieme richiesto (§3.1, dopo risoluzione alias §10)
- **Rifiuta**: altri CSV dell'archivio (es. `Click Activity`), file senza le colonne minime → `detect.fail` con guida all'utente
- I nomi file sono **stabili in inglese** a prescindere dalla lingua dell'account (differenza chiave da Google Takeout, che localizza i path)

### 2.3 Parsing

- **PapaParse in streaming** (row mode): l'export può superare le 100k righe; encoding UTF-8 (BOM tollerato), delimitatore sniffed
- **Fusione multi-part**: le righe di tutte le parti ZIP vengono trattate come un unico stream; l'idempotenza via `eventKey` deduplica le sovrapposizioni tra export ripetuti
- **Aliasing colonne** (§10): export legacy (2015-2021, es. `Content Name`/`Artist Name`/`Store Country Name`) e 2026.2 (`Song Name`/`Artist Name` assente/`ISO Country`) mappati su campi canonici
- **Filtro eventi** (§3.3): solo le righe candidate-ascolto diventano ListenEvent; il resto è scartato con contatori

## 3. Mapping campi sorgente → unificato

> **Schema di riferimento**: `02-DATA-SCHEMA.md` v1.1 — `ListenEvent` **piatto** con `trackId` come FK; i metadati del brano vivono sull'entità `Track` separata.
>
> **Semantica temporale**: la riga Apple di `02§2` cita `Play Date UTC` (campo dell'export legacy, assente nello schema 2026.2). L'export attuale fornisce `Event Start/End Timestamp` (ISO 8601 UTC con millisecondi): `timestamp` = **fine del segmento di ascolto**, `startedAt` = inizio. Aggiornamento factuale della riga `02§2` in questa PR (la regola `timestamp = fine ascolto` resta invariata).

### 3.1 ListenEvent (top-level, piatto — vedi `02§3.2`)

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `eventKey` | `Event ID` | string | `'apple_music:' + Event ID` | **Stabile e univoco per riga** → idempotenza perfetta anche multi-export. Fallback (export legacy senza `Event ID`): `sha1(trackKey + '\|' + endTs + '\|' + playDuration)` |
| `platform` | (fisso) | `PlatformId` | `'apple_music'` | — |
| `importId` | (interno) | uuid | generato al parse | FK a `imports` |
| `timestamp` | `Event End Timestamp` | ISO 8601 UTC | `Date.parse(endTs)` → unix ms | **Fine segmento di ascolto** (riga `PLAY_END`) |
| `startedAt` | `Event Start Timestamp` | ISO 8601 UTC | `Date.parse(startTs)`; assente → `timestamp - durationMs` | Inizio segmento |
| `durationMs` | `Play Duration Milliseconds` | int | diretto | Millisecondi **effettivamente ascoltati** (non la durata del brano) |
| `trackId` | (interno) | uuid | **risolto dal core via DEDUP** (`02§5`) | adapter emette metadati §3.1.1 |
| `completed` | `durationMs` + `Media Duration In Milliseconds` | bool | `durationMs >= mediaDuration - 5000` | Durata catalogo **presente nell'export** (a differenza di YT Music) |
| `skipped` | `End Reason Type` + durate | bool \| null | regola §3.3 | `NATURAL_END_OF_TRACK` → false; skip espliciti → true; ignoti → soglia 80% |
| `shuffle` | `Shuffle Play` | bool \| null | diretto | 2026.2; legacy → null |
| `offline` | `Offline` | bool \| null | diretto | presente in entrambe le epoche |
| `incognito` | — | — | `null` | Assente |
| `reasonStart` | `Event Reason Hint Type` | string \| null | raw | enum Apple |
| `reasonEnd` | `End Reason Type` | string \| null | raw | enum Apple (es. `NATURAL_END_OF_TRACK`, `MANUALLY_SELECTED_PLAYBACK_OF_A_DIFF_ITEM`, `SCRUB_BEGIN`) |
| `deviceType` | `Device Type` / `Build Version` | `DeviceType` | mapping §3.2 | 2026.2 esplicito; legacy derivato da `Build Version` |
| `deviceDetail` | `Device OS Name + Device OS Version` / `Build Version` | string \| null | raw | es. "iOS 18.2" / "Music/3.1 iOS/13.0 model/iPhone9,3" |
| `ip` | `Client IP Address` | string \| null | **SOLO se `PrivacySettings.retainIp` true** | mai inviato in rete; `IP City/Region/Latitude/Longitude` scartati SEMPRE (§7, D4) |
| `country` | `ISO Country` / `Store Country Name` | string \| null | `ISO Country` se ISO 3166-1 alpha-2 valido; altrimenti null | derivato anche se `ip` scartato; **senza passare dall'IP** |
| `day` | (derivato) | `YYYY-MM-DD` | da `timestamp` UTC | indice critico |

**Colonne mai persistite** (whitelist approach — l'export ne ha ~143): `Apple ID Number`, `Metrics Client ID`, `Metrics Bucket Id`, `Subscription User ID`, `Device Identifier` (hardware ID), `Evaluation Variant` (JSON), `IP City/Region/Latitude/Longitude`, `Referral ID`, e ogni colonna non mappata.

### 3.1.1 Track (entità separata — vedi `02§3.3`)

| Campo Track | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-------------|----------------|---------------|----------------|------|
| `name` | `Song Name` (alias: `Content Name` legacy) | string | `normalize(name)` (`02§5`); vuoto → **skip evento** con warning | — |
| `artistId` | `Artist Name` (legacy) → `Container Artist Name` (2026) → mappa Daily Tracks (§3.4) → `"Unknown"` | string | risolto da `artists` (dedup per nome normalizzato) | Catena di fallback D3; il Container Artist è l'artista del contenitore (playlist/pagina artista), approssimazione dichiarata |
| `albumId` | `Album Name` | string \| null | risolto da `albums` (dedup per nome+artistId); null se assente | Spesso "Titolo - Single": mantenuto raw, solo la **chiave** è normalizzata (E.AP.6) |
| `durationMs` | `Media Duration In Milliseconds` | int \| null | diretto | **Durata catalogo** → DEDUP-3 con bucket reale (migliore di YT) |
| `isrc` | — | — | `null` | Enrichment futuro (Story 4.2) |
| `mbid` | — | — | `null` | Enrichment futuro |
| `genres` | `Genre` | string[] | `[genre]` se presente (legacy); vuoto in 2026.2 | Enrichment per il resto |
| `artworkUrl` | — | — | `null` | Enrichment (Story 4.3: cascata con iTunes Search) |
| `platformIds` | — | — | `{}` (vuoto) | L'export non ha ID traccia stabile (`Shelf Content Identifier` inaffidabile, ~0.5% righe) |

### 3.1.2 Artist / Album (entità separate — vedi `02§3.3`)

L'adapter emette `{name, platformIds?}` per Artist (`platformIds` vuoto: nessun ID nell'export) e `{name, artistId, mbid: null, platformIds: {}}` per Album quando `Album Name` è presente. Il core fa upsert con dedup per nome normalizzato (Artist) o nome+artistId (Album).

### 3.2 Library / Playlist (vedi `02§3.7`)

**Fuori scope adapter MVP** (differite post-MVP, come YT Music):

| Entità | Sorgente Takeout Apple | Blocco tecnico |
|--------|------------------------|----------------|
| LibraryItem `saved_track` | `Apple Music Library Tracks.json.zip` (JSON annidato in ZIP) | Fuori dagli AC della Story 1.2; formato JSON in ZIP aggiunge dipendenze di parsing |
| Playlist / PlaylistItem | `Apple Music Library Playlists` / `Library Activity` | Identificatori interni non joinabili con il Play Activity |

Segnalazione: `info.libraryDeferred`.

### 3.3 Filtro eventi (edge case E.AP.1/E.AP.5) — decisione D2

Il Play Activity è un **event stream** (play/pause/resume/scrub), non una lista di ascolti. Regola MVP (1 riga = 1 evento):

```
isCandidateRow(r):
  1. r.eventType ∈ { 'PLAY_END', <assente/legacy> }         → candidata (altre tipologie: scartate)
  2. r.endReasonType === 'SCRUB_BEGIN'                      → scartata (Play Duration = distanza di jump,
                                                               non tempo ascoltato) + warning scrubSkipped
  3. r.playDurationMs < 30000                               → scartata + warning shortSkipped
     (30s: sotto-soglia, brani molto corti inclusi se quasi interi: durationMs >= mediaDuration - 5000)
  4. r.songName vuota                                       → scartata + warning noTitleSkipped
     (ident jingle radio, voiceover, contenuto senza titolo)
  5. altrimenti                                             → ListenEvent
```

**Regola `skipped` derivata**:

    isSkipped = endReasonType ∈ { 'MANUALLY_SELECTED_PLAYBACK_OF_A_DIFF_ITEM', 'SCRUB_BEGIN' }
             OR (endReasonType ∈ { null, 'NOT_SPECIFIED' } AND durationMs < mediaDuration * 0.80)
    NATURAL_END_OF_TRACK → false; valori enum ignoti → regola della soglia

**Bias dichiarato (E.AP.1)**: pause/riprese generano righe PLAY_END multiple → lo stesso ascolto continuo può contare più eventi. Il stitching dei segmenti è **differito** a un job di normalizzazione futuro (fuori adapter MVP, come la correzione temporale YT); la riconciliazione Daily Tracks (§3.4) rende il bias visibile all'utente.

### 3.4 Fonte secondaria: `Apple Music - Play History Daily Tracks.csv` (decisione D1)

Il file è un **aggregato giornaliero** (`Date Played` YYYYMMDD o ISO, `Track Description` "Artista - Brano", `Play Duration Milliseconds`, `Play Count`). **Non è joinabile per-riga** con il Play Activity (nessuna chiave condivisa) → viene usato SOLO per:

1. **Mappa candidati-artisti**: `Track Description` splittato alla **prima occorrenza di `" - "`** (con spazi) → `{songName, artistName}`; si costruisce `normalize(songName) → artistName` **solo se l'artista è univoco** per quel brano in tutto il file (in caso di ambiguità: nessuna associazione). La mappa entra nella catena di risoluzione artista di §3.1.1 (dopo `Container Artist Name`, prima di `"Unknown"`)
2. **Riconciliazione conteggi**: `Σ(Play Count ?? 1)` su Daily Tracks vs numero di eventi importati; se lo scostamento relativo supera il 10% → warning informativo `warn.reconciliationMismatch` con entrambe le cifre (espone il bias E.AP.1 e le lacune di retention)

**MAI importato come ListenEvent** (doppio conteggio con il Play Activity). La colonna `Play Count` non alimenta i contatori delle Track.

## 4. Edge case noti

Copia da `01-PLATFORMS.md` §5 (piattaforma Apple) + edge case specifici emersi in Sessione 40.

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E9 | *(retificato)* l'export 2026 HA durata/skip/shuffle/device — il limite vale solo per l'export legacy aggregato | Analisi comportamentale ora possibile | Mapping §3.1; legacy degradato via alias |
| E10 | Fusi orari: `Event Start/End Timestamp` UTC con ms; `UTC Offset In Seconds` separato | Timeline sfalsata | Normalizzazione a UTC al parse; `day` UTC (schema) |
| E.AP.1 | Event stream ≠ ascolti (pause/resume → righe multiple) | Conteggi sovrastimati | 1 riga ≥30s = 1 evento (D2); bias documentato; riconciliazione §3.4; stitching differito |
| E.AP.2 | `Artist Name` **assente** nello schema 2026.2 (~143 colonne); `Container Artist Name` sparse | Artisti Unknown di massa | Catena di fallback D3 + mappa Daily Tracks + enrichment (Story 4.2) |
| E.AP.3 | Due generazioni di schema (legacy `Content Name`/`Artist Name` vs 2026.2 `Song Name`/no artist) | Parsing errato | Tabella alias canonica (§10) con risoluzione per-preset |
| E.AP.4 | ZIP annidato (`Apple_Media_Services.zip` dentro lo ZIP privacy) + archivio diviso in N parti | File non trovato | Espansione ricorsiva ≤5 livelli + fusione multi-part (§2.2) |
| E.AP.5 | Righe scrub: `Play Duration` = distanza di jump | Durate assurde | Esclusione esplicita `SCRUB_BEGIN` (§3.3) |
| E.AP.6 | `Album Name` spesso "Titolo - Single" | Album frammentati vs versioni album | Nome raw, chiave normalizzata; DEDUP via enrichment |
| E.AP.7 | Radio: brani da stazioni da importare, idents/voiceover senza titolo | Falsi eventi | Filtro §3.3 (songName vuota → skip+warning) |
| E.AP.8 | Ogni export è uno snapshot; re-import e parti multiple sovrappongono eventi | Duplicati | `eventKey = Event ID` idempotente |
| E.AP.9 | ~143 colonne, molte con PII latente (ID Apple, Metrics ID, coordinate) | Leak di dati | Whitelist di mapping: solo le colonne di §3.1 entrano nel DB |

## 5. Semantica temporale

- `Event Start Timestamp` = inizio del segmento di ascolto; `Event End Timestamp` = **fine del segmento** (riga `PLAY_END`)
- `timestamp` (unificato) = `Event End Timestamp` (coerente con la regola `02§2`: fine ascolto)
- `startedAt` = `Event Start Timestamp`; assente → `timestamp - durationMs`
- `durationMs` = `Play Duration Milliseconds` (tempo effettivo, non posizione nel brano)
- Differenza dalla riga `02§2` corrente: `Play Date UTC` appartiene all'export legacy aggregato, non allo schema 2026.2 → riga aggiornata in questa PR (aggiornamento factuale, la regola non cambia)

## 6. Dedup tracce

- L'export **non fornisce ISRC né MBID** né ID traccia stabili → **DEDUP-3** (fuzzy name+artist) con **bucket reale** grazie a `Media Duration In Milliseconds` (non degradato come YT)
- La catena di risoluzione artista (D3) riduce la frammentazione artisti; il rischio residuo è la fusione di omonime con durata simile (tradeoff `02§5` accettato)
- Promozione post-enrichment: job `rekey()` (Story 1.4) quando MusicBrainz trova ISRC/MBID

## 7. Comportamento privacy

| Dato sensibile | Default | Note |
|----------------|---------|------|
| `Client IP Address` | scartato dopo nulla (il `country` NON deriva dall'IP) | conservato SOLO con `retainIp=true` (regola Spotify) |
| `IP City/Region/Latitude/Longitude` | **sempre scartati** | più sensibili dell'IP stesso; nessun campo nello schema, nessun toggle → scarto incondizionato (D4) |
| `Device Identifier` | sempre scartato | hardware ID persistente |
| `Apple ID Number`, `Subscription User ID`, `Metrics *` | sempre scartati | identificativi account/telemetria |
| `ISO Country` / `Store Country Name` | conservato in `country` | derivato **senza** passare dall'IP (privacy-by-design) |
| Coordinate GPS | mai raccolte dall'adapter | — |

## 8. Test — fixture attese

File atteso: `fixtures/synthetic-history/apple-music-sample.csv` (**creato nella Story 1.2**, generato in modo deterministico secondo `10-TESTING.md` §3.5). Questa spec definisce i casi che il fixture deve coprire.

Casi di test minimi:

1. **Happy path**: 3 righe `PLAY_END` ben formate (schema 2026.2) → 3 ListenEvent, 3 track, `durationMs` reale
2. **Idempotenza**: re-import dello stesso file → `eventsDuplicated = 3` (via `Event ID`)
3. **Skip esplicito**: `End Reason Type = MANUALLY_SELECTED_PLAYBACK_OF_A_DIFF_ITEM` → `skipped = true`
4. **Skip da soglia**: `End Reason Type = NOT_SPECIFIED`, `durationMs < 80% mediaDuration` → `skipped = true`
5. **Completed**: `NATURAL_END_OF_TRACK` con `durationMs >= mediaDuration - 5000` → `completed = true`
6. **E.AP.5 scrub**: riga `SCRUB_BEGIN` con `Play Duration` grande → scartata, warning
7. **E.AP.1 sotto-soglia**: riga con `Play Duration < 30s` → scartata, warning
8. **E.AP.2 artista**: riga senza `Artist Name` con `Container Artist Name` → artista dal container; senza container ma brano presente in Daily Tracks (univoco) → artista dalla mappa; altrimenti `"Unknown"`
9. **E.AP.3 legacy**: righe con `Content Name`/`Artist Name`/`Store Country Name` → alias risolti, eventi importati
10. **E.AP.4 ZIP**: ZIP con `Apple_Media_Services.zip` annidato + parte 2 → tutti gli eventi importati una volta sola
11. **Privacy retainIp=false**: `ip = null`, `country` da `ISO Country`; colonne geo assenti dal DB
12. **Privacy retainIp=true**: `ip` conservato; lat/long comunque assenti
13. **E10 fuso**: eventi a cavallo di mezzanotte con offset locale → `day` UTC corretto
14. **E.AP.7 radio**: riga da stazione radio con titolo → importata; ident senza titolo → scartata
15. **Riconciliazione**: `Σ Play Count` Daily Tracks ≠ eventi (±>10%) → warning `warn.reconciliationMismatch`
16. **DEDUP**: due righe stesso brano (segmenti diversi) → una sola Track (bucket reale)

## 9. Segnalazione all'utente

Codici i18n (`08-COPY-I18N.md`) usati dall'adapter — namespace `adapter.apple_music.*` (allineato a `PlatformId`; `08§2.12` prevede già "analoghi per apple" — chiavi da aggiungere in Story 1.2):

| Codice i18n | Messaggio (IT) | Quando |
|-------------|----------------|--------|
| `adapter.apple_music.detect.success` | "File Apple Music riconosciuto" | detect ok |
| `adapter.apple_music.detect.fail` | "File non riconosciuto come export Apple Media Services" | detect ko |
| `adapter.apple_music.warn.scrubSkipped` | "{count} eventi di scrubbing esclusi" | E.AP.5 |
| `adapter.apple_music.warn.shortSkipped` | "{count} frammenti sotto i 30 secondi esclusi" | E.AP.1 |
| `adapter.apple_music.warn.noTitleSkipped` | "{count} eventi senza titolo esclusi (jingle/ident radio)" | E.AP.7 |
| `adapter.apple_music.warn.reconciliationMismatch` | "Riconciliazione: {daily} ascolti stimati da Apple, {events} eventi importati (pause e riprese possono contare doppio)" | §3.4 |
| `adapter.apple_music.info.libraryDeferred` | "La libreria Apple Music non è inclusa in questo import (in arrivo)" | §3.2 |
| `adapter.apple_music.info.complete` | "Import completato: {events} eventi, {tracks} brani unici" | fine |

## 10. Note di implementazione

- **PapaParse streaming** (già stack-adjacent: zero deps pesanti; row mode + `step` per grandi file); mai caricare il CSV intero
- **Tabella alias canonica** (E.AP.3), risolta a colonna:

| Canonico | 2026.2 | Legacy (2015-2021) |
|----------|--------|---------------------|
| songName | `Song Name` | `Content Name` |
| artistName | *(assente)* | `Artist Name` |
| containerArtist | `Container Artist Name` | *(assente)* |
| albumName | `Album Name` | `Album Name` |
| playDurationMs | `Play Duration Milliseconds` | `Play Duration Milliseconds` |
| mediaDurationMs | `Media Duration In Milliseconds` | `Media Duration In Milliseconds` |
| endTs / startTs | `Event End/Start Timestamp` | `Event End/Start Timestamp` |
| endReason | `End Reason Type` | `End Reason Type` |
| country | `ISO Country` | `Store Country Name` (solo alpha-2 accettato, altrimenti null) |
| deviceDetail | `Device OS Name + Version` | `Build Version` |
| eventId | `Event ID` | *(assente → sha1 fallback)* |

- **Espansione ZIP**: riusare `fflate` (già dipendenza di `@ls/core` per lo ZIP Spotify); espansione ricorsiva ≤5 livelli + fusione multi-part in memoria
- **Soglie come costanti**: `MIN_PLAY_MS = 30000`, `COMPLETION_TOLERANCE_MS = 5000`, `SKIP_RATIO = 0.80`, `RECONCILIATION_TOLERANCE = 0.10`
- **Mappa Daily Tracks**: costruita prima del mapping Play Activity; regola unicità (un solo artista per brano normalizzato in tutto il file) — mai match fuzzy
- **Whitelist colonne**: il mapper legge SOLO le colonne canoniche; ogni altra colonna (143 nel 2026) non lascia il parser (E.AP.9)
- **Rate limit**: n/a (import locale, nessuna chiamata di rete)
- **Enrichment artista completo** (iTunes Search/MusicBrainz): fuori adapter, Story 4.2/4.3

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 40 (2026-10-21) | Prima stesura (issue #98). Decisioni D1-D4 chiuse con il Boss; formato Apple 2026.2 verificato su fonti 2026. Promozione a 🟢 APPROVED al merge della PR di approvazione |
