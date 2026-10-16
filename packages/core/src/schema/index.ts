export const PLATFORM_IDS = [
  'spotify',
  'youtube',
  'apple',
  'deezer',
  'tidal',
  'soundcloud',
  'lastfm',
  'listenbrainz',
  'plex',
  'navidrome',
  'manual',
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];
