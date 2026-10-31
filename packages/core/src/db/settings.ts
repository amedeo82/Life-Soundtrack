import type { LifeSoundtrackDB } from './db';

/**
 * Impostazioni locali dell'app (`02-DATA-SCHEMA.md` §6, tabella `settings`).
 *
 * Sono **impostazioni**, non dati di ascolto: proxy Last.fm, `api_key`,
 * username. Vanno conservate **solo sul dispositivo** (ADR-0002 local-first,
 * `09-PRIVACY-SECURITY.md` §3.2): nessun segreto è mai embedded nel bundle
 * (ADR-0010 V4) e nessuna chiave viene mai scritta nei log.
 */

/** Una voce della tabella `settings` (chiave/valore). */
export interface AppSetting {
  /** Chiave della voce (es. `lastfm.config`). */
  key: string;
  /** Valore arbitrario (JSON-serializzabile). */
  value: unknown;
  /** Data di ultima modifica (unix ms). */
  updatedAt: number;
}

/** Chiave della configurazione Last.fm. */
export const LASTFM_SETTINGS_KEY = 'lastfm.config';

/** Chiave della configurazione ListenBrainz. */
export const LISTENBRAINZ_SETTINGS_KEY = 'listenbrainz.config';

/**
 * Chiave del cursore di sync incrementale ListenBrainz (C-SH.1).
 *
 * Senza persistenza ogni sync ripartirebbe da capo: il percorso incrementale
 * deve **non** re-importare da zero (`20-SCROBBLING-HUB.md` §9).
 */
export const SCROBBLE_CURSOR_LISTENBRAINZ_KEY = 'scrobble.cursor.listenbrainz';

/**
 * Chiave del fuso orario dell'utente (Story 1.6, `19-GEO-CONTEXT.md` §5.3).
 *
 * Il classificatore di contesto usa l'ora **locale** ("ascolto la sera"): il
 * fuso è un dato, non un parametro dell'algoritmo, quindi non entra nel
 * `derivedVersion`. La spec chiede esplicitamente una **copia nelle
 * impostazioni**: `PatternPayload.userTimezone` è un campo derivato e non
 * può esserne la fonte.
 */
export const APP_TIMEZONE_SETTINGS_KEY = 'app.timezone';

/**
 * Modalità del proxy Last.fm (D-SH.14).
 *
 * - `read-only` (default): il proxy inoltra solo GET → l'hub resta in sola
 *   lettura e l'app **non tenta** la scrittura;
 * - `read-write`: il proxy inoltra anche POST con body → la scrittura è
 *   abilitata.
 */
export type LastfmProxyMode = 'read-only' | 'read-write';

/**
 * Configurazione Last.fm **per-utente**.
 *
 * - `proxyBaseUrl`: base URL del proxy CORS configurato dall'utente
 *   (D-LF.0). Stringa vuota = percorso API non utilizzabile: la card è
 *   `disabled` e **zero richieste** vengono fatte (E.LF.7).
 * - `apiKey`: chiave per-app dell'utente (D-LF.1). **Mai** embedded nel
 *   bundle, mai nei log.
 * - `username`: nome utente Last.fm (dato personale, escluso dal bundle).
 * - `sharedSecret` e `sessionKey`: credenziali del percorso **web auth**
 *   (D-LF.2), necessarie alla firma `api_sig` (D-SH.11). Per-utente, mai nel
 *   bundle.
 * - `proxyMode`: modalità dichiarata del proxy (D-SH.14). Il default
 *   `read-only` evita che l'app tenti scritture su un proxy che non le
 *   inoltra.
 */
export interface LastfmConfig {
  /** Base URL del proxy CORS. */
  proxyBaseUrl: string;
  /** Chiave API per-utente. */
  apiKey: string;
  /** Nome utente Last.fm. */
  username: string;
  /** Shared secret del percorso web auth (mai nel bundle). */
  sharedSecret: string;
  /** Session key (`sk`) del percorso web auth (mai nel bundle). */
  sessionKey: string;
  /** Modalità dichiarata del proxy (D-SH.14). */
  proxyMode: LastfmProxyMode;
}

/** Configurazione vuota (nessun proxy, nessuna chiave, nessun utente). */
export const EMPTY_LASTFM_CONFIG: LastfmConfig = {
  proxyBaseUrl: '',
  apiKey: '',
  username: '',
  sharedSecret: '',
  sessionKey: '',
  proxyMode: 'read-only',
};

/** Configurazione ListenBrainz **per-utente** (User Token). */
export interface ListenbrainzConfig {
  /** User Token: necessario in scrittura (`POST /1/submit-listens`) e nel
   * percorso incrementale (`/1/user/{u}/listens`). Mai nel bundle. */
  token: string;
}

/** Configurazione ListenBrainz vuota. */
export const EMPTY_LISTENBRAINZ_CONFIG: ListenbrainzConfig = {
  token: '',
};

/** Cursore di sync incrementale per hub (C-SH.1). */
export interface ScrobbleCursor {
  /** Ultimo `listened_at` letto (unix s UTC), null se nessuna sync. */
  maxTs: number | null;
  /** ts (unix ms) dell'ultima sync conclusa. */
  lastSyncedAt: number | null;
}

/** Cursore vuoto. */
export const EMPTY_SCROBBLE_CURSOR: ScrobbleCursor = {
  maxTs: null,
  lastSyncedAt: null,
};

