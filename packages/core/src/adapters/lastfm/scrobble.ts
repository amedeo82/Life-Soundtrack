import { md5Hex } from '../crypto';
import { ScrobbleError } from '../scrobble/types';
import type {
  ScrobblePayload,
  ScrobbleResult,
  ScrobbleSink,
  ScrobbleSubmitOptions,
} from '../scrobble/types';
import { TokenBucket } from './api';
import type { LastfmProxyMode } from '../../db/settings';

/**
 * Sink Last.fm — scrobble in scrittura (`track.scrobble`).
 *
 * Protocollo: `20-SCROBBLING-HUB.md` v1.0 §6.1, `03-ADAPTERS/lastfm.md` §10.
 *
 * - **CORS non è emesso** da Last.fm: il trasporto è il **proxy dell'utente**,
 *   che per la scrittura deve inoltrare una POST con body (D-SH.14). Il
 *   default `read-only` significa che l'app **non tenta** la scrittura.
 * - Autenticazione: `api_key` + `sk` + `api_sig` (`md5`, D-SH.11).
 * - Batch: fino a **50** scrobble per richiesta.
 * - Rate limit: ~5 req/s (token bucket), stimato: Last.fm non espone header.
 */

/** Massimo **50 scrobble** per richiesta (doc Last.fm API). */
export const LASTFM_MAX_SCROBBLES_PER_REQUEST = 50;

/** Richieste al secondo tollerate (stimato dai client, `03-ADAPTERS/lastfm.md` §10). */
export const LASTFM_SCROBBLE_REQUESTS_PER_SECOND = 5;

/** Configurazione del sink Last.fm. */
export interface LastfmScrobbleConfig {
  /** Base URL del proxy CORS dell'utente (D-LF.0). */
  proxyBaseUrl: string;
  /** Chiave API per-utente (mai nel bundle). */
  apiKey: string;
  /** Shared secret del percorso web auth (mai nel bundle). */
  sharedSecret: string;
  /** Session key `sk` (mai nel bundle). */
  sessionKey: string;
  /** Modalità dichiarata del proxy (D-SH.14). */
  proxyMode: LastfmProxyMode;
  /** `fetch` iniettabile (test). */
  fetchImpl?: typeof fetch;
  /** Orologio iniettabile (test). */
  now?: () => number;
  /** Sleep iniettabile (test). */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Codici di errore Last.fm che riguardano le **credenziali**: non sono
 * recuperabili (ritentare produrrebbe lo stesso errore, R-SH.3).
 *
 * 9 `sk` non valida · 10 `api_key` non valida · 13 firma non valida ·
 * 26 key sospesa.
 */
const AUTH_ERROR_CODES = new Set([9, 10, 13, 26]);

/** Codici di errore Last.fm temporanei: recuperabili con backoff. */
const TEMPORARY_ERROR_CODES = new Set([11, 16]);

/** Forma minima della risposta `track.scrobble`. */
interface LastfmScrobbleResponse {
  scrobbles?: {
    '@attr'?: {
      accepted?: number;
      ignored?: number;
    };
  };
  /** Codice di errore Last.fm (numerico). */
  error?: number;
  /** Messaggio di errore Last.fm. */
  message?: string;
}

/** Costruisce i parametri form-urlencoded di un lotto (senza `api_sig`). */
function buildBatchParams(listens: ScrobblePayload[]): Record<string, string> {
  const params: Record<string, string> = {};
  listens.forEach((listen, index) => {
    params[`artist[${index}]`] = listen.artistName;
    params[`track[${index}]`] = listen.trackName;
    if (listen.albumName) {
      params[`album[${index}]`] = listen.albumName;
    }
    // `timestamp` = inizio dell'ascolto in secondi UNIX UTC (T-SH.1).
    params[`timestamp[${index}]`] = String(Math.floor(listen.startedAt / 1000));
    if (listen.durationMs !== undefined) {
      params[`duration[${index}]`] = String(Math.floor(listen.durationMs / 1000));
    }
  });
  return params;
}

/**
 * Firma `api_sig`: md5 dei parametri **ordinati alfabeticamente come
 * stringhe** + shared secret.
 *
 * L'ordinamento è **lessicografico**: `artist[10]` viene **prima** di
 * `artist[2]`, perché il server ordina i *nomi* dei parametri, non gli indici
 * (E.SH.8). Ordinarlo numericamente produrrebbe una firma diversa — e il
 * difetto emerge solo con ≥ 10 elementi in un lotto.
 */
export function lastfmApiSignature(params: Record<string, string>, sharedSecret: string): string {
  const names = Object.keys(params).sort();
  const canonical = names.map((name) => `${name}${params[name]}`).join('');
  return md5Hex(canonical + sharedSecret);
}

/** Sink Last.fm per la scrittura degli scrobble. */
export class LastfmScrobbleSink implements ScrobbleSink {
  readonly hub = 'lastfm' as const;

  readonly name = 'Last.fm';

  readonly version = '1.0.0';

  private readonly config: LastfmScrobbleConfig;

  private readonly bucket: TokenBucket;

  private readonly fetchImpl: typeof fetch;

