/**
 * Schema dati unificato — source of truth.
 * Rispecchia `docs/02-DATA-SCHEMA.md` §3 (interfacce) e §4 (payload insight), v1.2 APPROVED.
 * Vincolante per adapter (03), analisi (04), db (core/db) e test (10).
 */

/** Piattaforme supportate — 02-DATA-SCHEMA.md §3.1. */
export const PLATFORM_IDS = [
  'spotify',
  'youtube_music',
  'apple_music',
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

/**
 * Hub di scrobbling abilitati — 02-DATA-SCHEMA.md §3.8, Story 1.5.
 *
 * Tipo **dedicato**, non `PlatformId`: i due insiemi non coincidono. Un hub è
 * una *fonte* di scrobble; i client di scrobbling (`maloja`, `subsonic`, `roon`)
 * sono destinatari e non piattaforme sorgente (`01-PLATFORMS.md` §3.9). Il tipo
 * dedicato rende il toggle per-hub verificabile a compile time.
 */
export const SCROBBLE_HUB_IDS = ['lastfm', 'listenbrainz'] as const;

export type ScrobbleHubId = (typeof SCROBBLE_HUB_IDS)[number];

export const DEVICE_TYPES = [
  'mobile',
  'desktop',
  'web',
  'speaker',
  'car',
  'wearable',
  'tv',
  'unknown',
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];

export const MOOD_IDS = ['sad', 'angry', 'neutral', 'calm', 'happy', 'excited'] as const;

export type MoodId = (typeof MOOD_IDS)[number];

/** Evento di ascolto: l'atomo dello schema. 02-DATA-SCHEMA.md §3.2. */
export interface ListenEvent {
  /** UUID interno. */
  id: string;
  /** Chiave di idempotenza, UNIQUE (primaria in Dexie, §6). */
  eventKey: string;
  platform: PlatformId;
  /** FK imports. */
  importId: string;
  /** Unix ms UTC — fine ascolto (§2). */
  timestamp: number;
  /** Unix ms UTC — inizio ascolto, null se non noto. */
  startedAt: number | null;
  /** ms effettivamente ascoltati. */
  durationMs: number;
  /** FK tracks: Track.id (UUID, come nei fixture 10-TESTING §3.2; PK di tracks è canonicalKey). */
  trackId: string;
  /** Ascoltato fino alla fine. */
  completed: boolean;
  /** Derivato dall'adapter (regola E1, 03-ADAPTERS/SPEC-TEMPLATE.md). */
  skipped: boolean;
  shuffle: boolean | null;
  offline: boolean | null;
  incognito: boolean | null;
  reasonStart: string | null;
  reasonEnd: string | null;
  deviceType: DeviceType;
  deviceDetail: string | null;
  /** Conservato SOLO se PrivacySettings.retainIp; purgabile con purgeIp(). */
  ip: string | null;
  /** ISO 3166-1 alpha-2, sempre derivato (privacy-by-design, §3.8). */
  country: string | null;
  /** 'YYYY-MM-DD' UTC, derivato da timestamp, indicizzato. */
  day: string;
}

/** Brano normalizzato. 02-DATA-SCHEMA.md §3.3. */
export interface Track {
  /** UUID interno (canonicalKey è la chiave primaria in Dexie, §6). */
  id: string;
  /** UNIQUE — regola DEDUP §5 (isrc: | mbid: | fuzzy:). */
  canonicalKey: string;
  name: string;
  artistId: string;
  albumId: string | null;
  durationMs: number | null;
  isrc: string | null;
  /** MusicBrainz Recording ID. */
  mbid: string | null;
  explicit: boolean | null;
  /** Popolato da enrichment (MusicBrainz) o dall'adapter. */
  genres: string[];
  /** URL immagine di copertina (lato). vedi 02 §11 fonti (Spotify API → MB Cover Art → iTunes Search → placeholder). */
  artworkUrl: string | null;
  platformIds: Partial<Record<PlatformId, string>>;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Contatore denormalizzato, ricalcolabile con recount() (§7 MIG-4). */
  listenCount: number;
}

/** Artista normalizzato. 02-DATA-SCHEMA.md §3.3. */
export interface Artist {
  id: string;
  name: string;
  mbid: string | null;
  /** Popolato da enrichment (MusicBrainz) o dall'adapter. */
  genres: string[];
  platformIds: Partial<Record<PlatformId, string>>;
  /** Contatore denormalizzato, ricalcolabile con recount() (§7 MIG-4). */
  listenCount: number;
}

/** Album normalizzato. 02-DATA-SCHEMA.md §3.3. */
export interface Album {
  id: string;
  name: string;
  artistId: string;
  mbid: string | null;
  upc: string | null;
  /** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'. */
  releaseDate: string | null;
  /** URL immagine di copertina album. vedi 02 §11 fonti. */
  artworkUrl: string | null;
  platformIds: Partial<Record<PlatformId, string>>;
}

/** Feature audio per traccia (PK trackId). 02-DATA-SCHEMA.md §3.4. */
export interface AudioFeatures {
  trackId: string;
  /** 0..1 positività emotiva. */
  valence: number | null;
  /** 0..1 intensità. */
  energy: number | null;
  danceability: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  speechiness: number | null;
  liveness: number | null;
  /** BPM. */
  tempo: number | null;
  /** 0-11. */
  key: number | null;
  /** 0=minore 1=maggiore. */
  mode: 0 | 1 | null;
  /** dB. */
  loudness: number | null;
  timeSignature: number | null;
  source: 'acousticbrainz' | 'essentia' | 'heuristic' | 'manual';
  fetchedAt: number;
  schemaVersion: number;
}

/** Sessione di ascolto (derivata, ricostruibile). 02-DATA-SCHEMA.md §3.5. */
export interface ListeningSession {
  id: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  eventCount: number;
  trackCount: number;
  platform: PlatformId;
  deviceType: DeviceType;
  /** Parametro usato (default 1_800_000). */
  gapThresholdMs: number;
  derivedVersion: string;
}

export const INSIGHT_TYPES = [
  'mood_day',
  'mood_week',
  'mood_month',
  'era',
  'event',
  'memory',
  'pattern',
] as const;

export type InsightType = (typeof INSIGHT_TYPES)[number];

/** Insight derivato con verdetto utente. 02-DATA-SCHEMA.md §3.6. */
export interface Insight {
  id: string;
  type: InsightType;
  periodStart: number;
  periodEnd: number;
  /** Unione discriminata (§4). */
  payload: InsightPayload;
  /** 0..1. */
  confidence: number;
  derivedVersion: string;
  status: 'pending' | 'confirmed' | 'corrected' | 'dismissed';
  userNote: string | null;
  createdAt: number;
}

/** Esito di un import. 02-DATA-SCHEMA.md §3.7. */
export interface ImportRecord {
  id: string;
  platform: PlatformId;
  fileName: string;
  /** sha256 del file. */
  fileHash: string;
  startedAt: number;
  completedAt: number | null;
  status: 'running' | 'done' | 'partial' | 'failed';
  eventsParsed: number;
  eventsInserted: number;
  eventsDuplicated: number;
  /** Codici edge case (E1..E10). */
  warnings: string[];
}

export const LIBRARY_KINDS = ['saved_track', 'saved_album', 'followed_artist'] as const;

export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export interface LibraryItem {
  id: string;
  platform: PlatformId;
  kind: LibraryKind;
  trackId: string | null;
  albumId: string | null;
  artistId: string | null;
  addedAt: number | null;
}

export interface Playlist {
  id: string;
  platform: PlatformId;
  name: string;
  createdAt: number | null;
  lastModifiedAt: number | null;
}

export interface PlaylistItem {
  playlistId: string;
  trackId: string;
  position: number | null;
  addedAt: number | null;
}

/**
 * Toggle privacy espliciti, tutti default off. 02-DATA-SCHEMA.md §3.8.
 * Non ha una tabella Dexie dedicata (§6): è persistito al livello app.
 */
export interface PrivacySettings {
  /** Default false; toggle ESPLICITO dell'utente. */
  retainIp: boolean;
  /** Default false; arricchimento metadati brani. */
  enrichMetadata: boolean;
  /** Default false; rilevamento ascolti in auto (consenso dedicato, D.2.2). */
  carDetectionConsent: boolean;
  /**
   * Default []; hub di scrobbling scelti (Story 1.5).
   *
   * Tipo **dedicato** (`ScrobbleHubId`), non `PlatformId`: i client di
   * scrobbling non sono piattaforme sorgente (`01-PLATFORMS.md` §3.9).
   * Il consenso è per-hub e indipendente dagli altri toggle; togliere un hub
   * svuota la sua coda (`20-SCROBBLING-HUB.md` §10.1).
   */
  scrobbleHubs: ScrobbleHubId[];
  /** Default false; sync E2E opzionale (Fase 2, ADR-0005). */
  syncCloud: boolean;
}

/** Criterio di ricerca conservato. 02-DATA-SCHEMA.md §3.9. */
export interface SearchQuery {
  id: string;
  platform: PlatformId;
  /** Testo libero cercato dall'utente. */
  query: string;
  /** Query normalizzata (lowercase, trim) per dedup. */
  normalized: string;
  /** Unix ms UTC. */
  timestamp: number;
  /** null se non disponibile. */
  resultCount: number | null;
  context: 'manual' | 'browse' | 'recommendation';
}

// --- §4 Payload degli Insight (unione discriminata) ---

export interface EraPayload {
  kind: 'era';
  /** es. "Era Malinconia". */
  label: string;
  moodDominant: MoodId;
  topArtistIds: string[];
  topTrackIds: string[];
  genreDistribution: Record<string, number>;
  avgValence: number;
  avgEnergy: number;
  /** Quota ascolti 00-06. */
  nightShare: number;
  /** Quota brani già noti. */
  repeatRate: number;
}

export interface MoodPeriodPayload {
  kind: 'mood';
  mood: MoodId;
  avgValence: number;
  avgEnergy: number;
  eventCount: number;
}

export type EventKind =
  | 'spike_artist'
  | 'spike_genre'
  | 'valence_drop'
  | 'valence_rise'
  | 'volume_spike'
  | 'volume_drop'
  | 'exploration'
  | 'silence';

export interface EventPayload {
  kind: 'event';
  eventType: EventKind;
  /** Frase in linguaggio naturale. */
  description: string;
  metrics: Record<string, number>;
}

export type MemoryKind = 'on_this_day' | 'first_time' | 'milestone' | 'return' | 'seasonal';

export interface MemoryPayload {
  kind: 'memory';
  memoryKind: MemoryKind;
  trackId: string | null;
  artistId: string | null;
  yearsAgo: number | null;
  text: string;
}

export type PatternKind = 'circadian' | 'weekly' | 'seasonal';

export interface PatternPayload {
  kind: 'pattern';
  patternType: PatternKind;
  /** es. ora->quota, giorno->quota, mese->quota. */
  buckets: Record<string, number>;
  /** 0..23, in userTimezone (circadian). */
  peakHour: number | null;
  /** 0=Sun..6=Sat, in userTimezone (weekly). */
  peakDay: number | null;
  /** 1..12, in userTimezone (seasonal). */
  peakMonth: number | null;
  /** Quota ascolti 00:00-05:59 (userTimezone). */
  nightShare: number | null;
  /** Quota sab+dom (userTimezone). */
  weekendShare: number | null;
  /** IANA tz, es. 'Europe/Rome'. */
  userTimezone: string;
}

export type InsightPayload =
  EraPayload | MoodPeriodPayload | EventPayload | MemoryPayload | PatternPayload;
