/**
 * Mood Tracker — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §3 (Story 2.1).
 *
 * Il motore calcola il **mood dominante** di un periodo (giorno, settimana,
 * mese) a partire dalla valence e dall'energy media degli ascolti, e produce
 * un `Insight` di tipo `mood_day` / `mood_week` / `mood_month`.
 *
 * Il motore è **puro**: riceve gli ascolti e le feature, non legge il DB
 * (`05§9`: il layer di analisi gira nel Web Worker). Le feature arrivano già
 * filtrate per sorgente: il motore vede solo quelle **misurate o manuali**
 * (`21-AUDIO-FEATURES.md` §12, D-AF.4).
 *
 * **Niente segnali inventati** (D-A.1, 04§11): sotto la soglia di eventi con
 * feature il periodo non produce nessun insight. Il fallback "mood-by-genre"
 * di `04§1.4` **non esiste** (D-A.6, ratificata il 2026-10-30 dalla issue
 * #193): la mappa genere→valence/energy non è ratificata in nessun
 * documento, e inventarla sarebbe esattamente il segnale inventato che D-A.1
 * esclude. La degradazione dichiarata da `04§1.4` è quindi: nessun insight
 * mood, più un **warning aggregato** per periodo con il numero di eventi
 * senza feature misurata o manuale.
 */

import type { Logger } from '../../logger';
import type { AudioFeatures, Insight, ListenEvent, MoodPeriodPayload } from '../../schema';
import { eventTime } from '../datetime';
import { classifyMood, weightedAverage } from './classify';
import { computeMoodDerivedVersion } from './derivedVersion';
import { buildFeatureIndex } from './features';
import { groupByPeriod, periodBounds } from './period';
import {
  MOOD_INSIGHT_TYPES,
  MOOD_PERIODS,
  resolveMoodConfig,
  type MoodConfig,
  type MoodPeriod,
} from './types';

/** Durata di riferimento del peso di un ascolto: 4 minuti (04§3.3). */
export const MOOD_WEIGHT_BASE_MS = 240_000;

/** Opzioni del motore. */
export interface MoodEngineOptions {
  /** Override dei parametri — utile per i test e per le preferenze future. */
  readonly config?: Partial<MoodConfig>;
  /** Periodi aggregati. Default: giorno, settimana e mese (04§3.1). */
  readonly periods?: readonly MoodPeriod[];
  /**
   * Logger per il warning aggregato sulle feature mancanti (04§1.4).
   *
   * È **opzionale**: il motore resta puro e chi non ne ha bisogno non
   * osserva nulla. Il warning non porta dati personali: solo periodo e
   * conteggi (09§4).
   */
  readonly logger?: Logger | undefined;
}

/** Dati grezzi su cui il motore lavora. */
export interface MoodInput {
  /** Ascolti del periodo da analizzare. */
  readonly listens: readonly ListenEvent[];
  /** Feature audio disponibili (già filtrate per sorgente, 21§12). */
  readonly features: readonly AudioFeatures[];
}

/** Mood calcolato: l'insight persistibile più il suo contesto. */
export interface GeneratedMood {
  /** Insight pronto per la persistenza (`type: mood_day|mood_week|mood_month`). */
  readonly insight: Insight;
  /** Periodo aggregato. */
  readonly period: MoodPeriod;
  /** Payload del mood (02§4). */
  readonly payload: MoodPeriodPayload;
}

/**
 * Id deterministico dell'insight.
 *
 * Ricalcolare il mood di un periodo non deve creare un duplicato: l'id
 * dipende dal periodo, non da un UUID casuale.
 */
export function moodInsightId(period: MoodPeriod, key: string): string {
  return `mood-${period}-${key}`;
}

/**
 * Mood di un periodo — 04§3.3 (`computeMoodForPeriod`).
 *
 * @param events - tutti gli ascolti del periodo.
 * @param features - indice delle feature per `trackId` (21§12).
 * @param config - parametri correnti.
 * @returns il payload del mood, oppure `null` se i dati non bastano.
 */
