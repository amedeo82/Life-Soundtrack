/**
 * Loader del fixture **demo** — Story 3.5, spec `docs/26-ONBOARDING-DEMO.md`
 * v1.0 (D-26.1, D-26.2).
 *
 * La demo vive in un **database separato** (`life-soundtrack-demo`): il
 * database dell'utente non viene mai toccato, né in scrittura né in lettura.
 * Il DB demo viene creato, popolato e poi **cancellato** con un click
 * (`06-UX-FLOWS-STATES.md` §2.14).
 *
 * Il loader fa tre cose (26§1):
 *
 * 1. **normalizza lo schema**: i campi assenti nel fixture (per esempio i
 *    tre campi città introdotti dallo schema v6) diventano `null`;
 * 2. **chiude i riferimenti**: per ogni `albumId` distinto dei brani esiste
 *    una riga `Album` → nessun riferimento pendente;
 * 3. **ricalcola i contatori** denormalizzati con `recount(db)`: i
 *    `listenCount` non si copiano dal fixture, si deducono dagli eventi.
 *
 * Il seed avviene in **una transazione Dexie**: un'interruzione non lascia
 * metà demo.
 */

import { LifeSoundtrackDB } from './db';
import { recount } from './recount';
import type { Album, Artist, AudioFeatures, ListenEvent, Track } from '../schema';

/**
 * Il nome del database **demo**: il secondo database Dexie dell'app.
 *
 * Diverso dal `DB_NAME` dell'utente per costruzione: i due dataset non
 * possono mescolarsi (D-26.1).
 */
export const DEMO_DB_NAME = 'life-soundtrack-demo';

/** Il report del seed: quante righe sono finite nel database. */
export interface DemoSeedReport {
  readonly listens: number;
  readonly tracks: number;
  readonly artists: number;
  readonly albums: number;
  readonly features: number;
}

/**
 * La forma minima del fixture demo.
 *
 * I quattro array sono opzionali e **non tipizzati**: il fixture è un file
 * JSON esterno e il loader ne normalizza i campi (26§1.1).
 */
export interface DemoFixture {
  readonly listens?: readonly unknown[] | undefined;
  readonly tracks?: readonly unknown[] | undefined;
  readonly artists?: readonly unknown[] | undefined;
  readonly albums?: readonly unknown[] | undefined;
  readonly features?: readonly unknown[] | undefined;
}

/** Opzioni del seed. */
export interface DemoSeedOptions {
  /** Timestamp delle feature senza `fetchedAt` (default: adesso). */
  readonly now?: number | undefined;
}

/** Il valore di `source` delle feature demo: sintetiche ma **dichiarate** (D-26.3). */
const DEMO_FEATURE_SOURCE = 'manual';

/** La versione dello schema delle feature (`enrichment/mapping.ts`). */
const DEMO_FEATURE_SCHEMA_VERSION = 1;

/** Un oggetto del fixture letto come record: `unknown` con chiavi note. */
type RawRecord = Record<string, unknown>;

/** Il fixture contiene un oggetto? */
function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Il record è un array con almeno un elemento? */
function isNonEmptyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0;
}

