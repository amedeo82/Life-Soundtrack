# 02 — Schema Dati Unificato (eseguibile)

> Status: 🟢 APPROVED · Versione 1.7 · Sessione 68 (2026-10-31)
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
| Last.fm | `date` | inizio scrobble | `timestamp = startedAt = date.uts*1000`; `durationMs` = 0 (costante) — la durata **non è disponibile** in `getRecentTracks` (esiste solo in `track.getInfo`, 1 chiamata per brano) |
| ListenBrainz | `listened_at` | inizio listen | `timestamp = startedAt = listened_at*1000`; `durationMs` = 0 (costante) — la durata **ascoltata** è sconosciuta e `additional_info.duration_ms` (opzionale, durata catalogo) va solo sulla `Track` come hint, mai nel bucket DEDUP-3 |

Regola: `timestamp` = **momento in cui l'ascolto si conclude**; `startedAt` = inizio. Le analisi temporali usano `startedAt` quando disponibile, altrimenti `timestamp`.

**Deroghe dichiarate** (fonti senza durata affidabile — la regola "fine ascolto" non è applicabile):

- **YouTube Takeout**: il Takeout non fornisce la durata e il catalogo non è ancora disponibile all'import → `timestamp = startedAt = time`, `durationMs = 0`. Bias dichiarato in `03-ADAPTERS/youtube-music.md` §5; ricalcolo post-enrichment come contratto.
- **ListenBrainz**: `additional_info.duration_ms` è **opzionale** e rappresenta la durata *catalogo*, non quella ascoltata. Applicare la regola alla lettera produrrebbe due semantiche temporali diverse nello stesso import (fine dell'ascolto quando il dato c'è, inizio quando manca) e sposterebbe il confine `day` per una parte degli eventi. Si adotta una semantica **uniforme**: `timestamp = startedAt = listened_at*1000`, `durationMs = 0`. Dettagli in `03-ADAPTERS/listenbrainz.md` §5.
- **Last.fm**: `getRecentTracks` **non espone la durata** (il campo `duration` esiste solo in `track.getInfo`, una chiamata per brano — incompatibile con 50k+ scrobble). Con `durationMs = 0` la regola "fine ascolto" dà `timestamp = date` = inizio, quindi la formula **non è violata**: ne è l'istanziazione. Si adotta la semantica **uniforme** `timestamp = startedAt = date.uts*1000`, con bias dichiarato in `03-ADAPTERS/lastfm.md` §5.

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
      country: string | null;    // ISO 3166-1 alpha-2, derivato, conservato
                                 // indipendentemente da retainIp (§3.8)
      city: string | null;       // città STIMATA (L2), null finché il DB geo
                                 // non c'è (19§4.1, E21)
      citySource: 'dbip-lite' | 'manual' | null;  // provenance della stima
      cityConfidence: number | null;  // 0..1, sotto 0.6 la città è scartata
      day: string;             // 'YYYY-MM-DD' (derivato, indicizzato)
    }

**eventKey** = `platform + ':' + (sourceEventId ?? sha1(trackId|timestamp|durationMs))`
Calcolato dall'adapter. Garantisce import idempotenti.

**I tre campi `city*`** (v1.7, Story 1.6) sono **derivati**, non raccolti:
la città viene stimata dal database geo locale a partire dall'IP già
presente nell'export (`19-GEO-CONTEXT.md` §4.1). Senza database geo — o senza
consenso `retainCity` — restano `null`. La derivazione è la **Story 4.4**:
questa versione fissa solo il **contratto** (i campi esistono, sono
nullable, e hanno una provenance esplicita).

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

