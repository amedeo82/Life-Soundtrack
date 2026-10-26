import type { DeviceType } from '../../schema';
import { sha1Hex } from '../crypto';
import type { RawListenEvent } from '../types';
import type { ListenBrainzListen } from './types';

/**
 * Mapping riga export ListenBrainz → `RawListenEvent`
 * (`03-ADAPTERS/listenbrainz.md` §3, v1.0 🟢 APPROVED).
 *
 * - filtro §3.3 (i 4 scarti + il caso "senza identificativi", che non
 *   scarta ma degrada a `sourceEventId = null`);
 * - semantica temporale D-LB.3: `timestamp = startedAt = listened_at * 1000`,
 *   `durationMs = 0` (la durata **ascoltata** è sconosciuta);
 * - `eventKey` D-LB.2: `listenbrainz:<listened_at>|<recording_msid>` — il
 *   msid da solo collasserebbe gli ascolti dello stesso brano (E.LB.8);
 * - artista multi-artista §3.1.2: `mbid_mapping.artists[]` se presente,
 *   altrimenti la stringa grezza — **mai** divisione per `&`;
 * - privacy §7: `user_name` e `inserted_at` mai persistiti, `ip`/`country`
 *   null, `tags[]` e `url_rels[]` scartati.
 */

/**
 * Costante del server: `LISTEN_MINIMUM_TS = 1033430400` (2001-12-03).
 * Sotto questa soglia l'ascolto è "backdated" e viene scartato (E.LB.17).
 */
export const LISTEN_MINIMUM_TS = 1033430400;

/** Motivo di scarto di una riga (filtro §3.3). */
export type ListenBrainzDiscardReason = 'malformed' | 'tooOld' | 'noTitle' | null;

/** Esito del mapping per singola riga. */
export interface ListenBrainzMapResult {
  /** Evento grezzo pronto per la pipeline core; null se scartato. */
  raw: RawListenEvent | null;
  /** Motivo dello scarto (null se l'evento è stato emesso). */
  discardReason: ListenBrainzDiscardReason;
}

/**
 * Ricostruisce il nome dell'artista dalle credit unità canoniche
 * (`mbid_mapping.artists[]`, §3.1.2 regola 1): i credit sono unità
 * **già separate**, con il `join_phrase` che esprime il separatore
 * ("Artist A" + " & " + "Artist B").
 *
 * Restituisce null se i credit non sono utilizzabili: in tal caso si usa
 * la stringa grezza `track_metadata.artist_name` (regola 2).
 */
export function reconstructArtistName(listen: ListenBrainzListen): string | null {
  const credits = listen.mbid_mapping?.artists;
  if (!Array.isArray(credits) || credits.length === 0) {
    return null;
  }
  const name = credits
    .map((credit) => `${credit?.artist_credit_name ?? ''}${credit?.join_phrase ?? ''}`)
    .join('')
    .trim();
  return name.length > 0 ? name : null;
}

/** MBID dell'artista: il primo di `artist_mbids`, o quello del primo credit. */
export function extractArtistMbid(listen: ListenBrainzListen): string | null {
  const mbids = listen.mbid_mapping?.artist_mbids;
  if (Array.isArray(mbids) && mbids.length > 0 && typeof mbids[0] === 'string' && mbids[0]) {
    return mbids[0];
  }
  const credits = listen.mbid_mapping?.artists;
  if (Array.isArray(credits) && credits.length > 0) {
    const mbid = credits[0]?.artist_mbid;
    if (typeof mbid === 'string' && mbid) {
      return mbid;
    }
  }
  return null;
}

/**
 * MBID della registrazione: vince `mbid_mapping.recording_mbid` (dato
 * risolto dal server, D2), con `additional_info.recording_mbid` come
 * fallback (E.LB.4).
 */
