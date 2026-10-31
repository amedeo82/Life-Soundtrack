/**
 * Classificatore di contesto **L1** — 19-GEO-CONTEXT.md §5 (Story 1.6).
 *
 * Algoritmo **deterministico e versionato**, non ML: le stesse regole di
 * `04-ANALYSIS-ALGORITHMS.md` (ricalcolabile, ispezionabile, testabile con
 * fixture). Le regole R1..R7 sono valutate **nell'ordine dichiarato** e vince
 * la prima che scatta.
 *
 * Il perimetro è dichiarato dalla spec:
 *
 * - nessun `outdoors` (non distinguibile da `home` con questi dati);
 * - nessun clustering non supervisionato (i cluster varierebbero fra
 *   esecuzioni e renderebbero il `derivedVersion` non-deterministico);
 * - nessuna inferenza di device oltre `deviceType` (la stringa grezza resta
 *   un dato, non un contesto).
 */

import type { ContextKind, DeviceType, ListenEvent } from '../schema';
import { eventTime } from '../analysis/datetime';
import type { ContextConfig } from './types';

/** Un giorno in millisecondi. */
const DAY_MS = 86_400_000;

/**
 * Regola che ha classificato un periodo.
 *
 * `R1-away` non è una regola nuova: è il **complemento** di R1. R1 dichiara
 * `unknown` quando mancano **sia** il paese **sia** un dispositivo utile; il
 * caso complementare (nessun paese, ma un dispositivo utile) non è
 * `unknown` — è `away`, il kind che la tassonomia di `19§4.3` riserva al
 * "periodo senza dati di paese".
 */
export type ContextRule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R1-away';

/** Sessione di ascolto derivata (MIG-2): il classificatore non la legge dal DB. */
export interface ContextSession {
  /** Inizio della sessione (unix ms UTC). */
  readonly startTime: number;
  /** Fine della sessione (unix ms UTC). */
  readonly endTime: number;
  /** Durata della sessione. */
  readonly durationMs: number;
  /** Dispositivo della sessione. */
  readonly deviceType: DeviceType;
  /** Paese della sessione (null se assente). */
  readonly country: string | null;
  /** Ascolti della sessione. */
  readonly eventCount: number;
  /** Giorno locale della sessione ('YYYY-MM-DD'). */
  readonly dayKey: string;
}

/**
 * Slot di contesto: l'unità di classificazione.
 *
 * È il gruppo (giorno locale × dispositivo): i segnali di `19§5.1` (ora
 * locale, dispositivo, paese, durata della sessione) sono definiti su quel
 * sottoinsieme, e i periodi (`19§4.3`) sono aggregazioni di slot.
 */
export interface ContextSlot {
  /** Chiave stabile: `giorno|dispositivo`. */
  readonly key: string;
  /** Giorno locale ('YYYY-MM-DD'). */
  readonly dayKey: string;
  /** Giorno della settimana 0=domenica..6=sabato. */
  readonly weekday: number;
  /** Inizio della settimana locale (lunedì), in unix ms UTC. */
  readonly weekStart: number;
  /** Dispositivo dello slot. */
  readonly deviceType: DeviceType;
  /** Paese dello slot (moda dei paesi degli ascolti), null se assente. */
  readonly country: string | null;
  /** Sessioni dello slot. */
  readonly sessions: readonly ContextSession[];
  /** Inizio dello slot. */
  readonly startTime: number;
  /** Fine dello slot. */
  readonly endTime: number;
  /** Ascolti dello slot. */
  readonly eventCount: number;
  /** Ore locali degli ascolti dello slot. */
  readonly hours: readonly number[];
  /** Ora locale dominante (moda; a parità la più piccola). */
  readonly dominantHour: number;
  /** Banda oraria dominante (2h, `19§5.2` R4). */
  readonly dominantBand: number;
  /** Quota di ascolti nella banda dominante («stessa fascia oraria»). */
  readonly bandShare: number;
  /** Durata mediana delle sessioni dello slot. */
  readonly medianSessionMs: number;
}

