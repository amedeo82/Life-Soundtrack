import type { ImportRecord, LibraryItem, Playlist, PlaylistItem, PrivacySettings } from '../schema';
import type { LifeSoundtrackDB } from '../db';
import { recount } from '../db';
import { AdapterError } from './errors';
import { sha256Hex, uuid } from './crypto';
import { NormalizationPipeline } from './pipeline';
import type {
  LibrarySnapshot,
  ParseOptions,
  PlatformAdapter,
  RawListenEvent,
  RemoteSource,
} from './types';

/**
 * Sessione di import — orchestra adapter → pipeline → DB (05§3.1, 05§5).
 *
 * Chunk di 1000 eventi per transazione (03-ADAPTERS/spotify.md §2.3):
 * a differenza della singola tx di 05§5, il chunking rende conveniente il
 * partial recovery di 05§4 (gli eventi validi scritti restano) e limita la
 * memoria della transazione su file da 50k+ eventi.
 */

/** Dimensione dei batch di upsert (§2.3: "chunk da ~1000 eventi"). */
export const IMPORT_CHUNK_SIZE = 1000;

/** Opzioni della sessione di import. */
export interface ImportOptions {
  privacy: PrivacySettings;
  signal?: AbortSignal;
  /** Nome file mostrato in `ImportRecord.fileName` (default "streaming-history"). */
  fileName?: string;
  /** Callback di progresso: chiamato dopo ogni chunk con il totale parsato. */
  onProgress?: (eventsParsed: number) => void;
}

/** Esito dell'import: il record persistito più i conteggi per codice. */
export interface ImportSummary extends ImportRecord {
  /** Conteggio per ogni codice di warning (i18n §9 + codici edge). */
  warningCounts: Record<string, number>;
}

/** Crea il record di import (persistito subito, prima del parsing). */
function newImportRecord(adapter: PlatformAdapter, fileName: string): ImportRecord {
  return {
    id: uuid(),
    platform: adapter.platform,
    fileName,
    fileHash: '',
    startedAt: Date.now(),
    completedAt: null,
    status: 'running',
    eventsParsed: 0,
    eventsInserted: 0,
    eventsDuplicated: 0,
    warnings: [],
  };
}

/**
 * Esegue un import completo: detect → parse streaming → normalize → upsert
 * a chunk → recount → ImportRecord finale.
 *
 * - detect fallito ⇒ nessuna scrittura, record `failed`, `AdapterError`
 *   `INVALID_FORMAT` (recoverable false).
 * - cancellazione (`AbortSignal`) o file troncato ⇒ i chunk già scritti
 *   restano, record `partial` (partial recovery, 05§4). `AdapterError`
 *   `TRUNCATED` viene rilanciata al caller dopo il flush.
 */
export async function runImport(
  db: LifeSoundtrackDB,
  adapter: PlatformAdapter,
  input: Blob,
  options: ImportOptions,
): Promise<ImportSummary> {
  const record = newImportRecord(adapter, options.fileName ?? 'streaming-history');

  // fileHash: sha256 del file (02§3.7). Lettura integrale una volta sola
  // per l'hash; il parse rilegge lo stream in modo indipendente (nessuna
  // copia del buffer in memoria oltre quella transitoria della lettura).
  const bytes = new Uint8Array(await input.arrayBuffer());
  record.fileHash = await sha256Hex(bytes);
  await db.imports.put(record);

  const detected = await adapter.detect(input);
  if (!detected) {
    // Nessuna scrittura (05§4 recoverable false): l'esito negativo del
    // detect viaggia via `AdapterError` INVALID_FORMAT; il codice i18n
    // `adapter.spotify.detect.fail` è scelto dalla UI, non dal core.
    await finalizeImport(db, record, {}, 'failed');
    throw new AdapterError('INVALID_FORMAT', `${adapter.name}: formato non riconosciuto`);
  }

  return runSession(db, adapter, record, options, (parseOptions) =>
    adapter.parse(input, parseOptions),
  );
}

/** Opzioni della sessione di import da sorgente remota (ADR-0010). */
export interface RemoteImportOptions extends Omit<ImportOptions, 'fileName'> {
  /** Nome mostrato in `ImportRecord.fileName` (default "remote-source"). */
  fileName?: string;
}

