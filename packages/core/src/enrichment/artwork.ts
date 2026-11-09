/**
 * L'artwork enrichment — `24-ARTWORK-ENRICHMENT.md` v1.0 🟢.
 *
 * La cascata delle fonti:
 *
 * ```
 * 1. iTunes Search API      (nessun auth, già in CSP, 20 req/min)
 * 2. Cover Art Archive      (nessun auth, serve MBID → Story 4.2, 1 req/s)
 * 3. placeholder gradient   (mai rete)
 * ```
 *
 * Il ramo Spotify Web API è **escluso** (D-24.2): il progetto non ha
 * infrastruttura OAuth per Spotify e gli export non contengono URL
 * di copertina.
 *
 * Regole non negoziabili:
 *
 * - `enrichMetadata = false` ⇒ **zero** uscite, **zero** scritture,
 *   **zero** letture della cache (come la cascata audio: `21§10.4`)
 * - il placeholder è **deterministico**: stesso `trackId` → stesso data URI
 * - il cursore `artwork.cursor` in `settings` ricorda i tentativi falliti
 *   (D-24.3: nessuna migrazione schema, coerenza col cursore scrobbling)
 */

import type { Track, Album } from '../schema';
import type { Clock, HttpClient, HttpResponse, Logger, RateLimiter } from './types';

/** La sorgente dell'artwork. */
export type ArtworkSource = 'itunes' | 'coverartarchive' | 'placeholder' | 'none';

/** Le dipendenze del resolver. */
export interface ArtworkDeps {
  readonly http: HttpClient;
  readonly limiter: RateLimiter;
  readonly clock: Clock;
  readonly logger?: Logger;
  readonly itunesEndpoint?: string;
  readonly coverArtEndpoint?: string;
}

/** Una richiesta di artwork. */
export interface ArtworkRequest {
  readonly trackId: string;
  readonly trackName: string;
  readonly artistName: string;
  readonly albumName: string | null;
  readonly albumId: string | null;
  readonly mbid: string | null;
}

/** L'esito del resolver. */
export interface ArtworkOutcome {
  readonly source: ArtworkSource;
  readonly url: string | null;
  readonly reason?: string | undefined;
}

/** L'host dell'iTunes Search API. */
export const ITUNES_SEARCH_ENDPOINT = 'https://itunes.apple.com/search';

/** L'host del Cover Art Archive. */
export const COVER_ART_ENDPOINT = 'https://coverartarchive.org';

/** L'endpoint di ricerca artwork iTunes (entity=album per artwork album). */
export const ITUNES_ALBUM_ENDPOINT = 'https://itunes.apple.com/search';

/** Un risultato dell'iTunes Search API per artwork. */
export interface ItunesArtworkResult {
  readonly trackId?: number;
  readonly trackName?: string;
  readonly artistName?: string;
  readonly collectionName?: string;
  readonly artworkUrl100?: string;
  readonly artworkUrl600?: string;
}

/** La risposta dell'iTunes Search API per artwork. */
export interface ItunesArtworkResponse {
  readonly resultCount?: number;
  readonly results?: readonly ItunesArtworkResult[];
}

/** Una entry del Cover Art Archive. */
export interface CoverArtArchiveImage {
  readonly url: string;
  readonly front: boolean;
}

/** La risposta del Cover Art Archive. */
export interface CoverArtArchiveResponse {
  readonly release: string;
  readonly images?: readonly CoverArtArchiveImage[];
}

/** Il cursore dell'artwork in `settings` (D-24.3). */
export interface ArtworkCursor {
  readonly lastAttemptedAt: number | null;
  readonly attemptedTrackIds: readonly string[];
}

/** Cursore vuoto. */
export const EMPTY_ARTWORK_CURSOR: ArtworkCursor = {
  lastAttemptedAt: null,
  attemptedTrackIds: [],
};

/** Chiave del cursore in `settings`. */
export const ARTWORK_CURSOR_KEY = 'artwork.cursor';

/**
 * Normalizza un testo per il confronto (match esatto).
 *
 * Minuscole, senza diacritici, spazi compattati.
 *
 * @param value - il testo da normalizzare.
 * @returns il testo normalizzato.
 */
