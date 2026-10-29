import { describe, expect, it } from 'vitest';
import type { ListenEvent } from '../../schema';
import {
  DEFAULT_MOOD_CONFIG,
  endOfUtcMonth,
  groupByPeriod,
  periodBounds,
  startOfUtcMonth,
  startOfUtcWeek,
} from '../mood';

/**
 * Test dei confini dei periodi del mood tracker — 04-ANALYSIS-ALGORITHMS.md
 * v1.0 🟢 §3.3.
 *
 * I confini sono UTC e la settimana parte dal lunedì (D.62.1): il parametro
 * `weekStartDay` è versionato, quindi una convenzione diversa cambierebbe la
 * `derivedVersion` e renderebbe `stale` gli insight già prodotti (MIG-3).
 */

const CONFIG = DEFAULT_MOOD_CONFIG;

/** Il 15 marzo 2024 è un venerdì. */
const FRIDAY = Date.UTC(2024, 2, 15, 13, 30, 0);

function listenAt(ms: number, id: string): ListenEvent {
  return {
    id,
    eventKey: `spotify:${id}`,
    platform: 'spotify',
    importId: 'imp-1',
    timestamp: ms,
    startedAt: ms,
    durationMs: 240_000,
    trackId: `t-${id}`,
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

describe('confini dei periodi', () => {
  it('il giorno UTC va da mezzanotte a mezzanotte meno un millisecondo', () => {
    const bounds = periodBounds('day', FRIDAY, CONFIG);
    expect(bounds.start).toBe(Date.UTC(2024, 2, 15));
    expect(bounds.end).toBe(Date.UTC(2024, 2, 15, 23, 59, 59, 999));
    expect(bounds.key).toBe('2024-03-15');
  });

  it('la settimana parte dal lunedì e finisce la domenica', () => {
    const bounds = periodBounds('week', FRIDAY, CONFIG);
    expect(bounds.start).toBe(Date.UTC(2024, 2, 11)); // lunedì 11 marzo
    expect(bounds.end).toBe(Date.UTC(2024, 2, 17, 23, 59, 59, 999)); // domenica 17
    expect(bounds.key).toBe('2024-03-11');
  });

  it('il mese copre l’intero mese UTC', () => {
    const bounds = periodBounds('month', FRIDAY, CONFIG);
    expect(bounds.start).toBe(Date.UTC(2024, 2, 1));
    expect(bounds.end).toBe(Date.UTC(2024, 3, 1) - 1);
    expect(bounds.key).toBe('2024-03');
  });

  it('il mese di febbraio in anno bisestile ha 29 giorni', () => {
    const bounds = periodBounds('month', Date.UTC(2024, 1, 10), CONFIG);
    expect(bounds.end - bounds.start + 1).toBe(29 * 86_400_000);
  });

  it('l’inizio della settimana è sempre il lunedì', () => {
    for (let day = 0; day < 7; day += 1) {
      const ms = Date.UTC(2024, 2, 11 + day, 12); // da lunedì a domenica
      expect(new Date(startOfUtcWeek(ms, CONFIG.weekStartDay)).getUTCDay()).toBe(1);
    }
  });

  it('il mese inizia il primo giorno del mese', () => {
    expect(startOfUtcMonth(Date.UTC(2024, 5, 30))).toBe(Date.UTC(2024, 5, 1));
    expect(endOfUtcMonth(Date.UTC(2024, 5, 30))).toBe(Date.UTC(2024, 6, 1) - 1);
  });

  it('la settimana dura esattamente sette giorni', () => {
    const bounds = periodBounds('week', FRIDAY, CONFIG);
    expect(bounds.end - bounds.start + 1).toBe(7 * 86_400_000);
  });
});

describe('raggruppamento per periodo', () => {
  it('raggruppa gli ascolti nel periodo che li contiene', () => {
    const listens = [
      listenAt(Date.UTC(2024, 2, 15, 9), 'a'),
      listenAt(Date.UTC(2024, 2, 15, 21), 'b'),
      listenAt(Date.UTC(2024, 2, 16, 9), 'c'),
    ];
    const days = groupByPeriod(
      listens,
      (event) => event.startedAt ?? event.timestamp,
      'day',
      CONFIG,
    );
    expect([...days.keys()]).toEqual(['2024-03-15', '2024-03-16']);
    expect(days.get('2024-03-15')).toHaveLength(2);
    expect(days.get('2024-03-16')).toHaveLength(1);

    const weeks = groupByPeriod(
      listens,
      (event) => event.startedAt ?? event.timestamp,
      'week',
      CONFIG,
    );
    expect([...weeks.keys()]).toEqual(['2024-03-11']);
    expect(weeks.get('2024-03-11')).toHaveLength(3);

    const months = groupByPeriod(
      listens,
      (event) => event.startedAt ?? event.timestamp,
      'month',
      CONFIG,
    );
    expect([...months.keys()]).toEqual(['2024-03']);
    expect(months.get('2024-03')).toHaveLength(3);
  });

  it('il raggruppamento non dipende dall’ordine degli ascolti', () => {
    const listens = [
      listenAt(Date.UTC(2024, 2, 16, 9), 'c'),
      listenAt(Date.UTC(2024, 2, 15, 9), 'a'),
    ];
    const forward = groupByPeriod(
      listens,
      (event) => event.startedAt ?? event.timestamp,
      'day',
      CONFIG,
    );
    const reversed = groupByPeriod(
      [...listens].reverse(),
      (event) => event.startedAt ?? event.timestamp,
      'day',
      CONFIG,
    );
    expect([...forward.keys()]).toEqual([...reversed.keys()]);
  });
});
