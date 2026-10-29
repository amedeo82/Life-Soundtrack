/**
 * Mood Tracker — barrel pubblico del modulo `analysis/mood`.
 *
 * `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §3 (Story 2.1).
 */

export {
  computeMoodForPeriod,
  MOOD_WEIGHT_BASE_MS,
  MoodEngine,
  moodInsightId,
  type GeneratedMood,
  type MoodEngineOptions,
  type MoodInput,
} from './engine';

export { classifyMood, weightedAverage } from './classify';

export { computeMoodDerivedVersion } from './derivedVersion';

export {
  ANALYSIS_FEATURE_SOURCES,
  buildFeatureIndex,
  isAnalysisFeatureSource,
  type AnalysisFeatureSource,
} from './features';

export {
  endOfUtcMonth,
  groupByPeriod,
  periodBounds,
  startOfUtcMonth,
  startOfUtcWeek,
  type MoodPeriodBounds,
} from './period';

export {
  DEFAULT_MOOD_CONFIG,
  MOOD_INSIGHT_TYPES,
  MOOD_PERIODS,
  resolveMoodConfig,
  type MoodConfig,
  type MoodPeriod,
  type MoodValue,
  type WeightedValue,
} from './types';
