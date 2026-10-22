import type { DeviceType } from '../../schema';
import { sha1Hex } from '../crypto';
import type { RawListenEvent } from '../types';
import type { YouTubeActivityRecord } from './types';

/**
 * Mapping attività Google Takeout → `RawListenEvent`
 * (03-ADAPTERS/youtube-music.md §3).
 *
 * Derivazioni implementate qui (i restanti step 05§3.1 sono della pipeline
 * core): filtro musica/video E6 (§3.3), semantica temporale D2 (§5: `time` è
 * inizio ascolto, `durationMs = 0`, `startedAt = timestamp`), `eventKey`
 * stabile `sha1(videoId|rawTime)` (§3.1), prefissi verbo localizzati E.YT.3
 * (§10), privacy §7 (`locationInfos` scartati, `country = null`).
 */

/** Header/products che qualificano un'attività come piattaforma YouTube (§2.2). */
export const YT_HEADERS = ['YouTube Music', 'YouTube'] as const;

/** URL di ascolto riconosciuti (§2.2: `/watch/` o `youtu.be/<id>`). */
export const WATCH_URL_RE = /youtube\.com\/watch|youtu\.be\//i;

/**
 * Prefissi verbo curati (E.YT.3, §10): EN `Watched` e IT `Guardato` alla
 * stesura; la lista è estendibile. Fallback conservativo: nessun prefisso
 * matcha → `name = title` intero (mai rimuovere la prima parola a caso).
 */
export const WATCH_VERB_PREFIXES = ['Watched', 'Guardato'] as const;

const WATCH_VERB_RE = new RegExp(`^(?:${WATCH_VERB_PREFIXES.join('|')})\\s+`, 'i');

/** True se il `title` inizia con un prefisso verbo di watch conosciuto. */
export function hasWatchVerbPrefix(title: string): boolean {
  return WATCH_VERB_RE.test(title);
}

/**
 * Rimuove il prefisso verbo localizzato dal `title` (E.YT.3). Fallback
 * conservativo: nessun prefisso matcha → title intero.
 */
export function stripWatchVerbPrefix(title: string): string {
  if (!hasWatchVerbPrefix(title)) {
    return title.trim();
  }
  return title.replace(WATCH_VERB_RE, '').trim();
}

/**
 * Estrae il `videoId` da `titleUrl` (§3.1, §10): host ammessi
 * `youtube.com`/`music.youtube.com` (parametro `v`) e `youtu.be/<id>`
 * (path-short). Altri host o URL malformati → null.
 */
export function extractVideoId(titleUrl: string | null | undefined): string | null {
  if (!titleUrl) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(titleUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0] ?? '';
    return id.length > 0 ? id : null;
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const v = url.searchParams.get('v');
    return v && v.length > 0 ? v : null;
  }
  return null;
}

