import { AdapterError, type AdapterErrorCode } from '../errors';
import type { LastfmApiTrack, LastfmRecentTracksResponse } from './types';
import { lastfmTotalPages, lastfmTrackList } from './types';

/**
 * Client HTTP dell'API Last.fm (`03-ADAPTERS/lastfm.md` §2.1, §10).
 *
 * Il protocollo vive qui (ADR-0010 V7): rate limiting, backoff e forma degli
 * errori sono proprietà della piattaforma, non del core.
 */

/** Limite massimo documentato di `limit` (doc ufficiale: 200, non 1000). */
export const LASTFM_MAX_LIMIT = 200;

/** Ritmo client-side sostenibile (limite Last.fm **non pubblicato**). */
export const LASTFM_REQUESTS_PER_SECOND = 5;

/** Tentativi massimi per un errore recuperabile (backoff esponenziale). */
const MAX_ATTEMPTS = 3;

/** Ritardo base del backoff esponenziale (ms). */
const BACKOFF_BASE_MS = 500;

/** Configurazione del client API Last.fm. */
export interface LastfmApiConfig {
  /** Base URL del proxy configurato dall'utente (D-LF.0). */
  endpoint: string;
  /** Username Last.fm: obbligatorio per `user.getRecentTracks`. */
  user: string;
  /**
   * `api_key` per-utente (D-LF.1). **Assente** → l'adapter omette il
   * parametro: è il caso del proxy "intelligente" che la inietta.
   */
  apiKey?: string | undefined;
  /**
   * Session key `sk`. Non usata nella Story 1.3 (E.LF.21): il percorso web
   * auth richiede `api_sig` (md5) ed è differito alla Story 1.5.
   */
  sessionKey?: string | undefined;
  /** Elementi per richiesta (max documentato 200). */
  limit?: number | undefined;
  /** Finestra temporale iniziale (UNIX secondi UTC). */
  from?: number | undefined;
  /** Finestra temporale finale (UNIX secondi UTC). */
  to?: number | undefined;
  /** `fetch` iniettabile (test: nessuna rete reale). */
  fetchImpl?: typeof fetch | undefined;
  /** Orologio iniettabile (test del token bucket). */
  now?: (() => number) | undefined;
  /** Sleep iniettabile (test del token bucket e del backoff). */
  sleep?: ((ms: number) => Promise<void>) | undefined;
}

/**
 * Tabella dei codici di errore Last.fm (§10, `lastfm.md`).
 *
 * `code` distingue due famiglie: gli errori **di configurazione/autenticazione**
 * (l'utente deve intervenire) sono `INTERNAL`; gli errori in cui la sorgente
 * **non è disponibile** (servizio offline, errore temporaneo, rate limit,
 * profilo privato) sono `SOURCE_UNREACHABLE` e recuperabili — gli eventi
 * già raccolti restano persistiti (ADR-0010 V8).
 */
const LASTFM_ERROR_CODES: Record<
  number,
  { message: string; recoverable: boolean; code: AdapterErrorCode }
> = {
  6: {
    message: 'Parametri invalidi: controlla proxy, chiave API e nome utente',
    recoverable: false,
    code: 'INTERNAL',
  },
  8: { message: 'Operazione fallita sul server Last.fm', recoverable: false, code: 'INTERNAL' },
  9: { message: 'Sessione Last.fm non valida: riautentica', recoverable: false, code: 'INTERNAL' },
  10: { message: 'Chiave API Last.fm non valida', recoverable: false, code: 'INTERNAL' },
  11: {
    message: 'Servizio Last.fm offline: riprova più tardi',
    recoverable: true,
    code: 'SOURCE_UNREACHABLE',
  },
  13: { message: 'Firma del metodo non valida', recoverable: false, code: 'INTERNAL' },
  16: { message: 'Errore temporaneo Last.fm', recoverable: true, code: 'SOURCE_UNREACHABLE' },
  17: {
    message:
      'Il profilo Last.fm non mostra gli ascolti recenti ("Hide recent listening"): usa il percorso file o la sessione web',
    recoverable: true,
    code: 'SOURCE_UNREACHABLE',
  },
  26: {
    message: 'Chiave API Last.fm sospesa: contatta il supporto Last.fm',
    recoverable: false,
    code: 'INTERNAL',
  },
  29: {
    message: 'Rate limit Last.fm superato: attesa con backoff',
    recoverable: true,
    code: 'SOURCE_UNREACHABLE',
  },
};

