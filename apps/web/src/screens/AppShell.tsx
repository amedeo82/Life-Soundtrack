/**
 * Shell dell'app — Story 3.1.
 *
 * La prima navigazione dell'app: Home (⑥) e Timeline (⑦), con una
 * **NavBar** su desktop e una **TabBar** su mobile (`15-DESIGN-SYSTEM.md` §5,
 * `15§10`). Le altre schermate (⑧ dettaglio era, ⑨ esplora, ⑩ analisi,
 * ⑪ ricordi) sono delle Story 3.2 e 3.3: qui ci sono solo le due che esistono.
 *
 * I dati arrivano da `useHomeTimelineData`, l'unico punto che conosce il
 * database: la shell non sa nulla di Dexie.
 */

import { useState } from 'react';
import { useT } from '../i18n';
import { Home } from './Home';
import { Timeline } from './Timeline';
import { useHomeTimelineData } from '../hooks/useHomeTimelineData';
import { granularityForSpan, type Granularity } from './homeTimelineModel';

/** Le schermate raggiungibili dalla shell. */
export type AppSection = 'home' | 'timeline';

export function AppShell() {
  const t = useT();
  const [section, setSection] = useState<AppSection>('home');
  // `null` = l'utente non ha ancora scelto: la granularità segue la durata
  // della storia (una vita lunga si legge per anni, poche settimane per giorni).
  const [chosen, setChosen] = useState<Granularity | null>(null);
  const data = useHomeTimelineData(chosen ?? 'months');

  const granularity: Granularity =
    chosen ?? (data.range ? granularityForSpan(data.range.end - data.range.start) : 'months');
  const visibleRange = data.range
    ? { start: data.range.start, end: data.range.end }
    : { start: Date.now() - 86_400_000, end: Date.now() };

  return (
    <div className="app-shell" data-testid="app-shell">
      <nav className="app-shell__nav" aria-label={t('nav.label')}>
        <button
          type="button"
          className="app-shell__nav-item"
          aria-current={section === 'home' ? 'page' : undefined}
          data-testid="nav-home"
          onClick={() => setSection('home')}
        >
          {t('nav.home')}
        </button>
        <button
          type="button"
          className="app-shell__nav-item"
          aria-current={section === 'timeline' ? 'page' : undefined}
          data-testid="nav-timeline"
          onClick={() => setSection('timeline')}
        >
          {t('nav.timeline')}
        </button>
      </nav>

      {section === 'home' ? (
        <Home
          state={data.state === 'error' ? 'loading' : data.state}
          stats={data.stats}
          barWeek={data.barWeek}
          memory={data.memory}
          weekMoodLabel={null}
        />
      ) : (
        <Timeline
          state={data.state === 'error' ? 'error' : data.state}
          granularity={granularity}
          volume={data.volume}
          mood={data.mood}
          eras={data.eras}
          contexts={data.contexts}
          visibleRange={visibleRange}
          onGranularityChange={setChosen}
        />
      )}
    </div>
  );
}
