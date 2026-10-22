/**
 * Entry point `@ls/core/adapters/youtube` — adapter Google Takeout
 * YouTube Music (03-ADAPTERS/youtube-music.md v1.0 APPROVED).
 */
export { YouTubeMusicAdapter } from './adapter';
export { detectYouTubeMusic, isWatchHistoryJson } from './detect';
export {
  classifyMusicEvent,
  extractChannelId,
  extractVideoId,
  hasWatchVerbPrefix,
  mapYouTubeEvent,
  stripWatchVerbPrefix,
  WATCH_URL_RE,
  WATCH_VERB_PREFIXES,
  YT_HEADERS,
  type MusicClassification,
  type YouTubeMapResult,
} from './mapEvent';
export { isYouTubeActivityRecord, type YouTubeActivityRecord } from './types';
