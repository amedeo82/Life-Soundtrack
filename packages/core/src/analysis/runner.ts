/**
 * Runner del pipeline di analisi — 23-ANALYSIS-PIPELINE.md v1.0 🟢.
 *
 * Orchestrazione nel core (senza React, senza dipendenze DB oltre Dexie).
 * Espone `runAnalysisPipeline` che l'app chiama tramite l'adapter in
 * `apps/web/src/analysis/analysisRunner.ts`.
 */

import type { LifeSoundtrackDB } from '../db';
import type { Insight, InsightType } from '../schema';
import type { Logger } from '../logger';
import type { Translator } from './i18n';
import {
  createEraGenerator,
  createEventGenerator,
  createMemoryGenerator,
  createMoodGenerator,
  AnalysisPipeline,
  type AnalysisInput,
  type AnalysisGenerator,
} from './pipeline';

/** Opzioni di esecuzione dell'analisi. */
export interface AnalysisRunOptions {
  /** Database locale (Dexie). */
  readonly db: LifeSoundtrackDB;
  /** Resolver i18n iniettato dall'app (D-A.4). */
  readonly translator: Translator;
  /** Locale dell'app (default: 'it'). */
  readonly locale?: string;
  /** Istante di riferimento "oggi" (default: Date.now()). */
  readonly today?: number;
  /** Logger per warning/debug (opzionale). */
  readonly logger?: Logger;
  /** Funzione ora per test deterministici (default: Date.now). */
  readonly now?: () => number;
}

/** Report di esecuzione dell'analisi. */
export interface AnalysisRunReport {
  /** Insight prodotti per tipo. */
  readonly produced: Record<InsightType, number>;
  /** Righe stale rimosse per tipo. */
  readonly replaced: Record<InsightType, number>;
  /** Generator che hanno prodotto 0 insight. */
  readonly skipped: number;
  /** Durata in ms. */
  readonly durationMs: number;
  /** Eventi senza valence/energy (feature mancanti). */
  readonly missingFeatures: number;
}

/** Tipo non prodotto oggi (04§4 fuori perimetro). */
const NON_PRODUCED_TYPES: readonly InsightType[] = ['pattern'];

/**
 * Esegue il pipeline di analisi completo e persiste i risultati.
 *
 * Comportamento:
 * 1. Legge listens, tracks, artists, features dal DB
 * 2. Costruisce i 4 generator (mood, era, event, memory) nell'ordine 04§8.1
 * 3. Esegue pipeline.run(input)
 * 4. Persiste con le replace* corrette, in transazione per tipo
 * 5. Scarta gli insight di tipo 'pattern' (non prodotti oggi)
 * 6. Ritorna il report
 *
 * Idempotenza (T-AF.14): due esecuzioni consecutive producono lo stesso
 * insieme di Insight (id deterministici: era-${periodStart}, ecc.) e non
 * duplicano righe.
 */
