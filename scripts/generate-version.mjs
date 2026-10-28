/**
 * Genera `apps/web/public/version.json` da `package.json` + `git rev-parse HEAD`.
 *
 * Usato nello script `build` di `apps/web` (Story 0.7 T0.7.6, 05-ARCHITECTURE §11.1):
 *   "build": "node ../../scripts/generate-version.mjs && tsc -p tsconfig.json --noEmit && vite build"
 *
 * Il manifest contiene:
 *   version        — versione dal package.json
 *   buildHash      — commit SHA corrente (`git rev-parse HEAD`)
 *   releasedAt     — timestamp ISO di generazione
 *   minSchemaVersion — versione minima di schema DB che il client sa gestire
 *
 * Il client confronta a ogni boot la versione cached con quella del server
 * (`version.json`) per decidere se mostrare il banner di update
 * (05-ARCHITECTURE.md §11.1, §11.4).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const webPkgPath = resolve(repoRoot, 'apps/web/package.json');
const outPath = resolve(repoRoot, 'apps/web/public/version.json');

function readPkg() {
  return JSON.parse(readFileSync(webPkgPath, 'utf8'));
}

function gitRevParse() {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const pkg = readPkg();
const manifest = {
  version: pkg.version,
  buildHash: gitRevParse(),
  releasedAt: new Date().toISOString(),
  minSchemaVersion: 5, // schema v5 (02-DATA-SCHEMA.md §6.2, tabella scrobbleOutbox — Story 1.5)
};

writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(
  `[generate-version] scritto ${outPath} (version=${manifest.version}, build=${manifest.buildHash})`,
);
