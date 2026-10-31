import { describe, expect, it } from 'vitest';
import type { AudioFeatures, ListenEvent, MoodId, Track } from '../../schema';
import {
  computeSignature,
  cosineSimilarity,
  DEFAULT_ERA_CONFIG,
  detectChangePoints,
  computeWeeklySignatures,
  EraEngine,
  eraInsightId,
  jaccardSimilarity,
  renderEraLabel,
  resolveEraConfig,
  signatureSimilarity,
  topGenre,
  type EraConfig,
} from '../era';
import { classifyMood } from '../mood';
import { createLocaleTranslator, eraPayloadOf } from './helpers';

/**
 * Test dell'era detector — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §5 (Story 2.2).
 *
 * La cronologia di test è **composta**, non casuale: due fasi con gusti
 * diversi (generi, artisti, orari), separate da un cambio netto a un
 * istante noto. È la stessa forma del fixture `era-shift`, ma in piccolo,
 * per poter verificare i numeri.
 */

const DAY_MS = 86_400_000;
const START = Date.UTC(2024, 0, 1);

/** Una fase di ascolto: gusti, artisti e orari costanti. */
interface Phase {
  readonly key: string;
  readonly genres: readonly string[];
  readonly valence: number;
  readonly energy: number;
  readonly hour: number;
  readonly weeks: number;
}

const PHASE_A: Phase = {
  key: 'a',
  genres: ['pop'],
  valence: 0.3,
  energy: 0.35,
  hour: 10,
  weeks: 8,
};

const PHASE_B: Phase = {
  key: 'b',
  genres: ['indie', 'folk'],
  valence: 0.8,
  energy: 0.65,
  hour: 1,
  weeks: 8,
};

interface History {
  readonly listens: ListenEvent[];
  readonly tracks: Track[];
  readonly features: AudioFeatures[];
}

/**
 * Costruisce una cronologia di due fasi.
 *
 * Ogni fase ha 3 artisti con 2 brani ciascuno: 6 ascolti a settimana,
 * sparsi sui primi 6 giorni della settimana. Le feature sono **misurate**
 * (`essentia`), con la valence e l'energy dichiarate dalla fase.
 */
function buildHistory(a: Phase = PHASE_A, b: Phase = PHASE_B): History {
  const listens: ListenEvent[] = [];
  const tracks: Track[] = [];
  const features: AudioFeatures[] = [];
  let counter = 0;

  const emit = (phase: Phase, weekOffset: number) => {
    for (let artist = 1; artist <= 3; artist += 1) {
      for (let track = 1; track <= 2; track += 1) {
        counter += 1;
        const trackId = `tr-${phase.key}${artist}-${track}`;
        const artistId = `ar-${phase.key}${artist}`;
        const day = weekOffset * 7 + (artist - 1) * 2 + (track - 1);
        const startedAt = START + day * DAY_MS + phase.hour * 3_600_000;
        listens.push({
          id: `le-${String(counter).padStart(4, '0')}`,
          eventKey: `spotify:ek-${String(counter).padStart(4, '0')}`,
          platform: 'spotify',
          importId: 'imp-1',
          timestamp: startedAt + 240_000,
          startedAt,
          durationMs: 240_000,
          trackId,
          completed: true,
          skipped: false,
          shuffle: false,
          offline: false,
          incognito: false,
          reasonStart: 'playbtn',
          reasonEnd: 'trackdone',
          deviceType: 'mobile',
          deviceDetail: null,
          ip: null,
          country: 'IT',
          city: null,
          citySource: null,
          cityConfidence: null,
          day: new Date(startedAt).toISOString().slice(0, 10),
        });
        if (!tracks.some((existing) => existing.id === trackId)) {
          tracks.push({
            id: trackId,
            canonicalKey: `fuzzy:${trackId}`,
            name: `Brano ${trackId}`,
            artistId,
            albumId: null,
            durationMs: 240_000,
            isrc: null,
            mbid: null,
            explicit: false,
            genres: [...phase.genres],
            artworkUrl: null,
            platformIds: { spotify: trackId },
            firstSeenAt: START,
            lastSeenAt: START,
            listenCount: 0,
          });
          features.push({
            trackId,
            valence: phase.valence,
            energy: phase.energy,
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
          });
        }
      }
    }
  };

  for (let week = 0; week < a.weeks; week += 1) emit(a, week);
  for (let week = 0; week < b.weeks; week += 1) emit(b, a.weeks + week);

  return { listens, tracks, features };
}

