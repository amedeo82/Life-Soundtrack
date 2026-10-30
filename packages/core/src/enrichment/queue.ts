/**
 * La coda di arricchimento e i suoi trigger —
 * `21-AUDIO-FEATURES.md` v1.0 🟢 §5.2, §5.3 (D-AF.7).
 *
 * I tre trigger di `05§6.1` (APPROVED):
 *
 * | Trigger      | Quando                              | Comportamento                    |
 * |--------------|-------------------------------------|----------------------------------|
 * | `on-import`  | a import committato                 | **accoda**, non eseguire          |
 * | `on-demand`  | l'utente apre una vista di analisi  | refresh lazy delle feature mancanti |
 * | `scheduled`  | idle (`requestIdleCallback`)        | backfill in batch                 |
 *
 * Regole comuni, applicate dalla coda:
 *
 * - **mai bloccante**: `enqueue` non attende la rete, `run` gira a parte;
 * - **concurrency 1**: un brano alla volta;
 * - **budget 5 min/giorno**: il job interrotto riprende al trigger
 *   successivo (è idempotente);
 * - **interrompibile**: `stop()` fa smettere la coda al brano successivo, e
 *   la feature **parziale** non viene scritta (la cascata scrive solo
 *   feature complete);
 * - **coda per brano** (E9): due trigger sullo stesso brano producono una
 *   sola coda.
 */

import type { EnrichmentCascade, EnrichmentRequest } from './cascade';
import type { Clock, EnrichmentPolicy, EnrichmentTrigger, Logger, Sleep } from './types';

/** Il budget giornaliero della pipeline: 5 minuti (`05§6.1`). */
export const DEFAULT_DAILY_BUDGET_MS = 5 * 60 * 1000;

/** Il motivo per cui un run è terminato. */
export type EnrichmentStopReason = 'finished' | 'budget' | 'stopped' | 'toggle-off' | 'empty';

/** Il rapporto di un run della coda. */
export interface EnrichmentRunReport {
  /** Il trigger che ha avviato il run. */
  readonly trigger: EnrichmentTrigger;
  /** I brani elaborati. */
  readonly processed: number;
  /** I brani saltati (già in coda o già presenti in cache). */
  readonly skipped: number;
  /** I brani con esito "nessuna feature". */
  readonly withoutFeatures: number;
  /** Il motivo della fine del run. */
  readonly stoppedBy: EnrichmentStopReason;
  /** I millisecondi consumati dal run (budget). */
  readonly spentMs: number;
}

/** Opzioni della coda. */
export interface EnrichmentQueueOptions {
  /** La cascata. */
  readonly cascade: EnrichmentCascade;
  /** La politica (toggle `enrichMetadata`). */
  readonly policy: EnrichmentPolicy;
  /** L'orologio iniettato. */
  readonly clock: Clock;
  /** Il logger (opzionale). */
  readonly logger?: Logger;
  /** L'attesa iniettata (opzionale). */
  readonly sleep?: Sleep;
  /** Il budget giornaliero in ms (default 5 minuti). */
  readonly budgetMs?: number;
}

/** La coda di arricchimento. */
export interface EnrichmentQueue {
  /**
   * Accoda un brano.
   *
   * Non attende la rete e non esegue: è ciò che rende l'on-import non
   * bloccante (`21§5.2`).
   *
   * @param request - il brano e il suo contesto.
   * @param trigger - il trigger che ha generato la richiesta.
   * @returns true se il brano è stato accodato, false se era già in coda
   *   (E9) o se il toggle è spento.
   */
  enqueue(request: EnrichmentRequest, trigger: EnrichmentTrigger): Promise<boolean>;
  /**
   * Accoda più brani.
   *
   * @param requests - i brani e il loro contesto.
   * @param trigger - il trigger che ha generato le richieste.
   * @returns il numero di brani accodati.
   */
  enqueueMany(requests: readonly EnrichmentRequest[], trigger: EnrichmentTrigger): Promise<number>;
  /**
   * Svuota la coda (senza eseguire).
   *
   * @returns il numero di brani rimossi dalla coda.
   */
  clear(): number;
  /** Il numero di brani in coda. */
  size(): number;
  /**
   * Esegue la coda.
   *
   * @param trigger - il trigger che ha avviato il run.
   * @returns il rapporto del run.
   */
  run(trigger: EnrichmentTrigger): Promise<EnrichmentRunReport>;
  /** Interrompe il run in corso (al brano successivo). */
  stop(): void;
  /** Azzera il budget giornaliero (usato dai test e dal cambio di giorno). */
  resetBudget(): void;
}

