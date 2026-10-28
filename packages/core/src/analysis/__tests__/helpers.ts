import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Artist, Insight, ListenEvent, MemoryPayload, Track } from '../../schema';
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
  };
  return { listens: raw.listens, tracks: raw.tracks, artists: raw.artists };
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
