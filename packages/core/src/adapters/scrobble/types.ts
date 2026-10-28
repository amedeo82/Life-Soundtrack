import type { ScrobbleHubId } from '../../schema';

/**
 * Contratto di scrittura verso un hub di scrobbling — `05-ARCHITECTURE.md` §4.2
 * (ADR-0011 🟢 APPROVED v1.0) e `20-SCROBBLING-HUB.md` v1.0 §4.
 *
 * È il **gemello** del contratto di lettura (`PlatformAdapter`): stessa forma,
 * direzione opposta. `PlatformAdapter` descrive come si *legge* da una
 * piattaforma; `ScrobbleSink` descrive come si *scrive* su un hub. I due
 * insiemi non coincidono (i client di scrobbling non sono piattaforme
 * sorgente), quindi il contratto di scrittura **non** è un quinto metodo del
 * factory degli adapter (ADR-0011 V1).
 */

/**
 * Payload di un ascolto da inviare: copia **minima** e **chiusa per
 * costruzione** dell'evento locale (ADR-0011 V8, G-SH.6).
 *
 * Non esistono campi per contesto, device, IP o insight: non è una policy,
 * è il tipo. Il toggle `retainIp` **non** è applicabile al percorso di
 * scrittura (`09-PRIVACY-SECURITY.md` §3.3).
 */
export interface ScrobblePayload {
  /** Chiave di idempotenza locale: `hub|eventKey`. */
  idempotencyKey: string;
  /** Inizio dell'ascolto, unix ms UTC (→ secondi alla serializzazione). */
  startedAt: number;
  /** Durata **catalogo** del brano in ms, se nota. */
  durationMs?: number;
  /** MBID del brano, se noto. */
  recordingMbid?: string;
  /** ISRC del brano, se noto. */
  isrc?: string;
  /** Nome artista (già normalizzato per la deduplicazione). */
  artistName: string;
  /** Titolo brano. */
  trackName: string;
  /** Nome album, se noto. */
  albumName?: string;
}

/** Esito di un invio: quanti elementi del lotto il hub ha accettato. */
export interface ScrobbleResult {
  /** Elementi del lotto accettati dal hub. */
  accepted: number;
  /** Elementi del lotto rifiutati (errore per elemento). */
  rejected: number;
}

/**
 * Codici di errore della scrittura — `20-SCROBBLING-HUB.md` §11.1.
 *
 * Diversi da `AdapterErrorCode`, che è orientato al **parsing**: qui la
 * domanda è "si può ritentare lo stesso invio?".
 */
export type ScrobbleErrorCode =
  /** Credenziali assenti o hub non abilitato. */
  | 'HUB_UNCONFIGURED'
  /** Token/`sk` non valido, scaduto, revocato, firma rifiutata. */
  | 'AUTH_INVALID'
  /** 429 o rate limit del protocollo. */
  | 'RATE_LIMITED'
  /** Rete, DNS, proxy assente o rotto, timeout. */
  | 'SOURCE_UNREACHABLE'
  /** Il hub ha rifiutato il contenuto (400, errore di forma). */
  | 'PAYLOAD_REJECTED'
  /** Errore lato hub non classificabile. */
  | 'HUB_ERROR';

/**
 * Errore di un invio (`20-SCROBBLING-HUB.md` §11.1).
 *
 * `recoverable` ha qui una semantica **diversa** da quella di `AdapterError`:
 * in `AdapterError` significa "gli eventi validi sono stati persistiti", qui
 * significa "**lo stesso invio può essere ritentato** senza intervento
 * dell'utente". Un errore di autenticazione non è recuperabile: ritentare
 * produrrebbe lo stesso errore e consumerebbe quota (ADR-0011 V6).
 */
export class ScrobbleError extends Error {
  readonly code: ScrobbleErrorCode;
  /** true = lo stesso invio può essere ritentato. */
  readonly recoverable: boolean;
  readonly hub: ScrobbleHubId;

  constructor(
    code: ScrobbleErrorCode,
    message: string,
    options: { recoverable?: boolean; hub: ScrobbleHubId },
  ) {
    super(message);
    this.name = 'ScrobbleError';
    this.code = code;
    this.recoverable = options.recoverable ?? false;
    this.hub = options.hub;
  }
}

/** Opzioni di un invio. */
export interface ScrobbleSubmitOptions {
  /** Cancellazione cooperativa (ADR-0011 V5). */
  signal?: AbortSignal;
}

/**
 * Un sink di scrobbling: sa inviare ascolti a **un** hub.
 *
 * Il protocollo (endpoint, autenticazione, rate limit, formato del payload,
 * semantica degli errori) vive nel sink: il core non sa nulla del protocollo
 * (ADR-0011 V9).
 */
export interface ScrobbleSink {
  /** Hub di destinazione. */
  readonly hub: ScrobbleHubId;
  /** Nome leggibile (UI, log). */
  readonly name: string;
  /** Versione del client del sink (semver). */
  readonly version: string;
  /**
   * Il sink è pronto a inviare? (credenziali presenti, endpoint utilizzabile).
   *
   * Va detto all'utente **prima** del primo invio, non al primo errore
   * (`20-SCROBBLING-HUB.md` §13.1, U-SH.2).
   */
  isConfigured(): boolean;
  /**
   * Invia **un lotto** di ascolti.
   *
   * @throws ScrobbleError con `recoverable` = true per i fallimenti transitori.
   */
  submit(listens: ScrobblePayload[], options?: ScrobbleSubmitOptions): Promise<ScrobbleResult>;
}
