/**
 * Lo stoccaggio delle audio features — `21-AUDIO-FEATURES.md` v1.0 🟢 §11.
 *
 * Il nucleo della pipeline parla solo con la **porta** `FeatureStore`
 * (`types.ts`): l'implementazione Dexie vive qui, quella in memoria serve
 * ai test e al Worker (che non ha IndexedDB).
 *
 * Lo schema non cambia (`02§6`, Dexie v2): `features: '&trackId, source'`,
 * una riga per brano.
 */

import { ACOUSTICBRAINZ_TTL_MS } from './mapping';
import type { LifeSoundtrackDB } from '../db/db';
import type { AudioFeatures } from '../schema';
import type { FeatureStore } from './types';

/**
 * Il negozio delle feature su Dexie.
 *
 * @param db - il database aperto.
 * @returns il negozio `FeatureStore`.
 */
export function createDexieFeatureStore(db: LifeSoundtrackDB): FeatureStore {
  return {
    async get(trackId: string): Promise<AudioFeatures | undefined> {
      return db.features.get(trackId);
    },
    async put(feature: AudioFeatures): Promise<void> {
      await db.features.put(feature);
    },
    async all(): Promise<AudioFeatures[]> {
      return db.features.toArray();
    },
    async count(): Promise<number> {
      return db.features.count();
    },
    async delete(trackId: string): Promise<void> {
      await db.features.delete(trackId);
    },
  };
}

/** Un negozio di feature in memoria (test, Worker, ambienti senza IndexedDB). */
export interface MemoryFeatureStore extends FeatureStore {
  /** Le feature presenti, in ordine di inserimento. */
  snapshot(): AudioFeatures[];
}

/**
 * Un negozio di feature in memoria.
 *
 * @returns il negozio con il metodo `snapshot`.
 */
export function createMemoryFeatureStore(): MemoryFeatureStore {
  const rows = new Map<string, AudioFeatures>();
  return {
    async get(trackId: string): Promise<AudioFeatures | undefined> {
      return rows.get(trackId);
    },
    async put(feature: AudioFeatures): Promise<void> {
      rows.set(feature.trackId, feature);
    },
    async all(): Promise<AudioFeatures[]> {
      return [...rows.values()];
    },
    async count(): Promise<number> {
      return rows.size;
    },
    async delete(trackId: string): Promise<void> {
      rows.delete(trackId);
    },
    snapshot(): AudioFeatures[] {
      return [...rows.values()];
    },
  };
}

/**
 * La feature è scaduta?
 *
 * Il TTL vale **solo** per `acousticbrainz` (90 giorni, `21§11.2`): per
 * `essentia` e `heuristic` il calcolo è locale e deterministico, quindi la
 * riga resta valida finché lo `schemaVersion` non cambia.
 *
 * @param feature - la feature da valutare.
 * @param now - l'orologio corrente (unix ms).
 * @returns true se la feature è scaduta.
 */
export function isFeatureExpired(feature: AudioFeatures, now: number): boolean {
  if (feature.source !== 'acousticbrainz') return false;
  return now - feature.fetchedAt >= ACOUSTICBRAINZ_TTL_MS;
}

/**
 * Il LRU delle feature: oltre il limite, evict della più vecchia.
 *
 * Il criterio primario è il `lastSeenAt` del **brano** (`Track`), che
 * `AudioFeatures` non porta (`21§11.2`); quando il brano non è risolvibile
 * il criterio di riserva è il `fetchedAt` della feature (`21§19`, punto 7).
 *
 * @param store - il negozio da cui leggere e scrivere.
 * @param limit - il numero massimo di righe.
 * @param lastSeenAt - il resolver del `lastSeenAt` del brano (opzionale).
 * @returns il numero di righe evictate.
 */
export async function evictOverflowingFeatures(
  store: FeatureStore,
  limit: number,
  lastSeenAt?: (trackId: string) => Promise<number | null>,
): Promise<number> {
  const total = await store.count();
  if (total <= limit) return 0;
  const rows = await store.all();
  const scored = await Promise.all(
    rows.map(async (feature) => {
      const seen = lastSeenAt ? await lastSeenAt(feature.trackId) : null;
      return { feature, key: seen ?? feature.fetchedAt };
    }),
  );
  scored.sort((a, b) => a.key - b.key || a.feature.trackId.localeCompare(b.feature.trackId));
  const excess = total - limit;
  const victims = scored.slice(0, excess);
  for (const victim of victims) {
    await store.delete(victim.feature.trackId);
  }
  return victims.length;
}