export function computeMoodForPeriod(
  events: readonly ListenEvent[],
  features: ReadonlyMap<string, AudioFeatures>,
  config: MoodConfig,
): MoodPeriodPayload | null {
  const valences: { value: number; weight: number }[] = [];
  const energies: { value: number; weight: number }[] = [];

  for (const event of events) {
    const feature = features.get(event.trackId);
    // La feature deve avere **entrambi** i valori: il pseudocodice di 04§3.3
    // controlla solo `valence`, ma `energy` è `null` nello schema (02§3.4) e
    // una media con un `null` produrrebbe `NaN`, che violerebbe l'invariante
    // `avgEnergy ∈ [0, 1]` (04§3.6).
    if (!feature || feature.valence === null || feature.energy === null) continue;
    const weight = event.durationMs / MOOD_WEIGHT_BASE_MS;
    valences.push({ value: feature.valence, weight });
    energies.push({ value: feature.energy, weight });
  }

  if (valences.length < config.minEventsPerPeriod) {
    return null; // dati insufficienti
  }

  const avgValence = weightedAverage(valences);
  const avgEnergy = weightedAverage(energies);
  if (avgValence === null || avgEnergy === null) {
    return null; // nessun peso: media non definibile
  }

  return {
    kind: 'mood',
    mood: classifyMood(avgValence, avgEnergy, config),
    avgValence,
    avgEnergy,
    // `eventCount` è il numero di **tutti** gli ascolti del periodo (04§3.3),
    // non solo quelli con feature: dice quanta attività copre il mood.
    eventCount: events.length,
  };
}

/** Motore del mood. */
export class MoodEngine {
  private readonly config: MoodConfig;
  private readonly periods: readonly MoodPeriod[];
  private readonly logger?: Logger | undefined;
  private versionPromise: Promise<string> | null = null;

  constructor(options: MoodEngineOptions = {}) {
    this.config = resolveMoodConfig(options.config);
    this.periods = options.periods ?? MOOD_PERIODS;
    this.logger = options.logger;
  }

  /** Parametri effettivi del motore. */
  get parameters(): MoodConfig {
    return this.config;
  }

  /** `derivedVersion` calcolata dai parametri — 04§9. */
  async derivedVersion(): Promise<string> {
    this.versionPromise ??= computeMoodDerivedVersion(this.config);
    return this.versionPromise;
  }

  /**
   * Calcola il mood di tutti i periodi coperti dagli ascolti.
   *
   * L'output è **deterministico**: a parità di ascolti e feature produce
   * sempre gli stessi insight, con gli stessi id (ricalcolo idempotente,
   * 02§7 MIG-3). Gli insight sono ordinati per periodo, dal più antico.
   */
  async generate(input: MoodInput): Promise<GeneratedMood[]> {
    const features = buildFeatureIndex(input.features);
    const derivedVersion = await this.derivedVersion();
    const generated: GeneratedMood[] = [];

    for (const period of this.periods) {
      const groups = groupByPeriod(input.listens, eventTime, period, this.config);
      for (const [key, events] of groups) {
        const usable = countUsable(events, features);
        this.warnMissingFeatures(period, key, events.length - usable, events.length);
        const payload = computeMoodForPeriod(events, features, this.config);
        if (!payload) continue;
        const bounds = periodBounds(period, eventTime(events[0]!), this.config);
        generated.push({
          insight: {
            id: moodInsightId(period, key),
            type: MOOD_INSIGHT_TYPES[period],
            periodStart: bounds.start,
            periodEnd: bounds.end,
            payload,
            // La copertura dei dati: quota di ascolti del periodo con feature
            // utilizzabili. 04§3 non definisce la `confidence` del mood (il
            // payload 02§4 è chiuso e non ha un campo score): il dato
            // disponibile è quanto del periodo il mood copre.
            confidence: events.length > 0 ? usable / events.length : 0,
            derivedVersion,
            status: 'pending',
            userNote: null,
            createdAt: Date.now(),
          },
          period,
          payload,
        });
      }
    }

    return generated.sort(
      (a, b) =>
        a.insight.periodStart - b.insight.periodStart || a.insight.id.localeCompare(b.insight.id),
    );
  }

  /**
   * Warning aggregato sulle feature mancanti — 04§1.4.
   *
   * **Un solo warning per periodo**, con il **numero** di eventi senza
   * feature misurata o manuale: il segnale dice quanto il mood copre, non
   * elenca i singoli ascolti (e non porta dati personali, 09§4).
   *
   * Il warning è emesso anche quando il periodo non produce insight: è
   * proprio il caso in cui la copertura manca.
   */
  private warnMissingFeatures(
    period: MoodPeriod,
    periodKey: string,
    missing: number,
    total: number,
  ): void {
    if (missing <= 0) return;
    this.logger?.warn('eventi senza audio features', {
      period,
      periodKey,
      missingFeatures: missing,
      totalEvents: total,
    });
  }
}

/** Quanti ascolti del periodo hanno una feature utilizzabile. */
function countUsable(
  events: readonly ListenEvent[],
  features: ReadonlyMap<string, AudioFeatures>,
): number {
  let count = 0;
  for (const event of events) {
    const feature = features.get(event.trackId);
    if (feature && feature.valence !== null && feature.energy !== null) count += 1;
  }
  return count;
}
