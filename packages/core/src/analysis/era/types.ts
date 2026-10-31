/**
 * Tipi e parametri dell'Era Detector — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §5.
 *
 * I parametri vivono qui, e solo qui: il `derivedVersion` (04§1.1, §9) è
 * l'hash di questo oggetto, quindi **ogni** parametro che influisce sul
 * risultato deve comparire in `EraConfig`. Un parametro fuori da qui
 * sarebbe un parametro non versionato: le ere vecchie non diventerebbero
 * `stale` al suo cambio (MIG-3, 02§7).
 *
 * I cinque parametri della tabella 04§5.3 (`windowDays`, `stepDays`,
 * `similarityThreshold`, `minEraDays`, `minEventsPerWindow`) e i tre pesi
 * (`weights.genre`, `weights.artist`, `weights.numeric`) sono il nucleo
 * ratificato.
 *
 * **`mood` è un parametro in più**, dichiarato esplicitamente: l'era
 * classifica il proprio mood con il **classificatore del mood tracker**
 * (04§3.2, D.69.2), quindi le sue soglie influenzano il risultato e
 * devono stare nella versione. I default sono quelli del mood tracker
 * (04§3.4): se l'app cambia le soglie del mood, deve passare le stesse
 * soglie all'era detector (le due letture restano coerenti).
 */

import { DEFAULT_MOOD_CONFIG } from '../mood/types';

/** Pesi della similarità fra due firme — 04§5.3. */
export interface EraWeights {
  /** Peso della cosine similarity sulla distribuzione dei generi. */
  readonly genre: number;
  /** Peso della Jaccard sugli artisti più ascoltati. */
  readonly artist: number;
  /** Peso della distanza normalizzata sulle metriche numeriche. */
  readonly numeric: number;
}

/**
 * Soglie del mood usate per classificare il mood dominante dell'era — 04§3.4.
 *
 * Sono le stesse del mood tracker: l'era e il mood devono parlare la stessa
 * lingua, altrimenti un'era «felice» coesisterebbe con un mood `sad` dello
 * stesso periodo (D.69.2).
 */
export interface EraMoodThresholds {
  /** Soglia di valence che divide il quadrante — 04§3.4. */
  readonly valenceThreshold: number;
  /** Soglia di energy che divide il quadrante — 04§3.4. */
  readonly energyThreshold: number;
  /** Semipiezza della fascia neutra attorno alla soglia — 04§3.4. */
  readonly neutralBand: number;
  /** Energy minima perché il mood sia `excited` — 04§3.4. */
  readonly excitedEnergyThreshold: number;
}

/** Set di parametri dell'era detector — 04§5.3 + 04§9. */
export interface EraConfig {
  /** Finestra di analisi, in giorni — 04§5.3. */
  readonly windowDays: number;
  /** Passo di scorrimento della finestra, in giorni — 04§5.3. */
  readonly stepDays: number;
  /** Soglia di similarità: sotto, il confine è un change point — 04§5.3. */
  readonly similarityThreshold: number;
  /** Durata minima di un'era, in giorni — 04§5.3. */
  readonly minEraDays: number;
  /** Ascolti minimi perché una finestra sia valida — 04§5.3. */
  readonly minEventsPerWindow: number;
  /** Pesi della similarità — 04§5.3. */
  readonly weights: EraWeights;
  /** Soglie del mood per classificare il mood dominante dell'era — 04§3.4. */
  readonly mood: EraMoodThresholds;
}

/** Override dei parametri dell'era detector (configurazione parziale). */
export interface EraConfigOverrides {
  readonly windowDays?: number;
  readonly stepDays?: number;
  readonly similarityThreshold?: number;
  readonly minEraDays?: number;
  readonly minEventsPerWindow?: number;
  readonly weights?: Partial<EraWeights>;
  readonly mood?: Partial<EraMoodThresholds>;
}

/**
 * Default dei parametri — 04§5.3.
 *
 * I pesi sommano a 1 (0.5 + 0.3 + 0.2): la similarità è dunque nella stessa
 * scala della soglia 0.65 senza normalizzazioni implicite.
 */
export const DEFAULT_ERA_CONFIG: EraConfig = {
  windowDays: 14,
  stepDays: 7,
  similarityThreshold: 0.65,
  minEraDays: 14,
  minEventsPerWindow: 5,
  weights: { genre: 0.5, artist: 0.3, numeric: 0.2 },
  mood: {
    valenceThreshold: DEFAULT_MOOD_CONFIG.valenceThreshold,
    energyThreshold: DEFAULT_MOOD_CONFIG.energyThreshold,
    neutralBand: DEFAULT_MOOD_CONFIG.neutralBand,
    excitedEnergyThreshold: DEFAULT_MOOD_CONFIG.excitedEnergyThreshold,
  },
};

/**
 * Applica gli override ai default mantenendo **l'ordine delle chiavi**:
 * `JSON.stringify(config)` deve essere deterministico, perché da lui dipende
 * la `derivedVersion` (04§1.1).
 */
export function resolveEraConfig(overrides: EraConfigOverrides = {}): EraConfig {
  return {
    windowDays: overrides.windowDays ?? DEFAULT_ERA_CONFIG.windowDays,
    stepDays: overrides.stepDays ?? DEFAULT_ERA_CONFIG.stepDays,
    similarityThreshold: overrides.similarityThreshold ?? DEFAULT_ERA_CONFIG.similarityThreshold,
    minEraDays: overrides.minEraDays ?? DEFAULT_ERA_CONFIG.minEraDays,
    minEventsPerWindow: overrides.minEventsPerWindow ?? DEFAULT_ERA_CONFIG.minEventsPerWindow,
    weights: {
      genre: overrides.weights?.genre ?? DEFAULT_ERA_CONFIG.weights.genre,
      artist: overrides.weights?.artist ?? DEFAULT_ERA_CONFIG.weights.artist,
      numeric: overrides.weights?.numeric ?? DEFAULT_ERA_CONFIG.weights.numeric,
    },
    mood: {
      valenceThreshold:
        overrides.mood?.valenceThreshold ?? DEFAULT_ERA_CONFIG.mood.valenceThreshold,
      energyThreshold: overrides.mood?.energyThreshold ?? DEFAULT_ERA_CONFIG.mood.energyThreshold,
      neutralBand: overrides.mood?.neutralBand ?? DEFAULT_ERA_CONFIG.mood.neutralBand,
      excitedEnergyThreshold:
        overrides.mood?.excitedEnergyThreshold ?? DEFAULT_ERA_CONFIG.mood.excitedEnergyThreshold,
    },
  };
}

/** Quanti artisti entrano nella firma (04§5.2: `topN(..., 5)`). */
export const ERA_TOP_ARTISTS = 5;

/** Quanti brani entrano nel payload dell'era (04§5.2: `topN(..., 5)`). */
export const ERA_TOP_TRACKS = 5;

/**
 * Ore considerate «notturne» — 02§4 (`EraPayload.nightShare`: "Quota
 * ascolti 00-06") e 04§4.3 (`nightShare`: 00:00-05:59).
 *
 * Sono le stesse ore: la finestra notturna va dalle 00:00 alle 05:59
 * incluse, cioè le ore `0..5`.
 */
export const ERA_NIGHT_HOURS = 6;
