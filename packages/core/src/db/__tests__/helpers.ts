import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Album,
  type Artist,
  type AudioFeatures,
  type ListenEvent,
  type Track,
} from '../../schema';
import { LifeSoundtrackDB } from '../db';

/**
 * Factory e helper condivisi dai test del layer DB.
 * Non è un file di test: non include asserzioni né si registra a hook.
 */

let seq = 0;

/** Id progressivo a larghezza fissa: l'ordine lessicografico delle PK resta deterministico. */
export function sid(): string {
  seq += 1;
  return String(seq).padStart(6, '0');
}

export function makeListen(overrides: Partial<ListenEvent> = {}): ListenEvent {
  const id = sid();
  return {
    id: `le-${id}`,
    eventKey: `spotify:ek-${id}`,
    platform: 'spotify',
    importId: 'imp-1',
    timestamp: 1710523800000 + seq * 1000,
    startedAt: 1710523555000 + seq * 1000,
    durationMs: 245000,
    trackId: 'track-uuid-1',
    completed: true,
    skipped: false,
    shuffle: null,
    offline: null,
    incognito: null,
    reasonStart: null,
    reasonEnd: null,
    deviceType: 'mobile',
    deviceDetail: null,
    ip: null,
    country: 'IT',
    city: null,
    citySource: null,
    cityConfidence: null,
    day: '2024-03-15',
    ...overrides,
  };
}

export function makeTrack(overrides: Partial<Track> = {}): Track {
  const id = sid();
  return {
    id: `track-uuid-${id}`,
    canonicalKey: `fuzzy:ck-${id}`,
    name: `Brano ${id}`,
    artistId: 'artist-1',
    albumId: null,
    durationMs: 200000,
    isrc: null,
    mbid: null,
    explicit: null,
    genres: [],
    artworkUrl: null,
    platformIds: {},
    firstSeenAt: 1710523555000,
    lastSeenAt: 1710523800000,
    listenCount: 0,
    ...overrides,
  };
}

export function makeArtist(overrides: Partial<Artist> = {}): Artist {
  const id = sid();
  return {
    id: `artist-${id}`,
    name: `Artista ${id}`,
    mbid: null,
    genres: [],
    platformIds: {},
    listenCount: 0,
    ...overrides,
  };
}

export function makeAlbum(overrides: Partial<Album> = {}): Album {
  const id = sid();
  return {
    id: `album-${id}`,
    name: `Album ${id}`,
    artistId: 'artist-1',
    mbid: null,
    upc: null,
    releaseDate: null,
    artworkUrl: null,
    platformIds: {},
    ...overrides,
  };
}

export function makeFeatures(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  const id = sid();
  return {
    trackId: `track-uuid-${id}`,
    valence: 0.5,
    energy: 0.5,
    danceability: null,
    acousticness: null,
    instrumentalness: null,
    speechiness: null,
    liveness: null,
    tempo: null,
    key: null,
    mode: null,
    loudness: null,
    timeSignature: null,
    source: 'heuristic',
    fetchedAt: 1710523800000,
    schemaVersion: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture 10-TESTING.md §3.2
// ---------------------------------------------------------------------------

export interface DbSeedFixture {
  listens: ListenEvent[];
  tracks: Track[];
  artists: Artist[];
}

export function loadSeed(name: 'minimal' | 'medium'): DbSeedFixture {
  const path = fileURLToPath(
    new URL(`../../../../../fixtures/db-seed/${name}.json`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf8')) as DbSeedFixture;
}

/** Conti attesi a valle del merge sulla PK canonicalKey (gruppi DEDUP fusi). */
export function seedCounts(seed: DbSeedFixture): {
  listens: number;
  tracks: number;
  artists: number;
} {
  return {
    listens: seed.listens.length,
    tracks: new Set(seed.tracks.map((t) => t.canonicalKey)).size,
    artists: new Set(seed.artists.map((a) => a.id)).size,
  };
}

// ---------------------------------------------------------------------------
// Gestione DB nei test
// ---------------------------------------------------------------------------

const dbs: LifeSoundtrackDB[] = [];

/** Registra un DB esterno per la pulizia in afterEach. */
export function registerDb(db: LifeSoundtrackDB): void {
  dbs.push(db);
}

export function freshDb(name: string): LifeSoundtrackDB {
  const db = new LifeSoundtrackDB(name);
  dbs.push(db);
  return db;
}

export function trackCanonicalKey(seed: DbSeedFixture, trackId: string): string | undefined {
  return seed.tracks.find((t) => t.id === trackId)?.canonicalKey;
}

/** Chiude e cancella tutti i DB creati nei test (da chiamare in afterEach). */
export async function closeAllDbs(): Promise<void> {
  await Promise.all(dbs.splice(0).map((db) => db.delete()));
}
