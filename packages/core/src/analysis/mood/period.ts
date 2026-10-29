/**
 * Confini dei periodi del mood tracker — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §3.3.
 *
 * Il mood tracker aggrega gli ascolti per **giorno, settimana e mese**. I
 * confini sono UTC, coerentemente con il resto del layer di analisi
 * (`analysis/datetime.ts`): il contratto di `04§3` non contiene un fuso
 * utente (`userTimezone` compare solo nel pattern analyzer, 04§4.2).
 *
 * L'istante che decide il periodo di un ascolto è il suo **inizio**
 * (`startedAt`, o la fine ascolto quando `startedAt` è `null`): è la stessa
 * regola del memory engine, così i due moduli concordano su quale giorno è
 * un ascolto.
 */

import { DAY_MS, startOfUtcDay, utcDayKey } from '../datetime';
import type { MoodConfig, MoodPeriod } from './types';

/** Confini di un periodo aggregato. */
export interface MoodPeriodBounds {
  /** Periodo aggregato. */
  readonly period: MoodPeriod;
  /** Inizio del periodo (unix ms UTC, incluso). */
  readonly start: number;
  /** Fine del periodo (unix ms UTC, inclusiva). */
  readonly end: number;
  /** Chiave stabile del periodo ('YYYY-MM-DD', 'YYYY-MM'). */
  readonly key: string;
}

/** Inizio della settimana UTC che contiene l'istante (default: lunedì). */
export function startOfUtcWeek(ms: number, weekStartDay = 1): number {
  const dayStart = startOfUtcDay(ms);
  const dayOfWeek = new Date(dayStart).getUTCDay();
  const back = (dayOfWeek - weekStartDay + 7) % 7;
  return dayStart - back * DAY_MS;
}

/** Inizio del mese UTC che contiene l'istante. */
export function startOfUtcMonth(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/** Fine del mese UTC che contiene l'istante (inclusiva). */
export function endOfUtcMonth(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - 1;
}

/**
 * Confini del periodo che contiene l'istante.
 *
 * @param period - periodo aggregato.
 * @param ms - istante di riferimento (unix ms UTC).
 * @param config - parametri correnti (serve `weekStartDay`).
 */
export function periodBounds(period: MoodPeriod, ms: number, config: MoodConfig): MoodPeriodBounds {
  switch (period) {
    case 'day': {
      const start = startOfUtcDay(ms);
      return { period, start, end: start + DAY_MS - 1, key: utcDayKey(start) };
    }
    case 'week': {
      const start = startOfUtcWeek(ms, config.weekStartDay);
      return { period, start, end: start + 7 * DAY_MS - 1, key: utcDayKey(start) };
    }
    case 'month': {
      const start = startOfUtcMonth(ms);
      const date = new Date(start);
      const key = `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
      return { period, start, end: endOfUtcMonth(ms), key };
    }
  }
}

/**
 * Raggruppa elementi per periodo.
 *
 * Il raggruppamento è per **chiave di periodo**: gli elementi dello stesso
 * periodo (giorno, settimana, mese) finiscono nello stesso gruppo, in
 * qualunque ordine arrivino. I gruppi sono restituiti in **ordine di chiave**:
 * a parità di elementi il risultato non dipende dall'ordine di ingresso.
 *
 * @param items - elementi da raggruppare.
 * @param timeOf - istante che decide il periodo di un elemento.
 * @param period - periodo aggregato.
 * @param config - parametri correnti.
 * @returns i gruppi, per chiave di periodo.
 */
export function groupByPeriod<T>(
  items: readonly T[],
  timeOf: (item: T) => number,
  period: MoodPeriod,
  config: MoodConfig,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = periodBounds(period, timeOf(item), config).key;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return new Map([...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
