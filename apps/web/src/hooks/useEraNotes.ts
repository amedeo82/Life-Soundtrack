/**
 * Hook delle note delle ere — Story 3.2, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §5 (T25.7).
 *
 * Il nome e le parole chiave di un'era stanno in `Insight.userNote` (D-25.4):
 * questo hook li legge e li scrive. Come `useMemories`, è l'unico punto che
 * conosce Dexie.
 *
 * Il testo scritto qui **sopravvive al ricalcolo** dell'analisi: la
 * persistenza degli insight riporta `userNote` e `status` dell'utente
 * (`replaceAllInsightsOfType` → `preserveUserFields`).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  DB_NAME,
  listInsightsByType,
  openDb,
  setInsightUserNote,
  type LifeSoundtrackDB,
} from '@core/db';

/** Un'era, con la nota dell'utente. */
export interface EraNoteModel {
  /** Id dell'insight dell'era (deterministico: `era-${periodStart}`). */
  readonly id: string;
  /** L'etichetta generata dal motore, già resa. */
  readonly label: string;
  /** La nota libera dell'utente (`null` = nessuna). */
  readonly userNote: string | null;
  /** Inizio dell'era (timestamp UTC). */
  readonly start: number;
  /** Fine dell'era (timestamp UTC). */
  readonly end: number;
}

/** I dati delle note. */
export interface EraNotesData {
  /** Stato della sezione. */
  readonly state: 'loading' | 'empty' | 'ready' | 'error';
  /** Le ere, con la nota. */
  readonly eras: readonly EraNoteModel[];
  /** Rinomina un'era e ne salva le parole chiave. */
  readonly rename: (id: string, note: string) => void;
}

/** Carica le ere con le note dell'utente. */
export function useEraNotes(dbName: string = DB_NAME): EraNotesData {
  const [state, setState] = useState<EraNotesData['state']>('loading');
  const [eras, setEras] = useState<readonly EraNoteModel[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const db: LifeSoundtrackDB = await openDb(dbName);
        const insights = await listInsightsByType(db, 'era');
        if (cancelled) return;
        setEras(
          insights.map((insight) => ({
            id: insight.id,
            label: insight.payload.kind === 'era' ? insight.payload.label : '',
            userNote: insight.userNote,
            start: insight.periodStart,
            end: insight.periodEnd,
          })),
        );
        setState(insights.length === 0 ? 'empty' : 'ready');
      } catch {
        if (!cancelled) setState('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [dbName]);

  const rename = useCallback(
    (id: string, note: string) => {
      const value = note.trim();
      setEras((current) =>
        current.map((era) =>
          era.id === id ? { ...era, userNote: value === '' ? null : value } : era,
        ),
      );
      void (async () => {
        try {
          const db: LifeSoundtrackDB = await openDb(dbName);
          await setInsightUserNote(db, id, {
            userNote: value === '' ? null : value,
            status: 'confirmed',
          });
        } catch {
          // Il prossimo caricamento riporta lo stato vero dal database.
        }
      })();
    },
    [dbName],
  );

  return { state, eras, rename };
}
