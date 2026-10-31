import type { Album, Artist, DeviceType, ListenEvent, PrivacySettings, Track } from '../schema';
import type { LifeSoundtrackDB } from '../db';
import type { RawListenEvent } from './types';
import { sha1Hex, uuid } from './crypto';
import { canonicalKey, durationBucketMs, normalizeName } from './dedup';

/**
 * Pipeline di normalizzazione adapter → core — `05-ARCHITECTURE.md` §3.1.
 *
 * Trasforma ogni `RawListenEvent` in un `ListenEvent` persistibile risolvendo:
 * timestamp → eventKey (05§3.2) → `trackId` via regole DEDUP `02§5` → `day` →
 * device mapping. Le entità `Track`/`Artist`/`Album` vengono tenute in cache
 * di sessione (upsert per PK `canonicalKey`/`id`) e scritte a chunk dalla
 * sessione di import (`importSession.ts`).
 */

/**
 * Gate di consenso `carDetectionConsent` (02-DATA-SCHEMA.md §3.8).
 *
 * La spec dichiara che il consenso dedicated copre gli eventi
 * `deviceType='car'` e nomina esplicitamente i segnali da cui sono
 * rilevati (Bluetooth auto, CarPlay, Android Auto, power profile):
 * senza opt-in, la classificazione auto non viene persistita e il
 * valore degrada a `unknown`. Il segnale utile si perde — è il
 * comportamento dichiarato, coerente con la minimizzazione di `02` §3.8.
 *
 * `deviceDetail` NON è coinvolto: resta la stringa grezza del provider
 * (dato già presente nell'export e governato dal suo consenso). La
 * demozione avviene in scrittura, mai sull'`RawListenEvent`: la pipeline
 * resta platform-agnostic e la regola vive in un solo punto per tutti
 * gli adapter futuri (issue #109).
 */
export function applyCarConsent(deviceType: DeviceType, consent: boolean): DeviceType {
  return consent || deviceType !== 'car' ? deviceType : 'unknown';
}

/**
 * Gate di persistenza del **dispositivo** — 02-DATA-SCHEMA.md §3.8,
 * 19-GEO-CONTEXT.md §7.1 (Story 1.6).
 *
 * `retainDeviceType` (default `true`) governa la persistenza del tipo di
 * dispositivo: 8 valori granulari, nessun identificativo, quindi è un dato
 * non identificativo e resta conservato. Senza il consenso, il tipo degrada
 * a `unknown` come ogni altro dato non autorizzato.
 *
 * `retainDeviceDetail` (default `false`) governa invece la **stringa grezza**
 * del provider (`"iPhone di Mario"`): è un dato identificante, quindi
 * opt-in. Il gate è applicato in scrittura, come il gate `car`.
 */
export function applyDeviceTypeConsent(
  deviceType: DeviceType,
  retainDeviceType: boolean,
  carConsent: boolean,
): DeviceType {
  const consented = applyCarConsent(deviceType, carConsent);
  return retainDeviceType ? consented : 'unknown';
}

/** Cache di sessione per la risoluzione DEDUP (05§3.1 step 3). */
export class NormalizationPipeline {
  private readonly db: LifeSoundtrackDB;
  private readonly importId: string;
  private readonly privacy: PrivacySettings;

  private readonly tracks = new Map<string, Track>(); // canonicalKey → Track
  private readonly artists = new Map<string, Artist>(); // nome normalizzato → Artist
  private readonly albums = new Map<string, Album>(); // artistId|nome normalizzato → Album
  private readonly eventKeyHashes = new Map<string, Promise<string>>();
  private readonly canonicalKeys = new Map<string, Promise<string>>();