/** Classificazione di uno slot. */
export interface ContextClassification {
  /** Chiave dello slot classificato. */
  readonly slotKey: string;
  /** Giorno locale dello slot. */
  readonly dayKey: string;
  /** Dispositivo dello slot. */
  readonly deviceType: DeviceType;
  /** Paese dello slot. */
  readonly country: string | null;
  /** Contesto dedotto. */
  readonly kind: ContextKind;
  /** Confidenza 0..1. */
  readonly confidence: number;
  /** Regola che ha scattato. */
  readonly rule: ContextRule;
  /** Inizio dello slot. */
  readonly startTime: number;
  /** Fine dello slot. */
  readonly endTime: number;
  /** Ascolti dello slot. */
  readonly eventCount: number;
}

/** Ascolto con le sue parti locali (precalcolate: l'algoritmo gira su 200k righe). */
export interface LocalListen {
  /** L'evento originale. */
  readonly event: ListenEvent;
  /** Inizio ascolto (unix ms UTC). */
  readonly start: number;
  /** Fine ascolto (unix ms UTC). */
  readonly end: number;
  /** Giorno locale ('YYYY-MM-DD'). */
  readonly dayKey: string;
  /** Ora locale 0..23. */
  readonly hour: number;
  /** Giorno della settimana 0=domenica..6=sabato. */
  readonly weekday: number;
  /** Inizio della settimana locale (lunedì), in unix ms UTC. */
  readonly weekStart: number;
}

/**
 * Precalcola le parti locali di ogni ascolto.
 *
 * `Intl` è costoso: il risolutore va riusato, non ricreato per evento.
 */
export function toLocalListens(
  listens: readonly ListenEvent[],
  partsOf: (ms: number) => { dayKey: string; hour: number; weekday: number; weekStart: number },
): LocalListen[] {
  const result: LocalListen[] = [];
  for (const event of listens) {
    const start = eventTime(event);
    const parts = partsOf(start);
    result.push({
      event,
      start,
      end: event.timestamp,
      dayKey: parts.dayKey,
      hour: parts.hour,
      weekday: parts.weekday,
      weekStart: parts.weekStart,
    });
  }
  result.sort((a, b) => a.start - b.start || a.event.eventKey.localeCompare(b.event.eventKey));
  return result;
}

/**
 * Deriva le sessioni di ascolto (MIG-2) usate dal classificatore.
 *
 * Una sessione si spezza quando: passa il gap di inattività, cambia il
 * dispositivo, cambia il paese (entrambi noti) o cambia il giorno locale.
 * Le ultime due condizioni tengono insieme i dati che descrivono **lo stesso
 * contesto**: il classificatore raggruppa per paese e per dispositivo.
 */
export function buildSessions(
  localListens: readonly LocalListen[],
  config: ContextConfig,
): ContextSession[] {
  const sessions: ContextSession[] = [];
  /** Sessione in costruzione (mutabile: si estende ascolto per ascolto). */
  interface WorkingSession {
    startTime: number;
    endTime: number;
    deviceType: DeviceType;
    country: string | null;
    eventCount: number;
    dayKey: string;
  }
  let current: WorkingSession | null = null;

  for (const listen of localListens) {
    const country = listen.event.country;
    if (current === null) {
      current = {
        startTime: listen.start,
        endTime: listen.end,
        deviceType: listen.event.deviceType,
        country,
        eventCount: 1,
        dayKey: listen.dayKey,
      };
      continue;
    }
    const active: WorkingSession = current;
    const continues =
      listen.start - active.endTime <= config.sessionGapMs &&
      listen.event.deviceType === active.deviceType &&
      (country === null || active.country === null || country === active.country) &&
      listen.dayKey === active.dayKey;
    if (!continues) {
      sessions.push({
        startTime: active.startTime,
        endTime: active.endTime,
        durationMs: active.endTime - active.startTime,
        deviceType: active.deviceType,
        country: active.country,
        eventCount: active.eventCount,
        dayKey: active.dayKey,
      });
      current = {
        startTime: listen.start,
        endTime: listen.end,
        deviceType: listen.event.deviceType,
        country,
        eventCount: 1,
        dayKey: listen.dayKey,
      };
      continue;
    }
    active.endTime = Math.max(active.endTime, listen.end);
    active.eventCount += 1;
  }

  if (current !== null) {
    sessions.push({
      startTime: current.startTime,
      endTime: current.endTime,
      durationMs: current.endTime - current.startTime,
      deviceType: current.deviceType,
      country: current.country,
      eventCount: current.eventCount,
      dayKey: current.dayKey,
    });
  }
  return sessions;
}

