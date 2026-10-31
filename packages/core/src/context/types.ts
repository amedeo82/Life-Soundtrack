/**
 * Parametri del classificatore di contesto **L1** — 19-GEO-CONTEXT.md §5
 * (Story 1.6).
 *
 * I valori sono **costanti misurabili** (D-B.3, ratificata dal project owner
 * il 2026-10-30, issue #201): i numeri di `19§5.2`/`§5.3` sono ragionati,
 * non misurati, ma la ratifica li fissa come **default vincolanti** e li
 * espone come **parametri di config**. Ogni parametro entra nel
 * `derivedVersion` (MIG-3): cambiarli produce un bump di versione e un
 * ricalcolo, mai una classificazione silenziosamente diversa.
 */

import type { DeviceType } from '../schema';

/**
 * Set di parametri del classificatore.
 *
 * I campi sono **piatti** e in ordine fisso: il `derivedVersion` è
 * `sha1(JSON.stringify(config))` (`04§1.1`), quindi la serializzazione deve
 * essere stabile — un oggetto con campi annidati o con chiavi in ordine
 * variabile romperebbe la garanzia.
 */
export interface ContextConfig {
  /** Soglia di aggregazione: sotto, il periodo **non** viene aggregato (19§5.3, E19). */
  readonly aggregationThreshold: number;
  /** Confidenza base di R2 (`car`). */
  readonly carConfidence: number;
  /** Confidenza base di R3 (`travel`). */
  readonly travelConfidence: number;
  /** Confidenza base di R4 (`home`). */
  readonly homeConfidence: number;
  /** Confidenza base di R5 (`work`). */
  readonly workConfidence: number;
  /** Confidenza base di R6 (`commute`): **sotto** la soglia, per costruzione. */
  readonly commuteConfidence: number;
  /** Confidenza del contesto `away` (nessun dato di paese, ma dispositivo utile). */
  readonly awayConfidence: number;
  /** Finestra (giorni) del paese di riferimento (19§5.3). */
  readonly referenceWindowDays: number;
  /** Eventi minimi nella finestra per considerare il paese di riferimento (19§5.3). */
  readonly referenceMinEvents: number;
  /** R3: giorni consecutivi minimi fuori dal paese di riferimento. */
  readonly travelMinDays: number;
  /** R4: quota di settimane con lo stesso pattern (dispositivo + banda oraria). */
  readonly homeRecurrence: number;
  /** R5: quota di settimane con lo stesso pattern (dispositivo + banda oraria). */
  readonly workRecurrence: number;
  /** R4: quota di ascolti del periodo nella banda oraria dominante («stessa fascia oraria»). */
  readonly bandConsistency: number;
  /**
   * R4: durata **mediana** minima di una sessione perché il cluster sia
   * «casa».
   *
   * Scelta dichiarata (vedi `docs/state/stories/1.6-geo-foundation.md`): R4
   * richiede «stessa fascia oraria + ≥60% delle settimane», ma senza un
   * vincolo di durata uno **spostamento** che si ripete ogni mattina (mobile,
   * sessioni da 8 minuti) soddisferebbe R4 e verrebbe classificato `home`
   * invece che `commute`. La soglia è la stessa di R6 (25 minuti): sotto, il
   * cluster è troppo breve per essere un cluster domestico.
   */
  readonly homeMinSessionMs: number;
  /** R6: durata massima di una sessione per essere `commute`. */
  readonly commuteMaxSessionMs: number;
  /** Gap che spezza una sessione di ascolto (derivata, MIG-2). */
  readonly sessionGapMs: number;
  /** Gap che spezza un periodo di contesto. */
  readonly periodGapMs: number;
  /** Larghezza della banda oraria (19§5.2 R4: banda di 2h). */
  readonly timeBandHours: number;
  /** Ora di inizio della fascia lavorativa (R5), inclusa. */
  readonly workHourStart: number;
  /** Ora di fine della fascia lavorativa (R5), **esclusa**. */
  readonly workHourEnd: number;
  /** Dispositivi che qualificano R5 (`work`). */
  readonly workDeviceTypes: readonly DeviceType[];
  /** Dispositivi che **non** portano informazione di contesto (R1). */
  readonly unknownDeviceTypes: readonly DeviceType[];
}

