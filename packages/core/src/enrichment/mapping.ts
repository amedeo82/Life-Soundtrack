/**
 * Normalizzazione e mappatura dei campi di `AudioFeatures` —
 * `21-AUDIO-FEATURES.md` v1.0 🟢 §6.2, §7.3, §11.2.
 *
 * Tre regole governano questo modulo:
 *
 * 1. **`valence` ed `energy` ∈ [0,1] per costruzione** (E8, `10§7`): ogni
 *    valore che arriva dai provider passa da `normalizeFeature`, che
 *    tronca e **clampa**; l'invariante non può essere violata in DB.
 * 2. **Nessun campo inventato**: un campo che il provider non misura resta
 *    `null` (`04§1.4`: "le feature mancanti degradano").
 * 3. **Determinismo**: l'arrotondamento a 4 decimali rende due feature
 *    uguali byte per byte (T-AF.14).
 */

import type { AudioFeatures } from '../schema';
import type { FeatureField, FeatureOrigin } from './types';

/**
 * La versione corrente dello schema delle audio features.
 *
 * Un bump invalida le righe con la versione vecchia: la cascata le
 * ricalcola al trigger successivo (`21§11.2`, E10).
 */
export const CURRENT_FEATURE_SCHEMA_VERSION = 1;

/**
 * TTL delle feature `acousticbrainz`: 90 giorni (`21§11.2`).
 *
 * Il dataset di AcousticBrainz è congelato a giugno 2022: un TTL più lungo
 * non avrebbe senso, uno più corto non costa niente.
 */
export const ACOUSTICBRAINZ_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** I campi di `AudioFeatures` che hanno un significato in [0,1]. */
export const UNIT_FIELDS = [
  'valence',
  'energy',
  'danceability',
  'acousticness',
  'instrumentalness',
  'speechiness',
  'liveness',
] as const satisfies readonly FeatureField[];

/** Arrotonda a 4 decimali (`21§6.2`: determinismo, stessi byte). */
export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Tronca un valore a [0,1]. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Normalizza un punteggio DEAM da [1,9] a [0,1] (`21§6.2`).
 *
 * ```
 * normalized = (value - 1) / (9 - 1)
 * ```
 *
 * I classification head `deam-msd-musicnn-2` restituiscono `valence` e
 * `arousal` su [1,9]; `02§3.4` vuole [0,1]. La normalizzazione è
 * **lineare e dichiarata**: i valori grezzi non vengono persistiti.
 *
 * @param value - il punteggio grezzo del classificatore.
 * @returns il valore normalizzato in [0,1], arrotondato a 4 decimali.
 */
export function normalizeDeamScore(value: number): number {
  return round4(clamp01((value - 1) / 8));
}

/**
 * Le classi `mood_*` del documento `high-level` di AcousticBrainz.
 *
 * Il documento contiene anche `danceable`, `gender`, `genre_*`, `timbre`,
 * `tonal_atonal` e `voice_instrumental`: qui servono solo le classi mood,
 * perché sono l'unica base possibile per la derivazione di
 * valence/energy (`21§7.3`).
 */
export interface AcousticBrainzMood {
  /** `mood_happy`: probabilità [0,1]. */
  readonly mood_happy?: number | undefined;
  /** `mood_sad`: probabilità [0,1]. */
  readonly mood_sad?: number | undefined;
  /** `mood_relaxed`: probabilità [0,1]. */
  readonly mood_relaxed?: number | undefined;
  /** `mood_party`: probabilità [0,1]. */
  readonly mood_party?: number | undefined;
  /** `mood_aggressive`: probabilità [0,1]. */
  readonly mood_aggressive?: number | undefined;
  /** `mood_acoustic`: probabilità [0,1]. */
  readonly mood_acoustic?: number | undefined;
  /** `mood_electronic`: probabilità [0,1]. */
  readonly mood_electronic?: number | undefined;
  /** `danceable`: probabilità [0,1]. */
  readonly danceable?: number | undefined;
}

/**
 * Deriva `valence` dalle classi mood di AcousticBrainz (`21§7.3`).
 *
 * ```
 * valence ≈ P(happy) + 0,5·P(relaxed) − P(sad) − 0,5·P(aggressive)
 * ```
 *
 * I pesi sono una **scelta di progetto dichiarata**, non una misura: un peso
 * non dichiarato è un peso nascosto. Il risultato è **derivato**, non
 * misurato (D-AF.8: il `source` resta `acousticbrainz`).
 *
 * @param mood - le classi mood del documento `high-level`.
 * @returns la valence derivata, troncata in [0,1].
 */
export function deriveValenceFromMood(mood: AcousticBrainzMood): number {
  const value =
    (mood.mood_happy ?? 0) +
    0.5 * (mood.mood_relaxed ?? 0) -
    (mood.mood_sad ?? 0) -
    0.5 * (mood.mood_aggressive ?? 0);
  return round4(clamp01(value));
}

/**
 * Deriva `energy` dalle classi mood di AcousticBrainz (`21§7.3`).
 *
 * ```
 * energy ≈ P(party) + P(aggressive) + 0,5·P(electronic)
 * ```
 *
 * `mood_acoustic` e `mood_electronic` sono qualità timbrali, non "energia
 * positiva": il peso su `mood_electronic` è un segnale secondario e
 * dichiarato.
 *
 * @param mood - le classi mood del documento `high-level`.
 * @returns l'energy derivata, troncata in [0,1].
 */
export function deriveEnergyFromMood(mood: AcousticBrainzMood): number {
  const value =
    (mood.mood_party ?? 0) + (mood.mood_aggressive ?? 0) + 0.5 * (mood.mood_electronic ?? 0);
  return round4(clamp01(value));
}

