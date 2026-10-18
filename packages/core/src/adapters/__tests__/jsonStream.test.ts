import { describe, expect, it } from 'vitest';
import { AdapterError } from '../errors';
import { JsonArrayScanner, blobChunks, iterateJsonArrayElements } from '../jsonStream';

/** Parser incrementale di array JSON (streaming, bounded memory). */
describe('JsonArrayScanner', () => {
  it('estrae gli elementi di un array in un colpo solo', () => {
    const scanner = new JsonArrayScanner();
    expect(scanner.push('[{"a":1},{"a":2},{"a":3}]')).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
    scanner.end();
  });

  it('gestisce chunk da 1 carattere (confine elemento/chunk)', () => {
    const scanner = new JsonArrayScanner();
    const text = '[{"a":"hello, \\"world\\""},{"b":2}]';
    const collected: unknown[] = [];
    for (const ch of text) {
      collected.push(...scanner.push(ch));
    }
    expect(collected).toEqual([{ a: 'hello, "world"' }, { b: 2 }]);
    scanner.end();
  });

  it('stringhe con graffe, virgole ed escape non spezzano gli elementi', () => {
    const elements = [
      { name: 'weird }{ name', note: 'a,b' },
      { name: 'quote " inside', nested: null },
      { unicode: 'pepperoni 🍕', arr: [1, 2, { deep: true }] },
    ];
    const scanner = new JsonArrayScanner();
    const out = scanner.push(JSON.stringify(elements));
    expect(out).toEqual(elements);
    scanner.end();
  });

  it('supporta elementi scalari, stringhe e annidati', () => {
    const scanner = new JsonArrayScanner();
    const out = scanner.push('[1, "due", null, true, [1, {"x":2}], {"y":3}]');
    expect(out).toEqual([1, 'due', null, true, [1, { x: 2 }], { y: 3 }]);
    scanner.end();
  });

  it('accetta il wrapper fixture {"events":[...]} scartando gli altri campi', () => {
    const wrapper = {
      _comment: 'con (parentesi) e "virgolette" e [quadre]',
      _metadata: { version: '1.1', list: ['a', 'b'] },
      events: [{ ts: '2024-01-01', ms_played: 1 }],
    };
    const scanner = new JsonArrayScanner();
    const out = scanner.push(JSON.stringify(wrapper));
    expect(out).toEqual([{ ts: '2024-01-01', ms_played: 1 }]);
    scanner.end();
  });

  it('array vuoto e spazi/andare a capo', () => {
    const scanner = new JsonArrayScanner();
    expect(scanner.push('  [  ]  ')).toEqual([]);
    scanner.end();
  });

  it('truncato a metà elemento ⇒ AdapterError TRUNCATED recoverable', () => {
    const scanner = new JsonArrayScanner();
    const out = scanner.push('[{"a":1},{"b":');
    expect(out).toEqual([{ a: 1 }]);
    let captured: unknown;
    try {
      scanner.end();
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(AdapterError);
    const adapterError = captured as AdapterError;
    expect(adapterError.code).toBe('TRUNCATED');
    expect(adapterError.recoverable).toBe(true);
    expect(adapterError.partialEvents).toBe(1);
  });

  it('elemento oltre la soglia di sicurezza ⇒ TRUNCATED', () => {
    const scanner = new JsonArrayScanner();
    expect(() => scanner.push(`[{"pad":"${'x'.repeat(1_100_000)}"`)).toThrow(AdapterError);
  });

  it('JSON che non è array né oggetto ⇒ INVALID_FORMAT', () => {
    const scanner = new JsonArrayScanner();
    expect(() => scanner.push('"solo una stringa"')).toThrow(AdapterError);
  });
});

describe('iterateJsonArrayElements', () => {
  it('decodifica chunk di bytes in modo streaming', async () => {
    const encoder = new TextEncoder();
    async function* chunks(): AsyncGenerator<Uint8Array | string> {
      yield encoder.encode('[{"a":');
      yield encoder.encode('1},{"a":2}');
      yield ']';
    }
    const out: unknown[] = [];
    for await (const element of iterateJsonArrayElements(chunks())) {
      out.push(element);
    }
    expect(out).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('multi-byte UTF-8 spezzato tra chunk non corrompe il testo', async () => {
    const bytes = new TextEncoder().encode('[{"name":"café 🎵"}]');
    async function* split(): AsyncGenerator<Uint8Array> {
      for (let i = 0; i < bytes.length; i += 1) {
        yield bytes.slice(i, i + 1);
      }
    }
    const out: unknown[] = [];
    for await (const element of iterateJsonArrayElements(split())) {
      out.push(element);
    }
    expect(out).toEqual([{ name: 'café 🎵' }]);
  });

  it('propaga TRUNCATED se lo stream finisce a metà', async () => {
    async function* truncated(): AsyncGenerator<Uint8Array> {
      yield new TextEncoder().encode('[{"a":1},{"b":2},{"c":');
    }
    const seen: unknown[] = [];
    await expect(
      (async () => {
        for await (const element of iterateJsonArrayElements(truncated())) {
          seen.push(element);
        }
      })(),
    ).rejects.toThrow(AdapterError);
    expect(seen).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('blobChunks', () => {
  it('streama il contenuto di un Blob', async () => {
    const blob = new Blob(['[{"x":1}]']);
    const chunks: Uint8Array[] = [];
    for await (const chunk of blobChunks(blob)) {
      chunks.push(chunk);
    }
    const text = chunks.map((c) => new TextDecoder().decode(c)).join('');
    expect(text).toBe('[{"x":1}]');
  });
});