/**
 * Import da **sorgente remota** (`parseRemote?`, ADR-0010).
 *
 * Produce gli stessi `ListenEvent` del percorso file (V2): la pipeline, la
 * dedup e il DB non distinguono le origini. Non c'è `fileHash` (l'input non
 * è un file) e non c'è `detect()` (una sorgente remota non si "rileva": si
 * configura).
 */
export async function runRemoteImport(
  db: LifeSoundtrackDB,
  adapter: PlatformAdapter,
  source: RemoteSource,
  options: RemoteImportOptions,
): Promise<ImportSummary> {
  if (!adapter.parseRemote) {
    throw new AdapterError(
      'INVALID_FORMAT',
      `${adapter.name}: l'adapter non supporta le sorgenti remote`,
    );
  }
  const record = newImportRecord(adapter, options.fileName ?? 'remote-source');
  await db.imports.put(record);
  return runSession(db, adapter, record, options, (parseOptions) =>
    (adapter.parseRemote as NonNullable<PlatformAdapter['parseRemote']>)(source, parseOptions),
  );
}

/**
 * Cuore comune delle due sessioni: dalla sorgente di eventi grezzi al DB.
 * Il `record` è già persistito (l'`imports` row esiste prima del parsing).
 */
async function runSession(
  db: LifeSoundtrackDB,
  adapter: PlatformAdapter,
  record: ImportRecord,
  options: ImportOptions,
  createIterator: (parseOptions: ParseOptions) => AsyncIterable<RawListenEvent>,
): Promise<ImportSummary> {
  const warningCounts: Record<string, number> = {};
  const countWarning = (code: string, count?: number): void => {
    warningCounts[code] = (warningCounts[code] ?? 0) + (count ?? 1);
  };
  const finalize = async (status: ImportRecord['status']): Promise<ImportSummary> => {
    record.status = status;
    record.completedAt = Date.now();
    record.warnings = Object.keys(warningCounts).sort();
    await db.imports.put(record);
    return { ...record, warningCounts };
  };

  const pipeline = new NormalizationPipeline(db, record.id, options.privacy);
  const seenEventKeys = new Set<string>();
  const buffer: RawListenEvent[] = [];
  let failure: AdapterError | null = null;

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) {
      return;
    }
    const events = await Promise.all(buffer.splice(0).map((raw) => pipeline.normalizeEvent(raw)));
    const keys = events.map((e) => e.eventKey);
    const uniqueKeys = [...new Set(keys)];
    const newKeys = uniqueKeys.filter((k) => !seenEventKeys.has(k));
    const existing = await db.listens.bulkGet(newKeys);
    const trulyNewKeys = newKeys.filter((k, i) => existing[i] === undefined);
    for (const k of trulyNewKeys) seenEventKeys.add(k);
    record.eventsInserted += trulyNewKeys.length;
    record.eventsDuplicated += keys.length - trulyNewKeys.length;
    const { tracks, artists, albums } = pipeline.dirtyRecords();
    await db.transaction('rw', db.listens, db.tracks, db.artists, db.albums, async () => {
      await db.listens.bulkPut(events);
      await db.tracks.bulkPut(tracks);
      await db.artists.bulkPut(artists);
      await db.albums.bulkPut(albums);
    });
    pipeline.clearDirty();
  };

  try {
    const parseOptions: ParseOptions = { onWarning: countWarning };
    if (options.signal) {
      parseOptions.signal = options.signal;
    }
    const iterator = createIterator(parseOptions)[Symbol.asyncIterator]();
    for (;;) {
      const step = await iterator.next();
      if (step.done) {
        break;
      }
      buffer.push(step.value);
      record.eventsParsed += 1;
      options.onProgress?.(record.eventsParsed);
      if (options.signal?.aborted) {
        throw new DOMException('Import cancellato', 'AbortError');
      }
      if (buffer.length >= IMPORT_CHUNK_SIZE) {
        await flush();
      }
    }
    await flush();
  } catch (error) {
    if (isAbortError(error)) {
      // Cancellazione cooperativa (05§4): i chunk già scritti restano.
      await flush();
      return finalize('partial');
    }
    if (error instanceof AdapterError && error.recoverable) {
      // Partial recovery: scrivi i chunk già parsati nel buffer, poi
      // il record va a `partial` (05§4).
      await flush();
      failure = error;
    } else {
      await finalize('failed');
      throw error;
    }
  }

  if (record.eventsInserted > 0) {
    // Contatori denormalizzati assegnati solo a fine import (02§7 MIG-4):
    // l'unica fonte di verità resta `recount()`, idempotente.
    await recount(db);
  }
  if (failure) {
    await finalize('partial');
    throw new AdapterError(failure.code, failure.message, {
      recoverable: true,
      partialEvents: failure.partialEvents,
    });
  }
  return finalize('done');
}

