/**
 * Test del modulo geolocalizzazione IP locale (L2) — Story 4.4.
 *
 * I test **non toccano mai la rete** (`10§8`): client HTTP, cache storage,
 * orologio e logger sono iniettati e deterministici.
 */

import { describe, expect, it } from 'vitest';
import {
  CITY_CONFIDENCE_THRESHOLD,
  CITY_DB_STALE_MS,
  type CityResult,
  type GeoConfig,
  type GeoDeps,
  type GeoLookup,
} from '../types';
import {
  createMmdbLookup,
  createDisabledLookup,
  createGeoPolicy,
  deriveCity,
  isDbStale,
} from '../mmdb';

/** Una risposta HTTP finta. */
interface FakeHttpResponse {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: string;
  bytes?: ArrayBuffer;
}

/** Un client HTTP finto che registra le chiamate. */
class FakeHttpClient {
  readonly calls: { url: string; responseType?: string | undefined }[] = [];
  constructor(private handler: (url: string) => FakeHttpResponse | Promise<FakeHttpResponse>) {}
  async request(
    url: string,
    init?: { responseType?: 'text' | 'binary' },
  ): Promise<FakeHttpResponse> {
    this.calls.push({ url, responseType: init?.responseType });
    return this.handler(url);
  }
}

/** Una cache storage finta. */
class FakeCacheStorage {
  readonly puts: { url: string; status: number }[] = [];
  readonly matches: string[] = [];
  private store: Map<string, { status: number; body: ArrayBuffer }> = new Map();

  async match(request: Request | string): Promise<Response | undefined> {
    const key = typeof request === 'string' ? request : request.url;
    this.matches.push(key);
    const entry = this.store.get(key);
    if (!entry) return undefined;
    return new Response(entry.body, { status: entry.status });
  }

  async put(request: Request | string, response: Response): Promise<void> {
    const key = typeof request === 'string' ? request : request.url;
    const body = await response.arrayBuffer();
    this.store.set(key, { status: response.status, body });
    this.puts.push({ url: key, status: response.status });
  }

  async delete(request: Request | string): Promise<boolean> {
    const key = typeof request === 'string' ? request : request.url;
    return this.store.delete(key);
  }
}

/** Un orologio controllabile. */
class FakeClock {
  nowValue: number;
  constructor(start = 1_700_000_000_000) {
    this.nowValue = start;
  }
  now(): number {
    return this.nowValue;
  }
  set(ms: number): void {
    this.nowValue = ms;
  }
}

/** Un logger finto che registra i messaggi. */
class FakeLogger {
  readonly messages: string[] = [];
  debug(msg: string): void {
    this.messages.push(`debug: ${msg}`);
  }
  info(msg: string): void {
    this.messages.push(`info: ${msg}`);
  }
  warn(msg: string): void {
    this.messages.push(`warn: ${msg}`);
  }
  error(msg: string): void {
    this.messages.push(`error: ${msg}`);
  }
}

/** Una configurazione di test valida. */
function makeConfig(overrides: Partial<GeoConfig> = {}): GeoConfig {
  return {
    dbIpHost: 'https://download.db-ip.com',
    mmdbPath: '/free/dbip-city-lite-2024.mmdb',
    cacheKey: 'geo:mmdb:2024',
    settingsKey: 'geo:mmdb:buildDate',
    urlSettingsKey: 'geo:mmdb:url',
    ...overrides,
  };
}

/** Crea le dipendenze per il modulo geo, con i fake esposti per i test. */
function makeDeps(): {
  deps: GeoDeps;
  http: FakeHttpClient;
  cache: FakeCacheStorage;
  clock: FakeClock;
  logger: FakeLogger;
} {
  const http = new FakeHttpClient(async () => ({
    status: 200,
    headers: {},
    body: '',
    bytes: new Uint8Array([1, 2, 3, 4]).buffer,
  }));
  const cache = new FakeCacheStorage();
  const clock = new FakeClock();
  const logger = new FakeLogger();
  const deps: GeoDeps = {
    http,
    cache,
    clock,
    logger,
    policy: createGeoPolicy({ retainCity: true } as never),
  };
  return { deps, http, cache, clock, logger };
}

describe('createDisabledLookup', () => {
  it('restituisce sempre null', async () => {
    const lookup = createDisabledLookup();
    const result = await lookup.lookup('8.8.8.8');
    expect(result).toBeNull();
    expect(lookup.isAvailable()).toBe(false);
    expect(lookup.buildDate()).toBeNull();
  });
});

describe('createGeoPolicy', () => {
  it('è abilitato quando retainCity è true', () => {
    const policy = createGeoPolicy({ retainCity: true } as never);
    expect(policy.isEnabled()).toBe(true);
  });

  it('è disabilitato quando retainCity è false', () => {
    const policy = createGeoPolicy({ retainCity: false } as never);
    expect(policy.isEnabled()).toBe(false);
  });
});

