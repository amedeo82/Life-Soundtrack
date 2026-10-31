/**
 * Lookup MMDB (MaxMind DB) — download on-demand e interrogazione in-process.
 *
 * `13-ADR/0009-local-ip-geolocation.md` v1.0 🟢 (Story 4.4).
 *
 * Il database DB-IP Lite City (CC BY 4.0) si scarica **on-demand al primo
 * uso**, non è embedded nel bundle né nel precache, e va in **Cache Storage**.
 * L'unico host di rete è quello dichiarato nella CSP applicata
 * (`apps/web/src/security/csp.ts`).
 *
 * Il reader MMDB è minimale: legge solo il campo `city.names.en` per IPv4.
 * Il formato MMDB è lo standard di MaxMind/DB-IP; il codice non dipende da
 * un fornitore specifico (ADR-0009 §Alternative considerate, A3/A6).
 */

import {
  CITY_CONFIDENCE_THRESHOLD,
  CITY_DB_STALE_MS,
  type CityResult,
  type GeoConfig,
  type GeoDeps,
  type GeoLookup,
  GeoError,
} from './types';
import type { GeoPolicy } from './types';
import type { PrivacySettings } from '../schema';

/** Flag del tipo di dato MMDB: pointer. */
const MMDB_TYPE_POINTER = 1;
/** Flag del tipo di dato MMDB: UTF-8 string. */
const MMDB_TYPE_UTF8_STRING = 2;
/** Flag del tipo di dato MMDB: double. */
const MMDB_TYPE_DOUBLE = 3;
/** Flag del tipo di dato MMDB: bytes. */
const MMDB_TYPE_BYTES = 4;
/** Flag del tipo di dato MMDB: uint16. */
const MMDB_TYPE_UINT16 = 5;
/** Flag del tipo di dato MMDB: uint32. */
const MMDB_TYPE_UINT32 = 6;
/** Flag del tipo di dato MMDB: map. */
const MMDB_TYPE_MAP = 7;
/** Flag del tipo di dato MMDB: int32. */
const MMDB_TYPE_INT32 = 8;
/** Flag del tipo di dato MMDB: uint64. */
const MMDB_TYPE_UINT64 = 9;
/** Flag del tipo di dato MMDB: uint128. */
const MMDB_TYPE_UINT128 = 10;
/** Flag del tipo di dato MMDB: array. */
const MMDB_TYPE_ARRAY = 11;
/** Flag del tipo di dato MMDB: container (map/array). */
const MMDB_TYPE_CONTAINER = 12;

/** Offset del record di metadata nel blocco dati (dopo l'header). */
const METADATA_OFFSET = 32;

/**
 * Decodifica un puntatore MMDB dal buffer.
 *
 * I puntatori usano un encoding a lunghezza variabile: il primo byte indica
 * quanti byte seguono (0-2 = inclusi nel primo byte, 3-4 = 1 byte extra, 5-7 = 2 byte extra).
 * @param buffer - il buffer MMDB.
 * @param offset - l'offset corrente.
 * @returns `[valore, nuovoOffset]`.
 */
function readPointer(buffer: ArrayBuffer, offset: number): [number, number] {
  const view = new DataView(buffer);
  const first = view.getUint8(offset);
  let value = 0;

  if (first >= 0 && first <= 2) {
    value = first;
  } else if (first >= 3 && first <= 4) {
    value = first - 3;
    offset += 1;
    value = (value << 8) | view.getUint8(offset);
  } else if (first >= 5 && first <= 7) {
    value = first - 5;
    offset += 1;
    value = (value << 8) | view.getUint8(offset);
    value = (value << 8) | view.getUint8(offset + 1);
    offset += 1;
  } else {
    throw new GeoError('LOOKUP_FAILED', 'Puntatore MMDB non supportato', false);
  }

  return [value, offset + 1];
}

/**
 * Decodifica un valore MMDB da un offset del blocco dati.
 * @param buffer - il buffer MMDB.
 * @param offset - l'offset del valore nel blocco dati.
 * @returns il valore decodato (string, number, oggetto, array, o null).
 */
