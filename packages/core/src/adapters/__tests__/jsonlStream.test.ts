import { describe, expect, it } from 'vitest';
import { AdapterError } from '../errors';
import { JsonlScanner, iterateJsonlLines } from '../jsonlStream';

/**
 * Scanner JSONL dedicato (`03-ADAPTERS/listenbrainz.md` §10): memoria
 * limitata a una riga, righe malformate tollerate, `end()` coerente.
 */
describe('JsonlScanner', () => {
  it('emette solo le righe complete e trattiene il frammento finale', () => {
    const scanner = new JsonlScanner();
    expect(scanner.push('{"a":1}\n{"b":2}\n{"c"')).toEqual(['{"a":1}', '{"b":2}']);
    expect(scanner.count).toBe(2);
    expect(scanner.push(':3}\n')).toEqual(['{"c":3}']);
    expect(scanner.count).toBe(3);
  });

  it('ignora le righe vuote e i terminatori CRLF', () => {
    const scanner = new JsonlScanner();
    expect(scanner.push('\n{"a":1}\r\n\n')).toEqual(['{"a":1}']);
  });

  it('scarta il BOM sul primo chunk', () => {
    const scanner = new JsonlScanner();
    expect(scanner.push('\uFEFF{"a":1}\n')).toEqual(['{"a":1}']);
  });

  it('end() senza righe residue non solleva', () => {
    const scanner = new JsonlScanner();
    scanner.push('{"a":1}\n');
    expect(() => scanner.end()).not.toThrow();
  });

  it('end() con riga senza terminatore lancia TRUNCATED recuperabile (§10)', () => {
    const scanner = new JsonlScanner();
    scanner.push('{"a":1}\n{"b":2}');
    let error: unknown;
    try {
      scanner.end();
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe('TRUNCATED');
    expect((error as AdapterError).recoverable).toBe(true);
    expect((error as AdapterError).partialEvents).toBe(1);
  });
});

describe('iterateJsonlLines', () => {
  /** Stream asincrono di chunk di testo. */
  async function* stream(chunks: string[]): AsyncGenerator<string> {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  it('itera le righe di uno stream a chunk', async () => {
    const lines: string[] = [];
    for await (const line of iterateJsonlLines(stream(['{"a":1}\n{"b', '":2}\n']))) {
      lines.push(line);
    }
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('propaga TRUNCATED a fine stream', async () => {
    await expect(async () => {
      for await (const _line of iterateJsonlLines(stream(['{"a":1}']))) {
        void _line;
      }
    }).rejects.toThrow(AdapterError);
  });
});
