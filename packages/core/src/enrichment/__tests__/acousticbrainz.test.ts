import { describe, expect, it } from 'vitest';
import {
  ACOUSTICBRAINZ_API_BASE,
  createAcousticBrainzProvider,
  extractMood,
  isAcousticBrainzExpired,
  readNumericField,
} from '../acousticbrainz';
import { createAcousticBrainzLimiter } from '../rateLimiter';
import {
  createFakeClock,
  createFakeHttpClient,
  createFakeSleep,
  httpResponse,
  loadApiMock,
  makeContext,
  makeTrack,
} from './helpers';

/**
 * Il provider AcousticBrainz — `21-AUDIO-FEATURES.md` §7 (T-AF.3, T-AF.9).
 */
describe("il ramo AB è condizionato dall'MBID (21§5.1)", () => {
  it('senza MBID il ramo salta (nessuna richiesta)', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() => httpResponse(200, '{}'));
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    const track = makeTrack({ mbid: null });
    expect(provider.canHandle(track)).toBe(false);
    expect(await provider.fetch(track, makeContext())).toBeNull();
    expect(http.calls).toHaveLength(0);
  });

  it("con MBID il ramo parte e interroga l'endpoint high-level", async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() =>
      httpResponse(200, loadApiMock('acousticbrainz/high-level-happy.json')),
    );
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    const track = makeTrack({ mbid: '58c8b7a5-8eeb-48ce-89fc-fa4a33cc610b' });
    expect(provider.canHandle(track)).toBe(true);

    await provider.fetch(track, makeContext());

    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]?.url).toBe(
      `${ACOUSTICBRAINZ_API_BASE}/58c8b7a5-8eeb-48ce-89fc-fa4a33cc610b/high-level`,
    );
  });
});

describe('la mappatura mood → feature (21§7.3, D-AF.8)', () => {
  it('valence ed energy sono derivate con i pesi dichiarati', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() =>
      httpResponse(200, loadApiMock('acousticbrainz/high-level-happy.json')),
    );
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    const feature = await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext());

    expect(feature?.valence).toBe(0.625);
    expect(feature?.energy).toBe(0.59);
    expect(feature?.danceability).toBe(0.78);
    expect(feature?.source).toBe('acousticbrainz');
  });

  it('i campi che AB non misura restano null (21§7.4)', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() =>
      httpResponse(200, loadApiMock('acousticbrainz/high-level-happy.json')),
    );
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    const feature = await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext());

    expect(feature?.tempo).toBeNull();
    expect(feature?.key).toBeNull();
    expect(feature?.mode).toBeNull();
    expect(feature?.loudness).toBeNull();
    expect(feature?.acousticness).toBeNull();
    expect(feature?.instrumentalness).toBeNull();
    expect(feature?.speechiness).toBeNull();
    expect(feature?.liveness).toBeNull();
  });

  it('il parser accetta sia {"value": n} sia il numero grezzo', () => {
    expect(readNumericField({ value: 0.42 })).toBe(0.42);
    expect(readNumericField(0.42)).toBe(0.42);
    expect(readNumericField({ value: 'x' })).toBeNull();
    expect(readNumericField(undefined)).toBeNull();
  });

  it('un documento senza classi mood non produce feature', () => {
    expect(extractMood({ 'high-level': {} }).mood_happy).toBeUndefined();
  });
});

describe('errori e rate limit (21§5.3, §7.2)', () => {
  it('un 404 non produce feature e non propaga', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() => httpResponse(404, ''));
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    expect(await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext())).toBeNull();
  });

  it('un 429 rispetta il Retry-After', async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const http = createFakeHttpClient(() => httpResponse(429, '', { 'retry-after': '5' }));
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    expect(await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext())).toBeNull();
    // Il cooldown viene applicato al limiter: la richiesta successiva attende.
    await provider.fetch(makeTrack({ mbid: 'mbid-2' }), makeContext());
    expect(waits).toEqual([5_000]);
  });

  it('un 500 non produce feature e non propaga', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() => httpResponse(500, 'boom'));
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    expect(await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext())).toBeNull();
  });

  it('un documento con una sola classe mood produce la derivazione', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() =>
      httpResponse(200, JSON.stringify({ 'high-level': { mood_sad: { value: 0.4 } } })),
    );
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    const feature = await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext());

    expect(feature?.valence).toBe(0);
    expect(feature?.energy).toBe(0);
  });

  it('un documento senza classi mood e senza danceable non produce feature', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() =>
      httpResponse(200, JSON.stringify({ 'high-level': { genre_dortmund: { value: 'pop' } } })),
    );
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    expect(await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext())).toBeNull();
  });

  it('un documento con solo danceable produce la feature', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() =>
      httpResponse(200, JSON.stringify({ 'high-level': { danceable: { value: 0.66 } } })),
    );
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    const feature = await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext());

    expect(feature?.danceability).toBe(0.66);
  });

  it('una risposta non JSON non produce feature', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() => httpResponse(200, 'non json'));
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    expect(await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext())).toBeNull();
  });

  it('un errore di rete non propaga', async () => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() => {
      throw new Error('offline');
    });
    const provider = createAcousticBrainzProvider({
      http,
      limiter: createAcousticBrainzLimiter(clock, sleep),
      clock,
    });

    expect(await provider.fetch(makeTrack({ mbid: 'mbid-1' }), makeContext())).toBeNull();
  });
});

describe('TTL di 90 giorni (21§11.2)', () => {
  it('la feature AB scade dopo 90 giorni', () => {
    const now = 1_700_000_000_000;
    const fresh = {
      trackId: 't',
      valence: null,
      energy: null,
      danceability: null,
      acousticness: null,
      instrumentalness: null,
      speechiness: null,
      liveness: null,
      tempo: null,
      key: null,
      mode: null,
      loudness: null,
      timeSignature: null,
      source: 'acousticbrainz' as const,
      fetchedAt: now,
      schemaVersion: 1,
    };

    expect(isAcousticBrainzExpired(fresh, now + 89 * 24 * 3600 * 1000)).toBe(false);
    expect(isAcousticBrainzExpired(fresh, now + 91 * 24 * 3600 * 1000)).toBe(true);
  });

  it('le altre sorgenti non hanno TTL', () => {
    const now = 1_700_000_000_000;
    const heuristic = {
      trackId: 't',
      valence: null,
      energy: null,
      danceability: 0.5,
      acousticness: null,
      instrumentalness: null,
      speechiness: null,
      liveness: null,
      tempo: 120,
      key: null,
      mode: null,
      loudness: null,
      timeSignature: null,
      source: 'heuristic' as const,
      fetchedAt: 0,
      schemaVersion: 1,
    };

    expect(isAcousticBrainzExpired(heuristic, now)).toBe(false);
  });
});
