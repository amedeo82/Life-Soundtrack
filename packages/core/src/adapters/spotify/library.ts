import { uuid } from '../crypto';
import type { LibrarySnapshot, RawLibraryRef, RawPlaylistItemRef } from '../types';
import type { Playlist } from '../../schema';

/**
 * Parsing di `YourLibrary.json`, `Playlist*.json`, `Follow.json`
 * (spotify.md §2.3, §3.4) → `LibrarySnapshot` (SPEC-TEMPLATE §3.2).
 *
 * Gli shape dell'export GDPR variano leggermente tra anni: il parsing è
 * difensivo (wrapper array/oggetto, campi opzionali) e non lancia mai per
 * singoli ref mancanti — contano come non risolti a valle.
 */

/** Riconosce un oggetto non null. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Converte una data GDPR (ISO o unix ms) in unix ms, null se assente/invalida. */
function parseAddedAt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Nome di una playlist GDPR: `Playlist1.json` ecc. */
export function isPlaylistFileName(name: string): boolean {
  return /^Playlist[^/]*\.json$/i.test(name);
}

/** `YourLibrary.json` → refs `saved_track`/`saved_album` (§3.4). */
function parseYourLibrary(data: unknown, refs: RawLibraryRef[]): void {
  if (!isObject(data)) {
    return;
  }
  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  for (const entry of tracks) {
    const track = isObject(entry) ? (isObject(entry.track) ? entry.track : entry) : null;
    const uri = isObject(track) && typeof track.trackUri === 'string' ? track.trackUri : null;
    refs.push({
      kind: 'saved_track',
      uri,
      name: null,
      addedAt: parseAddedAt(isObject(entry) ? entry.addedDate : null),
    });
  }
  const albums = Array.isArray(data.albums) ? data.albums : [];
  for (const entry of albums) {
    const album = isObject(entry) ? (isObject(entry.album) ? entry.album : entry) : null;
    const uri = isObject(album) && typeof album.uri === 'string' ? album.uri : null;
    const name = isObject(album) && typeof album.name === 'string' ? album.name : null;
    refs.push({
      kind: 'saved_album',
      uri,
      name,
      addedAt: parseAddedAt(isObject(entry) ? entry.addedDate : null),
    });
  }
}

/** `Follow.json` → refs `followed_artist` (§3.4: `artist` + `spotify_artist_uri`). */
function parseFollow(data: unknown, refs: RawLibraryRef[]): void {
  const entries = Array.isArray(data)
    ? data
    : isObject(data) && Array.isArray(data.artists)
      ? data.artists
      : isObject(data) && Array.isArray(data.followedArtists)
        ? data.followedArtists
        : [];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      refs.push({ kind: 'followed_artist', uri: null, name: entry, addedAt: null });
      continue;
    }
    if (!isObject(entry)) {
      continue;
    }
    const nested = isObject(entry.artist) ? entry.artist : entry;
    const uri =
      typeof entry.spotify_artist_uri === 'string'
        ? entry.spotify_artist_uri
        : typeof nested.uri === 'string'
          ? nested.uri
          : null;
    const name = typeof nested.name === 'string' ? nested.name : typeof entry.name === 'string' ? entry.name : null;
    refs.push({ kind: 'followed_artist', uri, name, addedAt: parseAddedAt(entry.addedDate) });
  }
}

/** Una singola `Playlist*.json` → `Playlist` + refs items (§3.4). */
function parsePlaylist(data: unknown, playlists: Playlist[], items: RawPlaylistItemRef[]): void {
  if (!isObject(data) || typeof data.name !== 'string') {
    return;
  }
  const playlist: Playlist = {
    id: uuid(),
    platform: 'spotify',
    name: data.name,
    createdAt: null,
    lastModifiedAt: parseAddedAt(data.lastModifiedDate),
  };
  playlists.push(playlist);
  const rawItems = Array.isArray(data.items) ? data.items : [];
  rawItems.forEach((entry, position) => {
    if (!isObject(entry)) {
      return;
    }
    const track = isObject(entry.track) ? entry.track : entry;
    const uri =
      typeof track.trackUri === 'string'
        ? track.trackUri
        : typeof track.uri === 'string'
          ? track.uri
          : null;
    items.push({
      playlistId: playlist.id,
      sourceTrackUri: uri,
      position,
      addedAt: parseAddedAt(entry.addedDate),
    });
  });
}

/**
 * Costruisce lo snapshot library dai file estratti. `files` mappa nome file →
 * contenuto già estratto; i nomi riconosciuti sono `YourLibrary.json`,
 * `Playlist*.json` (qualsiasi indice/suffisso) e `Follow.json`.
 */
export function buildLibrarySnapshot(files: Record<string, unknown>): LibrarySnapshot {
  const playlists: Playlist[] = [];
  const playlistItems: RawPlaylistItemRef[] = [];
  const libraryItems: RawLibraryRef[] = [];
  for (const [name, data] of Object.entries(files)) {
    if (/^YourLibrary\.json$/i.test(name)) {
      parseYourLibrary(data, libraryItems);
    } else if (/^Follow\.json$/i.test(name)) {
      parseFollow(data, libraryItems);
    } else if (isPlaylistFileName(name)) {
      parsePlaylist(data, playlists, playlistItems);
    }
  }
  return { playlists, playlistItems, libraryItems };
}
