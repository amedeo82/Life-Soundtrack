/**
 * Shell dell'app — Story 3.1 (Home, Timeline, Ricordi) e Story 3.3
 * (Esplora, Analisi).
 *
 * La prima navigazione dell'app: Home (⑥), Timeline (⑦) e Ricordi (⑪), con
 * una **NavBar** su desktop e una **TabBar** su mobile (`15-DESIGN-SYSTEM.md`
 * §5, `15§10`). Dalla Story 3.3 ci sono anche Esplora (⑨) e Analisi (⑩).
 *
 * I dati arrivano da `useHomeTimelineData`, l'unico punto che conosce il
 * database: la shell non sa nulla di Dexie. Esplora e Analisi hanno i loro
 * hook (`useExploreData`, `useAnalysisData`), che leggono lo stesso
 * database locale.
 *
 * La navigazione è a **stato**, senza librerie di routing (D-25.1): il
 * progetto non ha un router e non ne ha bisogno. Il deep-link fra le
 * schermate è un contratto interno (`AppFocus`).
 */

import { useState } from 'react';
import { useT } from '../i18n';
import { Home } from './Home';
import { Timeline } from './Timeline';
import { Memories } from './Memories';
import { ExploreScreen } from './ExploreScreen';
import { AnalysisScreen } from './AnalysisScreen';
import { useHomeTimelineData } from '../hooks/useHomeTimelineData';
import { granularityForSpan, type Granularity } from './homeTimelineModel';
import type { AppFocus, AppSection } from './appNavigation';

export type { AppFocus, AppSection } from './appNavigation';

export interface AppShellProps {
  /**
   * Il database da leggere (default: quello dell'utente).
   *
   * La **demo** (Story 3.5) passa il nome del database demo: è un secondo
   * database Dexie, quindi il diario di esempio e la storia dell'utente non
   * possono mescolarsi (`26-ONBOARDING-DEMO.md` D-26.1).
   */
  readonly dbName?: string | undefined;
  /** La shell mostra il banner della demo? */
  readonly demo?: boolean | undefined;
  /** Chiusura della demo: il click che cancella il database demo. */
  readonly onExitDemo?: (() => void) | undefined;
}

export function AppShell({ dbName, demo, onExitDemo }: AppShellProps) {
  const t = useT();
  const [section, setSection] = useState<AppSection>('home');
  /**
   * Il contesto evidenziato nella Timeline: è il **deep-link interno**
   * (D-25.1). Un click su un punto dell'Analisi porta alla Timeline con il
   * periodo in evidenza.
   */
  const [focus, setFocus] = useState<AppFocus | null>(null);
  // `null` = l'utente non ha ancora scelto: la granularità segue la durata
  // della storia (una vita lunga si legge per anni, poche settimane per giorni).
  const [chosen, setChosen] = useState<Granularity | null>(null);
  const data = useHomeTimelineData(chosen ?? 'months', dbName);

  const granularity: Granularity =
    chosen ?? (data.range ? granularityForSpan(data.range.end - data.range.start) : 'months');
  const visibleRange = data.range
    ? { start: data.range.start, end: data.range.end }
    : { start: Date.now() - 86_400_000, end: Date.now() };

  /** Il deep-link: si cambia sezione e si tiene il contesto. */
  const goToFocus = (next: AppFocus) => {
    setFocus(next);
    setSection('timeline');
  };

  return (
    <div className="app-shell" data-testid="app-shell">
      {demo && (
        <div className="app-shell__demo" role="status" data-testid="demo-banner">
          <span className="app-shell__demo-text">{t('onboarding.demo.banner')}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onExitDemo?.();
            }}
            data-testid="demo-exit"
          >
            {t('onboarding.demo.exit')}
          </button>
        </div>
      )}

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
        <button
          type="button"
          className="app-shell__nav-item"
          aria-current={section === 'explore' ? 'page' : undefined}
          data-testid="nav-explore"
          onClick={() => setSection('explore')}
        >
          {t('nav.explore')}
        </button>
        <button
          type="button"
          className="app-shell__nav-item"
          aria-current={section === 'analysis' ? 'page' : undefined}
          data-testid="nav-analysis"
          onClick={() => setSection('analysis')}
        >
          {t('nav.analysis')}
        </button>
      </nav>

      {section === 'home' ? (
        <Home
          state={data.state === 'error' ? 'loading' : data.state}
          stats={data.stats}
          barWeek={data.barWeek}
          memory={data.memory}
          weekMoodLabel={data.weekMood ? t(`analysis.moods.${data.weekMood}`) : null}
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
          focus={focus}
          onGranularityChange={setChosen}
        />
      ) : section === 'memories' ? (
        <Memories dbName={dbName} />
      ) : section === 'explore' ? (
        <ExploreScreen dbName={dbName} onFocus={goToFocus} />
      ) : (
        <AnalysisScreen dbName={dbName} onFocus={goToFocus} />
      )}
    </div>
  );
}
