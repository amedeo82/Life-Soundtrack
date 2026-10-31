import { describe, expect, it } from 'vitest';
import type { MoodId } from '../../schema';
import { EraEngine } from '../era';
import {
  createLocaleTranslator,
  eraPayloadOf,
  loadScenario,
  syntheticFeaturesFor,
} from './helpers';

/**
 * Test dell'era detector sul **fixture di scenario** — 10-TESTING.md §3.3
 * (Story 2.2, AC "Test su fixture di scenario: a parità di derivedVersion
 * le stesse ere").
 *
 * Il fixture `era-shift` è una cronologia **composta**: 8 settimane di *pop*
 * diurno e 8 settimane di *indie folk* notturno, con il cambio di gusto al
 * **giorno 56** (settimana 9). Le attese sono dichiarate nel fixture stesso
 * (`_metadata.expectedInsights`).
 *
 * Le **audio features** sono sintetiche: la pipeline di arricchimento
 * (EPIC 4.1) non scrive ancora feature vere. Il profilo è **per fase**, non
 * per brano: i brani del *pop* hanno valence bassa e energy bassa (mood
 * `sad`), quelli dell'*indie folk* valence alta e energy medio-alta (mood
 * `happy`). Il generatore è deterministico (seed derivato dall'id del
 * brano): lo stesso fixture produce sempre le stesse ere.
 */

const DAY_MS = 86_400_000;

/** Profilo di mood della fase *pop* (diurna, malinconica). */
const POP_PROFILE = {
  valenceMin: 0.25,
  valenceMax: 0.35,
  energyMin: 0.3,
  energyMax: 0.4,
};

/** Profilo di mood della fase *indie folk* (notturna, felice). */
const FOLK_PROFILE = {
  valenceMin: 0.75,
  valenceMax: 0.85,
  energyMin: 0.6,
  energyMax: 0.7,
};

/** Il fixture, con le feature sintetiche per fase. */
function loadEraShift() {
  const scenario = loadScenario('era-shift');
  const pop = scenario.tracks.filter((track) => track.genres.includes('pop'));
  const folk = scenario.tracks.filter((track) => track.genres.includes('indie'));
  const features = [
    ...syntheticFeaturesFor(pop, POP_PROFILE),
    ...syntheticFeaturesFor(folk, FOLK_PROFILE),
  ];
  return { ...scenario, features };
}

/** Il giorno del cambio di gusto: 8 settimane di *pop*. */
const SWITCH_DAY = 56;

