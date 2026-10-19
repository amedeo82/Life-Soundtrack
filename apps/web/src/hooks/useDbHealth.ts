/**
 * Hook React per la salute del DB locale (05-ARCHITECTURE.md §5, §12.1).
 *
 * Esegue `fastCheck()` ad ogni boot: se il DB non è apribile, lo schema
 * è sotto la versione attesa o gli indici non funzionano, l'app entra in
 * **read-only mode** e il chiamante mostra `DBCriticalBanner`.
 *
 * Espone anche `quotaCheck()` (settimanale/su richiesta) e un comando
 * `runHealthCheck()` per ritentare il check (click "Riprova" nel banner).
 */
import { useCallback, useEffect, useState } from 'react';
import type { DbHealthState } from '@core/db';
import { openDb, runHealthCheck, type LifeSoundtrackDB } from '@core/db';

const EXPECTED_SCHEMA_VERSION = 3; // 02-DATA-SCHEMA.md §10 v1.2

export interface UseDbHealthResult extends DbHealthState {
  /** Ri-esegue fastCheck + quotaCheck (click "Riprova" nel banner). */
  runHealthCheck: () => Promise<void>;
  /** Il DB è aperto (anche se in critical). */
  readonly dbOpen: boolean;
}

export function useDbHealth(): UseDbHealthResult {
  const [health, setHealth] = useState<DbHealthState | null>(null);
  const [db, setDb] = useState<LifeSoundtrackDB | null>(null);
  const [dbOpen, setDbOpen] = useState(false);

  const doHealthCheck = useCallback(async () => {
    if (!db) return;
    const result = await runHealthCheck(db, EXPECTED_SCHEMA_VERSION);
    setHealth(result);
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const database = await openDb();
        if (cancelled) {
          await database.close();
          return;
        }
        setDb(database);
        setDbOpen(true);
        await doHealthCheck();
      } catch (err) {
        if (cancelled) return;
        setDbOpen(false);
        setHealth({
          fastCheck: {
            ok: false,
            schemaVersion: null,
            error: err instanceof Error ? err.message : String(err),
            durationMs: 0,
          },
          quotaCheck: null,
          status: 'critical',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doHealthCheck]);

  return {
    fastCheck: health?.fastCheck ?? null,
    quotaCheck: health?.quotaCheck ?? null,
    status: health?.status ?? (dbOpen ? 'ok' : 'ok'),
    dbOpen,
    runHealthCheck: doHealthCheck,
  };
}