/**
 * La chiave del giorno (UTC) in cui il budget è stato consumato.
 *
 * @param now - l'orologio corrente (unix ms).
 * @returns la chiave `YYYY-MM-DD`.
 */
export function budgetDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Crea la coda di arricchimento.
 *
 * @param options - le dipendenze iniettate.
 * @returns la coda.
 */
export function createEnrichmentQueue(options: EnrichmentQueueOptions): EnrichmentQueue {
  const { cascade, policy, clock, logger } = options;
  const budgetMs = options.budgetMs ?? DEFAULT_DAILY_BUDGET_MS;

  const pending: EnrichmentRequest[] = [];
  const queuedIds = new Set<string>();
  let stopped = false;
  let budgetDay: string | null = null;
  let budgetSpent = 0;

  const resetBudgetIfNewDay = (now: number): void => {
    const key = budgetDayKey(now);
    if (budgetDay !== key) {
      budgetDay = key;
      budgetSpent = 0;
    }
  };

  const enqueue = async (
    request: EnrichmentRequest,
    trigger: EnrichmentTrigger,
  ): Promise<boolean> => {
    if (queuedIds.has(request.track.id)) {
      logger?.debug('arricchimento: brano già in coda', {
        trackId: request.track.id,
        trigger,
      });
      return false;
    }
    if (!(await policy.isEnabled())) {
      logger?.debug('arricchimento: toggle spento, richiesta scartata', {
        trackId: request.track.id,
        trigger,
      });
      return false;
    }
    queuedIds.add(request.track.id);
    pending.push(request);
    return true;
  };

  const run = async (trigger: EnrichmentTrigger): Promise<EnrichmentRunReport> => {
    stopped = false;
    const startedAt = clock.now();
    resetBudgetIfNewDay(startedAt);

    let processed = 0;
    let skipped = 0;
    let withoutFeatures = 0;
    let stoppedBy: EnrichmentStopReason = pending.length === 0 ? 'empty' : 'finished';

    while (pending.length > 0) {
      if (stopped) {
        stoppedBy = 'stopped';
        break;
      }
      if (budgetSpent >= budgetMs) {
        stoppedBy = 'budget';
        break;
      }
      if (!(await policy.isEnabled())) {
        // E11: il toggle passa da ON a OFF a pipeline in corso ⇒ il job
        // si ferma al prossimo brano, nessuna nuova uscita di rete.
        stoppedBy = 'toggle-off';
        break;
      }

      const request = pending.shift();
      if (request === undefined) break;
      queuedIds.delete(request.track.id);

      const before = clock.now();
      const outcome = await cascade.enrich(request.track, request.context);
      budgetSpent += Math.max(0, clock.now() - before);

      if (outcome.feature !== null) {
        processed += 1;
      } else if (outcome.status === 'disabled') {
        stoppedBy = 'toggle-off';
        break;
      } else {
        withoutFeatures += 1;
        skipped += 1;
      }
    }

    const report: EnrichmentRunReport = {
      trigger,
      processed,
      skipped,
      withoutFeatures,
      stoppedBy,
      spentMs: Math.max(0, clock.now() - startedAt),
    };
    logger?.debug('arricchimento: run terminato', {
      trigger,
      processed: report.processed,
      withoutFeatures: report.withoutFeatures,
      stoppedBy: report.stoppedBy,
    });
    return report;
  };

  return {
    enqueue,

    async enqueueMany(
      requests: readonly EnrichmentRequest[],
      trigger: EnrichmentTrigger,
    ): Promise<number> {
      let added = 0;
      for (const request of requests) {
        if (await enqueue(request, trigger)) added += 1;
      }
      return added;
    },

    clear(): number {
      const removed = pending.length;
      pending.length = 0;
      queuedIds.clear();
      return removed;
    },

    size(): number {
      return pending.length;
    },

    run,

    stop(): void {
      stopped = true;
    },

    resetBudget(): void {
      budgetDay = null;
      budgetSpent = 0;
    },
  };
}
