import { describe, expect, it, afterEach } from 'vitest';
import { LifeSoundtrackDB } from '../db';
import { clearDemoDatabase, seedDemoDatabase, type DemoFixture } from '../demoSeed';
import { closeAllDbs, freshDb } from './helpers';

/**
 * Il fixture demo minimale: un ascolto **senza** i campi città (schema v6),
 * un brano, un artista, un album e una feature.
 */
const FIXTURE: DemoFixture = {
  listens: [
    {
      id: 'le-demo-1',
      eventKey: 'spotify:ek-demo-1',
      platform: 'spotify',
      importId: 'imp-demo',
      timestamp: 1710523800000,
      startedAt: 1710523555000,
      durationMs: 245000,
      trackId: 'tr-demo-1',
      completed: true,
      skipped: false,
      deviceType: 'mobile',
      day: '2024-03-15',
    },
    {
      id: 'le-demo-2',
      eventKey: 'spotify:ek-demo-2',
      platform: 'spotify',
      importId: 'imp-demo',
      timestamp: 1710610200000,
      startedAt: 1710609955000,
      durationMs: 245000,
      trackId: 'tr-demo-1',
      completed: true,
      skipped: false,
      deviceType: 'mobile',
      day: '2024-03-16',
    },
  ],
  tracks: [
    {
      id: 'tr-demo-1',
      canonicalKey: 'fuzzy:ck-demo-1',
      name: 'Brano demo',
      artistId: 'ar-demo-1',
      albumId: 'al-demo-1',
      durationMs: 245000,
      genres: ['indie'],
    },
  ],
  artists: [{ id: 'ar-demo-1', name: 'Artista demo', genres: ['indie'] }],
  albums: [
    {
      id: 'al-demo-1',
      name: 'Album demo',
      artistId: 'ar-demo-1',
      releaseDate: '2024',
    },
  ],
  features: [
    {
      trackId: 'tr-demo-1',
      valence: 0.4,
      energy: 0.3,
      source: 'manual',
      fetchedAt: 1710523800000,
      schemaVersion: 1,
    },
  ],
};

