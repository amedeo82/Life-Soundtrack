/**
 * Contratto con le audio features — `21-AUDIO-FEATURES.md` v1.0 🟢 §12.
 *
 * La spec delle audio features definisce la semantica di
 * `getAudioFeatures(trackId)` **senza modificare `04`**:
 *
 * 1. restituisce la riga della tabella `features` per quel brano, **filtrata
 *    per sorgente**: `source ∈ {essentia, acousticbrainz, manual}`;
 * 2. le feature `heuristic` **non** sono visibili al layer di analisi
 *    (D-A.4): il mood tracker non deve costruire un umore su una stima;
 * 3. se la riga esiste ma è `heuristic`, per l'analisi è come se **non
 *    esistesse**.
 *
 * La regola che ne deriva, in una riga: **il mood tracker vede solo le
 * feature misurate o manuali**.
 *
 * Il filtro vive qui, non nel motore: è un contratto fra due moduli (la
 * pipeline di arricchimento e il layer di analisi) e deve valere per qualunque
 * generatore di insight che legga le feature, non solo per il mood tracker.
 */

import type { AudioFeatures } from '../../schema';

/** Sorgenti accettate dal layer di analisi — 21§12 (punto 1). */
export const ANALYSIS_FEATURE_SOURCES = ['essentia', 'acousticbrainz', 'manual'] as const;

/** Una sorgente accettata dal layer di analisi. */
export type AnalysisFeatureSource = (typeof ANALYSIS_FEATURE_SOURCES)[number];

/**
 * La sorgente della feature è accettata dal layer di analisi?
 *
 * `heuristic` è una **stima**: la D-AF.4 esclude che l'analisi costruisca
 * letture di umore su una stima (la stima serve alla UI, che la dichiara
 * come tale).
 */
export function isAnalysisFeatureSource(
  source: AudioFeatures['source'],
): source is AnalysisFeatureSource {
  return (ANALYSIS_FEATURE_SOURCES as readonly string[]).includes(source);
}

/**
 * Indice delle feature utilizzabili dall'analisi, per `trackId`.
 *
 * Le righe con sorgente non accettata sono **ignorate**: per l'analisi non
 * esistono (21§12, punto 3).
 *
 * @param features - feature da indicizzare.
 * @returns la mappa `trackId → feature`, con le sole sorgenti accettate.
 */
export function buildFeatureIndex(
  features: readonly AudioFeatures[],
): ReadonlyMap<string, AudioFeatures> {
  const index = new Map<string, AudioFeatures>();
  for (const feature of features) {
    if (!isAnalysisFeatureSource(feature.source)) continue;
    index.set(feature.trackId, feature);
  }
  return index;
}
