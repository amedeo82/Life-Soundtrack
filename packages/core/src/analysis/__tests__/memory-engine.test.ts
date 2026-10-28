import { describe, expect, it } from 'vitest';
import { makeArtist, makeListen, makeTrack } from '../../db/__tests__/helpers';
import type { Artist, ListenEvent, Track } from '../../schema';
import {
  computeMemoryDerivedVersion,
  computeMemoryScore,
  DAY_MS,
  DEFAULT_MEMORY_CONFIG,
  MemoryEngine,
  medianOf,
  MEMORY_BASE_SCORES,
  resolveMemoryConfig,
  type GeneratedMemory,
} from '../memory';
import { AnalysisPipeline, createMemoryGenerator } from '../pipeline';
import { createLocaleTranslator, memoryPayloadOf } from './helpers';

/**
 * Test del memory engine — `04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 §7
 * (Story 2.4): i cinque tipi di ricordo, il ranking (04§7.4) e la
 * `derivedVersion` (04§9).
 */

/** 2024-03-15T12:00:00Z — il "oggi" dei test. */
const TODAY = Date.UTC(2024, 2, 15, 12, 0, 0);

const at = (year: number, month: number, day: number, hour = 10): number =>
  Date.UTC(year, month - 1, day, hour, 0, 0);

/** Ascolto con `startedAt` e `timestamp` coerenti. */
function listen(trackId: string, startedAt: number, durationMs = 240_000): ListenEvent {
  return makeListen({
    trackId,
    startedAt,
    timestamp: startedAt + durationMs,
    durationMs,
    day: new Date(startedAt).toISOString().slice(0, 10),
  });
}

function engineFor(
  translator: ReturnType<typeof createLocaleTranslator>,
  options: { config?: Parameters<typeof resolveMemoryConfig>[0]; today?: number } = {},
): MemoryEngine {
  return new MemoryEngine({
    translator,
    ...(options.config ? { config: options.config } : {}),
    today: options.today ?? TODAY,
    locale: 'it',
  });
}

const payload = (memory: GeneratedMemory) => memoryPayloadOf(memory.insight);

describe('on_this_day (04§7.2)', () => {
  it('genera il ricordo quando un ascolto cade nella stessa data di N anni fa', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-otd', name: 'Aurora Boreale' });
    const track = makeTrack({ id: 't-otd', artistId: 'a-otd', name: 'Notte Bianca' });
    const listens = [listen('t-otd', at(2021, 3, 15, 20)), listen('t-otd', at(2021, 3, 15, 21))];

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    const memory = memories.find((item) => item.memoryKind === 'on_this_day');
    expect(memory).toBeDefined();
    expect(payload(memory!)).toMatchObject({
      kind: 'memory',
      memoryKind: 'on_this_day',
      trackId: 't-otd',
      artistId: 'a-otd',
      yearsAgo: 3,
    });
    expect(payload(memory!).text).toBe('3 anni fa ascoltavi "Notte Bianca" di Aurora Boreale');
  });

  it('non genera nulla se nessun ascolto cade nella data', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-otd', name: 'Aurora Boreale' });
    const track = makeTrack({ id: 't-otd', artistId: 'a-otd', name: 'Notte Bianca' });

    const memories = await engineFor(translator).generate({
      listens: [listen('t-otd', at(2021, 3, 14, 20))],
      tracks: [track],
      artists: [artist],
    });

    expect(memories.filter((item) => item.memoryKind === 'on_this_day')).toHaveLength(0);
  });
});

describe('first_time (04§7.2, D-A.3)', () => {
  it('richiede 5 brani distinti, non 5 ascolti', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-ft', name: 'Nova' });
    // Un solo brano, ascoltato 6 volte: non è "significativo" (D-A.3).
    const track = makeTrack({ id: 't-ft', artistId: 'a-ft', name: 'Unico' });
    const listens = Array.from({ length: 6 }, (_unused, index) =>
      listen('t-ft', at(2021, 3, 15, 8 + index)),
    );

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    expect(memories.filter((item) => item.memoryKind === 'first_time')).toHaveLength(0);
  });

  it('genera il ricordo con 5 brani distinti dell’artista', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-ft', name: 'Nova' });
    const tracks: Track[] = Array.from({ length: 5 }, (_unused, index) =>
      makeTrack({ id: `t-ft-${index}`, artistId: 'a-ft', name: `Brano ${index}` }),
    );
    const listens: ListenEvent[] = [
      listen('t-ft-0', at(2021, 3, 15, 8)),
      ...tracks.slice(1).map((track, index) => listen(track.id, at(2023, 6, 1 + index, 9))),
    ];

    const memories = await engineFor(translator).generate({
      listens,
      tracks,
      artists: [artist],
    });

    const memory = memories.find((item) => item.memoryKind === 'first_time');
    expect(memory).toBeDefined();
    expect(payload(memory!)).toMatchObject({
      memoryKind: 'first_time',
      artistId: 'a-ft',
      yearsAgo: 3,
      trackId: null,
    });
    expect(payload(memory!).text).toBe('3 anni fa scoprivi Nova');
  });
});

