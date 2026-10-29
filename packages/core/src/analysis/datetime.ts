/**
 * Utilità temporali condivise dal layer di analisi — confine UTC.
 *
 * Il layer di analisi lavora su confini **UTC**, coerentemente con il campo
 * `ListenEvent.day` ('YYYY-MM-DD' UTC derivato dal timestamp, 02§3.2) e con
 * l'assenza di un fuso utente nel contratto di 04§7 (il `userTimezone`
 * compare solo nel pattern analyzer, 04§4.2).
 *
 * Queste funzioni sono il vocabolario temporale del package: le usano sia il
 * memory engine (04§7) sia il mood tracker (04§3).
 */

import type { ListenEvent } from '../schema';

/** Un giorno in millisecondi. */
export const DAY_MS = 86_400_000;

/** Un'ora in millisecondi. */
export const HOUR_MS = 3_600_000;

/** Anno, mese (1..12) e giorno di un istante, in UTC. */
export interface UtcDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Scomporre un istante in anno/mese/giorno UTC. */
export function utcDateParts(ms: number): UtcDateParts {
  const date = new Date(ms);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** Inizio del giorno UTC che contiene l'istante (unix ms). */
export function startOfUtcDay(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Fine del giorno UTC che contiene l'istante (unix ms, inclusivo). */
export function endOfUtcDay(ms: number): number {
  return startOfUtcDay(ms) + DAY_MS - 1;
}

/** Chiave del giorno UTC, 'YYYY-MM-DD' (come `ListenEvent.day`). */
export function utcDayKey(ms: number): string {
  const { year, month, day } = utcDateParts(ms);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Due istanti cadono nello stesso giorno UTC? */
export function isSameUtcDate(a: number, b: number): boolean {
  const pa = utcDateParts(a);
  const pb = utcDateParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

/** Due istanti cadono nello stesso mese e giorno (anno ignorato)? */
export function isSameUtcMonthDay(a: number, b: number): boolean {
  const pa = utcDateParts(a);
  const pb = utcDateParts(b);
  return pa.month === pb.month && pa.day === pb.day;
}

/** Mese (1..12) di un istante, in UTC. */
export function utcMonth(ms: number): number {
  return new Date(ms).getUTCMonth() + 1;
}

/** Anno di un istante, in UTC. */
export function utcYear(ms: number): number {
  return new Date(ms).getUTCFullYear();
}

/**
 * Istante di inizio di un ascolto.
 *
 * `startedAt` può essere `null` (02§3.2): in quel caso si usa la fine
 * ascolto (`timestamp`), che è sempre presente.
 */
export function eventTime(event: ListenEvent): number {
  return event.startedAt ?? event.timestamp;
}
