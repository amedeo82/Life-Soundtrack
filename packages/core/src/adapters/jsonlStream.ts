import { AdapterError } from './errors';

/**
 * Scanner JSONL (Newline Delimited JSON) — `03-ADAPTERS/listenbrainz.md` §10.
 *
 * L'export ListenBrainz è **JSONL**, non array JSON: ogni riga è un oggetto
 * JSON indipendente. Lo `JsonArrayScanner` di `adapters/jsonStream.ts` è uno
 * scanner di **array JSON** e non va bene: qui serve uno scanner dedicato.
 *
 * Garantie:
 * - **memoria limitata a una riga**: il buffer tiene solo il frammento
 *   dell'ultima riga non ancora terminata;
 * - **una riga malformata non abortisce lo stream**: la riga viene scartata
 *   e il parsing continua (un export con una riga corrotta non deve perdere
 *   tutto lo storico);
 * - **`end()` coerente**: righe rimaste nel buffer senza terminatore →
 *   `AdapterError` `TRUNCATED`, `recoverable: true` (05§4 partial recovery).
 */

/** Dimensione massima di una singola riga (una riga di ascolto è ~1KB). */
const MAX_LINE_CHARS = 1_000_000;

/** Byte Order Mark UTF-8: tollerato sul primo file, poi scartato. */
const BOM = '\uFEFF';

/**
 * Scanner a push: `push(text)` restituisce le righe **complete** ricevute;
 * `end()` chiude lo stream verificando che non restino righe incomplete.
 */
export class JsonlScanner {
  private buf = '';

  /** True dopo il primo `push` (serve per scartare il BOM una volta sola). */
  private started = false;

  /** Numero di righe complete emesse finora. */
  private lineCount = 0;

  /** Elabora testo e restituisce le righe complete (senza terminatore). */
  push(text: string): string[] {
    let chunk = text;
    if (!this.started) {
      this.started = true;
      if (chunk.startsWith(BOM)) {
        chunk = chunk.slice(BOM.length);
      }
    }
    this.buf += chunk;
    const out: string[] = [];
    for (;;) {
      const idx = this.buf.indexOf('\n');
      if (idx < 0) {
        break;
      }
      const line = this.buf.slice(0, idx).replace(/\r$/, '');
      this.buf = this.buf.slice(idx + 1);
      if (line.trim().length === 0) {
        // Righe vuote: ignorate (non sono dati malformati).
        continue;
      }
      this.lineCount += 1;
      out.push(line);
    }
    if (this.buf.length > MAX_LINE_CHARS) {
      throw new AdapterError('TRUNCATED', 'Riga JSONL oltre la soglia di sicurezza', {
        recoverable: true,
        partialEvents: this.lineCount,
      });
    }
    return out;
  }

  /**
   * Fine stream: se resta una riga senza terminatore, il file è troncato
   * (05§4 partial recovery: gli eventi già emessi restano).
   */
  end(): void {
    if (this.buf.trim().length > 0) {
      throw new AdapterError('TRUNCATED', 'JSONL troncato: ultima riga senza terminatore', {
        recoverable: true,
        partialEvents: this.lineCount,
      });
    }
    this.buf = '';
  }

  /** Numero di righe complete emesse finora. */
  get count(): number {
    return this.lineCount;
  }
}

/**
 * Itera le righe di uno stream JSONL senza caricare il file in memoria
 * (05§4). Le righe sono rese come testo: il parsing JSON (e il conteggio
 * delle righe malformate) è responsabilità dell'adapter, che deve poter
 * scartare una riga senza abortire lo stream.
 */
export async function* iterateJsonlLines(
  chunks: AsyncIterable<Uint8Array | string>,
): AsyncGenerator<string> {
  const scanner = new JsonlScanner();
  const decoder = new TextDecoder();
  for await (const chunk of chunks) {
    const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    for (const line of scanner.push(text)) {
      yield line;
    }
  }
  const tail = decoder.decode();
  if (tail.length > 0) {
    for (const line of scanner.push(tail)) {
      yield line;
    }
  }
  scanner.end();
}
