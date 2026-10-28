/**
 * Ranking dei ricordi — 04§7.4.
 *
 *     score = baseScore(memoryKind) × relevance × recency
 *
 * - `baseScore`: l'importanza del tipo di ricordo (`on_this_day` 10, `milestone`
 *   9, `first_time` 8, `return` 7, `seasonal` 6);
 * - `relevance`: `trackCount / medianTrackCount` — quanto è rappresentativo il
 *   brano (o l'artista, o il genere) rispetto agli altri ricordi dello stesso
 *   giorno;
 * - `recency`: `exp(-daysAgo / 365)` — l'attenuazione per la distanza.
 *
 * Il feed mostra i top N score per giorno (04§7.4).
 */

import type { MemoryKind } from '../../schema';

/** Punteggio base per tipo di ricordo — 04§7.4. */
export const MEMORY_BASE_SCORES: Readonly<Record<MemoryKind, number>> = {
  on_this_day: 10,
  first_time: 8,
  milestone: 9,
  return: 7,
  seasonal: 6,
};

/** Mediana di una serie di numeri (0 se la serie è vuota). */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }
  const lower = sorted[middle - 1] ?? 0;
  const upper = sorted[middle] ?? 0;
  return (lower + upper) / 2;
}

/**
 * Rilevanza: `trackCount / medianTrackCount`.
 *
 * Se la mediana è 0 (nessun ricordo con ascolti associati) la rilevanza vale
 * 1: il ricordo non è penalizzato da un dato assente.
 */
export function computeRelevance(trackCount: number, medianTrackCount: number): number {
  if (medianTrackCount <= 0) return 1;
  return trackCount / medianTrackCount;
}

/** Attuenuazione per distanza: `exp(-daysAgo / 365)`. */
export function computeRecency(daysAgo: number): number {
  return Math.exp(-Math.max(0, daysAgo) / 365);
}

/** Score complessivo di un ricordo — 04§7.4. */
export function computeMemoryScore(
  memoryKind: MemoryKind,
  trackCount: number,
  medianTrackCount: number,
  daysAgo: number,
): number {
  const base = MEMORY_BASE_SCORES[memoryKind];
  return base * computeRelevance(trackCount, medianTrackCount) * computeRecency(daysAgo);
}

/** Vincola un valore nell'intervallo [0, 1]. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