  /**
   * Memoizzazione per le risoluzioni asincrone (resolveTrack/resolveArtist/
   * resolveAlbum). La sessione di import flusha i buffer in parallelo via
   * `Promise.all`, quindi più `normalizeEvent` con la stessa chiave canonica
   * (es. eventi DEDUP-3 su Queen + Bohemian Rhapsody) vengono normalizzati
   * in concorrenza: la cache sincrona non basta a deduplicare gli `await`
   * di `db.tracks.get`, e senza inflight la stessa entità veniva creata N
   * volte (un artista Queen per ogni evento parallelo, due Track distinti
   * per la stessa canonicalKey, vedi issue #75). Senza inflight, l'ultima
   * `Map.set` vinceva, lasciando le altre occorrenze con id orfani mai
   * sommati dal `recount()` — l'apparente "flaky test" era in realtà una
   * corsa deterministica ma non idfempotente.
   */
  private readonly inflightTracks = new Map<string, Promise<Track>>();
  private readonly inflightArtists = new Map<string, Promise<Artist>>();
  private readonly inflightAlbums = new Map<string, Promise<Album>>();

  /** Entità toccate dall'ultimo flush (la sessione le scrive in transazione). */
  readonly dirtyTracks = new Set<string>();
  readonly dirtyArtists = new Set<string>();
  readonly dirtyAlbums = new Set<string>();

  /** Numero di Track distinte toccate in questa sessione (per `info.complete`). */
  private trackCount = 0;

  constructor(db: LifeSoundtrackDB, importId: string, privacy: PrivacySettings) {
    this.db = db;
    this.importId = importId;
    this.privacy = privacy;
  }

  /** Track distinte viste in sessione (messaggio §9 `info.complete`). */
  get uniqueTrackCount(): number {
    return this.trackCount;
  }

  /**
   * Normalizza un evento (05§3.1, step 1-6) e registra le entità toccate.
   * Restituisce l'`ListenEvent` da persistire.
   */
  async normalizeEvent(raw: RawListenEvent): Promise<ListenEvent> {
    const timestamp = raw.rawTimestamp;
    const eventKey = await this.eventKeyFor(raw, timestamp);
    const track = await this.resolveTrack(raw, timestamp);
    const day = new Date(timestamp).toISOString().slice(0, 10);
    return {
      id: uuid(),
      eventKey,
      platform: raw.platform,
      importId: this.importId,
      timestamp,
      startedAt: raw.rawStartedAt,
      durationMs: raw.sourceDurationMs,
      trackId: track.id,
      completed: raw.completed ?? false,
      skipped: raw.skipped ?? false,
      shuffle: raw.shuffle,
      offline: raw.offline,
      incognito: raw.incognito,
      reasonStart: raw.reasonStart,
      reasonEnd: raw.reasonEnd,
      deviceType: applyDeviceTypeConsent(
        raw.deviceType,
        this.privacy.retainDeviceType,
        this.privacy.carDetectionConsent,
      ),
      deviceDetail: this.privacy.retainDeviceDetail ? raw.deviceDetail : null,
      ip: this.privacy.retainIp ? raw.ip : null,
      // Il paese è derivato e **conservato indipendentemente** da `retainIp`
      // (02§3.8, issue #108): è il cuore del prodotto e non richiede consenso
      // esplicito. Il toggle `retainCountry` (default `true`) lo governa.
      country: this.privacy.retainCountry ? raw.country : null,
      // Città (L2): derivata dal database geo on-demand, che è la Story 4.4.
      // Finché il database non c'è la derivazione non avviene (E21).
      city: null,
      citySource: null,
      cityConfidence: null,
      day,
    };
  }

  /** Svuota i set di entità sporche (chiamato dalla sessione dopo il flush). */
  clearDirty(): void {
    this.dirtyTracks.clear();
    this.dirtyArtists.clear();
    this.dirtyAlbums.clear();
  }

  /** Entità sporche correnti come record pronti per il `bulkPut`. */
  dirtyRecords(): { tracks: Track[]; artists: Artist[]; albums: Album[] } {
    return {
      tracks: [...this.dirtyTracks]
        .map((key) => this.tracks.get(key))
        .filter((t) => t !== undefined),
      artists: [...this.dirtyArtists]
        .map((key) => this.artists.get(key))
        .filter((a) => a !== undefined),
      albums: [...this.dirtyAlbums]
        .map((key) => this.albums.get(key))
        .filter((a) => a !== undefined),
    };
  }

