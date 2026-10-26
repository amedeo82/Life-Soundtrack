import { isZip, listZipEntries } from '../zip';

/**
 * Rilevamento del formato ListenBrainz (`03-ADAPTERS/listenbrainz.md` §2.2).
 *
 * - **ZIP**: si legge il **central directory** (nessuna decompressione) e si
 *   cercano voci `listens/*.jsonl` **e** `user.json`: è il criterio di
 *   riconoscimento dell'export.
 * - **JSONL sciolto** (lo stesso contenuto estratto a mano): accettato se la
 *   **prima riga** è un oggetto JSON valido con `listened_at` e
 *   `track_metadata` — utile per il debug e per i test.
 *
 * La detection è **statica**: nessuna decompressione, nessuna rete.
 */

/** Path dei file di ascolto dentro l'archivio export. */
const LISTENS_PATH_RE = /^listens\/.+\.jsonl$/i;

/** Byte letti per il controllo della prima riga (JSONL sciolto). */
const HEAD_BYTES = 64 * 1024;

/**
 * True se l'archivio contiene almeno un file `listens/*.jsonl` e il
 * manifest `user.json`.
 */
export function isListenBrainzArchive(entryNames: string[]): boolean {
  const hasListens = entryNames.some((name) => LISTENS_PATH_RE.test(name));
  const hasUser = entryNames.some((name) => /^user\.json$/i.test(name));
  return hasListens && hasUser;
}

/**
 * Riconosce un export ListenBrainz. Sempre via `await` (D.A.8).
 */
export async function detectListenBrainz(input: Blob): Promise<boolean> {
  if (await isZip(input)) {
    return isListenBrainzArchive(await listZipEntries(input));
  }
  const head = await input.slice(0, HEAD_BYTES).text();
  const firstLine =
    head
      .split('\n', 1)[0]
      ?.replace(/^\uFEFF/, '')
      .trim() ?? '';
  if (!firstLine.startsWith('{')) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(firstLine);
    if (typeof parsed !== 'object' || parsed === null) {
      return false;
    }
    const rec = parsed as Record<string, unknown>;
    return (
      typeof rec.listened_at === 'number' &&
      typeof rec.track_metadata === 'object' &&
      rec.track_metadata !== null
    );
  } catch {
    return false;
  }
}
