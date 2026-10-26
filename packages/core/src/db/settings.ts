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

/**
 * Configurazione Last.fm **per-utente**.
 *
 * - `proxyBaseUrl`: base URL del proxy CORS configurato dall'utente
 *   (D-LF.0). Stringa vuota = percorso API non utilizzabile: la card è
 *   `disabled` e **zero richieste** vengono fatte (E.LF.7).
 * - `apiKey`: chiave per-app dell'utente (D-LF.1). **Mai** embedded nel
 *   bundle, mai nei log.
 * - `username`: nome utente Last.fm (dato personale, escluso dal bundle).
 */
export interface LastfmConfig {
  /** Base URL del proxy CORS. */
  proxyBaseUrl: string;
  /** Chiave API per-utente. */
  apiKey: string;
  /** Nome utente Last.fm. */
  username: string;
}

/** Configurazione vuota (nessun proxy, nessuna chiave, nessun utente). */
export const EMPTY_LASTFM_CONFIG: LastfmConfig = {
  proxyBaseUrl: '',
  apiKey: '',
  username: '',
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
  };
}

/** Salva la configurazione Last.fm. */
export async function saveLastfmConfig(db: LifeSoundtrackDB, config: LastfmConfig): Promise<void> {
  await setSetting(db, LASTFM_SETTINGS_KEY, {
    proxyBaseUrl: config.proxyBaseUrl.trim(),
    apiKey: config.apiKey.trim(),
    username: config.username.trim(),
  });
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
