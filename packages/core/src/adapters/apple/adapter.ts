import { extractZipEntry, isZip, listZipEntries } from '../zip';
import type { ParseOptions, PlatformAdapter, RawListenEvent } from '../types';
import { detectAppleMusic } from './detect';
import {
  parseCsvStreaming,
  parseDailyTracksCsv,
  buildDailyTracksArtistMap,
  mapAppleMusicEvent,
  RECONCILIATION_TOLERANCE,
} from './mapEvent';

/** Frequenza del check di cancellazione cooperativa (05§4: "ogni N eventi"). */
const SIGNAL_CHECK_EVERY = 100;

/**
 * Adapter Apple Music — export Apple Privacy Portal "Apple Media Services" (CSV in ZIP).
 * (03-ADAPTERS/apple-music.md, 05-ARCHITECTURE.md §4).
 *
 * Il canale MVP è l'export GDPR (ZIP Privacy Portal): non esiste alcuna API per la
 * cronologia di ascolto (§1). L'export include due file principali:
 * - Apple Music Play Activity.csv (fonte primaria, event stream)
 * - Apple Music - Play History Daily Tracks.csv (fonte secondaria, aggregato giornaliero)
 *
 * L'adapter gestisce:
 * - ZIP multi-part (fusione in memoria)
 * - ZIP annidato ricorsivo (Apple_Media_Services.zip) ≤5 livelli
 * - CSV singolo (Play Activity)
 * - Due generazioni di schema (legacy 2015-2021 / 2026.2) via tabella alias
 * - Parsing streaming PapaParse row mode (memoria costante su 100k+ righe)
 * - Filtro eventi: scrub, <30s, senza titolo (§3.3)
 * - Catena risoluzione artista D3 + mappa Daily Tracks (§3.1.1, §3.4)
 * - Privacy: IP solo con retainIp, coordinate/Device ID mai (§7)
 * - Bias E.AP.1 dichiarato SEMPRE via info.pauseBias (§3.4, §9)
 */
export class AppleMusicAdapter implements PlatformAdapter {
  readonly platform = 'apple_music' as const;
  readonly name = 'Apple Music';
  readonly version = '1.0.0';

  /**
   * Riconoscimento strutturale ZIP/CSV (§2.2). Sempre via `await` (D.A.8).
   * L'HTML viene rifiutato in `detectAppleMusic` (§2.2: l'errore guidato
   * `error.htmlExport` è scelto dalla UI, il contratto detect è booleano).
   */
  detect(input: Blob): Promise<boolean> {
    return detectAppleMusic(input);
  }

