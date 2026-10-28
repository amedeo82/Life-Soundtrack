/**
 * Helper crittografici per la pipeline di import.
 *
 * Usa `crypto.subtle` (Web Crypto, disponibile in browser e Node ≥ 18):
 * SHA-1 per le chiavi di dedup/idempotenza (02§5, 05§3.2 — non per
 * sicurezza), SHA-256 per `ImportRecord.fileHash` (02§3.7).
 */

/** Hex lowercase di un digest. */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** SHA-1 esadecimale (chiavi DEDUP-3 `fuzzy:` e fallback `eventKey`, 02§5). */
export async function sha1Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  // Copia in un buffer proprio: `crypto.subtle.digest` richiede un
  // `BufferSource` con ArrayBuffer non condiviso.
  const view = new Uint8Array(encoded.byteLength);
  view.set(encoded);
  const digest = await crypto.subtle.digest('SHA-1', view);
  return toHex(digest);
}

/** SHA-256 esadecimale (`ImportRecord.fileHash`, 02§3.7). */
export async function sha256Hex(input: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', input);
  return toHex(digest);
}

/** UUID v4 (id interni di `ListenEvent`, `Track`, `Artist`, `Album`, `ImportRecord`). */
export function uuid(): string {
  return crypto.randomUUID();
}

// --- MD5 (RFC 1321) — Story 1.5, D-SH.11 ---
//
// `crypto.subtle` non espone md5, e la firma `api_sig` di Last.fm lo richiede.
// La scelta ratificata è **JS puro**, nessuna dipendenza nuova: un pacchetto
// wasm per ~4 KB di bundle PWA è un costo sproporzionato, e il rischio della
// scrittura a mano è contenuto dai vettori RFC 1321 (test: `md5.test.ts`).
//
// md5 **non** è una funzione di sicurezza: qui serve solo per calcolare la
// firma del protocollo, su valori già conosciuti.

/**
 * Costanti di spostamento (rotazione) dei 64 round: RFC 1321 §3.4.
 *
 * I 64 valori sono i 4 gruppi ripetuti 4 volte ciascuno.
 */
const MD5_SHIFTS: readonly number[] = (
  [
    [7, 12, 17, 22],
    [5, 9, 14, 20],
    [4, 11, 16, 23],
    [6, 10, 15, 21],
  ] as const
).flatMap((group) => Array.from({ length: 4 }, () => group).flat());

/** Rotazione a sinistra di `value` su `bits` bit (32 bit, unsigned). */
function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

/**
 * MD5 esadecimale (lowercase) — firma `api_sig` di Last.fm
 * (`03-ADAPTERS/lastfm.md` §10, `20-SCROBBLING-HUB.md` §6.1).
 *
 * Sintattico, come l'SHA-1: prende una stringa e restituisce l'esadecimale
 * del digest. Implementazione RFC 1321 in JS puro (D-SH.11).
 */
export function md5Hex(input: string): string {
  const message = new TextEncoder().encode(input);
  const bitLength = message.length * 8;

  // Padding: 0x80, poi zeri fino a lunghezza ≡ 56 mod 64, poi la lunghezza
  // in bit su 8 byte little-endian.
  const paddedLength = (((message.length + 8) >>> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;
  // La lunghezza in bit è scritta little-endian: per messaggi < 512 MB
  // bastano i 4 byte bassi, ma il calcolo completo copre il caso limite.
  const lowBits = bitLength >>> 0;
  const highBits = Math.floor(bitLength / 0x100000000);
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, lowBits, true);
  view.setUint32(paddedLength - 4, highBits, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < paddedLength; offset += 64) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (const [round, shift] of MD5_SHIFTS.entries()) {
      // `K[round] = floor(abs(sin(round + 1)) * 2^32)` (RFC 1321 §3.4).
      const k = Math.floor(Math.abs(Math.sin(round + 1)) * 0x100000000) >>> 0;
      let f: number;
      let g: number;
      if (round < 16) {
        f = (b & c) | (~b & d);
        g = round;
      } else if (round < 32) {
        f = (d & b) | (~d & c);
        g = (5 * round + 1) % 16;
      } else if (round < 48) {
        f = b ^ c ^ d;
        g = (3 * round + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * round) % 16;
      }
      const sum = (f + a + k + view.getUint32(offset + g * 4, true)) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotateLeft(sum, shift)) >>> 0;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const digest = new Uint8Array(16);
  const digestView = new DataView(digest.buffer);
  digestView.setUint32(0, a0, true);
  digestView.setUint32(4, b0, true);
  digestView.setUint32(8, c0, true);
  digestView.setUint32(12, d0, true);
  return toHex(digest.buffer);
}
