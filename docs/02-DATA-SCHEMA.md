# 02 — Schema Dati Unificato (eseguibile)

> Status: 🟢 APPROVED · Versione 1.3 · Sessione 40 (2026-10-21)
> Vincolante per: adapter (03), analisi (04), db (core/db), test (10)

---

## 1. Principi dello schema

1. **Un evento di ascolto è l'atomo**: tutto deriva da `ListenEvent`
2. **Normalizza presto**: i dati grezzi delle piattaforme vivono solo nel file dell'utente; nel DB entra solo il formato unificato (vedi ADR-0003)
3. **Idempotenza**: re-importare lo stesso file non duplica nulla (`eventKey` unico)
4. **Derivati versionati**: sessioni e insight sono ricalcolabili; portano il `derivedVersion` del set di parametri che li ha generati
5. **UTC ovunque**: ogni timestamp è unix millisecondi UTC

## 2. Semantica dei timestamp per piattaforma

| Piattaforma | Campo origine | Semantica | Derivazione in adapter |
|-------------|---------------|-----------|------------------------|
| Spotify | `ts` | fine ascolto | `startedAt = ts - ms_played` |
| YouTube Takeout | `time` | inizio azione | `timestamp = time + durata stimata` (durata da catalogo) |
| Apple | `Event End Timestamp` (Play Activity CSV) | fine segmento di ascolto | `timestamp = Event End Timestamp`, `startedAt = Event Start Timestamp`; legacy: `Play Date UTC` (inizio) → `timestamp = playDate + durationMs` |
| Last.fm | `date` | inizio scrobble | `timestamp = date + durationMs` |
| ListenBrainz | `listened_at` | inizio listen | `timestamp = listened_at*1000 + durationMs` |

Regola: `timestamp` = **momento in cui l'ascolto si conclude**; `startedAt` = inizio. Le analisi temporali usano `startedAt` quando disponibile, altrimenti `timestamp`.

## 3. Interfacce TypeScript (source of truth)

### 3.1 Tipi base

    export type PlatformId =
      | 'spotify' | 'youtube_music' | 'apple_music' | 'deezer'
      | 'tidal' | 'soundcloud' | 'lastfm' | 'listenbrainz'
      | 'plex' | 'navidrome' | 'manual';

    export type DeviceType =
      | 'mobile' | 'desktop' | 'web' | 'speaker'
      | 'car' | 'wearable' | 'tv' | 'unknown';

    export type MoodId =
      | 'sad' | 'angry' | 'neutral' | 'calm' | 'happy' | 'excited';

### 3.2 ListenEvent

    export interface ListenEvent {
      id: string;              // UUID interno
      eventKey: string;        // chiave di idempotenza (UNIQUE)
      platform: PlatformId;
      importId: string;        // FK imports
      timestamp: number;       // unix ms UTC, fine ascolto
      startedAt: number | null;
      durationMs: number;      // ms effettivamente ascoltati
      trackId: string;         // FK tracks
      completed: boolean;      // ascoltato fino alla fine
      skipped: boolean;
      shuffle: boolean | null;
      offline: boolean | null;
      incognito: boolean | null;
      reasonStart: string | null;
      reasonEnd: string | null;
      deviceType: DeviceType;
      deviceDetail: string | null;
      ip: string | null;         // conservato SOLO se PrivacySettings.retainIp
      country: string | null;    // ISO 3166-1 alpha-2, sempre derivato      
      day: string;             // 'YYYY-MM-DD' (derivato, indicizzato)
    }

**eventKey** = `platform + ':' + (sourceEventId ?? sha1(trackId|timestamp|durationMs))`
Calcolato dall'adapter. Garantisce import idempotenti.

