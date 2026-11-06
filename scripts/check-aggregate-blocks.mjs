#!/usr/bin/env node
/**
 * Gate "blocchi aggregati intoccabili" (issue #248, ADR-0012 regola 4).
 *
 * ADR-0008 stabilisce che i blocchi `<!-- AGGREGATE-* -->` dei file globali
 * hanno **un solo scrittore**: `scripts/aggregate-state.ps1`. La regola V1 e'
 * "mai modificare i blocchi aggregati a mano".
 *
 * Finche' la regola resta solo prosa, e' violabile in silenzio: il check in CI
 * (`aggregate-state.ps1 -Check`) e' **warning-only**, perche' confronta
 * *contenuti calcolati* e soffre dell'incompatibilita' residua PS 5.1 / PS 7
 * (issue #63). Il drift viene quindi auto-corretto post-merge e la violazione
 * **merge-e senza che il reviewer la veda**.
 *
 * Ma la regola che serve qui non e' "il blocco e' coerente con il calcolato":
 * e' "**il blocco non e' stato toccato**". E' una domanda **testuale**, quindi
 * non soffre di alcuna incompatibilita' di piattaforma: puo' essere
 * **bloccante** (decisione D4 del project owner).
 *
 * Il gate confronta i blocchi aggregati della PR con quelli della base:
 *   - base senza blocchi  -> caso di introduzione (ADR-0008): INFO, non fail
 *   - blocco aggiunto o rimosso -> FAIL
 *   - blocco modificato             -> FAIL
 *
 * Un blocco e' **esente** quando il suo contenuto e' una misura del repository
 * e non uno stato: `AGGREGATE-BUNDLE-INVENTORY` (le dimensioni dei file in
 * catalogo cambiano con qualsiasi modifica di contenuto, e il `pre-push` lo
 * rigenera automaticamente). Tutti gli altri blocchi sono **stati** e la loro
 * unica sorgente e' l'aggregator, post-merge.
 *
 * Uso: node scripts/check-aggregate-blocks.mjs [--base <ref>] [--head <ref>]
 *                                            [--root <dir>]
 *
 * Exit code: 0 = nessuna violazione, 1 = violazione, 2 = errore di ambiente.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
}
const base = arg('--base', 'origin/main');
const head = arg('--head', 'HEAD');
const root = resolve(arg('--root', '.'));

/** Blocchi il cui contenuto e' una misura del repository, non uno stato. */
const EXEMPT = new Set(['AGGREGATE-BUNDLE-INVENTORY']);

let failures = 0;

function fail(message) {
  console.error(`[FAIL] ${message}`);
  failures++;
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function info(message) {
  console.log(`[INFO] ${message}`);
}

// `maxBuffer`: il default di Node e' 1 MB. `git show` di `docs/BUNDLE.md`
// (~3.4 MB) lo supera e `allowFail` trasformava l'errore in "file assente":
// il blocco aggregato di quel file non veniva confrontato, in silenzio.
// Con il buffer largo l'errore di lettura resta un errore (issue #290).
const MAX_BUFFER = 64 * 1024 * 1024;

function git(args, allowFail = false) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: MAX_BUFFER,
    });
  } catch (err) {
    if (allowFail) return null;
    console.error(`[FAIL] git ${args.join(' ')}: ${String(err.stderr || err.message).trim()}`);
    process.exit(2);
  }
}

/** Paths dei file con blocchi aggregati, presi dalla lista dei target dell'aggregator. */
function aggregatorTargets() {
  const script = join(root, 'scripts', 'aggregate-state.ps1');
  if (!existsSync(script)) {
    console.error(`[FAIL] scripts/aggregate-state.ps1 non trovato: la lista dei target e' la sua`);
    process.exit(2);
  }
  const source = readFileSync(script, 'utf8');
  const paths = new Set();
  for (const m of source.matchAll(/Path\s*=\s*"([^"]+)"/g)) paths.add(m[1]);
  if (paths.size === 0) {
    console.error('[FAIL] nessun target trovato in scripts/aggregate-state.ps1');
    process.exit(2);
  }
  return [...paths];
}