/** Traduce un codice di errore Last.fm in `AdapterError` (§10). */
export function lastfmErrorToAdapterError(code: number, message?: string | null): AdapterError {
  const known = LASTFM_ERROR_CODES[code];
  if (!known) {
    return new AdapterError(
      'INTERNAL',
      `Errore Last.fm sconosciuto (${code}): ${message ?? ''}`.trim(),
    );
  }
  return new AdapterError(known.code, `${known.message} (codice ${code})`, {
    recoverable: known.recoverable,
  });
}

/** Codici su cui si ritenta con backoff (§10: 11, 16, 29). */
const RETRYABLE_CODES = new Set([11, 16, 29]);

/**
 * Token bucket client-side: rende il ritmo delle richieste **spaziato**,
 * non merely "non superato". L'ultimo limite non è pubblicato da Last.fm
 * (la community misura ~5 req/s sostenibili): il ritmo è **stimato**, non
 * guidato da header (asimmetria dichiarata rispetto a ListenBrainz).
 */
export class TokenBucket {
  private tokens: number;

  private lastRefill: number;

  private readonly capacity: number;

  private readonly now: () => number;

  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    ratePerSecond: number,
    options: {
      capacity?: number | undefined;
      now?: (() => number) | undefined;
      sleep?: ((ms: number) => Promise<void>) | undefined;
    } = {},
  ) {
    this.capacity = options.capacity ?? Math.max(1, ratePerSecond);
    this.tokens = this.capacity;
    this.now = options.now ?? (() => Date.now());
    this.sleep =
      options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.lastRefill = this.now();
  }

  /** Attende (se necessario) che un token sia disponibile e lo consuma. */
  async acquire(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.capacity) * 1000);
      await this.sleep(waitMs);
    }
  }

  /** Tokens disponibili (diagnostica/test). */
  get available(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = this.now();
    const elapsed = now - this.lastRefill;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + (elapsed / 1000) * this.capacity);
      this.lastRefill = now;
    }
  }
}

/** Una pagina della risposta API. */
export interface LastfmPage {
  /** Page number (1-based). */
  page: number;
  /** Track della pagina (può essere vuota: stop pulito). */
  tracks: LastfmApiTrack[];
  /** Totale pagine dichiarato (`@attr.totalPages`), se presente. */
  totalPages: number | null;
}

export class LastfmApiClient {
  private readonly config: LastfmApiConfig;

  private readonly bucket: TokenBucket;

