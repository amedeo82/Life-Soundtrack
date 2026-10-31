import { afterEach, describe, expect, it } from 'vitest';
import type { ListenEvent } from '../../schema';
import { freshDb, closeAllDbs } from '../../db/__tests__/helpers';
import { loadUserTimezone, saveUserTimezone } from '../../db/settings';
import { recomputeContextPeriods } from '../recompute';
import { listContextPeriods, setContextPeriodVerdict } from '../storage';

/**
 * Test della persistenza dei periodi di contesto — 02-DATA-SCHEMA.md §6.3
 * (tabella `contexts`), 19-GEO-CONTEXT.md §5.3 e §10 (E20) (Story 1.6).
 */

let seq = 0;

/** Ascolto sintetico in Italia, serale, telefono. */
function listen(overrides: Partial<ListenEvent> = {}): ListenEvent {
  seq += 1;
  const timestamp = overrides.timestamp ?? Date.UTC(2024, 3, 1, 18, 0, 0) + seq * 60_000;
  return {
    id: `le-p-${seq}`,
    eventKey: `spotify:p-${seq}`,
    platform: 'spotify',
    importId: 'imp-1',
    timestamp,
    startedAt: timestamp - 240_000,
    durationMs: 240_000,
    trackId: `tr-${seq}`,
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
    city: null,
    citySource: null,
    cityConfidence: null,
    day: '2024-04-01',
    ...overrides,
  };
}

/** Cronologia minima che produce un periodo `home` (mobile, sera, sessioni lunghe). */
function homeListens(): ListenEvent[] {
  const listens: ListenEvent[] = [];
  for (const day of [1, 2, 3, 8, 9, 10]) {
    for (let i = 0; i < 5; i += 1) {
      const timestamp = Date.UTC(2024, 3, day, 18, 0, 0) + i * 360_000;
      listens.push(listen({ timestamp }));
    }
  }
  return listens;
}

describe('persistenza dei periodi di contesto (tabella `contexts`)', () => {
  afterEach(closeAllDbs);

  it('il ricalcolo scrive i periodi e non duplica al secondo giro', async () => {
    const db = freshDb('ls-contexts-recompute');
    const listens = homeListens();

    const first = await recomputeContextPeriods(db, listens, {
      userTimezone: 'Europe/Rome',
      now: Date.UTC(2024, 3, 29),
    });
    expect(first.inserted).toBeGreaterThan(0);
    expect(first.skipped).toBe(false);
    expect(await db.contexts.count()).toBe(first.inserted);

    // Secondo ricalcolo con gli stessi dati: stessi id, nessun duplicato.
    const second = await recomputeContextPeriods(db, listens, {
      userTimezone: 'Europe/Rome',
      now: Date.UTC(2024, 3, 29),
    });
    expect(second.inserted).toBe(first.inserted);
    expect(second.removedSuperseded).toBe(first.inserted);
    expect(await db.contexts.count()).toBe(first.inserted);
  });

  it('un cambio di parametri rende i periodi vecchi `stale` e li sostituisce', async () => {
    const db = freshDb('ls-contexts-stale');
    const listens = homeListens();

    const first = await recomputeContextPeriods(db, listens, {
      userTimezone: 'Europe/Rome',
      now: Date.UTC(2024, 3, 29),
    });
    const staleVersion = first.derivedVersion;

    const second = await recomputeContextPeriods(db, listens, {
      userTimezone: 'Europe/Rome',
      now: Date.UTC(2024, 3, 29),
      config: { homeRecurrence: 0.9 },
    });
    expect(second.derivedVersion).not.toBe(staleVersion);
    expect(second.removedStale).toBe(first.inserted);
    expect(second.inserted).toBeGreaterThan(0);

    const stored = await listContextPeriods(db);
    expect(stored.every((period) => period.derivedVersion === second.derivedVersion)).toBe(true);
  });

  it('il verdetto dell’utente sopravvive al ricalcolo (E20)', async () => {
    const db = freshDb('ls-contexts-verdict');
    const listens = homeListens();

    const first = await recomputeContextPeriods(db, listens, {
      userTimezone: 'Europe/Rome',
      now: Date.UTC(2024, 3, 29),
    });
    const target = first.periods[0];
    expect(target).toBeDefined();

    // L'utente conferma il periodo e gli dà un'etichetta.
    const updated = await setContextPeriodVerdict(db, target!.id, {
      status: 'confirmed',
      userLabel: 'Casa di mia madre',
    });
    expect(updated?.status).toBe('confirmed');
    expect(updated?.userLabel).toBe('Casa di mia madre');

    // Un ricalcolo con parametri diversi non cancella il verdetto.
    const second = await recomputeContextPeriods(db, listens, {
      userTimezone: 'Europe/Rome',
      now: Date.UTC(2024, 3, 29),
      config: { homeRecurrence: 0.9 },
    });
    expect(second.preservedUserVerdicts).toBe(1);

    const stored = await listContextPeriods(db);
    const kept = stored.find((period) => period.id === target!.id);
    expect(kept?.status).toBe('confirmed');
    expect(kept?.userLabel).toBe('Casa di mia madre');
    // E il periodo ricalcolato non duplica quello confermato.
    expect(stored.filter((period) => period.id === target!.id)).toHaveLength(1);
  });

  it('il verdetto `dismissed` viene preservato come periodo scartato', async () => {
    const db = freshDb('ls-contexts-dismissed');
    const listens = homeListens();

    const first = await recomputeContextPeriods(db, listens, {
      userTimezone: 'Europe/Rome',
      now: Date.UTC(2024, 3, 29),
    });
    const target = first.periods[0]!;
    await setContextPeriodVerdict(db, target.id, { status: 'dismissed' });

    await recomputeContextPeriods(db, listens, {
      userTimezone: 'Europe/Rome',
      now: Date.UTC(2024, 3, 29),
      config: { homeRecurrence: 0.9 },
    });

    const stored = await listContextPeriods(db);
    expect(stored.find((period) => period.id === target.id)?.status).toBe('dismissed');
  });

  it('con `deriveContext` disattivato il ricalcolo non scrive nulla', async () => {
    const db = freshDb('ls-contexts-toggled-off');
    const report = await recomputeContextPeriods(db, homeListens(), {
      userTimezone: 'Europe/Rome',
      now: Date.UTC(2024, 3, 29),
      deriveContext: false,
    });
    expect(report.skipped).toBe(true);
    expect(report.inserted).toBe(0);
    expect(await db.contexts.count()).toBe(0);
  });

  it('il fuso orario dell’utente viene letto dalle impostazioni', async () => {
    const db = freshDb('ls-contexts-timezone');
    expect(await loadUserTimezone(db)).toBe('UTC');

    await saveUserTimezone(db, 'Europe/Rome');
    expect(await loadUserTimezone(db)).toBe('Europe/Rome');

    // Senza fuso esplicito il ricalcolo usa quello salvato.
    const report = await recomputeContextPeriods(db, homeListens(), {
      now: Date.UTC(2024, 3, 29),
    });
    expect(report.skipped).toBe(false);
    expect(report.periods.length).toBeGreaterThan(0);
  });
});
