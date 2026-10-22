import * as Papa from 'papaparse';
import type { DeviceType } from '../../schema';
import { sha1Hex } from '../crypto';
import type { RawListenEvent } from '../types';
import type { AppleMusicActivityRecord, AppleMusicDailyTrackRecord } from './types';

/**
 * Costanti soglia (§10, §3.3).
 */
export const MIN_PLAY_MS = 30_000;
export const COMPLETION_TOLERANCE_MS = 5_000;
export const SKIP_RATIO = 0.8;
export const RECONCILIATION_TOLERANCE = 0.1;

/**
 * Tabella alias canonica (E.AP.3, §10): mappa header legacy/2026.2 → campo canonico.
 * Usata per normalizzare i nomi delle colonne prima del mapping.
 */
export const ALIAS_MAP: Record<string, string> = {
  // Song name
  'song name': 'songName',
  'content name': 'songName',
  // Artist name
  'artist name': 'artistName',
  'container artist name': 'containerArtistName',
  // Album
  'album name': 'albumName',
  // Durate
  'play duration milliseconds': 'playDurationMs',
  'media duration in milliseconds': 'mediaDurationMs',
  // Timestamp
  'event end timestamp': 'eventEndTimestamp',
  'event start timestamp': 'eventStartTimestamp',
  // Reason
  'end reason type': 'endReasonType',
  'event reason hint type': 'eventReasonHintType',
  // Event ID
  'event id': 'eventId',
  // Event type
  'event type': 'eventType',
  // Shuffle/Offline
  'shuffle play': 'shufflePlay',
  offline: 'offline',
  // Device
  'device type': 'deviceType',
  'build version': 'buildVersion',
  // Country
  'iso country': 'isoCountry',
  'store country name': 'storeCountryName',
  // IP
  'client ip address': 'clientIpAddress',
  // Coordinate (sempre scartate)
  'ip city': 'ipCity',
  'ip region': 'ipRegion',
  'ip latitude': 'ipLatitude',
  'ip longitude': 'ipLongitude',
  // Identificativi (sempre scartati)
  'device identifier': 'deviceIdentifier',
  'apple id number': 'appleIdNumber',
  'subscription user id': 'subscriptionUserId',
  'metrics client id': 'metricsClientId',
  'metrics bucket id': 'metricsBucketId',
  'evaluation variant': 'evaluationVariant',
  'referral id': 'referralId',
  // UTC Offset
  'utc offset in seconds': 'utcOffsetInSeconds',
};

/**
 * Normalizza un nome di colonna CSV applicando la tabella alias.
 */
export function normalizeColumnName(header: string): string {
  const key = header.trim().toLowerCase();
  return ALIAS_MAP[key] ?? header.trim();
}

/**
 * Parsing CSV streaming con PapaParse row mode (§10, D5).
 * Restituisce AsyncGenerator di record normalizzati (chiavi canoniche).
 */
export async function parseCsvStreaming(
  csvText: string,
  _onWarning?: (code: string) => void,
): Promise<AsyncGenerator<Record<string, string>>> {
  const results: Record<string, string>[] = [];
  const gen = (async function* () {
    for (const row of results) {
      yield row;
    }
  })();

  const config = {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string, _index: number) => normalizeColumnName(h),
    step: (result: Papa.ParseStepResult<Record<string, string>>) => {
      if (result.errors.length > 0) {
        throw new Error(`PapaParse error: ${result.errors.map((e) => e.message).join(', ')}`);
      }
      if (result.data && Object.keys(result.data).length > 0) {
        results.push(result.data);
      }
    },
    complete: () => {},
  };
  (Papa.parse as (input: string, config: object) => void)(csvText, config);
  return gen;
}

/**
 * Costruisce la mappa candidati-artisti dal file Daily Tracks (§3.4, D1).
 * Regola: split `Track Description` alla prima occorrenza di " - " → {songName, artistName}.
 * Associa solo se l'artista è **univoco** per quel brano normalizzato in tutto il file.
 */
