/**
 * Risoluzione dell'ora **locale** dell'utente — 19-GEO-CONTEXT.md §5.1
 * (`ora locale | startedAt in userTimezone (IANA) | medio-alto`).
 *
 * Il classificatore L1 lavora su segnali locali (fasce orarie, giorni della
 * settimana, ricorrenza settimanale): senza il fuso dell'utente il pattern
 * "ascolto la sera" crollerebbe su un utente non UTC. Il fuso è un **dato**
 * (lo conserva l'app, `19§5.3`), non un parametro dell'algoritmo: non entra
 * quindi nel `derivedVersion`.
 *
 * La conversione usa solo `Intl` (nessuna dipendenza): è disponibile in ogni
 * browser supportato (`05§10`) e in Node 20, che è il runtime dei test.
 */

/** Parti della data in ora locale. */
export interface LocalParts {
  /** Anno locale. */
  readonly year: number;
  /** Mese locale 1..12. */
  readonly month: number;
  /** Giorno locale 1..31. */
  readonly day: number;
  /** Ora locale 0..23. */
  readonly hour: number;
  /** Minuto locale 0..59. */
  readonly minute: number;
  /** Secondo locale 0..59. */
  readonly second: number;
  /** Giorno della settimana 0=domenica..6=sabato (convenzione `Date`). */
  readonly weekday: number;
  /** Chiave del giorno locale, 'YYYY-MM-DD'. */
  readonly dayKey: string;
  /** Inizio della settimana locale (lunedì), in unix ms UTC. */
  readonly weekStart: number;
}

/** Un giorno in millisecondi. */
const DAY_MS = 86_400_000;

/**
 * Risolutore di ora locale per un fuso IANA.
 *
 * Un fuso non valido non deve far crashare l'analisi: il risolutore
 * degrada a **UTC** (gli stessi confini che usa il resto del layer di
 * analisi, `analysis/datetime.ts`).
 */
export class LocalTime {
  /** Fuso effettivo (quello richiesto, o 'UTC' se non valido). */
  readonly timeZone: string;

  private readonly formatter: Intl.DateTimeFormat;
  private readonly fallback: boolean;

  constructor(timeZone: string) {
    let resolved = timeZone;
    let fallback = false;
    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: resolved,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      // Fuso IANA inesistente: degrada a UTC senza sollevare.
      resolved = 'UTC';
      fallback = true;
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: resolved,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    this.timeZone = resolved;
    this.fallback = fallback;
    this.formatter = formatter;
  }

  /** True se il fuso richiesto non era valido e il risolutore è degradato a UTC. */
  get isFallback(): boolean {
    return this.fallback;
  }

  /** Parti locali dell'istante (unix ms UTC). */
  parts(ms: number): LocalParts {
    const values = this.formatter.formatToParts(new Date(ms));
    const year = readPart(values, 'year');
    const month = readPart(values, 'month');
    const day = readPart(values, 'day');
    const hour = readPart(values, 'hour');
    const minute = readPart(values, 'minute');
    const second = readPart(values, 'second');
    const dayKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      weekday,
      dayKey,
      weekStart: startOfLocalWeek(year, month, day),
    };
  }

  /** Chiave del giorno locale dell'istante, 'YYYY-MM-DD'. */
  dayKey(ms: number): string {
    return this.parts(ms).dayKey;
  }
}

/** Legge un campo numerico dalla formattazione locale. */
function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const part = parts.find((candidate) => candidate.type === type);
  return part ? Number(part.value) : 0;
}

/**
 * Inizio della settimana locale (lunedì), in unix ms UTC.
 *
 * La chiave di settimana è calcolata sulla data locale, non sull'istante:
 * due eventi della stessa settimana locale condividono la chiana anche se
 * l'offset UTC li colloca in giorni diversi.
 */
function startOfLocalWeek(year: number, month: number, day: number): number {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  // 0=domenica: la settimana locale parte il lunedì.
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return Date.UTC(year, month - 1, day + offset);
}

/** Chiave del giorno locale precedente ('YYYY-MM-DD'), in unix ms UTC. */
export function previousDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const previous = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) - 1));
  return previous.toISOString().slice(0, 10);
}

/** Chiave del giorno locale successivo ('YYYY-MM-DD'), in unix ms UTC. */
export function nextDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + 1));
  return next.toISOString().slice(0, 10);
}

/** Differenza in giorni fra due chiavi di giorno locale. */
export function dayKeyDistance(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromMs = Date.UTC(fy ?? 1970, (fm ?? 1) - 1, fd ?? 1);
  const toMs = Date.UTC(ty ?? 1970, (tm ?? 1) - 1, td ?? 1);
  return Math.round((toMs - fromMs) / DAY_MS);
}
