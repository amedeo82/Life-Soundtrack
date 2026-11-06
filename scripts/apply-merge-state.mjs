#!/usr/bin/env node
/**
 * Applica lo stato di merge al frontmatter di una sessione o di una story
 * (issue #239, issue #297) e aggiorna le entry del DEV-LOG (issue #324).
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
 *                                 DEV-LOG: `**Stato**:` canonico con PR e sha
 *
 * Questo script esegue il passo 2 in modo deterministico: nessuna LLM, nessuna
 * interpretazione, nessun rischio di dimenticanza. E' idempotente (se i campi
 * sono gia' corretti non scrive nulla) e tocca **solo** le righe di frontmatter
 * del file (o la riga `**Stato**:` del DEV-LOG): il resto resta byte-identico.
 *
 * **Tre perimetri, due formati per sessione/story, uno per DEV-LOG** (issue #297, #324):
 * `docs/state/sessions/` dichiara `state:`/`merged:`,
 * `docs/state/stories/` dichiara `status:`,
 * `docs/18-DEV-LOG.md` ha entry con `**Stato**:` per sessioni referenziate.
 *
 * Uso:
 *   node scripts/apply-merge-state.mjs --pr <N> [--sha <sha>] [--date <iso>]
 *                                       [--branch <ref>] [--root <dir>] [--dry-run]
 *                                       [--devlog <path>] [--repair-devlog]
 *
 * Se `--sha` / `--date` non sono forniti, vengono letti dall'API GitHub
 * (stessa fonte di verita' del gate `scripts/check-merge-state.mjs`).
 *
 * `--repair-devlog`: modalita' di riparazione storica. Non richiede `--pr`.
 * Scorre tutte le sessioni mergiate e normalizza le entry DEV-LOG corrispondenti.
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
const devlogPath = argValue('--devlog', join(root, 'docs', '18-DEV-LOG.md'));
const prNumber = Number.parseInt(argValue('--pr', ''), 10);
const shaArg = argValue('--sha');
const dateArg = argValue('--date');
const branchArg = argValue('--branch');
const dryRun = argv.includes('--dry-run');
const repairDevlog = argv.includes('--repair-devlog');
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

/** Frontmatter parser - must be defined before use in ESM. */
function parseFrontmatter(text) {
  const out = {};
  if (!text.startsWith('---')) return out;
  const end = text.indexOf('\n---', 3);
  if (end < 0) return out;
  const block = text.slice(text.indexOf('\n') + 1, end);
  for (const line of block.split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function frontmatterValue(text, field) {
  const m = new RegExp(`^${field}:\\s*(.*)$`, 'm').exec(text.slice(0, text.indexOf('\n---', 3)));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function listStateFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const full = join(dir, file);
      const text = readFileSync(full, 'utf8');
      return { file, full, text, fm: parseFrontmatter(text) };
    });
}

function abort(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(2);
}

if (!repairDevlog) {
  if (!Number.isFinite(prNumber) || prNumber <= 0) {
    abort('manca --pr <N> (numero della pull request mergiata)');
  }
}
if (!existsSync(sessionsDir) && !existsSync(storiesDir) && !repairDevlog) {
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

/** Legge le entry del DEV-LOG con `**Stato**:`. */
function readDevlogEntries(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{2,3})\s+(.*)$/.exec(lines[i]);
    if (m) {
      cur = { level: m[1].length, heading: m[2], line: i, body: [] };
      sections.push(cur);
      continue;
    }
    if (cur) cur.body.push(lines[i]);
  }
  const entries = [];
  for (const s of sections) {
    const body = s.body.join('\n');
    const statoM = /^\*\*Stato\*\*:\s*(.*)$/m.exec(body);
    if (!statoM) continue;
    const prM = /^\*\*PR\*\*:\s*(.*)$/m.exec(body);
    const sessionRefs = [];
    const single = s.heading.match(/\(Sessione\s+(\d+)\)/);
    if (single) sessionRefs.push(Number.parseInt(single[1], 10));
    const multi = s.heading.match(/\(Sessioni\s+([\d,\s-]+)\)/);
    if (multi) {
      const parts = multi[1].split(/[,\s-]+/);
      if (parts.length === 2) {
        const a = Number.parseInt(parts[0], 10);
        const b = Number.parseInt(parts[1], 10);
        if (Number.isFinite(a) && Number.isFinite(b) && a <= b) {
          for (let n = a; n <= b; n++) sessionRefs.push(n);
        }
      } else {
        for (const p of parts) {
          const n = Number.parseInt(p.trim(), 10);
          if (Number.isFinite(n)) sessionRefs.push(n);
        }
      }
    }
    entries.push({
      line: s.line,
      heading: s.heading,
      stato: statoM[1].trim(),
      prLine: prM ? prM[1].trim() : null,
      sessionRefs,
      rawStart: s.line,
      rawEnd: s.line + s.body.length,
    });
  }
  return entries;
}

