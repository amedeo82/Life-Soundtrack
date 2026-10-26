import * as Papa from 'papaparse';
import { AdapterError } from '../errors';
import type { ParseOptions, PlatformAdapter, RawListenEvent, RemoteSource } from '../types';
import { LastfmApiClient } from './api';
import { detectLastfmFile, isFourColumnRow, isGhanlHeader } from './detect';
import { LastfmEventKeyBuilder } from './eventKey';
import {
  mapLastfmApiTrack,
  mapLastfmFileRow,
  parseLastfmMinuteDate,
  type LastfmFileRow,
} from './mapEvent';

/**
 * Adapter Last.fm — percorso **ibrido**: API `user.getRecentTracks` (via
 * proxy CORS configurato dall'utente) + percorso **file** (CSV/JSON prodotti
 * da tool di terze parti) (`03-ADAPTERS/lastfm.md`, 05-ARCHITECTURE.md §4).
 *
 * I due percorsi producono **gli stessi `RawListenEvent`** e la stessa
 * `eventKey` normalizzata al minuto (D-LF.7): un re-import misto non
 * duplica nessuno scrobble.
 */

/** Frequenza del check di cancellazione cooperativa (05§4). */
const SIGNAL_CHECK_EVERY = 100;

/** Configurazione per-utente dell'adapter Last.fm (mai embedded nel bundle). */
export interface LastfmAdapterConfig {
  /** Username Last.fm: obbligatorio per il percorso API. */
  username?: string | undefined;
  /** `fetch` iniettabile (test: nessuna rete reale). */
  fetchImpl?: typeof fetch | undefined;
  /** Orologio iniettabile (test del token bucket). */
  now?: (() => number) | undefined;
  /** Sleep iniettabile (test del token bucket e del backoff). */
  sleep?: ((ms: number) => Promise<void>) | undefined;
}

export class LastfmAdapter implements PlatformAdapter {
  readonly platform = 'lastfm' as const;
  readonly name = 'Last.fm';
  readonly version = '1.0.0';

  private readonly config: LastfmAdapterConfig;

  constructor(config: LastfmAdapterConfig = {}) {
    this.config = config;
  }

  /**
   * Riconoscimento del percorso **file** (§2.3): CSV `ghan.nl` (header a 8
   * colonne), CSV `lastfm-to-csv` (4 colonne senza header) o export JSON.
   */
  detect(input: Blob): Promise<boolean> {
    return detectLastfmFile(input);
  }

  /**
   * Percorso **file** (§2.3): senza proxy, senza rete, senza `api_key`.
   */
  async *parse(input: Blob, options: ParseOptions = {}): AsyncGenerator<RawListenEvent> {
    const onWarning = options.onWarning;
    const checkSignal = (): void => {
      if (options.signal?.aborted) {
        throw new DOMException('Import cancellato', 'AbortError');
      }
    };

    const text = (await input.text()).replace(/^\uFEFF/, '');
    const firstLine = text.split('\n', 1)[0]?.trim() ?? '';
    const isJson = firstLine.startsWith('{') || firstLine.startsWith('[');
    const rows: LastfmFileRow[] = isJson ? parseJsonExportRows(text) : parseCsvRows(text);

    const keys = new LastfmEventKeyBuilder();
    let sinceCheck = 0;
    let mbidMissing = 0;
    for (const row of rows) {
      sinceCheck += 1;
      if (sinceCheck >= SIGNAL_CHECK_EVERY) {
        sinceCheck = 0;
        checkSignal();
      }
      const result = mapLastfmFileRow(row);
      if (!result.raw) {
        if (result.discardReason === 'noTitle') {
          onWarning?.('adapter.lastfm.warn.noTitleSkipped');
        } else if (result.discardReason === 'noArtist') {
          onWarning?.('adapter.lastfm.warn.noArtistSkipped');
        } else {
          onWarning?.('adapter.lastfm.warn.noDateSkipped');
        }
        continue;
      }
      if (!row.trackMbid) {
        mbidMissing += 1;
      }
      for (const resolved of keys.push(result.raw)) {
        yield resolved;
      }
    }
    for (const resolved of keys.flush()) {
      yield resolved;
    }
    if (mbidMissing > 0) {
      // E.LF.5: un solo warning aggregato, non uno per riga.
      onWarning?.('adapter.lastfm.warn.mbidMissing', mbidMissing);
    }
  }

