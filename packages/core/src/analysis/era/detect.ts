/**
 * Rilevamento delle ere — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §5.2.
 *
 * L'algoritmo è **change point detection**, non clustering non supervisionato
 * (esclusione dichiarata in 04§5): si comparano le firme di finestre
 * **adiacenti** e, dove la similarità crolla sotto la soglia, nasce un
 * confine. Nessun centroide, nessuna gerarchia, nessuna inizializzazione
 * casuale: lo stesso input produce sempre le stesse ere (D.69.1).
 *
 * I passi sono quelli dello pseudocodice di 04§5.2:
 *
 * 1. `computeWeeklySignatures` — una firma per finestra;
 * 2. `detectChangePoints` — i confini, dove la similarità crolla;
 * 3. `buildEras` — le ere, come segmenti fra un confine e il successivo.
 */

import type { AudioFeatures, ListenEvent, Track } from '../../schema';
import { DAY_MS, eventTime } from '../datetime';
import { signatureSimilarity } from './similarity';
import { computeSignature, type EraSignature } from './signature';
import type { EraConfig } from './types';

/** Una finestra analizzata e la sua firma. */
export interface EraWindow {
  /** Inizio della finestra (unix ms UTC). */
  readonly start: number;
  /** Fine della finestra (unix ms UTC, semi-aperta). */
  readonly end: number;
  /** Firma degli ascolti nella finestra. */
  readonly signature: EraSignature;
}

/**
 * Le firme delle finestre — 04§5.2 (`computeWeeklySignatures`).
 *
 * La finestra scorre di `stepDays` giorni e copre `windowDays` giorni; una
 * finestra con **meno di `minEventsPerWindow` ascolti** è scartata (non è
 * confrontabile: i suoi generi e i suoi artisti dipenderebbero da due o tre
 * ascolti).
 *
 * @param events - ascolti ordinati per istante di inizio.
 * @param tracks - indice dei brani per `trackId`.
 * @param features - indice delle feature utilizzabili per `trackId` (21§12).
 */
export function computeWeeklySignatures(
  events: readonly ListenEvent[],
  tracks: ReadonlyMap<string, Track>,
  features: ReadonlyMap<string, AudioFeatures>,
  config: EraConfig,
): EraWindow[] {
  if (events.length === 0) return [];

  const windowMs = config.windowDays * DAY_MS;
  const stepMs = config.stepDays * DAY_MS;
  const start = eventTime(events[0]!);
  const end = events[events.length - 1]!.timestamp;

  const windows: EraWindow[] = [];
  let cursor = start;
  let index = 0;

  while (cursor < end) {
    const windowEnd = cursor + windowMs;
    // Gli ascolti sono ordinati: si avanza l'indice invece di riscanere.
    while (index < events.length && eventTime(events[index]!) < cursor) index += 1;
    const windowEvents: ListenEvent[] = [];
    let scan = index;
    while (scan < events.length && eventTime(events[scan]!) < windowEnd) {
      windowEvents.push(events[scan]!);
      scan += 1;
    }
    if (windowEvents.length >= config.minEventsPerWindow) {
      windows.push({
        start: cursor,
        end: windowEnd,
        signature: computeSignature(windowEvents, tracks, features),
      });
    }
    cursor += stepMs;
  }

  return windows;
}

/**
 * I confini fra un'era e la successiva — 04§5.2 (`detectChangePoints`).
 *
 * Un confine nasce dove la similarità fra due finestre **adiacenti** scende
 * sotto `similarityThreshold`: il confine è l'inizio della finestra che
 * **inizia** la nuova era.
 */
export function detectChangePoints(windows: readonly EraWindow[], config: EraConfig): number[] {
  const changePoints: number[] = [];
  for (let i = 1; i < windows.length; i += 1) {
    const similarity = signatureSimilarity(
      windows[i - 1]!.signature,
      windows[i]!.signature,
      config.weights,
    );
    if (similarity < config.similarityThreshold) {
      changePoints.push(windows[i]!.start);
    }
  }
  return changePoints;
}

/** Un'era: il segmento fra due confini, con la sua firma. */
export interface EraDraft {
  /** Inizio dell'era (unix ms UTC, incluso). */
  readonly start: number;
  /** Fine dell'era (unix ms UTC, esclusa). */
  readonly end: number;
  /** Ascolti dell'era. */
  readonly events: readonly ListenEvent[];
  /** Firma degli ascolti dell'era. */
  readonly signature: EraSignature;
}

/**
 * Le ere — 04§5.2 (`buildEras`).
 *
 * I confini sono `[inizio, ...changePoints, fine]`: le ere sono i segmenti
 * fra due confini consecutivi. Le ere sono **disgiunte** e, prima del filtro
 * `minEraDays`, **coprono** l'intero periodo analizzato (04§5.5).
 *
 * Il filtro `minEraDays` (passo 4 dello pseudocodice) lascia dei **buchi**:
 * un segmento scartato non viene fuso con il vicino, perché fusesi
 * produrrebbe un'era che non corrisponde a nessun confine rilevato. È la
 * conseguenza dichiarata del filtro (D.69.6).
 */
export function buildEras(
  events: readonly ListenEvent[],
  changePoints: readonly number[],
  tracks: ReadonlyMap<string, Track>,
  features: ReadonlyMap<string, AudioFeatures>,
): EraDraft[] {
  if (events.length === 0) return [];

  const boundaries = [eventTime(events[0]!), ...changePoints, lastEventEnd(events)];
  const eras: EraDraft[] = [];
  let cursor = 0;

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i]!;
    const end = boundaries[i + 1]!;
    if (end <= start) continue;

    const eraEvents: ListenEvent[] = [];
    while (cursor < events.length && eventTime(events[cursor]!) < end) {
      if (eventTime(events[cursor]!) >= start) eraEvents.push(events[cursor]!);
      cursor += 1;
    }

    eras.push({
      start,
      end,
      events: eraEvents,
      signature: computeSignature(eraEvents, tracks, features),
    });
  }

  return eras;
}

/**
 * La fine del periodo analizzato: la fine dell'ultimo ascolto.
 *
 * È il `timestamp` massimo: l'ultimo ascolto può essere iniziato prima della
 * fine di un ascolto precedente (un brano più lungo iniziato prima).
 */
function lastEventEnd(events: readonly ListenEvent[]): number {
  let end = events[0]!.timestamp;
  for (const event of events) {
    if (event.timestamp > end) end = event.timestamp;
  }
  return end;
}

/** La durata dell'era, in giorni. */
export function eraDurationDays(era: EraDraft): number {
  return (era.end - era.start) / DAY_MS;
}
