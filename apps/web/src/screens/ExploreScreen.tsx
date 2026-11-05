/**
 * La schermata Esplora (⑨) — Story 3.3, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §6 e `docs/06-UX-FLOWS-STATES.md` §2.9.
 *
 * La ricerca nel **proprio** catalogo: artisti, brani, album, generi e i
 * periodi per mood. Nessuna rete, nessun indice globale (`06§2.9`): il
 * percorso è interamente locale.
 *
 * La ricerca ha un **debounce di 300 ms** e i risultati sono ordinati per
 * `listenCount` decrescente: prima gli artisti più ascoltati, poi gli altri.
 */

import { useMemo, useState, type ReactElement } from 'react';
import { useT } from '../i18n';
import { SearchField } from '../components/SearchField';
import { useExploreData } from '../hooks/useExploreData';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { EXPLORE_TABS, exploreResults, type ExploreResult, type ExploreTab } from './exploreModel';
import type { AppFocus } from './appNavigation';
import type { MoodId } from '@core/schema';

export interface ExploreScreenProps {
  /** Il database da leggere (iniettabile solo per i test). */
  readonly dbName?: string | undefined;
  /** Il deep-link interno: il click su un periodo porta alla Timeline. */
  readonly onFocus?: ((focus: AppFocus) => void) | undefined;
}

/** I sei mood (i template `analysis.moods.*` esistono già). */
const MOODS: readonly MoodId[] = ['sad', 'angry', 'neutral', 'calm', 'happy', 'excited'];

export function ExploreScreen({ dbName, onFocus }: ExploreScreenProps): ReactElement {
  const t = useT();
  const data = useExploreData(dbName);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ExploreTab>('artists');
  const [mood, setMood] = useState<MoodId | null>(null);
  // Il debounce sta sulla *ricerca*, non sul testo scritto: il campo resta
  // immediatamente reattivo, i risultati arrivano 300 ms dopo l'ultimo tasto.
  const debouncedQuery = useDebouncedValue(query);

  const results = useMemo(
    () => exploreResults(tab, data.catalog, data.periods, debouncedQuery, mood),
    [tab, data.catalog, data.periods, debouncedQuery, mood],
  );

  /** Il titolo del risultato: per il tab Mood è il mood tradotto. */
  const titleOf = (result: ExploreResult): string =>
    result.kind === 'mood' && result.mood ? t(`analysis.moods.${result.mood}`) : result.title;

  return (
    <section className="explore" data-testid="explore-screen">
      <h2 className="explore__title">{t('explore.title')}</h2>

      <SearchField
        value={query}
        onChange={setQuery}
        label={t('explore.search')}
        placeholder={t('explore.search')}
        fieldId="explore-search"
      />

      <div className="explore__tabs" role="group" aria-label={t('explore.title')}>
        {EXPLORE_TABS.map((option) => (
          <button
            key={option}
            type="button"
            className="btn btn-ghost"
            aria-pressed={option === tab}
            data-testid={`explore-tab-${option}`}
            onClick={() => {
              setTab(option);
            }}
          >
            {t(`explore.tab.${option}`)}
          </button>
        ))}
      </div>

      {tab === 'mood' && (
        <div className="explore__moods" role="group" aria-label={t('explore.tab.mood')}>
          {MOODS.map((option) => (
            <button
              key={option}
              type="button"
              className="mood-pill"
              aria-pressed={option === mood}
              data-testid={`explore-mood-${option}`}
              onClick={() => {
                setMood((current) => (current === option ? null : option));
              }}
            >
              {t(`analysis.moods.${option}`)}
            </button>
          ))}
        </div>
      )}

      {data.state === 'loading' && (
        <p className="explore__status" role="status" data-testid="explore-loading">
          {t('explore.search')}
        </p>
      )}

      {data.state === 'error' && (
        <p className="explore__status" role="alert" data-testid="explore-error">
          {t('error.generic')}
        </p>
      )}

      {data.state === 'empty' && (
        <p className="explore__status" data-testid="explore-empty">
          {t('empty.description.explore')}
        </p>
      )}

      {data.state === 'ready' && results.length === 0 && (
        <p className="explore__status" data-testid="explore-no-results">
          {t('explore.noResults', { query: debouncedQuery })}
        </p>
      )}

      <ul className="explore__results" data-testid="explore-results">
        {results.map((result) => (
          <li key={`${result.kind}-${result.id}`}>
            <button
              type="button"
              className="explore__result"
              data-testid={`explore-result-${result.id}`}
              onClick={() => {
                if (result.kind === 'mood' && result.at !== null) {
                  onFocus?.({ kind: 'period', id: result.id, at: result.at });
                }
              }}
            >
              <span className="explore__result-title">{titleOf(result)}</span>
              {result.subtitle && (
                <span className="explore__result-subtitle">{result.subtitle}</span>
              )}
              <span className="explore__result-count" data-testid={`explore-count-${result.id}`}>
                {t('explore.listens', { count: result.listenCount })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
