/**
 * Shape di una riga dell'export Apple Media Services "Apple Music Play Activity.csv"
 * (03-ADAPTERS/apple-music.md §2-3, §10). L'export ha due generazioni di schema:
 * - Legacy (2015-2021): `Content Name`, `Artist Name`, `Store Country Name`, ecc.
 * - 2026.2: `Song Name`, `Container Artist Name`, `ISO Country`, `Event ID`, ecc.
 *
 * I campi sono opzionali perché il CSV può avere colonne mancanti o vuote.
 * La tabella alias canonica (§10) mappa entrambi gli schemi sui campi canonici.
 */
export interface AppleMusicActivityRecord {
  /** Schema 2026.2: nome del brano. Legacy: `Content Name`. */
  songName?: string;
  /** Legacy: nome del brano. */
  contentName?: string;
  /** Legacy: nome artista (assente in 2026.2). */
  artistName?: string;
  /** Schema 2026.2: artista del contenitore (playlist/pagina artista). */
  containerArtistName?: string;
  /** Nome album (entrambe le epoche). */
  albumName?: string;
  /** Schema 2026.2: durata ascoltata in ms. Legacy: stesso nome. */
  playDurationMs?: string;
  /** Schema 2026.2: durata catalogo in ms. Legacy: stesso nome. */
  mediaDurationMs?: string;
  /** Schema 2026.2: timestamp fine segmento (ISO 8601 UTC con ms). Legacy: stesso nome. */
  eventEndTimestamp?: string;
  /** Schema 2026.2: timestamp inizio segmento (ISO 8601 UTC con ms). Legacy: stesso nome. */
  eventStartTimestamp?: string;
  /** Schema 2026.2: motivo fine (enum Apple). Legacy: stesso nome. */
  endReasonType?: string;
  /** Schema 2026.2: hint motivo inizio. Legacy: assente. */
  eventReasonHintType?: string;
  /** Schema 2026.2: ID stabile per riga. Legacy: assente. */
  eventId?: string;
  /** Tipo evento: `PLAY_END` (primario), altri valori = scartati. Legacy: assente/altro. */
  eventType?: string;
  /** Schema 2026.2: shuffle attivo. Legacy: assente. */
  shufflePlay?: string;
  /** Schema 2026.2: ascolto offline. Legacy: stesso nome. */
  offline?: string;
  /** Device type esplicito (2026.2) o derivato da Build Version (legacy). */
  deviceType?: string;
  /** Build Version (legacy) o Device OS Name + Version (2026.2). */
  buildVersion?: string;
  /** Schema 2026.2: ISO Country (alpha-2). Legacy: `Store Country Name`. */
  isoCountry?: string;
  /** Legacy: Store Country Name (non ISO). */
  storeCountryName?: string;
  /** Client IP Address (privacy: scartato salvo retainIp). */
  clientIpAddress?: string;
  /** Coordinate GPS (sempre scartate, §7). */
  ipCity?: string;
  ipRegion?: string;
  ipLatitude?: string;
  ipLongitude?: string;
  /** Device Identifier hardware ID (sempre scartato, §7). */
  deviceIdentifier?: string;
  /** Apple ID Number (sempre scartato, §7). */
  appleIdNumber?: string;
  /** Subscription User ID (sempre scartato, §7). */
  subscriptionUserId?: string;
  /** Metrics Client/Bucket ID (sempre scartati, §7). */
  metricsClientId?: string;
  metricsBucketId?: string;
  /** Evaluation Variant (JSON, sempre scartato, §7). */
  evaluationVariant?: string;
  /** Referral ID (sempre scartato, §7). */
  referralId?: string;
  /** UTC Offset In Seconds (E10, usato per normalizzazione day UTC). */
  utcOffsetInSeconds?: string;
  /** Annotazioni fixture (ignorate dal mapping). */
  _case?: string;
  _comment?: string;
}

/**
 * Shape di una riga del file secondario `Apple Music - Play History Daily Tracks.csv`
 * (§3.4). Usato SOLO per la mappa candidati-artisti e riconciliazione conteggi.
 */
export interface AppleMusicDailyTrackRecord {
  /** Data ascolto: YYYYMMDD o ISO. */
  datePlayed?: string;
  /** "Artista - Brano" (split alla prima occorrenza di " - "). */
  trackDescription?: string;
  /** Durata totale giornaliera in ms. */
  playDurationMs?: string;
  /** Conteggio ascolti (default 1 se assente). */
  playCount?: string;
  /** Annotazioni fixture. */
  _case?: string;
  _comment?: string;
}

/**
 * Guard runtime sui campi minimi per una riga Play Activity (§2.2: songName + timestamp interpretabile).
 */
export function isAppleMusicActivityRecord(value: unknown): value is AppleMusicActivityRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  const hasName = typeof rec.songName === 'string' || typeof rec.contentName === 'string';
  const hasTs =
    typeof rec.eventEndTimestamp === 'string' || typeof rec.eventStartTimestamp === 'string';
  return hasName && hasTs;
}

/**
 * Guard runtime per il file Daily Tracks.
 */
export function isAppleMusicDailyTrackRecord(value: unknown): value is AppleMusicDailyTrackRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return typeof rec.trackDescription === 'string' || typeof rec.datePlayed === 'string';
}
