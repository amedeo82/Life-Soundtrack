import { describe, expect, it } from 'vitest';
import { createAppI18n } from '../i18n';
import { createI18nTranslator } from '../i18n/translator';

/**
 * Test del resolver i18n del memory engine — 04§7.3.1 (D-A.4) e 08§2.15.
 *
 * Il punto è che i template usati dal core esistono **davvero** nei locale
 * dell'app e che i18next ne gestisce i plurali con il parametro `count`.
 */
describe('resolver i18n dei ricordi (04§7.3.1, D-A.4)', () => {
  it('rende il template on_this_day in italiano', () => {
    const translator = createI18nTranslator(createAppI18n({ language: 'it' }));
    expect(
      translator.translate('insight.memory.on_this_day', {
        years: 3,
        track: 'Notte Bianca',
        artist: 'Aurora Boreale',
      }),
    ).toBe('3 anni fa ascoltavi "Notte Bianca" di Aurora Boreale');
  });

  it('rende il template on_this_day in inglese', () => {
    const translator = createI18nTranslator(createAppI18n({ language: 'en' }));
    expect(
      translator.translate('insight.memory.on_this_day', {
        years: 3,
        track: 'Notte Bianca',
        artist: 'Aurora Boreale',
      }),
    ).toBe('3 years ago you were listening to "Notte Bianca" by Aurora Boreale');
  });

  it('rende i plurali dei milestone con il parametro count', () => {
    const it = createI18nTranslator(createAppI18n({ language: 'it' }));
    expect(it.translate('insight.memory.milestone.events', { count: 1 })).toBe(
      'Hai raggiunto 1 brano ascoltato!',
    );
    expect(it.translate('insight.memory.milestone.events', { count: 5000 })).toBe(
      'Hai raggiunto 5000 brani ascoltati!',
    );
    expect(it.translate('insight.memory.milestone.hours', { count: 100 })).toBe(
      'Hai raggiunto 100 ore di ascolto!',
    );
    expect(it.translate('insight.memory.milestone.artists', { count: 500 })).toBe(
      'Hai raggiunto 500 artisti unici!',
    );
  });

  it('rende i template return e seasonal con i loro parametri', () => {
    const it = createI18nTranslator(createAppI18n({ language: 'it' }));
    expect(it.translate('insight.memory.return', { artist: 'Eco', months: 6 })).toBe(
      'Non ascoltavi Eco da 6 mesi',
    );
    expect(it.translate('insight.memory.seasonal', { month: 'marzo', genre: 'rock' })).toBe(
      'Come ogni marzo, è tornato il periodo rock',
    );
  });

  it('una chiave inesistente produce una stringa vuota, mai la chiave grezza', () => {
    const it = createI18nTranslator(createAppI18n({ language: 'it' }));
    expect(it.translate('insight.memory.not.a.key')).toBe('');
  });
});
