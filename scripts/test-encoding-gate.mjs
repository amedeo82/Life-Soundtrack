#!/usr/bin/env node
/**
 * Test del gate "encoding dei file tracciati" (scripts/check-encoding.mjs).
 *
 * Ogni scenario costruisce un repository git temporaneo, ci scrive i file
 * necessari e verifica l'uscita e l'output del gate. I file sono scritti
 * **in byte**, non con le API di testo: il punto del gate e' proprio il
 * contenuto dei byte.
 *
 * Uso: node scripts/test-encoding-gate.mjs
 * Exit code: 0 = tutti gli scenari passano, 1 = almeno uno fallisce.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, 'check-encoding.mjs');

let failures = 0;
let checks = 0;

function ok(message) {
  console.log(`[OK] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
  failures++;
}

function assert(condition, message) {
  checks++;
  if (condition) ok(message);
  else fail(message);
}

/** Crea un repo git temporaneo con i file indicati (path -> Buffer). */
function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ls-encoding-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  execFileSync('git', ['add', '-A'], { cwd: dir });
  return dir;
}

function runGate(dir, extra = []) {
  try {
    const stdout = execFileSync('node', [GATE, '--root', dir, ...extra], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, stdout };
  } catch (err) {
    return {
      code: err.status ?? 2,
      stdout: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
}

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const utf8 = (s) => Buffer.from(s, 'utf8');

/** Doppia codifica: UTF-8 -> cp1252 -> UTF-8 (cosa fa PowerShell 5.1). */
function doubleEncode(s) {
  return utf8(
    Buffer.from(s, 'utf8')
      .toString('latin1')
      .split('')
      .map((c) => String.fromCharCode(c.charCodeAt(0) & 0xff))
      .join(''),
  );
}

const dirs = [];
function cleanup() {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}
process.on('exit', cleanup);

// --- T1: file pulito con accenti legittimi -> exit 0 ------------------------
{
  const dir = makeRepo({
    'docs/pulito.md': utf8('# Titolo\n\nTesto con accenti: città, perché, già.\nEm-dash — e virgolette “ciao”.\n'),
  });
  dirs.push(dir);
  const res = runGate(dir);
  assert(res.code === 0, `T1: file UTF-8 pulito -> exit 0 (ottenuto ${res.code})`);
  assert(!res.stdout.includes('[FAIL]'), 'T1: nessun falso positivo sugli accenti legittimi');
}

// --- T2: BOM UTF-8 -> exit 1, finding "bom" ---------------------------------
{
  const dir = makeRepo({
    'docs/bom.md': Buffer.concat([BOM, utf8('# Titolo\n')]),
  });
  dirs.push(dir);
  const res = runGate(dir);
  assert(res.code === 1, `T2: BOM -> exit 1 (ottenuto ${res.code})`);
  assert(res.stdout.includes('BOM UTF-8'), 'T2: il finding nomina il BOM');
}

// --- T3: mojibake -> exit 1, finding "mojibake" -----------------------------
{
  const dir = makeRepo({
    'docs/corrotto.md': doubleEncode('# Città\n\nPerché è così — con em-dash.\n'),
  });
  dirs.push(dir);
  const res = runGate(dir);
  assert(res.code === 1, `T3: mojibake -> exit 1 (ottenuto ${res.code})`);
  assert(res.stdout.includes('doppia codifica'), 'T3: il finding nomina la doppia codifica');
}

// --- T4: --fix ripara il file e il gate passa poi ---------------------------
{
  const dir = makeRepo({
    'docs/corrotto.md': doubleEncode('# Città\n\nPerché è così — con em-dash.\n'),
  });
  dirs.push(dir);
  const before = runGate(dir);
  assert(before.code === 1, 'T4: prima del fix il gate fallisce');
  const fix = runGate(dir, ['--fix']);
  assert(fix.code === 0, `T4: dopo --fix il gate passa (ottenuto ${fix.code})`);
  const content = readFileSync(join(dir, 'docs/corrotto.md'), 'utf8');
  assert(content.includes('Città'), 'T4: il testo accentato e\' stato ripristinato');
  assert(content.includes('—'), 'T4: l\'em-dash e\' stato ripristinato');
  assert(!content.includes('Ã'), 'T4: non resta mojibake nel file riparato');
}

// --- T5: UTF-8 non valido -> exit 1 -----------------------------------------
{
  const dir = makeRepo({
    'docs/invalido.md': Buffer.concat([utf8('# Titolo\n'), Buffer.from([0xff, 0xfe, 0x41])]),
  });
  dirs.push(dir);
  const res = runGate(dir);
  assert(res.code === 1, `T5: UTF-8 non valido -> exit 1 (ottenuto ${res.code})`);
  assert(res.stdout.includes('non e'), 'T5: il finding nomina la non validita\'');
}

// --- T6: allowlist -> WARN, exit 0 ------------------------------------------
{
  const dir = makeRepo({
    'docs/esempio.md': doubleEncode('# Città\n'),
    'scripts/encoding-allowlist.txt': utf8('docs/esempio.md  # documenta un esempio\n'),
  });
  dirs.push(dir);
  const res = runGate(dir);
  assert(res.code === 0, `T6: file in allowlist -> exit 0 (ottenuto ${res.code})`);
  assert(res.stdout.includes('[WARN]'), 'T6: il file in allowlist e\' segnalato in WARN');
}

// --- T7: --staged guarda solo i file staged ---------------------------------
{
  const dir = makeRepo({
    'docs/pulito.md': utf8('# Titolo\n'),
    'docs/corrotto.md': doubleEncode('# Città\n'),
  });
  dirs.push(dir);
  // il file corrotto non e' staged: il gate non deve vederlo
  execFileSync('git', ['rm', '--cached', '-q', 'docs/corrotto.md'], { cwd: dir });
  const res = runGate(dir, ['--staged']);
  assert(res.code === 0, `T7: --staged ignora i file non staged (ottenuto ${res.code})`);
}

console.log('');
if (failures === 0) {
  console.log(`[OK] test-encoding-gate: ${checks} assert, 0 falliti`);
  process.exit(0);
}
console.log(`[INFO] test-encoding-gate: ${checks} assert, ${failures} falliti`);
process.exit(1);