/** Estrae il primo numero di PR da una riga `**PR**:`. */
function extractPrFromLine(prLine) {
  if (!prLine) return null;
  const m = prLine.match(/#(\d+)/);
  return m ? Number.parseInt(m[1], 10) : null;
}

/** Costruisce la riga Stato canonica per una sessione mergiata. */
function buildCanonicalStato(prNumber, mergeSha, existingStato) {
  const sha7 = mergeSha.slice(0, 7);
  // Preserva la prosa dopo il primo "—" (em dash) se presente
  let prose = '';
  const dashIdx = existingStato.indexOf('—');
  if (dashIdx >= 0) {
    prose = ' —' + existingStato.slice(dashIdx + 1);
  }
  return `✅ **MERGED** (PR #${prNumber}, merge commit \`${sha7}\`${prose}`;
}

/** Normalizza la riga Stato di una entry DEV-LOG per una sessione mergiata. */
function normalizeDevlogEntry(text, entry, prNumber, mergeSha) {
  const lines = text.split('\n');
  // Find the actual line in the split array
  let targetIdx = -1;
  for (let i = entry.rawStart; i <= entry.rawEnd && i < lines.length; i++) {
    if (lines[i].trim().startsWith('**Stato**:')) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx < 0) return { text, changed: false };
  const newStato = buildCanonicalStato(prNumber, mergeSha, lines[targetIdx].trim());
  if (lines[targetIdx].trim() === newStato) {
    return { text, changed: false };
  }
  lines[targetIdx] = newStato;
  return { text: lines.join('\n'), changed: true };
}

const sessionFiles = listStateFiles(sessionsDir);
const storyFiles = listStateFiles(storiesDir);

let foundSessions = null;
let foundStories = null;

if (!repairDevlog) {
  foundSessions = findByPrOrBranch(sessionFiles, 'sessione');
  foundStories = findByPrOrBranch(storyFiles, 'story');

  if (!foundSessions && !foundStories) {
    console.log(
      `[WARN] nessun file di sessione ne' di story corrisponde alla PR #${prNumber}` +
        (branchArg ? ` (branch "${branchArg}")` : '') +
        ': niente da applicare. Se la PR ha una sessione o una story, il doc-sync ' +
        `in-branch deve scrivere \`pr: ${prNumber}\` nel file di stato.`,
    );
    process.exit(0);
  }
}

// Merge commit e data: dagli argomenti, altrimenti dall'API (per modalita' non repair).
let sha = shaArg;
let mergedAt = dateArg;
let prData = null;

async function ensurePrData(targetPr) {
  if (prData && prData.number === targetPr) return prData;
  if (!sha || !mergedAt) {
    const pr = await fetchPr(targetPr);
    if (!pr.merged_at) {
      abort(`la PR #${targetPr} non risulta mergiata (merged_at null): niente da applicare`);
    }
    sha = sha || pr.merge_commit_sha;
    mergedAt = mergedAt || pr.merged_at;
    prData = pr;
  }
  if (!sha) abort('merge commit sconosciuto per la PR #' + targetPr);
  if (!mergedAt) abort('data di merge sconosciuta per la PR #' + targetPr);
  return { number: targetPr, merge_commit_sha: sha, merged_at: mergedAt };
}

// Le story dichiarano la data di merge in formato `YYYY-MM-DD` (schema in
// `docs/state/_index.md`), le sessioni in timestamp ISO-8601 completo.
const mergedDate = mergedAt ? mergedAt.slice(0, 10) : '';

if (foundSessions) {
  await ensurePrData(prNumber);
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
    } else if (dryRun) {
      console.log(`[INFO] ${session.file}: dry-run, nessuna scrittura`);
      for (const line of patched.changed) console.log(`       ${line}`);
    } else {
      writeFileSync(session.full, patched.text, 'utf8');
      console.log(
        `[OK] ${session.file}: stato di merge applicato (match su \`${foundSessions.matchedBy}\`)`,
      );
      for (const line of patched.changed) console.log(`       ${line}`);
    }
  }

  if (foundSessions.files.length > 1) {
    console.log(
      `[INFO] ${foundSessions.files.length} file di sessione dichiarano \`pr: ${prNumber}\`: ` +
        "lo stato di merge e' stato applicato a tutti (una PR puo' consegnare piu' sessioni, issue #275)",
    );
  }
}

