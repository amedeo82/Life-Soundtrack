import { describe, expect, it } from 'vitest';
import type { AudioFeatures, ListenEvent, MoodId } from '../../schema';
import {
  buildFeatureIndex,
  classifyMood,
  computeMoodForPeriod,
  computeMoodDerivedVersion,
  DEFAULT_MOOD_CONFIG,
  isAnalysisFeatureSource,
  MoodEngine,
  moodInsightId,
  resolveMoodConfig,
  weightedAverage,
} from '../mood';
import { AnalysisPipeline, createMoodGenerator } from '../pipeline';

/**
 * Test del mood tracker — 04-ANALYSIS-ALGORITHMS.md v1.0 🟢 §3 (Story 2.1).
 *
 * Copre: la mappa dei sei quadranti (§3.2), la media ponderata (§3.3), i
 * parametri (§3.4), l'esempio numerico (§3.5), gli invarianti (§3.6) e il
 * contratto con le audio features (21-AUDIO-FEATURES.md §12).
 */

const CONFIG = DEFAULT_MOOD_CONFIG;

/** Costruisce un ascolto di prova. */
function listen(overrides: Partial<ListenEvent> = {}): ListenEvent {
  return {
    id: 'le-1',
    eventKey: 'spotify:ek-1',
    platform: 'spotify',
    importId: 'imp-1',
    timestamp: Date.UTC(2024, 2, 15, 20, 0, 0),
    startedAt: Date.UTC(2024, 2, 15, 19, 56, 0),
    durationMs: 240_000,
    trackId: 't-1',
    completed: true,
    skipped: false,
    shuffle: null,
    offline: null,
    incognito: null,
    reasonStart: null,
    reasonEnd: null,
    deviceType: 'mobile',
    deviceDetail: null,
    ip: null,
    country: 'IT',
    day: '2024-03-15',
    ...overrides,
  };
}

/** Costruisce una feature audio di prova. */
function feature(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    trackId: 't-1',
    valence: 0.5,
    energy: 0.5,
    danceability: null,
    acousticness: null,
    instrumentalness: null,
    speechiness: null,
    liveness: null,
    tempo: null,
    key: null,
    mode: null,
    loudness: null,
    timeSignature: null,
    source: 'essentia',
    fetchedAt: 0,
    schemaVersion: 1,
    ...overrides,
  };
}

describe('classificazione valence/energy → mood (04§3.2)', () => {
  const cases: ReadonlyArray<readonly [number, number, MoodId]> = [
    // La tabella di 04§3.2 riga per riga.
    [0.3, 0.4, 'sad'],
    [0.39, 0.5, 'angry'],
    [0.7, 0.4, 'calm'],
    [0.7, 0.6, 'happy'],
    [0.8, 0.8, 'excited'],
    // La fascia neutra è centrale e non un punto.
    [0.5, 0.5, 'neutral'],
    [0.4, 0.4, 'neutral'],
    [0.6, 0.6, 'neutral'],
  ];

  for (const [valence, energy, expected] of cases) {
    it(`classifica (${valence}, ${energy}) come ${expected}`, () => {
      expect(classifyMood(valence, energy, CONFIG)).toBe(expected);
    });
  }

  it('la fascia neutra sovrascrive sad, angry, calm e happy', () => {
    // Valence ed energy nella fascia [0.4, 0.6]: il risultato è neutral anche
    // se le soglie del quadrante cadrebbero su sad/calm.
    expect(classifyMood(0.42, 0.58, CONFIG)).toBe('neutral');
    expect(classifyMood(0.58, 0.42, CONFIG)).toBe('neutral');
    // La sovrascrittura vale anche per angry: 0.49 è nella fascia, 0.49 < 0.5
    // cadrebbe su angry senza la priorità della fascia neutra.
    expect(classifyMood(0.49, 0.5, CONFIG)).toBe('neutral');
  });

  it('fuori dalla fascia neutra valgono le soglie del quadrante', () => {
    // 0.39 è sotto la fascia, 0.61 sopra: nessuna sovrascrittura neutra.
    expect(classifyMood(0.39, 0.39, CONFIG)).toBe('sad');
    expect(classifyMood(0.61, 0.61, CONFIG)).toBe('happy');
  });

  it('i parametri configurabili spostano le soglie', () => {
    const config = resolveMoodConfig({ valenceThreshold: 0.3, energyThreshold: 0.3 });
    expect(classifyMood(0.35, 0.35, config)).toBe('neutral');
    expect(classifyMood(0.35, 0.35, CONFIG)).toBe('sad');
  });
});

