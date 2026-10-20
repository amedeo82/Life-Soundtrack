import { afterEach, describe, expect, it } from 'vitest';
import {
  orphanCleanup,
  putArtists,
  putListens,
  putTracks,
  recount,
  rekey,
  runHealthCheck,
} from '../index';
import { closeAllDbs, freshDb, makeArtist, makeListen, makeTrack, registerDb } from './helpers';

afterEach(closeAllDbs);

// ---------------------------------------------------------------------------
// T0.7.3 — rekey() (05§12.1, Story 1.4 Dedup promozione)
// ---------------------------------------------------------------------------

describe('rekey()', () => {
  it('promuove canonicalKey da fuzzy a isrc quando non esiste conflitto', async () => {
    const db = freshDb('ls-rekey-promote-isrc');
    const track = makeTrack({
      canonicalKey: 'fuzzy:ck-1',
      isrc: 'ITG040000001',
      mbid: null,
      id: 'track-uuid-1',
    });
    await putTracks(db, [track]);

    const report = await rekey(db);

    expect(report.promoted).toBe(1);
    expect(report.merged).toBe(0);
    expect(await db.tracks.get('isrc:ITG040000001')).toMatchObject({
      id: 'track-uuid-1',
      canonicalKey: 'isrc:ITG040000001',
      isrc: 'ITG040000001',
    });
    expect(await db.tracks.get('fuzzy:ck-1')).toBeUndefined();
  });

  it('promuove canonicalKey da fuzzy a mbid quando non esiste conflitto', async () => {
    const db = freshDb('ls-rekey-promote-mbid');
    const track = makeTrack({
      canonicalKey: 'fuzzy:ck-2',
      isrc: null,
      mbid: 'mbid-rec-1',
      id: 'track-uuid-2',
    });
    await putTracks(db, [track]);

    const report = await rekey(db);

    expect(report.promoted).toBe(1);
    expect(await db.tracks.get('mbid:mbid-rec-1')).toMatchObject({
      canonicalKey: 'mbid:mbid-rec-1',
      mbid: 'mbid-rec-1',
    });
    expect(await db.tracks.get('fuzzy:ck-2')).toBeUndefined();
  });

  it('unisce due track con stesso ISRC (fuzzy + isrc esistente) e aggrega listenCount', async () => {
    const db = freshDb('ls-rekey-merge-isrc');
    const vincitrice = makeTrack({
      canonicalKey: 'isrc:ITG040000002',
      isrc: 'ITG040000002',
      id: 'track-vincitrice',
      listenCount: 5,
    });
    const daUnire = makeTrack({
      canonicalKey: 'fuzzy:ck-3',
      isrc: 'ITG040000002',
      id: 'track-da-unire',
      listenCount: 3,
    });
    await putTracks(db, [vincitrice, daUnire]);

    // Listen eventi sulla track da unire.
    const l1 = makeListen({ trackId: 'track-da-unire', eventKey: 'spotify:ek-l1' });
    const l2 = makeListen({ trackId: 'track-da-unire', eventKey: 'spotify:ek-l2' });
    await putListens(db, [l1, l2]);

    const report = await rekey(db);

    expect(report.merged).toBe(1);
    expect(report.listenedMoved).toBe(2);
    const v = await db.tracks.get('isrc:ITG040000002');
    expect(v?.listenCount).toBe(8); // 5 + 3
    expect(await db.tracks.get('fuzzy:ck-3')).toBeUndefined();
    // I listen sono stati riorientati.
    expect((await db.listens.where('trackId').equals('track-vincitrice').toArray()).length).toBe(2);
    expect((await db.listens.where('trackId').equals('track-da-unire').toArray()).length).toBe(0);
  });

  it('è idempotente: riesecuzione non altera nulla', async () => {
    const db = freshDb('ls-rekey-idempotente');
    const track = makeTrack({
      canonicalKey: 'fuzzy:ck-4',
      isrc: 'ITG040000003',
      id: 'track-uuid-4',
    });
    await putTracks(db, [track]);

    const r1 = await rekey(db);
    const r2 = await rekey(db);

    expect(r1.promoted).toBe(1);
    expect(r2.promoted).toBe(0); // già promosso, niente da fare
    expect(await db.tracks.get('isrc:ITG040000003')).toBeDefined();
  });

  it('non modifica track già non-fuzzy', async () => {
    const db = freshDb('ls-rekey-noop');
    const track = makeTrack({
      canonicalKey: 'isrc:ITG040000004',
      isrc: 'ITG040000004',
      id: 'track-uuid-5',
    });
    await putTracks(db, [track]);

    const report = await rekey(db);

    expect(report.promoted).toBe(0);
    expect(report.merged).toBe(0);
    expect(await db.tracks.count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T0.7.3 — orphanCleanup() (05§12.1)
// ---------------------------------------------------------------------------

describe('orphanCleanup()', () => {
  it('rimuove track e artisti non referenziati da listens né da library', async () => {
    const db = freshDb('ls-orphan-cleanup');
    const artistaOrfano = makeArtist({ id: 'artist-orfano', name: 'Orfano' });
    const trackOrfana = makeTrack({
      id: 'track-orfana',
      canonicalKey: 'fuzzy:ck-orfana',
      artistId: 'artist-orfano',
    });
    const artistaAttivo = makeArtist({ id: 'artist-attivo', name: 'Attivo' });
    const trackAttiva = makeTrack({
      id: 'track-attiva',
      canonicalKey: 'fuzzy:ck-attiva',
      artistId: 'artist-attivo',
    });
    await putArtists(db, [artistaOrfano, artistaAttivo]);
    await putTracks(db, [trackOrfana, trackAttiva]);

    // Un listen sulla track attiva.
    await putListens(db, [makeListen({ trackId: 'track-attiva', eventKey: 'spotify:ek-o1' })]);

    const report = await orphanCleanup(db);

    expect(report.tracksRemoved).toBe(1);
    expect(report.artistsRemoved).toBe(1);
    expect(await db.tracks.get('fuzzy:ck-orfana')).toBeUndefined();
    expect(await db.artists.get('artist-orfano')).toBeUndefined();
    expect(await db.tracks.get('fuzzy:ck-attiva')).toBeDefined();
    expect(await db.artists.get('artist-attivo')).toBeDefined();
  });

  it('non rimuove entità referenziate solo da library', async () => {
    const db = freshDb('ls-orphan-library-only');
    const artista = makeArtist({ id: 'artist-lib', name: 'Lib' });
    const track = makeTrack({
      id: 'track-lib',
      canonicalKey: 'fuzzy:ck-lib',
      artistId: 'artist-lib',
    });
    await putArtists(db, [artista]);
    await putTracks(db, [track]);
    // Referenziato da library ma senza listen.
    await db.library.put({
      id: 'lib-1',
      platform: 'spotify',
      kind: 'saved_track',
      trackId: 'track-lib',
      albumId: null,
      artistId: 'artist-lib',
      addedAt: Date.now(),
    });

    const report = await orphanCleanup(db);

    expect(report.tracksRemoved).toBe(0);
    expect(report.artistsRemoved).toBe(0);
    expect(await db.tracks.get('fuzzy:ck-lib')).toBeDefined();
    expect(await db.artists.get('artist-lib')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// T0.7.4 — fastCheck + quotaCheck (05§12.1)
// ---------------------------------------------------------------------------

describe('runHealthCheck / fastCheck', () => {
  it('restituisce ok quando schema versione corretta e DB apribile', async () => {
    const db = freshDb('ls-health-ok');
    await db.open();
    registerDb(db);

    const health = await runHealthCheck(db, 3);

    expect(health.status).toBe('ok');
    expect(health.fastCheck?.ok).toBe(true);
    expect(health.fastCheck?.schemaVersion).toBe(3);
    expect(health.fastCheck?.error).toBeNull();
  });

  it("restituisce critical quando schema versione sotto l'attesa", async () => {
    // Usiamo direttamente freshDb che apre a v3; per forzare critical
    // passiamo expectedSchemaVersion = 99 (non raggiunto).
    const db = freshDb('ls-health-critical');
    await db.open();
    registerDb(db);

    const health = await runHealthCheck(db, 99);

    expect(health.status).toBe('critical');
    expect(health.fastCheck?.ok).toBe(false);
    expect(health.fastCheck?.error).toContain('serve migrazione');
  });

  it('quotaCheck restituisce fillRatio e warning quando disponibile', async () => {
    const quota = await import('../index').then((m) => m.quotaCheck());
    // In ambiente jsdom navigator.storage.estimate potrebbe non essere definito:
    // accettiamo sia ok con quota null che con valori.
    expect(quota).toHaveProperty('ok');
    expect(quota).toHaveProperty('fillRatio');
    expect(quota).toHaveProperty('warning');
  });
});

// ---------------------------------------------------------------------------
// T0.7.3 — integrazione rekey + recount (migrazione v1→v2 simulata senza perdita dati)
// ---------------------------------------------------------------------------

describe('integrazione rekey + recount (AC: migrazione senza perdita dati)', () => {
  it('mantenere listenCount corretti dopo promozione fuzzy->isrc', async () => {
    const db = freshDb('ls-rekey-recount-integ');
    const vincitrice = makeTrack({
      canonicalKey: 'isrc:ITG040000005',
      isrc: 'ITG040000005',
      id: 'track-v',
      listenCount: 0,
    });
    const daUnire = makeTrack({
      canonicalKey: 'fuzzy:ck-5',
      isrc: 'ITG040000005',
      id: 'track-d',
      listenCount: 0,
    });
    const artista = makeArtist({ id: 'artist-a', listenCount: 0 });
    vincitrice.artistId = 'artist-a';
    daUnire.artistId = 'artist-a';
    await putArtists(db, [artista]);
    await putTracks(db, [vincitrice, daUnire]);

    const l1 = makeListen({ trackId: 'track-d', eventKey: 'spotify:ek-r1' });
    const l2 = makeListen({ trackId: 'track-d', eventKey: 'spotify:ek-r2' });
    await putListens(db, [l1, l2]);

    await rekey(db);
    await recount(db);

    const v = await db.tracks.get('isrc:ITG040000005');
    expect(v?.listenCount).toBe(2);
    const a = await db.artists.get('artist-a');
    expect(a?.listenCount).toBe(2);
  });
});
