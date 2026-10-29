/**
 * Tipi e parametri del Mood Tracker — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §3.
 *
 * I parametri vivono qui, e solo qui: il `derivedVersion` (04§1.1, §9) è
 * l'hash di questo oggetto, quindi **ogni** parametro che influisce sul
 * risultato deve comparire in `MoodConfig`. Un parametro fuori da qui
 * sarebbe un parametro non versionato: gli insight vecchi non diventerebbero
 * `stale` al suo cambio (MIG-3, 02§7).
 */

import type { MoodId } from '../../schema';

/**
 * Periodo aggregato dal mood tracker — 04§3.1 ("giorno/settimana/mese").
 *
 * I tre periodi corrispondono ai tre tipi di insight dello schema
 * (`02§3.6`): `mood_day`, `mood_week`, `mood_month`.
 */
export type MoodPeriod = 'day' | 'week' | 'month';

/**
 * Set di parametri del mood tracker — 04§3.4.
 *
 * I cinque parametri elencati in 04§9 (`valenceThreshold`, `energyThreshold`,
 * `neutralBand`, `excitedEnergyThreshold`, `minEventsPerPeriod`) sono il
 * nucleo ratificato.
 *
 * Il sesto, `weekStartDay`, è una **scelta di implementazione** (D.62.1):
 * 04§3.3 definisce il mood di un "periodo (giorno/settimana/mese)" ma non
 * dice da quando comincia la settimana. Il default è il **lunedì** (ISO-8601),
 * coerente con la settimana commerciale e con la serie di giorni che chiude
 * il `mood_day` il sabato. Il parametro è versionato come gli altri: senza,
 * un cambio di convenzione non renderebbe `stale` gli insight già prodotti
 * (MIG-3).
 */
export interface MoodConfig {
  /** Soglia di valence che divide il quadrante — 04§3.4. */
  valenceThreshold: number;
  /** Soglia di energy che divide il quadrante — 04§3.4. */
  energyThreshold: number;
  /** Semipiezza della fascia neutra attorno alla soglia — 04§3.4. */
  neutralBand: number;
  /** Energy minima perché il mood sia `excited` — 04§3.4. */
  excitedEnergyThreshold: number;
  /** Eventi **con feature utilizzabili** minimi perché il periodo produca un insight — 04§3.4. */
  minEventsPerPeriod: number;
  /** Giorno di inizio della settimana UTC (0 = domenica, 1 = lunedì). */
  weekStartDay: number;
}

/** Default dei parametri — 04§3.4. */
export const DEFAULT_MOOD_CONFIG: MoodConfig = {
  valenceThreshold: 0.5,
  energyThreshold: 0.5,
  neutralBand: 0.1,
  excitedEnergyThreshold: 0.75,
  minEventsPerPeriod: 3,
  weekStartDay: 1,
};

/**
 * Applica gli override ai default mantenendo **l'ordine delle chiavi**:
 * `JSON.stringify(config)` deve essere deterministico, perché da lui dipende
 * il `derivedVersion` (04§1.1).
 */
export function resolveMoodConfig(overrides: Partial<MoodConfig> = {}): MoodConfig {
  return {
    valenceThreshold: overrides.valenceThreshold ?? DEFAULT_MOOD_CONFIG.valenceThreshold,
    energyThreshold: overrides.energyThreshold ?? DEFAULT_MOOD_CONFIG.energyThreshold,
    neutralBand: overrides.neutralBand ?? DEFAULT_MOOD_CONFIG.neutralBand,
    excitedEnergyThreshold:
      overrides.excitedEnergyThreshold ?? DEFAULT_MOOD_CONFIG.excitedEnergyThreshold,
    minEventsPerPeriod: overrides.minEventsPerPeriod ?? DEFAULT_MOOD_CONFIG.minEventsPerPeriod,
    weekStartDay: overrides.weekStartDay ?? DEFAULT_MOOD_CONFIG.weekStartDay,
  };
}

/** I tre periodi, nell'ordine in cui l'orchestratore li calcola (04§8). */
export const MOOD_PERIODS: readonly MoodPeriod[] = ['day', 'week', 'month'];

/**
 * Tipo di insight corrispondente al periodo — 02§3.6 (`INSIGHT_TYPES`).
 *
 * Il tipo è **derivato dal periodo**, non un parametro: cambiarlo cambierebbe
 * la natura dell'insight, non un suo parametro di calcolo.
 */
export const MOOD_INSIGHT_TYPES: Readonly<
  Record<MoodPeriod, 'mood_day' | 'mood_week' | 'mood_month'>
> = {
  day: 'mood_day',
  week: 'mood_week',
  month: 'mood_month',
};

/**
 * Mood dominante di un periodo — 04§3.1.
 *
 * I sei valori sono quelli di `MOOD_IDS` (schema).
 */
export type MoodValue = MoodId;

/** Valore numerico pesato, usato dalla media ponderata (04§3.3). */
export interface WeightedValue {
  /** Valore misurato (valence o energy). */
  readonly value: number;
  /** Peso associato (durata dell'ascolto). */
  readonly weight: number;
}
