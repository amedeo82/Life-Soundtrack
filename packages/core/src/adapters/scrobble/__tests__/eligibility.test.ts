import { afterEach, describe, expect, it } from 'vitest';
import {
  closeAllDbs,
  freshDb,
  makeArtist,
  makeListen,
  makeTrack,
} from '../../../db/__tests__/helpers';
import { putArtists, putListens, putTracks } from '../../../db/repositories';
import { enqueueEligibleListens, isMature } from '../eligibility';
import type { ScrobbleCandidate } from '../eligibility';

/**
 * Test del filtro di eleggibilità — `20-SCROBBLING-HUB.md` v1.0 §14.3, casi
 * 3, 5, 6, 7, 8, 8b, 30.
 */

afterEach(closeAllDbs);

const NOW = 1710523800000;
const MINUTE = 60_000;

/** Candidato minimale per i test unitari della regola di maturità. */
const candidate = (overrides: Partial<ScrobbleCandidate> = {}): ScrobbleCandidate => ({
  eventKey: 'spotify:ek-1',
  platform: 'spotify',
  startedAt: NOW - 10 * MINUTE,
  durationMs: 200_000,
  catalogDurationMs: 200_000,
  skipped: false,
  ...overrides,
});

describe('regola di maturità (casi 5, 6, 8b — T-SH.3, D-SH.13)', () => {
  it('un ascolto sotto la soglia non è maturo', () => {
    // 10 s di durata: sotto i 30 s minimi.
    expect(isMature(candidate({ durationMs: 10_000, catalogDurationMs: 10_000 }), NOW)).toBe(false);
    // Durata sufficiente ma tempo trascorso insufficiente (metà durata = 100 s).
    expect(
      isMature(
        candidate({ startedAt: NOW - 10 * 1000, durationMs: 200_000, catalogDurationMs: 200_000 }),
        NOW,
      ),
    ).toBe(false);
  });

  it('un ascolto sopra la soglia è maturo', () => {
    expect(isMature(candidate(), NOW)).toBe(true);
  });

  it('durata ignota, evento locale: escluso sotto i 4 minuti, incluso sopra (caso 6)', () => {
    expect(
      isMature(
        candidate({ startedAt: NOW - 3 * MINUTE, durationMs: 0, catalogDurationMs: null }),
        NOW,
      ),
    ).toBe(false);
    expect(
      isMature(
        candidate({ startedAt: NOW - 5 * MINUTE, durationMs: 0, catalogDurationMs: null }),
        NOW,
      ),
    ).toBe(true);
  });

  it("durata ignota, evento importato da un hub: maturo all'atto (caso 8b)", () => {
    expect(
      isMature(
        candidate({
          platform: 'listenbrainz',
          startedAt: NOW - 60 * 1000,
          durationMs: 0,
          catalogDurationMs: null,
        }),
        NOW,
      ),
    ).toBe(true);
  });

  it('la durata di catalogo è la miglior stima quando quella ascoltata è 0', () => {
    // Catalogo di 200 s: servono 100 s ascoltati → con 10 s trascorsi non maturo.
    expect(
      isMature(
        candidate({ startedAt: NOW - 10 * 1000, durationMs: 0, catalogDurationMs: 200_000 }),
        NOW,
      ),
    ).toBe(false);
    // Catalogo di 60 s: servono 30 s → con 60 s trascorsi è maturo.
    expect(
      isMature(
        candidate({ startedAt: NOW - 60 * 1000, durationMs: 0, catalogDurationMs: 60_000 }),
        NOW,
      ),
    ).toBe(true);
  });
});

/** Prepara un DB con un ascolto, un brano e un artista. */
async function seedListen(
  db: ReturnType<typeof freshDb>,
  overrides: {
    platform?: 'spotify' | 'lastfm' | 'listenbrainz';
    skipped?: boolean;
    startedAt?: number;
    durationMs?: number;
  } = {},
): Promise<void> {
  const artist = makeArtist({ id: 'artist-scrobble', name: 'Artista' });
  const track = makeTrack({
    id: 'track-scrobble',
    artistId: artist.id,
    name: 'Brano',
    durationMs: 200_000,
    mbid: 'mbid-scrobble',
  });
  await putArtists(db, [artist]);
  await putTracks(db, [track]);
  await putListens(db, [
    makeListen({
      id: 'le-scrobble',
      eventKey: 'spotify:ek-scrobble',
      platform: overrides.platform ?? 'spotify',
      trackId: track.id,
      startedAt: overrides.startedAt ?? NOW - 10 * MINUTE,
      timestamp: overrides.startedAt ?? NOW - 10 * MINUTE,
      durationMs: overrides.durationMs ?? 200_000,
      skipped: overrides.skipped ?? false,
    }),
  ]);
}