/** Una stringa non vuota, altrimenti il fallback. */
function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** Un numero finito, altrimenti il fallback. */
function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Una stringa o `null`. */
function nullableStr(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Un numero o `null`. */
function nullableNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Un array di stringhe (vuoto se non c'è). */
function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** Il giorno UTC (`YYYY-MM-DD`) di un timestamp. */
function dayOf(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Normalizza un ascolto del fixture allo schema corrente.
 *
 * I tre campi città (schema v6, Story 1.6) **non esistono** nel fixture
 * demo: diventano `null` (dato assente), non un valore inventato.
 */
function toListen(raw: RawRecord): ListenEvent | null {
  const eventKey = str(raw.eventKey);
  const trackId = str(raw.trackId);
  const timestamp = num(raw.timestamp, NaN);
  if (!eventKey || !trackId || !Number.isFinite(timestamp)) return null;

  const startedAt = nullableNum(raw.startedAt);
  const durationMs = num(raw.durationMs, 0);
  return {
    id: str(raw.id, eventKey),
    eventKey,
    platform: str(raw.platform, 'manual') as ListenEvent['platform'],
    importId: str(raw.importId, 'demo'),
    timestamp,
    startedAt,
    durationMs,
    trackId,
    completed: raw.completed === true,
    skipped: raw.skipped === true,
    shuffle: typeof raw.shuffle === 'boolean' ? raw.shuffle : null,
    offline: typeof raw.offline === 'boolean' ? raw.offline : null,
    incognito: typeof raw.incognito === 'boolean' ? raw.incognito : null,
    reasonStart: nullableStr(raw.reasonStart),
    reasonEnd: nullableStr(raw.reasonEnd),
    deviceType: str(raw.deviceType, 'unknown') as ListenEvent['deviceType'],
    deviceDetail: nullableStr(raw.deviceDetail),
    ip: nullableStr(raw.ip),
    country: nullableStr(raw.country),
    city: nullableStr(raw.city),
    citySource: nullableStr(raw.citySource) as ListenEvent['citySource'],
    cityConfidence: nullableNum(raw.cityConfidence),
    day: str(raw.day, dayOf(timestamp)),
  };
}

/** Normalizza un brano del fixture allo schema corrente. */
function toTrack(raw: RawRecord): Track | null {
  const canonicalKey = str(raw.canonicalKey);
  const id = str(raw.id);
  if (!canonicalKey || !id) return null;
  return {
    id,
    canonicalKey,
    name: str(raw.name),
    artistId: str(raw.artistId),
    albumId: nullableStr(raw.albumId),
    durationMs: nullableNum(raw.durationMs),
    isrc: nullableStr(raw.isrc),
    mbid: nullableStr(raw.mbid),
    explicit: typeof raw.explicit === 'boolean' ? raw.explicit : null,
    genres: strArray(raw.genres),
    artworkUrl: nullableStr(raw.artworkUrl),
    platformIds: isRecord(raw.platformIds) ? (raw.platformIds as Track['platformIds']) : {},
    firstSeenAt: num(raw.firstSeenAt, 0),
    lastSeenAt: num(raw.lastSeenAt, 0),
    listenCount: 0,
  };
}

/** Normalizza un artista del fixture allo schema corrente. */
function toArtist(raw: RawRecord): Artist | null {
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    name: str(raw.name),
    mbid: nullableStr(raw.mbid),
    genres: strArray(raw.genres),
    platformIds: isRecord(raw.platformIds) ? (raw.platformIds as Artist['platformIds']) : {},
    listenCount: 0,
  };
}

/** Normalizza un album del fixture allo schema corrente. */
function toAlbum(raw: RawRecord): Album | null {
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    name: str(raw.name),
    artistId: str(raw.artistId),
    mbid: nullableStr(raw.mbid),
    upc: nullableStr(raw.upc),
    releaseDate: nullableStr(raw.releaseDate),
    artworkUrl: nullableStr(raw.artworkUrl),
    platformIds: isRecord(raw.platformIds) ? (raw.platformIds as Album['platformIds']) : {},
  };
}

/** Normalizza una feature del fixture allo schema corrente. */
function toFeature(raw: RawRecord, now: number): AudioFeatures | null {
  const trackId = str(raw.trackId);
  if (!trackId) return null;
  return {
    trackId,
    valence: nullableNum(raw.valence),
    energy: nullableNum(raw.energy),
    danceability: nullableNum(raw.danceability),
    acousticness: nullableNum(raw.acousticness),
    instrumentalness: nullableNum(raw.instrumentalness),
    speechiness: nullableNum(raw.speechiness),
    liveness: nullableNum(raw.liveness),
    tempo: nullableNum(raw.tempo),
    key: nullableNum(raw.key),
    mode: raw.mode === 0 || raw.mode === 1 ? raw.mode : null,
    loudness: nullableNum(raw.loudness),
    timeSignature: nullableNum(raw.timeSignature),
    source: str(raw.source, DEMO_FEATURE_SOURCE) as AudioFeatures['source'],
    fetchedAt: num(raw.fetchedAt, now),
    schemaVersion: num(raw.schemaVersion, DEMO_FEATURE_SCHEMA_VERSION),
  };
}

/**
 * Popola il database demo con il fixture.
 *
 * Il seed è **idempotente**: le tabelle vengono svuotate e ripopolate nella
 * stessa transazione, quindi due seed sullo stesso database non duplicano
 * nulla e non lasciano righe obsolete.
 *
 * @param db - il database demo (di norma `openDb(DEMO_DB_NAME)`).
 * @param fixture - il fixture demo già caricato (vedi `loadDemoFixture`).
 * @param options - `now`: timestamp per le feature senza `fetchedAt`.
 */
export async function seedDemoDatabase(
  db: LifeSoundtrackDB,
  fixture: DemoFixture,
  options: DemoSeedOptions = {},
): Promise<DemoSeedReport> {
  const now = options.now ?? Date.now();

  const listens = (fixture.listens ?? [])
    .filter(isRecord)
    .map(toListen)
    .filter((listen): listen is ListenEvent => listen !== null);
  const tracks = (fixture.tracks ?? [])
    .filter(isRecord)
    .map(toTrack)
    .filter((track): track is Track => track !== null);
  const artists = (fixture.artists ?? [])
    .filter(isRecord)
    .map(toArtist)
    .filter((artist): artist is Artist => artist !== null);
  const features = (fixture.features ?? [])
    .filter(isRecord)
    .map((raw) => toFeature(raw, now))
    .filter((feature): feature is AudioFeatures => feature !== null);

  // Gli album dichiarati nel fixture, più quelli **derivati** dai `albumId`
  // dei brani: nessun riferimento pendente, nemmeno se il fixture ne omette
  // qualcuno (26§1.2).
  const albums = new Map<string, Album>();
  for (const raw of fixture.albums ?? []) {
    if (!isRecord(raw)) continue;
    const album = toAlbum(raw);
    if (album) albums.set(album.id, album);
  }
  for (const track of tracks) {
    if (!track.albumId || albums.has(track.albumId)) continue;
    albums.set(track.albumId, {
      id: track.albumId,
      name: `Album ${track.albumId}`,
      artistId: track.artistId,
      mbid: null,
      upc: null,
      releaseDate: null,
      artworkUrl: null,
      platformIds: {},
    });
  }

  await db.transaction(
    'rw',
    db.listens,
    db.tracks,
    db.artists,
    db.albums,
    db.features,
    async () => {
      await db.listens.clear();
      await db.tracks.clear();
      await db.artists.clear();
      await db.albums.clear();
      await db.features.clear();

      if (listens.length > 0) await db.listens.bulkPut(listens);
      if (tracks.length > 0) await db.tracks.bulkPut(tracks);
      if (artists.length > 0) await db.artists.bulkPut(artists);
      if (albums.size > 0) await db.albums.bulkPut([...albums.values()]);
      if (features.length > 0) await db.features.bulkPut(features);
    },
  );

  // I contatori denormalizzati non si copiano dal fixture: si deducono dagli
  // eventi appena scritti (26§1.3).
  await recount(db);

  return {
    listens: listens.length,
    tracks: tracks.length,
    artists: artists.length,
    albums: albums.size,
    features: features.length,
  };
}

/**
 * Cancella il database demo — il click che chiude la demo (`06§2.14`).
 *
 * Il database dell'utente non è coinvolto: la demo è un database separato
 * (D-26.1), e cancellarlo non lascia tracce.
 *
 * @param dbName - il database da cancellare (default: quello demo).
 */
export async function clearDemoDatabase(dbName: string = DEMO_DB_NAME): Promise<void> {
  const db = new LifeSoundtrackDB(dbName);
  await db.delete();
}

/** Il fixture demo contiene abbastanza dati da popolare la demo? */
export function hasDemoData(fixture: DemoFixture): boolean {
  return (
    isNonEmptyArray(fixture.listens) &&
    isNonEmptyArray(fixture.tracks) &&
    isNonEmptyArray(fixture.artists)
  );
}
