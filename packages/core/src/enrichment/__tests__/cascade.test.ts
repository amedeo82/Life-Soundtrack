import { describe, expect, it } from 'vitest';
import { buildFeatureIndex } from '../../analysis/mood/features';
import type { AudioFeatures, Track } from '../../schema';
import { createEnrichmentCascade, isEmptyFeature, sameValues } from '../cascade';
import { CURRENT_FEATURE_SCHEMA_VERSION } from '../mapping';
import { createMemoryFeatureStore } from '../storage';
import type { AudioFeatureProvider, EnrichmentPolicy, FeatureStore } from '../types';
import { createFakeClock, makeContext, makeTrack } from './helpers';

/**
 * La cascata — `21-AUDIO-FEATURES.md` §5 (T-AF.1…T-AF.6, T-AF.10, T-AF.11,
 * T-AF.14), §10.4 (toggle), §13 (E6, E10).
 */

/** Una feature vuota ma valida (per i test). */
function feature(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    trackId: 'track-1',
    valence: 0.5,
    energy: 0.4,
    danceability: null,
    acousticness: null,
    instrumentalness: null,
    speechiness: null,
    liveness: null,
    tempo: null,
    key: null,
    mode: null,
    loudness: null,
    timeSignature: null,
    source: 'essentia',
    fetchedAt: 1_000,
    schemaVersion: CURRENT_FEATURE_SCHEMA_VERSION,
    ...overrides,
  };
}

/** Una politica con toggle acceso. */
const enabled: EnrichmentPolicy = { isEnabled: () => true };

/** Un provider finto che registra le chiamate. */
function fakeProvider(
  id: AudioFeatureProvider['id'],
  result: AudioFeatures | null,
  calls: string[],
  canHandle: (track: Track) => boolean = () => true,
): AudioFeatureProvider {
  return {
    id,
    canHandle,
    fetch: async (track: Track) => {
      calls.push(track.id);
      return result === null ? null : { ...result, trackId: track.id, source: id };
    },
  };
}

/** Uno store che conta le letture e le scritture. */
function countingStore(inner: FeatureStore): FeatureStore & { gets: number; puts: number } {
  return {
    gets: 0,
    puts: 0,
    async get(trackId: string) {
      this.gets += 1;
      return inner.get(trackId);
    },
    async put(value: AudioFeatures) {
      this.puts += 1;
      await inner.put(value);
    },
    all: () => inner.all(),
    count: () => inner.count(),
    delete: (trackId: string) => inner.delete(trackId),
  };
}

describe('T-AF.1 — la feature in cache non fa uscite di rete', () => {
  it('la feature in cache è restituita e nessun provider viene chiamato', async () => {
    const store = createMemoryFeatureStore();
    const cached = feature({ valence: 0.77 });
    await store.put(cached);
    const calls: string[] = [];
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        essentia: fakeProvider('essentia', feature(), calls),
        acousticbrainz: fakeProvider('acousticbrainz', feature(), calls),
        heuristic: fakeProvider('heuristic', feature(), calls),
      },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect(outcome.status).toBe('cached');
    expect(outcome.feature?.valence).toBe(0.77);
    expect(calls).toEqual([]);
  });
});

describe('T-AF.2 — preview disponibile: il ramo Essentia vince', () => {
  it('source = essentia e valence ∈ [0,1]', async () => {
    const store = createMemoryFeatureStore();
    const calls: string[] = [];
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        essentia: fakeProvider('essentia', feature({ valence: 0.625 }), calls),
        acousticbrainz: fakeProvider('acousticbrainz', feature(), calls),
        heuristic: fakeProvider('heuristic', feature(), calls),
      },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect(outcome.status).toBe('essentia');
    expect(outcome.feature?.source).toBe('essentia');
    expect(outcome.feature?.valence).toBeGreaterThanOrEqual(0);
    expect(outcome.feature?.valence).toBeLessThanOrEqual(1);
    expect(await store.count()).toBe(1);
  });
});

describe('T-AF.3 — senza preview ma con MBID: vince AcousticBrainz', () => {
  it('Essentia è saltato e AB è chiamato', async () => {
    const store = createMemoryFeatureStore();
    const calls: string[] = [];
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        essentia: fakeProvider('essentia', null, calls, () => false),
        acousticbrainz: fakeProvider('acousticbrainz', feature({ valence: 0.6 }), calls),
        heuristic: fakeProvider('heuristic', feature(), calls),
      },
    });

    const outcome = await cascade.enrich(makeTrack({ mbid: 'mbid-1' }), makeContext());

    expect(outcome.status).toBe('acousticbrainz');
    expect(calls).toEqual(['track-1']);
    expect(await store.count()).toBe(1);
  });
});

