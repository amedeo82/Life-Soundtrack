/**
 * La schermata Analisi (⑩) — Story 3.3, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §7 e `docs/07-UI-SPEC.md` §2.8-§2.9.
 *
 * La **mappa emotiva**: il `QuadrantChart` (valence × energy) con un punto
 * per mese della storia, e sotto i grafici gli **insight in prosa** — gli
 * eventi e i ricordi persistiti dalla Story 2.5, con la frase che spiega il
 * periodo.
 *
 * Il criterio di accettazione della story è esplicito: *ogni grafico è
 * accompagnato da almeno una frase*. Un grafico senza lettura è l'ennesimo
 * cruscotto (`docs/22-COMPETITIVE-POSITIONING.md` §8).
 *
 * Il percorso è **interamente locale**: nessuna richiesta di rete.
 */

import { useMemo, type ReactElement } from 'react';
import { useT } from '../i18n';
import { InsightCard, type InsightCardAction } from '../components/InsightCard';
import { QuadrantChart } from '../components/QuadrantChart';
import { useAnalysisData, type AnalysisInsightModel } from '../hooks/useAnalysisData';
import { toQuadrantPoints, type PeriodPoint } from './analysisModel';
import type { AppFocus } from './appNavigation';
import type { MemoryKind } from '@core/schema';

export interface AnalysisScreenProps {
  /** Il database da leggere (iniettabile solo per i test). */
  readonly dbName?: string | undefined;
  /** Il deep-link interno: il click su un punto porta alla Timeline. */
  readonly onFocus?: ((focus: AppFocus) => void) | undefined;
}

/** L'etichetta breve di ogni tipo di ricordo (le chiavi esistono già). */
const MEMORY_LABELS: Readonly<Record<MemoryKind, string>> = {
  on_this_day: 'memories.onThisDay',
  first_time: 'memories.firstTime',
  milestone: 'memories.milestone',
  return: 'memories.return',
  seasonal: 'memories.seasonal',
};

export function AnalysisScreen({ dbName, onFocus }: AnalysisScreenProps): ReactElement {
  const t = useT();
  const data = useAnalysisData(dbName);

  /** L'`aria-label` di un punto: il periodo e i due valori, in prosa. */
  const ariaLabelFor = useMemo(
    () => (point: PeriodPoint) =>
      t('analysis.pointAria', {
        label: point.label,
        valence: point.valence.toFixed(2),
        energy: point.energy.toFixed(2),
      }),
    [t],
  );

  const points = useMemo(
    () => toQuadrantPoints(data.periods, ariaLabelFor),
    [data.periods, ariaLabelFor],
  );

  /** Le azioni dell'utente su un insight (confermare / correggere / ignorare). */
  const actionsFor = (insight: AnalysisInsightModel): readonly InsightCardAction[] => [
    {
      icon: '✓',
      label: t('common.confirm'),
      onClick: () => {
        data.setStatus(insight.id, 'confirmed');
      },
    },
    {
      icon: '✎',
      label: t('analysis.correct'),
      onClick: () => {
        data.setStatus(insight.id, 'corrected');
      },
    },
    {
      icon: '✕',
      label: t('analysis.dismiss'),
      onClick: () => {
        data.setStatus(insight.id, 'dismissed');
      },
    },
  ];

  return (
    <section className="analysis" data-testid="analysis-screen">
      <h2 className="analysis__title">{t('analysis.title')}</h2>

      {data.state === 'loading' && (
        <p className="analysis__status" role="status" data-testid="analysis-loading">
          {t('common.loading')}
        </p>
      )}

      {data.state === 'error' && (
        <p className="analysis__status" role="alert" data-testid="analysis-error">
          {t('error.generic')}
        </p>
      )}

      {data.state === 'empty' && (
        <p className="analysis__status" data-testid="analysis-empty">
          {t('empty.description.analysis')}
        </p>
      )}

      {data.state === 'ready' && points.length > 0 && (
        <section className="analysis__chart" aria-label={t('analysis.chart')}>
          <h3>{t('analysis.chart')}</h3>
          <QuadrantChart
            points={points}
            title={t('analysis.chart')}
            description={t('analysis.chart')}
            quadrantLabels={{
              high: t('analysis.quadrant.high'),
              low: t('analysis.quadrant.low'),
              valence: t('analysis.quadrant.valence'),
            }}
            onPointSelect={(point) => {
              onFocus?.({ kind: 'period', id: point.id, at: point.at });
            }}
          />
          {/* L'insight in prosa: il grafico non è mai solo un grafico. */}
          <p className="analysis__summary" data-testid="analysis-summary">
            {data.dominantMood
              ? t(`insight.mood.${data.dominantMood}`)
              : t('insight.disclaimerShort')}
          </p>
        </section>
      )}

      {data.state === 'ready' && data.insights.length > 0 && (
        <section className="analysis__insights" aria-label={t('analysis.insights')}>
          <h3>{t('analysis.insights')}</h3>
          {data.insights.map((insight) => (
            <InsightCard
              key={insight.id}
              icon={insight.kind === 'event' ? '⚡' : '💭'}
              title={
                insight.kind === 'memory' && insight.memoryKind
                  ? t(MEMORY_LABELS[insight.memoryKind])
                  : t('analysis.event')
              }
              description={insight.description}
              confidence={insight.confidence}
              status={insight.status}
              confidenceLabel={t('analysis.confidence', {
                value: `${Math.round(insight.confidence * 100)}%`,
              })}
              actions={actionsFor(insight)}
            />
          ))}
        </section>
      )}

      {data.state === 'ready' && (
        <p className="analysis__disclaimer small">{t('insight.disclaimer')}</p>
      )}
    </section>
  );
}
