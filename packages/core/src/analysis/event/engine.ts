/**
 * Event Detector — `04-ANALYSIS-ALGORITHMS.md` v1.2 🟢 §6 (Story 2.3).
 *
 * Il motore rileva le **anomalie significative** della storia di ascolto e le
 * rende insight narrativi con la loro confidenza: un picco di ascolto, un
 * crollo emotivo, un'esplosione di novità, un silenzio.
 *
 * Il motore è **puro**: riceve gli ascolti, i brani, gli artisti e le feature,
 * non legge il DB (`05§9`: il layer di analisi gira nel Web Worker). Le
 * feature arrivano già filtrate per sorgente: il motore vede solo quelle
 * **misurate o manuali** (`21-AUDIO-FEATURES.md` §12, D-AF.4).
 *
 * **Niente segnali inventati** (D-A.1, 04§11): senza feature utilizzabili il
 * rilevatore non produce eventi basati sulla valence. La quota artistica e
 * quella di genere, il volume e i silenzi derivano dagli **ascolti** e non
 * hanno bisogno di feature: misurano l'attività, non la sua emotività.
 */

import type { Logger } from '../../logger';
import type {
  Artist,
  AudioFeatures,
  EventKind,
  EventPayload,
  Insight,
  ListenEvent,
  Track,
} from '../../schema';
import { eventTime } from '../datetime';
import type { Translator } from '../i18n';
import { buildFeatureIndex } from '../mood/features';
import {
  dedupeOverlapping,
  detectExplorationEvents,
  detectQuotaEvents,
  detectSilenceEvents,
  detectZScoreEvents,
  type EventDraft,
} from './detect';
import { computeEventDerivedVersion } from './derivedVersion';
import { formatQuotaSuffix, formatZScoreSuffix, renderEventDescription } from './i18n';
import { buildTrackIndex, computeDailyBuckets } from './metrics';
import { resolveEventConfig, type EventConfig, type EventConfigOverrides } from './types';

/** Opzioni del motore. */
export interface EventEngineOptions {
  /** Resolver i18n iniettato dall'app (D-A.4): serve a rendere la descrizione. */
  readonly translator: Translator;
  /** Override dei parametri — utile per i test e per le preferenze future. */
  readonly config?: EventConfigOverrides;
  /**
   * Logger per il warning aggregato sulle feature mancanti (04§1.4).
   *
   * È **opzionale**: il motore resta puro e chi non ne ha bisogno non
   * osserva nulla. Il warning non porta dati personali: solo conteggi
   * (09§4).
   */
  readonly logger?: Logger | undefined;
}

/** Dati grezzi su cui il motore lavora. */
export interface EventInput {
  /** Ascolti della storia. */
  readonly listens: readonly ListenEvent[];
  /** Brani (servono generi e artisti). */
  readonly tracks: readonly Track[];
  /** Artisti (servono i nomi per la descrizione). */
  readonly artists: readonly Artist[];
  /** Feature audio disponibili (già filtrate per sorgente, 21§12). */
  readonly features: readonly AudioFeatures[];
}

/** Evento calcolato: l'insight persistibile più il suo payload. */
export interface GeneratedEvent {
  /** Insight pronto per la persistenza (`type: event`). */
  readonly insight: Insight;
  /** Payload dell'evento (02§4). */
  readonly payload: EventPayload;
}

/**
 * Id deterministico dell'insight.
 *
 * Ricalcolare gli eventi non deve creare duplicati: l'id dipende dal tipo,
 * dall'inizio del periodo e dal soggetto del detector a quota, non da un
 * UUID casuale.
 *
 * @param eventType - tipo di evento.
 * @param periodStart - inizio del periodo, in unix ms.
 * @param subject - artista o genere dominante (solo per i detector a quota).
 * @returns l'id dell'insight.
 */
export function eventInsightId(
  eventType: EventKind,
  periodStart: number,
  subject: string | null = null,
): string {
  const base = `event-${eventType}-${periodStart}`;
  return subject === null ? base : `${base}-${slugify(subject)}`;
}

/** Un id o un nome diventano un frammento sicuro per l'id dell'insight. */
function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length === 0 ? 'x' : slug;
}

/** Motore dell'event detector. */
export class EventEngine {
  private readonly config: EventConfig;
  private readonly translator: Translator;
  private readonly logger?: Logger | undefined;
  private versionPromise: Promise<string> | null = null;

  constructor(options: EventEngineOptions) {
    this.config = resolveEventConfig(options.config);
    this.translator = options.translator;
    this.logger = options.logger;
  }

