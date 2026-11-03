#!/usr/bin/env node
/**
 * Gate "stato di merge delle sessioni" (issue #239).
 *
 * Il frontmatter di `docs/state/sessions/<N>-<slug>.md` dichiara lo stato del
 * lavoro (`state`, `merged`, `merged_commit`, `merged_date`, `pr`). Fino alla
 * Sessione 78 nessun gate confrontava quei campi con lo stato REALE delle
 * pull request: 14 sessioni su ~56 riportavano `merged: false` anche dopo il
 * merge della propria PR, e 5 non avevano neppure il numero di PR.
 *
 * Il drift era invisibile perche' i gate esistenti verificano la consistenza
 * INTERNA (il blocco aggregato coincide con i file di quel momento): il flag
 * sbagliato veniva riprodotto fedelmente, quindi `-Check` usciva 0 e la
 * pipeline restava verde con la documentazione falsa. `auto-state-aggregate`
 * post-merge rigenerava i blocchi propagando l'errore: la CI amplificava il
 * drift invece di intercettarlo.
 *
 * Questo gate e' **read-only**: non genera e non scrive nulla, come
 * `check-readme-facts.mjs`. L'aggregator resta puro (nessuna rete, output
 * deterministico byte-identico): la verita' ESTERNA sta qui, in un verificatore
 * separato.
 *
 * Fonti di verita':
 *   1. API GitHub `/repos/{owner}/{repo}/pulls` -> stato reale delle PR
 *   2. `docs/state/sessions/*.md` -> frontmatter dichiarato
 *
 * Uso: node scripts/check-merge-state.mjs [--root <dir>] [--sessions <dir>]
 *                                           [--repo owner/name] [--api <url>]
 *                                           [--defer-unapplied]
 *
 * `--defer-unapplied` (issue #284): modalita' per il passaggio `push` della CI,
 * quello che gira sul MERGE COMMIT, prima che il writer post-merge applichi lo
 * stato. In quel caso l'albero contiene il merge commit e il frontmatter
 * dichiara ancora `merged: false`: il confronto fallirebbe per costruzione,
 * non per drift. La modalita' differisce **solo** i confronti la cui PR ha per
 * merge commit ESATTAMENTE l'albero sotto esame (cioe' lo stato non e' ancora
 * applicabile perche' il writer non e' passato). Ogni altro drift resta un
 * fallimento: il gate non e' indebolito, cambia solo l'albero cui si applica.
 *
 * Exit code: 0 = in sync, 1 = drift, 2 = errore di ambiente (fail-closed).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);

function argValue(name, fallback) {
  const idx = argv.indexOf(name);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  return fallback;
}

const root = resolve(argValue('--root', '.'));
const sessionsDir = argValue('--sessions', join(root, 'docs', 'state', 'sessions'));
const repo = argValue('--repo', process.env.GITHUB_REPOSITORY || 'amedeo82/Life-Soundtrack');
const apiBase = argValue('--api', process.env.GITHUB_API_URL || 'https://api.github.com').replace(
  /\/+$/,
  '',
);
// Issue #284: differimento dei confronti la cui PR e' stata mergiata ma il cui
// stato non e' ancora applicato dall'albero sotto esame (passaggio `push` sul
// merge commit, prima del writer post-merge).
const deferUnapplied = argv.includes('--defer-unapplied');

const CLOSED_MARKER = '\u{1F7E2}';

let failures = 0;
let checks = 0;

function fail(message) {
  console.error(`[FAIL] ${message}`);
  failures++;
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function environmentError(message) {
  console.error(`[FAIL] ${message}`);
  console.error(
    "       Il gate e' fail-closed: senza la verita' esterna non puo' dichiarare \"in sync\".",
  );
  process.exit(2);
}

/**
 * Frontmatter: solo il blocco `---\n ... \n---` in testa al file, con campi
 * `chiave: valore` su una riga. Non serve un parser YAML completo: i file di
 * sessione usano un frontmatter piatto, e i valori complessi (title con
 * apici) non servono al confronto.
 */
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

