/**
 * La **modalità demo** — Story 3.5, spec `docs/26-ONBOARDING-DEMO.md` v1.0.
 *
 * Tre pezzi, nessuno dei quali tocca il database dell'utente:
 *
 * 1. `loadDemoFixture()` carica il fixture locale `fixtures/demo-user.json`
 *    (1 anno di storia sintetica, 4 500 eventi). Il caricamento è **lazy**:
 *    il fixture diventa un chunk separato, scaricato solo quando l'utente
 *    chiede la demo.
 * 2. `startDemo()` popola il **database demo** (`life-soundtrack-demo`) e ci
 *    lancia sopra la pipeline di analisi: senza analisi la demo mostrerebbe
 *    una timeline vuota di ere e mood (D-26.2).
 * 3. `stopDemo()` cancella il database demo con un click (`06§2.14`).
 *
 * La demo è **dichiarata**: i dati sono sintetici e l'utente lo vede dalla
 * banner in cima all'app (D-26.3).
 */

import {
  DEMO_DB_NAME,
  clearDemoDatabase,
  openDb,
  seedDemoDatabase,
  type DemoFixture,
  type LifeSoundtrackDB,
} from '@core/db';
import { createLogger } from '@core/logger';
import { createAnalysisRunner } from '../analysis/analysisRunner';
import { i18n } from '../i18n';

/**
 * Il fixture demo, caricato **su richiesta**.
 *
 * Il `?raw` evita che TypeScript inferisca il tipo letterale di un JSON da
 * 3,6 MB (il typecheck impiegherebbe minuti): il testo viene parsato a
 * runtime e tipizzato da `DemoFixture`.
 */
export async function loadDemoFixture(): Promise<DemoFixture> {
  const module = await import('../../../../fixtures/demo-user.json?raw');
  return JSON.parse(module.default) as DemoFixture;
}

/**
 * Prepara il diario di esempio.
 *
 * Restituisce il database demo **pronto**: popolato e analizzato.
 */
export async function startDemo(): Promise<LifeSoundtrackDB> {
  const fixture = await loadDemoFixture();
  const db = await openDb(DEMO_DB_NAME);
  await seedDemoDatabase(db, fixture);
  const runner = createAnalysisRunner({
    i18n,
    logger: createLogger('demo:analysis'),
    db,
  });
  await runner.run('post-import');
  return db;
}

/** Cancella il database demo: il click che chiude la demo. */
export async function stopDemo(): Promise<void> {
  await clearDemoDatabase(DEMO_DB_NAME);
}