/** L'engine con il resolver i18n reale dell'app. */
function engine(config?: Partial<EraConfig>) {
  return new EraEngine({
    translator: createLocaleTranslator('it'),
    ...(config ? { config } : {}),
  });
}

describe('firma musicale (04§5.2)', () => {
  it('la distribuzione dei generi somma a 1 (04§5.5)', () => {
    const history = buildHistory();
    const tracks = new Map(history.tracks.map((track) => [track.id, track]));
    const features = new Map(history.features.map((feature) => [feature.trackId, feature]));
    const signature = computeSignature(history.listens, tracks, features);

    const total = Object.values(signature.genreDistribution).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(Object.keys(signature.genreDistribution).sort()).toEqual(['folk', 'indie', 'pop']);
  });

  it('il tasso di ripetizione è la quota di ascolti di brani già ascoltati', () => {
    const history = buildHistory();
    const tracks = new Map(history.tracks.map((track) => [track.id, track]));
    const features = new Map(history.features.map((feature) => [feature.trackId, feature]));
    const signature = computeSignature(history.listens, tracks, features);

    // 96 ascolti, 12 brani distinti → (96 - 12) / 96.
    expect(signature.repeatRate).toBeCloseTo((96 - 12) / 96, 10);
  });

  it('la quota notturna distingue le fasi diurna e notturna', () => {
    const history = buildHistory();
    const tracks = new Map(history.tracks.map((track) => [track.id, track]));
    const features = new Map(history.features.map((feature) => [feature.trackId, feature]));

    const day = computeSignature(history.listens.slice(0, 48), tracks, features);
    const night = computeSignature(history.listens.slice(48), tracks, features);

    expect(day.nightShare).toBe(0);
    expect(night.nightShare).toBeGreaterThan(0);
  });

  it('senza feature la firma non ha valence né energy (D-A.1)', () => {
    const history = buildHistory();
    const tracks = new Map(history.tracks.map((track) => [track.id, track]));
    const signature = computeSignature(history.listens, tracks, new Map());

    expect(signature.avgValence).toBeNull();
    expect(signature.avgEnergy).toBeNull();
    expect(signature.featureCoverage).toBe(0);
  });

  it('valence ed energy sono le medie ponderate per durata (04§3.3)', () => {
    const history = buildHistory();
    const tracks = new Map(history.tracks.map((track) => [track.id, track]));
    const features = new Map(history.features.map((feature) => [feature.trackId, feature]));
    const signature = computeSignature(history.listens, tracks, features);

    expect(signature.avgValence).toBeCloseTo(0.55, 10);
    expect(signature.avgEnergy).toBeCloseTo(0.5, 10);
  });
});

