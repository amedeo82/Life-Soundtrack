# 02 — Schema Dati Unificato (eseguibile)

> Status: 🟡 DRAFT
> Versione: 0.1
> Ultima modifica: Sessione 1
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
| Apple | `Play Date UTC` | inizio ascolto | `timestamp = playDate + durationMs` |
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
      country: string | null;  // ISO 3166-1 alpha-2
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
      platformIds: Partial<Record<PlatformId, string>>;
      firstSeenAt: number;
      lastSeenAt: number;
      listenCount: number;     // contatore denormalizzato
    }

    export interface Artist {
      id: string;
      name: string;
      mbid: string | null;
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
      source: 'acousticbrainz' | 'api_freqblog' | 'api_musicae' | 'essentia' | 'manual';
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
    }

## 5. Regole di deduplicazione tracce (DEDUP)

Priorità per `canonicalKey`, valutata al momento dell'upsert:

| # | Regola | canonicalKey |
|---|--------|--------------|
| DEDUP-1 | ISRC presente | `isrc:<ISRC upper>` |
| DEDUP-2 | MBID presente (no ISRC) | `mbid:<mbid>` |
| DEDUP-3 | altrimenti | `fuzzy:<sha1(normalize(name) + '|' + normalize(artistPrincipal))>` |

`normalize(s)`: lowercase → rimuovi feat./ft./with → rimuovi contenuti tra parentesi tonde/quadre → rimuovi punteggiatura → collassa spazi → trim.

Comportamento upsert:
- Se esiste track con stesso canonicalKey → aggiungi platformId, aggiorna lastSeenAt e contatori
- Altrimenti crea nuova track
- Conflitti nome: il nome visualizzato è quello della prima piattaforma importata per ordine di priorità (spotify > apple > tidal > listenbrainz > altro), salvo override utente futuro

Nota: DEDUP-3 può unire registrazioni diverse omonime (rischio accettato, documentato; mitigabile in futuro con durata ±2s nel fuzzy hash).

## 6. Schema Dexie (IndexedDB) — versione 1

    db.version(1).stores({
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
    });

PrimKey: dove non indicato con `&`, Dexie usa la prima chiave; le tabelle con `&x` usano x come chiave primaria unica. `id` espliciti sono UUID generati dal core.

## 7. Politiche di migrazione e ricalcolo

- **MIG-1**: ogni cambio schema = `db.version(n+1).stores({...}).upgrade(tx => ...)`; mai drop di tabelle utente
- **MIG-2**: tabelle derivate (`sessions`, `insights`) sono **ricostruibili**: comando `recompute()` le rigenera da `listens` + `features`
- **MIG-3**: ogni modifica ai parametri di analisi cambia `derivedVersion` (hash del config); insight con version vecchia sono marcati `stale` e ricalcolati al prossimo avvio
- **MIG-4**: i contatori denormalizzati (`listenCount`) sono ricalcolabili con `recount()`; servono solo per performance UI

## 8. Cosa NON è nello schema (decisioni esplicite)

- **Raw payload piattaforma**: non persistito (ADR-0003). Il file dell'utente è la fonte di verità; l'import è ri-eseguibile
- **IP address**: non persistito. L'adapter deriva `country` e lo scarta (privacy-by-design, vedi 09)
- **Coordinate GPS**: mai raccolte
- **Testi/lyrics**: fuori scope

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 1 | Prima versione eseguibile |