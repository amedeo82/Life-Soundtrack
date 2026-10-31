/**
 * Metriche giornaliere dell'event detector — `04-ANALYSIS-ALGORITHMS.md`
 * v1.2 🟢 §6.3 (`computeDailyMetrics`).
 *
 * Il detector lavora su **giorni UTC**, coerentemente con `ListenEvent.day`
 * ('YYYY-MM-DD' UTC derivato dal timestamp, 02§3.2) e con il resto del layer
 * di analisi (`analysis/datetime.ts`).
 *
 * Un giorno **senza ascolti non esiste** nella mappa delle metriche: non è un
 * giorno a volume zero. Il volume misura «quanto hai ascolto **nei giorni in
 * cui hai ascoltato**»; i buchi sono un altro segnale, e li dichiara il
 * detector di silenzio (04§6.4). Conteggiare i buchi come volume zero
 * produrrebbe falsi `volume_drop` sui periodi in cui l'utente ha ascoltato
 * meno spesso ma con la stessa abitudine.
 */

import type { AudioFeatures, ListenEvent, Track } from '../../schema';
import { DAY_MS, HOUR_MS, eventTime } from '../datetime';
import { weightedAverage } from '../mood/classify';
import { buildFeatureIndex } from '../mood/features';
import { MOOD_WEIGHT_BASE_MS } from '../mood/engine';

/**
 * Indice del giorno UTC che contiene un istante.
 *
 * L'epoca Unix cade a mezzanotte UTC: dividere per `DAY_MS` dà quindi
 * l'indice del giorno direttamente.
 */
