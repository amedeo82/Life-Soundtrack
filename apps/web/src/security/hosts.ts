/**
 * Gli host che la pipeline delle audio features può contattare —
 * `21-AUDIO-FEATURES.md` v1.1 🟢 §10.1, §10.2 (D-AF.9).
 *
 * Sono **tre**, e sono gli unici aggiunti a `connect-src` oltre a
 * MusicBrainz:
 *
 * - l'API di AcousticBrainz (bonus sui recording con MBID);
 * - il CDN delle anteprime dell'iTunes Search API (30 s di audio analizzata
 *   **in locale**: i byte non escono e non vengono persistiti);
 * - l'**iTunes Search API** stessa, l'host che **risponde** alla ricerca del
 *   preview.
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
 * È il terzo host della pipeline, distinto dal CDN dei file audio: la
 * ricerca (`GET https://itunes.apple.com/search`) restituisce il
 * `previewUrl` che il CDN serve (D-AF.1).
 *
 * Nella **v1.0** della spec, D-AF.9 elencava in `connect-src` soltanto i due
 * host che *non* sono quello della ricerca: la CSP applicata bloccava la
 * richiesta e la pipeline degradava **sempre** ad AcousticBrainz/euristico
 * (Essentia mai chiamabile, `valence`/`energy` mai misurate). La
 * contraddizione fra le due decisioni è stata dichiarata all'issue **#196**
 * (`needs-spec`) e **ratificata dal project owner** nella Sessione 66:
 * **D-AF.9 è emendata** nella v1.1 della spec e questo host è ora dichiarato.
 */
export const ITUNES_SEARCH_HOST = 'https://itunes.apple.com';
