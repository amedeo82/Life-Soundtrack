import type { ScrobbleHubId } from '../../schema';
import { LastfmScrobbleSink } from '../lastfm/scrobble';
import type { LastfmScrobbleConfig } from '../lastfm/scrobble';
import { ListenbrainzScrobbleSink } from '../listenbrainz/scrobble';
import type { ListenbrainzScrobbleConfig } from '../listenbrainz/scrobble';
import type { ScrobbleSink } from './types';

/**
 * Registry dei sink di scrobbling — `13-ADR/0011-scrobble-sink.md` 🟢 v1.0
 * ("Dove vive il codice") e `20-SCROBBLING-HUB.md` v1.0 §4.
 *
 * È il **gemello** del registry degli adapter: un punto solo da cui ottenere
 * un sink per hub, con la stessa forma di `parseRemote?()` — chi non scrobbla
 * non implementa nulla.
 */

/** Configurazione dei sink: credenziali per-utente, mai nel bundle (G-SH.4). */
export interface ScrobbleSinkConfig {
  /** Credenziali Last.fm (proxy, `api_key`, `shared secret`, `sk`, modalità). */
  lastfm: LastfmScrobbleConfig;
  /** Credenziali ListenBrainz (User Token). */
  listenbrainz: ListenbrainzScrobbleConfig;
  /** `fetch` condiviso (test). */
  fetchImpl?: typeof fetch;
}

/** Factory dei sink, per hub. */
export const SCROBBLE_SINKS: Record<ScrobbleHubId, (config: ScrobbleSinkConfig) => ScrobbleSink> = {
  lastfm: (config) =>
    new LastfmScrobbleSink({
      ...config.lastfm,
      ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    }),
  listenbrainz: (config) =>
    new ListenbrainzScrobbleSink({
      ...config.listenbrainz,
      ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    }),
};

/**
 * Restituisce il sink di un hub.
 *
 * @throws se l'hub non è supportato (mai, per costruzione: il tipo è chiuso).
 */
export function getScrobbleSink(hub: ScrobbleHubId, config: ScrobbleSinkConfig): ScrobbleSink {
  return SCROBBLE_SINKS[hub](config);
}

export { ScrobbleError } from './types';
export type {
  ScrobbleErrorCode,
  ScrobblePayload,
  ScrobbleResult,
  ScrobbleSink,
  ScrobbleSubmitOptions,
} from './types';
export {
  buildListenBrainzBody,
  LISTENBRAINZ_MAX_LISTENS_PER_REQUEST,
  LISTENBRAINZ_DEFAULT_ENDPOINT,
} from '../listenbrainz/scrobble';
export { lastfmApiSignature, LASTFM_MAX_SCROBBLES_PER_REQUEST } from '../lastfm/scrobble';
export {
  collectCandidates,
  enqueueEligibleListens,
  isEligible,
  isMature,
  SCROBBLE_CANDIDACY_WINDOW_MS,
  SCROBBLE_FALLBACK_THRESHOLD_MS,
  SCROBBLE_MIN_DURATION_MS,
  type EligibilityOptions,
  type ResolvedScrobbleCandidate,
  type ScrobbleCandidate,
} from './eligibility';
export {
  runScrobbleCycle,
  SCROBBLE_DEFAULT_BATCH_SIZE,
  type ScrobbleCycleOptions,
  type ScrobbleCycleSummary,
} from './sender';
export {
  syncListenbrainzIncrementally,
  type IncrementalSyncOptions,
  type IncrementalSyncResult,
} from './sync';