describe('era detector sul fixture di scenario (10§3.3)', () => {
  it('era-shift: il cambio di gusto produce due ere', async () => {
    const scenario = loadEraShift();
    const engine = new EraEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    expect(generated).toHaveLength(2);
    expect(scenario.expectedInsights.eraCount).toContain('2 ere');
  });

  it('era-shift: il confine cade sul cambio di gusto dichiarato', async () => {
    const scenario = loadEraShift();
    const engine = new EraEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const first = generated[0]!.insight;
    const start = scenario.listens[0]!.startedAt!;
    const boundaryDays = (first.periodEnd - start) / DAY_MS;

    // La granularità dell'algoritmo è `stepDays` (7 giorni): il confine
    // insegue il cambio di gusto, non lo precede di settimane.
    expect(Math.abs(boundaryDays - SWITCH_DAY)).toBeLessThanOrEqual(7);
    expect(scenario.expectedInsights.eraBoundary).toContain('giorno 56');
  });

  it('era-shift: i mood delle due ere sono quelli dichiarati', async () => {
    const scenario = loadEraShift();
    const engine = new EraEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const moods = generated.map((era) => eraPayloadOf(era.insight).moodDominant);
    expect(moods[0]).toBe('sad');
    expect(moods[1]).toBe('happy');
    expect(scenario.expectedInsights.eraMoods).toEqual(['sad', 'happy']);
  });

  it('era-shift: le ere sono disgiunte e coprono la storia', async () => {
    const scenario = loadEraShift();
    const engine = new EraEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const first = generated[0]!.insight;
    const second = generated[1]!.insight;

    expect(first.periodStart).toBeLessThan(first.periodEnd);
    expect(second.periodStart).toBe(first.periodEnd);
    expect(second.periodStart).toBeLessThan(second.periodEnd);

    const start = scenario.listens[0]!.startedAt!;
    const last = scenario.listens[scenario.listens.length - 1]!.timestamp;
    expect(first.periodStart).toBe(start);
    expect(second.periodEnd).toBe(last);
  });

  it('era-shift: a parità di derivedVersion le stesse ere', async () => {
    const scenario = loadEraShift();
    const engine = new EraEngine({ translator: createLocaleTranslator('it') });

    const first = await engine.generate(scenario);
    const second = await engine.generate(scenario);

    expect(second.map((era) => era.insight.id)).toEqual(first.map((era) => era.insight.id));
    expect(second.map((era) => era.insight.derivedVersion)).toEqual(
      first.map((era) => era.insight.derivedVersion),
    );
    expect(second.map((era) => eraPayloadOf(era.insight))).toEqual(
      first.map((era) => eraPayloadOf(era.insight)),
    );
  });

  it('era-shift: senza feature non viene prodotta alcuna era (D-A.1)', async () => {
    const scenario = loadEraShift();
    const engine = new EraEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate({ ...scenario, features: [] });

    expect(generated).toEqual([]);
  });

  it('era-shift: ogni era porta mood, medie e distribuzione dei generi', async () => {
    const scenario = loadEraShift();
    const engine = new EraEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    for (const era of generated) {
      const payload = eraPayloadOf(era.insight);
      const mood: MoodId = payload.moodDominant;
      expect(['sad', 'angry', 'neutral', 'calm', 'happy', 'excited']).toContain(mood);
      expect(payload.avgValence).toBeGreaterThanOrEqual(0);
      expect(payload.avgValence).toBeLessThanOrEqual(1);
      expect(payload.avgEnergy).toBeGreaterThanOrEqual(0);
      expect(payload.avgEnergy).toBeLessThanOrEqual(1);
      expect(payload.nightShare).toBeGreaterThanOrEqual(0);
      expect(payload.nightShare).toBeLessThanOrEqual(1);
      expect(payload.repeatRate).toBeGreaterThanOrEqual(0);
      expect(payload.repeatRate).toBeLessThanOrEqual(1);
      expect(payload.topArtistIds.length).toBeGreaterThan(0);
      expect(payload.topTrackIds.length).toBeGreaterThan(0);
      expect(payload.label.length).toBeGreaterThan(0);
    }
  });
});

describe('era detector su una cronologia non composta (10§3.3)', () => {
  /**
   * `lockdown-2020` è una cronologia **non composta**: generi e ritmi
   * casuali su 9 mesi. Non ha un cambio netto, e il rilevamento produce
   * quindi una **sola era** — che è il comportamento giusto: il
   * change point detection cerca un crollo della similarità, e in una
   * cronologia priva di salti non ce n'è.
   *
   * Il fixture lo dichiara: `_metadata.expectedInsights.eraCount` = "1-2 ere".
   */
  it('lockdown-2020: le ere rispettano le invarianti di 04§5.5', async () => {
    const scenario = loadScenario('lockdown-2020');
    const features = syntheticFeaturesFor(scenario.tracks, {
      valenceMin: 0.2,
      valenceMax: 0.42,
      energyMin: 0.15,
      energyMax: 0.4,
    });
    const engine = new EraEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate({ ...scenario, features });

    expect(generated.length).toBeGreaterThanOrEqual(1);
    expect(generated.length).toBeLessThanOrEqual(2);

    for (const era of generated) {
      const payload = eraPayloadOf(era.insight);
      const total = Object.values(payload.genreDistribution).reduce((sum, value) => sum + value, 0);
      expect(total).toBeCloseTo(1, 10);
      expect(['sad', 'angry', 'neutral', 'calm', 'happy', 'excited']).toContain(
        payload.moodDominant,
      );
      expect(era.insight.periodStart).toBeLessThan(era.insight.periodEnd);
    }
  });
});