  /**
   * `eventKey` = `platform + ':' + (sourceEventId ?? sha1(trackKey|timestamp|durationMs))`
   * (05§3.2). Il fallback sha1 è cachato: eventi senza ID nativo ripetuti
   * non pagano il digest due volte.
   */
  private async eventKeyFor(raw: RawListenEvent, timestamp: number): Promise<string> {
    if (raw.sourceEventId) {
      return `${raw.platform}:${raw.sourceEventId}`;
    }
    const material = [
      normalizeName(raw.sourceTrackName ?? ''),
      normalizeName(raw.sourceArtistName ?? ''),
      timestamp,
      raw.sourceDurationMs,
    ].join('|');
    let hash = this.eventKeyHashes.get(material);
    if (hash === undefined) {
      hash = sha1Hex(material);
      this.eventKeyHashes.set(material, hash);
    }
    return `${raw.platform}:${await hash}`;
  }

  /**
   * Risolve il `trackId` via DEDUP 02§5 (cache → DB → creazione).
   *
   * Per gli eventi con la stessa `canonicalKey` (DEDUP-3) che arrivano in
   * concorrenza da `Promise.all` in `importSession.flush()`, la cache
   * sincrona + il check `db.tracks.get` non bastano a deduplicare: tutte le
   * chiamate passano il `get` e cadono nel ramo "crea nuovo", generando
   * track con id distinti. La memoizzazione `inflightTracks` (Promise<T>
   * per chiave) garantisce che la prima chiamata risolve la creazione e le
   * altre ri-usano lo stesso `Track` (vedi issue #75).
   */
  private async resolveTrack(raw: RawListenEvent, timestamp: number): Promise<Track> {
    const key = await this.canonicalKeyFor(raw);
    const cached = this.tracks.get(key);
    if (cached) {
      this.mergeTrack(cached, raw, timestamp);
      this.dirtyTracks.add(key);
      return cached;
    }
    const inflight = this.inflightTracks.get(key);
    if (inflight) {
      const track = await inflight;
      this.mergeTrack(track, raw, timestamp);
      this.dirtyTracks.add(key);
      return track;
    }
    const creation = this.createOrFetchTrack(key, raw, timestamp);
    this.inflightTracks.set(key, creation);
    try {
      const track = await creation;
      this.mergeTrack(track, raw, timestamp);
      this.tracks.set(key, track);
      this.dirtyTracks.add(key);
      this.trackCount += 1;
      return track;
    } finally {
      this.inflightTracks.delete(key);
    }
  }

  /**
   * Slow path di `resolveTrack`: guarda DB, crea nuovo se manca, risolve
   * artista+album. Estratto come Promise<T> per essere memoizzato dalla
   * cache `inflightTracks`.
   */
  private async createOrFetchTrack(
    key: string,
    raw: RawListenEvent,
    timestamp: number,
  ): Promise<Track> {
    const existing = await this.db.tracks.get(key);
    const track: Track =
      existing ??
      ({
        id: uuid(),
        canonicalKey: key,
        name: raw.sourceTrackName ?? '',
        artistId: '', // risolto sotto
        albumId: null,
        durationMs: null,
        isrc: raw.isrc,
        mbid: raw.mbid,
        explicit: null,
        genres: [],
        artworkUrl: null,
        platformIds: {},
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        listenCount: 0,
      } satisfies Track);
    track.artistId = await this.resolveArtist(raw, track.artistId);
    // L'album si arricchisce ma non si azzera: un evento senza nome album
    // non deve cancellare l'albumId di una track già nota.
    if (raw.sourceAlbumName && !track.albumId) {
      track.albumId = await this.resolveAlbum(raw, track.artistId);
    }
    if (track.durationMs === null && (raw.sourceTrackDurationMs ?? 0) > 0) {
      // Durata **catalogo** (ListenBrainz `additional_info.duration_ms`):
      // un hint sulla Track, non la durata dell'evento. Non entra nel
      // bucket DEDUP-3 (che usa `sourceDurationMs` = 0 per questa
      // piattaforma): il dato, se presente su una parte degli ascolti e
      // assente sull'altra, non deve frammentare la Track (E.LB.2, D-LB.7).
      track.durationMs = raw.sourceTrackDurationMs ?? null;
    } else if (track.durationMs === null && raw.sourceDurationMs > 0) {
      // Proxy durata catalogo: `ms_played` (spotify.md §3.1.1).
      track.durationMs = raw.sourceDurationMs;
    }
    return track;
  }

