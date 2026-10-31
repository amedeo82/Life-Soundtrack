import type { LifeSoundtrackDB } from './db';
import { createLogger, type Logger } from '../logger';

const log: Logger = createLogger('db:health');

/**
 * Esito di `fastCheck()`: smoke test eseguito ad ogni boot.
 * `ok` false -> l'app entra in read-only mode (05-ARCHITECTURE.md §5, §12.1).
 */
export interface FastCheckResult {
  ok: boolean;
  /** Versione schema corrente del DB (da `db.verno`). */
  schemaVersion: number | null;
  /** Errore se `ok` è false. */
  error: string | null;
  /** Durata del check in ms. */
  durationMs: number;
}

/**
 * Esito di `quotaCheck()`: stima dello spazio IndexedDB.
 */
export interface QuotaCheckResult {
  ok: boolean;
  /** Quota stimata in byte (se disponibile). */
  quota: number | null;
  /** Uso stimato in byte (se disponibile). */
  usage: number | null;
  /** Percentuale di riempimento (0..1) se entrambe disponibili. */
  fillRatio: number | null;
  /** Warning se > 80%. */
  warning: string | null;
}

/**
 * Smoke test del DB locale eseguito ad ogni boot (05-ARCHITECTURE.md §12.1 `fastCheck`).
 * Verifica: DB apribile, schema version corretto (>= atteso), indici funzionanti.
 * Non modifica dati. In caso di failure l'app deve entrare in read-only mode +
 * banner persistente (gestito dal chiamante, es. `useDbHealth`).
 *
 * @param expectedSchemaVersion versione schema attesa (build-time, es. 6).
 */
export async function fastCheck(
  db: LifeSoundtrackDB,
  expectedSchemaVersion: number = 6,
): Promise<FastCheckResult> {
  const t0 = performance.now();
  try {
    // 1. DB apribile (già aperto dal chiamante, ma verifichiamo isOpen).
    if (!db.isOpen()) {
      return { ok: false, schemaVersion: null, error: 'DB non aperto', durationMs: 0 };
    }

    // 2. Schema version corretto.
    const verno = db.verno;
    if (verno < expectedSchemaVersion) {
      return {
        ok: false,
        schemaVersion: verno,
        error: `Schema versione ${verno} < attesa ${expectedSchemaVersion}: serve migrazione`,
        durationMs: Number(performance.now() - t0),
      };
    }

    // 3. Indici funzionanti: query banale su ogni tabella principale.
    await db.listens.limit(1).toArray();
    await db.tracks.limit(1).toArray();
    await db.artists.limit(1).toArray();

    log.info('fastCheck superato', {
      schemaVersion: verno,
      durationMs: Number(performance.now() - t0),
    });

    return {
      ok: true,
      schemaVersion: verno,
      error: null,
      durationMs: Number(performance.now() - t0),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('fastCheck fallito', { error: message, durationMs: Number(performance.now() - t0) });
    return {
      ok: false,
      schemaVersion: null,
      error: message,
      durationMs: Number(performance.now() - t0),
    };
  }
}

/**
 * Controllo quota IndexedDB (05-ARCHITECTURE.md §12.1 `quotaCheck`).
 * Eseguito settimanalmente o su richiesta dell'operatore.
 * Avvisa se il riempimento supera l'80%.
 */
export async function quotaCheck(): Promise<QuotaCheckResult> {
  const estimate =
    typeof navigator !== 'undefined' && 'storage' in navigator
      ? await navigator.storage.estimate()
      : null;

  if (!estimate) {
    return { ok: true, quota: null, usage: null, fillRatio: null, warning: null };
  }

  const { quota, usage } = estimate;
  const quotaNum = quota ?? null;
  const usageNum = usage ?? null;
  const fillRatio = quotaNum && quotaNum > 0 ? usageNum! / quotaNum : null;
  const warning =
    fillRatio !== null && fillRatio > 0.8
      ? `Spazio IndexedDB in esaurimento: ${Math.round(fillRatio * 100)}% utilizzato`
      : null;

  log.info('quotaCheck', { quota: quotaNum, usage: usageNum, fillRatio, warning });

  return {
    ok: warning === null,
    quota: quotaNum,
    usage: usageNum,
    fillRatio,
    warning,
  };
}

/**
 * Esegue fastCheck + quotaCheck in sequenza e restituisce lo stato aggregato.
 * Usato da `useDbHealth` per esporre un unico punto di verità all'UI.
 */
export interface DbHealthState {
  fastCheck: FastCheckResult | null;
  quotaCheck: QuotaCheckResult | null;
  status: 'ok' | 'critical';
}

export async function runHealthCheck(
  db: LifeSoundtrackDB,
  expectedSchemaVersion: number = 6,
): Promise<DbHealthState> {
  const [fast, quota] = await Promise.all([fastCheck(db, expectedSchemaVersion), quotaCheck()]);

  return {
    fastCheck: fast,
    quotaCheck: quota,
    status: fast.ok && quota.ok ? 'ok' : 'critical',
  };
}
