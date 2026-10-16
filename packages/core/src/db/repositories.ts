import type { Album, Artist, AudioFeatures, ListenEvent, PlatformId, Track } from '../schema';
import type { LifeSoundtrackDB } from './db';

/**
 * Repository di accesso ai dati — CRUD e query base.
 * 11-BACKLOG.md T0.2.3. Le query usano gli indici dichiarati in
 * `02-DATA-SCHEMA.md` §6; nessuna scansione completa se esiste un indice.
 */

// ---------------------------------------------------------------------------
// listens
// ---------------------------------------------------------------------------

/**
 * Inserisce o aggiorna eventi di ascolto in blocco. Idempotente: la chiave
 * primaria è `eventKey` (UNIQUE, D.1.2), quindi il re-import dello stesso
 * evento non crea duplicati.
 */
export async function putListens(db: LifeSoundtrackDB, events: ListenEvent[]): Promise<void> {
  await db.listens.bulkPut(events);
}

/** Legge un evento di ascolto per `eventKey`. */
export async function getListen(
  db: LifeSoundtrackDB,
  eventKey: string,
): Promise<ListenEvent | undefined> {
  return db.listens.get(eventKey);
}

/** Eventi di ascolto di un giorno ('YYYY-MM-DD', derivato UTC, §3.2). */
export async function listListensByDay(db: LifeSoundtrackDB, day: string): Promise<ListenEvent[]> {
  return db.listens.where('day').equals(day).toArray();
}

/** Eventi di ascolto di un brano. */
export async function listListensByTrack(
  db: LifeSoundtrackDB,
  trackId: string,
): Promise<ListenEvent[]> {
  return db.listens.where('trackId').equals(trackId).toArray();
}

/** Eventi di ascolto di una piattaforma. */
export async function listListensByPlatform(
  db: LifeSoundtrackDB,
  platform: PlatformId,
): Promise<ListenEvent[]> {
  return db.listens.where('platform').equals(platform).toArray();
}

/** Eventi generati da un import (tracciabilità per importId). */
export async function listListensByImport(
  db: LifeSoundtrackDB,
  importId: string,
): Promise<ListenEvent[]> {
  return db.listens.where('importId').equals(importId).toArray();
}

/** Eventi conclusi nell'intervallo `[fromMs, toMs]` (unix ms UTC), in ordine di tempo. */
export async function listListensInRange(
  db: LifeSoundtrackDB,
  fromMs: number,
  toMs: number,
): Promise<ListenEvent[]> {
  return db.listens.where('timestamp').between(fromMs, toMs, true, true).toArray();
}

/** Conta tutti gli eventi di ascolto. */
export async function countListens(db: LifeSoundtrackDB): Promise<number> {
  return db.listens.count();
}

/**
 * Azzera tutti gli indirizzi IP conservati (02§3.8: `purgeIp()`).
 * Il `country` derivato resta conservato (privacy-by-design).
 */
export async function purgeIp(db: LifeSoundtrackDB): Promise<void> {
  await db.listens.toCollection().modify({ ip: null });
}

// ---------------------------------------------------------------------------
// tracks
// ---------------------------------------------------------------------------

/** Inserisce o aggiorna tracce in blocco (upsert per `canonicalKey`, §5). */
export async function putTracks(db: LifeSoundtrackDB, tracks: Track[]): Promise<void> {
  await db.tracks.bulkPut(tracks);
}

/** Legge una traccia per chiave canonica (DEDUP §5). */
export async function getTrack(
  db: LifeSoundtrackDB,
  canonicalKey: string,
): Promise<Track | undefined> {
  return db.tracks.get(canonicalKey);
}

/** Tracce di un artista. */
export async function listTracksByArtist(db: LifeSoundtrackDB, artistId: string): Promise<Track[]> {
  return db.tracks.where('artistId').equals(artistId).toArray();
}

/** Tracce di un album. */
export async function listTracksByAlbum(db: LifeSoundtrackDB, albumId: string): Promise<Track[]> {
  return db.tracks.where('albumId').equals(albumId).toArray();
}

/** Tracce con un dato ISRC (DEDUP-1). */
export async function listTracksByIsrc(db: LifeSoundtrackDB, isrc: string): Promise<Track[]> {
  return db.tracks.where('isrc').equals(isrc).toArray();
}

/** Tracce con un dato MBID (DEDUP-2). */
export async function listTracksByMbid(db: LifeSoundtrackDB, mbid: string): Promise<Track[]> {
  return db.tracks.where('mbid').equals(mbid).toArray();
}

/** Tracce per nome esatto (indice `name`). */
export async function listTracksByName(db: LifeSoundtrackDB, name: string): Promise<Track[]> {
  return db.tracks.where('name').equals(name).toArray();
}

// ---------------------------------------------------------------------------
// artists
// ---------------------------------------------------------------------------

/** Inserisce o aggiorna artisti in blocco (upsert per `id`). */
export async function putArtists(db: LifeSoundtrackDB, artists: Artist[]): Promise<void> {
  await db.artists.bulkPut(artists);
}

/** Legge un artista per id. */
export async function getArtist(db: LifeSoundtrackDB, id: string): Promise<Artist | undefined> {
  return db.artists.get(id);
}

/** Artisti per nome esatto (indice `name`). */
export async function listArtistsByName(db: LifeSoundtrackDB, name: string): Promise<Artist[]> {
  return db.artists.where('name').equals(name).toArray();
}

/** Artisti con un dato MBID. */
export async function listArtistsByMbid(db: LifeSoundtrackDB, mbid: string): Promise<Artist[]> {
  return db.artists.where('mbid').equals(mbid).toArray();
}

// ---------------------------------------------------------------------------
// albums
// ---------------------------------------------------------------------------

/** Inserisce o aggiorna album in blocco (upsert per `id`). */
export async function putAlbums(db: LifeSoundtrackDB, albums: Album[]): Promise<void> {
  await db.albums.bulkPut(albums);
}

/** Legge un album per id. */
export async function getAlbum(db: LifeSoundtrackDB, id: string): Promise<Album | undefined> {
  return db.albums.get(id);
}

/** Album di un artista. */
export async function listAlbumsByArtist(db: LifeSoundtrackDB, artistId: string): Promise<Album[]> {
  return db.albums.where('artistId').equals(artistId).toArray();
}

// ---------------------------------------------------------------------------
// features
// ---------------------------------------------------------------------------

/** Inserisce o aggiorna feature audio in blocco (una riga per trackId, PK). */
export async function putFeatures(db: LifeSoundtrackDB, features: AudioFeatures[]): Promise<void> {
  await db.features.bulkPut(features);
}

/** Feature audio di un brano. */
export async function getFeatures(
  db: LifeSoundtrackDB,
  trackId: string,
): Promise<AudioFeatures | undefined> {
  return db.features.get(trackId);
}

/** Feature audio per sorgente (cache/audit del pipeline enrichment, 05§6). */
export async function listFeaturesBySource(
  db: LifeSoundtrackDB,
  source: AudioFeatures['source'],
): Promise<AudioFeatures[]> {
  return db.features.where('source').equals(source).toArray();
}
