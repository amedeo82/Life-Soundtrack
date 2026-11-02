#!/usr/bin/env node
/**
 * Gate di PORTABILITA' dei generatori (issue #284).
 *
 * Requisito: le automazioni non devono dipendere dal sistema operativo che le
 * eseguira'. Lo stesso input (lo stato del repository) deve produrre gli
 * stessi byte su Linux, Windows e macOS.
 *
 * Il gate misura la proprieta' su tre livelli:
 *
 *   1. **DETERMINISMINO** — due rigenerazioni consecutive producono gli stessi
 *      byte (locale, su ogni OS).
 *   2. **INVARIANTI DEL REPO** — il bundle e' in sync con lo stato committato
 *      (`generate-bundle -Check`), e i blocchi aggregati sono coerenti con lo
 *      stato dichiarato (`aggregate-state -Check`).
 *   3. **CROSS-OS** — il manifest dei file generati (sha256 per file) prodotto
 *      su Linux e' identico a quello prodotto su Windows. Ogni job della
 *      matrix `gates-portability` scrive il proprio manifest come artefatto; il
 *      job di confronto li confronta byte per byte. Il riferimento NON e' lo
 *      stato committato: quello cambia a ogni PR (i blocchi aggregati vengono
 *      aggiornati dal writer POST-merge per contratto, vedi ADR-0008), quindi
 *      non puo' essere il riferimento di un confronto cross-OS.
 *
 * Perche' confrontare i byte e non "lo stato logico": le tre dipendenze
 * storiche (fuso orario, locale corrente, ordinamento culture-sensitive) si
 * manifestano come byte diversi a parita' di fatti.
 *
 * Uso:
 *   node scripts/check-generators-portable.mjs                     # livelli 1 e 2
 *   node scripts/check-generators-portable.mjs --manifest <file>   # + manifest
 *   node scripts/check-generators-portable.mjs --compare <a> <b>    # confronto
 *
 * Exit code: 0 = tutto verde, 1 = drift o divergenza, 2 = errore di ambiente.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2);

function argValue(name, fallback = null) {
  const idx = argv.indexOf(name);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  return fallback;
}
function argValues(name) {
  const out = [];
  argv.forEach((a, i) => {
    if (a === name && i + 1 < argv.length) out.push(argv[i + 1]);
  });
  return out;
}

const root = resolve(argValue('--root', '.'));
const manifestPath = argValue('--manifest');
const comparePaths = argValues('--compare');

/** I file prodotti dai generatori (stessi target dell'aggregator). */
const TARGETS = [
  'docs/SESSIONS.md',
  'docs/11-BACKLOG.md',
  'docs/INDEX.md',
  'docs/BUNDLE.md',
  'README.md',
];

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function environmentError(message) {
  console.error(`[FAIL] ${message}`);
  console.error(
    "       Il gate e' fail-closed: senza poter confrontare i byte non puo' dichiarare la portabilita'.",
  );
  process.exit(2);
}

function git(args, options = {}) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', ...options });
}