### 3.3 Track / Artist / Album

    export interface Track {
      id: string;
      canonicalKey: string;    // UNIQUE — regola DEDUP (§5)
      name: string;
      artistId: string;
      albumId: string | null;
      durationMs: number | null;
      isrc: string | null;
      mbid: string | null;     // MusicBrainz Recording ID
      explicit: boolean | null;
      genres: string[];        // popolato da enrichment (MusicBrainz) o dall'adapter
      /** URL immagine di copertina (lato). vedi §11 fonti */
      artworkUrl: string | null;
      platformIds: Partial<Record<PlatformId, string>>;
      firstSeenAt: number;
      lastSeenAt: number;
      listenCount: number;     // contatore denormalizzato
    }

    export interface Artist {
      id: string;
      name: string;
      mbid: string | null;
      genres: string[];        // popolato da enrichment (MusicBrainz) o dall'adapter
      platformIds: Partial<Record<PlatformId, string>>;
      listenCount: number;
    }

    export interface Album {
      id: string;
      name: string;
      artistId: string;
      mbid: string | null;
      upc: string | null;
      releaseDate: string | null;   // 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'
      /** URL immagine di copertina album (lato). vedi §11 fonti */
      artworkUrl: string | null;
      platformIds: Partial<Record<PlatformId, string>>;
    }

### 3.4 AudioFeatures

    export interface AudioFeatures {
      trackId: string;         // PK
      valence: number | null;          // 0..1 positività emotiva
      energy: number | null;           // 0..1 intensità
      danceability: number | null;
      acousticness: number | null;
      instrumentalness: number | null;
      speechiness: number | null;
      liveness: number | null;
      tempo: number | null;            // BPM
      key: number | null;              // 0-11
      mode: 0 | 1 | null;              // 0=minore 1=maggiore
      loudness: number | null;         // dB
      timeSignature: number | null;
      source: 'acousticbrainz' | 'essentia' | 'heuristic' | 'manual';
      fetchedAt: number;
      schemaVersion: number;
    }

### 3.5 ListeningSession (derivato)

    export interface ListeningSession {
      id: string;
      startTime: number;
      endTime: number;
      durationMs: number;
      eventCount: number;
      trackCount: number;
      platform: PlatformId;
      deviceType: DeviceType;
      gapThresholdMs: number;      // parametro usato (default 1_800_000)
      derivedVersion: string;
    }

### 3.6 Insight (derivato, con verdetto utente)

    export type InsightType =
      | 'mood_day' | 'mood_week' | 'mood_month'
      | 'era' | 'event' | 'memory' | 'pattern';

    export interface Insight {
      id: string;
      type: InsightType;
      periodStart: number;
      periodEnd: number;
      payload: InsightPayload;       // unione discriminata (§4)
      confidence: number;            // 0..1
      derivedVersion: string;
      status: 'pending' | 'confirmed' | 'corrected' | 'dismissed';
      userNote: string | null;
      createdAt: number;
    }

### 3.7 Import, Library, Playlist

    export interface ImportRecord {
      id: string;
      platform: PlatformId;
      fileName: string;
      fileHash: string;              // sha256 del file
      startedAt: number;
      completedAt: number | null;
      status: 'running' | 'done' | 'partial' | 'failed';
      eventsParsed: number;
      eventsInserted: number;
      eventsDuplicated: number;
      warnings: string[];            // codici edge case (E1..E10)
    }

    export interface LibraryItem {
      id: string;
      platform: PlatformId;
      kind: 'saved_track' | 'saved_album' | 'followed_artist';
      trackId: string | null;
      albumId: string | null;
      artistId: string | null;
      addedAt: number | null;
    }

    export interface Playlist {
      id: string;
      platform: PlatformId;
      name: string;
      createdAt: number | null;
      lastModifiedAt: number | null;
    }

    export interface PlaylistItem {
      playlistId: string;
      trackId: string;
      position: number | null;
      addedAt: number | null;
    }

### 3.8 PrivacySettings (toggle espliciti, default off)

    export interface PrivacySettings {
      retainIp: boolean;          // default false; toggle ESPLICITO dell'utente
      enrichMetadata: boolean;    // default false; arricchimento metadati brani
      carDetectionConsent: boolean; // default false; rilevamento ascolti in auto (es. Bluetooth/Battery)
      scrobbleHubs: PlatformId[]; // default []; hub di scrobbling scelti
      syncCloud: boolean;         // default false; sync E2E opzionale (Fase 2, ADR-0005)
    }

