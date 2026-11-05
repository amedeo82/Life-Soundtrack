/**
 * QuadrantChart — Story 3.3, spec `docs/07-UI-SPEC.md` §2.8.
 *
 * La **mappa emotiva** (⑩): ogni punto è un periodo (un mese) posizionato
 * per valence (x) ed energy (y). La dimensione del punto è proporzionale
 * agli ascolti del periodo.
 *
 * I punti sono **`<button>`** (`07§2.8`), non cerchi di SVG: un punto
 * cliccabile deve essere un controllo della tastiera, con un nome
 * accessibile. L'SVG fa la cornice (assi, quadranti, etichette), i pulsanti
 * stanno sopra, posizionati in percentuale.
 *
 * Il componente non conosce l'i18n: le etichette dei quadranti arrivano
 * già rese dalla schermata.
 */

import type { CSSProperties } from 'react';
import type { QuadrantPoint } from '../screens/analysisModel';

export interface QuadrantChartProps {
  /** I punti del quadrante. */
  readonly points: readonly QuadrantPoint[];
  /** Le etichette dei quadranti, già rese. */
  readonly quadrantLabels: {
    /** L'etichetta della metà alta. */
    readonly high: string;
    /** L'etichetta della metà bassa. */
    readonly low: string;
    /** L'etichetta dell'asse orizzontale. */
    readonly valence: string;
  };
  /** Il titolo del grafico (accessibile), già reso. */
  readonly title?: string | undefined;
  /** La descrizione del grafico (accessibile), già resa. */
  readonly description?: string | undefined;
  /** Callback alla selezione di un punto (deep-link alla Timeline). */
  readonly onPointSelect?: ((point: QuadrantPoint) => void) | undefined;
}

/** Il lato del quadrato del grafico (l'SVG è quadrato). */
const BOX = 320;

export function QuadrantChart({
  points,
  quadrantLabels,
  title,
  description,
  onPointSelect,
}: QuadrantChartProps) {
  const half = BOX / 2;

  return (
    <div className="quadrant-chart" data-testid="quadrant-chart">
      <svg
        className="quadrant-chart__frame"
        viewBox={`0 0 ${BOX} ${BOX}`}
        role="img"
        aria-label={title ?? description ?? quadrantLabels.valence}
        data-testid="quadrant-chart-svg"
      >
        {title ? <title>{title}</title> : null}
        {description ? <desc>{description}</desc> : null}
        {/* gli assi: due rette che dividono il quadrante in quattro */}
        <line
          x1={half}
          y1={0}
          x2={half}
          y2={BOX}
          className="quadrant-chart__axis"
          data-testid="quadrant-chart-axis-y"
        />
        <line
          x1={0}
          y1={half}
          x2={BOX}
          y2={half}
          className="quadrant-chart__axis"
          data-testid="quadrant-chart-axis-x"
        />
        <text x={BOX - 8} y={20} textAnchor="end" className="quadrant-chart__quadrant-label">
          {quadrantLabels.high}
        </text>
        <text x={BOX - 8} y={BOX - 10} textAnchor="end" className="quadrant-chart__quadrant-label">
          {quadrantLabels.low}
        </text>
        <text x={BOX} y={BOX - 2} textAnchor="end" className="quadrant-chart__axis-label">
          {quadrantLabels.valence}
        </text>
      </svg>

      <div className="quadrant-chart__points">
        {points.map((point) => {
          const style: CSSProperties = {
            left: `${point.x * 100}%`,
            bottom: `${point.y * 100}%`,
            width: `${point.size * 2}px`,
            height: `${point.size * 2}px`,
            backgroundColor: point.color,
          };
          return (
            <button
              key={point.id}
              type="button"
              className="quadrant-chart__point"
              style={style}
              aria-label={point.ariaLabel}
              title={point.label}
              data-testid={`quadrant-point-${point.id}`}
              onClick={() => {
                onPointSelect?.(point);
              }}
            >
              <span className="quadrant-chart__point-label">{point.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
