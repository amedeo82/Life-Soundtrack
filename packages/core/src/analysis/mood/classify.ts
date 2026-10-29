/**
 * Classificazione valence/energy → mood — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §3.2-§3.3.
 *
 * La mappa dei sei quadranti è **vincolante**: `04` è APPROVED e la sua
 * tabella (valence × energy) è l'unica fonte. Il codice ne segue l'ordine di
 * verifica del pseudocodice di 04§3.3, che è anche l'ordine della tabella:
 * la fascia neutra si controlla per prima e sovrascrive le altre quattro.
 */

import type { MoodId } from '../../schema';
import type { MoodConfig, WeightedValue } from './types';

/**
 * Classifica una coppia (valence, energy) nel mood dominante.
 *
 * - la fascia neutra è `[valenceThreshold ± neutralBand]` su **entrambe** le
 *   coordinate: è una fascia, non un punto, e serve a evitare il flip-flop
 *   fra `sad` e `calm` (04§3.2);
 * - `excited` richiede valence alta **e** energy molto alta;
 * - `happy` è la fascia di energy alta ma non altissima.
 *
 * @param valence - valence media ponderata, in [0, 1].
 * @param energy - energy media ponderata, in [0, 1].
 * @param config - parametri correnti del motore.
 * @returns uno dei sei mood di `MOOD_IDS`.
 */
export function classifyMood(valence: number, energy: number, config: MoodConfig): MoodId {
  const neutralLow = config.valenceThreshold - config.neutralBand;
  const neutralHigh = config.valenceThreshold + config.neutralBand;
  const energyLow = config.energyThreshold - config.neutralBand;
  const energyHigh = config.energyThreshold + config.neutralBand;

  if (
    valence >= neutralLow &&
    valence <= neutralHigh &&
    energy >= energyLow &&
    energy <= energyHigh
  ) {
    return 'neutral';
  }
  if (valence >= config.valenceThreshold && energy >= config.excitedEnergyThreshold) {
    return 'excited';
  }
  if (valence >= config.valenceThreshold && energy >= config.energyThreshold) {
    return 'happy';
  }
  if (valence >= config.valenceThreshold) {
    return 'calm';
  }
  if (energy >= config.energyThreshold) {
    return 'angry';
  }
  return 'sad';
}

/**
 * Media ponderata — 04§3.3 (`weightedAverage`).
 *
 * Il peso di un ascolto è `durationMs / 240000` (durata / 4 minuti): un
 * brano ascoltato per intero pesa 1, uno ascoltato per metà pesa 0,5.
 *
 * @returns la media, oppure `null` se il peso totale è nullo (nessun ascolto
 * con durata): la divisione per zero produrrebbe `NaN`, e un insight con
 * `NaN` non rispetterebbe l'invariante `avgValence ∈ [0, 1]` (04§3.6).
 */
export function weightedAverage(items: readonly WeightedValue[]): number | null {
  let sum = 0;
  let weightSum = 0;
  for (const item of items) {
    sum += item.value * item.weight;
    weightSum += item.weight;
  }
  if (weightSum <= 0) return null;
  return sum / weightSum;
}
