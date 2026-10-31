/**
 * Persistenza dei periodi di contesto — tabella `contexts`
 * (`02-DATA-SCHEMA.md` §6.3, Story 1.6).
 *
 * I periodi sono **derivati** (MIG-2): ricostruibili con `recompute()` a
 * partire dagli ascolti. Portano la `derivedVersion` dei parametri che li
 * ha generati (MIG-3): quando i parametri cambiano, i periodi vecchi
 * diventano `stale` e vengono ricalcolati.
 *
 * Il **verdetto dell'utente** (`status` ≠ `pending`, `userLabel`) è
 * **stabile**: un ricalcolo non cancella un periodo che l'utente ha
 * confermato, corretto o scartato, e non ne duplica uno sovrapposto
 * (E20: «i campi già persistiti non vengono azzerati»).
 */

import type { ContextKind, ContextPeriod } from '../schema';
import type { LifeSoundtrackDB } from '../db/db';

/** Verdetto dell'utente su un periodo (stesso modello di `Insight.status`). */
export type ContextVerdict = 'pending' | 'confirmed' | 'corrected' | 'dismissed';

/** Esito di una scrittura/ricomputazione dei periodi. */
export interface ContextStoreReport {
  /** Periodi scritti. */
  readonly inserted: number;
  /** Periodi `stale` rimossi (versione vecchia dei parametri). */
  readonly removedStale: number;
  /** Periodi superseded rimossi (stessa versione, ricalcolati). */
  readonly removedSuperseded: number;
  /** Periodi con verdetto utente preservati. */
  readonly preservedUserVerdicts: number;
  /** Periodi nuovi scartati perché sovrappongono un periodo con verdetto utente. */
  readonly skippedOverlapped: number;
}

/** Scrive (o sovrascrive, per id) i periodi di contesto. */
export async function putContextPeriods(
  db: LifeSoundtrackDB,
  periods: ContextPeriod[],
): Promise<void> {
  if (periods.length === 0) return;
  await db.contexts.bulkPut(periods);
}

/** Tutti i periodi, in ordine di inizio. */
export async function listContextPeriods(db: LifeSoundtrackDB): Promise<ContextPeriod[]> {
  const periods = await db.contexts.toArray();
  return periods.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
}

/** Periodi di un `kind`, in ordine di inizio. */
export async function listContextPeriodsByKind(
  db: LifeSoundtrackDB,
  kind: ContextKind,
): Promise<ContextPeriod[]> {
  const periods = await db.contexts.where('kind').equals(kind).toArray();
  return periods.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
}

/** Periodi generati da una specifica `derivedVersion`. */
export async function listContextPeriodsByVersion(
  db: LifeSoundtrackDB,
  derivedVersion: string,
): Promise<ContextPeriod[]> {
  const periods = await db.contexts.where('derivedVersion').equals(derivedVersion).toArray();
  return periods.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
}

/** Elimina i periodi indicati. */
export async function deleteContextPeriods(db: LifeSoundtrackDB, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.contexts.bulkDelete(ids);
}

/** Opzioni di `replaceContextPeriods`. */
export interface ReplaceContextPeriodsOptions {
  /** Periodi appena calcolati. */
  readonly periods: ContextPeriod[];
  /** `derivedVersion` corrente dei parametri. */
  readonly derivedVersion: string;
}

/**
 * Sostituisce i periodi di contesto con quelli appena calcolati.
 *
 * È il passo di **ricalcolo** (`19§10` E20): il ricalcolo è **esplicito**,
 * mai automatico a ogni import. I periodi con verdetto dell'utente
 * (`status` ≠ `pending`) sono preservati e i periodi nuovi che li
 * sovrappongono vengono scartati: la volontà dell'utente non viene
 * sovrascritta da un ricalcolo.
 *
 * Tutto avviene in una transazione: o la nuova generazione è persistita, o
 * restano i periodi precedenti.
 */
export async function replaceContextPeriods(
  db: LifeSoundtrackDB,
  options: ReplaceContextPeriodsOptions,
): Promise<ContextStoreReport> {
  return db.transaction('rw', [db.contexts], async () => {
    const existing = await db.contexts.toArray();
    const preserved = existing.filter((period) => period.status !== 'pending');
    const stale = existing.filter(
      (period) => period.status === 'pending' && period.derivedVersion !== options.derivedVersion,
    );
    const superseded = existing.filter(
      (period) => period.status === 'pending' && period.derivedVersion === options.derivedVersion,
    );
    const toInsert = options.periods.filter(
      (period) => !preserved.some((kept) => overlaps(kept, period)),
    );
    const removed = [...stale, ...superseded];
    if (removed.length > 0) {
      await db.contexts.bulkDelete(removed.map((period) => period.id));
    }
    if (toInsert.length > 0) {
      await db.contexts.bulkPut(toInsert);
    }
    return {
      inserted: toInsert.length,
      removedStale: stale.length,
      removedSuperseded: superseded.length,
      preservedUserVerdicts: preserved.length,
      skippedOverlapped: options.periods.length - toInsert.length,
    };
  });
}

/**
 * Applica il verdetto dell'utente a un periodo.
 *
 * `confirmed` e `corrected` mantengono il periodo; `dismissed` lo scarta
 * dalla vista senza cancellarlo (il dato resta locale e ispezionabile).
 * `userLabel` è l'etichetta libera ("Casa di mia madre").
 */
export async function setContextPeriodVerdict(
  db: LifeSoundtrackDB,
  id: string,
  verdict: { status: ContextVerdict; userLabel?: string | null },
): Promise<ContextPeriod | null> {
  const period = await db.contexts.get(id);
  if (!period) return null;
  const updated: ContextPeriod = {
    ...period,
    status: verdict.status,
    userLabel: verdict.userLabel ?? period.userLabel,
  };
  await db.contexts.put(updated);
  return updated;
}

/** Due periodi si sovrappongono (intervalli temporali)? */
export function overlaps(a: ContextPeriod, b: ContextPeriod): boolean {
  return a.startTime <= b.endTime && b.startTime <= a.endTime;
}
