/**
 * La cascata di arricchimento — `21-AUDIO-FEATURES.md` v1.0 🟢 §5.
 *
 * L'ordine è quello di `05§6` (APPROVED):
 *
 * ```
 * cache → Essentia.js → AcousticBrainz → euristico
 * ```
 *
 * con i salti dichiarati (§5.1):
 *
 * - il ramo Essentia è condizionato dall'**audio** (preview): senza, salta;
 * - il ramo AcousticBrainz è condizionato dall'**MBID**: senza, salta;
 * - il ramo euristico è sempre disponibile (copre il 100% del catalogo).
 *
 * Regole che la cascata applica **prima** di qualunque altra cosa:
 *
 * - **toggle spento ⇒ zero uscite, zero scritture, zero letture della cache**
 *   (`21§10.4`): il controllo sta prima di ogni accesso, anche della cache;
 * - **mai throws**: un provider che fallisce dà `null` + log, e la cascata
 *   continua con il ramo successivo (`21§4.2`, `05§7.2`);
 * - **un tentativo per ramo**: nessun retry inline (`21§5.3`);
 * - **mai una riga vuota**: senza risultato non c'è riga (`21§11.3`).
 */

import { CURRENT_FEATURE_SCHEMA_VERSION, normalizeFeature } from './mapping';
import { isFeatureExpired } from './storage';
import type { AudioFeatures, Track } from '../schema';
import type {
  AudioFeatureProvider,
  Clock,
  EnrichmentOutcome,
  EnrichmentPolicy,
  FeatureContext,
  FeatureStore,
  Logger,
} from './types';

/** I provider della cascata, per ramo. */
export interface EnrichmentProviders {
  /** Il ramo acustico locale (Essentia). */
  readonly essentia?: AudioFeatureProvider;
  /** Il ramo AcousticBrainz (richiede l'MBID). */
  readonly acousticbrainz?: AudioFeatureProvider;
  /** Il ramo euristico (sempre presente nella pipeline reale). */
  readonly heuristic?: AudioFeatureProvider;
}

/** Opzioni della cascata. */
export interface EnrichmentCascadeOptions {
  /** Il negozio delle feature. */
  readonly store: FeatureStore;
  /** La politica (toggle `enrichMetadata`). */
  readonly policy: EnrichmentPolicy;
  /** L'orologio iniettato. */
  readonly clock: Clock;
  /** I provider, per ramo. */
  readonly providers: EnrichmentProviders;
  /** Il logger (opzionale). */
  readonly logger?: Logger;
  /** La versione corrente dello schema delle feature. */
  readonly schemaVersion?: number;
}

/** L'orchestratore della cascata. */
export interface EnrichmentCascade {
  /**
   * Arricchisce un brano.
   *
   * @param track - il brano.
   * @param context - il contesto (nome dell'artista, generi).
   * @returns l'esito: lo stato e la feature (eventuale).
   */
  enrich(track: Track, context: FeatureContext): Promise<EnrichmentOutcome>;
  /**
   * Arricchisce più brani in sequenza (concurrency 1, `21§5.2`).
   *
   * @param items - i brani e il loro contesto.
   * @returns gli esiti, nello stesso ordine.
   */
  enrichMany(items: readonly EnrichmentRequest[]): Promise<EnrichmentOutcome[]>;
}

/** Una richiesta di arricchimento. */
export interface EnrichmentRequest {
  /** Il brano. */
  readonly track: Track;
  /** Il contesto (nome dell'artista, generi). */
  readonly context: FeatureContext;
}

/**
 * La feature è vuota (nessun campo valorizzato)?
 *
 * Una riga vuota non viene scritta: la tabella vuota è il segnale "nessuna
 * feature", non "feature vuota" (`21§11.3`).
 *
 * @param feature - la feature da valutare.
 * @returns true se nessun campo portatore di segnale è valorizzato.
 */
export function isEmptyFeature(feature: AudioFeatures): boolean {
  return (
    feature.valence === null &&
    feature.energy === null &&
    feature.danceability === null &&
    feature.acousticness === null &&
    feature.instrumentalness === null &&
    feature.speechiness === null &&
    feature.liveness === null &&
    feature.tempo === null &&
    feature.key === null &&
    feature.mode === null &&
    feature.loudness === null &&
    feature.timeSignature === null
  );
}

/**
 * L'ordine di qualità delle sorgenti (`21§9`, `21§11.3`).
 *
 * Una misura batte una derivazione, una derivazione batte una stima, e la
 * feature manuale non viene mai sovrascritta. L'ordine è dichiarato qui
 * perché **un peso non dichiarato è un peso nascosto**: la cascata usa
 * `manual > essentia > acousticbrainz > heuristic`.
 */
export const SOURCE_QUALITY: Readonly<Record<AudioFeatures['source'], number>> = {
  manual: 3,
  essentia: 2,
  acousticbrainz: 1,
  heuristic: 0,
};

/**
 * Crea la cascata.
 *
 * @param options - le dipendenze iniettate.
 * @returns l'orchestratore.
 */
