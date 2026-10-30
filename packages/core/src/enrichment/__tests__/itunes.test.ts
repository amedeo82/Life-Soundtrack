import { describe, expect, it } from 'vitest';
import {
  ITUNES_SEARCH_ENDPOINT,
  buildItunesSearchUrl,
  createItunesPreviewResolver,
  isExactMatch,
  normalizeMatchText,
} from '../itunes';
import { createAcousticBrainzLimiter, createItunesLimiter } from '../rateLimiter';
import {
  createFakeClock,
  createFakeHttpClient,
  createFakeSleep,
  httpResponse,
  loadApiMock,
} from './helpers';

/**
 * Il resolver del preview iTunes — `21-AUDIO-FEATURES.md` §6.6 (D-AF.1),
 * §13 (E2).
 *
 * Il match è **esatto**: una feature sbagliata è peggio di nessuna.
 */
describe('normalizzazione e match esatto (21§6.6, E2)', () => {
  it('la normalizzazione ignora maiuscole, diacritici e spazi ridondanti', () => {
    expect(normalizeMatchText('  Northern   Sky ')).toBe('northern sky');
    expect(normalizeMatchText('Perché No')).toBe('perche no');
  });

  it('titolo e artista devono coincidere entrambi', () => {
    const result = { trackName: 'Northern Sky', artistName: 'The Midnight Echo' };
    expect(isExactMatch(result, 'Northern Sky', 'The Midnight Echo')).toBe(true);
    expect(isExactMatch(result, 'Northern Sky', 'Another Artist')).toBe(false);
    expect(isExactMatch(result, 'Greatest Hits', 'The Midnight Echo')).toBe(false);
  });

  it('un risultato senza titolo o artista non è un match', () => {
    expect(isExactMatch({}, 'Northern Sky', 'The Midnight Echo')).toBe(false);
  });
});

describe('URL della ricerca (09§3.3: escono solo le due stringhe)', () => {
  it("l'URL porta term, artist ed entity=song", () => {
    const url = buildItunesSearchUrl('Northern Sky', 'The Midnight Echo');
    expect(url.startsWith(ITUNES_SEARCH_ENDPOINT)).toBe(true);
    expect(url).toContain('term=Northern+Sky');
    expect(url).toContain('artist=The+Midnight+Echo');
    expect(url).toContain('entity=song');
  });

  it('nessun altro parametro esce (nessun id utente, nessun timestamp)', () => {
    const url = new URL(buildItunesSearchUrl('Northern Sky', 'The Midnight Echo'));
    expect([...url.searchParams.keys()].sort()).toEqual(['artist', 'entity', 'term']);
  });
});

describe('resolver del preview (21§6.6)', () => {
  const build = (handler: Parameters<typeof createFakeHttpClient>[0]) => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(handler);
    const resolver = createItunesPreviewResolver({
      http,
      limiter: createItunesLimiter(clock, sleep),
      clock,
    });
    return { http, resolver, clock };
  };

  it('trova il preview con il match esatto (T-AF.2)', async () => {
    const body = loadApiMock('itunes/search-preview.json');
    const { http, resolver } = build(() => httpResponse(200, body));

    const preview = await resolver.resolve('Northern Sky', 'The Midnight Echo');

    expect(preview?.previewUrl).toBe(
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/1a2b3c4d/plus.aac.p.m4a',
    );
    expect(preview?.itunesTrackId).toBe(1234567890);
    expect(http.calls).toHaveLength(1);
  });

  it('NON sceglie la variante "(Live)": solo il match esatto (E2)', async () => {
    const body = loadApiMock('itunes/search-preview.json');
    const { resolver } = build(() => httpResponse(200, body));

    const preview = await resolver.resolve('Northern Sky (Live)', 'Someone Else');

    expect(preview).toBeNull();
  });

  it('un titolo ambiguo senza match esatto non produce preview', async () => {
    const body = loadApiMock('itunes/search-no-match.json');
    const { resolver } = build(() => httpResponse(200, body));

    expect(await resolver.resolve('Northern Sky', 'The Midnight Echo')).toBeNull();
  });

  it('un 429 non produce preview (il ramo salta, non è un errore)', async () => {
    const { resolver } = build(() => httpResponse(429, '', { 'retry-after': '30' }));

    expect(await resolver.resolve('Northern Sky', 'The Midnight Echo')).toBeNull();
  });

  it('una risposta non OK (500) non produce preview', async () => {
    const { resolver } = build(() => httpResponse(500, 'boom'));

    expect(await resolver.resolve('Northern Sky', 'The Midnight Echo')).toBeNull();
  });

  it('una risposta non JSON non produce preview', async () => {
    const { resolver } = build(() => httpResponse(200, '<html>proxy error</html>'));

    expect(await resolver.resolve('Northern Sky', 'The Midnight Echo')).toBeNull();
  });

  it('un errore di rete non produce preview e non propaga', async () => {
    const { resolver } = build(() => {
      throw new Error('offline');
    });

    expect(await resolver.resolve('Northern Sky', 'The Midnight Echo')).toBeNull();
  });

  it('senza nome artista non esce nessuna richiesta', async () => {
    const { http, resolver } = build(() => httpResponse(200, '{}'));

    expect(await resolver.resolve('Northern Sky', '  ')).toBeNull();
    expect(http.calls).toHaveLength(0);
  });

  it('il limiter iTunes è quello dichiarato (~20 req/min)', async () => {
    const clock = createFakeClock();
    const { sleep, waits } = createFakeSleep(clock);
    const http = createFakeHttpClient(() =>
      httpResponse(200, loadApiMock('itunes/search-preview.json')),
    );
    const resolver = createItunesPreviewResolver({
      http,
      limiter: createItunesLimiter(clock, sleep),
      clock,
    });

    await resolver.resolve('Northern Sky', 'The Midnight Echo');
    await resolver.resolve('Northern Sky', 'The Midnight Echo');

    expect(waits).toEqual([3_000]);
  });

  it('il limiter di AcousticBrainz è disponibile per il provider AB', () => {
    const clock = createFakeClock();
    const limiter = createAcousticBrainzLimiter(clock, async () => undefined);
    expect(typeof limiter.acquire).toBe('function');
  });
});