  /** Unisce uri nativo e timestamp di attività su una Track esistente (02§5 upsert). */
  private mergeTrack(track: Track, raw: RawListenEvent, timestamp: number): void {
    if (raw.sourceTrackUri) {
      const nativeId = raw.sourceTrackUri.split(':').pop() ?? null;
      if (nativeId) {
        track.platformIds = { ...track.platformIds, [raw.platform]: nativeId };
      }
    }
    if (raw.isrc && !track.isrc) {
      track.isrc = raw.isrc;
    }
    if (raw.mbid && !track.mbid) {
      track.mbid = raw.mbid;
    }
    // Durata catalogo come hint: arriva anche su una Track già creata da un
    // ascolto senza `additional_info` (E.LB.2: stesso brano, bucket 0).
    if (track.durationMs === null && (raw.sourceTrackDurationMs ?? 0) > 0) {
      track.durationMs = raw.sourceTrackDurationMs ?? null;
    }
    track.firstSeenAt = Math.min(track.firstSeenAt, timestamp);
    track.lastSeenAt = Math.max(track.lastSeenAt, timestamp);
  }

  /**
   * Risolve l'artista per nome normalizzato (cache di sessione) con lookup
   * DB per nome esatto sul miss cross-import (re-import dello stesso file).
   *
   * Memoizzazione chiave → Promise<Artist> per evitare che più eventi
   * Queen paralleli (da `Promise.all` in `importSession.flush()`) creino
   * artisti distinti con lo stesso nome (issue #75): senza inflight, la
   * cache sincrona non protegge il gap tra `db.artists.get` e il set,
   * e l'ultimo `Map.set` vince, lasciando tracks con id orfani che
   * `recount()` non saprebbe più sommare sull'artista reale.
   */
  private async resolveArtist(raw: RawListenEvent, currentId: string): Promise<string> {
    const rawName = raw.sourceArtistName ?? 'Unknown';
    const key = normalizeName(rawName);
    const cached = this.artists.get(key);
    if (cached) {
      this.mergeArtist(cached, raw);
      this.dirtyArtists.add(key);
      return cached.id;
    }
    const inflight = this.inflightArtists.get(key);
    if (inflight) {
      const artist = await inflight;
      this.mergeArtist(artist, raw);
      this.dirtyArtists.add(key);
      return artist.id;
    }
    const fetch = this.fetchOrCreateArtist(raw, currentId, rawName);
    this.inflightArtists.set(key, fetch);
    try {
      const artist = await fetch;
      this.mergeArtist(artist, raw);
      this.artists.set(key, artist);
      this.dirtyArtists.add(key);
      return artist.id;
    } finally {
      this.inflightArtists.delete(key);
    }
  }

  /**
   * Unisce l'id nativo della piattaforma su un Artist esistente (02§5 upsert).
   * `sourceArtistUri` è un URI convenzionale il cui ultimo segmento è l'id
   * nativo (stessa convenzione di `mergeTrack`): `youtube_music:channel:<id>`
   * → `platformIds.youtube_music = <id>` (youtube-music.md §3.1.2). Spotify
   * emette null → nessun effetto.
   */
  private mergeArtist(artist: Artist, raw: RawListenEvent): void {
    if (raw.sourceArtistUri) {
      const nativeId = raw.sourceArtistUri.split(':').pop() ?? null;
      if (nativeId && artist.platformIds[raw.platform] !== nativeId) {
        artist.platformIds = { ...artist.platformIds, [raw.platform]: nativeId };
      }
    }
    // MBID dell'artista (Last.fm `artist.mbid`, ListenBrainz
    // `artist_mbids[0]`): dato risolto dal server, più affidabile del MBID
    // del brano. L'artista joinata multi-artista prende il primo MBID
    // (02§3.3 non modella la relazione many-to-many).
    if (raw.sourceArtistMbid && !artist.mbid) {
      artist.mbid = raw.sourceArtistMbid;
    }
  }

