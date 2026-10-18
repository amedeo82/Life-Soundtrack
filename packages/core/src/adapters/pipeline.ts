import type { Album, Artist, ListenEvent, PrivacySettings, Track } from '../schema';
import type { LifeSoundtrackDB } from '../db';
import type { RawListenEvent } from './types';
import { sha1Hex, uuid } from './crypto';
import { canonicalKey, normalizeName } from './dedup';

/**
 * Pipeline di normalizzazione adapter → core — `05-ARCHITECTURE.md` §3.1.
 *
 * Trasforma ogni `RawListenEvent` in un `ListenEvent` persistibile risolvendo:
 * timestamp → eventKey (05§3.2) → `trackId` via regole DEDUP `02§5` → `day` →
 * device mapping. Le entità `Track`/`Artist`/`Album` vengono tenute in cache
 * di sessione (upsert per PK `canonicalKey`/`id`) e scritte a chunk dalla
 * sessione di import (`importSession.ts`).
 */

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
      deviceType: raw.deviceType,
      deviceDetail: raw.deviceDetail,
      ip: this.privacy.retainIp ? raw.ip : null,
      country: raw.country,
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

  /** Risolve il `trackId` via DEDUP 02§5 (cache → DB → creazione). */
  private async resolveTrack(raw: RawListenEvent, timestamp: number): Promise<Track> {
    const key = await this.canonicalKeyFor(raw);
    const cached = this.tracks.get(key);
    if (cached) {
      this.mergeTrack(cached, raw, timestamp);
      this.dirtyTracks.add(key);
      return cached;
    }
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
    if (track.durationMs === null && raw.sourceDurationMs > 0) {
      // Proxy durata catalogo: `ms_played` (spotify.md §3.1.1).
      track.durationMs = raw.sourceDurationMs;
    }
    this.mergeTrack(track, raw, timestamp);
    this.tracks.set(key, track);
    this.dirtyTracks.add(key);
    this.trackCount += 1;
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
    track.firstSeenAt = Math.min(track.firstSeenAt, timestamp);
    track.lastSeenAt = Math.max(track.lastSeenAt, timestamp);
  }

  /**
   * Risolve l'artista per nome normalizzato (cache di sessione) con lookup
   * DB per nome esatto sul miss cross-import (re-import dello stesso file).
   */
  private async resolveArtist(raw: RawListenEvent, currentId: string): Promise<string> {
    const rawName = raw.sourceArtistName ?? 'Unknown';
    const key = normalizeName(rawName);
    const cached = this.artists.get(key);
    if (cached) {
      this.dirtyArtists.add(key);
      return cached.id;
    }
    if (currentId) {
      const known = await this.db.artists.get(currentId);
      if (known) {
        this.artists.set(key, known);
        this.dirtyArtists.add(key);
        return known.id;
      }
    }
    const byName = await this.db.artists.where('name').equals(rawName).first();
    if (byName) {
      this.artists.set(key, byName);
      this.dirtyArtists.add(key);
      return byName.id;
    }
    if (currentId) {
      // Artista non trovato né in cache né per nome, ma la track già lo
      // referenzia: conserva il riferimento esistente.
      return currentId;
    }
    const artist: Artist = {
      id: uuid(),
      name: rawName,
      mbid: null,
      genres: [],
      platformIds: {},
      listenCount: 0,
    };
    this.artists.set(key, artist);
    this.dirtyArtists.add(key);
    return artist.id;
  }

  /** Risolve l'album per artista + nome normalizzato (cache → DB → creazione). */
  private async resolveAlbum(raw: RawListenEvent, artistId: string): Promise<string> {
    const rawName = raw.sourceAlbumName ?? '';
    const key = `${artistId}|${normalizeName(rawName)}`;
    const cached = this.albums.get(key);
    if (cached) {
      this.dirtyAlbums.add(key);
      return cached.id;
    }
    const byName = await this.db.albums
      .where('name')
      .equals(rawName)
      .filter((a) => a.artistId === artistId)
      .first();
    const album: Album = byName ?? {
      id: uuid(),
      name: rawName,
      artistId,
      mbid: null,
      upc: null,
      releaseDate: null,
      artworkUrl: null,
      platformIds: {},
    };
    this.albums.set(key, album);
    this.dirtyAlbums.add(key);
    return album.id;
  }

  /** `canonicalKey` 02§5 con cache dei digest (DEDUP-3 su 50k eventi). */
  private canonicalKeyFor(raw: RawListenEvent): Promise<string> {
    const material = [
      raw.sourceTrackName ?? '',
      raw.sourceArtistName ?? '',
      raw.sourceDurationMs,
      raw.isrc,
      raw.mbid,
    ].join('|');
    let key = this.canonicalKeys.get(material);
    if (key === undefined) {
      key = canonicalKey({
        name: raw.sourceTrackName ?? '',
        artistPrincipal: raw.sourceArtistName ?? '',
        durationMs: raw.sourceDurationMs,
        isrc: raw.isrc,
        mbid: raw.mbid,
      });
      this.canonicalKeys.set(material, key);
    }
    return key;
  }
}
