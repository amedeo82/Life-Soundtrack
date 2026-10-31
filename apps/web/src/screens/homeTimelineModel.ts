/**
 * Modello puro di Home (⑥) e Timeline (⑦) — Story 3.1, spec
 * `docs/06-UX-FLOWS-STATES.md` §2.6-2.7, `docs/07-UI-SPEC.md` §2.1-2.7.
 *
 * Tutta la logica — conteggi, aggregazioni, bucket, bande di era, zoom — sta
 * qui, **senza React e senza DOM**: è testabile con il solo dato e rende i
 * componenti puri presentazionali, come il nastro contesto della Story 3.4.
 *
 * Il vocabolario temporale è quello del core (`@core`: `startOfUtcDay`,
 * `startOfUtcMonth`, `startOfUtcWeek`, `utcYear`, `utcMonth`, `DAY_MS`): la
 * Timeline non introduce un secondo calendario (lesson 27-7).
 *
 * **Nessun dato inventato**: un bucket senza ascolti vale `0`, un punto senza
 * mood non viene interpolato, un'era senza mood resta senza mood. I numeri
 * vengono dai dati, non da euristiche di presentazione.
 */

import {
  DAY_MS,
  HOUR_MS,
  startOfUtcDay,
  startOfUtcWeek,
  utcDateParts,
  utcDayKey,
  utcMonth,
  utcYear,
} from '@core/analysis';

/** Granularità della Timeline (`06§2.7` — toggle Anni/Mesi/Settimane/Giorni). */
export type Granularity = 'years' | 'months' | 'weeks' | 'days';

/** Ordine del toggle: dal più largo al più fine. */
export const GRANULARITIES: readonly Granularity[] = ['years', 'months', 'weeks', 'days'];

const MONTH_MS = 30 * DAY_MS;
const WEEK_MS = 7 * DAY_MS;

/** Ascoltoaggregato: il minimo necessario a Home e Timeline. */
export interface ListenFact {
  /** Unix ms UTC. */
  playedAt: number;
  /** Durata in ms. */
  durationMs: number;
  /** Id dell'artista (per il conteggio artisti distinti). */
  artistId: string;
}

/** Mood aggregato su un periodo (da `Insight` di tipo `mood_*`). */
export interface MoodPoint {
  /** Unix ms UTC — inizio del periodo. */
  periodStart: number;
  /** Unix ms UTC — fine del periodo. */
  periodEnd: number;
  /** Valence media 0..1 (`04§3.5`). */
  valence: number;
  /** Mood dominante (`04§3.4`), se noto. */
  mood: string | null;
}

/** Era derivata (da `Insight` di tipo `era`). */
export interface EraFact {
  id: string;
  startTime: number;
  endTime: number;
  /** Etichetta già resa (`insight.era.label`). */
  label: string;
  /** Mood dominante dell'era, se noto. */
  mood: string | null;
}

/** I quattro numeri della Home (`06§2.6` — 4 StatCard). */
export interface HomeStats {
  /** Brani ascoltati (il nome segue la chiave copy `home.stats.tracks`). */
  tracks: number;
  /** Ore ascoltate (arrotondate). */
  hours: number;
  /** Artisti distinti. */
  artists: number;
  /** Ere note. */
  eras: number;
}

/**
 * I quattro numeri della Home.
 *
 * Le ore sono arrotondate all'intero: un numero decimale su una StatCard è
 * rumore, e il dato grezzo resta nel dato (`06§2.6`).
 */
export function computeHomeStats(listens: readonly ListenFact[], eraCount: number): HomeStats {
  const artists = new Set<string>();
  let totalMs = 0;
  for (const listen of listens) {
    artists.add(listen.artistId);
    totalMs += Math.max(0, listen.durationMs);
  }
  return {
    tracks: listens.length,
    hours: Math.round(totalMs / HOUR_MS),
    artists: artists.size,
    eras: eraCount,
  };
}

/** Barra del giorno: minuti ascoltati e chiave del giorno. */
export interface BarWeekPoint {
  /** Chiave del giorno UTC (`YYYY-MM-DD`). */
  dayKey: string;
  /** Etichetta breve pronta per la UI (il giorno della settimana). */
  label: string;
  /** Minuti ascoltati. */
  minutes: number;
}

