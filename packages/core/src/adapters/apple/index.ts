/**
 * Entry point `@ls/core/adapters/apple` — adapter Apple Media Services
 * Apple Music (03-ADAPTERS/apple-music.md v1.0 APPROVED).
 */
export { AppleMusicAdapter } from './adapter';
export { detectAppleMusic, looksLikeHtml } from './detect';
export {
  parseCsvStreaming,
  parseDailyTracksCsv,
  buildDailyTracksArtistMap,
  mapAppleMusicEvent,
  normalizeColumnName,
  ALIAS_MAP,
  MIN_PLAY_MS,
  COMPLETION_TOLERANCE_MS,
  SKIP_RATIO,
  RECONCILIATION_TOLERANCE,
  computeCompleted,
  computeSkipped,
  mapDeviceType,
  buildDeviceDetail,
  parseTimestamp,
  resolveCountry,
  resolveArtistName,
} from './mapEvent';
export {
  isAppleMusicActivityRecord,
  isAppleMusicDailyTrackRecord,
  type AppleMusicActivityRecord,
  type AppleMusicDailyTrackRecord,
} from './types';
