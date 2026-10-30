/**
 * Il resolver del preview audio — iTunes Search API.
 *
 * `21-AUDIO-FEATURES.md` v1.0 🟢 §2.1, §6.6 (D-AF.1): l'**unica** fonte di
 * audio gratis, senza autenticazione, è il `previewUrl` di 30 secondi
 * restituito dall'iTunes Search API.
 *
 * Regole non negoziabili:
 *
 * - escono **solo** le due stringhe (nome brano e nome artista): nessun
 *   timestamp, nessun ascolto, nessun identificativo di sessione
 *   (`09§3.3`);
 * - il match è **esatto** su titolo e artista normalizzati (E2): una
 *   feature sbagliata è peggio di nessuna;
 * - nessun file audio viene **persistito**: i byte restano in memoria per
 *   la durata dell'analisi (`21§6.6`).
 */

import type { Clock, HttpClient, Logger, RateLimiter } from './types';

/** L'host dell'iTunes Search API (`21§6.6`). */
export const ITUNES_SEARCH_ENDPOINT = 'https://itunes.apple.com/search';

/** Il limite pubblicato dell'iTunes Search API: ~20 richieste al minuto. */
export const ITUNES_RATE_LIMIT_PER_MINUTE = 20;

/** Un risultato dell'iTunes Search API (solo i campi che servono). */
export interface ItunesSearchResult {
  /** Identificativo del brano nel catalogo Apple. */
  readonly trackId?: number;
  /** Nome del brano. */
  readonly trackName?: string;
  /** Nome dell'artista. */
  readonly artistName?: string;
  /** URL del preview di 30 s (AAC `.m4a`), se presente. */
  readonly previewUrl?: string;
  /** Nome dell'album. */
  readonly collectionName?: string;
}

/** La risposta dell'iTunes Search API. */
export interface ItunesSearchResponse {
  /** Numero di risultati. */
  readonly resultCount?: number;
  /** I risultati. */
  readonly results?: readonly ItunesSearchResult[];
}

/** Il preview trovato per un brano. */
export interface ItunesPreview {
  /** L'URL del preview di 30 s. */
  readonly previewUrl: string;
  /** L'identificativo del brano nel catalogo Apple (se presente). */
  readonly itunesTrackId: number | null;
}

/** Il resolver del preview: trova l'anteprima di un brano. */
export interface ItunesPreviewResolver {
  /**
   * Cerca il preview del brano.
   *
   * @param trackName - il nome del brano.
   * @param artistName - il nome dell'artista.
   * @returns il preview trovato, `null` se il brano non è in catalogo o se
   *   il match non è esatto (E2).
   */
  resolve(trackName: string, artistName: string): Promise<ItunesPreview | null>;
}

/** Opzioni del resolver iTunes. */
export interface ItunesPreviewResolverOptions {
  /** Il client HTTP iniettato. */
  readonly http: HttpClient;
  /** Il limiter (iTunes: ~20 req/min). */
  readonly limiter: RateLimiter;
  /** L'orologio iniettato. */
  readonly clock: Clock;
  /** Il logger (opzionale). */
  readonly logger?: Logger;
  /** L'endpoint (sovrascrivibile nei test). */
  readonly endpoint?: string;
}

/**
 * Normalizza un testo per il confronto (match esatto, E2).
 *
 * Minuscole, senza diacritici, spazi compattati. La normalizzazione non
 * "indovina": due titoli che differiscono restano diversi.
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
export function isExactMatch(
  result: ItunesSearchResult,
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
 * Costruisce l'URL della ricerca iTunes.
 *
 * Escono **solo** `term` (nome brano), `artist` (nome artista) ed
 * `entity=song`: è il contenuto consentito da `09§3.3`.
 *
 * @param trackName - il nome del brano.
 * @param artistName - il nome dell'artista.
 * @param endpoint - l'endpoint base.
 * @returns l'URL completo della ricerca.
 */
export function buildItunesSearchUrl(
  trackName: string,
  artistName: string,
  endpoint: string = ITUNES_SEARCH_ENDPOINT,
): string {
  const params = new URLSearchParams({
    term: trackName,
    artist: artistName,
    entity: 'song',
  });
  return `${endpoint}?${params.toString()}`;
}

/**
 * Crea il resolver del preview iTunes.
 *
 * @param options - le dipendenze iniettate.
 * @returns il resolver.
 */
export function createItunesPreviewResolver(
  options: ItunesPreviewResolverOptions,
): ItunesPreviewResolver {
  const { http, limiter, clock, logger, endpoint = ITUNES_SEARCH_ENDPOINT } = options;

  return {
    async resolve(trackName: string, artistName: string): Promise<ItunesPreview | null> {
      if (trackName.trim().length === 0 || artistName.trim().length === 0) {
        return null;
      }
      await limiter.acquire();
      const url = buildItunesSearchUrl(trackName, artistName, endpoint);
      let response;
      try {
        response = await http.request(url, { method: 'GET' });
      } catch (error) {
        logger?.warn('iTunes: richiesta fallita', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
        return null;
      }
      limiter.observe(response.headers);
      if (response.status === 429) {
        logger?.warn('iTunes: rate limit raggiunto', { status: response.status });
        return null;
      }
      if (response.status < 200 || response.status >= 300) {
        logger?.debug('iTunes: risposta non OK', { status: response.status });
        return null;
      }
      let payload: ItunesSearchResponse;
      try {
        payload = JSON.parse(response.body) as ItunesSearchResponse;
      } catch {
        logger?.warn('iTunes: risposta non JSON');
        return null;
      }
      const results = payload.results ?? [];
      const exact = results.find((result) => isExactMatch(result, trackName, artistName));
      if (!exact || exact.previewUrl === undefined || exact.previewUrl.length === 0) {
        logger?.debug('iTunes: nessun preview per il match esatto', {
          results: results.length,
          checkedAt: clock.now(),
        });
        return null;
      }
      return {
        previewUrl: exact.previewUrl,
        itunesTrackId: typeof exact.trackId === 'number' ? exact.trackId : null,
      };
    },
  };
}
