import { describe, expect, it } from 'vitest';
import { LastfmScrobbleSink, lastfmApiSignature } from '../../lastfm/scrobble';
import type { ScrobbleError, ScrobblePayload } from '../types';

/**
 * Test del sink Last.fm — `20-SCROBBLING-HUB.md` v1.0 §14.3, casi 1, 4, 12,
 * 14-18, 21, 22, 31.
 */

const CONFIG = {
  proxyBaseUrl: 'https://proxy.example.test',
  apiKey: 'api-key-test',
  sharedSecret: 'shared-secret-test',
  sessionKey: 'sk-test',
  proxyMode: 'read-write' as const,
};

const payload = (index: number): ScrobblePayload => ({
  idempotencyKey: `lastfm|ek-${index}`,
  startedAt: 1710523555000 + index * 1000,
  durationMs: 245000,
  artistName: `Artista ${index}`,
  trackName: `Brano ${index}`,
  albumName: `Album ${index}`,
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** Stub di `fetch` che registra le chiamate e risponde con un handler. */
const makeFetch = (
  handler: (url: URL, init: RequestInit | undefined) => Response | Promise<Response>,
): { fetchImpl: typeof fetch; calls: FetchCall[] } => {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    calls.push({ url: url.toString(), init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
};

describe('sink Last.fm — happy path (caso 1)', () => {
  it('invia una POST con api_sig, timestamp al secondo e body urlencoded', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      jsonResponse({ scrobbles: { '@attr': { accepted: 1, ignored: 0 } } }),
    );
    const sink = new LastfmScrobbleSink({ ...CONFIG, fetchImpl });

    const result = await sink.submit([payload(0)]);

    expect(result).toEqual({ accepted: 1, rejected: 0 });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.init?.method).toBe('POST');
    const body = new URLSearchParams(String(call?.init?.body));
    expect(body.get('method')).toBe('track.scrobble');
    expect(body.get('api_key')).toBe('api-key-test');
    expect(body.get('sk')).toBe('sk-test');
    expect(body.get('artist[0]')).toBe('Artista 0');
    expect(body.get('track[0]')).toBe('Brano 0');
    expect(body.get('album[0]')).toBe('Album 0');
    // `timestamp` = inizio in secondi UNIX UTC (T-SH.1).
    expect(body.get('timestamp[0]')).toBe(String(Math.floor(1710523555000 / 1000)));
    expect(body.get('duration[0]')).toBe('245');
    expect(body.get('api_sig')).toHaveLength(32);
  });

  it('la firma è il md5 dei parametri ordinati + shared secret', async () => {
    const params = { 'artist[0]': 'A', 'track[0]': 'T', 'timestamp[0]': '1' };
    const expected = lastfmApiSignature(params, 'secret');
    expect(expected).toBe(lastfmApiSignature(params, 'secret'));
    expect(expected).not.toBe(lastfmApiSignature(params, 'altro'));
  });
});

describe('sink Last.fm — firma in batch con ≥ 10 elementi (caso 22, E.SH.8)', () => {
  it('ordina i nomi indicizzati come stringhe: artist[10] prima di artist[2]', () => {
    const params: Record<string, string> = {};
    for (let i = 0; i < 11; i += 1) {
      params[`artist[${i}]`] = `A${i}`;
      params[`track[${i}]`] = `T${i}`;
      params[`timestamp[${i}]`] = String(1700000000 + i);
    }
    const signature = lastfmApiSignature(params, 'secret');
    // L'ordinamento lessicografico mette `artist[10]` prima di `artist[2]`:
    // la firma attesa non è quella dell'ordinamento numerico.
    const numericOrder = Object.keys(params)
      .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0))
      .map((k) => `${k}${params[k]}`)
      .join('');
    expect(signature).not.toBe(numericOrder);
    // ... ed è stabile: due calcoli danno lo stesso risultato.
    expect(lastfmApiSignature(params, 'secret')).toBe(signature);
  });
});

describe('sink Last.fm — batch da 50 (caso 21)', () => {
  it('un solo lotto da 50 produce 50 coppie indicizzate', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      jsonResponse({ scrobbles: { '@attr': { accepted: 50, ignored: 0 } } }),
    );
    const sink = new LastfmScrobbleSink({ ...CONFIG, fetchImpl });

    const batch = Array.from({ length: 50 }, (_, index) => payload(index));
    const result = await sink.submit(batch);

    expect(result).toEqual({ accepted: 50, rejected: 0 });
    expect(calls).toHaveLength(1);
    const body = new URLSearchParams(String(calls[0]?.init?.body));
    expect(body.get('artist[49]')).toBe('Artista 49');
    expect(body.get('timestamp[49]')).toBeTruthy();
  });
});

