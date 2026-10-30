/**
 * Il provider acustico locale — Essentia.js (WASM, lazy).
 *
 * `21-AUDIO-FEATURES.md` v1.0 🟢 §6 (D-AF.1, D-AF.3, D-AF.5).
 *
 * Il provider **non** importa mai il WASM staticamente: il modulo viene
 * caricato con `import()` dinamico al primo arricchimento acustico e il
 * risultato è memoizzato (`21§6.5`). Ne segue che:
 *
 * - il WASM **non** entra nel bundle iniziale né nel precache del service
 *   worker (`21§2.5`, T4.1.13);
 * - se il caricamento fallisce (rete assente, quota, browser senza WASM) il
 *   ramo **salta** e la cascata continua con gli altri (E4): il fallback
 *   deve esistere.
 *
 * Il motore è una **porta** (`EssentiaEngine`): il core non conosce
 * l'API di `essentia.js`, che è iniettata dall'app (`D-AF.5`: il core è
 * runtime-agnostic e gira anche nel Worker).
 */

import { CURRENT_FEATURE_SCHEMA_VERSION, normalizeDeamScore } from './mapping';
import type { ItunesPreviewResolver } from './itunes';
import type { AudioFeatures, Track } from '../schema';
import type { AudioFeatureProvider, Clock, FeatureContext, HttpClient, Logger } from './types';

/**
 * Il risultato grezzo dell'analisi acustica.
 *
 * `valence` e `arousal` arrivano su **[1,9]** (i classification head
 * DEAM/MuSe/emoMusic): la normalizzazione a [0,1] è di
 * `mapping.normalizeDeamScore` (`21§6.2`).
 */
export interface EssentiaAnalysis {
  /** Punteggio di positività emotiva, su [1,9]. */
  readonly valence?: number;
  /** Punteggio di arousal (≈ energy), su [1,9]. */
  readonly arousal?: number;
  /** Probabilità di ballabilità, su [0,1]. */
  readonly danceable?: number;
  /** Battiti per minuto. */
  readonly bpm?: number;
  /** Tonalità, 0..11. */
  readonly key?: number;
  /** Scala: `major` o `minor`. */
  readonly scale?: 'major' | 'minor';
  /** Loudness in dB. */
  readonly loudness?: number;
  /** Numeratore della time signature. */
  readonly timeSignature?: number;
}

/** Il motore di analisi: calcola le feature dal segnale audio. */
export interface EssentiaEngine {
  /**
   * Analizza un preview audio.
   *
   * @param audio - i byte del preview, **in memoria**: nessun file audio
   *   viene scritto su disco (`21§6.6`).
   * @returns il risultato grezto dell'analisi.
   */
  analyze(audio: ArrayBuffer): Promise<EssentiaAnalysis>;
}

/** La factory del motore: carica (o riusa) il modulo WASM. */
export interface EssentiaEngineFactory {
  /**
   * Carica il motore.
   *
   * Le implementazioni reali devono **memoizzare**: il caricamento costa
   * ~6 MB di rete (`21§2.5`) e non deve ripetersi per ogni brano.
   */
  load(): Promise<EssentiaEngine>;
}

/** Il modulo che il loader dinamico deve esportare. */
export interface EssentiaModule {
  /**
   * Crea il motore a partire dal modulo caricato.
   *
   * Il contratto è dichiarato qui, non nel codice di `essentia.js`: il
   * loader dinamico non può conoscere un'API che cambia fra versioni, e
   * l'app decide cosa passare (`D-AF.5`).
   */
  createEssentiaEngine(options: EssentiaModuleOptions): EssentiaEngine | Promise<EssentiaEngine>;
}

/** Le opzioni passate alla factory del modulo. */
export interface EssentiaModuleOptions {
  /** L'URL del modello (versione `deam-msd-musicnn-2`, D-AF.3). */
  readonly modelUrl: string;
  /** La frequenza di campionamento attesa. */
  readonly sampleRate?: number;
}

/** Opzioni del loader dinamico. */
export interface EssentiaLoaderOptions {
  /** L'URL del modulo WASM (obbligatorio: nessun URL è inventato nel codice). */
  readonly moduleUrl: string;
  /** L'URL del modello. */
  readonly modelUrl: string;
  /** La frequenza di campionamento attesa. */
  readonly sampleRate?: number;
}