  /**
   * Parsing streaming dell'export Apple (05§4: mai tutto il file in memoria).
   *
   * Flussi supportati:
   * - ZIP (uno o più parti): fusione byte, espansione ricorsiva ZIP annidati,
   *   estrazione Play Activity + Daily Tracks, parsing streaming CSV.
   * - CSV singolo: parsing streaming diretto (solo Play Activity).
   *
   * Emette `RawListenEvent` per ogni riga Play Activity che supera il filtro.
   * Le warning per evento (scrub, short, noTitle, reconciliation) sono inviate
   * via `onWarning` callback (codici i18n `adapter.apple_music.warn.*`).
   * A fine import emette sempre `adapter.apple_music.info.pauseBias` (§3.4, §9).
   */
  async *parse(input: Blob, options: ParseOptions = {}): AsyncGenerator<RawListenEvent> {
    const signal = options.signal;
    const onWarning = options.onWarning;
    const retainIp = options.retainIp ?? false;

    const checkSignal = (): void => {
      if (signal?.aborted) {
        throw new DOMException('Import cancellato', 'AbortError');
      }
    };

    // Estrae il testo CSV dal file (ZIP o CSV singolo)
    const { playActivityCsv, dailyTracksCsv } = await this.extractCsvFiles(input, checkSignal);

    if (!playActivityCsv) {
      // Nessun Play Activity trovato: detect avrebbe dovuto fallire, ma per sicurezza
      return;
    }

    // Parsa Daily Tracks per costruire la mappa artisti (§3.4)
    const dailyArtistMap = dailyTracksCsv
      ? buildDailyTracksArtistMap(await parseDailyTracksCsv(dailyTracksCsv))
      : new Map<string, string>();

    // Reconciliazione conteggi: Σ Play Count vs eventi importati (§3.4)
    let importedEvents = 0;
    let dailyTotalCount = 0;
    if (dailyTracksCsv) {
      const dailyRecords = await parseDailyTracksCsv(dailyTracksCsv);
      for (const rec of dailyRecords) {
        const count = rec.playCount ? parseInt(rec.playCount, 10) : 1;
        if (Number.isFinite(count)) dailyTotalCount += count;
      }
    }

    // Streaming Play Activity CSV
    let sinceCheck = 0;
    const csvGenerator = await parseCsvStreaming(playActivityCsv, onWarning);
    for await (const row of csvGenerator) {
      sinceCheck += 1;
      if (sinceCheck >= SIGNAL_CHECK_EVERY) {
        sinceCheck = 0;
        checkSignal();
      }

      const mapped = await mapAppleMusicEvent(
        row as Record<string, string>,
        dailyArtistMap,
        onWarning,
      );
      if (!mapped) continue;

      importedEvents += 1;

      // IP: conservato solo se retainIp=true (il core gestisce PrivacySettings)
      if (!retainIp) {
        mapped.ip = null;
      }

      yield mapped;
    }

    // Riconciliazione e bias E.AP.1 (§3.4, §9): SEMPRE dichiara info.pauseBias
    if (onWarning) {
      onWarning('adapter.apple_music.info.pauseBias');
    }

    // Warning numerico se scostamento > 10% (§3.4)
    if (dailyTotalCount > 0 && importedEvents > 0) {
      const ratio = Math.abs(dailyTotalCount - importedEvents) / dailyTotalCount;
      if (ratio > RECONCILIATION_TOLERANCE) {
        onWarning?.(`adapter.apple_music.warn.reconciliationMismatch`);
        // Il messaggio i18n includerà entrambe le cifre via interpolazione
      }
    }

    // Completion notice
    if (onWarning) {
      onWarning('adapter.apple_music.info.complete');
    }
  }

  /**
   * Estrae i contenuti CSV da ZIP o CSV singolo.
   * Restituisce { playActivityCsv: string | null, dailyTracksCsv: string | null }
   */
  private async extractCsvFiles(
    input: Blob,
    checkSignal: () => void,
  ): Promise<{ playActivityCsv: string | null; dailyTracksCsv: string | null }> {
    // CSV singolo
    if (!(await isZip(input))) {
      const text = new TextDecoder().decode(new Uint8Array(await input.arrayBuffer()));
      return { playActivityCsv: text, dailyTracksCsv: null };
    }

    // ZIP: fusione multi-part + espansione ricorsiva
    await listZipEntries(input); // validate ZIP structure
    const zipBytes = new Uint8Array(await input.arrayBuffer());

    let playActivityCsv: string | null = null;
    let dailyTracksCsv: string | null = null;

    // Helper ricorsivo per processare ZIP (stessa logica di detect)
    const processZip = async (bytes: Uint8Array, depth: number): Promise<void> => {
      if (depth > 5) return;
      checkSignal();

      const entryNames = await listZipEntries(new Blob([new Uint8Array(bytes)]));
      for (const name of entryNames) {
        checkSignal();
        const lower = name.toLowerCase();

        if (lower.endsWith('.zip')) {
          // ZIP annidato
          const data = await extractZipEntry(bytes, name);
          if (data) {
            await processZip(data, depth + 1);
          }
        } else if (lower === 'apple music play activity.csv') {
          const data = await extractZipEntry(bytes, name);
          if (data) {
            const text = new TextDecoder().decode(new Uint8Array(data));
            // Concatena se multi-part (le parti sono fuse in memoria)
            playActivityCsv = playActivityCsv ? playActivityCsv + '\n' + text : text;
          }
        } else if (lower === 'apple music - play history daily tracks.csv') {
          const data = await extractZipEntry(bytes, name);
          if (data) {
            const text = new TextDecoder().decode(new Uint8Array(data));
            dailyTracksCsv = dailyTracksCsv ? dailyTracksCsv + '\n' + text : text;
          }
        }
      }
    };

    await processZip(zipBytes, 0);
    return { playActivityCsv, dailyTracksCsv };
  }
}
