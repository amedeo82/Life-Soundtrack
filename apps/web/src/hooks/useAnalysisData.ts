/**
 * Hook dei dati di Analisi (⑩) — Story 3.3, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §7.
 *
 * La schermata consuma l'output **persistito** della Story 2.5: gli insight
 * `mood_day` (i periodi con mood), `event` (i fatti narrativi) e `memory` (i
 * ricordi). Nulla è calcolato «a caldo»: la lettura è dalla tabella
 * `insights`, quindi l'utente vede esattamente ciò che l'analisi ha scritto.
 *
 * Il testo degli insight è **già reso** (`EventPayload.description`,
 * `MemoryPayload.text` — D-A.4): la UI non re-renderizza i template.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DB_NAME, listInsightsByType, openDb, setInsightStatus } from '@core/db';
import type { EventKind, Insight, MemoryKind, MoodId } from '@core/schema';
import {
  aggregateByMonth,
  dominantMood,
  type MoodInsightFact,
  type PeriodPoint,
} from '../screens/analysisModel';

/** Un insight mostrato sotto i grafici. */
export interface AnalysisInsightModel {
  /** Id dell'insight. */
  readonly id: string;
  /** Che tipo di insight è. */
  readonly kind: 'event' | 'memory';
  /** Il tipo dell'evento (null per un ricordo). */
  readonly eventType: EventKind | null;
  /** Il tipo del ricordo (null per un evento). */
  readonly memoryKind: MemoryKind | null;
  /** Il testo, **già reso** dal core. */
  readonly description: string;
  /** La rilevanza (0..1). */
  readonly confidence: number;
  /** Lo stato dell'insight (`pending` / `confirmed` / …). */
  readonly status: Insight['status'];
  /** Inizio del periodo (unix ms UTC). */
  readonly at: number;
}

/** I dati della schermata Analisi. */
export interface AnalysisData {
  /** Lo stato della schermata. */
  readonly state: 'loading' | 'empty' | 'ready' | 'error';
  /** I periodi mensili (i punti del quadrante). */
  readonly periods: readonly PeriodPoint[];
  /** Gli insight da mostrare sotto i grafici. */
  readonly insights: readonly AnalysisInsightModel[];
  /** Il mood dominante della storia (per la frase in prosa). */
  readonly dominantMood: MoodId | null;
  /** Cambia lo stato di un insight (`confirmed` / `corrected` / `dismissed`). */
  readonly setStatus: (id: string, status: Insight['status']) => void;
}

/**
 * Carica i dati di Analisi.
 *
 * `dbName` è iniettabile **solo per i test**.
 */
export function useAnalysisData(dbName: string = DB_NAME): AnalysisData {
  const [state, setState] = useState<AnalysisData['state']>('loading');
  const [facts, setFacts] = useState<readonly MoodInsightFact[]>([]);
  const [insights, setInsights] = useState<readonly AnalysisInsightModel[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const db = await openDb(dbName);
        const [moodInsights, eventInsights, memoryInsights] = await Promise.all([
          listInsightsByType(db, 'mood_day'),
          listInsightsByType(db, 'event'),
          listInsightsByType(db, 'memory'),
        ]);
        if (cancelled) return;

        const moodFacts: MoodInsightFact[] = [];
        for (const insight of moodInsights) {
          if (insight.payload.kind !== 'mood') continue;
          moodFacts.push({
            id: insight.id,
            periodStart: insight.periodStart,
            periodEnd: insight.periodEnd,
            mood: insight.payload.mood,
            valence: insight.payload.avgValence,
            energy: insight.payload.avgEnergy,
            eventCount: insight.payload.eventCount,
          });
        }

        const models: AnalysisInsightModel[] = [];
        for (const insight of eventInsights) {
          if (insight.payload.kind !== 'event') continue;
          models.push({
            id: insight.id,
            kind: 'event',
            eventType: insight.payload.eventType,
            memoryKind: null,
            description: insight.payload.description,
            confidence: insight.confidence,
            status: insight.status,
            at: insight.periodStart,
          });
        }
        for (const insight of memoryInsights) {
          if (insight.payload.kind !== 'memory') continue;
          models.push({
            id: insight.id,
            kind: 'memory',
            eventType: null,
            memoryKind: insight.payload.memoryKind,
            description: insight.payload.text,
            confidence: insight.confidence,
            status: insight.status,
            at: insight.periodStart,
          });
        }
        models.sort((a, b) => b.at - a.at);

        setFacts(moodFacts);
        setInsights(models);
        setState(moodFacts.length === 0 && models.length === 0 ? 'empty' : 'ready');
      } catch {
        if (!cancelled) setState('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [dbName]);

  const periods = useMemo(() => aggregateByMonth(facts), [facts]);
  const mood = useMemo(() => dominantMood(facts), [facts]);

  /**
   * Cambia lo stato di un insight.
   *
   * Lo stato locale è **ottimistico**: l'insight esce subito dalla lista dei
   * `dismissed`, e il database è la verità (il prossimo caricamento riporta
   * lo stato vero).
   */
  const updateStatus = useCallback(
    (id: string, status: Insight['status']) => {
      setInsights((current) =>
        current
          .map((insight) => (insight.id === id ? { ...insight, status } : insight))
          .filter((insight) => !(insight.id === id && status === 'dismissed')),
      );
      void (async () => {
        try {
          const db = await openDb(dbName);
          await setInsightStatus(db, id, status);
        } catch {
          // Il ricalcolo riporta lo stato vero: nessun errore bloccante.
        }
      })();
    },
    [dbName],
  );

  return { state, periods, insights, dominantMood: mood, setStatus: updateStatus };
}
