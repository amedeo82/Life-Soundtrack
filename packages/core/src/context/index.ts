/**
 * Modulo di contesto di ascolto — `19-GEO-CONTEXT.md` v1.0 🟢 (Story 1.6).
 *
 * Punto d'ingresso `@ls/core/context`: il classificatore **L1** (contesto
 * dedotto: casa, lavoro, viaggio) e la persistenza dei periodi nella tabella
 * `contexts`.
 *
 * Il modulo è separato dal layer `analysis` per una ragione precisa: il
 * layer di analisi è **puro** e non ha dipendenze dal DB (`05§9`: gira nel
 * Web Worker), mentre il contesto ha bisogno dei due (`context/storage.ts`
 * scrive sulla tabella `contexts`). È la stessa forma del pacchetto
 * `enrichment/` (porte + orchestratore + storage Dexie).
 */

export {
  bandOf,
  buildRecurrenceIndex,
  buildSessions,
  buildSlots,
  classifySlot,
  computeDayCountries,
  computeReferenceCountry,
  consecutiveForeignDays,
  isWeekday,
  isWorkHour,
  medianOf,
  modeOf,
  modeOfCodes,
  patternKeyOf,
  recurrenceOf,
  toLocalListens,
  type ClassifySlotInput,
  type ContextClassification,
  type ContextRule,
  type ContextSession,
  type ContextSlot,
  type LocalListen,
  type RecurrenceIndex,
} from './classifier';

export { computeContextDerivedVersion } from './derivedVersion';

export {
  ContextEngine,
  contextPeriodId,
  type ContextEngineOptions,
  type GeneratedContext,
} from './engine';

export {
  LocalTime,
  dayKeyDistance,
  nextDayKey,
  previousDayKey,
  type LocalParts,
} from './localTime';

export {
  recomputeContextPeriods,
  type RecomputeContextOptions,
  type RecomputeContextReport,
} from './recompute';

export {
  deleteContextPeriods,
  listContextPeriods,
  listContextPeriodsByKind,
  listContextPeriodsByVersion,
  overlaps,
  putContextPeriods,
  replaceContextPeriods,
  setContextPeriodVerdict,
  type ContextStoreReport,
  type ContextVerdict,
  type ReplaceContextPeriodsOptions,
} from './storage';

export { DEFAULT_CONTEXT_CONFIG, resolveContextConfig, type ContextConfig } from './types';
