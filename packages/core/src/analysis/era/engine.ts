/**
 * Era Detector — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §5 (Story 2.2).
 *
 * Il motore segmenta la storia di ascolto in **ere musicali**: periodi
 * prolungati con caratteristiche coerenti, separati da cambiamenti
 * significativi. L'algoritmo è **change point detection** su firme
 * settimanali: non c'è clustering non supervisionato (04§5).
 *
 * Il motore è **puro**: riceve gli ascolti, i brani e le feature, non legge il
 * DB (`05§9`: il layer di analisi gira nel Web Worker). Le feature
 * arrivano già filtrate per sorgente: il motore vede solo quelle **misurate
 * o manuali** (`21-AUDIO-FEATURES.md` §12, D-AF.4).
 *
 * **Niente segnali inventati** (D-A.1, 04§11): un'era senza feature
 * utilizzabili non viene prodotta. `EraPayload.avgValence` e
 * `avgEnergy` (02§4) non sono nullable: riempirli con uno zero sarebbe
 * una lettura falsa, e l'era riporterebbe un mood che nessuno ha misurato.
 */

import type { Logger } from '../../logger';
import type { AudioFeatures, EraPayload, Insight, ListenEvent, MoodId, Track } from '../../schema';
import { eventTime } from '../datetime';
import type { Translator } from '../i18n';
import { buildFeatureIndex, classifyMood, DEFAULT_MOOD_CONFIG, type MoodConfig } from '../mood';
import {
  buildEras,
  computeWeeklySignatures,
  detectChangePoints,
  eraDurationDays,
  type EraDraft,
} from './detect';
import { computeEraDerivedVersion } from './derivedVersion';
import { renderEraLabel } from './i18n';
import type { EraSignature } from './signature';
import { ERA_TOP_TRACKS, resolveEraConfig, type EraConfig, type EraConfigOverrides } from './types';

/** Opzioni del motore. */
export interface EraEngineOptions {
  /** Resolver i18n iniettato dall'app (D-A.4): serve a rendere l'etichetta. */
  readonly translator: Translator;
  /** Override dei parametri — utile per i test e per le preferenze future. */
  readonly config?: EraConfigOverrides;
  /**
   * Logger per il warning aggregato sulle ere scartate (04§1.4).
   *
   * È **opzionale**: il motore resta puro e chi non ne ha bisogno non
   * osserva nulla. Il warning non porta dati personali: solo conteggi
   * (09§4).
   */
  readonly logger?: Logger | undefined;
}

/** Dati grezzi su cui il motore lavora. */
export interface EraInput {
  /** Ascolti della storia. */
  readonly listens: readonly ListenEvent[];
  /** Brani (servono generi e artisti). */
  readonly tracks: readonly Track[];
  /** Feature audio disponibili (già filtrate per sorgente, 21§12). */
  readonly features: readonly AudioFeatures[];
}

/** Era calcolata: l'insight persistibile più il suo payload. */
export interface GeneratedEra {
  /** Insight pronto per la persistenza (`type: era`). */
  readonly insight: Insight;
  /** Payload dell'era (02§4). */
  readonly payload: EraPayload;
}

/**
 * Id deterministico dell'insight.
 *
 * Ricalcolare le ere non deve creare duplicati: l'id dipende dall'inizio
 * dell'era, non da un UUID casuale.
 */
export function eraInsightId(periodStart: number): string {
  return `era-${periodStart}`;
}

/** Motore dell'era detector. */
export class EraEngine {
  private readonly config: EraConfig;
  private readonly translator: Translator;
  private readonly logger?: Logger | undefined;
  private versionPromise: Promise<string> | null = null;

  constructor(options: EraEngineOptions) {
    this.config = resolveEraConfig(options.config);
    this.translator = options.translator;
    this.logger = options.logger;
  }

  /** Parametri effettivi del motore. */
  get parameters(): EraConfig {
    return this.config;
  }

  /** `derivedVersion` calcolata dai parametri — 04§9. */
  async derivedVersion(): Promise<string> {
    this.versionPromise ??= computeEraDerivedVersion(this.config);
    return this.versionPromise;
  }

