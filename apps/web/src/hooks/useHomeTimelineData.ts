/**
 * Hook dei dati di Home (⑥) e Timeline (⑦) — Story 3.1.
 *
 * Il **modello** (`homeTimelineModel.ts`) è puro e non sa nulla del database;
 * questo hook è il solo punto che conosce Dexie, e si occupa di tre cose:
 * leggere gli ascolti e gli insight, **mapparli** sul view model, e dichiarare
 * in che stato è la schermata (`empty` / `partial` / `ready` / `loading` /
 * `error`).
 *
 * La regola di stato è la spec (`06§2.6-2.7`): `partial` è «meno di 100
 * eventi» per la Home e «meno di 6 mesi di dati» per la Timeline. La soglia
 * è dichiarata **qui**, in un posto solo.
 */

import { useEffect, useState } from 'react';
import {
  openDb,
  listListensInRange,
  listInsightsByType,
  DB_NAME,
  type LifeSoundtrackDB,
} from '@core/db';
import { listContextPeriods } from '@core/context';
import { toRibbonPeriod, type ContextRibbonPeriod } from '../components/contextRibbonModel';
import {
  bucketizeListens,
  bucketizeMood,
  computeBarWeek,
  computeHomeStats,
  toEraBands,
  type EraBandModel,
  type EraFact,
  type HomeStats,
  type ListenFact,
  type MoodPoint,
  type SeriesPoint,
} from '../screens/homeTimelineModel';

/** Soglia della Home: sotto i 100 eventi la storia è «parziale» (`06§2.6`). */
export const HOME_PARTIAL_THRESHOLD = 100;

/** Soglia della Timeline: sotto i 6 mesi di dati la timeline è «parziale» (`06§2.7`). */
export const TIMELINE_PARTIAL_MONTHS = 6;

/** I dati delle due schermate, già mappati sul view model. */
export interface HomeTimelineData {
  /** Stato della schermata (inclusi gli stati vuoti). */
  state: 'empty' | 'no-features' | 'partial' | 'ready' | 'loading' | 'error';
  stats: HomeStats;
  /** I sette giorni della settimana. */
  barWeek: ReturnType<typeof computeBarWeek>;
  /** Serie del volume, per bucket. */
  volume: SeriesPoint[];
  /** Serie del mood, per bucket. */
  mood: SeriesPoint[];
  /** Le ere musicali. */
  eras: EraBandModel[];
  /** I periodi di contesto (nastro contesto, Story 3.4). */
  contexts: ContextRibbonPeriod[];
  /** Inizio e fine dei dati. */
  range: { start: number; end: number } | null;
  /** Il ricordo del giorno (l'ultimo insight di tipo `memory`). */
  memory: { title: string; mood: string | null; date: string } | null;
  /** Mood della settimana, già reso (per AppShell). */
  weekMoodLabel: string | null;
}

/** Stato vuoto, prima che il database risponda. */
function initialData(): HomeTimelineData {
  return {
    state: 'loading',
    stats: { tracks: 0, hours: 0, artists: 0, eras: 0 },
    barWeek: [],
    volume: [],
    mood: [],
    eras: [],
    contexts: [],
    range: null,
    memory: null,
    weekMoodLabel: null,
  };
}

/**
 * Mappa gli ascolti del core sul minimo che il modello sa contare.
 *
 * L'artista non sta sull'ascolto ma sul **brano** (`Track.artistId`): il
 * join è fatto qui, una volta, e non nel modello.
 */
function toListenFacts(
  listens: readonly { timestamp: number; durationMs: number; trackId: string }[],
  artistByTrack: ReadonlyMap<string, string>,
): ListenFact[] {
  return listens.map((listen) => ({
    playedAt: listen.timestamp,
    durationMs: listen.durationMs,
    artistId: artistByTrack.get(listen.trackId) ?? listen.trackId,
  }));
}

