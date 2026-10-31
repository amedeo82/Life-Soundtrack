/**
 * Similarità fra firme musicali — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §5.2
 * (`similarity`).
 *
 * La similarità è la somma di tre componenti (04§5.2):
 *
 * - **cosine** sulla distribuzione dei generi: due epoche che ascoltano la
 *   stessa musica hanno generi nella stessa direzione;
 * - **Jaccard** sugli artisti più ascoltati: la sovrapposizione degli
 *   artisti è la traccia più forte di un cambio di gusto;
 * - **distanza normalizzata** sulle metriche numeriche (valence, energy,
 *   quota notturna, tasso di ripetizione).
 *
 * Il risultato è in `[0, 1]`: sotto `similarityThreshold` c'è un **change
 * point** (D.69.1).
 */

import type { EraSignature } from './signature';
import type { EraWeights } from './types';

/**
 * Cosine similarity fra due distribuzioni.
 *
 * Le distribuzioni sono **sparse**: si somma solo sui generi presenti in
 * entrambe. Una delle due vuota (o con norma nulla) dà 0: non c'è
 * informazione condivisa.
 */
export function cosineSimilarity(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [key, value] of Object.entries(a)) {
    normA += value * value;
    const other = b[key];
    if (other !== undefined) dot += value * other;
  }
  for (const value of Object.values(b)) {
    normB += value * value;
  }
  if (normA <= 0 || normB <= 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Jaccard (intersezione su unione) fra due insiemi di artisti.
 *
 * Due insiemi disgiunti danno 0; un insieme vuoto dà 0 (non c'è
 * informazione condivisa, non "coincidenza perfetta").
 */
export function jaccardSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let intersection = 0;
  for (const value of a) {
    if (setB.has(value)) intersection += 1;
  }
  const union = a.length + b.length - intersection;
  if (union <= 0) return 0;
  return intersection / union;
}

/** La componente numerica della similarità. */
export interface NumericSimilarity {
  /** Valore in `[0, 1]`. */
  readonly value: number;
  /** La dimensione numerica ha dati disponibili? */
  readonly available: boolean;
}

/**
 * Componente numerica: `1 − (Σ|differenze| / 4)` — 04§5.2.
 *
 * Le metriche **senza dato** (valence o energy assenti) sono **escluse** dal
 * calcolo, e il divisore è il numero delle metriche effettivamente
 * disponibili: una finestra senza feature non deve essere trattata come se
 * avesse valence 0 (D.69.5). Se non resta nessuna metrica, la dimensione
 * non è disponibile e i pesi vengono rinormalizzati sulle dimensioni che
 * hanno dato.
 */
export function numericSimilarity(a: EraSignature, b: EraSignature): NumericSimilarity {
  const deltas: number[] = [];
  if (a.avgValence !== null && b.avgValence !== null) {
    deltas.push(Math.abs(a.avgValence - b.avgValence));
  }
  if (a.avgEnergy !== null && b.avgEnergy !== null) {
    deltas.push(Math.abs(a.avgEnergy - b.avgEnergy));
  }
  deltas.push(Math.abs(a.nightShare - b.nightShare));
  deltas.push(Math.abs(a.repeatRate - b.repeatRate));
  if (deltas.length === 0) {
    return { value: 0, available: false };
  }
  const sum = deltas.reduce((total, delta) => total + delta, 0);
  const value = 1 - sum / deltas.length;
  return { value: Math.min(1, Math.max(0, value)), available: true };
}

/**
 * Similarità fra due firme — 04§5.2.
 *
 * `0.5 * genreSim + 0.3 * artistSim + 0.2 * numericSim`, con i pesi
 * dichiarati in 04§5.3 (`weights`). I pesi sono **rinormalizzati** sulla
 * somma di quelli effettivamente usati: con i default (0.5 + 0.3 + 0.2 = 1)
 * la rinormalizzazione è un'identità, e la formula coincide con quella
 * della spec.
 */
export function signatureSimilarity(a: EraSignature, b: EraSignature, weights: EraWeights): number {
  const genreSim = cosineSimilarity(a.genreDistribution, b.genreDistribution);
  const artistSim = jaccardSimilarity(a.topArtistIds, b.topArtistIds);
  const numeric = numericSimilarity(a, b);

  let used = weights.genre + weights.artist;
  let total = weights.genre * genreSim + weights.artist * artistSim;
  if (numeric.available) {
    used += weights.numeric;
    total += weights.numeric * numeric.value;
  }
  if (used <= 0) return 0;
  return total / used;
}