/** Accumulatore interno di uno slot (costruito ascolto per ascolto). */
interface SlotAccumulator {
  readonly key: string;
  readonly dayKey: string;
  readonly weekday: number;
  readonly weekStart: number;
  readonly deviceType: DeviceType;
  readonly countryCounts: Map<string, number>;
  countryNulls: number;
  readonly sessions: ContextSession[];
  startTime: number;
  endTime: number;
  eventCount: number;
  readonly hours: number[];
}

/**
 * Raggruppa gli ascolti in slot (giorno locale × dispositivo).
 *
 * Lo slot è l'unità su cui le regole sono definite: paese, ora locale,
 * dispositivo, durata della sessione e ricorrenza settimanale sono tutti
 * segnali definiti **dentro** uno slot (`19§5.1`).
 */
export function buildSlots(
  localListens: readonly LocalListen[],
  sessions: readonly ContextSession[],
  config: ContextConfig,
): ContextSlot[] {
  const accumulators = new Map<string, SlotAccumulator>();

  for (const listen of localListens) {
    const key = `${listen.dayKey}|${listen.event.deviceType}`;
    const existing = accumulators.get(key);
    if (existing === undefined) {
      accumulators.set(key, {
        key,
        dayKey: listen.dayKey,
        weekday: listen.weekday,
        weekStart: listen.weekStart,
        deviceType: listen.event.deviceType,
        countryCounts: new Map(),
        countryNulls: 0,
        sessions: [],
        startTime: listen.start,
        endTime: listen.end,
        eventCount: 1,
        hours: [listen.hour],
      });
      const created = accumulators.get(key);
      if (created) countCountry(created, listen.event.country);
      continue;
    }
    countCountry(existing, listen.event.country);
    existing.startTime = Math.min(existing.startTime, listen.start);
    existing.endTime = Math.max(existing.endTime, listen.end);
    existing.eventCount += 1;
    existing.hours.push(listen.hour);
  }

  // Associa le sessioni agli slot (una sessione vive nel giorno del suo inizio).
  for (const session of sessions) {
    const accumulator = accumulators.get(`${session.dayKey}|${session.deviceType}`);
    if (accumulator) accumulator.sessions.push(session);
  }

  const slots: ContextSlot[] = [];
  for (const accumulator of accumulators.values()) {
    const hours = accumulator.hours;
    const dominantHour = modeOf(hours);
    const dominantBand = bandOf(dominantHour, config);
    const bandCount = hours.filter((hour) => bandOf(hour, config) === dominantBand).length;
    slots.push({
      key: accumulator.key,
      dayKey: accumulator.dayKey,
      weekday: accumulator.weekday,
      weekStart: accumulator.weekStart,
      deviceType: accumulator.deviceType,
      country: modeOfCodes([...accumulator.countryCounts.keys()]),
      sessions: accumulator.sessions,
      startTime: accumulator.startTime,
      endTime: accumulator.endTime,
      eventCount: accumulator.eventCount,
      hours,
      dominantHour,
      dominantBand,
      bandShare: bandCount / hours.length,
      medianSessionMs: medianOf(accumulator.sessions.map((session) => session.durationMs)),
    });
  }
  slots.sort((a, b) => a.startTime - b.startTime || a.key.localeCompare(b.key));
  return slots;
}

