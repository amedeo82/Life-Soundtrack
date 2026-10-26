/**
 * Adapter Last.fm — percorso ibrido (API via proxy + file export).
 * `03-ADAPTERS/lastfm.md` v1.0 🟢 APPROVED · `13-ADR/0010` per `parseRemote?()`.
 */
export {
  LastfmAdapter,
  parseCsvRows,
  parseJsonExportRows,
  type LastfmAdapterConfig,
} from './adapter';
export {
  LastfmApiClient,
  LASTFM_MAX_LIMIT,
  LASTFM_REQUESTS_PER_SECOND,
  TokenBucket,
  lastfmErrorToAdapterError,
  type LastfmApiConfig,
  type LastfmPage,
} from './api';
export {
  detectLastfmFile,
  isFourColumnRow,
  isGhanlHeader,
  isGhanlJson,
  readFirstLine,
} from './detect';
export {
  buildLastfmSourceEventId,
  lastfmMinuteKey,
  looksLikeLastfmMinuteDate,
  mapLastfmApiTrack,
  mapLastfmFileRow,
  parseLastfmMinuteDate,
  type LastfmDiscardReason,
  type LastfmFileRow,
  type LastfmMapResult,
} from './mapEvent';
export {
  lastfmAlbumText,
  lastfmArtistMbid,
  lastfmArtistText,
  lastfmTotalPages,
  lastfmTrackList,
  type LastfmAlbumObject,
  type LastfmApiTrack,
  type LastfmArtistObject,
  type LastfmDate,
  type LastfmFourColumnRow,
  type LastfmGhanlRow,
  type LastfmRecentTracksAttr,
  type LastfmRecentTracksResponse,
  type LastfmTrackAttr,
} from './types';
