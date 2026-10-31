import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifeSoundtrackDB } from '../../../db';
import { recount } from '../../../db';
import { runImport } from '../../importSession';
import { AdapterError } from '../../errors';
import type { PrivacySettings } from '../../../schema';
import { SpotifyAdapter } from '../adapter';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../../../../../fixtures/synthetic-history/spotify-sample.json', import.meta.url),
);

const PRIVACY_DEFAULTS: PrivacySettings = {
  retainIp: false,
  retainCountry: true,
  retainCity: false,
  retainDeviceType: true,
  retainDeviceDetail: false,
  deriveContext: true,
  enrichMetadata: false,
  carDetectionConsent: false,
  scrobbleHubs: [],
  syncCloud: false,
};

const fixtureBytes = (): Uint8Array => new Uint8Array(readFileSync(FIXTURE_PATH));

/**
 * Import end-to-end del fixture `spotify-sample.json` v1.1 (Sessione 13):
 * 11 eventi nel file (10 musicali + 1 podcast), 9 Track unici dopo il merge
 * DEDUP-3 (#5+#6), 3 artisti, 2 skip derivati E1, 1 offline convertito E3,
 * 1 incognito. Vedi `_expectedOutput` nel fixture (totali corretti: la
 * derivazione interna "10 music events - 1 merge = 9 unique" è il canone).
 */
