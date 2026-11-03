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
import { Memories } from './Memories';
import { useHomeTimelineData } from '../hooks/useHomeTimelineData';
import { granularityForSpan, type Granularity } from './homeTimelineModel';

/**
 * Le schermate raggiungibili dalla shell.
 *
 * La navigazione è a **stato**, senza librerie di routing (D-25.1): il
 * progetto non ha un router e non ne ha bisogno. Le schermate della Story
 * 3.3 (Esplora, Analisi) arriveranno con la loro.
 */
export type AppSection = 'home' | 'timeline' | 'memories';

/**
 * Il contesto da passare a un'altra schermata (D-25.1).
 *
 * È il deep-link **interno**: l'utente clicca un punto e la Timeline mette
 * in evidenza l'era o il periodo. Non c'è un URL: c'è uno stato.
 */
export interface AppFocus {
  /** Che cosa è evidenziato. */
  readonly kind: 'era' | 'track' | 'period';
  /** L'id dell'oggetto (l'id dell'era, per esempio). */
  readonly id: string;
  /** Il timestamp UTC del periodo. */
  readonly at: number;
}

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
        <button
          type="button"
          className="app-shell__nav-item"
          aria-current={section === 'memories' ? 'page' : undefined}
          data-testid="nav-memories"
          onClick={() => setSection('memories')}
        >
          {t('nav.memories')}
        </button>
      </nav>

      {section === 'home' ? (
        <Home
          state={data.state === 'error' ? 'loading' : data.state}
          stats={data.stats}
          barWeek={data.barWeek}
          memory={data.memory}
          weekMoodLabel={data.weekMoodLabel}
        />
      ) : section === 'timeline' ? (
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
      ) : (
        <Memories />
      )}
    </div>
  );
}
