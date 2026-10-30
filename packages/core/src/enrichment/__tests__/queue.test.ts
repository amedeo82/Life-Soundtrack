import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILY_BUDGET_MS, budgetDayKey, createEnrichmentQueue } from '../queue';
import type { EnrichmentCascade, EnrichmentRequest } from '../cascade';
import type { EnrichmentOutcome, EnrichmentPolicy } from '../types';
import { createFakeClock, makeContext, makeTrack } from './helpers';

/**
 * La coda e i trigger — `21-AUDIO-FEATURES.md` §5.2, §5.3 (D-AF.7),
 * §13 (E9, E11).
 */

/** Una cascata finta che conta le chiamate e può avanzare l'orologio. */
function fakeCascade(
  clock: { advance(ms: number): void },
  options: {
    costMs?: number;
    outcome?: EnrichmentOutcome;
    onEnrich?: (trackId: string) => void;
  } = {},
): EnrichmentCascade & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async enrich(track): Promise<EnrichmentOutcome> {
      calls.push(track.id);
      clock.advance(options.costMs ?? 0);
      options.onEnrich?.(track.id);
      return (
        options.outcome ?? {
          status: 'heuristic',
          feature: {
            trackId: track.id,
            valence: null,
            energy: null,
            danceability: 0.6,
            acousticness: null,
            instrumentalness: null,
            speechiness: null,
            liveness: null,
            tempo: 120,
            key: null,
            mode: null,
            loudness: null,
            timeSignature: null,
            source: 'heuristic',
            fetchedAt: 0,
            schemaVersion: 1,
          },
        }
      );
    },
    async enrichMany(): Promise<EnrichmentOutcome[]> {
      return [];
    },
  };
}

/** La richiesta di un brano. */
function request(id: string): EnrichmentRequest {
  return { track: makeTrack({ id }), context: makeContext() };
}

describe('i trigger (21§5.2)', () => {
  it('on-import accoda e non esegue', async () => {
    const clock = createFakeClock();
    const cascade = fakeCascade(clock);
    const queue = createEnrichmentQueue({ cascade, policy: { isEnabled: () => true }, clock });

    expect(await queue.enqueue(request('a'), 'on-import')).toBe(true);
    expect(queue.size()).toBe(1);
    expect(cascade.calls).toEqual([]);
  });

  it('on-demand e scheduled usano la stessa coda', async () => {
    const clock = createFakeClock();
    const cascade = fakeCascade(clock);
    const queue = createEnrichmentQueue({ cascade, policy: { isEnabled: () => true }, clock });

    await queue.enqueue(request('a'), 'on-demand');
    await queue.enqueue(request('b'), 'scheduled');

    expect(queue.size()).toBe(2);
  });

  it('E9: lo stesso brano non entra due volte in coda', async () => {
    const clock = createFakeClock();
    const queue = createEnrichmentQueue({
      cascade: fakeCascade(clock),
      policy: { isEnabled: () => true },
      clock,
    });

    expect(await queue.enqueue(request('a'), 'on-import')).toBe(true);
    expect(await queue.enqueue(request('a'), 'on-demand')).toBe(false);
    expect(queue.size()).toBe(1);
  });

  it('con il toggle spento la richiesta è scartata', async () => {
    const clock = createFakeClock();
    const queue = createEnrichmentQueue({
      cascade: fakeCascade(clock),
      policy: { isEnabled: () => false },
      clock,
    });

    expect(await queue.enqueue(request('a'), 'on-import')).toBe(false);
    expect(queue.size()).toBe(0);
  });
});

