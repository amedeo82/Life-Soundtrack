import type { Track } from '../schema';
import type { LifeSoundtrackDB } from './db';
import { recount } from './recount';

/**
 * Promuove `canonicalKey` da `fuzzy:` a `isrc:`/`mbid:` quando una track
 * acquisisce ISRC o MBID via enrichment, unendo i duplicati
 * (05-ARCHITECTURE.md §12.1, 11-BACKLOG Story 1.4).
 *
 * Finché una piattaforma non espone ISRC/MBID, il brano vive con la chiave
 * "fuzzy" (nome + artista + bucket di durata): è una **ipotesi**, non
 * un'identità. Quando l'enrichment scopre l'ISRC, l'ipotesi diventa
 * un'identità (`isrc:<ISRC>`) e va promossa — e la `canonicalKey` è la
 * **chiave primaria** della tabella `tracks` (`02§6`), quindi promuoverla
 * significa cambiare la PK.
 *
 * I duplicati sono il caso normale, non l'eccezione: due varianti fuzzy
 * dello stesso brano (durata diversa, nome con feat., artisti con "&" vs "e")
 * hanno due chiavi diverse e, dopo l'enrichment, **la stessa** chiave
 * `isrc:`. Vanno fusi, e i riferimenti (`listens`, `library`,
 * `playlistItems`, `features`) riorientati sulla track sopravvissuta.
 *
 * Regole applicate:
 * - **priorità DEDUP-1 su DEDUP-2** (`02§5`): con ISRC e MBID presenti
 *   vince l'ISRC; l'ISRC è normalizzato in maiuscole, come la chiave che
 *   calcola la pipeline (`isrc:<ISRC upper>`);
 * - **sopravvivenza deterministica**: sopravvive la track più vecchia
 *   (primo ascolto), con disambiguazione sul `canonicalKey`. Senza un ordine
 *   esplicito "chi sopravvive" dipenderebbe dall'ordine di enumerazione di
 *   IndexedDB, che non è garantito (lesson 34-1: stesso input → stesso
 *   output su ogni piattaforma);
 * - **atomicità**: tutta l'operazione è in una transazione Dexie — o la
 *   promozione avviene tutta, o non avviene (MIG-1: nessuna migrazione
 *   lascia il DB a metà);
 * - **i contatori non sono calcolati qui**: `recount()` (MIG-4) resta
 *   l'unica fonte di verità di `listenCount` (`02§7`).
 *
 * Il job è **idempotente**: rieseguito quando non c'è più nulla da promuove
 * non tocca nulla.
 */
export interface RekeyReport {
  /** Track esaminate. */
  tracksScanned: number;
  /** Track promosse: la PK è passata da `fuzzy:` a `isrc:`/`mbid:`. */
  promoted: number;
  /** Track fuse in una già esistente (la perdente è stata eliminata). */
  merged: number;
  /** `ListenEvent` riorientati verso la track vincitrice. */
  listenedMoved: number;
  /** `LibraryItem` riorientati. */
  libraryRepointed: number;
  /** `PlaylistItem` riorientati. */
  playlistItemsRepointed: number;
  /** `AudioFeatures` riorientate (o scartate se la sopravvissuta ne ha già). */
  featuresRepointed: number;
}

/**
 * Chiave di destinazione di una track, secondo la priorità DEDUP `02§5`:
 * **DEDUP-1** (ISRC) su **DEDUP-2** (MBID). `null` se la track non ha
 * identificativi (allora resta `fuzzy:` e non va promossa).
 */
export function rekeyTargetKey(track: Track): string | null {
  const isrc = track.isrc?.trim().toUpperCase();
  if (isrc) {
    return `isrc:${isrc}`;
  }
  const mbid = track.mbid?.trim();
  if (mbid) {
    return `mbid:${mbid}`;
  }
  return null;
}

