import { act, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { createAppI18n, setLanguage } from '../i18n';
import { T } from '../i18n/T';
import { useT } from '../i18n/useT';

describe('hook useT (T0.6.4)', () => {
  it('restituisce una t funzionante e ricalcola al cambio lingua senza reload', async () => {
    localStorage.clear();
    const i = createAppI18n({ language: 'it' });

    function Probe() {
      const t = useT();
      return <p>{t('common.loading')}</p>;
    }

    render(
      <I18nextProvider i18n={i}>
        <Probe />
      </I18nextProvider>,
    );
    expect(screen.getByText('Caricamento...')).toBeTruthy();

    await act(async () => {
      await setLanguage('en', i);
    });
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(i.language).toBe('en');
  });
});

describe('componente T (T0.6.4)', () => {
  it('renderizza la stringa tradotta con variabili', () => {
    const i = createAppI18n({ language: 'it' });
    const { container } = render(
      <I18nextProvider i18n={i}>
        <T i18nKey="home.greeting" values={{ name: 'Amedeo' }} />
      </I18nextProvider>,
    );
    expect(container.textContent).toBe('Ciao, Amedeo \u{1F44B}');
  });

  it('renderizza il plurale con count', () => {
    const i = createAppI18n({ language: 'it' });
    const { container } = render(
      <I18nextProvider i18n={i}>
        <T i18nKey="import.status.done" count={3} />
      </I18nextProvider>,
    );
    expect(container.textContent).toBe('3 eventi trovati');
  });

  it('per una chiave ignota non mostra mai la chiave grezza', () => {
    const i = createAppI18n({ language: 'it' });
    const { container } = render(
      <I18nextProvider i18n={i}>
        <T i18nKey="unknown.key" />
      </I18nextProvider>,
    );
    expect(container.textContent).toBe('');
  });
});