describe('filtro di eleggibilità (§5)', () => {
  it('toggle vuoto → zero righe in coda (caso 3, AC-SH.1)', async () => {
    const db = freshDb('ls-scrobble-toggle-empty');
    await seedListen(db);
    const inserted = await enqueueEligibleListens(db, {
      hub: 'lastfm',
      enabledHubs: [],
      now: NOW,
    });
    expect(inserted).toBe(0);
    expect(await db.scrobbleOutbox.count()).toBe(0);
  });

  it("toggle attivo → l'ascolto maturo entra in coda", async () => {
    const db = freshDb('ls-scrobble-toggle-on');
    await seedListen(db);
    const inserted = await enqueueEligibleListens(db, {
      hub: 'lastfm',
      enabledHubs: ['lastfm'],
      now: NOW,
    });
    expect(inserted).toBe(1);
    const row = await db.scrobbleOutbox.get('lastfm|spotify:ek-scrobble');
    expect(row?.status).toBe('pending');
    expect(row?.payload.artistName).toBe('Artista');
    expect(row?.payload.trackName).toBe('Brano');
  });

  it('ascolto non maturo → non entra in coda (caso 5)', async () => {
    const db = freshDb('ls-scrobble-not-mature');
    await seedListen(db, { startedAt: NOW - 5 * 1000 });
    const inserted = await enqueueEligibleListens(db, {
      hub: 'lastfm',
      enabledHubs: ['lastfm'],
      now: NOW,
    });
    expect(inserted).toBe(0);
  });

  it('ascolto skippato → escluso (caso 7)', async () => {
    const db = freshDb('ls-scrobble-skipped');
    await seedListen(db, { skipped: true });
    const inserted = await enqueueEligibleListens(db, {
      hub: 'lastfm',
      enabledHubs: ['lastfm'],
      now: NOW,
    });
    expect(inserted).toBe(0);
  });

  it('evento di piattaforma hub → escluso, anti-loop (caso 8, E.SH.12)', async () => {
    const db = freshDb('ls-scrobble-antiloop');
    await seedListen(db, { platform: 'lastfm' });
    const inserted = await enqueueEligibleListens(db, {
      hub: 'lastfm',
      enabledHubs: ['lastfm'],
      now: NOW,
    });
    expect(inserted).toBe(0);
    expect(await db.scrobbleOutbox.count()).toBe(0);
  });

  it('finestra di 7 giorni: più vecchio escluso, tutto lo storico incluso (caso 30, D-SH.12)', async () => {
    const db = freshDb('ls-scrobble-window');
    await seedListen(db, { startedAt: NOW - 8 * 24 * 60 * MINUTE });
    const inserted = await enqueueEligibleListens(db, {
      hub: 'lastfm',
      enabledHubs: ['lastfm'],
      now: NOW,
    });
    expect(inserted).toBe(0);

    const db2 = freshDb('ls-scrobble-window-all');
    await seedListen(db2, { startedAt: NOW - 8 * 24 * 60 * MINUTE });
    const insertedAll = await enqueueEligibleListens(db2, {
      hub: 'lastfm',
      enabledHubs: ['lastfm'],
      now: NOW,
      windowMs: 0,
    });
    expect(insertedAll).toBe(1);
  });

  it('il payload non contiene né IP né contesto (caso 28, V8)', async () => {
    const db = freshDb('ls-scrobble-privacy');
    await seedListen(db);
    await enqueueEligibleListens(db, { hub: 'lastfm', enabledHubs: ['lastfm'], now: NOW });
    const row = await db.scrobbleOutbox.get('lastfm|spotify:ek-scrobble');
    const serialized = JSON.stringify(row?.payload);
    expect(serialized).not.toContain('ip');
    expect(serialized).not.toContain('country');
    expect(serialized).not.toContain('device');
    expect(Object.keys(row?.payload ?? {}).sort()).toEqual([
      'artistName',
      'durationMs',
      'idempotencyKey',
      'recordingMbid',
      'startedAt',
      'trackName',
    ]);
  });
});
