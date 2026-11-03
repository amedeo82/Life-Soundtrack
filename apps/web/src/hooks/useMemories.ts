/**
 * Hook del feed dei ricordi (⑪) — Story 3.2, spec `docs/25-MEMORIES-SHARE-EXPLORE.md` §2.
 *
 * Il feed mostra gli insight di tipo `memory` in ordine di **rilevanza**:
 * la rilevanza del motore dei ricordi (`04§7.4`) è normalizzata dentro
 * `Insight.confidence`, quindi l'ordinamento è su quel campo e non su
 * `periodStart` (il ricordo più recente non è per forza il più importante).
 *
 * I ricordi **nascosti** (`status: 'dismissed'`, swipe sinistro — D-25.3)
 * non compaiono nel feed, ma **restano** nel database: cancellarli è un atto
 * separato (Story 5.2, export e purge).
 *
 * Questo hook è l'unico punto che conosce Dexie: la schermata riceve dei
 * view model già pronti e non sa nulla del database.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DB_NAME,
  listInsightsByType,
  openDb,
  setInsightStatus,
  setInsightUserNote,
  type LifeSoundtrackDB,
} from '@core/db';
import type { Insight, MemoryKind } from '@core/schema';

/** Pagine di 10 elementi (`06§2.11`, infinite scroll). */
export const MEMORIES_PAGE_SIZE = 10;

/** Il ricordo, come lo vede la UI. */
export interface MemoryCardModel {
  /** Id dell'insight (deterministico: `mem-${giorno}-${kind}-${...}`). */
  readonly id: string;
  /** Il testo del ricordo, **già reso** (`MemoryPayload.text`, D-A.4). */
  readonly title: string;
  /** Il tipo di ricordo (`on_this_day`, `first_time`, `milestone`, …). */
  readonly kind: MemoryKind;
  /** Data ISO del periodo (`YYYY-MM-DD`). */
  readonly date: string;
  /** Quanti anni fa, se il ricordo lo sa. */
  readonly yearsAgo: number | null;
  /** Copertina del brano simbolo, se presente. */
  readonly artworkUrl: string | null;
  /** Id del brano simbolo. */
  readonly trackId: string | null;
  /** Il nome del brano simbolo (serve alla card condivisa). */
  readonly trackName: string | null;
  /** Id dell'artista del brano simbolo. */
  readonly artistId: string | null;
  /** Il nome dell'artista del brano simbolo (serve alla card condivisa). */
  readonly artistName: string | null;
  /** Lo stato dell'insight (`confirmed` = salvato dall'utente). */
  readonly status: Insight['status'];
  /** La nota libera dell'utente. */
  readonly userNote: string | null;
}

/** I dati del feed. */
export interface MemoriesData {
  /** Stato della schermata. */
  readonly state: 'loading' | 'empty' | 'ready' | 'error';
  /** I ricordi visibili (la pagina corrente). */
  readonly items: readonly MemoryCardModel[];
  /** Ci sono altri ricordi oltre quelli mostrati? */
  readonly hasMore: boolean;
  /** Carica la pagina successiva. */
  readonly loadMore: () => void;
  /** Nasconde un ricordo (`dismissed`): resta nel database, esce dal feed. */
  readonly dismiss: (id: string) => void;
  /** Salva un ricordo (`confirmed`). */
  readonly save: (id: string) => void;
  /** Scrive la nota libera dell'utente sul ricordo (il suo tag). */
  readonly tag: (id: string, note: string) => void;
}

/**
 * Mappa gli insight `memory` sul view model.
 *
 * L'ordinamento per rilevanza è fatto dal hook, che conosce anche il
 * `confidence` (non fa parte del view model: è un fatto dell'insight).
 */
function toMemoryModels(insights: readonly Insight[], facts: SymbolFacts): MemoryCardModel[] {
  const models: MemoryCardModel[] = [];
  for (const insight of insights) {
    if (insight.payload.kind !== 'memory') continue;
    const payload = insight.payload;
    models.push({
      id: insight.id,
      title: payload.text,
      kind: payload.memoryKind,
      date: new Date(insight.periodStart).toISOString().slice(0, 10),
      yearsAgo: payload.yearsAgo,
      artworkUrl: payload.trackId ? (facts.artworkByTrack.get(payload.trackId) ?? null) : null,
      trackId: payload.trackId,
      trackName: payload.trackId ? (facts.trackNameById.get(payload.trackId) ?? null) : null,
      artistId: payload.artistId,
      artistName: payload.artistId ? (facts.artistNameById.get(payload.artistId) ?? null) : null,
      status: insight.status,
      userNote: insight.userNote,
    });
  }
  return models;
}

/** I dati dei brani e degli artisti citati dai ricordi. */
interface SymbolFacts {
  readonly artworkByTrack: ReadonlyMap<string, string | null>;
  readonly trackNameById: ReadonlyMap<string, string>;
  readonly artistNameById: ReadonlyMap<string, string>;
}

