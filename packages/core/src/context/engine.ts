/**
 * Motore di classificazione del contesto — 19-GEO-CONTEXT.md §4.3 e §5
 * (Story 1.6).
 *
 * Il motore è **puro**: riceve gli ascolti, non legge il DB (`05§9`: il layer
 * di analisi gira nel Web Worker). Produce i `ContextPeriod` pronti per la
 * persistenza.
 *
 * **Determinismo**: a parità di ascolti, fuso, consenso e parametri produce
 * **sempre** gli stessi periodi, con gli stessi id (ricalcolo idempotente,
 * MIG-2/MIG-3). Gli id sono deterministici (`ctx-<kind>-<startTime>`): un
 * ricalcolo non deve creare duplicati.
 */

import type { ContextPeriod, DeviceType, ListenEvent } from '../schema';
import { DEVICE_TYPES } from '../schema';
import {
  buildRecurrenceIndex,
  buildSessions,
  buildSlots,
  classifySlot,
  computeDayCountries,
  computeReferenceCountry,
  consecutiveForeignDays,
  modeOfCodes,
  recurrenceOf,
  toLocalListens,
  type ContextClassification,
} from './classifier';
import { computeContextDerivedVersion } from './derivedVersion';
import { LocalTime } from './localTime';
import { resolveContextConfig, type ContextConfig } from './types';

/** Opzioni del motore. */
export interface ContextEngineOptions {
  /** Override dei parametri — utile per i test e per la calibrazione. */
  readonly config?: Partial<ContextConfig>;
  /** Fuso IANA dell'utente (default 'UTC'). */
  readonly userTimezone?: string;
  /** Consenso `carDetectionConsent`: senza, `car` non è classificabile (`19§5.3`). */
  readonly carDetectionConsent?: boolean;
  /** Istante di riferimento (unix ms UTC). Default: adesso. */
  readonly now?: number;
}

/** Esito della classificazione. */
export interface GeneratedContext {
  /** Periodi aggregati (confidenza ≥ soglia), pronti per la persistenza. */
  readonly periods: ContextPeriod[];
  /** Classificazione di ogni slot (diagnostica e test). */
  readonly classifications: readonly ContextClassification[];
  /** Slot scartati perché sotto la soglia di aggregazione. */
  readonly droppedBelowThreshold: number;
  /** Paese di riferimento usato dalle regole. */
  readonly referenceCountry: string | null;
  /** `derivedVersion` dei parametri correnti. */
  readonly derivedVersion: string;
}

/**
 * Id deterministico di un periodo.
 *
 * Il ricalcolo produce lo stesso id: il periodo viene **aggiornato**, non
 * duplicato.
 */
export function contextPeriodId(kind: ContextPeriod['kind'], startTime: number): string {
  return `ctx-${kind}-${startTime}`;
}

/** Motore del classificatore di contesto. */
export class ContextEngine {
  private readonly config: ContextConfig;
  private readonly timezone: string;
  private readonly carDetectionConsent: boolean;
  private readonly now: number;
  private versionPromise: Promise<string> | null = null;

  constructor(options: ContextEngineOptions = {}) {
    this.config = resolveContextConfig(options.config);
    this.timezone = options.userTimezone ?? 'UTC';
    this.carDetectionConsent = options.carDetectionConsent ?? false;
    this.now = options.now ?? Date.now();
  }

  /** Parametri effettivi del motore. */
  get parameters(): ContextConfig {
    return this.config;
  }

  /** Fuso effettivo del motore. */
  get userTimezone(): string {
    return this.timezone;
  }

  /** `derivedVersion` calcolata dai parametri — MIG-3. */
  async derivedVersion(): Promise<string> {
    this.versionPromise ??= computeContextDerivedVersion(this.config);
    return this.versionPromise;
  }

