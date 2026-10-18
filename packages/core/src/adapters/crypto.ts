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
