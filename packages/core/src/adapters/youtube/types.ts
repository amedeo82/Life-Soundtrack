/**
 * Shape di un'attività della cronologia Google Takeout "YouTube and YouTube
 * Music" (03-ADAPTERS/youtube-music.md §2-3). L'export unifica in un solo
 * array la cronologia di YouTube e YouTube Music: i campi oltre a `title` e
 * `time` sono opzionali o nullabili e i nomi di file/cartelle sono
 * localizzati (E.YT.1) — nessun field è dato per scontato oltre i due minimi.
 *
 * I campi `_case`/`_comment` sono annotazioni dei fixture di test
 * (`fixtures/synthetic-history/youtube-sample.json`): il mapping li ignora.
 */
export interface YouTubeActivityRecord {
  /** Prodotto Google dell'attività: "YouTube Music" | "YouTube" | altro. */
  header?: string;
  /** Titolo con prefisso verbo localizzato, es. "Watched X" / "Guardato X". */
  title: string;
  /** URL dell'attività; assente nei video rimossi (E.YT.2). */
  titleUrl?: string;
  /** Canali collegati: `[0]` è l'approssimazione dell'artista (§3.1.1). */
  subtitles?: Array<{ name?: string; url?: string } | null>;
  /** ISO 8601 con offset locale o Z — inizio dell'azione (§5, E10). */
  time: string;
  /** Prodotti coinvolti; fallback del filtro musica (§3.3 regola 2d). */
  products?: string[] | null;
  /** Scartati sempre al parse (privacy §7): mai letti, mai persistiti. */
  locationInfos?: unknown;
  /** Usato solo per l'euristica di filtro; mai persistito (§7). */
  details?: Array<{ name?: string }> | null;
  /** Metadato di provisioning Google, ignorato (§7). */
  activityControls?: string[] | null;
  /** Annotazioni fixture (ignorate dal mapping). */
  _case?: string;
  _comment?: string;
}

/**
 * Guard runtime sui campi irrinunciabili (§2.2: `title` + `time` interpretabile).
 * La validità del timestamp (`Date.parse`) è verificata nel mapping: qui si
 * controlla solo la shape, per scartare senza crash record eterogenei.
 */
export function isYouTubeActivityRecord(value: unknown): value is YouTubeActivityRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return typeof rec.title === 'string' && typeof rec.time === 'string';
}