describe('return (04§7.2, D-A.2)', () => {
  it('usa l’ultimo ascolto precedente e il testo {months}', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-ret', name: 'Eco' });
    const track = makeTrack({ id: 't-ret', artistId: artist.id, name: 'Silenzio' });
    // Ultimo ascolto 200 giorni prima dell'inizio di oggi.
    const lastSeen = Date.UTC(2024, 2, 15) - 200 * DAY_MS;
    const listens = [listen('t-ret', lastSeen), listen('t-ret', at(2024, 3, 15, 9))];

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    const memory = memories.find((item) => item.memoryKind === 'return');
    expect(memory).toBeDefined();
    expect(payload(memory!)).toMatchObject({
      memoryKind: 'return',
      artistId: 'a-ret',
      trackId: 't-ret',
      yearsAgo: null,
    });
    // 200 giorni di silenzio → floor(200/30) = 6 mesi.
    expect(payload(memory!).text).toBe('Non ascoltavi Eco da 6 mesi');
  });

  it('non genera il ricordo sotto la soglia di 180 giorni', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-ret', name: 'Eco' });
    const track = makeTrack({ id: 't-ret', artistId: 'a-ret', name: 'Silenzio' });
    const dayStart = Date.UTC(2024, 2, 15);
    const listens = [listen('t-ret', dayStart - 179 * DAY_MS), listen('t-ret', at(2024, 3, 15, 9))];

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    expect(memories.filter((item) => item.memoryKind === 'return')).toHaveLength(0);
  });
});

describe('seasonal (04§7.2, D-A.2)', () => {
  it('è per genere e usa la concentrazione sugli ultimi 12 mesi', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-se', name: 'Genere' });
    const track = makeTrack({
      id: 't-se',
      artistId: 'a-se',
      name: 'Estate',
      genres: ['rock'],
    });
    const listens: ListenEvent[] = [
      // 8 ascolti in marzo 2024 (il mese corrente)
      ...Array.from({ length: 8 }, (_unused, index) => listen('t-se', at(2024, 3, 1 + index, 9))),
      // 2 ascolti in aprile 2023 (nella finestra, ma non nel mese)
      ...Array.from({ length: 2 }, (_unused, index) => listen('t-se', at(2023, 4, 1 + index, 9))),
    ];

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    const memory = memories.find((item) => item.memoryKind === 'seasonal');
    expect(memory).toBeDefined();
    expect(payload(memory!)).toMatchObject({
      memoryKind: 'seasonal',
      trackId: null,
      artistId: null,
      yearsAgo: null,
    });
    expect(payload(memory!).text).toBe('Come ogni marzo, è tornato il periodo rock');
  });

  it('non genera il ricordo sotto seasonalMinEvents', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-se', name: 'Genere' });
    const track = makeTrack({ id: 't-se', artistId: 'a-se', name: 'Estate', genres: ['rock'] });
    const listens = [listen('t-se', at(2024, 3, 1, 9)), listen('t-se', at(2024, 3, 2, 9))];

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    expect(memories.filter((item) => item.memoryKind === 'seasonal')).toHaveLength(0);
  });
});

describe('milestone (04§7.2)', () => {
  it('scatta sul totale esatto di ascolti e di ore', async () => {
    const translator = createLocaleTranslator('it');
    const artists: Artist[] = [];
    const tracks: Track[] = [];
    const listens: ListenEvent[] = [];
    for (let index = 0; index < 10; index += 1) {
      const artist = makeArtist({ id: `a-ms-${index}`, name: `Artista ${index}` });
      const track = makeTrack({ id: `t-ms-${index}`, artistId: artist.id, name: `Brano ${index}` });
      artists.push(artist);
      tracks.push(track);
      for (let repeat = 0; repeat < 100; repeat += 1) {
        // 1000 ascolti da 360 s = 100 ore esatte.
        listens.push(listen(track.id, at(2023, 4, 1, 9) + repeat * 60_000, 360_000));
      }
    }

    const memories = await engineFor(translator).generate({
      listens,
      tracks,
      artists,
    });

    const milestones = memories.filter((item) => item.memoryKind === 'milestone');
    const texts = milestones.map((item) => payload(item).text);
    expect(texts).toContain('Hai raggiunto 1000 brani ascoltati!');
    expect(texts).toContain('Hai raggiunto 100 ore di ascolto!');
  });

  it('non scatta quando il totale non coincide con la soglia', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-ms', name: 'Artista' });
    const track = makeTrack({ id: 't-ms', artistId: artist.id, name: 'Brano' });
    const listens = Array.from({ length: 999 }, (_unused, index) =>
      listen('t-ms', at(2023, 4, 1, 9) + index * 60_000, 360_000),
    );

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    expect(memories.filter((item) => item.memoryKind === 'milestone')).toHaveLength(0);
  });
});

