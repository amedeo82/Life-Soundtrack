import { describe, expect, it } from 'vitest';
import type { Insight } from '../../schema';
import { DAY_MS, MemoryEngine } from '../memory';
import { createLocaleTranslator, loadScenario, memoryPayloadOf, SCENARIOS } from './helpers';

/**
 * Test del memory engine sui fixture di scenario — 10-TESTING.md §3.3.
 *
 * I fixture coprono mesi di ascolto (lockdown, litigio, viaggio estivo): i
 * trigger dei ricordi sono **anniversari e soglie**, quindi il caso noto si
 * osserva spostando "oggi" di un anno avanti (anniversario `on_this_day`) o
 * fermandosi sul giorno in cui una soglia è stata raggiunta.
 */

/** Ultimo ascolto del fixture (unix ms). */
function lastListenTime(listens: { startedAt: number | null; timestamp: number }[]): number {
  return Math.max(...listens.map((event) => event.startedAt ?? event.timestamp));
}

describe('fixture di scenario (10-TESTING §3.3)', () => {
  it('lockdown-2020: un anno dopo l’ultimo ascolto emerge il ricordo on_this_day', async () => {
    const scenario = loadScenario('lockdown-2020');
    const today = lastListenTime(scenario.listens) + 365 * DAY_MS;
    const engine = new MemoryEngine({
      translator: createLocaleTranslator('it'),
      today,
      locale: 'it',
    });

    const memories = await engine.generate(scenario);

    expect(memories).toHaveLength(1);
    expect(memories[0]!.memoryKind).toBe('on_this_day');
    expect(memoryPayloadOf(memories[0]!.insight).yearsAgo).toBe(1);
    expect(memoryPayloadOf(memories[0]!.insight).trackId).not.toBeNull();
    expect(memoryPayloadOf(memories[0]!.insight).text.length).toBeGreaterThan(0);
  });

  it('breakup-oct2021: un anno dopo l’ultimo ascolto emerge il ricordo on_this_day', async () => {
    const scenario = loadScenario('breakup-oct2021');
    const today = lastListenTime(scenario.listens) + 365 * DAY_MS;
    const engine = new MemoryEngine({
      translator: createLocaleTranslator('it'),
      today,
      locale: 'it',
    });

    const memories = await engine.generate(scenario);

    expect(memories).toHaveLength(1);
    expect(memories[0]!.memoryKind).toBe('on_this_day');
    expect(memoryPayloadOf(memories[0]!.insight).text.length).toBeGreaterThan(0);
  });

  it('summer-roadtrip: il ricordo milestone dei 5000 brani ascoltati', async () => {
    const scenario = loadScenario('summer-roadtrip');
    const today = lastListenTime(scenario.listens);
    const engine = new MemoryEngine({
      translator: createLocaleTranslator('it'),
      today,
      locale: 'it',
    });

    const memories = await engine.generate(scenario);

    expect(memories).toHaveLength(1);
    expect(memories[0]!.memoryKind).toBe('milestone');
    expect(memoryPayloadOf(memories[0]!.insight).text).toBe('Hai raggiunto 5000 brani ascoltati!');
  });

  it('rispetta gli invarianti di 04§7.5 su tutti i fixture', async () => {
    for (const name of SCENARIOS) {
      const scenario = loadScenario(name);
      const today = lastListenTime(scenario.listens) + 365 * DAY_MS;
      const engine = new MemoryEngine({
        translator: createLocaleTranslator('it'),
        today,
        locale: 'it',
      });

      const memories = await engine.generate(scenario);

      for (const memory of memories) {
        const insight: Insight = memory.insight;
        expect(insight.type).toBe('memory');
        expect(insight.payload.kind).toBe('memory');
        // `text` mai vuoto e con almeno un dato concreto (04§7.5).
        expect(memoryPayloadOf(insight).text.trim().length).toBeGreaterThan(0);
        expect(insight.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
        expect(insight.confidence).toBeGreaterThanOrEqual(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
        expect(insight.periodStart).toBeLessThan(insight.periodEnd);
        // Il payload è chiuso (02§4): nessun campo extra.
        expect(Object.keys(insight.payload).sort()).toEqual([
          'artistId',
          'kind',
          'memoryKind',
          'text',
          'trackId',
          'yearsAgo',
        ]);
      }

      // Il feed è ordinato per rilevanza decrescente (04§7.4).
      const scores = memories.map((memory) => memory.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
  });

  it('è deterministico: due esecuzioni producono gli stessi ricordi', async () => {
    const scenario = loadScenario('summer-roadtrip');
    const today = lastListenTime(scenario.listens) + 365 * DAY_MS;
    const engine = new MemoryEngine({
      translator: createLocaleTranslator('it'),
      today,
      locale: 'it',
    });

    const first = await engine.generate(scenario);
    const second = await engine.generate(scenario);

    expect(second.map((memory) => memory.insight.id)).toEqual(
      first.map((memory) => memory.insight.id),
    );
    expect(second.map((memory) => memoryPayloadOf(memory.insight).text)).toEqual(
      first.map((memory) => memoryPayloadOf(memory.insight).text),
    );
  });
});
