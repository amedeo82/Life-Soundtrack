import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../i18n';
import { About } from '../components/About';

it("espone l'offerta del sorgente AGPL §13 dalla UI (issue #202)", async () => {
  await i18n.changeLanguage('it');
  render(
    <I18nextProvider i18n={i18n}>
      <About />
    </I18nextProvider>,
  );

  expect(screen.getByText(/Informazioni/i)).toBeTruthy();
  expect(screen.getByTestId('about-source-offer')).toBeTruthy();
  expect(screen.getByText(/repository pubblico/i)).toBeTruthy();
  expect(screen.getByTestId('about-source-offer').textContent).toMatch(/tag git/);
  expect(screen.getByText(/AGPL §13/i)).toBeTruthy();
  expect(screen.getByTestId('about-close')).toBeTruthy();
});

it("mostra l'offerta del sorgente anche in inglese (issue #202)", async () => {
  await i18n.changeLanguage('en');
  render(
    <I18nextProvider i18n={i18n}>
      <About />
    </I18nextProvider>,
  );

  expect(screen.getByText(/About/i)).toBeTruthy();
  expect(screen.getByTestId('about-source-offer')).toBeTruthy();
  expect(screen.getByText(/public repository/i)).toBeTruthy();
});