/**
 * Paese di riferimento — 19-GEO-CONTEXT.md §5.3.
 *
 * Moda dei paesi degli ultimi 90 giorni **con almeno 30 eventi**; in mancanza
 * di quella condizione, il paese più frequente dell'intero storico. A parità
 * di conteggio vince il codice **minimo**: la scelta deve essere
 * deterministica, altrimenti la stessa cronologia produrrebbe periodi
 * diversi fra due esecuzioni.
 */
export function computeReferenceCountry(
  listens: readonly ListenEvent[],
  now: number,
  config: ContextConfig,
): string | null {
  const windowStart = now - config.referenceWindowDays * DAY_MS;
  const inWindow = new Map<string, number>();
  const overall = new Map<string, number>();
  for (const listen of listens) {
    const country = listen.country;
    if (!country) continue;
    overall.set(country, (overall.get(country) ?? 0) + 1);
    if (listen.timestamp >= windowStart) {
      inWindow.set(country, (inWindow.get(country) ?? 0) + 1);
    }
  }
  const windowWinner = modeOfCounted(inWindow);
  if (windowWinner !== null && (inWindow.get(windowWinner) ?? 0) >= config.referenceMinEvents) {
    return windowWinner;
  }
  return modeOfCounted(overall);
}

/** Indice di ricorrenza settimanale per pattern (dispositivo + banda oraria). */
export interface RecurrenceIndex {
  /** Settimane coperte dai dati. */
  readonly totalWeeks: number;
  /** Settimane in cui ogni pattern compare. */
  readonly weeksByPattern: ReadonlyMap<string, ReadonlySet<number>>;
}

/** Costruisce l'indice di ricorrenza settimanale (`19§5.1`). */
export function buildRecurrenceIndex(slots: readonly ContextSlot[]): RecurrenceIndex {
  const weeks = new Set<number>();
  const weeksByPattern = new Map<string, Set<number>>();
  for (const slot of slots) {
    weeks.add(slot.weekStart);
    const pattern = patternKeyOf(slot);
    const bucket = weeksByPattern.get(pattern) ?? new Set<number>();
    bucket.add(slot.weekStart);
    weeksByPattern.set(pattern, bucket);
  }
  return { totalWeeks: weeks.size, weeksByPattern };
}

/** Quota di settimane in cui il pattern dello slot ricorre (0..1). */
export function recurrenceOf(slot: ContextSlot, index: RecurrenceIndex): number {
  if (index.totalWeeks === 0) return 0;
  const weeks = index.weeksByPattern.get(patternKeyOf(slot));
  if (!weeks) return 0;
  return weeks.size / index.totalWeeks;
}

/** Pattern di ricorrenza: dispositivo + banda oraria. */
export function patternKeyOf(slot: ContextSlot): string {
  return `${slot.deviceType}|${slot.dominantBand}`;
}

/**
 * Paese dominante per giorno locale.
 *
 * Serve a R3: un viaggio è una **sequenza** di giorni fuori dal paese di
 * riferimento, non un singolo evento.
 */
export function computeDayCountries(
  localListens: readonly LocalListen[],
): Map<string, string | null> {
  const counts = new Map<string, Map<string, number>>();
  for (const listen of localListens) {
    const country = listen.event.country;
    if (!country) continue;
    const dayCounts = counts.get(listen.dayKey) ?? new Map<string, number>();
    dayCounts.set(country, (dayCounts.get(country) ?? 0) + 1);
    counts.set(listen.dayKey, dayCounts);
  }
  const result = new Map<string, string | null>();
  for (const [dayKey, dayCounts] of counts) {
    result.set(dayKey, modeOfCodes([...dayCounts.keys()]));
  }
  return result;
}

/**
 * Giorni consecutivi fuori dal paese di riferimento (lunghezza del *run*).
 *
 * R3 scatta da **3 giorni** (`19§5.2`): un cambio di paese improvviso è
 * E18 (`travel`, non errore) e un singolo giorno non basta a parlare di
 * viaggio.
 *
 * La lunghezza è quella dell'intero **run** di giorni esteri che contiene il
 * giorno dello slot, non quella dei giorni trascorsi: il ricalcolo lavora
 * sulla cronologia completa, quindi un viaggio di tre giorni è viaggio per
 * tutti e tre i giorni (il primo giorno non resta "sconosciuto" solo perché
 * quando è stato osservato il secondo non c'era ancora il terzo).
 */
