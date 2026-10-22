import { blobChunks, iterateJsonArrayElements } from '../jsonStream';
import { extractZipEntry, isZip, listZipEntries } from '../zip';
import { YT_HEADERS, WATCH_URL_RE } from './mapEvent';

/**
 * Rilevamento del formato export YouTube Music (youtube-music.md §2.2).
 *
 * Detection **strutturale**, mai per nome file o path: i nomi di cartelle e
 * file del Takeout seguono la lingua dell'account Google (E.YT.1).
 *
 * - **ZIP**: scansione ricorsiva di tutti i `*.json`; almeno un file deve
 *   superare il test strutturale `isWatchHistoryJson`.
 * - **JSON singolo**: il test strutturale applicato direttamente al file
 *   (array top-level o wrapper fixture `{"events":[...]}`).
 * - **Rifiuta**: HTML (contenuto `<html`) → false; l'errore guidato
 *   `error.htmlExport` è scelto dalla UI, non dal core (il contratto
 *   `PlatformAdapter.detect` è booleano).
 * - **Rifiuta**: array vuoto o shape non riconosciuta (es. search-history,
 *   MyActivity, CSV) → false.
 */

/** Prefisso dei byte letti per escludere HTML prima di ogni altro test. */
const HEAD_PROBE_BYTES = 64;

/**
 * Test strutturale di un file JSON candidata watch-history (§2.2): è un array
 * di oggetti in cui la **maggioranza** degli elementi ha header/products
 * YouTube valido e `time` ISO 8601 interpretabile, e **almeno un** elemento
 * ha un `titleUrl` di ascolto.
 *
 * Streaming via `iterateJsonArrayElements` (memoria limitata anche su file
 * da decine di MB); errori di parsing → false, mai eccezioni.
 */
export async function isWatchHistoryJson(input: Blob): Promise<boolean> {
  let total = 0;
  let qualified = 0;
  let hasWatchUrl = false;
  try {
    for await (const element of iterateJsonArrayElements(blobChunks(input))) {
      total += 1;
      if (typeof element !== 'object' || element === null) {
        continue;
      }
      const rec = element as Record<string, unknown>;
      const header = typeof rec.header === 'string' ? rec.header : null;
      const products = Array.isArray(rec.products)
        ? rec.products.filter((p): p is string => typeof p === 'string')
        : null;
      const platformMatch =
        (header !== null && (YT_HEADERS as readonly string[]).includes(header)) ||
        (products !== null && products.some((p) => (YT_HEADERS as readonly string[]).includes(p)));
      const timeValid = typeof rec.time === 'string' && Number.isFinite(Date.parse(rec.time));
      if (platformMatch && timeValid) {
        qualified += 1;
      }
      if (typeof rec.titleUrl === 'string' && WATCH_URL_RE.test(rec.titleUrl)) {
        hasWatchUrl = true;
      }
    }
  } catch {
    // Stream corrotto o troncato: si valuta il prefisso già analizzato
    // (05§4 partial recovery) — se la maggioranza degli elementi finora
    // rispetta la shape, il file resta una watch-history riconoscibile e
    // il parse ne recupererà il prefisso con `AdapterError` TRUNCATED
    // recoverable. Shape non riconosciuta → false (§2.2 detect.fail).
  }
  return total > 0 && qualified > total / 2 && hasWatchUrl;
}

/** True se i primi byte sono markup HTML (export nel formato sbagliato). */
export async function looksLikeHtml(input: Blob): Promise<boolean> {
  const head = new TextDecoder().decode(
    new Uint8Array(await input.slice(0, HEAD_PROBE_BYTES).arrayBuffer()),
  );
  return head.trimStart().startsWith('<');
}

/** Riconosce un export YouTube Music (ZIP Takeout o JSON watch-history). */
export async function detectYouTubeMusic(input: Blob): Promise<boolean> {
  if (input.size === 0) {
    return false;
  }
  if (await looksLikeHtml(input)) {
    return false;
  }
  if (await isZip(input)) {
    try {
      const names = await listZipEntries(input);
      const zipBytes = new Uint8Array(await input.arrayBuffer());
      for (const name of names) {
        if (!/\.json$/i.test(name)) {
          continue;
        }
        const data = await extractZipEntry(zipBytes, name);
        if (!data) {
          continue;
        }
        if (await isWatchHistoryJson(new Blob([new Uint8Array(data)]))) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
  const head = new TextDecoder().decode(new Uint8Array(await input.slice(0, 1).arrayBuffer()));
  const first = head.trimStart();
  if (first.startsWith('[') || first.startsWith('{')) {
    return isWatchHistoryJson(input);
  }
  return false;
}