/**
 * Crea la factory del motore Essentia con **import dinamico**.
 *
 * Il commento `@vite-ignore` impedisce a Vite di risolvere l'import
 * statico: è il meccanismo che tiene il WASM fuori dal bundle iniziale
 * (`21§6.5`, T4.1.13).
 *
 * @param options - l'URL del modulo e del modello.
 * @returns la factory, memoizzata.
 */
export function createEssentiaEngineFactory(options: EssentiaLoaderOptions): EssentiaEngineFactory {
  let pending: Promise<EssentiaEngine> | null = null;
  return {
    load(): Promise<EssentiaEngine> {
      if (pending === null) {
        pending = (async () => {
          const module = (await import(/* @vite-ignore */ options.moduleUrl)) as EssentiaModule;
          if (typeof module.createEssentiaEngine !== 'function') {
            throw new Error('modulo Essentia privo di createEssentiaEngine');
          }
          return module.createEssentiaEngine({
            modelUrl: options.modelUrl,
            ...(options.sampleRate === undefined ? {} : { sampleRate: options.sampleRate }),
          });
        })().catch((error: unknown) => {
          pending = null;
          throw error;
        });
      }
      return pending;
    },
  };
}

/** Opzioni del provider Essentia. */
export interface EssentiaProviderOptions {
  /** Il client HTTP iniettato (per il download del preview). */
  readonly http: HttpClient;
  /** L'orologio iniettato. */
  readonly clock: Clock;
  /** Il resolver del preview iTunes. */
  readonly previewResolver: ItunesPreviewResolver;
  /** La factory del motore (lazy). */
  readonly engineFactory: EssentiaEngineFactory;
  /** Il logger (opzionale). */
  readonly logger?: Logger;
}

/**
 * Il provider Essentia.
 *
 * Il ramo è condizionato dall'**audio**, non dal brano: senza preview il
 * ramo salta, e non è un errore (`21§2.1`, `21§5.1`).
 */
export function createEssentiaProvider(options: EssentiaProviderOptions): AudioFeatureProvider {
  const { http, clock, previewResolver, engineFactory, logger } = options;
  let skipReason: string | null = null;

  return {
    id: 'essentia',

    canHandle(): boolean {
      return true;
    },

    lastSkipReason(): string | null {
      return skipReason;
    },

    async fetch(track: Track, context: FeatureContext): Promise<AudioFeatures | null> {
      const preview = await previewResolver.resolve(track.name, context.artistName);
      if (preview === null) {
        skipReason = 'no_preview';
        logger?.debug('Essentia: nessun preview, ramo saltato', { trackId: track.id });
        return null;
      }

      let bytes: ArrayBuffer;
      try {
        const response = await http.request(preview.previewUrl, {
          method: 'GET',
          responseType: 'binary',
        });
        if (response.status < 200 || response.status >= 300 || response.bytes === undefined) {
          skipReason = 'download_failed';
          logger?.warn('Essentia: download del preview non riuscito', {
            trackId: track.id,
            status: response.status,
          });
          return null;
        }
        bytes = response.bytes;
      } catch (error) {
        skipReason = 'download_failed';
        logger?.warn('Essentia: download del preview fallito', {
          trackId: track.id,
          reason: error instanceof Error ? error.name : 'unknown',
        });
        return null;
      }

      let analysis: EssentiaAnalysis;
      try {
        const engine = await engineFactory.load();
        analysis = await engine.analyze(bytes);
      } catch (error) {
        skipReason = 'engine_unavailable';
        logger?.warn('Essentia: motore non disponibile, ramo saltato', {
          trackId: track.id,
          reason: error instanceof Error ? error.name : 'unknown',
        });
        return null;
      }

      const scale = analysis.scale;
      return {
        trackId: track.id,
        valence: analysis.valence === undefined ? null : normalizeDeamScore(analysis.valence),
        energy: analysis.arousal === undefined ? null : normalizeDeamScore(analysis.arousal),
        danceability: analysis.danceable ?? null,
        acousticness: null,
        instrumentalness: null,
        speechiness: null,
        liveness: null,
        tempo: analysis.bpm ?? null,
        key: analysis.key ?? null,
        mode: scale === 'major' ? 1 : scale === 'minor' ? 0 : null,
        loudness: analysis.loudness ?? null,
        timeSignature: analysis.timeSignature ?? null,
        source: 'essentia',
        fetchedAt: clock.now(),
        schemaVersion: CURRENT_FEATURE_SCHEMA_VERSION,
      };
    },
  };
}
