import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createEssentiaEngineFactory, createEssentiaProvider } from '../essentia';
import type { EssentiaAnalysis, EssentiaEngine } from '../essentia';
import type { ItunesPreviewResolver } from '../itunes';
import {
  createFakeClock,
  createFakeHttpClient,
  fakeAudioBytes,
  httpResponse,
  makeContext,
  makeTrack,
} from './helpers';

/**
 * Il provider Essentia — `21-AUDIO-FEATURES.md` §6 (T-AF.2), §13 (E3, E4).
 *
 * Il motore è **iniettato**: il core non conosce l'API di `essentia.js`
 * (D-AF.5) e il test non carica mai il WASM.
 */

/** Un resolver di preview finto. */
function previewResolver(previewUrl: string | null): ItunesPreviewResolver {
  return {
    resolve: async () => (previewUrl === null ? null : { previewUrl, itunesTrackId: 1 }),
  };
}

/** Un motore finto che restituisce sempre lo stesso risultato. */
function fakeEngine(analysis: EssentiaAnalysis): EssentiaEngine {
  return { analyze: async () => analysis };
}

/** Una risposta con i byte del preview. */
function previewResponse(): ReturnType<typeof httpResponse> {
  return httpResponse(200, '', {}, fakeAudioBytes());
}

describe("il ramo Essentia è condizionato dall'audio (21§2.1, §5.1)", () => {
  it('senza preview il ramo salta e non viene scritta alcuna feature', async () => {
    const clock = createFakeClock();
    const http = createFakeHttpClient(() => previewResponse());
    const provider = createEssentiaProvider({
      http,
      clock,
      previewResolver: previewResolver(null),
      engineFactory: { load: async () => fakeEngine({ valence: 5 }) },
    });

    const feature = await provider.fetch(makeTrack({ id: 't1' }), makeContext());

    expect(feature).toBeNull();
    expect(provider.lastSkipReason?.()).toBe('no_preview');
    expect(http.calls).toHaveLength(0);
  });

  it('con preview il ramo analizza e scrive source = essentia (T-AF.2)', async () => {
    const clock = createFakeClock();
    const http = createFakeHttpClient(() => previewResponse());
    const provider = createEssentiaProvider({
      http,
      clock,
      previewResolver: previewResolver('https://audio-ssl.itunes.apple.com/preview.m4a'),
      engineFactory: { load: async () => fakeEngine({ valence: 5, arousal: 5, danceable: 0.7 }) },
    });

    const feature = await provider.fetch(makeTrack({ id: 't1' }), makeContext());

    expect(feature?.source).toBe('essentia');
    expect(feature?.valence).toBe(0.5);
    expect(feature?.energy).toBe(0.5);
    expect(feature?.danceability).toBe(0.7);
    expect(http.calls).toHaveLength(1);
  });
});

describe('la mappatura DEAM (21§6.1, §6.2)', () => {
  it('valence e arousal sono normalizzate da [1,9] a [0,1]', async () => {
    const clock = createFakeClock();
    const http = createFakeHttpClient(() => previewResponse());
    const provider = createEssentiaProvider({
      http,
      clock,
      previewResolver: previewResolver('https://audio-ssl.itunes.apple.com/preview.m4a'),
      engineFactory: {
        load: async () => fakeEngine({ valence: 9, arousal: 1, bpm: 128, key: 7, scale: 'minor' }),
      },
    });

    const feature = await provider.fetch(makeTrack({ id: 't1' }), makeContext());

    expect(feature?.valence).toBe(1);
    expect(feature?.energy).toBe(0);
    expect(feature?.tempo).toBe(128);
    expect(feature?.key).toBe(7);
    expect(feature?.mode).toBe(0);
  });

  it('i campi che Essentia non copre restano null', async () => {
    const clock = createFakeClock();
    const http = createFakeHttpClient(() => previewResponse());
    const provider = createEssentiaProvider({
      http,
      clock,
      previewResolver: previewResolver('https://audio-ssl.itunes.apple.com/preview.m4a'),
      engineFactory: { load: async () => fakeEngine({ valence: 5 }) },
    });

    const feature = await provider.fetch(makeTrack({ id: 't1' }), makeContext());

    expect(feature?.acousticness).toBeNull();
    expect(feature?.instrumentalness).toBeNull();
    expect(feature?.speechiness).toBeNull();
    expect(feature?.liveness).toBeNull();
  });

  it('la scala maggiore vale 1, il minore 0', async () => {
    const clock = createFakeClock();
    const http = createFakeHttpClient(() => previewResponse());
    const provider = createEssentiaProvider({
      http,
      clock,
      previewResolver: previewResolver('https://audio-ssl.itunes.apple.com/preview.m4a'),
      engineFactory: { load: async () => fakeEngine({ scale: 'major' }) },
    });

    const feature = await provider.fetch(makeTrack({ id: 't1' }), makeContext());

    expect(feature?.mode).toBe(1);
  });
});

