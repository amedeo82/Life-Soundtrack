/**
 * Formattazione numeri/date localizzata (08-COPY-I18N §5).
 * Usa Intl (ICU) nativo: nessuna dipendenza aggiuntiva.
 */

import type { AppLanguage } from './detector';

export type DateFormatVariant = 'short' | 'long' | 'time';

/**
 * Formatta un numero con i separatori della lingua: `1.000` (it) / `1,000` (en),
 * decimali `0,5` (it) / `0.5` (en).
 * `useGrouping: true` forza il separatore delle migliaia (08§5) anche con
 * CLDR ≥ 46, che per l'italiano non raggruppa sotto 10.000 (il boolean è
 * interpretato come `always` dalle engine Intl.NumberFormat v3).
 */
export function formatNumber(value: number, lang: AppLanguage): string {
  return new Intl.NumberFormat(lang, { useGrouping: true }).format(value);
}

/**
 * Formatta una data secondo 08§5:
 * - `short`: `15 gen 2024` (it) / `Jan 15, 2024` (en)
 * - `long`: `15 gennaio 2024` (it) / `January 15, 2024` (en)
 * - `time`: `14:30` (it, 24h) / `2:30 PM` (en, 12h)
 */
export function formatDate(date: Date, lang: AppLanguage, variant: DateFormatVariant): string {
  switch (variant) {
    case 'short':
      return new Intl.DateTimeFormat(lang, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
    case 'long':
      return new Intl.DateTimeFormat(lang, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    case 'time':
      return new Intl.DateTimeFormat(lang, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: lang === 'en',
      }).format(date);
  }
}
