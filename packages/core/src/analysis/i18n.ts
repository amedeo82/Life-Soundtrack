/**
 * Contratto i18n del layer di analisi — 04§7.3.1 (decisione D-A.4).
 *
 * Il layer di analisi **non** scrive mai stringhe italiane inline: chi
 * implementa chiama il resolver i18n con la chiave del template e i suoi
 * parametri. Il core non dipende da i18next (05§9: `@ls/core/analysis` è
 * puro TS e gira nel Web Worker): l'app inietta il resolver tramite
 * `Translator`.
 *
 * Il contratto vive qui, e non dentro un generatore, perché **due**
 * generatori producono testo reso: il memory engine (`insight.memory.*`) e
 * l'era detector (`insight.era.*`). Un contratto per generatore avrebbe
 * due definizioni dello stesso resolver — e l'app dovrebbe iniettarne due.
 */

/** Parametri interpolati in un template i18n — valori stringa o numerici. */
export type TranslateParams = Record<string, string | number>;

/** Funzione di traduzione fornita dall'app (i18next `t` nel caso dell'app web). */
export type TranslateFn = (key: string, params?: TranslateParams) => string;

/** Resolver i18n iniettato nel layer di analisi. */
export interface Translator {
  translate(key: string, params?: TranslateParams): string;
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