/**
 * I sette giorni della settimana, con i minuti ascoltati (`06§2.6` — BarWeek).
 *
 * La settimana parte da lunedì (`startOfUtcWeek`, default del core) e il
 * risultato è **sempre di 7 giorni**: una settimana incompleta mostrerebbe
 * barre mancanti, che si leggerebbero come «nessun ascolto» invece che come
 * «giorni futuri».
 */
export function computeBarWeek(listens: readonly ListenFact[], now: number): BarWeekPoint[] {
  const weekStart = startOfUtcWeek(now);
  const minutes = new Array<number>(7).fill(0);
  const labels: string[] = [];

  for (let i = 0; i < 7; i++) {
    const day = weekStart + i * DAY_MS;
    const parts = utcDateParts(day);
    labels.push(String(parts.day).padStart(2, '0'));
  }

  for (const listen of listens) {
    const day = startOfUtcDay(listen.playedAt);
    const offset = Math.round((day - weekStart) / DAY_MS);
    if (offset < 0 || offset > 6) continue;
    minutes[offset] = (minutes[offset] ?? 0) + Math.max(0, listen.durationMs) / 60_000;
  }

  return minutes.map((value, index) => ({
    dayKey: utcDayKey(startOfUtcDay(weekStart + index * DAY_MS)),
    label: labels[index] ?? '',
    minutes: Math.round(value),
  }));
}

/** Punto di una serie (StreamChart o MoodLine). */
export interface SeriesPoint {
  /** Unix ms UTC — inizio del bucket. */
  start: number;
  /** Unix ms UTC — fine del bucket. */
  end: number;
  /** Etichetta del bucket (pronta per la UI). */
  label: string;
  /** Valore: minuti ascoltati (volume) o valence media 0..1 (mood). */
  value: number;
}

/** Inizio del bucket che contiene `ms`, alla granularità richiesta. */
export function bucketStart(ms: number, granularity: Granularity): number {
  switch (granularity) {
    case 'years':
      return Date.UTC(utcYear(ms), 0, 1);
    case 'months':
      // `utcMonth` è **1-based**, `Date.UTC` è 0-based: il mese va scalato.
      return Date.UTC(utcYear(ms), utcMonth(ms) - 1, 1);
    case 'weeks':
      return startOfUtcWeek(ms);
    case 'days':
      return startOfUtcDay(ms);
  }
}

/** Fine (esclusa) del bucket che contiene `ms`. */
export function bucketEnd(ms: number, granularity: Granularity): number {
  const start = bucketStart(ms, granularity);
  switch (granularity) {
    case 'years':
      return Date.UTC(utcYear(start) + 1, 0, 1);
    case 'months':
      return Date.UTC(utcYear(start), utcMonth(start), 1);
    case 'weeks':
      return start + WEEK_MS;
    case 'days':
      return start + DAY_MS;
  }
}

/** Etichetta del bucket, pronta per la UI. */
export function bucketLabel(start: number, granularity: Granularity): string {
  const parts = utcDateParts(start);
  // `utcDateParts` restituisce il mese **1-based** (`month + 1`).
  const month = String(parts.month).padStart(2, '0');
  switch (granularity) {
    case 'years':
      return String(parts.year);
    case 'months':
      return `${month}/${String(parts.year).slice(2)}`;
    case 'weeks': {
      const day = utcDateParts(start + 3 * DAY_MS);
      return `${String(day.day).padStart(2, '0')} ${month}`;
    }
    case 'days':
      return `${String(parts.day).padStart(2, '0')} ${month}`;
  }
}

/**
 * Serie del **volume** (StreamChart): i minuti ascoltati per bucket.
 *
 * I bucket vuoti **esistono** (valore 0): una linea che salta i buchi
 * suggerirebbe continuità che i dati non hanno.
 */
export function bucketizeListens(
  listens: readonly ListenFact[],
  granularity: Granularity,
): SeriesPoint[] {
  if (listens.length === 0) return [];

  const buckets = new Map<number, number>();
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;

  for (const listen of listens) {
    const start = bucketStart(listen.playedAt, granularity);
    buckets.set(start, (buckets.get(start) ?? 0) + Math.max(0, listen.durationMs) / 60_000);
    if (start < first) first = start;
    if (start > last) last = start;
  }

  const points: SeriesPoint[] = [];
  for (let start = first; start <= last; start = nextBucket(start, granularity)) {
    const minutes = buckets.get(start) ?? 0;
    points.push({
      start,
      end: bucketEnd(start, granularity),
      label: bucketLabel(start, granularity),
      value: Math.round(minutes),
    });
  }
  return points;
}

