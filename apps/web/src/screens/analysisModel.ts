/**
 * Modello puro di Analisi (⑩) — Story 3.3, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §7 e `docs/07-UI-SPEC.md` §2.8-§2.9.
 *
 * Il modello fa due cose, entrambe **pure**:
 *
 * 1. aggrega gli insight `mood_day` **per mese** (`25§7`: i punti del
 *    quadrante sono i periodi mensili con `avgValence`/`avgEnergy`);
 * 2. rende quei periodi dei **punti del quadrante**, con la dimensione
 *    proporzionale agli ascolti e il colore del mood dominante.
 *
 * Il testo degli insight **non** nasce qui: `EventPayload.description` e
 * `MemoryPayload.text` sono **già rese** dal core (D-A.4), e la UI non deve
 * re-renderizzare i template.
 */

import type { MoodId } from '@core/schema';

/** Il colore di ogni mood (i token del design system, `15-DESIGN-SYSTEM.md`). */
export const MOOD_COLORS: Readonly<Record<MoodId, string>> = {
  sad: 'var(--ls-mood-sad)',
  angry: 'var(--ls-mood-angry)',
  neutral: 'var(--ls-mood-neutral)',
  calm: 'var(--ls-mood-calm)',
  happy: 'var(--ls-mood-happy)',
  excited: 'var(--ls-mood-excited)',
};

/** Un fatto di mood, come arriva dal database. */
export interface MoodInsightFact {
  /** Id dell'insight. */
  readonly id: string;
  /** Inizio del periodo (unix ms UTC). */
  readonly periodStart: number;
  /** Fine del periodo (unix ms UTC). */
  readonly periodEnd: number;
  /** Il mood dominante del periodo. */
  readonly mood: MoodId;
  /** La positività media (0..1). */
  readonly valence: number;
  /** L'intensità media (0..1). */
  readonly energy: number;
  /** Quanti ascolti copre il periodo. */
  readonly eventCount: number;
}

/** Un periodo aggregato (un mese della storia). */
export interface PeriodPoint {
  /** Id deterministico del periodo (`YYYY-MM`). */
  readonly id: string;
  /** L'etichetta del periodo (`YYYY-MM`). */
  readonly label: string;
  /** Inizio del periodo (unix ms UTC). */
  readonly at: number;
  /** La positività media del mese. */
  readonly valence: number;
  /** L'intensità media del mese. */
  readonly energy: number;
  /** Quanti ascolti copre il mese. */
  readonly eventCount: number;
  /** Il mood dominante del mese. */
  readonly mood: MoodId;
}

/** Un punto del QuadrantChart. */
export interface QuadrantPoint {
  /** Id del punto (il periodo). */
  readonly id: string;
  /** La x del punto: la valence (0..1). */
  readonly x: number;
  /** La y del punto: l'energy (0..1). */
  readonly y: number;
  /** Il raggio del punto in pixel (proporzionale agli ascolti). */
  readonly size: number;
  /** Il colore del punto (il mood dominante). */
  readonly color: string;
  /** L'etichetta del punto (`YYYY-MM`). */
  readonly label: string;
  /** L'`aria-label` del punto, già pronta (la schermata la costruisce). */
  readonly ariaLabel: string;
  /** Inizio del periodo (unix ms UTC): serve al deep-link alla Timeline. */
  readonly at: number;
}

/** La chiave del mese di un timestamp (`YYYY-MM`, UTC). */
export function monthKey(at: number): string {
  return new Date(at).toISOString().slice(0, 7);
}

/**
 * Aggrega i fatti di mood **per mese**.
 *
 * La media è **pesata** sugli ascolti: un mese con 300 ascolti conta più di
 * un mese con 3, e la valence media del mese non può essere la media delle
 * medie giornaliere. Il mood del mese è quello con più ascolti.
 */
export function aggregateByMonth(facts: readonly MoodInsightFact[]): PeriodPoint[] {
  interface Accumulator {
    key: string;
    at: number;
    valenceSum: number;
    energySum: number;
    weight: number;
    eventCount: number;
    moodWeights: Map<MoodId, number>;
  }

  const buckets = new Map<string, Accumulator>();
  for (const fact of facts) {
    const key = monthKey(fact.periodStart);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        at: fact.periodStart,
        valenceSum: 0,
        energySum: 0,
        weight: 0,
        eventCount: 0,
        moodWeights: new Map<MoodId, number>(),
      };
      buckets.set(key, bucket);
    }
    const weight = Math.max(1, fact.eventCount);
    bucket.valenceSum += fact.valence * weight;
    bucket.energySum += fact.energy * weight;
    bucket.weight += weight;
    bucket.eventCount += fact.eventCount;
    bucket.moodWeights.set(fact.mood, (bucket.moodWeights.get(fact.mood) ?? 0) + weight);
    if (fact.periodStart < bucket.at) bucket.at = fact.periodStart;
  }

  const points: PeriodPoint[] = [];
  for (const bucket of buckets.values()) {
    let mood: MoodId = 'neutral';
    let best = -1;
    for (const [candidate, weight] of bucket.moodWeights) {
      if (weight > best) {
        best = weight;
        mood = candidate;
      }
    }
    points.push({
      id: bucket.key,
      label: bucket.key,
      at: bucket.at,
      valence: bucket.weight === 0 ? 0 : bucket.valenceSum / bucket.weight,
      energy: bucket.weight === 0 ? 0 : bucket.energySum / bucket.weight,
      eventCount: bucket.eventCount,
      mood,
    });
  }

  return points.sort((a, b) => a.at - b.at);
}

/**
 * Il mood dominante dell'intera storia.
 *
 * Serve alla **frase in prosa** che accompagna il grafico (`insight.mood.*`):
 * un grafico senza lettura è l'ennesimo cruscotto (`22§8`).
 */
export function dominantMood(facts: readonly MoodInsightFact[]): MoodId | null {
  const weights = new Map<MoodId, number>();
  for (const fact of facts) {
    const weight = Math.max(1, fact.eventCount);
    weights.set(fact.mood, (weights.get(fact.mood) ?? 0) + weight);
  }
  let mood: MoodId | null = null;
  let best = -1;
  for (const [candidate, weight] of weights) {
    if (weight > best) {
      best = weight;
      mood = candidate;
    }
  }
  return mood;
}

/** Il raggio minimo e massimo di un punto (in pixel). */
export const POINT_MIN_SIZE = 4;
export const POINT_MAX_SIZE = 14;

/**
 * I punti del QuadrantChart.
 *
 * La dimensione è proporzionale agli ascolti del periodo: un mese con molta
 * musica è un punto grande. Il raggio è calcolato sul massimo della serie,
 * non su un valore assoluto: altrimenti una storia di 10 ascolti e una di
 * 10.000 avrebbero la stessa scala.
 */
export function toQuadrantPoints(
  points: readonly PeriodPoint[],
  ariaLabelFor: (point: PeriodPoint) => string,
): QuadrantPoint[] {
  const maxEvents = points.reduce((max, point) => Math.max(max, point.eventCount), 0);
  return points.map((point) => {
    const ratio = maxEvents === 0 ? 0 : point.eventCount / maxEvents;
    return {
      id: point.id,
      x: point.valence,
      y: point.energy,
      size: POINT_MIN_SIZE + ratio * (POINT_MAX_SIZE - POINT_MIN_SIZE),
      color: MOOD_COLORS[point.mood],
      label: point.label,
      ariaLabel: ariaLabelFor(point),
      at: point.at,
    };
  });
}
