/**
 * `derivedVersion` del classificatore di contesto — 19-GEO-CONTEXT.md §5.2,
 * MIG-3 (`02-DATA-SCHEMA.md` §7).
 *
 *     derivedVersion = sha1(JSON.stringify(configObject)).slice(0, 8)
 *
 * Il config object contiene **tutti** i parametri dell'algoritmo: quando un
 * parametro cambia (una soglia, una finestra, la banda oraria) cambia la
 * versione, i periodi vecchi diventano `stale` e vengono ricalcolati al
 * prossimo avvio. È la stessa formula del mood tracker (`04§9`).
 */

import { sha1Hex } from '../adapters/crypto';
import type { ContextConfig } from './types';

/** Versione derivata (8 caratteri esadecimali) del set di parametri. */
export async function computeContextDerivedVersion(config: ContextConfig): Promise<string> {
  return (await sha1Hex(JSON.stringify(config))).slice(0, 8);
}