export function consecutiveForeignDays(
  slot: ContextSlot,
  referenceCountry: string | null,
  dayCountries: ReadonlyMap<string, string | null>,
): number {
  if (!slot.country || referenceCountry === null || slot.country === referenceCountry) return 0;
  let days = 0;
  // Limite di 366 iterazioni per lato: il percorso non può superare un anno.
  let before = slot.dayKey;
  for (let guard = 0; guard < 366; guard += 1) {
    if (dayCountries.get(before) !== slot.country) break;
    days += 1;
    before = previousDay(before);
  }
  let after = slot.dayKey;
  for (let guard = 0; guard < 366; guard += 1) {
    if (dayCountries.get(after) !== slot.country) break;
    days += 1;
    after = nextDay(after);
  }
  // Il giorno dello slot è contato due volte (una per lato).
  return Math.max(0, days - 1);
}

/** Input della classificazione di uno slot. */
export interface ClassifySlotInput {
  /** Slot da classificare. */
  readonly slot: ContextSlot;
  /** Paese di riferimento. */
  readonly referenceCountry: string | null;
  /** Consenso `carDetectionConsent` (gate di `19§5.3`). */
  readonly carDetectionConsent: boolean;
  /** Giorni consecutivi fuori dal paese di riferimento. */
  readonly travelDays: number;
  /** Ricorrenza settimanale del pattern dello slot (0..1). */
  readonly recurrence: number;
  /** Parametri del classificatore. */
  readonly config: ContextConfig;
}

/**
 * Applica R1..R7 a uno slot, nell'ordine dichiarato.
 *
 * La prima regola che scatta vince: R2 (auto) precede R3 (viaggio), che
 * precede R4 (casa) e R5 (lavoro), che precedono R6 (spostamento) e R7
 * (nessuna delle precedenti).
 */
