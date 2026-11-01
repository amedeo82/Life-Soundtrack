#!/usr/bin/env node
/**
 * Applica lo stato di merge al frontmatter di una sessione (issue #239).
 *
 * Il merge commit di una PR **non esiste prima del merge**: il doc-sync fatto
 * nel branch puo' scrivere `pr:`, ma `merged_commit` e `merged_date` sono
 * noti solo dopo. Percio' il doc-sync si divide in due momenti:
 *
 *   1. pre-merge, nel branch  -> `pr: <N>`
 *   2. post-merge             -> `merged: true`, `merged_commit`, `merged_date`,
 *                                 `state: <chiuso>`
 *
 * Questo script esegue il passo 2 in modo deterministico: nessuna LLM, nessuna
 * interpretazione, nessun rischio di dimenticanza. E' idempotente (se i campi
 * sono gia' corretti non scrive nulla) e tocca **solo** le righe di frontmatter
 * del file di sessione: il corpo del documento resta byte-identico.
 *
 * Uso:
 *   node scripts/apply-merge-state.mjs --pr <N> [--sha <sha>] [--date <iso>]
 *                                       [--branch <ref>] [--root <dir>] [--dry-run]
 *
 * Se `--sha` / `--date` non sono forniti, vengono letti dall'API GitHub
 * (stessa fonte di verita' del gate `scripts/check-merge-state.mjs`).
 *
 * Exit code: 0 = applicato o gia' in sync, 2 = errore (nessun file
 * corrispondente, argomenti invalidi, errore I/O).
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);

function argValue(name, fallback = null) {
  const idx = argv.indexOf(name);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  return fallback;
}

const root = resolve(argValue('--root', '.'));
const sessionsDir = join(root, 'docs', 'state', 'sessions');
const prNumber = Number.parseInt(argValue('--pr', ''), 10);
const shaArg = argValue('--sha');
const dateArg = argValue('--date');
const branchArg = argValue('--branch');
const dryRun = argv.includes('--dry-run');
const repo = argValue('--repo', process.env.GITHUB_REPOSITORY || 'amedeo82/Life-Soundtrack');
const apiBase = argValue('--api', process.env.GITHUB_API_URL || 'https://api.github.com').replace(
  /\/+$/,
  '',
);

const CLOSED_MARKER = '\u{1F7E2}';

function abort(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(2);
}

if (!Number.isFinite(prNumber) || prNumber <= 0) {
  abort('manca --pr <N> (numero della pull request mergiata)');
}
if (!existsSync(sessionsDir)) {
  abort(`directory delle sessioni non trovata: ${sessionsDir}`);
}

/** Token: env per prima, poi la CLI `gh`, poi anonimo. */
function resolveToken() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    const res = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
    const token = (res.stdout || '').trim();
    if (res.status === 0 && token) return token;
  } catch {
    // gh non disponibile
  }
  return null;
}

const token = resolveToken();

async function fetchPr(number) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'life-soundtrack-apply-merge-state',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${apiBase}/repos/${repo}/pulls/${number}`;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return await res.json();
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  abort(`impossibile leggere la PR #${number} dall'API GitHub (${url}): ${lastError}`);
  return null;
}

function listSessionFiles() {
  return readdirSync(sessionsDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const full = join(sessionsDir, file);
      const text = readFileSync(full, 'utf8');
      return { file, full, text };
    });
}

