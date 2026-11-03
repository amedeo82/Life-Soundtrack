import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEraNotes } from '../../hooks/useEraNotes';
import { openDb, replaceAllInsightsOfType } from '@core/db';
import type { Insight } from '@core/schema';

/**
 * Test di integrazione della rinomina dell'era — Story 3.2,
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §5 e T25.7.
 *
 * Il punto: il nome dato dall'utente **sopravvive al ricalcolo** dell'analisi
 * (`replaceAllInsightsOfType` cancella e reinserisce gli insight).
 */

let dbName = 'ls-era-rename-test';

beforeEach(() => {
  dbName = `ls-era-rename-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
});

afterEach(async () => {
  const db = await openDb(dbName);
  await db.delete();
});

/** Un'era minimale. */
function makeEra(derivedVersion = 'era-v1'): Insight {
  return {
    id: 'era-1000',
    type: 'era',
    periodStart: 1000,
    periodEnd: 2000,
    payload: {
      kind: 'era',
      label: 'Era Malinconia',
      moodDominant: 'sad',
      topArtistIds: [],
      topTrackIds: [],
      genreDistribution: {},
      avgValence: 0.3,
      avgEnergy: 0.4,
      nightShare: 0.3,
      repeatRate: 0.5,
    },
    confidence: 0.8,
    derivedVersion,
    status: 'pending',
    userNote: null,
    createdAt: 1000,
  };
}

describe("rinomina dell'era (Story 3.2)", () => {
  it('scrive il nome e le parole chiave, e li conserva al ricalcolo', async () => {
    const db = await openDb(dbName);
    await db.open();
    await db.insights.put(makeEra());

    const first = renderHook(() => useEraNotes(dbName));
    await waitFor(() => {
      expect(first.result.current.state).toBe('ready');
    });

    first.result.current.rename('era-1000', 'Il viaggio a Berlino, esame di laurea');
    await waitFor(async () => {
      expect((await db.insights.get('era-1000'))?.userNote).toBe(
        'Il viaggio a Berlino, esame di laurea',
      );
    });
    expect((await db.insights.get('era-1000'))?.status).toBe('confirmed');
    first.unmount();

    // Ricalcolo dell'analisi: gli insight vengono cancellati e reinseriti.
    await replaceAllInsightsOfType(db, {
      type: 'era',
      derivedVersion: 'era-v2',
      insights: [makeEra('era-v2')],
    });

    const second = renderHook(() => useEraNotes(dbName));
    await waitFor(() => {
      expect(second.result.current.state).toBe('ready');
    });
    expect(second.result.current.eras[0]?.userNote).toBe('Il viaggio a Berlino, esame di laurea');
  });
});
