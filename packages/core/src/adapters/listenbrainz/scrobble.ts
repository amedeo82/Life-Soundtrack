import { ScrobbleError } from '../scrobble/types';
import type {
  ScrobblePayload,
  ScrobbleResult,
  ScrobbleSink,
  ScrobbleSubmitOptions,
} from '../scrobble/types';

/**
 * Sink ListenBrainz — scrobble in scrittura (`POST /1/submit-listens`).
 *
 * Protocollo: `20-SCROBBLING-HUB.md` v1.0 §6.2, `03-ADAPTERS/listenbrainz.md`.
 *
 * - CORS **nativo**: nessun proxy.
 * - Autenticazione: header `Authorization: Token …`.
 * - `User-Agent` **obbligatorio**: senza, le richieste possono essere bloccate
 *   senza preavviso.
 * - Tipo di invio: `import` (ascolti già salvati) — non `single` (D-SH.8).
 * - Rate limit: **1 req/s**, guidato dagli header `X-RateLimit-*`.
 */

/** Massimo elementi per richiesta (`MAX_LISTENS_PER_REQUEST`, doc ListenBrainz). */
export const LISTENBRAINZ_MAX_LISTENS_PER_REQUEST = 1000;

/** Richieste al secondo tollerate (senza token premium). */
export const LISTENBRAINZ_REQUESTS_PER_SECOND = 1;

/** Endpoint pubblico di ListenBrainz. */
export const LISTENBRAINZ_DEFAULT_ENDPOINT = 'https://api.listenbrainz.org';

/** Configurazione del sink ListenBrainz. */
export interface ListenbrainzScrobbleConfig {
  /** User Token (mai nel bundle). */
  token: string;
  /** Endpoint (testabile). */
  endpoint?: string;
  /** `User-Agent` obbligatorio: `NomeApp/<versione> ( url-contatto )`. */
  userAgent: string;
  /** `fetch` iniettabile (test). */
  fetchImpl?: typeof fetch;
  /** Orologio iniettabile (test). */
  now?: () => number;
  /** Sleep iniettabile (test). */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Capacità **opzionale** di un sink: il delay di retry che il protocollo
 * consiglia (R-SH.4 — ListenBrainz espone `X-RateLimit-Reset-In`).
 *
 * Non fa parte di `ScrobbleSink`: il contratto approvato (`05§4.2`) non ha
 * bisogno di conoscere i dettagli di nessun protocollo (ADR-0011 V9). Il
 * sender lo cerca **strutturalmente**: se il sink espone il metodo, il suo
 * consiglio viene rispettato.
 */
export interface ScrobbleRetryAdvice {
  /** Delay consigliato prima del prossimo tentativo (ms), se noto. */
  retryDelayMs(): number | null;
}

/** Corpo di una richiesta `submit-listens` (tipo `import`). */
interface ListenBrainzSubmitBody {
  listen_type: 'import';
  payload: Array<{
    listened_at: number;
    track_metadata: {
      artist_name: string;
      track_name: string;
      release_name?: string;
    };
    additional_info?: {
      recording_mbid?: string;
      isrc?: string;
      duration_ms?: number;
    };
  }>;
}

/** Costruisce il corpo `import` di un lotto di ascolti. */
export function buildListenBrainzBody(listens: ScrobblePayload[]): ListenBrainzSubmitBody {
  return {
    listen_type: 'import',
    payload: listens.map((listen) => {
      const additionalInfo: ListenBrainzSubmitBody['payload'][number]['additional_info'] = {};
      if (listen.recordingMbid) {
        additionalInfo.recording_mbid = listen.recordingMbid;
      }
      if (listen.isrc) {
        additionalInfo.isrc = listen.isrc;
      }
      if (listen.durationMs !== undefined) {
        additionalInfo.duration_ms = listen.durationMs;
      }
      const item: ListenBrainzSubmitBody['payload'][number] = {
        // `listened_at` = inizio dell'ascolto in secondi UNIX UTC (T-SH.1).
        listened_at: Math.floor(listen.startedAt / 1000),
        track_metadata: {
          artist_name: listen.artistName,
          track_name: listen.trackName,
          ...(listen.albumName ? { release_name: listen.albumName } : {}),
        },
      };
      if (Object.keys(additionalInfo).length > 0) {
        item.additional_info = additionalInfo;
      }
      return item;
    }),
  };
}

/** Sink ListenBrainz per la scrittura degli scrobble. */
export class ListenbrainzScrobbleSink implements ScrobbleSink, ScrobbleRetryAdvice {
  readonly hub = 'listenbrainz' as const;

  readonly name = 'ListenBrainz';

  readonly version = '1.0.0';

  private readonly config: ListenbrainzScrobbleConfig;

  private readonly fetchImpl: typeof fetch;

  private readonly now: () => number;

  private readonly sleep: (ms: number) => Promise<void>;