function decodeValue(buffer: ArrayBuffer, offset: number): unknown {
  const view = new DataView(buffer);
  const ctrl = view.getUint8(offset);
  const type = ctrl & 0xf;
  const size = ctrl >> 4;

  switch (type) {
    case MMDB_TYPE_UTF8_STRING: {
      const len = size === 15 ? readPointer(buffer, offset + 1)[0] : size;
      const strOffset = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      const bytes = new Uint8Array(buffer, strOffset, len);
      return new TextDecoder().decode(bytes);
    }
    case MMDB_TYPE_DOUBLE: {
      const dataOffset = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      return view.getFloat64(dataOffset);
    }
    case MMDB_TYPE_BYTES: {
      const len = size === 15 ? readPointer(buffer, offset + 1)[0] : size;
      const dataOffset = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      return new Uint8Array(buffer, dataOffset, len);
    }
    case MMDB_TYPE_UINT16: {
      const dataOffset = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      return view.getUint16(dataOffset);
    }
    case MMDB_TYPE_UINT32: {
      const dataOffset = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      return view.getUint32(dataOffset);
    }
    case MMDB_TYPE_MAP: {
      const len = size === 15 ? readPointer(buffer, offset + 1)[0] : size;
      let cursor = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      const map: Record<string, unknown> = {};
      for (let i = 0; i < len; i++) {
        const key = decodeValue(buffer, cursor);
        if (typeof key !== 'string') break;
        cursor = advanceCursor(buffer, cursor);
        const val = decodeValue(buffer, cursor);
        cursor = advanceCursor(buffer, cursor);
        map[key] = val;
      }
      return map;
    }
    case MMDB_TYPE_INT32: {
      const dataOffset = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      return view.getInt32(dataOffset);
    }
    case MMDB_TYPE_UINT64: {
      const dataOffset = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      return Number(view.getBigUint64(dataOffset));
    }
    case MMDB_TYPE_UINT128: {
      const dataOffset = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      const hi = view.getBigUint64(dataOffset);
      const lo = view.getBigUint64(dataOffset + 8);
      return Number((hi << 64n) | lo);
    }
    case MMDB_TYPE_ARRAY: {
      const len = size === 15 ? readPointer(buffer, offset + 1)[0] : size;
      let cursor = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
      const arr: unknown[] = [];
      for (let i = 0; i < len; i++) {
        arr.push(decodeValue(buffer, cursor));
        cursor = advanceCursor(buffer, cursor);
      }
      return arr;
    }
    case MMDB_TYPE_CONTAINER: {
      const containerCtrl = view.getUint8(offset + 1);
      const containerType = containerCtrl & 0xf;
      const containerSize = containerCtrl >> 4;
      if (containerType === MMDB_TYPE_MAP) {
        const len = containerSize === 15 ? readPointer(buffer, offset + 2)[0] : containerSize;
        let cursor = containerSize === 15 ? readPointer(buffer, offset + 2)[1] : offset + 2;
        const map: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          const key = decodeValue(buffer, cursor);
          if (typeof key !== 'string') break;
          cursor = advanceCursor(buffer, cursor);
          const val = decodeValue(buffer, cursor);
          cursor = advanceCursor(buffer, cursor);
          map[key] = val;
        }
        return map;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Avanza il cursore oltre un valore decodato (per iterare mappe/array).
 * @param buffer - il buffer MMDB.
 * @param offset - l'offset corrente.
 * @returns il nuovo offset dopo il valore.
 */
function advanceCursor(buffer: ArrayBuffer, offset: number): number {
  const view = new DataView(buffer);
  const ctrl = view.getUint8(offset);
  const type = ctrl & 0xf;
  const size = ctrl >> 4;

  if (type === MMDB_TYPE_POINTER) {
    return readPointer(buffer, offset + 1)[1];
  }
  if (type === MMDB_TYPE_MAP || type === MMDB_TYPE_ARRAY || type === MMDB_TYPE_CONTAINER) {
    const len = size === 15 ? readPointer(buffer, offset + 1)[0] : size;
    let cursor = size === 15 ? readPointer(buffer, offset + 1)[1] : offset + 1;
    const count = type === MMDB_TYPE_MAP ? len * 2 : len;
    for (let i = 0; i < count; i++) {
      cursor = advanceCursor(buffer, cursor);
    }
    return cursor;
  }
  if (size === 15) {
    return readPointer(buffer, offset + 1)[1];
  }
  return offset + 1 + size;
}

/**
 * Converte un indirizzo IPv4 stringa in un numero 32-bit.
 * @param ip - l'indirizzo IPv4 (es. "8.8.8.8").
 * @returns il numero 32-bit, o null se non è un IPv4 valido.
 */
function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const p = Number(parts[i]);
    if (!Number.isInteger(p) || p < 0 || p > 255) return null;
    value = (value << 8) | p;
  }
  return value >>> 0;
}

/**
 * Converte un indirizzo IPv6 stringa in un array di 128 bit (2 x uint64).
 * @param ip - l'indirizzo IPv6.
 * @returns `[hi, lo]` come bigint, o null.
 */
function ipv6ToBigInts(ip: string): [bigint, bigint] | null {
  const parts = ip.split(':');
  if (parts.length < 2 || parts.length > 8) return null;

  let hasDoubleColon = false;
  const groups: string[] = [];
  for (const p of parts) {
    if (p === '') {
      if (hasDoubleColon) return null;
      hasDoubleColon = true;
    } else {
      groups.push(p);
    }
  }

  if (!hasDoubleColon) {
    if (groups.length !== 8) return null;
    return parseIPv6Groups(groups);
  }

  const missing = 8 - groups.length;
  const expanded: string[] = [];
  let skipNext = false;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    if (part === '' && !skipNext) {
      for (let j = 0; j < missing; j++) expanded.push('0000');
      skipNext = true;
    } else if (part !== '' || skipNext) {
      expanded.push(part);
    }
  }
  while (expanded.length < 8) expanded.push('0000');
  return parseIPv6Groups(expanded);
}