export function createEnrichmentCascade(options: EnrichmentCascadeOptions): EnrichmentCascade {
  const { store, policy, clock, providers, logger } = options;
  const schemaVersion = options.schemaVersion ?? CURRENT_FEATURE_SCHEMA_VERSION;

  const normalize = (feature: AudioFeatures): AudioFeatures => {
    const normalized = normalizeFeature(feature, feature.trackId, (field, value, trackId) => {
      logger?.warn('feature fuori intervallo, clampata', { field, value, trackId });
    });
    return {
      ...normalized,
      trackId: feature.trackId,
      source: feature.source,
      fetchedAt: clock.now(),
      schemaVersion,
    };
  };

  const runBranch = async (
    provider: AudioFeatureProvider | undefined,
    track: Track,
    context: FeatureContext,
  ): Promise<AudioFeatures | null> => {
    if (provider === undefined) return null;
    if (!provider.canHandle(track)) return null;
    try {
      const result = await provider.fetch(track, context);
      if (result === null) return null;
      if (isEmptyFeature(result)) return null;
      return normalize(result);
    } catch (error) {
      logger?.warn('provider di arricchimento fallito', {
        provider: provider.id,
        trackId: track.id,
        reason: error instanceof Error ? error.name : 'unknown',
      });
      return null;
    }
  };

  const enrich = async (track: Track, context: FeatureContext): Promise<EnrichmentOutcome> => {
    // 0. Il toggle. Prima di tutto: nessuna uscita, nessuna scrittura,
    //    nessuna lettura della cache (`21§10.4`).
    if (!(await policy.isEnabled())) {
      return { status: 'disabled', feature: null, reason: 'toggle-off' };
    }

    const now = clock.now();

    // 1. CACHE (`21§5.1`).
    const cached = await store.get(track.id);
    if (cached !== undefined && cached.source === 'manual') {
      // §9: la feature manuale non viene mai sovrascritta.
      return { status: 'manual', feature: cached };
    }
    const cacheUsable =
      cached !== undefined &&
      cached.schemaVersion === schemaVersion &&
      !isFeatureExpired(cached, now);
    if (cacheUsable && cached !== undefined && cached.source !== 'heuristic') {
      return { status: 'cached', feature: cached };
    }

    // 2. ESSENTIA (condizionato dall'audio).
    const essentia = await runBranch(providers.essentia, track, context);
    if (essentia !== null) {
      await store.put(essentia);
      return { status: 'essentia', feature: essentia };
    }
    const essentiaSkip = providers.essentia?.lastSkipReason?.() ?? null;

    // 3. ACOUSTICBRAINZ (condizionato dall'MBID).
    const acoustic = await runBranch(providers.acousticbrainz, track, context);
    if (acoustic !== null) {
      await store.put(acoustic);
      return { status: 'acousticbrainz', feature: acoustic };
    }

    // 4. EURISTICO: scrive solo se non esiste già una fonte migliore
    //    (`21§11.3`). Il ramo `manual` è già escluso (l'utente non viene
    //    sovrascritto) e le fonti misurate sono più forti della stima: la
    //    stima **non** degrada mai una misura, nemmeno se è scaduta.
    const heuristic = await runBranch(providers.heuristic, track, context);
    if (heuristic !== null) {
      const existing = await store.get(track.id);
      const canWrite =
        existing === undefined || SOURCE_QUALITY[existing.source] <= SOURCE_QUALITY.heuristic;
      if (canWrite) {
        if (
          existing !== undefined &&
          existing.source === 'heuristic' &&
          sameValues(existing, heuristic)
        ) {
          // Idempotenza: la riga identica non viene riscritta (`21§11.3`).
          return { status: 'cached', feature: existing };
        }
        await store.put(heuristic);
        return { status: 'heuristic', feature: heuristic };
      }
    }

    // 5. NIENTE: nessuna riga scritta (`21§11.3`).
    if (cacheUsable && cached !== undefined) {
      return { status: 'cached', feature: cached };
    }
    if (essentiaSkip === 'no_preview') {
      return { status: 'no_audio', feature: null, reason: 'no_preview' };
    }
    return { status: 'none', feature: null, reason: 'no_provider_result' };
  };

  return {
    enrich,
    async enrichMany(items: readonly EnrichmentRequest[]): Promise<EnrichmentOutcome[]> {
      const outcomes: EnrichmentOutcome[] = [];
      for (const item of items) {
        outcomes.push(await enrich(item.track, item.context));
      }
      return outcomes;
    },
  };
}

/**
 * Due feature hanno gli stessi valori (ignorando `fetchedAt`)?
 *
 * Serve all'idempotenza: la cascata non riscrive una riga identica
 * (`21§11.3`, T-AF.14).
 *
 * @param a - la prima feature.
 * @param b - la seconda feature.
 * @returns true se i valori coincidono.
 */
export function sameValues(a: AudioFeatures, b: AudioFeatures): boolean {
  return (
    a.trackId === b.trackId &&
    a.source === b.source &&
    a.schemaVersion === b.schemaVersion &&
    a.valence === b.valence &&
    a.energy === b.energy &&
    a.danceability === b.danceability &&
    a.acousticness === b.acousticness &&
    a.instrumentalness === b.instrumentalness &&
    a.speechiness === b.speechiness &&
    a.liveness === b.liveness &&
    a.tempo === b.tempo &&
    a.key === b.key &&
    a.mode === b.mode &&
    a.loudness === b.loudness &&
    a.timeSignature === b.timeSignature
  );
}
