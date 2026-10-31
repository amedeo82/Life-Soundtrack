/**
 * Modulo di geolocalizzazione IP locale (L2) — `13-ADR/0009-local-ip-geolocation.md`
 * v1.0 🟢 e `19-GEO-CONTEXT.md` v1.0 🟢 (Story 4.4).
 *
 * Esposto come subpath `@ls/core/geo`: il core resta **senza React** e senza
 * accesso diretto alla rete. `fetch`, clock, cache storage e logger sono
 * **iniettati**, così i test non toccano mai la rete (`10-TESTING.md` §8:
 * "Mai chiamate reali in CI").
 *
 * La derivazione della città avviene **dentro la pipeline di import**, prima
 * che l'IP venga azzerato (`adapters/pipeline.ts`). Senza database geo o
 * senza `retainCity` attivo, la città resta `null` (edge case E21).
 */

import type { HttpClient } from '../enrichment';
import type { Logger } from '../logger';

/** Risultato della derivazione della città per un IP. */
export interface CityResult {
  /** Città stimata (null se non risolvibile o sotto soglia). */
  readonly city: string | null;
  /** Provenance: `'dbip-lite'` se stimata dal DB locale, `'manual'` se corretta a mano. */
  readonly citySource: 'dbip-lite' | 'manual' | null;
  /** Confidenza della stima 0..1; sotto 0.6 la città viene scartata (D-B.3). */
  readonly cityConfidence: number | null;
}

/** Errore del modulo geo: mai contiene l'IP dell'utente (solo codice e contesto). */
export class GeoError extends Error {
  readonly code:
    | 'DB_NOT_DOWNLOADED'
    | 'DB_DOWNLOAD_FAILED'
    | 'DB_STALE'
    | 'LOOKUP_FAILED'
    | 'IP_NOT_GEOLOCATABLE'
    | 'CITY_DISABLED';
  readonly recoverable: boolean;

  constructor(code: GeoError['code'], message: string, recoverable: boolean) {
    super(message);
    this.name = 'GeoError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

/** Porta di lookup MMDB: data un IP, restituisce città e confidenza. */
export interface GeoLookup {
  /** Risolve l'IP in città + confidenza (null se non risolvibile). */
  lookup(ip: string): Promise<CityResult | null>;
  /** True se il database è presente e utilizzabile. */
  isAvailable(): boolean;
  /** Build date del database (per la UI di freshness). */
  buildDate(): number | null;
}

/** Porta del toggle `PrivacySettings.retainCity` (`02-DATA-SCHEMA.md` §3.8). */
export interface GeoPolicy {
  /** La derivazione della città (L2) è abilitata? */
  isEnabled(): boolean | Promise<boolean>;
}

/** Costante misurabile: soglia di confidenza sotto cui la città viene scartata (D-B.3). */
export const CITY_CONFIDENCE_THRESHOLD = 0.6;

/** Costante misurabile: soglia di staleness del database (60 giorni, ms). */
export const CITY_DB_STALE_MS = 60 * 24 * 60 * 60 * 1000;

/** Configurazione del modulo geo. */
export interface GeoConfig {
  /** Host da cui scaricare il `.mmdb` (dichiarato nella CSP applicata, `12§2.1`). */
  readonly dbIpHost: string;
  /** Path completo del file `.mmdb` da scaricare (es. `/free/dbip-city-lite-2024.mmdb`). */
  readonly mmdbPath: string;
  /** Chiave di Cache Storage per il database scaricato. */
  readonly cacheKey: string;
  /** Chiave delle impostazioni per la build date del database. */
  readonly settingsKey: string;
  /** Chiave delle impostazioni per l'URL del database scaricato. */
  readonly urlSettingsKey: string;
}

/** Porta per l'accesso a Cache Storage (iniettata, non globale). */
export interface CacheStorage {
  /** Recupera un item dalla cache (null se assente). */
  match(request: Request | string): Promise<Response | undefined>;
  /** Salva una risposta nella cache. */
  put(request: Request | string, response: Response): Promise<void>;
  /** Elimina un item dalla cache. */
  delete(request: Request | string): Promise<boolean>;
}

/** Dipendenze del modulo geo (iniettate). */
export interface GeoDeps {
  /** Client HTTP per il download del `.mmdb`. */
  readonly http: HttpClient;
  /** Storage Cache per il database. */
  readonly cache: CacheStorage;
  /** Orologio iniettato (unix ms). */
  readonly clock: { now(): number };
  /** Logger (opzionale). */
  readonly logger?: Logger;
  /** Politica del toggle `retainCity`. */
  readonly policy: GeoPolicy;
}
