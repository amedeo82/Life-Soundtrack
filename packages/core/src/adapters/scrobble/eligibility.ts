import type { ListenEvent, PlatformId, ScrobbleHubId, Track } from '../../schema';
import type { LifeSoundtrackDB } from '../../db/db';
import { enqueueScrobble, listScrobbleQueue } from '../../db/scrobbleOutbox';
import type { ScrobblePayload } from './types';

/**
 * Filtro di eleggibilità degli scrobble — `20-SCROBBLING-HUB.md` v1.0 §5
 * (passo [3b]) e §7 (regola di maturità).
 *
 * Un ascolto locale è candidato per l'hub H se sono soddisfatte **tutte** le
 * condizioni della tabella §5:
 *
 * | # | Condizione |
 * |---|------------|
 * | 1 | `H ∈ PrivacySettings.scrobbleHubs` (consenso esplicito) |
 * | 2 | `platform` dell'ascolto **non** è un hub (anti-loop) |
 * | 3 | `timestamp` nella finestra di candidatura (7 giorni, D-SH.12) |
 * | 4 | `skipped !== true` |
 * | 5 | **maturato** secondo §7 |
 * | 6 | `eventKey` assente dalla coda per H (G-SH.1) |
 */

/** Finestra di candidatura predefinita: **7 giorni** (D-SH.12). */
export const SCROBBLE_CANDIDACY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Durata minima per considerare un ascolto reale: 30 s (T-SH.3). */
export const SCROBBLE_MIN_DURATION_MS = 30_000;

/** Soglia di maturità a tempo: 4 minuti (T-SH.3, D-SH.13). */
export const SCROBBLE_FALLBACK_THRESHOLD_MS = 4 * 60 * 1000;

/** Gli hub sono anche piattaforme sorgente: i loro ascolti non vengono rimandati. */
export const SCROBBLE_HUB_PLATFORMS: readonly PlatformId[] = ['lastfm', 'listenbrainz'];

/** Un ascolto locale in esame per l'eligibilità. */
export interface ScrobbleCandidate {
  /** Chiave di idempotenza locale dell'ascolto (`05§3.2`). */
  eventKey: string;
  /** Piattaforma **sorgente** dell'ascolto. */
  platform: PlatformId;
  /** Inizio dell'ascolto (unix ms UTC), null se ignoto. */
  startedAt: number | null;
  /** Durata effettivamente ascoltata (ms): 0 = ignota. */
  durationMs: number;
  /** Durata **catalogo** del brano (ms), se nota. */
  catalogDurationMs: number | null;
  /** L'utente ha skippato l'ascolto. */
  skipped: boolean;
}

/** Un candidato con i metadati del brano già risolti dal DB. */
export interface ResolvedScrobbleCandidate extends ScrobbleCandidate {
  /** Brano normalizzato (null se non trovato). */
  track: Track | null;
  /** Nome dell'artista (null se non trovato). */
  artistName: string | null;
  /** Nome dell'album (null se non presente). */
  albumName: string | null;
}

/** Opzioni del filtro di eleggibilità. */
export interface EligibilityOptions {
  /** Hub di destinazione. */
  hub: ScrobbleHubId;
  /** Hub abilitati dall'utente (consenso, condizione 1). */
  enabledHubs: readonly ScrobbleHubId[];
  /** Istante di riferimento (unix ms). */
  now: number;
  /** Finestra di candidatura (ms): default 7 giorni (D-SH.12). */
  windowMs?: number;
}

/**
 * Regola di maturità (§7, T-SH.3 con D-SH.13).
 *
 * - durata **nota**: maturo se durata > 30 s **e** tempo trascorso ≥
 *   min(metà durata, 4 minuti);
 * - durata **ignota** e sorgente **hub**: maturo **all'atto** — la fonte ha
 *   già applicato la propria regola (D-SH.13);
 * - durata **ignota** e sorgente non-hub: maturo se il tempo trascorso dal
 *   `startedAt` è ≥ 4 minuti.
 */
export function isMature(candidate: ScrobbleCandidate, now: number): boolean {
  if (candidate.startedAt === null) {
    return false;
  }
  const elapsed = now - candidate.startedAt;
  if (elapsed < 0) {
    return false;
  }
  const sourceIsHub = SCROBBLE_HUB_PLATFORMS.includes(candidate.platform);
  const duration = candidate.durationMs > 0 ? candidate.durationMs : candidate.catalogDurationMs;
  if (duration === null || duration <= 0) {
    // Durata ignota: la fonte ha già deciso, oppure si usa il tempo trascorso.
    return sourceIsHub || elapsed >= SCROBBLE_FALLBACK_THRESHOLD_MS;
  }
  if (duration <= SCROBBLE_MIN_DURATION_MS) {
    return false;
  }
  const required = Math.min(duration / 2, SCROBBLE_FALLBACK_THRESHOLD_MS);
  return elapsed >= required;
}