describe('media ponderata (04§3.3)', () => {
  it('pesa per durata/4 minuti', () => {
    // 200s → 0.83, 240s → 1.0 (arrotondati a due decimali).
    const average = weightedAverage([
      { value: 1, weight: 0.83 },
      { value: 3, weight: 1 },
    ]);
    expect(average).not.toBeNull();
    expect(average!).toBeCloseTo((1 * 0.83 + 3 * 1) / 1.83, 6);
  });

  it('senza peso totale non produce un valore (NaN)', () => {
    expect(weightedAverage([{ value: 1, weight: 0 }])).toBeNull();
    expect(weightedAverage([])).toBeNull();
  });
});

describe('mood di periodo (04§3.3, §3.5)', () => {
  it("l'esempio numerico di 04§3.5 classifica il periodo come happy", () => {
    const events = [
      listen({ id: 'a', trackId: 't-a', durationMs: 200_000 }),
      listen({ id: 'b', trackId: 't-b', durationMs: 240_000 }),
      listen({ id: 'c', trackId: 't-c', durationMs: 180_000 }),
      listen({ id: 'd', trackId: 't-d', durationMs: 300_000 }),
      listen({ id: 'e', trackId: 't-e', durationMs: 220_000 }),
    ];
    const features = [
      feature({ trackId: 't-a', valence: 0.3, energy: 0.4 }),
      feature({ trackId: 't-b', valence: 0.7, energy: 0.8 }),
      feature({ trackId: 't-c', valence: 0.4, energy: 0.6 }),
      feature({ trackId: 't-d', valence: 0.8, energy: 0.9 }),
      feature({ trackId: 't-e', valence: 0.5, energy: 0.5 }),
    ];
    const payload = computeMoodForPeriod(events, buildFeatureIndex(features), CONFIG);
    expect(payload).not.toBeNull();
    // 04§3.5: valence ≥ 0.5 ed energy in [0.5, 0.75) → happy.
    expect(payload!.mood).toBe('happy');
    expect(payload!.avgValence).toBeGreaterThan(0.5);
    expect(payload!.avgEnergy).toBeGreaterThanOrEqual(0.5);
    expect(payload!.avgEnergy).toBeLessThan(0.75);
    expect(payload!.eventCount).toBe(5);
  });

  it('sotto la soglia di eventi non produce alcun insight', () => {
    const events = [listen({ id: 'a', trackId: 't-a' }), listen({ id: 'b', trackId: 't-b' })];
    const features = [
      feature({ trackId: 't-a', valence: 0.8, energy: 0.8 }),
      feature({ trackId: 't-b', valence: 0.8, energy: 0.8 }),
    ];
    expect(computeMoodForPeriod(events, buildFeatureIndex(features), CONFIG)).toBeNull();
  });

  it('senza feature non produce alcun insight (D-A.1: nessun segnale inventato)', () => {
    const events = [listen({ id: 'a' }), listen({ id: 'b' }), listen({ id: 'c' })];
    expect(computeMoodForPeriod(events, buildFeatureIndex([]), CONFIG)).toBeNull();
  });

  it('una feature senza energy non è utilizzabile (nessun NaN)', () => {
    const events = [listen({ id: 'a' }), listen({ id: 'b' }), listen({ id: 'c' })];
    const features = [
      feature({ trackId: 't-1', valence: 0.8, energy: null }),
      feature({ trackId: 't-1', valence: 0.8, energy: null }),
      feature({ trackId: 't-1', valence: 0.8, energy: null }),
    ];
    expect(computeMoodForPeriod(events, buildFeatureIndex(features), CONFIG)).toBeNull();
  });
});