function readSessions() {
  if (!existsSync(sessionsDir)) {
    environmentError(`directory delle sessioni non trovata: ${sessionsDir}`);
  }
  const files = readdirSync(sessionsDir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  return files.map((file) => {
    const full = join(sessionsDir, file);
    const text = readFileSync(full, 'utf8');
    return { file, full, text, fm: parseFrontmatter(text) };
  });
}

/** Token: env per prima, poi la CLI `gh` (dev machine e runner), poi anonimo. */
function resolveToken() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    const res = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
    const token = (res.stdout || '').trim();
    if (res.status === 0 && token) return token;
  } catch {
    // gh non disponibile: si prosegue anonimamente
  }
  return null;
}

const token = resolveToken();

async function apiGet(path) {
  const url = `${apiBase}${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'life-soundtrack-check-merge-state',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 403 || res.status === 429) {
        const remaining = res.headers.get('x-ratelimit-remaining');
        lastError = `HTTP ${res.status} (rate limit remaining: ${remaining ?? 'n/d'})`;
      } else if (!res.ok) {
        lastError = `HTTP ${res.status}`;
      } else {
        return await res.json();
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  environmentError(`API GitHub non raggiungibile (${url}): ${lastError}`);
  return null;
}

/**
 * Elenco delle PR del repository: un numero di sessione puo' riferirsi a una
 * PR qualsiasi, quindi serve l'elenco completo. Il list endpoint restituisce
 * `merged_at` (non null solo per le PR effettivamente mergiate) e
 * `merge_commit_sha`.
 */
async function fetchPulls() {
  const map = new Map();
  for (let page = 1; page <= 20; page++) {
    const items = await apiGet(
      `/repos/${repo}/pulls?state=all&per_page=100&page=${page}&sort=created&direction=asc`,
    );
    if (!Array.isArray(items)) {
      environmentError(
        `risposta inattesa dall'API GitHub: atteso un array, ricevuto ${typeof items}`,
      );
    }
    if (items.length === 0) break;
    for (const pr of items) {
      map.set(pr.number, {
        number: pr.number,
        state: pr.state,
        mergedAt: pr.merged_at || null,
        mergeCommitSha: pr.merge_commit_sha || null,
      });
    }
    if (items.length < 100) break;
  }
  return map;
}

/** Il SHA dichiarato puo' essere abbreviato (7 char) o completo (40 char). */
function shaMatches(declared, actual) {
  if (!declared || !actual) return false;
  const d = declared.toLowerCase();
  const a = actual.toLowerCase();
  return a.startsWith(d) || d.startsWith(a);
}

/**
 * SHA del commit sotto esame (issue #284).
 *
 * Serve a distinguere il caso strutturale dal drift reale: se l'albero e'
 * ESATTAMENTE il merge commit della PR, lo stato di merge non e' ancora
 * applicabile (lo applica il writer post-merge, che gira DOPO). Se git non
 * e' disponibile la modalita' `--defer-unapplied` non puo' fare questa
 * distinzione: in quel caso non differisce nulla e il gate resta fail-closed
 * su tutto.
 */
function resolveHeadSha() {
  // Il path viene passato come ARGOMENTO (`git -C <root>`) e non come `cwd`:
  // su Windows il `cwd` di un processo figlio deve essere un path del sistema
  // operativo, mentre il path puo' arrivare in forma POSIX (Git Bash: /tmp/...),
  // e in quel caso lo spawn fallirebbe silenziosamente. `git -C` non ha questo
  // problema: il path viene convertito da chi invoca git.
  const attempts = [
    ['git', ['-C', root, 'rev-parse', 'HEAD']],
    ['git', ['rev-parse', 'HEAD']],
  ];
  for (const [cmd, args] of attempts) {
    try {
      const res = spawnSync(cmd, args, {
        cwd: attempts.length === 2 ? undefined : root,
        encoding: 'utf8',
      });
      const sha = (res.stdout || '').trim();
      if (res.status === 0 && /^[0-9a-f]{40}$/i.test(sha)) return sha;
    } catch {
      // git non disponibile: nessun differimento (fail-closed)
    }
  }
  return null;
}

/** La data dichiarata puo' essere `YYYY-MM-DD` o un timestamp ISO completo. */
function dateMatches(declared, actual) {
  if (!declared || !actual) return false;
  return declared.slice(0, 10) === actual.slice(0, 10);
}

const sessions = readSessions();
const pulls = await fetchPulls();

console.log(
  `[INFO] check-merge-state: ${sessions.length} sessioni, ${pulls.size} PR lette da ${repo}`,
);

