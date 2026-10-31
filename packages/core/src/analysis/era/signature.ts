/**
 * Firme musicali — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §5.2
 * (`computeSignature`).
 *
 * Una **firma** è il ritratto di un insieme di ascolti: la distribuzione dei
 * generi, gli artisti più ascoltati, la valence e l'energy medie, la quota
 * notturna e il tasso di ripetizione. Due firme simili indicano che il
 * gusto non è cambiato; due firme diverse segnano un **change point** (D.69.1).
 *
 * La firma è **pura**: riceve gli ascolti, i brani e le feature, non legge il
 * DB (`05§9`: il layer di analisi gira nel Web Worker).
 */

import type { AudioFeatures, ListenEvent, Track } from '../../schema';
import { eventTime } from '../datetime';
import { MOOD_WEIGHT_BASE_MS, weightedAverage } from '../mood';
import { ERA_NIGHT_HOURS, ERA_TOP_ARTISTS } from './types';

/**
 * Ritratto musicale di un insieme di ascolti — 04§5.2.
 *
 * `avgValence` e `avgEnergy` sono **nullable**: una finestra senza feature
 * misurate o manuali non ha valori da riportare, e inventare uno zero
 * sarebbe il «segnale inventato» che D-A.1 esclude. Le metriche che non
 * dipendono dalle feature (generi, artisti, quota notturna, ripetizioni)
 * sono sempre disponibili.
 */
export interface EraSignature {
  /** Quota di ascolti per genere — `sum ≈ 1.0` (04§5.5). */
  readonly genreDistribution: Readonly<Record<string, number>>;
  /** Artisti più ascoltati, al massimo `ERA_TOP_ARTISTS` — 04§5.2. */
  readonly topArtistIds: readonly string[];
  /** Valence media ponderata — `null` senza feature utilizzabili. */
  readonly avgValence: number | null;
  /** Energy media ponderata — `null` senza feature utilizzabili. */
  readonly avgEnergy: number | null;
  /** Quota di ascolti notturni (00:00-05:59 UTC) — 02§4, 04§4.3. */
  readonly nightShare: number;
  /** Quota di ascolti di brani già ascoltati — 02§4, 04§5.2. */
  readonly repeatRate: number;
  /** Quota di ascolti con feature utilizzabili (misurate o manuali). */
  readonly featureCoverage: number;
}

/**
 * Calcola la firma di un insieme di ascolti — 04§5.2 (`computeSignature`).
 *
 * Le scelte che la spec non explicita (D.69.3) sono:
 *
 * - la **distribuzione dei generi** è una quota di **ascolti**, non di
 *   minuti: ogni ascolto contribuisce ai generi del suo brano (un brano con
 *   due generi dà metà a ciascuno), e la somma è normalizzata a 1 sugli
 *   ascolti che hanno almeno un genere (04§5.5);
 * - il **tasso di ripetizione** è la quota di ascolti il cui brano era già
 *   stato ascoltato **all'interno dello stesso insieme**: `1 − (brani
 *   distinti / ascolti)`;
 * - la **quota notturna** è calcolata in **UTC** (D.69.4): il payload
 *   dell'era non trasporta un `userTimezone` (a differenza di quello del
 *   pattern analyzer, 02§4), e il layer di analisi lavora su confini UTC
 *   (`analysis/datetime.ts`).
 *
 * @param events - ascolti del segmento, in ordine cronologico.
 * @param tracks - indice dei brani per `trackId`.
 * @param features - indice delle feature utilizzabili per `trackId` (21§12).
 */
export function computeSignature(
  events: readonly ListenEvent[],
  tracks: ReadonlyMap<string, Track>,
  features: ReadonlyMap<string, AudioFeatures>,
): EraSignature {
  const genreCounts = new Map<string, number>();
  const artistCounts = new Map<string, number>();
  const trackCounts = new Map<string, number>();
  const valences: { value: number; weight: number }[] = [];
  const energies: { value: number; weight: number }[] = [];

  let night = 0;
  let usable = 0;

  for (const event of events) {
    const track = tracks.get(event.trackId);
    if (track) {
      trackCounts.set(track.id, (trackCounts.get(track.id) ?? 0) + 1);
      artistCounts.set(track.artistId, (artistCounts.get(track.artistId) ?? 0) + 1);
      if (track.genres.length > 0) {
        const share = 1 / track.genres.length;
        for (const genre of track.genres) {
          genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + share);
        }
      }
    }

    if (isNightHour(eventTime(event))) night += 1;

    const feature = features.get(event.trackId);
    if (feature && feature.valence !== null && feature.energy !== null) {
      usable += 1;
      const weight = event.durationMs / MOOD_WEIGHT_BASE_MS;
      valences.push({ value: feature.valence, weight });
      energies.push({ value: feature.energy, weight });
    }
  }

  const total = events.length;
  const uniqueTracks = trackCounts.size;

  return {
    genreDistribution: normalizeDistribution(genreCounts),
    topArtistIds: topN(artistCounts, ERA_TOP_ARTISTS),
    avgValence: weightedAverage(valences),
    avgEnergy: weightedAverage(energies),
    nightShare: total > 0 ? night / total : 0,
    repeatRate: total > 0 ? (total - uniqueTracks) / total : 0,
    featureCoverage: total > 0 ? usable / total : 0,
  };
}

/**
 * L'ascolto è notturno? (00:00-05:59 UTC).
 *
 * La finestra notturna è **semi-aperta**: `[0, ERA_NIGHT_HOURS)`.
 */
export function isNightHour(time: number): boolean {
  const hour = new Date(time).getUTCHours();
  return hour < ERA_NIGHT_HOURS;
}

/**
 * Normalizza una distribuzione di conteggi a una **quota** (somma 1).
 *
 * Una distribuzione vuota resta vuota: non c'è niente da normalizzare, e
 * `0/0` produrrebbe `NaN`.
 */
export function normalizeDistribution(counts: ReadonlyMap<string, number>): Record<string, number> {
  const distribution: Record<string, number> = {};
  let total = 0;
  for (const count of counts.values()) total += count;
  if (total <= 0) return distribution;
  for (const [key, count] of counts) {
    distribution[key] = count / total;
  }
  return distribution;
}

/**
 * I `n` elementi più frequenti di un conteggio, in ordine decrescente.
 *
 * **Il pareggio è risolto dall'id**: due elementi con lo stesso conteggio
 * sono ordinati per id crescente. Senza questo, l'ordinamento dipenderebbe
 * dall'ordine di inserimento nella mappa e la firma (e quindi l'era)
 * non sarebbe riproducibile.
 */
export function topN(counts: ReadonlyMap<string, number>, n: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([id]) => id);
}
