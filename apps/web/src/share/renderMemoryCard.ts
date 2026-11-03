/**
 * Renderer della card dei ricordi — Story 3.2, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §3 (T25.4).
 *
 * La card è un **capitolo statico**: un PNG 1080×1350 disegnato in locale,
 * con le copertine, il periodo, il nome dell'era e il brano simbolo. Non
 * contiene **mai** il database: è la condivisione di un momento, non
 * un'export (quello è la Story 5.2).
 *
 * Tre vincoli tecnici che non sono negoziabili:
 *
 * 1. **nessun taint**: le immagini remote si caricano con
 *    `crossOrigin = 'anonymous'`; se il server non risponde con CORS (o la
 *    copertina non esiste) si disegna il **placeholder** e si continua — un
 *    `toBlob` che fallirebbe non produrrebbe nessuna card;
 * 2. **font caricati** prima del disegno (`document.fonts.load`): senza, il
 *    canvas usa il fallback e il testo non è quello del design system;
 * 3. il risultato è un **Blob PNG**, mai un data URL (D-25.5): è il
 *    formato che `navigator.share` e `navigator.clipboard` accettano.
 */

import type { MoodId } from '@core/schema';
import type { Logger } from '@core/logger';

/** Larghezza della card, in pixel. */
export const MEMORY_CARD_WIDTH = 1080;
/** Altezza della card, in pixel. */
export const MEMORY_CARD_HEIGHT = 1350;

/** L'input del renderer: un capitolo, non un database. */
export interface MemoryCardInput {
  /** Il testo del ricordo, già reso. */
  readonly title: string;
  /** Il periodo, già reso (es. «estate 2019»). */
  readonly periodLabel: string;
  /** Il nome dell'era (quello dell'utente, se l'ha rinominata). */
  readonly eraName: string | null;
  /** Il brano simbolo del ricordo. */
  readonly symbolTrack: {
    readonly name: string;
    readonly artist: string;
    readonly artworkUrl: string | null;
  } | null;
  /** Le copertine da disegnare (quelle già presenti nel database). */
  readonly artworks: readonly { readonly url: string | null; readonly mood: MoodId | null }[];
}

/** La card disegnata. */
export interface RenderedCard {
  /** Il PNG, come Blob. */
  readonly blob: Blob;
  /** Larghezza del PNG. */
  readonly width: 1080;
  /** Altezza del PNG. */
  readonly height: 1350;
}

/** Dipendenze iniettabili (per i test e per il fallback dei font). */
export interface RenderMemoryCardDeps {
  /** I font da caricare prima del disegno. */
  readonly fonts?: readonly FontFace[] | undefined;
  /** Il logger del core (warn sui fallback). */
  readonly logger?: Logger | undefined;
}

const MOOD_COLORS: Record<string, string> = {
  sad: '#7C89A8',
  angry: '#E06C75',
  neutral: '#9AA3B2',
  calm: '#88C0A0',
  happy: '#EBCB8B',
  excited: '#B48EAD',
};

/** Carica i font del design system prima del disegno. */
async function loadFonts(deps: RenderMemoryCardDeps): Promise<void> {
  const provided = deps.fonts;
  if (provided && provided.length > 0) {
    for (const font of provided) {
      try {
        await font.load();
      } catch (error) {
        deps.logger?.warn('render-memory-card: font non caricato', { error: String(error) });
      }
    }
    return;
  }
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts || typeof fonts.load !== 'function') return;
  try {
    await fonts.load('700 72px "Inter Tight"');
    await fonts.load('400 36px "Inter"');
  } catch (error) {
    deps.logger?.warn('render-memory-card: font di sistema non caricato', { error: String(error) });
  }
}

/** Carica un'immagine senza taint; `null` se non è caricabile. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Un colore deterministico, derivato dal testo: lo stesso ricordo ha sempre lo stesso placeholder. */
function placeholderColors(seed: string, mood: MoodId | null): [string, string] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  const from = mood ? (MOOD_COLORS[mood] ?? `hsl(${hash}, 42%, 32%)`) : `hsl(${hash}, 42%, 32%)`;
  return [from, `hsl(${(hash + 48) % 360}, 46%, 20%)`];
}

/** Disegna il gradiente di fallback al posto di una copertina non disponibile. */
function drawPlaceholder(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: string,
  mood: MoodId | null = null,
): void {
  const [from, to] = placeholderColors(seed, mood);
  const gradient = context.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  context.fillStyle = gradient;
  context.fillRect(x, y, width, height);
}

/** Spezza il testo su più righe, entro `maxWidth`. */
function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (context.measureText(candidate).width > maxWidth && line !== '') {
      context.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
      if (lines >= maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines < maxLines && line !== '') {
    context.fillText(line, x, y + lines * lineHeight);
  }
}

