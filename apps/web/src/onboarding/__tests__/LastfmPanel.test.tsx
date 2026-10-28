import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { LastfmPanel } from '../LastfmPanel';
import { i18n } from '../../i18n';
import type { PrivacySettings } from '@core/schema';

const PRIVACY_OFF: PrivacySettings = {
  retainIp: false,
  enrichMetadata: false,
  carDetectionConsent: false,
  scrobbleHubs: [],
  syncCloud: false,
};

const renderPanel = (): void => {
  render(
    <I18nextProvider i18n={i18n}>
      <LastfmPanel privacy={PRIVACY_OFF} />
    </I18nextProvider>,
  );
};

describe('LastfmPanel — configurazione locale (E.LF.7, D-LF.0/D-LF.1)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('senza proxy/chiave/utente: il bottone di import è disabilitato e zero richieste', () => {
    renderPanel();

    const importButton = screen.getByTestId('lastfm-import') as HTMLButtonElement;
    expect(importButton.disabled).toBe(true);
    expect(screen.getByTestId('lastfm-not-configured')).toBeTruthy();
  });

  it('con proxy, chiave e utente valorizzati: il bottone di import si abilita', () => {
    renderPanel();

    fireEvent.change(screen.getByTestId('lastfm-proxy'), {
      target: { value: 'https://proxy.example.org' },
    });
    fireEvent.change(screen.getByTestId('lastfm-username'), { target: { value: 'ls_user' } });
    fireEvent.change(screen.getByTestId('lastfm-apikey'), { target: { value: 'key-123' } });

    const importButton = screen.getByTestId('lastfm-import') as HTMLButtonElement;
    expect(importButton.disabled).toBe(false);
  });

  it('la chiave API è un input di tipo password (non finisce in chiaro a schermo)', () => {
    renderPanel();
    const apiKey = screen.getByTestId('lastfm-apikey') as HTMLInputElement;
    expect(apiKey.type).toBe('password');
    expect(apiKey.getAttribute('autocomplete')).toBe('off');
  });

  it('il percorso web auth espone shared secret e callback (D-LF.2)', () => {
    renderPanel();
    const secret = screen.getByTestId('lastfm-shared-secret') as HTMLInputElement;
    expect(secret.type).toBe('password');
    expect(screen.getByTestId('lastfm-auth-callback')).toBeTruthy();
  });

  it('senza token nel callback il collegamento fallisce con un avviso esplicito', async () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('lastfm-auth-callback'), {
      target: { value: 'https://app.example.org/callback?foo=bar' },
    });
    fireEvent.click(screen.getByTestId('lastfm-auth-connect'));
    await waitFor(() => {
      expect(screen.getByTestId('lastfm-error')).toBeTruthy();
    });
  });
});