/**
 * Default vincolanti del classificatore.
 *
 * I valori delle soglie sono quelli ratificati in `19§5.2`/`§5.3` (D-B.3);
 * gli altri sono i parametri operativi dichiarati dalla stessa spec
 * (finestra 90gg, 30 eventi, 3 giorni di viaggio, banda 2h, 25 minuti di
 * sessione, gap 30 minuti).
 */
export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  aggregationThreshold: 0.5,
  carConfidence: 0.9,
  travelConfidence: 0.9,
  homeConfidence: 0.7,
  workConfidence: 0.6,
  commuteConfidence: 0.4,
  awayConfidence: 0.5,
  referenceWindowDays: 90,
  referenceMinEvents: 30,
  travelMinDays: 3,
  homeRecurrence: 0.6,
  workRecurrence: 0.5,
  bandConsistency: 0.6,
  homeMinSessionMs: 25 * 60_000,
  commuteMaxSessionMs: 25 * 60_000,
  sessionGapMs: 30 * 60_000,
  periodGapMs: 24 * 60 * 60_000,
  timeBandHours: 2,
  workHourStart: 9,
  workHourEnd: 18,
  workDeviceTypes: ['desktop', 'web'],
  unknownDeviceTypes: ['unknown'],
};

/**
 * Compone i parametri effettivi: defaults + override.
 *
 * L'override è **parziale** e non può rimuovere chiavi: un parametro
 * mancante prende il default ratificato. La chiave `workDeviceTypes` viene
 * copiata in un array nuovo per non condividere il riferimento del default.
 */
export function resolveContextConfig(override?: Partial<ContextConfig>): ContextConfig {
  if (!override) return DEFAULT_CONTEXT_CONFIG;
  return {
    aggregationThreshold:
      override.aggregationThreshold ?? DEFAULT_CONTEXT_CONFIG.aggregationThreshold,
    carConfidence: override.carConfidence ?? DEFAULT_CONTEXT_CONFIG.carConfidence,
    travelConfidence: override.travelConfidence ?? DEFAULT_CONTEXT_CONFIG.travelConfidence,
    homeConfidence: override.homeConfidence ?? DEFAULT_CONTEXT_CONFIG.homeConfidence,
    workConfidence: override.workConfidence ?? DEFAULT_CONTEXT_CONFIG.workConfidence,
    commuteConfidence: override.commuteConfidence ?? DEFAULT_CONTEXT_CONFIG.commuteConfidence,
    awayConfidence: override.awayConfidence ?? DEFAULT_CONTEXT_CONFIG.awayConfidence,
    referenceWindowDays: override.referenceWindowDays ?? DEFAULT_CONTEXT_CONFIG.referenceWindowDays,
    referenceMinEvents: override.referenceMinEvents ?? DEFAULT_CONTEXT_CONFIG.referenceMinEvents,
    travelMinDays: override.travelMinDays ?? DEFAULT_CONTEXT_CONFIG.travelMinDays,
    homeRecurrence: override.homeRecurrence ?? DEFAULT_CONTEXT_CONFIG.homeRecurrence,
    workRecurrence: override.workRecurrence ?? DEFAULT_CONTEXT_CONFIG.workRecurrence,
    bandConsistency: override.bandConsistency ?? DEFAULT_CONTEXT_CONFIG.bandConsistency,
    homeMinSessionMs: override.homeMinSessionMs ?? DEFAULT_CONTEXT_CONFIG.homeMinSessionMs,
    commuteMaxSessionMs: override.commuteMaxSessionMs ?? DEFAULT_CONTEXT_CONFIG.commuteMaxSessionMs,
    sessionGapMs: override.sessionGapMs ?? DEFAULT_CONTEXT_CONFIG.sessionGapMs,
    periodGapMs: override.periodGapMs ?? DEFAULT_CONTEXT_CONFIG.periodGapMs,
    timeBandHours: override.timeBandHours ?? DEFAULT_CONTEXT_CONFIG.timeBandHours,
    workHourStart: override.workHourStart ?? DEFAULT_CONTEXT_CONFIG.workHourStart,
    workHourEnd: override.workHourEnd ?? DEFAULT_CONTEXT_CONFIG.workHourEnd,
    workDeviceTypes: override.workDeviceTypes
      ? [...override.workDeviceTypes]
      : DEFAULT_CONTEXT_CONFIG.workDeviceTypes,
    unknownDeviceTypes: override.unknownDeviceTypes
      ? [...override.unknownDeviceTypes]
      : DEFAULT_CONTEXT_CONFIG.unknownDeviceTypes,
  };
}
