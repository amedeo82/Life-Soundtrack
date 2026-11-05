/**
 * Timeline (⑦) — Story 3.1, spec `docs/06-UX-FLOWS-STATES.md` §2.7.
 *
 * La schermata centrale dell'app: le `EraBand` in cima, lo `StreamChart` del
 * volume e la `MoodLine` del mood, sincronizzati, con il **nastro contesto**
 * (Story 3.4) sotto le bande.
 *
 * **La sincronizzazione è un estado condiviso**, non un effetto locale: il
 * hover su un'EraBand evidenzia il bucket corrispondente nei due grafici, e
 * il hover su un punto evidenzia l'era che lo contiene (`06§2.7`).
 *
 * Il **toggle di granularità** (Anni/Mesi/Settimane/Giorni) cambia il bucket
 * dei dati: il cambio è un passaggio di prop dal chiamante, non uno stato
 * nascosto, così il chiamante decide anche dove ricalcolare.
 */

import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { EraBand } from '../components/EraBand';
import { MoodLine } from '../components/MoodLine';
import { StreamChart } from '../components/StreamChart';
import { ContextRibbon } from '../components/ContextRibbon';
import type { ContextRibbonPeriod } from '../components/contextRibbonModel';
import {
  GRANULARITIES,
  type EraBandModel,
  type Granularity,
  type SeriesPoint,
  type VisibleRange,
} from './homeTimelineModel';
import type { AppFocus } from './appNavigation';

/** Stati della Timeline (`06§2.7`). */
export type TimelineState = 'empty' | 'no-features' | 'partial' | 'loading' | 'ready' | 'error';

export interface TimelineProps {
  state: TimelineState;
  /** Granularità attiva dei bucket. */
  granularity: Granularity;
  /** Serie del volume (minuti per bucket). */
  volume: readonly SeriesPoint[];
  /** Serie del mood (valence per bucket). */
  mood: readonly SeriesPoint[];
  /** Le ere musicali. */
  eras: readonly EraBandModel[];
  /** Periodi di contesto (nastro contesto, Story 3.4). */
  contexts?: readonly ContextRibbonPeriod[];
  /** Intervallo visibile (zoom) dei dati. */
  visibleRange: VisibleRange;
  /**
   * Il contesto evidenziato (deep-link interno, D-25.1).
   *
   * Arriva dal click su un punto dell'Analisi (⑩): la Timeline mette in
   * evidenza l'era che contiene il periodo.
   */
  focus?: AppFocus | null | undefined;
  /** Callback del cambio di granularità. */
  onGranularityChange?: (granularity: Granularity) => void;
  /** Callback alla selezione di un'era (schermata ⑧). */
  onEraSelect?: (era: EraBandModel) => void;
  /** Callback alla selezione di un periodo di contesto. */
  onContextSelect?: (period: ContextRibbonPeriod) => void;
  /** Callback del retry (stato `error`). */
  onRetry?: () => void;
}

