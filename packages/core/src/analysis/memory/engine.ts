/**
 * Memory Engine — 04-ANALYSIS-ALGORITHMS.md v1.0 🟢 §7 (Story 2.4).
 *
 * Il motore è **incrementale per costruzione**: riceve gli ascolti, i brani e
 * gli artisti, e produce i ricordi del giorno. Ogni tipo di ricordo è un
 * generatore indipendente (04§8.1, D-A.5): i generatori si aggiungono senza
 * cambiare il contratto.
 *
 * Il testo di ogni ricordo è una **stringa resa** (D-A.4): la chiave i18n e
 * i parametri sono scelti dal generatore, la resa avviene una volta sola nel
 * motore, e nel core non compare nessuna stringa italiana.
 */

import type { Artist, Insight, ListenEvent, MemoryKind, Track } from '../../schema';
import { renderMemoryText, type Translator } from './i18n';
import { computeMemoryDerivedVersion } from './derivedVersion';
import { endOfUtcDay, startOfUtcDay, utcDayKey } from './datetime';
import { clamp01, computeMemoryScore, medianOf } from './ranking';
import { generateFirstTime } from './firstTime';
import { generateMilestone } from './milestone';
import { generateOnThisDay } from './onThisDay';
import { generateReturn } from './returnMemory';
import { generateSeasonal } from './seasonal';
import { resolveMemoryConfig, type MemoryConfig, type MemoryDraft } from './types';
import { buildWorkspace, type MemoryWorkspace } from './workspace';

/** Opzioni del motore. */
export interface MemoryEngineOptions {
  /** Resolver i18n iniettato dall'app (D-A.4). */
  readonly translator: Translator;
  /** Override dei parametri — utile per i test e per le preferenze future. */
  readonly config?: Partial<MemoryConfig>;
  /** Locale dei nomi localizzati (nome del mese). Default `it`. */
  readonly locale?: string;
  /** Istante di riferimento ("oggi"). Default: adesso. */
  readonly today?: number;
}

/** Dati grezzi su cui il motore lavora. */
export interface MemoryInput {
  readonly listens: readonly ListenEvent[];
  readonly tracks: readonly Track[];
  readonly artists: readonly Artist[];
}

/** Ricordo generato: l'insight persistibile più il suo score di rilevanza. */
export interface GeneratedMemory {
  /** Insight pronto per la persistenza (`type: 'memory'`). */
  readonly insight: Insight;
  /** Score 04§7.4: `baseScore × relevance × recency`. */
  readonly score: number;
  /** Tipo di ricordo. */
  readonly memoryKind: MemoryKind;
}

/**
 * Id deterministico dell'insight.
 *
 * Ricostruire il ricordo di un giorno non deve creare un duplicato: l'id
 * dipende dal giorno e dal soggetto del ricordo, non da un UUID casuale.
 */
export function memoryInsightId(periodStart: number, draft: MemoryDraft): string {
  const day = utcDayKey(periodStart);
  const suffix = draft.discriminator.replace(/[^A-Za-z0-9_-]/g, '_');
  return `mem-${day}-${draft.memoryKind}-${suffix}`;
}

/** Motore dei ricordi. */
export class MemoryEngine {
  private readonly translator: Translator;
  private readonly config: MemoryConfig;
  private readonly locale: string;
  private readonly today: number;
  private versionPromise: Promise<string> | null = null;

  constructor(options: MemoryEngineOptions) {
    this.translator = options.translator;
    this.config = resolveMemoryConfig(options.config);
    this.locale = options.locale ?? 'it';
    this.today = options.today ?? Date.now();
  }

  /** Parametri effettivi del motore. */
  get parameters(): MemoryConfig {
    return this.config;
  }

  /** `derivedVersion` calcolata dai parametri — 04§9. */
  async derivedVersion(): Promise<string> {
    this.versionPromise ??= computeMemoryDerivedVersion(this.config);
    return this.versionPromise;
  }

  /**
   * Genera i ricordi del giorno, ordinati per rilevanza (score decrescente).
   *
   * L'ordinamento è deterministico: a parità di score si ordina per id, che
   * dipende dal giorno e dal soggetto del ricordo.
   */
  async generate(input: MemoryInput): Promise<GeneratedMemory[]> {
    const workspace = buildWorkspace({
      listens: input.listens,
      tracks: input.tracks,
      artists: input.artists,
      today: this.today,
      locale: this.locale,
      config: this.config,
    });

    const drafts = this.collectDrafts(workspace);
    const medianTrackCount = medianOf(drafts.map((draft) => draft.trackCount));
    const scored = drafts.map((draft) => ({
      draft,
      score: computeMemoryScore(
        draft.memoryKind,
        draft.trackCount,
        medianTrackCount,
        draft.daysAgo,
      ),
    }));

    const maxScore = scored.reduce((max, item) => Math.max(max, item.score), 0);
    const derivedVersion = await this.derivedVersion();

    const generated = scored.map((item) => ({
      insight: this.toInsight(item.draft, item.score, maxScore, derivedVersion),
      score: item.score,
      memoryKind: item.draft.memoryKind,
    }));

    return generated.sort((a, b) => b.score - a.score || a.insight.id.localeCompare(b.insight.id));
  }

  /** Chiama i cinque generatori — 04§7.2. */
  private collectDrafts(workspace: MemoryWorkspace): MemoryDraft[] {
    return [
      ...generateOnThisDay(workspace),
      ...generateFirstTime(workspace),
      ...generateMilestone(workspace),
      ...generateReturn(workspace),
      ...generateSeasonal(workspace),
    ];
  }

  /** Trasforma un ricordo non reso nell'insight persistibile. */
  private toInsight(
    draft: MemoryDraft,
    score: number,
    maxScore: number,
    derivedVersion: string,
  ): Insight {
    const text = renderMemoryText(this.translator, draft.templateKey, draft.templateParams);
    const periodStart = startOfUtcDay(this.today);
    const periodEnd = endOfUtcDay(this.today);
    return {
      id: memoryInsightId(periodStart, draft),
      type: 'memory',
      periodStart,
      periodEnd,
      payload: {
        kind: 'memory',
        memoryKind: draft.memoryKind,
        trackId: draft.trackId,
        artistId: draft.artistId,
        yearsAgo: draft.yearsAgo,
        text,
      },
      // Il payload è chiuso (02§4): non ha un campo score. La rilevanza
      // ordinata vive in `confidence`, normalizzata sul batch del giorno.
      confidence: maxScore > 0 ? clamp01(score / maxScore) : 0,
      derivedVersion,
      status: 'pending',
      userNote: null,
      createdAt: Date.now(),
    };
  }
}