export function dayIndex(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

/** Scheletro del brano: serve al detector a quota (artista e generi). */
export interface TrackInfo {
  /** Id dell'artista (02§3.3). */
  readonly artistId: string;
  /** Generi dichiarati del brano (02§3.3). */
  readonly genres: readonly string[];
}

/**
 * Indice dei brani per `trackId`.
 *
 * I brani assenti non hanno artista né generi: un ascolto di un brano
 * sconosciuto non può attribuirsi a un artista e non può entrare in una quota
 * di genere.
 *
 * @param tracks - brani della storia.
 * @returns la mappa `trackId → {artistId, genres}`.
 */
export function buildTrackIndex(tracks: readonly Track[]): ReadonlyMap<string, TrackInfo> {
  const index = new Map<string, TrackInfo>();
  for (const track of tracks) {
    index.set(track.id, { artistId: track.artistId, genres: track.genres });
  }
  return index;
}

/** Metriche di un giorno (04§6.3). */
export interface DailyMetrics {
  /** Indice del giorno UTC. */
  readonly day: number;
  /** Inizio del giorno UTC, in unix ms. */
  readonly dayStart: number;
  /** Volume di ascolto del giorno, **in ore**. */
  readonly volume: number;
  /** Valence media ponderata del giorno, `null` senza feature utilizzabili. */
  readonly valence: number | null;
  /** Energy media ponderata del giorno, `null` senza feature utilizzabili. */
  readonly energy: number | null;
  /** Artisti distinti ascoltati nel giorno. */
  readonly diversity: number;
  /** Artisti sentiti **per la prima volta** nel giorno. */
  readonly newArtists: number;
  /** Ascolti del giorno. */
  readonly eventCount: number;
  /** Quota degli ascolti del giorno con feature misurate o manuali. */
  readonly featureCoverage: number;
}

/** Un giorno della storia: le sue metriche e i suoi ascolti. */
export interface DailyBucket {
  /** Indice del giorno UTC. */
  readonly day: number;
  /** Inizio del giorno UTC, in unix ms. */
  readonly dayStart: number;
  /** Ascolti del giorno, in ordine cronologico. */
  readonly listens: readonly ListenEvent[];
  /** Metriche del giorno. */
  readonly metrics: DailyMetrics;
}

/**
 * Calcola le metriche giornaliere della storia — 04§6.3
 * (`computeDailyMetrics`).
 *
 * Il **volume** è la somma delle durate dichiarate degli ascolti del giorno,
 * espressa in ore: l'unità dell'esempio numerico di `04§6.6` («avg volume
 * 3h/giorno»).
 *
 * La **valence** e l'**energy** sono medie ponderate per durata, come nel
 * mood tracker (`04§3.3`), e sono `null` quando il giorno non ha feature
 * **misurate o manuali**: l'euristico non alimenta l'analisi
 * (`21-AUDIO-FEATURES.md` §12, D-AF.4).
 *
 * I **newArtists** contano gli artisti il cui primo ascolto **in assoluto**
 * cade in quel giorno: sono i "mai ascoltati prima" di `04§6.4`.
 *
 * @param listens - ascolti della storia.
 * @param tracks - brani della history.
 * @param features - feature audio disponibili (già filtrate per sorgente, 21§12).
 * @returns i giorni della storia, in ordine cronologico.
 */
export function computeDailyBuckets(
  listens: readonly ListenEvent[],
  tracks: readonly Track[],
  features: readonly AudioFeatures[],
): DailyBucket[] {
  if (listens.length === 0) return [];

  const trackIndex = buildTrackIndex(tracks);
  const featureIndex = buildFeatureIndex(features);

  const sorted = [...listens].sort(
    (a, b) => eventTime(a) - eventTime(b) || a.id.localeCompare(b.id),
  );

  // Raggruppa gli ascolti per giorno: l'ordine di `sorted` garantisce che i
  // giorni restino in ordine cronologico.
  const byDay = new Map<number, ListenEvent[]>();
  for (const listen of sorted) {
    const day = dayIndex(eventTime(listen));
    const bucket = byDay.get(day);
    if (bucket) bucket.push(listen);
    else byDay.set(day, [listen]);
  }

  const firstListenDay = computeFirstListenDays(sorted, trackIndex);

  return [...byDay.entries()].map(([day, dayListens]) => ({
    day,
    dayStart: day * DAY_MS,
    listens: dayListens,
    metrics: computeDayMetrics(day, dayListens, trackIndex, featureIndex, firstListenDay),
  }));
}

/** Il primo ascolto di ciascun artista, in indice di giorno. */
function computeFirstListenDays(
  listens: readonly ListenEvent[],
  trackIndex: ReadonlyMap<string, TrackInfo>,
): Map<string, number> {
  const first = new Map<string, number>();
  for (const listen of listens) {
    const track = trackIndex.get(listen.trackId);
    if (!track) continue;
    const day = dayIndex(eventTime(listen));
    const known = first.get(track.artistId);
    if (known === undefined || day < known) first.set(track.artistId, day);
  }
  return first;
}

/** Metriche di un giorno, calcolate dai suoi ascolti. */
function computeDayMetrics(
  day: number,
  listens: readonly ListenEvent[],
  trackIndex: ReadonlyMap<string, TrackInfo>,
  featureIndex: ReadonlyMap<string, AudioFeatures>,
  firstListenDay: ReadonlyMap<string, number>,
): DailyMetrics {
  let durationMs = 0;
  let usable = 0;
  const artists = new Set<string>();
  const valences: { value: number; weight: number }[] = [];
  const energies: { value: number; weight: number }[] = [];

  for (const listen of listens) {
    durationMs += listen.durationMs;
    const track = trackIndex.get(listen.trackId);
    if (track) artists.add(track.artistId);

    const feature = featureIndex.get(listen.trackId);
    if (!feature || feature.valence === null || feature.energy === null) continue;
    usable += 1;
    const weight = listen.durationMs / MOOD_WEIGHT_BASE_MS;
    valences.push({ value: feature.valence, weight });
    energies.push({ value: feature.energy, weight });
  }

  let newArtists = 0;
  for (const artistId of artists) {
    if (firstListenDay.get(artistId) === day) newArtists += 1;
  }

  return {
    day,
    dayStart: day * DAY_MS,
    volume: durationMs / HOUR_MS,
    valence: weightedAverage(valences),
    energy: weightedAverage(energies),
    diversity: artists.size,
    newArtists,
    eventCount: listens.length,
    featureCoverage: listens.length === 0 ? 0 : usable / listens.length,
  };
}