/**
 * Unione dei campi di due track che vanno fuse: la sopravvissuta conserva i
 * propri dati (nome, artista, album) e **accetta** quelli della perdente solo
 * dove non ha già un valore. I `platformIds` e i `genres` sono **unioni**:
 * perderli significa perdere la traccia da quale piattaforma è arrivato
 * l'ascolto.
 */
function mergeTrackFields(survivor: Track, loser: Track): Track {
  return {
    ...survivor,
    albumId: survivor.albumId ?? loser.albumId,
    durationMs: survivor.durationMs ?? loser.durationMs,
    explicit: survivor.explicit ?? loser.explicit,
    isrc: survivor.isrc ?? loser.isrc,
    mbid: survivor.mbid ?? loser.mbid,
    genres: [...new Set([...survivor.genres, ...loser.genres])],
    platformIds: { ...loser.platformIds, ...survivor.platformIds },
    firstSeenAt: Math.min(survivor.firstSeenAt, loser.firstSeenAt),
    lastSeenAt: Math.max(survivor.lastSeenAt, loser.lastSeenAt),
  };
}

/**
 * Ordine deterministico di fusione: sopravvive la track **più vecchia**
 * (primo ascolto), con disambiguazione sul `canonicalKey`.
 */
function compareForSurvival(a: Track, b: Track): number {
  if (a.firstSeenAt !== b.firstSeenAt) {
    return a.firstSeenAt - b.firstSeenAt;
  }
  return a.canonicalKey.localeCompare(b.canonicalKey);
}

/**
 * Promuove le chiavi `fuzzy:` a `isrc:`/`mbid:` e unisce i duplicati.
 *
 * Una sola transazione: o la promozione avviene tutta, o non avviene.
 */
export async function rekey(db: LifeSoundtrackDB): Promise<RekeyReport> {
  const report: RekeyReport = {
    tracksScanned: 0,
    promoted: 0,
    merged: 0,
    listenedMoved: 0,
    libraryRepointed: 0,
    playlistItemsRepointed: 0,
    featuresRepointed: 0,
  };

  const tracks = await db.tracks.toArray();
  report.tracksScanned = tracks.length;

  // Gruppo per chiave di destinazione: `isrc:X` → [track...].
  const groups = new Map<string, Track[]>();
  for (const track of tracks) {
    if (!track.canonicalKey.startsWith('fuzzy:')) {
      // Già promossa: non si tocca.
      continue;
    }
    const target = rekeyTargetKey(track);
    if (!target || target === track.canonicalKey) {
      // Nessun identificativo: resta `fuzzy:` (è ancora un'ipotesi).
      continue;
    }
    const bucket = groups.get(target);
    if (bucket) {
      bucket.push(track);
    } else {
      groups.set(target, [track]);
    }
  }
  if (groups.size === 0) {
    return report;
  }

  const byCanonicalKey = new Map(tracks.map((track) => [track.canonicalKey, track]));

  await db.transaction(
    'rw',
    [db.tracks, db.listens, db.library, db.playlistItems, db.features],
    async () => {
      for (const [target, group] of groups) {
        // Se esiste già una track con la chiave di destinazione (promossa in
        // un run precedente, o importata da una fonte che espone gli
        // identificativi) quella vince: è già la versione "ufficiale" del
        // brano. Altrimenti sopravvive la più vecchia del gruppo.
        const existing = byCanonicalKey.get(target);
        const ordered = [...group].sort(compareForSurvival);
        let survivor = existing ?? ordered[0]!;
        const losers = ordered.filter((track) => track.id !== survivor.id);

        if (!existing) {
          // Promozione in-place: cambia la PK, ma l'UUID interno resta: gli
          // ascolti restano collegati senza toccarli.
          const promoted: Track = { ...survivor, canonicalKey: target };
          await db.tracks.delete(survivor.canonicalKey);
          await db.tracks.put(promoted);
          byCanonicalKey.delete(survivor.canonicalKey);
          byCanonicalKey.set(target, promoted);
          survivor = promoted;
          report.promoted += 1;
        }

        for (const loser of losers) {
          const merged: Track = mergeTrackFields(survivor, loser);
          await db.tracks.put(merged);
          survivor = merged;
          report.merged += 1;

          report.listenedMoved += await db.listens
            .where('trackId')
            .equals(loser.id)
            .modify((listen) => {
              listen.trackId = survivor.id;
            });

          report.libraryRepointed += await repointLibrary(db, loser.id, survivor.id);
          report.playlistItemsRepointed += await repointPlaylistItems(db, loser.id, survivor.id);
          report.featuresRepointed += await repointFeatures(db, loser.id, survivor.id);

          await db.tracks.delete(loser.canonicalKey);
          byCanonicalKey.delete(loser.canonicalKey);
        }
      }
    },
  );

  // I contatori denormalizzati sono ricalcolati dalla fonte di verità
  // (MIG-4): `rekey()` non li calcola da sé.
  await recount(db);

  return report;
}