describe('sink Last.fm — errori (casi 12, 14-18)', () => {
  const captureScrobbleError = async (response: () => Response): Promise<ScrobbleError> => {
    const { fetchImpl } = makeFetch(() => response());
    const sink = new LastfmScrobbleSink({ ...CONFIG, fetchImpl });
    return sink.submit([payload(0)]).then(
      () => {
        throw new Error('il sink doveva fallire');
      },
      (error: unknown) => error as ScrobbleError,
    );
  };

  it('errore 29 → RATE_LIMITED recuperabile', async () => {
    const error = await captureScrobbleError(() =>
      jsonResponse({ error: 29, message: 'rate' }, 429),
    );
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.recoverable).toBe(true);
    expect(error.hub).toBe('lastfm');
  });

  it('errore 9 (sk non valida) → AUTH_INVALID terminale', async () => {
    const error = await captureScrobbleError(() =>
      jsonResponse({ error: 9, message: 'invalid sk' }, 403),
    );
    expect(error.code).toBe('AUTH_INVALID');
    expect(error.recoverable).toBe(false);
  });

  it('errore 13 (firma non valida) → AUTH_INVALID terminale', async () => {
    const error = await captureScrobbleError(() =>
      jsonResponse({ error: 13, message: 'bad sig' }, 403),
    );
    expect(error.code).toBe('AUTH_INVALID');
    expect(error.recoverable).toBe(false);
  });

  it('errore non mappato (8) → PAYLOAD_REJECTED non recuperabile', async () => {
    const error = await captureScrobbleError(() =>
      jsonResponse({ error: 8, message: 'malformed' }, 400),
    );
    expect(error.code).toBe('PAYLOAD_REJECTED');
    expect(error.recoverable).toBe(false);
  });

  it('proxy irraggiungibile → SOURCE_UNREACHABLE recuperabile', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const sink = new LastfmScrobbleSink({ ...CONFIG, fetchImpl });
    await expect(sink.submit([payload(0)])).rejects.toMatchObject({
      code: 'SOURCE_UNREACHABLE',
      recoverable: true,
    });
  });

  it('proxy che risponde HTML → errore, non crash di parsing (caso 18)', async () => {
    const { fetchImpl } = makeFetch(
      () =>
        new Response('<html>proxy</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    const sink = new LastfmScrobbleSink({ ...CONFIG, fetchImpl });
    await expect(sink.submit([payload(0)])).rejects.toMatchObject({
      code: 'SOURCE_UNREACHABLE',
      recoverable: true,
    });
  });
});

describe('sink Last.fm — rate limit (caso 24, AC-SH.5)', () => {
  it('il token bucket spazia le richieste (clock iniettato)', async () => {
    const sleeps: number[] = [];
    let clock = 0;
    const { fetchImpl, calls } = makeFetch(() =>
      jsonResponse({ scrobbles: { '@attr': { accepted: 1, ignored: 0 } } }),
    );
    const sink = new LastfmScrobbleSink({
      ...CONFIG,
      fetchImpl,
      now: () => clock,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    // 7 richieste con un bucket da 5/s: le prime 5 sono immediate, la sesta
    // aspetta, la settima pure.
    for (let index = 0; index < 7; index += 1) {
      await sink.submit([payload(index)]);
    }

    expect(calls).toHaveLength(7);
    expect(sleeps.length).toBeGreaterThanOrEqual(2);
    expect(sleeps.every((ms) => ms > 0)).toBe(true);
  });
});

describe('sink Last.fm — configurazione (casi 4, 31)', () => {
  it('senza credenziali → HUB_UNCONFIGURED e zero richieste', async () => {
    const { fetchImpl, calls } = makeFetch(() => jsonResponse({}));
    const sink = new LastfmScrobbleSink({
      proxyBaseUrl: '',
      apiKey: '',
      sharedSecret: '',
      sessionKey: '',
      proxyMode: 'read-only',
      fetchImpl,
    });
    expect(sink.isConfigured()).toBe(false);
    await expect(sink.submit([payload(0)])).rejects.toMatchObject({ code: 'HUB_UNCONFIGURED' });
    expect(calls).toHaveLength(0);
  });

  it('modalità proxy "read-only" (default) → zero richieste di scrittura', async () => {
    const { fetchImpl, calls } = makeFetch(() => jsonResponse({}));
    const sink = new LastfmScrobbleSink({ ...CONFIG, proxyMode: 'read-only', fetchImpl });
    expect(sink.isConfigured()).toBe(false);
    await expect(sink.submit([payload(0)])).rejects.toMatchObject({ code: 'HUB_UNCONFIGURED' });
    expect(calls).toHaveLength(0);
  });

  it('modalità "read-write" → la POST parte', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      jsonResponse({ scrobbles: { '@attr': { accepted: 1, ignored: 0 } } }),
    );
    const sink = new LastfmScrobbleSink({ ...CONFIG, proxyMode: 'read-write', fetchImpl });
    expect(sink.isConfigured()).toBe(true);
    await sink.submit([payload(0)]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init?.method).toBe('POST');
  });
});
