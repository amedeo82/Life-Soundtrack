import type { ScrobbleError, ScrobbleErrorCode, ScrobblePayload } from '../adapters/scrobble/types';
import type { ScrobbleHubId } from '../schema';
import type { LifeSoundtrackDB } from './db';

/**
 * Coda di invio degli scrobble (`scrobbleOutbox`) — `02-DATA-SCHEMA.md` §6.2,
 * `20-SCROBBLING-HUB.md` v1.0 §8.
 *
 * La coda **non** può stare in `settings`: `settings` è chiave/valore per
 * impostazioni, e una coda ha stato per elemento, tentativi e indice unico.
 *
 * Tre garanzie, tutte locali (nessuna delle due API espone una chiave di
 * deduplica lato server):
 *
 * - **idempotenza per costruzione**: la PK è `hub|eventKey`, quindi un ascolto
 *   entra in coda al massimo una volta per hub (G-SH.1). Il secondo enqueue è
 *   **ignorato**, non è un errore;
 * - **write-ahead**: la riga passa a `in_flight` **prima** della richiesta, così
 *   un crash fra la richiesta e la conferma lascia la riga in `in_flight` e non
 *   ritentata in automatico (E.SH.6): il caso residuo è un doppio scrobble
 *   possibile, mai una perdita (G-SH.2);
 * - **nessuna perdita**: un fallimento lascia la riga in coda con `attempts` e
 *   `nextAttemptAt`.
 */

/** Stati della macchina a stati della coda (`20§8.2`). */
export type ScrobbleOutboxStatus = 'pending' | 'in_flight' | 'sent' | 'failed' | 'dropped';

/** Ultimo errore registrato sulla riga: **mai** un segreto. */
export interface ScrobbleOutboxError {
  /** Codice della mappa `ScrobbleError` (`20§11.1`). */
  code: ScrobbleErrorCode;
  /** Messaggio sintetico (mai credenziali, mai payload). */
  message: string;
  /** true = lo stesso invio può essere ritentato. */
  recoverable: boolean;
}

/** Una riga della coda di invio (`02§6.2`). */
export interface ScrobbleOutboxRow {
  /** **PK**: `hub|eventKey` — unico per costruzione (G-SH.1). */
  idempotencyKey: string;
  /** Hub di destinazione. */
  hub: ScrobbleHubId;
  /** `eventKey` locale dell'ascolto (`05§3.2`). */
  eventKey: string;
  /** Payload da inviare: serializzabile, **senza segreti** (`05§4.2` V8). */
  payload: ScrobblePayload;
  /** Stato nella macchina a stati. */
  status: ScrobbleOutboxStatus;
  /** Numero di tentativi effettuati. */
  attempts: number;
  /** ts (unix ms) del prossimo tentativo consentito. */
  nextAttemptAt: number;
  /** Ultimo errore, se c'è stato. */
  lastError: ScrobbleOutboxError | null;
  /** ts di enqueue. */
  createdAt: number;
  /** ts di conferma dell'hub (null se non inviato). */
  sentAt: number | null;
}

/** Massimo **5 tentativi** per riga (R-SH.2). */
export const SCROBBLE_MAX_ATTEMPTS = 5;

/** Base del backoff esponenziale: 30 s (R-SH.1). */
export const SCROBBLE_RETRY_BASE_MS = 30_000;

/** Tetto del backoff: 1 h (R-SH.1). */
export const SCROBBLE_RETRY_CAP_MS = 3_600_000;

/** Costruisce la chiave di idempotenza di una riga: `hub|eventKey`. */
export function scrobbleIdempotencyKey(hub: ScrobbleHubId, eventKey: string): string {
  return `${hub}|${eventKey}`;
}

/**
 * Delay del prossimo tentativo: `min(base × 2^(attempts-1), cap)` con jitter
 * (R-SH.1).
 *
 * Il jitter è un fattore in `[0.5, 1.5]` applicato **dopo** il tetto: senza
 * jitter, venti righe in coda ritenterebbero tutte insieme e il rate limit del
 * hub (V2) verrebbe violato proprio nel momento del retry.
 *
 * `random` è iniettabile per rendere il test deterministico.
 */
