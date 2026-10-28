/**
 * Modulo di analisi — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢.
 *
 * Punto d'ingresso `@ls/core/analysis`: puro TypeScript, senza React e senza
 * dipendenze dal layer DB (05§9: gira nel Web Worker).
 */

export {
  AnalysisPipeline,
  createMemoryGenerator,
  type AnalysisGenerator,
  type AnalysisInput,
  type MemoryGeneratorOptions,
} from './pipeline';

export {
  buildWorkspace,
  clamp01,
  computeMemoryDerivedVersion,
  computeMemoryScore,
  computeRecency,
  computeRelevance,
  createTranslator,
  DAY_MS,
  DEFAULT_MEMORY_CONFIG,
  endOfUtcDay,
  eventTime,
  generateFirstTime,
  generateMilestone,
  generateOnThisDay,
  generateReturn,
  generateSeasonal,
  HOUR_MS,
  isSameUtcDate,
  isSameUtcMonthDay,
  localizedMonthName,
  medianOf,
  MEMORY_BASE_SCORES,
  MEMORY_TEMPLATE_KEYS,
  memoryInsightId,
  MemoryEngine,
  renderMemoryText,
  resolveMemoryConfig,
  startOfUtcDay,
  utcDateParts,
  utcDayKey,
  utcMonth,
  utcYear,
  type GeneratedMemory,
  type MemoryConfig,
  type MemoryContext,
  type MemoryDraft,
  type MemoryEngineOptions,
  type MemoryInput,
  type MemoryTemplateKey,
  type MemoryTemplateParams,
  type MemoryWorkspace,
  type MemoryWorkspaceInput,
  type TranslateFn,
  type Translator,
} from './memory';