/** Legge una voce dalla tabella `settings` (null se assente). */
export async function getSetting<T>(db: LifeSoundtrackDB, key: string): Promise<T | null> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : null;
}

/** Scrive (o sovrascrive) una voce nella tabella `settings`. */
export async function setSetting<T>(db: LifeSoundtrackDB, key: string, value: T): Promise<void> {
  await db.settings.put({ key, value, updatedAt: Date.now() });
}

/** Carica la configurazione Last.fm (campi vuoti se assente). */
export async function loadLastfmConfig(db: LifeSoundtrackDB): Promise<LastfmConfig> {
  const stored = await getSetting<Partial<LastfmConfig>>(db, LASTFM_SETTINGS_KEY);
  return {
    proxyBaseUrl: stored?.proxyBaseUrl ?? '',
    apiKey: stored?.apiKey ?? '',
    username: stored?.username ?? '',
    sharedSecret: stored?.sharedSecret ?? '',
    sessionKey: stored?.sessionKey ?? '',
    proxyMode: stored?.proxyMode === 'read-write' ? 'read-write' : 'read-only',
  };
}

/** Salva la configurazione Last.fm. */
export async function saveLastfmConfig(db: LifeSoundtrackDB, config: LastfmConfig): Promise<void> {
  await setSetting(db, LASTFM_SETTINGS_KEY, {
    proxyBaseUrl: config.proxyBaseUrl.trim(),
    apiKey: config.apiKey.trim(),
    username: config.username.trim(),
    sharedSecret: config.sharedSecret.trim(),
    sessionKey: config.sessionKey.trim(),
    proxyMode: config.proxyMode === 'read-write' ? 'read-write' : 'read-only',
  });
}

/** Carica la configurazione ListenBrainz (token vuoto se assente). */
export async function loadListenbrainzConfig(db: LifeSoundtrackDB): Promise<ListenbrainzConfig> {
  const stored = await getSetting<Partial<ListenbrainzConfig>>(db, LISTENBRAINZ_SETTINGS_KEY);
  return { token: stored?.token ?? '' };
}

/** Salva la configurazione ListenBrainz. */
export async function saveListenbrainzConfig(
  db: LifeSoundtrackDB,
  config: ListenbrainzConfig,
): Promise<void> {
  await setSetting(db, LISTENBRAINZ_SETTINGS_KEY, { token: config.token.trim() });
}

/** Carica il cursore di sync incrementale ListenBrainz (C-SH.1). */
export async function loadScrobbleCursor(
  db: LifeSoundtrackDB,
  key: string = SCROBBLE_CURSOR_LISTENBRAINZ_KEY,
): Promise<ScrobbleCursor> {
  const stored = await getSetting<Partial<ScrobbleCursor>>(db, key);
  return {
    maxTs: typeof stored?.maxTs === 'number' ? stored.maxTs : null,
    lastSyncedAt: typeof stored?.lastSyncedAt === 'number' ? stored.lastSyncedAt : null,
  };
}

/** Salva il cursore di sync incrementale. */
export async function saveScrobbleCursor(
  db: LifeSoundtrackDB,
  cursor: ScrobbleCursor,
  key: string = SCROBBLE_CURSOR_LISTENBRAINZ_KEY,
): Promise<void> {
  await setSetting(db, key, {
    maxTs: cursor.maxTs,
    lastSyncedAt: cursor.lastSyncedAt,
  });
}

/**
 * Carica il fuso orario dell'utente (IANA).
 *
 * Default `'UTC'`: è il confine che il resto del layer di analisi usa
 * (`analysis/datetime.ts`), quindi un utente senza fuso impostato non vede
 * il proprio orario spostato.
 */
export async function loadUserTimezone(db: LifeSoundtrackDB): Promise<string> {
  const stored = await getSetting<string>(db, APP_TIMEZONE_SETTINGS_KEY);
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : 'UTC';
}

/** Salva il fuso orario dell'utente (IANA, es. `Europe/Rome`). */
export async function saveUserTimezone(db: LifeSoundtrackDB, timezone: string): Promise<void> {
  await setSetting(db, APP_TIMEZONE_SETTINGS_KEY, timezone.trim());
}

/**
 * True se il percorso API Last.fm è utilizzabile: proxy, chiave e nome
 * utente valorizzati (D-LF.0, E.LF.7).
 */
export function isLastfmConfigured(config: LastfmConfig): boolean {
  return (
    config.proxyBaseUrl.trim().length > 0 &&
    config.apiKey.trim().length > 0 &&
    config.username.trim().length > 0
  );
}

/**
 * True se il percorso **di scrittura** Last.fm è utilizzabile: percorso API
 * valorizzato, proxy dichiarato in modalità `read-write` (D-SH.14) e credenziali
 * web auth presenti (`api_key` + `shared secret` + `sk`, D-LF.2).
 *
 * Senza tutti e tre gli elementi l'app **non tenta** la scrittura: zero
 * richieste, nessun errore a runtime (P-SH.3, U-SH.2).
 */
export function isLastfmWriteConfigured(config: LastfmConfig): boolean {
  return (
    isLastfmConfigured(config) &&
    config.proxyMode === 'read-write' &&
    config.sharedSecret.trim().length > 0 &&
    config.sessionKey.trim().length > 0
  );
}

/** True se il percorso di scrittura ListenBrainz è utilizzabile (User Token). */
export function isListenbrainzWriteConfigured(config: ListenbrainzConfig): boolean {
  return config.token.trim().length > 0;
}
