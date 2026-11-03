import { describe, expect, it } from 'vitest';
import { memoryChapterBlob, renderMemoryChapterHtml } from '../renderMemoryChapter';

/** L'input di base, con un brano simbolo. */
const INPUT = {
  title: 'Il tuo primo ascolto',
  periodLabel: '3 marzo 2019',
  eraName: 'Laurea',
  symbolTrack: { name: 'Intro', artist: 'The xx', artworkUrl: 'https://example.test/a.jpg' },
  artworks: [{ url: 'https://example.test/a.jpg', mood: null }],
} as const;

describe('renderMemoryChapterHtml', () => {
  it('contiene il contenuto del capitolo', () => {
    const html = renderMemoryChapterHtml(INPUT);
    expect(html).toContain('Il tuo primo ascolto');
    expect(html).toContain('3 marzo 2019');
    expect(html).toContain('Laurea');
    expect(html).toContain('Intro');
    expect(html).toContain('The xx');
    expect(html).toContain('https://example.test/a.jpg');
  });

  it('è un documento autonomo: nessuno script, nessuno stile esterno', () => {
    const html = renderMemoryChapterHtml(INPUT);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('stylesheet');
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('escapa i caratteri che hanno significato in HTML', () => {
    const html = renderMemoryChapterHtml({
      ...INPUT,
      title: '<script>alert("x")</script>',
      eraName: 'A & B',
    });
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<script>');
    expect(html).toContain('lt;script');
    expect(html).toContain('amp; B');
  });

  it('senza copertine disegna il segnaposto', () => {
    const html = renderMemoryChapterHtml({
      ...INPUT,
      symbolTrack: null,
      artworks: [{ url: null, mood: null }],
    });
    expect(html).toContain('placeholder');
    expect(html).not.toContain('<img');
  });
});

describe('memoryChapterBlob', () => {
  it('produce un Blob HTML', () => {
    const blob = memoryChapterBlob(INPUT);
    expect(blob.type).toContain('text/html');
    expect(blob.size).toBeGreaterThan(0);
  });
});
