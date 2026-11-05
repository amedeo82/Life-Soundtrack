/**
 * Modello puro di Esplora (⑨) — Story 3.3, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §6 e `docs/07-UI-SPEC.md` §2.8.
 *
 * Il modello **non sa nulla del database né dell'i18n**: riceve i dati
 * dell'utente (il suo catalogo) e restituisce i risultati della ricerca,
 * ordinati per `listenCount` decrescente. Le etichette sono tradotte dalla
 * schermata, che è l'unico punto che parla i18n.
 *
 * La ricerca è **sulle sole cose dell'utente** (`06§2.9`): nessuna rete,
 * nessun indice globale. Il nome del modello contiene "explore" perché la
 * schermata si chiama Esplora, non perché esplori la rete.
 */

import type { Album, Artist, MoodId, Track } from '@core/schema';

/** Le tab di Esplora: le etichette esistono già (`explore.tab.*`). */
export const EXPLORE_TABS = ['artists', 'tracks', 'albums', 'genres', 'mood'] as const;

export type ExploreTab = (typeof EXPLORE_TABS)[number];

/** Un risultato della ricerca, pronto per la UI. */
export interface ExploreResult {
  /** Id stabile del risultato (usato come chiave React e come `data-testid`). */
  readonly id: string;
  /** A che tab appartiene. */
  readonly kind: ExploreTab;
  /** Il nome (artista, brano, album, genere) o l'id del mood. */
  readonly title: string;
  /** Il contesto: l'artista di un brano, l'artista di un album. */
  readonly subtitle: string | null;
  /** Il mood del periodo (solo tab Mood). */
  readonly mood: MoodId | null;
  /** Quanti ascolti: l'ordinamento è su questo numero. */
  readonly listenCount: number;
  /** Il timestamp UTC del periodo (solo tab Mood): serve al deep-link. */
  readonly at: number | null;
}

/** Un periodo con il suo mood (tab Mood): deriva dagli insight `mood_day`. */
export interface MoodPeriod {
  /** Id dell'insight (deterministico). */
  readonly id: string;
  /** Il mood del periodo. */
  readonly mood: MoodId;
  /** Inizio del periodo (unix ms UTC). */
  readonly at: number;
  /** Fine del periodo (unix ms UTC). */
  readonly end: number;
  /** Quanti ascolti copre il periodo. */
  readonly eventCount: number;
}

/** Il catalogo dell'utente: le tre tabelle su cui si cerca. */
export interface ExploreCatalog {
  readonly artists: readonly Artist[];
  readonly tracks: readonly Track[];
  readonly albums: readonly Album[];
}

/** Il numero massimo di risultati per tab: la lista scorre, non cresce all'infinito. */
export const EXPLORE_RESULT_LIMIT = 50;

/**
 * Normalizza la query: minuscole, spazi compattati.
 *
 * Una query vuota è **valida**: significa «mostra tutto». Il chiamante
 * distingue il caso «nessuna ricerca» dal caso «nessun risultato».
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Il testo contiene la query (sottostringa, case-insensitive)? */
export function matchesQuery(text: string, normalizedQuery: string): boolean {
  if (normalizedQuery === '') return true;
  return text.toLowerCase().includes(normalizedQuery);
}

/**
 * L'ordinamento dei risultati: `listenCount` decrescente, poi nome crescente.
 *
 * Il nome è il criterio di spareggio: due artisti con lo stesso numero di
 * ascolti hanno un ordine **stabile**, altrimenti la lista cambierebbe a ogni
 * render e il deep-link punterebbe a un risultato diverso.
 */
export function sortResults(results: readonly ExploreResult[]): ExploreResult[] {
  return [...results].sort((a, b) => {
    if (b.listenCount !== a.listenCount) return b.listenCount - a.listenCount;
    return a.title.localeCompare(b.title);
  });
}

/**
 * L'indice dei generi: `genre -> ascolti totali`.
 *
 * Il genere non è una tabella: sta dentro `Track.genres` (`02§3.3`). Il
 * conteggio è la somma dei `listenCount` dei brani che lo portano, così
 * l'ordinamento è lo stesso degli altri tab.
 */
export function buildGenreIndex(tracks: readonly Track[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const track of tracks) {
    for (const genre of track.genres) {
      index.set(genre, (index.get(genre) ?? 0) + track.listenCount);
    }
  }
  return index;
}

/** I brani di un album, con il loro conteggio. */
function listensByAlbum(tracks: readonly Track[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const track of tracks) {
    if (!track.albumId) continue;
    index.set(track.albumId, (index.get(track.albumId) ?? 0) + track.listenCount);
  }
  return index;
}