function frontmatterValue(text, field) {
  const m = new RegExp(`^${field}:\\s*(.*)$`, 'm').exec(text.slice(0, text.indexOf('\n---', 3)));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

/**
 * Individua il file di sessione della PR. Ordine di ricerca:
 *   1. `pr: <N>` (il doc-sync in-branch lo scrive: e' il legame esplicito)
 *   2. `branch: <ref>` (fallback: utile quando il doc-sync in-branch non ha
 *      ancora impostato `pr:`)
 */
function findSession(files) {
  const byPr = files.filter((f) => frontmatterValue(f.text, 'pr') === String(prNumber));
  if (byPr.length === 1) return { file: byPr[0], matchedBy: 'pr' };
  if (byPr.length > 1) {
    abort(
      `piu' file di sessione dichiarano \`pr: ${prNumber}\`: ${byPr.map((f) => f.file).join(', ')}. ` +
        'Il gate `check-merge-state.mjs` segnalera la collisione: risolvi prima di applicare.',
    );
  }
  if (branchArg) {
    const byBranch = files.filter((f) => frontmatterValue(f.text, 'branch') === branchArg);
    if (byBranch.length === 1) return { file: byBranch[0], matchedBy: 'branch' };
    if (byBranch.length > 1) {
      abort(
        `piu' file di sessione dichiarano \`branch: ${branchArg}\`: ${byBranch.map((f) => f.file).join(', ')}`,
      );
    }
  }
  return null;
}

/**
 * Riscrive il frontmatter: sostituisce i campi esistenti e inserisce quelli
 * mancanti nell'ordine dello schema (state, merged, merged_commit,
 * merged_date, branch, pr). Il corpo del file non viene toccato.
 */
function patchFrontmatter(text, updates) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return null;
  const fm = lines.slice(1, end);
  const rest = lines.slice(end);

  const order = ['state', 'merged', 'merged_commit', 'merged_date', 'branch', 'pr'];
  const changed = [];

  for (const [field, value] of Object.entries(updates)) {
    const idx = fm.findIndex((l) => l.startsWith(`${field}:`));
    const line = `${field}: ${value}`;
    if (idx >= 0) {
      if (fm[idx] !== line) {
        changed.push(`${fm[idx]}  ->  ${line}`);
        fm[idx] = line;
      }
      continue;
    }
    // Inserisce il campo subito dopo l'ultimo campo noto che lo precede
    // nello schema. I campi fuori dallo schema (claim, tags, ...) non
    // contano: altrimenti il campo finirebbe in coda al frontmatter.
    const position = order.indexOf(field);
    let insertAt = fm.length;
    let bestIndex = -1;
    for (let i = 0; i < fm.length; i++) {
      const name = /^([A-Za-z_][A-Za-z0-9_]*):/.exec(fm[i]);
      if (!name) continue;
      const pos = order.indexOf(name[1]);
      if (pos < 0 || pos >= position) continue;
      if (pos > bestIndex) {
        bestIndex = pos;
        insertAt = i + 1;
      }
    }
    changed.push(`(inserito)  ${line}`);
    fm.splice(insertAt, 0, line);
  }

  return { text: ['---', ...fm, ...rest].join('\n'), changed };
}

const files = listSessionFiles();
const found = findSession(files);
if (!found) {
  abort(
    `nessun file di sessione corrisponde alla PR #${prNumber}` +
      (branchArg ? ` (branch "${branchArg}")` : '') +
      '. Il doc-sync in-branch deve scrivere `pr: ' +
      prNumber +
      '` nel file di sessione (oppure il workflow deve passare --branch).',
  );
}

const session = found.file;

// Merge commit e data: dagli argomenti, altrimenti dall'API.
let sha = shaArg;
let mergedAt = dateArg;
if (!sha || !mergedAt) {
  const pr = await fetchPr(prNumber);
  if (!pr.merged_at) {
    abort(`la PR #${prNumber} non risulta mergiata (merged_at null): niente da applicare`);
  }
  sha = sha || pr.merge_commit_sha;
  mergedAt = mergedAt || pr.merged_at;
}
if (!sha) abort(`merge commit sconosciuto per la PR #${prNumber}`);
if (!mergedAt) abort(`data di merge sconosciuta per la PR #${prNumber}`);

const currentState = frontmatterValue(session.text, 'state');
const updates = {
  state: currentState === CLOSED_MARKER ? CLOSED_MARKER : CLOSED_MARKER,
  merged: 'true',
  merged_commit: `"${sha}"`,
  merged_date: `"${mergedAt}"`,
};

const patched = patchFrontmatter(session.text, updates);
if (!patched) abort(`frontmatter non valido in ${session.file}`);

if (patched.changed.length === 0) {
  console.log(
    `[OK] ${session.file}: stato di merge gia' in sync (match su \`${found.matchedBy}\`)`,
  );
  process.exit(0);
}

if (dryRun) {
  console.log(`[INFO] ${session.file}: dry-run, nessuna scrittura`);
  for (const line of patched.changed) console.log(`       ${line}`);
  process.exit(0);
}

writeFileSync(session.full, patched.text, 'utf8');
console.log(`[OK] ${session.file}: stato di merge applicato (match su \`${found.matchedBy}\`)`);
for (const line of patched.changed) console.log(`       ${line}`);
console.log('[INFO] ricorda di rigenerare i blocchi: aggregate-state.ps1 -> generate-bundle.ps1');
process.exit(0);
