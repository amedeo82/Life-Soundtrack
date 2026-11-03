import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../../i18n';
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

  /** Renderizza la Home nella lingua indicata (default: italiano). */
  async function renderHome(language: 'it' | 'en' = 'it') {
    await i18n.changeLanguage(language);
    return render(
      <I18nextProvider i18n={i18n}>
        <Home {...defaultProps} />
      </I18nextProvider>,
    );
  }

  it("mostra il messaggio no-features e la CTA per attivare l'analisi acustica", async () => {
    await renderHome();

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
    await renderHome();

    const ctaButton = screen.getByRole('button', { name: 'Attiva analisi acustica' });
    await userEvent.click(ctaButton);

    expect(mockOnImportCta).toHaveBeenCalledTimes(1);
  });

  it('ha data-testid home-no-features', async () => {
    await renderHome();

    expect(screen.getByTestId('home-no-features')).toBeInTheDocument();
  });

  it('traduce il messaggio anche in inglese', async () => {
    await renderHome('en');

    expect(
      screen.getByText(
        'Your data is here, but to tell its mood we need acoustic analysis: enable it in Settings → Privacy',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable acoustic analysis' })).toBeInTheDocument();
  });
});