  /**
   * Percorso **API** (`parseRemote?`, ADR-0010): pagina `user.getRecentTracks`
   * dopo pagina, con token bucket, backoff e mappa dei 10 codici di errore.
   *
   * Senza proxy configurato **nessuna richiesta** viene fatta (E.LF.7): il
   * percorso file resta comunque disponibile.
   */
  async *parseRemote(
    source: RemoteSource,
    options: ParseOptions = {},
  ): AsyncGenerator<RawListenEvent> {
    const endpoint = (source.endpoint ?? '').trim();
    if (endpoint.length === 0) {
      throw new AdapterError(
        'SOURCE_UNREACHABLE',
        'Nessun proxy Last.fm configurato: imposta il proxy nelle impostazioni (le richieste non partono)',
        { recoverable: true },
      );
    }
    const user = (this.config.username ?? '').trim();
    if (user.length === 0) {
      throw new AdapterError(
        'INTERNAL',
        'Nome utente Last.fm mancante: completa la configurazione nelle impostazioni',
      );
    }

    const onWarning = options.onWarning;
    const signal = source.signal ?? options.signal;
    const client = new LastfmApiClient({
      endpoint,
      user,
      apiKey: source.credentials?.apiKey,
      sessionKey: source.credentials?.sessionKey,
      limit: source.pagination?.limit,
      from: source.pagination?.from,
      to: source.pagination?.to,
      fetchImpl: this.config.fetchImpl,
      now: this.config.now,
      sleep: this.config.sleep,
    });

    let sinceCheck = 0;
    let mbidMissing = 0;
    const keys = new LastfmEventKeyBuilder();
    for await (const page of client.pages(signal)) {
      for (const track of page.tracks) {
        sinceCheck += 1;
        if (sinceCheck >= SIGNAL_CHECK_EVERY) {
          sinceCheck = 0;
          if (signal?.aborted) {
            throw new DOMException('Import cancellato', 'AbortError');
          }
        }
        const result = mapLastfmApiTrack(track);
        if (!result.raw) {
          // E.LF.1: il brano in riproduzione è scartato **in silenzio**.
          if (result.discardReason === 'noTitle') {
            onWarning?.('adapter.lastfm.warn.noTitleSkipped');
          } else if (result.discardReason === 'noArtist') {
            onWarning?.('adapter.lastfm.warn.noArtistSkipped');
          } else if (result.discardReason === 'noDate') {
            onWarning?.('adapter.lastfm.warn.noDateSkipped');
          }
          continue;
        }
        if (!result.raw.mbid) {
          mbidMissing += 1;
        }
        for (const resolved of keys.push(result.raw)) {
          yield resolved;
        }
      }
    }
    for (const resolved of keys.flush()) {
      yield resolved;
    }
    if (mbidMissing > 0) {
      onWarning?.('adapter.lastfm.warn.mbidMissing', mbidMissing);
    }
  }
}

/**
 * Righe dell'export **JSON** dei tool ghan.nl: un oggetto per riga, con gli
 * stessi campi del CSV a 8 colonne (`{ "events": [...] }` o array).
 */
export function parseJsonExportRows(text: string): LastfmFileRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AdapterError('INVALID_FORMAT', 'Export JSON Last.fm non valido');
  }
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { events?: unknown }).events)
      ? ((parsed as { events: unknown[] }).events as unknown[])
      : typeof parsed === 'object' && parsed !== null
        ? [parsed]
        : [];
  const rows: LastfmFileRow[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const uts = rec.uts;
    const epochSeconds =
      typeof uts === 'number' ? uts : typeof uts === 'string' ? Number.parseInt(uts, 10) : NaN;
    rows.push({
      epochSeconds: Number.isFinite(epochSeconds) ? epochSeconds : null,
      artist: textOrNull(rec.artist),
      album: textOrNull(rec.album),
      track: textOrNull(rec.track),
      trackMbid: textOrNull(rec.track_mbid),
      artistMbid: textOrNull(rec.artist_mbid),
    });
  }
  return rows;
}

/**
 * Righe dei due formati CSV (§2.3): `ghan.nl` (8 colonne con header) e
 * `lastfm-to-csv` (4 colonne senza header, data al minuto).
 */
export function parseCsvRows(text: string): LastfmFileRow[] {
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: 'greedy' });
  const rawRows = parsed.data;
  if (rawRows.length === 0) {
    return [];
  }
  const head = (rawRows[0] ?? []).map((cell) =>
    typeof cell === 'string' ? cell : String(cell ?? ''),
  );
  if (isGhanlHeader(head)) {
    // Header a 8 colonne: `uts, utc_time, artist, album, track, artist_mbid, album_mbid, track_mbid`.
    const rows: LastfmFileRow[] = [];
    for (const raw of rawRows.slice(1)) {
      const cells = (raw ?? []).map((cell) =>
        typeof cell === 'string' ? cell : String(cell ?? ''),
      );
      const uts = Number.parseInt(cells[0] ?? '', 10);
      rows.push({
        epochSeconds: Number.isFinite(uts) ? uts : null,
        artist: textOrNull(cells[2]),
        album: textOrNull(cells[3]),
        track: textOrNull(cells[4]),
        artistMbid: textOrNull(cells[5]),
        trackMbid: textOrNull(cells[7]),
      });
    }
    return rows;
  }
  // 4 colonne senza header: `artist, album, track, date` (data al minuto).
  // L'ultima riga può non avere la data (E.LF.18: brano in riproduzione).
  const rows: LastfmFileRow[] = [];
  const start = isFourColumnRow(head) || isGhanlHeader(head) ? 0 : 0;
  for (const raw of rawRows.slice(start)) {
    const cells = (raw ?? []).map((cell) => (typeof cell === 'string' ? cell : String(cell ?? '')));
    if (cells.length === 0) {
      continue;
    }
    rows.push({
      epochSeconds: parseLastfmMinuteDate(cells[3]),
      artist: textOrNull(cells[0]),
      album: textOrNull(cells[1]),
      track: textOrNull(cells[2]),
      artistMbid: null,
      trackMbid: null,
    });
  }
  return rows;
}

/** Campo testuale del payload: stringa non vuota, altrimenti null. */
function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
