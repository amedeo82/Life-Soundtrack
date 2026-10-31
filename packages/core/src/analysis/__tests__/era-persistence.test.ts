import { afterEach, describe, expect, it } from 'vitest';
import {
  listInsightsByType,
  listInsightsByTypeAndVersion,
  listStaleInsights,
  putInsights,
  replaceAllInsightsOfType,
} from '../../db/insights';
import { closeAllDbs, freshDb } from '../../db/__tests__/helpers';
import type { AudioFeatures, ListenEvent, Track } from '../../schema';
import { EraEngine, type EraConfigOverrides } from '../era';
import { createLocaleTranslator, eraPayloadOf } from './helpers';

/**
 * Test della persistenza delle ere — 02-DATA-SCHEMA.md §6 (tabella
 * `insights`), §7 MIG-3 (insight `stale` al cambio dei parametri) e 04§9
 * (`derivedVersion` calcolata dai parametri).
 *
 * Le ere hanno una particolarità rispetto al mood: la loro segmentazione
 * dipende **dall'intera storia**, quindi un ricalcolo può spostare i
 * confini. Il ricalcolo deve sostituire **l'insieme** delle ere, non solo
 * quelle del periodo ricalcolato.
 */

afterEach(closeAllDbs);

function engine(config?: EraConfigOverrides) {
  return new EraEngine({
    translator: createLocaleTranslator('it'),
    ...(config ? { config } : {}),
  });
}

/** Un ascolto sintetico. */
function listen(id: string, trackId: string, startedAt: number) {
  return {
    id,
    eventKey: `spotify:${id}`,
    platform: 'spotify' as const,
    importId: 'imp-1',
    timestamp: startedAt + 240_000,
    startedAt,
    durationMs: 240_000,
    trackId,
    completed: true,
    skipped: false,
    shuffle: null,
    offline: null,
    incognito: null,
    reasonStart: null,
    reasonEnd: null,
    deviceType: 'mobile' as const,
    deviceDetail: null,
    ip: null,
    country: 'IT',
    city: null,
    citySource: null,
    cityConfidence: null,
    day: '2024-01-01',
  };
}

/** Un brano sintetico. */
function track(id: string, artistId: string, genres: string[]) {
  return {
    id,
    canonicalKey: `fuzzy:${id}`,
    name: `Brano ${id}`,
    artistId,
    albumId: null,
    durationMs: 240_000,
    isrc: null,
    mbid: null,
    explicit: false,
    genres,
    artworkUrl: null,
    platformIds: { spotify: id },
    firstSeenAt: 0,
    lastSeenAt: 0,
    listenCount: 0,
  };
}

/** Una feature misurata. */
function feature(trackId: string, valence: number, energy: number) {
  return {
    trackId,
    valence,
    energy,
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
    source: 'essentia' as const,
    fetchedAt: 0,
    schemaVersion: 1,
  };
}

const DAY_MS = 86_400_000;
const START = Date.UTC(2024, 0, 1);

/**
 * Una cronologia con due gusti distinti: pop diurno e indie folk notturno.
 *
 * Il cambio è al giorno 56: il rilevamento produce due ere.
 */
function sampleInput() {
  const listens: ListenEvent[] = [];
  const tracks: Track[] = [];
  const features: AudioFeatures[] = [];
  let counter = 0;

  const phases = [
    { key: 'a', genres: ['pop'], valence: 0.3, energy: 0.35, hour: 10 },
    { key: 'b', genres: ['indie', 'folk'], valence: 0.8, energy: 0.65, hour: 1 },
  ];

  phases.forEach((phase, phaseIndex) => {
    for (let artist = 1; artist <= 3; artist += 1) {
      for (let trackIndex = 1; trackIndex <= 2; trackIndex += 1) {
        counter += 1;
        const trackId = `tr-${phase.key}${artist}-${trackIndex}`;
        const artistId = `ar-${phase.key}${artist}`;
        const day = phaseIndex * 56 + (artist - 1) * 2 + (trackIndex - 1);
        const startedAt = START + day * DAY_MS + phase.hour * 3_600_000;
        listens.push(listen(`le-${counter}`, trackId, startedAt));
        tracks.push(track(trackId, artistId, phase.genres));
        features.push(feature(trackId, phase.valence, phase.energy));
      }
    }
  });

  return { listens, tracks, features };
}

