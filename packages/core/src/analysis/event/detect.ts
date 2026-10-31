/**
 * I detector dell'event detector — `04-ANALYSIS-ALGORITHMS.md` v1.2 🟢 §6.
 *
 * Quattro detector, ciascuno con un **tipo di evento** di proprietà:
 *
 * | Detector | Tipi prodotti | Sezione |
 * |----------|---------------|---------|
 * | z-score generico | `volume_spike`, `volume_drop`, `valence_rise`, `valence_drop`, `exploration` | 04§6.3 |
 * | quota | `spike_artist`, `spike_genre` | 04§6.2 |
 * | silenzio | `silence` | 04§6.4 |
 * | esplorazione | `exploration` | 04§6.4 |
 *
 * Il tipo `exploration` può essere prodotto da due detector: il dedupe
 * (§6.7) tiene, per ciascun tipo, l'evento con la confidenza più alta.
 *
 * Tutti i detector sono **puri**: ricevono i dati già calcolati e non
 * leggono il DB (`05§9`: il layer di analisi gira nel Web Worker). Tutti
 * sono **deterministici**: a parità di input producono gli stessi eventi,
 * nello stesso ordine, con gli stessi id.
 */

import type { EventKind, ListenEvent } from '../../schema';
import { DAY_MS, eventTime } from '../datetime';
import type { DailyBucket, TrackInfo } from './metrics';
import { EVENT_QUOTA_RATIO, type EventConfig } from './types';

/** Un evento rilevato, prima della costruzione dell'insight. */
export interface EventDraft {
  /** Tipo di evento (02§4, `EventKind`). */
  readonly eventType: EventKind;
  /** Inizio del periodo, in unix ms. */
  readonly periodStart: number;
  /** Fine del periodo, in unix ms. */
  readonly periodEnd: number;
  /** Le metriche del detector (02§4, `EventPayload.metrics`). */
  readonly metrics: Record<string, number>;
  /** Confidenza dell'evento, in [0, 1] (04§6.7). */
  readonly confidence: number;
  /** Soggetto del detector a quota: l'artista o il genere che domina. */
  readonly subject: string | null;
}

/** Le metriche valutate dal detector a z-score — 04§6.3. */
export type ZScoreMetric = 'volume' | 'valence' | 'diversity';

/** I tre metriche del loop z-score, nell'ordine della spec. */
export const ZSCORE_METRICS: readonly ZScoreMetric[] = ['volume', 'valence', 'diversity'];

/** Una finestra di analisi: la baseline e la finestra che la confronta. */
export interface AnalysisWindow {
  /** Primo giorno della baseline (indice UTC). */
  readonly baselineStartDay: number;
  /** Primo giorno della finestra (indice UTC). */
  readonly startDay: number;
  /** Ultimo giorno della finestra **escluso** (indice UTC). */
  readonly endDay: number;
  /** I giorni della baseline, con i loro ascolti. */
  readonly baseline: readonly DailyBucket[];
  /** I giorni della finestra, con i loro ascolti. */
  readonly window: readonly DailyBucket[];
}

/**
 * Le finestre di analisi, sulla griglia dello stride — 04§6.3.
 *
 * La griglia parte da `earliestDay + baselineDays`: **prima** di quel
 * momento non esiste una baseline, e un confronto senza baseline produrrebbe
 * eventi arbitrari. La griglia avanza di `strideDays` giorni.
 *
 * La finestra deve essere **completa**: l'ultima finestra utile è quella che
 * finisce entro l'ultimo giorno osservato. Una finestra troncata avrebbe
 * meno giorni della baseline e la sua media sarebbe più bassa per costruzione:
 * un `volume_drop` sistematico, non un evento (D.70.3).
 *
 * @param buckets - i giorni della storia, in ordine cronologico.
 * @param config - parametri correnti.
 * @returns le finestre, in ordine cronologico.
 */
export function analysisWindows(
  buckets: readonly DailyBucket[],
  config: EventConfig,
): AnalysisWindow[] {
  if (buckets.length === 0) return [];
  const firstDay = buckets[0]!.day;
  const lastDay = buckets[buckets.length - 1]!.day;
  const windows: AnalysisWindow[] = [];

  for (
    let cursor = firstDay + config.baselineDays;
    cursor + config.windowDays <= lastDay + 1;
    cursor += config.strideDays
  ) {
    const baselineStart = cursor - config.baselineDays;
    windows.push({
      baselineStartDay: baselineStart,
      startDay: cursor,
      endDay: cursor + config.windowDays,
      baseline: sliceByDay(buckets, baselineStart, cursor),
      window: sliceByDay(buckets, cursor, cursor + config.windowDays),
    });
  }
  return windows;
}

