/**
 * Le azioni di condivisione sul **Blob** — Story 3.2, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §4.
 *
 * Tutte agiscono sul file locale, mai su un URL remoto: il file condiviso
 * è la card generata in locale, e il suo contenuto è un capitolo statico
 * (nessun dump del database — Story 5.2).
 *
 * Ogni azione ha un **fallback**: senza Web Share API si scarica il file,
 * senza clipboard si scarica il file. L'utente deve sempre poter portare
 * fuori la card.
 */

/** Il file condiviso: un PNG con il nome del prodotto. */
export function memoryCardFile(blob: Blob): File {
  return new File([blob], 'life-soundtrack.png', { type: 'image/png' });
}

/** Il browser può condividere **questo** file? */
export function canShareFiles(file: File): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Condivisione nativa (Web Share API con file).
 *
 * Restituisce `false` se il Web Share API non è disponibile o l'utente ha
 * annullato: il chiamante passa al download.
 */
export async function shareFile(file: File): Promise<boolean> {
  const nav = navigator as Navigator & {
    share?: (data?: ShareData) => Promise<void>;
  };
  if (typeof nav.share !== 'function') return false;
  if (!canShareFiles(file)) return false;
  try {
    await nav.share({ files: [file] });
    return true;
  } catch {
    return false;
  }
}

/** Copia il file negli appunti. `false` se il clipboard non è disponibile. */
export async function copyFileToClipboard(file: File): Promise<boolean> {
  const clipboard = navigator.clipboard;
  if (!clipboard || typeof clipboard.write !== 'function') return false;
  if (typeof ClipboardItem === 'undefined') return false;
  try {
    await clipboard.write([new ClipboardItem({ [file.type]: file })]);
    return true;
  } catch {
    return false;
  }
}

/** Salva il file sul dispositivo (il fallback di ogni azione). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
