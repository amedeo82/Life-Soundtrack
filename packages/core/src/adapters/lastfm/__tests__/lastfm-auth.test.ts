import { describe, expect, it } from 'vitest';
import {
  buildAuthSessionUrl,
  buildAuthTokenUrl,
  exchangeSessionKey,
  parseAuthToken,
} from '../auth';

/**
 * Test del percorso web auth di Last.fm (D-LF.2) — `03-ADAPTERS/lastfm.md`
 * §2, `20-SCROBBLING-HUB.md` v1.0 §6.1.
 */

describe('percorso web auth Last.fm (D-LF.2)', () => {
  it("l'URL di autorizzazione porta api_key e redirect_uri", () => {
    const url = new URL(buildAuthTokenUrl('key-123', 'https://app.example.org/callback'));
    expect(url.origin + url.pathname).toBe('https://www.last.fm/api/auth.getToken');
    expect(url.searchParams.get('api_key')).toBe('key-123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.org/callback');
  });

  it("l'URL di scambio porta api_key, token e formato JSON", () => {
    const url = new URL(buildAuthSessionUrl('key-123', 'tok-abc'));
    expect(url.pathname).toBe('/2.0/auth.getSession');
    expect(url.searchParams.get('api_key')).toBe('key-123');
    expect(url.searchParams.get('token')).toBe('tok-abc');
    expect(url.searchParams.get('format')).toBe('json');
  });

  it('il token si estrae dalla URL di callback', () => {
    expect(parseAuthToken('https://app.example.org/callback?token=tok-abc')).toBe('tok-abc');
    expect(parseAuthToken('https://app.example.org/callback?foo=bar')).toBeNull();
    expect(parseAuthToken('non-una-url')).toBeNull();
  });

  it('lo scambio restituisce nome utente e session key', async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          session: { name: 'ls_user', key: 'sk-xyz', subscriber: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;

    const session = await exchangeSessionKey('key-123', 'tok-abc', fetchImpl);
    expect(session.username).toBe('ls_user');
    expect(session.sessionKey).toBe('sk-xyz');
    expect(session.subscriber).toBe(false);
  });

  it('un token rifiutato produce un errore dichiarato, non una sessione vuota', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: 14, message: 'Invalid token' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;

    await expect(exchangeSessionKey('key-123', 'tok-bad', fetchImpl)).rejects.toMatchObject({
      code: 'INVALID_FORMAT',
    });
  });
});
