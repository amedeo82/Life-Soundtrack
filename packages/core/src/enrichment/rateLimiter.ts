/**
 * Rate limiting della pipeline — `21-AUDIO-FEATURES.md` v1.0 🟢 §7.2
 * (D-AF.6).
 *
 * Due implementazioni, per due nature diverse di limite:
 *
 * - **a intervallo fisso**: il limite è noto e pubblicato (MusicBrainz
 *   1 req/s, iTunes ~20 req/min). Nessuna costante **hidden**: il valore è
 *   dichiarato qui e copre da un test.
 * - **a header**: il limite di AcousticBrainz **cambia** e viene
 *   comunicato dalla risposta (`X-RateLimit-Limit`, `-Remaining`, `-Reset-In`).
 *   Nessuna costante hard-coded: il limiter legge, deduce e aspetta.
 *
 * Il limiter è una **porta** (`RateLimiter`): i provider non conoscono i
 * dettagli, il test può iniettare `clock` e `sleep` e così verificare i
 * tempi senza attendere davvero.
 */

import type { Clock, RateLimiter, Sleep } from './types';

/**
 * L'intervallo minimo fra due richieste a MusicBrainz: **1 req/s**.
 *
 * Valore noto e pubblicato (AC della Story 4.1, D-AF.6). Il *lookup*
 * MusicBrainz è la Story 4.2: qui viene consegnato il **limiter** e il suo
 * test, non il client di lookup.
 */
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1_000;

/**
 * L'intervallo minimo fra due richieste all'iTunes Search API: **3 s**.
 *
 * Il limite pubblicato è di ~20 richieste al minuto (21§6.6): 3000 ms
 * danno 20/min con margine.
 */
export const ITUNES_MIN_INTERVAL_MS = 3_000;

/** Opzioni del limiter a intervallo fisso. */
export interface FixedIntervalLimiterOptions {
  /** L'intervallo minimo fra due richieste, in ms. */
  readonly intervalMs: number;
  /** L'orologio iniettato. */
  readonly clock: Clock;
  /** L'attesa iniettata. */
  readonly sleep: Sleep;
}

/**
 * Un limiter a **intervallo fisso**: garantisce almeno `intervalMs` fra due
 * richieste consecutive.
 *
 * Le acquisizioni sono serializzate: due chiamanti concurrenti non
 * "condividono" lo stesso slot (la pipeline ha concurrency 1, ma il limiter
 * è comunque difensivo).
 */
export function createFixedIntervalLimiter(options: FixedIntervalLimiterOptions): RateLimiter {
  const { intervalMs, clock, sleep } = options;
  let lastRequestAt: number | null = null;
  let chain: Promise<void> = Promise.resolve();

  const acquireSlot = async (): Promise<void> => {
    const now = clock.now();
    if (lastRequestAt !== null) {
      const wait = lastRequestAt + intervalMs - now;
      if (wait > 0) await sleep(wait);
    }
    lastRequestAt = clock.now();
  };

  return {
    acquire(): Promise<void> {
      const next = chain.then(acquireSlot, acquireSlot);
      chain = next.catch(() => undefined);
      return next;
    },
    observe(): void {
      // Il limite di un intervallo fisso non cambia: gli header non lo
      // influenzano (D-AF.6 li rende vincolanti solo per AcousticBrainz).
    },
    cooldown(ms: number): void {
      const until = clock.now() + Math.max(0, ms);
      lastRequestAt = Math.max(lastRequestAt ?? 0, until - intervalMs);
    },
  };
}

/**
 * Crea il limiter di **MusicBrainz** (1 req/s, valore pubblicato).
 *
 * @param clock - l'orologio iniettato.
 * @param sleep - l'attesa iniettata.
 * @returns il limiter MusicBrainz.
 */
export function createMusicBrainzLimiter(clock: Clock, sleep: Sleep): RateLimiter {
  return createFixedIntervalLimiter({
    intervalMs: MUSICBRAINZ_MIN_INTERVAL_MS,
    clock,
    sleep,
  });
}

/**
 * Crea il limiter dell'**iTunes Search API** (~20 req/min).
 *
 * @param clock - l'orologio iniettato.
 * @param sleep - l'attesa iniettata.
 * @returns il limiter iTunes.
 */
