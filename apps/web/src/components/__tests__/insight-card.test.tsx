/**
 * Test dell'InsightCard — Story 3.3, spec `docs/07-UI-SPEC.md` §2.9.
 *
 * La card porta **l'insight in prosa**: il contratto è che la descrizione è
 * una **frase** (non un valore numerico) e che le azioni dell'utente
 * (confermare / correggere / ignorare) sono raggiungibili.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InsightCard } from '../InsightCard';

describe('InsightCard (Story 3.3)', () => {
  it('è un articolo con titolo e descrizione', () => {
    render(
      <InsightCard
        icon="⚡"
        title="Evento"
        description="Hai scoperto Beatles che ha dominato il tuo ascolto"
      />,
    );

    const card = screen.getByTestId('insight-card');
    expect(card.getAttribute('role')).toBe('article');
    expect(card.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByTestId('insight-card-description').textContent).toContain('Beatles');
  });

  it('lo stato è dichiarato (pending / confirmed / dismissed)', () => {
    render(<InsightCard icon="💭" title="Ricordo" description="Due anni fa…" status="confirmed" />);
    expect(screen.getByTestId('insight-card').getAttribute('data-status')).toBe('confirmed');
  });

  it('le azioni sono bottoni con etichetta e invocano il callback', () => {
    const onClick = vi.fn();
    render(
      <InsightCard
        icon="⚡"
        title="Evento"
        description="Una frase."
        actions={[{ icon: '✓', label: 'Conferma', onClick }]}
      />,
    );

    const action = screen.getByTestId('insight-card-action-0');
    expect(action.getAttribute('aria-label')).toBe('Conferma');
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
