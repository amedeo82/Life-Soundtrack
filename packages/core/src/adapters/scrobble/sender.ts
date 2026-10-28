import type { LifeSoundtrackDB } from '../../db/db';
import { claimScrobbles, markScrobbleFailed, markScrobbleSent } from '../../db/scrobbleOutbox';
import { ScrobbleError } from './types';
import type { ScrobblePayload, ScrobbleSink } from './types';
import type { ScrobbleRetryAdvice } from '../listenbrainz/scrobble';

/**
 * Ciclo di invio della coda — `20-SCROBBLING-HUB.md` v1.0 §5, passi [4a]-[4d].
 *
 * Il ciclo è **seriale**: un solo invio in volo per hub (R-SH.5). Il
 * dimensionamento del lotto **non** è deciso qui: il core raggruppa le righe
 * in coda, il **sink** decide come trasformarle in richieste (V2 — i due hub
 * hanno limiti incompatibili: Last.fm 50 per richiesta, ListenBrainz 1000).
 */

/** Lotto predefinito di righe da mettere in volo per ciclo. */
export const SCROBBLE_DEFAULT_BATCH_SIZE = 50;

/** Esito di un ciclo di invio. */
export interface ScrobbleCycleSummary {
  /** Righe messe in `in_flight` (write-ahead). */
  claimed: number;
  /** Righe confermate dall'hub. */
  sent: number;
  /** Righe re-inviate più avanti (errore recuperabile). */
  retrying: number;
  /** Righe fallite in modo definitivo (errore terminale o tentativi esauriti). */
  failed: number;
}

/** Opzioni di un ciclo di invio. */
export interface ScrobbleCycleOptions {
  /** Istante di riferimento (unix ms). */
  now?: number;
  /** Numero massimo di righe per ciclo. */
  batchSize?: number;
  /** Cancellazione cooperativa. */
  signal?: AbortSignal;
}

/**
 * Esegue un ciclo di invio per un hub.
 *
 * Gli errori del sink **non** fanno fallire il ciclo: ogni riga claimata
 * viene registrata come `sent` o come `failed`/`pending`, e il ciclo prosegue.
 * Un errore di rete che fa perdere la coda sarebbe una perdita di dati
 * (G-SH.2).
 */
export async function runScrobbleCycle(
  db: LifeSoundtrackDB,
  sink: ScrobbleSink,
  options: ScrobbleCycleOptions = {},
): Promise<ScrobbleCycleSummary> {
  const now = options.now ?? Date.now();
  const summary: ScrobbleCycleSummary = { claimed: 0, sent: 0, retrying: 0, failed: 0 };

  const rows = await claimScrobbles(
    db,
    sink.hub,
    options.batchSize ?? SCROBBLE_DEFAULT_BATCH_SIZE,
    now,
  );
  summary.claimed = rows.length;
  if (rows.length === 0) {
    return summary;
  }

  const payloads: ScrobblePayload[] = rows.map((row) => row.payload);
  try {
    const result = await sink.submit(payloads, {
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const accepted = Math.min(result.accepted, rows.length);
    for (let index = 0; index < accepted; index += 1) {
      const row = rows[index];
      if (!row) {
        continue;
      }
      await markScrobbleSent(db, row.idempotencyKey, now);
      summary.sent += 1;
    }
    if (result.rejected > 0) {
      // Accept parziale (E.SH.9): l'hub ha rifiutato una parte del lotto. La
      // risposta non dice *quali* elementi, quindi si assume l'ordine FIFO del
      // lotto: i primi `accepted` sono confermati, gli altri no.
      for (let index = accepted; index < rows.length; index += 1) {
        const row = rows[index];
        if (!row) {
          continue;
        }
        await markScrobbleFailed(
          db,
          row.idempotencyKey,
          {
            code: 'PAYLOAD_REJECTED',
            message: "Hub ha rifiutato l'elemento (accettazione parziale)",
            recoverable: false,
          },
          { now },
        );
        summary.failed += 1;
      }
    }
  } catch (error) {
    const scrobbleError = toScrobbleError(error, sink);
    const retryAfterMs = readRetryAdvice(sink);
    for (const row of rows) {
      await markScrobbleFailed(db, row.idempotencyKey, scrobbleError, {
        now,
        ...(retryAfterMs !== null ? { retryAfterMs } : {}),
      });
      if (scrobbleError.recoverable) {
        summary.retrying += 1;
      } else {
        summary.failed += 1;
      }
    }
  }
  return summary;
}

/** Normalizza un errore del sink in `ScrobbleError`. */
function toScrobbleError(error: unknown, sink: ScrobbleSink): ScrobbleError {
  if (error instanceof ScrobbleError) {
    return error;
  }
  return new ScrobbleError('HUB_ERROR', error instanceof Error ? error.message : String(error), {
    recoverable: true,
    hub: sink.hub,
  });
}

/**
 * Delay di retry consigliato dal protocollo, se il sink lo espone (R-SH.4:
 * ListenBrainz comunica `X-RateLimit-Reset-In`).
 */
function readRetryAdvice(sink: ScrobbleSink): number | null {
  const advice = sink as ScrobbleSink & Partial<ScrobbleRetryAdvice>;
  if (typeof advice.retryDelayMs !== 'function') {
    return null;
  }
  return advice.retryDelayMs();
}
