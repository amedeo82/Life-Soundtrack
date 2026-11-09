import { describe, expect, it } from 'vitest';
import {
  EMPTY_ARTWORK_CURSOR,
  ITUNES_ALBUM_ENDPOINT,
  buildItunesArtworkUrl,
  fetchArtworkUrl,
  fetchCoverArtArchive,
  fetchItunesArtwork,
  generatePlaceholderGradient,
  isExactArtworkMatch,
  isTrackAttempted,
  normalizeMatchText,
  upgradeArtworkUrl,
} from '../artwork';
import { createFixedIntervalLimiter, createItunesLimiter } from '../rateLimiter';
import {
  createFakeClock,
  createFakeHttpClient,
  createFakeSleep,
  httpResponse,
  loadApiMock,
  makeTrack,
} from './helpers';
import type { Logger } from '../../logger';

const mockLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe('normalizzazione e match esatto (24§D-24.4)', () => {
  it('la normalizzazione ignora maiuscole, diacritici e spazi ridondanti', () => {
    expect(normalizeMatchText('  Northern   Sky ')).toBe('northern sky');
    expect(normalizeMatchText('Perché No')).toBe('perche no');
  });

  it('titolo e artista devono coincidere entrambi per artwork', () => {
    const result = { trackName: 'Northern Sky', artistName: 'The Midnight Echo' };
    expect(isExactArtworkMatch(result, 'Northern Sky', 'The Midnight Echo')).toBe(true);
    expect(isExactArtworkMatch(result, 'Northern Sky', 'Another Artist')).toBe(false);
    expect(isExactArtworkMatch(result, 'Greatest Hits', 'The Midnight Echo')).toBe(false);
  });

  it('un risultato senza titolo o artista non è un match', () => {
    expect(isExactArtworkMatch({}, 'Northern Sky', 'The Midnight Echo')).toBe(false);
  });
});

describe('URL della ricerca iTunes per artwork (entity=album)', () => {
  it("l'URL porta term, artist, entity=album ed attribute=albumTerm", () => {
    const url = buildItunesArtworkUrl('Northern Sky', 'The Midnight Echo');
    expect(url.startsWith(ITUNES_ALBUM_ENDPOINT)).toBe(true);
    expect(url).toContain('term=Northern+Sky');
    expect(url).toContain('artist=The+Midnight+Echo');
    expect(url).toContain('entity=album');
    expect(url).toContain('attribute=albumTerm');
  });

  it('nessun altro parametro esce', () => {
    const url = new URL(buildItunesArtworkUrl('Northern Sky', 'The Midnight Echo'));
    expect([...url.searchParams.keys()].sort()).toEqual(['artist', 'attribute', 'entity', 'term']);
  });
});

describe('upgradeArtworkUrl (D-24.4: 100x100 → 600x600)', () => {
  it('trasforma artworkUrl100 in artworkUrl600', () => {
    expect(upgradeArtworkUrl('https://example.com/artwork/100x100bb.jpg')).toBe(
      'https://example.com/artwork/600x600bb.jpg',
    );
    expect(upgradeArtworkUrl('https://example.com/artwork/100x100.jpg')).toBe(
      'https://example.com/artwork/600x600.jpg',
    );
  });

  it("fallback all'URL originale se il pattern non c'è", () => {
    expect(upgradeArtworkUrl('https://example.com/artwork/300x300.jpg')).toBe(
      'https://example.com/artwork/300x300.jpg',
    );
    expect(upgradeArtworkUrl('https://example.com/no-pattern')).toBe(
      'https://example.com/no-pattern',
    );
  });
});

