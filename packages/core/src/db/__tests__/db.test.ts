import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import type { Track } from '../../schema';
import type { LifeSoundtrackDB } from '../index';
import {
  DB_SCHEMA_V1,
  DB_SCHEMA_V2,
  DB_SCHEMA_V3,
  countListens,
  getAlbum,
  getArtist,
  getFeatures,
  getListen,
  getTrack,
  listAlbumsByArtist,
  listArtistsByName,
  listArtistsByMbid,
  listFeaturesBySource,
  listListensByDay,
  listListensByImport,
  listListensByPlatform,
  listListensByTrack,
  listListensInRange,
  listTracksByAlbum,
  listTracksByArtist,
  listTracksByIsrc,
  listTracksByMbid,
  listTracksByName,
  openDb,
  purgeIp,
  putAlbums,
  putArtists,
  putFeatures,
  putListens,
  putTracks,
  recount,
} from '../index';
import {
  closeAllDbs,
  freshDb,
  loadSeed,
  makeAlbum,
  makeArtist,
  makeFeatures,
  makeListen,
  makeTrack,
  registerDb,
  seedCounts,
} from './helpers';

afterEach(closeAllDbs);

// ---------------------------------------------------------------------------
// T0.2.2 — schema Dexie: tabelle e indici di 02-DATA-SCHEMA.md §6
// ---------------------------------------------------------------------------

describe('schema Dexie (02-DATA-SCHEMA.md §6)', () => {
  it('espone tutte le 12 tabelle della spec v1.1/v1.2', async () => {
    const db = freshDb('ls-schema-tables');
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      [
        'albums',
        'artists',
        'features',
        'imports',
        'insights',
        'library',
        'listens',
        'playlistItems',
        'playlists',
        'searchQueries',
        'sessions',
        'tracks',
      ].sort(),
    );
  });

  it('ha indici identici a quelli dichiarati in §6', async () => {
    const db = freshDb('ls-schema-indexes');
    await db.open();

    // Attesi copiati dalla spec §6 (indipendenti dal codice): [primaria, indici]
    const expected: Record<string, { primKey: string; indexes: string[] }> = {
      listens: {
        primKey: 'eventKey',
        indexes: ['timestamp', 'startedAt', 'trackId', 'platform', 'day', 'importId'],
      },
      tracks: {
        primKey: 'canonicalKey',
        indexes: ['name', 'artistId', 'albumId', 'isrc', 'mbid'],
      },
      artists: { primKey: 'id', indexes: ['name', 'mbid'] },
      albums: { primKey: 'id', indexes: ['name', 'artistId'] },
      features: { primKey: 'trackId', indexes: ['source'] },
      sessions: { primKey: 'id', indexes: ['startTime', 'platform', 'derivedVersion'] },
      insights: { primKey: 'id', indexes: ['type', 'periodStart', 'derivedVersion', 'status'] },
      imports: { primKey: 'id', indexes: ['platform', 'fileHash', 'startedAt'] },
      library: { primKey: 'id', indexes: ['trackId', 'artistId', 'albumId', 'platform'] },
      playlists: { primKey: 'id', indexes: ['platform'] },
      playlistItems: { primKey: '[playlistId+trackId]', indexes: ['playlistId', 'addedAt'] },
      searchQueries: { primKey: 'id', indexes: ['platform', 'timestamp', '[platform+normalized]'] },
    };

    for (const [table, want] of Object.entries(expected)) {
      const t = db.table(table);
      const got = {
        primKey: t.schema.primKey.name,
        indexes: t.schema.indexes.map((i) => i.name).sort(),
      };
      expect(got.primKey, `primKey di ${table}`).toBe(want.primKey);
      expect(got.indexes, `indici di ${table}`).toEqual([...want.indexes].sort());
    }
  });

  it('dichiara la versione 3 come massima (aggiunta searchQueries v1→v2, artworkUrl v2→v3)', async () => {
    const db = freshDb('ls-schema-versions');
    await db.open();
    expect(db.verno).toBe(3);
    expect(Object.keys(DB_SCHEMA_V2)).toContain('searchQueries');
    expect(Object.keys(DB_SCHEMA_V1)).not.toContain('searchQueries');
    expect(Object.keys(DB_SCHEMA_V3).length).toBe(Object.keys(DB_SCHEMA_V2).length);
  });

  it('openDb apre o crea il DB col nome di default', async () => {
    const db = await openDb('ls-opendb-check');
    registerDb(db);
    expect(db.isOpen()).toBe(true);
    expect(db.name).toBe('ls-opendb-check');
  });
});