describe('filtro delle sorgenti (21§12, D-AF.4)', () => {
  it('accetta essentia, acousticbrainz e manual', () => {
    expect(isAnalysisFeatureSource('essentia')).toBe(true);
    expect(isAnalysisFeatureSource('acousticbrainz')).toBe(true);
    expect(isAnalysisFeatureSource('manual')).toBe(true);
  });

  it('rifiuta la stima euristica', () => {
    expect(isAnalysisFeatureSource('heuristic')).toBe(false);
  });

  it('le feature euristiche sono invisibili al layer di analisi', () => {
    const events = [listen({ id: 'a' }), listen({ id: 'b' }), listen({ id: 'c' })];
    const features = [feature({ trackId: 't-1', valence: 0.9, energy: 0.9, source: 'heuristic' })];
    expect(computeMoodForPeriod(events, buildFeatureIndex(features), CONFIG)).toBeNull();
  });
});

describe('parametri e derivedVersion (04§3.4, §9)', () => {
  it('i default sono quelli di 04§3.4', () => {
    expect(DEFAULT_MOOD_CONFIG.valenceThreshold).toBe(0.5);
    expect(DEFAULT_MOOD_CONFIG.energyThreshold).toBe(0.5);
    expect(DEFAULT_MOOD_CONFIG.neutralBand).toBe(0.1);
    expect(DEFAULT_MOOD_CONFIG.excitedEnergyThreshold).toBe(0.75);
    expect(DEFAULT_MOOD_CONFIG.minEventsPerPeriod).toBe(3);
  });

  it('la derivedVersion è deterministica e cambia coi parametri', async () => {
    const version = await computeMoodDerivedVersion(CONFIG);
    expect(version).toMatch(/^[0-9a-f]{8}$/);
    expect(await computeMoodDerivedVersion(resolveMoodConfig())).toBe(version);
    expect(await computeMoodDerivedVersion(resolveMoodConfig({ minEventsPerPeriod: 5 }))).not.toBe(
      version,
    );
  });

  it('resolveMoodConfig mantiene l’ordine delle chiavi', () => {
    expect(Object.keys(resolveMoodConfig())).toEqual(Object.keys(DEFAULT_MOOD_CONFIG));
  });
});