export function buildDailyTracksArtistMap(
  dailyRecords: AppleMusicDailyTrackRecord[],
): Map<string, string> {
  const candidates = new Map<string, Map<string, number>>();

  for (const rec of dailyRecords) {
    const desc = rec.trackDescription?.trim();
    if (!desc) continue;
    const splitIdx = desc.indexOf(' - ');
    if (splitIdx <= 0) continue;
    const artist = desc.slice(0, splitIdx).trim();
    const song = desc.slice(splitIdx + 3).trim();
    if (!artist || !song) continue;

    const normSong = song.toLowerCase();
    if (!candidates.has(normSong)) {
      candidates.set(normSong, new Map());
    }
    const artistCounts = candidates.get(normSong)!;
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
  }

  // Costruisce la mappa finale: solo artisti univoci per brano
  const artistMap = new Map<string, string>();
  for (const [song, artists] of candidates) {
    if (artists.size === 1) {
      const artist = artists.keys().next().value;
      if (artist !== undefined) {
        artistMap.set(song, artist);
      }
    }
  }
  return artistMap;
}

/**
 * Risolve il nome artista per un brano (catena di fallback D3, §3.1.1):
 * 1. `Artist Name` (legacy)
 * 2. `Container Artist Name` (2026.2)
 * 3. Mappa Daily Tracks (se univoca)
 * 4. "Unknown"
 */
export function resolveArtistName(
  record: AppleMusicActivityRecord,
  dailyArtistMap: Map<string, string>,
): string {
  const songName = record.songName ?? record.contentName ?? '';
  const normSong = songName.toLowerCase();

  // 1. Artist Name legacy
  if (record.artistName?.trim()) {
    return record.artistName.trim();
  }
  // 2. Container Artist Name 2026.2
  if (record.containerArtistName?.trim()) {
    return record.containerArtistName.trim();
  }
  // 3. Mappa Daily Tracks (univoca)
  if (dailyArtistMap.has(normSong)) {
    return dailyArtistMap.get(normSong)!;
  }
  // 4. Fallback
  return 'Unknown';
}

/**
 * Determina `completed` secondo §3.1:
 * `durationMs >= mediaDuration - 5000` (tolleranza 5s per rounding).
 */
export function computeCompleted(
  durationMs: number | null,
  mediaDurationMs: number | null,
): boolean | null {
  if (durationMs === null || mediaDurationMs === null) return null;
  return durationMs >= mediaDurationMs - COMPLETION_TOLERANCE_MS;
}

/**
 * Determina `skipped` secondo §3.3:
 * - `End Reason Type` ∈ { 'MANUALLY_SELECTED_PLAYBACK_OF_A_DIFF_ITEM', 'SCRUB_BEGIN' } → true
 * - `End Reason Type` ∈ { null, 'NOT_SPECIFIED' } E `durationMs < mediaDuration * 0.8` → true
 * - `NATURAL_END_OF_TRACK` → false
 * - Enum ignoti → regola della soglia
 */
export function computeSkipped(
  endReason: string | undefined,
  durationMs: number | null,
  mediaDurationMs: number | null,
): boolean | null {
  if (!endReason) {
    if (durationMs !== null && mediaDurationMs !== null) {
      return durationMs < mediaDurationMs * SKIP_RATIO;
    }
    return null;
  }
  const reason = endReason.trim().toUpperCase();
  if (reason === 'NATURAL_END_OF_TRACK') return false;
  if (reason === 'MANUALLY_SELECTED_PLAYBACK_OF_A_DIFF_ITEM' || reason === 'SCRUB_BEGIN') {
    return true;
  }
  // Enum ignoti: soglia 80%
  if (durationMs !== null && mediaDurationMs !== null) {
    return durationMs < mediaDurationMs * SKIP_RATIO;
  }
  return null;
}

/**
 * Mappa `Device Type` / `Build Version` → `DeviceType` enum (§3.2).
 * Valori validi: 'mobile', 'desktop', 'web', 'speaker', 'car', 'wearable', 'tv', 'unknown'.
 */