/**
 * I giorni nel range `[fromDay, toDay)` — estremi esclusi a destra.
 *
 * I giorni sono ordinati: la ricerca è binaria, e il risultato è una copia
 * (l'array restituito non espone lo stato interno).
 */
export function sliceByDay(
  buckets: readonly DailyBucket[],
  fromDay: number,
  toDay: number,
): DailyBucket[] {
  const from = lowerBound(buckets, fromDay);
  const to = lowerBound(buckets, toDay);
  return buckets.slice(from, to);
}

/** Il primo indice con `buckets[index].day >= day`. */
function lowerBound(buckets: readonly DailyBucket[], day: number): number {
  let low = 0;
  let high = buckets.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (buckets[mid]!.day < day) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * Il detector generico a z-score — 04§6.3 (`detectEvents`).
 *
 * Per ciascuna finestra della griglia confronta la media della finestra con
 * la media e la deviazione standard della baseline:
 *
 *     z = (windowMean - mean) / std
 *
 * e produce un evento quando `|z| > zScoreThreshold`. La deviazione
 * standard è **popolazionale** (÷N): la baseline è l'intera popolazione dei
 * giorni osservati, non un campione (D.70.4).
 *
 * Un giorno **senza feature** non è un giorno a valence zero: è un giorno
 * **assente** dalla baseline di quella metrica. Trattarlo come zero
 * falserebbe lo z-score verso il basso — un periodo senza feature sembrerebbe
 * «triste» (D.70.5).
 *
 * @param buckets - i giorni della storia.
 * @param config - parametri correnti.
 * @returns gli eventi del detector, in ordine di finestra.
 */
export function detectZScoreEvents(
  buckets: readonly DailyBucket[],
  config: EventConfig,
): EventDraft[] {
  const drafts: EventDraft[] = [];

  for (const window of analysisWindows(buckets, config)) {
    if (window.baseline.length < config.minBaselineDays) continue;

    for (const metric of ZSCORE_METRICS) {
      const baselineValues = metricValues(window.baseline, metric);
      if (baselineValues.length < config.minBaselineDays) continue;

      const mean = average(baselineValues);
      const std = populationStdDev(baselineValues, mean);
      // 04§6.3: «if std == 0: continue» — una baseline costante non ha
      // nessuna dispersione, e nessuno z-score è definito su di essa.
      if (std === 0) continue;

      const windowValues = metricValues(window.window, metric);
      if (windowValues.length === 0) continue;

      const windowMean = average(windowValues);
      const z = (windowMean - mean) / std;
      if (Math.abs(z) <= config.zScoreThreshold) continue;

      const eventType = metricToEventType(metric, z);
      if (!eventType) continue;

      drafts.push({
        eventType,
        periodStart: window.startDay * DAY_MS,
        periodEnd: window.endDay * DAY_MS,
        metrics: {
          z,
          baseline_mean: mean,
          window_mean: windowMean,
          feature_coverage: coverageOf(window.window),
        },
        confidence: Math.min(1, Math.abs(z) / (2 * config.zScoreThreshold)),
        subject: null,
      });
    }
  }

  return drafts;
}

/**
 * Il tipo di evento di una metrica, secondo il segno dello z-score — 04§6.3.
 *
 * Una **diversità in calo** non produce alcun evento: l'enum dei tipi
 * (`02§4`) non ha un contropartita per «ascoltato meno artisti del solito»,
 * e inventarne uno sarebbe un tipo fuori dallo schema chiuso.
 */
export function metricToEventType(metric: ZScoreMetric, z: number): EventKind | null {
  const rising = z > 0;
  switch (metric) {
    case 'volume':
      return rising ? 'volume_spike' : 'volume_drop';
    case 'valence':
      return rising ? 'valence_rise' : 'valence_drop';
    case 'diversity':
      return rising ? 'exploration' : null;
    default:
      return null;
  }
}

/**
 * Il detector a quota — `spike_artist` e `spike_genre` (04§6.2).
 *
 * Il trigger dichiarato dalla spec è «quota artista > 2× baseline». La
 * condizione è applicata in due parti, perché la quota da sola non distingue
 * un picco da una variazione ordinaria:
 *
 * 1. **la dominanza**: la quota del soggetto nella finestra deve superare
 *    `minDominantShare` — è il «dominato il tuo ascolto» della copia
 *    (`insight.event.spike_artist`);
 * 2. **il picco**: la quota nella finestra deve superare
 *    `EVENT_QUOTA_RATIO` volte la quota in baseline.
 *
 * Il soggetto è **il primo per quota** della finestra: un solo artista (o un
 * solo genere) domina ogni finestra. Il pareggio è risolto in modo
 * deterministico (id dell'artista, ordine alfabetico del genere).
 *
 * Un artista assente in baseline ha quota baseline **0**: il rapporto non è
 * definito, e la quota viene confrontata con la soglia di dominanza. Il
 * rapporto riportato nelle metriche è in ogni caso finito (D.70.6).
 *
 * @param buckets - i giorni della storia.
 * @param trackIndex - indice dei brani (artista e generi).
 * @param config - parametri correnti.
 * @returns gli eventi del detector, in ordine di finestra.
 */
export function detectQuotaEvents(
  buckets: readonly DailyBucket[],
  trackIndex: ReadonlyMap<string, TrackInfo>,
  config: EventConfig,
): EventDraft[] {
  const drafts: EventDraft[] = [];

  for (const window of analysisWindows(buckets, config)) {
    const windowListens = window.window.flatMap((bucket) => bucket.listens);
    const baselineListens = window.baseline.flatMap((bucket) => bucket.listens);
    if (windowListens.length === 0 || baselineListens.length === 0) continue;

    const artist = dominantArtist(windowListens, baselineListens, trackIndex);
    if (artist) {
      const draft = quotaDraft(
        'spike_artist',
        artist.subject,
        artist.windowShare,
        artist.baselineShare,
        window,
        config,
      );
      if (draft) drafts.push(draft);
    }

    const genre = dominantGenre(windowListens, baselineListens, trackIndex);
    if (genre) {
      const draft = quotaDraft(
        'spike_genre',
        genre.subject,
        genre.windowShare,
        genre.baselineShare,
        window,
        config,
      );
      if (draft) drafts.push(draft);
    }
  }

  return drafts;
}

/** Il soggetto dominante di un detector a quota. */
interface DominantSubject {
  /** L'id dell'artista o il nome del genere. */
  readonly subject: string;
  /** Quota nella finestra (0..1). */
  readonly windowShare: number;
  /** Quota in baseline (0..1). */
  readonly baselineShare: number;
}

/** Costruisce l'evento a quota, se il trigger è soddisfatto. */
function quotaDraft(
  eventType: EventKind,
  subject: string,
  windowShare: number,
  baselineShare: number,
  window: AnalysisWindow,
  config: EventConfig,
): EventDraft | null {
  // La dominanza: il soggetto deve dominare la finestra (D.70.2).
  if (windowShare < config.minDominantShare) return null;
  // Il picco: la quota deve superare il multiplo della baseline (04§6.2).
  if (windowShare <= EVENT_QUOTA_RATIO * baselineShare) return null;

  // Il rapporto è finito per costruzione: quando il soggetto è assente in
  // baseline la sua quota è 0, e il rapporto è definito rispetto alla
  // soglia di dominanza (D.70.6).
  const ratio =
    baselineShare > 0 ? windowShare / baselineShare : windowShare / config.minDominantShare;

  return {
    eventType,
    periodStart: window.startDay * DAY_MS,
    periodEnd: window.endDay * DAY_MS,
    metrics: {
      window_share: windowShare,
      baseline_share: baselineShare,
      share_ratio: ratio,
      feature_coverage: coverageOf(window.window),
    },
    confidence: Math.min(1, ratio / (2 * EVENT_QUOTA_RATIO)),
    subject,
  };
}

/** L'artista che domina la finestra, con le sue quote. */
function dominantArtist(
  windowListens: readonly ListenEvent[],
  baselineListens: readonly ListenEvent[],
  trackIndex: ReadonlyMap<string, TrackInfo>,
): DominantSubject | null {
  const windowCounts = new Map<string, number>();
  const baselineCounts = new Map<string, number>();

  for (const listen of windowListens) {
    const track = trackIndex.get(listen.trackId);
    if (!track) continue;
    windowCounts.set(track.artistId, (windowCounts.get(track.artistId) ?? 0) + 1);
  }
  for (const listen of baselineListens) {
    const track = trackIndex.get(listen.trackId);
    if (!track) continue;
    baselineCounts.set(track.artistId, (baselineCounts.get(track.artistId) ?? 0) + 1);
  }

  let subject: string | null = null;
  let topCount = 0;
  for (const [artistId, count] of windowCounts) {
    // Il pareggio è risolto dall'id: due artisti con la stessa quota non
    // possono produrre due eventi diversi a parità di input.
    if (count > topCount || (count === topCount && subject !== null && artistId < subject)) {
      subject = artistId;
      topCount = count;
    }
  }
  if (subject === null) return null;

  const windowShare = topCount / windowListens.length;
  const baselineShare = (baselineCounts.get(subject) ?? 0) / baselineListens.length;
  return { subject, windowShare, baselineShare };
}

/** Il genere che domina la finestra, con le sue quote. */
function dominantGenre(
  windowListens: readonly ListenEvent[],
  baselineListens: readonly ListenEvent[],
  trackIndex: ReadonlyMap<string, TrackInfo>,
): DominantSubject | null {
  const windowWeights = genreWeights(windowListens, trackIndex);
  const baselineWeights = genreWeights(baselineListens, trackIndex);

  let subject: string | null = null;
  let topWeight = 0;
  for (const [genre, weight] of windowWeights) {
    // Il pareggio è risolto alfabeticamente: il genere è un dato, non un id.
    if (weight > topWeight || (weight === topWeight && subject !== null && genre < subject)) {
      subject = genre;
      topWeight = weight;
    }
  }
  if (subject === null) return null;

  const windowShare = topWeight / windowListens.length;
  const baselineShare = (baselineWeights.get(subject) ?? 0) / baselineListens.length;
  return { subject, windowShare, baselineShare };
}

/**
 * Il peso di ogni genere in un insieme di ascolti.
 *
 * Ogni genere di un brano pesa `1/n`, con `n` il numero di generi del
 * brano: la somma dei pesi è il numero degli ascolti, e la quota di un
 * genere è la sua somma divisa per quel numero (D.69.3, la stessa regola
 * dell'era detector).
 */
function genreWeights(
  listens: readonly ListenEvent[],
  trackIndex: ReadonlyMap<string, TrackInfo>,
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const listen of listens) {
    const track = trackIndex.get(listen.trackId);
    if (!track || track.genres.length === 0) continue;
    const share = 1 / track.genres.length;
    for (const genre of track.genres) {
      weights.set(genre, (weights.get(genre) ?? 0) + share);
    }
  }
  return weights;
}