### 3.8 PrivacySettings (toggle espliciti)

    export interface PrivacySettings {
      retainIp: boolean;          // default false; toggle ESPLICITO dell'utente
      retainCountry: boolean;     // default TRUE; persistenza del paese derivato
      retainCity: boolean;        // default false; derivazione e persistenza della città (L2)
      retainDeviceType: boolean;  // default true; persistenza del tipo di dispositivo
      retainDeviceDetail: boolean;// default false; persistenza della stringa grezza del device
      deriveContext: boolean;     // default true; classificazione del contesto di ascolto (L1)
      enrichMetadata: boolean;    // default false; arricchimento metadati brani
      carDetectionConsent: boolean; // default false; rilevamento ascolti in auto (es. Bluetooth/Battery)
      scrobbleHubs: ScrobbleHubId[]; // default []; hub di scrobbling scelti (tipo DEDICATO — vedi sotto)
      syncCloud: boolean;         // default false; sync E2E opzionale (Fase 2, ADR-0005)
    }

**I default non sono tutti `off`** (v1.7, Story 1.6 — decisione del project
owner sull'issue #108, ratificata in `19-GEO-CONTEXT.md` §7.1):

| Toggle | Default | Perché |
|---|---|---|
| `retainIp` | `false` | dato identificante: l'IP resta nel file dell'utente, non nel DB |
| `retainCountry` | **`true`** | dato **derivato**, non identificante, e cuore del prodotto: metterlo a `false` sarebbe una regressione di feature, non un rafforzamento della privacy |
| `retainCity` | `false` | dato **stimato**, accuratezza scarsa su IP mobili, più sensibile del paese: opt-in |
| `retainDeviceType` | `true` | 8 valori granulari, nessun identificativo |
| `retainDeviceDetail` | `false` | è la **stringa grezza** del provider (`"iPhone di Mario"`): dato identificante, opt-in |
| `deriveContext` | `true` | non raccoglie nulla di nuovo: opera su dati già conservati (`country`, `deviceType`, timestamp) |

Il `country` resta quindi **conservato indipendentemente da `retainIp`**:
retainere l'IP e conservare il paese sono due decisioni separate. Il toggle
`retainCountry` li disaccoppia esplicitamente.

**`ScrobbleHubId` è un tipo dedicato, non `PlatformId`** (ratificato dalla spec
`20-SCROBBLING-HUB.md` v1.0 🟢, D-SH.2 e ADR-0011 🟢 v1.0 §"I vincoli", V7):

    export type ScrobbleHubId = 'lastfm' | 'listenbrainz';

I due insiemi **non coincidono**: i client di scrobbling (`maloja`, `subsonic`,
`roon`) sono destinatari, non fonti (`01-PLATFORMS.md` §3.9), e `maloja` è scope
Fase 2. Un tipo dedicato rende il toggle per-hub **verificabile a compile time**:
aggiungere un nuovo client di scrobbling non può essere fatto per errore con un
`PlatformId` di una piattaforma sorgente.

Semantica del toggle (spec `20§5`, D-SH.4, G-SH.3):

- **default `[]`** → nessun hub abilitato → **zero richieste** e zero righe in coda
- il consenso è **per-hub** e **indipendente** dagli altri toggle: `retainIp`,
  `enrichMetadata` e `carDetectionConsent` **non** influiscono sulla scrittura, e
  viceversa
- togliere un hub dalla lista **svuota la sua coda** (le righe passano a
  `dropped`, nessun invio in volo): revocare il consenso non lascia scrobble in
  attesa
- la configurazione **per-hub** (credenziali, proxy scrivibile, User Token) vive in
  `settings` (§6.1) ed è **per-utente**: mai nel bundle, mai nei log

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

### 3.10 ContextPeriod (derivato, con verdetto utente) — v1.7

    export const CONTEXT_KINDS = [
      'home', 'work', 'commute', 'car', 'travel', 'away', 'unknown',
    ] as const;
    export type ContextKind = (typeof CONTEXT_KINDS)[number];

    export interface ContextPeriod {
      id: string;              // deterministico: il ricalcolo non crea duplicati
      startTime: number;       // unix ms UTC, inizio del periodo
      endTime: number;         // unix ms UTC, fine del periodo
      kind: ContextKind;       // contesto dedotto (L1) o tassonomia del periodo
      country: string | null;  // ISO 3166-1 alpha-2
      city: string | null;     // città stimata (L2, Story 4.4): null in questa tranche
      eventCount: number;      // ascolti coperti
      deviceTypes: DeviceType[];
      confidence: number;      // 0..1 — sotto 0.5 il periodo non viene aggregato
      derivedVersion: string;  // hash dei parametri dell'algoritmo (MIG-3)
      status: 'pending' | 'confirmed' | 'corrected' | 'dismissed';
      userLabel: string | null;  // etichetta libera: "Casa di mia madre"
      createdAt: number;
    }

Il contesto **non sta sull'evento**: si ripeterebbe identico su migliaia di
righe. Sta su un **periodo**, ricostruibile con `recompute()` (MIG-2) e
versionato come gli insight (MIG-3). La tassonomia dei `kind` è vincolante
(`19-GEO-CONTEXT.md` §4.3): `unknown` non è un errore, è la dichiarazione
"i segnali non bastano".

Il **verdetto dell'utente** (`status` ≠ `pending`, `userLabel`) è stabile: un
ricalcolo non cancella un periodo confermato, corretto o scartato, e non ne
duplica uno sovrapposto (E20).

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

### Sorgenti con durata non affidabile (documentato)

Alcune fonti espongono una durata **catalogo** opzionale anziché la durata **effettivamente ascoltata**: se il dato è presente solo su una parte degli ascolti dello stesso brano, usarlo nel bucket produce **due `Track` distinte per lo stesso brano** — l'esatto opposto di ciò che la dedup persegue.

**Regola**: per queste fonti il bucket DEDUP-3 è **sempre 0** e la durata va conservata sulla `Track` come dato catalogo, **fuori** dal calcolo del `canonicalKey`.

| Fonte | Campo durata | Stato | Trattamento |
|-------|--------------|-------|------------|
| YouTube Music | — | assente | `durationMs` = 0, nessun hint (E.YT.5) |
| Last.fm | — | assente in `getRecentTracks` | `durationMs` = 0, nessun hint (`03-ADAPTERS/lastfm.md` §5) |
| ListenBrainz | `additional_info.duration_ms` | **opzionale**, durata catalogo | bucket **sempre 0**; la durata va sulla `Track` come hint (`03-ADAPTERS/listenbrainz.md` §3.1.1, D7) |
| Last.fm | — | assente da `getRecentTracks` | `durationMs` = 0 (`03-ADAPTERS/lastfm.md` D-LF.4) |

La priorità DEDUP-1/2 (ISRC/MBID) compensa: ListenBrainz espone gli identificativi nativi, quindi la maggior parte dei suoi brani non transita da DEDUP-3.

**Nota**: la regola "bucket sempre 0" è una decisione di **spec adapter**, non una modifica del modello. `durationBucketMs` continua a valere `Math.floor(durationMs / 2000) * 2000` per le fonti che hanno una durata affidabile.

Comportamento upsert:
- Se esiste track con stesso canonicalKey → aggiungi platformId, aggiorna lastSeenAt e contatori
- Altrimenti crea nuova track
- Conflitti nome: il nome visualizzato è quello della prima piattaforma importata per ordine di priorità (spotify > apple > tidal > listenbrainz > altro), salvo override utente futuro

### Promozione post-enrichment: il job `rekey()` (Story 1.4)

La chiave `fuzzy:` è un'**ipotesi** (nome + artista + bucket), non un'identità: due
varianti dello stesso brano hanno due chiavi diverse. Quando l'enrichment
MusicBrainz scopre l'ISRC o l'MBID, la chiave va **promossa** a `isrc:`/`mbid:`
e i duplicati vanno **fusi**.

`rekey()` (`packages/core/src/db/rekey.ts`, `05§12.1`, `16-OPERATIONS.md` §2.3)
applica queste regole:

- **priorità DEDUP-1 su DEDUP-2**: con ISRC e MBID presenti vince l'ISRC, che
  è normalizzato in **maiuscole** per coincidere con la chiave che calcola la
  pipeline (`isrc:<ISRC upper>`);
- **atomicità**: l'operazione è interamente in una transazione Dexie (MIG-1): o
  la promozione avviene tutta, o non avviene;
- **sopravvivenza deterministica**: sopravvive la track **più vecchia** (primo
  ascolto), con disambiguazione sul `canonicalKey` — l'ordine di enumerazione
  di IndexedDB non è garantito e non deve decidere quale delle due track
  "conta" come l'originale;
- **riferimenti riorientati**: `listens`, `library`, `playlistItems` e
  `features` passano alla track sopravvissuta (i duplicati in libreria e in
  playlist sono scartati: sono insiemi);
- **nessuna perdita**: `platformIds`, `generi` e la finestra temporale
  (`firstSeenAt`/`lastSeenAt`) della track perdente vengono uniti a quelli della
  sopravvissuta;
- **contatori dalla fonte di verità**: `listenCount` è ricalcolato da
  `recount()` (MIG-4), non sommato a mano.

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

### 6.1 Tabella `settings` (schema v4 — Story 1.3)

    db.version(4).stores({
      ...v3,
      settings: '&key',
    });

`settings` è una tabella **chiave/valore** per le impostazioni locali che non
sono dati di ascolto: proxy CORS Last.fm, `api_key`, username (`09§4`). Una
riga per chiave:

| Campo | Tipo | Note |
|-------|------|------|
| `key` | string | Chiave della voce (es. `lastfm.config`) — **PK unica** |
| `value` | unknown | Valore JSON-serializzabile |
| `updatedAt` | number | Data di ultima modifica (unix ms) |

Migrazione **non distruttiva** (MIG-1): nessuna tabella esistente viene
modificata e nessun dato viene perso. Le credenziali contenute qui sono
**per-utente**: mai nel bundle, mai nei log, mai nelle fixture
(`09-PRIVACY-SECURITY.md` §4).

### 6.2 Tabella `scrobbleOutbox` (schema v5 — Story 1.5)

La coda di invio degli scrobble **non** può stare in `settings`: `settings` è
chiave/valore per impostazioni, e una coda ha **stato per elemento**, tentativi
e indice unico. Serve una tabella nuova → **schema Dexie v5**
(`20-SCROBBLING-HUB.md` §8.1, ratificato nella spec v1.0 🟢).

    db.version(5).stores({
      ...v4,
      scrobbleOutbox: '&idempotencyKey, hub, status, createdAt, nextAttemptAt',
    });

| Campo | Tipo | Note |
|-------|------|------|
| `idempotencyKey` | string | **PK**: `hub\|eventKey` — unico per costruzione (G-SH.1) |
| `hub` | `ScrobbleHubId` | indice: il ciclo lavora per hub |
| `eventKey` | string | l'`eventKey` locale dell'ascolto (`05§3.2`) |
| `payload` | `ScrobblePayload` | la copia che verrà inviata: serializzabile, **senza segreti** (`05§4.2`, V8) |
| `status` | `'pending' \| 'in_flight' \| 'sent' \| 'failed' \| 'dropped'` | macchina a stati (`20§8.2`) |
| `attempts` | number | numero di tentativi effettuati |
| `nextAttemptAt` | number | ts (unix ms) del prossimo tentativo consentito |
| `lastError` | `{ code, message, recoverable } \| null` | mai un segreto: solo codice e messaggio |
| `createdAt` | number | ts di enqueue |
| `sentAt` | number \| null | ts di conferma |

**La PK è la garanzia di idempotenza**: `hub|eventKey` è univoco per
costruzione, quindi un ascolto locale entra in coda **al massimo una volta** per
hub (G-SH.1): il secondo `enqueue` è **ignorato**, non è un errore. Nessuna delle
due API espone una chiave di deduplica lato server: la chiave unica locale è
l'unica garanzia possibile (ADR-0011 🟢 v1.0, V10).

**Write-ahead**: la riga passa a `in_flight` **prima** della richiesta. Se il
processo muore fra la richiesta e la conferma, la riga resta `in_flight` e non
viene ritentata in automatico: il caso residuo è un **doppio scrobble**
possibile, mai una perdita (G-SH.2, E.SH.6).

**Migrazione non distruttiva** (MIG-1): nessuna tabella esistente viene
modificata e nessun dato viene perso; la tabella nasce vuota.

**Cosa NON è in questa tabella**: nessun segreto (le credenziali stanno in
`settings`), nessun contesto di ascolto, nessun IP, nessun device (il payload è
chiuso per costruzione, `05§4.2` V8).

### 6.3 Tabella `contexts` (schema v6 — Story 1.6)

I **periodi di contesto** (`19-GEO-CONTEXT.md` §4.3) hanno stato per elemento,
confidenza, versione degli algoritmi e verdetto dell'utente: sono quindi una
tabella a sé, non una chiave/valore in `settings` → **schema Dexie v6**.

    db.version(6).stores({
      ...v5,
      contexts: '&id, kind, startTime, endTime, derivedVersion, status',
    });

| Campo | Tipo | Note |
|-------|------|------|
| `id` | string | **PK**: deterministico (`ctx-<kind>-<startTime>`) → il ricalcolo aggiorna, non duplica |
| `startTime` | number | ts (unix ms UTC) di inizio del periodo |
| `endTime` | number | ts (unix ms UTC) di fine del periodo |
| `kind` | `ContextKind` | indice: il nastro filtra per contesto (`19§8.2`) |
| `country` | string \| null | ISO 3166-1 alpha-2 |
| `city` | string \| null | città stimata (L2, Story 4.4): null in questa tranche |
| `eventCount` | number | ascolti coperti |
| `deviceTypes` | `DeviceType[]` | dispositivi presenti nel periodo |
| `confidence` | number | 0..1 — sotto 0.5 il periodo non viene aggregato (E19) |
| `derivedVersion` | string | hash dei parametri dell'algoritmo (MIG-3) |
| `status` | `'pending' \| 'confirmed' \| 'corrected' \| 'dismissed'` | verdetto dell'utente |
| `userLabel` | string \| null | etichetta libera: "Casa di mia madre" |
| `createdAt` | number | ts di creazione |

**Tabella derivata** (MIG-2): `contexts` è ricostruibile da `listens` con
`recompute()`. Un drop non perde nulla.

**Migrazione non distruttiva** (MIG-1): la tabella nasce vuota e nessuna
tabella esistente viene modificata. L'unica-touch è l'upgrade che azzera i
tre campi `city*` sugli ascolti già persistiti:

    db.version(6).stores({...}).upgrade(tx =>
      tx.table('listens').toCollection().modify(l => {
        l.city = l.city ?? null;
        l.citySource = l.citySource ?? null;
        l.cityConfidence = l.cityConfidence ?? null;
      }))

La città è una **derivazione** (L2) che nasce solo con il database geo
on-demand (Story 4.4): sugli ascolti già persistiti non può essere nota, e
`null` significa "dato assente", non "dato perso".

## 7. Politiche di migrazione e ricalcolo

- **MIG-1**: ogni cambio schema = `db.version(n+1).stores({...}).upgrade(tx => ...)`; mai drop di tabelle utente
- **MIG-2**: tabelle derivate (`sessions`, `insights`, `contexts`) sono **ricostruibili**: comando `recompute()` le rigenera da `listens` + `features`
- **MIG-3**: ogni modifica ai parametri di analisi cambia `derivedVersion` (hash del config); insight con version vecchia sono marcati `stale` e ricalcolati al prossimo avvio
- **MIG-4**: i contatori denormalizzati (`listenCount`) sono ricalcolabili con `recount()`; servono solo per performance UI
- **MIG-5** (v1.7): il ricalcolo dei **periodi di contesto** è **esplicito** — un re-import con toggle diversi **non** azzera i campi già persistiti (E20). I periodi con verdetto dell'utente (`status` ≠ `pending`) sono preservati e i periodi nuovi che li sovrappongono vengono scartati

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
| 1.4 | Sessione 52 (2026-10-26, issue #155) | §6.1 (nuova): tabella `settings` (chiave/valore) nello schema Dexie **v4** — proxy CORS Last.fm, `api_key`, username, per-utente e locali (`09§4`). Migrazione non distruttiva (MIG-1), nessuna modifica alle tabelle dati. §3.1: il contratto `RawListenEvent` riceve due campi **additivi e opzionali** — `sourceArtistMbid` (→ `Artist.mbid`, richiesto dalle spec `03-ADAPTERS/lastfm.md` §3.1.2 e `listenbrainz.md` §3.1.2) e `sourceTrackDurationMs` (durata **catalogo**, solo hint sulla `Track`: non entra nel bucket DEDUP-3, altrimenti uno stesso brano finirebbe in due `Track` distinte) |
| 1.5 | Sessione 53 (2026-10-26, issue #160) | **§5**: nota sul job di promozione `rekey()` (Story 1.4): la `canonicalKey` `fuzzy:` è un'**ipotesi**, non un'identità — la promozione a `isrc:`/`mbid:` avviene quando l'enrichment scopre gli identificativi, e i duplicati (due varianti fuzzy dello stesso brano) vengono fusi **in una transazione** (MIG-1) con i riferimenti riorientati e i contatori ricalcolati da `recount()` (MIG-4). La priorità è DEDUP-1 (ISRC) su DEDUP-2 (MBID) e l'ISRC è normalizzato in maiuscole, per coincidere con la chiave che calcola la pipeline. *(Riga riportata nella tabella: nella Sessione 53 era stata appesa per errore in cima al file, fuori dalla tabella del changelog — riposizionata nella Sessione 57, issue #172)* |
| 1.6 | Sessione 57 (2026-10-27, issue #172) | **Story 1.5 ratificata** (`20-SCROBBLING-HUB.md` v1.0 🟢 APPROVED): **§3.8** — `scrobbleHubs` passa da `PlatformId[]` al **tipo dedicato** `ScrobbleHubId` (`'lastfm' \| 'listenbrainz'`), con la semantica del toggle (default `[]`, consenso per-hub indipendente dagli altri toggle, revoca che svuota la coda del hub, configurazione per-utente in `settings`); **§6.2 (nuova)** — tabella `scrobbleOutbox` nello schema Dexie **v5** (PK `hub\|eventKey`, indice per `hub`/`status`/`createdAt`/`nextAttemptAt`, payload senza segreti, write-ahead `in_flight`), con la garanzia di idempotenza per costruzione (G-SH.1) e il caso residuo dichiarato (doppio scrobble possibile, mai una perdita). Migrazione **non distruttiva** (MIG-1). Il tipo `ScrobblePayload` e il contratto `ScrobbleSink` sono in `05§4.2` (ADR-0011 🟢 v1.0) |
| 1.7 | Sessione 68 (2026-10-31, issue #205) | **Story 1.6 — fondazione geo e contesto di ascolto** (`19-GEO-CONTEXT.md` v1.0 🟢 APPROVED): **§3.2** — tre campi derivati `city` / `citySource` / `cityConfidence` su `ListenEvent` (la città è una *stima* L2, non un fatto: la derivazione è la Story 4.4); **§3.8** — `PrivacySettings` con i toggle `retainCountry` (default **true**: il paese è derivato e non identificativo, decisione del project owner sull'issue #108), `retainCity` (default false), `retainDeviceType` (default true), `retainDeviceDetail` (default false: la stringa grezza del provider è identificante) e `deriveContext` (default true), con la semantica dichiarata che **il `country` è conservato indipendentemente da `retainIp`**; **§3.10 (nuova)** — `ContextPeriod` con la tassonomia vincolante `CONTEXT_KINDS` (`home`, `work`, `commute`, `car`, `travel`, `away`, `unknown`), il verdetto utente (`status` + `userLabel`) e la soglia 0.5 (E19); **§6.3 (nuova)** — tabella `contexts` nello schema Dexie **v6** (tabella derivata, ricostruibile con `recompute()`, MIG-2) con migrazione non distruttiva che azzera i campi città sugli ascolti esistenti; **§7** — MIG-5: il ricalcolo del contesto è **esplicito** e non azzera i campi già persistiti (E20) |