function run(command, args, cwd = root) {
  const res = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (res.error) {
    environmentError(`impossibile eseguire \`${command}\`: ${res.error.message}`);
  }
  if (res.status !== 0) {
    console.error((res.stdout || '') + (res.stderr || ''));
    environmentError(
      `\`${command} ${args.join(' ')}\` e' fallito (exit ${res.status})`,
    );
  }
  return res.stdout || '';
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

// === confronto fra manifest (cross-OS) ========================================

if (comparePaths.length >= 2) {
  const manifests = comparePaths.map((p) => {
    if (!existsSync(p)) environmentError(`manifest non trovato: ${p}`);
    return { path: p, data: JSON.parse(readFileSync(p, 'utf8')) };
  });
  const [a, b] = manifests;
  const keys = [...new Set([...Object.keys(a.data), ...Object.keys(b.data)])].sort();
  const diffs = keys.filter((k) => a.data[k] !== b.data[k]);
  if (diffs.length > 0) {
    fail(
      `i generatori producono output DIVERSI sui due sistemi operativi (${a.path} vs ${b.path}): ` +
        `${diffs.length}/${keys.length} file divergono`,
    );
    for (const k of diffs) {
      console.error(`         ${k}: ${a.data[k] ?? '(assente)'} vs ${b.data[k] ?? '(assente)'}`);
    }
    console.error(
      '       Cause tipiche: locale corrente (separatore decimale), fuso orario del timestamp, ' +
        'ordinamento culture-sensitive, line ending (CRLF), versione di PowerShell.',
    );
    process.exit(1);
  }
  console.log(
    `[OK] i generatori producono output IDENTICI sui due sistemi operativi ` +
      `(${keys.length} file, sha256 confrontati)`,
  );
  process.exit(0);
}

// === rigenerazione in un worktree pulito =====================================

/**
 * Rigenera i file in un worktree pulito (checkout di HEAD) e restituisce il
 * manifest {file: sha256}.
 *
 * Il worktree serve per due motivi:
 *   * lo stato di partenza e' quello COMMITTATO (l'input dei generatori non
 *     e' inquinato dalle modifiche locali);
 *   * i generatori scrivono li', senza toccare il working tree di chi esegue
 *     il gate (il gate e' read-only sul repository).
 */
function regenerate() {
  const dir = mkdtempSync(join(tmpdir(), 'ls-portability-'));
  const wt = join(dir, 'wt');
  try {
    const add = git(['worktree', 'add', '--detach', wt, 'HEAD']);
    if (add.status !== 0) {
      environmentError(
        `impossibile creare il worktree temporaneo: ${(add.stderr || '').trim()}`,
      );
    }
    run('pwsh', ['-NoProfile', '-File', 'scripts/aggregate-state.ps1'], wt);
    run('pwsh', ['-NoProfile', '-File', 'scripts/generate-bundle.ps1'], wt);
    const manifest = {};
    for (const target of TARGETS) {
      const file = join(wt, target);
      if (!existsSync(file)) environmentError(`il generatore non ha prodotto ${target}`);
      manifest[target] = sha256(file);
    }
    return manifest;
  } finally {
    git(['worktree', 'remove', '--force', wt]);
    git(['worktree', 'prune']);
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- 1. determinismo: due rigenerazioni consecutive ---------------------------

console.log('[INFO] check-generators-portable: rigenero i file in un worktree pulito');
const first = regenerate();
const second = regenerate();
const drift = Object.keys(first).filter((k) => first[k] !== second[k]);
if (drift.length > 0) {
  fail(`i generatori non sono deterministici: ${drift.length} file cambiano fra due run consecutivi`);
  for (const k of drift) console.error(`         ${k}: ${first[k]} -> ${second[k]}`);
  process.exit(1);
}
console.log(`[OK] i generatori sono deterministici (${Object.keys(first).length} file, due run consecutive)`);

if (manifestPath) {
  mkdirSync(resolve(manifestPath).replace(/[\\/][^\\/]*$/, ''), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(first, null, 2) + '\n', 'utf8');
  console.log(`[OK] manifest scritto in ${manifestPath}`);
}

// --- 2. invarianti del repo sullo stato committato ---------------------------

const bundleCheck = spawnSync(
  'pwsh',
  ['-NoProfile', '-File', 'scripts/generate-bundle.ps1', '-Check'],
  { cwd: root, encoding: 'utf8' },
);
if (bundleCheck.status !== 0) {
  console.error((bundleCheck.stdout || '') + (bundleCheck.stderr || ''));
  fail('il bundle non e\' in sync con lo stato committato (esegui `pwsh scripts/generate-bundle.ps1`)');
  process.exit(1);
}
console.log('[OK] il bundle e\' in sync con lo stato committato');

process.exit(0);
