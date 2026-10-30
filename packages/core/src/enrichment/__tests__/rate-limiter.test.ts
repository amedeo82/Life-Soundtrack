import { describe, expect, it } from 'vitest';
import {
  ITUNES_MIN_INTERVAL_MS,
  MUSICBRAINZ_MIN_INTERVAL_MS,
  createAcousticBrainzLimiter,
  createFixedIntervalLimiter,
  createHeaderRateLimiter,
  createItunesLimiter,
  createMusicBrainzLimiter,
  parseRetryAfterMs,
} from '../rateLimiter';
import { createFakeClock, createFakeSleep, loadApiMock } from './helpers';

/**
 * Il rate limiting — `21-AUDIO-FEATURES.md` §7.2 (D-AF.6), T-AF.9.
 *
 * Il punto della spec è che **due** limiti hanno due nature diverse:
 * MusicBrainz ha un limite noto (1 req/s), AcousticBrainz lo
 * **comunica** e il valore cambia: il limiter deve leggere gli header.
 */
describe('limiter a intervallo fisso (MusicBrainz 1 req/s)', () => {
  it('due richieste consecutive sono separate da almeno 1 secondo', async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const limiter = createMusicBrainzLimiter(clock, sleep);

    await limiter.acquire();
    await limiter.acquire();

    expect(MUSICBRAINZ_MIN_INTERVAL_MS).toBe(1_000);
    expect(waits).toEqual([1_000]);
  });

  it('la prima richiesta non attende', async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const limiter = createMusicBrainzLimiter(clock, sleep);

    await limiter.acquire();

    expect(waits).toEqual([]);
  });

  it('le richieste sono serializzate: due acquirer non condividono lo slot', async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const limiter = createMusicBrainzLimiter(clock, sleep);

    await Promise.all([limiter.acquire(), limiter.acquire()]);

    expect(waits).toEqual([1_000]);
  });

  it("l'iTunes rispetta ~20 req/min (3 s)", async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const limiter = createItunesLimiter(clock, sleep);

    await limiter.acquire();
    await limiter.acquire();

    expect(ITUNES_MIN_INTERVAL_MS).toBe(3_000);
    expect(waits).toEqual([3_000]);
  });

  it('un cooldown blocca il limiter per il tempo indicato', async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const limiter = createFixedIntervalLimiter({ intervalMs: 1_000, clock, sleep });

    await limiter.acquire();
    limiter.cooldown(5_000);
    await limiter.acquire();

    expect(waits).toEqual([5_000]);
  });
});

describe('limiter a header (AcousticBrainz, D-AF.6, T-AF.9)', () => {
  it('con Remaining 0 attende Reset-In prima della richiesta successiva', async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const limiter = createAcousticBrainzLimiter(clock, sleep);

    const headers = JSON.parse(loadApiMock('acousticbrainz/headers-rate-limit.json')) as Record<
      string,
      string
    >;
    limiter.observe(headers);
    await limiter.acquire();

    expect(waits).toEqual([2_000]);
  });

  it("dopo l'attesa il limite non è più noto (nessuna costante hidden)", async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const limiter = createAcousticBrainzLimiter(clock, sleep);

    limiter.observe({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-in': '2' });
    await limiter.acquire();
    await limiter.acquire();

    expect(waits).toEqual([2_000]);
  });

  it('finché Remaining è positivo non attende', async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const limiter = createAcousticBrainzLimiter(clock, sleep);

    limiter.observe({ 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '99' });
    await limiter.acquire();

    expect(waits).toEqual([]);
  });

  it('il cooldown di un 429 blocca fino al Retry-After', async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const limiter = createHeaderRateLimiter({ clock, sleep });

    limiter.cooldown(4_000);
    await limiter.acquire();

    expect(waits).toEqual([4_000]);
  });

  it('i nomi degli header sono quelli dichiarati nella spec', () => {
    const limiter = createAcousticBrainzLimiter(createFakeClock(), async () => undefined);
    expect(() => limiter.observe({ 'X-RateLimit-Limit': '100' })).not.toThrow();
  });
});

describe('Retry-After (21§7.2)', () => {
  it('i secondi diventano millisecondi', () => {
    expect(parseRetryAfterMs({ 'retry-after': '30' }, 0)).toBe(30_000);
  });

  it('una data HTTP è convertita in millisecondi', () => {
    const now = Date.parse('2026-10-28T10:00:00Z');
    expect(parseRetryAfterMs({ 'retry-after': 'Wed, 28 Oct 2026 10:00:05 GMT' }, now)).toBe(5_000);
  });

  it('un valore non interpretabile non aggiunge attese', () => {
    expect(parseRetryAfterMs({ 'retry-after': 'presto' }, 0)).toBe(0);
    expect(parseRetryAfterMs({}, 0)).toBe(0);
  });
});