/** Il tab Artisti. */
export function searchArtists(
  artists: readonly Artist[],
  query: string,
  limit: number = EXPLORE_RESULT_LIMIT,
): ExploreResult[] {
  const normalized = normalizeQuery(query);
  const results: ExploreResult[] = [];
  for (const artist of artists) {
    if (!matchesQuery(artist.name, normalized)) continue;
    results.push({
      id: artist.id,
      kind: 'artists',
      title: artist.name,
      subtitle: null,
      mood: null,
      listenCount: artist.listenCount,
      at: null,
    });
  }
  return sortResults(results).slice(0, limit);
}

/** Il tab Brani. */
export function searchTracks(
  tracks: readonly Track[],
  artistsById: ReadonlyMap<string, Artist>,
  query: string,
  limit: number = EXPLORE_RESULT_LIMIT,
): ExploreResult[] {
  const normalized = normalizeQuery(query);
  const results: ExploreResult[] = [];
  for (const track of tracks) {
    if (!matchesQuery(track.name, normalized)) continue;
    results.push({
      id: track.id,
      kind: 'tracks',
      title: track.name,
      subtitle: artistsById.get(track.artistId)?.name ?? null,
      mood: null,
      listenCount: track.listenCount,
      at: null,
    });
  }
  return sortResults(results).slice(0, limit);
}

/** Il tab Album. */
export function searchAlbums(
  albums: readonly Album[],
  tracks: readonly Track[],
  artistsById: ReadonlyMap<string, Artist>,
  query: string,
  limit: number = EXPLORE_RESULT_LIMIT,
): ExploreResult[] {
  const normalized = normalizeQuery(query);
  const listens = listensByAlbum(tracks);
  const results: ExploreResult[] = [];
  for (const album of albums) {
    if (!matchesQuery(album.name, normalized)) continue;
    results.push({
      id: album.id,
      kind: 'albums',
      title: album.name,
      subtitle: artistsById.get(album.artistId)?.name ?? null,
      mood: null,
      listenCount: listens.get(album.id) ?? 0,
      at: null,
    });
  }
  return sortResults(results).slice(0, limit);
}

/** Il tab Generi. */
export function searchGenres(
  tracks: readonly Track[],
  query: string,
  limit: number = EXPLORE_RESULT_LIMIT,
): ExploreResult[] {
  const normalized = normalizeQuery(query);
  const index = buildGenreIndex(tracks);
  const results: ExploreResult[] = [];
  for (const [genre, listenCount] of index) {
    if (!matchesQuery(genre, normalized)) continue;
    results.push({
      id: `genre:${genre}`,
      kind: 'genres',
      title: genre,
      subtitle: null,
      mood: null,
      listenCount,
      at: null,
    });
  }
  return sortResults(results).slice(0, limit);
}

/**
 * Il tab Mood: i periodi in cui un mood è stato dominante.
 *
 * L'ordinamento è per data decrescente (il periodo più recente prima) e non
 * per `listenCount`: qui il numero non è la notizia, il tempo lo è.
 *
 * La query filtra sul **mood** (il suo id, che è stabile fra le lingue: il
 * testo tradotto cambierebbe i risultati a seconda della lingua dell'UI).
 */
export function moodPeriodResults(
  periods: readonly MoodPeriod[],
  mood: MoodId | null,
  query: string = '',
  limit: number = EXPLORE_RESULT_LIMIT,
): ExploreResult[] {
  const normalized = normalizeQuery(query);
  const selected = periods.filter(
    (period) =>
      (mood === null || period.mood === mood) &&
      (normalized === '' || matchesQuery(period.mood, normalized)),
  );
  return [...selected]
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map((period) => ({
      id: period.id,
      kind: 'mood' as const,
      title: period.mood,
      subtitle: null,
      mood: period.mood,
      listenCount: period.eventCount,
      at: period.at,
    }));
}

/**
 * Il risultato di una ricerca, per tab.
 *
 * La funzione è il **punto unico** in cui i tab si differenziano: la
 * schermata chiama questa e non sa come sono fatti i risultati.
 */
export function exploreResults(
  tab: ExploreTab,
  catalog: ExploreCatalog,
  periods: readonly MoodPeriod[],
  query: string,
  mood: MoodId | null,
  limit: number = EXPLORE_RESULT_LIMIT,
): ExploreResult[] {
  const artistsById = new Map(catalog.artists.map((artist) => [artist.id, artist]));
  switch (tab) {
    case 'artists':
      return searchArtists(catalog.artists, query, limit);
    case 'tracks':
      return searchTracks(catalog.tracks, artistsById, query, limit);
    case 'albums':
      return searchAlbums(catalog.albums, catalog.tracks, artistsById, query, limit);
    case 'genres':
      return searchGenres(catalog.tracks, query, limit);
    case 'mood':
      return moodPeriodResults(periods, mood, query, limit);
    default:
      return [];
  }
}
