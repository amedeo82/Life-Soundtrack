import { blobChunks, iterateJsonArrayElements } from '../jsonStream';
import type { LibrarySnapshot, ParseOptions, PlatformAdapter, RawListenEvent } from '../types';
import { detectSpotify } from './detect';
import { mapSpotifyEvent } from './mapEvent';
import { buildLibrarySnapshot, isPlaylistFileName } from './library';
import { isSpotifyStreamingRecord } from './types';
import { extractZipEntry, isZip, listZipEntries } from './zip';

/**
 * Adapter Spotify — export GDPR "Extended streaming history"
 * (03-ADAPTERS/spotify.md, 05-ARCHITECTURE.md §4).
 *
 * Il canale MVP è il file ZIP (o i JSON che contiene, passati singolarmente):
 * l'API pubblica è fuori scope per la cronologia (§1).
 */

/** Nome di un file di streaming history audio nell'export (§2.1-2.2). */
const AUDIO_FILE_RE = /^Streaming_History_Audio_.+\.json$/i;

/** File non musicali conteggiati come E6 e mai importati come brani (§4). */
const NON_MUSIC_FILE_RE = /^Streaming_History_(?:Podcast|Audiobook|Video)_.+\.json$/i;

/** File tecnici mai processati (§7: consenso separato per CarDetection). */
const CAR_DETECTION_FILE_RE = /(?:^|\/)CarDetectionEvent\.json$/i;

/** Frequenza del check di cancellazione cooperativa (05§4: "ogni N eventi"). */
const SIGNAL_CHECK_EVERY = 100;

export class SpotifyAdapter implements PlatformAdapter {
  readonly platform = 'spotify' as const;
  readonly name = 'Spotify';
  readonly version = '1.0.0';

  /** Riconoscimento ZIP/JSON (spotify.md §2.2). Sempre via `await` (D.A.8). */
  detect(input: Blob): Promise<boolean> {
    return detectSpotify(input);
  }

  /**
   * Parsing streaming della cronologia (05§4: mai tutto il file in memoria).
   *
   * - ZIP: i file audio sono processati dal più recente al più vecchio
   *   (§10), uno alla volta; podcast/audiobook/video contano solo come
   *   warning E6; i file tecnici (`CarDetectionEvent.json`) sono scartati
   *   a prescindere dal consenso: la pipeline dati-auto non esiste in MVP
   *   (AC: rifiuto senza opt-in esplicito).
   * - JSON singolo: array eventi (produzione) o wrapper fixture `{"events":[...]}`.
   */
  async *parse(input: Blob, options: ParseOptions = {}): AsyncGenerator<RawListenEvent> {
    const signal = options.signal;
    const onWarning = options.onWarning;
    const checkSignal = (): void => {
      if (signal?.aborted) {
        throw new DOMException('Import cancellato', 'AbortError');
      }
    };

    if (await isZip(input)) {
      const names = await listZipEntries(input);
      const zipBytes = new Uint8Array(await input.arrayBuffer());
      if (names.some((name) => CAR_DETECTION_FILE_RE.test(name))) {
        onWarning?.('CAR_DETECTION_SKIPPED');
      }
      // §10: ordine cronologico inverso (più recente → più vecchio). I nomi
      // GDPR numerano i chunk progressivamente: l'ordinamento lessicografico
      // decrescente approssima l'ordine temporale per entrambi gli stili.
      const audioFiles = names
        .filter((name) => AUDIO_FILE_RE.test(name))
        .sort()
        .reverse();
      for (const name of audioFiles) {
        const data = await extractZipEntry(zipBytes, name);
        if (data) {
          yield* this.streamJsonFile(this.asBlob(data), onWarning, checkSignal);
        }
      }
      // E6 (§4): file non musicali — si contano gli episodi, non si importano.
      const nonMusicFiles = names.filter((name) => NON_MUSIC_FILE_RE.test(name));
      for (const name of nonMusicFiles) {
        const data = await extractZipEntry(zipBytes, name);
        if (!data) {
          continue;
        }
        for await (const element of iterateJsonArrayElements(blobChunks(this.asBlob(data)))) {
          void element;
          checkSignal();
          onWarning?.('adapter.spotify.warn.podcastSkipped');
        }
      }
      return;
    }
    yield* this.streamJsonFile(input, onWarning, checkSignal);
  }

