/**
 * Porta i18n del memory engine — 04§7.3.1 (decisione D-A.4).
 *
 * Il `text` di `MemoryPayload` (02§4) è una **stringa già resa**, non una
 * chiave: il ricordo è uno snapshot e la lingua in cui è stato scritto è
 * parte della memoria. Ma la generazione resta internazionalizzata: qui non
 * compare **nessuna** stringa italiana, solo la chiave del template e i suoi
 * parametri.
 *
 * Il core non dipende da i18next (05§9: `@ls/core/analysis` è puro TS e
 * gira nel Web Worker): l'app inietta il resolver tramite `Translator`.
 */

import type { MemoryTemplateParams } from './types';

/** Chiavi dei template dei ricordi — `08-COPY-I18N.md` §2.15 (namespace `insight.*`). */
export const MEMORY_TEMPLATE_KEYS = {
  onThisDay: 'insight.memory.on_this_day',
  firstTime: 'insight.memory.first_time',
  milestoneEvents: 'insight.memory.milestone.events',
  milestoneHours: 'insight.memory.milestone.hours',
  milestoneArtists: 'insight.memory.milestone.artists',
  returning: 'insight.memory.return',
  seasonal: 'insight.memory.seasonal',
} as const;

/** Chiave di un template di ricordo. */
export type MemoryTemplateKey = (typeof MEMORY_TEMPLATE_KEYS)[keyof typeof MEMORY_TEMPLATE_KEYS];

/** Funzione di traduzione fornita dall'app (i18next `t` nel caso dell'app web). */
export type TranslateFn = (key: string, params?: MemoryTemplateParams) => string;

/** Resolver i18n iniettato nel memory engine. */
export interface Translator {
  translate(key: string, params?: MemoryTemplateParams): string;
}

/**
 * Adatta una funzione di traduzione al contratto `Translator`.
 *
 * La funzione riceve i parametri così come sono: i template con plurali
 * (`insight.memory.milestone.events_one` / `_other`) richiedono il parametro
 * `count`, che il resolver deve passare al motore i18n sottostante.
 */
export function createTranslator(translate: TranslateFn): Translator {
  return {
    translate(key, params) {
      return translate(key, params);
    },
  };
}

/**
 * Rende il testo di un ricordo.
 *
 * Fallisce (invece di produrre un testo vuoto) quando il template non
 * esiste: 04§7.5 invoca `text mai vuoto` come invariante, e un ricordo
 * muto è peggio di un errore esplicito in fase di sviluppo.
 */
export function renderMemoryText(
  translator: Translator,
  key: string,
  params: MemoryTemplateParams,
): string {
  const text = translator.translate(key, params).trim();
  if (text.length === 0) {
    throw new Error(`MemoryEngine: missing or empty i18n template "${key}"`);
  }
  return text;
}
