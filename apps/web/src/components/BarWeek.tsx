/**
 * BarWeek — Story 3.1, spec `docs/07-UI-SPEC.md` §2.7 e `docs/06-UX-FLOWS-STATES.md` §2.6.
 *
 * I sette giorni della settimana con i minuti ascoltati. Le barre crescono
 * con uno **stagger** (ritardo progressivo): il dato si legge come una
 * sequenza, non come sette numeri scolpiti.
 *
 * L'altezza della barra è proporzionale al **massimo** della settimana, non
 * al massimo assoluto: il confronto è fra i giorni della stessa settimana.
 */

import { barHeight, barWidth, barX, domainOf, plotArea, type ChartBox } from './chartGeometry';

export interface BarWeekPoint {
  dayKey: string;
  label: string;
  minutes: number;
}

export interface BarWeekProps {
  /** I sette giorni, nell'ordine lunedì → domenica. */
  points: readonly BarWeekPoint[];
  /** Etichetta del giorno (giorni della settimana), lunghezza 7. */
  dayLabels: readonly string[];
  /** Indice del giorno evidenziato. */
  highlightedIndex?: number | null | undefined;
  /** Callback al hover su una barra. */
  onHover?: (index: number | null) => void | undefined;
  title: string;
  description: string;
  box?: ChartBox | undefined;
}

const DEFAULT_BOX: ChartBox = { width: 320, height: 120, padding: 12 };

export function BarWeek({
  points,
  dayLabels,
  highlightedIndex = null,
  onHover,
  title,
  description,
  box = DEFAULT_BOX,
}: BarWeekProps) {
  const values = points.map((point) => point.minutes);
  const domain = domainOf(values);
  const area = plotArea(box);
  const width = barWidth(box, points.length);

  return (
    <figure className="chart chart--barweek" data-testid="bar-week">
      <svg
        viewBox={`0 0 ${box.width} ${box.height}`}
        role="img"
        aria-labelledby="bar-week-title bar-week-desc"
      >
        <title id="bar-week-title">{title}</title>
        <desc id="bar-week-desc">{description}</desc>
        {points.map((point, index) => {
          const height = barHeight(point.minutes, domain, box);
          return (
            <rect
              key={point.dayKey}
              x={barX(box, index, points.length)}
              y={area.y + area.height - height}
              width={width}
              height={height}
              rx={2}
              fill={
                index === highlightedIndex ? 'var(--ls-brand-magenta)' : 'var(--ls-brand-violet)'
              }
              data-testid={`bar-week-bar-${index}`}
              style={{ transitionDelay: `${index * 50}ms` }}
              onMouseEnter={() => onHover?.(index)}
              onMouseLeave={() => onHover?.(null)}
            />
          );
        })}
      </svg>
      <table className="sr-only" data-testid="bar-week-table">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Giorno</th>
            <th scope="col">Minuti</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={point.dayKey}>
              <th scope="row">{dayLabels[index] ?? point.label}</th>
              <td>{point.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