/**
 * Una feature grezza, prima della normalizzazione.
 *
 * I provider restituiscono valori già nel loro intervallo nativo ([1,9] per
 * Essentia, [0,1] per le classi AB): la normalizzazione è centralizzata qui.
 */
export interface RawFeature {
  /** Positività emotiva grezza. */
  readonly valence?: number | null;
  /** Intensità grezza. */
  readonly energy?: number | null;
  /** Ballabilità grezza. */
  readonly danceability?: number | null;
  /** Acustica grezza. */
  readonly acousticness?: number | null;
  /** Strumentalità grezza. */
  readonly instrumentalness?: number | null;
  /** Parlato grezzo. */
  readonly speechiness?: number | null;
  /** Presenza di pubblico grezza. */
  readonly liveness?: number | null;
  /** BPM grezzi. */
  readonly tempo?: number | null;
  /** Tonalità grezza (0..11). */
  readonly key?: number | null;
  /** Modo grezzo (0 minore, 1 maggiore). */
  readonly mode?: 0 | 1 | null;
  /** Loudness grezzo (dB). */
  readonly loudness?: number | null;
  /** Time signature grezza. */
  readonly timeSignature?: number | null;
}

/** Il callback che riceve i campi fuori intervallo (E8). */
export type ClampReporter = (field: FeatureField, value: number, trackId: string) => void;

/**
 * Applica la normalizzazione a una feature grezza.
 *
 * I campi in [0,1] vengono **clampati** (E8: il clamp è obbligatorio, con
 * warning) e arrotondati a 4 decimali; gli altri campi (BPM, tonalità,
 * loudness) vengono solo arrotondati dove ha senso.
 *
 * @param raw - la feature grezza del provider.
 * @param trackId - il brano (serve al warning E8, mai un dato personale).
 * @param report - callback di warning per i valori fuori intervallo.
 * @returns la feature normalizzata, con `null` per i campi assenti.
 */
export function normalizeFeature(
  raw: RawFeature,
  trackId: string,
  report?: ClampReporter,
): Omit<AudioFeatures, 'trackId' | 'source' | 'fetchedAt' | 'schemaVersion'> {
  const unit = (field: FeatureField, value: number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(value)) {
      report?.(field, value, trackId);
      return null;
    }
    if (value < 0 || value > 1) {
      report?.(field, value, trackId);
    }
    return round4(clamp01(value));
  };

  return {
    valence: unit('valence', raw.valence),
    energy: unit('energy', raw.energy),
    danceability: unit('danceability', raw.danceability),
    acousticness: unit('acousticness', raw.acousticness),
    instrumentalness: unit('instrumentalness', raw.instrumentalness),
    speechiness: unit('speechiness', raw.speechiness),
    liveness: unit('liveness', raw.liveness),
    tempo: raw.tempo === null || raw.tempo === undefined ? null : round4(raw.tempo),
    key: raw.key === null || raw.key === undefined ? null : Math.trunc(raw.key),
    mode: raw.mode === null || raw.mode === undefined ? null : raw.mode,
    loudness: raw.loudness === null || raw.loudness === undefined ? null : round4(raw.loudness),
    timeSignature:
      raw.timeSignature === null || raw.timeSignature === undefined
        ? null
        : Math.trunc(raw.timeSignature),
  };
}

/**
 * L'origine di ogni campo per ciascun provider.
 *
 * È la dichiarazione che la spec richiede (`21§2.3`, D-AF.8): la
 * trasparenza su "misurata / derivata / stimata" non può stare nel valore
 * di `source` (lo schema è chiuso a quattro valori), quindi sta qui.
 */
export const FEATURE_ORIGINS: Readonly<
  Record<AudioFeatures['source'], Readonly<Record<FeatureField, FeatureOrigin>>>
> = {
  essentia: {
    valence: 'measured',
    energy: 'measured',
    danceability: 'measured',
    acousticness: 'none',
    instrumentalness: 'none',
    speechiness: 'none',
    liveness: 'none',
    tempo: 'measured',
    key: 'measured',
    mode: 'measured',
    loudness: 'measured',
    timeSignature: 'measured',
  },
  acousticbrainz: {
    valence: 'derived',
    energy: 'derived',
    danceability: 'measured',
    acousticness: 'none',
    instrumentalness: 'none',
    speechiness: 'none',
    liveness: 'none',
    tempo: 'none',
    key: 'none',
    mode: 'none',
    loudness: 'none',
    timeSignature: 'none',
  },
  heuristic: {
    valence: 'none',
    energy: 'none',
    danceability: 'estimated',
    acousticness: 'estimated',
    instrumentalness: 'none',
    speechiness: 'none',
    liveness: 'none',
    tempo: 'estimated',
    key: 'none',
    mode: 'none',
    loudness: 'none',
    timeSignature: 'none',
  },
  manual: {
    valence: 'measured',
    energy: 'measured',
    danceability: 'measured',
    acousticness: 'measured',
    instrumentalness: 'measured',
    speechiness: 'measured',
    liveness: 'measured',
    tempo: 'measured',
    key: 'measured',
    mode: 'measured',
    loudness: 'measured',
    timeSignature: 'measured',
  },
};

/**
 * L'origine di un campo per un provider dato.
 *
 * @param source - il `source` della feature.
 * @param field - il campo di `AudioFeatures`.
 * @returns l'origine dichiarata del campo.
 */
export function featureOrigin(source: AudioFeatures['source'], field: FeatureField): FeatureOrigin {
  return FEATURE_ORIGINS[source][field];
}
