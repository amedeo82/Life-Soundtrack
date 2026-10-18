/**
 * Entry point `@ls/core/adapters/spotify` — adapter export GDPR Spotify
 * (03-ADAPTERS/spotify.md v1.2 APPROVED).
 */
export { SpotifyAdapter } from './adapter';
export { detectSpotify } from './detect';
export {
  deriveCompleted,
  deriveSkipped,
  E1_NO_CATALOG_THRESHOLD_MS,
  extractTrackId,
  mapDeviceType,
  mapSpotifyEvent,
  normalizeOfflineTimestamp,
  type SpotifyMapResult,
} from './mapEvent';
export { buildLibrarySnapshot, isPlaylistFileName } from './library';
export { isSpotifyStreamingRecord, type SpotifyStreamingRecord } from './types';
export { extractZipEntry, isZip, listZipEntries } from './zip';