export function mapDeviceType(record: AppleMusicActivityRecord): DeviceType {
  // 2026.2: Device Type esplicito
  const dt = record.deviceType?.trim().toLowerCase();
  if (dt) {
    if (dt.includes('iphone') || dt.includes('ios')) return 'mobile';
    if (dt.includes('ipad') || dt.includes('ipados')) return 'mobile'; // tablet mapped to mobile
    if (dt.includes('mac') || dt.includes('macos')) return 'desktop';
    if (dt.includes('apple tv') || dt.includes('tvos')) return 'tv';
    if (dt.includes('watch') || dt.includes('watchos')) return 'wearable';
    if (dt.includes('carplay') || dt.includes('auto')) return 'car';
    if (dt.includes('homepod') || dt.includes('speaker')) return 'speaker';
  }
  // Legacy: deriva da Build Version
  const bv = record.buildVersion?.trim().toLowerCase();
  if (bv) {
    if (bv.includes('iphone') || bv.includes('ios')) return 'mobile';
    if (bv.includes('ipad') || bv.includes('ipados')) return 'mobile'; // tablet mapped to mobile
    if (bv.includes('mac') || bv.includes('macos')) return 'desktop';
    if (bv.includes('apple tv') || bv.includes('tvos')) return 'tv';
    if (bv.includes('watch') || bv.includes('watchos')) return 'wearable';
  }
  return 'unknown';
}

/**
 * Costruisce `deviceDetail` raw (§3.1): "Device OS Name + Version" o Build Version.
 */
export function buildDeviceDetail(record: AppleMusicActivityRecord): string | null {
  // 2026.2: Device OS Name + Version (campi separati nell'export reale)
  // L'export 2026.2 ha colonne separate; qui proviamo a ricostruire da Build Version
  // se i campi separati non sono mappati (Build Version contiene spesso "Music/3.1 iOS/13.0 model/iPhone9,3")
  const bv = record.buildVersion?.trim();
  if (bv) return bv;
  return null;
}

/**
 * Parsing timestamp ISO 8601 UTC con ms → unix ms.
 * Gestisce `Event End Timestamp` (primario) e fallback `Event Start Timestamp + duration`.
 */
export function parseTimestamp(record: AppleMusicActivityRecord): {
  timestamp: number | null;
  startedAt: number | null;
} {
  const endTs = record.eventEndTimestamp?.trim();
  const startTs = record.eventStartTimestamp?.trim();
  const durationMs = record.playDurationMs ? parseInt(record.playDurationMs, 10) : null;

  let timestamp: number | null = null;
  let startedAt: number | null = null;

  if (endTs) {
    const parsed = Date.parse(endTs);
    if (Number.isFinite(parsed)) {
      timestamp = parsed;
    }
  }
  if (startTs) {
    const parsed = Date.parse(startTs);
    if (Number.isFinite(parsed)) {
      startedAt = parsed;
    }
  }
  // Fallback: startedAt = timestamp - durationMs
  if (startedAt === null && timestamp !== null && durationMs !== null) {
    startedAt = timestamp - durationMs;
  }
  // Fallback: timestamp = startedAt + durationMs
  if (timestamp === null && startedAt !== null && durationMs !== null) {
    timestamp = startedAt + durationMs;
  }
  return { timestamp, startedAt };
}

/**
 * Determina `country` ISO 3166-1 alpha-2 (§3.1, §7):
 * - `ISO Country` se valido (2 lettere)
 * - `Store Country Name` solo se mappabile a alpha-2 (non implementato qui: null)
 * - Mai derivato da IP
 */
export function resolveCountry(record: AppleMusicActivityRecord): string | null {
  const iso = record.isoCountry?.trim().toUpperCase();
  if (iso && /^[A-Z]{2}$/.test(iso)) {
    return iso;
  }
  // Store Country Name → alpha-2 richiederebbe una tabella di mapping; per MVP null
  return null;
}

/**
 * Mapping singola riga Play Activity → `RawListenEvent` (§3.1).
 * Restituisce null se la riga viene scartata dal filtro eventi (§3.3).
 */
