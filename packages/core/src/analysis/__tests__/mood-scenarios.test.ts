import { describe, expect, it } from 'vitest';
import type { MoodId } from '../../schema';
import { MoodEngine } from '../mood';
import { loadScenario, moodPayloadOf, syntheticFeaturesFor, type MoodProfile } from './helpers';

/**
 * Test del mood tracker sui **fixture di scenario** — 10-TESTING.md §3.3
 * (Story 2.1, AC "Test su fixture con scenario noto").
 *
 * I tre scenari dichiarano il mood dominante atteso in
 * `_metadata.expectedInsights.dominantMood`:
 *
 * - `lockdown-2020`: "sad o calm" (valence bassa, energia bassa);
 * - `breakup-oct2021`: "sad" (crollo di valence);
 * - `summer-roadtrip`: "happy o excited" (valence alta).
 *
 * Le **audio features** dei fixture sono sintetiche: la pipeline di
 * arricchimento (EPIC 4.1, issue #188) non è ancora implementata, quindi
 * nessun provider scrive feature vere. Il profilo di ogni scenario è
 * dichiarato qui, e il generatore è deterministico (seed derivato dall'id
 * del brano): lo stesso fixture produce sempre lo stesso mood.
 */

/** Profili di mood dei tre scenari (intervalli di valence ed energy). */
const PROFILES = {
  'lockdown-2020': { valenceMin: 0.2, valenceMax: 0.42, energyMin: 0.15, energyMax: 0.4 },
  'breakup-oct2021': { valenceMin: 0.12, valenceMax: 0.35, energyMin: 0.18, energyMax: 0.42 },
  'summer-roadtrip': { valenceMin: 0.62, valenceMax: 0.92, energyMin: 0.58, energyMax: 0.88 },
} as const satisfies Record<string, MoodProfile>;

/** Mood attesi per scenario, dalla dichiarazione del fixture. */
const EXPECTED = {
  'lockdown-2020': ['sad', 'calm'] as MoodId[],
  'breakup-oct2021': ['sad'] as MoodId[],
  'summer-roadtrip': ['happy', 'excited'] as MoodId[],
} as const satisfies Record<string, readonly MoodId[]>;

/** Il mood dominante del periodo: quello più frequente. */
function dominantMood(moods: readonly MoodId[]): MoodId {
  const counts = new Map<MoodId, number>();
  for (const mood of moods) {
    counts.set(mood, (counts.get(mood) ?? 0) + 1);
  }
  let best: MoodId = 'neutral';
  let bestCount = -1;
  for (const [mood, count] of counts) {
    if (count > bestCount) {
      best = mood;
      bestCount = count;
    }
  }
  return best;
}

describe('mood tracker sui fixture di scenario (10§3.3)', () => {
  it('lockdown-2020: il mood dominante è sad o calm, come dichiarato', async () => {
    const scenario = loadScenario('lockdown-2020');
    const features = syntheticFeaturesFor(scenario.tracks, PROFILES['lockdown-2020']);
    const engine = new MoodEngine();
    const generated = await engine.generate({ listens: scenario.listens, features });
    const days = generated.filter((mood) => mood.period === 'day');

    expect(days.length).toBeGreaterThan(60);
    expect(EXPECTED['lockdown-2020']).toContain(
      dominantMood(days.map((mood) => mood.payload.mood)),
    );

    // L'attesa dichiarata dal fixture: "sad o calm".
    expect(scenario.expectedInsights.dominantMood).toBe('sad o calm');
  });

  it('breakup-oct2021: il mood dominante è sad e la valence media è sotto 0.40', async () => {
    const scenario = loadScenario('breakup-oct2021');
    const features = syntheticFeaturesFor(scenario.tracks, PROFILES['breakup-oct2021']);
    const engine = new MoodEngine();
    const generated = await engine.generate({ listens: scenario.listens, features });
    const days = generated.filter((mood) => mood.period === 'day');

    expect(days.length).toBeGreaterThan(20);
    expect(EXPECTED['breakup-oct2021']).toContain(
      dominantMood(days.map((mood) => mood.payload.mood)),
    );

    const avgValence = days.reduce((sum, mood) => sum + mood.payload.avgValence, 0) / days.length;
    expect(avgValence).toBeLessThan(0.4);
  });

  it('summer-roadtrip: il mood dominante è happy o excited e la valence media è sopra 0.60', async () => {
    const scenario = loadScenario('summer-roadtrip');
    const features = syntheticFeaturesFor(scenario.tracks, PROFILES['summer-roadtrip']);
    const engine = new MoodEngine();
    const generated = await engine.generate({ listens: scenario.listens, features });
    const days = generated.filter((mood) => mood.period === 'day');

    expect(days.length).toBeGreaterThan(50);
    expect(EXPECTED['summer-roadtrip']).toContain(
      dominantMood(days.map((mood) => mood.payload.mood)),
    );

    const avgValence = days.reduce((sum, mood) => sum + mood.payload.avgValence, 0) / days.length;
    expect(avgValence).toBeGreaterThan(0.6);
  });

  it('ogni giorno del fixture produce un insight mood_day valido', async () => {
    const scenario = loadScenario('summer-roadtrip');
    const features = syntheticFeaturesFor(scenario.tracks, PROFILES['summer-roadtrip']);
    const engine = new MoodEngine();
    const generated = await engine.generate({ listens: scenario.listens, features });

    const days = generated.filter((mood) => mood.period === 'day');
    for (const day of days) {
      expect(day.insight.type).toBe('mood_day');
      expect(day.insight.id).toMatch(/^mood-day-\d{4}-\d{2}-\d{2}$/);
      expect(day.insight.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
      expect(day.payload.eventCount).toBeGreaterThanOrEqual(3);
      expect(day.payload.avgValence).toBeGreaterThanOrEqual(0);
      expect(day.payload.avgValence).toBeLessThanOrEqual(1);
      expect(day.payload.avgEnergy).toBeGreaterThanOrEqual(0);
      expect(day.payload.avgEnergy).toBeLessThanOrEqual(1);
      expect(moodPayloadOf(day.insight)).toBe(day.payload);
    }
  });

  it('senza feature il fixture non produce alcun insight (D-A.1)', async () => {
    const scenario = loadScenario('lockdown-2020');
    const engine = new MoodEngine();
    expect(await engine.generate({ listens: scenario.listens, features: [] })).toHaveLength(0);
  });
});