export function computeRetryDelayMs(attempts: number, random: () => number = Math.random): number {
  const exponential = SCROBBLE_RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1);
  const capped = Math.min(exponential, SCROBBLE_RETRY_CAP_MS);
  const jitterFactor = 0.5 + random();
  return Math.round(capped * jitterFactor);
}

/**
 * Inserisce un ascolto in coda.
 *
 * @returns `true` se la riga è stata inserita, `false` se l'evento era già in
 * coda per quell'hub (G-SH.1: la doppia enqueue è **ignorata**, non è un
 * errore — il caller non deve fallire per un doppio giro del ciclo).
 */
export async function enqueueScrobble(
  db: LifeSoundtrackDB,
  input: { hub: ScrobbleHubId; eventKey: string; payload: ScrobblePayload },
  now: number = Date.now(),
): Promise<boolean> {
  const idempotencyKey = scrobbleIdempotencyKey(input.hub, input.eventKey);
  const existing = await db.scrobbleOutbox.get(idempotencyKey);
  if (existing) {
    return false;
  }
  const row: ScrobbleOutboxRow = {
    idempotencyKey,
    hub: input.hub,
    eventKey: input.eventKey,
    payload: { ...input.payload, idempotencyKey },
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
    createdAt: now,
    sentAt: null,
  };
  try {
    await db.scrobbleOutbox.add(row);
  } catch {
    // Collissione sulla PK: un altro enqueue ha vinto la corsa. Non è un
    // errore (G-SH.1): l'evento è in coda una sola volta.
    return false;
  }
  return true;
}

/**
 * Claims un lotto di rigole pendenti per un hub e le porta in `in_flight`
 * (write-ahead, R-SH.5).
 *
 * Il ciclo è **seriale**: se c'è già una riga `in_flight` per quell'hub, non
 * viene claimato nulla — un solo invio in volo per hub.
 */
export async function claimScrobbles(
  db: LifeSoundtrackDB,
  hub: ScrobbleHubId,
  limit: number,
  now: number = Date.now(),
): Promise<ScrobbleOutboxRow[]> {
  return db.transaction('rw', db.scrobbleOutbox, async () => {
    const inFlight = await db.scrobbleOutbox
      .where('hub')
      .equals(hub)
      .filter((r) => r.status === 'in_flight')
      .first();
    if (inFlight) {
      return [];
    }
    const candidates = await db.scrobbleOutbox
      .where('hub')
      .equals(hub)
      .filter((r) => r.status === 'pending' && r.nextAttemptAt <= now)
      .sortBy('createdAt');
    const claimed = candidates.slice(0, Math.max(0, limit));
    for (const row of claimed) {
      await db.scrobbleOutbox.update(row.idempotencyKey, {
        status: 'in_flight',
        attempts: row.attempts + 1,
      });
    }
    return claimed.map((row) => ({
      ...row,
      status: 'in_flight' as const,
      attempts: row.attempts + 1,
    }));
  });
}

/** Segna una riga come inviata e confermata dall'hub. */
export async function markScrobbleSent(
  db: LifeSoundtrackDB,
  idempotencyKey: string,
  now: number = Date.now(),
): Promise<void> {
  await db.scrobbleOutbox.update(idempotencyKey, {
    status: 'sent',
    sentAt: now,
    lastError: null,
  });
}

/**
 * Registra un fallimento sulla riga.
 *
 * - errore **recuperabile** e tentativi < 5 → torna `pending` con backoff
 *   esponenziale (R-SH.1, R-SH.2);
 * - errore **terminale** (token scaduto, firma non valida, payload rifiutato) →
 *   `failed` subito: ritentare produrrebbe lo stesso errore e consumerebbe
 *   quota (R-SH.3);
 * - tentativi esauriti → `failed` (R-SH.2).
 *
 * `retryAfterMs` è il `X-RateLimit-Reset-In` di ListenBrainz, quando presente:
 * il backoff **deve** rispettarlo (R-SH.4).
 */
