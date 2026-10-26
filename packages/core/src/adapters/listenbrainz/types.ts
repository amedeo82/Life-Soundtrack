/**
 * Shape delle righe dell'export ListenBrainz
 * (`03-ADAPTERS/listenbrainz.md` §3, v1.0 🟢 APPROVED).
 *
 * L'export è generato dal server: i campi sono **quelli che il client di
 * scrobbling ha inviato** e possono mancare (`additional_info` è opzionale,
 * E.LB.1). Nessun campo è dato per scontato oltre `listened_at` e
 * `track_metadata` (i due minimi usati dal filtro §3.3).
 *
 * I campi `_case` / `_expectedOutput` sono annotazioni dei fixture di test
 * (`fixtures/synthetic-history/listenbrainz-sample.jsonl`): il mapping li
 * ignora, come per gli altri adapter.
 */

/** `additional_info`: dati opzionali inviati dal client di scrobbling. */
export interface ListenBrainzAdditionalInfo {
  /** Durata **catalogo** del brano (non la durata ascoltata): D7/E.LB.2. */
  duration_ms?: number | null;
  /** ISRC del brano: attiva DEDUP-1. */
  isrc?: string | null;
  /** MBID della registrazione inviato dal client: DEDUP-2 (fallback). */
  recording_mbid?: string | null;
  /** Client che ha scrobbato: conservato come `deviceDetail` grezzo. */
  media_player?: string | null;
  /** Versione del client: mai persistita. */
  submission_client?: string | null;
  submission_client_version?: string | null;
  /** Id di terze parti: mai usati (E.LB.12, nessuna chiamata secondaria). */
  origin_url?: string | null;
  spotify_id?: string | null;
  youtube_id?: string | null;
  /** Tag inseriti dall'utente: non sono generi, mai persistiti. */
  tags?: string[] | null;
  /** Numero di traccia: non modellato in 02§3.3. */
  tracknumber?: number | null;
}

/** Una credit unità artistica risolta dal server. */
export interface ListenBrainzArtistCredit {
  /** Nome del credit (es. "Artist A"). */
  artist_credit_name?: string | null;
  /** Separatore verso il credit successivo (es. " & "). */
  join_phrase?: string | null;
  /** MBID del singolo artista. */
  artist_mbid?: string | null;
}

/** `mbid_mapping`: risoluzione MusicBrainz fatta dal server. */
export interface ListenBrainzMbidMapping {
  /** MBID della registrazione: **vince** su `additional_info` (D2). */
  recording_mbid?: string | null;
  /** MBID degli artisti: il primo va su `Artist.mbid` (§3.1.2). */
  artist_mbids?: string[] | null;
  /** Credit unità canoniche: da queste si ricostruisce il nome artista. */
  artists?: ListenBrainzArtistCredit[] | null;
  /** Cover Art Archive: non è un URL, ignorato. */
  caa_id?: number | null;
  caa_release_mbid?: string | null;
  /** Link verso Spotify/Deezer/Tidal: mai persistiti (E.LB.12). */
  url_rels?: unknown[] | null;
}

/** `track_metadata`: i metadati del brano come inviati dal client. */
export interface ListenBrainzTrackMetadata {
  track_name?: string | null;
  /** Stringa **già joinata** dal client ("A & B"): mai divisa (§3.1.2). */
  artist_name?: string | null;
  release_name?: string | null;
  recording_mbid?: string | null;
}

/** Una riga dell'export ListenBrainz. */
export interface ListenBrainzListen {
  /** Inizio dell'ascolto in UNIX secondi UTC (§5). */
  listened_at?: number | null;
  /** Momento di inserimento nel DB del server: **mai** usato (E.LB.19). */
  inserted_at?: number | null;
  /** Hash dei metadati: **non** è un ID di registrazione (E.LB.13). */
  recording_msid?: string | null;
  /** Account che ha scrobbato: mai persistito (§7). */
  user_name?: string | null;
  track_metadata?: ListenBrainzTrackMetadata | null;
  additional_info?: ListenBrainzAdditionalInfo | null;
  mbid_mapping?: ListenBrainzMbidMapping | null;
  /** Annotazioni fixture (ignorate dal mapping). */
  _case?: string;
  _expectedOutput?: unknown;
}

/**
 * Guard runtime sui campi minimi (filtro §3.3, punti 1 e 3): `listened_at`
 * intero e `track_metadata` presente. La validità dei singoli campi è
 * verificata nel mapping.
 */
export function isListenBrainzListen(value: unknown): value is ListenBrainzListen {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.listened_at === 'number' &&
    Number.isInteger(rec.listened_at) &&
    typeof rec.track_metadata === 'object' &&
    rec.track_metadata !== null
  );
}
