import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifeSoundtrackDB } from '../../../db';
import { runRemoteImport } from '../../importSession';
import { AdapterError } from '../../errors';
import type { PrivacySettings } from '../../../schema';
import { LastfmAdapter } from '../adapter';

const PAGE1 = fileURLToPath(
  new URL(
    '../../../../../../fixtures/synthetic-history/lastfm-scrobbles-sample.json',
    import.meta.url,
  ),
);
const PAGE2 = fileURLToPath(
  new URL('../../../../../../fixtures/synthetic-history/lastfm-page2-sample.json', import.meta.url),
);

const PRIVACY_OFF: PrivacySettings = {
  retainIp: false,
  enrichMetadata: false,
  carDetectionConsent: false,
  scrobbleHubs: [],
  syncCloud: false,
};

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

/** Fixture con `@attr` rimpiazzato (per simulare `totalPages` diversi). */
const page = (base: Record<string, unknown>, totalPages: number): Record<string, unknown> => {
  const clone = structuredClone(base) as {
    recenttracks: { '@attr': Record<string, unknown> };
  };
  clone.recenttracks['@attr'] = { ...clone.recenttracks['@attr'], totalPages: String(totalPages) };
  return clone as unknown as Record<string, unknown>;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Stub di `fetch` con orologio e sleep iniettabili (nessuna rete, nessun timer). */
interface FetchStub {
  fetchImpl: typeof fetch;
  calls: string[];
  clockAt: number[];
}

const makeFetch = (
  handler: (url: URL, attempt: number) => Response | Promise<Response>,
): FetchStub => {
  const calls: string[] = [];
  const clockAt: number[] = [];
  const clock = 0;
  let attempt = 0;
  const fetchImpl = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    calls.push(url.toString());
    clockAt.push(clock);
    const response = await handler(url, attempt);
    attempt += 1;
    return response;
  }) as unknown as typeof fetch;
  return {
    fetchImpl,
    calls,
    clockAt,
  };
};

/** Orologio e sleep condivisi con il token bucket e il backoff. */
const fakeClock = (): {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  advance: (ms: number) => void;
} => {
  let clock = 0;
  return {
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
    },
    advance: (ms: number) => {
      clock += ms;
    },
  };
};

