import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { OnboardingRouter } from '../OnboardingRouter';
import { i18n } from '../../i18n';
import { DEMO_DB_NAME, countListens, openDb } from '@core/db';

/**
 * La CTA «Scopri come funziona» e il flusso demo — Story 3.5,
 * `docs/26-ONBOARDING-DEMO.md` v1.0.
 *
 * Il modulo `demoMode` è **mockato**: il test verifica il flusso (CTA →
 * diario di esempio → uscita) e l'isolamento del database, non il seeding di
 * 4 500 eventi (quello è coperto dal test core del loader).
 */

const { startDemo, stopDemo } = vi.hoisted(() => ({ startDemo: vi.fn(), stopDemo: vi.fn() }));

vi.mock('../../demo/demoMode', () => ({ startDemo, stopDemo }));

const renderRouter = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <OnboardingRouter />
    </I18nextProvider>,
  );

describe('demo — la CTA «Scopri come funziona» (Story 3.5)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    startDemo.mockReset();
    stopDemo.mockReset();
    startDemo.mockResolvedValue(undefined);
    stopDemo.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    const demoDb = await openDb(DEMO_DB_NAME);
    await demoDb.delete();
  });

  it('la CTA esiste, è cliccabile e avvia la demo', async () => {
    const user = userEvent.setup();
    renderRouter();

    const cta = screen.getByTestId('demo-cta');
    expect(cta.textContent).toBe('Scopri come funziona');
    expect((cta as HTMLButtonElement).disabled).toBe(false);

    await user.click(cta);

    await waitFor(() => {
      expect(startDemo).toHaveBeenCalledTimes(1);
    });
  });

  it('la demo mostra il diario di esempio e la sua banner', async () => {
    const user = userEvent.setup();
    renderRouter();

    await user.click(screen.getByTestId('demo-cta'));

    await waitFor(() => {
      expect(screen.getByTestId('app-shell')).toBeTruthy();
    });
    expect(screen.getByTestId('demo-banner')).toBeTruthy();
  });

  it('la demo non scrive nel database dell utente', async () => {
    const user = userEvent.setup();
    renderRouter();

    await user.click(screen.getByTestId('demo-cta'));

    await waitFor(() => {
      expect(startDemo).toHaveBeenCalledTimes(1);
    });

    const userDb = await openDb();
    expect(await countListens(userDb)).toBe(0);
  });

  it('«Esci dalla demo» cancella il database demo e torna all onboarding', async () => {
    const user = userEvent.setup();
    renderRouter();

    await user.click(screen.getByTestId('demo-cta'));
    await waitFor(() => {
      expect(screen.getByTestId('demo-banner')).toBeTruthy();
    });

    await user.click(screen.getByTestId('demo-exit'));

    await waitFor(() => {
      expect(stopDemo).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('welcome-cta')).toBeTruthy();
  });
});
