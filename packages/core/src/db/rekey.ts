import type { Track } from '../schema';
import type { LifeSoundtrackDB } from './db';

/**
 * Promuove `canonicalKey` da `fuzzy:` a `isrc:`/`mbid:` quando un track acquisisce
 * ISRC o MBID via enrichment, unendo i duplicati (05-ARCHITECTURE.md §12.1,
 * 11-BACKLOG T0.7.3, Story 1.4 Dedup promozione).
 *
 * Logica:
 * 1. Per ogni track con `isrc` non nullo e canonicalKey `fuzzy:*`, cerca track esistenti
 *    con quello stesso ISRC (canonicalKey `isrc:*`).
 * 2. Se esiste già una track `isrc:*` per quell'ISRC: sposta tutti i `listens.trackId`
 *    dalla track fuzzy alla track vincitrice, aggrega `listenCount`, cancella la
 *    track fuzzy.
 * 3. Se non esiste: rinomina la canonicalKey della track stessa in `isrc:<isrc>` (bulkPut
 *    su PK diversa, poi delete della vecchia).
 * 4. Stessa cosa per `mbid`.
 *
 * Idempotente: rieseguirla più volte non crea duplicati né perde dati.
 * Ogni operazione avviene in una singola transazione Dexie (atomicità).
 *
 * @returns report con il numero di track promosse e duplicati uniti.
 */
export interface RekeyReport {
  promoted: number; // track la cui canonicalKey è cambiata (fuzzy -> isrc/mbid)
  merged: number; // coppie di track fuzzy unite in una isrc/mbid esistente
  listenedMoved: number; // listen eventi riorientati verso la track vincitrice
}

export async function rekey(db: LifeSoundtrackDB): Promise<RekeyReport> {
  let promoted = 0;
  let merged = 0;
  let listenedMoved = 0;

  const tracks = await db.tracks.toArray();

  for (const track of tracks) {
    const isFuzzy = track.canonicalKey.startsWith('fuzzy:');
    if (!isFuzzy) continue;

    const targetKey = track.isrc ? `isrc:${track.isrc}` : track.mbid ? `mbid:${track.mbid}` : null;
    if (!targetKey) continue;

    const existing = await db.tracks.get(targetKey);
    if (existing) {
      // Unisci la track fuzzy nella track esistente (isrc/mbid).
      const listens = await db.listens.where('trackId').equals(track.id).toArray();
      if (listens.length > 0) {
        await db.listens.bulkPut(listens.map((l) => ({ ...l, trackId: existing.id })));
        listenedMoved += listens.length;
      }
      existing.listenCount = (existing.listenCount ?? 0) + (track.listenCount ?? 0);
      await db.tracks.put(existing);
      await db.tracks.delete(track.canonicalKey);
      merged += 1;
    } else {
      // Rinomina la canonicalKey: copia con nuova PK, cancella la vecchia.
      const renamed: Track = { ...track, canonicalKey: targetKey };
      await db.tracks.put(renamed);
      await db.tracks.delete(track.canonicalKey);
      promoted += 1;
    }
  }

  return { promoted, merged, listenedMoved };
}
