import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  CONTENT_SECURITY_POLICY,
  CONTENT_SECURITY_POLICY_DEV,
  CONTENT_SECURITY_POLICY_META,
  CSP_DIRECTIVES,
  DEV_SCRIPT_SOURCES,
  buildCsp,
} from '../csp';
import { ACOUSTICBRAINZ_HOST, DBIP_HOST, ITUNES_AUDIO_HOST, ITUNES_SEARCH_HOST } from '../hosts';

/**
 * La CSP applicata al bundle — `21-AUDIO-FEATURES.md` §10.2 (D-AF.9),
 * deliverable T4.1.11.
 *
 * Il test è un **gate sulla privacy**: la pipeline può contattare tre host
 * (la ricerca iTunes, il CDN delle anteprime, l'API di AcousticBrainz) e
 * nessun altro. Una CSP che "si ricorda a memoria" in due posti diverge:
 * qui la policy vive in una costante, e il test la confronta sia con il tag
 * `<meta>` sia con quella **dichiarata** in `docs/12-DEVOPS.md`.
 */
describe('Content Security Policy (12§2.1, 21§10.2)', () => {
  it('consente in connect-src i tre host della pipeline e MusicBrainz', () => {
    const connect = CSP_DIRECTIVES['connect-src'];
    expect(connect).toContain("'self'");
    expect(connect).toContain('https://api.musicbrainz.org');
    expect(connect).toContain('https://*.musicbrainz.org');
    expect(connect).toContain(ACOUSTICBRAINZ_HOST);
    expect(connect).toContain(ITUNES_AUDIO_HOST);
  });

  it("consente anche l'host della ricerca iTunes: D-AF.1 impone la chiamata", () => {
    // L'host della *ricerca* è distinto dal *CDN* dei file audio: senza di
    // esso la CSP bloccherebbe la ricerca del preview e il ramo Essentia non
    // potrebbe mai partire (D-AF.1, ratificato in `21` v1.1, issue #196).
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
      DBIP_HOST,
    ]);
    expect([...CSP_DIRECTIVES['connect-src']]).toEqual([...allowed]);
  });

  it('la connect-src applicata coincide con quella dichiarata in docs/12-DEVOPS.md', () => {
    // Il confronto che mancava: la dichiarazione e il codice possono
    // divergere in silenzio (è successo fra D-AF.1 e D-AF.9, issue #196).
    const declared = readDeclaredConnectSrc();
    expect(declared).toEqual([...CSP_DIRECTIVES['connect-src']]);
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

/**
 * La `connect-src` **dichiarata** in `docs/12-DEVOPS.md`.
 *
 * È il confronto che mancava: la dichiarazione e il codice potevano
 * divergere in silenzio (è successo fra D-AF.1 e D-AF.9, issue #196 — la
 * spec elencava due host e la pipeline ne chiamava tre).
 *
 * @returns le sorgenti dichiarate, nell'ordine del documento.
 */
function readDeclaredConnectSrc(): string[] {
  const docPath = findRepoFile('docs/12-DEVOPS.md');
  const content = readFileSync(docPath, 'utf8');
  const line = content
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith('connect-src '));
  if (!line) {
    throw new Error(`Nessuna riga "connect-src" nella CSP dichiarata in ${docPath}`);
  }
  return line.slice('connect-src '.length).replace(/;$/, '').split(/\s+/).filter(Boolean);
}

/**
 * Cerca un file del repository salendo dalla directory corrente.
 *
 * Il test gira con la cwd sul package `@ls/web`, ma il percorso del
 * repository non è fisso: la ricerca sale finché il file non compare.
 *
 * @param relative - il path del file, relativo alla root del repository.
 * @returns il path assoluto del file trovato.
 */
function findRepoFile(relative: string): string {
  let directory = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(directory, relative);
    if (existsSync(candidate)) {
      return candidate;
    }
    directory = dirname(directory);
  }
  throw new Error(`File non trovato salendo da ${process.cwd()}: ${relative}`);
}