export function createItunesLimiter(clock: Clock, sleep: Sleep): RateLimiter {
  return createFixedIntervalLimiter({
    intervalMs: ITUNES_MIN_INTERVAL_MS,
    clock,
    sleep,
  });
}

/** Opzioni del limiter a header. */
export interface HeaderRateLimiterOptions {
  /** L'orologio iniettato. */
  readonly clock: Clock;
  /** L'attesa iniettata. */
  readonly sleep: Sleep;
}

/** I nomi dei header di rate limit di AcousticBrainz (21§7.2). */
export const RATE_LIMIT_HEADERS = {
  limit: 'x-ratelimit-limit',
  remaining: 'x-ratelimit-remaining',
  resetIn: 'x-ratelimit-reset-in',
} as const;

/**
 * Un limiter **a header**: il limite non è nel codice, è nella risposta.
 *
 * Il ciclo è:
 *
 * 1. `observe()` registra `Limit`, `Remaining` e `Reset-In` (in secondi);
 * 2. `acquire()` aspetta `Reset-In` se `Remaining` è 0;
 * 3. dopo un 429 il provider chiama `cooldown()` con il `Retry-After`.
 *
 * Prima della prima risposta non c'è alcun limite noto: il limiter non
 * blocca (è la documentazione che dichiara "tipicamente 10 query ogni 10
 * secondi", ma un valore hard-coded sbaglierebbe in entrambe le direzioni —
 * D-AF.6).
 */
export function createHeaderRateLimiter(options: HeaderRateLimiterOptions): RateLimiter {
  const { clock, sleep } = options;
  let remaining: number | null = null;
  let resetAt: number | null = null;
  let cooldownUntil: number | null = null;
  let chain: Promise<void> = Promise.resolve();

  const acquireSlot = async (): Promise<void> => {
    const now = clock.now();
    if (cooldownUntil !== null && cooldownUntil > now) {
      await sleep(cooldownUntil - now);
    }
    const afterCooldown = clock.now();
    if (remaining !== null && remaining <= 0 && resetAt !== null && resetAt > afterCooldown) {
      await sleep(resetAt - afterCooldown);
      remaining = null;
      resetAt = null;
    }
  };

  return {
    acquire(): Promise<void> {
      const next = chain.then(acquireSlot, acquireSlot);
      chain = next.catch(() => undefined);
      return next;
    },
    observe(headers: Readonly<Record<string, string>>): void {
      const limit = Number(headers[RATE_LIMIT_HEADERS.limit]);
      const left = Number(headers[RATE_LIMIT_HEADERS.remaining]);
      const resetIn = Number(headers[RATE_LIMIT_HEADERS.resetIn]);
      if (Number.isFinite(limit)) {
        remaining = limit;
      }
      if (Number.isFinite(left)) {
        remaining = left;
      }
      if (Number.isFinite(resetIn)) {
        resetAt = clock.now() + Math.max(0, resetIn) * 1000;
      }
    },
    cooldown(ms: number): void {
      const until = clock.now() + Math.max(0, ms);
      cooldownUntil = cooldownUntil === null ? until : Math.max(cooldownUntil, until);
    },
  };
}

/**
 * Crea il limiter di **AcousticBrainz**, basato sugli header.
 *
 * @param clock - l'orologio iniettato.
 * @param sleep - l'attesa iniettata.
 * @returns il limiter AcousticBrainz.
 */
export function createAcousticBrainzLimiter(clock: Clock, sleep: Sleep): RateLimiter {
  return createHeaderRateLimiter({ clock, sleep });
}

/**
 * Il ritardo indicato dall'header `Retry-After`, in ms.
 *
 * `Retry-After` può essere un numero di secondi o una data HTTP: le due
 * forme sono entrambe gestite, un valore non interpretabile dà 0 (nessun
 * ritardo aggiuntivo oltre a quello già imposto dal limiter).
 *
 * @param headers - gli header della risposta 429.
 * @param now - l'orologio corrente (unix ms).
 * @returns il ritardo in ms.
 */
export function parseRetryAfterMs(headers: Readonly<Record<string, string>>, now: number): number {
  const raw = headers['retry-after'];
  if (raw === undefined) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(raw);
  if (Number.isNaN(date)) return 0;
  return Math.max(0, date - now);
}