describe('ranking dei ricordi (04§7.4)', () => {
  it('ordina il feed per score decrescente', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-rank', name: 'Ordine' });
    const track = makeTrack({ id: 't-rank', artistId: artist.id, name: 'Brano' });
    const listens = [
      listen('t-rank', at(2021, 3, 15, 20)),
      listen('t-rank', at(2021, 3, 15, 21)),
      listen('t-rank', Date.UTC(2024, 2, 15) - 200 * DAY_MS),
      listen('t-rank', at(2024, 3, 15, 9)),
    ];

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    expect(memories.length).toBeGreaterThan(1);
    const scores = memories.map((item) => item.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('applica score = baseScore × relevance × recency', async () => {
    const translator = createLocaleTranslator('it');
    const artist = makeArtist({ id: 'a-rank', name: 'Ordine' });
    const track = makeTrack({ id: 't-rank', artistId: artist.id, name: 'Brano' });
    const listens = [listen('t-rank', at(2021, 3, 15, 20))];

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    const memory = memories.find((item) => item.memoryKind === 'on_this_day');
    expect(memory).toBeDefined();
    const median = medianOf([1]);
    expect(memory!.score).toBeCloseTo(computeMemoryScore('on_this_day', 1, median, 3 * 365), 10);
    expect(MEMORY_BASE_SCORES.on_this_day).toBe(10);
  });
});

describe('derivedVersion (04§1.1, §9)', () => {
  it('è stabile a parità di parametri e cambia al cambio di un parametro', async () => {
    const translator = createLocaleTranslator('it');
    const first = await engineFor(translator).derivedVersion();
    const second = await engineFor(translator).derivedVersion();
    const changed = await engineFor(translator, {
      config: { returnMinGapDays: 200 },
    }).derivedVersion();

    expect(first).toMatch(/^[0-9a-f]{8}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it('è calcolata dall’hash dei parametri', async () => {
    const config = resolveMemoryConfig();
    expect(await computeMemoryDerivedVersion(config)).toMatch(/^[0-9a-f]{8}$/);
    expect(await computeMemoryDerivedVersion({ ...config, seasonalMinEvents: 9 })).not.toBe(
      await computeMemoryDerivedVersion(config),
    );
    expect(DEFAULT_MEMORY_CONFIG.returnMinGapDays).toBe(180);
  });
});

describe('testo del ricordo (04§7.3.1, D-A.4)', () => {
  it('è reso dal resolver i18n e non contiene stringhe inline', async () => {
    const translator = createLocaleTranslator('en');
    const artist = makeArtist({ id: 'a-txt', name: 'Aurora' });
    const track = makeTrack({ id: 't-txt', artistId: artist.id, name: 'Notte' });
    const listens = [listen('t-txt', at(2021, 3, 15, 20))];

    const memories = await engineFor(translator).generate({
      listens,
      tracks: [track],
      artists: [artist],
    });

    expect(translator.calls.length).toBeGreaterThan(0);
    for (const call of translator.calls) {
      expect(call.key.startsWith('insight.memory.')).toBe(true);
    }
    for (const memory of memories) {
      expect(payload(memory).text.length).toBeGreaterThan(0);
    }
    expect(payload(memories[0]!).text).toBe('3 years ago you were listening to "Notte" by Aurora');
  });

  it('fallisce quando il template manca, invece di produrre un testo vuoto', async () => {
    const engine = new MemoryEngine({
      translator: { translate: () => '' },
      today: TODAY,
      locale: 'it',
    });
    const artist = makeArtist({ id: 'a-txt', name: 'Aurora' });
    const track = makeTrack({ id: 't-txt', artistId: artist.id, name: 'Notte' });

    await expect(
      engine.generate({
        listens: [listen('t-txt', at(2021, 3, 15, 20))],
        tracks: [track],
        artists: [artist],
      }),
    ).rejects.toThrow(/insight\.memory\./);
  });
});

describe('orchestratore (04§8.1)', () => {
  it('chiama solo i generatori implementati nella tranche', async () => {
    const translator = createLocaleTranslator('it');
    const pipeline = new AnalysisPipeline([createMemoryGenerator({ translator })]);
    expect(pipeline.names).toEqual(['memory']);

    const artist = makeArtist({ id: 'a-pipe', name: 'Pipeline' });
    const track = makeTrack({ id: 't-pipe', artistId: artist.id, name: 'Brano' });
    const insights = await pipeline.run({
      listens: [listen('t-pipe', at(2021, 3, 15, 20))],
      tracks: [track],
      artists: [artist],
      today: TODAY,
      locale: 'it',
    });

    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.type).toBe('memory');
      expect(insight.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
      expect(insight.status).toBe('pending');
    }
  });

  it('una pipeline senza generatori non produce insight', async () => {
    const insights = await new AnalysisPipeline().run({
      listens: [],
      tracks: [],
      artists: [],
      today: TODAY,
      locale: 'it',
    });
    expect(insights).toEqual([]);
  });
});
