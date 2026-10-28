/**
 * Memory Engine — barrel pubblico del modulo `analysis/memory`.
 *
 * `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §7 (Story 2.4).
 */

export {
  MemoryEngine,
  memoryInsightId,
  type GeneratedMemory,
  type MemoryEngineOptions,
  type MemoryInput,
} from './engine';

export {
  createTranslator,
  MEMORY_TEMPLATE_KEYS,
  renderMemoryText,
  type MemoryTemplateKey,
  type TranslateFn,
  type Translator,
} from './i18n';

export { computeMemoryDerivedVersion } from './derivedVersion';

export {
  DEFAULT_MEMORY_CONFIG,
  resolveMemoryConfig,
  type MemoryConfig,
  type MemoryContext,
  type MemoryDraft,
  type MemoryTemplateParams,
} from './types';

export {
  clamp01,
  computeMemoryScore,
  computeRecency,
  computeRelevance,
  medianOf,
  MEMORY_BASE_SCORES,
} from './ranking';

export { generateFirstTime } from './firstTime';
export { generateMilestone } from './milestone';
export { generateOnThisDay } from './onThisDay';
export { generateReturn } from './returnMemory';
export { generateSeasonal } from './seasonal';

export { buildWorkspace, type MemoryWorkspace, type MemoryWorkspaceInput } from './workspace';

export {
  DAY_MS,
  endOfUtcDay,
  eventTime,
  HOUR_MS,
  isSameUtcDate,
  isSameUtcMonthDay,
  localizedMonthName,
  startOfUtcDay,
  utcDateParts,
  utcDayKey,
  utcMonth,
  utcYear,
} from './datetime';
