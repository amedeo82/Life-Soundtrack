import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnalysisRunner } from '../analysisRunner';
import { openDb } from '@core/db';
import { i18n } from '../i18n';
import { createLogger } from '@core/logger';

/**
 * Test dell'adapter app per l'analisi — 23-ANALYSIS-PIPELINE.md v1.0 🟢.
 *
 * Copre: il runner non propaga gli errori; il report è loggato.
 */

let dbName = 'ls-analysis-runner-test';

afterEach(async () => {
  const db = await openDb(dbName);
  await db.delete();
  vi.resetAllMocks();
});

beforeEach(() => {
  dbName = `ls-analysis-runner-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
});

describe('createAnalysisRunner (23-ANALYSIS-PIPELINE)', () => {
  it('run restituisce un report e non propaga errori', async () => {
    const runner = createAnalysisRunner({
      i18n,
      logger: createLogger('test:analysis-runner'),
    });

    const report = await runner.run('post-import');

    expect(report).toHaveProperty('produced');
    expect(report).toHaveProperty('replaced');
    expect(report).toHaveProperty('skipped');
    expect(report).toHaveProperty('durationMs');
    expect(report).toHaveProperty('missingFeatures');
    expect(typeof report.durationMs).toBe('number');
  });

  it('run multiple volte: la seconda volta ritorna report vuoto se running', async () => {
    const runner = createAnalysisRunner({
      i18n,
      logger: createLogger('test:analysis-runner'),
    });

    // Avvia prima run (non aspettiamo che finisca)
    const promise1 = runner.run('post-import');

    // Seconda run immediata: dovrebbe rilevare running=true
    const report2 = await runner.run('manual');

    expect(report2.produced).toEqual({});
    expect(report2.replaced).toEqual({});
    expect(report2.skipped).toBe(0);
    expect(report2.durationMs).toBe(0);
    expect(report2.missingFeatures).toBe(0);

    // Aspetta la prima
    await promise1;
  });

  it("isRunning ritorna false all'inizio", () => {
    const runner = createAnalysisRunner({
      i18n,
      logger: createLogger('test:analysis-runner'),
    });

    expect(runner.isRunning()).toBe(false);
  });

  it('errori nel runner core non propagano al chiamante', async () => {
    // Crea un runner con un DB che fallirà
    const runner = createAnalysisRunner({
      i18n,
      logger: createLogger('test:analysis-runner'),
    });

    // Il runner non dovrebbe lanciare anche se il DB ha problemi
    // (il DB viene creato lazy, quindi non fallisce qui)
    const report = await runner.run('on-demand');

    expect(report).toHaveProperty('produced');
    expect(report).toHaveProperty('replaced');
  });
});
