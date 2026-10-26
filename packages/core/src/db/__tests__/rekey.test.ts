import { afterEach, describe, expect, it } from 'vitest';
import type { LibraryItem, ListenEvent, PlaylistItem, Track } from '../../schema';
import { putListens, putTracks, rekey, type RekeyReport } from '../index';
import { closeAllDbs, freshDb, makeFeatures, makeListen, makeTrack } from './helpers';

/**
 * `rekey()` — promozione `fuzzy:` → `isrc:`/`mbid:` e unione dei duplicati
 * (Story 1.4, `02-DATA-SCHEMA.md` §5, `05-ARCHITECTURE.md` §12.1).
 *
 * I test di base (promozione semplice, merge con una track già `isrc:`,
 * idempotenza) sono in `operations.test.ts` (T0.7.3). Qui le garanzie che
 * la Story 1.4 dichiara e che non erano coperte.
 */

/** ISRC di prova: lo stesso brano, due varianti fuzzy. */
const ISRC = 'ITG040000001';

describe('rekey() — Story 1.4', () => {
  afterEach(async () => {
    await closeAllDbs();
  });

  it('due track fuzzy con lo stesso ISRC → una sola track (AC Story 1.4)', async () => {
    const db = freshDb('ls-rekey-due-fuzzy');
    const a = makeTrack({
      canonicalKey: 'fuzzy:ApocalypseDreams|TameImpala|0',
      name: 'Apocalypse Dreams',
      isrc: ISRC,
      firstSeenAt: 1000,
    });
    const b = makeTrack({
      canonicalKey: 'fuzzy:Apocalypse Dreams|Tame Impala|0',
      name: 'Apocalypse Dreams',
      isrc: ISRC,
      firstSeenAt: 2000,
    });
    await putTracks(db, [a, b]);

    const report = await rekey(db);

    const tracks = await db.tracks.toArray();
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.canonicalKey).toBe(`isrc:${ISRC}`);
    expect(report.promoted).toBe(1);
    expect(report.merged).toBe(1);
  });

  it('ISRC in minuscolo → promossa a isrc:<UPPER> (DEDUP-1, `02§5`)', async () => {
    const db = freshDb('ls-rekey-isrc-upper');
    await putTracks(db, [makeTrack({ canonicalKey: 'fuzzy:x', isrc: 'itg040000002', mbid: null })]);

    await rekey(db);

    const track = await db.tracks.get('isrc:ITG040000002');
    expect(track).toBeDefined();
  });

  it('ISRC e MBID entrambi presenti → vince l’ISRC (priorità DEDUP-1 su DEDUP-2)', async () => {
    const db = freshDb('ls-rekey-priority');
    await putTracks(db, [makeTrack({ canonicalKey: 'fuzzy:x', isrc: ISRC, mbid: 'mbid-1' })]);

    await rekey(db);

    expect(await db.tracks.get(`isrc:${ISRC}`)).toBeDefined();
    expect(await db.tracks.get('mbid:mbid-1')).toBeUndefined();
  });

  it('sopravvivenza deterministica: vince la track più vecchia, indipendentemente dall’ordine di inserimento', async () => {
    const db = freshDb('ls-rekey-determinismo');
    const vecchia = makeTrack({
      id: 'track-vecchia',
      canonicalKey: 'fuzzy:vecchia',
      isrc: ISRC,
      firstSeenAt: 1000,
    });
    const nuova = makeTrack({
      id: 'track-nuova',
      canonicalKey: 'fuzzy:nuova',
      isrc: ISRC,
      firstSeenAt: 9000,
    });
    // Inserite in ordine inverso rispetto all'anzianità.
    await putTracks(db, [nuova, vecchia]);

    await rekey(db);

    const track = await db.tracks.get(`isrc:${ISRC}`);
    expect(track).toBeDefined();
    expect(track!.id).toBe('track-vecchia');
  });

  it('i riferimenti sono riorientati: listens, library, playlistItems, features', async () => {
    const db = freshDb('ls-rekey-referimenti');
    const vincitrice = makeTrack({
      id: 'track-vincitrice',
      canonicalKey: `isrc:${ISRC}`,
      isrc: ISRC,
      firstSeenAt: 1000,
    });
    const perdente = makeTrack({
      id: 'track-perdente',
      canonicalKey: 'fuzzy:variante',
      isrc: ISRC,
      firstSeenAt: 2000,
    });
    await putTracks(db, [vincitrice, perdente]);

    const listens: ListenEvent[] = [
      makeListen({ eventKey: 'spotify:ek-1', trackId: 'track-perdente' }),
      makeListen({ eventKey: 'spotify:ek-2', trackId: 'track-vincitrice' }),
    ];
    await putListens(db, listens);

    const libraryItem: LibraryItem = {
      id: 'lib-1',
      platform: 'spotify',
      kind: 'saved_track',
      trackId: 'track-perdente',
      albumId: null,
      artistId: null,
      addedAt: 1,
    };
    await db.library.put(libraryItem);

    const playlistItem: PlaylistItem = {
      playlistId: 'pl-1',
      trackId: 'track-perdente',
      position: 0,
      addedAt: 1,
    };
    await db.playlistItems.put(playlistItem);

    await db.features.put(makeFeatures({ trackId: 'track-perdente' }));

    const report = await rekey(db);

    expect(report.listenedMoved).toBe(1);
    expect(report.libraryRepointed).toBe(1);
    expect(report.playlistItemsRepointed).toBe(1);
    expect(report.featuresRepointed).toBe(1);

    // Gli ascolti puntano tutti alla track sopravvissuta.
    const allListens = await db.listens.toArray();
    expect(allListens.every((listen) => listen.trackId === 'track-vincitrice')).toBe(true);

    // La libreria e la playlist non hanno riferimenti pendenti.
    const library = await db.library.toArray();
    expect(library).toHaveLength(1);
    expect(library[0]!.trackId).toBe('track-vincitrice');
    const items = await db.playlistItems.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]!.trackId).toBe('track-vincitrice');
    expect(await db.features.get('track-vincitrice')).toBeDefined();
    expect(await db.features.get('track-perdente')).toBeUndefined();
  });

  it('la fusione non perde platformIds, generi e finestra temporale', async () => {
    const db = freshDb('ls-rekey-merge-campi');
    const a: Track = makeTrack({
      id: 'track-a',
      canonicalKey: 'fuzzy:a',
      isrc: ISRC,
      firstSeenAt: 1000,
      lastSeenAt: 5000,
      genres: ['rock'],
      platformIds: { spotify: 'spotify-1' },
    });
    const b: Track = makeTrack({
      id: 'track-b',
      canonicalKey: 'fuzzy:b',
      isrc: ISRC,
      firstSeenAt: 2000,
      lastSeenAt: 9000,
      genres: ['psych'],
      platformIds: { lastfm: 'lastfm-1' },
    });
    await putTracks(db, [a, b]);

    await rekey(db);

    const track = await db.tracks.get(`isrc:${ISRC}`);
    expect(track).toBeDefined();
    expect(track!.genres).toEqual(expect.arrayContaining(['rock', 'psych']));
    expect(track!.platformIds.spotify).toBe('spotify-1');
    expect(track!.platformIds.lastfm).toBe('lastfm-1');
    expect(track!.firstSeenAt).toBe(1000);
    expect(track!.lastSeenAt).toBe(9000);
  });

  it('listenCount ricalcolato dalla fonte di verità (recount, MIG-4)', async () => {
    const db = freshDb('ls-rekey-listen-count');
    const a = makeTrack({ id: 'track-a', canonicalKey: 'fuzzy:a', isrc: ISRC, firstSeenAt: 1000 });
    const b = makeTrack({ id: 'track-b', canonicalKey: 'fuzzy:b', isrc: ISRC, firstSeenAt: 2000 });
    await putTracks(db, [a, b]);
    await putListens(db, [
      makeListen({ eventKey: 'spotify:ek-1', trackId: 'track-a' }),
      makeListen({ eventKey: 'spotify:ek-2', trackId: 'track-b' }),
      makeListen({ eventKey: 'spotify:ek-3', trackId: 'track-b' }),
    ]);

    await rekey(db);

    const track = await db.tracks.get(`isrc:${ISRC}`);
    expect(track!.listenCount).toBe(3);
  });

  it('idempotente: la seconda esecuzione non cambia nulla', async () => {
    const db = freshDb('ls-rekey-idempotente-2');
    await putTracks(db, [
      makeTrack({ canonicalKey: 'fuzzy:a', isrc: ISRC, firstSeenAt: 1000 }),
      makeTrack({ canonicalKey: 'fuzzy:b', isrc: ISRC, firstSeenAt: 2000 }),
    ]);

    const first = await rekey(db);
    const after = await db.tracks.toArray();
    const second: RekeyReport = await rekey(db);

    expect(first.promoted).toBe(1);
    expect(first.merged).toBe(1);
    expect(second.promoted).toBe(0);
    expect(second.merged).toBe(0);
    expect(await db.tracks.toArray()).toEqual(after);
  });

  it('una track senza ISRC né MBID resta fuzzy: (è ancora un’ipotesi)', async () => {
    const db = freshDb('ls-rekey-senza-ids');
    const track = makeTrack({ canonicalKey: 'fuzzy:senza-ids', isrc: null, mbid: null });
    await putTracks(db, [track]);

    const report = await rekey(db);

    expect(report.promoted).toBe(0);
    expect(report.merged).toBe(0);
    expect(await db.tracks.get('fuzzy:senza-ids')).toBeDefined();
  });

  it('una track già promossa non viene toccata', async () => {
    const db = freshDb('ls-rekey-gia-promossa');
    const track = makeTrack({ canonicalKey: `isrc:${ISRC}`, isrc: ISRC, firstSeenAt: 1000 });
    await putTracks(db, [track]);

    const report = await rekey(db);

    expect(report.promoted).toBe(0);
    expect(report.merged).toBe(0);
    const after = await db.tracks.get(`isrc:${ISRC}`);
    expect(after).toBeDefined();
    expect(after!.id).toBe(track.id);
  });
});
