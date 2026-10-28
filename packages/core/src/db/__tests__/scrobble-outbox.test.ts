import { afterEach, describe, expect, it } from 'vitest';
import { closeAllDbs, freshDb } from './helpers';
import { LifeSoundtrackDB } from '../db';
import {
  claimScrobbles,
  computeRetryDelayMs,
  countScrobbleQueue,
  enqueueScrobble,
  listScrobbleQueue,
  listStuckScrobbles,
  markScrobbleFailed,
  markScrobbleSent,
  purgeScrobbleQueue,
  releaseStuckScrobbles,
  SCROBBLE_MAX_ATTEMPTS,
  SCROBBLE_RETRY_BASE_MS,
  SCROBBLE_RETRY_CAP_MS,
} from '../scrobbleOutbox';
import { runScrobbleCycle } from '../../adapters/scrobble/sender';
import { ScrobbleError } from '../../adapters/scrobble/types';
import type { ScrobblePayload, ScrobbleSink } from '../../adapters/scrobble/types';

/**
 * Test della coda di invio — `20-SCROBBLING-HUB.md` v1.0 §14.3, casi 9, 10,
 * 11-17, 19, 20, 27.
 */

afterEach(closeAllDbs);

const NOW = 1710523800000;

const payload = (eventKey: string): ScrobblePayload => ({
  idempotencyKey: `lastfm|${eventKey}`,
  startedAt: NOW - 600_000,
  durationMs: 200_000,
  artistName: 'Artista',
  trackName: 'Brano',
});

/** Sink finto che registra le richieste e può fallire. */
function fakeSink(
  behaviour: { accepted?: number; error?: ScrobbleError } = {},
): ScrobbleSink & { batches: ScrobblePayload[][] } {
  const batches: ScrobblePayload[][] = [];
  return {
    hub: 'lastfm',
    name: 'Fake',
    version: '1.0.0',
    batches,
    isConfigured: () => true,
    submit: async (listens: ScrobblePayload[]) => {
      batches.push(listens);
      if (behaviour.error) {
        throw behaviour.error;
      }
      const accepted = behaviour.accepted ?? listens.length;
      return { accepted, rejected: listens.length - accepted };
    },
  };
}

