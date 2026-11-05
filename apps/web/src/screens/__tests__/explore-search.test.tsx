/**
 * Test di Esplora (⑨) — Story 3.3, spec `docs/25-MEMORIES-SHARE-EXPLORE.md` §6.
 *
 * Copre i tre vincoli della story: la ricerca filtra **solo** i dati
 * dell'utente (nessuna rete), i risultati sono ordinati per `listenCount` e
 * il percorso è locale.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../../i18n';
import { ExploreScreen } from '../ExploreScreen';
import { openDb } from '@core/db';
import { makeAlbum, makeArtist, makeTrack } from '@core/db/__tests__/helpers';
import type { Insight, MoodId } from '@core/schema';

let dbName = 'ls-explore-search-test';

beforeEach(async () => {
  dbName = `ls-explore-search-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  const db = await openDb(dbName);
  await db.delete();
  vi.restoreAllMocks();
});

/** Un insight `mood_day` (il tab Mood). */
function makeMoodInsight(id: string, day: number, mood: MoodId): Insight {
  return {
    id,
    type: 'mood_day',
    periodStart: Date.UTC(2026, 0, day),
    periodEnd: Date.UTC(2026, 0, day, 23, 59),
    payload: { kind: 'mood', mood, avgValence: 0.5, avgEnergy: 0.5, eventCount: 3 },
    confidence: 0.8,
    derivedVersion: 'mood-v1',
    status: 'pending',
    userNote: null,
    createdAt: Date.UTC(2026, 0, day),
  };
}

/** Il catalogo dell'utente: due artisti, due brani, un album. */
async function seed(): Promise<void> {
  const db = await openDb(dbName);
  await db.open();
  await db.artists.bulkPut([
    makeArtist({ id: 'artist-1', name: 'Beatles', listenCount: 30 }),
    makeArtist({ id: 'artist-2', name: 'Radiohead', listenCount: 10 }),
    makeArtist({ id: 'artist-3', name: 'Beethoven', listenCount: 20 }),
  ]);
  await db.tracks.bulkPut([
    makeTrack({
      id: 'track-1',
      name: 'Let It Be',
      artistId: 'artist-1',
      listenCount: 30,
      genres: ['rock'],
    }),
    makeTrack({
      id: 'track-2',
      name: 'Creep',
      artistId: 'artist-2',
      listenCount: 10,
      genres: ['rock'],
    }),
  ]);
  await db.albums.bulkPut([makeAlbum({ id: 'album-1', name: 'Abbey Road', artistId: 'artist-1' })]);
  await db.insights.bulkPut([
    makeMoodInsight('mood-1', 1, 'happy'),
    makeMoodInsight('mood-2', 2, 'sad'),
  ]);
}

function renderExplore(onFocus = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <ExploreScreen dbName={dbName} onFocus={onFocus} />
    </I18nextProvider>,
  );
  return onFocus;
}

describe('Esplora (⑨) — ricerca sui propri dati', () => {
  it('ordina i risultati per listenCount decrescente', async () => {
    await seed();
    renderExplore();

    await waitFor(() => {
      expect(screen.getByTestId('explore-result-artist-1')).toBeTruthy();
    });

    const titles = Array.from(
      screen.getByTestId('explore-results').querySelectorAll('.explore__result-title'),
    ).map((node) => node.textContent);
    // Beatles (30) prima di Beethoven (20) prima di Radiohead (10).
    expect(titles).toEqual(['Beatles', 'Beethoven', 'Radiohead']);
  });

  it('filtra sui propri dati senza fare richieste di rete', async () => {
    await seed();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderExplore();

    await waitFor(() => {
      expect(screen.getByTestId('explore-result-artist-1')).toBeTruthy();
    });

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beat' } });

    await waitFor(
      () => {
        expect(screen.queryByTestId('explore-result-artist-2')).toBeNull();
        expect(screen.getByTestId('explore-result-artist-1')).toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('il tab Brani mostra il nome e il titolo del risultato', async () => {
    await seed();
    renderExplore();
    await waitFor(() => {
      expect(screen.getByTestId('explore-result-artist-1')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('explore-tab-tracks'));
    await waitFor(() => {
      expect(screen.getByTestId('explore-result-track-1')).toBeTruthy();
    });
    const result = screen.getByTestId('explore-result-track-1');
    expect(result.textContent).toContain('Let It Be');
    expect(result.textContent).toContain('Beatles');
  });

  it('il tab Mood filtra sui periodi con quel mood', async () => {
    await seed();
    renderExplore();
    await waitFor(() => {
      expect(screen.getByTestId('explore-result-artist-1')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('explore-tab-mood'));
    await waitFor(() => {
      expect(screen.getByTestId('explore-result-mood-1')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('explore-mood-sad'));
    await waitFor(() => {
      expect(screen.queryByTestId('explore-result-mood-1')).toBeNull();
      expect(screen.getByTestId('explore-result-mood-2')).toBeTruthy();
    });
  });

  it('senza risultati la schermata lo dice (nessun silenzio)', async () => {
    await seed();
    renderExplore();
    await waitFor(() => {
      expect(screen.getByTestId('explore-result-artist-1')).toBeTruthy();
    });

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nessuno' } });
    await waitFor(
      () => {
        expect(screen.getByTestId('explore-no-results')).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });
});