Quando `retainIp` è true:
- `ListenEvent.ip` è conservato (string, IPv4/IPv6)
- L'IP resta SOLO nel DB locale, mai inviato in rete
- L'utente può purgarlo in qualsiasi momento (`purgeIp()` azzera tutti gli ip)
- Il `country` è sempre derivato dall'IP al parse e conservato (indipendentemente dal toggle)

Quando `retainIp` è false (default):
- `ListenEvent.ip` è null dopo il parse
- Il `country` è derivato e conservato (privacy-by-design)

Quando `carDetectionConsent` è true (default false):
- L'utente acconsente a eventi `deviceType='car'` rilevati da segnali locali (Bluetooth auto, CarPlay, Android Auto, power profile)
- L'evento resta locale; nessun dato auto-specifico lascia il dispositivo
- Disattivabile in qualsiasi momento

### 3.9 SearchQuery (criteri di ricerca)

    export interface SearchQuery {
      id: string;
      platform: PlatformId;
      query: string;             // testo libero cercato dall'utente
      normalized: string;        // query normalizzata (lowercase, trim) per dedup
      timestamp: number;         // unix ms UTC
      resultCount: number | null; // null se non disponibile
      context: 'manual' | 'browse' | 'recommendation';
    }

Regole di persistenza:
- Solo se `PrivacySettings.enrichMetadata` è true OPPURE il consenso specifico è attivo
- Mai condivisi con terze parti
- Deduplicazione per `(platform, normalized, day)` via indice

## 4. Payload degli Insight (unione discriminata)

    export type InsightPayload =
      | EraPayload | MoodPeriodPayload | EventPayload | MemoryPayload | PatternPayload;

    export interface EraPayload {
      kind: 'era';
      label: string;                    // es. "Era Malinconia"
      moodDominant: MoodId;
      topArtistIds: string[];
      topTrackIds: string[];
      genreDistribution: Record<string, number>;
      avgValence: number;
      avgEnergy: number;
      nightShare: number;               // quota ascolti 00-06
      repeatRate: number;               // quota brani già noti
    }

    export interface MoodPeriodPayload {
      kind: 'mood';
      mood: MoodId;
      avgValence: number;
      avgEnergy: number;
      eventCount: number;
    }

    export interface EventPayload {
      kind: 'event';
      eventType: 'spike_artist' | 'spike_genre' | 'valence_drop' | 'valence_rise'
               | 'volume_spike' | 'volume_drop' | 'exploration' | 'silence';
      description: string;              // frase in linguaggio naturale
      metrics: Record<string, number>;
    }

    export interface MemoryPayload {
      kind: 'memory';
      memoryKind: 'on_this_day' | 'first_time' | 'milestone' | 'return' | 'seasonal';
      trackId: string | null;
      artistId: string | null;
      yearsAgo: number | null;
      text: string;
    }

    export interface PatternPayload {
      kind: 'pattern';
      patternType: 'circadian' | 'weekly' | 'seasonal';
      buckets: Record<string, number>;  // es. ora->quota, giorno->quota, mese->quota
      peakHour: number | null;         // 0..23, in userTimezone (circadian)
      peakDay: number | null;          // 0=Sun..6=Sat, in userTimezone (weekly)
      peakMonth: number | null;        // 1..12, in userTimezone (seasonal)
      nightShare: number | null;       // quota ascolti 00:00-05:59 (userTimezone)
      weekendShare: number | null;     // quota sab+dom (userTimezone)
      userTimezone: string;            // IANA tz, es. 'Europe/Rome'
    }

## 5. Regole di deduplicazione tracce (DEDUP)

Priorità per `canonicalKey`, valutata al momento dell'upsert:

| # | Regola | canonicalKey |
|---|--------|--------------|
| DEDUP-1 | ISRC presente | `isrc:<ISRC upper>` |
| DEDUP-2 | MBID presente (no ISRC) | `mbid:<mbid>` |
| DEDUP-3 | altrimenti | `fuzzy:<sha1(normalize(name) + '\|' + normalize(artistPrincipal) + '\|' + durationBucketMs)>` |

`durationBucketMs = Math.floor(durationMs / 2000) * 2000` (bucket da 2 secondi)