describe('seedDemoDatabase — il loader del fixture demo (Story 3.5)', () => {
  afterEach(async () => {
    await closeAllDbs();
  });

  it('popola tutte le tabelle e restituisce il report', async () => {
    const db = freshDb('ls-demo-seed-test');
    const report = await seedDemoDatabase(db, FIXTURE, { now: 1710523800000 });

    expect(report).toEqual({ listens: 2, tracks: 1, artists: 1, albums: 1, features: 1 });
    expect(await db.listens.count()).toBe(2);
    expect(await db.tracks.count()).toBe(1);
    expect(await db.artists.count()).toBe(1);
    expect(await db.albums.count()).toBe(1);
    expect(await db.features.count()).toBe(1);
  });

  it('i campi assenti diventano null (schema v6: i tre campi città)', async () => {
    const db = freshDb('ls-demo-seed-v6-test');
    await seedDemoDatabase(db, FIXTURE, { now: 1710523800000 });

    const listen = await db.listens.get('spotify:ek-demo-1');
    expect(listen).toBeDefined();
    expect(listen?.city).toBeNull();
    expect(listen?.citySource).toBeNull();
    expect(listen?.cityConfidence).toBeNull();
    expect(listen?.ip).toBeNull();
    expect(listen?.deviceDetail).toBeNull();

    const track = await db.tracks.get('fuzzy:ck-demo-1');
    expect(track?.artworkUrl).toBeNull();
    expect(track?.isrc).toBeNull();
    expect(track?.explicit).toBeNull();

    const feature = await db.features.get('tr-demo-1');
    expect(feature?.danceability).toBeNull();
    expect(feature?.tempo).toBeNull();
  });

  it('nessun riferimento pendente: album, artisti e feature esistono', async () => {
    const db = freshDb('ls-demo-seed-refs-test');
    await seedDemoDatabase(db, FIXTURE, { now: 1710523800000 });

    const albumIds = new Set((await db.albums.toArray()).map((album) => album.id));
    const artistIds = new Set((await db.artists.toArray()).map((artist) => artist.id));
    const trackIds = new Set((await db.tracks.toArray()).map((track) => track.id));

    const tracks = await db.tracks.toArray();
    const referencedAlbumIds = tracks
      .map((track) => track.albumId)
      .filter((albumId): albumId is string => albumId !== null);
    expect(referencedAlbumIds.every((albumId) => albumIds.has(albumId))).toBe(true);
    expect(tracks.every((track) => artistIds.has(track.artistId))).toBe(true);

    const listens = await db.listens.toArray();
    expect(listens.every((listen) => trackIds.has(listen.trackId))).toBe(true);

    const features = await db.features.toArray();
    expect(features.every((feature) => trackIds.has(feature.trackId))).toBe(true);
  });

  it('recount allineato: i contatori vengono ricalcolati, non copiati', async () => {
    const db = freshDb('ls-demo-seed-recount-test');
    await seedDemoDatabase(db, FIXTURE, { now: 1710523800000 });

    const track = await db.tracks.get('fuzzy:ck-demo-1');
    const artist = await db.artists.get('ar-demo-1');
    expect(track?.listenCount).toBe(2);
    expect(artist?.listenCount).toBe(2);
  });

  it('idempotente: due seed sullo stesso database non duplicano', async () => {
    const db = freshDb('ls-demo-seed-idempotent-test');
    await seedDemoDatabase(db, FIXTURE, { now: 1710523800000 });
    const second = await seedDemoDatabase(db, FIXTURE, { now: 1710523800000 });

    expect(second).toEqual({ listens: 2, tracks: 1, artists: 1, albums: 1, features: 1 });
    expect(await db.listens.count()).toBe(2);
    expect(await db.tracks.count()).toBe(1);
    expect(await db.artists.count()).toBe(1);
    expect(await db.albums.count()).toBe(1);
    expect(await db.features.count()).toBe(1);
  });

  it('l album derivato chiude i riferimenti quando il fixture non li dichiara', async () => {
    const db = freshDb('ls-demo-seed-album-test');
    const report = await seedDemoDatabase(
      db,
      { listens: FIXTURE.listens, tracks: FIXTURE.tracks, artists: FIXTURE.artists },
      { now: 1710523800000 },
    );

    expect(report.albums).toBe(1);
    const album = await db.albums.get('al-demo-1');
    expect(album?.artistId).toBe('ar-demo-1');
  });

  it('clearDemoDatabase svuota il database demo e non tocca quello dell utente', async () => {
    const userDb = freshDb('ls-demo-seed-user-test');
    const demoDb = freshDb('ls-demo-seed-demo-test');
    await userDb.listens.put({
      id: 'le-user-1',
      eventKey: 'spotify:ek-user-1',
      platform: 'spotify',
      importId: 'imp-user',
      timestamp: 1710523800000,
      startedAt: null,
      durationMs: 200000,
      trackId: 'tr-user-1',
      completed: true,
      skipped: false,
      shuffle: null,
      offline: null,
      incognito: null,
      reasonStart: null,
      reasonEnd: null,
      deviceType: 'mobile',
      deviceDetail: null,
      ip: null,
      country: null,
      city: null,
      citySource: null,
      cityConfidence: null,
      day: '2024-03-15',
    });
    await seedDemoDatabase(demoDb, FIXTURE, { now: 1710523800000 });

    await clearDemoDatabase('ls-demo-seed-demo-test');

    expect(await userDb.listens.count()).toBe(1);

    const reopened = new LifeSoundtrackDB('ls-demo-seed-demo-test');
    await reopened.open();
    expect(await reopened.listens.count()).toBe(0);
    await reopened.delete();
  });
});
