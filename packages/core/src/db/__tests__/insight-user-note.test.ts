import { afterEach, describe, expect, it } from 'vitest';
import {
  listInsightsByType,
  replaceAllInsightsOfType,
  replaceInsightsOfType,
  setInsightStatus,
  setInsightUserNote,
} from '../insights';
import { openDb, type LifeSoundtrackDB } from '../db';
import type { Insight } from '../../schema';

/**
 * Test della nota e dello stato dell'utente sugli insight — Story 3.2,
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §1 e T25.1/T25.2.
 *
 * Il punto non negoziabile: la rinomina di un'era **sopravvive** al
 * ricalcolo dell'analisi (`replaceAllInsightsOfType` cancella e reinserisce).
 */

const dbNames: string[] = [];

async function freshDb(): Promise<LifeSoundtrackDB> {
  const name = `ls-insight-user-note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  dbNames.push(name);
  const db = await openDb(name);
  await db.open();
  return db;
}

afterEach(async () => {
  while (dbNames.length > 0) {
    const name = dbNames.pop();
    if (!name) continue;
    const db = await openDb(name);
    await db.delete();
  }
});

/** Un'era minima. */
function makeEra(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'era-1000',
    type: 'era',
    periodStart: 1000,
    periodEnd: 2000,
    payload: {
      kind: 'era',
      label: 'Era di prova',
      moodDominant: 'calm',
      topArtistIds: [],
      topTrackIds: [],
      genreDistribution: {},
      avgValence: 0.5,
      avgEnergy: 0.5,
      nightShare: 0.2,
      repeatRate: 0.4,
    },
    confidence: 0.8,
    derivedVersion: 'era-v1',
    status: 'pending',
    userNote: null,
    createdAt: 1000,
    ...overrides,
  };
}

describe('setInsightUserNote / setInsightStatus (Story 3.2)', () => {
  it("scrive la nota e lo stato dell'utente", async () => {
    const db = await freshDb();
    await db.insights.put(makeEra());

    const updated = await setInsightUserNote(db, 'era-1000', {
      userNote: 'Il viaggio a Berlino, esame di laurea',
      status: 'confirmed',
    });

    expect(updated?.userNote).toBe('Il viaggio a Berlino, esame di laurea');
    expect(updated?.status).toBe('confirmed');
    const stored = await db.insights.get('era-1000');
    expect(stored?.userNote).toBe('Il viaggio a Berlino, esame di laurea');
    expect(stored?.status).toBe('confirmed');
  });

  it('restituisce null su un id inesistente (nessuna scrittura fantasma)', async () => {
    const db = await freshDb();
    const updated = await setInsightUserNote(db, 'era-inesistente', {
      userNote: 'x',
      status: 'confirmed',
    });
    expect(updated).toBeNull();
    expect(await db.insights.count()).toBe(0);
  });

  it('nasconde un ricordo senza cancellarlo dal database', async () => {
    const db = await freshDb();
    await db.insights.put(makeEra({ id: 'mem-1', type: 'memory' }));

    const updated = await setInsightStatus(db, 'mem-1', 'dismissed');

    expect(updated?.status).toBe('dismissed');
    expect(await db.insights.count()).toBe(1);
    const stored = await db.insights.get('mem-1');
    expect(stored).not.toBeUndefined();
    expect(stored?.status).toBe('dismissed');
  });
});

describe("preservazione dei campi dell'utente al ricalcolo (T25.2)", () => {
  it("replaceAllInsightsOfType conserva il nome dell'era", async () => {
    const db = await freshDb();
    await db.insights.put(makeEra());
    await setInsightUserNote(db, 'era-1000', {
      userNote: 'Il viaggio a Berlino',
      status: 'confirmed',
    });

    await replaceAllInsightsOfType(db, {
      type: 'era',
      derivedVersion: 'era-v2',
      insights: [makeEra({ derivedVersion: 'era-v2' })],
    });

    const stored = await db.insights.get('era-1000');
    expect(stored?.userNote).toBe('Il viaggio a Berlino');
    expect(stored?.status).toBe('confirmed');
    expect(stored?.derivedVersion).toBe('era-v2');
  });

  it('replaceAllInsightsOfType conserva lo stato dismissed', async () => {
    const db = await freshDb();
    await db.insights.put(makeEra());
    await setInsightStatus(db, 'era-1000', 'dismissed');

    await replaceAllInsightsOfType(db, {
      type: 'era',
      derivedVersion: 'era-v2',
      insights: [makeEra({ derivedVersion: 'era-v2' })],
    });

    expect((await db.insights.get('era-1000'))?.status).toBe('dismissed');
  });

  it('replaceInsightsOfType conserva la nota anche per i batch', async () => {
    const db = await freshDb();
    await db.insights.put(makeEra());
    await setInsightUserNote(db, 'era-1000', {
      userNote: 'Estate',
      status: 'confirmed',
    });

    await replaceInsightsOfType(db, {
      type: 'era',
      derivedVersion: 'era-v1',
      insights: [makeEra()],
    });

    expect((await db.insights.get('era-1000'))?.userNote).toBe('Estate');
  });

  it("non inventa campi dell'utente su un insight nuovo", async () => {
    const db = await freshDb();
    await replaceAllInsightsOfType(db, {
      type: 'era',
      derivedVersion: 'era-v1',
      insights: [makeEra()],
    });

    const stored = await db.insights.get('era-1000');
    expect(stored?.userNote).toBeNull();
    expect(stored?.status).toBe('pending');
  });

  it('il ricalcolo di un tipo diverso non tocca le note delle ere', async () => {
    const db = await freshDb();
    await db.insights.put(makeEra());
    await setInsightUserNote(db, 'era-1000', { userNote: 'Estate', status: 'confirmed' });

    await replaceAllInsightsOfType(db, {
      type: 'memory',
      derivedVersion: 'memory-v1',
      insights: [],
    });

    const eras = await listInsightsByType(db, 'era');
    expect(eras).toHaveLength(1);
    expect(eras[0]?.userNote).toBe('Estate');
  });
});
