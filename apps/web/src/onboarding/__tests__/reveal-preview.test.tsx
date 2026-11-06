import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { RevealScreen } from '../OnboardingRouter';
import { buildRevealPreview } from '../revealPreview';
import { i18n } from '../../i18n';
import { openDb } from '@core/db';
import { makeListen, makeTrack, makeArtist } from '@core/db/__tests__/helpers';

/**
 * Il reveal post-import con le **prime righe reali** e l'anno **calcolato** —
 * Story 3.5, `docs/26-ONBOARDING-DEMO.md` v1.0 §4.
 */

const renderReveal = (preview: Parameters<typeof RevealScreen>[0]['preview']) =>
  render(
    <I18nextProvider i18n={i18n}>
      <RevealScreen events={preview?.events ?? 0} preview={preview} onComplete={() => {}} />
    </I18nextProvider>,
  );

const dbs: string[] = [];

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  for (const name of dbs.splice(0)) {
    const db = await openDb(name);
    await db.delete();
  }
});

describe('reveal — anteprima della timeline reale (Story 3.5)', () => {
  it('mostra almeno tre righe quando ci sono dati', () => {
    renderReveal({
      rows: [
        { start: Date.UTC(2024, 0, 1), label: '01/24', listens: 120, minutes: 420, mood: 'sad' },
        { start: Date.UTC(2024, 1, 1), label: '02/24', listens: 90, minutes: 310, mood: 'calm' },
        { start: Date.UTC(2024, 2, 1), label: '03/24', listens: 150, minutes: 540, mood: 'happy' },
      ],
      years: 3,
      events: 360,
    });

    expect(screen.getAllByTestId('reveal-preview-row')).toHaveLength(3);
    expect(screen.getByText('01/24')).toBeTruthy();
  });

  it('l anno visualizzato è calcolato, non cablato a 1', () => {
    renderReveal({
      rows: [{ start: Date.UTC(2024, 0, 1), label: '01/24', listens: 10, minutes: 30, mood: null }],
      years: 6,
      events: 2000,
    });

    expect(screen.getByText(/6 anni/)).toBeTruthy();
  });

  it('senza dati sufficienti il reveal resta il contatore e mostra lo skip', () => {
    renderReveal({ rows: [], years: 1, events: 0 });

    expect(screen.queryAllByTestId('reveal-preview-row')).toHaveLength(0);
    expect(screen.getByTestId('reveal-no-preview')).toBeTruthy();
  });

  it('buildRevealPreview calcola righe e anno dai dati reali del database', async () => {
    const name = `ls-reveal-preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dbs.push(name);
    const db = await openDb(name);

    // Tre mesi in due anni diversi: lo span vale circa due anni.
    const timestamps = [
      Date.UTC(2023, 0, 10),
      Date.UTC(2023, 1, 10),
      Date.UTC(2023, 2, 10),
      Date.UTC(2025, 0, 10),
    ];
    await db.listens.bulkAdd(
      timestamps.map((timestamp, index) =>
        makeListen({
          id: `le-reveal-${index}`,
          eventKey: `spotify:ek-reveal-${index}`,
          trackId: `tr-reveal-${index}`,
          timestamp,
        }),
      ),
    );
    await db.tracks.bulkAdd(
      timestamps.map((_, index) =>
        makeTrack({ id: `tr-reveal-${index}`, canonicalKey: `fuzzy:ck-reveal-${index}` }),
      ),
    );
    await db.artists.bulkAdd([makeArtist({ id: 'artist-reveal', name: 'Artista' })]);

    const preview = await buildRevealPreview(db);

    expect(preview.rows).toHaveLength(3);
    expect(preview.rows[0]?.listens).toBe(1);
    expect(preview.events).toBe(4);
    expect(preview.years).toBe(2);
  });
});
