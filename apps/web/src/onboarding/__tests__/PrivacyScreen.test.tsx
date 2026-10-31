import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { PrivacyScreen } from '../OnboardingRouter';
import { i18n } from '../../i18n';

const renderWithI18n = (ui: React.ReactElement) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('PrivacyScreen — 4 toggle (02-DATA-SCHEMA §3.8)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  it('mostra i 4 toggle privacy e il CTA', () => {
    renderWithI18n(
      <PrivacyScreen
        privacy={{
          retainIp: false,
          retainCountry: true,
          retainCity: false,
          retainDeviceType: true,
          retainDeviceDetail: false,
          deriveContext: true,
          enrichMetadata: false,
          carDetectionConsent: false,
          scrobbleHubs: [],
          syncCloud: false,
        }}
        onChange={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByTestId('toggle-retainIp')).toBeTruthy();
    expect(screen.getByTestId('toggle-enrichMetadata')).toBeTruthy();
    expect(screen.getByTestId('toggle-carDetectionConsent')).toBeTruthy();
    expect(screen.getByTestId('toggle-syncCloud')).toBeTruthy();
    expect(screen.getByTestId('privacy-cta')).toBeTruthy();
    expect(screen.getByText(/I tuoi dati, solo tuoi/i)).toBeTruthy();
  });
});
