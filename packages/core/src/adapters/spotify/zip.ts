import { unzip } from 'fflate';
import { AdapterError } from '../errors';

/**
 * Lettura minimale dei metadati ZIP senza decomprimere: `detect` deve
 * verificare la presenza di `Streaming_History_Audio_*.json` senza pagare
 * l'estrazione completa (05§4: detect statico, economico).
 *
 * L'estrazione è per-file e lazy (via `fflate` `unzip` con filtro): la
 * memoria di picco resta limitata a un file decompresso alla volta, e un
 * file corrotto a metà archivio lascia intatti gli eventi già emessi
 * (05§4 partial recovery).
 */

/** Firma local file header (PK\x03\x04). */
const ZIP_LOCAL_MAGIC = 0x04034b50;
/** Firma end of central directory (PK\x05\x06). */
const ZIP_EOCD_MAGIC = 0x06054b50;
/** Firma central directory entry (PK\x01\x02). */
const ZIP_CD_MAGIC = 0x02014b50;

/** Dimensione della coda del file in cui cercare l'EOCD (64KiB + commento). */
const EOCD_SCAN_TAIL = 65_536 + 256;

function readU16(data: Uint8Array, offset: number): number {
  return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
}

function readU32(data: Uint8Array, offset: number): number {
  return (
    (data[offset] ?? 0) |
    ((data[offset + 1] ?? 0) << 8) |
    ((data[offset + 2] ?? 0) << 16) |
    ((data[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

/** True se il blob inizia con una firma ZIP nota. */
export async function isZip(input: Blob): Promise<boolean> {
  if (input.size < 4) {
    return false;
  }
  const head = new Uint8Array(await input.slice(0, 4).arrayBuffer());
  const sig = readU32(head, 0);
  return sig === ZIP_LOCAL_MAGIC || sig === ZIP_EOCD_MAGIC;
}

/**
 * Elenca i nomi dei file nel central directory. Lancia `AdapterError`
 * `INVALID_FORMAT` su ZIP corrotto o Zip64 (gli export GDPR stanno ampiamente
 * sotto i limiti classici: 4 GiB / 65k voci).
 */
export async function listZipEntries(input: Blob): Promise<string[]> {
  const tailStart = Math.max(0, input.size - EOCD_SCAN_TAIL);
  const tail = new Uint8Array(await input.slice(tailStart).arrayBuffer());
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (readU32(tail, i) === ZIP_EOCD_MAGIC) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new AdapterError('INVALID_FORMAT', 'ZIP senza end of central directory');
  }
  const entryCount = readU16(tail, eocd + 10);
  const cdSize = readU32(tail, eocd + 12);
  const cdOffset = readU32(tail, eocd + 16);
  const cdStart = tailStart + eocd - cdSize;
  if (cdStart < 0 || cdStart + cdSize > input.size) {
    throw new AdapterError('INVALID_FORMAT', 'ZIP con central directory fuori dal file');
  }
  const cd = new Uint8Array(await input.slice(cdStart, cdStart + cdSize).arrayBuffer());
  const decoder = new TextDecoder();
  const names: string[] = [];
  let pos = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (pos + 46 > cd.length || readU32(cd, pos) !== ZIP_CD_MAGIC) {
      throw new AdapterError('INVALID_FORMAT', 'ZIP con central directory corrotto');
    }
    const nameLen = readU16(cd, pos + 28);
    const extraLen = readU16(cd, pos + 30);
    const commentLen = readU16(cd, pos + 32);
    names.push(decoder.decode(cd.subarray(pos + 46, pos + 46 + nameLen)));
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

/**
 * Estrae un singolo file dal ZIP (buffer già letto in memoria). Restituisce
 * null se il nome non esiste. Il `unzip` asincrono di fflate è callback-based:
 * qui è incapsulato in una Promise.
 */
export function extractZipEntry(zipBytes: Uint8Array, name: string): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    unzip(
      zipBytes,
      { filter: (file) => file.name === name },
      (err, data) => {
        if (err) {
          reject(new AdapterError('TRUNCATED', `ZIP corrotto durante l'estrazione di ${name}`, {
            recoverable: true,
          }));
          return;
        }
        resolve(data[name] ?? null);
      },
    );
  });
}
