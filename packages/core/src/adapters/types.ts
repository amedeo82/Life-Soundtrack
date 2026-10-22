import type { DeviceType, LibraryKind, PlatformId, Playlist } from '../schema';

/**
 * Contratto adapter — `05-ARCHITECTURE.md` §4.
 *
 * L'adapter emette `RawListenEvent` (metadati nativi della piattaforma);
 * il core li trasforma in `ListenEvent` con la pipeline di `05§3.1`
 * (normalizzazione, eventKey, DEDUP, day, device mapping).
 */

/**
 * Evento di ascolto grezzo, output dell'adapter (05§3.1).
 *
 * I timestamp sono già normalizzati dall'adapter a unix ms UTC con la
 * semantica "fine ascolto" di `02-DATA-SCHEMA.md` §2 (Spotify: `ts`).
 */
export interface RawListenEvent {
  platform: PlatformId;
  /**
   * ID nativo stabile dell'evento (05§3.2: es. Spotify `trackId@played_at`).
   * null ⇒ il core usa il fallback sha1(trackKey|timestamp|durationMs).
   */
  sourceEventId: string | null;
  /** Unix ms UTC — fine ascolto. */
  rawTimestamp: number;
  /** Unix ms UTC — inizio ascolto, null se non ricavabile. */
  rawStartedAt: number | null;
  /** ms effettivamente ascoltati. */
  sourceDurationMs: number;
  sourceTrackUri: string | null;
  sourceTrackName: string | null;
  sourceArtistName: string | null;
  /**
   * URI convenzionale dell'artista nativo, se la piattaforma lo espone
   * (youtube-music.md §3.1.2: `youtube_music:channel:<channelId>`); il core
   * deriva da esso `Artist.platformIds[platform]` con la stessa convenzione
   * "ultimo segmento" di `sourceTrackUri`. null se la piattaforma non lo
   * espone (Spotify GDPR: null).
   */
  sourceArtistUri: string | null;
  sourceAlbumName: string | null;
  /** ISRC nativo se la piattaforma lo espone (Spotify GDPR: null, 03-ADAPTERS/spotify.md §3.1.1). */
  isrc: string | null;
  /** MBID nativo se la piattaforma lo espone (Spotify GDPR: null). */
  mbid: string | null;
  /** Derivato dall'adapter quando la piattaforma lo consente (Spotify: `reason_end === 'trackdone'`). */
  completed: boolean | null;
  /** Derivato dall'adapter con la regola della piattaforma (Spotify: E1, spotify.md §3.3). */
  skipped: boolean | null;
  shuffle: boolean | null;
  offline: boolean | null;
  incognito: boolean | null;
  reasonStart: string | null;
  reasonEnd: string | null;
  /** Già mappato dall'adapter (spotify.md §3.2); il core lo copia su `ListenEvent`. */
  deviceType: DeviceType;
  /** Valore raw della piattaforma (es. "iOS 16.4 (iPhone 13)"). */
  deviceDetail: string | null;
  /** Conservato SOLO se `PrivacySettings.retainIp` (02§3.8); mai inviato in rete. */
  ip: string | null;
  /** ISO 3166-1 alpha-2, sempre derivato anche se l'IP è scartato. */
  country: string | null;
}

/** Opzioni di parse (05§4: cancellazione cooperativa via `AbortSignal`). */
export interface ParseOptions {
  signal?: AbortSignal;
  /**
   * Callback per i codici di segnalazione per-evento (T0.3.7, i18n §9
   * dell'adapter, es. `adapter.spotify.warn.podcastSkipped`). Chiamato una
   * volta per occorrenza.
   */
  onWarning?: (code: string) => void;
}

/** Riferimento a un elemento di playlist non ancora risolto su un Track. */
export interface RawPlaylistItemRef {
  playlistId: string;
  sourceTrackUri: string | null;
  position: number | null;
  addedAt: number | null;
}

/** Riferimento library non ancora risolto su un'entità del DB. */
export interface RawLibraryRef {
  kind: LibraryKind;
  /** URI nativo della piattaforma (es. `spotify:track:...`). */
  uri: string | null;
  /** Nome visualizzato grezzo, per la risoluzione via nome quando l'uri manca. */
  name: string | null;
  addedAt: number | null;
}

/** Snapshot library/playlist emesso da `parseLibrary` (03-ADAPTERS SPEC-TEMPLATE §3.2). */
export interface LibrarySnapshot {
  playlists: Playlist[];
  playlistItems: RawPlaylistItemRef[];
  libraryItems: RawLibraryRef[];
}

/** Contratto logico che ogni adapter espone (05§4). */
export interface PlatformAdapter {
  readonly platform: PlatformId;
  /** Nome commerciale, es. "Spotify". */
  readonly name: string;
  /** Semver dell'adapter. */
  readonly version: string;
  /**
   * Riconoscimento del formato. I caller devono sempre trattarlo come
   * Promise con `await` (D.A.8), anche quando l'implementazione è statica.
   */
  detect(input: Blob): boolean | Promise<boolean>;
  /** Parsing streaming: mai caricare tutti gli eventi in memoria in un colpo. */
  parse(input: Blob, options?: ParseOptions): AsyncIterable<RawListenEvent>;
  /** Parsing dei file library/playlist/follow, se la piattaforma li espone. */
  parseLibrary?(input: Blob): Promise<LibrarySnapshot>;
}
