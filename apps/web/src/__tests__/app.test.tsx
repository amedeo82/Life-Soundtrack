import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from '../App';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../i18n';

it("monta lo schermo di benvenuto dell'onboarding", async () => {
  await i18n.changeLanguage('it');
  render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>,
  );

  // L'app sceglie fra onboarding e app **leggendo i dati**: la verifica del
  // database è asincrona, quindi il benvenuto arriva dopo un tick.
  expect(await screen.findByText(/La colonna sonora della tua vita/i)).toBeTruthy();
  expect(screen.getByTestId('welcome-cta')).toBeTruthy();
});