export function Timeline({
  state,
  granularity,
  volume,
  mood,
  eras,
  contexts = [],
  visibleRange,
  focus,
  onGranularityChange,
  onEraSelect,
  onContextSelect,
  onRetry,
}: TimelineProps) {
  const t = useT();
  const [hoveredEraId, setHoveredEraId] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const span = Math.max(1, visibleRange.end - visibleRange.start);

  /** La banda evidenziata: per hover diretto, per il bucket sotto il puntatore, o per il deep-link. */
  const activeEraId = useMemo(() => {
    if (hoveredEraId) return hoveredEraId;
    if (hoveredIndex === null) {
      // Il deep-link (D-25.1): l'era che contiene il periodo evidenziato.
      if (!focus) return null;
      const era = eras.find((candidate) => focus.at >= candidate.start && focus.at < candidate.end);
      return era?.id ?? null;
    }
    const point = volume[hoveredIndex];
    if (!point) return null;
    const era = eras.find(
      (candidate) => point.start >= candidate.start && point.start < candidate.end,
    );
    return era?.id ?? null;
  }, [hoveredEraId, hoveredIndex, volume, eras, focus]);

  /** Il bucket evidenziato: per hover diretto, per l'era sotto il puntatore, o per il deep-link. */
  const activeIndex = useMemo(() => {
    if (hoveredIndex !== null) return hoveredIndex;
    if (!activeEraId) {
      if (!focus) return null;
      const index = volume.findIndex((point) => point.start <= focus.at && focus.at < point.end);
      return index >= 0 ? index : null;
    }
    const era = eras.find((candidate) => candidate.id === activeEraId);
    if (!era) return null;
    const index = volume.findIndex((point) => point.start >= era.start && point.start < era.end);
    return index >= 0 ? index : null;
  }, [hoveredIndex, activeEraId, eras, volume, focus]);

  if (state === 'loading') {
    return (
      <main className="screen screen--timeline" aria-busy="true" aria-label={t('timeline.title')}>
        <div className="chart chart--skeleton" data-testid="timeline-skeleton" />
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className="screen screen--timeline" data-testid="timeline-error">
        <h1>{t('timeline.title')}</h1>
        <p>{t('timeline.error')}</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          {t('timeline.retry')}
        </button>
      </main>
    );
  }

  if (state === 'empty') {
    return (
      <main className="screen screen--timeline" data-testid="timeline-empty">
        <h1>{t('timeline.title')}</h1>
        <p>{t('empty.description.timeline')}</p>
      </main>
    );
  }

  return (
    <main className="screen screen--timeline" aria-label={t('timeline.title')}>
      <header className="screen__header">
        <h1>{t('timeline.title')}</h1>
        <div className="timeline__granularity" role="group" aria-label={t('timeline.granularity')}>
          {GRANULARITIES.map((option) => (
            <button
              key={option}
              type="button"
              className="btn btn-ghost"
              aria-pressed={option === granularity}
              data-testid={`timeline-granularity-${option}`}
              onClick={() => onGranularityChange?.(option)}
            >
              {t(`timeline.granularity.${option}`)}
            </button>
          ))}
        </div>
      </header>

      {state === 'partial' && (
        <p className="small" data-testid="timeline-partial">
          {t('timeline.partial')}
        </p>
      )}

      <section className="timeline__eras" aria-label={t('timeline.eras')}>
        {eras.map((era) => {
          const offset = ((era.start - visibleRange.start) / span) * 100;
          const width = ((era.end - era.start) / span) * 100;
          return (
            <EraBand
              key={era.id}
              era={era}
              isActive={era.id === activeEraId}
              widthPercent={Math.max(0, Math.min(100, width))}
              offsetPercent={Math.max(0, Math.min(100, offset))}
              moodLabel={era.mood}
              durationLabel={t('timeline.eraDuration', {
                days: Math.max(1, Math.round((era.end - era.start) / 86_400_000)),
              })}
              onHover={setHoveredEraId}
              onSelect={onEraSelect}
            />
          );
        })}
      </section>

      <section aria-label={t('timeline.volume')}>
        <h2>{t('timeline.volume')}</h2>
        <StreamChart
          labels={volume.map((point) => point.label)}
          values={volume.map((point) => point.value)}
          highlightedIndex={activeIndex}
          onHover={setHoveredIndex}
          title={t('timeline.volume')}
          description={t('timeline.volume')}
        />
      </section>

      <section aria-label={t('timeline.mood')}>
        <h2>{t('timeline.mood')}</h2>
        <MoodLine
          labels={mood.map((point) => point.label)}
          values={mood.map((point) => point.value)}
          highlightedIndex={activeIndex}
          onHover={setHoveredIndex}
          axisLabel={t('timeline.mood')}
          title={t('timeline.mood')}
          description={t('timeline.mood')}
        />
      </section>

      {contexts.length > 0 && <ContextRibbon periods={contexts} onSelect={onContextSelect} />}
    </main>
  );
}
