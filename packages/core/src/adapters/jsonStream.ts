import { AdapterError } from './errors';

/**
 * Parser incrementale di array JSON (e del wrapper fixture `{ "events": [...] }`).
 *
 * I file GDPR di Spotify sono array di oggetti piatti anche da 155MB+
 * (03-ADAPTERS/spotify.md §10): non devono mai stare interi in memoria.
 * Questo scanner riceve chunk di testo, estrae gli elementi completi man
 * mano e trattiene solo il frammento non ancora chiuso (bounded memory).
 *
 * Formati accettati:
 * - `[ {...}, {...} ]` — array top-level (produzione, export GDPR)
 * - `{ ..., "events": [...] }` — wrapper dei fixture di test
 *   (`fixtures/synthetic-history/*.json`): gli altri campi vengono scartati.
 */

/** Dimensione massima di un singolo elemento (un evento GDPR è ~500B). */
const MAX_ELEMENT_CHARS = 1_000_000;

type ScanState = 'root' | 'objectRoot' | 'array' | 'done';

/**
 * Scanner a push: `push(text)` restituisce gli elementi completati dal testo
 * ricevuto finora; `end()` segnala la fine dello stream e verifica che lo
 * stato sia coerente (altrimenti `AdapterError` `TRUNCATED`, recoverable).
 */
export class JsonArrayScanner {
  private buf = '';
  private pos = 0;
  private state: ScanState = 'root';
  private elementCount = 0;

  /** Elabora testo e restituisce gli elementi completati (non ancora interpretati). */
  push(text: string): unknown[] {
    this.buf += text;
    const out: unknown[] = [];
    let progressed = true;
    while (progressed) {
      progressed = false;
      if (this.state === 'root') {
        progressed = this.startRoot();
      } else if (this.state === 'objectRoot') {
        progressed = this.consumeObjectRootEntry(out);
      } else if (this.state === 'array') {
        progressed = this.consumeArrayElement(out);
      }
    }
    this.compact();
    return out;
  }

  /** Fine stream: se lo stato non è `done` il JSON è troncato (05§4 partial recovery). */
  end(): void {
    if (this.state !== 'done') {
      throw new AdapterError('TRUNCATED', 'JSON troncato prima della fine dell\'array', {
        recoverable: true,
        partialEvents: this.elementCount,
      });
    }
  }

  /** Numero di elementi estratti finora. */
  get count(): number {
    return this.elementCount;
  }

  // -- stati ----------------------------------------------------------------

  /** Determina se il JSON è un array top-level o un oggetto wrapper. */
  private startRoot(): boolean {
    this.skipWhitespace();
    if (this.pos >= this.buf.length) {
      return false;
    }
    const c = this.buf[this.pos];
    if (c === '[') {
      this.pos += 1;
      this.state = 'array';
      return true;
    }
    if (c === '{') {
      this.pos += 1;
      this.state = 'objectRoot';
      return true;
    }
    throw new AdapterError('INVALID_FORMAT', 'JSON non è un array né un oggetto');
  }

  /**
   * Wrapper `{ "events": [...] }`: consuma le coppie chiave/valore top-level;
   * quando incontra la chiave `events` passa allo streaming del suo array,
   * gli altri valori vengono scartati strutturalmente (stringhe consapevoli).
   */
  private consumeObjectRootEntry(out: unknown[]): boolean {
    this.skipWhitespace();
    if (this.pos >= this.buf.length) {
      return false;
    }
    const c = this.buf[this.pos];
    if (c === ',') {
      this.pos += 1;
      return true;
    }
    if (c === '}') {
      this.pos += 1;
      this.state = 'done';
      return true;
    }
    if (c !== '"') {
      throw new AdapterError('INVALID_FORMAT', 'Oggetto wrapper malformato');
    }
    const key = this.readString();
    if (key === null) {
      return false; // stringa non ancora completa
    }
    this.skipWhitespace();
    if (this.peek() !== ':') {
      throw new AdapterError('INVALID_FORMAT', 'Manca ":" dopo la chiave del wrapper');
    }
    this.pos += 1;
    this.skipWhitespace();
    if (key === 'events') {
      if (this.peek() !== '[') {
        throw new AdapterError('INVALID_FORMAT', 'Il campo "events" del wrapper non è un array');
      }
      this.pos += 1;
      this.state = 'array';
      return true;
    }
    return this.skipValue(out, true);
  }

  /** Estrae il prossimo elemento dell'array (o rileva la chiusura). */
  private consumeArrayElement(out: unknown[]): boolean {
    this.skipWhitespace();
    if (this.pos >= this.buf.length) {
      return false;
    }
    const c = this.buf[this.pos];
    if (c === ']') {
      this.pos += 1;
      this.skipWhitespace();
      if (this.peek() === '}') {
        this.pos += 1; // chiusura del wrapper fixture
      }
      this.state = 'done';
      return true;
    }
    if (c === ',') {
      this.pos += 1;
      return true;
    }
    return this.skipValue(out, false);
  }

  // -- primitive ------------------------------------------------------------

