import { afterEach, describe, expect, it, beforeEach } from 'vitest';
import {
  ARTWORK_CURSOR_KEY,
  EMPTY_ARTWORK_CURSOR,
  fetchArtworkUrl,
  generatePlaceholderGradient,
  persistArtwork,
} from '../artwork';
import {
  createFakeClock,
  createFakeHttpClient,
  createFakeSleep,
  httpResponse,
  loadApiMock,
  makeTrack,
} from './helpers';
import { createItunesLimiter, createFixedIntervalLimiter } from '../rateLimiter';
import { freshDb, closeAllDbs } from '../../db/__tests__/helpers';
import type { LifeSoundtrackDB } from '../../db/db';
import type { Album } from '../../schema';
import type { Logger } from '../../logger';

const mockLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

afterEach(closeAllDbs);

/**
 * Persistenza artwork su Track/Album + cursore in settings (D-24.3).
 * Test con Dexie reale (LifeSoundtrackDB).
 */
describe('persistArtwork — scrittura Track/Album + cursore (D-24.3)', () => {
  let db: LifeSoundtrackDB;
  let clock: ReturnType<typeof createFakeClock>;

  beforeEach(() => {
    db = freshDb(`ls-artwork-${Date.now()}-${Math.random()}`);
    clock = createFakeClock();
  });

  it('scrive Track.artworkUrl e aggiorna il cursore', async () => {
    await db.open();
    const track = makeTrack({ id: 'track-1', artworkUrl: null });
    await db.tracks.put(track); // Aggiunge il track al DB prima
    const album = null as Album | null;
    const outcome = {
      source: 'itunes' as const,
      url: 'https://example.com/artwork.jpg',
      reason: undefined,
    };
    const cursor = EMPTY_ARTWORK_CURSOR;

    const result = await persistArtwork(db, track, album, outcome, cursor, clock);

    expect(result.trackUpdated).toBe(true);
    expect(result.cursorUpdated).toBe(true);

    const savedTrack = await db.tracks.get(track.canonicalKey);
    expect(savedTrack?.artworkUrl).toBe('https://example.com/artwork.jpg');

    const savedCursor = await db.settings.get(ARTWORK_CURSOR_KEY);
    expect(savedCursor?.value).toEqual({
      lastAttemptedAt: clock.now(),
      attemptedTrackIds: [track.canonicalKey],
    });
  });

  it('scrive Album.artworkUrl con deduplicazione per albumId', async () => {
    await db.open();
    const track = makeTrack({ id: 'track-1', albumId: 'album-1', artworkUrl: null });
    await db.tracks.put(track);
    const album: Album = {
      id: 'album-1',
      name: 'Long Nights',
      artistId: 'artist-1',
      mbid: null,
      upc: null,
      releaseDate: null,
      artworkUrl: null,
      platformIds: {},
    };
    await db.albums.put(album);
    const outcome = {
      source: 'itunes' as const,
      url: 'https://example.com/album-artwork.jpg',
      reason: undefined,
    };
    const cursor = EMPTY_ARTWORK_CURSOR;

    const result = await persistArtwork(db, track, album, outcome, cursor, clock);

    expect(result.trackUpdated).toBe(true);
    expect(result.albumUpdated).toBe(true);

    const savedTrack = await db.tracks.get(track.canonicalKey);
    expect(savedTrack?.artworkUrl).toBe('https://example.com/album-artwork.jpg');

    const savedAlbum = await db.albums.get('album-1');
    expect(savedAlbum?.artworkUrl).toBe('https://example.com/album-artwork.jpg');
  });

  it("non riscrive se l'URL è identico (idempotenza)", async () => {
    await db.open();
    const track = makeTrack({ id: 'track-1', artworkUrl: 'https://example.com/same.jpg' });
    await db.tracks.put(track);
    const outcome = {
      source: 'itunes' as const,
      url: 'https://example.com/same.jpg',
      reason: undefined,
    };
    const cursor = EMPTY_ARTWORK_CURSOR;

    const result1 = await persistArtwork(db, track, null, outcome, cursor, clock);
    const result2 = await persistArtwork(db, track, null, outcome, cursor, clock);

    // Idempotenza: se l'URL è già uguale, non c'è aggiornamento
    expect(result1.trackUpdated).toBe(false);
    expect(result2.trackUpdated).toBe(false);
  });

  it('aggiorna il cursore mantenendo solo gli ultimi 10000 trackId', async () => {
    await db.open();
    const cursor = {
      ...EMPTY_ARTWORK_CURSOR,
      attemptedTrackIds: Array.from({ length: 10000 }, (_, i) => `fuzzy:track-${i}`),
    };
    const track = makeTrack({ id: 'track-new', artworkUrl: null });
    const outcome = {
      source: 'placeholder' as const,
      url: generatePlaceholderGradient('track-new'),
      reason: undefined,
    };

    await persistArtwork(db, track, null, outcome, cursor, clock);

    const savedCursor = await db.settings.get(ARTWORK_CURSOR_KEY);
    const ids = (savedCursor?.value as { attemptedTrackIds: string[] }).attemptedTrackIds;
    expect(ids.length).toBe(10000);
    expect(ids[ids.length - 1]).toBe(track.canonicalKey);
    expect(ids[0]).toBe('fuzzy:track-1'); // Il più vecchio viene rimosso
  });
});

