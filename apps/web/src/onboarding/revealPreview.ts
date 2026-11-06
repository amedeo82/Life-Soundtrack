/**
 * L'**anteprima del reveal** — Story 3.5, spec `docs/26-ONBOARDING-DEMO.md`
 * v1.0 §4.
 *
 * Il reveal post-import non deve mostrare un contatore e un anno cablato a 1:
 * mostra le **prime tre righe** della timeline reale (bucket mensili, la
 * stessa logica di `homeTimelineModel.ts`) e l'anno **calcolato** dallo span
 * reale dei dati.
 *
 * Il modulo è puro dal punto di vista del DB: legge, calcola, restituisce. Il
 * testo lo mette la UI.
 */

import { listInsightsByType, type LifeSoundtrackDB } from '@core/db';
import type { MoodId } from '@core/schema';
import { bucketizeListens, bucketStart, type ListenFact } from '../screens/homeTimelineModel';

/** Una riga di anteprima: un mese della storia reale. */
export interface RevealPreviewRow {
  /** Inizio del bucket (unix ms UTC). */
  readonly start: number;
  /** Etichetta del bucket (pronta per la UI). */
  readonly label: string;
  /** Quanti ascolti nel mese. */
  readonly listens: number;
  /** Quanti minuti ascoltati nel mese. */
  readonly minutes: number;
  /** Il mood del mese, se l'analisi l'ha già calcolato. */
  readonly mood: MoodId | null;
}

/** L'anteprima completa: le righe, l'anno e il numero di eventi. */
export interface RevealPreview {
  readonly rows: readonly RevealPreviewRow[];
  /** Gli anni coperti dalla storia (minimo 1). */
  readonly years: number;
  /** Il numero di eventi. */
  readonly events: number;
}

/** Quante righe mostra il reveal. */
export const REVEAL_PREVIEW_ROWS = 3;

/** Un anno in millisecondi (365,25 giorni: l'anno medio, non quello solare). */
const YEAR_MS = 365.25 * 86_400_000;

/**
 * Costruisce l'anteprima del reveal dal database dell'utente.
 *
 * Se non ci sono dati sufficienti le righe sono vuote: il reveal resta il
 * contatore di oggi e mostra `onboarding.reveal.skip` (26§4).
 */
export async function buildRevealPreview(db: LifeSoundtrackDB): Promise<RevealPreview> {
  const listens = await db.listens.toArray();
  if (listens.length === 0) {
    return { rows: [], years: 1, events: 0 };
  }

  const facts: ListenFact[] = listens.map((listen) => ({
    playedAt: listen.timestamp,
    durationMs: listen.durationMs,
    artistId: listen.trackId,
  }));

  // I bucket mensili: la stessa serie che disegna la Timeline.
  const months = bucketizeListens(facts, 'months');
  const counts = new Map<number, number>();
  for (const listen of listens) {
    const start = bucketStart(listen.timestamp, 'months');
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }

  // Il mood del mese, quando l'analisi lo ha già calcolato.
  const moodByMonth = new Map<number, MoodId>();
  for (const insight of await listInsightsByType(db, 'mood_month')) {
    if (insight.payload.kind !== 'mood') continue;
    moodByMonth.set(bucketStart(insight.periodStart, 'months'), insight.payload.mood);
  }

  const rows: RevealPreviewRow[] = [];
  for (const month of months) {
    if (rows.length >= REVEAL_PREVIEW_ROWS) break;
    const listensInMonth = counts.get(month.start) ?? 0;
    if (listensInMonth === 0) continue;
    rows.push({
      start: month.start,
      label: month.label,
      listens: listensInMonth,
      minutes: month.value,
      mood: moodByMonth.get(month.start) ?? null,
    });
  }

  const timestamps = listens.map((listen) => listen.timestamp);
  const span = Math.max(...timestamps) - Math.min(...timestamps);
  const years = Math.max(1, Math.round(span / YEAR_MS));

  return { rows, years, events: listens.length };
}
