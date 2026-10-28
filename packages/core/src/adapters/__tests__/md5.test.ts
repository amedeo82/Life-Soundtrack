import { describe, expect, it } from 'vitest';
import { md5Hex } from '../crypto';

/**
 * Vettori di test MD5 (RFC 1321 §"Test suite" + il caso "a" in copertura).
 *
 * Il contratto md5 è **sintattico**: serve solo per la firma `api_sig` di
 * Last.fm (`03-ADAPTERS/lastfm.md` §10, D-SH.11). md5 non è una funzione di
 * sicurezza: non va usato per derivare chiavi di dedup.
 */
describe('md5Hex — vettori RFC 1321 (D-SH.11)', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    [
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      'd174ab98d277d9f5a5611c2c9f419d9f',
    ],
    [
      '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
      '57edf4a22be3c955ac49da2e2107b67a',
    ],
  ];

  for (const [input, expected] of cases) {
    it(`md5(${JSON.stringify(input.slice(0, 24))}…) = ${expected}`, () => {
      expect(md5Hex(input)).toBe(expected);
    });
  }

  it('hasha un input più lungo di un blocco (padding multi-blocco)', () => {
    expect(md5Hex('x'.repeat(1000))).toHaveLength(32);
    expect(md5Hex('x'.repeat(1000))).toBe(md5Hex('x'.repeat(1000)));
    expect(md5Hex('x'.repeat(1000))).not.toBe(md5Hex('x'.repeat(999)));
  });

  it('è deterministico e distintivo su input diversi', () => {
    expect(md5Hex('artist[0]track[0]timestamp[0]secret')).toBe(
      md5Hex('artist[0]track[0]timestamp[0]secret'),
    );
    expect(md5Hex('a')).not.toBe(md5Hex('b'));
  });

  it('gestisce i caratteri non-ASCII (UTF-8)', () => {
    expect(md5Hex('Björk')).toHaveLength(32);
    expect(md5Hex('Björk')).toBe(md5Hex('Björk'));
    expect(md5Hex('Björk')).not.toBe(md5Hex('Bjork'));
  });
});
