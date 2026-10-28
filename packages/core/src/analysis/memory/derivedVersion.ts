/**
 * `derivedVersion` del memory engine — 04§1.1 e §9.
 *
 *     derivedVersion = sha1(JSON.stringify(configObject)).slice(0, 8)
 *
 * Il config object contiene **tutti** i parametri dell'algoritmo: quando un
 * parametro cambia, cambia la versione, gli insight vecchi diventano `stale`
 * e vengono ricalcolati al prossimo avvio (MIG-3, 02§7).
 */

import { sha1Hex } from '../../adapters/crypto';
import type { MemoryConfig } from './types';

/** Versione derivata (8 caratteri esadecimali) del set di parametri. */
export async function computeMemoryDerivedVersion(config: MemoryConfig): Promise<string> {
  return (await sha1Hex(JSON.stringify(config))).slice(0, 8);
}
