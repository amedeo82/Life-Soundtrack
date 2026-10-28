import type { Insight, InsightType } from '../schema';
import type { LifeSoundtrackDB } from './db';

/**
 * Repository degli insight — `02-DATA-SCHEMA.md` §6 (tabella `insights`).
 *
 * Gli insight sono **derivati**: portano la `derivedVersion` del set di
 * parametri che li ha generati. MIG-3 (02§7): quando i parametri cambiano,
 * la versione cambia e gli insight con la versione vecchia diventano
 * `stale` → vengono ricalcolati al prossimo avvio.
 *
 * Lo `status` di `Insight` (`pending | confirmed | corrected | dismissed`,
 * 02§3.6) **non** prevede `stale`: la condizione "stale" è derivata dal
 * confronto fra la `derivedVersion` dell'insight e quella corrente. È il
 * motivo per cui qui esiste `listStaleInsights`.
 */

/** Scrive (o sovrascrive, per id) gli insight. */
export async function putInsights(db: LifeSoundtrackDB, insights: Insight[]): Promise<void> {
  if (insights.length === 0) return;
  await db.insights.bulkPut(insights);
}

/** Insight di un tipo, in ordine di periodo. */
export async function listInsightsByType(
  db: LifeSoundtrackDB,
  type: InsightType,
): Promise<Insight[]> {
  const insights = await db.insights.where('type').equals(type).toArray();
  return insights.sort((a, b) => a.periodStart - b.periodStart);
}

/** Insight di un tipo generati da una specifica `derivedVersion`. */
export async function listInsightsByTypeAndVersion(
  db: LifeSoundtrackDB,
  type: InsightType,
  derivedVersion: string,
): Promise<Insight[]> {
  const insights = await listInsightsByType(db, type);
  return insights.filter((insight) => insight.derivedVersion === derivedVersion);
}

/**
 * Insight **stale** (MIG-3): la loro `derivedVersion` non è più quella
 * corrente, quindi il risultato è stato prodotto da parametri diversi e va
 * ricalcolato.
 */
export async function listStaleInsights(
  db: LifeSoundtrackDB,
  type: InsightType,
  currentDerivedVersion: string,
): Promise<Insight[]> {
  const insights = await listInsightsByType(db, type);
  return insights.filter((insight) => insight.derivedVersion !== currentDerivedVersion);
}

/** Elimina gli insight indicati. */
export async function deleteInsightsById(db: LifeSoundtrackDB, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.insights.bulkDelete(ids);
}

/** Opzioni di `replaceInsights`. */
export interface ReplaceInsightsOptions {
  /** Tipo degli insight da sostituire. */
  readonly type: InsightType;
  /** Insight appena calcolati. */
  readonly insights: Insight[];
  /** `derivedVersion` corrente dei parametri. */
  readonly derivedVersion: string;
  /** Periodo ricalcolato: gli insight di quel periodo vengono sostituiti. */
  readonly periodStart: number;
}

/** Esito di `replaceInsights`. */
export interface ReplaceInsightsReport {
  /** Insight scritti. */
  readonly inserted: number;
  /** Insight `stale` rimossi (versione vecchia dei parametri). */
  readonly removedStale: number;
  /** Insight del periodo ricalcolato, sostituiti da quelli nuovi. */
  readonly removedSuperseded: number;
}

/**
 * Sostituisce gli insight di un tipo per un periodo, e rimuove quelli
 * `stale` (MIG-3).
 *
 * È il passo di **ricalcolo**: il generatore ha prodotto gli insight del
 * periodo con i parametri correnti, quindi gli insight dello stesso periodo
 * generati prima (o con parametri diversi) non devono sopravvivere. Tutto
 * avviene in una transazione: o la nuova generazione è persistita, o
 * restano gli insight precedenti.
 */
export async function replaceInsights(
  db: LifeSoundtrackDB,
  options: ReplaceInsightsOptions,
): Promise<ReplaceInsightsReport> {
  return db.transaction('rw', [db.insights], async () => {
    const existing = await db.insights.where('type').equals(options.type).toArray();
    const stale = existing.filter((insight) => insight.derivedVersion !== options.derivedVersion);
    const superseded = existing.filter(
      (insight) =>
        insight.derivedVersion === options.derivedVersion &&
        insight.periodStart === options.periodStart,
    );
    const removed = [...stale, ...superseded];
    if (removed.length > 0) {
      await db.insights.bulkDelete(removed.map((insight) => insight.id));
    }
    if (options.insights.length > 0) {
      await db.insights.bulkPut(options.insights);
    }
    return {
      inserted: options.insights.length,
      removedStale: stale.length,
      removedSuperseded: superseded.length,
    };
  });
}
