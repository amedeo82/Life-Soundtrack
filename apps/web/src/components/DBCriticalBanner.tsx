/**
 * Banner persistente mostrato quando il DB è in stato critico
 * (read-only mode, 05-ARCHITECTURE.md §5).
 *
 * Espone:
 *   - messaggio dell'errore di fastCheck
 *   - pulsante "Riprova" (ri-esegue fastCheck + quotaCheck)
 *   - pulsante "Ripristina SW" (rollback del service worker, §11.4)
 *
 * Spec: `05-ARCHITECTURE.md §5 read-only mode`, `§11.4` rollback SW,
 * `11-BACKLOG.md Story 0.7 T0.7.4 / T0.7.5`.
 */
import { useCallback } from 'react';
import { Button } from '@ui/Button';
import { rollbackServiceWorker } from '../lib/swRollback';
import { useT } from '../i18n/useT';

export interface DBCriticalBannerProps {
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly onRollback: () => void;
}

export function DBCriticalBanner({ error, onRetry, onRollback }: DBCriticalBannerProps) {
  const t = useT();

  const handleRollback = useCallback(async () => {
    const ok = await rollbackServiceWorker();
    if (ok) {
      void onRollback();
    }
  }, [onRollback]);

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="db-critical-banner"
      style={{
        position: 'fixed',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 'min(560px, calc(100vw - 2rem))',
        padding: '1rem 1.25rem',
        borderRadius: '0.75rem',
        background: 'rgba(190, 30, 45, 0.95)',
        color: '#FFFFFF',
        boxShadow: '0 0 24px rgba(190, 30, 45, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        zIndex: 3000,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{t('error.dbCritical')}</h2>
      {error && <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.9 }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button
          label={t('settings.maintenance.retryButton')}
          onClick={onRetry}
          data-testid="db-critical-retry"
        />
        <Button
          label={t('settings.maintenance.rollbackButton')}
          variant="ghost"
          onClick={handleRollback}
          data-testid="db-critical-rollback"
        />
      </div>
    </div>
  );
}