  /** Legge una stringa JSON completa; null se il buffer non basta. */
  private readString(): string | null {
    if (this.pos >= this.buf.length || this.buf[this.pos] !== '"') {
      return null;
    }
    let i = this.pos + 1;
    for (;;) {
      if (i >= this.buf.length) {
        return null;
      }
      const c = this.buf[i];
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '"') {
        const raw = this.buf.slice(this.pos, i + 1);
        this.pos = i + 1;
        return JSON.parse(raw) as string;
      }
      i += 1;
    }
  }

  /**
   * Raccoglie il prossimo valore (oggetto, array, stringa o scalare) e, se
   * `discard` è false, lo interpreta e lo appende a `out`. Restituisce false
   * se il buffer non contiene ancora il valore completo.
   */
  private skipValue(out: unknown[], discard: boolean): boolean {
    const start = this.pos;
    const c = this.buf[this.pos];
    if (c === '"') {
      if (this.readString() === null) {
        this.pos = start;
        this.guard(start);
        return false;
      }
    } else if (c === '{' || c === '[') {
      if (!this.skipBracketed()) {
        this.pos = start;
        this.guard(start);
        return false;
      }
    } else {
      // number | true | false | null
      let i = this.pos;
      while (i < this.buf.length && !',]}'.includes(this.buf[i] ?? '') && this.buf[i] !== ' ') {
        i += 1;
      }
      if (i >= this.buf.length) {
        this.pos = start;
        return false; // lo scalare potrebbe continuare nel prossimo chunk
      }
      this.pos = i;
    }
    if (!discard) {
      const raw = this.buf.slice(start, this.pos).trim();
      if (raw.length === 0) {
        throw new AdapterError('INVALID_FORMAT', 'Elemento vuoto nell\'array');
      }
      try {
        out.push(JSON.parse(raw) as unknown);
        this.elementCount += 1;
      } catch {
        throw new AdapterError('TRUNCATED', 'Elemento JSON non valido a metà stream', {
          recoverable: true,
          partialEvents: this.elementCount,
        });
      }
    }
    return true;
  }

  /** Salta un valore `{...}` o `[...]` bilanciando parentesi e stringhe. */
  private skipBracketed(): boolean {
    const open = this.buf[this.pos];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let i = this.pos;
    for (;;) {
      if (i >= this.buf.length) {
        return false;
      }
      const c = this.buf[i];
      if (c === '"') {
        const saved = this.pos;
        this.pos = i;
        const done = this.readString();
        if (done === null) {
          this.pos = saved;
          return false;
        }
        i = this.pos;
        continue;
      }
      if (c === open) {
        depth += 1;
      } else if (c === close) {
        depth -= 1;
        if (depth === 0) {
          this.pos = i + 1;
          return true;
        }
      }
      i += 1;
    }
  }

  private skipWhitespace(): void {
    while (this.pos < this.buf.length && /\s/.test(this.buf[this.pos] ?? '')) {
      this.pos += 1;
    }
  }

  private peek(): string | undefined {
    return this.buf[this.pos];
  }

  /** Elemento eccede la soglia: lo stream è corrotto, non un evento GDPR. */
  private guard(start: number): void {
    if (this.buf.length - start > MAX_ELEMENT_CHARS) {
      throw new AdapterError('TRUNCATED', 'Elemento JSON oltre la soglia di sicurezza', {
        recoverable: true,
        partialEvents: this.elementCount,
      });
    }
  }

  /** Rimuove dal buffer il testo già consumato (bounded memory). */
  private compact(): void {
    if (this.pos > 0) {
      this.buf = this.buf.slice(this.pos);
      this.pos = 0;
    }
  }
}

/** Converte un Blob in chunk di bytes sfruttando lo stream quando disponibile. */
export async function* blobChunks(input: Blob): AsyncGenerator<Uint8Array> {
  if (typeof input.stream === 'function') {
    const stream = input.stream() as ReadableStream<Uint8Array>;
    // Node ≥ 18 espone i web ReadableStream come AsyncIterable; dove non è
    // disponibile si usa il reader manuale.
    if (typeof (stream as unknown as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function') {
      yield* stream as unknown as AsyncIterable<Uint8Array>;
      return;
    }
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        yield value;
      }
    }
    return;
  }
  yield new Uint8Array(await input.arrayBuffer());
}

/**
 * Itera gli elementi di un array JSON (o del wrapper `{ "events": [...] }`)
 * da uno stream di chunk senza caricare il file in memoria (05§4).
 *
 * A fine stream con stato incompleto lancia `AdapterError` `TRUNCATED`
 * (recoverable): il caller conserva gli eventi già emessi (partial recovery).
 */
export async function* iterateJsonArrayElements(
  chunks: AsyncIterable<Uint8Array | string>,
): AsyncGenerator<unknown> {
  const scanner = new JsonArrayScanner();
  const decoder = new TextDecoder();
  for await (const chunk of chunks) {
    const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    for (const element of scanner.push(text)) {
      yield element;
    }
  }
  const tail = decoder.decode();
  if (tail.length > 0) {
    for (const element of scanner.push(tail)) {
      yield element;
    }
  }
  scanner.end();
}
