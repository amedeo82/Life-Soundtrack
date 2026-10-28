/**
 * Entry point `@ls/core/adapters` — contratto adapter (05§4), pipeline di
 * normalizzazione (05§3.1), sessione di import e utility condivise.
 */
export { AdapterError, type AdapterErrorCode } from './errors';
export { md5Hex, sha1Hex, sha256Hex, uuid } from './crypto';
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

/**
 * Contratto di **scrittura** verso gli hub di scrobbling (Story 1.5,
 * `05§4.2` ADR-0011): interfaccia `ScrobbleSink`, payload, errori e
 * registro dei sink. È il gemello di `PlatformAdapter`, che resta invariato
 * (V1).
 */
export {
  getScrobbleSink,
  SCROBBLE_SINKS,
  ScrobbleError,
  buildListenBrainzBody,
  lastfmApiSignature,
  LISTENBRAINZ_DEFAULT_ENDPOINT,
  LISTENBRAINZ_MAX_LISTENS_PER_REQUEST,
  LASTFM_MAX_SCROBBLES_PER_REQUEST,
  type ScrobbleErrorCode,
  type ScrobblePayload,
  type ScrobbleResult,
  type ScrobbleSink,
  type ScrobbleSinkConfig,
  type ScrobbleSubmitOptions,
} from './scrobble';
export {
  enqueueEligibleListens,
  isEligible,
  isMature,
  SCROBBLE_CANDIDACY_WINDOW_MS,
  SCROBBLE_FALLBACK_THRESHOLD_MS,
  SCROBBLE_MIN_DURATION_MS,
  type EligibilityOptions,
  type ResolvedScrobbleCandidate,
  type ScrobbleCandidate,
} from './scrobble/eligibility';
export {
  runScrobbleCycle,
  SCROBBLE_DEFAULT_BATCH_SIZE,
  type ScrobbleCycleOptions,
  type ScrobbleCycleSummary,
} from './scrobble/sender';
export {
  syncListenbrainzIncrementally,
  type IncrementalSyncOptions,
  type IncrementalSyncResult,
} from './scrobble/sync';
