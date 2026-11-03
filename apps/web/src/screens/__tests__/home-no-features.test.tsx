import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home } from '../Home';
import { vi } from 'vitest';

/**
 * Test dello stato vuoto no-features — 23-ANALYSIS-PIPELINE.md v1.0 🟢.
 *
 * Verifica che lo stato no-features mostri il messaggio e la CTA,
 * non lo schermo bianco.
 */

describe('Home no-features state (Story 2.5)', () => {
  const mockOnImportCta = vi.fn();
  const mockOnStatCardClick = vi.fn();

  const defaultProps = {
    state: 'no-features' as const,
    stats: { tracks: 10, hours: 5, artists: 3, eras: 0 },
    barWeek: [],
    memory: null,
    weekMoodLabel: null,
    onStatCardClick: mockOnStatCardClick,
    onImportCta: mockOnImportCta,
  };

  it("mostra il messaggio no-features e la CTA per attivare l'analisi acustica", () => {
    render(<Home {...defaultProps} />);

    // Titolo uguale a empty
    expect(screen.getByText('La tua storia inizia qui')).toBeInTheDocument();

    // Messaggio specifico no-features
    expect(
      screen.getByText(
        "I tuoi dati ci sono, ma per raccontare il loro umore serve l'analisi acustica: attivala in Impostazioni → Privacy",
      ),
    ).toBeInTheDocument();

    // CTA per attivare analisi
    const ctaButton = screen.getByRole('button', { name: 'Attiva analisi acustica' });
    expect(ctaButton).toBeInTheDocument();
  });

  it('click su CTA chiama onImportCta', async () => {
    render(<Home {...defaultProps} />);

    const ctaButton = screen.getByRole('button', { name: 'Attiva analisi acustica' });
    await userEvent.click(ctaButton);

    expect(mockOnImportCta).toHaveBeenCalledTimes(1);
  });

  it('ha data-testid home-no-features', () => {
    render(<Home {...defaultProps} />);

    expect(screen.getByTestId('home-no-features')).toBeInTheDocument();
  });
});