export async function mapAppleMusicEvent(
  record: AppleMusicActivityRecord,
  dailyArtistMap: Map<string, string>,
  onWarning?: (code: string) => void,
): Promise<RawListenEvent | null> {
  // Filtro eventi (§3.3): solo PLAY_END (e legacy senza eventType)
  const eventType = record.eventType?.trim().toUpperCase();
  if (eventType && eventType !== 'PLAY_END') {
    return null; // scartato silenziosamente (non è un ascolto)
  }

  // SCRUB_BEGIN: scartato con warning (§3.3, E.AP.5)
  const endReason = record.endReasonType?.trim().toUpperCase();
  if (endReason === 'SCRUB_BEGIN') {
    onWarning?.('adapter.apple_music.warn.scrubSkipped');
    return null;
  }

  // Estrae campi numerici
  const playDurationMs = record.playDurationMs ? parseInt(record.playDurationMs, 10) : null;
  const mediaDurationMs = record.mediaDurationMs ? parseInt(record.mediaDurationMs, 10) : null;

  // Sotto-soglia 30s: scartato con warning (§3.3, E.AP.1)
  if (playDurationMs !== null && playDurationMs < MIN_PLAY_MS) {
    // Eccezione: brano molto corto quasi intero (durationMs >= mediaDuration - 5000)
    if (mediaDurationMs !== null && playDurationMs >= mediaDurationMs - COMPLETION_TOLERANCE_MS) {
      // passa il filtro
    } else {
      onWarning?.('adapter.apple_music.warn.shortSkipped');
      return null;
    }
  }

  // Senza titolo: scartato con warning (§3.3, E.AP.7)
  const songName = record.songName ?? record.contentName;
  if (!songName?.trim()) {
    onWarning?.('adapter.apple_music.warn.noTitleSkipped');
    return null;
  }

  // Timestamp
  const { timestamp, startedAt } = parseTimestamp(record);
  if (timestamp === null) {
    // Shape non interpretabile: skip silenzioso (come YouTube)
    return null;
  }

  // sourceEventId: Event ID (stabile) o fallback sha1
  let sourceEventId: string | null = null;
  if (record.eventId?.trim()) {
    sourceEventId = `apple_music:${record.eventId.trim()}`;
  } else {
    const trackKey = `${songName.trim()}|${resolveArtistName(record, dailyArtistMap)}`;
    sourceEventId = await sha1Hex(`${trackKey}|${timestamp}|${playDurationMs ?? 0}`);
  }

  // Campi derivati
  const completed = computeCompleted(playDurationMs, mediaDurationMs);
  const skipped = computeSkipped(endReason, playDurationMs, mediaDurationMs);
  const shuffle = record.shufflePlay !== undefined ? record.shufflePlay === 'true' : null;
  const offline = record.offline !== undefined ? record.offline === 'true' : null;
  const deviceType = mapDeviceType(record);
  const deviceDetail = buildDeviceDetail(record);
  const country = resolveCountry(record);

  // IP: solo se retainIp (gestito dal caller via options)
  const ip = null; // il core sovrascriverà se retainIp=true

  const raw: RawListenEvent = {
    platform: 'apple_music',
    sourceEventId,
    rawTimestamp: timestamp,
    rawStartedAt: startedAt,
    sourceDurationMs: playDurationMs ?? 0,
    sourceTrackUri: null, // nessun ID traccia stabile nell'export
    sourceTrackName: songName.trim(),
    sourceArtistName: resolveArtistName(record, dailyArtistMap),
    sourceArtistUri: null, // nessun ID artista stabile
    sourceAlbumName: record.albumName?.trim() ?? null,
    isrc: null,
    mbid: null,
    completed,
    skipped,
    shuffle,
    offline,
    incognito: null,
    reasonStart: record.eventReasonHintType?.trim() ?? null,
    reasonEnd: endReason ?? null,
    deviceType,
    deviceDetail,
    ip,
    country,
  };
  return raw;
}

/**
 * Parsing del file Daily Tracks CSV → array di record.
 */
export async function parseDailyTracksCsv(csvText: string): Promise<AppleMusicDailyTrackRecord[]> {
  return new Promise<AppleMusicDailyTrackRecord[]>((resolve, reject) => {
    const results: AppleMusicDailyTrackRecord[] = [];
    const config = {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: 'greedy',
      transformHeader: (h: string, _index: number) => h.trim().toLowerCase().replace(/\s+/g, ' '),
      step: (result: Papa.ParseStepResult<AppleMusicDailyTrackRecord>) => {
        if (result.errors.length > 0) {
          reject(
            new Error(
              `PapaParse Daily Tracks error: ${result.errors.map((e) => e.message).join(', ')}`,
            ),
          );
          return;
        }
        if (result.data) {
          results.push(result.data);
        }
      },
      complete: () => resolve(results),
    };
    (Papa.parse as (input: string, config: object) => void)(csvText, config);
  });
}
