import { afterEach, describe, expect, it } from 'vitest';
import {
  listInsightsByType,
  listInsightsByTypeAndVersion,
  listStaleInsights,
  putInsights,
  replaceInsights,
} from '../../db/insights';
import {
  closeAllDbs,
  freshDb,
  makeArtist,
  makeListen,
  makeTrack,
} from '../../db/__tests__/helpers';
import type { Insight } from '../../schema';
import { MemoryEngine } from '../memory';
import { createLocaleTranslator } from './helpers';

/**
 * Test della persistenza dei ricordi — 02-DATA-SCHEMA.md §6 (tabella
 * `insights`), §7 MIG-3 (insight `stale` al cambio dei parametri) e 04§9
 * (`derivedVersion` calcolata dai parametri).
 */

afterEach(closeAllDbs);

const TODAY = Date.UTC(2024, 2, 15, 12, 0, 0);

function sampleInput(): {
  listens: ReturnType<typeof makeListen>[];
  tracks: ReturnType<typeof makeTrack>[];
  artists: ReturnType<typeof makeArtist>[];
} {
  const artist = makeArtist({ id: 'a-p', name: 'Aurora' });
  const track = makeTrack({ id: 't-p', artistId: artist.id, name: 'Notte' });
  const listens = [
    makeListen({
      trackId: 't-p',
      startedAt: Date.UTC(2021, 2, 15, 20),
      timestamp: Date.UTC(2021, 2, 15, 20, 4),
      durationMs: 240_000,
    }),
  ];
  return { listens, tracks: [track], artists: [artist] };
}

async function generate(config?: { returnMinGapDays: number }): Promise<Insight[]> {
  const engine = new MemoryEngine({
    translator: createLocaleTranslator('it'),
    today: TODAY,
    locale: 'it',
    ...(config ? { config } : {}),
  });
  const memories = await engine.generate(sampleInput());
  return memories.map((memory) => memory.insight);
}

describe('persistenza degli insight di ricordo (02§6, §7 MIG-3)', () => {
  it('scrive e rilegge gli insight per tipo', async () => {
    const db = freshDb('ls-memory-put');
    await db.open();
    const insights = await generate();

    await putInsights(db, insights);

    const stored = await listInsightsByType(db, 'memory');
    expect(stored).toHaveLength(insights.length);
    expect(stored[0]!.payload.kind).toBe('memory');
    expect(stored[0]!.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
  });

  it('l’insight generato con paramimi diversi diventa stale (MIG-3)', async () => {
    const db = freshDb('ls-memory-stale');
    await db.open();
    const insights = await generate();
    await putInsights(db, insights);
    const oldVersion = insights[0]!.derivedVersion;

    // Stessi dati, parametro cambiato → derivedVersion diversa.
    const recomputed = await generate({ returnMinGapDays: 200 });
    const newVersion = recomputed[0]!.derivedVersion;
    expect(newVersion).not.toBe(oldVersion);

    const stale = await listStaleInsights(db, 'memory', newVersion);
    expect(stale).toHaveLength(insights.length);
    expect(stale.map((insight) => insight.id)).toEqual(insights.map((insight) => insight.id));

    const current = await listInsightsByTypeAndVersion(db, 'memory', newVersion);
    expect(current).toHaveLength(0);
  });

  it('il ricalcolo sostituisce gli insight del periodo e rimuove quelli stale', async () => {
    const db = freshDb('ls-memory-replace');
    await db.open();
    const insights = await generate();
    const oldVersion = insights[0]!.derivedVersion;

    await replaceInsights(db, {
      type: 'memory',
      insights,
      derivedVersion: oldVersion,
      periodStart: insights[0]!.periodStart,
    });
    expect(await listInsightsByType(db, 'memory')).toHaveLength(insights.length);

    // Ricalcolo con parametri diversi: gli insight precedenti sono stale.
    const recomputed = await generate({ returnMinGapDays: 200 });
    const newVersion = recomputed[0]!.derivedVersion;
    const report = await replaceInsights(db, {
      type: 'memory',
      insights: recomputed,
      derivedVersion: newVersion,
      periodStart: recomputed[0]!.periodStart,
    });

    expect(report.removedStale).toBe(insights.length);
    expect(report.inserted).toBe(recomputed.length);

    const stored = await listInsightsByType(db, 'memory');
    expect(stored).toHaveLength(recomputed.length);
    for (const insight of stored) {
      expect(insight.derivedVersion).toBe(newVersion);
    }
    expect(await listStaleInsights(db, 'memory', newVersion)).toHaveLength(0);
  });

  it('ricalcolare due volte lo stesso giorno non duplica gli insight', async () => {
    const db = freshDb('ls-memory-idempotent');
    await db.open();
    const insights = await generate();
    const version = insights[0]!.derivedVersion;
    const options = {
      type: 'memory' as const,
      insights,
      derivedVersion: version,
      periodStart: insights[0]!.periodStart,
    };

    await replaceInsights(db, options);
    const second = await replaceInsights(db, options);

    expect(second.inserted).toBe(insights.length);
    expect(second.removedSuperseded).toBe(insights.length);
    expect(await listInsightsByType(db, 'memory')).toHaveLength(insights.length);
  });
});
