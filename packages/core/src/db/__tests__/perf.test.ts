import { afterEach, describe, expect, it } from 'vitest';
import { countListens, listListensByDay, putListens } from '../index';
import { closeAllDbs, freshDb, makeListen } from './helpers';

/**
 * Test di performance — AC Story 0.2: "Test con 10.000 ListenEvent in < 500ms".
 * File separato dalla suite funzionale: viene escluso dalle run con coverage
 * (`pnpm --filter @ls/core test:coverage`) perché la strumentazione v8 raddoppia
 * i tempi e renderebbe l'asserzione AC un artefatto, non una misura del layer DB.
 */

/**
 * Esegue `fn` per `rounds` iterazioni raccogliendo i tempi, applica outlier
 * rejection (scarta min e max per eliminare cold-start residuo e spike runner
 * CI) e restituisce il best-of-(N-2) dei rimanenti.
 *
 * Issue #80: sostituisce il best-of-3 fisso, che su ubuntu-latest poteva
 * sfiorare il budget AC anche nel caso felice per varianza del runner.
 */
async function bench(fn: () => Promise<unknown>, rounds = 5): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  times.shift(); // rimuovi min (cold-start / JIT residuo)
  times.pop(); // rimuovi max (spike runner CI)
  return Math.min(...times);
}

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

    let count = 0;
    const elapsed = await bench(async () => {
      await putListens(db, events);
      count = await countListens(db);
      await db.listens.clear();
    }, 5);

    expect(count).toBe(10_000);
    // AC Story 0.2: "Test con 10.000 ListenEvent in < 500ms"
    expect(elapsed).toBeLessThan(500);
  }, 30000);

  it('query indicizzata per day su 10.000 eventi in < 100ms', async () => {
    const db = freshDb('ls-perf-query');
    const events = Array.from({ length: 10_000 }, (_, i) =>
      makeListen({
        eventKey: `perfq:${i}`,
        day: i % 2 === 0 ? '2024-01-01' : '2024-01-02',
      }),
    );
    await putListens(db, events);

    let size = 0;
    const elapsed = await bench(async () => {
      const dayEvents = await listListensByDay(db, '2024-01-01');
      size = dayEvents.length;
    }, 5);

    expect(size).toBe(5_000);
    expect(elapsed).toBeLessThan(100);
  }, 30000);
});