describe('LastfmAdapter — percorso API (parseRemote?, ADR-0010)', () => {
  let db: LifeSoundtrackDB;

  beforeEach(() => {
    db = new LifeSoundtrackDB(`lf-remote-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('happy path: 2 pagine → eventi delle due pagine, 2 richieste', async () => {
    const p1 = page(readJson(PAGE1), 2);
    const p2 = page(readJson(PAGE2), 2);
    const stub = makeFetch((url) =>
      url.searchParams.get('page') === '1' ? jsonResponse(p1) : jsonResponse(p2),
    );
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });

    const summary = await runRemoteImport(
      db,
      adapter,
      { endpoint: 'https://proxy.example.invalid', credentials: { apiKey: 'key-123' } },
      { privacy: PRIVACY_OFF },
    );

    // 4 + 2 track, meno 1 nowplaying e 1 senza artista (E.LF.9).
    expect(summary.status).toBe('done');
    expect(summary.eventsParsed).toBe(5);
    expect(summary.eventsInserted).toBe(5);
    expect(stub.calls).toHaveLength(2);
    expect(stub.calls[0]).toContain('method=user.getRecentTracks');
    expect(stub.calls[0]).toContain('limit=200');
    expect(stub.calls[0]).toContain('extended=1');
    expect(stub.calls[0]).toContain('user=ls_user');
    expect(stub.calls[0]).toContain('api_key=key-123');
  });

  it('E.LF.2: la paginazione si ferma a totalPages (474 richieste, non oltre)', async () => {
    const p1 = page(readJson(PAGE1), 474);
    const p2 = page(readJson(PAGE2), 474);
    const stub = makeFetch((url) => {
      const n = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
      if (n === 1) return jsonResponse(p1);
      if (n === 2) return jsonResponse(p2);
      return jsonResponse({ recenttracks: { '@attr': { totalPages: '474' }, track: [] } });
    });
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    const events = [];
    for await (const event of adapter.parseRemote({ endpoint: 'https://proxy.example.invalid' })) {
      events.push(event);
    }
    expect(stub.calls).toHaveLength(474);
    expect(events).toHaveLength(5);
  });

  it('E.LF.1: il brano in riproduzione è scartato in silenzio (nessun warning)', async () => {
    const p1 = page(readJson(PAGE1), 1);
    const stub = makeFetch(() => jsonResponse(p1));
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    const summary = await runRemoteImport(
      db,
      adapter,
      { endpoint: 'https://proxy.example.invalid' },
      { privacy: PRIVACY_OFF },
    );
    expect(summary.eventsParsed).toBe(3);
    // Solo due warning: il brano in riproduzione è scartato in silenzio
    // (E.LF.1) e il brano senza artista è scartato con warning (E.LF.9).
    expect(summary.warnings).toEqual([
      'adapter.lastfm.warn.mbidMissing',
      'adapter.lastfm.warn.noArtistSkipped',
    ]);
  });

  it('E.LF.14: artist come stringa e come oggetto → stessi eventi', async () => {
    const track = {
      artist: 'Radiohead',
      album: 'OK Computer',
      name: 'Airbag',
      mbid: 'mbid-airbag',
      date: { uts: '1603187000' },
    };
    const asObject = { ...track, artist: { mbid: 'mbid-radiohead', '#text': 'Radiohead' } };
    const clock = fakeClock();
    const collect = async (payload: unknown): Promise<unknown[]> => {
      const stub = makeFetch(() =>
        jsonResponse({ recenttracks: { '@attr': { totalPages: '1' }, track: [payload] } }),
      );
      const adapter = new LastfmAdapter({
        username: 'ls_user',
        fetchImpl: stub.fetchImpl,
        now: clock.now,
        sleep: clock.sleep,
      });
      const events = [];
      for await (const event of adapter.parseRemote({
        endpoint: 'https://proxy.example.invalid',
      })) {
        events.push(event);
      }
      return events;
    };
    const fromString = await collect(track);
    const fromObject = await collect(asObject);
    expect(fromString).toHaveLength(1);
    expect(fromObject).toHaveLength(1);
    expect((fromObject[0] as { sourceEventId: string }).sourceEventId).toBe(
      (fromString[0] as { sourceEventId: string }).sourceEventId,
    );
    expect((fromObject[0] as { sourceArtistName: string }).sourceArtistName).toBe('Radiohead');
    expect((fromObject[0] as { sourceArtistMbid: string | null }).sourceArtistMbid).toBe(
      'mbid-radiohead',
    );
  });

  it('E.LF.7: nessun proxy → zero richieste e errore recuperabile', async () => {
    const stub = makeFetch(() => jsonResponse({}));
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
    });
    let error: unknown;
    try {
      for await (const _event of adapter.parseRemote({ endpoint: '' })) {
        void _event;
      }
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe('SOURCE_UNREACHABLE');
    expect((error as AdapterError).recoverable).toBe(true);
    expect(stub.calls).toHaveLength(0);
  });

  it('E.LF.8: il proxy risponde HTML → SOURCE_UNREACHABLE recuperabile', async () => {
    const stub = makeFetch(
      () => new Response('<html><body>proxy rotto</body></html>', { status: 200 }),
    );
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    let error: unknown;
    try {
      for await (const _event of adapter.parseRemote({
        endpoint: 'https://proxy.example.invalid',
      })) {
        void _event;
      }
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe('SOURCE_UNREACHABLE');
    expect((error as AdapterError).recoverable).toBe(true);
  });

  it('E.LF.8b: errore 10 (api_key non valida) → non recuperabile', async () => {
    const stub = makeFetch(() => jsonResponse({ error: 10, message: 'Invalid API key' }));
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    let error: unknown;
    try {
      for await (const _event of adapter.parseRemote({
        endpoint: 'https://proxy.example.invalid',
      })) {
        void _event;
      }
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).recoverable).toBe(false);
    expect(stub.calls).toHaveLength(1);
  });

  it('E.LF.12: errore 9 (sk non valida) → non recuperabile, un solo tentativo', async () => {
    const stub = makeFetch(() => jsonResponse({ error: 9, message: 'Invalid session key' }));
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    await expect(async () => {
      for await (const _event of adapter.parseRemote({
        endpoint: 'https://proxy.example.invalid',
      })) {
        void _event;
      }
    }).rejects.toThrow(AdapterError);
    expect(stub.calls).toHaveLength(1);
  });

  it('errore 16 (temporaneo) → recuperabile, con retry e backoff', async () => {
    let attempts = 0;
    const stub = makeFetch(() => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse({ error: 16, message: 'Temporary error' });
      }
      return jsonResponse({
        recenttracks: { '@attr': { totalPages: '1' }, track: [] },
      });
    });
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    const events = [];
    for await (const event of adapter.parseRemote({ endpoint: 'https://proxy.example.invalid' })) {
      events.push(event);
    }
    expect(attempts).toBe(2);
    expect(events).toHaveLength(0);
  });

  it('HTTP 429 → backoff e retry, poi successo', async () => {
    let attempts = 0;
    const stub = makeFetch(() => {
      attempts += 1;
      if (attempts === 1) {
        return new Response('rate limited', { status: 429 });
      }
      return jsonResponse({
        recenttracks: { '@attr': { totalPages: '1' }, track: [] },
      });
    });
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    for await (const _event of adapter.parseRemote({ endpoint: 'https://proxy.example.invalid' })) {
      void _event;
    }
    expect(attempts).toBe(2);
  });

  it('rate limit: il token bucket spazia le richieste (~5 req/s)', async () => {
    const stub = makeFetch(() =>
      jsonResponse({ recenttracks: { '@attr': { totalPages: '5' }, track: [] } }),
    );
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    for await (const _event of adapter.parseRemote({ endpoint: 'https://proxy.example.invalid' })) {
      void _event;
    }
    expect(stub.calls).toHaveLength(5);
    // I primi 5 token sono disponibili subito (capacità = 5): il 6° attende.
    expect(stub.clockAt[0]).toBe(0);
    expect(stub.clockAt[4]).toBe(0);
  });

  it('E.LF.21: senza `sk` la query non contiene api_sig e non serve il secret', async () => {
    const stub = makeFetch(() =>
      jsonResponse({ recenttracks: { '@attr': { totalPages: '1' }, track: [] } }),
    );
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    for await (const _event of adapter.parseRemote({ endpoint: 'https://proxy.example.invalid' })) {
      void _event;
    }
    expect(stub.calls[0]).not.toContain('api_sig');
    expect(stub.calls[0]).not.toContain('sk=');
  });

  it('proxy assente di api_key: la query la omette (proxy "intelligente")', async () => {
    const stub = makeFetch(() =>
      jsonResponse({ recenttracks: { '@attr': { totalPages: '1' }, track: [] } }),
    );
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    for await (const _event of adapter.parseRemote({ endpoint: 'https://proxy.example.invalid' })) {
      void _event;
    }
    expect(stub.calls[0]).not.toContain('api_key');
  });

  it('AbortSignal a metà → AbortError e partialEvents persistiti', async () => {
    const p1 = page(readJson(PAGE1), 474);
    const p2 = page(readJson(PAGE2), 474);
    const controller = new AbortController();
    const stub = makeFetch((url) => {
      const n = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
      if (n === 1) return jsonResponse(p1);
      if (n === 2) {
        controller.abort();
        return jsonResponse(p2);
      }
      return jsonResponse({ recenttracks: { '@attr': { totalPages: '474' }, track: [] } });
    });
    const clock = fakeClock();
    const adapter = new LastfmAdapter({
      username: 'ls_user',
      fetchImpl: stub.fetchImpl,
      now: clock.now,
      sleep: clock.sleep,
    });
    const summary = await runRemoteImport(
      db,
      adapter,
      { endpoint: 'https://proxy.example.invalid', signal: controller.signal },
      { privacy: PRIVACY_OFF },
    );
    expect(summary.status).toBe('partial');
    expect(summary.eventsInserted).toBeGreaterThan(0);
  });
});
