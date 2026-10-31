/**
 * Init i18next + react-i18next per Life-Soundtrack (Story 0.6, 08-COPY-I18N §7).
 *
 * - Formato chiavi: `namespace.scope.key` come stringhe flat (08§1):
 *   `keySeparator: false` preserva le chiavi documentate, incluse le collisioni
 *   tipo `settings.privacy` (label) accanto a `settings.privacy.retainIp` (08§2.9).
 * - Plurali: formato JSON v4 i18next con suffissi `_one`/`_other` risolti via
 *   `Intl.PluralRules` — equivalente ICU `{count, plural, one {...} other {...}}`
 *   (08§3), senza plugin aggiuntivi (stack 05-ARCHITECTURE §8).
 * - Fallback: lingua mancante in una lingua → l'altra lingua (08 AC "lingua
 *   fallback se chiave mancante"); chiave ignota ovunque → stringa vuota,
 *   mai la chiave grezza e mai crash (08 AC "no {{key}}").
 */

import { createInstance, type i18n as I18nInstance, type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { detectLanguage, persistLanguage, type AppLanguage } from './detector';
import { useT, useLanguage } from './useT';
import en from './locales/en.json';
import it from './locales/it.json';

/** Namespace di 08-COPY-I18N §1, nel formato chiave `namespace.scope.key`. */
export const NAMESPACES = [
  'about',
  'onboarding',
  'home',
  'timeline',
  'era',
  'explore',
  'analysis',
  'memories',
  'share',
  'settings',
  'empty',
  'import',
  'adapter',
  'scrobble',
  'error',
  'common',
  'insight',
  'enrichment',
] as const;

const bundledResources: Resource = {
  it: { translation: it },
  en: { translation: en },
};

export interface CreateAppI18nOptions {
  /** Lingua iniziale; default: rilevamento localStorage → browser (T0.6.2). */
  language?: AppLanguage;
  /** Override risorse (test: simulare chiavi mancanti per il fallback). */
  resources?: Resource;
}

/** Crea un'istanza i18next configurata per l'app (isolata, usabile in test). */
export function createAppI18n(options: CreateAppI18nOptions = {}): I18nInstance {
  const instance = createInstance();
  instance.use(initReactI18next);
  void instance.init({
    resources: options.resources ?? bundledResources,
    lng: options.language ?? detectLanguage(),
    fallbackLng: { it: ['en'], en: ['it'], default: ['en'] },
    supportedLngs: ['it', 'en'],
    keySeparator: false,
    nsSeparator: false,
    defaultNS: 'translation',
    returnEmptyString: false,
    returnNull: false,
    pluralSeparator: '_',
    interpolation: { escapeValue: false },
    parseMissingKeyHandler: () => '',
  });
  return instance;
}

/** Istanza singleton dell'app; importata per side-effect da `main.tsx`. */
export const i18n = createAppI18n();

/**
 * Cambia lingua a caldo (AC "switch IT↔EN senza reload": i componenti
 * react-i18next ricalcolano al `languageChanged`) e la persiste in
 * localStorage per il prossimo avvio.
 */
export async function setLanguage(lang: AppLanguage, instance: I18nInstance = i18n): Promise<void> {
  await instance.changeLanguage(lang);
  persistLanguage(lang);
}

export { useT, useLanguage };
export type { TFunction } from 'i18next';

/**
 * Resolver i18n per il memory engine (04§7.3.1, D-A.4): il testo del
 * ricordo è una stringa resa, resa dal resolver iniettato dall'app.
 */
export { createI18nTranslator } from './translator';
