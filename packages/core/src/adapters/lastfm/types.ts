/**
 * Shape delle risposte e dei file dell'adapter Last.fm
 * (`03-ADAPTERS/lastfm.md` §1, §2.3, §3 — v1.0 🟢 APPROVED).
 *
 * Due percorsi, due forme:
 * - **API** (`user.getRecentTracks`, `extended=1`): JSON con `recenttracks.track[]`,
 *   dove i campi testuali sono **oggetti** con chiave `#text` (la forma JSON
 *   del testo semplice del formato XML);
 * - **file**: CSV `ghan.nl` (8 colonne con header) o CSV `lastfm-to-csv`
 *   (4 colonne senza header), più l'export JSON degli stessi tool.
 */

/** Attributi di una track API (`@attr`): solo `nowplaying` interessa. */
export interface LastfmTrackAttr {
  /** "true" se è il brano **in riproduzione** (non ancora scrobbblato). */
  nowplaying?: string | null;
}

/** Forma oggetto di `artist` (con `extended=1`): `{mbid, #text, name, url}`. */
export interface LastfmArtistObject {
  mbid?: string | null;
  '#text'?: string | null;
  name?: string | null;
  url?: string | null;
}

/** Forma oggetto di `album` (con `extended=1`): `{mbid, #text, name}`. */
export interface LastfmAlbumObject {
  mbid?: string | null;
  '#text'?: string | null;
  name?: string | null;
}

/** `date` della track: `uts` (UNIX secondi UTC) + `#text` (formattato). */
export interface LastfmDate {
  /** Inizio dello scrobble, in UNIX secondi UTC (§5). */
  uts?: string | number | null;
  /** "20 Oct 2020, 09:40": **redundante**, mai usato come sorgente. */
  '#text'?: string | null;
}

/** Una track della risposta `user.getRecentTracks`. */
export interface LastfmApiTrack {
  '@attr'?: LastfmTrackAttr | null;
  /** Stringa (senza `extended=1`) **oppure** oggetto (con `extended=1`). */
  artist?: string | LastfmArtistObject | null;
  album?: string | LastfmAlbumObject | null;
  name?: string | null;
  /** MBID del brano: presente solo con `extended=1`, spesso vuoto (E.LF.5). */
  mbid?: string | null;
  /** "0" / "1": nessun campo "loved" nel modello (E.LF.17). */
  loved?: string | null;
  /** **Assente** per il brano in riproduzione (E.LF.1). */
  date?: LastfmDate | null;
  url?: string | null;
  streamable?: string | null;
  /** URL copertine: mai persistiti (§3.1). */
  image?: unknown[] | null;
}

/** Attributi della risposta: paginazione e totale scrobble. */
export interface LastfmRecentTracksAttr {
  /** Account interrogato: mai persistito. */
  user?: string | null;
  page?: string | number | null;
  perPage?: string | number | null;
  /** Totale scrobble (94.618 → 474 pagine a `limit=200`). */
  total?: string | number | null;
  /** Pagine disponibili: la paginazione **non va oltre** (E.LF.2). */
  totalPages?: string | number | null;
}

/** Risposta completa dell'API (o corpo dell'errore Last.fm). */
export interface LastfmRecentTracksResponse {
  recenttracks?: {
    '@attr'?: LastfmRecentTracksAttr | null;
    /** Array di track; l'API può restituire un oggetto singolo. */
    track?: LastfmApiTrack[] | LastfmApiTrack | null;
  } | null;
  /** Codice di errore Last.fm (6, 8, 9, 10, 11, 13, 16, 17, 26, 29). */
  error?: number | null;
  /** Messaggio di testo dell'errore. */
  message?: string | null;
}

/** Riga del CSV `ghan.nl` (8 colonne con header). */
export interface LastfmGhanlRow {
  /** Inizio dello scrobble in UNIX secondi UTC. */
  uts?: string | null;
  /** Stesso istante formattato in UTC: mai usato come sorgente. */
  utc_time?: string | null;
  artist?: string | null;
  album?: string | null;
  track?: string | null;
  artist_mbid?: string | null;
  album_mbid?: string | null;
  /** MBID del brano: DEDUP-2 quando presente. */
  track_mbid?: string | null;
}

/** Riga del CSV `lastfm-to-csv` (4 colonne **senza header**). */
export interface LastfmFourColumnRow {
  artist?: string | null;
  album?: string | null;
  track?: string | null;
  /** Data al **minuto** in UTC ("20 Oct 2020, 09:40"); può essere vuota. */
  date?: string | null;
}

/** Testo dell'artista, sia nella forma stringa sia in quella oggetto (E.LF.14). */
export function lastfmArtistText(
  value: string | LastfmArtistObject | null | undefined,
): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value && typeof value === 'object') {
    const text = value['#text'] ?? value.name ?? null;
    if (typeof text !== 'string') {
      return null;
    }
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

/** MBID dell'artista (solo nella forma oggetto, `extended=1`). */
export function lastfmArtistMbid(
  value: string | LastfmArtistObject | null | undefined,
): string | null {
  if (value && typeof value === 'object' && typeof value.mbid === 'string' && value.mbid) {
    return value.mbid;
  }
  return null;
}

/** Testo dell'album, sia nella forma stringa sia in quella oggetto (E.LF.10). */
export function lastfmAlbumText(
  value: string | LastfmAlbumObject | null | undefined,
): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value && typeof value === 'object') {
    const text = value['#text'] ?? value.name ?? null;
    if (typeof text !== 'string') {
      return null;
    }
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

/** Normalizza `track[]` in un array (l'API può restituire un oggetto singolo). */
export function lastfmTrackList(response: LastfmRecentTracksResponse): LastfmApiTrack[] {
  const track = response.recenttracks?.track;
  if (!track) {
    return [];
  }
  return Array.isArray(track) ? track : [track];
}

/** Numero di pagine dichiarato dalla risposta (`@attr.totalPages`). */
export function lastfmTotalPages(response: LastfmRecentTracksResponse): number | null {
  const value = response.recenttracks?.['@attr']?.totalPages;
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
