/**
 * Orchestratore dell'analisi — 04-ANALYSIS-ALGORITHMS.md v1.0 🟢 §8.1.
 *
 * Il codice dell'orchestratore è **il contratto**, i generatori sono
 * plug-in (decisione D-A.5): ogni generatore è indipendente dagli altri e
 * riceve gli stessi input. La prima tranche (Story 2.4) implementa **solo il
 * memory engine**; mood tracker, session segmentation, pattern analyzer, era
 * detector ed event detector si aggiungeranno senza modificare il contratto,
 * come i sink di scrobbling si sono aggiunti al registry senza modificare
 * `PlatformAdapter` (ADR-0011 V1).
 */

import type { Artist, Insight, ListenEvent, Track } from '../schema';
import { MemoryEngine, type MemoryConfig } from './memory';
import type { Translator } from './memory';

/** Dati che il pipeline consegna a ogni generatore. */
export interface AnalysisInput {
  /** Tutti gli ascolti (l'engine di memoria li usa per la sua finestra). */
  readonly listens: readonly ListenEvent[];
  /** Brani. */
  readonly tracks: readonly Track[];
  /** Artisti. */
  readonly artists: readonly Artist[];
  /** Istante di riferimento ("oggi"), in unix ms UTC. */
  readonly today: number;
  /** Locale dell'app, per i nomi localizzati. */
  readonly locale: string;
}

/** Un generatore di insight — il plug-in del pipeline. */
export interface AnalysisGenerator {
  /** Nome del generatore ( diagnostica e test). */
  readonly name: string;
  /** Produce gli insight del proprio tipo. */
  generate(input: AnalysisInput): Promise<Insight[]>;
}

/**
 * Pipeline di analisi: esegue i generatori registrati, in ordine.
 *
 * Il perimetro della tranche corrente è deliberatamente minimo: nessun
 * generatore oltre al memory engine (04§8.1).
 */
export class AnalysisPipeline {
  private readonly generators: readonly AnalysisGenerator[];

  constructor(generators: readonly AnalysisGenerator[] = []) {
    this.generators = generators;
  }

  /** Nomi dei generatori registrati. */
  get names(): string[] {
    return this.generators.map((generator) => generator.name);
  }

  /** Esegue i generatori e concatena i loro insight. */
  async run(input: AnalysisInput): Promise<Insight[]> {
    const insights: Insight[] = [];
    for (const generator of this.generators) {
      insights.push(...(await generator.generate(input)));
    }
    return insights;
  }
}

/** Opzioni del generatore di memoria. */
export interface MemoryGeneratorOptions {
  /** Resolver i18n iniettato dall'app (D-A.4). */
  readonly translator: Translator;
  /** Override dei parametri del memory engine. */
  readonly config?: Partial<MemoryConfig>;
}

/**
 * Adatta il memory engine al contratto del pipeline.
 *
 * L'engine riceve `today` e `locale` dal pipeline (sono dati della
 * generazione, non configurazione del motore).
 */
export function createMemoryGenerator(options: MemoryGeneratorOptions): AnalysisGenerator {
  return {
    name: 'memory',
    async generate(input: AnalysisInput): Promise<Insight[]> {
      const engine = new MemoryEngine({
        translator: options.translator,
        ...(options.config ? { config: options.config } : {}),
        today: input.today,
        locale: input.locale,
      });
      const generated = await engine.generate({
        listens: input.listens,
        tracks: input.tracks,
        artists: input.artists,
      });
      return generated.map((memory) => memory.insight);
    },
  };
}