/**
 * Il detector di silenzio — 04§6.4 (`detectSilence`).
 *
 * Un silenzio è un **buco** fra due ascolti consecutivi: l'ultimo ascolto
 * prima e il primo dopo. La sua durata è la distanza fra i due.
 *
 * Non richiede baseline né feature: il buco è un fatto della cronologia.
 *
 * @param listens - gli ascolti della storia.
 * @param config - parametri correnti.
 * @returns gli eventi di silenzio, in ordine cronologico.
 */
export function detectSilenceEvents(
  listens: readonly ListenEvent[],
  config: EventConfig,
): EventDraft[] {
  if (listens.length < 2) return [];
  const sorted = [...listens].sort(
    (a, b) => eventTime(a) - eventTime(b) || a.id.localeCompare(b.id),
  );
  const drafts: EventDraft[] = [];
  const minGapMs = config.silenceMinDays * DAY_MS;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    const gapMs = eventTime(current) - previous.timestamp;
    if (gapMs < minGapMs) continue;

    const durationDays = gapMs / DAY_MS;
    drafts.push({
      eventType: 'silence',
      periodStart: previous.timestamp,
      periodEnd: eventTime(current),
      metrics: {
        duration_days: durationDays,
        silence_min_days: config.silenceMinDays,
      },
      confidence: Math.min(1, durationDays / (2 * config.silenceMinDays)),
      subject: null,
    });
  }

  return drafts;
}