let compared = 0;
let skipped = 0;
let deferred = 0;
const headSha = deferUnapplied ? resolveHeadSha() : null;

for (const session of sessions) {
  const prRaw = session.fm.pr;
  const prNumber = Number.parseInt(prRaw ?? '', 10);
  if (!Number.isFinite(prNumber) || prNumber <= 0) {
    skipped++;
    continue;
  }
  const pr = pulls.get(prNumber);
  if (!pr) {
    environmentError(
      `PR #${prNumber} (citata da ${session.file}) non trovata nella risposta dell'API: ` +
        'il dato esterno e\' incompleto, il gate non puo\' dichiarare "in sync"',
    );
  }

  compared++;
  checks++;
  const isMerged = pr.mergedAt !== null;
  const declaredMerged = session.fm.merged === 'true';

  if (isMerged !== declaredMerged) {
    console.error('[DEBUG] isMerged='+isMerged+' declared='+declaredMerged+' mergeCommitSha='+pr.mergeCommitSha);
    // Issue #284: il caso strutturale (la PR e' stata mergiata, ma l'albero
    // sotto esame e' il suo merge commit, quindi lo stato non e' ancora
    // applicabile perche' il writer post-merge non e' ancora passato) viene
    // DIFFERITO, non fallito. Il gate autoritativo gira sullo stato finale,
    // dopo il writer: li' nessun confronto e' differito.
    console.error('[DBG] isMerged=' + isMerged + ' declared=' + declaredMerged + ' prSha=' + pr.mergeCommitSha);
    console.error('[DBG] isMerged=' + isMerged + ' declared=' + declaredMerged + ' prSha=' + pr.mergeCommitSha);
    if (
      deferUnapplied &&
      isMerged &&
      session.fm.merged === 'false' &&
      headSha &&
      pr.mergeCommitSha &&
      pr.mergeCommitSha.toLowerCase() === headSha.toLowerCase()
    ) {
      deferred++;
      console.log(
        `[DEFERRED] ${session.file}: la PR #${prNumber} e' MERGED e l'albero sotto esame ne e' ` +
          `il merge commit (${headSha.slice(0, 7)}): lo stato viene applicato dal writer ` +
          "post-merge, il confronto e' differito al passaggio successivo.",
      );
      continue;
    }
    fail(
      `${session.file}: la PR #${prNumber} e' ${isMerged ? 'MERGED' : 'aperta'}, ma il frontmatter ` +
        `dichiara \`merged: ${session.fm.merged ?? '(assente)'}\``,
    );
    continue;
  }

  if (!isMerged) continue;

  const declaredSha = session.fm.merged_commit ?? '';
  if (!shaMatches(declaredSha, pr.mergeCommitSha)) {
    fail(
      `${session.file}: \`merged_commit\` non coincide con il merge commit della PR #${prNumber} ` +
        `(dichiarato: "${declaredSha || '(vuoto)'}", reale: "${pr.mergeCommitSha ?? '(null)'}")`,
    );
    continue;
  }

  const declaredDate = session.fm.merged_date ?? '';
  if (!dateMatches(declaredDate, pr.mergedAt)) {
    fail(
      `${session.file}: \`merged_date\` non coincide con la data di merge della PR #${prNumber} ` +
        `(dichiarato: "${declaredDate || '(vuoto)'}", reale: "${pr.mergedAt}")`,
    );
    continue;
  }

  if (session.fm.state !== CLOSED_MARKER) {
    fail(
      `${session.file}: la PR #${prNumber} e' mergiata, ma \`state\` e' "${session.fm.state ?? '(assente)'}" ` +
        `invece di "${CLOSED_MARKER}" (sessione chiusa)`,
    );
  }
}

if (failures === 0) {
  ok(
    `stato di merge delle sessioni in sync con GitHub: ${compared} sessioni con PR confrontate, ` +
      `${skipped} senza PR (ignorate)` +
      (deferred > 0 ? `, ${deferred} differiti (stato non ancora applicato dal writer)` : ''),
  );
}

console.log('');
console.log(
  `[INFO] check-merge-state: ${checks} confronti, ${failures} falliti` +
    (deferred > 0 ? `, ${deferred} differiti` : ''),
);
process.exit(failures > 0 ? 1 : 0);