  constructor(config: LastfmScrobbleConfig) {
    this.config = config;
    this.bucket = new TokenBucket(LASTFM_SCROBBLE_REQUESTS_PER_SECOND, {
      now: config.now,
      sleep: config.sleep,
    });
    this.fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /**
   * Il sink è pronto a inviare? Proxy valorizzato, credenziali complete e
   * **modalità dichiarata** `read-write` (D-SH.14): senza dichiarazione
   * l'app non tenta la scrittura (P-SH.3).
   */
  isConfigured(): boolean {
    return (
      this.config.proxyBaseUrl.trim().length > 0 &&
      this.config.apiKey.trim().length > 0 &&
      this.config.sharedSecret.trim().length > 0 &&
      this.config.sessionKey.trim().length > 0 &&
      this.config.proxyMode === 'read-write'
    );
  }

  /**
   * Invia un lotto di ascolti.
   *
   * @throws ScrobbleError con `recoverable` = true per i fallimenti transitori
   *   (rete, rate limit, 5xx) e `false` per quelli terminali (credenziali,
   *   firma, payload rifiutato).
   */
  async submit(
    listens: ScrobblePayload[],
    options: ScrobbleSubmitOptions = {},
  ): Promise<ScrobbleResult> {
    if (!this.isConfigured()) {
      throw new ScrobbleError(
        'HUB_UNCONFIGURED',
        'Last.fm non è configurato per la scrittura (proxy, credenziali o modalità proxy)',
        { recoverable: false, hub: this.hub },
      );
    }
    if (listens.length === 0) {
      return { accepted: 0, rejected: 0 };
    }
    const accepted = await this.sendBatch(listens, options.signal);
    return { accepted, rejected: listens.length - accepted };
  }

  /** Invia un lotto (≤ 50) e restituisce quanti scrobble sono stati accettati. */
  private async sendBatch(listens: ScrobblePayload[], signal?: AbortSignal): Promise<number> {
    const params: Record<string, string> = {
      ...buildBatchParams(listens),
      method: 'track.scrobble',
      api_key: this.config.apiKey,
      sk: this.config.sessionKey,
    };
    params.api_sig = lastfmApiSignature(params, this.config.sharedSecret);

    const body = new URLSearchParams(params).toString();
    const url = new URL('/2.0/', this.config.proxyBaseUrl).toString();

    await this.bucket.acquire();
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      throw new ScrobbleError(
        'SOURCE_UNREACHABLE',
        'Proxy Last.fm non raggiungibile: connessione fallita o timeout',
        { recoverable: true, hub: this.hub },
      );
    }

    const text = await response.text();
    const parsed = safeJson(text);

    if (!response.ok) {
      throw this.mapError(response.status, parsed);
    }
    if (parsed && typeof parsed.error === 'number') {
      throw this.mapError(response.status, parsed);
    }
    if (!parsed) {
      // Il proxy ha risposto 200 ma non è JSON: non è un proxy Last.fm
      // funzionante (E.SH.7, caso 18). Non è un crash di parsing: è un
      // errore dichiarato.
      throw new ScrobbleError(
        'SOURCE_UNREACHABLE',
        'Il proxy Last.fm ha risposto con un corpo non JSON: non è un proxy Last.fm utilizzabile',
        { recoverable: true, hub: this.hub },
      );
    }
    return parsed.scrobbles?.['@attr']?.accepted ?? 0;
  }

  /** Mappa un errore Last.fm sulla mappa `ScrobbleError` (`20§11.1`). */
  private mapError(
    status: number,
    parsed: { error?: number; message?: string } | null,
  ): ScrobbleError {
    const code = parsed?.error;
    const message = parsed?.message ?? `Last.fm ha risposto ${status}`;
    if (code !== undefined && AUTH_ERROR_CODES.has(code)) {
      return new ScrobbleError('AUTH_INVALID', message, {
        recoverable: false,
        hub: this.hub,
      });
    }
    if (code === 29 || status === 429) {
      return new ScrobbleError('RATE_LIMITED', message, { recoverable: true, hub: this.hub });
    }
    if (code !== undefined && TEMPORARY_ERROR_CODES.has(code)) {
      return new ScrobbleError('HUB_ERROR', message, { recoverable: true, hub: this.hub });
    }
    if (status === 401 || status === 403) {
      return new ScrobbleError('AUTH_INVALID', message, { recoverable: false, hub: this.hub });
    }
    if (status >= 500) {
      return new ScrobbleError('HUB_ERROR', message, { recoverable: true, hub: this.hub });
    }
    if (status === 429) {
      return new ScrobbleError('RATE_LIMITED', message, { recoverable: true, hub: this.hub });
    }
    return new ScrobbleError('PAYLOAD_REJECTED', message, { recoverable: false, hub: this.hub });
  }
}

/** JSON tollerante: un proxy che risponde HTML non deve far crashare l'app. */
function safeJson(text: string): LastfmScrobbleResponse | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as LastfmScrobbleResponse;
  } catch {
    return null;
  }
}

/** Riconosce un abort (cancellazione cooperativa, V5). */
function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return error instanceof Error && error.name === 'AbortError';
}
