import type { LifeSoundtrackDB } from './db';

/**
 * Ricalcola i contatori denormalizzati `listenCount` su `tracks` e `artists`
 * a partire dagli eventi di ascolto (02-DATA-SCHEMA.md §7 MIG-4, 11-BACKLOG T0.2.4).
 *
 * I contatori servono solo per performance UI: questa funzione è l'unica fonte
 * di verità di ricalcolo e può essere rieseguita in qualsiasi momento (idempotente).
 *
 * Semantica: `listens.trackId` referenzia `Track.id` (UUID, come nei fixture
 * db-seed `10-TESTING.md` §3.2); il contatore di un artista è la somma dei
 * contatori delle sue tracce. I contatori di entità senza ascolti vengono azzerati.
 */
export async function recount(db: LifeSoundtrackDB): Promise<void> {
  const trackCounts = new Map<string, number>();
  await db.listens.each((listen) => {
    trackCounts.set(listen.trackId, (trackCounts.get(listen.trackId) ?? 0) + 1);
  });

  const artistCounts = new Map<string, number>();
  await db.transaction('rw', db.tracks, db.artists, async () => {
    await db.tracks.toCollection().modify((track) => {
      const count = trackCounts.get(track.id) ?? 0;
      track.listenCount = count;
      if (count > 0) {
        artistCounts.set(track.artistId, (artistCounts.get(track.artistId) ?? 0) + count);
      }
    });
    await db.artists.toCollection().modify((artist) => {
      artist.listenCount = artistCounts.get(artist.id) ?? 0;
    });
  });
}