export async function runAnalysisPipeline(options: AnalysisRunOptions): Promise<AnalysisRunReport> {
  const startTime = options.now?.() ?? Date.now();
  const { db, translator, locale = 'it', today = startTime, logger } = options;

  // 1. Leggi dati dal DB
  const listens = await db.listens.toArray();
  const tracks = await db.tracks.toArray();
  const artists = await db.artists.toArray();
  const features = await db.features.toArray();

  // 2. Conta eventi senza feature utilizzabili (valence + energy non nulli)
  const featureByTrack = new Map(features.map((f) => [f.trackId, f]));
  let missingFeatures = 0;
  for (const listen of listens) {
    const feat = featureByTrack.get(listen.trackId);
    if (!feat || feat.valence === null || feat.energy === null) {
      missingFeatures++;
    }
  }

  // 3. Costruisci input per il pipeline
  const input: AnalysisInput = {
    listens,
    tracks,
    artists,
    features,
    today,
    locale,
  };

  // 4. Costruisci i 4 generator nell'ordine dichiarato in 04§8.1
  const generators: AnalysisGenerator[] = [
    createMoodGenerator({ logger }),
    createEraGenerator({ translator, logger }),
    createEventGenerator({ translator, logger }),
    createMemoryGenerator({ translator }),
  ];

  // 5. Esegui pipeline
  const pipeline = new AnalysisPipeline(generators);
  const insights = await pipeline.run(input);

  // 6. Filtra tipi non prodotti (pattern)
  const filteredInsights = insights.filter((insight) => !NON_PRODUCED_TYPES.includes(insight.type));

  // 7. Persisti con le replace* corrette per tipo
  const produced: Record<InsightType, number> = {
    mood_day: 0,
    mood_week: 0,
    mood_month: 0,
    era: 0,
    event: 0,
    memory: 0,
    pattern: 0,
  };
  const replaced: Record<InsightType, number> = {
    mood_day: 0,
    mood_week: 0,
    mood_month: 0,
    era: 0,
    event: 0,
    memory: 0,
    pattern: 0,
  };
  let skipped = 0;

  // Raggruppa per tipo
  const byType = new Map<InsightType, Insight[]>();
  for (const insight of filteredInsights) {
    const arr = byType.get(insight.type) ?? [];
    arr.push(insight);
    byType.set(insight.type, arr);
  }

  // Derived version per ogni tipo (usata per rilevare stale)
  // Il runner calcola la derivedVersion dai parametri correnti
  // (le factory la calcolano internamente; qui usiamo quella del primo insight per tipo)
  const derivedVersionByType = new Map<InsightType, string>();
  for (const [type, arr] of byType) {
    if (arr.length > 0) {
      derivedVersionByType.set(type, arr[0]!.derivedVersion);
    }
  }

  // Importa le funzioni di persistenza
  const { replaceInsightsOfType, replaceAllInsightsOfType } = await import('../db/insights');

  // Per mood (giorno/settimana/mese): replaceInsightsOfType (per periodo)
  const moodInsights = byType.get('mood_day') ?? [];
  if (moodInsights.length > 0) {
    const dv = derivedVersionByType.get('mood_day') ?? '';
    const report = await replaceInsightsOfType(db, {
      type: 'mood_day',
      insights: moodInsights,
      derivedVersion: dv,
    });
    produced.mood_day = report.inserted;
    replaced.mood_day = report.removedStale + report.removedSuperseded;
  } else {
    skipped++;
  }

  const moodWeekInsights = byType.get('mood_week') ?? [];
  if (moodWeekInsights.length > 0) {
    const dv = derivedVersionByType.get('mood_week') ?? '';
    const report = await replaceInsightsOfType(db, {
      type: 'mood_week',
      insights: moodWeekInsights,
      derivedVersion: dv,
    });
    produced.mood_week = report.inserted;
    replaced.mood_week = report.removedStale + report.removedSuperseded;
  } else {
    skipped++;
  }

  const moodMonthInsights = byType.get('mood_month') ?? [];
  if (moodMonthInsights.length > 0) {
    const dv = derivedVersionByType.get('mood_month') ?? '';
    const report = await replaceInsightsOfType(db, {
      type: 'mood_month',
      insights: moodMonthInsights,
      derivedVersion: dv,
    });
    produced.mood_month = report.inserted;
    replaced.mood_month = report.removedStale + report.removedSuperseded;
  } else {
    skipped++;
  }

  // Per ere: replaceAllInsightsOfType (confini mobili, D.69.8)
  const eraInsights = byType.get('era') ?? [];
  if (eraInsights.length > 0) {
    const dv = derivedVersionByType.get('era') ?? '';
    const report = await replaceAllInsightsOfType(db, {
      type: 'era',
      insights: eraInsights,
      derivedVersion: dv,
    });
    produced.era = report.inserted;
    replaced.era = report.removedStale + report.removedSuperseded;
  } else {
    skipped++;
  }

  // Per eventi: replaceInsightsOfType (per periodo)
  const eventInsights = byType.get('event') ?? [];
  if (eventInsights.length > 0) {
    const dv = derivedVersionByType.get('event') ?? '';
    const report = await replaceInsightsOfType(db, {
      type: 'event',
      insights: eventInsights,
      derivedVersion: dv,
    });
    produced.event = report.inserted;
    replaced.event = report.removedStale + report.removedSuperseded;
  } else {
    skipped++;
  }

  // Per ricordi: replaceAllInsightsOfType (il feed si riordina per rilevanza)
  const memoryInsights = byType.get('memory') ?? [];
  if (memoryInsights.length > 0) {
    const dv = derivedVersionByType.get('memory') ?? '';
    const report = await replaceAllInsightsOfType(db, {
      type: 'memory',
      insights: memoryInsights,
      derivedVersion: dv,
    });
    produced.memory = report.inserted;
    replaced.memory = report.removedStale + report.removedSuperseded;
  } else {
    skipped++;
  }

  const durationMs = (options.now?.() ?? Date.now()) - startTime;

  if (logger) {
    logger.info('analisi completata', {
      produced,
      replaced,
      durationMs,
      missingFeatures,
    });
  }

  return {
    produced,
    replaced,
    skipped,
    durationMs,
    missingFeatures,
  };
}
