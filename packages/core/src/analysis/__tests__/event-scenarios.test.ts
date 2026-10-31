import { describe, expect, it } from 'vitest';
import type { EventKind } from '../../schema';
import { EventEngine } from '../event';
import {
  createLocaleTranslator,
  eventPayloadOf,
  loadScenario,
  syntheticFeaturesByArtist,
} from './helpers';

/**
 * Test dell'event detector sul **fixture di scenario** — 10-TESTING.md §3.3
 * (Story 2.3, AC "Test su fixture di scenario: determinismo e copertura dei
 * casi minimi").
 *
 * Il fixture `listening-spike` è una cronologia **composta**: 81 giorni di
 * baseline (6 artisti noti, 4-7 ascolti al giorno, 3 giorni di silenzio) e
 * poi 14 giorni di **picco** (20 ascolti al giorno, un artista che domina e 4
 * artisti nuovi ogni giorno). Le attese sono dichiarate nel fixture stesso
 * (`_metadata.expectedInsights`).
 *
 * Le **audio features** sono sintetiche: la pipeline di arricchimento
 * (EPIC 4.1) non scrive ancora feature vere. Il profilo è **per artista**,
 * non per genere: la baseline deve avere una varianza giornaliera della
 * valence, altrimenti la deviazione standard sarebbe zero e lo z-score sulla
 * valence non sarebbe definito.
 */

const DAY_MS = 86_400_000;

/**
 * La valence dei 6 artisti noti della baseline.
 *
 * I valori sono sparsi attorno a 0.5: la **media** giornaliera dipende dal
 * mix di artisti del giorno (la rotazione ne cambia la composizione), e la
 * sua deviazione standard è non nulla — il presupposto dello z-score sulla
 * valence (04§6.3).
 */
const BASELINE_VALENCE: Readonly<Record<string, number>> = {
  'ar-evt-a1': 0.35,
  'ar-evt-a2': 0.42,
  'ar-evt-a3': 0.48,
  'ar-evt-a4': 0.52,
  'ar-evt-a5': 0.58,
  'ar-evt-a6': 0.65,
};

/** La valence del picco: crolla (è il `valence_drop` del fixture). */
const SPIKE_VALENCE = 0.15;

/** Il giorno del picco, in giorni dalla prima data (dichiarato nel fixture). */
const SPIKE_DAY = 81;

/** Il fixture, con le feature sintetiche per artista. */
function loadListeningSpike() {
  const scenario = loadScenario('listening-spike');
  const features = syntheticFeaturesByArtist(scenario.tracks, BASELINE_VALENCE, SPIKE_VALENCE);
  return { ...scenario, features };
}

/** I tipi di evento rilevati, in ordine. */
function typesOf(generated: ReadonlyArray<{ payload: { eventType: EventKind } }>): EventKind[] {
  return generated.map((event) => event.payload.eventType);
}

