/**
 * Orchestratore dell'analisi — 04-ANALYSIS-ALGORITHMS.md v1.0 🟢 §8.1.
 *
 * Il codice dell'orchestratore è **il contratto**, i generatori sono
 * plug-in (decisione D-A.5): ogni generatore è indipendente dagli altri e
 * riceve gli stessi input. La tranche corrente implementa il **memory
 * engine** (04§7) e il **mood tracker** (04§3); session segmentation,
 * pattern analyzer, era detector ed event detector si aggiungeranno senza
 * modificare il contratto, come i sink di scrobbling si sono aggiunti al
 * registry senza modificare `PlatformAdapter` (ADR-0011 V1).
 */

import type { Logger } from '../logger';
import type { Artist, AudioFeatures, Insight, ListenEvent, Track } from '../schema';
import { MemoryEngine, type MemoryConfig } from './memory';
import type { Translator } from './memory';
import { MoodEngine, type MoodConfig, type MoodPeriod } from './mood';

/** Dati che il pipeline consegna a ogni generatore. */
export interface AnalysisInput {
  /** Tutti gli ascolti (l'engine di memoria li usa per la sua finestra). */
  readonly listens: readonly ListenEvent[];
  /** Brani. */
  readonly tracks: readonly Track[];
  /** Artisti. */
  readonly artists: readonly Artist[];
  /**
   * Feature audio disponibili.
   *
   * Le legge solo il mood tracker (04§3.3) e solo quelle **misurate o
   * manuali**: il filtro per sorgente è applicato dal generatore
   * (`21-AUDIO-FEATURES.md` §12, D-AF.4). È opzionale perché i generatori
   * che non ne hanno bisogno non devono pagare il costo di caricarle.
   */
  readonly features?: readonly AudioFeatures[];
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
 * generatore oltre a quelli implementati (04§8.1).
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

/** Opzioni del generatore di mood. */
export interface MoodGeneratorOptions {
  /** Override dei parametri del mood tracker. */
  readonly config?: Partial<MoodConfig>;
  /** Periodi aggregati (default: giorno, settimana e mese). */
  readonly periods?: readonly MoodPeriod[];
  /**
   * Logger per il warning aggregato sulle feature mancanti (04§1.4).
   *
   * Opzionale: senza logger il generatore non emette warning.
   */
  readonly logger?: Logger | undefined;
}

/**
 * Adatta il mood tracker al contratto del pipeline.
 *
 * Il generatore passa al motore gli ascolti e le feature ricevute: il filtro
 * per sorgente (misurate o manuali) è applicato dal motore
 * (`21-AUDIO-FEATURES.md` §12).
 */
export function createMoodGenerator(options: MoodGeneratorOptions = {}): AnalysisGenerator {
  return {
    name: 'mood',
    async generate(input: AnalysisInput): Promise<Insight[]> {
      const engine = new MoodEngine({
        ...(options.config ? { config: options.config } : {}),
        ...(options.periods ? { periods: options.periods } : {}),
        ...(options.logger ? { logger: options.logger } : {}),
      });
      const generated = await engine.generate({
        listens: input.listens,
        features: input.features ?? [],
      });
      return generated.map((mood) => mood.insight);
    },
  };
}
