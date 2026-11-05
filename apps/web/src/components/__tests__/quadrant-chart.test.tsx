/**
 * Test del QuadrantChart — Story 3.3, spec `docs/07-UI-SPEC.md` §2.8.
 *
 * Il contratto accessibile è il punto: ogni punto è un **`<button>`** con
 * un `aria-label` descrittivo (`07§2.8`), non un cerchio di SVG.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuadrantChart } from '../QuadrantChart';
import type { QuadrantPoint } from '../../screens/analysisModel';

const points: QuadrantPoint[] = [
  {
    id: '2026-01',
    x: 0.8,
    y: 0.7,
    size: 12,
    color: 'var(--ls-mood-happy)',
    label: '2026-01',
    ariaLabel: '2026-01: valence 0.80, energy 0.70',
    at: Date.UTC(2026, 0, 1),
  },
  {
    id: '2026-02',
    x: 0.2,
    y: 0.3,
    size: 6,
    color: 'var(--ls-mood-sad)',
    label: '2026-02',
    ariaLabel: '2026-02: valence 0.20, energy 0.30',
    at: Date.UTC(2026, 1, 1),
  },
];

const labels = { high: 'ALTA ENERGIA', low: 'BASSA ENERGIA', valence: 'VALENCE →' };

describe('QuadrantChart (Story 3.3)', () => {
  it('ogni punto è un bottone con aria-label', () => {
    render(<QuadrantChart points={points} quadrantLabels={labels} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.getAttribute('aria-label')).toBe('2026-01: valence 0.80, energy 0.70');
    expect(buttons[1]?.getAttribute('aria-label')).toBe('2026-02: valence 0.20, energy 0.30');
  });

  it('le etichette dei quadranti sono nel grafico', () => {
    render(<QuadrantChart points={points} quadrantLabels={labels} />);

    const svg = screen.getByTestId('quadrant-chart-svg');
    expect(svg.textContent).toContain('ALTA ENERGIA');
    expect(svg.textContent).toContain('BASSA ENERGIA');
    expect(svg.textContent).toContain('VALENCE →');
  });

  it('il click su un punto consegna il punto al chiamante', () => {
    const onPointSelect = vi.fn();
    render(<QuadrantChart points={points} quadrantLabels={labels} onPointSelect={onPointSelect} />);

    fireEvent.click(screen.getByTestId('quadrant-point-2026-02'));
    expect(onPointSelect).toHaveBeenCalledTimes(1);
    expect(onPointSelect.mock.calls[0]?.[0].id).toBe('2026-02');
  });
});