describe('persistenza delle ere (02§6, §7 MIG-3)', () => {
  it('scrive e rilegge gli insight di tipo era', async () => {
    const db = freshDb('ls-era-put');
    await db.open();
    const input = sampleInput();
    const eraEngine = engine();
    const generated = await eraEngine.generate(input);

    expect(generated.length).toBeGreaterThan(0);
    await putInsights(
      db,
      generated.map((era) => era.insight),
    );

    const stored = await listInsightsByType(db, 'era');
    expect(stored).toHaveLength(generated.length);
    expect(stored[0]!.payload.kind).toBe('era');
    expect(stored[0]!.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
    expect(stored[0]!.derivedVersion).toBe(await eraEngine.derivedVersion());
    expect(eraPayloadOf(stored[0]!).label.length).toBeGreaterThan(0);
  });

  it('le ere generate con parametri diversi diventano stale (MIG-3)', async () => {
    const db = freshDb('ls-era-stale');
    await db.open();
    const input = sampleInput();

    const first = await engine().generate(input);
    await putInsights(
      db,
      first.map((era) => era.insight),
    );

    const second = await engine({ similarityThreshold: 0.7 }).generate(input);
    const newVersion = second[0]!.insight.derivedVersion;
    expect(newVersion).not.toBe(first[0]!.insight.derivedVersion);

    const stale = await listStaleInsights(db, 'era', newVersion);
    expect(stale).toHaveLength(first.length);
    expect(await listInsightsByTypeAndVersion(db, 'era', newVersion)).toHaveLength(0);
  });

  it('il ricalcolo sostituisce l’insieme delle ere, anche quelle spostate', async () => {
    const db = freshDb('ls-era-replace');
    await db.open();
    const input = sampleInput();

    const first = await engine().generate(input);
    await putInsights(
      db,
      first.map((era) => era.insight),
    );
    expect(await listInsightsByType(db, 'era')).toHaveLength(first.length);

    // Un ricalcolo con un threshold diverso sposta i confini: le ere vecchie
    // hanno un `periodStart` diverso e non verrebbero rimosse da un
    // ricalcolo per periodo.
    const second = await engine({ similarityThreshold: 0.7 }).generate(input);
    const report = await replaceAllInsightsOfType(db, {
      type: 'era',
      insights: second.map((era) => era.insight),
      derivedVersion: second[0]!.insight.derivedVersion,
    });

    expect(report.removedStale).toBe(first.length);
    expect(report.inserted).toBe(second.length);

    const stored = await listInsightsByType(db, 'era');
    expect(stored).toHaveLength(second.length);
    for (const insight of stored) {
      expect(insight.derivedVersion).toBe(second[0]!.insight.derivedVersion);
    }
  });

  it('ricalcolare due volte non duplica gli insight', async () => {
    const db = freshDb('ls-era-idempotent');
    await db.open();
    const input = sampleInput();

    const generated = await engine().generate(input);
    const version = generated[0]!.insight.derivedVersion;
    const options = {
      type: 'era' as const,
      insights: generated.map((era) => era.insight),
      derivedVersion: version,
    };

    await replaceAllInsightsOfType(db, options);
    const second = await replaceAllInsightsOfType(db, options);

    expect(second.inserted).toBe(options.insights.length);
    expect(second.removedSuperseded).toBe(options.insights.length);
    expect(await listInsightsByType(db, 'era')).toHaveLength(options.insights.length);
  });

  it('il ricalcolo non tocca gli insight degli altri tipi', async () => {
    const db = freshDb('ls-era-isolated');
    await db.open();
    const input = sampleInput();

    const generated = await engine().generate(input);
    await putInsights(db, [
      {
        id: 'mood-day-2024-01-01',
        type: 'mood_day',
        periodStart: START,
        periodEnd: START + DAY_MS,
        payload: {
          kind: 'mood',
          mood: 'sad',
          avgValence: 0.3,
          avgEnergy: 0.35,
          eventCount: 6,
        },
        confidence: 1,
        derivedVersion: 'deadbeef',
        status: 'pending',
        userNote: null,
        createdAt: 0,
      },
    ]);

    await replaceAllInsightsOfType(db, {
      type: 'era',
      insights: generated.map((era) => era.insight),
      derivedVersion: generated[0]!.insight.derivedVersion,
    });

    expect(await listInsightsByType(db, 'mood_day')).toHaveLength(1);
    expect(await listInsightsByType(db, 'era')).toHaveLength(generated.length);
  });
});
