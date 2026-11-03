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

/**
 * I campi **dell'utente** su un insight: la nota libera e lo stato.
 *
 * `Insight.userNote` esiste per il testo libero dell'utente (Story 3.2:
 * il nome di un'era e le sue parole chiave, `docs/25-MEMORIES-SHARE-EXPLORE.md`
 * D-25.4) e `status` dice se l'utente ha confermato, corretto o nascosto
 * l'insight (`02-DATA-SCHEMA.md` §3.6).
 *
 * I due campi sono **separati** dal resto: sono scritti dai generatori
 * sempre a `userNote: null` / `status: 'pending'`, e sono gli unici che
 * sopravvivono al ricalcolo (vedi `preserveUserFields`).
 */
export interface InsightUserNote {
  /** Il testo libero dell'utente (`null` = nessuna nota). */
  readonly userNote: string | null;
  /** Lo stato dell'insight dopo l'intervento dell'utente. */
  readonly status: Insight['status'];
}

/**
 * Scrive la nota e lo stato di un insight, in una transazione.
 *
 * Restituisce l'insight aggiornato, oppure `null` se l'id non esiste: la
 * scrittura di un insight inesistente non è un errore (l'utente può aver
 * rinominato un'era che il ricalcolo ha appena rimosso), ma non è nemmeno
 * un'operazione riuscita.
 */
export async function setInsightUserNote(
  db: LifeSoundtrackDB,
  id: string,
  value: InsightUserNote,
): Promise<Insight | null> {
  return db.transaction('rw', [db.insights], async () => {
    const insight = await db.insights.get(id);
    if (!insight) return null;
    const updated: Insight = { ...insight, userNote: value.userNote, status: value.status };
    await db.insights.put(updated);
    return updated;
  });
}

/**
 * Cambia lo stato di un insight (`confirmed` / `corrected` / `dismissed`),
 * in una transazione. Vedi `setInsightUserNote` per il contratto.
 */
export async function setInsightStatus(
  db: LifeSoundtrackDB,
  id: string,
  status: Insight['status'],
): Promise<Insight | null> {
  return db.transaction('rw', [db.insights], async () => {
    const insight = await db.insights.get(id);
    if (!insight) return null;
    const updated: Insight = { ...insight, status };
    await db.insights.put(updated);
    return updated;
  });
}

/**
 * Riporta i **campi dell'utente** dagli insight esistenti a quelli nuovi.
 *
 * Il ricalcolo cancella e reinserisce gli insight (`replaceAllInsightsOfType`),
 * quindi un insight ricalcolato **perde** la nota e la conferma dell'utente:
 * il nome dato a un'era sparisirebbe al primo ricalcolo dell'analisi. La
 * correzione è qui, non nei generatori: gli id sono deterministici
 * (`era-${periodStart}`), quindi l'insight nuovo e quello vecchio sono lo
 * **stesso** insight e i campi dell'utente gli appartengono.
 *
 * Lo `status` è preservato solo se l'utente l'ha cambiato: i generatori
 * scrivono `pending`, che è il default e non distingue "non toccato" da
 * "toccato e riportato a pending".
 */
function preserveUserFields(existing: readonly Insight[], incoming: readonly Insight[]): Insight[] {
  const byId = new Map(existing.map((insight) => [insight.id, insight]));
  return incoming.map((insight) => {
    const previous = byId.get(insight.id);
    if (!previous) return insight;
    const userNote = previous.userNote !== null ? previous.userNote : insight.userNote;
    const status = previous.status !== 'pending' ? previous.status : insight.status;
    if (userNote === insight.userNote && status === insight.status) return insight;
    return { ...insight, userNote, status };
  });
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
      await db.insights.bulkPut(preserveUserFields(existing, options.insights));
    }
    return {
      inserted: options.insights.length,
      removedStale: stale.length,
      removedSuperseded: superseded.length,
    };
  });
}