describe('generatePlaceholderGradient (deterministico, offline)', () => {
  it('stesso trackId → stesso data URI', () => {
    const uri1 = generatePlaceholderGradient('track-123');
    const uri2 = generatePlaceholderGradient('track-123');
    expect(uri1).toBe(uri2);
    expect(uri1.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('trackId diversi → data URI diversi', () => {
    const uri1 = generatePlaceholderGradient('track-1');
    const uri2 = generatePlaceholderGradient('track-2');
    expect(uri1).not.toBe(uri2);
  });

  it('il data URI è un SVG valido con gradient', () => {
    const uri = generatePlaceholderGradient('track-test');
    const base64 = uri.slice('data:image/svg+xml;base64,'.length);
    const svg = atob(base64);
    expect(svg).toContain('<svg');
    expect(svg).toContain('linearGradient');
    expect(svg).toContain('stop-color');
  });
});

describe('fetchItunesArtwork (24§D-24.1)', () => {
  const build = (handler: Parameters<typeof createFakeHttpClient>[0]) => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(handler);
    const deps = {
      http,
      limiter: createItunesLimiter(clock, sleep),
      clock,
      logger: mockLogger,
    };
    return { http, deps, clock };
  };

  it("trova l'artwork con match esatto e lo upgrada a 600", async () => {
    const body = loadApiMock('itunes/search-artwork.json');
    const { http, deps } = build(() => httpResponse(200, body));

    const track = makeTrack({ name: 'Northern Sky', artistId: 'artist-1', mbid: 'mbid-123' });
    const request = {
      trackId: track.id,
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: 'Long Nights',
      albumId: 'album-1',
      mbid: track.mbid,
    };

    const outcome = await fetchItunesArtwork(request, deps);

    expect(outcome?.source).toBe('itunes');
    expect(outcome?.url).toContain('600x600');
    expect(http.calls).toHaveLength(1);
  });

  it('NON sceglie varianti non esatte', async () => {
    const body = loadApiMock('itunes/search-artwork.json');
    const { deps } = build(() => httpResponse(200, body));

    const request = {
      trackId: 'track-1',
      trackName: 'Wrong Title',
      artistName: 'Wrong Artist',
      albumName: null,
      albumId: null,
      mbid: null,
    };

    const outcome = await fetchItunesArtwork(request, deps);
    expect(outcome).toBeNull();
  });

  it('senza match esatto → null', async () => {
    const body = loadApiMock('itunes/search-no-match.json');
    const { deps } = build(() => httpResponse(200, body));

    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: null,
      albumId: null,
      mbid: null,
    };

    expect(await fetchItunesArtwork(request, deps)).toBeNull();
  });

  it('un 429 restituisce http_429 (il ramo non riprova)', async () => {
    const { deps } = build(() => httpResponse(429, '', { 'retry-after': '30' }));

    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: null,
      albumId: null,
      mbid: null,
    };

    const outcome = await fetchItunesArtwork(request, deps);
    expect(outcome).toEqual({ source: 'itunes', url: null, reason: 'http_429' });
  });

  it('risposta non OK → null', async () => {
    const { deps } = build(() => httpResponse(500, 'boom'));
    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: null,
      albumId: null,
      mbid: null,
    };
    expect(await fetchItunesArtwork(request, deps)).toBeNull();
  });

  it('risposta non JSON → null', async () => {
    const { deps } = build(() => httpResponse(200, '<html>proxy error</html>'));
    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: null,
      albumId: null,
      mbid: null,
    };
    expect(await fetchItunesArtwork(request, deps)).toBeNull();
  });

  it('errore di rete → null e non propaga', async () => {
    const { deps } = build(() => {
      throw new Error('offline');
    });
    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: null,
      albumId: null,
      mbid: null,
    };
    expect(await fetchItunesArtwork(request, deps)).toBeNull();
  });

  it('senza nome artista non esce nessuna richiesta', async () => {
    const { http, deps } = build(() => httpResponse(200, '{}'));
    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: '  ',
      albumName: null,
      albumId: null,
      mbid: null,
    };
    expect(await fetchItunesArtwork(request, deps)).toBeNull();
    expect(http.calls).toHaveLength(0);
  });
});

describe('fetchCoverArtArchive (24§D-24.1, solo con MBID)', () => {
  const build = (handler: Parameters<typeof createFakeHttpClient>[0]) => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(handler);
    const deps = {
      http,
      limiter: createItunesLimiter(clock, sleep),
      clock,
      logger: mockLogger,
    };
    return { http, deps, clock };
  };

  it('senza MBID → null (ramo non parte)', async () => {
    const { deps } = build(() => httpResponse(200, '{}'));
    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: 'Long Nights',
      albumId: 'album-1',
      mbid: null,
    };
    expect(await fetchCoverArtArchive(request, deps)).toBeNull();
  });

  it("con MBID trova l'artwork", async () => {
    const body = loadApiMock('coverartarchive/release-with-images.json');
    const { http, deps } = build(() => httpResponse(200, body));

    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: 'Long Nights',
      albumId: 'album-1',
      mbid: 'a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8',
    };

    const outcome = await fetchCoverArtArchive(request, deps);
    expect(outcome?.source).toBe('coverartarchive');
    expect(outcome?.url).toBe(
      'https://coverartarchive.org/release/a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8/1234567890-front-500.jpg',
    );
    expect(http.calls).toHaveLength(1);
  });

  it('404 → not_found', async () => {
    const body = loadApiMock('coverartarchive/release-404.json');
    const { deps } = build(() => httpResponse(404, body));

    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: 'Long Nights',
      albumId: 'album-1',
      mbid: 'nonexistent-mbid',
    };

    const outcome = await fetchCoverArtArchive(request, deps);
    expect(outcome).toEqual({ source: 'coverartarchive', url: null, reason: 'not_found' });
  });

  it('429 → http_429 (nessun retry)', async () => {
    const { deps } = build(() => httpResponse(429, '', { 'retry-after': '60' }));

    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: 'Long Nights',
      albumId: 'album-1',
      mbid: 'some-mbid',
    };

    const outcome = await fetchCoverArtArchive(request, deps);
    expect(outcome).toEqual({ source: 'coverartarchive', url: null, reason: 'http_429' });
  });

  it('risposta non OK → null', async () => {
    const { deps } = build(() => httpResponse(500, 'boom'));
    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: 'Long Nights',
      albumId: 'album-1',
      mbid: 'some-mbid',
    };
    expect(await fetchCoverArtArchive(request, deps)).toBeNull();
  });

  it('risposta non JSON → null', async () => {
    const { deps } = build(() => httpResponse(200, '<html>error</html>'));
    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: 'Long Nights',
      albumId: 'album-1',
      mbid: 'some-mbid',
    };
    expect(await fetchCoverArtArchive(request, deps)).toBeNull();
  });
});