describe('il run (21§5.2)', () => {
  it('processa la coda in ordine, un brano alla volta', async () => {
    const clock = createFakeClock();
    const cascade = fakeCascade(clock);
    const queue = createEnrichmentQueue({ cascade, policy: { isEnabled: () => true }, clock });

    await queue.enqueueMany([request('a'), request('b'), request('c')], 'scheduled');
    const report = await queue.run('scheduled');

    expect(cascade.calls).toEqual(['a', 'b', 'c']);
    expect(report.processed).toBe(3);
    expect(report.stoppedBy).toBe('finished');
    expect(queue.size()).toBe(0);
  });

  it('una coda vuota termina subito', async () => {
    const clock = createFakeClock();
    const queue = createEnrichmentQueue({
      cascade: fakeCascade(clock),
      policy: { isEnabled: () => true },
      clock,
    });

    const report = await queue.run('scheduled');

    expect(report.stoppedBy).toBe('empty');
    expect(report.processed).toBe(0);
  });

  it('il budget giornaliero ferma il run (5 min/giorno)', async () => {
    const clock = createFakeClock();
    const cascade = fakeCascade(clock, { costMs: 600 });
    const queue = createEnrichmentQueue({
      cascade,
      policy: { isEnabled: () => true },
      clock,
      budgetMs: 1_000,
    });

    await queue.enqueueMany([request('a'), request('b'), request('c'), request('d')], 'scheduled');
    const report = await queue.run('scheduled');

    expect(report.stoppedBy).toBe('budget');
    expect(report.processed).toBe(2);
    expect(queue.size()).toBe(2);
  });

  it('il budget di default è di 5 minuti', () => {
    expect(DEFAULT_DAILY_BUDGET_MS).toBe(5 * 60 * 1000);
  });

  it('il budget riparte da zero al giorno successivo', async () => {
    const clock = createFakeClock(Date.parse('2026-10-28T23:59:00Z'));
    const cascade = fakeCascade(clock, { costMs: 600 });
    const queue = createEnrichmentQueue({
      cascade,
      policy: { isEnabled: () => true },
      clock,
      budgetMs: 1_000,
    });

    await queue.enqueueMany([request('a'), request('b'), request('c')], 'scheduled');
    const first = await queue.run('scheduled');
    expect(first.stoppedBy).toBe('budget');
    expect(first.processed).toBe(2);
    expect(queue.size()).toBe(1);

    clock.advance(2 * 60 * 1000);
    await queue.enqueue(request('d'), 'scheduled');
    const second = await queue.run('scheduled');

    expect(second.stoppedBy).toBe('finished');
    expect(second.processed).toBe(2);
  });

  it('E11: se il toggle si spegne a pipeline in corso il run si ferma', async () => {
    const clock = createFakeClock();
    let enabled = true;
    const policy: EnrichmentPolicy = { isEnabled: () => enabled };
    const cascade = fakeCascade(clock, {
      onEnrich: () => {
        enabled = false;
      },
    });
    const queue = createEnrichmentQueue({ cascade, policy, clock });

    await queue.enqueueMany([request('a'), request('b'), request('c')], 'scheduled');
    const report = await queue.run('scheduled');

    expect(report.stoppedBy).toBe('toggle-off');
    expect(cascade.calls).toEqual(['a']);
  });

  it('con il toggle già spento il run non parte (nessuna uscita di rete)', async () => {
    const clock = createFakeClock();
    let enabled = true;
    const cascade = fakeCascade(clock);
    const queue = createEnrichmentQueue({
      cascade,
      policy: { isEnabled: () => enabled },
      clock,
    });

    await queue.enqueueMany([request('a')], 'scheduled');
    enabled = false;
    const report = await queue.run('scheduled');

    expect(report.stoppedBy).toBe('toggle-off');
    expect(cascade.calls).toEqual([]);
  });

  it('stop() interrompe il run al brano successivo', async () => {
    const clock = createFakeClock();
    let stop: () => void = () => undefined;
    const cascade = fakeCascade(clock, {
      costMs: 10,
      onEnrich: () => stop(),
    });
    const queue = createEnrichmentQueue({
      cascade,
      policy: { isEnabled: () => true },
      clock,
    });
    stop = () => queue.stop();

    await queue.enqueueMany([request('a'), request('b'), request('c')], 'scheduled');
    const report = await queue.run('scheduled');

    expect(report.stoppedBy).toBe('stopped');
    expect(cascade.calls).toEqual(['a']);
    expect(queue.size()).toBe(2);
  });

  it('un brano senza feature viene contato come "senza feature"', async () => {
    const clock = createFakeClock();
    const cascade = fakeCascade(clock, { outcome: { status: 'none', feature: null } });
    const queue = createEnrichmentQueue({
      cascade,
      policy: { isEnabled: () => true },
      clock,
    });

    await queue.enqueueMany([request('a'), request('b')], 'scheduled');
    const report = await queue.run('scheduled');

    expect(report.processed).toBe(0);
    expect(report.withoutFeatures).toBe(2);
    expect(report.skipped).toBe(2);
  });

  it('un esito "disabled" a cascata ferma il run', async () => {
    const clock = createFakeClock();
    const cascade = fakeCascade(clock, { outcome: { status: 'disabled', feature: null } });
    const queue = createEnrichmentQueue({
      cascade,
      policy: { isEnabled: () => true },
      clock,
    });

    await queue.enqueueMany([request('a'), request('b')], 'scheduled');
    const report = await queue.run('scheduled');

    expect(report.stoppedBy).toBe('toggle-off');
    expect(cascade.calls).toEqual(['a']);
  });

  it('resetBudget() azzera il consumo del giorno', async () => {
    const clock = createFakeClock();
    const cascade = fakeCascade(clock, { costMs: 600 });
    const queue = createEnrichmentQueue({
      cascade,
      policy: { isEnabled: () => true },
      clock,
      budgetMs: 1_000,
    });

    await queue.enqueueMany([request('a'), request('b'), request('c')], 'scheduled');
    expect((await queue.run('scheduled')).stoppedBy).toBe('budget');

    queue.resetBudget();
    const report = await queue.run('scheduled');

    expect(report.stoppedBy).toBe('finished');
  });

  it('clear() svuota la coda', async () => {
    const clock = createFakeClock();
    const queue = createEnrichmentQueue({
      cascade: fakeCascade(clock),
      policy: { isEnabled: () => true },
      clock,
    });

    await queue.enqueueMany([request('a'), request('b')], 'on-import');
    expect(queue.clear()).toBe(2);
    expect(queue.size()).toBe(0);
  });
});

describe('la chiave del giorno (budget)', () => {
  it('è la data UTC', () => {
    expect(budgetDayKey(Date.parse('2026-10-28T23:30:00Z'))).toBe('2026-10-28');
    expect(budgetDayKey(Date.parse('2026-10-29T00:30:00Z'))).toBe('2026-10-29');
  });
});
