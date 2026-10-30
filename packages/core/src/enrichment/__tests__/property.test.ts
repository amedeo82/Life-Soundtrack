import { describe, expect, it } from 'vitest';
import { createEnrichmentCascade } from '../cascade';
import {
  deriveEnergyFromMood,
  deriveValenceFromMood,
  normalizeDeamScore,
  normalizeFeature,
} from '../mapping';
import { createMemoryFeatureStore } from '../storage';
import type { AudioFeatureProvider } from '../types';
import { createFakeClock, makeContext, makeTrack, mulberry32 } from './helpers';

/**
 * I **property test** delle invarianti — `21-AUDIO-FEATURES.md` §6.2,
 * §15.3, `10-TESTING.md` §7.
 *
 * `fast-check` non è disponibile nel repository (nessuna dipendenza
 * nuova: il progetto non aggiunge librerie per un test), quindi il
 * generatore è locale: **mulberry32 con seme esplicito**. Il vantaggio è
 * che un fallimento è riproducibile: il seme è nel messaggio
 * dell'asserzione.
 */

/** Il seme dei property test: cambiandolo si cambia il campione. */
const SEED = 0x21a1fea7;

/** Quanti campioni genera il property test. */
const SAMPLES = 500;

/** Un valore grezzo "da modello": può essere fuori intervallo (E8). */
function rawScore(random: () => number): number {
  const bucket = random();
  if (bucket < 0.25) return random() * 9; // [0,9]
  if (bucket < 0.5) return 1 + random() * 8; // [1,9] (DEAM)
  if (bucket < 0.75) return random() * 2 - 0.5; // fuori [0,1]
  return random() * 200 - 100; // wildly out of range
}

describe('gli invarianti di 10§7 (property-based)', () => {
  it('la normalizzazione DEAM produce sempre valori in [0,1]', () => {
    const random = mulberry32(SEED);
    for (let i = 0; i < SAMPLES; i += 1) {
      const value = normalizeDeamScore(rawScore(random));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('i campi unitari sono sempre in [0,1], anche partendo da valori assurdi', () => {
    const random = mulberry32(SEED);
    for (let i = 0; i < SAMPLES; i += 1) {
      const normalized = normalizeFeature(
        {
          valence: rawScore(random),
          energy: rawScore(random),
          danceability: rawScore(random),
          acousticness: rawScore(random),
          instrumentalness: rawScore(random),
          speechiness: rawScore(random),
          liveness: rawScore(random),
        },
        `track-${i}`,
      );
      for (const value of [
        normalized.valence,
        normalized.energy,
        normalized.danceability,
        normalized.acousticness,
        normalized.instrumentalness,
        normalized.speechiness,
        normalized.liveness,
      ]) {
        if (value === null) continue;
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('la derivazione mood → valence/energy è sempre in [0,1]', () => {
    const random = mulberry32(SEED);
    for (let i = 0; i < SAMPLES; i += 1) {
      const mood = {
        mood_happy: random(),
        mood_sad: random(),
        mood_relaxed: random(),
        mood_party: random(),
        mood_aggressive: random(),
        mood_acoustic: random(),
        mood_electronic: random(),
        danceable: random(),
      };
      const valence = deriveValenceFromMood(mood);
      const energy = deriveEnergyFromMood(mood);
      expect(valence).toBeGreaterThanOrEqual(0);
      expect(valence).toBeLessThanOrEqual(1);
      expect(energy).toBeGreaterThanOrEqual(0);
      expect(energy).toBeLessThanOrEqual(1);
    }
  });

  it('la cascata non scrive mai una feature fuori [0,1]', async () => {
    const random = mulberry32(SEED);
    const store = createMemoryFeatureStore();
    const provider: AudioFeatureProvider = {
      id: 'essentia',
      canHandle: () => true,
      fetch: async (track) => ({
        trackId: track.id,
        valence: rawScore(random),
        energy: rawScore(random),
        danceability: rawScore(random),
        acousticness: null,
        instrumentalness: null,
        speechiness: null,
        liveness: null,
        tempo: 120,
        key: 3,
        mode: 1,
        loudness: -8.5,
        timeSignature: 4,
        source: 'essentia',
        fetchedAt: 0,
        schemaVersion: 1,
      }),
    };
    const cascade = createEnrichmentCascade({
      store,
      policy: { isEnabled: () => true },
      clock: createFakeClock(),
      providers: { essentia: provider },
    });

    for (let i = 0; i < 50; i += 1) {
      await cascade.enrich(makeTrack({ id: `track-${i}` }), makeContext());
    }

    const rows = await store.all();
    expect(rows).toHaveLength(50);
    for (const row of rows) {
      for (const value of [row.valence, row.energy, row.danceability]) {
        if (value === null) continue;
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
