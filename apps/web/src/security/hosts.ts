/**
 * Gli host che la pipeline delle audio features può contattare —
 * `21-AUDIO-FEATURES.md` v1.0 🟢 §10.1, §10.2 (D-AF.9).
 *
 * Sono **due**, e sono gli unici aggiunti a `connect-src` oltre a
 * MusicBrainz:
 *
 * - l'API di AcousticBrainz (bonus sui recording con MBID);
 * - il CDN delle anteprime dell'iTunes Search API (30 s di audio analizzata
 *   **in locale**: i byte non escono e non vengono persistiti).
 *
 * Il fatto di avere una costante dedicata (e non una stringa sparsa nel
 * codice) è ciò che permette al test della CSP di dimostrare che **non
 * entra nessun altro host**.
 */

/** L'host dell'API di AcousticBrainz. */
export const ACOUSTICBRAINZ_HOST = 'https://acousticbrainz.org';

/** L'host del CDN delle anteprime audio dell'iTunes. */
export const ITUNES_AUDIO_HOST = 'https://audio-ssl.itunes.apple.com';

/**
 * L'host dell'**iTunes Search API**.
 *
 * ⚠️ **Terzo host, non previsto da D-AF.9**: la decisione D-AF.9 elenca due
 * host nuovi in `connect-src` (`acousticbrainz.org` e
 * `audio-ssl.itunes.apple.com`), ma D-AF.1 impone di prendere l'audio dal
 * **preview** restituito da `GET https://itunes.apple.com/search` — e
 * l'host della *ricerca* è diverso da quello del *CDN* dei file audio.
 *
 * Senza questo host la CSP bloccherebbe la ricerca e il ramo Essentia non
 * potrebbe mai partire: i due AC ("la fonte dell'audio è il preview iTunes"
 * e "la rete è limitata ai due host dichiarati") sono **incompatibili** fra
 * loro. La contradizione è segnalata all'issue con label `needs-spec`: la
 * ratifica del Boss può (a) confermare il terzo host o (b) rivedere D-AF.9.
 *
 * Finché la ratifica non c'è, il codice **funziona** (il ramo Essentia
 * trova il preview) invece di degradare sempre: una pipeline che non può
 * mai misurare niente è un falso verde peggiore di un host in più.
 */
export const ITUNES_SEARCH_HOST = 'https://itunes.apple.com';