describe('event detector sul fixture di scenario (10§3.3)', () => {
  it('listening-spike: il rilevamento produce i tipi dichiarati dal fixture', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const types = new Set(typesOf(generated));
    const expected = scenario.expectedInsights.eventTypes as string[];

    for (const type of expected) {
      expect(types.has(type as EventKind)).toBe(true);
    }
  });

  it('listening-spike: il picco produce un volume_spike e un valence_drop', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const spike = generated.filter(
      (event) =>
        event.payload.eventType === 'volume_spike' || event.payload.eventType === 'valence_drop',
    );
    expect(spike.length).toBeGreaterThanOrEqual(2);

    const start = scenario.listens[0]!.startedAt!;
    for (const event of spike) {
      const day = (event.insight.periodStart - start) / DAY_MS;
      // La finestra del detector deve essere **dentro** il picco: il confine
      // non può precedere l'inizio del picco di più di una finestra.
      expect(day).toBeGreaterThanOrEqual(SPIKE_DAY - 14);
      expect(day).toBeLessThanOrEqual(SPIKE_DAY);
    }
    expect(scenario.expectedInsights.spikeStart).toContain('giorno 81');
  });

  it('listening-spike: il silenzio dichiarato viene rilevato', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const silences = generated.filter((event) => event.payload.eventType === 'silence');
    expect(silences).toHaveLength(1);

    const metrics = silences[0]!.payload.metrics;
    expect(metrics.duration_days!).toBeGreaterThanOrEqual(3);
    expect(metrics.duration_days!).toBeLessThan(5);
    expect(scenario.expectedInsights.silenceDays).toContain('3 giorni');
  });

  it('listening-spike: l’artefista che domina il picco viene dichiarato', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const spikes = generated.filter((event) => event.payload.eventType === 'spike_artist');
    expect(spikes.length).toBeGreaterThanOrEqual(1);

    const dominant = spikes[0]!;
    expect(dominant.payload.description).toContain('Dominante');
    // La quota dell'artista che domina: 12 ascolti su 20 al giorno.
    expect(dominant.payload.metrics.window_share!).toBeGreaterThan(0.5);
  });

  it('listening-spike: il genere che domina il picco viene dichiarato', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const spikes = generated.filter((event) => event.payload.eventType === 'spike_genre');
    expect(spikes.length).toBeGreaterThanOrEqual(1);
    expect(spikes[0]!.payload.metrics.window_share!).toBeGreaterThan(0.5);
  });

  it('listening-spike: l’esplorazione conta gli artisti nuovi', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const explorations = generated.filter((event) => event.payload.eventType === 'exploration');
    expect(explorations.length).toBeGreaterThanOrEqual(1);

    for (const exploration of explorations) {
      // 4 artisti nuovi al giorno: la finestra di 7 giorni ne conta 28.
      expect(exploration.payload.metrics.new_artists!).toBeGreaterThanOrEqual(10);
    }
  });

  it('listening-spike: la baseline non produce picchi di quota', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const start = scenario.listens[0]!.startedAt!;
    for (const event of generated) {
      if (event.payload.eventType !== 'spike_artist' && event.payload.eventType !== 'spike_genre') {
        continue;
      }
      const day = (event.insight.periodStart - start) / DAY_MS;
      // La baseline occupa i giorni 0-80: nessun picco di quota deve
      // iniziare lì (gli artisti noti sono equi, nessuno domina).
      expect(day).toBeGreaterThanOrEqual(SPIKE_DAY - 14);
    }
  });

  it('listening-spike: gli eventi rispettano le invarianti di 04§6.7', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate(scenario);

    const valid: EventKind[] = [
      'spike_artist',
      'spike_genre',
      'valence_drop',
      'valence_rise',
      'volume_spike',
      'volume_drop',
      'exploration',
      'silence',
    ];

    for (const event of generated) {
      expect(valid).toContain(event.payload.eventType);
      expect(event.insight.confidence).toBeGreaterThanOrEqual(0);
      expect(event.insight.confidence).toBeLessThanOrEqual(1);
      expect(event.insight.periodStart).toBeLessThan(event.insight.periodEnd);
      expect(event.insight.type).toBe('event');
      expect(event.payload.description.length).toBeGreaterThan(0);
      expect(event.insight.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('listening-spike: a parità di derivedVersion gli stessi eventi', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });

    const first = await engine.generate(scenario);
    const second = await engine.generate(scenario);

    expect(second.map((event) => event.insight.id)).toEqual(first.map((event) => event.insight.id));
    expect(second.map((event) => event.insight.derivedVersion)).toEqual(
      first.map((event) => event.insight.derivedVersion),
    );
    expect(second.map((event) => eventPayloadOf(event.insight))).toEqual(
      first.map((event) => eventPayloadOf(event.insight)),
    );
  });

  it('listening-spike: senza feature non viene prodotto alcun evento di valence', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const generated = await engine.generate({ ...scenario, features: [] });

    const types = typesOf(generated);
    expect(types).not.toContain('valence_drop');
    expect(types).not.toContain('valence_rise');
    // Gli eventi che non dipendono dalle feature restano: il volume, le quote
    // e il silenzio derivano dagli ascolti.
    expect(types).toContain('volume_spike');
  });

  it('listening-spike: le feature euristiche non alimentano l’analisi (D-AF.4)', async () => {
    const scenario = loadListeningSpike();
    const engine = new EventEngine({ translator: createLocaleTranslator('it') });
    const heuristic = scenario.features.map((feature) => ({
      ...feature,
      source: 'heuristic' as const,
    }));
    const generated = await engine.generate({ ...scenario, features: heuristic });

    const types = typesOf(generated);
    expect(types).not.toContain('valence_drop');
    expect(types).not.toContain('valence_rise');
  });
});
