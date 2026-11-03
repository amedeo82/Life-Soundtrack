#!/usr/bin/env node
/**
 * Applica lo stato di merge al frontmatter di una sessione o di una story
 * (issue #239, issue #297).
 *
 * Il merge commit di una PR **non esiste prima del merge**: il doc-sync fatto
 * nel branch puo' scrivere `pr:`, ma `merged_commit` e `merged_date` sono
 * noti solo dopo. Percio' il doc-sync si divide in due momenti:
 *
 *   1. pre-merge, nel branch  -> `pr: <N>`
 *   2. post-merge             -> il frontmatter dichiara lo stato chiuso:
 *                                 sessione: `merged: true`, `merged_commit`,
 *                                 `merged_date`, `state: <chiuso>`
 *                                 story:   `status: done`, `merged_commit`,
 *                                 `merged_date`
 *
 * Questo script esegue il passo 2 in modo deterministico: nessuna LLM, nessuna
 * interpretazione, nessun rischio di dimenticanza. E' idempotente (se i campi
 * sono gia' corretti non scrive nulla) e tocca **solo** le righe di frontmatter
 * del file: il corpo del documento resta byte-identico.
 *
 * **Due perimetri, due formati** (issue #297): `docs/state/sessions/` dichiara
 * `state:`/`merged:`, `docs/state/stories/` dichiara `status:`. Fino alla
 * Sessione 94 solo le sessioni erano coperte: una story mergiata poteva
 * restare `status: in-review` per sempre, senza errore e con la CI verde.
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
const storiesDir = join(root, 'docs', 'state', 'stories');
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
const STORY_DONE = 'done';
// Stati di una story che NON sono stati di lavoro: sono esiti terminali
// dichiarati (scope cancellato, dipendenza esterna). Il merge di una PR non
// li cancella: sovrascriverli sarebbe un falso "done".
const STORY_TERMINAL = new Set(['blocked', 'wontdo']);
const SESSION_ORDER = ['state', 'merged', 'merged_commit', 'merged_date', 'branch', 'pr'];
const STORY_ORDER = [
  'id',
  'title',
  'phase',
  'area',
  'status',
  'priority',
  'depends_on',
  'issue',
  'branch',
  'pr',
  'merged_commit',
  'merged_date',
];

function abort(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(2);
}

if (!Number.isFinite(prNumber) || prNumber <= 0) {
  abort('manca --pr <N> (numero della pull request mergiata)');
}
if (!existsSync(sessionsDir) && !existsSync(storiesDir)) {
  abort(`nessuna directory di stato trovata: ${sessionsDir} / ${storiesDir}`);
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

function listStateFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const full = join(dir, file);
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
 * Individua i file di stato della PR. Ordine di ricerca:
 *   1. `pr: <N>` (il doc-sync in-branch lo scrive: e' il legame esplicito)
 *   2. `branch: <ref>` (fallback: utile quando il doc-sync in-branch non ha
 *      ancora impostato `pr:`)
 *
 * **Piu' file per PR**: una PR puo' consegnare piu' blocchi di lavoro distinti
 * (una sola issue, piu' sessioni). Il fatto e' inequivocabile — sono stati
 * mergiati da quella PR — quindi lo stato di merge viene applicato a **tutti**
 * i file che la dichiarano. Prima (issue #275) lo script abortava, e al merge
 * nessuna delle sessioni riceveva `merged: true`: i blocchi aggregati
 * mostravano ancora «non ancora mergiato (PR #N)», il drift che il gate
 * `check-merge-state.mjs` esiste per intercettare.
 */
function findByPrOrBranch(files, label) {
  const byPr = files.filter((f) => frontmatterValue(f.text, 'pr') === String(prNumber));
  if (byPr.length > 0) return { files: byPr, matchedBy: 'pr' };
  if (branchArg) {
    const byBranch = files.filter((f) => frontmatterValue(f.text, 'branch') === branchArg);
    if (byBranch.length === 1) return { files: byBranch, matchedBy: 'branch' };
    if (byBranch.length > 1) {
      abort(
        `piu' file di ${label} dichiarano \`branch: ${branchArg}\`: ${byBranch.map((f) => f.file).join(', ')}`,
      );
    }
  }
  return null;
}

/**
 * Riscrive il frontmatter: sostituisce i campi esistenti e inserisce quelli
 * mancanti nell'ordine dello schema. Il corpo del file non viene toccato.
 */
function patchFrontmatter(text, updates, order) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return null;
  const fm = lines.slice(1, end);
  const rest = lines.slice(end);

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