export function classifySlot(input: ClassifySlotInput): ContextClassification {
  const { slot, referenceCountry, carDetectionConsent, travelDays, recurrence, config } = input;
  const usefulDevice = !config.unknownDeviceTypes.includes(slot.deviceType);

  const base = {
    slotKey: slot.key,
    dayKey: slot.dayKey,
    deviceType: slot.deviceType,
    country: slot.country,
    startTime: slot.startTime,
    endTime: slot.endTime,
    eventCount: slot.eventCount,
  };

  // R1 — nessun paese e nessun dispositivo utile: segnali insufficienti.
  if (!slot.country && !usefulDevice) {
    return { ...base, kind: 'unknown', confidence: 0, rule: 'R1' };
  }

  // R2 — ascolto in auto. Il gate `carDetectionConsent` è applicato in
  // scrittura dalla pipeline (`applyCarConsent`, issue #109): senza consenso
  // `deviceType='car'` non viene persistito. Il classificatore verifica il
  // consenso lo stesso: una classificazione `car` senza consenso è
  // impossibile per costruzione, non per convenzione.
  if (slot.deviceType === 'car' && carDetectionConsent) {
    return { ...base, kind: 'car', confidence: config.carConfidence, rule: 'R2' };
  }

  // R3 — paese diverso dal paese di riferimento per almeno 3 giorni.
  if (
    slot.country !== null &&
    referenceCountry !== null &&
    slot.country !== referenceCountry &&
    travelDays >= config.travelMinDays
  ) {
    return { ...base, kind: 'travel', confidence: config.travelConfidence, rule: 'R3' };
  }

  const inReferenceCountry = slot.country !== null && slot.country === referenceCountry;

  // R4 — casa: paese di riferimento, fascia oraria **non** lavorativa
  // (sera/notte/mattino presto), stessa banda oraria, pattern che ricorre in
  // almeno il 60% delle settimane e sessioni abbastanza lunghe da essere un
  // cluster domestico (scelta dichiarata: vedi `homeMinSessionMs`).
  if (
    inReferenceCountry &&
    !isWorkHour(slot.dominantHour, config) &&
    slot.bandShare >= config.bandConsistency &&
    slot.medianSessionMs >= config.homeMinSessionMs &&
    recurrence >= config.homeRecurrence
  ) {
    return { ...base, kind: 'home', confidence: config.homeConfidence, rule: 'R4' };
  }

  // R5 — lavoro: paese di riferimento, ore 09-18 feriali, dispositivo
  // desktop/web e ricorrenza in almeno il 50% delle settimane.
  if (
    inReferenceCountry &&
    isWorkHour(slot.dominantHour, config) &&
    isWeekday(slot.weekday) &&
    config.workDeviceTypes.includes(slot.deviceType) &&
    recurrence >= config.workRecurrence
  ) {
    return { ...base, kind: 'work', confidence: config.workConfidence, rule: 'R5' };
  }

  // R6 — spostamento: dispositivo mobile, sessioni brevi, fuori dai cluster
  // R4/R5 (che non hanno scattato). Confidenza 0.4: **sotto** la soglia,
  // quindi il periodo non viene aggregato (`19§5.2`).
  if (slot.deviceType === 'mobile' && slot.medianSessionMs < config.commuteMaxSessionMs) {
    return { ...base, kind: 'commute', confidence: config.commuteConfidence, rule: 'R6' };
  }

  // R7 — nessuna delle precedenti. Il caso "nessun paese ma dispositivo
  // utile" è `away` (periodo senza dati di paese, `19§4.3`), non `unknown`.
  if (!slot.country && usefulDevice) {
    return { ...base, kind: 'away', confidence: config.awayConfidence, rule: 'R1-away' };
  }

  return { ...base, kind: 'unknown', confidence: 0, rule: 'R7' };
}

/** L'ora locale cade nella fascia lavorativa? */
export function isWorkHour(hour: number, config: ContextConfig): boolean {
  return hour >= config.workHourStart && hour < config.workHourEnd;
}

/** La giornata locale è un giorno feriale (lunedì..venerdì)? */
export function isWeekday(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

/** Banda oraria di un'ora (2h di default, `19§5.2` R4). */
export function bandOf(hour: number, config: ContextConfig): number {
  return Math.floor(hour / config.timeBandHours) * config.timeBandHours;
}

/** Conta il paese di un ascolto nello slot. */
function countCountry(accumulator: SlotAccumulator, country: string | null): void {
  if (country === null) {
    accumulator.countryNulls += 1;
    return;
  }
  accumulator.countryCounts.set(country, (accumulator.countryCounts.get(country) ?? 0) + 1);
}

/** Moda di una lista di numeri (a parità vince il più piccolo). */
export function modeOf(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = -1;
  for (const [value, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best ?? 0;
}

/** Moda di una lista di codici paese (a parità vince il minore). */
export function modeOfCodes(codes: readonly string[]): string | null {
  if (codes.length === 0) return null;
  const counts = new Map<string, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = -1;
  for (const [code, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Moda di un conteggio `codice → numero`.
 *
 * Vince il codice con **più eventi**; a parità vince il codice minimo (la
 * scelta deve essere deterministica). Diversamente da `modeOfCodes`, che
 * pesa ogni elemento una volta, qui conta i valori.
 */
export function modeOfCounted(counts: ReadonlyMap<string, number>): string | null {
  let best: string | null = null;
  let bestCount = -1;
  for (const [code, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

/** Mediana di una lista di numeri (media dei due centrali se pari). */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Giorno locale precedente, in chiave 'YYYY-MM-DD'. */
function previousDay(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const previous = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) - 1));
  return previous.toISOString().slice(0, 10);
}

/** Giorno locale successivo, in chiave 'YYYY-MM-DD'. */
function nextDay(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + 1));
  return next.toISOString().slice(0, 10);
}