describe('similarità (04§5.2)', () => {
  it('la cosine di due distribuzioni identiche è 1', () => {
    expect(cosineSimilarity({ pop: 1 }, { pop: 1 })).toBeCloseTo(1, 10);
    expect(cosineSimilarity({ pop: 1 }, { indie: 1 })).toBe(0);
    expect(cosineSimilarity({}, { pop: 1 })).toBe(0);
  });

  it('la Jaccard di due insiemi disgiunti è 0', () => {
    expect(jaccardSimilarity(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(jaccardSimilarity(['a'], ['b'])).toBe(0);
    expect(jaccardSimilarity([], ['b'])).toBe(0);
  });

  it('due firme identiche hanno similarità 1', () => {
    const history = buildHistory();
    const tracks = new Map(history.tracks.map((track) => [track.id, track]));
    const features = new Map(history.features.map((feature) => [feature.trackId, feature]));
    const signature = computeSignature(history.listens, tracks, features);

    const similarity = signatureSimilarity(signature, signature, DEFAULT_ERA_CONFIG.weights);
    expect(similarity).toBeCloseTo(1, 10);
  });

  it('due gusti diversi scendono sotto la soglia di change point', () => {
    const history = buildHistory();
    const tracks = new Map(history.tracks.map((track) => [track.id, track]));
    const features = new Map(history.features.map((feature) => [feature.trackId, feature]));
    const a = computeSignature(history.listens.slice(0, 48), tracks, features);
    const b = computeSignature(history.listens.slice(48), tracks, features);

    const similarity = signatureSimilarity(a, b, DEFAULT_ERA_CONFIG.weights);
    expect(similarity).toBeLessThan(DEFAULT_ERA_CONFIG.similarityThreshold);
  });
});

describe('change point detection (04§5.2)', () => {
  it('un gusto costante non produce confini', () => {
    const history = buildHistory();
    const tracks = new Map(history.tracks.map((track) => [track.id, track]));
    const features = new Map(history.features.map((feature) => [feature.trackId, feature]));
    const config = resolveEraConfig();

    const windows = computeWeeklySignatures(history.listens, tracks, features, config);
    const changePoints = detectChangePoints(windows, config);

    // Una sola fase: tutte le finestre sono uguali.
    const only = computeWeeklySignatures(history.listens.slice(0, 48), tracks, features, config);
    expect(detectChangePoints(only, config)).toEqual([]);
    expect(changePoints.length).toBeGreaterThanOrEqual(1);
  });

  it('il confine cade nel passaggio fra le due fasi', () => {
    const history = buildHistory();
    const tracks = new Map(history.tracks.map((track) => [track.id, track]));
    const features = new Map(history.features.map((feature) => [feature.trackId, feature]));
    const config = resolveEraConfig();

    const windows = computeWeeklySignatures(history.listens, tracks, features, config);
    const changePoints = detectChangePoints(windows, config);

    expect(changePoints).toHaveLength(1);
    // Il confine è l'inizio della finestra che apre la nuova era: la
    // granularità dell'algoritmo è `stepDays` (7 giorni).
    expect(Math.abs(changePoints[0]! - (START + 56 * DAY_MS))).toBeLessThanOrEqual(
      config.stepDays * DAY_MS,
    );
  });
});

describe('ere (04§5.2, §5.5)', () => {
  it('due gusti distinti producono due ere disgiunte e ordinate', async () => {
    const history = buildHistory();
    const generated = await engine().generate(history);

    expect(generated).toHaveLength(2);

    const first = generated[0]!;
    const second = generated[1]!;
    expect(first.insight.periodStart).toBeLessThan(first.insight.periodEnd);
    expect(second.insight.periodStart).toBeLessThan(second.insight.periodEnd);
    // Disgiunte: la seconda comincia dove finisce la prima.
    expect(second.insight.periodStart).toBe(first.insight.periodEnd);
    expect(first.insight.id).toBe(eraInsightId(first.insight.periodStart));
  });

  it('il mood dominante è quello del mood tracker (04§3.2)', async () => {
    const history = buildHistory();
    const generated = await engine().generate(history);
    const moodConfig = resolveEraConfig().mood;

    for (const era of generated) {
      const payload = eraPayloadOf(era.insight);
      const expected: MoodId = classifyMood(payload.avgValence, payload.avgEnergy, {
        valenceThreshold: moodConfig.valenceThreshold,
        energyThreshold: moodConfig.energyThreshold,
        neutralBand: moodConfig.neutralBand,
        excitedEnergyThreshold: moodConfig.excitedEnergyThreshold,
        minEventsPerPeriod: 0,
        weekStartDay: 1,
      });
      expect(payload.moodDominant).toBe(expected);
    }

    expect(eraPayloadOf(generated[0]!.insight).moodDominant).toBe('sad');
    expect(eraPayloadOf(generated[1]!.insight).moodDominant).toBe('happy');
  });

  it('la distribuzione dei generi di ogni era somma a 1 (04§5.5)', async () => {
    const history = buildHistory();
    const generated = await engine().generate(history);

    for (const era of generated) {
      const payload = eraPayloadOf(era.insight);
      const total = Object.values(payload.genreDistribution).reduce((sum, value) => sum + value, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it('un’era più corta di minEraDays viene scartata', async () => {
    const history = buildHistory();
    // 9 giorni di ascolto: sotto `minEraDays` (14) l'era non viene prodotta.
    const generated = await engine().generate({
      ...history,
      listens: history.listens.slice(0, 12),
    });
    expect(generated).toEqual([]);
  });

  it('senza feature non viene prodotta alcuna era (D-A.1)', async () => {
    const history = buildHistory();
    const generated = await engine().generate({ ...history, features: [] });
    expect(generated).toEqual([]);
  });

  it('l’etichetta è resa dal resolver i18n dell’app (D-A.4)', async () => {
    const history = buildHistory();
    const generated = await engine().generate(history);

    const label = eraPayloadOf(generated[0]!.insight).label;
    expect(label).toBe('Era Malinconia pop');
    expect(label).not.toContain('{{');
  });

  it('il genere più ascoltato è deterministico a parità di quota', () => {
    expect(topGenre({ indie: 0.5, folk: 0.5 })).toBe('folk');
    expect(topGenre({ pop: 1 })).toBe('pop');
    expect(topGenre({})).toBe('');
  });

  it('due esecuzioni producono le stesse ere (ricalcolo idempotente)', async () => {
    const history = buildHistory();
    const first = await engine().generate(history);
    const second = await engine().generate(history);

    expect(second.map((era) => era.insight.id)).toEqual(first.map((era) => era.insight.id));
    expect(second.map((era) => eraPayloadOf(era.insight))).toEqual(
      first.map((era) => eraPayloadOf(era.insight)),
    );
  });

  it('la derivedVersion cambia quando cambia un parametro (MIG-3)', async () => {
    const base = await engine().derivedVersion();
    const changed = await engine({ similarityThreshold: 0.7 }).derivedVersion();

    expect(base).toMatch(/^[0-9a-f]{8}$/);
    expect(changed).not.toBe(base);
  });

  it('la confidence è la copertura delle feature dell’era', async () => {
    const history = buildHistory();
    const generated = await engine().generate(history);

    for (const era of generated) {
      expect(era.insight.confidence).toBeGreaterThan(0);
      expect(era.insight.confidence).toBeLessThanOrEqual(1);
      expect(era.insight.status).toBe('pending');
      expect(era.insight.type).toBe('era');
    }
  });
});

describe('orchestratore (04§8.1)', () => {
  it('il generatore dell’era è un plug-in del pipeline', async () => {
    const { AnalysisPipeline, createEraGenerator } = await import('../pipeline');
    const history = buildHistory();
    const pipeline = new AnalysisPipeline([
      createEraGenerator({ translator: createLocaleTranslator('it') }),
    ]);

    expect(pipeline.names).toEqual(['era']);
    const insights = await pipeline.run({
      listens: history.listens,
      tracks: history.tracks,
      artists: [],
      features: history.features,
      today: START + 200 * DAY_MS,
      locale: 'it',
    });

    expect(insights).toHaveLength(2);
    for (const insight of insights) {
      expect(insight.type).toBe('era');
      expect(insight.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});

describe('i18n (D-A.4)', () => {
  it('il template assente fa fallire esplicitamente il rendering', () => {
    const translator = {
      translate: () => '',
    };
    expect(() => renderEraLabel(translator, 'sad', 'pop')).toThrow(/insight\.era\./);
  });

  it('la label inglese mette “Era” in coda', () => {
    const label = renderEraLabel(createLocaleTranslator('en'), 'happy', 'indie');
    expect(label).toBe('Happiness indie Era');
  });
});
