import { blobChunks } from '../jsonStream';
import { iterateJsonlLines } from '../jsonlStream';
import { extractZipEntry, isZip, listZipEntries } from '../zip';
import type { ParseOptions, PlatformAdapter, RawListenEvent } from '../types';
import { detectListenBrainz } from './detect';
import { mapListenBrainzEvent } from './mapEvent';
import { isListenBrainzListen } from './types';

/**
 * Adapter ListenBrainz — export API (ZIP con `listens/*.jsonl`, o JSONL
 * sciolto) (`03-ADAPTERS/listenbrainz.md`, 05-ARCHITECTURE.md §4).
 *
 * L'adapter è **file-only** nella Story 1.3: nessuna chiamata di rete, nessun
 * token, nessun rate limit. Il canale `/1/user/{u}/listens` (query
 * incrementale) è materiale della Story 1.5 e produrrà gli stessi
 * `RawListenEvent` attraverso il contratto `parseRemote?()` (ADR-0010).
 */

/** Frequenza del check di cancellazione cooperativa (05§4). */
const SIGNAL_CHECK_EVERY = 100;

/** Path dei file di ascolto dentro l'archivio export. */
const LISTENS_PATH_RE = /^listens\/.+\.jsonl$/i;

/** File presenti nell'archivio ma **fuori scope** (E.LB.16). */
const DEFERRED_FILES = ['feedback.jsonl', 'pinned_recording.jsonl'];

export class ListenBrainzAdapter implements PlatformAdapter {
  readonly platform = 'listenbrainz' as const;
  readonly name = 'ListenBrainz';
  readonly version = '1.0.0';

  /**
   * Riconoscimento strutturale dell'export (§2.2): ZIP con `listens/*.jsonl`
   * + `user.json`, oppure JSONL sciolto con prima riga valida.
   */
  detect(input: Blob): Promise<boolean> {
    return detectListenBrainz(input);
  }

  /**
   * Parsing streaming dell'export (05§4: mai tutto il file in memoria).
   *
   * - ZIP: si estrae **un file per volta** (`extractZipEntry`) e lo si
   *   consuma prima del successivo → picco di memoria limitato a un mese di
   *   ascolti. L'ordine dei mesi **non** è assunto (E.LB.14): l'ordine
   *   finale degli eventi è determinato dal `listened_at`.
   * - JSONL sciolto: stream identico, dal file estratto a mano.
   */
  async *parse(input: Blob, options: ParseOptions = {}): AsyncGenerator<RawListenEvent> {
    const onWarning = options.onWarning;
    const checkSignal = (): void => {
      if (options.signal?.aborted) {
        throw new DOMException('Import cancellato', 'AbortError');
      }
    };
    /** E.LB.1: righe senza durata catalogo → un solo warning aggregato. */
    const counter = { durationMissing: 0 };

    if (await isZip(input)) {
      const names = await listZipEntries(input);
      const zipBytes = new Uint8Array(await input.arrayBuffer());
      let deferred = false;
      for (const name of names) {
        const lower = name.toLowerCase();
        if (DEFERRED_FILES.some((file) => lower.endsWith(`/${file}`) || lower === file)) {
          // E.LB.16: feedback e pinned non sono modellati (02§3.3).
          deferred = true;
          continue;
        }
        if (!LISTENS_PATH_RE.test(name)) {
          continue;
        }
        const data = await extractZipEntry(zipBytes, name);
        if (!data) {
          continue;
        }
        const file = new Blob([new Uint8Array(data) as unknown as ArrayBuffer]);
        yield* this.streamJsonl(file, onWarning, checkSignal, counter);
      }
      if (deferred) {
        onWarning?.('adapter.listenbrainz.info.libraryDeferred');
      }
    } else {
      yield* this.streamJsonl(input, onWarning, checkSignal, counter);
    }
    if (counter.durationMissing > 0) {
      onWarning?.('adapter.listenbrainz.warn.durationMissing', counter.durationMissing);
    }
  }

  /**
   * Streaming di un file JSONL: ogni riga è un oggetto JSON indipendente.
   * Una riga malformata **non** abortisce lo stream (la riga viene scartata
   * con warning e il parsing continua).
   */
  private async *streamJsonl(
    file: Blob,
    onWarning: ((code: string, count?: number) => void) | undefined,
    checkSignal: () => void,
    counter: { durationMissing: number },
  ): AsyncGenerator<RawListenEvent> {
    let sinceCheck = 0;
    for await (const line of iterateJsonlLines(blobChunks(file))) {
      sinceCheck += 1;
      if (sinceCheck >= SIGNAL_CHECK_EVERY) {
        sinceCheck = 0;
        checkSignal();
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        // Riga malformata: scartata, lo stream continua (§10).
        onWarning?.('adapter.listenbrainz.warn.malformedSkipped');
        continue;
      }
      if (!isListenBrainzListen(parsed)) {
        onWarning?.('adapter.listenbrainz.warn.malformedSkipped');
        continue;
      }
      const result = await mapListenBrainzEvent(parsed);
      if (!result.raw) {
        if (result.discardReason === 'tooOld') {
          onWarning?.('adapter.listenbrainz.warn.tooOldSkipped');
        } else if (result.discardReason === 'noTitle') {
          onWarning?.('adapter.listenbrainz.warn.noTitleSkipped');
        } else {
          onWarning?.('adapter.listenbrainz.warn.malformedSkipped');
        }
        continue;
      }
      if (result.raw.sourceTrackDurationMs === null) {
        counter.durationMissing += 1;
      }
      yield result.raw;
    }
  }
}
