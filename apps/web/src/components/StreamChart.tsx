/**
 * StreamChart — Story 3.1, spec `docs/07-UI-SPEC.md` §2.7.
 *
 * Il volume di ascolto nel tempo: un'area SVG, disegnata a mano (il
 * toolchain non ha una libreria di chart). L'area è chiusa sul **minimo** del
 * dominio e non su zero: un ascolto non riparte da zero minuti, e un'area
 * che scende a zero inventerebbe un silenzio che i dati non hanno.
 *
 * Contratto a11y (vincolante): `<title>` e `<desc>` nel tag `svg`, più una
 * **tabella dati nascosta** (`sr-only`) con i valori esatti per screen
 * reader: il grafico da solo non è leggibile.
 */

import { areaPath, chartPoints, domainOf, type ChartBox } from './chartGeometry';

export interface StreamChartProps {
  /** Etichette dei bucket, nella stessa lunghezza di `values`. */
  labels: readonly string[];
  /** Valori (minuti ascoltati) per bucket. */
  values: readonly number[];
  /** Indice del bucket evidenziato (sincronizzazione con EraBand e MoodLine). */
  highlightedIndex?: number | null | undefined;
  /** Callback al hover su un bucket. */
  onHover?: (index: number | null) => void | undefined;
  /** Descrizione per screen reader. */
  title: string;
  description: string;
  box?: ChartBox | undefined;
}

const DEFAULT_BOX: ChartBox = { width: 640, height: 180, padding: 16 };

export function StreamChart({
  labels,
  values,
  highlightedIndex = null,
  onHover,
  title,
  description,
  box = DEFAULT_BOX,
}: StreamChartProps) {
  const domain = domainOf(values);
  const points = chartPoints(values, box, domain);
  const path = areaPath(points, box, domain);

  return (
    <figure className="chart chart--stream" data-testid="stream-chart">
      <svg
        viewBox={`0 0 ${box.width} ${box.height}`}
        role="img"
        aria-labelledby="stream-chart-title stream-chart-desc"
        preserveAspectRatio="none"
      >
        <title id="stream-chart-title">{title}</title>
        <desc id="stream-chart-desc">{description}</desc>
        <path
          d={path}
          fill="var(--ls-brand-violet)"
          fillOpacity={0.35}
          stroke="var(--ls-brand-violet)"
        />
        {points.map((point) => (
          <circle
            key={point.index}
            cx={point.x}
            cy={point.y}
            r={point.index === highlightedIndex ? 5 : 3}
            fill={
              point.index === highlightedIndex
                ? 'var(--ls-brand-magenta)'
                : 'var(--ls-brand-violet)'
            }
            data-testid={`stream-point-${point.index}`}
            onMouseEnter={() => onHover?.(point.index)}
            onMouseLeave={() => onHover?.(null)}
          />
        ))}
      </svg>
      <table className="sr-only" data-testid="stream-chart-table">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Periodo</th>
            <th scope="col">Minuti</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value, index) => (
            <tr key={labels[index] ?? index}>
              <th scope="row">{labels[index] ?? ''}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