export function normalizeMatchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Il match è esatto su titolo **e** artista?
 *
 * @param result - il risultato iTunes.
 * @param trackName - il nome del brano cercato.
 * @param artistName - il nome dell'artista cercato.
 * @returns true se titolo e artista coincidono dopo normalizzazione.
 */
export function isExactArtworkMatch(
  result: ItunesArtworkResult,
  trackName: string,
  artistName: string,
): boolean {
  const title = result.trackName;
  const artist = result.artistName;
  if (title === undefined || artist === undefined) return false;
  return (
    normalizeMatchText(title) === normalizeMatchText(trackName) &&
    normalizeMatchText(artist) === normalizeMatchText(artistName)
  );
}

/**
 * Costruisce l'URL della ricerca iTunes per artwork.
 *
 * Usa `entity=album` per ottenere `artworkUrl600` (D-24.4).
 *
 * @param trackName - il nome del brano.
 * @param artistName - il nome dell'artista.
 * @param endpoint - l'endpoint base.
 * @returns l'URL completo della ricerca.
 */
export function buildItunesArtworkUrl(
  trackName: string,
  artistName: string,
  endpoint: string = ITUNES_ALBUM_ENDPOINT,
): string {
  const params = new URLSearchParams({
    term: trackName,
    artist: artistName,
    entity: 'album',
    attribute: 'albumTerm',
  });
  return `${endpoint}?${params.toString()}`;
}

/**
 * Trasforma `artworkUrl100` in `artworkUrl600` (D-24.4).
 *
 * La regola: `replace('100x100bb', '600x600bb')`, con fallback all'URL
 * originale se il pattern non c'è.
 *
 * @param url - l'URL da trasformare.
 * @returns l'URL trasformato o l'originale.
 */
export function upgradeArtworkUrl(url: string): string {
  return url.replace('100x100bb', '600x600bb').replace('100x100', '600x600');
}

/**
 * Genera un placeholder gradient deterministico (data URI SVG).
 *
 * Derivato dall'hash di `trackId` con la palette mood di `design/tokens.json`.
 * Il risultato è un **data URI** (`data:image/svg+xml;base64,…`), così
 * nessun host esterno serve l'immagine e il placeholder funziona offline.
 *
 * @param trackId - l'ID del brano.
 * @returns un data URI SVG.
 */