if (foundStories) {
  await ensurePrData(prNumber);
  for (const story of foundStories.files) {
    const currentStatus = frontmatterValue(story.text, 'status');
    if (currentStatus && STORY_TERMINAL.has(currentStatus)) {
      console.log(
        `[INFO] ${story.file}: \`status: ${currentStatus}\` e' uno stato terminale dichiarato: ` +
          "lo stato di merge non viene applicato (non e' un lavoro in corso)",
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
    } else if (dryRun) {
      console.log(`[INFO] ${story.file}: dry-run, nessuna scrittura`);
      for (const line of patched.changed) console.log(`       ${line}`);
    } else {
      writeFileSync(story.full, patched.text, 'utf8');
      console.log(
        `[OK] ${story.file}: stato di merge applicato (match su \`${foundStories.matchedBy}\`)`,
      );
      for (const line of patched.changed) console.log(`       ${line}`);
    }
  }

  if (foundStories.files.length > 1) {
    console.log(
      `[INFO] ${foundStories.files.length} file di story dichiarano \`pr: ${prNumber}\`: ` +
        "lo stato di merge e' stato applicato a tutti (una PR puo' consegnare piu' story)",
    );
  }
}

/** Aggiorna il DEV-LOG per le sessioni della PR corrente (modalita' post-merge). */
async function updateDevlogForPr(targetPr, targetSha, targetMergedAt) {
  if (!existsSync(devlogPath)) {
    console.log(`[WARN] DEV-LOG non trovato: ${devlogPath}`);
    return false;
  }
  const devlogText = readFileSync(devlogPath, 'utf8');
  const entries = readDevlogEntries(devlogText);
  const sessionFilesAll = listStateFiles(sessionsDir);
  const sessionMap = new Map();
  for (const s of sessionFilesAll) {
    const m = /^(\d+)-/.exec(s.file);
    if (m) sessionMap.set(Number.parseInt(m[1], 10), s);
  }

  let anyChanged = false;
  let newText = devlogText;

  for (const entry of entries) {
    // L'entry riguarda questa PR?
    let matches = false;
    if (entry.sessionRefs.length > 0) {
      for (const sn of entry.sessionRefs) {
        const s = sessionMap.get(sn);
        if (s && s.fm.pr) {
          const p = Number.parseInt(s.fm.pr, 10);
          if (p === targetPr) {
            matches = true;
            break;
          }
        }
      }
    }
    if (!matches && entry.prLine) {
      const p = extractPrFromLine(entry.prLine);
      if (p === targetPr) matches = true;
    }
    if (!matches) continue;

    const result = normalizeDevlogEntry(newText, entry, targetPr, targetSha);
    if (result.changed) {
      newText = result.text;
      anyChanged = true;
      console.log(
        `[OK] DEV-LOG L${entry.line} (${entry.heading}): riga Stato normalizzata per PR #${targetPr}`,
      );
    }
  }

  if (anyChanged) {
    if (dryRun) {
      console.log('[INFO] DEV-LOG: dry-run, nessuna scrittura');
    } else {
      writeFileSync(devlogPath, newText, 'utf8');
      console.log('[OK] DEV-LOG aggiornato');
    }
  }
  return anyChanged;
}

/** Ripara TUTTE le entry DEV-LOG per sessioni mergiate (modalita' --repair-devlog). */
async function repairAllDevlog() {
  if (!existsSync(devlogPath)) {
    abort(`file DEV-LOG non trovato: ${devlogPath}`);
  }
  const devlogText = readFileSync(devlogPath, 'utf8');
  const entries = readDevlogEntries(devlogText);
  const sessionFilesAll = listStateFiles(sessionsDir);
  const sessionMap = new Map();
  for (const s of sessionFilesAll) {
    const m = /^(\d+)-/.exec(s.file);
    if (m) sessionMap.set(Number.parseInt(m[1], 10), s);
  }

  // Raccogli tutte le PR mergiate dalle sessioni
  const prInfo = new Map(); // prNumber -> { sha, mergedAt }
  for (const s of sessionFilesAll) {
    const p = Number.parseInt(s.fm.pr ?? '', 10);
    if (Number.isFinite(p) && p > 0 && s.fm.merged === 'true') {
      if (!prInfo.has(p)) {
        // Fetch from API if we don't have sha/date
        const pr = await fetchPr(p);
        if (pr.merged_at && pr.merge_commit_sha) {
          prInfo.set(p, { sha: pr.merge_commit_sha, mergedAt: pr.merged_at });
        }
      }
    }
  }

  let newText = devlogText;
  let anyChanged = false;
  let processed = 0;

  for (const entry of entries) {
    // Trova la PR per questa entry
    let prNumber = null;
    if (entry.sessionRefs.length > 0) {
      for (const sn of entry.sessionRefs) {
        const s = sessionMap.get(sn);
        if (s && s.fm.pr) {
          const p = Number.parseInt(s.fm.pr, 10);
          if (Number.isFinite(p) && p > 0 && prInfo.has(p)) {
            prNumber = p;
            break;
          }
        }
      }
    }
    if (!prNumber && entry.prLine) {
      const p = extractPrFromLine(entry.prLine);
      if (Number.isFinite(p) && p > 0 && prInfo.has(p)) {
        prNumber = p;
      }
    }
    if (!prNumber) continue;

    const info = prInfo.get(prNumber);
    if (!info) continue;

    const result = normalizeDevlogEntry(newText, entry, prNumber, info.sha);
    if (result.changed) {
      newText = result.text;
      anyChanged = true;
      processed++;
      console.log(
        `[OK] DEV-LOG L${entry.line} (${entry.heading}): riga Stato normalizzata per PR #${prNumber}`,
      );
    }
  }

  if (anyChanged) {
    if (dryRun) {
      console.log('[INFO] DEV-LOG (repair): dry-run, nessuna scrittura');
    } else {
      writeFileSync(devlogPath, newText, 'utf8');
      console.log(`[OK] DEV-LOG riparato: ${processed} entry aggiornate`);
    }
  } else {
    console.log("[OK] DEV-LOG: gia' in sync, nessuna modifica necessaria");
  }
  return anyChanged;
}

// Esegui aggiornamento DEV-LOG
if (repairDevlog) {
  await repairAllDevlog();
} else if (foundSessions || foundStories) {
  await ensurePrData(prNumber);
  await updateDevlogForPr(prNumber, sha, mergedAt);
}

console.log('[INFO] ricorda di rigenerare i blocchi: aggregate-state.ps1 -> generate-bundle.ps1');
process.exit(0);