  /** Slow path di `resolveArtist`: DB lookup per id, fallback per nome, o creazione. */
  private async fetchOrCreateArtist(
    raw: RawListenEvent,
    currentId: string,
    rawName: string,
  ): Promise<Artist> {
    if (currentId) {
      const known = await this.db.artists.get(currentId);
      if (known) {
        return known;
      }
    }
    const byName = await this.db.artists.where('name').equals(rawName).first();
    if (byName) {
      return byName;
    }
    if (currentId) {
      // Artista non trovato né in cache né per nome, ma la track già lo
      // referenzia: conserva il riferimento esistente.
      return {
        id: currentId,
        name: rawName,
        mbid: null,
        genres: [],
        platformIds: {},
        listenCount: 0,
      } satisfies Artist;
    }
    return {
      id: uuid(),
      name: rawName,
      mbid: null,
      genres: [],
      platformIds: {},
      listenCount: 0,
    } satisfies Artist;
  }

  /**
   * Risolve l'album per artista + nome normalizzato (cache → DB → creazione).
   * Stessa memoizzazione chiave → Promise<Album> di `resolveArtist` per
   * evitare la race condition su Promise.all (issue #75).
   */
  private async resolveAlbum(raw: RawListenEvent, artistId: string): Promise<string> {
    const rawName = raw.sourceAlbumName ?? '';
    const key = `${artistId}|${normalizeName(rawName)}`;
    const cached = this.albums.get(key);
    if (cached) {
      this.dirtyAlbums.add(key);
      return cached.id;
    }
    const inflight = this.inflightAlbums.get(key);
    if (inflight) {
      const album = await inflight;
      this.dirtyAlbums.add(key);
      return album.id;
    }
    const fetch = this.fetchOrCreateAlbum(raw, artistId, rawName);
    this.inflightAlbums.set(key, fetch);
    try {
      const album = await fetch;
      this.albums.set(key, album);
      this.dirtyAlbums.add(key);
      return album.id;
    } finally {
      this.inflightAlbums.delete(key);
    }
  }

  /** Slow path di `resolveAlbum`: lookup DB name+artist, o creazione. */
  private async fetchOrCreateAlbum(
    raw: RawListenEvent,
    artistId: string,
    rawName: string,
  ): Promise<Album> {
    const byName = await this.db.albums
      .where('name')
      .equals(rawName)
      .filter((a) => a.artistId === artistId)
      .first();
    if (byName) {
      return byName;
    }
    return {
      id: uuid(),
      name: rawName,
      artistId,
      mbid: null,
      upc: null,
      releaseDate: null,
      artworkUrl: null,
      platformIds: {},
    } satisfies Album;
  }

  /** `canonicalKey` 02§5 con cache dei digest (DEDUP-3 su 50k eventi). */
  private canonicalKeyFor(raw: RawListenEvent): Promise<string> {
    const material = [
      raw.sourceTrackName ?? '',
      raw.sourceArtistName ?? '',
      durationBucketMs(raw.sourceDurationMs ?? 0),
      raw.isrc,
      raw.mbid,
    ].join('|');
    let key = this.canonicalKeys.get(material);
    if (key === undefined) {
      key = canonicalKey({
        name: raw.sourceTrackName ?? '',
        artistPrincipal: raw.sourceArtistName ?? '',
        durationMs: durationBucketMs(raw.sourceDurationMs ?? 0),
        isrc: raw.isrc,
        mbid: raw.mbid,
      });
      this.canonicalKeys.set(material, key);
    }
    return key;
  }
}
