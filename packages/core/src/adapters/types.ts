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
  /**
   * MBID dell'**artista** (Last.fm `artist.mbid`, ListenBrainz
   * `mbid_mapping.artist_mbids[0]`): va sull'entità `Artist.mbid`, non sulla
   * Track. Assente sulle piattaforme che non lo espongono (Spotify GDPR).
   *
   * Nota: `05§3.1` non prevedeva un campo dedicato — il dato era richiesto
   * dalle spec `03-ADAPTERS/lastfm.md` §3.1.2 e `listenbrainz.md` §3.1.2
   * (entrambe 🟢 APPROVED) e il campo è **additivo e opzionale**: gli adapter
   * esistenti non lo valorizzano e restano invariati.
   */
  sourceArtistMbid?: string | null;
  /**
   * Durata **catalogo** del brano (ListenBrainz `additional_info.duration_ms`):
   * un *hint* sull'entità `Track.durationMs`, **non** la durata dell'evento.
   *
   * Il bucket DEDUP-3 usa `sourceDurationMs` (la durata dell'ascolto), che
   * per ListenBrainz e Last.fm è **sempre 0** (D-LB.7 / D-LF.7): la durata
   * catalogo, se presente su una parte degli ascolti e non sull'altra,
   * produrrebbe due `Track` distinte per lo stesso brano (E.LB.2). Tenere i
   * due dati separati rende quel degrado impossibile per costruzione.
   */
  sourceTrackDurationMs?: number | null;
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
  /** Se true, l'adapter può includere l'IP nel RawListenEvent (PrivacySettings.retainIp). */
  retainIp?: boolean;
  /**
   * Callback per i codici di segnalazione per-evento (T0.3.7, i18n §9
   * dell'adapter, es. `adapter.spotify.warn.podcastSkipped`). Chiamato una
   * volta per occorrenza.
   *
   * Il secondo parametro è il **contatore aggregato** per i warning che
   * non sono per-riga (es. `adapter.lastfm.warn.mbidMissing`: un solo
   * avviso con il totale degli ascolti senza MusicBrainz ID, E.LF.5).
   * Se omesso, il contatore vale 1.
   */
  onWarning?: (code: string, count?: number) => void;
}

/**
 * Sorgente dati remota per gli adapter che non consumano un file
 * (`13-ADR/0010-remote-source-adapter.md` §"Decisione", vincoli V1-V8).
 *
 * L'adapter conosce il protocollo della piattaforma: il core fornisce solo
 * *dove* andare e *con cosa* autenticarsi. Il rate limiting è
 * responsabilità dell'adapter (V7): `RemoteSource` non ha un campo per
 * quello, e non deve averlo.
 */
export interface RemoteSource {
  /** URL base dell'API, o del proxy configurato dall'utente (Last.fm). */
  endpoint: string;
  /** Credenziali per-utente. Nessun segreto è mai embedded nel bundle (V4). */
  credentials?: {
    /** Chiave API per-app (es. Last.fm `api_key`). */
    apiKey?: string | undefined;
    /** Chiave di sessione (es. Last.fm `sk` dal web auth). */
    sessionKey?: string | undefined;
  };
  /** Parametri di paginazione, se la piattaforma li supporta. */
  pagination?: {
    /** Massimo elementi per richiesta. */
    limit?: number | undefined;
    /** Finestra temporale iniziale (unix secondi UTC). */
    from?: number | undefined;
    /** Finestra temporale finale (unix secondi UTC). */
    to?: number | undefined;
  };
  /** Header HTTP aggiuntivi (es. User-Agent obbligatorio su ListenBrainz). */
  headers?: Record<string, string> | undefined;
  /** Cancellazione cooperativa dell'import (V6). */
  signal?: AbortSignal;
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
  /**
   * Parsing da **sorgente remota** (`13-ADR/0010`): presente SOLO negli
   * adapter che non consumano un file (Last.fm).
   *
   * Produce **gli stessi `RawListenEvent`** del percorso file (V2): la
   * pipeline di normalizzazione è riusata invariata, e un import da API e
   * uno da file convergono sulle stesse chiavi.
   */
  parseRemote?(source: RemoteSource, options?: ParseOptions): AsyncIterable<RawListenEvent>;
}