describe('SpotifyAdapter — import fixture (§8: casi 1-10)', () => {
  let db: LifeSoundtrackDB;

  beforeEach(() => {
    db = new LifeSoundtrackDB(`spotify-adapter-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('casi 1,3,4,5,6,7: import pulito con tutti i valori attesi', async () => {
    const summary = await runImport(
      db,
      new SpotifyAdapter(),
      new Blob([fixtureBytes() as unknown as ArrayBuffer]),
      {
        privacy: PRIVACY_DEFAULTS,
        fileName: 'spotify-sample.json',
      },
    );

    // Cosa è stato parsato e scritto
    expect(summary.status).toBe('done');
    expect(summary.eventsParsed).toBe(10);
    expect(summary.eventsInserted).toBe(10);
    expect(summary.eventsDuplicated).toBe(0);
    expect(summary.fileHash).toMatch(/^[0-9a-f]{64}$/);
    expect(summary.completedAt).not.toBeNull();

    // _expectedOutput (v1.1, derivazione interna come canone)
    expect(await db.listens.count()).toBe(10);
    expect(await db.tracks.count()).toBe(9);
    expect(await db.artists.count()).toBe(3);
    // 10 album: il DEDUP-3 fonda le track #5+#6 ma conserva entrambi gli
    // album sorgenti (Greatest Hits + Greatest Hits Remaster).
    // 9 album: uno per Track. DEDUP-3 su #4+#5 fonde i due ListenEvent sullo
    // stesso Track (issue #75), ma l'`albumId` di quel Track resta quello del
    // primo evento (`Greatest Hits`): il secondo album (`Greatest Hits Remaster`)
    // non viene creato perché il guard `!track.albumId` salta la risoluzione.
    // Senza il fix della race, si sarebbero creati 10 album (uno per ciascuno
    // dei due eventi DEDUP-3) — coerente con la corsa precedente.
    expect(await db.albums.count()).toBe(9);

    // E6 (caso 7): 1 episodio podcast escluso
    expect(summary.warningCounts['adapter.spotify.warn.podcastSkipped']).toBe(1);
    // E3 (caso 4): 1 timestamp offline convertito
    expect(summary.warningCounts['adapter.spotify.warn.offlineConverted']).toBe(1);
    // E2: sovrapposizioni rilevate (4 a causa di tracce non fuse da DEDUP-3)
    expect(summary.warningCounts['adapter.spotify.warn.overlaps']).toBe(4);

    // E1 (caso 3): 2 skip derivati (fwdbtn + endplay corto)
    const skipped = await db.listens.filter((l) => l.skipped).toArray();
    expect(skipped).toHaveLength(2);
    expect(new Set(skipped.map((l) => l.reasonEnd))).toEqual(new Set(['fwdbtn', 'endplay']));

    // completed derivato da trackdone
    const completed = await db.listens.filter((l) => l.completed).toArray();
    expect(completed.every((l) => l.reasonEnd === 'trackdone')).toBe(true);

    // E5 (caso 6): deviceType mappati
    const deviceTypes = new Map(
      (await db.listens.toArray()).map((l) => [l.eventKey, l.deviceType]),
    );
    expect(new Set(deviceTypes.values())).toEqual(new Set(['mobile', 'desktop', 'web']));

    // incognito (fixture: 1 evento)
    expect(await db.listens.filter((l) => l.incognito === true).count()).toBe(1);

    // E4/DEDUP-3 (caso 5): #5+#6 fusi ⇒ track "Bohemian Rhapsody" bucket 354000
    // con 2 ascolti (entrambi i ListenEvent persistono, deduplica il Track);
    // le altre due varianti restano tracce distinte.
    const bohemia = await db.tracks.filter((t) => t.name === 'Bohemian Rhapsody').toArray();
    expect(bohemia).toHaveLength(3);
    const merged = bohemia.find((t) => t.durationMs === 354_000);
    expect(merged).toBeDefined();
    // I due ListenEvent della coppia DEDUP-3 puntano **allo stesso** Track.id:
    // la corsa tra `Promise.all` di `normalizeEvent` (issue #75) avrebbe potuto
    // creare due Track distinti se la pipeline non deduplichi l'inflight.
    expect(await db.listens.where('trackId').equals(merged!.id).count()).toBe(2);

    // startedAt = ts - ms_played (§5)
    const first = await db.listens.get('spotify:4u7EnebtmKWzUH433cf5Qv@1710534600000');
    expect(first).toBeDefined();
    expect(first!.startedAt).toBe(first!.timestamp - first!.durationMs);
    expect(first!.day).toBe('2024-03-15');
    expect(first!.country).toBe('IT');
    expect(first!.ip).toBeNull();
    // `deviceDetail` è la stringa grezza del provider: dato identificante,
    // quindi **opt-in** (`retainDeviceDetail`, default false — 19-GEO-CONTEXT
    // §7.1). Il valore persistito con il default è `null`.
    expect(first!.deviceDetail).toBeNull();
    expect(first!.deviceType).toBe('mobile');

    // Contatori denormalizzati ricalcolati (recount): `merged` ha 2 ListenEvent
    // che lo puntano (entrambi gli eventi DEDUP-3), dunque `listenCount` deve
    // essere 2 dopo `recount()` (che somma per `trackId`, non per `canonicalKey`).
    expect(merged!.listenCount).toBe(2);
  });

  it('caso 2: re-import dello stesso file è idempotente (eventKey unico)', async () => {
    const adapter = new SpotifyAdapter();
    const input = new Blob([fixtureBytes() as unknown as ArrayBuffer]);
    const first = await runImport(db, adapter, input, { privacy: PRIVACY_DEFAULTS });
    const second = await runImport(db, adapter, input, { privacy: PRIVACY_DEFAULTS });

    expect(first.eventsInserted).toBe(10);
    expect(second.eventsInserted).toBe(0);
    expect(second.eventsDuplicated).toBe(10);
    expect(second.status).toBe('done');
    expect(await db.listens.count()).toBe(10);
    expect(await db.tracks.count()).toBe(9);
    expect(await db.artists.count()).toBe(3);
  });

  it('casi 9-10: retainIp true conserva gli IP; false li scarta ma tiene country', async () => {
    const adapter = new SpotifyAdapter();
    const input = new Blob([fixtureBytes() as unknown as ArrayBuffer]);

    const noIp = await runImport(db, adapter, input, { privacy: PRIVACY_DEFAULTS });
    expect(noIp.status).toBe('done');
    for (const listen of await db.listens.toArray()) {
      expect(listen.ip).toBeNull();
      expect(listen.country).not.toBeNull();
    }

    const dbKeep = new LifeSoundtrackDB(`spotify-adapter-keepip-${crypto.randomUUID()}`);
    try {
      const keepIp = await runImport(dbKeep, adapter, input, {
        privacy: { ...PRIVACY_DEFAULTS, retainIp: true },
      });
      expect(keepIp.eventsInserted).toBe(10);
      const kept = await dbKeep.listens.toArray();
      expect(kept.every((l) => l.ip !== null)).toBe(true);
      expect(new Set(kept.map((l) => l.ip))).toEqual(
        new Set(['92.40.100.50', '85.20.40.10', '78.195.10.20']),
      );
    } finally {
      await dbKeep.delete();
    }
  });

  it('AC: ZIP con streaming history + CarDetectionEvent.json importa e rifiuta i dati auto', async () => {
    const zip = zipSync({
      'Streaming_History_Audio_2024_0.json': fixtureBytes(),
      'CarDetectionEvent.json': new TextEncoder().encode(
        '[{"ts":"2024-01-01T00:00:00Z","car":true}]',
      ),
    });
    const summary = await runImport(db, new SpotifyAdapter(), new Blob([zip]), {
      privacy: { ...PRIVACY_DEFAULTS, carDetectionConsent: true },
      fileName: 'export.zip',
    });

    expect(summary.status).toBe('done');
    expect(summary.eventsInserted).toBe(10);
    expect(summary.warningCounts['CAR_DETECTION_SKIPPED']).toBe(1);
    // Nessuna tabella riceve dati auto: nel DB esistono solo listens/tracks/…
    expect(await db.listens.count()).toBe(10);
    expect(await db.listens.filter((l) => l.deviceType === 'car').count()).toBe(0);
  });

  it('AC: file CarDetectionEvent.json da solo non è un export Spotify', async () => {
    const zip = zipSync({ 'CarDetectionEvent.json': new TextEncoder().encode('[]') });
    await expect(
      runImport(db, new SpotifyAdapter(), new Blob([zip]), { privacy: PRIVACY_DEFAULTS }),
    ).rejects.toThrow(AdapterError);
    expect(await db.listens.count()).toBe(0);
    const record = (await db.imports.toArray())[0]!;
    expect(record!.status).toBe('failed');
  });

  it('TRUNCATED: file troncato a metà ⇒ partial con eventi già scritti (05§4)', async () => {
    const full = new TextDecoder().decode(fixtureBytes());
    const cut = new Blob([full.slice(0, Math.floor(full.length * 0.7))]);
    let failure: unknown;
    try {
      await runImport(db, new SpotifyAdapter(), cut, { privacy: PRIVACY_DEFAULTS });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AdapterError);
    expect((failure as AdapterError).code).toBe('TRUNCATED');
    expect((failure as AdapterError).recoverable).toBe(true);

    const record = (await db.imports.toArray())[0]!;
    expect(record!.status).toBe('partial');
    expect(record!.eventsInserted).toBeGreaterThan(0);
    expect(await db.listens.count()).toBe(record!.eventsInserted);
  });

  it('cancellazione cooperativa: AbortSignal ⇒ status partial senza errori (05§4)', async () => {
    const controller = new AbortController();
    const adapter = new SpotifyAdapter();
    const input = new Blob([fixtureBytes() as unknown as ArrayBuffer]);
    const summary = await runImport(db, adapter, input, {
      privacy: PRIVACY_DEFAULTS,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    expect(summary.status).toBe('partial');
    // L'abort è triggerato da `onProgress` dopo il primo evento (chunk size
    // 1000 > 10 eventi → nessun flush intermedio): solo il primo evento è nel
    // buffer quando l'AbortError scatta.
    expect(summary.eventsInserted).toBe(1);
  });

  it('import multipli concordanti non duplicano né spezzano (E2 via eventKey)', async () => {
    const adapter = new SpotifyAdapter();
    const bytes = new TextEncoder().encode(
      JSON.stringify([
        {
          ts: '2024-05-01T10:00:00Z',
          platform: 'android',
          ms_played: 100_000,
          master_metadata_track_name: 'Song A',
          master_metadata_album_artist_name: 'Artist X',
          spotify_track_uri: 'spotify:track:a1',
          reason_end: 'trackdone',
        },
        {
          ts: '2024-05-01T10:00:00Z',
          platform: 'android',
          ms_played: 100_000,
          master_metadata_track_name: 'Song A',
          master_metadata_album_artist_name: 'Artist X',
          spotify_track_uri: 'spotify:track:a1',
          reason_end: 'trackdone',
        },
      ]),
    );
    const summary = await runImport(db, adapter, new Blob([bytes]), { privacy: PRIVACY_DEFAULTS });
    expect(summary.eventsInserted).toBe(1);
    expect(summary.eventsDuplicated).toBe(1);
    expect(await db.listens.count()).toBe(1);
  });

  it("recount() dopo l'import resta coerente (02§7 MIG-4)", async () => {
    await runImport(
      db,
      new SpotifyAdapter(),
      new Blob([fixtureBytes() as unknown as ArrayBuffer]),
      { privacy: PRIVACY_DEFAULTS },
    );
    await recount(db);
    const tracks = await db.tracks.toArray();
    const totalListens = tracks.reduce((sum, t) => sum + t.listenCount, 0);
    // 10 ListenEvent, ognuno punta alla propria track (DEDUP-3 fonde #4+#5 in
    // un singolo Track con 2 listen): 10 = 1+1+1+1+2+1+1+1+1. `totalListens`
    // è la somma su `tracks.listenCount`, NON `db.listens.count()`.
    expect(totalListens).toBe(10);
    // Tutti gli ascolti sono stati persistiti (1 podcast escluso dall'adapter).
    expect(await db.listens.count()).toBe(10);
    // 8 eventi Queen (10 totale − 1 Q&DB − 1 Some Pop): dopo il recap della
    // pipeline (issue #75, race condition su Promise.all di normalizeEvent),
    // gli 8 eventi condividono **un solo** artista "Queen" nel DB e si
    // distribuiscono su 7 Track distinti (DEDUP-3 su Bohemian Rhapsody 354s).
    const queenRows = await db.artists.where('name').equals('Queen').toArray();
    expect(queenRows, 'un solo artista Queen deve sopravvivere al recap').toHaveLength(1);
    const queen = queenRows[0]!;
    const queenTracks = await db.tracks.where('artistId').equals(queen.id).toArray();
    expect(queenTracks).toHaveLength(7);
    // DEDUP-3 fonda davvero i due eventi Bohemian Rhapsody 354s: il track
    // fuso deve avere durationMs=354000 e 2 listen puntano ad esso.
    const mergedBohemia = queenTracks.find((t) => t.durationMs === 354_000);
    expect(mergedBohemia, 'Track fuso DEDUP-3 deve esistere').toBeDefined();
    expect(await db.listens.where('trackId').equals(mergedBohemia!.id).count()).toBe(2);
    // I 6 track Queen non fusi hanno 1 listen ciascuno.
    const unmerged = queenTracks.filter((t) => t.durationMs !== 354_000);
    for (const t of unmerged) {
      expect(await db.listens.where('trackId').equals(t.id).count()).toBe(1);
    }
    // Somma coerente: 8 (2 del fuso + 6 × 1 dei non fusi) = totale Queen.
    expect(queen.listenCount).toBe(8);
    // Verifica globale: somma tracks.reduce = totale listens e artist.lc
    // corrisponde alla somma per artistaId.
    const queenListens = await db.listens
      .where('trackId')
      .anyOf(queenTracks.map((t) => t.id))
      .count();
    expect(queen.listenCount).toBe(queenListens);
  });
});
