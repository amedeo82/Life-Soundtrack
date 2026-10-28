import { describe, expect, it } from 'vitest';
import { ListenbrainzScrobbleSink, buildListenBrainzBody } from '../../listenbrainz/scrobble';
import type { ScrobblePayload } from '../types';

/**
 * Test del sink ListenBrainz — `20-SCROBBLING-HUB.md` v1.0 §14.3, casi 2, 4,
 * 11, 13.
 */

const CONFIG = {
  token: 'user-token-test',
  userAgent: 'LifeSoundtrack/0.1.0 ( https://example.test/contact )',
  endpoint: 'https://lb.example.test',
};

const payload = (index: number): ScrobblePayload => ({
  idempotencyKey: `listenbrainz|ek-${index}`,
  startedAt: 1710523555000 + index * 1000,
  durationMs: 245000,
  recordingMbid: 'mbid-1',
  isrc: 'ISRC-1',
  artistName: `Artista ${index}`,
  trackName: `Brano ${index}`,
  albumName: `Album ${index}`,
});

const jsonResponse = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response => new Response(JSON.stringify(body), { status, headers });

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

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

describe('sink ListenBrainz — happy path (caso 2)', () => {
  it('POST /1/submit-listens con listen_type import, User-Agent e Authorization', async () => {
    const { fetchImpl, calls } = makeFetch(() => jsonResponse({ status: 'ok' }));
    const sink = new ListenbrainzScrobbleSink({ ...CONFIG, fetchImpl });

    const result = await sink.submit([payload(0)]);

    expect(result).toEqual({ accepted: 1, rejected: 0 });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe('https://lb.example.test/1/submit-listens');
    expect(call?.init?.method).toBe('POST');
    const headers = call?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Token user-token-test');
    expect(headers['User-Agent']).toContain('LifeSoundtrack');
    const body = JSON.parse(String(call?.init?.body)) as {
      listen_type: string;
      payload: Array<{ listened_at: number; track_metadata: Record<string, string> }>;
    };
    expect(body.listen_type).toBe('import');
    expect(body.payload[0]?.listened_at).toBe(Math.floor(1710523555000 / 1000));
    expect(body.payload[0]?.track_metadata.artist_name).toBe('Artista 0');
    expect(body.payload[0]?.track_metadata.release_name).toBe('Album 0');
  });

  it('il payload porta solo i metadati noti (closed by construction, V8)', () => {
    const body = buildListenBrainzBody([payload(0)]);
    expect(body.payload[0]?.additional_info).toEqual({
      recording_mbid: 'mbid-1',
      isrc: 'ISRC-1',
      duration_ms: 245000,
    });
    const minimal = buildListenBrainzBody([
      {
        idempotencyKey: 'listenbrainz|ek-x',
        startedAt: 1710523555000,
        artistName: 'A',
        trackName: 'T',
      },
    ]);
    expect(minimal.payload[0]?.additional_info).toBeUndefined();
    expect(JSON.stringify(minimal)).not.toContain('ip');
    expect(JSON.stringify(minimal)).not.toContain('country');
  });
});

describe('sink ListenBrainz — errori (casi 11, 13)', () => {
  it('401 → AUTH_INVALID terminale', async () => {
    const { fetchImpl } = makeFetch(() => jsonResponse({ code: 401 }, 401));
    const sink = new ListenbrainzScrobbleSink({ ...CONFIG, fetchImpl });
    await expect(sink.submit([payload(0)])).rejects.toMatchObject({
      code: 'AUTH_INVALID',
      recoverable: false,
    });
  });

  it('429 → RATE_LIMITED recuperabile e reset-in letto dagli header', async () => {
    const { fetchImpl } = makeFetch(() =>
      jsonResponse({ code: 429 }, 429, { 'X-RateLimit-Reset-In': '7' }),
    );
    const sink = new ListenbrainzScrobbleSink({ ...CONFIG, fetchImpl });
    await expect(sink.submit([payload(0)])).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      recoverable: true,
    });
    // R-SH.4: il delay consigliato dal protocollo è 7 s.
    expect(sink.retryDelayMs()).toBe(7000);
  });

  it('500 → HUB_ERROR recuperabile', async () => {
    const { fetchImpl } = makeFetch(() => jsonResponse({}, 500));
    const sink = new ListenbrainzScrobbleSink({ ...CONFIG, fetchImpl });
    await expect(sink.submit([payload(0)])).rejects.toMatchObject({
      code: 'HUB_ERROR',
      recoverable: true,
    });
  });
});

describe('sink ListenBrainz — configurazione (caso 4)', () => {
  it('senza User Token → HUB_UNCONFIGURED e zero richieste', async () => {
    const { fetchImpl, calls } = makeFetch(() => jsonResponse({}));
    const sink = new ListenbrainzScrobbleSink({ ...CONFIG, token: '', fetchImpl });
    expect(sink.isConfigured()).toBe(false);
    await expect(sink.submit([payload(0)])).rejects.toMatchObject({ code: 'HUB_UNCONFIGURED' });
    expect(calls).toHaveLength(0);
  });
});