function parseIPv6Groups(groups: string[]): [bigint, bigint] | null {
  const words: number[] = [];
  for (const g of groups) {
    const v = parseInt(g, 16);
    if (isNaN(v) || v < 0 || v > 0xffff) return null;
    words.push(v);
  }
  if (words.length !== 8) return null;

  const hi =
    (BigInt(words[0]!) << 112n) |
    (BigInt(words[1]!) << 96n) |
    (BigInt(words[2]!) << 64n) |
    (BigInt(words[3]!) << 32n);
  const lo =
    (BigInt(words[4]!) << 32n) |
    (BigInt(words[5]!) << 16n) |
    (BigInt(words[6]!) << 8n) |
    BigInt(words[7]!);
  return [hi, lo];
}

/**
 * Cerca un indirizzo IPv4 nell'albero di ricerca MMDB.
 * @param buffer - il buffer MMDB.
 * @param nodeOffset - l'offset del nodo corrente nel blocco di ricerca.
 * @param ipNum - l'indirizzo IPv4 come numero 32-bit.
 * @returns l'offset del record trovato, o null.
 */
function findIPv4(buffer: ArrayBuffer, nodeOffset: number, ipNum: number): number | null {
  const view = new DataView(buffer);
  let offset = nodeOffset;

  for (let bit = 31; bit >= 0; bit--) {
    const bitValue = (ipNum >>> bit) & 1;
    const leftPtr = view.getUint32(offset, true);
    const rightPtr = view.getUint32(offset + 4, true);

    const isLeftNode = (leftPtr & 1) === 0;
    const isRightNode = (rightPtr & 1) === 0;

    const targetPtr = bitValue === 0 ? leftPtr : rightPtr;
    const isTargetNode = bitValue === 0 ? isLeftNode : isRightNode;

    if (isTargetNode) {
      offset = Number(targetPtr >>> 1) * 6;
    } else {
      return Number(targetPtr >>> 1);
    }
  }

  return null;
}

/**
 * Recupera il campo `city.names.en` da un record dati MMDB.
 * @param buffer - il buffer MMDB.
 * @param recordOffset - l'offset del record nel blocco dati.
 * @returns il nome della città, o null.
 */
