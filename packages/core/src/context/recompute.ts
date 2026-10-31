/**
 * Ricalcolo dei periodi di contesto — `19-GEO-CONTEXT.md` §5.3 e §10 (E20).
 *
 * Il ricalcolo è **esplicito**: un re-import con toggle diversi **non**
 * azzera i campi già persistiti (`02-DATA-SCHEMA.md` §10, E20). Il
 * percorso è: classificazione (puro) → sostituzione dei periodi (transazione).
 *
 * Il toggle `deriveContext` (default `true`, `19§7.1`) governa l'esistenza
 * della classificazione: non raccoglie nulla di nuovo, opera su dati già
 * conservati, ma l'utente può spegnerlo.
 */

import type { ContextPeriod, ListenEvent } from '../schema';
import { loadUserTimezone } from '../db/settings';
import type { LifeSoundtrackDB } from '../db/db';
import { ContextEngine } from './engine';
import { replaceContextPeriods, type ContextStoreReport } from './storage';
import type { ContextConfig } from './types';
import type { ContextClassification } from './classifier';

/** Opzioni del ricalcolo. */
export interface RecomputeContextOptions {
  /** Override dei parametri del classificatore. */
  readonly config?: Partial<ContextConfig>;
  /** Fuso IANA dell'utente. Default: quello salvato nelle impostazioni. */
  readonly userTimezone?: string;
  /** Consenso `carDetectionConsent`: senza, `car` non è classificabile. */
  readonly carDetectionConsent?: boolean;
  /** Toggle `deriveContext`: se `false`, il ricalcolo non viene eseguito. */
  readonly deriveContext?: boolean;
  /** Istante di riferimento (unix ms UTC). */
  readonly now?: number;
}

/** Esito del ricalcolo. */
export interface RecomputeContextReport extends ContextStoreReport {
  /** Periodi calcolati (già aggregati: sotto la soglia non arrivano qui). */
  readonly periods: ContextPeriod[];
  /** Classificazione di ogni slot. */
  readonly classifications: readonly ContextClassification[];
  /** Slot scartati perché sotto la soglia di aggregazione. */
  readonly droppedBelowThreshold: number;
  /** Paese di riferimento usato dalle regole. */
  readonly referenceCountry: string | null;
  /** `derivedVersion` dei parametri correnti. */
  readonly derivedVersion: string;
  /** True se il ricalcolo è stato saltato (`deriveContext` disattivato). */
  readonly skipped: boolean;
}

/**
 * Ricalcola i periodi di contesto e li persiste.
 *
 * @param db - database locale (tabella `contexts`).
 * @param listens - ascolti da classificare.
 * @param options - parametri, fuso, consenso e toggle.
 * @returns l'esito del ricalcolo.
 */
export async function recomputeContextPeriods(
  db: LifeSoundtrackDB,
  listens: readonly ListenEvent[],
  options: RecomputeContextOptions = {},
): Promise<RecomputeContextReport> {
  const userTimezone = options.userTimezone ?? (await loadUserTimezone(db));
  const engine = new ContextEngine({
    ...(options.config ? { config: options.config } : {}),
    userTimezone,
    ...(options.carDetectionConsent !== undefined
      ? { carDetectionConsent: options.carDetectionConsent }
      : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  const derivedVersion = await engine.derivedVersion();

  if (options.deriveContext === false) {
    return {
      inserted: 0,
      removedStale: 0,
      removedSuperseded: 0,
      preservedUserVerdicts: 0,
      skippedOverlapped: 0,
      periods: [],
      classifications: [],
      droppedBelowThreshold: 0,
      referenceCountry: null,
      derivedVersion,
      skipped: true,
    };
  }

  const generated = await engine.generate(listens);
  const report = await replaceContextPeriods(db, {
    periods: generated.periods,
    derivedVersion: generated.derivedVersion,
  });

  return {
    ...report,
    periods: generated.periods,
    classifications: generated.classifications,
    droppedBelowThreshold: generated.droppedBelowThreshold,
    referenceCountry: generated.referenceCountry,
    derivedVersion: generated.derivedVersion,
    skipped: false,
  };
}