describe('degradazione (21§6.5, §13 E3/E4)', () => {
  it('un download fallito salta il ramo (E3)', async () => {
    const clock = createFakeClock();
    const http = createFakeHttpClient(() => httpResponse(404, ''));
    const provider = createEssentiaProvider({
      http,
      clock,
      previewResolver: previewResolver('https://audio-ssl.itunes.apple.com/preview.m4a'),
      engineFactory: { load: async () => fakeEngine({ valence: 5 }) },
    });

    const feature = await provider.fetch(makeTrack({ id: 't1' }), makeContext());

    expect(feature).toBeNull();
    expect(provider.lastSkipReason?.()).toBe('download_failed');
  });

  it('un download che solleva un errore salta il ramo (E3)', async () => {
    const clock = createFakeClock();
    const http = createFakeHttpClient(() => {
      throw new Error('offline');
    });
    const provider = createEssentiaProvider({
      http,
      clock,
      previewResolver: previewResolver('https://audio-ssl.itunes.apple.com/preview.m4a'),
      engineFactory: { load: async () => fakeEngine({ valence: 5 }) },
    });

    const feature = await provider.fetch(makeTrack({ id: 't1' }), makeContext());

    expect(feature).toBeNull();
    expect(provider.lastSkipReason?.()).toBe('download_failed');
  });

  it("canHandle è sempre vero: il ramo è condizionato dall'audio, non dal brano", () => {
    const clock = createFakeClock();
    const provider = createEssentiaProvider({
      http: createFakeHttpClient(() => previewResponse()),
      clock,
      previewResolver: previewResolver(null),
      engineFactory: { load: async () => fakeEngine({ valence: 5 }) },
    });

    expect(provider.canHandle(makeTrack({ id: 't1' }))).toBe(true);
  });

  it('un motore non disponibile salta il ramo (E4)', async () => {
    const clock = createFakeClock();
    const http = createFakeHttpClient(() => previewResponse());
    const provider = createEssentiaProvider({
      http,
      clock,
      previewResolver: previewResolver('https://audio-ssl.itunes.apple.com/preview.m4a'),
      engineFactory: {
        load: async () => {
          throw new Error('wasm non caricabile');
        },
      },
    });

    const feature = await provider.fetch(makeTrack({ id: 't1' }), makeContext());

    expect(feature).toBeNull();
    expect(provider.lastSkipReason?.()).toBe('engine_unavailable');
  });
});

describe('il caricamento lazy (21§6.5)', () => {
  it('la factory non carica nulla finché load() non viene chiamata', () => {
    const factory = createEssentiaEngineFactory({
      moduleUrl: 'https://example.invalid/essentia.js',
      modelUrl: 'https://example.invalid/deam-msd-musicnn-2',
    });

    expect(factory).toBeDefined();
    expect(typeof factory.load).toBe('function');
  });

  it('un caricamento fallito non avvelena il memo: il trigger successivo ritenta', async () => {
    const factory = createEssentiaEngineFactory({
      moduleUrl: 'https://example.invalid/essentia.js',
      modelUrl: 'https://example.invalid/deam-msd-musicnn-2',
    });

    // L'import dinamico fallisce (nessuna rete nei test): l'errore
    // propaga al chiamante, che lo traduce in "ramo saltato".
    await expect(factory.load()).rejects.toBeDefined();
    await expect(factory.load()).rejects.toBeDefined();
  });

  it('un modulo valido viene caricato una volta sola e il motore è memoizzato', async () => {
    const moduleUrl = pathToFileURL(
      fileURLToPath(new URL('./fake-essentia-module.ts', import.meta.url)),
    ).href;
    const factory = createEssentiaEngineFactory({
      moduleUrl,
      modelUrl: 'https://example.invalid/deam-msd-musicnn-2',
      sampleRate: 44_100,
    });

    const first = await factory.load();
    const second = await factory.load();

    expect(await first.analyze(new ArrayBuffer(8))).toEqual({
      valence: 5,
      arousal: 5,
      danceable: 0.5,
    });
    expect(second).toBe(first);
  });

  it('un modulo privo di createEssentiaEngine viene rifiutato', async () => {
    const moduleUrl = pathToFileURL(
      fileURLToPath(new URL('./fake-essentia-module-without-factory.ts', import.meta.url)),
    ).href;
    const factory = createEssentiaEngineFactory({
      moduleUrl,
      modelUrl: 'https://example.invalid/deam-msd-musicnn-2',
    });

    await expect(factory.load()).rejects.toThrow(/createEssentiaEngine/);
  });

  it('il modulo WASM non può finire nel bundle iniziale (21§6.5, T4.1.13)', () => {
    const source = readFileSync(fileURLToPath(new URL('../essentia.ts', import.meta.url)), 'utf8');

    // L'import è **dinamico** e con `@vite-ignore`: Vite non lo risolve
    // staticamente, quindi il WASM (~2,7 MB) resta fuori dal bundle.
    expect(source).toContain('import(/* @vite-ignore */');
    // Nessun import statico del modulo: è la condizione che tiene il
    // WASM fuori dal bundle iniziale e dal precache.
    expect(source).not.toMatch(/from\s+['"]essentia\.js['"]/);
    expect(source).not.toMatch(/^\s*import\s+['"]essentia\.js['"]/m);
    expect(source).not.toMatch(/require\(['"]essentia\.js['"]\)/);
  });
});
