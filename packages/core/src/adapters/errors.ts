/**
 * Errori del layer adapter — `05-ARCHITECTURE.md` §4.
 *
 * `recoverable: true` ⇒ gli eventi validi parsati prima dell'errore sono già
 * stati persistiti a chunk (partial recovery, 05§4); il caller può mostrare
 * l'errore mantenendo i dati. `recoverable: false` ⇒ nessun dato scritto.
 */
export type AdapterErrorCode = 'INVALID_FORMAT' | 'TRUNCATED' | 'UNSUPPORTED_VERSION' | 'INTERNAL';

export class AdapterError extends Error {
  /** Causa dell'errore (05§4). */
  readonly code: AdapterErrorCode;

  /** Se true, `partialEvents` eventi validi sono già stati persistiti. */
  readonly recoverable: boolean;

  /** Quanti eventi validi sono stati parsati prima dell'errore. */
  readonly partialEvents: number;

  constructor(
    code: AdapterErrorCode,
    message: string,
    options: { recoverable?: boolean; partialEvents?: number } = {},
  ) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    this.recoverable = options.recoverable ?? false;
    this.partialEvents = options.partialEvents ?? 0;
  }
}