/**
 * Carica i dati delle due schermate.
 *
 * `granularity` determina il bucket delle serie: cambiarla **ricalcola** le
 * serie, ed è il chiamante (la Timeline) a decidere quando.
 *
 * `dbName` è il nome del database IndexedDB da leggere: di default `DB_NAME`
 * (il database unico dell'app, ADR-0002 local-first). È iniettabile **solo
 * per i test**, che devono leggere un database isolato invece di quello
 * dell'app.
 */
export function useHomeTimelineData(
  granularity: 'years' | 'months' | 'weeks' | 'days',
  dbName: string = DB_NAME,
): HomeTimelineData {
  const [data, setData] = useState<HomeTimelineData>(initialData);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const db: LifeSoundtrackDB = await openDb(dbName);
        const listens = await listListensInRange(db, 0, Date.now() + 86_400_000);
        const tracks = await db.tracks.toArray();
        const artistByTrack = new Map(tracks.map((track) => [track.id, track.artistId]));
        const eras = await listInsightsByType(db, 'era');
        const moods = await listInsightsByType(db, 'mood_day');
        const moodWeeks = await listInsightsByType(db, 'mood_week');
        const memories = await listInsightsByType(db, 'memory');
        const contexts = await listContextPeriods(db);

        // Verifica feature utilizzabili (valence + energy non nulli)
        const features = await db.features.toArray();
        const featureByTrack = new Map(features.map((f) => [f.trackId, f]));
        let hasUsableFeatures = false;
        for (const listen of listens) {
          const feat = featureByTrack.get(listen.trackId);
          if (feat && feat.valence !== null && feat.energy !== null) {
            hasUsableFeatures = true;
            break;
          }
        }

        if (cancelled) return;

        const facts = toListenFacts(listens, artistByTrack);
        const eraFacts: EraFact[] = eras.map((era) => ({
          id: era.id,
          startTime: era.periodStart,
          endTime: era.periodEnd,
          label: era.payload.kind === 'era' ? era.payload.label : '',
          mood: era.payload.kind === 'era' ? era.payload.moodDominant : null,
        }));
        const moodPoints: MoodPoint[] = moods
          .filter((mood) => mood.payload.kind === 'mood')
          .map((mood) => ({
            periodStart: mood.periodStart,
            periodEnd: mood.periodEnd,
            valence: mood.payload.kind === 'mood' ? mood.payload.avgValence : 0,
            mood: mood.payload.kind === 'mood' ? mood.payload.mood : null,
          }));

        // weekMoodLabel dal più recente mood_week
        const latestMoodWeek = moodWeeks
          .filter((m) => m.payload.kind === 'mood')
          .sort((a, b) => b.periodStart - a.periodStart)[0];
        const weekMoodLabel =
          latestMoodWeek && latestMoodWeek.payload.kind === 'mood'
            ? latestMoodWeek.payload.mood
            : null;

        const timestamps = facts.map((fact) => fact.playedAt);
        const range =
          timestamps.length > 0
            ? { start: Math.min(...timestamps), end: Math.max(...timestamps) }
            : null;

        const stats = computeHomeStats(facts, eraFacts.length);
        let state: HomeTimelineData['state'];
        if (facts.length === 0) {
          state = 'empty';
        } else if (!hasUsableFeatures) {
          state = 'no-features';
        } else if (facts.length < HOME_PARTIAL_THRESHOLD) {
          state = 'partial';
        } else {
          state = 'ready';
        }

        const lastMemory = memories[memories.length - 1];
        const memory =
          lastMemory && lastMemory.payload.kind === 'memory'
            ? {
                title: lastMemory.payload.text,
                mood: null,
                date: new Date(lastMemory.periodStart).toISOString().slice(0, 10),
              }
            : null;

        setData({
          state,
          stats,
          barWeek: computeBarWeek(facts, Date.now()),
          volume: bucketizeListens(facts, granularity),
          mood: bucketizeMood(moodPoints, granularity),
          eras: toEraBands(eraFacts),
          contexts: contexts.map((context) => toRibbonPeriod(context)),
          range,
          memory,
          weekMoodLabel,
        });
      } catch {
        if (!cancelled) setData({ ...initialData(), state: 'error' });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [granularity, dbName]);

  return data;
}
