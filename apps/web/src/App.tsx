import { PLATFORM_IDS } from '@core/schema';
import { Button } from '@ui/Button';
import { useAppUpdate, formatSemver } from './hooks/useAppUpdate';
import { UpdateBanner } from './components/UpdateBanner';

export function App() {
  const update = useAppUpdate();

  return (
    <main className="app-shell">
      <h1>Life-Soundtrack</h1>
      <p data-testid="platforms">Piattaforme: {PLATFORM_IDS.join(' · ')}</p>
      <Button label="Placeholder" />
      {update.needRefresh && update.updateKind && (
        <UpdateBanner
          updateKind={update.updateKind}
          nextVersionLabel={update.nextVersion ? formatSemver(update.nextVersion) : 'next'}
          currentVersionLabel={
            update.currentVersion ? formatSemver(update.currentVersion) : 'current'
          }
          onUpdate={update.update}
          onDismiss={update.dismiss}
          requiresDbMigration={false}
        />
      )}
    </main>
  );
}