export function extractRecordingMbid(listen: ListenBrainzListen): string | null {
  const mapped = listen.mbid_mapping?.recording_mbid;
  if (typeof mapped === 'string' && mapped) {
    return mapped;
  }
  const fromClient = listen.additional_info?.recording_mbid;
  if (typeof fromClient === 'string' && fromClient) {
    return fromClient;
  }
  const fromMetadata = listen.track_metadata?.recording_mbid;
  if (typeof fromMetadata === 'string' && fromMetadata) {
    return fromMetadata;
  }
  return null;
}

/**
 * `sourceEventId` dell'evento: `listened_at|recording_msid` (D-LB.2).
 *
 * Senza msid si usa il fallback della spec (`sha1(mbid|listened_at)`);
 * senza msid **e** senza MBID l'evento emette `sourceEventId = null` e il
 * core calcola il suo fallback SHA-1 (05§3.2) — un ascolto senza
 * identificativi è comunque un ascolto valido (§3.3 punto 5).
 */
export async function buildSourceEventId(
  listen: ListenBrainzListen,
  recordingMbid: string | null,
): Promise<string | null> {
  const listenedAt = listen.listened_at;
  if (typeof listenedAt !== 'number') {
    return null;
  }
  const msid = listen.recording_msid;
  if (typeof msid === 'string' && msid.length > 0) {
    return `${listenedAt}|${msid}`;
  }
  if (recordingMbid) {
    return await sha1Hex(`${recordingMbid}|${listenedAt}`);
  }
  return null;
}

/**
 * Mappa una riga dell'export in `RawListenEvent` (§3.1).
 *
 * Scarti (§3.3): `malformed` (timestamp assente/non intero, `track_metadata`
 * assente), `tooOld` (prima del 2001-12-03), `noTitle` (nome vuoto).
 */
export async function mapListenBrainzEvent(
  listen: ListenBrainzListen,
): Promise<ListenBrainzMapResult> {
  const listenedAt = listen.listened_at;
  if (typeof listenedAt !== 'number' || !Number.isInteger(listenedAt)) {
    return { raw: null, discardReason: 'malformed' };
  }
  if (listenedAt < LISTEN_MINIMUM_TS) {
    return { raw: null, discardReason: 'tooOld' };
  }
  const metadata = listen.track_metadata;
  if (!metadata || typeof metadata !== 'object') {
    return { raw: null, discardReason: 'malformed' };
  }
  const name = (metadata.track_name ?? '').trim();
  if (name.length === 0) {
    return { raw: null, discardReason: 'noTitle' };
  }

  const recordingMbid = extractRecordingMbid(listen);
  const sourceEventId = await buildSourceEventId(listen, recordingMbid);
  const artistName = reconstructArtistName(listen) ?? (metadata.artist_name ?? '').trim();
  const durationMs = listen.additional_info?.duration_ms;
  const isrc = listen.additional_info?.isrc;
  const deviceDetail =
    listen.additional_info?.media_player ?? listen.additional_info?.submission_client ?? null;

  const raw: RawListenEvent = {
    platform: 'listenbrainz',
    sourceEventId,
    rawTimestamp: listenedAt * 1000,
    rawStartedAt: listenedAt * 1000,
    sourceDurationMs: 0,
    sourceTrackUri: null,
    sourceTrackName: name,
    sourceArtistName: artistName.length > 0 ? artistName : null,
    sourceArtistUri: null,
    sourceAlbumName: (metadata.release_name ?? '').trim() || null,
    isrc: typeof isrc === 'string' && isrc ? isrc.toUpperCase() : null,
    mbid: recordingMbid,
    sourceArtistMbid: extractArtistMbid(listen),
    sourceTrackDurationMs: typeof durationMs === 'number' && durationMs > 0 ? durationMs : null,
    completed: false,
    skipped: null,
    shuffle: null,
    offline: null,
    incognito: null,
    reasonStart: null,
    reasonEnd: null,
    deviceType: 'unknown' satisfies DeviceType,
    deviceDetail,
    ip: null,
    country: null,
  };
  return { raw, discardReason: null };
}
