/**
 * Entry point `@ls/core/adapters` — contratto adapter (05§4), pipeline di
 * normalizzazione (05§3.1), sessione di import e utility condivise.
 */
export { AdapterError, type AdapterErrorCode } from './errors';
export { sha1Hex, sha256Hex, uuid } from './crypto';
export { canonicalKey, durationBucketMs, normalizeName, type CanonicalKeyInput } from './dedup';
export { JsonArrayScanner, blobChunks, iterateJsonArrayElements } from './jsonStream';
export { NormalizationPipeline } from './pipeline';
export {
  IMPORT_CHUNK_SIZE,
  importLibrary,
  runImport,
  type ImportOptions,
  type ImportSummary,
  type LibrarySummary,
} from './importSession';
export type {
  LibrarySnapshot,
  ParseOptions,
  PlatformAdapter,
  RawLibraryRef,
  RawListenEvent,
  RawPlaylistItemRef,
} from './types';
