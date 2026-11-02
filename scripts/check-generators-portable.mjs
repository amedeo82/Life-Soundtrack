#!/usr/bin/env node
/**
 * Gate di PORTABILITA' dei generatori (issue #284).
 *
 * Requisito: le automazioni non devono dipendere dal sistema operativo che le
 * eseguira'. Lo stesso input (lo stato del repository) deve produrre gli
 * stessi byte su Linux, Windows e macOS.
 *
 * Come lo si verifica, senza supposizioni:
 *
 *   1. il working tree deve essere PULITO per i file generati (altrimenti il
 *      confronto sarebbe ambiguo: l'input non sarebbe quello committato);
 *   2. i generatori vengono rieseguiti **in place** (aggregator, poi bundle —
 *      l'ordine e' vincolante);
 *   3. il risultato viene confrontato con lo stato COMMITTATO: se i generatori
 *      producono qualcosa di diverso, il diff e' non vuoto e il gate fallisce.
 *
 * Il gate e' bloccante e gira su due sistemi operativi reali (matrix
 * `ubuntu-latest` + `windows-latest` in `.github/workflows/ci.yml`): e' la
 * prova empirica dell'indipendenza, non un'assunzione.
 *
 * Perche' confrontare i byte e non "lo stato logico": le tre dipendenze
 * storiche (fuso orario, locale corrente, ordinamento culture-sensitive) si
 * manifestano proprio come byte diversi a parita' di fatti.
 *
 * Uso: node scripts/check-generators-portable.mjs [--root <dir>]
 *
 * Exit code: 0 = i generatori riproducono lo stato committato, 1 = drift
 * (output diverso), 2 = errore di ambiente (fail-closed).
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);

function argValue(name, fallback) {
  const idx = argv.indexOf(name);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  return fallback;
}

const root = resolve(argValue('--root', '.'));

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
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8', ...options });
  return res;
}

function run(command, args) {
  const res = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (res.error) {
    environmentError(`impossibile eseguire \`${command}\`: ${res.error.message}`);
  }
  if (res.status !== 0) {
    console.error((res.stdout || '') + (res.stderr || ''));
    environmentError(
      `\`${command} ${args.join(' ')}\` e' fallito (exit ${res.status}): i generatori devono uscire 0`,
    );
  }
  return res.stdout || '';
}

// --- 1. precondizioni -------------------------------------------------------

const rev = git(['rev-parse', '--show-toplevel']);
if (rev.status !== 0) {
  environmentError('la directory corrente non e' + ' un repository git');
}

// Il confronto e' con lo stato **committato** (in CI: indice == HEAD; in
// locale: indice, cioe' quello che verrà committato). Il riferimento e' quindi
// l'indice: `git diff` confronta il working tree con l'indice.
const dirty = git(['diff', '--quiet', '--', ...TARGETS]);
if (dirty.status !== 0 && dirty.status !== 1) {
  environmentError('impossibile confrontare i file generati con lo stato committato');
}
if (dirty.status === 1) {
  environmentError(
    'i file generati hanno modifiche NON committate: il gate confronta i generatori con lo stato ' +
      "committato, quindi l'input deve essere quello committato (committa o stasha le modifiche locali)",
  );
}

// --- 2. riesecuzione dei generatori ------------------------------------------

console.log('[INFO] check-generators-portable: rieseguo i generatori su questo sistema operativo');
run('pwsh', ['-NoProfile', '-File', 'scripts/aggregate-state.ps1']);
run('pwsh', ['-NoProfile', '-File', 'scripts/generate-bundle.ps1']);

// --- 3. confronto con lo stato committato ------------------------------------

const diff = git(['diff', '--stat', '--', ...TARGETS]);
const diffFull = git(['diff', '--unified=1', '--', ...TARGETS]);

if (diff.status !== 0) {
  environmentError('impossibile confrontare i file generati con lo stato committato');
}

if (diff.stdout.trim() === '') {
  console.log(
    `[OK] i generatori riproducono byte per byte lo stato committato (${TARGETS.length} file): ` +
      "l'output e' indipendente da questo sistema operativo",
  );
  process.exit(0);
}

fail('i generatori producono un output DIVERSO dallo stato committato su questo sistema operativo');
console.error(diff.stdout.trim());
const diffLines = (diffFull.stdout || '').split('\n').slice(0, 40);
if (diffLines.length > 0) console.error(diffLines.join('\n'));
console.error(
  '       Cause tipiche: locale corrente (separatore decimale), fuso orario del timestamp, ' +
    'ordinamento culture-sensitive, line ending (CRLF), versione di PowerShell.',
);

// Ripristina i file generati: il gate non deve lasciare il working tree sporco.
const restore = git(['checkout', '--', ...TARGETS]);
if (restore.status !== 0) {
  console.error('[WARN] impossibile ripristinare i file generati: esegui `git checkout -- .`');
}
process.exit(1);
