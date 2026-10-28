/**
 * Tipi e parametri del Memory Engine — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §7.
 *
 * I parametri vivono qui, e solo qui: il `derivedVersion` (04§1.1, §9) è
 * l'hash di questo oggetto, quindi **ogni** parametro che influisce sul
 * risultato deve comparire in `MemoryConfig`. Un parametro fuori da qui
 * sarebbe un parametro non versionato: gli insight vecchi non diventerebbero
 * `stale` al suo cambio (MIG-3, 02§7).
 */

import type { Artist, ListenEvent, MemoryKind, Track } from '../../schema';

/**
 * Set di parametri del memory engine — 04§7.3.
 *
 * I sei parametri elencati in 04§9 (`onThisDayYears`, `firstTimeMinTracks`,
 * `milestones`, `returnMinGapDays`, `seasonalConcentration`,
 * `seasonalMinEvents`) sono il nucleo ratificato. Le due soglie in più
 * (`milestoneHours`, `milestoneArtists`) coprono le altre due famiglie di
 * milestone enumerate nel trigger di 04§7.2 ("100, 500, 1000 ore; 100, 500
 * artisti unici") e sono versionate insieme alle altre: un parametro che
 * cambia il risultato ma non il `derivedVersion` romperebbe MIG-3.
 */
export interface MemoryConfig {
  /** Anni considerati da `on_this_day` — 04§7.3. */
  onThisDayYears: number[];
  /** Brani **distinti** minimi perché un artista sia "significativo" — 04§7.3 (D-A.3). */
  firstTimeMinTracks: number;
  /** Soglie di ascolti totali — 04§7.3. */
  milestones: number[];
  /** Soglie di ore di ascolto cumulative — 04§7.2. */
  milestoneHours: number[];
  /** Soglie di artisti unici — 04§7.2. */
  milestoneArtists: number[];
  /** Silenzio minimo dell'artista, in giorni, per `return` — 04§7.3 (D-A.2). */
  returnMinGapDays: number;
  /** Quota di ascolti nel mese corrente (finestra 12 mesi) — 04§7.3. */
  seasonalConcentration: number;
  /** Ascolti minimi nella finestra, per non generare ricordi da un singolo ascolto — 04§7.3. */
  seasonalMinEvents: number;
}

/** Default dei parametri — 04§7.3. */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  onThisDayYears: [1, 2, 3, 5, 10],
  firstTimeMinTracks: 5,
  milestones: [1000, 5000, 10000, 50000, 100000],
  milestoneHours: [100, 500, 1000],
  milestoneArtists: [100, 500],
  returnMinGapDays: 180,
  seasonalConcentration: 0.6,
  seasonalMinEvents: 5,
};

/**
 * Applica gli override ai default mantenendo **l'ordine delle chiavi**:
 * `JSON.stringify(config)` deve essere deterministico, perché da lui dipende
 * il `derivedVersion` (04§1.1).
 */
export function resolveMemoryConfig(overrides: Partial<MemoryConfig> = {}): MemoryConfig {
  return {
    onThisDayYears: [...(overrides.onThisDayYears ?? DEFAULT_MEMORY_CONFIG.onThisDayYears)],
    firstTimeMinTracks: overrides.firstTimeMinTracks ?? DEFAULT_MEMORY_CONFIG.firstTimeMinTracks,
    milestones: [...(overrides.milestones ?? DEFAULT_MEMORY_CONFIG.milestones)],
    milestoneHours: [...(overrides.milestoneHours ?? DEFAULT_MEMORY_CONFIG.milestoneHours)],
    milestoneArtists: [...(overrides.milestoneArtists ?? DEFAULT_MEMORY_CONFIG.milestoneArtists)],
    returnMinGapDays: overrides.returnMinGapDays ?? DEFAULT_MEMORY_CONFIG.returnMinGapDays,
    seasonalConcentration:
      overrides.seasonalConcentration ?? DEFAULT_MEMORY_CONFIG.seasonalConcentration,
    seasonalMinEvents: overrides.seasonalMinEvents ?? DEFAULT_MEMORY_CONFIG.seasonalMinEvents,
  };
}

/** Parametri interpolati in un template i18n — valori stringa o numerici. */
export type MemoryTemplateParams = Record<string, string | number>;

/**
 * Ricordo **non ancora reso**: il produttore del ricordo decide il template
 * e i parametri, il motore li rende una volta sola (04§7.3.1, D-A.4).
 */
export interface MemoryDraft {
  /** Tipo di ricordo — 04§7.2. */
  readonly memoryKind: MemoryKind;
  /** Brano di riferimento (quello di oggi per `return`, quello del giorno per `on_this_day`). */
  readonly trackId: string | null;
  /** Artista di riferimento. */
  readonly artistId: string | null;
  /** Anni fa, quando il ricordo è ancorato a una data nel passato. */
  readonly yearsAgo: number | null;
  /** Chiave i18n del template — `insight.memory.*` (08§2.15). */
  readonly templateKey: string;
  /** Parametri del template. */
  readonly templateParams: MemoryTemplateParams;
  /** Ascolti associati al soggetto: base della `relevance` (04§7.4). */
  readonly trackCount: number;
  /** Distanza in giorni dal riferimento temporale: base della `recency` (04§7.4). */
  readonly daysAgo: number;
  /** Discriminante che rende univoco l'id dell'insight per lo stesso giorno. */
  readonly discriminator: string;
}

/**
 * Contesto condiviso dai generatori: gli ascolti, gli indici dei brani e
 * degli artisti, il giorno di riferimento e i parametri.
 */
export interface MemoryContext {
  /** Ascolti (non necessariamente ordinati: ogni generatore ordina il suo sottoinsieme). */
  readonly listens: readonly ListenEvent[];
  /** Brani indicizzati per `Track.id`. */
  readonly tracks: ReadonlyMap<string, Track>;
  /** Artisti indicizzati per `Artist.id`. */
  readonly artists: ReadonlyMap<string, Artist>;
  /** Istante di riferimento ("oggi"), in unix ms UTC. */
  readonly today: number;
  /** Locale per i nomi localizzati (nome del mese, 04§7.3.1). */
  readonly locale: string;
  /** Parametri correnti. */
  readonly config: MemoryConfig;
}