describe('motore (04§3, §8)', () => {
  it('genera un insight per giorno, settimana e mese', async () => {
    const engine = new MoodEngine();
    const listens = [
      listen({ id: 'a', trackId: 't-1', startedAt: Date.UTC(2024, 2, 15, 10) }),
      listen({ id: 'b', trackId: 't-2', startedAt: Date.UTC(2024, 2, 15, 11) }),
      listen({ id: 'c', trackId: 't-3', startedAt: Date.UTC(2024, 2, 15, 12) }),
      listen({ id: 'd', trackId: 't-4', startedAt: Date.UTC(2024, 2, 16, 11) }),
      listen({ id: 'e', trackId: 't-5', startedAt: Date.UTC(2024, 2, 16, 12) }),
      listen({ id: 'f', trackId: 't-6', startedAt: Date.UTC(2024, 2, 16, 13) }),
    ];
    const features = listens.map((event) =>
      feature({ trackId: event.trackId, valence: 0.8, energy: 0.8 }),
    );
    const generated = await engine.generate({ listens, features });
    const types = new Set(generated.map((mood) => mood.insight.type));
    expect(types).toEqual(new Set(['mood_day', 'mood_week', 'mood_month']));
    // Due giorni (15 e 16 marzo), una sola settimana, un solo mese.
    expect(generated.filter((mood) => mood.period === 'day')).toHaveLength(2);
    expect(generated.filter((mood) => mood.period === 'week')).toHaveLength(1);
    expect(generated.filter((mood) => mood.period === 'month')).toHaveLength(1);
  });

  it('gli id sono deterministici e distinti per periodo', async () => {
    const engine = new MoodEngine();
    const listens = [listen({ id: 'a' }), listen({ id: 'b' }), listen({ id: 'c' })];
    const features = [feature({ valence: 0.8, energy: 0.8 })];
    const first = await engine.generate({ listens, features });
    const second = await engine.generate({ listens, features });
    expect(first.map((mood) => mood.insight.id)).toEqual(second.map((mood) => mood.insight.id));
    expect(new Set(first.map((mood) => mood.insight.id)).size).toBe(first.length);
    expect(moodInsightId('day', '2024-03-15')).toBe('mood-day-2024-03-15');
  });

  it('senza feature il motore non produce insight', async () => {
    const engine = new MoodEngine();
    const listens = [listen({ id: 'a' }), listen({ id: 'b' }), listen({ id: 'c' })];
    expect(await engine.generate({ listens, features: [] })).toHaveLength(0);
  });

  it('gli insight portano la derivedVersion dei parametri', async () => {
    const engine = new MoodEngine({ config: { minEventsPerPeriod: 2 } });
    const listens = [listen({ id: 'a' }), listen({ id: 'b' })];
    const features = [feature({ valence: 0.8, energy: 0.8 })];
    const generated = await engine.generate({ listens, features });
    expect(generated.length).toBeGreaterThan(0);
    for (const mood of generated) {
      expect(mood.insight.derivedVersion).toBe(await engine.derivedVersion());
      expect(mood.insight.status).toBe('pending');
    }
  });

  it('rispetta gli invarianti di 04§3.6', async () => {
    const engine = new MoodEngine();
    const listens = [listen({ id: 'a' }), listen({ id: 'b' }), listen({ id: 'c' })];
    const features = [feature({ valence: 0.63, energy: 0.28 })];
    const generated = await engine.generate({ listens, features });
    for (const mood of generated) {
      const { avgValence, avgEnergy, mood: value } = mood.payload;
      expect(value).toMatch(/^(sad|angry|neutral|calm|happy|excited)$/);
      expect(avgValence).toBeGreaterThanOrEqual(0);
      expect(avgValence).toBeLessThanOrEqual(1);
      expect(avgEnergy).toBeGreaterThanOrEqual(0);
      expect(avgEnergy).toBeLessThanOrEqual(1);
      expect(mood.insight.confidence).toBeGreaterThan(0);
      expect(mood.insight.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('orchestratore (04§8.1)', () => {
  const listens = [
    listen({ id: 'a', trackId: 't-1' }),
    listen({ id: 'b', trackId: 't-2' }),
    listen({ id: 'c', trackId: 't-3' }),
  ];
  const features = [
    feature({ trackId: 't-1', valence: 0.8, energy: 0.8 }),
    feature({ trackId: 't-2', valence: 0.8, energy: 0.8 }),
    feature({ trackId: 't-3', valence: 0.8, energy: 0.8 }),
  ];

  it('il generatore mood è un plug-in dell’orchestratore', async () => {
    const pipeline = new AnalysisPipeline([createMoodGenerator()]);
    expect(pipeline.names).toEqual(['mood']);

    const insights = await pipeline.run({
      listens,
      tracks: [],
      artists: [],
      features,
      today: Date.UTC(2024, 2, 15, 12),
      locale: 'it',
    });

    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.type).toMatch(/^mood_(day|week|month)$/);
      expect(insight.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('senza feature il generatore mood non produce insight', async () => {
    const pipeline = new AnalysisPipeline([createMoodGenerator()]);
    const insights = await pipeline.run({
      listens,
      tracks: [],
      artists: [],
      today: Date.UTC(2024, 2, 15, 12),
      locale: 'it',
    });
    expect(insights).toEqual([]);
  });

  it('i periodi si possono limitare (default: giorno, settimana, mese)', async () => {
    const pipeline = new AnalysisPipeline([createMoodGenerator({ periods: ['day'] })]);
    const insights = await pipeline.run({
      listens,
      tracks: [],
      artists: [],
      features,
      today: Date.UTC(2024, 2, 15, 12),
      locale: 'it',
    });
    expect(insights.every((insight) => insight.type === 'mood_day')).toBe(true);
  });
});
