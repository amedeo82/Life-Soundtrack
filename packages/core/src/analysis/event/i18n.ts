/**
 * Porta i18n dell'event detector — `04-ANALYSIS-ALGORITHMS.md` v1.2 🟢 §6.3
 * (`generateDescription`).
 *
 * La `description` di `EventPayload` (02§4) è una **stringa già resa**, non
 * una chiave: l'evento è uno snapshot e la lingua in cui è stato scritto è
 * parte della lettura. Ma la generazione resta internazionalizzata: qui non
 * compare **nessuna** stringa italiana, solo la chiave del template e i suoi
 * parametri (D-A.4).
 *
 * I template sono dichiarati in `08-COPY-I18N.md` §2.15 (namespace
 * `insight.*`).
 */

import type { EventKind } from '../../schema';
import type { TranslateParams, Translator } from '../i18n';

/** Chiavi dei template dell'evento — `08-COPY-I18N.md` §2.15. */
export const EVENT_TEMPLATE_KEYS = {
  spike_artist: 'insight.event.spike_artist',
  spike_genre: 'insight.event.spike_genre',
  valence_drop: 'insight.event.valence_drop',
  valence_rise: 'insight.event.valence_rise',
  volume_spike: 'insight.event.volume_spike',
  volume_drop: 'insight.event.volume_drop',
  exploration: 'insight.event.exploration',
  silence: 'insight.event.silence',
} as const;

/**
 * I parametri interpolati nei template dell'evento.
 *
 * Sono gli stessi del memory engine (`MemoryTemplateParams`): un record di
 * valori stringa o numerici. Le chiavi usate dai template dell'evento sono
 * `artist` (il nome dell'artista che domina) e `genre` (il genere che
 * domina): il genere è **dato**, non copia, e non viene tradotto.
 */
export type EventTemplateParams = TranslateParams;

/**
 * Rende la descrizione di un evento — 04§6.3 (`generateDescription`).
 *
 * Il template è **reso** dal resolver iniettato dall'app: il core non
 * contiene stringhe italiane (D-A.4).
 *
 * @param translator - resolver i18n iniettato dall'app.
 * @param eventType - tipo di evento (02§4).
 * @param params - i dati del template (artista, genere).
 * @returns la descrizione resa, mai vuota.
 */
export function renderEventDescription(
  translator: Translator,
  eventType: EventKind,
  params: EventTemplateParams = {},
): string {
  const key = EVENT_TEMPLATE_KEYS[eventType];
  const text = translator.translate(key, params).trim();
  if (text.length === 0) {
    throw new Error(`EventEngine: missing or empty i18n template "${key}"`);
  }
  return text;
}

/**
 * Il suffisso numerico del detector a z-score — 04§6.3.
 *
 * Il suffisso è **linguisticamente neutro** (il nome della statistica e un
 * numero): è il dato che rende l'evento verificabile, e non un-commento.
 */
export function formatZScoreSuffix(z: number): string {
  return `(z-score: ${z.toFixed(2)})`;
}

/**
 * Il suffisso numerico del detector a quota — 04§6.2.
 *
 * Anche questo è neutro: il rapporto fra la quota nella finestra e la quota
 * in baseline.
 */
export function formatQuotaSuffix(ratio: number): string {
  return `(×${ratio.toFixed(2)})`;
}
