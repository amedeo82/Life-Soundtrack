import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMemories } from '../useMemories';
import { openDb } from '@core/db';
import type { Insight } from '@core/schema';

/**
 * Test del feed dei ricordi — Story 3.2, `docs/25-MEMORIES-SHARE-EXPLORE.md` §2.
 *
 * Copre: paginazione a 10, esclusione dei `dismissed`, ordinamento per
 * rilevanza (`Insight.confidence`), stato vuoto.
 */

let dbName = 'ls-use-memories-test';

beforeEach(() => {
  dbName = `ls-use-memories-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
});

afterEach(async () => {
  const db = await openDb(dbName);
  await db.delete();
});

/** Un ricordo minimale. */
function makeMemory(index: number, confidence: number, overrides: Partial<Insight> = {}): Insight {
  return {
    id: `mem-${index}`,
    type: 'memory',
    periodStart: Date.UTC(2024, 0, index + 1),
    periodEnd: Date.UTC(2024, 0, index + 1, 23, 59),
    payload: {
      kind: 'memory',
      memoryKind: 'on_this_day',
      trackId: null,
      artistId: null,
      yearsAgo: null,
      text: `Ricordo ${index}`,
    },
    confidence,
    derivedVersion: 'memory-v1',
    status: 'pending',
    userNote: null,
    createdAt: Date.UTC(2024, 0, index + 1),
    ...overrides,
  };
}

describe('useMemories (Story 3.2)', () => {
  it('parte in loading e poi passa a ready', async () => {
    const db = await openDb(dbName);
    await db.open();
    await db.insights.put(makeMemory(1, 0.5));

    const { result } = renderHook(() => useMemories(10, dbName));
    expect(result.current.state).toBe('loading');

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });
    expect(result.current.items).toHaveLength(1);
  });

  it('pagina a 10 elementi e segnala che ce ne sono altri', async () => {
    const db = await openDb(dbName);
    await db.open();
    const insights = Array.from({ length: 12 }, (_, index) => makeMemory(index, 0.5));
    await db.insights.bulkPut(insights);

    const { result } = renderHook(() => useMemories(10, dbName));
    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    expect(result.current.items).toHaveLength(10);
    expect(result.current.hasMore).toBe(true);

    result.current.loadMore();
    await waitFor(() => {
      expect(result.current.items).toHaveLength(12);
    });
    expect(result.current.hasMore).toBe(false);
  });

  it('ordina per rilevanza (confidence decrescente)', async () => {
    const db = await openDb(dbName);
    await db.open();
    await db.insights.bulkPut([makeMemory(1, 0.2), makeMemory(2, 0.9), makeMemory(3, 0.5)]);

    const { result } = renderHook(() => useMemories(10, dbName));
    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    expect(result.current.items.map((item) => item.id)).toEqual(['mem-2', 'mem-3', 'mem-1']);
  });

  it('esclude i ricordi nascosti ma li lascia nel database', async () => {
    const db = await openDb(dbName);
    await db.open();
    await db.insights.bulkPut([makeMemory(1, 0.9), makeMemory(2, 0.8, { status: 'dismissed' })]);

    const { result } = renderHook(() => useMemories(10, dbName));
    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    expect(result.current.items.map((item) => item.id)).toEqual(['mem-1']);
    expect(await db.insights.count()).toBe(2);
    expect((await db.insights.get('mem-2'))?.status).toBe('dismissed');
  });

  it('nasconde un ricordo (dismissed) e lo scrive nel database', async () => {
    const db = await openDb(dbName);
    await db.open();
    await db.insights.put(makeMemory(1, 0.9));

    const { result } = renderHook(() => useMemories(10, dbName));
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    result.current.dismiss('mem-1');
    await waitFor(() => {
      expect(result.current.items).toHaveLength(0);
    });
    await waitFor(async () => {
      expect((await db.insights.get('mem-1'))?.status).toBe('dismissed');
    });
  });

  it('salva un ricordo (confirmed)', async () => {
    const db = await openDb(dbName);
    await db.open();
    await db.insights.put(makeMemory(1, 0.9));

    const { result } = renderHook(() => useMemories(10, dbName));
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    result.current.save('mem-1');
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('confirmed');
    });
    await waitFor(async () => {
      expect((await db.insights.get('mem-1'))?.status).toBe('confirmed');
    });
  });

  it('scrive la nota libera del ricordo e lo conferma', async () => {
    const db = await openDb(dbName);
    await db.open();
    await db.insights.put(makeMemory(1, 0.9));

    const { result } = renderHook(() => useMemories(10, dbName));
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    result.current.tag('mem-1', '  la notte in cui ho preso il treno  ');
    await waitFor(() => {
      expect(result.current.items[0]?.userNote).toBe('la notte in cui ho preso il treno');
    });
    await waitFor(async () => {
      const insight = await db.insights.get('mem-1');
      expect(insight?.userNote).toBe('la notte in cui ho preso il treno');
      expect(insight?.status).toBe('confirmed');
    });
  });

  it('stato vuoto quando non ci sono ricordi', async () => {
    const db = await openDb(dbName);
    await db.open();

    const { result } = renderHook(() => useMemories(10, dbName));
    await waitFor(() => {
      expect(result.current.state).toBe('empty');
    });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });
});