describe("T-AF.4 — senza preview e senza MBID: solo l'euristico", () => {
  it('la feature ha source = heuristic', async () => {
    const store = createMemoryFeatureStore();
    const calls: string[] = [];
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        essentia: fakeProvider('essentia', null, calls, () => false),
        acousticbrainz: fakeProvider('acousticbrainz', null, calls, () => false),
        heuristic: fakeProvider(
          'heuristic',
          feature({ valence: null, energy: null, danceability: 0.7, tempo: 120 }),
          calls,
        ),
      },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect(outcome.status).toBe('heuristic');
    expect(outcome.feature?.source).toBe('heuristic');
    expect(calls).toEqual(['track-1']);
  });
});

describe('T-AF.5 — tutti i provider falliscono: nessuna riga scritta', () => {
  it('nessun errore propaga e la tabella resta vuota', async () => {
    const store = createMemoryFeatureStore();
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        essentia: {
          id: 'essentia',
          canHandle: () => true,
          fetch: async () => {
            throw new Error('boom');
          },
        },
        acousticbrainz: fakeProvider('acousticbrainz', null, []),
        heuristic: fakeProvider('heuristic', null, []),
      },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect(outcome.status).toBe('none');
    expect(outcome.feature).toBeNull();
    expect(await store.count()).toBe(0);
  });

  it('una feature priva di valori non viene scritta (21§11.3)', async () => {
    const store = createMemoryFeatureStore();
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        heuristic: fakeProvider(
          'heuristic',
          feature({ valence: null, energy: null, danceability: null, tempo: null }),
          [],
        ),
      },
    });

    await cascade.enrich(makeTrack(), makeContext());

    expect(await store.count()).toBe(0);
    expect(isEmptyFeature(feature({ valence: null, energy: null }))).toBe(true);
  });
});

describe('T-AF.6 — toggle spento: zero uscite, zero scritture, zero letture (21§10.4)', () => {
  it('la cache non è neppure letta', async () => {
    const inner = createMemoryFeatureStore();
    await inner.put(feature({ valence: 0.9 }));
    const store = countingStore(inner);
    const calls: string[] = [];
    const cascade = createEnrichmentCascade({
      store,
      policy: { isEnabled: () => false },
      clock: createFakeClock(),
      providers: {
        essentia: fakeProvider('essentia', feature(), calls),
        acousticbrainz: fakeProvider('acousticbrainz', feature(), calls),
        heuristic: fakeProvider('heuristic', feature(), calls),
      },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect(outcome.status).toBe('disabled');
    expect(outcome.feature).toBeNull();
    expect(store.gets).toBe(0);
    expect(store.puts).toBe(0);
    expect(calls).toEqual([]);
  });
});

describe("T-AF.7 — l'analisi non vede le feature euristiche (21§12, D-AF.4)", () => {
  it('buildFeatureIndex scarta la fonte heuristic', async () => {
    const store = createMemoryFeatureStore();
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        heuristic: fakeProvider(
          'heuristic',
          feature({
            source: 'heuristic',
            valence: null,
            energy: null,
            danceability: 0.8,
            tempo: 120,
          }),
          [],
        ),
      },
    });

    await cascade.enrich(makeTrack(), makeContext());
    const rows = await store.all();
    const index = buildFeatureIndex(rows);

    expect(rows[0]?.source).toBe('heuristic');
    expect(index.has('track-1')).toBe(false);
  });
});

describe('T-AF.10 — schemaVersion vecchia: la feature non viene usata (E10)', () => {
  it('la feature viene ricalcolata e sovrascrive la vecchia', async () => {
    const store = createMemoryFeatureStore();
    await store.put(feature({ valence: 0.1, schemaVersion: CURRENT_FEATURE_SCHEMA_VERSION - 1 }));
    const calls: string[] = [];
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        essentia: fakeProvider('essentia', feature({ valence: 0.8 }), calls),
      },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect(outcome.status).toBe('essentia');
    expect(calls).toEqual(['track-1']);
    expect((await store.get('track-1'))?.valence).toBe(0.8);
    expect(await store.count()).toBe(1);
  });
});

describe('T-AF.11 — source manual: la cascata non lo sovrascrive (21§9, E6)', () => {
  it('la feature manuale resta al suo posto', async () => {
    const store = createMemoryFeatureStore();
    await store.put(feature({ source: 'manual', valence: 0.33 }));
    const calls: string[] = [];
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        essentia: fakeProvider('essentia', feature({ valence: 0.8 }), calls),
        heuristic: fakeProvider('heuristic', feature(), calls),
      },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect(outcome.status).toBe('manual');
    expect(calls).toEqual([]);
    expect((await store.get('track-1'))?.source).toBe('manual');
    expect((await store.get('track-1'))?.valence).toBe(0.33);
  });
});