export async function markScrobbleFailed(
  db: LifeSoundtrackDB,
  idempotencyKey: string,
  error: Pick<ScrobbleError, 'code' | 'message' | 'recoverable'>,
  options: { now?: number; retryAfterMs?: number; random?: () => number } = {},
): Promise<void> {
  const now = options.now ?? Date.now();
  const row = await db.scrobbleOutbox.get(idempotencyKey);
  if (!row) {
    return;
  }
  const lastError: ScrobbleOutboxError = {
    code: error.code,
    message: error.message,
    recoverable: error.recoverable,
  };
  const canRetry = error.recoverable && row.attempts < SCROBBLE_MAX_ATTEMPTS;
  if (!canRetry) {
    await db.scrobbleOutbox.update(idempotencyKey, { status: 'failed', lastError });
    return;
  }
  const delay =
    options.retryAfterMs !== undefined
      ? options.retryAfterMs
      : computeRetryDelayMs(row.attempts, options.random ?? Math.random);
  await db.scrobbleOutbox.update(idempotencyKey, {
    status: 'pending',
    lastError,
    nextAttemptAt: now + delay,
  });
}

/**
 * Svuota la coda di un hub: le righe `pending` e `in_flight` passano a
 * `dropped` (P-SH.4, revoca del consenso).
 *
 * I dati locali (`listens`) **non** vengono toccati: revocare il consenso
 * all'invio non cancella lo storico locale.
 *
 * @returns numero di righe svuotate.
 */
export async function purgeScrobbleQueue(
  db: LifeSoundtrackDB,
  hub: ScrobbleHubId,
): Promise<number> {
  return db.transaction('rw', db.scrobbleOutbox, async () => {
    const rows = await db.scrobbleOutbox.where('hub').equals(hub).toArray();
    const toDrop = rows.filter((r) => r.status === 'pending' || r.status === 'in_flight');
    for (const row of toDrop) {
      await db.scrobbleOutbox.update(row.idempotencyKey, { status: 'dropped' });
    }
    return toDrop.length;
  });
}

/**
 * Righe rimaste `in_flight` dopo un crash (E.SH.6).
 *
 * Non vengono ritentate in automatico: il caso residuo dichiarato è un
 * **doppio scrobble** possibile, mai una perdita. Sono un avviso per l'utente,
 * che decide (e può rilasciarle con `releaseStuckScrobbles`).
 */
export async function listStuckScrobbles(
  db: LifeSoundtrackDB,
  hub: ScrobbleHubId,
): Promise<ScrobbleOutboxRow[]> {
  return db.scrobbleOutbox
    .where('hub')
    .equals(hub)
    .filter((r) => r.status === 'in_flight')
    .toArray();
}

/**
 * Rilascia le righe `in_flight` bloccate da un crash, tornando `pending`.
 *
 * È un'azione **esplicita** dell'utente: ritentare può produrre un doppio
 * scrobble (E.SH.6, G-SH.2 — mai una perdita).
 */
export async function releaseStuckScrobbles(
  db: LifeSoundtrackDB,
  hub: ScrobbleHubId,
  now: number = Date.now(),
): Promise<number> {
  const stuck = await listStuckScrobbles(db, hub);
  for (const row of stuck) {
    await db.scrobbleOutbox.update(row.idempotencyKey, {
      status: 'pending',
      nextAttemptAt: now,
    });
  }
  return stuck.length;
}

/** Righe della coda, per hub o tutte (ordine FIFO per `createdAt`). */
export async function listScrobbleQueue(
  db: LifeSoundtrackDB,
  hub?: ScrobbleHubId,
): Promise<ScrobbleOutboxRow[]> {
  const rows =
    hub === undefined
      ? await db.scrobbleOutbox.toArray()
      : await db.scrobbleOutbox.where('hub').equals(hub).toArray();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

/** Conteggio delle righe per stato (per hub o complessivo). */
export async function countScrobbleQueue(
  db: LifeSoundtrackDB,
  hub?: ScrobbleHubId,
): Promise<Record<ScrobbleOutboxStatus, number>> {
  const counts: Record<ScrobbleOutboxStatus, number> = {
    pending: 0,
    in_flight: 0,
    sent: 0,
    failed: 0,
    dropped: 0,
  };
  const rows = await listScrobbleQueue(db, hub);
  for (const row of rows) {
    counts[row.status] += 1;
  }
  return counts;
}