/**
 * Verifica tutte le condizioni della tabella §5.
 *
 * `alreadyQueued` è la condizione 6: l'evento è già in coda per quell'hub.
 */
export function isEligible(
  candidate: ScrobbleCandidate,
  options: EligibilityOptions,
  alreadyQueued: boolean,
): boolean {
  if (!options.enabledHubs.includes(options.hub)) {
    return false;
  }
  if (SCROBBLE_HUB_PLATFORMS.includes(candidate.platform)) {
    return false;
  }
  if (candidate.skipped) {
    return false;
  }
  if (candidate.startedAt === null) {
    return false;
  }
  const windowMs = options.windowMs ?? SCROBBLE_CANDIDACY_WINDOW_MS;
  if (windowMs > 0 && options.now - candidate.startedAt > windowMs) {
    return false;
  }
  if (!isMature(candidate, options.now)) {
    return false;
  }
  return !alreadyQueued;
}

/**
 * Costruisce i candidati dalla tabella `listens`, unendo i metadati del brano.
 *
 * La finestra è applicata **in query** (`timestamp`), il resto dei filtri in
 * memoria: sono condizioni cheap e la tabella locale è già indicizzata.
 *
 * I brani sono risolti con una **scansione**: la PK di `tracks` è
 * `canonicalKey` e `id` non è indicizzato (`02§6`), quindi non esiste una
 * query per `listen.trackId`. È lo stesso approccio di
 * `db/orphan-cleanup.ts`.
 */
export async function collectCandidates(
  db: LifeSoundtrackDB,
  options: EligibilityOptions,
): Promise<ResolvedScrobbleCandidate[]> {
  const windowMs = options.windowMs ?? SCROBBLE_CANDIDACY_WINDOW_MS;
  const windowStart = options.now - windowMs;
  const listens: ListenEvent[] =
    windowMs > 0
      ? await db.listens.where('timestamp').aboveOrEqual(windowStart).toArray()
      : await db.listens.toArray();

  const trackById = new Map<string, Track>();
  for (const track of await db.tracks.toArray()) {
    trackById.set(track.id, track);
  }

  const resolved: ResolvedScrobbleCandidate[] = [];
  for (const listen of listens) {
    const track = trackById.get(listen.trackId) ?? null;
    const artist = track?.artistId ? await db.artists.get(track.artistId) : undefined;
    const album = track?.albumId ? await db.albums.get(track.albumId) : undefined;
    resolved.push({
      eventKey: listen.eventKey,
      platform: listen.platform,
      startedAt: listen.startedAt,
      durationMs: listen.durationMs,
      catalogDurationMs: track?.durationMs ?? null,
      skipped: listen.skipped,
      track,
      artistName: artist?.name ?? null,
      albumName: album?.name ?? null,
    });
  }
  return resolved;
}

/**
 * Costruisce il payload di invio per un candidato (il tipo è chiuso per
 * costruzione: nessun campo per contesto, device, IP o insight).
 */
export function buildPayload(
  candidate: ResolvedScrobbleCandidate,
  hub: ScrobbleHubId,
): ScrobblePayload | null {
  const { track } = candidate;
  if (!track || !candidate.artistName || candidate.startedAt === null) {
    return null;
  }
  const durationMs =
    candidate.durationMs > 0 ? candidate.durationMs : (track.durationMs ?? undefined);
  const payload: ScrobblePayload = {
    idempotencyKey: `${hub}|${candidate.eventKey}`,
    startedAt: candidate.startedAt,
    artistName: candidate.artistName,
    trackName: track.name,
  };
  if (durationMs !== undefined) {
    payload.durationMs = durationMs;
  }
  if (track.mbid) {
    payload.recordingMbid = track.mbid;
  }
  if (track.isrc) {
    payload.isrc = track.isrc;
  }
  if (candidate.albumName) {
    payload.albumName = candidate.albumName;
  }
  return payload;
}

/**
 * Passo [3b]+[3c] del flusso: seleziona i candidati e li mette in coda.
 *
 * @returns numero di righe **inserite** (una doppia enqueue non è un errore:
 *   G-SH.1).
 */
export async function enqueueEligibleListens(
  db: LifeSoundtrackDB,
  options: EligibilityOptions,
): Promise<number> {
  if (!options.enabledHubs.includes(options.hub)) {
    return 0;
  }
  const queued = await listScrobbleQueue(db, options.hub);
  const queuedKeys = new Set(queued.map((row) => row.eventKey));
  const candidates = await collectCandidates(db, options);
  let inserted = 0;
  for (const candidate of candidates) {
    if (!isEligible(candidate, options, queuedKeys.has(candidate.eventKey))) {
      continue;
    }
    const payload = buildPayload(candidate, options.hub);
    if (!payload) {
      continue;
    }
    const ok = await enqueueScrobble(db, {
      hub: options.hub,
      eventKey: candidate.eventKey,
      payload,
    });
    if (ok) {
      queuedKeys.add(candidate.eventKey);
      inserted += 1;
    }
  }
  return inserted;
}
