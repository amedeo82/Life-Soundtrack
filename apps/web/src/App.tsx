import { PLATFORM_IDS } from '@core/schema';
import { Button } from '@ui/Button';

export function App() {
  return (
    <main className="app-shell">
      <h1>Life-Soundtrack</h1>
      <p data-testid="platforms">Piattaforme: {PLATFORM_IDS.join(' · ')}</p>
      <Button label="Placeholder" />
    </main>
  );
}
