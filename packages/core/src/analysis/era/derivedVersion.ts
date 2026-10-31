/**
 * `derivedVersion` dell'era detector — 04§1.1 e §9.
 *
 *     derivedVersion = sha1(JSON.stringify(configObject)).slice(0, 8)
 *
 * Il config object contiene **tutti** i parametri dell'algoritmo: quando un
 * parametro cambia, cambia la versione, le ere vecchie diventano `stale` e
 * vengono ricalcolate al prossimo avvio (MIG-3, 02§7).
 */

import { sha1Hex } from '../../adapters/crypto';
import type { EraConfig } from './types';

/** Versione derivata (8 caratteri esadecimali) del set di parametri. */
export async function computeEraDerivedVersion(config: EraConfig): Promise<string> {
  return (await sha1Hex(JSON.stringify(config))).slice(0, 8);
}