/**
 * Carica i ricordi.
 *
 * `pageSize` è il numero di elementi per pagina (10, `06§2.11`).
 * `dbName` è iniettabile **solo per i test**, che leggono un database
 * isolato invece di quello dell'app.
 */
export function useMemories(
  pageSize: number = MEMORIES_PAGE_SIZE,
  dbName: string = DB_NAME,
): MemoriesData {
  const [state, setState] = useState<MemoriesData['state']>('loading');
  const [models, setModels] = useState<readonly MemoryCardModel[]>([]);
  const [confidences, setConfidences] = useState<ReadonlyMap<string, number>>(new Map());
  const [visible, setVisible] = useState(pageSize);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const db: LifeSoundtrackDB = await openDb(dbName);
        const insights = await listInsightsByType(db, 'memory');
        const trackIds = new Set<string>();
        for (const insight of insights) {
          if (insight.payload.kind === 'memory' && insight.payload.trackId) {
            trackIds.add(insight.payload.trackId);
          }
        }
        const artworkByTrack = new Map<string, string | null>();
        const trackNameById = new Map<string, string>();
        const artistNameById = new Map<string, string>();
        const artistIds = new Set<string>();
        for (const trackId of trackIds) {
          const track = await db.tracks.get(trackId);
          artworkByTrack.set(trackId, track?.artworkUrl ?? null);
          if (track) {
            trackNameById.set(trackId, track.name);
            artistIds.add(track.artistId);
          }
        }
        for (const insight of insights) {
          if (insight.payload.kind === 'memory' && insight.payload.artistId) {
            artistIds.add(insight.payload.artistId);
          }
        }
        for (const artistId of artistIds) {
          const artist = await db.artists.get(artistId);
          if (artist) artistNameById.set(artistId, artist.name);
        }
        if (cancelled) return;
        const visibleInsights = insights.filter((insight) => insight.status !== 'dismissed');
        setModels(
          toMemoryModels(visibleInsights, {
            artworkByTrack,
            trackNameById,
            artistNameById,
          }),
        );
        setConfidences(new Map(visibleInsights.map((insight) => [insight.id, insight.confidence])));
        setState(visibleInsights.length === 0 ? 'empty' : 'ready');
      } catch {
        if (!cancelled) setState('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [dbName]);

  /** L'ordinamento finale è per `confidence` decrescente. */
  const ordered = useMemo(() => {
    return [...models].sort((a, b) => {
      const byConfidence = (confidences.get(b.id) ?? 0) - (confidences.get(a.id) ?? 0);
      if (byConfidence !== 0) return byConfidence;
      return b.date.localeCompare(a.date);
    });
  }, [models, confidences]);

  const loadMore = useCallback(() => {
    setVisible((current) => current + pageSize);
  }, [pageSize]);

  const dismiss = useCallback(
    (id: string) => {
      setModels((current) => current.filter((model) => model.id !== id));
      void (async () => {
        try {
          const db: LifeSoundtrackDB = await openDb(dbName);
          await setInsightStatus(db, id, 'dismissed');
        } catch {
          // Il ricalcolo dell'elenco riporta lo stato vero: nessun errore bloccante.
        }
      })();
    },
    [dbName],
  );

  const save = useCallback(
    (id: string) => {
      setModels((current) =>
        current.map((model) => (model.id === id ? { ...model, status: 'confirmed' } : model)),
      );
      void (async () => {
        try {
          const db: LifeSoundtrackDB = await openDb(dbName);
          await setInsightStatus(db, id, 'confirmed');
        } catch {
          // Idem: lo stato locale è ottimistico, il database è la verità.
        }
      })();
    },
    [dbName],
  );

  const items = ordered.slice(0, visible);

  /**
   * Scrive la nota libera dell'utente sul ricordo.
   *
   * La nota sta in `Insight.userNote` (D-25.4: nessuna migrazione dello
   * schema). Una nota non vuota **conferma** il ricordo: il testo dell'utente
   * è un verdetto, non un commento.
   */
  const tag = useCallback(
    (id: string, note: string) => {
      const value = note.trim();
      setModels((current) =>
        current.map((model) =>
          model.id === id
            ? { ...model, userNote: value === '' ? null : value, status: 'confirmed' }
            : model,
        ),
      );
      void (async () => {
        try {
          const db: LifeSoundtrackDB = await openDb(dbName);
          const insight = await db.insights.get(id);
          await setInsightUserNote(db, id, {
            userNote: value === '' ? null : value,
            status: value === '' ? (insight?.status ?? 'pending') : 'confirmed',
          });
        } catch {
          // Idem: il database è la verità, il ricalcolo riporta lo stato vero.
        }
      })();
    },
    [dbName],
  );

  return {
    state,
    items,
    hasMore: ordered.length > visible,
    loadMore,
    dismiss,
    save,
    tag,
  };
}