/**
 * Il detector di esplorazione — 04§6.4 (`detectExploration`).
 *
 * Conta gli artisti **mai ascoltati prima** (il cui primo ascolto cade
 * nella finestra) e produce un evento quando superano
 * `explorationMinNewArtists`.
 *
 * La finestra è lunga `strideDays` giorni — 7 per default, come i «7gg» di
 * `04§6.2` — e le finestre sono allineate alla stessa griglia degli altri
 * detector (D.70.7).
 *
 * Il detector parte dalla stessa soglia degli altri (`earliestDay +
 * baselineDays`): i primi giorni della storia hanno per definizione tutti
 * gli artisti "nuovi", e contarli produrrebbe un evento di esplorazione
 * all'inizio di ogni storia.
 *
 * @param buckets - i giorni della storia.
 * @param config - parametri correnti.
 * @returns gli eventi di esplorazione, in ordine di finestra.
 */
export function detectExplorationEvents(
  buckets: readonly DailyBucket[],
  config: EventConfig,
): EventDraft[] {
  if (buckets.length === 0) return [];
  const firstDay = buckets[0]!.day;
  const lastDay = buckets[buckets.length - 1]!.day;
  const drafts: EventDraft[] = [];

  for (
    let cursor = firstDay + config.baselineDays;
    cursor + config.strideDays <= lastDay + 1;
    cursor += config.strideDays
  ) {
    const window = sliceByDay(buckets, cursor, cursor + config.strideDays);
    let newArtists = 0;
    for (const bucket of window) newArtists += bucket.metrics.newArtists;
    if (newArtists < config.explorationMinNewArtists) continue;

    drafts.push({
      eventType: 'exploration',
      periodStart: cursor * DAY_MS,
      periodEnd: (cursor + config.strideDays) * DAY_MS,
      metrics: {
        new_artists: newArtists,
        window_days: config.strideDays,
        feature_coverage: coverageOf(window),
      },
      confidence: Math.min(1, newArtists / (2 * config.explorationMinNewArtists)),
      subject: null,
    });
  }

  return drafts;
}

