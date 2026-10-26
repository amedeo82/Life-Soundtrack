import type { DeviceType } from '../../schema';
import type { RawListenEvent } from '../types';
import { lastfmAlbumText, lastfmArtistMbid, lastfmArtistText, type LastfmApiTrack } from './types';

/**
 * Mapping Last.fm → `RawListenEvent` (`03-ADAPTERS/lastfm.md` §3, v1.0
 * 🟢 APPROVED).
 *
 * - `eventKey` D-LF.7: **normalizzato al minuto** su tutti i percorsi
 *   (`lastfm:<YYYY-MM-DDTHH:MM>|<mbid ?? name|artist>`). Il percorso API
 *   dà il secondo, gli export tool il minuto: senza normalizzazione un
 *   re-import misto duplicherebbe ogni scrobble.
 * - semantica temporale D-LF.4: `timestamp = startedAt = date.uts * 1000`,
 *   `durationMs = 0` (la durata non è disponibile).
 * - `artist` in due forme (stringa senza `extended=1`, oggetto con): un
 *   accessor unico (E.LF.14).
 */

/** Motivo di scarto di una track (filtro §3.3). */
export type LastfmDiscardReason = 'nowplaying' | 'noDate' | 'noTitle' | 'noArtist' | null;

/** Esito del mapping per singola track/riga. */
export interface LastfmMapResult {
  /** Evento grezzo pronto per la pipeline core; null se scartato. */
  raw: RawListenEvent | null;
  /** Motivo dello scarto (null se l'evento è stato emesso). */
  discardReason: LastfmDiscardReason;
}

/**
 * Chiave minuto normalizzata (`YYYY-MM-DDTHH:MM`, UTC): il minuto è derivato
 * dal timestamp (`Math.floor(uts / 60) * 60`), così API e file convergono
 * sulla stessa chiave (D-LF.7).
 */
export function lastfmMinuteKey(epochSeconds: number): string {
  const minute = Math.floor(epochSeconds / 60) * 60;
  return new Date(minute * 1000).toISOString().slice(0, 16);
}

/**
 * `sourceEventId` dell'evento: `<minuto>|<mbid ?? name|artist>` (D-LF.7).
 * Il MBID, quando presente, disambigua due scrobble diversi nella stessa
 * secondo (E.LF.4); altrimenti si usa la coppia nome|artista.
 */
export function buildLastfmSourceEventId(
  minuteKey: string,
  mbid: string | null,
  name: string,
  artist: string,
): string {
  return `${minuteKey}|${mbid ?? `${name}|${artist}`}`;
}

/** Mesi inglesi accettati nel formato data dei CSV (`20 Oct 2020, 09:40`). */
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** Formato data dei CSV `lastfm-to-csv`: `DD MMM YYYY, HH:mm` (UTC). */
const MINUTE_DATE_RE = /^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})[, ]\s*(\d{1,2}):(\d{2})$/;

/**
 * Parsing della data al **minuto** dei CSV `lastfm-to-csv` → UNIX secondi
 * UTC. `null` se il formato non è riconosciuto (E.LF.18: ultima riga senza
 * data → scartata, non letta come record malformato).
 */
export function parseLastfmMinuteDate(value: string | null | undefined): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = MINUTE_DATE_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  const month = MONTHS[(match[2] ?? '').toLowerCase()];
  if (month === undefined) {
    return null;
  }
  const seconds = Date.UTC(
    Number.parseInt(match[3] ?? '0', 10),
    month,
    Number.parseInt(match[1] ?? '0', 10),
    Number.parseInt(match[4] ?? '0', 10),
    Number.parseInt(match[5] ?? '0', 10),
  );
  return Number.isFinite(seconds) ? Math.floor(seconds / 1000) : null;
}

/** True se la stringa ha il formato data dei CSV al minuto (per il detect). */
export function looksLikeLastfmMinuteDate(value: string | null | undefined): boolean {
  return parseLastfmMinuteDate(value) !== null;
}

/**
 * Mappa una track della risposta API in `RawListenEvent` (§3.1, §3.3).
 *
 * Scarti: `nowplaying` (E.LF.1, silenzioso), `noDate` (E.LF.9/E.LF.18),
 * `noTitle`, `noArtist`.
 */
