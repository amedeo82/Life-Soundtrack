/**
 * La Content Security Policy dell'app — `docs/12-DEVOPS.md` §2.1 (v1.0),
 * applicazione della pipeline delle audio features (`21-AUDIO-FEATURES.md`
 * v1.0 🟢 §10.2, D-AF.9, deliverable T4.1.11).
 *
 * La **policy dichiarata** nei documenti è quella di produzione; qui vive
 * come **costante applicabile**, così header e `<meta>` non possono
 * divergere (una CSP che "si ricorda a memoria" in due posti diverge).
 *
 * I due host aggiunti dalla pipeline sono gli **unici** consentiti in
 * `connect-src` oltre a MusicBrainz:
 *
 * - `https://acousticbrainz.org` — il bonus sui recording con MBID;
 * - `https://audio-ssl.itunes.apple.com` — il download dell'anteprima audio
 *   di 30 s, analizzata **in locale** (i byte non escono dal dispositivo).
 */

import { ACOUSTICBRAINZ_HOST, ITUNES_AUDIO_HOST, ITUNES_SEARCH_HOST } from './hosts';

/** La policy dichiarata in `12-DEVOPS.md` §2.1 (v1.0). */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': [
    "'self'",
    'https://api.musicbrainz.org',
    'https://*.musicbrainz.org',
    ACOUSTICBRAINZ_HOST,
    ITUNES_AUDIO_HOST,
    // L'host della **ricerca** iTunes: D-AF.1 impone la chiamata, D-AF.9
    // non lo elencava. Contraddizione segnalata all'issue `needs-spec`
    // (cfr. `hosts.ts`): senza, il ramo Essentia non può mai partire.
    ITUNES_SEARCH_HOST,
  ],
  'worker-src': ["'self'", 'blob:'],
  'frame-ancestors': ["'none'"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/**
 * Il rilassamento **solo per il server di sviluppo**.
 *
 * Vite inietta un preamble inline (React Refresh) e usa `eval` per il
 * source map: senza questi due valori il dev server non funziona. La
 * policy di **produzione** non li contiene, e il test lo verifica.
 */
export const DEV_SCRIPT_SOURCES = [
  "'self'",
  "'wasm-unsafe-eval'",
  "'unsafe-inline'",
  "'unsafe-eval'",
];

/** Le opzioni di composizione della policy. */
export interface CspOptions {
  /** Le sorgenti di `script-src` (default: quelle di produzione). */
  readonly scriptSources?: readonly string[];
  /** Includere `frame-ancestors` (ignorato dai `<meta>`, default true). */
  readonly includeFrameAncestors?: boolean;
}

/**
 * Compone la policy in una stringa di header.
 *
 * @param options - le opzioni (rilassamento dev, `frame-ancestors`).
 * @returns il valore dell'header `Content-Security-Policy`.
 */
export function buildCsp(options: CspOptions = {}): string {
  const directives: Record<string, readonly string[]> = {
    ...CSP_DIRECTIVES,
    'script-src': options.scriptSources ?? CSP_DIRECTIVES['script-src'],
  };
  if (options.includeFrameAncestors === false) {
    delete directives['frame-ancestors'];
  }
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/** La policy di produzione (header HTTP). */
export const CONTENT_SECURITY_POLICY = buildCsp();

/**
 * La policy di produzione per il tag `<meta>`.
 *
 * `frame-ancestors` è **ignorato** dai `<meta>` (CSP §3.3: la direttiva
 * vale solo come header): viene omesso, non invalidato.
 */
export const CONTENT_SECURITY_POLICY_META = buildCsp({ includeFrameAncestors: false });

/**
 * La policy del server di sviluppo (Vite `server.headers`).
 *
 * Identica a quella di produzione, con il rilassamento di `script-src`
 * dichiarato in `DEV_SCRIPT_SOURCES`.
 */
export const CONTENT_SECURITY_POLICY_DEV = buildCsp({ scriptSources: DEV_SCRIPT_SOURCES });
