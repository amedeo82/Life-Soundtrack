import { runRemoteImport } from '../importSession';
import type { ImportSummary } from '../importSession';
import type { ListenBrainzAdapter } from '../listenbrainz/adapter';
import { LISTENBRAINZ_DEFAULT_ENDPOINT } from '../listenbrainz/scrobble';
import type { PrivacySettings } from '../../schema';
import type { LifeSoundtrackDB } from '../../db/db';
import {
  loadScrobbleCursor,
  saveScrobbleCursor,
  SCROBBLE_CURSOR_LISTENBRAINZ_KEY,
} from '../../db/settings';
import type { ScrobbleCursor } from '../../db/settings';

/**
 * Sync continua incrementale di ListenBrainz — `20-SCROBBLING-HUB.md` v1.0 §9
 * (C-SH.1…C-SH.8).
 *
 * Il percorso è di **lettura**: passa dal contratto `parseRemote?()` di
 * ADR-0010, non dal contratto di scrittura. Gli eventi letti hanno
 * `platform = 'listenbrainz'` e **non** vengono rimandati al sync in scrittura
 * (C-SH.8, anti-loop).
 *
 * Il **cursore** è persistito: senza persistenza ogni sync ripartirebbe da
 * capo, e la story chiede esplicitamente di **non re-importare da zero**
 * (AC-SH.6, AC-SH.7).
 */

/** Opzioni della sync incrementale ListenBrainz. */
export interface IncrementalSyncOptions {
  /** DB locale. */
  db: LifeSoundtrackDB;
  /** Adapter ListenBrainz (istanza dedicata: espone il cursore letto). */
  adapter: ListenBrainzAdapter;
  /** User Token (per-utente, mai nel bundle). */
  token: string;
  /** Username ListenBrainz (percorso `/1/user/{username}/listens`). */
  username: string;
  /** Impostazioni privacy applicate all'import. */
  privacy: PrivacySettings;
  /** Endpoint base (testabile). */
  endpoint?: string;
  /** `User-Agent` obbligatorio (C-SH.5). */
  userAgent: string;
  /** Chiave del cursore (default: quella di C-SH.1). */
  cursorKey?: string;
  /** Cancellazione cooperativa. */
  signal?: AbortSignal;
}

/** Esito di una sync incrementale. */
export interface IncrementalSyncResult {
  /** Summary dell'import (record persistito + conteggi warning). */
  import: ImportSummary;
  /** Cursore dopo la sync. */
  cursor: ScrobbleCursor;
  /** true se la sync ha letto almeno un ascolto. */
  imported: boolean;
}

/**
 * Esegue una sync incrementale e **persiste il cursore**.
 *
 * Il cursore avanza solo con i `listened_at` effettivamente letti: una sync
 * vuota non lo tocca, così la successiva riparte dallo stesso punto.
 */
export async function syncListenbrainzIncrementally(
  options: IncrementalSyncOptions,
): Promise<IncrementalSyncResult> {
  const cursorKey = options.cursorKey ?? SCROBBLE_CURSOR_LISTENBRAINZ_KEY;
  const cursor = await loadScrobbleCursor(options.db, cursorKey);
  const endpoint = options.endpoint ?? LISTENBRAINZ_DEFAULT_ENDPOINT;
  const base = `${endpoint.replace(/\/+$/, '')}/1/user/${encodeURIComponent(options.username)}`;

  options.adapter.lastRemoteTimestamp = null;

  const summary = await runRemoteImport(
    options.db,
    options.adapter,
    {
      endpoint: base,
      credentials: { sessionKey: options.token },
      headers: { 'User-Agent': options.userAgent },
      pagination: { to: cursor.maxTs ?? undefined },
      ...(options.signal ? { signal: options.signal } : {}),
    },
    {
      privacy: options.privacy,
      fileName: 'listenbrainz-incremental',
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );

  const latest = options.adapter.lastRemoteTimestamp;
  const nextCursor: ScrobbleCursor = {
    maxTs: latest !== null ? Math.max(latest, cursor.maxTs ?? latest) : cursor.maxTs,
    lastSyncedAt: Date.now(),
  };
  await saveScrobbleCursor(options.db, nextCursor, cursorKey);

  return { import: summary, cursor: nextCursor, imported: latest !== null };
}