  private readonly fetchImpl: typeof fetch;

  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: LastfmApiConfig) {
    this.config = config;
    this.bucket = new TokenBucket(LASTFM_REQUESTS_PER_SECOND, {
      now: config.now,
      sleep: config.sleep,
    });
    this.fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep =
      config.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /**
   * Itera le pagine della risposta, con rate limiting, backoff e gestione
   * degli errori. Si ferma a `@attr.totalPages` (E.LF.2) e su una pagina
   * vuota.
   */
  async *pages(signal?: AbortSignal): AsyncGenerator<LastfmPage> {
    let page = 1;
    let totalPages: number | null = null;
    for (;;) {
      if (signal?.aborted) {
        throw new DOMException('Import cancellato', 'AbortError');
      }
      const response = await this.fetchPage(page, signal);
      const tracks = lastfmTrackList(response);
      const declared = lastfmTotalPages(response);
      if (declared !== null) {
        totalPages = declared;
      }
      yield { page, tracks, totalPages };
      if (totalPages !== null && page >= totalPages) {
        // E.LF.2: la paginazione non va oltre `totalPages`.
        return;
      }
      if (totalPages === null && tracks.length === 0) {
        // Senza `totalPages` la risposta vuota è l'unico segnale di fine.
        return;
      }
      page += 1;
    }
  }

  /** Costruisce l'URL di una pagina (§10: `new URL('/2.0/', proxyUrl)`). */
  buildUrl(page: number): string {
    const url = new URL('/2.0/', this.config.endpoint);
    url.searchParams.set('method', 'user.getRecentTracks');
    url.searchParams.set('user', this.config.user);
    if (this.config.apiKey) {
      url.searchParams.set('api_key', this.config.apiKey);
    }
    url.searchParams.set('format', 'json');
    url.searchParams.set(
      'limit',
      String(Math.min(this.config.limit ?? LASTFM_MAX_LIMIT, LASTFM_MAX_LIMIT)),
    );
    url.searchParams.set('page', String(page));
    url.searchParams.set('extended', '1');
    if (this.config.from !== undefined) {
      url.searchParams.set('from', String(this.config.from));
    }
    if (this.config.to !== undefined) {
      url.searchParams.set('to', String(this.config.to));
    }
    return url.toString();
  }

  /** Scarica una pagina, con retry e backoff (§10). */
  private async fetchPage(page: number, signal?: AbortSignal): Promise<LastfmRecentTracksResponse> {
    const url = this.buildUrl(page);
    let attempt = 0;
    for (;;) {
      if (signal?.aborted) {
        throw new DOMException('Import cancellato', 'AbortError');
      }
      await this.bucket.acquire();
      let response: Response;
      try {
        const init: RequestInit = signal ? { signal, method: 'GET' } : { method: 'GET' };
        response = await this.fetchImpl(url, init);
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        throw new AdapterError(
          'SOURCE_UNREACHABLE',
          'Proxy Last.fm non raggiungibile: connessione fallita o timeout',
          { recoverable: true },
        );
      }
      const text = await response.text();
      const parsed = safeJson(text);

      if (!response.ok) {
        if (parsed && typeof parsed.error === 'number') {
          const mapped = lastfmErrorToAdapterError(parsed.error, parsed.message);
          if (RETRYABLE_CODES.has(parsed.error) && attempt < MAX_ATTEMPTS) {
            attempt += 1;
            await this.sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
            continue;
          }
          throw mapped;
        }
        if (response.status === 429 || response.status >= 500) {
          if (attempt < MAX_ATTEMPTS) {
            attempt += 1;
            await this.sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
            continue;
          }
          throw new AdapterError(
            'SOURCE_UNREACHABLE',
            `Errore HTTP ${response.status} dal proxy Last.fm`,
            { recoverable: true },
          );
        }
        throw new AdapterError(
          'SOURCE_UNREACHABLE',
          `Errore HTTP ${response.status} dal proxy Last.fm`,
          { recoverable: true },
        );
      }

      if (!parsed) {
        // E.LF.8: il proxy ha risposto con HTML (o altro non-JSON): non è
        // "API non raggiungibile" ma "proxy rotto" — lo stesso codice con un
        // messaggio che li distingue.
        throw new AdapterError(
          'SOURCE_UNREACHABLE',
          'Il proxy Last.fm ha risposto con dati non JSON: il proxy è rotto o non è un proxy Last.fm',
          { recoverable: true },
        );
      }
      if (typeof parsed.error === 'number') {
        if (RETRYABLE_CODES.has(parsed.error) && attempt < MAX_ATTEMPTS) {
          attempt += 1;
          await this.sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
          continue;
        }
        throw lastfmErrorToAdapterError(parsed.error, parsed.message);
      }
      return parsed;
    }
  }
}

/** Parse JSON tollerante: `null` se il corpo non è JSON (E.LF.8). */
function safeJson(text: string): LastfmRecentTracksResponse | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as LastfmRecentTracksResponse;
  } catch {
    return null;
  }
}

/** Riconosce un abort (cancellazione cooperativa, V6). */
function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return error instanceof Error && error.name === 'AbortError';
}
