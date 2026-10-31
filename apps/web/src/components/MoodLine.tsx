/**
 * MoodLine — Story 3.1, spec `docs/07-UI-SPEC.md` §2.7.
 *
 * La linea del mood (valence) nel tempo. Come lo StreamChart è SVG scritto a
 * mano, con `<title>`, `<desc>` e tabella nascosta per screen reader.
 *
 * Un bucket **senza** mood non è un punto a zero: la linea semplicemente
 * salta il vuoto. Il modello (`homeTimelineModel.bucketizeMood`) non produce
 * quei bucket, e qui non si interpolano.
 */

import { chartPoints, domainOf, linePath, type ChartBox } from './chartGeometry';

export interface MoodLineProps {
  /** Etichette dei bucket. */
  labels: readonly string[];
  /** Valori di valence 0..1. */
  values: readonly number[];
  /** Indice del bucket evidenziato (sincronizzazione con EraBand e StreamChart). */
  highlightedIndex?: number | null | undefined;
  /** Callback al hover su un punto. */
  onHover?: (index: number | null) => void | undefined;
  /** Etichetta dell'asse (per il `<desc>`). */
  axisLabel: string;
  title: string;
  description: string;
  box?: ChartBox | undefined;
}

const DEFAULT_BOX: ChartBox = { width: 640, height: 140, padding: 16 };

export function MoodLine({
  labels,
  values,
  highlightedIndex = null,
  onHover,
  axisLabel,
  title,
  description,
  box = DEFAULT_BOX,
}: MoodLineProps) {
  const domain = domainOf(values);
  const points = chartPoints(values, box, domain);
  const path = linePath(points);

  return (
    <figure className="chart chart--mood" data-testid="mood-line">
      <svg
        viewBox={`0 0 ${box.width} ${box.height}`}
        role="img"
        aria-labelledby="mood-line-title mood-line-desc"
        preserveAspectRatio="none"
      >
        <title id="mood-line-title">{title}</title>
        <desc id="mood-line-desc">{description}</desc>
        <path d={path} fill="none" stroke="var(--ls-brand-magenta)" strokeWidth={2} />
        {points.map((point) => (
          <circle
            key={point.index}
            cx={point.x}
            cy={point.y}
            r={point.index === highlightedIndex ? 5 : 3}
            fill={
              point.index === highlightedIndex
                ? 'var(--ls-brand-magenta)'
                : 'var(--ls-mood-neutral)'
            }
            data-testid={`mood-point-${point.index}`}
            onMouseEnter={() => onHover?.(point.index)}
            onMouseLeave={() => onHover?.(null)}
          />
        ))}
      </svg>
      <table className="sr-only" data-testid="mood-line-table">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Periodo</th>
            <th scope="col">{axisLabel}</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value, index) => (
            <tr key={labels[index] ?? index}>
              <th scope="row">{labels[index] ?? ''}</th>
              <td>{value.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
