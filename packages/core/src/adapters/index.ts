/**
 * Entry point `@ls/core/adapters` — contratto adapter (05§4), pipeline di
 * normalizzazione (05§3.1), sessione di import e utility condivise.
 */
export { AdapterError, type AdapterErrorCode } from './errors';
export { sha1Hex, sha256Hex, uuid } from './crypto';
export { canonicalKey, durationBucketMs, normalizeName, type CanonicalKeyInput } from './dedup';
export { JsonArrayScanner, blobChunks, iterateJsonArrayElements } from './jsonStream';
export { JsonlScanner, iterateJsonlLines } from './jsonlStream';
export { NormalizationPipeline, applyCarConsent } from './pipeline';
export {
  IMPORT_CHUNK_SIZE,
  importLibrary,
  runImport,
  runRemoteImport,
  type ImportOptions,
  type ImportSummary,
  type LibrarySummary,
  type RemoteImportOptions,
} from './importSession';
export type {
  LibrarySnapshot,
  ParseOptions,
  PlatformAdapter,
  RawLibraryRef,
  RawListenEvent,
  RawPlaylistItemRef,
  RemoteSource,
} from './types';

export { AppleMusicAdapter } from './apple';
export {
  detectAppleMusic,
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
} from './apple';
export {
  isAppleMusicActivityRecord,
  isAppleMusicDailyTrackRecord,
  type AppleMusicActivityRecord,
  type AppleMusicDailyTrackRecord,
} from './apple';
