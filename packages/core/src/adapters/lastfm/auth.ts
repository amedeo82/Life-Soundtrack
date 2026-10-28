import { AdapterError } from '../errors';

/**
 * Percorso **web auth** di Last.fm — `03-ADAPTERS/lastfm.md` §2 (D-LF.2),
 * `20-SCROBBLING-HUB.md` v1.0 §6.1.
 *
 * Il percorso API (D-LF.1) funziona senza `sk` e serve per la **lettura**. Per
 * la **scrittura** (`track.scrobble`) Last.fm pretende una firma `api_sig`:
 * l'utente autorizza l'app nel browser, l'app scambia il token con una
 * **session key** (`sk`), e da lì in poi firma ogni richiesta (D-SH.11).
 *
 * Il flusso è:
 *
 * 1. `GET /api/auth.getToken?api_key=…&redirect_uri=…` → l'utente autorizza nel
 *    browser e viene reindirizzato alla callback con `?token=…`;
 * 2. `GET /api/auth.getSession?api_key=…&token=…` → `{ session: { name, key } }`.
 *
 * `redirect_uri` è **registrata dall'utente** su Last.fm (D-LF.2): l'app non
 * possiede un dominio di callback, e la PWA non fa da server (ADR-0002).
 */

const LASTFM_API_BASE = 'https://ws.audioscrobbler.com/2.0/';

/** URL di autorizzazione: apre il browser dell'utente. */
export function buildAuthTokenUrl(apiKey: string, redirectUri: string): string {
  const url = new URL('/api/auth.getToken', 'https://www.last.fm');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('redirect_uri', redirectUri);
  return url.toString();
}

/** URL di scambio token → session key. */
export function buildAuthSessionUrl(apiKey: string, token: string): string {
  const url = new URL(`${LASTFM_API_BASE}auth.getSession`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('token', token);
  url.searchParams.set('format', 'json');
  return url.toString();
}

/**
 * Estrae il token dalla URL di callback (`?token=…`).
 *
 * @returns il token, oppure `null` se la URL non ne contiene uno.
 */
export function parseAuthToken(callbackUrl: string): string | null {
  try {
    const url = new URL(callbackUrl);
    const token = url.searchParams.get('token');
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/** Esito dello scambio token → session key. */
export interface LastfmSession {
  /** Nome utente Last.fm. */
  username: string;
  /** Session key (`sk`): credenziale per-utente, mai nel bundle. */
  sessionKey: string;
  /** L'utente ha un account premium (non usato, ma la risposta lo porta). */
  subscriber: boolean;
}

/** Forma minima della risposta `auth.getSession`. */
interface AuthSessionResponse {
  session?: {
    name?: string;
    key?: string;
    subscriber?: number;
  };
  error?: number;
  message?: string;
}

/**
 * Scambia il token con la session key.
 *
 * @throws AdapterError con `INVALID_FORMAT` se la risposta non contiene una
 *   sessione (token non valido o scaduto).
 */
export async function exchangeSessionKey(
  apiKey: string,
  token: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<LastfmSession> {
  const response = await fetchImpl(buildAuthSessionUrl(apiKey, token), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const text = await response.text();
  let parsed: AuthSessionResponse | null = null;
  try {
    const value: unknown = JSON.parse(text);
    parsed = value && typeof value === 'object' ? (value as AuthSessionResponse) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok || !parsed?.session?.key) {
    throw new AdapterError(
      'INVALID_FORMAT',
      parsed?.message ?? `Last.fm ha rifiutato lo scambio del token (HTTP ${response.status})`,
    );
  }
  return {
    username: parsed.session.name ?? '',
    sessionKey: parsed.session.key,
    subscriber: parsed.session.subscriber === 1,
  };
}
