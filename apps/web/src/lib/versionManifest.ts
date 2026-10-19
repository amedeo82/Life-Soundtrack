/**
 * Lettura del version manifest (`/version.json`, generato da
 * `scripts/generate-version.mjs` in fase di build, Story 0.7 T0.7.6).
 *
 * Spec: `05-ARCHITECTURE.md §11.1` — il client confronta a ogni boot la
 * versione cached con quella del manifest per decidere se mostrare il banner
 * di update.
 */

export interface VersionManifest {
  readonly version: string;
  readonly buildHash: string;
  readonly releasedAt: string;
  /** Versione minima di schema DB che il client sa gestire (02-DATA-SCHEMA). */
  readonly minSchemaVersion: number;
}

const VERSION_URL = '/version.json';

/**
 * Fetch del version manifest. Restituisce `null` se il file non è
 * disponibile (es. primo boot offline, SW non ancora registrato).
 * Nessun dato personale transita (solo metadati di build).
 */
export async function fetchVersionManifest(): Promise<VersionManifest | null> {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as VersionManifest;
  } catch {
    return null;
  }
}

/**
 * Decide se un update è "bloccante" (richiede modal, non banner soft).
 * Spec `05-ARCHITECTURE.md §11.3/§11.4`:
 *   major + migrazione DB necessaria (currentDbVersion < minSchemaVersion)
 *   -> modal bloccante; altrimenti banner come minor.
 *
 * @param updateKind tipo di bump (patch/minor/major) da `useAppUpdate`.
 * @param currentDbVersion versione schema corrente del DB (da `db.verno`).
 * @param manifest version manifest dal server (può essere null).
 */
export function isBlockingUpdate(
  updateKind: 'patch' | 'minor' | 'major' | null,
  currentDbVersion: number | null,
  manifest: VersionManifest | null,
): boolean {
  if (updateKind !== 'major') return false;
  if (!manifest) return false; // default sicuro: senza manifest, banner soft
  if (currentDbVersion === null) return false; // non si può giudicare -> non blocca
  return currentDbVersion < manifest.minSchemaVersion;
}