// ---------------------------------------------------------------------------
// Migrazione v1 → v2 (02§7 MIG-1, 10-TESTING §4.3)
// ---------------------------------------------------------------------------

describe('migrazione v1 → v2', () => {
  it('preserva i dati v1 e aggiunge la tabella searchQueries', async () => {
    // 1. Crea un DB "legacy" con solo lo schema v1 e inserisci dati.
    class LegacyV1DB extends Dexie {
      constructor(name: string) {
        super(name);
        this.version(1).stores(DB_SCHEMA_V1);
      }
    }
    const name = 'ls-migration-v1-v2';
    const legacy = new LegacyV1DB(name);
    registerDb(legacy as unknown as LifeSoundtrackDB);
    const listen = makeListen();
    const track = makeTrack();
    await legacy.open();
    await legacy.table('listens').put(listen);
    await legacy.table('tracks').put(track);
    expect(await legacy.table('listens').count()).toBe(1);
    legacy.close();

    // 2. Riapre con lo schema corrente (v1→v2→v3): le migrazioni sono automatiche.
    const upgraded = freshDb(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(3);
    expect(await getListen(upgraded, listen.eventKey)).toEqual(listen);
    expect(await getTrack(upgraded, track.canonicalKey)).toEqual(track);
    expect(upgraded.table('searchQueries')).toBeDefined();

    // 3. La tabella aggiunta è scrivibile dopo la migrazione.
    await upgraded.searchQueries.put({
      id: 'sq-1',
      platform: 'spotify',
      query: 'Radiohead',
      normalized: 'radiohead',
      timestamp: 1710523800000,
      resultCount: 10,
      context: 'manual',
    });
    expect(await upgraded.searchQueries.get('sq-1')).toMatchObject({ query: 'Radiohead' });
  });
});

// ---------------------------------------------------------------------------
// Migrazione v2 → v3 (02-DATA-SCHEMA.md §10, artworkUrl nullable)
// ---------------------------------------------------------------------------

describe('migrazione v2 → v3', () => {
  it('aggiunge artworkUrl null a track e album esistenti senza perdere dati', async () => {
    // 1. Crea un DB "legacy" con solo lo schema v2 e inserisci dati.
    class LegacyV2DB extends Dexie {
      constructor(name: string) {
        super(name);
        this.version(1).stores(DB_SCHEMA_V1);
        this.version(2).stores(DB_SCHEMA_V2);
      }
    }
    const name = 'ls-migration-v2-v3';
    const legacy = new LegacyV2DB(name);
    registerDb(legacy as unknown as LifeSoundtrackDB);
    const track = makeTrack();
    const album = makeAlbum();
    await legacy.open();
    await legacy.table('tracks').put(track);
    await legacy.table('albums').put(album);
    expect(await legacy.table('tracks').count()).toBe(1);
    expect(await legacy.table('albums').count()).toBe(1);
    legacy.close();

    // 2. Riapre con lo schema corrente (v3): la migrazione v2→v3 è automatica.
    const upgraded = freshDb(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(3);

    // 3. I dati esistenti sono preservati e artworkUrl è stato aggiunto come null.
    const storedTrack = await upgraded.table('tracks').get(track.canonicalKey);
    const storedAlbum = await upgraded.table('albums').get(album.id);
    expect(storedTrack?.artworkUrl).toBe(null);
    expect(storedAlbum?.artworkUrl).toBe(null);
    expect(storedTrack?.name).toBe(track.name);
    expect(storedAlbum?.name).toBe(album.name);
  });
});

// ---------------------------------------------------------------------------
// T0.2.3 — Repository: CRUD e query base
// ---------------------------------------------------------------------------

describe('repository listens', () => {
  it('put + get per eventKey', async () => {
    const db = freshDb('ls-listens-crud');
    const listen = makeListen();
    await putListens(db, [listen]);
    expect(await getListen(db, listen.eventKey)).toEqual(listen);
    expect(await getListen(db, 'inesistente')).toBeUndefined();
  });

  it('query per day, trackId, platform, importId e range temporale', async () => {
    const db = freshDb('ls-listens-queries');
    const a = makeListen({ day: '2024-03-15', platform: 'spotify', importId: 'imp-A' });
    const b = makeListen({ day: '2024-03-16', platform: 'lastfm', importId: 'imp-B' });
    const c = makeListen({ day: '2024-03-16', platform: 'spotify', importId: 'imp-A' });
    await putListens(db, [a, b, c]);

    expect(await listListensByDay(db, '2024-03-16')).toHaveLength(2);
    expect(await listListensByTrack(db, a.trackId)).toHaveLength(3);
    expect(await listListensByPlatform(db, 'spotify')).toHaveLength(2);
    expect(await listListensByImport(db, 'imp-B')).toEqual([b]);
    expect(await listListensInRange(db, b.timestamp, c.timestamp)).toEqual([b, c]);
    expect(await listListensInRange(db, 0, 1)).toEqual([]);
    expect(await countListens(db)).toBe(3);
  });

  it('purgeIp azzera gli ip e conserva il country (02§3.8)', async () => {
    const db = freshDb('ls-listens-purgeip');
    const keep = makeListen({ ip: null, country: 'IT' });
    const purge = makeListen({ ip: '203.0.113.7', country: 'DE' });
    await putListens(db, [keep, purge]);

    await purgeIp(db);

    expect(await getListen(db, purge.eventKey)).toMatchObject({ ip: null, country: 'DE' });
    expect(await getListen(db, keep.eventKey)).toMatchObject({ ip: null, country: 'IT' });
  });
});

describe('repository tracks', () => {
  it('upsert per canonicalKey: re-import non duplica (DEDUP §5)', async () => {
    const db = freshDb('ls-tracks-upsert');
    const track = makeTrack();
    await putTracks(db, [track]);
    const updated: Track = { ...track, name: 'Nome aggiornato', listenCount: 4 };
    await putTracks(db, [updated]);

    expect(await db.tracks.count()).toBe(1);
    expect(await getTrack(db, track.canonicalKey)).toMatchObject({
      name: 'Nome aggiornato',
      listenCount: 4,
    });
  });

  it('query per artistId, albumId, isrc, mbid e name', async () => {
    const db = freshDb('ls-tracks-queries');
    const artist = makeArtist();
    const album = makeAlbum({ artistId: artist.id });
    const t1 = makeTrack({
      artistId: artist.id,
      albumId: album.id,
      isrc: 'ITG040000001',
      name: 'Same Name',
    });
    const t2 = makeTrack({ artistId: artist.id, mbid: 'mbid-1', name: 'Same Name' });
    const t3 = makeTrack({ artistId: 'artist-alt', name: 'Same Name' });
    await putAlbums(db, [album]);
    await putArtists(db, [artist]);
    await putTracks(db, [t1, t2, t3]);

    expect((await listTracksByArtist(db, artist.id)).map((t) => t.id)).toEqual([t1.id, t2.id]);
    expect(await listTracksByAlbum(db, album.id)).toEqual([t1]);
    expect(await listTracksByIsrc(db, 'ITG040000001')).toEqual([t1]);
    expect(await listTracksByMbid(db, 'mbid-1')).toEqual([t2]);
    expect(await listTracksByName(db, 'Same Name')).toHaveLength(3);
  });
});

describe('repository artists e albums', () => {
  it('upsert per id e query per name, mbid, artistId', async () => {
    const db = freshDb('ls-artists-albums');
    const a1 = makeArtist({ name: 'Eco', mbid: 'mbid-a1' });
    const a2 = makeArtist({ name: 'Eco' });
    await putArtists(db, [a1, a2]);
    const album = makeAlbum({ artistId: a1.id });
    await putAlbums(db, [album]);

    expect(await getArtist(db, a1.id)).toEqual(a1);
    expect(await listArtistsByName(db, 'Eco')).toHaveLength(2);
    expect(await listArtistsByMbid(db, 'mbid-a1')).toEqual([a1]);
    expect(await getAlbum(db, album.id)).toEqual(album);
    expect(await listAlbumsByArtist(db, a1.id)).toEqual([album]);
    expect(await getAlbum(db, 'nessuno')).toBeUndefined();
  });
});

describe('repository features', () => {
  it('upsert per trackId (una riga per traccia) e query per source', async () => {
    const db = freshDb('ls-features');
    const f1 = makeFeatures({ source: 'essentia' });
    const f2 = makeFeatures({ source: 'heuristic' });
    await putFeatures(db, [f1, f2]);

    expect(await getFeatures(db, f1.trackId)).toEqual(f1);
    const again: typeof f1 = { ...f1, valence: 0.9 };
    await putFeatures(db, [again]);
    expect(await db.features.count()).toBe(2);
    expect(await getFeatures(db, f1.trackId)).toMatchObject({ valence: 0.9 });
    expect(await listFeaturesBySource(db, 'essentia')).toEqual([again]);
    expect(await listFeaturesBySource(db, 'acousticbrainz')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Idempotenza import via eventKey (02§1.3, 10-TESTING §7)
// ---------------------------------------------------------------------------

describe('idempotenza eventKey (invariante 10-TESTING §7)', () => {
  it('re-put degli stessi eventi non crea duplicati', async () => {
    const db = freshDb('ls-idempotenza');
    const events = Array.from({ length: 100 }, (_, i) =>
      makeListen({ eventKey: `spotify:ek-${i}` }),
    );

    await putListens(db, events);
    await putListens(db, events);

    expect(await countListens(db)).toBe(100);
    await expect(db.listens.bulkAdd(events)).rejects.toThrow();
    expect(await countListens(db)).toBe(100);
  });

  it('eventKey diversi con stesso contenuto creano eventi distinti', async () => {
    const db = freshDb('ls-eventkey-distinti');
    const base = makeListen();
    const clone = { ...base, eventKey: `${base.eventKey}-b`, id: `${base.id}-b` };
    await putListens(db, [base, clone]);
    expect(await countListens(db)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// T0.2.4 — recount() (02§7 MIG-4)
// ---------------------------------------------------------------------------

describe('recount()', () => {
  it('ricalcola listenCount di tracks e artists a partire dagli ascolti', async () => {
    const db = freshDb('ls-recount-minimal');
    const seed = loadSeed('minimal');
    await putArtists(db, seed.artists);
    await putTracks(db, seed.tracks);
    await putListens(db, seed.listens);

    await recount(db);

    // Track sopravvissute per canonicalKey: bulkPut con PK canonicalKey fonde i
    // gruppi DEDUP del fixture (l'ultimo record per chiave vince).
    const surviving = new Map<string, Track>();
    for (const track of seed.tracks) surviving.set(track.canonicalKey, track);
    const listensByTrackId = new Map<string, number>();
    for (const listen of seed.listens) {
      listensByTrackId.set(listen.trackId, (listensByTrackId.get(listen.trackId) ?? 0) + 1);
    }

    for (const [canonicalKey, track] of surviving) {
      const stored = await getTrack(db, canonicalKey);
      expect(stored?.id, `id sopravvissuto per ${canonicalKey}`).toBe(track.id);
      expect(stored?.listenCount, `listenCount per ${canonicalKey}`).toBe(
        listensByTrackId.get(track.id) ?? 0,
      );
    }
    for (const artist of seed.artists) {
      const stored = await getArtist(db, artist.id);
      let expected = 0;
      for (const track of surviving.values()) {
        if (track.artistId === artist.id) expected += listensByTrackId.get(track.id) ?? 0;
      }
      expect(stored?.listenCount, `listenCount artist ${artist.id}`).toBe(expected);
    }
  });

  it('azzera i contatori quando gli ascolti vengono eliminati', async () => {
    const db = freshDb('ls-recount-reset');
    const artist = makeArtist();
    const track = makeTrack({ artistId: artist.id });
    await putArtists(db, [artist]);
    await putTracks(db, [track]);
    await putListens(db, [makeListen({ trackId: track.id }), makeListen({ trackId: track.id })]);

    await recount(db);
    expect((await getTrack(db, track.canonicalKey))?.listenCount).toBe(2);
    expect((await getArtist(db, artist.id))?.listenCount).toBe(2);

    await db.listens.clear();
    await recount(db);
    expect((await getTrack(db, track.canonicalKey))?.listenCount).toBe(0);
    expect((await getArtist(db, artist.id))?.listenCount).toBe(0);
  });

  it('recount è idempotente', async () => {
    const db = freshDb('ls-recount-idempotente');
    const seed = loadSeed('minimal');
    await putArtists(db, seed.artists);
    await putTracks(db, seed.tracks);
    await putListens(db, seed.listens);

    await recount(db);
    const after1 = await db.tracks.toArray();
    await recount(db);
    const after2 = await db.tracks.toArray();
    expect(after2).toEqual(after1);
  });
});

// ---------------------------------------------------------------------------
// Integrazione fixture medium (10-TESTING §3.2)
// ---------------------------------------------------------------------------

describe('integrazione fixture db-seed/medium.json', () => {
  it('carica 5.000 eventi e fonde i gruppi DEDUP sulla PK canonicalKey', async () => {
    const db = freshDb('ls-integrazione-medium');
    const seed = loadSeed('medium');
    const counts = seedCounts(seed);

    await putArtists(db, seed.artists);
    await putTracks(db, seed.tracks);
    await putListens(db, seed.listens);

    expect(counts.listens).toBe(5000);
    expect(await countListens(db)).toBe(counts.listens);
    // 500 record ma PK canonicalKey: i gruppi DEDUP del fixture si fondono.
    expect(await db.tracks.count()).toBe(counts.tracks);
    expect(await db.artists.count()).toBe(counts.artists);

    await recount(db);

    // I listens che referenziano UUID soppiantati dal merge non trovano la track:
    // restano nel DB ma non contribuiscono ai contatori. Limite noto del fixture
    // (l'adapter risolverà trackId via DEDUP in Story 0.3, 05§3).
    const surviving = new Map<string, Track>();
    for (const track of seed.tracks) surviving.set(track.canonicalKey, track);
    const survivingIds = new Set([...surviving.values()].map((t) => t.id));
    const orphanListens = seed.listens.filter((l) => !survivingIds.has(l.trackId)).length;

    const totalFromTracks = (await db.tracks.toArray()).reduce((s, t) => s + t.listenCount, 0);
    expect(totalFromTracks).toBe(counts.listens - orphanListens);
    const totalFromArtists = (await db.artists.toArray()).reduce((s, a) => s + a.listenCount, 0);
    expect(totalFromArtists).toBe(totalFromTracks);
  });

  it('re-import parziale del medium non duplica nulla', async () => {
    const db = freshDb('ls-idempotenza-medium');
    const seed = loadSeed('medium');
    await putListens(db, seed.listens);
    // Il re-put su chiavi esistenti attraversa il slow-path di fake-indexeddb
    // (scan per chunk): una slice di 50 eventi è equivalente ai fini dell'
    // invariante e mantiene la suite veloce. L'idempotenza integrale è
    // coperta dal test dedicato (100 eventi) e dall'unicità della PK eventKey.
    await putListens(db, seed.listens.slice(0, 50));
    expect(await countListens(db)).toBe(5000);
    expect(new Set(seed.listens.map((l) => l.eventKey)).size).toBe(5000);
  });
});