describe('deriveCity', () => {
  it('restituisce city null quando il toggle è spento', async () => {
    const lookup = createDisabledLookup();
    const policy = createGeoPolicy({ retainCity: false } as never);
    const result = await deriveCity(lookup, policy, '8.8.8.8');
    expect(result).toEqual({ city: null, citySource: null, cityConfidence: null });
  });

  it("restituisce city null quando l'IP è null", async () => {
    const lookup = createDisabledLookup();
    const policy = createGeoPolicy({ retainCity: true } as never);
    const result = await deriveCity(lookup, policy, null);
    expect(result).toEqual({ city: null, citySource: null, cityConfidence: null });
  });

  it('restituisce city null quando il lookup non è disponibile', async () => {
    const lookup = createDisabledLookup();
    const policy = createGeoPolicy({ retainCity: true } as never);
    const result = await deriveCity(lookup, policy, '8.8.8.8');
    expect(result.city).toBeNull();
    expect(result.citySource).toBeNull();
    expect(result.cityConfidence).toBeNull();
  });

  it('scarta la città sotto la soglia di confidenza 0.6', async () => {
    const lookup: GeoLookup = {
      async lookup(): Promise<CityResult | null> {
        return { city: 'Parigi', citySource: 'dbip-lite', cityConfidence: 0.5 };
      },
      isAvailable(): boolean {
        return true;
      },
      buildDate(): number | null {
        return null;
      },
    };
    const policy = createGeoPolicy({ retainCity: true } as never);
    const result = await deriveCity(lookup, policy, '8.8.8.8');
    expect(result.city).toBeNull();
    expect(result.citySource).toBeNull();
    expect(result.cityConfidence).toBeNull();
  });

  it('restituisce la città sopra la soglia di confidenza', async () => {
    const lookup: GeoLookup = {
      async lookup(): Promise<CityResult | null> {
        return { city: 'Parigi', citySource: 'dbip-lite', cityConfidence: 0.8 };
      },
      isAvailable(): boolean {
        return true;
      },
      buildDate(): number | null {
        return null;
      },
    };
    const policy = createGeoPolicy({ retainCity: true } as never);
    const result = await deriveCity(lookup, policy, '8.8.8.8');
    expect(result.city).toBe('Parigi');
    expect(result.citySource).toBe('dbip-lite');
    expect(result.cityConfidence).toBe(0.8);
  });

  it('usa la soglia costante CITY_CONFIDENCE_THRESHOLD', () => {
    expect(CITY_CONFIDENCE_THRESHOLD).toBe(0.6);
  });
});

describe('isDbStale', () => {
  it('restituisce true se il database è oltre 60 giorni', () => {
    const now = Date.now();
    const buildDate = now - CITY_DB_STALE_MS - 1;
    expect(isDbStale(buildDate, now)).toBe(true);
  });

  it('restituisce false se il database è entro 60 giorni', () => {
    const now = Date.now();
    const buildDate = now - CITY_DB_STALE_MS + 1;
    expect(isDbStale(buildDate, now)).toBe(false);
  });

  it('restituisce false se la build date è null', () => {
    expect(isDbStale(null, Date.now())).toBe(false);
  });
});

describe('createMmdbLookup - download on-demand', () => {
  it('scarica il database al primo lookup', async () => {
    const { deps, http, cache } = makeDeps();
    const config = makeConfig();
    const lookup = createMmdbLookup(deps, config);

    expect(lookup.isAvailable()).toBe(false);

    await lookup.lookup('8.8.8.8');

    // Il download è avvenuto (chiamata HTTP)
    expect(http.calls.length).toBe(1);
    expect(http.calls[0]!.url).toBe('https://download.db-ip.com/free/dbip-city-lite-2024.mmdb');
    expect(http.calls[0]!.responseType).toBe('binary');

    // Salvato in cache
    expect(cache.puts.length).toBe(1);
    expect(cache.puts[0]!.url).toBe('https://download.db-ip.com/free/dbip-city-lite-2024.mmdb');

    // Ora è disponibile
    expect(lookup.isAvailable()).toBe(true);
  });

  it('non riscarica se già disponibile', async () => {
    const { deps, http } = makeDeps();
    const config = makeConfig();
    const lookup = createMmdbLookup(deps, config);

    await lookup.lookup('8.8.8.8');
    await lookup.lookup('1.1.1.1');

    expect(http.calls.length).toBe(1);
  });

  it("gestisce l'errore di download", async () => {
    const http = new FakeHttpClient(async () => ({ status: 404, headers: {}, body: '' }));
    const cache = new FakeCacheStorage();
    const clock = new FakeClock();
    const logger = new FakeLogger();
    const deps: GeoDeps = {
      http,
      cache,
      clock,
      logger,
      policy: createGeoPolicy({ retainCity: true } as never),
    };
    const config = makeConfig();
    const lookup = createMmdbLookup(deps, config);

    await expect(lookup.lookup('8.8.8.8')).rejects.toThrow();
    expect(lookup.isAvailable()).toBe(false);
  });

  it('usa Cache Storage se disponibile', async () => {
    const { deps, cache } = makeDeps();
    const config = makeConfig();
    const lookup = createMmdbLookup(deps, config);

    await lookup.lookup('8.8.8.8');

    expect(cache.puts.length).toBe(1);
  });
});

describe('CityResult type', () => {
  it('ha i campi previsti', () => {
    const result: CityResult = { city: 'Milano', citySource: 'dbip-lite', cityConfidence: 0.9 };
    expect(result.city).toBe('Milano');
    expect(result.citySource).toBe('dbip-lite');
    expect(result.cityConfidence).toBe(0.9);
  });
});