const sessionFiles = listStateFiles(sessionsDir);
const storyFiles = listStateFiles(storiesDir);
const foundSessions = findByPrOrBranch(sessionFiles, 'sessione');
const foundStories = findByPrOrBranch(storyFiles, 'story');

if (!foundSessions && !foundStories) {
  // Nessun file di stato per questa PR: e' legittimo (una PR `fix` senza
  // sessione, o una PR che non ha ancora scritto `pr:`). Non e' un errore:
  // fallire qui rendeva rosso il workflow post-merge per una PR che non ha
  // niente da chiudere (misurato: issue #254, Sessione 81). La verifica
  // della precondizione resta fail-closed dove conta: il gate
  // `check-merge-state.mjs` segnala sessioni e story mergiate senza stato.
  console.log(
    `[WARN] nessun file di sessione ne' di story corrisponde alla PR #${prNumber}` +
      (branchArg ? ` (branch "${branchArg}")` : '') +
      ': niente da applicare. Se la PR ha una sessione o una story, il doc-sync ' +
      `in-branch deve scrivere \`pr: ${prNumber}\` nel file di stato.`,
  );
  process.exit(0);
}

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
if (!sha) abort('merge commit sconosciuto per la PR #' + prNumber);
if (!mergedAt) abort('data di merge sconosciuta per la PR #' + prNumber);

// Le story dichiarano la data di merge in formato `YYYY-MM-DD` (schema in
// `docs/state/_index.md`), le sessioni in timestamp ISO-8601 completo.
const mergedDate = mergedAt.slice(0, 10);

if (foundSessions) {
  for (const session of foundSessions.files) {
    const updates = {
      state: CLOSED_MARKER,
      merged: 'true',
      merged_commit: `"${sha}"`,
      merged_date: `"${mergedAt}"`,
    };

    const patched = patchFrontmatter(session.text, updates, SESSION_ORDER);
    if (!patched) abort('frontmatter non valido in ' + session.file);

    if (patched.changed.length === 0) {
      console.log(
        `[OK] ${session.file}: stato di merge gia' in sync (match su \`${foundSessions.matchedBy}\`)`,
      );
      continue;
    }

    if (dryRun) {
      console.log(`[INFO] ${session.file}: dry-run, nessuna scrittura`);
      for (const line of patched.changed) console.log(`       ${line}`);
      continue;
    }

    writeFileSync(session.full, patched.text, 'utf8');
    console.log(
      `[OK] ${session.file}: stato di merge applicato (match su \`${foundSessions.matchedBy}\`)`,
    );
    for (const line of patched.changed) console.log(`       ${line}`);
  }

  if (foundSessions.files.length > 1) {
    console.log(
      `[INFO] ${foundSessions.files.length} file di sessione dichiarano \`pr: ${prNumber}\`: ` +
        "lo stato di merge e' stato applicato a tutti (una PR puo' consegnare piu' sessioni, issue #275)",
    );
  }
}

if (foundStories) {
  for (const story of foundStories.files) {
    const currentStatus = frontmatterValue(story.text, 'status');
    if (currentStatus && STORY_TERMINAL.has(currentStatus)) {
      console.log(
        `[INFO] ${story.file}: \`status: ${currentStatus}\` e' uno stato terminale dichiarato: ` +
          'lo stato di merge non viene applicato (non e\' un lavoro in corso)',
      );
      continue;
    }

    const updates = {
      status: STORY_DONE,
      merged_commit: `"${sha}"`,
      merged_date: mergedDate,
    };

    const patched = patchFrontmatter(story.text, updates, STORY_ORDER);
    if (!patched) abort('frontmatter non valido in ' + story.file);

    if (patched.changed.length === 0) {
      console.log(
        `[OK] ${story.file}: stato di merge gia' in sync (match su \`${foundStories.matchedBy}\`)`,
      );
      continue;
    }

    if (dryRun) {
      console.log(`[INFO] ${story.file}: dry-run, nessuna scrittura`);
      for (const line of patched.changed) console.log(`       ${line}`);
      continue;
    }

    writeFileSync(story.full, patched.text, 'utf8');
    console.log(
      `[OK] ${story.file}: stato di merge applicato (match su \`${foundStories.matchedBy}\`)`,
    );
    for (const line of patched.changed) console.log(`       ${line}`);
  }

  if (foundStories.files.length > 1) {
    console.log(
      `[INFO] ${foundStories.files.length} file di story dichiarano \`pr: ${prNumber}\`: ` +
        "lo stato di merge e' stato applicato a tutti (una PR puo' consegnare piu' story)",
    );
  }
}

console.log('[INFO] ricorda di rigenerare i blocchi: aggregate-state.ps1 -> generate-bundle.ps1');
process.exit(0);
