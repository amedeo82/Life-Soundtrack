import { describe, expect, it } from 'vitest';
import { formatDate, formatNumber } from '../i18n/formatter';

const sample = new Date(2024, 0, 15, 14, 30);

function normalizeSpaces(value: string): string {
  return value.replace(/\s/g, ' ');
}

describe('formatNumber (08\u00a75)', () => {
  it('migliaia: 1.000 (it) / 1,000 (en)', () => {
    expect(formatNumber(1000, 'it')).toBe('1.000');
    expect(formatNumber(1000, 'en')).toBe('1,000');
  });

  it('decimali: 0,5 (it) / 0.5 (en)', () => {
    expect(formatNumber(0.5, 'it')).toBe('0,5');
    expect(formatNumber(0.5, 'en')).toBe('0.5');
  });
});

describe('formatDate (08\u00a75)', () => {
  it('data breve: 15 gen 2024 (it) / Jan 15, 2024 (en)', () => {
    expect(formatDate(sample, 'it', 'short')).toBe('15 gen 2024');
    expect(normalizeSpaces(formatDate(sample, 'en', 'short'))).toBe('Jan 15, 2024');
  });

  it('data lunga: 15 gennaio 2024 (it) / January 15, 2024 (en)', () => {
    expect(formatDate(sample, 'it', 'long')).toBe('15 gennaio 2024');
    expect(normalizeSpaces(formatDate(sample, 'en', 'long'))).toBe('January 15, 2024');
  });

  it('ora: 14:30 (it, 24h) / 2:30 PM (en, 12h)', () => {
    expect(formatDate(sample, 'it', 'time')).toBe('14:30');
    expect(normalizeSpaces(formatDate(sample, 'en', 'time'))).toBe('2:30 PM');
  });
});