/** Contenuto di un file a un dato ref (null se il file non esiste a quel ref). */
function fileAt(ref, path) {
  const out = git(['show', `${ref}:${path}`], true);
  return out === null ? null : out;
}

/** Blocchi aggregati di un testo: nome -> contenuto. */
function extractBlocks(text) {
  const blocks = new Map();
  if (!text) return blocks;
  const re = /<!--\s*(AGGREGATE-[A-Z0-9-]+)-START\s*-->([\s\S]*?)<!--\s*\1-END\s*-->/g;
  for (const m of text.matchAll(re)) blocks.set(m[1], m[2]);
  return blocks;
}

console.log(
  `[INFO] check-aggregate-blocks: blocchi AGGREGATE-* intoccabili nella PR (base=${base}, head=${head})`,
);

// il base deve esistere come oggetto git
if (git(['cat-file', '-e', `${base}^{commit}`], true) === null) {
  console.log(`[INFO] base ${base} non presente localmente: lo recupero da origin...`);
  const fetched = git(['fetch', '--no-tags', '--depth=1', 'origin', base], true);
  if (fetched === null || git(['cat-file', '-e', `${base}^{commit}`], true) === null) {
    console.error(`[FAIL] base non recuperabile: ${base}`);
    process.exit(2);
  }
}

const targets = aggregatorTargets();
let compared = 0;
let blocksSeen = 0;

for (const path of targets) {
  const baseText = fileAt(base, path);
  const headText = fileAt(head, path);
  if (baseText === null && headText === null) continue;
  if (baseText === null) {
    info(`${path}: file nuovo nella PR (nessun blocco da confrontare)`);
    continue;
  }

  const baseBlocks = extractBlocks(baseText);
  const headBlocks = extractBlocks(headText);
  console.log('[DEBUG] baseBlocks:', Array.from(baseBlocks.keys()));
  console.log('[DEBUG] headBlocks:', Array.from(headBlocks.keys()));
  for (const [name, content] of headBlocks) {
    console.log('[DEBUG] head block:', name, 'len:', content.length);
    if (!baseBlocks.has(name)) {
      console.log('[DEBUG] MISSING IN BASE:', name);
    } else if (baseBlocks.get(name) !== content) {
      console.log('[DEBUG] CONTENT DIFFERS:', name);
    } else {
      console.log('[DEBUG] OK:', name);
    }
  }

  if (baseBlocks.size === 0) {
    info(`${path}: nessun blocco aggregato nella base (caso di introduzione ADR-0008)`);
    continue;
  }
  compared++;

  for (const [name, content] of headBlocks) {
    blocksSeen++;
    if (!baseBlocks.has(name)) {
      fail(
        `${path}: blocco "${name}" aggiunto nella PR — i blocchi aggregati hanno un solo scrittore (aggregate-state.ps1), post-merge`,
      );
      continue;
    }
    if (EXEMPT.has(name)) continue;
    if (baseBlocks.get(name) !== content) {
      fail(
        `${path}: blocco "${name}" modificato a mano nella PR (regola V1 di ADR-0008). I blocchi si cambiano solo in docs/state/<propria>/* e vengono rigenerati dall'aggregator post-merge`,
      );
    }
  }

  for (const name of baseBlocks.keys()) {
    if (!headBlocks.has(name)) {
      fail(
        `${path}: blocco "${name}" rimosso nella PR — i blocchi aggregati hanno un solo scrittore (aggregate-state.ps1), post-merge`,
      );
    }
  }
}

if (compared === 0) {
  info('nessun file con blocchi aggregati da confrontare');
}

console.log(
  `\n[INFO] check-aggregate-blocks: ${compared} file confrontati, ${blocksSeen} blocchi, ${failures} violazioni`,
);
process.exit(failures === 0 ? 0 : 1);
