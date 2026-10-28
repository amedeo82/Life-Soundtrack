/**
 * Spazio di lavoro del memory engine: indici derivati dagli ascolti.
 *
 * I generatori ricevono gli stessi dati (ascolti, brani, artisti) e li
 * interrogano in modo diverso. Costruire gli indici **una volta** per
 * generazione evita il quadrato dei generatori: con 6.000 ascolti e 60
 * artisti, un filtro per artista per ogni artista costa 360.000
 * confronti, e la specifica chiede un'esecuzione sotto i 5 secondi
 * (04§10).
 */

import type { Artist, ListenEvent, Track } from '../../schema';
import type { MemoryConfig, MemoryContext } from './types';
import { eventTime } from './datetime';

/** Indici e contesto condivisi dai generatori. */
export interface MemoryWorkspace {
  /** Contesto di sola lettura (ascolti, brani, artisti, oggi, parametri). */
  readonly context: MemoryContext;
  /** Ascolti raggruppati per artista, in ordine cronologico. */
  readonly eventsByArtist: ReadonlyMap<string, ListenEvent[]>;
  /** Ascolti raggruppati per brano, in ordine cronologico. */
  readonly eventsByTrack: ReadonlyMap<string, ListenEvent[]>;
}

/** Input grezzo del memory engine. */
export interface MemoryWorkspaceInput {
  readonly listens: readonly ListenEvent[];
  readonly tracks: readonly Track[];
  readonly artists: readonly Artist[];
  readonly today: number;
  readonly locale: string;
  readonly config: MemoryConfig;
}

/**
 * Costruisce il workspace: indici per artista e per brano, e gli eventi
 * riordinati per tempo (l'ordinamento è necessario a `first_time`, `return`
 * e `milestone`).
 */
export function buildWorkspace(input: MemoryWorkspaceInput): MemoryWorkspace {
  const tracks = new Map(input.tracks.map((track) => [track.id, track]));
  const artists = new Map(input.artists.map((artist) => [artist.id, artist]));

  const listens = [...input.listens].sort((a, b) => eventTime(a) - eventTime(b));

  const eventsByArtist = new Map<string, ListenEvent[]>();
  const eventsByTrack = new Map<string, ListenEvent[]>();
  for (const event of listens) {
    const byTrack = eventsByTrack.get(event.trackId);
    if (byTrack) {
      byTrack.push(event);
    } else {
      eventsByTrack.set(event.trackId, [event]);
    }
    const artistId = tracks.get(event.trackId)?.artistId;
    if (artistId === undefined) continue;
    const byArtist = eventsByArtist.get(artistId);
    if (byArtist) {
      byArtist.push(event);
    } else {
      eventsByArtist.set(artistId, [event]);
    }
  }

  return {
    context: {
      listens,
      tracks,
      artists,
      today: input.today,
      locale: input.locale,
      config: input.config,
    },
    eventsByArtist,
    eventsByTrack,
  };
}

/** Artista di un ascolto (via il brano), `null` se il brano non è noto. */
export function artistIdOf(workspace: MemoryWorkspace, event: ListenEvent): string | null {
  return workspace.context.tracks.get(event.trackId)?.artistId ?? null;
}

/** Nome dell'artista, `null` se l'artista non è noto. */
export function artistNameOf(workspace: MemoryWorkspace, artistId: string | null): string | null {
  if (artistId === null) return null;
  return workspace.context.artists.get(artistId)?.name ?? null;
}
