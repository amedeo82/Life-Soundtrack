/**
 * Utilità temporali del memory engine — confine UTC.
 *
 * Il memory engine lavora su confini **UTC**, coerentemente con il campo
 * `ListenEvent.day` ('YYYY-MM-DD' UTC derivato dal timestamp, 02§3.2) e con
 * l'assenza di un fuso utente nel contratto di 04§7 (il `userTimezone`
 * compare solo nel pattern analyzer, 04§4.2).
 *
 * Il vocabolario temporale condiviso vive in `analysis/datetime.ts`: questo
 * modulo lo riusa e aggiunge l'unico helper specifico del memory engine (il
 * nome localizzato del mese, usato dal ricordo `seasonal`).
 */

export {
  DAY_MS,
  endOfUtcDay,
  eventTime,
  HOUR_MS,
  isSameUtcDate,
  isSameUtcMonthDay,
  startOfUtcDay,
  utcDateParts,
  utcDayKey,
  utcMonth,
  utcYear,
  type UtcDateParts,
} from '../datetime';

/**
 * Nome del mese localizzato (`marzo`, `March`).
 *
 * Il mese è un **dato localizzato**, non una stringa inline: entra nel
 * template `insight.memory.seasonal` come parametro `{month}` (04§7.3.1).
 */
export function localizedMonthName(month: number, locale: string): string {
  const date = new Date(Date.UTC(2000, month - 1, 15));
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date);
}