`normalize(s)`: lowercase → rimuovi feat./ft./with → rimuovi contenuti tra parentesi tonde/quadre → rimuovi punteggiatura → collassa spazi → trim.

### Tradeoff di DEDUP-3 con durata (documentato)

- **Pro**: includere la durata riduce drasticamente le fusioni false di brani omonimi ma diversi (radio edit vs album version vs live)
- **Contro**: può separare la stessa registrazione quando la durata differisce tra piattaforme (remaster, rounding ±1-2s)
- **Mitigazione**: DEDUP-1/2 (ISRC/MBID) catturano comunque quelle; il bucket da 2s assorbe il rounding
- **Rischio accettato**: registrazioni omonime con durata identica restano fuse (documentato; mitigabile in futuro con fuzzy a 3 campi: nome+artista+durata+album)

Comportamento upsert:
- Se esiste track con stesso canonicalKey → aggiungi platformId, aggiorna lastSeenAt e contatori
- Altrimenti crea nuova track
- Conflitti nome: il nome visualizzato è quello della prima piattaforma importata per ordine di priorità (spotify > apple > tidal > listenbrainz > altro), salvo override utente futuro

## 6. Schema Dexie (IndexedDB) — versione 1

    db.version(2).stores({
      listens:       '&eventKey, timestamp, startedAt, trackId, platform, day, importId',
      tracks:        '&canonicalKey, name, artistId, albumId, isrc, mbid',
      artists:       '&id, name, mbid',
      albums:        '&id, name, artistId',
      features:      '&trackId, source',
      sessions:      '&id, startTime, platform, derivedVersion',
      insights:      '&id, type, periodStart, derivedVersion, status',
      imports:       '&id, platform, fileHash, startedAt',
      library:       '&id, trackId, artistId, albumId, platform',
      playlists:     '&id, platform',
      playlistItems: '&[playlistId+trackId], playlistId, addedAt',
      searchQueries: '&id, platform, timestamp, [platform+normalized]',
    });

Migrazione v1→v2: aggiunge `searchQueries`; nessuna modifica distruttiva a tabelle esistenti. Le colonne `genres` su `tracks`/`artists` sono nullable e backfill opzionale via enrichment.

PrimKey: dove non indicato con `&`, Dexie usa la prima chiave; le tabelle con `&x` usano x come chiave primaria unica. `id` espliciti sono UUID generati dal core.

## 7. Politiche di migrazione e ricalcolo

- **MIG-1**: ogni cambio schema = `db.version(n+1).stores({...}).upgrade(tx => ...)`; mai drop di tabelle utente
- **MIG-2**: tabelle derivate (`sessions`, `insights`) sono **ricostruibili**: comando `recompute()` le rigenera da `listens` + `features`
- **MIG-3**: ogni modifica ai parametri di analisi cambia `derivedVersion` (hash del config); insight con version vecchia sono marcati `stale` e ricalcolati al prossimo avvio
- **MIG-4**: i contatori denormalizzati (`listenCount`) sono ricalcolabili con `recount()`; servono solo per performance UI

## 8. Cosa NON è nello schema (decisioni esplicite)

- **Raw payload piattaforma**: non persistito (ADR-0003). Il file dell'utente è la fonte di verità; l'import è ri-eseguibile
- **IP address**: non persistito DI DEFAULT. Conservato SOLO con toggle esplicito `PrivacySettings.retainIp`; mai inviato in rete; purgabile con `purgeIp()`. Il `country` è sempre derivato e conservato
- **Coordinate GPS**: mai raccolte
- **Testi/lyrics**: fuori scope

## 9. Schema Dexie — indici aggiuntivi

L'aggiunta di `artworkUrl` su `Track` e `Album` (§3.3) non richiede nuovi indici: il campo è letto solo insieme all'entità stessa. **Nessuna modifica a Dexie schema v2.**

## 10. Migrazione v2 → v3 (per Track.artworkUrl / Album.artworkUrl)

`artworkUrl` è nullable. La migrazione aggiunge il campo `null` a tutti i record esistenti senza ricalcolo. Da `db.version(3).stores({...}).upgrade(tx => tx.table('tracks').toCollection().modify(t => { t.artworkUrl = t.artworkUrl ?? null; }))` (idem per albums).