/** Il PNG della card, generato in locale. */
export async function renderMemoryCard(
  input: MemoryCardInput,
  deps: RenderMemoryCardDeps = {},
): Promise<RenderedCard> {
  await loadFonts(deps);

  const ratio = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);
  // Il disegno avviene a risoluzione `ratio` (testo più nitido) e il PNG
  // finale è **sempre** 1080×1350: il `devicePixelRatio` non cambia la
  // dimensione del file condiviso.
  const drawing = document.createElement('canvas');
  drawing.width = Math.round(MEMORY_CARD_WIDTH * ratio);
  drawing.height = Math.round(MEMORY_CARD_HEIGHT * ratio);
  const context = drawing.getContext('2d');
  if (!context) {
    throw new Error("render-memory-card: il contesto 2D non e' disponibile");
  }
  context.save();
  context.scale(ratio, ratio);
  const width = MEMORY_CARD_WIDTH;
  const height = MEMORY_CARD_HEIGHT;

  // Sfondo.
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#12121A');
  background.addColorStop(1, '#1E1B2E');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  // Le copertine: tre riquadri in alto, il placeholder al posto di quelle mancanti.
  const artworks = input.artworks.slice(0, 3);
  const tileSize = (width - 160) / 3;
  for (let index = 0; index < 3; index += 1) {
    const artwork = artworks[index];
    const x = 80 + index * tileSize;
    const y = 120;
    drawPlaceholder(
      context,
      x,
      y,
      tileSize - 24,
      tileSize - 24,
      `${input.title}-${index}`,
      artwork?.mood ?? null,
    );
    if (!artwork?.url) continue;
    const image = await loadImage(artwork.url);
    if (!image) {
      deps.logger?.warn('render-memory-card: copertina non caricabile, uso il placeholder');
      continue;
    }
    try {
      context.drawImage(image, x, y, tileSize - 24, tileSize - 24);
    } catch (error) {
      deps.logger?.warn('render-memory-card: copertina non disegnabile, uso il placeholder', {
        error: String(error),
      });
    }
  }

  // Il periodo.
  context.fillStyle = '#A78BFA';
  context.font = '600 30px "Inter", sans-serif';
  context.fillText(input.periodLabel, 80, 120 + tileSize + 40);

  // Il nome dell'era (quello dell'utente).
  if (input.eraName) {
    context.fillStyle = '#F4F2FF';
    context.font = '700 48px "Inter Tight", sans-serif';
    context.fillText(input.eraName, 80, 120 + tileSize + 100);
  }

  // Il testo del ricordo.
  context.fillStyle = '#F4F2FF';
  context.font = '700 56px "Inter Tight", sans-serif';
  wrapText(context, input.title, 80, 120 + tileSize + 190, width - 160, 72, 4);

  // Il brano simbolo.
  if (input.symbolTrack) {
    const trackY = height - 220;
    if (input.symbolTrack.artworkUrl) {
      const image = await loadImage(input.symbolTrack.artworkUrl);
      if (image) {
        try {
          context.drawImage(image, 80, trackY - 80, 120, 120);
        } catch (error) {
          deps.logger?.warn('render-memory-card: copertina del brano non disegnabile', {
            error: String(error),
          });
        }
      }
    }
    context.fillStyle = '#E6E3F5';
    context.font = '600 32px "Inter", sans-serif';
    context.fillText(input.symbolTrack.name, 220, trackY - 30);
    context.fillStyle = '#9AA3B2';
    context.font = '400 28px "Inter", sans-serif';
    context.fillText(input.symbolTrack.artist, 220, trackY + 16);
  }

  context.restore();

  // Composizione finale: il PNG è 1080×1350 qualunque sia il `devicePixelRatio`.
  const canvas = document.createElement('canvas');
  canvas.width = MEMORY_CARD_WIDTH;
  canvas.height = MEMORY_CARD_HEIGHT;
  const target = canvas.getContext('2d');
  if (!target) {
    throw new Error("render-memory-card: il contesto 2D non e' disponibile");
  }
  target.drawImage(drawing, 0, 0, MEMORY_CARD_WIDTH, MEMORY_CARD_HEIGHT);

  const blob = await toPng(canvas);
  return { blob, width: MEMORY_CARD_WIDTH, height: MEMORY_CARD_HEIGHT };
}

/** Il PNG del canvas, come Blob. */
function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('render-memory-card: toBlob non disponibile'));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('render-memory-card: il canvas non ha prodotto un PNG'));
      }
    }, 'image/png');
  });
}
