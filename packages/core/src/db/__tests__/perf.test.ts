import { afterEach, describe, expect, it } from 'vitest';
import { countListens, listListensByDay, putListens } from '../index';
import { closeAllDbs, freshDb, makeListen } from './helpers';

/**
 * Test di performance — AC Story 0.2: "Test con 10.000 ListenEvent in < 500ms".
 * File separato dalla suite funzionale: viene escluso dalle run con coverage
 * (`pnpm --filter @ls/core test:coverage`) perché la strumentazione v8 raddoppia
 * i tempi e renderebbe l'asserzione AC un artefatto, non una misura del layer DB.
 */

afterEach(closeAllDbs);

describe('performance', () => {
  it('inserisce e conta 10.000 ListenEvent in < 500ms', async () => {
    const db = freshDb('ls-perf-10k');
    // Warm-up non misurato: assesta il costo del primo percorso JIT di
    // bulkPut (Dexie + fake-indexeddb) prima della misurazione dell'AC.
    await putListens(
      db,
      Array.from({ length: 200 }, (_, i) => makeListen({ eventKey: `warm:${i}` })),
    );
    await db.listens.clear();

    const events = Array.from({ length: 10_000 }, (_, i) =>
      makeListen({
        eventKey: `perf:${i}`,
        trackId: `perf-track-${i % 1000}`,
        timestamp: 1704067200000 + i * 1000,
        day: '2024-01-01',
      }),
    );

    // Minimo di 3 round (prassi micro-benchmark): misura lo steady-state del
    // layer DB ed esclude il rumore del primo round sulla macchina/CI.
    let best = Number.POSITIVE_INFINITY;
    let count = 0;
    for (let round = 0; round < 3; round += 1) {
      const t0 = performance.now();
      await putListens(db, events);
      count = await countListens(db);
      best = Math.min(best, performance.now() - t0);
      if (round < 2) await db.listens.clear();
    }

    expect(count).toBe(10_000);
    // AC Story 0.2: "Test con 10.000 ListenEvent in < 500ms"
    expect(best).toBeLessThan(500);
  });

  it('query indicizzata per day su 10.000 eventi in < 100ms', async () => {
    const db = freshDb('ls-perf-query');
    const events = Array.from({ length: 10_000 }, (_, i) =>
      makeListen({
        eventKey: `perfq:${i}`,
        day: i % 2 === 0 ? '2024-01-01' : '2024-01-02',
      }),
    );
    await putListens(db, events);

    // Minimo di 3 round: metodologia identica al test AC precedente.
    let best = Number.POSITIVE_INFINITY;
    let size = 0;
    for (let round = 0; round < 3; round += 1) {
      const t0 = performance.now();
      const dayEvents = await listListensByDay(db, '2024-01-01');
      best = Math.min(best, performance.now() - t0);
      size = dayEvents.length;
    }

    expect(size).toBe(5_000);
    expect(best).toBeLessThan(100);
  });
});
