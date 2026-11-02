#!/usr/bin/env node
/**
 * Test di `scripts/apply-merge-state.mjs` (issue #275).
 *
 * Il caso che ha motivato il fix: una PR puo' consegnare **piu' file di sessione**
 * (una sola issue, piu' blocchi di lavoro distinti). La versione precedente abortava
 * e nessuna delle sessioni riceveva `merged: true`: i blocchi aggregati mostravano
 * «non ancora mergiato (PR #N)» per sempre — il drift che il gate
 * `check-merge-state.mjs` esiste per intercettare.
 *
 * Ogni scenario costruisce una directory con `docs/state/sessions/` e verifica
 * l'uscita e il contenuto dei file. Lo SHA e la data sono passati come argomenti:
 * il test non tocca la rete.
 *
 * Uso: node scripts/test-apply-merge-state.mjs
 * Exit code: 0 = tutti gli scenari passano, 1 = almeno uno fallisce.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, 'apply-merge-state.mjs');
const SHA = '89573176e80ef24b4f4015ab03fbd954de823b15';
const DATE = '2026-11-02T11:42:46Z';

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

const dirs = [];
function cleanup() {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}
process.on('exit', cleanup);

function makeRepo(sessionFiles) {
  const dir = mkdtempSync(join(tmpdir(), 'ls-merge-state-'));
  for (const [name, content] of Object.entries(sessionFiles)) {
    const full = join(dir, 'docs', 'state', 'sessions', name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function runTool(dir, prNumber) {
  try {
    const stdout = execFileSync(
      'node',
      [TOOL, '--pr', String(prNumber), '--sha', SHA, '--date', DATE, '--root', dir],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return { code: 0, stdout };
  } catch (err) {
    return {
      code: err.status ?? 2,
      stdout: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
}

const session = (number, pr) =>
  [
    '---',
    `number: ${number}`,
    'title: "Sessione di test"',
    'date: 2026-11-02',
    'state: 🟡',
    'merged: false',
    'branch: feat/test',
    `pr: ${pr}`,
    '---',
    '',
    '# Sessione di test',
    '',
  ].join('\n');

// --- T1: una sessione con pr: N ---------------------------------------------
{
  const dir = makeRepo({ '10-unica.md': session(10, 273) });
  dirs.push(dir);
  const res = runTool(dir, 273);
  assert(res.code === 0, `T1: una sessione -> exit 0 (ottenuto ${res.code})`);
  const content = readFileSync(join(dir, 'docs', 'state', 'sessions', '10-unica.md'), 'utf8');
  assert(content.includes('merged: true'), 'T1: merged: true applicato');
  assert(content.includes(SHA), 'T1: merged_commit applicato');
  assert(content.includes(DATE), 'T1: merged_date applicato');
  assert(content.includes('state: 🟢'), 'T1: stato chiuso (🟢)');
}

// --- T2: DUE sessioni con lo stesso pr: N (il caso dell'issue #275) ----------
{
  const dir = makeRepo({
    '11-prima.md': session(11, 273),
    '12-seconda.md': session(12, 273),
  });
  dirs.push(dir);
  const res = runTool(dir, 273);
  assert(res.code === 0, `T2: due sessioni -> exit 0, nessun abort (ottenuto ${res.code})`);
  for (const name of ['11-prima.md', '12-seconda.md']) {
    const content = readFileSync(join(dir, 'docs', 'state', 'sessions', name), 'utf8');
    assert(content.includes('merged: true'), `T2: ${name}: merged: true applicato`);
    assert(content.includes(SHA), `T2: ${name}: merged_commit applicato`);
  }
  assert(
    res.stdout.includes('lo stato di merge e\' stato applicato a tutti'),
    'T2: il log dichiara l\'applicazione a tutte le sessioni',
  );
}

// --- T3: nessuna sessione per la PR -> WARN, exit 0 -------------------------
{
  const dir = makeRepo({ '13-altra.md': session(13, 999) });
  dirs.push(dir);
  const res = runTool(dir, 273);
  assert(res.code === 0, `T3: nessuna sessione -> exit 0 (ottenuto ${res.code})`);
  assert(res.stdout.includes('[WARN]'), 'T3: l\'assenza e\' un WARN, non un errore');
}

console.log('');
if (failures === 0) {
  console.log(`[OK] test-apply-merge-state: ${checks} assert, 0 falliti`);
  process.exit(0);
}
console.log(`[INFO] test-apply-merge-state: ${checks} assert, ${failures} falliti`);
process.exit(1);
