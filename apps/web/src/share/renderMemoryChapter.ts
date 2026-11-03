/**
 * Il capitolo statico in HTML — Story 3.2, AC «export statico alternativo»
 * dell'issue #241.
 *
 * È la **stessa** cosa della card PNG, in un altro formato: un capitolo
 * autonomo (copertine, periodo, era, brano simbolo) che si apre nel browser
 * senza dipendenze. Non è un'export del database: quello è la Story 5.2.
 *
 * Il documento è ** autonomo**: nessun foglio di stile esterno, nessun
 * script, nessuna richiesta di rete. Le copertine remote sono referenziate
 * come URL assoluti (le stesse immagini che si vedono nell'app); se non
 * sono raggiungibili, il capitolo resta leggibile.
 */

import type { MoodId } from '@core/schema';

/** L'input del capitolo: le stesse cose della card. */
export interface MemoryChapterInput {
  /** Il testo del ricordo, già reso. */
  readonly title: string;
  /** Il periodo, già reso. */
  readonly periodLabel: string;
  /** Il nome dell'era. */
  readonly eraName: string | null;
  /** Il brano simbolo. */
  readonly symbolTrack: {
    readonly name: string;
    readonly artist: string;
    readonly artworkUrl: string | null;
  } | null;
  /** Le copertine. */
  readonly artworks: readonly { readonly url: string | null; readonly mood: MoodId | null }[];
}

/** Escappa i caratteri che hanno significato in HTML. */
function escapeHtml(text: string): string {
  const amp = String.fromCodePoint(38);
  return text
    .replace(/&/g, amp + 'amp;')
    .replace(/</g, amp + 'lt;')
    .replace(/>/g, amp + 'gt;')
    .replace(/"/g, amp + 'quot;');
}

/** Il capitolo, come documento HTML autonomo. */
export function renderMemoryChapterHtml(input: MemoryChapterInput): string {
  const artworks = input.artworks
    .map((artwork) =>
      artwork.url
        ? `      <img src="${escapeHtml(artwork.url)}" alt="" />`
        : '      <div class="placeholder" aria-hidden="true"></div>',
    )
    .join('\n');

  const symbol = input.symbolTrack
    ? `    <p class="track"><strong>${escapeHtml(input.symbolTrack.name)}</strong> — ${escapeHtml(
        input.symbolTrack.artist,
      )}</p>`
    : '';

  const era = input.eraName ? `    <h2>${escapeHtml(input.eraName)}</h2>` : '';

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        padding: 2rem;
        background: #12121a;
        color: #f4f2ff;
        font-family: Inter, system-ui, sans-serif;
      }
      main { max-width: 42rem; margin: 0 auto; }
      .period { color: #a78bfa; font-weight: 600; }
      h1 { font-size: 2rem; line-height: 1.2; }
      h2 { font-size: 1.25rem; }
      .artworks { display: flex; gap: 0.75rem; }
      .artworks img, .placeholder {
        width: 8rem; height: 8rem; border-radius: 0.75rem; object-fit: cover;
      }
      .placeholder { background: linear-gradient(135deg, #3b3358, #211d33); }
      .track { color: #e6e3f5; }
      footer { margin-top: 2rem; color: #9aa3b2; font-size: 0.875rem; }
    </style>
  </head>
  <body>
    <main>
      <p class="period">${escapeHtml(input.periodLabel)}</p>
${era}
      <h1>${escapeHtml(input.title)}</h1>
      <div class="artworks">
${artworks}
      </div>
${symbol}
      <footer>Life Soundtrack — un capitolo della tua storia musicale.</footer>
    </main>
  </body>
</html>
`;
}

/** Il capitolo, come Blob HTML pronto per il download. */
export function memoryChapterBlob(input: MemoryChapterInput): Blob {
  return new Blob([renderMemoryChapterHtml(input)], { type: 'text/html;charset=utf-8' });
}
