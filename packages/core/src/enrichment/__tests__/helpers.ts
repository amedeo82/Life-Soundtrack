import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Track } from '../../schema';
import type {
  Clock,
  FeatureContext,
  HttpClient,
  HttpRequestInit,
  HttpResponse,
  Sleep,
} from '../types';

/**
 * Helper dei test della pipeline delle audio features.
 *
 * Non è un file di test: non include asserzioni né si registra a hook.
 *
 * I test **non toccano mai la rete** (`10§8`): il client HTTP, l'orologio
 * e l'attesa sono iniettati e deterministici, e le risposte delle API
 * esterne arrivano dai fixture in `fixtures/api-mocks/`.
 */

/** Un orologio controllabile. */
export interface FakeClock extends Clock {
  /** Avanza l'orologio di `ms` millisecondi. */
  advance(ms: number): void;
  /** Fissa l'orologio a un istante preciso. */
  set(ms: number): void;
}

/**
 * Crea un orologio controllabile.
 *
 * @param start - l'istante iniziale (unix ms).
 * @returns l'orologio.
 */
export function createFakeClock(start = 1_700_000_000_000): FakeClock {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    set: (ms: number) => {
      now = ms;
    },
  };
}

/** Un'attesa che avanza l'orologio invece di aspettare davvero. */
export interface FakeSleep {
  /** La funzione di attesa da iniettare. */
  readonly sleep: Sleep;
  /** I millisecondi attesi, in ordine. */
  readonly waits: number[];
}

/**
 * Crea un'attesa che avanza l'orologio fittizio.
 *
 * @param clock - l'orologio da avanzare.
 * @returns l'attesa e il registro delle attese.
 */
export function createFakeSleep(clock: FakeClock): FakeSleep {
  const waits: number[] = [];
  return {
    waits,
    sleep: async (ms: number) => {
      waits.push(ms);
      clock.advance(ms);
    },
  };
}

/** Una richiesta registrata dal client HTTP finto. */
export interface RecordedRequest {
  /** L'URL richiesto. */
  readonly url: string;
  /** Le opzioni della richiesta. */
  readonly init: HttpRequestInit | undefined;
}

/** Un client HTTP finto. */
export interface FakeHttpClient extends HttpClient {
  /** Le richieste effettuate, in ordine. */
  readonly calls: RecordedRequest[];
}

/**
 * Crea un client HTTP finto.
 *
 * @param handler - il gestore: riceve URL e init e restituisce la risposta.
 * @returns il client finto con il registro delle chiamate.
 */
export function createFakeHttpClient(
  handler: (url: string, init?: HttpRequestInit) => HttpResponse | Promise<HttpResponse>,
): FakeHttpClient {
  const calls: RecordedRequest[] = [];
  return {
    calls,
    async request(url: string, init?: HttpRequestInit): Promise<HttpResponse> {
      calls.push({ url, init });
      return handler(url, init);
    },
  };
}

/** Una risposta HTTP vuota con lo status richiesto. */
export function httpResponse(
  status: number,
  body = '',
  headers: Readonly<Record<string, string>> = {},
  bytes?: ArrayBuffer,
): HttpResponse {
  return bytes === undefined ? { status, headers, body } : { status, headers, body, bytes };
}

/** I byte di un file audio finto (abbastanza per un test). */
export function fakeAudioBytes(): ArrayBuffer {
  return new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]).buffer;
}

/**
 * Carica un fixture delle API esterne da `fixtures/api-mocks/`.
 *
 * @param relativePath - il percorso relativo dentro `fixtures/api-mocks/`.
 * @returns il contenuto grezzo del fixture.
 */
export function loadApiMock(relativePath: string): string {
  const path = fileURLToPath(
    new URL(`../../../../../fixtures/api-mocks/${relativePath}`, import.meta.url),
  );
  return readFileSync(path, 'utf8');
}

/**
 * Un brano di test.
 *
 * @param overrides - i campi da sovrascrivere.
 * @returns il brano.
 */
export function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    canonicalKey: 'fuzzy:track-1',
    name: 'Northern Sky',
    artistId: 'artist-1',
    albumId: null,
    durationMs: 330_000,
    isrc: null,
    mbid: null,
    explicit: null,
    genres: [],
    artworkUrl: null,
    platformIds: {},
    firstSeenAt: 0,
    lastSeenAt: 0,
    listenCount: 1,
    ...overrides,
  };
}

/**
 * Il contesto di test (nome dell'artista e generi).
 *
 * @param overrides - i campi da sovrascrivere.
 * @returns il contesto.
 */
export function makeContext(overrides: Partial<FeatureContext> = {}): FeatureContext {
  return {
    artistName: 'The Midnight Echo',
    ...overrides,
  };
}

/**
 * Un PRNG mulberry32: deterministico, con seme esplicito.
 *
 * Serve ai **property test**: senza `fast-check` (non disponibile offline)
 * il generatore è locale e riproducibile, così un fallimento è
 * riproducibile da un altro agente.
 *
 * @param seed - il seme.
 * @returns il generatore di numeri in [0,1).
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
