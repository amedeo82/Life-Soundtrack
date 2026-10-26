import * as Papa from 'papaparse';
import { looksLikeLastfmMinuteDate } from './mapEvent';

/**
 * Rilevamento del percorso **file** Last.fm (`03-ADAPTERS/lastfm.md` §2.3).
 *
 * - **CSV ghan.nl**: la prima riga è un header riconoscibile (`uts`,
 *   `utc_time`, `artist`, `track`);
 * - **CSV lastfm-to-csv**: 4 colonne **senza header**, l'ultima che matcha il
 *   formato data `DD MMM YYYY HH:mm`;
 * - **JSON** (export dei tool ghan.nl): la prima riga è un oggetto JSON con
 *   gli stessi campi del CSV ghan.nl.
 *
 * Rilevamento **statico**: nessuna rete, nessuna decompressione. Il BOM UTF-8
 * viene rimosso prima del controllo (E.LF.20).
 */

/** Byte letti per il controllo della prima riga. */
const HEAD_BYTES = 64 * 1024;

/** Chiavi del CSV ghan.nl (8 colonne con header). */
const GHANL_HEADER_KEYS = ['uts', 'utc_time', 'artist', 'album', 'track'];

/** Chiavi dell'export JSON ghan.nl. */
const GHANL_JSON_KEYS = ['uts', 'utc_time', 'artist', 'album', 'track'];

/** Legge la prima riga del file, senza BOM. */
export async function readFirstLine(input: Blob): Promise<string> {
  const head = await input.slice(0, HEAD_BYTES).text();
  const line = head.split('\n', 1)[0] ?? '';
  return line.replace(/^\uFEFF/, '').trim();
}

/** True se l'header CSV è quello di `ghan.nl`. */
export function isGhanlHeader(cells: string[]): boolean {
  const normalized = cells.map((cell) => cell.trim().toLowerCase());
  return GHANL_HEADER_KEYS.some((key) => normalized.includes(key));
}

/** True se una riga ha la forma del CSV `lastfm-to-csv` (4 colonne + data). */
export function isFourColumnRow(cells: string[]): boolean {
  return cells.length === 4 && looksLikeLastfmMinuteDate(cells[3]);
}

/** True se l'oggetto JSON ha la forma dell'export ghan.nl. */
export function isGhanlJson(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  if (GHANL_JSON_KEYS.some((key) => key in rec)) {
    return true;
  }
  // Wrapper `{"events": [...]}`: il primo record decide.
  const events = rec.events;
  if (Array.isArray(events) && events.length > 0) {
    return isGhanlJson(events[0]);
  }
  return false;
}

/**
 * Riconosce un export **file** Last.fm. Sempre via `await` (D.A.8).
 */
export async function detectLastfmFile(input: Blob): Promise<boolean> {
  const firstLine = await readFirstLine(input);
  if (firstLine.length === 0) {
    return false;
  }
  if (firstLine.startsWith('{') || firstLine.startsWith('[')) {
    // Il JSON export è pretty-printed: la prima riga è solo "{". Il
    // riconoscimento guarda la **forma** del payload, non la sua prima riga.
    try {
      return isGhanlJson(JSON.parse(await input.text()));
    } catch {
      return false;
    }
  }
  const parsed = Papa.parse<string[]>(firstLine, { header: false, skipEmptyLines: true });
  const cells = (parsed.data[0] ?? []).map((cell) =>
    typeof cell === 'string' ? cell : String(cell ?? ''),
  );
  if (cells.length === 0) {
    return false;
  }
  return isGhanlHeader(cells) || isFourColumnRow(cells);
}