/** Scrive il record finale con i warning raccolti. */
async function finalizeImport(
  db: LifeSoundtrackDB,
  record: ImportRecord,
  warningCounts: Record<string, number>,
  status: ImportRecord['status'],
): Promise<ImportSummary> {
  record.status = status;
  record.completedAt = Date.now();
  record.warnings = Object.keys(warningCounts).sort();
  await db.imports.put(record);
  return { ...record, warningCounts };
}

/** Riconosce una cancellazione cooperativa indipendentemente dal costruttore. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

/** Esito della persistenza library. */
export interface LibrarySummary {
  playlists: number;
  playlistItems: number;
  playlistItemsSkipped: number;
  libraryItems: number;
  libraryItemsSkipped: number;
}

/**
 * Persiste lo snapshot library/playlist/follow (T0.3.6). Gli URI nativi
 * vengono risolti sulle entità già presenti nel DB (import della cronologia
 * eseguito prima); i riferimenti non risolvibili sono contati e scartati —
 * non esiste una tabella per i raw ref (ADR-0003: il raw non è persistito).
 */
export async function importLibrary(
  db: LifeSoundtrackDB,
  snapshot: LibrarySnapshot,
): Promise<LibrarySummary> {
  const summary: LibrarySummary = {
    playlists: 0,
    playlistItems: 0,
    playlistItemsSkipped: 0,
    libraryItems: 0,
    libraryItemsSkipped: 0,
  };

  // Mappa uri nativo → trackId, costruita dalle track presenti (nessun indice
  // su platformIds: una scansione one-shot è accettabile a fine import).
  const trackIdByUri = new Map<string, string>();
  await db.tracks.each((track) => {
    const native = track.platformIds?.spotify;
    if (native) {
      trackIdByUri.set(`spotify:track:${native}`, track.id);
    }
  });

  const playlists: Playlist[] = snapshot.playlists;
  await db.playlists.bulkPut(playlists);
  summary.playlists = playlists.length;

  const items: PlaylistItem[] = [];
  for (const ref of snapshot.playlistItems) {
    const trackId = ref.sourceTrackUri ? trackIdByUri.get(ref.sourceTrackUri) : undefined;
    if (!trackId) {
      summary.playlistItemsSkipped += 1;
      continue;
    }
    items.push({
      playlistId: ref.playlistId,
      trackId,
      position: ref.position,
      addedAt: ref.addedAt,
    });
  }
  await db.playlistItems.bulkPut(items);
  summary.playlistItems = items.length;

  const library: LibraryItem[] = [];
  for (const ref of snapshot.libraryItems) {
    const item: LibraryItem = {
      id: uuid(),
      platform: 'spotify',
      kind: ref.kind,
      trackId: null,
      albumId: null,
      artistId: null,
      addedAt: ref.addedAt,
    };
    if (ref.kind === 'saved_track') {
      const trackId = ref.uri ? trackIdByUri.get(ref.uri) : undefined;
      if (!trackId) {
        summary.libraryItemsSkipped += 1;
        continue;
      }
      item.trackId = trackId;
    } else if (ref.kind === 'followed_artist') {
      const artist = ref.name ? await db.artists.where('name').equals(ref.name).first() : undefined;
      if (!artist) {
        summary.libraryItemsSkipped += 1;
        continue;
      }
      if (ref.uri) {
        const native = ref.uri.split(':').pop() ?? null;
        if (native) {
          artist.platformIds = { ...artist.platformIds, spotify: native };
          await db.artists.put(artist);
        }
      }
      item.artistId = artist.id;
    } else {
      const album = ref.name ? await db.albums.where('name').equals(ref.name).first() : undefined;
      if (!album) {
        summary.libraryItemsSkipped += 1;
        continue;
      }
      item.albumId = album.id;
    }
    library.push(item);
  }
  await db.library.bulkPut(library);
  summary.libraryItems = library.length;
  return summary;
}
