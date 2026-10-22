import { extractZipEntry, isZip, listZipEntries } from '../zip';

/**
 * Nomi file attesi dentro l'archivio Apple (case-insensitive, §2.2).
 */
const PLAY_ACTIVITY_FILENAME = 'apple music play activity.csv';
const DAILY_TRACKS_FILENAME = 'apple music - play history daily tracks.csv';

/** Byte letti per escludere HTML prima di ogni altro test. */
const HEAD_PROBE_BYTES = 64;

/**
 * Verifica se un CSV ha le colonne minime richieste per Play Activity.
 * La risoluzione alias (§10) avviene nel mapping; qui controlliamo solo la presenza
 * di almeno un nome canonico per ogni campo richiesto.
 */
function hasRequiredPlayActivityHeaders(headers: string[]): boolean {
  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());
  const hasSongName = lowerHeaders.includes('song name') || lowerHeaders.includes('content name');
  const hasPlayDuration = lowerHeaders.includes('play duration milliseconds');
  const hasEndTs =
    lowerHeaders.includes('event end timestamp') || lowerHeaders.includes('event start timestamp');
  return hasSongName && hasPlayDuration && hasEndTs;
}

/**
 * Verifica se un CSV ha le colonne del Daily Tracks.
 */
function hasDailyTracksHeaders(headers: string[]): boolean {
  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());
  return lowerHeaders.includes('date played') && lowerHeaders.includes('track description');
}

/**
 * Legge la prima riga di un CSV per estrarre gli header.
 * Gestisce BOM UTF-8 e delimitatore sniffed (virgola, punto e virgola, tab).
 */
async function readCsvHeaders(csvText: string): Promise<string[]> {
  // Rimuove BOM se presente
  const clean = csvText.replace(/^\uFEFF/, '');
  // Trova la prima riga non vuota
  const lines = clean.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      // Sniffa il delimitatore: prova virgola, ;, tab
      const delimiters = [',', ';', '\t'];
      for (const delim of delimiters) {
        const parts = trimmed.split(delim);
        if (parts.length > 1) {
          return parts.map((p) => p.trim().replace(/^"|"$/g, ''));
        }
      }
      // Fallback: singolo campo (non dovrebbe succedere per CSV validi)
      return [trimmed];
    }
  }
  return [];
}

/**
 * Test strutturale per un file CSV Play Activity (§2.2).
 * Streaming via PapaParse sarebbe ideale, ma per il detect leggiamo solo l'header
 * e le prime poche righe per confermare la shape.
 */
async function isPlayActivityCsv(input: Blob): Promise<boolean> {
  try {
    const text = new TextDecoder().decode(new Uint8Array(await input.slice(0, 8192).arrayBuffer()));
    const headers = await readCsvHeaders(text);
    if (!hasRequiredPlayActivityHeaders(headers)) {
      return false;
    }
    // Verifica rapida: almeno una riga dati con campi popolati
    const lines = text.split(/\r?\n/);
    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      const line = lines[i]?.trim();
      if (line && line.length > 0) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Test strutturale per il file Daily Tracks (§3.4).
 */
async function isDailyTracksCsv(input: Blob): Promise<boolean> {
  try {
    const text = new TextDecoder().decode(new Uint8Array(await input.slice(0, 4096).arrayBuffer()));
    const headers = await readCsvHeaders(text);
    return hasDailyTracksHeaders(headers);
  } catch {
    return false;
  }
}

/**
 * True se i primi byte sono markup HTML (export nel formato sbagliato).
 */
export async function looksLikeHtml(input: Blob): Promise<boolean> {
  const head = new TextDecoder().decode(
    new Uint8Array(await input.slice(0, HEAD_PROBE_BYTES).arrayBuffer()),
  );
  return head.trimStart().startsWith('<');
}

/**
 * Riconosce un export Apple Music (ZIP Privacy Portal o CSV singolo).
 * §2.2: ZIP (uno o più parti) → fusione + espansione ricorsiva ≤5 livelli
 *       CSV singolo → test header Play Activity
 * Rifiuta: altri CSV dell'archivio, file senza colonne minime, HTML.
 */
export async function detectAppleMusic(input: Blob): Promise<boolean> {
  if (input.size === 0) {
    return false;
  }
  if (await looksLikeHtml(input)) {
    return false;
  }

  // CSV singolo
  if (!(await isZip(input))) {
    const head = new TextDecoder().decode(new Uint8Array(await input.slice(0, 1).arrayBuffer()));
    const first = head.trimStart();
    // CSV inizia con lettera o virgoletta, non con [ o {
    if (/^[\w"]/.test(first)) {
      return isPlayActivityCsv(input);
    }
    return false;
  }

  // ZIP: elenca entry, espande ricorsivamente ZIP annidati (≤5 livelli)
  try {
    await listZipEntries(input); // validate ZIP structure
    const zipBytes = new Uint8Array(await input.arrayBuffer());

    // Helper ricorsivo per espandere ZIP annidati
    const processZip = async (
      bytes: Uint8Array,
      depth: number,
      foundPlayActivity: { value: boolean },
      foundDailyTracks: { value: boolean },
    ): Promise<void> => {
      if (depth > 5 || foundPlayActivity.value) return;
      const entryNames = await listZipEntries(new Blob([new Uint8Array(bytes)]));
      for (const name of entryNames) {
        const lower = name.toLowerCase();
        if (lower.endsWith('.zip')) {
          // ZIP annidato: estrae e ricorsiona
          const data = await extractZipEntry(bytes, name);
          if (data) {
            await processZip(data, depth + 1, foundPlayActivity, foundDailyTracks);
          }
        } else if (lower === PLAY_ACTIVITY_FILENAME) {
          const data = await extractZipEntry(bytes, name);
          if (data && (await isPlayActivityCsv(new Blob([new Uint8Array(data)])))) {
            foundPlayActivity.value = true;
          }
        } else if (lower === DAILY_TRACKS_FILENAME) {
          const data = await extractZipEntry(bytes, name);
          if (data && (await isDailyTracksCsv(new Blob([new Uint8Array(data)])))) {
            foundDailyTracks.value = true;
          }
        }
      }
    };

    const foundPlayActivity = { value: false };
    const foundDailyTracks = { value: false };
    await processZip(zipBytes, 0, foundPlayActivity, foundDailyTracks);

    // Play Activity è richiesto; Daily Tracks è opzionale
    return foundPlayActivity.value;
  } catch {
    return false;
  }
}
