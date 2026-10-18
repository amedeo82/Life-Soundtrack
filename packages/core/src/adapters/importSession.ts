import type {
  ImportRecord,
  LibraryItem,
  Playlist,
  PlaylistItem,
  PrivacySettings,
} from '../schema';
import type { LifeSoundtrackDB } from '../db';
import { recount } from '../db';
import { AdapterError } from './errors';
import { sha256Hex, uuid } from './crypto';
import { NormalizationPipeline } from './pipeline';
import type { LibrarySnapshot, ParseOptions, PlatformAdapter, RawListenEvent } from './types';

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
  const record: ImportRecord = {
    id: uuid(),
    platform: adapter.platform,
    fileName: options.fileName ?? 'streaming-history',
    fileHash: '',
    startedAt: Date.now(),
    completedAt: null,
    status: 'running',
    eventsParsed: 0,
    eventsInserted: 0,
    eventsDuplicated: 0,
    warnings: [],
  };
  const warningCounts: Record<string, number> = {};
  const countWarning = (code: string): void => {
    warningCounts[code] = (warningCounts[code] ?? 0) + 1;
  };
  const finalize = async (status: ImportRecord['status']): Promise<ImportSummary> => {
    record.status = status;
    record.completedAt = Date.now();
    record.warnings = Object.keys(warningCounts).sort();
    await db.imports.put(record);
    return { ...record, warningCounts };
  };

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
    await finalize('failed');
    throw new AdapterError('INVALID_FORMAT', `${adapter.name}: formato non riconosciuto`);
  }

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
    const intraDuplicates = keys.length - new Set(keys).size;
    let duplicates = intraDuplicates;
    for (const key of keys) {
      if (seenEventKeys.has(key)) {
        duplicates += 1;
      } else {
        seenEventKeys.add(key);
      }
    }
    const newKeys = [...new Set(keys)];
    const existing = await db.listens.bulkGet(newKeys);
    duplicates += existing.filter((e) => e !== undefined).length;
    const { tracks, artists, albums } = pipeline.dirtyRecords();
    await db.transaction('rw', db.listens, db.tracks, db.artists, db.albums, async () => {
      await db.listens.bulkPut(events);
      await db.tracks.bulkPut(tracks);
      await db.artists.bulkPut(artists);
      await db.albums.bulkPut(albums);
    });
    pipeline.clearDirty();
    record.eventsInserted += events.length - duplicates;
    record.eventsDuplicated += duplicates;
  };

  try {
    const parseOptions: ParseOptions = { onWarning: countWarning };
    if (options.signal) {
      parseOptions.signal = options.signal;
    }
    const iterator = adapter.parse(input, parseOptions)[Symbol.asyncIterator]();
    for (;;) {
      const step = await iterator.next();
      if (step.done) {
        break;
      }
      buffer.push(step.value);
      record.eventsParsed += 1;
      if (buffer.length >= IMPORT_CHUNK_SIZE) {
        await flush();
        options.onProgress?.(record.eventsParsed);
        if (options.signal?.aborted) {
          throw new DOMException('Import cancellato', 'AbortError');
        }
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
      // Partial recovery: il record va a `partial` con i chunk già flushati.
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

/** Riconosce una cancellazione cooperativa indipendentemente dal costruttore. */
function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === 'AbortError'
      : error instanceof Error && error.name === 'AbortError'
  );
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