  /**
   * Wrap di un buffer estratto in Blob: la copia garantisce un ArrayBuffer
   * proprio (i chunk fflate non sono riutilizzati altrove).
   */
  private asBlob(data: Uint8Array): Blob {
    return new Blob([new Uint8Array(data)]);
  }

  /**
   * Streaming di un singolo file JSON eventi: mapping per-evento + segnalazioni
   * (T0.3.7): E3 offline convertiti, E6 podcast scartati, E2 timestamp
   * sovrapposti (§4) contati sulla sequenza consecutiva del file.
   */
  private async *streamJsonFile(
    file: Blob,
    onWarning: ((code: string) => void) | undefined,
    checkSignal: () => void,
  ): AsyncGenerator<RawListenEvent> {
    let sinceCheck = 0;
    let lastEnd: number | null = null;
    for await (const element of iterateJsonArrayElements(blobChunks(file))) {
      sinceCheck += 1;
      if (sinceCheck >= SIGNAL_CHECK_EVERY) {
        sinceCheck = 0;
        checkSignal();
      }
      if (!isSpotifyStreamingRecord(element)) {
        // §2.2: record senza `ts`/`ms_played` è scartato, non fatale.
        onWarning?.('E_INVALID_RECORD');
        continue;
      }
      const result = mapSpotifyEvent(element);
      if (result.offlineConverted) {
        onWarning?.('adapter.spotify.warn.offlineConverted');
      }
      if (!result.raw) {
        if (result.discardReason === 'podcast') {
          onWarning?.('adapter.spotify.warn.podcastSkipped');
        } else {
          onWarning?.('E_INVALID_RECORD');
        }
        continue;
      }
      if (
        lastEnd !== null &&
        result.raw.rawStartedAt !== null &&
        result.raw.rawStartedAt < lastEnd &&
        new Date(lastEnd).toISOString().slice(0, 10) ===
          new Date(result.raw.rawTimestamp).toISOString().slice(0, 10)
      ) {
        // Sovrapposizione reale (stesso giorno UTC): eventi molto ravvicinati
        // su file non cronologico non sono "overlap" di sessione.
        onWarning?.('adapter.spotify.warn.overlaps');
      }
      lastEnd = result.raw.rawTimestamp;
      yield result.raw;
    }
  }

  /**
   * Parsing library/playlist/follow (T0.3.6, §2.3, §3.4). Accetta lo ZIP
   * completo oppure i singoli JSON: il contenuto viene classificato per
   * shape e ridotto a `LibrarySnapshot` grezzo — la risoluzione sugli id
   * interni avviene in `importLibrary` (importSession.ts).
   */
  async parseLibrary(input: Blob): Promise<LibrarySnapshot> {
    const files: Record<string, unknown> = {};
    if (await isZip(input)) {
      const names = await listZipEntries(input);
      const zipBytes = new Uint8Array(await input.arrayBuffer());
      const wanted = names.filter(
        (name) =>
          /^YourLibrary\.json$/i.test(name) ||
          /^Follow\.json$/i.test(name) ||
          isPlaylistFileName(name),
      );
      for (const name of wanted) {
        const data = await extractZipEntry(zipBytes, name);
        if (data) {
          files[name] = this.parseSmallJson(data);
        }
      }
    } else {
      const data = this.parseSmallJson(new Uint8Array(await input.arrayBuffer()));
      files[this.classifySingleJson(data)] = data;
    }
    return buildLibrarySnapshot(files);
  }

  /** Decodifica e interpreta un JSON piccolo (library/playlist/follow). */
  private parseSmallJson(data: Uint8Array): unknown {
    return JSON.parse(new TextDecoder().decode(data)) as unknown;
  }

  /** Classifica un JSON singolo per shape (nome file virtuale). */
  private classifySingleJson(data: unknown): string {
    if (Array.isArray(data)) {
      return 'Follow.json';
    }
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if ('tracks' in obj || 'albums' in obj) {
        return 'YourLibrary.json';
      }
      if ('name' in obj && 'items' in obj) {
        return 'Playlist1.json';
      }
      if ('artists' in obj || 'followedArtists' in obj) {
        return 'Follow.json';
      }
    }
    return 'Unknown.json';
  }
}