Migrazione **non distruttiva** (MIG-1). Implementazione attesa nella Story 0.7 (Operations runbook + manutenzione) o in un mini-task di Story 0.2 se Dexie v2→v3 viene aperto subito.

## 11. Artwork (copertina album/track): fonti e popolamento

Il campo `artworkUrl` su Track/Album (§3.3) **non è popolato dall'import**: l'export GDPR delle piattaforme (es. Spotify) non contiene URL di copertina, e l'utente non ha un consenso esplicito per fetch remoti al momento dell'import. Il popolamento è demandato alla pipeline di enrichment (Fase 2), rispettando `PrivacySettings.enrichMetadata`.

**Fonti in ordine di priorità** (cascata, come `05-ARCHITECTURE §6` per le audio features):

| # | Fonte | Quando | Note |
|---|-------|--------|------|
| 1 | **Spotify Web API** (`/v1/tracks/{id}` campo `album.images[0].url`) | Dopo import Spotify, se l'utente ha effettuato OAuth Dev Mode (Fase 2+, vedi D.A.11) | Richiede `PrivacySettings.enrichMetadata=true` + token utente |
| 2 | **MusicBrainz Cover Art Archive** (`/release/{mbid}/cover-art`) | Quando il Track o l'Album ha `mbid` valorizzato (da ListenBrainz import o enrichment) | No chiave API richiesta, rate limit `1 req/s` |
| 3 | **iTunes Search API** (`/search?term=...&entity=song`) | Fallback se Spotify non disponibile (es. utenti Apple/Last.fm-first) | No autenticazione, no rate limit stretto; ricerca per `name+artist` |
| 4 | **Placeholder** (gradient + mood color) | Se tutte le fonti falliscono | Generato lato UI, non persistito |

**Regole di persistenza**:
- `artworkUrl` è un URL HTTPS assoluto (no path relativi)
- Se la copertina cambia su Spotify (es. album reissue), `artworkUrl` viene aggiornato al prossimo enrichment
- L'arricchimento è **lazy**: popolato on-import + on-demand (schermata che richiede artwork) + scheduled idle (vedi `05-ARCHITECTURE §6.1`)
- **No logo piattaforma**: `artworkUrl` è solo artwork di copertina del brano/album; i loghi commerciali sono vietati (D.6.4)
- **Cache**: nessuna tabella dedicata; l'URL è direttamente su Track/Album (è un singolo valore, no LRU)

Task di implementazione previsti in **Story 4.3 — Artwork enrichment** (aggiunta in Sessione 13, vedi `11-BACKLOG §4`).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 1 | Prima versione eseguibile |
| 1.0 | Sessione 1 | 🟢 APPROVED · Versione 1.0 · Sessione 1 |
| 1.1 | Sessione 9 (2026-10-15) | Audit: `genres: string[]` su Track/Artist (D.A.2); `carDetectionConsent` in PrivacySettings (C1); tabella `searchQueries` + interfaccia (D.A.3); `AudioFeatures.source` ripulito a `{acousticbrainz, essentia, heuristic, manual}` (D.A.6); schema Dexie portato a v2; `PatternPayload` esteso con `peakHour`, `peakDay`, `peakMonth`, `nightShare`, `weekendShare`, `userTimezone` (M6/M7) |
| 1.2 | Sessione 13 (2026-10-16) | **M5 audit chiuso**: `artworkUrl: string \| null` aggiunto a Track e Album (§3.3); nuova sezione §11 Artwork (fonti e popolamento: Spotify Web API → MusicBrainz Cover Art Archive → iTunes Search → placeholder gradient); pianificata migrazione non distruttiva v2→v3 (§10); Story 4.3 aggiunta al backlog per l'implementazione |
| 1.3 | Sessione 40 (2026-10-21, issue #98) | §2: riga Apple aggiornata al formato reale dell'export (schema 2026.2: `Event Start/End Timestamp` del Play Activity CSV; `Play Date UTC` era del legacy aggregato). **Aggiornamento factuale**: nessuna modifica a interfacce (§3), regole DEDUP (§5) o schema Dexie (§6) |