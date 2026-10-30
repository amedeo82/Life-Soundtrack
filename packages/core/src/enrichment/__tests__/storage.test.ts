import { describe, expect, it } from 'vitest';
import {
  createDexieFeatureStore,
  createMemoryFeatureStore,
  evictOverflowingFeatures,
  isFeatureExpired,
} from '../storage';
import type { AudioFeatures } from '../../schema';
import { freshDb, makeFeatures } from '../../db/__tests__/helpers';

/**
 * Lo stoccaggio delle feature — `21-AUDIO-FEATURES.md` §11 (TTL, LRU).
 */

/** Una feature con `source` e `fetchedAt` dichiarati. */
function feature(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return makeFeatures({ fetchedAt: 1_000, schemaVersion: 1, ...overrides });
}

describe('il negozio in memoria', () => {
  it('scrive, legge e conta', async () => {
    const store = createMemoryFeatureStore();
    await store.put(feature({ trackId: 'a' }));

    expect((await store.get('a'))?.trackId).toBe('a');
    expect(await store.count()).toBe(1);
    expect(store.snapshot()).toHaveLength(1);
  });

  it('la stessa trackId sovrascrive (una riga per brano, 02§6)', async () => {
    const store = createMemoryFeatureStore();
    await store.put(feature({ trackId: 'a', valence: 0.1 }));
    await store.put(feature({ trackId: 'a', valence: 0.9 }));

    expect(await store.count()).toBe(1);
    expect((await store.get('a'))?.valence).toBe(0.9);
  });

  it('delete() rimuove la riga', async () => {
    const store = createMemoryFeatureStore();
    await store.put(feature({ trackId: 'a' }));
    await store.delete('a');

    expect(await store.get('a')).toBeUndefined();
  });
});

describe('il negozio Dexie', () => {
  it('scrive e rilegge dalla tabella features', async () => {
    const db = freshDb('ls-enrichment-store');
    const store = createDexieFeatureStore(db);
    const row = feature({ trackId: 'a', source: 'essentia' });

    await store.put(row);

    expect(await store.get('a')).toEqual(row);
    expect(await store.count()).toBe(1);
    expect(await store.all()).toHaveLength(1);
    await store.delete('a');
    expect(await store.count()).toBe(0);
  });
});

describe('il TTL (21§11.2)', () => {
  it('solo AcousticBrainz ha un TTL (90 giorni)', () => {
    const now = 1_700_000_000_000;
    const acoustic = feature({ source: 'acousticbrainz', fetchedAt: now });
    const essentia = feature({ source: 'essentia', fetchedAt: now });
    const heuristic = feature({ source: 'heuristic', fetchedAt: now });

    expect(isFeatureExpired(acoustic, now + 89 * 24 * 3600 * 1000)).toBe(false);
    expect(isFeatureExpired(acoustic, now + 91 * 24 * 3600 * 1000)).toBe(true);
    expect(isFeatureExpired(essentia, now + 365 * 24 * 3600 * 1000)).toBe(false);
    expect(isFeatureExpired(heuristic, now + 365 * 24 * 3600 * 1000)).toBe(false);
  });
});

describe('il LRU (21§11.2, §12 E12)', () => {
  it('oltre il limite evict della più vecchia', async () => {
    const store = createMemoryFeatureStore();
    await store.put(feature({ trackId: 'vecchia', fetchedAt: 100 }));
    await store.put(feature({ trackId: 'media', fetchedAt: 200 }));
    await store.put(feature({ trackId: 'nuova', fetchedAt: 300 }));

    const evicted = await evictOverflowingFeatures(store, 2);

    expect(evicted).toBe(1);
    expect(await store.get('vecchia')).toBeUndefined();
    expect(await store.count()).toBe(2);
  });

  it('il resolver del lastSeenAt del brano ha la precedenza sul fetchedAt', async () => {
    const store = createMemoryFeatureStore();
    await store.put(feature({ trackId: 'a', fetchedAt: 100 }));
    await store.put(feature({ trackId: 'b', fetchedAt: 200 }));

    const evicted = await evictOverflowingFeatures(store, 1, async (trackId) =>
      trackId === 'a' ? 900 : 100,
    );

    expect(evicted).toBe(1);
    expect(await store.get('b')).toBeUndefined();
    expect(await store.get('a')).toBeDefined();
  });

  it('sotto il limite non evicta nulla', async () => {
    const store = createMemoryFeatureStore();
    await store.put(feature({ trackId: 'a' }));

    expect(await evictOverflowingFeatures(store, 10)).toBe(0);
    expect(await store.count()).toBe(1);
  });
});