describe('coda `scrobbleOutbox` — idempotenza (casi 9, 10, G-SH.1)', () => {
  it('la doppia enqueue della stessa chiave è ignorata, non è un errore', async () => {
    const db = freshDb('ls-outbox-double-enqueue');
    const first = await enqueueScrobble(
      db,
      { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') },
      NOW,
    );
    const second = await enqueueScrobble(
      db,
      { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') },
      NOW,
    );
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await db.scrobbleOutbox.count()).toBe(1);
  });

  it('gli stessi eventi per hub diversi sono righe diverse', async () => {
    const db = freshDb('ls-outbox-two-hubs');
    await enqueueScrobble(db, { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') }, NOW);
    await enqueueScrobble(
      db,
      { hub: 'listenbrainz', eventKey: 'ek-1', payload: payload('ek-1') },
      NOW,
    );
    expect(await db.scrobbleOutbox.count()).toBe(2);
  });

  it('il ciclo girato due volte invia una sola volta (caso 9)', async () => {
    const db = freshDb('ls-outbox-cycle-twice');
    await enqueueScrobble(db, { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') }, NOW);
    const sink = fakeSink();

    await runScrobbleCycle(db, sink, { now: NOW });
    await runScrobbleCycle(db, sink, { now: NOW + 1000 });

    expect(sink.batches).toHaveLength(1);
    expect(sink.batches[0]).toHaveLength(1);
    const counts = await countScrobbleQueue(db, 'lastfm');
    expect(counts.sent).toBe(1);
    expect(counts.pending).toBe(0);
  });
});

describe('coda `scrobbleOutbox` — crash simulato (caso 19, E.SH.6)', () => {
  it('la riga resta `in_flight` e non viene ritentata al riavvio', async () => {
    const db = freshDb('ls-outbox-crash');
    await enqueueScrobble(db, { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') }, NOW);

    // Claim senza conferma: simula un crash fra la richiesta e la conferma.
    const claimed = await claimScrobbles(db, 'lastfm', 10, NOW);
    expect(claimed).toHaveLength(1);
    expect(await listStuckScrobbles(db, 'lastfm')).toHaveLength(1);

    // Al riavvio il ciclo **non** claima nulla: la riga è ancora in volo.
    const sink = fakeSink();
    const summary = await runScrobbleCycle(db, sink, { now: NOW + 60_000 });
    expect(summary.claimed).toBe(0);
    expect(sink.batches).toHaveLength(0);
  });

  it('il rilascio esplicito rimette la riga in `pending`', async () => {
    const db = freshDb('ls-outbox-release');
    await enqueueScrobble(db, { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') }, NOW);
    await claimScrobbles(db, 'lastfm', 10, NOW);
    const released = await releaseStuckScrobbles(db, 'lastfm', NOW + 60_000);
    expect(released).toBe(1);
    expect(await listStuckScrobbles(db, 'lastfm')).toHaveLength(0);
  });
});

describe('coda `scrobbleOutbox` — revoca del consenso (caso 20, E.SH.9, P-SH.4)', () => {
  it('le righe passano a `dropped` e non partono più richieste', async () => {
    const db = freshDb('ls-outbox-revoke');
    await enqueueScrobble(db, { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') }, NOW);
    const dropped = await purgeScrobbleQueue(db, 'lastfm');
    expect(dropped).toBe(1);
    const counts = await countScrobbleQueue(db, 'lastfm');
    expect(counts.dropped).toBe(1);
    expect(counts.pending).toBe(0);

    const sink = fakeSink();
    const summary = await runScrobbleCycle(db, sink, { now: NOW + 1000 });
    expect(summary.claimed).toBe(0);
    expect(sink.batches).toHaveLength(0);
  });
});

describe('coda `scrobbleOutbox` — retry (casi 11-17, R-SH.1…R-SH.5)', () => {
  it('un errore recuperabile rimette la riga in `pending` con backoff', async () => {
    const db = freshDb('ls-outbox-retry');
    await enqueueScrobble(db, { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') }, NOW);
    const sink = fakeSink({
      error: new ScrobbleError('RATE_LIMITED', 'troppo veloce', {
        recoverable: true,
        hub: 'lastfm',
      }),
    });

    const summary = await runScrobbleCycle(db, sink, { now: NOW });
    expect(summary.retrying).toBe(1);
    const row = await db.scrobbleOutbox.get('lastfm|ek-1');
    expect(row?.status).toBe('pending');
    expect(row?.attempts).toBe(1);
    expect(row?.nextAttemptAt).toBeGreaterThan(NOW);
    expect(row?.lastError?.code).toBe('RATE_LIMITED');
  });

  it('un errore terminale porta subito a `failed` (R-SH.3)', async () => {
    const db = freshDb('ls-outbox-terminal');
    await enqueueScrobble(db, { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') }, NOW);
    const sink = fakeSink({
      error: new ScrobbleError('AUTH_INVALID', 'token scaduto', {
        recoverable: false,
        hub: 'lastfm',
      }),
    });

    const summary = await runScrobbleCycle(db, sink, { now: NOW });
    expect(summary.failed).toBe(1);
    const row = await db.scrobbleOutbox.get('lastfm|ek-1');
    expect(row?.status).toBe('failed');
    expect(row?.lastError?.code).toBe('AUTH_INVALID');
  });

  it('dopo 5 tentativi la riga va in `failed` (R-SH.2)', async () => {
    const db = freshDb('ls-outbox-max-attempts');
    await enqueueScrobble(db, { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') }, NOW);
    const sink = fakeSink({
      error: new ScrobbleError('HUB_ERROR', 'server giù', { recoverable: true, hub: 'lastfm' }),
    });

    for (let attempt = 0; attempt < SCROBBLE_MAX_ATTEMPTS; attempt += 1) {
      await runScrobbleCycle(db, sink, { now: NOW + attempt * 3_600_000 });
    }
    const row = await db.scrobbleOutbox.get('lastfm|ek-1');
    expect(row?.attempts).toBe(SCROBBLE_MAX_ATTEMPTS);
    expect(row?.status).toBe('failed');
  });

  it('il delay ha base 30 s, tetto 1 h e jitter (R-SH.1)', () => {
    expect(computeRetryDelayMs(1, () => 0)).toBe(Math.round(SCROBBLE_RETRY_BASE_MS * 0.5));
    expect(computeRetryDelayMs(1, () => 1)).toBe(Math.round(SCROBBLE_RETRY_BASE_MS * 1.5));
    expect(computeRetryDelayMs(10, () => 0)).toBe(Math.round(SCROBBLE_RETRY_CAP_MS * 0.5));
    expect(computeRetryDelayMs(1, () => 0)).toBeLessThan(computeRetryDelayMs(2, () => 0));
  });

  it('il delay del protocollo (X-RateLimit-Reset-In) viene rispettato (caso 11, R-SH.4)', async () => {
    const db = freshDb('ls-outbox-retry-after');
    await enqueueScrobble(
      db,
      { hub: 'listenbrainz', eventKey: 'ek-1', payload: payload('ek-1') },
      NOW,
    );
    await markScrobbleFailed(
      db,
      'listenbrainz|ek-1',
      { code: 'RATE_LIMITED', message: '429', recoverable: true },
      { now: NOW, retryAfterMs: 7000 },
    );
    const row = await db.scrobbleOutbox.get('listenbrainz|ek-1');
    expect(row?.nextAttemptAt).toBe(NOW + 7000);
  });

  it('un invio confermato segna la riga `sent`', async () => {
    const db = freshDb('ls-outbox-sent');
    await enqueueScrobble(db, { hub: 'lastfm', eventKey: 'ek-1', payload: payload('ek-1') }, NOW);
    await claimScrobbles(db, 'lastfm', 10, NOW);
    await markScrobbleSent(db, 'lastfm|ek-1', NOW);
    const row = await db.scrobbleOutbox.get('lastfm|ek-1');
    expect(row?.status).toBe('sent');
    expect(row?.sentAt).toBe(NOW);
  });
});

describe('schema Dexie v5 (caso 27)', () => {
  it('la tabella `scrobbleOutbox` esiste con PK univoca su `idempotencyKey`', async () => {
    const db = freshDb('ls-outbox-schema-v5');
    expect(db.tables.some((table) => table.name === 'scrobbleOutbox')).toBe(true);
    const rows = await listScrobbleQueue(db);
    expect(rows).toEqual([]);
  });

  it('la migrazione da v4 a v5 non distrugge i dati esistenti', async () => {
    const name = 'ls-outbox-migration';
    // Un DB creato a v4 (schema precedente) con un ascolto.
    const v4 = new LifeSoundtrackDB(name);
    v4.version(4).stores({
      listens: '&eventKey, timestamp, startedAt, trackId, platform, day, importId',
      tracks: '&canonicalKey, name, artistId, albumId, isrc, mbid',
      artists: '&id, name, mbid',
      albums: '&id, name, artistId',
      features: '&trackId, source',
      sessions: '&id, startTime, platform, derivedVersion',
      insights: '&id, type, periodStart, derivedVersion, status',
      imports: '&id, platform, fileHash, startedAt',
      library: '&id, trackId, artistId, albumId, platform',
      playlists: '&id, platform',
      playlistItems: '&[playlistId+trackId], playlistId, addedAt',
      searchQueries: '&id, platform, timestamp, [platform+normalized]',
      settings: '&key',
    });
    await v4.open();
    await v4.listens.put({
      id: 'le-1',
      eventKey: 'spotify:ek-1',
      platform: 'spotify',
      importId: 'imp-1',
      timestamp: NOW,
      startedAt: NOW - 1000,
      durationMs: 1000,
      trackId: 'track-1',
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
      day: '2024-03-15',
    });
    await v4.close();

    // Riapertura con lo schema corrente (v5): il dato c'è ancora e la coda è
    // stata creata.
    const v5 = new LifeSoundtrackDB(name);
    await v5.open();
    expect(v5.verno).toBe(5);
    expect(await v5.listens.count()).toBe(1);
    expect(v5.tables.some((table) => table.name === 'scrobbleOutbox')).toBe(true);
    await v5.delete();
  });
});
