/**
 * Adapter app per il runner di analisi — 23-ANALYSIS-PIPELINE.md v1.0 🟢.
 *
 * Responsabilità: aprire il DB, costruire il Translator dall'istanza i18next,
 * chiamare runAnalysisPipeline, loggare il report e **non propagare errori
 * al chiamante** (un fallimento dell'analisi non deve far fallire l'import).
 */

import { openDb, type LifeSoundtrackDB } from '@core/db';
import { runAnalysisPipeline, type AnalysisRunReport } from '@core/analysis';
import { createI18nTranslator } from '../i18n/translator';
import type { i18n as I18nInstance } from 'i18next';
import { createLogger } from '@core/logger';

/** Interfaccia del runner per l'app. */
export interface AnalysisRunner {
  /** Avvia l'analisi per la ragione data. */
  run(reason: 'post-import' | 'manual' | 'on-demand'): Promise<AnalysisRunReport>;
  /** Restituisce true se un'analisi è in corso. */
  isRunning(): boolean;
}

/** Dipendenze iniettate per creare il runner. */
export interface AnalysisRunnerDeps {
  /** Istanza i18next dell'app. */
  readonly i18n: I18nInstance;
  /** Logger opzionale (default: console logger). */
  readonly logger?: ReturnType<typeof createLogger>;
  /**
   * Il database da analizzare (default: quello dell'utente).
   *
   * La **demo** (Story 3.5) analizza il proprio database separato: senza
   * questa iniezione il runner aprirebbe sempre il database dell'utente e
   * la demo resterebbe senza ere né mood.
   */
  readonly db?: LifeSoundtrackDB | undefined;
}

/**
 * Crea l'adapter app per l'analisi.
 *
 * Non propaga errori: cattura e logga, ritorna un report con produced=0.
 */
export function createAnalysisRunner(deps: AnalysisRunnerDeps): AnalysisRunner {
  let running = false;
  let dbPromise: Promise<LifeSoundtrackDB> | null = null;

  const logger = deps.logger ?? createLogger('analysis:runner');
  const translator = createI18nTranslator(deps.i18n);

  /** Ottiene (o crea) la connessione DB. */
  const getDb = (): Promise<LifeSoundtrackDB> => {
    if (!dbPromise) {
      dbPromise = deps.db ? Promise.resolve(deps.db) : openDb();
    }
    return dbPromise;
  };

  return {
    async run(reason) {
      if (running) {
        logger.warn('analisi già in corso, salto', { reason });
        return {
          produced: {} as AnalysisRunReport['produced'],
          replaced: {} as AnalysisRunReport['replaced'],
          skipped: 0,
          durationMs: 0,
          missingFeatures: 0,
        };
      }

      running = true;
      const startTime = Date.now();

      try {
        const db = await getDb();
        const report = await runAnalysisPipeline({
          db,
          translator,
          logger,
        });
        return report;
      } catch (error) {
        logger.error('analisi fallita', {
          reason,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        });
        // Non propaga: ritorna report vuoto
        return {
          produced: {} as AnalysisRunReport['produced'],
          replaced: {} as AnalysisRunReport['replaced'],
          skipped: 0,
          durationMs: Date.now() - startTime,
          missingFeatures: 0,
        };
      } finally {
        running = false;
      }
    },

    isRunning() {
      return running;
    },
  };
}