describe('fetchArtworkUrl + persistArtwork — flusso integrato', () => {
  let db: LifeSoundtrackDB;
  let clock: ReturnType<typeof createFakeClock>;

  beforeEach(() => {
    db = freshDb(`ls-artwork-integrated-${Date.now()}-${Math.random()}`);
    clock = createFakeClock();
  });

  it('iTunes trova artwork → persiste su Track e aggiorna cursore', async () => {
    await db.open();
    const body = loadApiMock('itunes/search-artwork.json');
    const { sleep } = createFakeSleep(clock);
    const http = createFakeHttpClient(() => httpResponse(200, body));
    const deps = {
      http,
      limiter: createItunesLimiter(clock, sleep),
      clock,
      logger: mockLogger,
    };

    const track = makeTrack({
      id: 'track-1',
      name: 'Northern Sky',
      artistId: 'artist-1',
      albumId: 'album-1',
      mbid: 'mbid-123',
      artworkUrl: null,
    });
    await db.tracks.put(track);
    const album: Album = {
      id: 'album-1',
      name: 'Long Nights',
      artistId: 'artist-1',
      mbid: null,
      upc: null,
      releaseDate: null,
      artworkUrl: null,
      platformIds: {},
    };
    await db.albums.put(album);

    const request = {
      trackId: track.id,
      trackName: track.name,
      artistName: 'The Midnight Echo',
      albumName: album.name,
      albumId: track.albumId,
      mbid: track.mbid,
    };

    const outcome = await fetchArtworkUrl(request, deps, true);
    expect(outcome.source).toBe('itunes');
    expect(outcome.url).toContain('600x600');

    const cursor = EMPTY_ARTWORK_CURSOR;
    const result = await persistArtwork(db, track, album, outcome, cursor, clock);

    expect(result.trackUpdated).toBe(true);
    expect(result.albumUpdated).toBe(true);
    expect(result.cursorUpdated).toBe(true);

    const savedTrack = await db.tracks.get(track.canonicalKey);
    expect(savedTrack?.artworkUrl).toBe(outcome.url);

    const savedAlbum = await db.albums.get('album-1');
    expect(savedAlbum?.artworkUrl).toBe(outcome.url);
  });

  it('placeholder → persiste data URI su Track', async () => {
    await db.open();
    const itunesBody = loadApiMock('itunes/search-no-match.json');
    const coverArtBody = loadApiMock('coverartarchive/release-404.json');

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

    const track = makeTrack({
      id: 'track-placeholder',
      name: 'Unknown',
      artistId: 'artist-1',
      artworkUrl: null,
    });
    await db.tracks.put(track);
    const request = {
      trackId: track.id,
      trackName: 'Unknown',
      artistName: 'Unknown Artist',
      albumName: null,
      albumId: null,
      mbid: null,
    };

    const outcome = await fetchArtworkUrl(request, deps, true);
    expect(outcome.source).toBe('placeholder');
    expect(outcome.url).toContain('data:image/svg+xml;base64,');
    const placeholderUrl = outcome.url;

    const cursor = EMPTY_ARTWORK_CURSOR;
    await persistArtwork(db, track, null, outcome, cursor, clock);

    const savedTrack = await db.tracks.get(track.canonicalKey);
    expect(savedTrack?.artworkUrl).toBe(placeholderUrl);
  });
});
