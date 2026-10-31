/**
 * Event Detector — barrel pubblico del modulo `analysis/event`.
 *
 * `04-ANALYSIS-ALGORITHMS.md` v1.2 🟢 §6 (Story 2.3).
 */

export {
  EventEngine,
  eventInsightId,
  sortByTime,
  type EventEngineOptions,
  type EventInput,
  type GeneratedEvent,
} from './engine';

export {
  analysisWindows,
  average,
  dedupeOverlapping,
  detectExplorationEvents,
  detectQuotaEvents,
  detectSilenceEvents,
  detectZScoreEvents,
  metricToEventType,
  overlapsRange,
  populationStdDev,
  sliceByDay,
  ZSCORE_METRICS,
  type AnalysisWindow,
  type EventDraft,
  type ZScoreMetric,
} from './detect';

export { computeEventDerivedVersion } from './derivedVersion';

export {
  EVENT_TEMPLATE_KEYS,
  formatQuotaSuffix,
  formatZScoreSuffix,
  renderEventDescription,
  type EventTemplateParams,
} from './i18n';

export {
  buildTrackIndex,
  computeDailyBuckets,
  dayIndex,
  type DailyBucket,
  type DailyMetrics,
  type TrackInfo,
} from './metrics';

export {
  DEFAULT_EVENT_CONFIG,
  EVENT_QUOTA_RATIO,
  resolveEventConfig,
  type EventConfig,
  type EventConfigOverrides,
} from './types';
