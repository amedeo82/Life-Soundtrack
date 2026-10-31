import { describe, expect, it } from 'vitest';
import type { DeviceType, ListenEvent } from '../../schema';
import { ContextEngine } from '../engine';
import { computeContextDerivedVersion } from '../derivedVersion';
import { DEFAULT_CONTEXT_CONFIG, resolveContextConfig } from '../types';
import { classifySlot, type ContextSlot } from '../classifier';

/**
 * Test del classificatore di contesto L1 — 19-GEO-CONTEXT.md §5 (Story 1.6).
 *
 * Le regole sono testate una per una: ogni test costruisce lo **slot**
 * minimo che la regola richiede, così il fallimento dice quale regola ha
 * cambiato comportamento.
 */

let seq = 0;

/** Ascolto sintetico: solo i campi che il classificatore usa. */
function listen(overrides: Partial<ListenEvent> = {}): ListenEvent {
  seq += 1;
  const timestamp = overrides.timestamp ?? Date.UTC(2024, 3, 1, 18, 0, 0) + seq * 60_000;
  return {
    id: `le-ctx-${seq}`,
    eventKey: `spotify:ctx-${seq}`,
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

/** Slot minimale con i valori di default delle regole. */
function slot(overrides: Partial<ContextSlot> = {}): ContextSlot {
  return {
    key: '2024-04-01|mobile',
    dayKey: '2024-04-01',
    weekday: 1,
    weekStart: Date.UTC(2024, 3, 1),
    deviceType: 'mobile',
    country: 'IT',
    sessions: [],
    startTime: Date.UTC(2024, 3, 1, 18, 0, 0),
    endTime: Date.UTC(2024, 3, 1, 18, 30, 0),
    eventCount: 5,
    hours: [18, 18, 19, 19, 19],
    dominantHour: 18,
    dominantBand: 18,
    bandShare: 1,
    medianSessionMs: 30 * 60_000,
    ...overrides,
  };
}

/** Classifica uno slot con i valori di default. */
function classify(overrides: Partial<Parameters<typeof classifySlot>[0]> = {}) {
  return classifySlot({
    slot: slot(),
    referenceCountry: 'IT',
    carDetectionConsent: false,
    travelDays: 0,
    recurrence: 0,
    config: DEFAULT_CONTEXT_CONFIG,
    ...overrides,
  });
}

describe('configurazione del classificatore (19§5.2 — D-B.3)', () => {
  it('i default sono quelli ratificati in 19§5.2/§5.3', () => {
    expect(DEFAULT_CONTEXT_CONFIG.aggregationThreshold).toBe(0.5);
    expect(DEFAULT_CONTEXT_CONFIG.carConfidence).toBe(0.9);
    expect(DEFAULT_CONTEXT_CONFIG.travelConfidence).toBe(0.9);
    expect(DEFAULT_CONTEXT_CONFIG.homeConfidence).toBe(0.7);
    expect(DEFAULT_CONTEXT_CONFIG.workConfidence).toBe(0.6);
    expect(DEFAULT_CONTEXT_CONFIG.commuteConfidence).toBe(0.4);
    expect(DEFAULT_CONTEXT_CONFIG.referenceWindowDays).toBe(90);
    expect(DEFAULT_CONTEXT_CONFIG.referenceMinEvents).toBe(30);
    expect(DEFAULT_CONTEXT_CONFIG.travelMinDays).toBe(3);
    expect(DEFAULT_CONTEXT_CONFIG.homeRecurrence).toBe(0.6);
    expect(DEFAULT_CONTEXT_CONFIG.workRecurrence).toBe(0.5);
    expect(DEFAULT_CONTEXT_CONFIG.timeBandHours).toBe(2);
    expect(DEFAULT_CONTEXT_CONFIG.commuteMaxSessionMs).toBe(25 * 60_000);
  });

  it('l’override parziale completa i parametri mancanti con i default', () => {
    const config = resolveContextConfig({ aggregationThreshold: 0.7 });
    expect(config.aggregationThreshold).toBe(0.7);
    expect(config.homeConfidence).toBe(DEFAULT_CONTEXT_CONFIG.homeConfidence);
    expect(config.workDeviceTypes).toEqual(['desktop', 'web']);
  });

  it('la derivedVersion cambia se cambia un parametro (MIG-3)', async () => {
    const base = await computeContextDerivedVersion(DEFAULT_CONTEXT_CONFIG);
    const changed = await computeContextDerivedVersion(
      resolveContextConfig({ homeRecurrence: 0.61 }),
    );
    expect(base).toHaveLength(8);
    expect(base).not.toBe(changed);
    // Stessi parametri ⇒ stessa versione.
    expect(await computeContextDerivedVersion(DEFAULT_CONTEXT_CONFIG)).toBe(base);
  });
});

describe('regole R1..R7 (19§5.2)', () => {
  it('R1 — nessun paese e nessun dispositivo utile ⇒ unknown, confidenza 0', () => {
    const result = classify({
      slot: slot({ country: null, deviceType: 'unknown' as DeviceType }),
    });
    expect(result.kind).toBe('unknown');
    expect(result.rule).toBe('R1');
    expect(result.confidence).toBe(0);
  });

  it('R1 — il caso complementare (nessun paese, dispositivo utile) è `away`', () => {
    const result = classify({ slot: slot({ country: null, deviceType: 'mobile' }) });
    expect(result.kind).toBe('away');
    expect(result.rule).toBe('R1-away');
    expect(result.confidence).toBe(DEFAULT_CONTEXT_CONFIG.awayConfidence);
  });

  it('R2 — `car` con consenso ⇒ car, confidenza 0.9', () => {
    const result = classify({
      slot: slot({ deviceType: 'car', country: 'IT' }),
      carDetectionConsent: true,
    });
    expect(result.kind).toBe('car');
    expect(result.rule).toBe('R2');
    expect(result.confidence).toBe(0.9);
  });

  it('R2 — `car` senza consenso non viene classificato `car`', () => {
    const result = classify({ slot: slot({ deviceType: 'car', country: 'IT' }) });
    expect(result.kind).not.toBe('car');
  });

  it('R3 — paese diverso dal riferimento per 3 giorni ⇒ travel, confidenza 0.9', () => {
    const result = classify({
      slot: slot({ country: 'DE' }),
      referenceCountry: 'IT',
      travelDays: 3,
    });
    expect(result.kind).toBe('travel');
    expect(result.rule).toBe('R3');
    expect(result.confidence).toBe(0.9);
  });

  it('R3 — un solo giorno fuori dal paese di riferimento non è viaggio', () => {
    const result = classify({
      slot: slot({ country: 'DE' }),
      referenceCountry: 'IT',
      travelDays: 1,
    });
    expect(result.kind).not.toBe('travel');
  });

  it('R4 — paese di riferimento, sera, banda coerente e ricorrenza ≥ 60% ⇒ home', () => {
    const result = classify({ recurrence: 0.6 });
    expect(result.kind).toBe('home');
    expect(result.rule).toBe('R4');
    expect(result.confidence).toBe(0.7);
  });

  it('R4 — sotto il 60% di ricorrenza non è home', () => {
    const result = classify({ recurrence: 0.59 });
    expect(result.kind).not.toBe('home');
  });

  it('R4 — un cluster di sessioni brevi non è `home` (scelta dichiarata)', () => {
    const result = classify({
      slot: slot({ medianSessionMs: 8 * 60_000 }),
      recurrence: 0.75,
    });
    expect(result.kind).toBe('commute');
    expect(result.rule).toBe('R6');
  });

  it('R5 — ore lavorative feriali su desktop/web con ricorrenza ≥ 50% ⇒ work', () => {
    const result = classify({
      slot: slot({
        deviceType: 'desktop',
        hours: [9, 9, 9, 10, 10],
        dominantHour: 9,
        dominantBand: 8,
        bandShare: 1,
      }),
      recurrence: 0.5,
    });
    expect(result.kind).toBe('work');
    expect(result.rule).toBe('R5');
    expect(result.confidence).toBe(0.6);
  });

  it('R5 — il weekend non è `work`', () => {
    const result = classify({
      slot: slot({
        deviceType: 'desktop',
        weekday: 6,
        hours: [9, 9, 9, 10, 10],
        dominantHour: 9,
        dominantBand: 8,
        bandShare: 1,
      }),
      recurrence: 0.5,
    });
    expect(result.kind).not.toBe('work');
  });

  it('R6 — mobile con sessioni brevi ⇒ commute, confidenza 0.4 (sotto soglia)', () => {
    const result = classify({ slot: slot({ medianSessionMs: 8 * 60_000 }) });
    expect(result.kind).toBe('commute');
    expect(result.rule).toBe('R6');
    expect(result.confidence).toBe(0.4);
    expect(result.confidence).toBeLessThan(DEFAULT_CONTEXT_CONFIG.aggregationThreshold);
  });

  it('R7 — nessuna delle precedenti ⇒ unknown', () => {
    const result = classify({
      slot: slot({ deviceType: 'speaker', medianSessionMs: 60 * 60_000 }),
      recurrence: 0,
    });
    expect(result.kind).toBe('unknown');
    expect(result.rule).toBe('R7');
    expect(result.confidence).toBe(0);
  });

  it('le regole sono valutate nell’ordine dichiarato: R2 precede R3', () => {
    const result = classify({
      slot: slot({ deviceType: 'car', country: 'DE' }),
      referenceCountry: 'IT',
      travelDays: 5,
      carDetectionConsent: true,
    });
    expect(result.rule).toBe('R2');
    expect(result.kind).toBe('car');
  });
});

describe('motore — determinismo e soglia di aggregazione (19§5.3)', () => {
  const engine = new ContextEngine({
    userTimezone: 'Europe/Rome',
    now: Date.UTC(2024, 3, 29),
  });

  it('gli ascolti senza paese e senza dispositivo utile producono zero periodi', async () => {
    const generated = await engine.generate([
      listen({ country: null, deviceType: 'unknown' }),
      listen({ country: null, deviceType: 'unknown' }),
    ]);
    expect(generated.periods).toHaveLength(0);
    expect(generated.droppedBelowThreshold).toBeGreaterThan(0);
  });

  it('a parità di input produce sempre gli stessi periodi (id compresi)', async () => {
    const listens = [
      listen({ timestamp: Date.UTC(2024, 3, 1, 18, 0, 0), country: 'IT' }),
      listen({ timestamp: Date.UTC(2024, 3, 1, 18, 5, 0), country: 'IT' }),
      listen({ timestamp: Date.UTC(2024, 3, 8, 18, 0, 0), country: 'IT' }),
      listen({ timestamp: Date.UTC(2024, 3, 8, 18, 5, 0), country: 'IT' }),
    ];
    const first = await engine.generate(listens);
    const second = await engine.generate(listens);
    expect(second.periods).toEqual(first.periods);
    expect(second.derivedVersion).toBe(first.derivedVersion);
  });

  it('i periodi sotto la soglia non vengono aggregati (E19)', async () => {
    // Slot mobile serale con sessioni brevi: sotto soglia (commute, 0.4).
    const listens = [listen({ timestamp: Date.UTC(2024, 3, 1, 18, 0, 0), durationMs: 60_000 })];
    const generated = await engine.generate(listens);
    expect(generated.periods).toHaveLength(0);
    expect(generated.classifications.every((c) => c.confidence < 0.5)).toBe(true);
  });
});
