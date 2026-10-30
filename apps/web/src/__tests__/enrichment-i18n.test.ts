import { describe, expect, it } from 'vitest';
import enLocale from '../i18n/locales/en.json';
import itLocale from '../i18n/locales/it.json';
import { createAppI18n } from '../i18n';

/**
 * I testi pubblici della pipeline delle audio features — `08-COPY-I18N.md`
 * §2.17 (namespace `enrichment.*`), deliverable T4.1.12.
 *
 * Le otto chiavi sono **vincolanti**: la coppia chiave → stato della
 * pipeline è decisa dalla spec `21-AUDIO-FEATURES.md` §14, non dalla UI.
 * Il test verifica i testi **e** il confine "stima ≠ misura": l'unica
 * chiave che può descrivere una feature euristica è
 * `enrichment.status.estimated`, e il suo testo non usa mai la parola
 * "analizzato".
 */
const KEYS = [
  'enrichment.status.queued',
  'enrichment.status.analyzing',
  'enrichment.status.done',
  'enrichment.status.estimated',
  'enrichment.status.no_audio',
  'enrichment.status.disabled',
  'enrichment.download.size',
] as const;

describe('namespace enrichment.* (08§2.17, 21§14)', () => {
  it('le sette chiavi semplici esistono in it ed en', () => {
    for (const key of KEYS) {
      expect(itLocale).toHaveProperty(key);
      expect(enLocale).toHaveProperty(key);
    }
  });

  it("il plurale dell'avviso aggregato esiste in it ed en", () => {
    expect(itLocale).toHaveProperty('enrichment.error.aggregate_one');
    expect(itLocale).toHaveProperty('enrichment.error.aggregate_other');
    expect(enLocale).toHaveProperty('enrichment.error.aggregate_one');
    expect(enLocale).toHaveProperty('enrichment.error.aggregate_other');
  });

  it('IT: i testi sono quelli dichiarati in 08§2.17', () => {
    expect(itLocale['enrichment.status.queued']).toBe('In coda');
    expect(itLocale['enrichment.status.analyzing']).toBe('In analisi');
    expect(itLocale['enrichment.status.done']).toBe('Fatto ({{source}})');
    expect(itLocale['enrichment.status.estimated']).toBe('Fatto, ma è una stima');
    expect(itLocale['enrichment.status.no_audio']).toBe('Nessun audio disponibile');
    expect(itLocale['enrichment.status.disabled']).toBe('Arricchimento spento');
    expect(itLocale['enrichment.download.size']).toBe(
      "L'analisi acustica scarica ~6 MB, una volta sola. Vuoi continuare?",
    );
  });

  it('EN: i testi sono quelli dichiarati in 08§2.17', () => {
    expect(enLocale['enrichment.status.queued']).toBe('In the queue');
    expect(enLocale['enrichment.status.analyzing']).toBe('Analyzing');
    expect(enLocale['enrichment.status.done']).toBe('Done ({{source}})');
    expect(enLocale['enrichment.status.estimated']).toBe("Done, but it's an estimate");
    expect(enLocale['enrichment.status.no_audio']).toBe('No audio available');
    expect(enLocale['enrichment.status.disabled']).toBe('Enrichment is off');
    expect(enLocale['enrichment.download.size']).toBe(
      'Acoustic analysis downloads ~6 MB, once. Do you want to continue?',
    );
  });

  it('il confine "stima ≠ misura": la stima non dice "analizzato"', () => {
    expect(itLocale['enrichment.status.estimated'].toLowerCase()).not.toContain('analizz');
    expect(enLocale['enrichment.status.estimated'].toLowerCase()).not.toContain('analyz');
  });

  it('la stima non è descritta come "fatto" da una fonte misurata', () => {
    expect(itLocale['enrichment.status.estimated']).not.toContain('{{source}}');
    expect(enLocale['enrichment.status.estimated']).not.toContain('{{source}}');
  });

  it('interpolazione della fonte e pluralizzazione del conteggio', () => {
    const it = createAppI18n({ language: 'it' });
    expect(it.t('enrichment.status.done', { source: 'Essentia' })).toBe('Fatto (Essentia)');
    expect(it.t('enrichment.error.aggregate', { count: 1 })).toBe(
      'Un brano non è stato analizzato',
    );
    expect(it.t('enrichment.error.aggregate', { count: 5 })).toBe(
      '5 brani non sono stati analizzati',
    );

    const en = createAppI18n({ language: 'en' });
    expect(en.t('enrichment.status.done', { source: 'AcousticBrainz' })).toBe(
      'Done (AcousticBrainz)',
    );
    expect(en.t('enrichment.error.aggregate', { count: 1 })).toBe(
      'One track could not be analyzed',
    );
    expect(en.t('enrichment.error.aggregate', { count: 5 })).toBe('5 tracks could not be analyzed');
  });
});
