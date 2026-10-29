import { afterEach, describe, expect, it } from 'vitest';
import {
  listInsightsByType,
  listInsightsByTypeAndVersion,
  listStaleInsights,
  putInsights,
  replaceInsightsOfType,
} from '../../db/insights';
import { closeAllDbs, freshDb } from '../../db/__tests__/helpers';
import type { AudioFeatures, ListenEvent } from '../../schema';
import { MoodEngine } from '../mood';
import { moodPayloadOf } from './helpers';

/**
 * Test della persistenza dei mood — 02-DATA-SCHEMA.md §6 (tabella
 * `insights`), §7 MIG-3 (insight `stale` al cambio dei parametri) e 04§9
 * (`derivedVersion` calcolata dai parametri).
 */

afterEach(closeAllDbs);

function listen(id: string, trackId: string, startedAt: number): ListenEvent {
  return {
    id,
    eventKey: `spotify:${id}`,
    platform: 'spotify',
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
    deviceType: 'mobile',
    deviceDetail: null,
    ip: null,
    country: 'IT',
    day: '2024-03-15',
  };
}

function feature(trackId: string, valence: number, energy: number): AudioFeatures {
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
    source: 'essentia',
    fetchedAt: 0,
    schemaVersion: 1,
  };
}

const DAY_ONE = Date.UTC(2024, 2, 15, 9);
const DAY_TWO = Date.UTC(2024, 2, 16, 9);

function sampleInput(): {
  listens: ListenEvent[];
  features: AudioFeatures[];
} {
  const listens = [
    listen('a', 't-1', DAY_ONE),
    listen('b', 't-2', DAY_ONE),
    listen('c', 't-3', DAY_ONE),
    listen('d', 't-4', DAY_TWO),
    listen('e', 't-5', DAY_TWO),
    listen('f', 't-6', DAY_TWO),
  ];
  const features = [
    feature('t-1', 0.8, 0.8),
    feature('t-2', 0.8, 0.8),
    feature('t-3', 0.8, 0.8),
    feature('t-4', 0.25, 0.3),
    feature('t-5', 0.25, 0.3),
    feature('t-6', 0.25, 0.3),
  ];
  return { listens, features };
}

async function generate(config?: { minEventsPerPeriod: number }) {
  const engine = new MoodEngine({
    ...(config ? { config } : {}),
  });
  const { listens, features } = sampleInput();
  const generated = await engine.generate({ listens, features });
  return {
    engine,
    generated,
    days: generated.filter((mood) => mood.period === 'day').map((mood) => mood.insight),
  };
}

describe('persistenza degli insight di mood (02§6, §7 MIG-3)', () => {
  it('scrive e rilegge gli insight mood_day con derivedVersion', async () => {
    const db = freshDb('ls-mood-put');
    await db.open();
    const { engine, generated } = await generate();

    await putInsights(
      db,
      generated.map((mood) => mood.insight),
    );

    const stored = await listInsightsByType(db, 'mood_day');
    expect(stored).toHaveLength(2);
    expect(stored[0]!.payload.kind).toBe('mood');
    expect(stored[0]!.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
    expect(stored[0]!.derivedVersion).toBe(await engine.derivedVersion());
    expect(moodPayloadOf(stored[0]!).mood).toBe('excited');
    expect(moodPayloadOf(stored[1]!).mood).toBe('sad');
  });

  it('il mood del giorno riflette valence ed energy medie', async () => {
    const db = freshDb('ls-mood-payload');
    await db.open();
    const { generated } = await generate();
    const day = generated.find(
      (mood) => mood.period === 'day' && mood.insight.id.endsWith('2024-03-15'),
    );
    expect(day).toBeDefined();
    expect(day!.payload.mood).toBe('excited');
    expect(day!.payload.avgValence).toBeCloseTo(0.8, 6);
    expect(day!.payload.avgEnergy).toBeCloseTo(0.8, 6);
    expect(day!.payload.eventCount).toBe(3);
  });

  it('l’insight generato con parametri diversi diventa stale (MIG-3)', async () => {
    const db = freshDb('ls-mood-stale');
    await db.open();
    const { days } = await generate();
    await putInsights(db, days);
    const oldVersion = days[0]!.derivedVersion;

    const recomputed = await generate({ minEventsPerPeriod: 2 });
    const newVersion = recomputed.days[0]!.derivedVersion;
    expect(newVersion).not.toBe(oldVersion);

    const stale = await listStaleInsights(db, 'mood_day', newVersion);
    expect(stale.length).toBe(days.length);
    expect(await listInsightsByTypeAndVersion(db, 'mood_day', newVersion)).toHaveLength(0);
  });

  it('il ricalcolo sostituisce gli insight del periodo e rimuove quelli stale', async () => {
    const db = freshDb('ls-mood-replace');
    await db.open();
    const { days } = await generate();
    const oldVersion = days[0]!.derivedVersion;

    await replaceInsightsOfType(db, {
      type: 'mood_day',
      insights: days,
      derivedVersion: oldVersion,
    });
    expect(await listInsightsByType(db, 'mood_day')).toHaveLength(2);

    const recomputed = await generate({ minEventsPerPeriod: 2 });
    const newVersion = recomputed.days[0]!.derivedVersion;
    const report = await replaceInsightsOfType(db, {
      type: 'mood_day',
      insights: recomputed.days,
      derivedVersion: newVersion,
    });

    expect(report.removedStale).toBe(2);
    expect(report.inserted).toBe(recomputed.days.length);

    const stored = await listInsightsByType(db, 'mood_day');
    for (const insight of stored) {
      expect(insight.derivedVersion).toBe(newVersion);
    }
    expect(await listStaleInsights(db, 'mood_day', newVersion)).toHaveLength(0);
  });

  it('ricalcolare due volte gli stessi periodi non duplica gli insight', async () => {
    const db = freshDb('ls-mood-idempotent');
    await db.open();
    const { days } = await generate();
    const version = days[0]!.derivedVersion;
    const options = {
      type: 'mood_day' as const,
      insights: days,
      derivedVersion: version,
    };

    await replaceInsightsOfType(db, options);
    const second = await replaceInsightsOfType(db, options);

    expect(second.inserted).toBe(options.insights.length);
    expect(second.removedSuperseded).toBe(options.insights.length);
    expect(await listInsightsByType(db, 'mood_day')).toHaveLength(options.insights.length);
  });

  it('il ricalcolo di un periodo non cancella gli altri periodi dello stesso tipo', async () => {
    const db = freshDb('ls-mood-partial');
    await db.open();
    const { days } = await generate();
    const version = days[0]!.derivedVersion;
    await replaceInsightsOfType(db, {
      type: 'mood_day',
      insights: days,
      derivedVersion: version,
    });

    // Ricalcolo incrementale: solo il 15 marzo.
    const onlyFirst = days.filter((insight) => insight.id.endsWith('2024-03-15'));
    await replaceInsightsOfType(db, {
      type: 'mood_day',
      insights: onlyFirst,
      derivedVersion: version,
    });

    expect(await listInsightsByType(db, 'mood_day')).toHaveLength(2);
  });
});