describe('fetchArtworkUrl — cascata completa (24§D-24.1)', () => {
  const build = (handler: Parameters<typeof createFakeHttpClient>[0]) => {
    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(handler);
    const deps = {
      http,
      limiter: createItunesLimiter(clock, sleep),
      clock,
      logger: mockLogger,
    };
    return { http, deps, clock };
  };

  it('toggle spento → zero uscite, zero scritture, zero letture cache (21§10.4)', async () => {
    const { http, deps } = build(() => httpResponse(200, '{}'));
    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: null,
      albumId: null,
      mbid: null,
    };

    const outcome = await fetchArtworkUrl(request, deps, false);
    expect(outcome).toEqual({ source: 'none', url: null, reason: 'toggle-off' });
    expect(http.calls).toHaveLength(0);
  });

  it('iTunes trova artwork → restituisce itunes', async () => {
    const body = loadApiMock('itunes/search-artwork.json');
    const { deps } = build(() => httpResponse(200, body));

    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: null,
      albumId: null,
      mbid: 'some-mbid',
    };

    const outcome = await fetchArtworkUrl(request, deps, true);
    expect(outcome.source).toBe('itunes');
    expect(outcome.url).toContain('600x600');
  });

  it('iTunes non trova, Cover Art Archive trova → restituisce coverartarchive', async () => {
    const itunesBody = loadApiMock('itunes/search-no-match.json');
    const coverArtBody = loadApiMock('coverartarchive/release-with-images.json');

    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient((url) => {
      if (url.includes('itunes.apple.com')) return httpResponse(200, itunesBody);
      if (url.includes('coverartarchive.org')) return httpResponse(200, coverArtBody);
      return httpResponse(404, 'not found');
    });
    const deps = {
      http,
      limiter: createFixedIntervalLimiter({ intervalMs: 1000, clock, sleep }),
      clock,
      logger: mockLogger,
    };

    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: 'Long Nights',
      albumId: 'album-1',
      mbid: 'a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8',
    };

    const outcome = await fetchArtworkUrl(request, deps, true);
    expect(outcome.source).toBe('coverartarchive');
    expect(outcome.url).toContain('coverartarchive.org');
  });

  it('nessuna fonte trova → placeholder deterministico', async () => {
    const itunesBody = loadApiMock('itunes/search-no-match.json');
    const coverArtBody = loadApiMock('coverartarchive/release-404.json');

    const clock = createFakeClock();
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient((url) => {
      if (url.includes('itunes.apple.com')) return httpResponse(200, itunesBody);
      if (url.includes('coverartarchive.org')) return httpResponse(404, coverArtBody);
      return httpResponse(404, 'not found');
    });
    const deps = {
      http,
      limiter: createFixedIntervalLimiter({ intervalMs: 1000, clock, sleep }),
      clock,
      logger: mockLogger,
    };

    const request = {
      trackId: 'track-placeholder-123',
      trackName: 'Unknown Track',
      artistName: 'Unknown Artist',
      albumName: null,
      albumId: null,
      mbid: null,
    };

    const outcome = await fetchArtworkUrl(request, deps, true);
    expect(outcome.source).toBe('placeholder');
    expect(outcome.url).toContain('data:image/svg+xml;base64,');
    // Deterministico
    const outcome2 = await fetchArtworkUrl(request, deps, true);
    expect(outcome.url).toBe(outcome2.url);
  });

  it('rate limit iTunes → http_429, non prova Cover Art Archive', async () => {
    const { http, deps } = build(() => httpResponse(429, '', { 'retry-after': '30' }));

    const request = {
      trackId: 'track-1',
      trackName: 'Northern Sky',
      artistName: 'The Midnight Echo',
      albumName: 'Long Nights',
      albumId: 'album-1',
      mbid: 'some-mbid',
    };

    const outcome = await fetchArtworkUrl(request, deps, true);
    expect(outcome).toEqual({ source: 'itunes', url: null, reason: 'http_429' });
    // Nessuna chiamata a Cover Art Archive
    expect(http.calls.every((c) => c.url.includes('itunes.apple.com'))).toBe(true);
  });
});

describe('isTrackAttempted / cursore (D-24.3)', () => {
  it('restituisce true se il trackId è nel cursore', () => {
    const cursor = { ...EMPTY_ARTWORK_CURSOR, attemptedTrackIds: ['track-1', 'track-2'] };
    expect(isTrackAttempted(cursor, 'track-1')).toBe(true);
    expect(isTrackAttempted(cursor, 'track-3')).toBe(false);
  });

  it('cursore vuoto → sempre false', () => {
    expect(isTrackAttempted(EMPTY_ARTWORK_CURSOR, 'track-1')).toBe(false);
  });
});
