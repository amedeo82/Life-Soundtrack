/**
 * Shape dei record di streaming history dell'export GDPR Spotify
 * (03-ADAPTERS/spotify.md §2-3). Tutti i campi oltre a `ts` e `ms_played`
 * sono opzionali o nullabili: l'export reale è eterogeneo tra anni.
 *
 * I campi `_case`/`_comment` sono annotazioni dei fixture di test
 * (`fixtures/synthetic-history/spotify-sample.json`): il mapping li ignora.
 */
export interface SpotifyStreamingRecord {
  /** ISO 8601 UTC — fine ascolto (spotify.md §5). */
  ts: string;
  /** Stringa raw della piattaforma, es. "Android OS 13 (samsung, SM-S911B)". */
  platform: string;
  /** ms effettivamente ascoltati. */
  ms_played: number;
  conn_country?: string | null;
  ip_addr?: string | null;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
  spotify_track_uri?: string | null;
  episode_name?: string | null;
  episode_show_name?: string | null;
  spotify_episode_uri?: string | null;
  reason_start?: string | null;
  reason_end?: string | null;
  shuffle?: boolean | null;
  skipped?: boolean | null;
  offline?: boolean | null;
  /** Unità variabile nel tempo: secondi (vecchi export) o ms — edge case E3. */
  offline_timestamp?: number | null;
  incognito_mode?: boolean | null;
  /** Annotazioni fixture (ignorate dal mapping). */
  _case?: string;
  _comment?: string;
}

/**
 * Guard runtime sui campi irrinunciabili (spotify.md §2.2: "rifiuta file
 * senza `ts` e `ms_played`"). Validazione per-evento senza dipendenze
 * esterne: la forma piatta del record rende superfluo un validator a schema.
 */
export function isSpotifyStreamingRecord(value: unknown): value is SpotifyStreamingRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.ts === 'string' &&
    typeof rec.ms_played === 'number' &&
    Number.isFinite(rec.ms_played)
  );
}
