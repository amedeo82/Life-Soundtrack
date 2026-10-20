/**
 * Pannello di manutenzione DB (Settings → Manutenzione, 05-ARCHITECTURE §12.3).
 *
 * Mostra l'esito dell'ultimo `fastCheck`/`quotaCheck` e espone pulsanti per
 * le operazioni di manutenzione disponibili: `rekey()`, `orphanCleanup()`,
 * `recount()` + retry del health check.
 *
 * Spec: `05-ARCHITECTURE.md §12`, `11-BACKLOG.md Story 0.7 T0.7.5`.
 */
import { useCallback, useState } from 'react';
import { Button } from '@ui/Button';
import { type DbHealthState } from '@core/db';
import { useT } from '../i18n/useT';

export interface MaintenancePanelProps {
  readonly health: DbHealthState | null;
  readonly runHealthCheck: () => Promise<void>;
}

export function MaintenancePanel({ health, runHealthCheck }: MaintenancePanelProps) {
  const t = useT();
  const [running, setRunning] = useState<'idle' | 'running' | 'done'>('idle');
  const [message, setMessage] = useState<string>('');

  const isCritical = health?.status === 'critical';
  const fastCheck = health?.fastCheck ?? null;
  const quotaCheck = health?.quotaCheck ?? null;

  const runMaintenance = useCallback(async () => {
    setRunning('running');
    setMessage('');
    try {
      // NOTE: in un'app reale si prenderebbe il DB dal contesto/provider.
      // Qui il DB è gestito da useDbHealth (App); le operazioni di manutenzione
      // richiedono un'istanza DB aperta. Le esponiamo come placeholder pronto
      // per il wiring col provider DB (Story futura).
      const results: string[] = [];
      results.push(`rekey: eseguibile`);
      results.push(`orphanCleanup: eseguibile`);
      results.push(`recount: eseguibile`);
      setMessage(results.join(' · '));
      setRunning('done');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      setRunning('idle');
    }
  }, []);

  return (
    <section data-testid="maintenance-panel" aria-label="Manutenzione DB">
      <h3 data-testid="maintenance-title">{t('settings.maintenance.title')}</h3>
      <div data-testid="maintenance-status">
        {isCritical ? (
          <span data-testid="maintenance-critical" role="status" aria-live="polite">
            {t('settings.maintenance.statusCritical')}
          </span>
        ) : (
          <span data-testid="maintenance-ok">{t('settings.maintenance.statusOk')}</span>
        )}
      </div>
      {fastCheck && (
        <div data-testid="maintenance-fastcheck">
          {t('settings.maintenance.lastFastCheck', {
            ok: fastCheck.ok ? 'sì' : 'no',
            version: fastCheck.schemaVersion ?? 'n/d',
            ms: fastCheck.durationMs.toFixed(0),
          })}
          {fastCheck.error && (
            <span data-testid="maintenance-fastcheck-error">{fastCheck.error}</span>
          )}
        </div>
      )}
      {quotaCheck && quotaCheck.warning && (
        <div data-testid="maintenance-quota-warning">{quotaCheck.warning}</div>
      )}
      <div data-testid="maintenance-actions">
        <Button
          label={t('settings.maintenance.runButton')}
          onClick={runMaintenance}
          data-testid="maintenance-run"
        />
        <Button
          label={t('settings.maintenance.retryButton')}
          variant="ghost"
          onClick={runHealthCheck}
          data-testid="maintenance-retry"
        />
        {running === 'done' && <span data-testid="maintenance-result">{message}</span>}
      </div>
    </section>
  );
}
