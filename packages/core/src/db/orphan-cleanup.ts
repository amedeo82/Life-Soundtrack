import type { LifeSoundtrackDB } from './db';

/**
 * Rimuove `tracks` e `artists` orfani: entità non referenziate da nessun
 * `listens.trackId` né da alcun `library.trackId`/`library.artistId` (05-ARCHITECTURE.md §12.1,
 * 11-BACKLOG T0.7.3).
 *
 * Eseguito mensile (job in Web Worker idle) o manualmente dall'operatore.
 * Idempotente e sicuro: cancella solo entità senza riferimenti attivi.
 *
 * @returns report con il numero di track e artisti rimossi.
 */
export interface OrphanCleanupReport {
  tracksRemoved: number;
  artistsRemoved: number;
}

export async function orphanCleanup(db: LifeSoundtrackDB): Promise<OrphanCleanupReport> {
  // ID di track ancora referenziati da ascolti o libreria.
  const listens = await db.listens.toArray();
  const library = await db.library.toArray();

  const referencedTrackIds = new Set<string>();
  for (const l of listens) if (l.trackId) referencedTrackIds.add(l.trackId);
  for (const item of library) if (item.trackId) referencedTrackIds.add(item.trackId);

  const tracks = await db.tracks.toArray();
  const orphanTracks = tracks.filter((t) => !referencedTrackIds.has(t.id));
  for (const t of orphanTracks) {
    await db.tracks.delete(t.canonicalKey);
  }

  // ID di artisti ancora referenziati da tracce superstiti o libreria.
  const referencedArtistIds = new Set<string>();
  for (const t of tracks) {
    if (!orphanTracks.some((o) => o.id === t.id) && t.artistId) referencedArtistIds.add(t.artistId);
  }
  for (const item of library) if (item.artistId) referencedArtistIds.add(item.artistId);

  const artists = await db.artists.toArray();
  const orphanArtists = artists.filter((a) => !referencedArtistIds.has(a.id));
  for (const a of orphanArtists) {
    await db.artists.delete(a.id);
  }

  return { tracksRemoved: orphanTracks.length, artistsRemoved: orphanArtists.length };
}
