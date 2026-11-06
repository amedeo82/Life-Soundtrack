import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useHomeTimelineData } from '../useHomeTimelineData';
import { DEMO_DB_NAME, countListens, openDb } from '@core/db';
import { makeListen, makeTrack, makeArtist, makeFeatures } from '@core/db/__tests__/helpers';

/**
 * Il hook con il **database iniettabile** — Story 3.5,
 * `docs/26-ONBOARDING-DEMO.md` v1.0 (T26.3).
 *
 * La demo passa il nome del proprio database: l'hook legge da lì e il
 * database dell'utente resta intatto.
 */

let dbName = '';

beforeEach(() => {
  dbName = `ls-demo-db-hook-${Date.now()}-${Math.random().toString(36).slice(2)}`;
});

afterEach(async () => {
  const db = await openDb(dbName);
  await db.delete();
  const demoDb = await openDb(DEMO_DB_NAME);
  await demoDb.delete();
});

describe('useHomeTimelineData con database iniettabile', () => {
  it('legge dal database passato e non dal database dell utente', async () => {
    const db = await openDb(dbName);
    await db.listens.bulkAdd([
      makeListen({
        id: 'le-demo-1',
        eventKey: 'spotify:ek-demo-1',
        trackId: 'tr-demo-1',
        timestamp: Date.UTC(2024, 0, 15, 10),
      }),
      makeListen({
        id: 'le-demo-2',
        eventKey: 'spotify:ek-demo-2',
        trackId: 'tr-demo-2',
        timestamp: Date.UTC(2024, 1, 15, 10),
      }),
    ]);
    await db.tracks.bulkAdd([
      makeTrack({ id: 'tr-demo-1', canonicalKey: 'fuzzy:ck-demo-1', artistId: 'ar-demo-1' }),
      makeTrack({ id: 'tr-demo-2', canonicalKey: 'fuzzy:ck-demo-2', artistId: 'ar-demo-2' }),
    ]);
    await db.artists.bulkAdd([
      makeArtist({ id: 'ar-demo-1', name: 'Artista 1' }),
      makeArtist({ id: 'ar-demo-2', name: 'Artista 2' }),
    ]);
    await db.features.bulkAdd([
      makeFeatures({ trackId: 'tr-demo-1', valence: 0.8, energy: 0.7, source: 'manual' }),
      makeFeatures({ trackId: 'tr-demo-2', valence: 0.7, energy: 0.6, source: 'manual' }),
    ]);

    const { result } = renderHook(() => useHomeTimelineData('months', dbName));

    await waitFor(() => {
      expect(result.current.state).not.toBe('loading');
    });

    expect(result.current.state).toBe('partial');
    expect(result.current.volume.length).toBe(2);
    expect(result.current.stats.tracks).toBe(2);

    // Il database dell'utente non è stato toccato.
    const userDb = await openDb();
    expect(await countListens(userDb)).toBe(0);
  });
});
