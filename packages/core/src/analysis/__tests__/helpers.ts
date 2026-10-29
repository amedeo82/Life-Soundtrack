import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  Artist,
  AudioFeatures,
  Insight,
  ListenEvent,
  MemoryPayload,
  MoodPeriodPayload,
  Track,
} from '../../schema';
import type { MemoryTemplateParams, Translator } from '../memory';

/**
 * Helper dei test del memory engine.
 *
 * Non è un file di test: non include asserzioni né si registra a hook.
 *
 * I test leggono i **locale reali dell'app** (`apps/web/src/i18n/locales`):
 * il resolver i18n è il contratto fra il core e l'app (D-A.4), e un test
 * che usa una copia dei template nel test passerebbe anche se l'app perdesse
 * una chiave.
 */

/** Fixture di scenario di vita — 10-TESTING.md §3.3. */
export interface ScenarioFixture {
  readonly listens: ListenEvent[];
  readonly tracks: Track[];
  readonly artists: Artist[];
  /** Attesa dichiarata dal fixture (`_metadata.expectedInsights`). */
  readonly expectedInsights: Readonly<Record<string, unknown>>;
}

/** Nomi dei fixture di scenario disponibili. */
export const SCENARIOS = ['lockdown-2020', 'breakup-oct2021', 'summer-roadtrip'] as const;

/** Carica un fixture di scenario. */
export function loadScenario(name: (typeof SCENARIOS)[number]): ScenarioFixture {
  const path = fileURLToPath(
    new URL(`../../../../../fixtures/scenarios/${name}.json`, import.meta.url),
  );
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    listens: ListenEvent[];
    tracks: Track[];
    artists: Artist[];
    _metadata: { expectedInsights: Record<string, unknown> };
  };
  return {
    listens: raw.listens,
    tracks: raw.tracks,
    artists: raw.artists,
    expectedInsights: raw._metadata?.expectedInsights ?? {},
  };
}

/**
 * Payload di memoria di un insight.
 *
 * `Insight.payload` è l'unione discriminata di 02§4: per leggere i campi
 * (`text`, `yearsAgo`, …) il tipo va prima ristretto a `MemoryPayload`.
 */
export function memoryPayloadOf(insight: Insight): MemoryPayload {
  if (insight.payload.kind !== 'memory') {
    throw new Error(`Insight ${insight.id} is not a memory insight`);
  }
  return insight.payload;
}

/**
 * Payload di mood di un insight.
 *
 * Come `memoryPayloadOf`, ma per `MoodPeriodPayload` (02§4).
 */
export function moodPayloadOf(insight: Insight): MoodPeriodPayload {
  if (insight.payload.kind !== 'mood') {
    throw new Error(`Insight ${insight.id} is not a mood insight`);
  }
  return insight.payload;
}

/** Profilo di mood sintetico: intervalli di valence ed energy. */
export interface MoodProfile {
  /** Valence minima (inclusa). */
  readonly valenceMin: number;
  /** Valence massima (esclusa). */
  readonly valenceMax: number;
  /** Energy minima (inclusa). */
  readonly energyMin: number;
  /** Energy massima (esclusa). */
  readonly energyMax: number;
}

/**
 * Feature audio **sintetiche** per i brani di uno scenario.
 *
 * La pipeline di arricchimento (EPIC 4.1, issue #188) non è ancora
 * implementata: nessun provider scrive oggi feature vere. I test del mood
 * tracker hanno quindi bisogno di feature deterministiche, costruite dal
 * profilo di mood dello scenario (il profilo **non** è una feature: è
 * l'input del generatore di test).
 *
 * La generazione è **deterministica**: il seme deriva dall'id del brano
 * (hash FNV-1a) e il PRNG è mulberry32, lo stesso del generatore dei fixture
 * (`scripts/generate-fixtures.mjs`). Stesso brano → stesse feature, sempre.
 *
 * @param tracks - brani dello scenario.
 * @param profile - intervalli di valence ed energy.
 * @param source - sorgente dichiarata (default `essentia`: misurata).
 */
export function syntheticFeaturesFor(
  tracks: readonly Track[],
  profile: MoodProfile,
  source: AudioFeatures['source'] = 'essentia',
): AudioFeatures[] {
  return tracks.map((track) => {
    const random = mulberry32(hashString(track.id));
    const valence = profile.valenceMin + random() * (profile.valenceMax - profile.valenceMin);
    const energy = profile.energyMin + random() * (profile.energyMax - profile.energyMin);
    return {
      trackId: track.id,
      valence: round4(valence),
      energy: round4(energy),
      danceability: null,
      acousticness: null,
      instrumentalness: null,
      speechiness: null,
      liveness: null,
      tempo: null,
      key: null,
      mode: null,
      loudness: null,
      timeSignature: null,
      source,
      fetchedAt: 0,
      schemaVersion: 1,
    };
  });
}

/** Hash FNV-1a a 32 bit, deterministico e cross-platform. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** PRNG mulberry32 (identico al generatore dei fixture). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arrotondamento a quattro decimali: numeri stabili nelle asserzioni. */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Carica i locale dell'app (chiavi piatte `namespace.scope.key`, 08§1). */
export function loadAppLocale(lang: 'it' | 'en'): Record<string, string> {
  const path = fileURLToPath(
    new URL(`../../../../../apps/web/src/i18n/locales/${lang}.json`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
}

/** Chiamata al resolver, registrata per le asserzioni. */
export interface RecordedCall {
  readonly key: string;
  readonly params: MemoryTemplateParams;
}

/** Resolver che registra le chiamate. */
export interface TestTranslator extends Translator {
  readonly calls: RecordedCall[];
}

/**
 * Resolver minimale sui locale reali dell'app.
 *
 * Riproduce il comportamento di i18next che serve al memory engine:
 * interpolazione `{{param}}` e plurali con suffisso `_one` / `_other`
 * (08§3), selezionati dal parametro `count`.
 */
export function createLocaleTranslator(lang: 'it' | 'en'): TestTranslator {
  const resources = loadAppLocale(lang);
  const calls: RecordedCall[] = [];
  return {
    calls,
    translate(key: string, params?: MemoryTemplateParams): string {
      calls.push({ key, params: params ?? {} });
      const count = params?.count;
      let template: string | undefined;
      if (typeof count === 'number') {
        template = resources[`${key}_${count === 1 ? 'one' : 'other'}`];
      }
      template ??= resources[key];
      if (template === undefined) return '';
      return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
        const value = params?.[name];
        return value === undefined ? '' : String(value);
      });
    },
  };
}
