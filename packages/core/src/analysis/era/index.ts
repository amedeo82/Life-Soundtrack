/**
 * Era Detector — barrel pubblico del modulo `analysis/era`.
 *
 * `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §5 (Story 2.2).
 */

export {
  EraEngine,
  eraInsightId,
  moodConfig,
  topGenre,
  topTrackIds,
  type EraEngineOptions,
  type EraInput,
  type GeneratedEra,
} from './engine';

export {
  buildEras,
  computeWeeklySignatures,
  detectChangePoints,
  eraDurationDays,
  type EraDraft,
  type EraWindow,
} from './detect';

export { computeEraDerivedVersion } from './derivedVersion';

export { ERA_TEMPLATE_KEYS, renderEraLabel } from './i18n';

export {
  computeSignature,
  isNightHour,
  normalizeDistribution,
  topN,
  type EraSignature,
} from './signature';

export {
  cosineSimilarity,
  jaccardSimilarity,
  numericSimilarity,
  signatureSimilarity,
  type NumericSimilarity,
} from './similarity';

export {
  DEFAULT_ERA_CONFIG,
  ERA_NIGHT_HOURS,
  ERA_TOP_ARTISTS,
  ERA_TOP_TRACKS,
  resolveEraConfig,
  type EraConfig,
  type EraConfigOverrides,
  type EraMoodThresholds,
  type EraWeights,
} from './types';
