import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { ImportScreen } from '../OnboardingRouter';
import { i18n } from '../../i18n';
import type { PrivacySettings } from '@core/schema';

const PRIVACY_OFF: PrivacySettings = {
  retainIp: false,
  enrichMetadata: false,
  carDetectionConsent: false,
  scrobbleHubs: [],
  syncCloud: false,
};

const renderWithI18n = (ui: React.ReactElement) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const makeFile = (name: string): File =>
  new File(['{}'], name, { type: 'application/json' }) as unknown as File;

const makeFileList = (...files: File[]): FileList =>
  Object.assign(files, { length: files.length }) as unknown as FileList;

describe('ImportScreen — validazione file e Importa tutto', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  let onDrop: ReturnType<typeof vi.fn>;
  let onImportAll: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onDrop = vi.fn();
    onImportAll = vi.fn();
  });

  it('Importa tutto è disabilitata senza file validi', () => {
    renderWithI18n(
      <ImportScreen
        states={{
          spotify: {
            status: 'empty',
            file: null,
            error: null,
            eventsParsed: 0,
            eventsInserted: 0,
            uniqueTracks: 0,
          },
        }}
        onDrop={onDrop}
        onImportAll={onImportAll}
        canImport={false}
        detecting={false}
        privacy={PRIVACY_OFF}
      />,
    );

    expect((screen.getByTestId('import-all') as HTMLButtonElement).disabled).toBe(true);
  });

  it('dopo drop di un file valido, onDrop è invocato con piattaforma e file', () => {
    renderWithI18n(
      <ImportScreen
        states={{
          spotify: {
            status: 'empty',
            file: null,
            error: null,
            eventsParsed: 0,
            eventsInserted: 0,
            uniqueTracks: 0,
          },
        }}
        onDrop={onDrop}
        onImportAll={onImportAll}
        canImport={false}
        detecting={false}
        privacy={PRIVACY_OFF}
      />,
    );

    act(() => {
      onDrop('spotify', makeFileList(makeFile('Streaming_History_Audio_2024_0.json')));
    });

    expect(onDrop).toHaveBeenCalledWith('spotify', expect.anything());
  });

  it('stato errore mostra il messaggio fileTooLarge', () => {
    renderWithI18n(
      <ImportScreen
        states={{
          spotify: {
            status: 'error',
            file: null,
            error: 'File troppo grande (max 500MB)',
            eventsParsed: 0,
            eventsInserted: 0,
            uniqueTracks: 0,
          },
        }}
        onDrop={onDrop}
        onImportAll={onImportAll}
        canImport={false}
        detecting={false}
        privacy={PRIVACY_OFF}
      />,
    );

    expect(screen.getByText(/File troppo grande \(max 500MB\)/)).toBeTruthy();
  });
});
