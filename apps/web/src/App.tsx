import { PLATFORM_IDS } from '@core/schema';
import { Button } from '@ui/Button';
import { useEffect, useState } from 'react';
import { useAppUpdate, formatSemver } from './hooks/useAppUpdate';
import { useDbHealth } from './hooks/useDbHealth';
import { UpdateBanner } from './components/UpdateBanner';
import { DBCriticalBanner } from './components/DBCriticalBanner';
import { MaintenancePanel } from './components/MaintenancePanel';
import {
  fetchVersionManifest,
  isBlockingUpdate,
  type VersionManifest,
} from './lib/versionManifest';

/**
 * Shell dell'app — Story 0.7:
 * - boot con `fastCheck` (read-only mode su failure, 05§5)
 * - Settings → Manutenzione (05§12.3) tramite `<MaintenancePanel>`
 * - prompt policy completa (05§11.3): major + migrazione DB → modal
 *   bloccante via `version.json` (`requiresDbMigration`)
 * - DBCriticalBanner persistente in caso di DB critico
 */
export function App() {
  const update = useAppUpdate();
  const health = useDbHealth();
  const [manifest, setManifest] = useState<VersionManifest | null>(null);

  // Il manifest serve a decidere se un update major è bloccante (migrazione
  // DB, 05§11.3/§11.4); in assenza si resta sul banner soft (default sicuro).
  useEffect(() => {
    let cancelled = false;
    void fetchVersionManifest().then((result) => {
      if (!cancelled) setManifest(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const requiresDbMigration =
    update.updateKind !== null &&
    health.dbOpen &&
    isBlockingUpdate(update.updateKind, health.fastCheck?.schemaVersion ?? null, manifest);

  if (health.status === 'critical') {
    return (
      <main className="app-shell">
        <h1>Life-Soundtrack</h1>
        <p data-testid="platforms">Piattaforme: {PLATFORM_IDS.join(' · ')}</p>
        <DBCriticalBanner
          error={health.fastCheck?.error ?? null}
          onRetry={() => {
            void health.runHealthCheck();
          }}
          onRollback={() => {
            void health.runHealthCheck();
          }}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1>Life-Soundtrack</h1>
      <p data-testid="platforms">Piattaforme: {PLATFORM_IDS.join(' · ')}</p>
      <Button label="Placeholder" />
      <MaintenancePanel health={health} runHealthCheck={health.runHealthCheck} />
      {update.needRefresh && update.updateKind && (
        <UpdateBanner
          updateKind={update.updateKind}
          nextVersionLabel={update.nextVersion ? formatSemver(update.nextVersion) : 'next'}
          currentVersionLabel={
            update.currentVersion ? formatSemver(update.currentVersion) : 'current'
          }
          onUpdate={update.update}
          onDismiss={update.dismiss}
          requiresDbMigration={requiresDbMigration}
        />
      )}
    </main>
  );
}