  /** ts (unix ms) del prossimo invio ammesso (1 req/s). */
  private nextAllowedAt = 0;

  /** Delay consigliato dall'hub (`X-RateLimit-Reset-In`), in ms. */
  private advisedDelayMs: number | null = null;

  constructor(config: ListenbrainzScrobbleConfig) {
    this.config = config;
    this.fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
    this.now = config.now ?? (() => Date.now());
    this.sleep =
      config.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** Il sink è pronto a inviare? Serve il User Token (P-SH.3). */
  isConfigured(): boolean {
    return this.config.token.trim().length > 0;
  }

  /** Delay consigliato dall'hub dopo l'ultima risposta (R-SH.4). */
  retryDelayMs(): number | null {
    return this.advisedDelayMs;
  }

  /**
   * Invia un lotto di ascolti, spezzandolo al limite di protocollo.
   *
   * @throws ScrobbleError con `recoverable` = true per i fallimenti transitori
   *   (rete, rate limit, 5xx) e `false` per quelli terminali (token, payload).
   */
  async submit(
    listens: ScrobblePayload[],
    options: ScrobbleSubmitOptions = {},
  ): Promise<ScrobbleResult> {
    if (!this.isConfigured()) {
      throw new ScrobbleError(
        'HUB_UNCONFIGURED',
        'ListenBrainz non è configurato (User Token mancante)',
        { recoverable: false, hub: this.hub },
      );
    }
    if (listens.length === 0) {
      return { accepted: 0, rejected: 0 };
    }
    let accepted = 0;
    for (let index = 0; index < listens.length; index += LISTENBRAINZ_MAX_LISTENS_PER_REQUEST) {
      const chunk = listens.slice(index, index + LISTENBRAINZ_MAX_LISTENS_PER_REQUEST);
      accepted += await this.sendChunk(chunk, options.signal);
    }
    return { accepted, rejected: listens.length - accepted };
  }

  /** Invia un chunk e restituisce quanti elementi sono stati accettati. */
  private async sendChunk(chunk: ScrobblePayload[], signal?: AbortSignal): Promise<number> {
    await this.throttle();
    const endpoint = this.config.endpoint ?? LISTENBRAINZ_DEFAULT_ENDPOINT;
    const url = new URL('/1/submit-listens', endpoint).toString();
    const body = JSON.stringify(buildListenBrainzBody(chunk));

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${this.config.token}`,
          'User-Agent': this.config.userAgent,
        },
        body,
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      throw new ScrobbleError(
        'SOURCE_UNREACHABLE',
        'ListenBrainz non raggiungibile: connessione fallita o timeout',
        { recoverable: true, hub: this.hub },
      );
    }

    this.readRateLimitHeaders(response);

    if (!response.ok) {
      throw this.mapError(response.status);
    }
    return chunk.length;
  }

  /** Tiene traccia del rate limit comunicato dagli header (D-SH.8). */
  private readRateLimitHeaders(response: Response): void {
    const resetIn = response.headers.get('X-RateLimit-Reset-In');
    if (resetIn) {
      const seconds = Number(resetIn);
      if (Number.isFinite(seconds) && seconds >= 0) {
        this.advisedDelayMs = Math.round(seconds * 1000);
      }
    }
  }

  /** Attende il rispetto del rate limit: 1 req/s e reset consigliato. */
  private async throttle(): Promise<void> {
    const now = this.now();
    const advised = this.advisedDelayMs;
    const waitUntil = Math.max(this.nextAllowedAt, advised !== null ? now + advised : 0);
    if (waitUntil > now) {
      await this.sleep(waitUntil - now);
    }
    this.nextAllowedAt = this.now() + 1000 / LISTENBRAINZ_REQUESTS_PER_SECOND;
  }

  /** Mappa lo stato HTTP sulla mappa `ScrobbleError` (`20§11.1`). */
  private mapError(status: number): ScrobbleError {
    if (status === 401 || status === 403 || status === 404) {
      return new ScrobbleError(
        'AUTH_INVALID',
        `ListenBrainz ha rifiutato le credenziali (HTTP ${status})`,
        { recoverable: false, hub: this.hub },
      );
    }
    if (status === 429) {
      return new ScrobbleError('RATE_LIMITED', 'ListenBrainz ha limitato le richieste (HTTP 429)', {
        recoverable: true,
        hub: this.hub,
      });
    }
    if (status >= 500) {
      return new ScrobbleError('HUB_ERROR', `ListenBrainz ha risposto ${status}`, {
        recoverable: true,
        hub: this.hub,
      });
    }
    return new ScrobbleError(
      'PAYLOAD_REJECTED',
      `ListenBrainz ha rifiutato il payload (HTTP ${status})`,
      { recoverable: false, hub: this.hub },
    );
  }
}

/** Riconosce un abort (cancellazione cooperativa, V5). */
function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return error instanceof Error && error.name === 'AbortError';
}