  /** Parametri effettivi del motore. */
  get parameters(): EventConfig {
    return this.config;
  }

  /** `derivedVersion` calcolata dai parametri — 04§9. */
  async derivedVersion(): Promise<string> {
    this.versionPromise ??= computeEventDerivedVersion(this.config);
    return this.versionPromise;
  }

  /**
   * Calcola gli eventi della storia di ascolto.
   *
   * L'output è **deterministico**: a parità di ascolti, brani, artisti e
   * feature produce sempre gli stessi eventi, con gli stessi id (ricalcolo
   * idempotente, 02§7 MIG-3). Gli eventi sono ordinati per periodo.
   */
  async generate(input: EventInput): Promise<GeneratedEvent[]> {
    if (input.listens.length === 0) return [];

    const trackIndex = buildTrackIndex(input.tracks);
    const buckets = computeDailyBuckets(input.listens, input.tracks, input.features);

    const drafts = dedupeOverlapping([
      ...detectZScoreEvents(buckets, this.config),
      ...detectQuotaEvents(buckets, trackIndex, this.config),
      ...detectSilenceEvents(input.listens, this.config),
      ...detectExplorationEvents(buckets, this.config),
    ]);

    const derivedVersion = await this.derivedVersion();
    const artistNames = buildArtistNames(input.artists);
    const generated: GeneratedEvent[] = [];

    for (const draft of drafts) {
      const payload = buildPayload(draft, artistNames, this.translator);
      generated.push({
        insight: {
          id: eventInsightId(draft.eventType, draft.periodStart, draft.subject),
          type: 'event',
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
          payload,
          confidence: draft.confidence,
          derivedVersion,
          status: 'pending',
          userNote: null,
          createdAt: Date.now(),
        },
        payload,
      });
    }

    this.warnMissingFeatures(input);
    return generated;
  }

  /**
   * Warning aggregato sulle feature mancanti — 04§1.4.
   *
   * **Un solo warning**, con i **numeri**: quanti ascolti della storia non
   * hanno feature misurate o manuali. Il segnale dice quanto il rilevamento
   * copre, non elenca i singoli ascolti (e non porta dati personali, 09§4).
   */
  private warnMissingFeatures(input: EventInput): void {
    const features = buildFeatureIndex(input.features);
    let missing = 0;
    for (const listen of input.listens) {
      const feature = features.get(listen.trackId);
      if (!feature || feature.valence === null || feature.energy === null) missing += 1;
    }
    if (missing === 0) return;
    this.logger?.warn('eventi senza audio features', {
      missingFeatures: missing,
      totalEvents: input.listens.length,
    });
  }
}

/** La mappa `artistId → nome` per la descrizione degli eventi. */
function buildArtistNames(artists: readonly Artist[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const artist of artists) names.set(artist.id, artist.name);
  return names;
}

/**
 * Costruisce il payload dell'evento (02§4).
 *
 * La descrizione è **resa** dal resolver i18n: nessuna stringa italiana
 * vive nel core (D-A.4). Il suffisso numerico è quello del detector che ha
 * prodotto l'evento, ed è **linguisticamente neutro**.
 */
function buildPayload(
  draft: EventDraft,
  artistNames: ReadonlyMap<string, string>,
  translator: Translator,
): EventPayload {
  const params: Record<string, string> = {};
  if (draft.eventType === 'spike_artist' && draft.subject !== null) {
    params.artist = artistNames.get(draft.subject) ?? draft.subject;
  }
  if (draft.eventType === 'spike_genre' && draft.subject !== null) {
    params.genre = draft.subject;
  }

  const description = renderEventDescription(translator, draft.eventType, params);
  const suffix = suffixOf(draft);
  return {
    kind: 'event',
    eventType: draft.eventType,
    description: suffix === null ? description : `${description} ${suffix}`,
    metrics: { ...draft.metrics },
  };
}

/** Il suffisso numerico del detector che ha prodotto l'evento. */
function suffixOf(draft: EventDraft): string | null {
  const z = draft.metrics.z;
  if (z !== undefined) return formatZScoreSuffix(z);
  const ratio = draft.metrics.share_ratio;
  if (ratio !== undefined) return formatQuotaSuffix(ratio);
  return null;
}

/** Ordina gli ascolti per istante di inizio (e per id, a parità di istante). */
export function sortByTime(listens: readonly ListenEvent[]): ListenEvent[] {
  return [...listens].sort((a, b) => eventTime(a) - eventTime(b) || a.id.localeCompare(b.id));
}