/**
 * Riorienta i `LibraryItem` della track perdente su quella sopravvissuta.
 * Se la sopravvissuta ha già un item per la stessa piattaforma, quello della
 * perdente è **scartato** (duplicato): la libreria è un insieme.
 *
 * Le query usano solo indici **esistenti** (`02§6`: `library` ha `trackId`
 * e `platform`, non la coppia `[platform+trackId]`): un `where()` su un
 * indice inesistente fallisce a runtime, e un job di manutenzione non può
 * fallire per la forma della query.
 */
async function repointLibrary(
  db: LifeSoundtrackDB,
  loserId: string,
  survivorId: string,
): Promise<number> {
  const items = await db.library.where('trackId').equals(loserId).toArray();
  let moved = 0;
  for (const item of items) {
    const duplicate = await db.library
      .where('platform')
      .equals(item.platform)
      .filter((candidate) => candidate.trackId === survivorId)
      .first();
    if (duplicate) {
      await db.library.delete(item.id);
      continue;
    }
    await db.library.put({ ...item, trackId: survivorId });
    moved += 1;
  }
  return moved;
}

/**
 * Riorienta i `PlaylistItem` della track perdente su quella sopravvissuta.
 * La PK è composta `[playlistId+trackId]`: il riorientamento cambia la PK,
 * quindi è delete + put. Se la playlist contiene già il brano, l'item
 * duplicato viene scartato.
 *
 * `playlistItems` non ha un indice su `trackId` (`02§6`), quindi la
 * ricerca è un filtro: è un job di manutenzione, non un percorso critico.
 */
async function repointPlaylistItems(
  db: LifeSoundtrackDB,
  loserId: string,
  survivorId: string,
): Promise<number> {
  const items = await db.playlistItems.filter((item) => item.trackId === loserId).toArray();
  let moved = 0;
  for (const item of items) {
    const duplicate = await db.playlistItems
      .where('playlistId')
      .equals(item.playlistId)
      .filter((candidate) => candidate.trackId === survivorId)
      .first();
    if (duplicate) {
      await db.playlistItems.delete([item.playlistId, item.trackId]);
      continue;
    }
    await db.playlistItems.delete([item.playlistId, item.trackId]);
    await db.playlistItems.put({ ...item, trackId: survivorId });
    moved += 1;
  }
  return moved;
}

/**
 * Riorienta le `AudioFeatures` della track perdente. Se la sopravvissuta ne
 * ha già, quelle della perdente vengono scartate: le features sono per
 * brano, non per variante.
 */
async function repointFeatures(
  db: LifeSoundtrackDB,
  loserId: string,
  survivorId: string,
): Promise<number> {
  const features = await db.features.get(loserId);
  if (!features) {
    return 0;
  }
  const existing = await db.features.get(survivorId);
  if (existing) {
    await db.features.delete(loserId);
    return 0;
  }
  await db.features.put({ ...features, trackId: survivorId });
  await db.features.delete(loserId);
  return 1;
}
