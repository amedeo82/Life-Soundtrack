import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderMemoryCard, MEMORY_CARD_HEIGHT, MEMORY_CARD_WIDTH } from '../renderMemoryCard';

/**
 * Test del renderer della card — Story 3.2,
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §3 (T25.4).
 *
 * Copre: il PNG è 1080×1350, la copertina senza CORS **non** taintа il
 * canvas (si usa il placeholder) e il risultato non crasha.
 */

/** Un contesto 2D finto: registra le chiamate, non disegna. */
function fakeContext() {
  const calls: string[] = [];
  return {
    calls,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    scale: () => calls.push('scale'),
    fillRect: () => calls.push('fillRect'),
    fillText: () => calls.push('fillText'),
    drawImage: () => calls.push('drawImage'),
    createLinearGradient: () => ({
      addColorStop: () => calls.push('addColorStop'),
    }),
    measureText: (text: string) => ({ width: text.length * 10 }),
  };
}

/** Installa un canvas finto: il contesto e `toBlob` funzionano. */
function installCanvas() {
  const canvases: HTMLCanvasElement[] = [];
  const original = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((
    tagName: string,
    options?: ElementCreationOptions,
  ) => {
    const element = original(tagName as never, options as never) as HTMLElement;
    if (tagName !== 'canvas') return element;
    const canvas = element as HTMLCanvasElement;
    canvases.push(canvas);
    const context = fakeContext();
    (canvas as unknown as { getContext: () => unknown }).getContext = () => context;
    (canvas as unknown as { toBlob: (cb: (blob: Blob) => void) => void }).toBlob = (cb) => {
      cb(new Blob(['png'], { type: 'image/png' }));
    };
    return canvas as unknown as HTMLElement;
  }) as typeof document.createElement);
  return canvases;
}

/** Un `Image` finto: `fail` simula una copertina che non si carica. */
function installImage(fail: boolean) {
  class FakeImage {
    crossOrigin = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private source = '';
    set src(value: string) {
      this.source = value;
      setTimeout(() => {
        if (fail) {
          this.onerror?.();
        } else {
          this.onload?.();
        }
      }, 0);
    }
    get src(): string {
      return this.source;
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('renderMemoryCard (Story 3.2)', () => {
  it('produce un PNG 1080x1350', async () => {
    const canvases = installCanvas();
    installImage(true);

    const rendered = await renderMemoryCard({
      title: 'Un anno fa ascoltavi questo brano',
      periodLabel: 'marzo 2024',
      eraName: 'Il viaggio a Berlino',
      symbolTrack: null,
      artworks: [],
    });

    expect(rendered.width).toBe(MEMORY_CARD_WIDTH);
    expect(rendered.height).toBe(MEMORY_CARD_HEIGHT);
    expect(rendered.blob.type).toBe('image/png');
    const final = canvases[canvases.length - 1];
    expect(final?.width).toBe(1080);
    expect(final?.height).toBe(1350);
  });

  it('usa il placeholder quando la copertina non si carica (nessun taint, nessun crash)', async () => {
    const canvases = installCanvas();
    installImage(true);

    const rendered = await renderMemoryCard({
      title: 'Ricordo senza copertina',
      periodLabel: 'marzo 2024',
      eraName: null,
      symbolTrack: { name: 'Brano', artist: 'Artista', artworkUrl: 'https://example.com/a.png' },
      artworks: [{ url: 'https://example.com/b.png', mood: 'calm' }],
    });

    expect(rendered.blob).toBeInstanceOf(Blob);
    const context = (
      canvases[0] as unknown as { getContext: () => { calls: string[] } }
    ).getContext();
    expect(context.calls).toContain('fillRect');
  });

  it("disegna la copertina quando l'immagine si carica", async () => {
    const canvases = installCanvas();
    installImage(false);

    await renderMemoryCard({
      title: 'Ricordo con copertina',
      periodLabel: 'marzo 2024',
      eraName: null,
      symbolTrack: null,
      artworks: [{ url: 'https://example.com/b.png', mood: 'calm' }],
    });

    const context = (
      canvases[0] as unknown as { getContext: () => { calls: string[] } }
    ).getContext();
    expect(context.calls).toContain('drawImage');
  });

  it('non lascia il canvas in uno stato sporco (save/restore bilanciati)', async () => {
    const canvases = installCanvas();
    installImage(true);

    await renderMemoryCard({
      title: 'Titolo',
      periodLabel: 'periodo',
      eraName: null,
      symbolTrack: null,
      artworks: [],
    });

    const context = (
      canvases[0] as unknown as { getContext: () => { calls: string[] } }
    ).getContext();
    expect(context.calls.filter((call) => call === 'save')).toHaveLength(1);
    expect(context.calls.filter((call) => call === 'restore')).toHaveLength(1);
  });
});
