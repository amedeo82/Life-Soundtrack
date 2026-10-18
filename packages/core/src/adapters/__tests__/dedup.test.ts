import { describe, expect, it } from 'vitest';
import { canonicalKey, durationBucketMs, normalizeName } from '../dedup';

/** Regole DEDUP — 02-DATA-SCHEMA.md §5 (vincolante). */
describe('normalizeName (02§5)', () => {
  it('normalizza lowercase, punteggiatura e spazi', () => {
    expect(normalizeName('  Bohemian   Rhapsody ')).toBe('bohemian rhapsody');
    expect(normalizeName("Don't Stop Me Now!")).toBe('don t stop me now');
  });

  it('rimuove feat./ft./with', () => {
    expect(normalizeName('Track (feat. Someone)')).toBe('track');
    expect(normalizeName('Track ft. Someone')).toBe('track');
    expect(normalizeName('Track with Someone')).toBe('track');
  });

  it('rimuove i contenuti tra parentesi tonde e quadre', () => {
    expect(normalizeName('Song (Remaster 2011)')).toBe('song');
    expect(normalizeName('Song [Live at Wembley]')).toBe('song');
  });

  it('è deterministica su varianti equivalenti', () => {
    expect(normalizeName('Track feat. X')).toBe(normalizeName('track (with x)'));
  });

  it('normalizza "Queen & David Bowie" in modo stabile', () => {
    expect(normalizeName('Queen & David Bowie')).toBe('queen david bowie');
  });
});

describe('durationBucketMs (02§5)', () => {
  it('raggruppa per bucket da 2 secondi', () => {
    expect(durationBucketMs(245_000)).toBe(244_000);
    expect(durationBucketMs(245_999)).toBe(244_000);
    expect(durationBucketMs(354_000)).toBe(354_000);
    expect(durationBucketMs(0)).toBe(0);
  });

  it('assorbe il rounding ±1-2s tra piattaforme (tradeoff §5)', () => {
    expect(durationBucketMs(200_000)).toBe(durationBucketMs(201_999));
    expect(durationBucketMs(200_000)).not.toBe(durationBucketMs(203_999));
  });
});

describe('canonicalKey (02§5: DEDUP-1/2/3)', () => {
  it('DEDUP-1: ISRC vince su tutto e viene upperizzato', async () => {
    expect(await canonicalKey({ name: 'A', artistPrincipal: 'B', durationMs: 1000, isrc: 'gb-abc-12-3' })).toBe(
      'isrc:GB-ABC-12-3',
    );
  });

  it('DEDUP-2: MBID vince solo senza ISRC', async () => {
    expect(await canonicalKey({ name: 'A', artistPrincipal: 'B', durationMs: 1000, mbid: 'xyz' })).toBe('mbid:xyz');
    expect(
      await canonicalKey({ name: 'A', artistPrincipal: 'B', durationMs: 1000, isrc: 'i', mbid: 'xyz' }),
    ).toBe('isrc:I');
  });

  it('DEDUP-3: stesso nome+artista+bucket ⇒ stessa chiave fuzzy', async () => {
    const a = await canonicalKey({ name: 'Bohemian Rhapsody', artistPrincipal: 'Queen', durationMs: 354_000 });
    const b = await canonicalKey({ name: 'bohemian rhapsody', artistPrincipal: 'queen', durationMs: 354_002 });
    expect(a).toBe(b);
    expect(a.startsWith('fuzzy:')).toBe(true);
  });

  it('DEDUP-3: bucket diverso ⇒ chiavi diverse (fixture E4)', async () => {
    const opera = await canonicalKey({ name: 'Bohemian Rhapsody', artistPrincipal: 'Queen', durationMs: 245_000 });
    const greatestHits = await canonicalKey({
      name: 'Bohemian Rhapsody',
      artistPrincipal: 'Queen',
      durationMs: 354_000,
    });
    const live = await canonicalKey({ name: 'Bohemian Rhapsody', artistPrincipal: 'Queen', durationMs: 412_000 });
    expect(new Set([opera, greatestHits, live]).size).toBe(3);
  });

  it('DEDUP-3: artista diverso ⇒ chiavi diverse', async () => {
    const a = await canonicalKey({ name: 'Song', artistPrincipal: 'A', durationMs: 1000 });
    const b = await canonicalKey({ name: 'Song', artistPrincipal: 'B', durationMs: 1000 });
    expect(a).not.toBe(b);
  });

  it('durata null ⇒ bucket 0 (piattaforme senza durata)', async () => {
    expect(await canonicalKey({ name: 'X', artistPrincipal: 'Y', durationMs: null })).toBe(
      await canonicalKey({ name: 'X', artistPrincipal: 'Y', durationMs: 0 }),
    );
  });
});
