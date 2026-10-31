/**
 * Geometria dei grafici — Story 3.1 (`docs/07-UI-SPEC.md` §2.7).
 *
 * Funzioni **pure**: il calcolo delle coordinate SVG non dipende da React né
 * dal DOM, e può essere verificato con i soli numeri. Il DOM (il tag `svg`,
 * il `<title>`, il `<desc>`, la tabella nascosta per screen reader) sta nei
 * componenti.
 *
 * I grafici sono **SVG scritti a mano**: il toolchain non ha una libreria di
 * chart e introdurne una sarebbe una decisione di stack, non di story.
 */

/** Dimensioni di rendering di un grafico. */
export interface ChartBox {
  width: number;
  height: number;
  /** Padding interno (asse, etichette). */
  padding: number;
}

/** Area utile (dentro il padding). */
export interface PlotArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Area utile di un box. */
export function plotArea(box: ChartBox): PlotArea {
  return {
    x: box.padding,
    y: box.padding,
    width: Math.max(0, box.width - box.padding * 2),
    height: Math.max(0, box.height - box.padding * 2),
  };
}

/**
 * Scala lineare da dominio a intervallo.
 *
 * Un dominio degenere (min === max) è un caso reale: una sola ora di
 * ascolto. La scala restituisce il **centro** dell'area utile, così il
 * punto non finisce sul bordo.
 */
export function linearScale(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): number {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
  const ratio = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + ratio * (rangeMax - rangeMin);
}

/** Il dominio dei valori di una serie (min, max). */
export function domainOf(values: readonly number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 };
  let min = values[0] as number;
  let max = values[0] as number;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

/** Punto calcolato di una serie. */
export interface ChartPoint {
  x: number;
  y: number;
  value: number;
  index: number;
}

/**
 * I punti di una serie, disposti sul box.
 *
 * Con un solo punto la x è al centro: un punto a sinistra sembrerebbe un
 * errore di rendering.
 */
export function chartPoints(
  values: readonly number[],
  box: ChartBox,
  domain?: { min: number; max: number },
): ChartPoint[] {
  const area = plotArea(box);
  const { min, max } = domain ?? domainOf(values);
  const count = values.length;
  return values.map((value, index) => ({
    x:
      count <= 1
        ? area.x + area.width / 2
        : linearScale(index, 0, count - 1, area.x, area.x + area.width),
    y: linearScale(value, min, max, area.y + area.height, area.y),
    value,
    index,
  }));
}

/** Il path `d` di una polilinea (MoodLine). */
export function linePath(points: readonly ChartPoint[]): string {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

/**
 * Il path `d` di un'area (StreamChart): la linea e la chiusura sul basso.
 *
 * L'area è chiusa sul **minimo** del dominio, non su zero: un volume
 * misurato in minuti ha un basale nonzero (gli ascolti non partono da zero
 * minuti ogni volta), e un'area che scende a zero inventa un silenzio.
 */
export function areaPath(
  points: readonly ChartPoint[],
  box: ChartBox,
  domain: { min: number; max: number },
): string {
  if (points.length === 0) return '';
  const area = plotArea(box);
  const baseline = linearScale(domain.min, domain.min, domain.max, area.y + area.height, area.y);
  const head = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const last = points[points.length - 1] as ChartPoint;
  const first = points[0] as ChartPoint;
  return `${head} L${last.x.toFixed(2)} ${baseline.toFixed(2)} L${first.x.toFixed(2)} ${baseline.toFixed(2)} Z`;
}

/** La larghezza di una barra, con lo spazio fra una e l'altra. */
export function barWidth(box: ChartBox, count: number): number {
  if (count <= 0) return 0;
  const area = plotArea(box);
  const slot = area.width / count;
  return Math.max(1, slot * 0.7);
}

/** La x di una barra (barra centrata nello slot). */
export function barX(box: ChartBox, index: number, count: number): number {
  const area = plotArea(box);
  const slot = area.width / Math.max(1, count);
  return area.x + slot * index + (slot - barWidth(box, count)) / 2;
}

/** L'altezza di una barra, dal valore al minimo del dominio. */
export function barHeight(
  value: number,
  domain: { min: number; max: number },
  box: ChartBox,
): number {
  const area = plotArea(box);
  const top = linearScale(value, domain.min, domain.max, area.y + area.height, area.y);
  const baseline = linearScale(domain.min, domain.min, domain.max, area.y + area.height, area.y);
  return Math.max(0, baseline - top);
}
