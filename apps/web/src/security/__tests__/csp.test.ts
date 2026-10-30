import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CONTENT_SECURITY_POLICY,
  CONTENT_SECURITY_POLICY_DEV,
  CONTENT_SECURITY_POLICY_META,
  CSP_DIRECTIVES,
  DEV_SCRIPT_SOURCES,
  buildCsp,
} from '../csp';
import { ACOUSTICBRAINZ_HOST, ITUNES_AUDIO_HOST, ITUNES_SEARCH_HOST } from '../hosts';

/**
 * La CSP applicata al bundle — `21-AUDIO-FEATURES.md` §10.2 (D-AF.9),
 * deliverable T4.1.11.
 *
 * Il test è un **gate sulla privacy**: la pipeline può contattare due host,
 * e nessun altro. Una CSP che "si ricorda a memoria" in due posti diverge:
 * qui la policy vive in una costante, e il test la confronta con quella
 * dichiarata in `docs/12-DEVOPS.md` §2.1.
 */
describe('Content Security Policy (12§2.1, 21§10.2)', () => {
  it('consente in connect-src i due host della pipeline e MusicBrainz', () => {
    const connect = CSP_DIRECTIVES['connect-src'];
    expect(connect).toContain("'self'");
    expect(connect).toContain('https://api.musicbrainz.org');
    expect(connect).toContain('https://*.musicbrainz.org');
    expect(connect).toContain(ACOUSTICBRAINZ_HOST);
    expect(connect).toContain(ITUNES_AUDIO_HOST);
  });

  it("consente anche l'host della ricerca iTunes: D-AF.1 lo impone, D-AF.9 non lo elencava", () => {
    // Contraddizione dichiarata e segnalata all'issue `needs-spec`
    // (cfr. `src/security/hosts.ts`): senza questo host la CSP bloccherebbe
    // la ricerca del preview e il ramo Essentia non potrebbe mai partire.
    expect(CSP_DIRECTIVES['connect-src']).toContain(ITUNES_SEARCH_HOST);
  });

  it('non ammette nessun altro host esterno', () => {
    const allowed = new Set([
      "'self'",
      'https://api.musicbrainz.org',
      'https://*.musicbrainz.org',
      ACOUSTICBRAINZ_HOST,
      ITUNES_AUDIO_HOST,
      ITUNES_SEARCH_HOST,
    ]);
    expect([...CSP_DIRECTIVES['connect-src']]).toEqual([...allowed]);
  });

  it("consente 'wasm-unsafe-eval' per Essentia.js e non 'unsafe-eval'", () => {
    expect(CSP_DIRECTIVES['script-src']).toContain("'wasm-unsafe-eval'");
    expect(CSP_DIRECTIVES['script-src']).not.toContain("'unsafe-eval'");
    expect(CSP_DIRECTIVES['script-src']).not.toContain("'unsafe-inline'");
  });

  it('la policy di produzione non contiene il rilassamento del dev server', () => {
    // Il rilassamento del dev server riguarda **solo** `script-src`:
    // `style-src 'unsafe-inline'` è invece parte della policy dichiarata
    // in `12-DEVOPS.md` §2.1 (gli stili inline di React).
    expect(CSP_DIRECTIVES['script-src']).not.toContain("'unsafe-inline'");
    expect(CSP_DIRECTIVES['script-src']).not.toContain("'unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY).toContain("'wasm-unsafe-eval'");
  });

  it('il rilassamento del dev server è dichiarato e limitato a script-src', () => {
    expect(DEV_SCRIPT_SOURCES).toEqual([
      "'self'",
      "'wasm-unsafe-eval'",
      "'unsafe-inline'",
      "'unsafe-eval'",
    ]);
    expect(CONTENT_SECURITY_POLICY_DEV).toContain("'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY_DEV).toContain('https://acousticbrainz.org');
  });

  it('la policy del meta tag omette frame-ancestors (ignorato dai meta)', () => {
    expect(CONTENT_SECURITY_POLICY).toContain('frame-ancestors');
    expect(CONTENT_SECURITY_POLICY_META).not.toContain('frame-ancestors');
    expect(CONTENT_SECURITY_POLICY_META).toContain('connect-src');
  });

  it('ogni direttiva è dichiarata come chiave/valori senza spazi attorno al ";"', () => {
    expect(CONTENT_SECURITY_POLICY.split('; ').every((part) => part.includes(' '))).toBe(true);
    expect(buildCsp({ includeFrameAncestors: false })).toBe(CONTENT_SECURITY_POLICY_META);
  });

  it('il meta tag di index.html è identico alla policy della costante', () => {
    // Vitest gira con la cwd sul package `@ls/web`: il path del file è
    // risolto da lì (in jsdom `import.meta.url` non è un URL `file:`).
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const match = html.match(
      /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/,
    );
    expect(match).not.toBeNull();
    expect(match?.[1]).toEqual(CONTENT_SECURITY_POLICY_META);
  });
});