/** Opzioni di `replaceAllInsightsOfType`. */
export interface ReplaceAllInsightsOfTypeOptions {
  /** Tipo degli insight da sostituire. */
  readonly type: InsightType;
  /** Insight appena calcolati (l'insieme completo del tipo). */
  readonly insights: Insight[];
  /** `derivedVersion` corrente dei parametri. */
  readonly derivedVersion: string;
}

/**
 * Sostituisce **tutti** gli insight di un tipo con quelli appena calcolati.
 *
 * È la variante per gli algoritmi la cui segmentazione dipende **dall'intera
 * storia**: le ere (04§5) sono calcolate sui confini dell'intero periodo, e
 * un ricalcolo può spostarli. `replaceInsightsOfType` (che sostituisce solo
 * i periodi ricalcolati) lascerebbe sopravvivere le ere i cui confini sono
 * cambiati: gli insight vecchi avrebbero un `periodStart` diverso da quello
 * dell'era nuova, e nessuno dei due meccanismi li rimuoverebbe.
 *
 * Qui si rimuovono **tutti** gli insight del tipo — qualunque versione
 * abbiano — e si scrivono quelli nuovi, in una transazione: o il nuovo
 * insieme è persistito, o resta il precedente.
 */
export async function replaceAllInsightsOfType(
  db: LifeSoundtrackDB,
  options: ReplaceAllInsightsOfTypeOptions,
): Promise<ReplaceInsightsReport> {
  return db.transaction('rw', [db.insights], async () => {
    const existing = await db.insights.where('type').equals(options.type).toArray();
    const stale = existing.filter((insight) => insight.derivedVersion !== options.derivedVersion);
    const superseded = existing.filter(
      (insight) => insight.derivedVersion === options.derivedVersion,
    );
    const removed = [...stale, ...superseded];
    if (removed.length > 0) {
      await db.insights.bulkDelete(removed.map((insight) => insight.id));
    }
    if (options.insights.length > 0) {
      await db.insights.bulkPut(preserveUserFields(existing, options.insights));
    }
    return {
      inserted: options.insights.length,
      removedStale: stale.length,
      removedSuperseded: superseded.length,
    };
  });
}

/** Opzioni di `replaceInsightsOfType`. */
export interface ReplaceInsightsOfTypeOptions {
  /** Tipo degli insight da sostituire. */
  readonly type: InsightType;
  /** Insight appena calcolati (uno o più periodi). */
  readonly insights: Insight[];
  /** `derivedVersion` corrente dei parametri. */
  readonly derivedVersion: string;
}

/**
 * Sostituisce gli insight di un tipo per **tutti i periodi ricalcolati**, e
 * rimuove quelli `stale` (MIG-3).
 *
 * È la variante **per batch** di `replaceInsights`: il mood tracker (04§3)
 * calcola il mood di tutti i periodi coperti dagli ascolti (giorni,
 * settimane, mesi) in una passata, e chiamare `replaceInsights` una volta per
 * periodo aprirebbe una transazione per ogni giorno.
 *
 * Restano intatti gli insight degli altri periodi dello stesso tipo: un
 * calcolo incrementale (04§1.2) che ricalcola solo la settimana corrente non
 * deve cancellare le settimane passate.
 */
export async function replaceInsightsOfType(
  db: LifeSoundtrackDB,
  options: ReplaceInsightsOfTypeOptions,
): Promise<ReplaceInsightsReport> {
  return db.transaction('rw', [db.insights], async () => {
    const existing = await db.insights.where('type').equals(options.type).toArray();
    const recalculated = new Set(options.insights.map((insight) => insight.periodStart));
    const stale = existing.filter((insight) => insight.derivedVersion !== options.derivedVersion);
    const superseded = existing.filter(
      (insight) =>
        insight.derivedVersion === options.derivedVersion && recalculated.has(insight.periodStart),
    );
    const removed = [...stale, ...superseded];
    if (removed.length > 0) {
      await db.insights.bulkDelete(removed.map((insight) => insight.id));
    }
    if (options.insights.length > 0) {
      await db.insights.bulkPut(preserveUserFields(existing, options.insights));
    }
    return {
      inserted: options.insights.length,
      removedStale: stale.length,
      removedSuperseded: superseded.length,
    };
  });
}