export function mapLastfmApiTrack(track: LastfmApiTrack): LastfmMapResult {
  if (track['@attr']?.nowplaying === 'true') {
    // E.LF.1: il brano in riproduzione non ha `date`: non è uno scrobble.
    return { raw: null, discardReason: 'nowplaying' };
  }
  const uts = track.date?.uts;
  const epochSeconds =
    typeof uts === 'number' ? uts : typeof uts === 'string' ? Number.parseInt(uts, 10) : NaN;
  if (!Number.isFinite(epochSeconds)) {
    return { raw: null, discardReason: 'noDate' };
  }
  const name = (track.name ?? '').trim();
  if (name.length === 0) {
    return { raw: null, discardReason: 'noTitle' };
  }
  const artist = lastfmArtistText(track.artist);
  if (artist === null) {
    return { raw: null, discardReason: 'noArtist' };
  }
  const album = lastfmAlbumText(track.album);
  const mbid = typeof track.mbid === 'string' && track.mbid ? track.mbid : null;
  const artistMbid = lastfmArtistMbid(track.artist);

  const raw: RawListenEvent = {
    platform: 'lastfm',
    sourceEventId: buildLastfmSourceEventId(lastfmMinuteKey(epochSeconds), mbid, name, artist),
    rawTimestamp: epochSeconds * 1000,
    rawStartedAt: epochSeconds * 1000,
    sourceDurationMs: 0,
    sourceTrackUri: typeof track.url === 'string' && track.url ? track.url : null,
    sourceTrackName: name,
    sourceArtistName: artist,
    sourceArtistUri: null,
    sourceAlbumName: album,
    isrc: null,
    mbid,
    sourceArtistMbid: artistMbid,
    sourceTrackDurationMs: null,
    completed: false,
    skipped: null,
    shuffle: null,
    offline: null,
    incognito: null,
    reasonStart: null,
    reasonEnd: null,
    deviceType: 'unknown' satisfies DeviceType,
    deviceDetail: null,
    ip: null,
    country: null,
  };
  return { raw, discardReason: null };
}

/**
 * Riga di un export **file** (CSV `ghan.nl` o suo export JSON), già
 * normalizzata nei campi della spec §2.3.
 */
export interface LastfmFileRow {
  /** UNIX secondi UTC (dal CSV 8 colonne) **oppure** data al minuto. */
  epochSeconds: number | null;
  artist: string | null;
  album: string | null;
  track: string | null;
  /** MBID del brano (`track_mbid`): DEDUP-2 quando presente. */
  trackMbid: string | null;
  /** MBID dell'artista (`artist_mbid`): va su `Artist.mbid`. */
  artistMbid: string | null;
}

/**
 * Mappa una riga di export file in `RawListenEvent`. Stessa `eventKey`
 * normalizzata al minuto del percorso API (D-LF.7): lo stesso scrobble
 * importato via file e via API produce **un solo** evento (E.LF.16, E.LF.19).
 */
export function mapLastfmFileRow(row: LastfmFileRow): LastfmMapResult {
  if (row.epochSeconds === null || !Number.isFinite(row.epochSeconds)) {
    return { raw: null, discardReason: 'noDate' };
  }
  const name = (row.track ?? '').trim();
  if (name.length === 0) {
    return { raw: null, discardReason: 'noTitle' };
  }
  const artist = (row.artist ?? '').trim();
  if (artist.length === 0) {
    return { raw: null, discardReason: 'noArtist' };
  }
  const album = (row.album ?? '').trim();
  const mbid = row.trackMbid && row.trackMbid ? row.trackMbid : null;

  const raw: RawListenEvent = {
    platform: 'lastfm',
    sourceEventId: buildLastfmSourceEventId(lastfmMinuteKey(row.epochSeconds), mbid, name, artist),
    rawTimestamp: row.epochSeconds * 1000,
    rawStartedAt: row.epochSeconds * 1000,
    sourceDurationMs: 0,
    sourceTrackUri: null,
    sourceTrackName: name,
    sourceArtistName: artist,
    sourceArtistUri: null,
    sourceAlbumName: album.length > 0 ? album : null,
    isrc: null,
    mbid,
    sourceArtistMbid: row.artistMbid && row.artistMbid ? row.artistMbid : null,
    sourceTrackDurationMs: null,
    completed: false,
    skipped: null,
    shuffle: null,
    offline: null,
    incognito: null,
    reasonStart: null,
    reasonEnd: null,
    deviceType: 'unknown' satisfies DeviceType,
    deviceDetail: null,
    ip: null,
    country: null,
  };
  return { raw, discardReason: null };
}
