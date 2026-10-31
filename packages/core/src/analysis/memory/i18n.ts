/**
 * Porta i18n del memory engine — 04§7.3.1 (decisione D-A.4).
 *
 * Il `text` di `MemoryPayload` (02§4) è una **stringa già resa**, non una
 * chiave: il ricordo è uno snapshot e la lingua in cui è stato scritto è
 * parte della memoria. Ma la generazione resta internazionalizzata: qui non
 * compare **nessuna** stringa italiana, solo la chiave del template e i suoi
 * parametri.
 *
 * Il contratto del resolver è definito in `analysis/i18n.ts` (è condiviso
 * con l'era detector): questo modulo ne riusa le esportazioni perché
 * l'API pubblica del memory engine non cambia.
 */

import type { MemoryTemplateParams } from './types';
import type { Translator } from '../i18n';

export { createTranslator } from '../i18n';
export type { TranslateFn, Translator } from '../i18n';

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