/**
 * Dedupe degli eventi sovrapposti — 04§6.3 (`dedupeOverlapping`), §6.7.
 *
 * Il dedupe è **per tipo e per soggetto**: due eventi dello stesso tipo (e
 * dello stesso artista o genere) che si sovrappongono sono lo stesso evento
 * visto da due finestre diverse — la griglia avanza di `strideDays` giorni e
 * la finestra è lunga `windowDays`, quindi le finestre consecutive si
 * sovrappongono. Si tiene quello con la **confidenza più alta**.
 *
 * Due eventi di **tipi diversi** sulla stessa finestra non si sovrappongono
 * ai sensi del dedupe: un picco di volume e un crollo di valence possono
 * co-occorrere, e sono due letture diverse della stessa settimana.
 *
 * @param drafts - gli eventi rilevati.
 * @returns gli eventi deduplicati, in ordine cronologico.
 */
export function dedupeOverlapping(drafts: readonly EventDraft[]): EventDraft[] {
  const groups = new Map<string, EventDraft[]>();
  for (const draft of drafts) {
    const key = `${draft.eventType}|${draft.subject ?? ''}`;
    const group = groups.get(key);
    if (group) group.push(draft);
    else groups.set(key, [draft]);
  }

  const kept: EventDraft[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort(
      (a, b) =>
        b.confidence - a.confidence ||
        a.periodStart - b.periodStart ||
        a.periodEnd - b.periodEnd ||
        (a.subject ?? '').localeCompare(b.subject ?? ''),
    );
    for (const draft of ordered) {
      const overlaps = kept.some(
        (other) =>
          other.eventType === draft.eventType &&
          (other.subject ?? '') === (draft.subject ?? '') &&
          overlapsRange(other.periodStart, other.periodEnd, draft.periodStart, draft.periodEnd),
      );
      if (!overlaps) kept.push(draft);
    }
  }

  return kept.sort(
    (a, b) => a.periodStart - b.periodStart || a.eventType.localeCompare(b.eventType),
  );
}

/** Due intervalli `[start, end)` si sovrappongono? */
export function overlapsRange(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** I valori di una metrica sui giorni indicati, senza i `null`. */
function metricValues(buckets: readonly DailyBucket[], metric: ZScoreMetric): number[] {
  const values: number[] = [];
  for (const bucket of buckets) {
    const value = metricValue(bucket, metric);
    if (value !== null) values.push(value);
  }
  return values;
}

/** Il valore di una metrica su un giorno, `null` se il dato non c'è. */
function metricValue(bucket: DailyBucket, metric: ZScoreMetric): number | null {
  switch (metric) {
    case 'volume':
      return bucket.metrics.volume;
    case 'valence':
      return bucket.metrics.valence;
    case 'diversity':
      return bucket.metrics.diversity;
    default:
      return null;
  }
}

/** La media aritmetica di una serie non vuota. */
export function average(values: readonly number[]): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** La deviazione standard **popolazionale** di una serie (÷N). */
export function populationStdDev(values: readonly number[], mean: number): number {
  let sum = 0;
  for (const value of values) sum += (value - mean) ** 2;
  return Math.sqrt(sum / values.length);
}

/** La quota degli ascolti con feature utilizzabili nei giorni indicati. */
function coverageOf(buckets: readonly DailyBucket[]): number {
  let total = 0;
  let covered = 0;
  for (const bucket of buckets) {
    total += bucket.metrics.eventCount;
    covered += bucket.metrics.featureCoverage * bucket.metrics.eventCount;
  }
  return total === 0 ? 0 : covered / total;
}
