import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryCard } from '../MemoryCard';

/**
 * Test delle azioni della card — Story 3.2, `docs/07-UI-SPEC.md` §2.2 (T25.6).
 *
 * Copre: l'array `actions` è renderizzato, invocabile e accessibile
 * (l'etichetta è l'`aria-label` del bottone).
 */

describe('MemoryCard actions (Story 3.2)', () => {
  it('rende le azioni con la loro etichetta', () => {
    render(
      <MemoryCard
        title="Un ricordo"
        actions={[
          { icon: '🙈', label: 'Nascondi', onClick: () => {} },
          { icon: '⭐', label: 'Salva', onClick: () => {} },
          { icon: '📤', label: 'Condividi', onClick: () => {} },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Nascondi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Condividi' })).toBeInTheDocument();
  });

  it("invoca l'azione scelta", () => {
    const hide = vi.fn();
    const save = vi.fn();
    const share = vi.fn();
    render(
      <MemoryCard
        title="Un ricordo"
        actions={[
          { icon: '🙈', label: 'Nascondi', onClick: hide },
          { icon: '⭐', label: 'Salva', onClick: save },
          { icon: '📤', label: 'Condividi', onClick: share },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nascondi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    fireEvent.click(screen.getByRole('button', { name: 'Condividi' }));

    expect(hide).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('senza azioni non rende il blocco delle azioni', () => {
    render(<MemoryCard title="Il ricordo del giorno" />);
    expect(screen.queryByTestId('memory-card-actions')).not.toBeInTheDocument();
  });

  it("l'azione non attiva il click della card", () => {
    const onClick = vi.fn();
    const hide = vi.fn();
    render(
      <MemoryCard
        title="Un ricordo"
        onClick={onClick}
        actions={[{ icon: '🙈', label: 'Nascondi', onClick: hide }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nascondi' }));
    expect(hide).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});
