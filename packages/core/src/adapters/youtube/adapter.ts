import { blobChunks, iterateJsonArrayElements } from '../jsonStream';
import type { ParseOptions, PlatformAdapter, RawListenEvent } from '../types';
import { detectYouTubeMusic, isWatchHistoryJson } from './detect';
import { mapYouTubeEvent } from './mapEvent';
import { isYouTubeActivityRecord } from './types';
import { extractZipEntry, isZip, listZipEntries } from '../zip';

/**
 * Adapter YouTube Music — export Google Takeout "YouTube and YouTube Music"
 * (03-ADAPTERS/youtube-music.md, 05-ARCHITECTURE.md §4).
 *
 * Il canale MVP è il Takeout JSON (ZIP o il watch-history.json estratto):
 * non esiste alcuna API per la cronologia di ascolto (§1). La cronologia è
 * **unificata** video + musica (E6): il filtro §3.3 scarta i non-musica
 * contandoli come warning.
 */

/** Frequenza del check di cancellazione cooperativa (05§4: "ogni N eventi"). */
const SIGNAL_CHECK_EVERY = 100;

export class YouTubeMusicAdapter implements PlatformAdapter {
  readonly platform = 'youtube_music' as const;
  readonly name = 'YouTube Music';
  readonly version = '1.0.0';

  /**
   * Riconoscimento strutturale ZIP/JSON (§2.2). Sempre via `await` (D.A.8).
   * L'HTML viene rifiutato in `detectYouTubeMusic` (§2.2: l'errore guidato
   * `error.htmlExport` è scelto dalla UI, il contratto detect è booleano).
   */
  detect(input: Blob): Promise<boolean> {
    return detectYouTubeMusic(input);
  }

  /**
   * Parsing streaming della cronologia (05§4: mai tutto il file in memoria).
   *
   * - ZIP: scansione ricorsiva di **tutti** i `*.json` (i nomi sono
   *   localizzati, E.YT.1); vengono streammati solo i file che superano il
   *   test strutturale watch-history — gli altri file del Takeout
   *   (`search-history.json`, MyActivity, CSV) sono fuori scope (D7) e
   *   non generano né eventi né warning spurio.
   * - JSON singolo: array eventi (produzione) o wrapper fixture
   *   `{"events":[...]}`.
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
      for (const name of names) {
        if (!/\.json$/i.test(name)) {
          continue;
        }
        const data = await extractZipEntry(zipBytes, name);
        if (!data) {
          continue;
        }
        const file = this.asBlob(data);
        if (!(await isWatchHistoryJson(file))) {
          continue;
        }
        yield* this.streamJsonFile(file, onWarning, checkSignal);
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
   * Streaming di un singolo file JSON eventi: guard strutturale per elemento,
   * mapping per-evento + segnalazioni (§9): E6 non-musica e E.YT.2 video
   * rimossi contati, eventi non-ascolto scartati in silenzio.
   */
  private async *streamJsonFile(
    file: Blob,
    onWarning: ((code: string) => void) | undefined,
    checkSignal: () => void,
  ): AsyncGenerator<RawListenEvent> {
    let sinceCheck = 0;
    for await (const element of iterateJsonArrayElements(blobChunks(file))) {
      sinceCheck += 1;
      if (sinceCheck >= SIGNAL_CHECK_EVERY) {
        sinceCheck = 0;
        checkSignal();
      }
      if (!isYouTubeActivityRecord(element)) {
        // Record non interpretabile: skip silenzioso (§3.3 regola 3).
        continue;
      }
      const result = await mapYouTubeEvent(element);
      if (!result.raw) {
        if (result.discardReason === 'nonMusic') {
          onWarning?.('adapter.youtube_music.warn.nonMusicSkipped');
        } else if (result.discardReason === 'unwatchable') {
          onWarning?.('adapter.youtube_music.warn.unwatchableSkipped');
        }
        continue;
      }
      yield result.raw;
    }
  }
}