  /**
   * Classifica gli ascolti e aggrega i periodi.
   *
   * L'output è **deterministico**: a parità di input produce sempre gli
   * stessi periodi, con gli stessi id. I periodi sono ordinati per inizio.
   */
  async generate(listens: readonly ListenEvent[]): Promise<GeneratedContext> {
    const derivedVersion = await this.derivedVersion();
    const localTime = new LocalTime(this.timezone);
    const local = computeLocalListens(listens, localTime);
    const sessions = buildSessions(local, this.config);
    const slots = buildSlots(local, sessions, this.config);
    const referenceCountry = computeReferenceCountry(listens, this.now, this.config);
    const recurrenceIndex = buildRecurrenceIndex(slots);
    const dayCountries = computeDayCountries(local);

    const classifications: ContextClassification[] = slots.map((slot) =>
      classifySlot({
        slot,
        referenceCountry,
        carDetectionConsent: this.carDetectionConsent,
        travelDays: consecutiveForeignDays(slot, referenceCountry, dayCountries),
        recurrence: recurrenceOf(slot, recurrenceIndex),
        config: this.config,
      }),
    );

    const aggregated = classifications.filter(
      (classification) => classification.confidence >= this.config.aggregationThreshold,
    );
    const periods = mergeIntoPeriods(aggregated, derivedVersion, this.now, this.config);

    return {
      periods,
      classifications,
      droppedBelowThreshold: classifications.length - aggregated.length,
      referenceCountry,
      derivedVersion,
    };
  }
}

/**
 * Aggrega le classificazioni in periodi.
 *
 * Gli slot con lo stesso `kind` e adiacenti (gap ≤ `periodGapMs`) formano un
 * solo periodo: il nastro contesto mostra **periodi**, non eventi. La
 * confidenza del periodo è la **minima** dei suoi slot: un periodo è forte
 * quanto il suo pezzo più incerto.
 */
function mergeIntoPeriods(
  classifications: readonly ContextClassification[],
  derivedVersion: string,
  now: number,
  config: ContextConfig,
): ContextPeriod[] {
  const byKind = new Map<ContextClassification['kind'], ContextClassification[]>();
  for (const classification of classifications) {
    const bucket = byKind.get(classification.kind) ?? [];
    bucket.push(classification);
    byKind.set(classification.kind, bucket);
  }

  const periods: ContextPeriod[] = [];
  for (const [kind, bucket] of byKind) {
    bucket.sort((a, b) => a.startTime - b.startTime || a.slotKey.localeCompare(b.slotKey));
    let current:
      | {
          startTime: number;
          endTime: number;
          eventCount: number;
          deviceTypes: Set<DeviceType>;
          countryCounts: Map<string, number>;
          confidence: number;
        }
      | undefined;

    const flush = (): void => {
      if (!current) return;
      periods.push({
        id: contextPeriodId(kind, current.startTime),
        startTime: current.startTime,
        endTime: current.endTime,
        kind,
        country: modeOfCodes([...current.countryCounts.keys()]),
        // La città (L2) è derivata dal database geo on-demand (Story 4.4):
        // in questa tranche il periodo non ha città.
        city: null,
        eventCount: current.eventCount,
        deviceTypes: DEVICE_TYPES.filter((device) => current?.deviceTypes.has(device)),
        confidence: current.confidence,
        derivedVersion,
        status: 'pending',
        userLabel: null,
        createdAt: now,
      });
      current = undefined;
    };

    for (const classification of bucket) {
      const continues =
        current !== undefined && classification.startTime - current.endTime <= config.periodGapMs;
      if (!continues) {
        flush();
        current = {
          startTime: classification.startTime,
          endTime: classification.endTime,
          eventCount: classification.eventCount,
          deviceTypes: new Set<DeviceType>(),
          countryCounts: new Map<string, number>(),
          confidence: classification.confidence,
        };
      }
      if (!current) continue;
      current.startTime = Math.min(current.startTime, classification.startTime);
      current.endTime = Math.max(current.endTime, classification.endTime);
      current.eventCount += classification.eventCount;
      current.deviceTypes.add(classification.deviceType);
      current.confidence = Math.min(current.confidence, classification.confidence);
      if (classification.country !== null) {
        current.countryCounts.set(
          classification.country,
          (current.countryCounts.get(classification.country) ?? 0) + classification.eventCount,
        );
      }
    }
    flush();
  }

  periods.sort((a, b) => a.startTime - b.startTime || a.kind.localeCompare(b.kind));
  return periods;
}

/**
 * Precalcola le parti locali degli ascolti.
 *
 * Il risolutore `Intl` viene riusato (una formatter per fuso): ricrearlo per
 * ogni evento costerebbe un ordine di grandezza in più su 200k righe.
 */
function computeLocalListens(
  listens: readonly ListenEvent[],
  localTime: LocalTime,
): ReturnType<typeof toLocalListens> {
  return toLocalListens(listens, (ms) => {
    const parts = localTime.parts(ms);
    return {
      dayKey: parts.dayKey,
      hour: parts.hour,
      weekday: parts.weekday,
      weekStart: parts.weekStart,
    };
  });
}
