/**
 * Barrel pubblico del modulo geolocalizzazione IP locale (L2) —
 * `13-ADR/0009-local-ip-geolocation.md` v1.0 🟢 (Story 4.4).
 *
 * Esposto come subpath `@ls/core/geo`: il core resta **senza React** e senza
 * accesso diretto alla rete. `fetch`, clock, cache storage e logger sono
 * iniettati dall'app, così i test non toccano mai la rete.
 */

export type { CityResult, CacheStorage, GeoConfig, GeoDeps, GeoLookup, GeoPolicy } from './types';
export { CITY_CONFIDENCE_THRESHOLD, CITY_DB_STALE_MS, GeoError } from './types';
export {
  createMmdbLookup,
  createDisabledLookup,
  createGeoPolicy,
  deriveCity,
  isDbStale,
} from './mmdb';
