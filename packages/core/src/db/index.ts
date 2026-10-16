/**
 * Database locale Life-Soundtrack — layer Dexie (11-BACKLOG Story 0.2).
 *
 * Entry point `@ls/core/db`: classe Dexie, schema dichiarato e repository
 * di accesso ai dati. Lo schema rispecchia `02-DATA-SCHEMA.md` §6 (v1.1).
 */
export { DB_NAME, DB_SCHEMA_V1, DB_SCHEMA_V2, LifeSoundtrackDB, openDb } from './db';

/**
 * Repository di accesso ai dati — CRUD e query base (11-BACKLOG T0.2.3).
 */
export {
  countListens,
  getAlbum,
  getArtist,
  getFeatures,
  getListen,
  getTrack,
  listAlbumsByArtist,
  listArtistsByName,
  listArtistsByMbid,
  listFeaturesBySource,
  listListensByDay,
  listListensByImport,
  listListensByPlatform,
  listListensByTrack,
  listListensInRange,
  listTracksByAlbum,
  listTracksByArtist,
  listTracksByIsrc,
  listTracksByMbid,
  listTracksByName,
  purgeIp,
  putAlbums,
  putArtists,
  putFeatures,
  putListens,
  putTracks,
} from './repositories';

/**
 * Ricalcolo contatori denormalizzati `listenCount` (11-BACKLOG T0.2.4, 02§7 MIG-4).
 */
export { recount } from './recount';
