import { beforeEach, describe, expect, it } from 'vitest';
import enLocale from '../i18n/locales/en.json';
import itLocale from '../i18n/locales/it.json';
import { createAppI18n, i18n as appI18n, NAMESPACES, setLanguage } from '../i18n';
import {
  detectLanguage,
  LANGUAGE_STORAGE_KEY,
  persistLanguage,
  readStoredLanguage,
} from '../i18n/detector';

describe('init i18next (T0.6.1)', () => {
  it('inizializza il singleton dell\u2019app con una lingua supportata', () => {
    expect(appI18n.isInitialized).toBe(true);
    expect(['it', 'en']).toContain(appI18n.language);
  });

  it('risolve chiavi nel formato namespace.scope.key di 08\u00a71', () => {
    const i = createAppI18n({ language: 'it' });
    expect(i.t('onboarding.welcome.title')).toBe('La colonna sonora della tua vita');
    expect(i.t('home.greeting', { name: 'Amedeo' })).toBe('Ciao, Amedeo \u{1F44B}');
  });

  it('interpolazione variabili 08\u00a74', () => {
    const i = createAppI18n({ language: 'it' });
    expect(i.t('adapter.spotify.wrongFormat', { platform: 'Apple Music' })).toBe(
      'Questo file sembra di Apple Music, non di Spotify',
    );
  });
});

describe('parity chiavi 08\u00a72 (AC: tutte le chiavi importate)', () => {
  const itKeys = Object.keys(itLocale).sort();
  const enKeys = Object.keys(enLocale).sort();

  it('lingue it ed en con esattamente lo stesso set di chiavi', () => {
    expect(enKeys).toEqual(itKeys);
  });

  it('ogni chiave appartiene a un namespace di 08\u00a71', () => {
    const orphans = itKeys.filter(
      (key) => !NAMESPACES.some((ns) => key === ns || key.startsWith(`${ns}.`)),
    );
    expect(orphans).toEqual([]);
  });

  it('copre le chiavi rappresentative di ogni sezione 08\u00a72.1-2.15', () => {
    for (const key of [
      'onboarding.privacy.cta',
      'home.stats.tracks',
      'timeline.granularity.years',
      'era.moodDominant',
      'explore.noResults',
      'analysis.moods.happy',
      'memories.onThisDay',
      'share.copied',
      'settings.privacy',
      'settings.privacy.retainIp',
      'empty.cta.demo',
      'import.status.error',
      'adapter.spotify.detect.fail',
      'error.dbCritical',
      'common.search',
      'insight.disclaimer',
    ]) {
      expect(itLocale).toHaveProperty(key);
      expect(enLocale).toHaveProperty(key);
    }
  });

  it('preserva le collisioni chiave di 08\u00a72.9 (label + sotto-chiavi)', () => {
    expect(itLocale['settings.privacy']).toBe('Privacy');
    expect(itLocale['settings.privacy.retainIp']).toBe('Conserva indirizzi IP');
    expect(itLocale['settings.data']).toBe('Dati');
    expect(itLocale['settings.data.export']).toBe('Esporta tutto (JSON)');
  });

  it('valori EN dal documento 08\u00a72', () => {
    expect(enLocale['onboarding.welcome.title']).toBe('The soundtrack of your life');
    expect(enLocale['error.fileTooLarge']).toBe('File too large (max 500MB)');
  });
});

describe('pluralizzazione 08\u00a73 (AC: plurali corretti)', () => {
  it('IT: one/other per onboarding.processing.events', () => {
    const i = createAppI18n({ language: 'it' });
    expect(i.t('onboarding.processing.events', { count: 1 })).toBe('1 evento analizzato');
    expect(i.t('onboarding.processing.events', { count: 5 })).toBe('5 eventi analizzati');
  });

  it('EN: one/other per onboarding.processing.events', () => {
    const i = createAppI18n({ language: 'en' });
    expect(i.t('onboarding.processing.events', { count: 1 })).toBe('1 event analyzed');
    expect(i.t('onboarding.processing.events', { count: 5 })).toBe('5 events analyzed');
  });

  it('chiave con variabile pluralizzata non-standard (memories.yearsAgo, var {n})', () => {
    const i = createAppI18n({ language: 'it' });
    expect(i.t('memories.yearsAgo', { n: 1, count: 1 })).toBe('1 anno fa');
    expect(i.t('memories.yearsAgo', { n: 12, count: 12 })).toBe('12 anni fa');
  });

  it('plurali import.status.done (08\u00a72.11)', () => {
    const i = createAppI18n({ language: 'en' });
    expect(i.t('import.status.done', { count: 3 })).toBe('3 events found');
  });

  it('chiave plurale di esempio 08\u00a73 (import.info.events)', () => {
    const i = createAppI18n({ language: 'it' });
    expect(i.t('import.info.events', { count: 1 })).toBe('1 evento');
    expect(i.t('import.info.events', { count: 10 })).toBe('10 eventi');
  });
});

describe('fallback lingua (AC: no crash, no chiave grezza)', () => {
  it('chiave mancante nella lingua attiva \u2192 lingua fallback', () => {
    const i = createAppI18n({
      language: 'en',
      resources: { it: { translation: itLocale }, en: { translation: { 'common.save': 'Save' } } },
    });
    expect(i.t('common.save')).toBe('Save');
    expect(i.t('onboarding.welcome.title')).toBe('La colonna sonora della tua vita');
  });

  it('chiave ignota ovunque \u2192 stringa vuota, mai la chiave grezza', () => {
    const i = createAppI18n({ language: 'it' });
    expect(i.t('totally.unknown.key')).toBe('');
  });

  it('valore vuoto in lingua attiva \u2192 fallback, non stringa vuota', () => {
    const i = createAppI18n({
      language: 'en',
      resources: {
        it: { translation: itLocale },
        en: { translation: { 'common.save': '', 'other.key': 'x' } },
      },
    });
    expect(i.t('common.save')).toBe('Salva');
  });
});

describe('language detector (T0.6.2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('localStorage vince sul browser', () => {
    expect(detectLanguage({ getStored: () => 'en', navigatorLanguage: 'it-IT' })).toBe('en');
  });

  it('valore stored non supportato viene ignorato', () => {
    expect(detectLanguage({ getStored: () => 'fr', navigatorLanguage: 'it-IT' })).toBe('it');
  });

  it('browser it-* \u2192 it', () => {
    expect(detectLanguage({ navigatorLanguage: 'it-IT' })).toBe('it');
  });

  it('browser non italiano \u2192 en (default internazionale)', () => {
    expect(detectLanguage({ navigatorLanguage: 'en-US' })).toBe('en');
    expect(detectLanguage({ navigatorLanguage: 'fr-FR' })).toBe('en');
    expect(detectLanguage({ getStored: () => null })).toBe('en');
  });

  it('integrazione con localStorage reale', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'it');
    expect(detectLanguage()).toBe('it');
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    expect(detectLanguage()).toBe('en');
  });

  it('storage che lancia (private mode) non fa crashare lettura né scrittura', () => {
    const throwing = {
      getItem: () => {
        throw new Error('quota');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readStoredLanguage(throwing)).toBe(null);
    expect(() => persistLanguage('it', throwing)).not.toThrow();
  });

  it('setLanguage persiste la scelta per il prossimo avvio', async () => {
    const i = createAppI18n({ language: 'en' });
    await setLanguage('it', i);
    expect(i.language).toBe('it');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('it');
  });
});
