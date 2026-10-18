import type { DeviceType } from '../../schema';
import type { RawListenEvent } from '../types';
import type { SpotifyStreamingRecord } from './types';

/**
 * Mapping record GDPR Spotify → `RawListenEvent` (spotify.md §3).
 *
 * Derivazioni implementate qui (i restanti step 05§3.1 sono della pipeline
 * core): regola `skipped` derivata E1 (§3.3), conversione unità
 * `offline_timestamp` E3 (§4), mapping `platform` → `deviceType` (§3.2),
 * `startedAt = ts - ms_played` (§5).
 */

/**
 * Soglia fissa per la regola E1 quando la durata catalogo non è disponibile
 * (spotify.md §3.3: "se non disponibile, soglia fissa ms_played < 30000").
 */
export const E1_NO_CATALOG_THRESHOLD_MS = 30_000;

/**
 * Mapping `platform` raw → `DeviceType` (§3.2). I pattern specifici
 * (`web_player`, auto, speaker) sono valutati PRIMA dei pattern OS: la
 * granularità cambiata post ott-2023 (E5) rende "web_player windows 10"
 * ambiguamente matchabile da entrambi e vince il segnale specifico.
 */
const DEVICE_PATTERNS: ReadonlyArray<readonly [RegExp, DeviceType]> = [
  [/web_player|webplayer/i, 'web'],
  [/carplay|android auto|\bcar\b/i, 'car'],
  [/speaker|chromecast|\bcast\b|sonos/i, 'speaker'],
  [/ipad|iphone|ios/i, 'mobile'],
  [/android/i, 'mobile'],
  [/windows|linux|os x|macintosh|\bmac\b/i, 'desktop'],
];

/** Deriva il `DeviceType` dalla stringa `platform` dell'export (§3.2). */
export function mapDeviceType(platformRaw: string | null | undefined): DeviceType {
  if (!platformRaw) {
    return 'unknown';
  }
  for (const [pattern, type] of DEVICE_PATTERNS) {
    if (pattern.test(platformRaw)) {
      return type;
    }
  }
  return 'unknown';
}

/**
 * Regola `skipped` derivata E1 (§3.3): il flag `skipped` dell'export è
 * inaffidabile (tutti false tra 2015-04 e 2022-10), quindi lo skip è derivato:
 *
 *     skipped === true
 *      OR reason_end ∈ {'backbtn', 'fwdbtn', 'unknown'}
 *      OR (reason_end === 'endplay' AND ms_played < soglia)
 *
 * L'export GDPR non porta la durata catalogo: si usa la soglia fissa.
 */
export function deriveSkipped(record: SpotifyStreamingRecord): boolean {
  if (record.skipped === true) {
    return true;
  }
  const reasonEnd = record.reason_end ?? null;
  if (reasonEnd === 'backbtn' || reasonEnd === 'fwdbtn' || reasonEnd === 'unknown') {
    return true;
  }
  if (reasonEnd === 'endplay' && record.ms_played < E1_NO_CATALOG_THRESHOLD_MS) {
    return true;
  }
  return false;
}

/**
 * `completed` (02§3.2, §3.1 spotify.md): la formula "ms_played ≥ durataCatalogo
 * − 5000" richiede la durata catalogo, assente nell'export GDPR. Il segnale
 * nativo equivalente è `reason_end === 'trackdone'` (brano portato a termine):
 * è la derivazione documentata dell'AC per questa piattaforma.
 */
export function deriveCompleted(record: SpotifyStreamingRecord): boolean {
  return record.reason_end === 'trackdone';
}

/**
 * E3 (§4): `offline_timestamp` ha unità variabile — valore < 1e12 ⇒ secondi,
 * va moltiplicato per 1000. Restituisce il valore normalizzato a ms e un flag
 * di conversione applicata.
 */
export function normalizeOfflineTimestamp(
  value: number | null | undefined,
): { valueMs: number | null; converted: boolean } {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return { valueMs: null, converted: false };
  }
  if (value < 1e12) {
    return { valueMs: value * 1000, converted: true };
  }
  return { valueMs: value, converted: false };
}

/** Esito del mapping per singolo record. */
export interface SpotifyMapResult {
  /** Evento grezzo pronto per la pipeline core; null se scartato. */
  raw: RawListenEvent | null;
  /**
   * Categorie di scarto: 'podcast' (E6), 'invalid' (campi irrinunciabili
   * mancanti o ts non interpretabile — §2.2, §3.1.1).
   */
  discardReason: 'podcast' | 'invalid' | null;
  /** E3: timestamp offline convertito da secondi a ms. */
  offlineConverted: boolean;
}

/** Estrae l'id nativo da un URI Spotify (`spotify:track:<id>` → `<id>`). */
export function extractTrackId(uri: string): string | null {
  const idx = uri.lastIndexOf(':');
  if (idx < 0 || idx === uri.length - 1) {
    return null;
  }
  return uri.slice(idx + 1);
}

/**
 * Mappa un record di streaming history in `RawListenEvent` (spotify.md §3.1).
 *
 * - Podcast/audiobook (E6): `episode_name` presente senza metadati track ⇒
 *   scartato con `discardReason: 'podcast'` (MVP: non supportati).
 * - `master_metadata_track_name` null ⇒ scartato (§3.1.1 "null → skip evento").
 * - `sourceEventId` = `<trackId>@<ts ms>` (05§3.2: "Spotify trackId+played_at").
 */
export function mapSpotifyEvent(record: SpotifyStreamingRecord): SpotifyMapResult {
  const rawName = record.master_metadata_track_name ?? null;
  if (!rawName) {
    // E6 (§4): metadati musicali assenti. Con `episode_name` è un podcast
    // (MVP non supportato); senza, l'evento è incompleto (§3.1.1).
    const isPodcast = Boolean(record.episode_name ?? record.spotify_episode_uri);
    return { raw: null, discardReason: isPodcast ? 'podcast' : 'invalid', offlineConverted: false };
  }
  const timestamp = Date.parse(record.ts);
  if (!Number.isFinite(timestamp)) {
    return { raw: null, discardReason: 'invalid', offlineConverted: false };
  }
  if (record.ms_played < 0) {
    return { raw: null, discardReason: 'invalid', offlineConverted: false };
  }
  const { converted } = normalizeOfflineTimestamp(record.offline_timestamp);
  const uri = record.spotify_track_uri ?? null;
  const trackId = uri ? extractTrackId(uri) : null;
  return {
    raw: {
      platform: 'spotify',
      sourceEventId: trackId ? `${trackId}@${timestamp}` : null,
      rawTimestamp: timestamp,
      rawStartedAt: timestamp - record.ms_played,
      sourceDurationMs: record.ms_played,
      sourceTrackUri: uri,
      sourceTrackName: rawName,
      sourceArtistName: record.master_metadata_album_artist_name ?? null,
      sourceAlbumName: record.master_metadata_album_album_name ?? null,
      isrc: null,
      mbid: null,
      completed: deriveCompleted(record),
      skipped: deriveSkipped(record),
      shuffle: record.shuffle ?? null,
      offline: record.offline ?? null,
      incognito: record.incognito_mode ?? null,
      reasonStart: record.reason_start ?? null,
      reasonEnd: record.reason_end ?? null,
      deviceType: mapDeviceType(record.platform),
      deviceDetail: record.platform ?? null,
      ip: record.ip_addr ?? null,
      country: record.conn_country ?? null,
    },
    discardReason: null,
    offlineConverted: converted,
  };
}