  /**
   * Calcola le ere della storia di ascolto.
   *
   * L'output è **deterministico**: a parità di ascolti, brani e feature
   * produce sempre le stesse ere, con gli stessi id (ricalcolo idempotente,
   * 02§7 MIG-3). Le ere sono ordinate dalla più antica.
   */
  async generate(input: EraInput): Promise<GeneratedEra[]> {
    const events = sortByTime(input.listens);
    if (events.length === 0) return [];

    const tracks = new Map(input.tracks.map((track) => [track.id, track]));
    const features = buildFeatureIndex(input.features);

    const windows = computeWeeklySignatures(events, tracks, features, this.config);
    const changePoints = detectChangePoints(windows, this.config);
    const drafts = buildEras(events, changePoints, tracks, features);

    const derivedVersion = await this.derivedVersion();
    const generated: GeneratedEra[] = [];
    let skipped = 0;
    let short = 0;

    for (const draft of drafts) {
      // D-A.1: senza feature utilizzabili l'era non può essere riempita
      // (`avgValence`/`avgEnergy` non sono nullable in 02§4).
      const { avgValence, avgEnergy } = draft.signature;
      if (avgValence === null || avgEnergy === null) {
        skipped += 1;
        continue;
      }
      if (eraDurationDays(draft) < this.config.minEraDays) {
        short += 1;
        continue;
      }

      const mood = classifyMood(avgValence, avgEnergy, moodConfig(this.config));
      const payload = buildPayload(draft, mood, avgValence, avgEnergy, this.translator);
      generated.push({
        insight: {
          id: eraInsightId(draft.start),
          type: 'era',
          periodStart: draft.start,
          periodEnd: draft.end,
          payload,
          // La copertura dei dati: quota di ascolti dell'era con feature
          // utilizzabili (D.69.7). È la stessa semantica della confidence
          // del mood tracker (D.63.8).
          confidence: draft.signature.featureCoverage,
          derivedVersion,
          status: 'pending',
          userNote: null,
          createdAt: Date.now(),
        },
        payload,
      });
    }

    this.warnSkipped(skipped, short, events.length);
    return generated;
  }

  /**
   * Warning aggregato sulle ere scartate — 04§1.4.
   *
   * **Un solo warning**, con i **numeri**: quante ere non hanno feature
   * utilizzabili e quante sono troppo corte. Il segnale dice quanto il
   * rilevamento copre, non elenca i singoli ascolti (e non porta dati
   * personali, 09§4).
   */
  private warnSkipped(skipped: number, short: number, totalEvents: number): void {
    if (skipped === 0 && short === 0) return;
    this.logger?.warn('ere scartate dal rilevamento', {
      erasWithoutFeatures: skipped,
      erasTooShort: short,
      totalEvents,
    });
  }
}

/**
 * Costruisce il payload dell'era (02§4).
 *
 * La label è **resa** dal resolver i18n: nessuna stringa italiana vive nel
 * core (D-A.4).
 */
function buildPayload(
  draft: EraDraft,
  mood: MoodId,
  avgValence: number,
  avgEnergy: number,
  translator: Translator,
): EraPayload {
  const signature: EraSignature = draft.signature;
  return {
    kind: 'era',
    label: renderEraLabel(translator, mood, topGenre(signature.genreDistribution)),
    moodDominant: mood,
    topArtistIds: [...signature.topArtistIds],
    topTrackIds: topTrackIds(draft.events),
    genreDistribution: { ...signature.genreDistribution },
    avgValence,
    avgEnergy,
    nightShare: signature.nightShare,
    repeatRate: signature.repeatRate,
  };
}

/**
 * Il genere più ascoltato dell'era.
 *
 * Il **pareggio è risolto alfabeticamente**: due generi con la stessa quota
 * non possono produrre due etichette diverse a parità di input.
 */
export function topGenre(distribution: Readonly<Record<string, number>>): string {
  let best = '';
  let bestValue = -1;
  for (const [genre, value] of Object.entries(distribution)) {
    if (value > bestValue || (value === bestValue && genre < best)) {
      best = genre;
      bestValue = value;
    }
  }
  return best;
}

/**
 * I brani più ascoltati dell'era — 04§5.2 (`topN(eraEvents.groupBy(trackId), 5)`).
 *
 * Il pareggio è risolto dall'id del brano, come per gli artisti: la firma
 * deve essere riproducibile.
 */
export function topTrackIds(events: readonly ListenEvent[]): string[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.trackId, (counts.get(event.trackId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, ERA_TOP_TRACKS)
    .map(([id]) => id);
}

/**
 * La config del mood tracker derivata dalle soglie dell'era.
 *
 * Le soglie dell'era sono le stesse del mood tracker (D.69.2): l'era
 * classifica il proprio mood con **lo stesso** classificatore, così l'era e
 * il mood dello stesso periodo non si contraddicono.
 */
export function moodConfig(config: EraConfig): MoodConfig {
  return {
    ...DEFAULT_MOOD_CONFIG,
    valenceThreshold: config.mood.valenceThreshold,
    energyThreshold: config.mood.energyThreshold,
    neutralBand: config.mood.neutralBand,
    excitedEnergyThreshold: config.mood.excitedEnergyThreshold,
  };
}

/** Ordina gli ascolti per istante di inizio (e per id, a parità di istante). */
function sortByTime(listens: readonly ListenEvent[]): ListenEvent[] {
  return [...listens].sort((a, b) => eventTime(a) - eventTime(b) || a.id.localeCompare(b.id));
}
