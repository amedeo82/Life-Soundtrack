/**
 * Porta i18n dell'era detector — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §5.2
 * (`generateEraLabel`).
 *
 * Il `label` di `EraPayload` (02§4) è una **stringa già resa**, non una
 * chiave: l'era è uno snapshot e la lingua in cui è stata scritta è parte
 * della lettura. Ma la generazione resta internazionalizzata: qui non
 * compare **nessuna** stringa italiana, solo la chiave del template e i suoi
 * parametri (D-A.4).
 *
 * I template sono dichiarati in `08-COPY-I18N.md` §2.15 (namespace
 * `insight.*`).
 */

import type { MoodId } from '../../schema';
import type { Translator } from '../i18n';

/** Chiavi dei template dell'era — `08-COPY-I18N.md` §2.15 (namespace `insight.*`). */
export const ERA_TEMPLATE_KEYS = {
  /** Template dell'etichetta: "Era {mood} {genre}". */
  label: 'insight.era.label',
  /** Nomi dei sei mood, usati nell'etichetta. */
  mood: {
    sad: 'insight.era.mood.sad',
    angry: 'insight.era.mood.angry',
    neutral: 'insight.era.mood.neutral',
    calm: 'insight.era.mood.calm',
    happy: 'insight.era.mood.happy',
    excited: 'insight.era.mood.excited',
  },
} as const;

/**
 * Rende l'etichetta di un'era — 04§5.2 (`generateEraLabel`).
 *
 * Il nome del mood è **reso prima** di essere interpolato: il template
 * dell'etichetta contiene un segnaposto, non una parola italiana.
 *
 * Il genere è il **dato** (viene dai metadati del brano), non della copia:
 * non viene tradotto.
 *
 * @param translator - resolver i18n iniettato dall'app.
 * @param mood - mood dominante dell'era (04§3.2).
 * @param genre - genere più ascoltato dell'era (stringa vuota se assente).
 * @returns l'etichetta resa, mai vuota.
 */
export function renderEraLabel(translator: Translator, mood: MoodId, genre: string): string {
  const moodName = translator.translate(ERA_TEMPLATE_KEYS.mood[mood]).trim();
  if (moodName.length === 0) {
    throw new Error(`EraEngine: missing or empty i18n template "${ERA_TEMPLATE_KEYS.mood[mood]}"`);
  }
  const label = translator.translate(ERA_TEMPLATE_KEYS.label, { mood: moodName, genre }).trim();
  if (label.length === 0) {
    throw new Error(`EraEngine: missing or empty i18n template "${ERA_TEMPLATE_KEYS.label}"`);
  }
  return label;
}