describe('T-AF.12 — un valore fuori [0,1] viene clampato prima della scrittura', () => {
  it("la feature scritta rispetta l'invariante", async () => {
    const store = createMemoryFeatureStore();
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        essentia: fakeProvider('essentia', feature({ valence: 1.7, energy: -0.4 }), []),
      },
    });

    await cascade.enrich(makeTrack(), makeContext());
    const stored = await store.get('track-1');

    expect(stored?.valence).toBe(1);
    expect(stored?.energy).toBe(0);
  });
});

describe('T-AF.14 — idempotenza (21§11.3)', () => {
  it('due esecuzioni producono la stessa tabella', async () => {
    const store = createMemoryFeatureStore();
    const calls: string[] = [];
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        heuristic: fakeProvider(
          'heuristic',
          feature({
            source: 'heuristic',
            valence: null,
            energy: null,
            danceability: 0.7,
            tempo: 120,
          }),
          calls,
        ),
      },
    });

    const first = await cascade.enrich(makeTrack(), makeContext());
    const rowsAfterFirst = await store.all();
    const second = await cascade.enrich(makeTrack(), makeContext());
    const rowsAfterSecond = await store.all();

    expect(first.feature).not.toBeNull();
    expect(second.feature).not.toBeNull();
    expect(sameValues(rowsAfterFirst[0]!, rowsAfterSecond[0]!)).toBe(true);
    expect(rowsAfterFirst).toEqual(rowsAfterSecond);
    expect(await store.count()).toBe(1);
  });
});

describe('i rami saltati (21§5.1)', () => {
  it('senza preview e senza MBID il ramo Essentia salta: lo stato è no_audio', async () => {
    const store = createMemoryFeatureStore();
    const essentia = {
      id: 'essentia' as const,
      canHandle: () => true,
      lastSkipReason: () => 'no_preview',
      fetch: async () => null,
    };
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: { essentia },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect(outcome.status).toBe('no_audio');
    expect(outcome.reason).toBe('no_preview');
    expect(await store.count()).toBe(0);
  });

  it('una feature euristica in cache resta la risposta se il ramo euristico non produce nulla', async () => {
    const store = createMemoryFeatureStore();
    await store.put(
      feature({
        source: 'heuristic',
        valence: null,
        energy: null,
        danceability: 0.6,
        tempo: 120,
      }),
    );
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: { heuristic: fakeProvider('heuristic', null, []) },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect(outcome.status).toBe('cached');
    expect(outcome.feature?.source).toBe('heuristic');
  });

  it("l'euristico non degrada una feature misurata già in tabella", async () => {
    const store = createMemoryFeatureStore();
    // La riga AB è **scaduta** (TTL 90 giorni): la cascata la ricalcola,
    // ma la stima non la sovrascrive — la riga vecchia resta e viene
    // ricalcolata al trigger successivo (`21§11.3`).
    await store.put(
      feature({
        source: 'acousticbrainz',
        valence: 0.4,
        energy: 0.3,
        fetchedAt: 0,
      }),
    );
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(200 * 24 * 60 * 60 * 1000),
      providers: {
        heuristic: fakeProvider(
          'heuristic',
          feature({
            source: 'heuristic',
            valence: null,
            energy: null,
            danceability: 0.9,
            tempo: 100,
          }),
          [],
        ),
      },
    });

    const outcome = await cascade.enrich(makeTrack(), makeContext());

    expect((await store.get('track-1'))?.source).toBe('acousticbrainz');
    expect((await store.get('track-1'))?.valence).toBe(0.4);
    expect(outcome.status).toBe('none');
  });
});

describe('la cascata in sequenza (21§5.2)', () => {
  it('enrichMany processa i brani in ordine', async () => {
    const store = createMemoryFeatureStore();
    const cascade = createEnrichmentCascade({
      store,
      policy: enabled,
      clock: createFakeClock(),
      providers: {
        heuristic: fakeProvider(
          'heuristic',
          feature({
            source: 'heuristic',
            valence: null,
            energy: null,
            danceability: 0.5,
            tempo: 100,
          }),
          [],
        ),
      },
    });

    const outcomes = await cascade.enrichMany([
      { track: makeTrack({ id: 'a' }), context: makeContext() },
      { track: makeTrack({ id: 'b' }), context: makeContext() },
    ]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['heuristic', 'heuristic']);
    expect(await store.count()).toBe(2);
  });
});
