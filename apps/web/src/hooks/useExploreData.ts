/**
 * Hook dei dati di Esplora (⑨) — Story 3.3, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §6.
 *
 * È l'unico punto che conosce Dexie per questa schermata: carica il
 * **catalogo dell'utente** (artisti, brani, album) e i **periodi con mood**
 * (gli insight `mood_day` persistiti dalla Story 2.5).
 *
 * Il percorso è **interamente locale**: nessuna richiesta di rete, nessuna
 * indice globale. I dati caricati sono già quelli dell'utente.
 */

import { useEffect, useState } from 'react';
import { DB_NAME, listInsightsByType, openDb } from '@core/db';
import type { Album, Artist, Track } from '@core/schema';
import type { ExploreCatalog, MoodPeriod } from '../screens/exploreModel';

/** I dati della schermata Esplora. */
export interface ExploreData {
  /** Lo stato della schermata. */
  readonly state: 'loading' | 'empty' | 'ready' | 'error';
  /** Il catalogo dell'utente. */
  readonly catalog: ExploreCatalog;
  /** I periodi con mood (dal tab Mood). */
  readonly periods: readonly MoodPeriod[];
}

/** Il catalogo vuoto (lo stato iniziale). */
const EMPTY_CATALOG: ExploreCatalog = { artists: [], tracks: [], albums: [] };

/**
 * Carica i dati di Esplora.
 *
 * `dbName` è iniettabile **solo per i test**, che leggono un database
 * isolato invece di quello dell'app.
 */
export function useExploreData(dbName: string = DB_NAME): ExploreData {
  const [state, setState] = useState<ExploreData['state']>('loading');
  const [catalog, setCatalog] = useState<ExploreCatalog>(EMPTY_CATALOG);
  const [periods, setPeriods] = useState<readonly MoodPeriod[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const db = await openDb(dbName);
        const [artists, tracks, albums, moodInsights] = await Promise.all([
          db.artists.toArray(),
          db.tracks.toArray(),
          db.albums.toArray(),
          listInsightsByType(db, 'mood_day'),
        ]);
        if (cancelled) return;

        const moodPeriods: MoodPeriod[] = [];
        for (const insight of moodInsights) {
          if (insight.payload.kind !== 'mood') continue;
          moodPeriods.push({
            id: insight.id,
            mood: insight.payload.mood,
            at: insight.periodStart,
            end: insight.periodEnd,
            eventCount: insight.payload.eventCount,
          });
        }

        const next: ExploreCatalog = {
          artists: artists as Artist[],
          tracks: tracks as Track[],
          albums: albums as Album[],
        };
        setCatalog(next);
        setPeriods(moodPeriods);
        setState(
          next.artists.length + next.tracks.length + next.albums.length === 0 ? 'empty' : 'ready',
        );
      } catch {
        if (!cancelled) setState('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [dbName]);

  return { state, catalog, periods };
}
