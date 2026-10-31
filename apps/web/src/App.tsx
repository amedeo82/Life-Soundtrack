import { useEffect, useState } from 'react';
import { AppShell } from './screens/AppShell';
import { OnboardingRouter } from './onboarding/OnboardingRouter';
import { countListens, openDb } from '@core/db';
import './onboarding/onboarding.css';

/**
 * Radice dell'app — Story 3.1.
 *
 * La scelta fra **onboarding** e **app** è legata ai **dati**, non a un flag:
 * se il database contiene ascolti l'utente ha già importato e l'app si apre
 * su Home (⑥); altrimenti parte l'onboarding. Un flag in `localStorage`
 * mentirebbe dopo una cancellazione dei dati o un import su un altro
 * dispositivo.
 */
export function App() {
  const [mode, setMode] = useState<'checking' | 'onboarding' | 'app'>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const db = await openDb();
        const listens = await countListens(db);
        if (!cancelled) setMode(listens > 0 ? 'app' : 'onboarding');
      } catch {
        if (!cancelled) setMode('onboarding');
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === 'checking') {
    return <main className="onboarding-shell" aria-busy="true" />;
  }

  if (mode === 'app') {
    return <AppShell />;
  }

  return <OnboardingRouter onComplete={() => setMode('app')} />;
}