export function generatePlaceholderGradient(trackId: string): string {
  // Hash semplice deterministico del trackId
  let hash = 0;
  for (let i = 0; i < trackId.length; i++) {
    hash = ((hash << 5) - hash + trackId.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);

  // Palette mood da design/tokens.json (color.mood.*)
  const moodColors = [
    '#3B82F6', // sad
    '#EF4444', // angry
    '#8B5CF6', // neutral
    '#10B981', // calm
    '#F59E0B', // happy
    '#EC4899', // excited
  ];

  const color1 = moodColors[hash % moodColors.length];
  const color2 = moodColors[(hash + 2) % moodColors.length];
  const color3 = moodColors[(hash + 4) % moodColors.length];

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}" />
      <stop offset="50%" stop-color="${color2}" />
      <stop offset="100%" stop-color="${color3}" />
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#grad)" />
</svg>
  `.trim();

  const base64 = btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Cerca l'artwork su iTunes Search API.
 *
 * Match esatto su titolo + artista (come `itunes.ts:110-122`).
 * Prende `artworkUrl100` → `artworkUrl600` (D-24.4).
 *
 * @param request - la richiesta di artwork.
 * @param deps - le dipendenze.
 * @returns l'esito o null se non trovato.
 */
export async function fetchItunesArtwork(
  request: ArtworkRequest,
  deps: ArtworkDeps,
): Promise<ArtworkOutcome | null> {
  if (request.trackName.trim().length === 0 || request.artistName.trim().length === 0) {
    return null;
  }

  await deps.limiter.acquire();
  const url = buildItunesArtworkUrl(
    request.trackName,
    request.artistName,
    deps.itunesEndpoint ?? ITUNES_SEARCH_ENDPOINT,
  );

  let response: HttpResponse;
  try {
    response = await deps.http.request(url, { method: 'GET' });
  } catch (error) {
    deps.logger?.warn('iTunes artwork: richiesta fallita', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return null;
  }

  deps.limiter.observe(response.headers);

  if (response.status === 429) {
    deps.logger?.warn('iTunes artwork: rate limit raggiunto', { status: response.status });
    return { source: 'itunes', url: null, reason: 'http_429' };
  }

  if (response.status < 200 || response.status >= 300) {
    deps.logger?.debug('iTunes artwork: risposta non OK', { status: response.status });
    return null;
  }

  let payload: ItunesArtworkResponse;
  try {
    payload = JSON.parse(response.body) as ItunesArtworkResponse;
  } catch {
    deps.logger?.warn('iTunes artwork: risposta non JSON');
    return null;
  }

  const results = payload.results ?? [];
  const exact = results.find((result) =>
    isExactArtworkMatch(result, request.trackName, request.artistName),
  );

  if (!exact) {
    deps.logger?.debug('iTunes artwork: nessun match esatto', { results: results.length });
    return null;
  }

  const artworkUrl = exact.artworkUrl600 ?? exact.artworkUrl100;
  if (!artworkUrl || artworkUrl.length === 0) {
    deps.logger?.debug('iTunes artwork: nessun artworkUrl nel match esatto');
    return null;
  }

  const upgradedUrl = upgradeArtworkUrl(artworkUrl);
  return { source: 'itunes', url: upgradedUrl };
}

/**
 * Cerca l'artwork su Cover Art Archive.
 *
 * Usa **solo** se `request.mbid` è presente (D-24.1).
 * Prende `images[0].url` (o la prima con `front: true`).
 * 404 ⇒ `not_found`; 429 ⇒ `http_429` (nessun retry, il limiter governa).
 *
 * @param request - la richiesta di artwork.
 * @param deps - le dipendenze.
 * @returns l'esito o null se non applicabile/non trovato.
 */
export async function fetchCoverArtArchive(
  request: ArtworkRequest,
  deps: ArtworkDeps,
): Promise<ArtworkOutcome | null> {
  const mbid = request.mbid?.trim();
  if (!mbid || mbid.length === 0) {
    return null;
  }

  await deps.limiter.acquire();
  const url = `${deps.coverArtEndpoint ?? COVER_ART_ENDPOINT}/release/${mbid}`;

  let response: HttpResponse;
  try {
    response = await deps.http.request(url, { method: 'GET' });
  } catch (error) {
    deps.logger?.warn('Cover Art Archive: richiesta fallita', {
      reason: error instanceof Error ? error.name : 'unknown',
      mbid,
    });
    return null;
  }

  deps.limiter.observe(response.headers);

  if (response.status === 404) {
    deps.logger?.debug('Cover Art Archive: release non trovata', { mbid });
    return { source: 'coverartarchive', url: null, reason: 'not_found' };
  }

  if (response.status === 429) {
    deps.logger?.warn('Cover Art Archive: rate limit raggiunto', { status: response.status });
    return { source: 'coverartarchive', url: null, reason: 'http_429' };
  }

  if (response.status < 200 || response.status >= 300) {
    deps.logger?.debug('Cover Art Archive: risposta non OK', { status: response.status });
    return null;
  }

  let payload: CoverArtArchiveResponse;
  try {
    payload = JSON.parse(response.body) as CoverArtArchiveResponse;
  } catch {
    deps.logger?.warn('Cover Art Archive: risposta non JSON');
    return null;
  }

  const images = payload.images ?? [];
  if (images.length === 0) {
    deps.logger?.debug('Cover Art Archive: nessuna immagine', { mbid });
    return { source: 'coverartarchive', url: null, reason: 'no_images' };
  }

  // Preferisce l'immagine front, altrimenti la prima
  const front = images.find((img) => img.front);
  const chosen = front ?? images[0]!;

  return { source: 'coverartarchive', url: chosen.url };
}

/**
 * Il resolver principale: applica la cascata iTunes → Cover Art Archive → placeholder.
 *
 * @param request - la richiesta di artwork.
 * @param deps - le dipendenze.
 * @param enrichEnabled - se l'arricchimento è abilitato (toggle `enrichMetadata`).
 * @returns l'esito finale.
 */
export async function fetchArtworkUrl(
  request: ArtworkRequest,
  deps: ArtworkDeps,
  enrichEnabled: boolean,
): Promise<ArtworkOutcome> {
  // 0. Toggle spento ⇒ zero uscite, zero scritture, zero letture cache (21§10.4)
  if (!enrichEnabled) {
    return { source: 'none', url: null, reason: 'toggle-off' };
  }

  // 1. iTunes Search API
  const itunes = await fetchItunesArtwork(request, deps);
  if (itunes !== null && itunes.url !== null) {
    return itunes;
  }
  if (itunes !== null && itunes.reason === 'http_429') {
    // Rate limit: non proviamo la fonte successiva per non sprecare budget
    return itunes;
  }

  // 2. Cover Art Archive (solo se MBID presente)
  const coverArt = await fetchCoverArtArchive(request, deps);
  if (coverArt !== null && coverArt.url !== null) {
    return coverArt;
  }
  if (coverArt !== null && coverArt.reason === 'http_429') {
    return coverArt;
  }

  // 3. Placeholder gradient deterministico (mai rete)
  const placeholder = generatePlaceholderGradient(request.trackId);
  return { source: 'placeholder', url: placeholder };
}

/**
 * Persiste l'artwork su Track e Album con deduplicazione per album.
 *
 * L'album viene aggiornato **una volta per album** (deduplicazione per `albumId`).
 * Il cursore `artwork.cursor` in `settings` ricorda i tentativi falliti
 * per non ri-interrogare sempre gli stessi brani (D-24.3).
 *
 * @param db - il database Dexie.
 * @param track - il brano.
 * @param album - l'album (opzionale).
 * @param outcome - l'esito del resolver.
 * @param cursor - il cursore da aggiornare.
 * @param clock - l'orologio per il timestamp.
 */
export async function persistArtwork(
  db: {
    tracks: {
      put: (track: Track) => Promise<string>;
      get: (id: string) => Promise<Track | undefined>;
    };
    albums: {
      put: (album: Album) => Promise<string>;
      get: (id: string) => Promise<Album | undefined>;
    };
    settings: {
      put: (setting: { key: string; value: unknown; updatedAt: number }) => Promise<string>;
      get: (key: string) => Promise<{ value: unknown } | undefined>;
    };
  },
  track: Track,
  album: Album | null,
  outcome: ArtworkOutcome,
  cursor: ArtworkCursor,
  clock: { now: () => number },
): Promise<{ trackUpdated: boolean; albumUpdated: boolean; cursorUpdated: boolean }> {
  let trackUpdated = false;
  let albumUpdated = false;
  let cursorUpdated = false;

  // Aggiorna il cursore: ricorda il trackId tentato (usa canonicalKey come chiave primaria)
  const newAttemptedTrackIds = [...cursor.attemptedTrackIds, track.canonicalKey];
  // Mantieni solo gli ultimi 10000 per non far crescere all'infinito
  const trimmedTrackIds = newAttemptedTrackIds.slice(-10000);

  const newCursor: ArtworkCursor = {
    lastAttemptedAt: clock.now(),
    attemptedTrackIds: trimmedTrackIds,
  };

  // Scrive il cursore in settings
  await db.settings.put({
    key: ARTWORK_CURSOR_KEY,
    value: newCursor,
    updatedAt: clock.now(),
  });
  cursorUpdated = true;

  // Aggiorna Track.artworkUrl
  const currentTrack = await db.tracks.get(track.canonicalKey);
  if (currentTrack && currentTrack.artworkUrl !== outcome.url) {
    await db.tracks.put({ ...currentTrack, artworkUrl: outcome.url });
    trackUpdated = true;
  }

  // Aggiorna Album.artworkUrl (deduplicazione per albumId)
  if (album && album.id) {
    const currentAlbum = await db.albums.get(album.id);
    if (currentAlbum && currentAlbum.artworkUrl !== outcome.url) {
      await db.albums.put({ ...currentAlbum, artworkUrl: outcome.url });
      albumUpdated = true;
    }
  }

  return { trackUpdated, albumUpdated, cursorUpdated };
}

/**
 * Verifica se un brano è già stato tentato (cursore).
 *
 * @param cursor - il cursore corrente.
 * @param canonicalKey - la chiave canonica del brano.
 * @returns true se il brano è già nel cursore.
 */
export function isTrackAttempted(cursor: ArtworkCursor, canonicalKey: string): boolean {
  return cursor.attemptedTrackIds.includes(canonicalKey);
}
