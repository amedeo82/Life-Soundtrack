import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runAnalysisPipeline } from '../../analysis';
import { listInsightsByType } from '../insights';
import { seedDemoDatabase } from '../demoSeed';
import { closeAllDbs, freshDb } from './helpers';
import { createLocaleTranslator } from '../../analysis/__tests__/helpers';

/**
 * Il fixture **demo** reale (`fixtures/demo-user.json`) — Story 3.5,
 * `docs/26-ONBOARDING-DEMO.md` v1.0 (D-26.2).
 *
 * Il test chiude l'acceptance criterion «il fixture demo contiene albums e
 * features deterministiche, così la demo mostra almeno un'era e un mood»:
 * popola un database con il fixture di produzione e ci lancia sopra la
 * pipeline di analisi.
 */

interface DemoFixtureFile {
  readonly listens: readonly unknown[];
  readonly tracks: readonly unknown[];
  readonly artists: readonly unknown[];
  readonly albums: readonly unknown[];
  readonly features: readonly unknown[];
  readonly _metadata: {
    readonly counts: Readonly<Record<string, number>>;
    readonly demoMode: boolean;
    readonly generatedAt: string;
  };
}

function loadDemoFixtureFile(): DemoFixtureFile {
  const path = fileURLToPath(new URL('../../../../../fixtures/demo-user.json', import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as DemoFixtureFile;
}

afterEach(async () => {
  await closeAllDbs();
});

describe('fixture demo — il diario di esempio è ricco (Story 3.5)', () => {
  it('il fixture dichiara album e feature, e i contatori sono quelli attesi', () => {
    const fixture = loadDemoFixtureFile();

    expect(fixture._metadata.demoMode).toBe(true);
    expect(fixture._metadata.counts).toMatchObject({
      listens: 4500,
      tracks: 200,
      artists: 30,
    });
    expect(fixture.albums.length).toBeGreaterThan(0);
    expect(fixture.features.length).toBe(fixture.tracks.length);
    for (const feature of fixture.features as readonly { source: string }[]) {
      // D-26.3: le feature demo sono sintetiche ma **dichiarate**.
      expect(feature.source).toBe('manual');
    }
  });

  it('il generatore è deterministico: `generatedAt` non dipende da new Date()', () => {
    const first = loadDemoFixtureFile();
    const second = loadDemoFixtureFile();
    expect(first._metadata.generatedAt).toBe(second._metadata.generatedAt);
  });

  it('la pipeline produce almeno un era e almeno un mood sul database demo', async () => {
    const fixture = loadDemoFixtureFile();
    const db = freshDb('ls-demo-fixture-test');

    await seedDemoDatabase(db, fixture);

    await runAnalysisPipeline({
      db,
      translator: createLocaleTranslator('it'),
    });

    const eras = await listInsightsByType(db, 'era');
    const moods = await listInsightsByType(db, 'mood_day');
    const moodWeeks = await listInsightsByType(db, 'mood_week');

    expect(eras.length).toBeGreaterThan(0);
    expect(moods.length).toBeGreaterThan(0);
    expect(moodWeeks.length).toBeGreaterThan(0);
  }, 60_000);
});
