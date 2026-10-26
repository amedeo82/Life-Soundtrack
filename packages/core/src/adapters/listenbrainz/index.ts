/**
 * Adapter ListenBrainz — export API (file-only nella Story 1.3).
 * `03-ADAPTERS/listenbrainz.md` v1.0 🟢 APPROVED.
 */
export { ListenBrainzAdapter } from './adapter';
export { detectListenBrainz, isListenBrainzArchive } from './detect';
export {
  LISTEN_MINIMUM_TS,
  buildSourceEventId,
  extractArtistMbid,
  extractRecordingMbid,
  mapListenBrainzEvent,
  reconstructArtistName,
  type ListenBrainzDiscardReason,
  type ListenBrainzMapResult,
} from './mapEvent';
export {
  isListenBrainzListen,
  type ListenBrainzAdditionalInfo,
  type ListenBrainzArtistCredit,
  type ListenBrainzListen,
  type ListenBrainzMbidMapping,
  type ListenBrainzTrackMetadata,
} from './types';
