import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ListenEvent } from '../../schema';
import { ContextEngine } from '../engine';

/**
 * Test del classificatore di contesto sul **fixture di scenario geo**
 * — 10-TESTING.md §3.3, 19-GEO-CONTEXT.md §5 (Story 1.6, T1.6.4).
 *
 * Il fixture `fixtures/scenarios/geo-context.json` è una cronologia
 * composta e deterministica: 4 settimane a Roma (Europe/Rome) con casa
 * serale, lavoro diurno da desktop, spostamenti brevi, tre giorni di viaggio
 * in Germania e una serata in auto.
 *
 * Il piano atteso è dichiarato nel `_metadata.expectedContexts` del fixture:
 * qui non si ricostruisce a mano, si verifica.
 */

interface GeoScenario {
  readonly listens: ListenEvent[];
  readonly _metadata: {
    readonly expectedContexts: Record<string, string>;
  };
}

/** Carica il fixture di scenario geo. */
function loadGeoScenario(): GeoScenario {
  const path = fileURLToPath(
    new URL('../../../../../fixtures/scenarios/geo-context.json', import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf8')) as GeoScenario;
}

/** Istante di riferimento: il giorno dopo la fine del fixture. */
const NOW = Date.UTC(2024, 3, 29);

/** Motore con le impostazioni del test: fuso dell'utente e consenso auto. */
function engine(overrides: { carDetectionConsent?: boolean; userTimezone?: string } = {}) {
  return new ContextEngine({
    userTimezone: overrides.userTimezone ?? 'Europe/Rome',
    carDetectionConsent: overrides.carDetectionConsent ?? true,
    now: NOW,
  });
}

describe('classificatore di contesto sul fixture geo (10§3.3, 19§5)', () => {
  it('riconosce i quattro contesti attesi: casa, lavoro, viaggio, auto', async () => {
    const scenario = loadGeoScenario();
    const generated = await engine().generate(scenario.listens);

    const kinds = new Set(generated.periods.map((period) => period.kind));
    expect(kinds).toContain('home');
    expect(kinds).toContain('work');
    expect(kinds).toContain('travel');
    expect(kinds).toContain('car');
  });

  it('usa l’Italia come paese di riferimento', async () => {
    const scenario = loadGeoScenario();
    const generated = await engine().generate(scenario.listens);
    expect(generated.referenceCountry).toBe('IT');
  });

  it('lo spostamento non viene aggregato: sotto la soglia 0.5 (E19)', async () => {
    const scenario = loadGeoScenario();
    const generated = await engine().generate(scenario.listens);

    // Gli slot di spostamento sono classificati `commute` (0.4)…
    const commutes = generated.classifications.filter((c) => c.kind === 'commute');
    expect(commutes.length).toBeGreaterThan(0);
    expect(commutes.every((c) => c.confidence < 0.5)).toBe(true);
    // …e quindi non producono nessun periodo.
    expect(generated.periods.some((period) => period.kind === 'commute')).toBe(false);
    expect(generated.droppedBelowThreshold).toBe(commutes.length);
  });

  it('il viaggio copre i tre giorni consecutivi in Germania', async () => {
    const scenario = loadGeoScenario();
    const generated = await engine().generate(scenario.listens);
    const travels = generated.periods.filter((period) => period.kind === 'travel');

    expect(travels).toHaveLength(1);
    expect(travels[0]?.country).toBe('DE');
    expect(travels[0]?.confidence).toBe(0.9);
    // 15 → 17 aprile 2024, ora locale Europe/Rome (UTC+2).
    expect(travels[0]?.startTime).toBe(Date.UTC(2024, 3, 15, 18, 0, 0));
    expect(travels[0]?.endTime).toBe(Date.UTC(2024, 3, 17, 18, 30, 0));
  });

  it('senza `carDetectionConsent` non esiste nessun periodo `car`', async () => {
    const scenario = loadGeoScenario();
    const generated = await engine({ carDetectionConsent: false }).generate(scenario.listens);
    expect(generated.periods.some((period) => period.kind === 'car')).toBe(false);
  });

  it('il fuso dell’utente cambia il risultato: i segnali sono locali', async () => {
    const scenario = loadGeoScenario();
    const local = await engine({ userTimezone: 'Europe/Rome' }).generate(scenario.listens);
    const utc = await engine({ userTimezone: 'UTC' }).generate(scenario.listens);

    // Stessa cronologia, fuso diverso ⇒ periodi diversi (le ore locali spostano
    // il pattern serale fuori dalla fascia domestica).
    expect(utc.periods.map((p) => p.id)).not.toEqual(local.periods.map((p) => p.id));
  });

  it('è deterministico: due esecuzioni producono gli stessi periodi, con gli stessi id', async () => {
    const scenario = loadGeoScenario();
    const first = await engine().generate(scenario.listens);
    const second = await engine().generate(scenario.listens);

    expect(second.periods).toEqual(first.periods);
    expect(second.derivedVersion).toBe(first.derivedVersion);
    // Gli id sono deterministici ⇒ il ricalcolo non crea duplicati.
    expect(new Set(first.periods.map((p) => p.id)).size).toBe(first.periods.length);
  });

  it('i periodi hanno confidenza e derivedVersion coerenti', async () => {
    const scenario = loadGeoScenario();
    const generated = await engine().generate(scenario.listens);

    for (const period of generated.periods) {
      expect(period.confidence).toBeGreaterThanOrEqual(0.5);
      expect(period.derivedVersion).toBe(generated.derivedVersion);
      expect(period.status).toBe('pending');
      expect(period.userLabel).toBeNull();
      expect(period.endTime).toBeGreaterThanOrEqual(period.startTime);
    }
    const confidences = new Map(
      generated.periods.map((period) => [period.kind, period.confidence]),
    );
    expect(confidences.get('home')).toBe(0.7);
    expect(confidences.get('work')).toBe(0.6);
    expect(confidences.get('travel')).toBe(0.9);
    expect(confidences.get('car')).toBe(0.9);
  });
});
