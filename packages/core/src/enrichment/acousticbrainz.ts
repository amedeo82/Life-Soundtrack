/**
 * Il provider AcousticBrainz — `21-AUDIO-FEATURES.md` v1.0 🟢 §7.
 *
 * Caratteristiche del ramo:
 *
 * - **richiede un MBID di recording**: senza, il ramo salta (è la Story 4.2
 *   a procurarlo — `21§7.1`);
 * - il **rate limit si legge dagli header** `X-RateLimit-*`, senza costanti
 *   hard-coded (D-AF.6, `21§7.2`);
 * - `valence` ed `energy` **non esistono** in AcousticBrainz: sono derivate
 *   dalle classi `mood_*` con pesi dichiarati (`21§7.3`), e il `source`
 *   resta `acousticbrainz` (D-AF.8);
 * - nella prima tranche si usa **solo** `high-level`: `tempo`, `key`,
 *   `mode` e `loudness` restano `null` (`21§7.4`).
 */

import {
  ACOUSTICBRAINZ_TTL_MS,
  CURRENT_FEATURE_SCHEMA_VERSION,
  deriveEnergyFromMood,
  deriveValenceFromMood,
} from './mapping';
import { parseRetryAfterMs } from './rateLimiter';
import type { AcousticBrainzMood } from './mapping';
import type { AudioFeatures, Track } from '../schema';
import type {
  AudioFeatureProvider,
  Clock,
  FeatureContext,
  HttpClient,
  Logger,
  RateLimiter,
} from './types';

/** L'host di AcousticBrainz (`21§7.1`). */
export const ACOUSTICBRAINZ_API_BASE = 'https://acousticbrainz.org/api/v1';

/** Il documento `high-level` di AcousticBrainz. */
export interface AcousticBrainzHighLevel {
  /** Il documento `high-level`. */
  readonly 'high-level'?: Readonly<Record<string, unknown>>;
}

/**
 * Legge un campo numerico del documento AB.
 *
 * AcousticBrainz espone i valori come `{"value": 0.42}`; il parser accetta
 * anche il numero grezzo, così un fixture o una risposta alternativa non
 * fanno fallire l'intero ramo.
 *
 * @param node - il nodo del documento.
 * @returns il numero, `null` se non c'è.
 */
export function readNumericField(node: unknown): number | null {
  if (typeof node === 'number' && Number.isFinite(node)) return node;
  if (node !== null && typeof node === 'object' && 'value' in node) {
    const value = (node as { value: unknown }).value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * Estrae le classi mood dal documento `high-level`.
 *
 * @param document - la risposta completa dell'endpoint.
 * @returns le classi mood e `danceable`.
 */
export function extractMood(document: AcousticBrainzHighLevel): AcousticBrainzMood {
  const node = document['high-level'] ?? {};
  const read = (key: string): number | undefined => {
    const value = readNumericField(node[key]);
    return value === null ? undefined : value;
  };
  return {
    mood_happy: read('mood_happy'),
    mood_sad: read('mood_sad'),
    mood_relaxed: read('mood_relaxed'),
    mood_party: read('mood_party'),
    mood_aggressive: read('mood_aggressive'),
    mood_acoustic: read('mood_acoustic'),
    mood_electronic: read('mood_electronic'),
    danceable: read('danceable'),
  };
}

/** Opzioni del provider AcousticBrainz. */
export interface AcousticBrainzProviderOptions {
  /** Il client HTTP iniettato. */
  readonly http: HttpClient;
  /** Il limiter (a header, D-AF.6). */
  readonly limiter: RateLimiter;
  /** L'orologio iniettato. */
  readonly clock: Clock;
  /** Il logger (opzionale). */
  readonly logger?: Logger;
  /** La base dell'API (sovrascrivibile nei test). */
  readonly apiBase?: string;
}

/**
 * Il provider AcousticBrainz.
 *
 * Il ramo è condizionato dall'**MBID**: senza MBID salta (`21§5.1`).
 */
export function createAcousticBrainzProvider(
  options: AcousticBrainzProviderOptions,
): AudioFeatureProvider {
  const { http, limiter, clock, logger, apiBase = ACOUSTICBRAINZ_API_BASE } = options;

  return {
    id: 'acousticbrainz',

    canHandle(track: Track): boolean {
      return typeof track.mbid === 'string' && track.mbid.length > 0;
    },

    async fetch(track: Track, _context: FeatureContext): Promise<AudioFeatures | null> {
      const mbid = track.mbid;
      if (mbid === null || mbid.length === 0) return null;

      await limiter.acquire();
      const url = `${apiBase}/${encodeURIComponent(mbid)}/high-level`;
      let response;
      try {
        response = await http.request(url, { method: 'GET' });
      } catch (error) {
        logger?.warn('AcousticBrainz: richiesta fallita', {
          trackId: track.id,
          reason: error instanceof Error ? error.name : 'unknown',
        });
        return null;
      }
      limiter.observe(response.headers);

      if (response.status === 429) {
        const retryAfter = parseRetryAfterMs(response.headers, clock.now());
        limiter.cooldown(retryAfter);
        logger?.warn('AcousticBrainz: rate limit raggiunto', {
          trackId: track.id,
          retryAfterMs: retryAfter,
        });
        return null;
      }
      if (response.status === 404) {
        logger?.debug('AcousticBrainz: nessun documento per il recording', {
          trackId: track.id,
        });
        return null;
      }
      if (response.status < 200 || response.status >= 300) {
        logger?.warn('AcousticBrainz: risposta non OK', {
          trackId: track.id,
          status: response.status,
        });
        return null;
      }

      let document: AcousticBrainzHighLevel;
      try {
        document = JSON.parse(response.body) as AcousticBrainzHighLevel;
      } catch {
        logger?.warn('AcousticBrainz: risposta non JSON', { trackId: track.id });
        return null;
      }

      const mood = extractMood(document);
      const hasMood =
        mood.mood_happy !== undefined ||
        mood.mood_sad !== undefined ||
        mood.mood_relaxed !== undefined ||
        mood.mood_party !== undefined ||
        mood.mood_aggressive !== undefined ||
        mood.mood_electronic !== undefined;
      if (!hasMood && mood.danceable === undefined) {
        logger?.debug('AcousticBrainz: documento senza classi mood', { trackId: track.id });
        return null;
      }

      return {
        trackId: track.id,
        valence: deriveValenceFromMood(mood),
        energy: deriveEnergyFromMood(mood),
        danceability: mood.danceable ?? null,
        acousticness: null,
        instrumentalness: null,
        speechiness: null,
        liveness: null,
        tempo: null,
        key: null,
        mode: null,
        loudness: null,
        timeSignature: null,
        source: 'acousticbrainz',
        fetchedAt: clock.now(),
        schemaVersion: CURRENT_FEATURE_SCHEMA_VERSION,
      };
    },
  };
}

/**
 * La feature `acousticbrainz` è scaduta?
 *
 * TTL di 90 giorni (`21§11.2`): il dataset è congelato a giugno 2022, il
 * TTL serve a non servire righe vecchie.
 *
 * @param feature - la feature da valutare.
 * @param now - l'orologio corrente (unix ms).
 * @returns true se la feature è scaduta.
 */
export function isAcousticBrainzExpired(feature: AudioFeatures, now: number): boolean {
  if (feature.source !== 'acousticbrainz') return false;
  return now - feature.fetchedAt >= ACOUSTICBRAINZ_TTL_MS;
}
