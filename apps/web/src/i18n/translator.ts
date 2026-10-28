import { createTranslator, type Translator } from '@core/analysis';
import type { i18n as I18nInstance } from 'i18next';

/**
 * Adatta l'istanza i18next dell'app al resolver i18n del core — 04§7.3.1
 * (decisione D-A.4).
 *
 * Il memory engine non conosce i18next (05§9: `@ls/core/analysis` è puro TS
 * e gira nel Web Worker): l'app gli inietta il resolver. Il `text` del
 * ricordo è una **stringa resa** — la lingua in cui è stato scritto è parte
 * della memoria — ma il **template** è internazionalizzato e la generazione
 * non scrive mai stringhe italiane inline.
 */
export function createI18nTranslator(instance: I18nInstance): Translator {
  return createTranslator((key, params) => instance.t(key, { ...(params ?? {}) }) as string);
}
