import { afterEach, describe, expect, it } from 'vitest';
import { closeAllDbs, freshDb } from '../../../db/__tests__/helpers';
import { loadScrobbleCursor } from '../../../db/settings';
import { ListenBrainzAdapter } from '../adapter';
import { syncListenbrainzIncrementally } from '../../scrobble/sync';
import type { PrivacySettings } from '../../../schema';

/**
 * Test della sync continua incrementale — `20-SCROBBLING-HUB.md` v1.0 §14.3,
 * casi 25 e 26 (C-SH.1…C-SH.6).
 */

afterEach(closeAllDbs);

const PRIVACY_OFF: PrivacySettings = {
  retainIp: false,
  enrichMetadata: false,
  carDetectionConsent: false,
  scrobbleHubs: [],
  syncCloud: false,
};

const LISTENED_AT = 1710523800;

const listenPayload = (listenedAt: number): Record<string, unknown> => ({
  listened_at: listenedAt,
  inserted_at: listenedAt,
  track_metadata: {
    artist_name: 'Artista',
    track_name: `Brano ${listenedAt}`,
    release_name: 'Album',
  },
  additional_info: {
    duration_ms: 200000,
    recording_mbid: 'mbid-1',
  },
});

/** Stub di `fetch` che restituisce le pagine indicate, in ordine. */
const makeFetch = (
  pages: Array<Array<Record<string, unknown>>>,
): { fetchImpl: typeof fetch; urls: string[] } => {
  const urls: string[] = [];
  let index = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    urls.push(url.toString());
    const listens = pages[index] ?? [];
    index += 1;
    return new Response(JSON.stringify({ payload: { count: listens.length, listens } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, urls };
};

describe('sync incrementale ListenBrainz (casi 25, 26)', () => {
  it('il cursore è persistito e la seconda sync usa max_ts = ultimoTs - 1 (C-SH.1, C-SH.2)', async () => {
    const db = freshDb('ls-lb-sync-cursor');
    const { fetchImpl, urls } = makeFetch([
      [listenPayload(LISTENED_AT), listenPayload(LISTENED_AT - 10)],
    ]);
    const adapter = new ListenBrainzAdapter({ fetchImpl, sleep: async () => undefined });

    const result = await syncListenbrainzIncrementally({
      db,
      adapter,
      token: 'user-token',
      username: 'utente',
      privacy: PRIVACY_OFF,
      userAgent: 'LifeSoundtrack/0.1.0 ( https://example.test/contact )',
      endpoint: 'https://lb.example.test',
    });

    expect(result.imported).toBe(true);
    expect(result.cursor.maxTs).toBe(LISTENED_AT);
    const stored = await loadScrobbleCursor(db);
    expect(stored.maxTs).toBe(LISTENED_AT);

    // Seconda sync: la richiesta porta il cursore diminuito di 1 secondo.
    const { fetchImpl: fetch2, urls: urls2 } = makeFetch([[]]);
    const adapter2 = new ListenBrainzAdapter({ fetchImpl: fetch2, sleep: async () => undefined });
    await syncListenbrainzIncrementally({
      db,
      adapter: adapter2,
      token: 'user-token',
      username: 'utente',
      privacy: PRIVACY_OFF,
      userAgent: 'LifeSoundtrack/0.1.0 ( https://example.test/contact )',
      endpoint: 'https://lb.example.test',
    });

    // La prima sync non ha cursore: la richiesta non porta `max_ts`.
    expect(urls[0]).not.toContain('max_ts');
    expect(urls2[0]).toContain(`max_ts=${LISTENED_AT - 1}`);
    expect(urls2[0]).toContain('count=1000');
  });

  it('a pagina vuota il cursore non si muove (caso 26, C-SH.3)', async () => {
    const db = freshDb('ls-lb-sync-empty');
    const { fetchImpl } = makeFetch([[]]);
    const adapter = new ListenBrainzAdapter({ fetchImpl, sleep: async () => undefined });

    const result = await syncListenbrainzIncrementally({
      db,
      adapter,
      token: 'user-token',
      username: 'utente',
      privacy: PRIVACY_OFF,
      userAgent: 'LifeSoundtrack/0.1.0 ( https://example.test/contact )',
      endpoint: 'https://lb.example.test',
    });

    expect(result.imported).toBe(false);
    expect(result.cursor.maxTs).toBeNull();
  });

  it('senza User Token la sync non parte (E.LB.18: token obbligatorio)', async () => {
    const db = freshDb('ls-lb-sync-no-token');
    const { fetchImpl, urls } = makeFetch([[listenPayload(LISTENED_AT)]]);
    const adapter = new ListenBrainzAdapter({ fetchImpl, sleep: async () => undefined });

    await expect(
      syncListenbrainzIncrementally({
        db,
        adapter,
        token: '',
        username: 'utente',
        privacy: PRIVACY_OFF,
        userAgent: 'LifeSoundtrack/0.1.0 ( https://example.test/contact )',
        endpoint: 'https://lb.example.test',
      }),
    ).rejects.toThrow();
    expect(urls).toHaveLength(0);
  });
});
