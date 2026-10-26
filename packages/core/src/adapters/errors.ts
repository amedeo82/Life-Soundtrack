/**
 * Errori del layer adapter — `05-ARCHITECTURE.md` §4.
 *
 * `recoverable: true` ⇒ gli eventi validi parsati prima dell'errore sono già
 * stati persistiti a chunk (partial recovery, 05§4); il caller può mostrare
 * l'errore mantenendo i dati. `recoverable: false` ⇒ nessun dato scritto.
 */
/**
 * Codici di errore del layer adapter — `05-ARCHITECTURE.md` §4.
 *
 * - `INVALID_FORMAT` — il file non è nel formato atteso.
 * - `TRUNCATED` — il file/stream termina a metà (partial recovery).
 * - `UNSUPPORTED_VERSION` — formato riconosciuto ma versione non supportata.
 * - `INTERNAL` — errore inatteso dell'adapter.
 * - `SOURCE_UNREACHABLE` — **sorgente remota** non raggiungibile: proxy
 *   assente, connessione fallita, timeout, risposta non-JSON (un proxy che
 *   risponde con HTML). Ratificato in ADR-0010 §4.1: è **recuperabile**
 *   (V8) perché gli eventi già raccolti restano persistiti; riusare
 *   `INVALID_FORMAT` darebbe all'utente la remediation sbagliata
 *   (correggere il file invece di configurare il proxy).
 */
export type AdapterErrorCode =
  'INVALID_FORMAT' | 'TRUNCATED' | 'UNSUPPORTED_VERSION' | 'INTERNAL' | 'SOURCE_UNREACHABLE';

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
