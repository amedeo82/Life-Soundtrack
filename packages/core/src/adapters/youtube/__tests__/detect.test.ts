import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { detectYouTubeMusic, looksLikeHtml } from '../detect';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../../../../../fixtures/synthetic-history/youtube-sample.json', import.meta.url),
);

const fixtureBytes = (): Uint8Array => new Uint8Array(readFileSync(FIXTURE_PATH));

/** N eventi watch-history ben formati come array top-level. */
const sampleArray = (n: number): string =>
  JSON.stringify(
    Array.from({ length: n }, (_, i) => ({
      header: 'YouTube Music',
      title: `Watched Song ${i}`,
      titleUrl: `https://music.youtube.com/watch?v=vid_${i}`,
      time: '2024-05-01T10:00:00Z',
    })),
  );

describe('detectYouTubeMusic — JSON singolo (§2.2)', () => {
  it('array di eventi watch-history → true', async () => {
    expect(await detectYouTubeMusic(new Blob([sampleArray(3)]))).toBe(true);
  });

  it('wrapper fixture {"events":[...]} → true', async () => {
    expect(await detectYouTubeMusic(new Blob([fixtureBytes() as unknown as ArrayBuffer]))).toBe(
      true,
    );
  });

  it('array vuoto → false', async () => {
    expect(await detectYouTubeMusic(new Blob(['[]']))).toBe(false);
  });

  it('oggetti senza header/time YouTube → false', async () => {
    expect(await detectYouTubeMusic(new Blob(['[{"foo":1},{"bar":2}]']))).toBe(false);
  });

  it('cronologia search-only (header "Search") → false', async () => {
    const searchOnly = JSON.stringify([
      { header: 'Search', title: 'Searched for Queen', time: '2024-05-01T10:00:00Z' },
      { header: 'Search', title: 'Searched for Bowie', time: '2024-05-01T11:00:00Z' },
    ]);
    expect(await detectYouTubeMusic(new Blob([searchOnly]))).toBe(false);
  });

  it('maggioranza non qualificata (1 musica + 3 estranei) → false', async () => {
    const mixed = JSON.stringify([
      {
        header: 'YouTube Music',
        title: 'Watched Song',
        titleUrl: 'https://music.youtube.com/watch?v=v1',
        time: '2024-05-01T10:00:00Z',
      },
      { foo: 1 },
      { bar: 2 },
      { header: 'Search', title: 'Searched for x', time: '2024-05-01T10:00:00Z' },
    ]);
    expect(await detectYouTubeMusic(new Blob([mixed]))).toBe(false);
  });

  it('header/products coerenti ma nessun titleUrl di ascolto → false', async () => {
    const noUrl = JSON.stringify([
      { header: 'YouTube Music', title: 'Watched Song', time: '2024-05-01T10:00:00Z' },
      { header: 'YouTube Music', title: 'Watched Song 2', time: '2024-05-01T11:00:00Z' },
      { header: 'YouTube Music', title: 'Watched Song 3', time: '2024-05-01T12:00:00Z' },
    ]);
    expect(await detectYouTubeMusic(new Blob([noUrl]))).toBe(false);
  });

  it('JSON non array né oggetto → false', async () => {
    expect(await detectYouTubeMusic(new Blob(['"solo stringa"']))).toBe(false);
    expect(await detectYouTubeMusic(new Blob(['null']))).toBe(false);
  });

  it('blob vuoto → false', async () => {
    expect(await detectYouTubeMusic(new Blob([]))).toBe(false);
  });
});

describe('detectYouTubeMusic — HTML rifiutato (§2.2)', () => {
  it("contenuto <html → false (l'errore guidato error.htmlExport è lato UI)", async () => {
    const html = new Blob(['<!DOCTYPE html><html><body>Watch history</body></html>']);
    expect(await looksLikeHtml(html)).toBe(true);
    expect(await detectYouTubeMusic(html)).toBe(false);
  });
});

describe('detectYouTubeMusic — ZIP Takeout con nomi localizzati (E.YT.1)', () => {
  it('cartella "YouTube e YouTube Music" localizzata → true (detection strutturale)', async () => {
    const zip = zipSync({
      'Takeout/YouTube e YouTube Music/history/watch-history.json': fixtureBytes(),
      'Takeout/README.txt': new TextEncoder().encode('testo non json'),
    });
    expect(await detectYouTubeMusic(new Blob([zip as unknown as ArrayBuffer]))).toBe(true);
  });

  it('ZIP con soli file fuori scope (search-history) → false', async () => {
    const zip = zipSync({
      'Takeout/YouTube e YouTube Music/history/search-history.json': new TextEncoder().encode(
        JSON.stringify([
          { header: 'Search', title: 'Searched for Queen', time: '2024-05-01T10:00:00Z' },
        ]),
      ),
    });
    expect(await detectYouTubeMusic(new Blob([zip as unknown as ArrayBuffer]))).toBe(false);
  });

  it('ZIP senza alcun .json → false', async () => {
    const zip = zipSync({
      'Takeout/YouTube e YouTube Music/playlists/playlist.csv': new TextEncoder().encode('a,b'),
    });
    expect(await detectYouTubeMusic(new Blob([zip as unknown as ArrayBuffer]))).toBe(false);
  });

  it('ZIP corrotto → false (mai eccezioni dal detect)', async () => {
    const corrupt = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await detectYouTubeMusic(new Blob([corrupt as unknown as ArrayBuffer]))).toBe(false);
  });

  it('ZIP vuoto → false', async () => {
    const zip = zipSync({});
    expect(await detectYouTubeMusic(new Blob([zip as unknown as ArrayBuffer]))).toBe(false);
  });
});