/** Estrae il `channelId` da una URL canale (§3.1.2: pattern `/channel/<id>`). */
export function extractChannelId(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  const match = /\/channel\/([^/?#]+)/i.exec(url);
  return match?.[1] ?? null;
}

/** Esito della classificazione filtro musica (§3.3). */
export type MusicClassification = 'music' | 'nonMusic' | 'nonListen';

/**
 * Regola filtro musica/video (edge case E6 — decisione D3, §3.3):
 *
 *     1. header 'YouTube Music'                        → MUSICA
 *     2. header 'YouTube':
 *        2a. host(titleUrl) 'music.youtube.com'        → MUSICA
 *        2b. subtitles[0].name `-\s*Topic$`            → MUSICA
 *        2c. subtitles[0].name `VEVO$`                 → MUSICA
 *        2d. products include 'YouTube Music'          → MUSICA
 *        2e. altrimenti                                → NON-MUSICA
 *     3. header assente o altro ('Search', …)          → NON-ASCOLTO
 *
 * Gli eventi non-ascolto eventualmente presenti ('Liked…', 'Searched…',
 * §2.2) non passano il gate del watch-verb/URL ed emergono come
 * `nonListen` (skip silenzioso, ammesso dalla regola 3).
 */
export function classifyMusicEvent(record: YouTubeActivityRecord): MusicClassification {
  if (record.header === 'YouTube Music') {
    return 'music';
  }
  if (record.header === 'YouTube') {
    if (record.titleUrl) {
      try {
        if (new URL(record.titleUrl).hostname.toLowerCase() === 'music.youtube.com') {
          return 'music';
        }
      } catch {
        // URL malformato: prosegue con l'euristica sul canale/prodotti.
      }
    }
    const channel = record.subtitles?.[0]?.name ?? null;
    if (channel) {
      if (/-\s*Topic$/i.test(channel)) {
        return 'music';
      }
      if (/VEVO$/i.test(channel)) {
        return 'music';
      }
    }
    if (record.products?.includes('YouTube Music')) {
      return 'music';
    }
    return 'nonMusic';
  }
  return 'nonListen';
}

/** Esito del mapping per singola attività. */
export interface YouTubeMapResult {
  /** Evento grezzo pronto per la pipeline core; null se scartato. */
  raw: RawListenEvent | null;
  /**
   * Categorie di scarto: 'nonMusic' (E6 §3.3, con warning), 'unwatchable'
   * (E.YT.2, con warning), 'nonListen' (regola 3 / shape non interpretabile,
   * skip silenzioso).
   */
  discardReason: 'nonMusic' | 'unwatchable' | 'nonListen' | null;
}

/**
 * Mappa un'attività Takeout in `RawListenEvent` (youtube-music.md §3.1).
 *
 * - E.YT.2 (video rimossi): verbo di watch presente ma nessun `videoId`
 *   estraibile (niente `titleUrl` o URL non-watch) → skip con warning.
 * - `sourceEventId` = `sha1(videoId + '|' + rawTime)` — derivato SOLO da
 *   dati grezzi (§3.1): abilita la correzione temporale futura (§5).
 * - `sourceTrackUri` è un URI convenzionale (`youtube_music:video:<id>`):
 *   il pipeline core deriva da esso `platformIds.youtube_music = videoId`
 *   (§3.1.1) con la stessa convenzione "ultimo segmento" di Spotify.
 * - `sourceArtistUri` analogamente porta il `channelId` (§3.1.2).
 * - `rawStartedAt = rawTimestamp` (D2: `time` è inizio ascolto; durata
 *   ignota, `sourceDurationMs = 0`).
 */
export async function mapYouTubeEvent(record: YouTubeActivityRecord): Promise<YouTubeMapResult> {
  const timestamp = Date.parse(record.time);
  if (!Number.isFinite(timestamp)) {
    // Shape non interpretabile (§2.2): skip silenzioso, non è fatale.
    return { raw: null, discardReason: 'nonListen' };
  }
  const videoId = extractVideoId(record.titleUrl ?? null);
  const watchVerb = hasWatchVerbPrefix(record.title);
  if (watchVerb && !videoId) {
    // E.YT.2: metadati inutilizzabili (video rimosso/privato).
    return { raw: null, discardReason: 'unwatchable' };
  }
  if (!watchVerb && !videoId) {
    // Non-ascolto ('Liked…', 'Searched…', regola 3): skip silenzioso.
    return { raw: null, discardReason: 'nonListen' };
  }
  if (classifyMusicEvent(record) !== 'music') {
    return { raw: null, discardReason: 'nonMusic' };
  }
  const name = stripWatchVerbPrefix(record.title);
  if (!name) {
    return { raw: null, discardReason: 'unwatchable' };
  }
  const subtitle = record.subtitles?.[0] ?? null;
  const channelId = extractChannelId(subtitle?.url ?? null);
  const sourceEventId = videoId ? await sha1Hex(`${videoId}|${record.time}`) : null;
  const raw: RawListenEvent = {
    platform: 'youtube_music',
    sourceEventId,
    rawTimestamp: timestamp,
    rawStartedAt: timestamp,
    sourceDurationMs: 0,
    sourceTrackUri: videoId ? `youtube_music:video:${videoId}` : null,
    sourceTrackName: name,
    sourceArtistName: subtitle?.name ?? null,
    sourceArtistUri: channelId ? `youtube_music:channel:${channelId}` : null,
    sourceAlbumName: null,
    isrc: null,
    mbid: null,
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
