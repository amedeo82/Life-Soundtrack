import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { ScrobblePanel } from '../ScrobblePanel';
import { i18n } from '../../i18n';

/**
 * Test del pannello scrobbling — `20-SCROBBLING-HUB.md` v1.0 §14.3, caso 29
 * (U-SH.1, U-SH.4, D-SH.14).
 */

describe('ScrobblePanel — selettore per-hub e coda (caso 29)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('default vuoto: nessun hub selezionato e bottone di invio disabilitato', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ScrobblePanel hubs={[]} onHubsChange={vi.fn()} />
      </I18nextProvider>,
    );

    expect(screen.getByTestId('scrobble-no-hub')).toBeTruthy();
    const sendButton = screen.getByTestId('scrobble-send-now') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
    const lastfm = screen.getByTestId('scrobble-hub-lastfm') as HTMLInputElement;
    const listenbrainz = screen.getByTestId('scrobble-hub-listenbrainz') as HTMLInputElement;
    expect(lastfm.checked).toBe(false);
    expect(listenbrainz.checked).toBe(false);
  });

  it('abilitare un hub notifica il set di hub (U-SH.1)', () => {
    const onHubsChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ScrobblePanel hubs={[]} onHubsChange={onHubsChange} />
      </I18nextProvider>,
    );

    fireEvent.click(screen.getByTestId('scrobble-hub-lastfm'));
    expect(onHubsChange).toHaveBeenCalledWith(['lastfm']);
  });

  it('disattivare un hub notifica la revoca (U-SH.4)', () => {
    const onHubsChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ScrobblePanel hubs={['lastfm', 'listenbrainz']} onHubsChange={onHubsChange} />
      </I18nextProvider>,
    );

    const lastfm = screen.getByTestId('scrobble-hub-lastfm') as HTMLInputElement;
    expect(lastfm.checked).toBe(true);
    fireEvent.click(lastfm);
    expect(onHubsChange).toHaveBeenCalledWith(['listenbrainz']);
  });

  it('la modalità del proxy parte da "solo lettura" (D-SH.14)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ScrobblePanel hubs={['lastfm']} onHubsChange={vi.fn()} />
      </I18nextProvider>,
    );

    const select = screen.getByTestId('scrobble-proxy-mode') as HTMLSelectElement;
    expect(select.value).toBe('read-only');
    expect(screen.getByText('Solo lettura (predefinito)')).toBeTruthy();
  });

  it('con un hub attivo il bottone di invio si abilita', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ScrobblePanel hubs={['listenbrainz']} onHubsChange={vi.fn()} />
      </I18nextProvider>,
    );

    const sendButton = screen.getByTestId('scrobble-send-now') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
    expect(screen.queryByTestId('scrobble-no-hub')).toBeNull();
  });
});
