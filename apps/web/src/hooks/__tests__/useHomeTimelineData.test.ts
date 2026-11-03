import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useHomeTimelineData } from '../useHomeTimelineData';
import { openDb } from '@core/db';
import { makeListen, makeTrack, makeArtist, makeFeatures } from '@core/db/__tests__/helpers';

/**
 * Test di useHomeTimelineData — Story 2.5, 23-ANALYSIS-PIPELINE.md v1.0 🟢.
 *
 * Copre: lettura di mood_week; weekMoodLabel popolato quando esiste.
 */

let dbName = 'ls-use-home-timeline-test';

afterEach(async () => {
  const db = await openDb(dbName);
  await db.delete();
  vi.resetAllMocks();
});

beforeEach(() => {
  dbName = `ls-use-home-timeline-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
});

describe('useHomeTimelineData (Story 2.5)', () => {
  it('legge mood_week e popola weekMoodLabel quando esiste', async () => {
    const db = await openDb(dbName);
    await db.open();

    // Inserisci listen con feature
    const listens = [
      makeListen({
        id: 'le-1',
        eventKey: 'spotify:ek-1',
        trackId: 'track-1',
        timestamp: Date.UTC(2024, 2, 15, 10),
      }),
      makeListen({
        id: 'le-2',
        eventKey: 'spotify:ek-2',
        trackId: 'track-2',
        timestamp: Date.UTC(2024, 2, 15, 11),
      }),
      makeListen({
        id: 'le-3',
        eventKey: 'spotify:ek-3',
        trackId: 'track-3',
        timestamp: Date.UTC(2024, 2, 15, 12),
      }),
    ];
    await db.listens.bulkAdd(listens);

    const tracks = [
      makeTrack({ id: 'track-1', canonicalKey: 'fuzzy:ck-1', artistId: 'artist-1' }),
      makeTrack({ id: 'track-2', canonicalKey: 'fuzzy:ck-2', artistId: 'artist-2' }),
      makeTrack({ id: 'track-3', canonicalKey: 'fuzzy:ck-3', artistId: 'artist-3' }),
    ];
    await db.tracks.bulkAdd(tracks);

    const artists = [
      makeArtist({ id: 'artist-1', name: 'Artist One' }),
      makeArtist({ id: 'artist-2', name: 'Artist Two' }),
      makeArtist({ id: 'artist-3', name: 'Artist Three' }),
    ];
    await db.artists.bulkAdd(artists);

    const features = [
      makeFeatures({ trackId: 'track-1', valence: 0.8, energy: 0.7, source: 'essentia' }),
      makeFeatures({ trackId: 'track-2', valence: 0.7, energy: 0.6, source: 'essentia' }),
      makeFeatures({ trackId: 'track-3', valence: 0.9, energy: 0.8, source: 'essentia' }),
    ];
    await db.features.bulkAdd(features);

    // Inserisci insight mood_week direttamente
    await db.insights.bulkAdd([
      {
        id: 'mood-week-1',
        type: 'mood_week',
        periodStart: Date.UTC(2024, 2, 10),
        periodEnd: Date.UTC(2024, 2, 16),
        payload: {
          kind: 'mood',
          mood: 'happy',
          avgValence: 0.8,
          avgEnergy: 0.7,
          eventCount: 3,
        },
        confidence: 0.9,
        derivedVersion: 'abcdef12',
        status: 'confirmed',
        userNote: null,
        createdAt: Date.now(),
      },
    ]);

    const { result } = renderHook(() => useHomeTimelineData('months'));

    await waitFor(() => {
      expect(result.current.state).not.toBe('loading');
    });

    // weekMoodLabel dovrebbe essere popolato dal mood_week
    expect(result.current.weekMoodLabel).toBe('happy');
  });

  it('stato no-features quando ci sono listen ma zero feature utilizzabili', async () => {
    const db = await openDb(dbName);
    await db.open();

    // Inserisci listen SENZA feature
    const listens = [
      makeListen({
        id: 'le-1',
        eventKey: 'spotify:ek-1',
        trackId: 'track-1',
        timestamp: Date.UTC(2024, 2, 15, 10),
      }),
      makeListen({
        id: 'le-2',
        eventKey: 'spotify:ek-2',
        trackId: 'track-2',
        timestamp: Date.UTC(2024, 2, 15, 11),
      }),
    ];
    await db.listens.bulkAdd(listens);

    const tracks = [
      makeTrack({ id: 'track-1', canonicalKey: 'fuzzy:ck-1', artistId: 'artist-1' }),
      makeTrack({ id: 'track-2', canonicalKey: 'fuzzy:ck-2', artistId: 'artist-2' }),
    ];
    await db.tracks.bulkAdd(tracks);

    const artists = [
      makeArtist({ id: 'artist-1', name: 'Artist One' }),
      makeArtist({ id: 'artist-2', name: 'Artist Two' }),
    ];
    await db.artists.bulkAdd(artists);

    // NESSUNA feature inserita

    const { result } = renderHook(() => useHomeTimelineData('months'));

    await waitFor(() => {
      expect(result.current.state).not.toBe('loading');
    });

    // Stato deve essere no-features
    expect(result.current.state).toBe('no-features');
  });

  it('stato empty quando zero listen', async () => {
    const db = await openDb(dbName);
    await db.open();
    // DB vuoto

    const { result } = renderHook(() => useHomeTimelineData('months'));

    await waitFor(() => {
      expect(result.current.state).not.toBe('loading');
    });

    expect(result.current.state).toBe('empty');
  });
});