function getCityName(buffer: ArrayBuffer, recordOffset: number): string | null {
  try {
    const value = decodeValue(buffer, recordOffset);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const city = obj['city'];
      if (city && typeof city === 'object' && !Array.isArray(city)) {
        const names = (city as Record<string, unknown>)['names'];
        if (names && typeof names === 'object' && !Array.isArray(names)) {
          const en = (names as Record<string, unknown>)['en'];
          if (typeof en === 'string') return en;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Estrae la build date dal metadata del database MMDB.
 * @param buffer - il buffer MMDB.
 * @returns il timestamp (unix ms) o null.
 */
function getBuildDate(buffer: ArrayBuffer): number | null {
  try {
    const metadata = decodeValue(buffer, METADATA_OFFSET);
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const obj = metadata as Record<string, unknown>;
      const buildDate = obj['build_date'];
      if (typeof buildDate === 'number') {
        return buildDate < 1e12 ? buildDate * 1000 : buildDate;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Crea un lookup MMDB che scarica on-demand il database e lo mette in Cache Storage.
 */
export function createMmdbLookup(deps: GeoDeps, config: GeoConfig): GeoLookup {
  const { http, cache, clock: _clock, logger } = deps;
  let buffer: ArrayBuffer | null = null;
  let downloaded = false;

  async function ensureDownloaded(): Promise<void> {
    if (buffer !== null) return;
    if (downloaded) return;
    downloaded = true;

    try {
      const url = config.dbIpHost + config.mmdbPath;
      const response = await http.request(url, {
        method: 'GET',
        responseType: 'binary',
      });

      if (response.status < 200 || response.status >= 300) {
        throw new GeoError(
          'DB_DOWNLOAD_FAILED',
          `Download del database MMDB fallito: HTTP ${response.status}`,
          true,
        );
      }

      const bytes = response.bytes;
      if (!bytes) {
        throw new GeoError(
          'DB_DOWNLOAD_FAILED',
          'Download del database MMDB: risposta vuota',
          true,
        );
      }

      buffer = bytes;

      try {
        const request = new Request(config.dbIpHost + config.mmdbPath);
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const cacheResponse = new Response(blob);
        await cache.put(request, cacheResponse);
      } catch (cacheError) {
        logger?.warn('Cache Storage non disponibile per MMDB', {
          reason: cacheError instanceof Error ? cacheError.name : 'unknown',
        });
      }

      logger?.debug('Database MMDB scaricato', {
        size: bytes.byteLength,
        host: config.dbIpHost,
      });
    } catch (error) {
      downloaded = false;
      buffer = null;
      if (error instanceof GeoError) throw error;
      throw new GeoError(
        'DB_DOWNLOAD_FAILED',
        `Download del database MMDB fallito: ${error instanceof Error ? error.message : 'errore sconosciuto'}`,
        true,
      );
    }
  }

  return {
    async lookup(ip: string): Promise<CityResult | null> {
      if (!buffer) {
        await ensureDownloaded();
      }
      if (!buffer) return null;

      const ipNum = ipv4ToNumber(ip);
      if (ipNum !== null) {
        const recordOffset = findIPv4(buffer, 0, ipNum);
        if (recordOffset !== null) {
          const city = getCityName(buffer, recordOffset);
          return {
            city,
            citySource: 'dbip-lite',
            cityConfidence: city !== null ? 0.8 : null,
          };
        }
      }

      const ipv6 = ipv6ToBigInts(ip);
      if (ipv6 !== null) {
        return null;
      }

      return null;
    },

    isAvailable(): boolean {
      return buffer !== null;
    },

    buildDate(): number | null {
      if (!buffer) return null;
      return getBuildDate(buffer);
    },
  };
}

/**
 * Crea un lookup MMDB che restituisce sempre null (disabilitato o senza DB).
 */
export function createDisabledLookup(): GeoLookup {
  return {
    async lookup(): Promise<CityResult | null> {
      return null;
    },
    isAvailable(): boolean {
      return false;
    },
    buildDate(): number | null {
      return null;
    },
  };
}

/**
 * Crea una policy che delega al toggle `PrivacySettings.retainCity`.
 */
export function createGeoPolicy(settings: PrivacySettings): GeoPolicy {
  return {
    isEnabled(): boolean | Promise<boolean> {
      return settings.retainCity === true;
    },
  };
}

/**
 * Deriva la città da un IP, rispettando il toggle e il database.
 *
 * Se il toggle è spento o il database non c'è, restituisce null (E21).
 * Se la confidenza è sotto 0.6, la città viene scartata (E16).
 *
 * @param lookup - il lookup MMDB.
 * @param policy - la policy del toggle.
 * @param ip - l'IP da risolvere (già presente nell'evento, mai inviato in rete).
 * @returns il risultato della derivazione (city null se non disponibile).
 */
export async function deriveCity(
  lookup: GeoLookup,
  policy: GeoPolicy,
  ip: string | null,
): Promise<CityResult> {
  const enabled = await policy.isEnabled();
  if (!enabled || ip === null) {
    return { city: null, citySource: null, cityConfidence: null };
  }

  if (!lookup.isAvailable()) {
    return { city: null, citySource: null, cityConfidence: null };
  }

  const result = await lookup.lookup(ip);
  if (!result) {
    return { city: null, citySource: null, cityConfidence: null };
  }

  if (result.cityConfidence !== null && result.cityConfidence < CITY_CONFIDENCE_THRESHOLD) {
    return { city: null, citySource: null, cityConfidence: null };
  }

  return result;
}

/**
 * Controlla se il database MMDB è scaduto (oltre 60 giorni dalla build date).
 * @param buildDate - il timestamp di build del database (unix ms).
 * @param now - l'ora corrente (unix ms).
 * @returns true se il database è stale.
 */
export function isDbStale(buildDate: number | null, now: number): boolean {
  if (buildDate === null) return false;
  return now - buildDate > CITY_DB_STALE_MS;
}
