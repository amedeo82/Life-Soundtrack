import { describe, expect, it } from 'vitest';
import {
  ACOUSTICBRAINZ_TTL_MS,
  CURRENT_FEATURE_SCHEMA_VERSION,
  FEATURE_ORIGINS,
  UNIT_FIELDS,
  clamp01,
  deriveEnergyFromMood,
  deriveValenceFromMood,
  featureOrigin,
  normalizeDeamScore,
  normalizeFeature,
  round4,
} from '../mapping';
import { createFakeClock } from './helpers';

/**
 * La normalizzazione e la mappatura dei campi — `21-AUDIO-FEATURES.md`
 * §6.2, §7.3, §11.2 (T-AF.8, T-AF.12).
 */
describe('normalizzazione DEAM [1,9] → [0,1] (21§6.2, T-AF.8)', () => {
  it('1 → 0, 5 → 0,5, 9 → 1', () => {
    expect(normalizeDeamScore(1)).toBe(0);
    expect(normalizeDeamScore(5)).toBe(0.5);
    expect(normalizeDeamScore(9)).toBe(1);
  });

  it('arrotonda a 4 decimali (determinismo: stessi byte)', () => {
    expect(normalizeDeamScore(4.123456)).toBe(0.3904);
    expect(normalizeDeamScore(7.777777)).toBe(0.8472);
  });

  it('i valori fuori [1,9] sono truncati in [0,1]', () => {
    expect(normalizeDeamScore(-3)).toBe(0);
    expect(normalizeDeamScore(12)).toBe(1);
  });
});

describe('clamp e invarianti (21§13 E8, 10§7, T-AF.12)', () => {
  it('clamp01 tronca ai due estremi', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it('un valore fuori [0,1] dal modello viene clampato e segnalato', () => {
    const warnings: Array<{ field: string; value: number; trackId: string }> = [];
    const feature = normalizeFeature(
      { valence: 1.4, energy: -0.2, danceability: 0.5 },
      'track-x',
      (field, value, trackId) => warnings.push({ field, value, trackId }),
    );

    expect(feature.valence).toBe(1);
    expect(feature.energy).toBe(0);
    expect(feature.danceability).toBe(0.5);
    expect(warnings).toEqual([
      { field: 'valence', value: 1.4, trackId: 'track-x' },
      { field: 'energy', value: -0.2, trackId: 'track-x' },
    ]);
  });

  it('i campi non coperti restano null (nessuna misura inventata)', () => {
    const feature = normalizeFeature({ valence: 0.5 }, 'track-x');
    expect(feature.acousticness).toBeNull();
    expect(feature.instrumentalness).toBeNull();
    expect(feature.speechiness).toBeNull();
    expect(feature.liveness).toBeNull();
    expect(feature.tempo).toBeNull();
    expect(feature.key).toBeNull();
    expect(feature.mode).toBeNull();
    expect(feature.loudness).toBeNull();
    expect(feature.timeSignature).toBeNull();
  });

  it('un valore non finito (NaN) diventa null ed è segnalato', () => {
    const warnings: Array<{ field: string; value: number; trackId: string }> = [];
    const feature = normalizeFeature(
      { valence: Number.NaN, energy: Number.POSITIVE_INFINITY },
      'track-nan',
      (field, value, trackId) => warnings.push({ field, value, trackId }),
    );

    expect(feature.valence).toBeNull();
    expect(feature.energy).toBeNull();
    expect(warnings.map((warning) => warning.field)).toEqual(['valence', 'energy']);
  });

  it('round4 arrotonda a quattro decimali', () => {
    expect(round4(0.123456)).toBe(0.1235);
    expect(round4(0.12344)).toBe(0.1234);
  });

  it('i campi unitari sono quelli dichiarati in 02§3.4', () => {
    expect([...UNIT_FIELDS]).toEqual([
      'valence',
      'energy',
      'danceability',
      'acousticness',
      'instrumentalness',
      'speechiness',
      'liveness',
    ]);
  });
});

describe('derivazione mood → valence/energy (21§7.3, D-AF.8)', () => {
  it('valence = P(happy) + 0,5·P(relaxed) − P(sad) − 0,5·P(aggressive)', () => {
    const valence = deriveValenceFromMood({
      mood_happy: 0.62,
      mood_sad: 0.04,
      mood_relaxed: 0.11,
      mood_aggressive: 0.02,
    });
    expect(valence).toBe(0.625);
  });

  it('energy = P(party) + P(aggressive) + 0,5·P(electronic)', () => {
    const energy = deriveEnergyFromMood({
      mood_party: 0.35,
      mood_aggressive: 0.02,
      mood_electronic: 0.44,
    });
    expect(energy).toBe(0.59);
  });

  it('il risultato è troncato in [0,1]', () => {
    expect(deriveValenceFromMood({ mood_happy: 1, mood_relaxed: 1 })).toBe(1);
    expect(deriveValenceFromMood({ mood_sad: 1, mood_aggressive: 1 })).toBe(0);
    expect(deriveEnergyFromMood({ mood_party: 1, mood_aggressive: 1, mood_electronic: 1 })).toBe(1);
  });

  it('senza classi mood la derivazione è 0, non un errore', () => {
    expect(deriveValenceFromMood({})).toBe(0);
    expect(deriveEnergyFromMood({})).toBe(0);
  });
});

describe("l'origine dichiarata di ogni campo (21§2.3, D-AF.8)", () => {
  it('Essentia misura valence/energy, ma non copre i campi che nessun provider misura', () => {
    expect(featureOrigin('essentia', 'valence')).toBe('measured');
    expect(featureOrigin('essentia', 'energy')).toBe('measured');
    expect(featureOrigin('essentia', 'tempo')).toBe('measured');
    expect(featureOrigin('essentia', 'acousticness')).toBe('none');
    expect(featureOrigin('essentia', 'instrumentalness')).toBe('none');
    expect(featureOrigin('essentia', 'speechiness')).toBe('none');
    expect(featureOrigin('essentia', 'liveness')).toBe('none');
  });

  it('AcousticBrainz: valence/energy sono derivate, danceability misurata', () => {
    expect(featureOrigin('acousticbrainz', 'valence')).toBe('derived');
    expect(featureOrigin('acousticbrainz', 'energy')).toBe('derived');
    expect(featureOrigin('acousticbrainz', 'danceability')).toBe('measured');
    expect(featureOrigin('acousticbrainz', 'tempo')).toBe('none');
  });

  it("l'euristico non stima valence ed energy (21§8.1)", () => {
    expect(featureOrigin('heuristic', 'valence')).toBe('none');
    expect(featureOrigin('heuristic', 'energy')).toBe('none');
    expect(featureOrigin('heuristic', 'tempo')).toBe('estimated');
    expect(featureOrigin('heuristic', 'danceability')).toBe('estimated');
  });

  it('la tabella copre tutti i provider e tutti i campi', () => {
    for (const source of ['essentia', 'acousticbrainz', 'heuristic', 'manual'] as const) {
      expect(Object.keys(FEATURE_ORIGINS[source])).toHaveLength(12);
    }
  });
});

describe('versioni e TTL (21§11.2)', () => {
  it('la versione corrente dello schema è 1', () => {
    expect(CURRENT_FEATURE_SCHEMA_VERSION).toBe(1);
  });

  it('il TTL di AcousticBrainz è di 90 giorni', () => {
    expect(ACOUSTICBRAINZ_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("l'orologio iniettato è utilizzabile dai test", () => {
    const clock = createFakeClock(1_000);
    expect(clock.now()).toBe(1_000);
    clock.advance(500);
    expect(clock.now()).toBe(1_500);
  });
});
