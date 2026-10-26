import Dexie, { type EntityTable, type Table } from 'dexie';
import type { AppSetting } from './settings';
import type {
  Album,
  Artist,
  AudioFeatures,
  ImportRecord,
  Insight,
  LibraryItem,
  ListenEvent,
  ListeningSession,
  Playlist,
  PlaylistItem,
  SearchQuery,
  Track,
} from '../schema';

/**
 * Nome di default del database IndexedDB locale.
 * Ogni istanza dell'app ha un solo DB locale (ADR-0002 local-first).
 */
export const DB_NAME = 'life-soundtrack';

/**
 * Schema Dexie versione 1 — 02-DATA-SCHEMA.md §6 (stato pre-Sessione 9).
 * Sintassi Dexie: il primo indice è la chiave primaria; il prefisso `&`
 * la rende una chiave unica (`&x` ⇒ x è chiave primaria unica, §6).
 */
export const DB_SCHEMA_V1: Record<string, string> = {
  listens: '&eventKey, timestamp, startedAt, trackId, platform, day, importId',
  tracks: '&canonicalKey, name, artistId, albumId, isrc, mbid',
  artists: '&id, name, mbid',
  albums: '&id, name, artistId',
  features: '&trackId, source',
  sessions: '&id, startTime, platform, derivedVersion',
  insights: '&id, type, periodStart, derivedVersion, status',
  imports: '&id, platform, fileHash, startedAt',
  library: '&id, trackId, artistId, albumId, platform',
  playlists: '&id, platform',
  playlistItems: '&[playlistId+trackId], playlistId, addedAt',
};

/**
 * Schema Dexie versione 2 — 02-DATA-SCHEMA.md §6 v1.1 (Sessione 9, D.A.3).
 * Migrazione v1→v2: aggiunge solo `searchQueries`, nessuna modifica
 * distruttiva alle tabelle esistenti (§7 MIG-1).
 */
export const DB_SCHEMA_V2: Record<string, string> = {
  ...DB_SCHEMA_V1,
  searchQueries: '&id, platform, timestamp, [platform+normalized]',
};

/**
 * Schema Dexie versione 3 — 02-DATA-SCHEMA.md §10 (v1.2, Sessione 13).
 * Aggiunge `artworkUrl` (nullable) a `tracks` e `albums`; nessuna nuova
 * chiave di indicizzazione (§9). Migrazione non distruttiva (MIG-1).
 * I record esistenti ricevono `artworkUrl = null` via upgrade function.
 */
export const DB_SCHEMA_V3: Record<string, string> = {
  ...DB_SCHEMA_V2,
};

/**
 * Schema Dexie versione 4 — 02-DATA-SCHEMA.md §6 (Story 1.3).
 * Aggiunge `settings` (chiave/valore) per le **impostazioni locali** che
 * non sono dati di ascolto: proxy Last.fm, `api_key`, username
 * (`09-PRIVACY-SECURITY.md` §4). Migrazione non distruttiva (MIG-1): nessuna
 * tabella esistente viene modificata e nessun dato viene perso.
 */
export const DB_SCHEMA_V4: Record<string, string> = {
  ...DB_SCHEMA_V3,
  settings: '&key',
};

/**
 * Database locale Life-Soundtrack (IndexedDB via Dexie 4).
 *
 * Le tabelle con `&x` usano x come chiave primaria unica (02§6): in particolare
 * `listens` usa `eventKey` (idempotenza import, D.1.2) e `tracks` usa `canonicalKey`
 * (regole DEDUP §5). `ListenEvent.trackId` referenzia `Track.id` (UUID), come nei
 * fixture db-seed di `10-TESTING.md` §3.2; la PK di `tracks` resta l'identità DEDUP.
 */
export class LifeSoundtrackDB extends Dexie {
  listens!: EntityTable<ListenEvent, 'eventKey'>;
  tracks!: EntityTable<Track, 'canonicalKey'>;
  artists!: EntityTable<Artist, 'id'>;
  albums!: EntityTable<Album, 'id'>;
  features!: EntityTable<AudioFeatures, 'trackId'>;
  sessions!: EntityTable<ListeningSession, 'id'>;
  insights!: EntityTable<Insight, 'id'>;
  imports!: EntityTable<ImportRecord, 'id'>;
  library!: EntityTable<LibraryItem, 'id'>;
  playlists!: EntityTable<Playlist, 'id'>;
  playlistItems!: Table<PlaylistItem, [string, string]>;
  searchQueries!: EntityTable<SearchQuery, 'id'>;
  /** Impostazioni locali (proxy, chiavi per-utente): mai nel bundle. */
  settings!: EntityTable<AppSetting, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores(DB_SCHEMA_V1);
    this.version(2).stores(DB_SCHEMA_V2);
    this.version(3).stores(DB_SCHEMA_V3);
    this.version(3).upgrade((tx) => {
      tx.table('tracks')
        .toCollection()
        .modify((t) => {
          t.artworkUrl = t.artworkUrl ?? null;
        });
      tx.table('albums')
        .toCollection()
        .modify((a) => {
          a.artworkUrl = a.artworkUrl ?? null;
        });
    });
    this.version(4).stores(DB_SCHEMA_V4);
  }
}

/** Apre (o crea, se assente) il DB locale con lo schema corrente (versione 2). */
export async function openDb(name: string = DB_NAME): Promise<LifeSoundtrackDB> {
  const db = new LifeSoundtrackDB(name);
  await db.open();
  return db;
}