/** Bucket successivo a `start` alla granularità richiesta. */
export function nextBucket(start: number, granularity: Granularity): number {
  switch (granularity) {
    case 'years':
      return Date.UTC(utcYear(start) + 1, 0, 1);
    case 'months':
      // `utcMonth` è 1-based e `Date.UTC` è 0-based: passare `utcMonth(start)`
      // come argomento 0-based dà **il mese successivo**.
      return Date.UTC(utcYear(start), utcMonth(start), 1);
    case 'weeks':
      return start + WEEK_MS;
    case 'days':
      return start + DAY_MS;
  }
}

/**
 * Serie del **mood** (MoodLine): la valence media per bucket.
 *
 * Un bucket senza mood **non** viene interpolato: la linea deve saltare il
 * vuoto (i dati non ci sono, non valgono zero). Un mood sotto la soglia di
 * aggregazione non è prodotto dal core: qui non se ne inventa.
 */
export function bucketizeMood(
  moods: readonly MoodPoint[],
  granularity: Granularity,
): SeriesPoint[] {
  if (moods.length === 0) return [];

  const buckets = new Map<number, { sum: number; count: number }>();
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;

  for (const mood of moods) {
    const start = bucketStart(mood.periodStart, granularity);
    const entry = buckets.get(start) ?? { sum: 0, count: 0 };
    entry.sum += mood.valence;
    entry.count += 1;
    buckets.set(start, entry);
    if (start < first) first = start;
    if (start > last) last = start;
  }

  const points: SeriesPoint[] = [];
  for (let start = first; start <= last; start = nextBucket(start, granularity)) {
    const entry = buckets.get(start);
    if (!entry) continue;
    points.push({
      start,
      end: bucketEnd(start, granularity),
      label: bucketLabel(start, granularity),
      value: entry.sum / entry.count,
    });
  }
  return points;
}

/** Banda di era pronta per la Timeline. */
export interface EraBandModel {
  id: string;
  label: string;
  mood: string | null;
  start: number;
  end: number;
}

/** Le ere come bande, ordinate per inizio. */
export function toEraBands(eras: readonly EraFact[]): EraBandModel[] {
  return [...eras]
    .sort((a, b) => a.startTime - b.startTime)
    .map((era) => ({
      id: era.id,
      label: era.label,
      mood: era.mood,
      start: era.startTime,
      end: era.endTime,
    }));
}

/**
 * Granularità suggerita dalla **durata** del periodo visibile: è il zoom
 * progressivo (`06§2.7` — anni → mesi → giorni).
 *
 * Le soglie sono scelte sui confini naturali dei dati: oltre tre anni la
 * granularità mensile diventa illeggibile, oltre sei mesi quella settimanale
 * non distingue niente, oltre sei settimane quella giornaliera è rumore.
 */
export function granularityForSpan(spanMs: number): Granularity {
  if (spanMs > 3 * 365 * DAY_MS) return 'years';
  if (spanMs > 6 * MONTH_MS) return 'months';
  if (spanMs > 6 * WEEK_MS) return 'weeks';
  return 'days';
}

/** Intervallo visibile (zoom) della Timeline. */
export interface VisibleRange {
  start: number;
  end: number;
}

/**
 * L'intervallo visibile per una granularità, ancorato alla fine dei dati.
 *
 * L'intervallo parte dall'inizio del primo bucket visibile: così il primo
 * bucket non appare tagliato a metà.
 */
export function rangeForGranularity(
  lastBucketStart: number,
  granularity: Granularity,
  buckets: number,
): VisibleRange {
  const end = bucketEnd(lastBucketStart, granularity);
  const start = bucketStart(
    lastBucketStart - Math.max(0, buckets - 1) * (end - lastBucketStart),
    granularity,
  );
  return { start, end };
}

/** Quanti bucket coprono la serie a una data granularità. */
export function bucketCount(series: readonly SeriesPoint[]): number {
  return series.length;
}

/** Il bucket che contiene `ms`, o `null` se nessuno. */
export function bucketAt(series: readonly SeriesPoint[], ms: number): SeriesPoint | null {
  for (const point of series) {
    if (ms >= point.start && ms < point.end) return point;
  }
  return null;
}

/** L'era che contiene `ms`, o `null` se nessuna. */
export function eraAt(eras: readonly EraBandModel[], ms: number): EraBandModel | null {
  for (const era of eras) {
    if (ms >= era.start && ms < era.end) return era;
  }
  return null;
}
