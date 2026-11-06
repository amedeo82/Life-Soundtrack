#!/usr/bin/env node
/**
 * Gate "stato di merge delle sessioni e delle story" (issue #239, issue #297).
 *
 * Il frontmatter di `docs/state/sessions/<N>-<slug>.md` dichiara lo stato del
 * lavoro (`state`, `merged`, `merged_commit`, `merged_date`, `pr`). Fino alla
 * Sessione 78 nessun gate confrontava quei campi con lo stato REALE delle
 * pull request: 14 sessioni su ~56 riportavano `merged: false` anche dopo il
 * merge della propria PR, e 5 non avevano neppure il numero di PR.
 *
 * **Issue #297 — il perimetro delle story**: `docs/state/stories/<id>-<slug>.md`
 * dichiara lo stesso fatto in un formato diverso (`status: done` invece di
 * `state: <chiuso>` + `merged: true`). Fino alla Sessione 94 nessun writer e
 * nessun gate coprivano quel perimetro: la Story 2.5 e' restata
 * `status: in-review` con `pr: 267` dopo il merge della PR #295, e nulla se
 * n'era accorto. Oggi il gate confronta anche le story.
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
 *   2. `docs/state/sessions/*.md` -> frontmatter dichiarato (formato sessione)
 *   3. `docs/state/stories/*.md` -> frontmatter dichiarato (formato story)
 *   4. `docs/18-DEV-LOG.md` -> entry `**Stato**:` (issue #324)
 *
 * Uso: node scripts/check-merge-state.mjs [--root <dir>] [--sessions <dir>]
 *                                           [--stories <dir>]
 *                                           [--devlog <file>]
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
const storiesDir = argValue('--stories', join(root, 'docs', 'state', 'stories'));
const devlogPath = argValue('--devlog', join(root, 'docs', '18-DEV-LOG.md'));
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
const STORY_DONE = 'done';
// Stati terminali dichiarati di una story: non sono stati di lavoro, e il
// merge di una PR non li cancella (scope cancellato, dipendenza esterna).
const STORY_TERMINAL = new Set(['blocked', 'wontdo']);

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

/**
 * Le story (issue #297): stesso fatto, formato diverso. Il frontmatter dichiara
 * `status: done` invece di `state: <chiuso>` + `merged: true`.
 */
function readStories() {
  if (!existsSync(storiesDir)) {
    environmentError(`directory delle story non trovata: ${storiesDir}`);
  }
  const files = readdirSync(storiesDir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  return files.map((file) => {
    const full = join(storiesDir, file);
    const text = readFileSync(full, 'utf8');
    return { file, full, text, fm: parseFrontmatter(text) };
  });
}

/**
 * Legge e analizza le entry del DEV-LOG che hanno una riga `**Stato**:`.
 * Ogni entry e' delimitata da heading `## ` o `### `.
 * Restituisce un array di oggetti: { line, heading, stato, prLine, sessionRefs }.
 */
function readDevlogEntries() {
  if (!existsSync(devlogPath)) {
    environmentError(`file DEV-LOG non trovato: ${devlogPath}`);
  }
  const text = readFileSync(devlogPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{2,3})\s+(.*)$/.exec(lines[i]);
    if (m) {
      cur = { level: m[1].length, heading: m[2], line: i + 1, body: [] };
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
    // Sessioni referenziate nel heading: "(Sessione N)" o "(Sessioni N-M)"
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
    });
  }
  return entries;
}

/** Mappa sessione -> file di stato (per lookup rapido). */
function buildSessionMap(sessions) {
  const map = new Map();
  for (const s of sessions) {
    const m = /^(\d+)-/.exec(s.file);
    if (m) map.set(Number.parseInt(m[1], 10), s);
  }
  return map;
}

/** Estrae il primo numero di PR da una riga `**PR**:`. */
function extractPrFromLine(prLine) {
  if (!prLine) return null;
  // Formati: **#236**, #21, **#190**, **#236** (aperta ...), etc.
  const m = prLine.match(/#(\d+)/);
  return m ? Number.parseInt(m[1], 10) : null;
}

/** Classifica il marker dello stato. */
function classifyMarker(stato) {
  // MERGED claim: contiene "MERGED" o "merged" come parola intera o in **MERGED**
  if (/\bmerged\b/i.test(stato) || /MERGED/.test(stato)) return 'MERGED';
  // WIP claim: emoji 🟡 / 👀, o parole chiave
  if (/^🟡|^👀/.test(stato)) return 'WIP';
  if (/\bin corso\b/i.test(stato)) return 'WIP';
  if (/\bin progress\b/i.test(stato)) return 'WIP';
  if (/\bin review\b/i.test(stato)) return 'WIP';
  if (/\bPR aperta\b/i.test(stato)) return 'WIP';
  if (/\bin attesa di merge\b/i.test(stato)) return 'WIP';
  // DONE claim: altri checkmark verdi
  if (/^✅/.test(stato)) return 'DONE';
  if (/\bcompletata\b/i.test(stato)) return 'DONE';
  if (/\bfatto\b/i.test(stato)) return 'DONE';
  if (/\bimplementazione completa\b/i.test(stato)) return 'DONE';
  if (/\bspec .* scritta e approvata\b/i.test(stato)) return 'DONE';
  return 'UNKNOWN';
}

/** Verifica se la riga Stato cita PR #N e merge commit sha (7+ hex). */
function checkCitation(stato, prNumber, mergeSha) {
  const prPattern = new RegExp(`PR\\s*#${prNumber}\\b`, 'i');
  const shaPattern = new RegExp('`[0-9a-f]{7,}`', 'i');
  const hasPr = prPattern.test(stato);
  const hasSha = shaPattern.test(stato);
  return { hasPr, hasSha };
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
const stories = readStories();
const pulls = await fetchPulls();

console.log(
  `[INFO] check-merge-state: ${sessions.length} sessioni, ${stories.length} story, ` +
    `${pulls.size} PR lette da ${repo}`,
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
    console.error(
      '[DEBUG] isMerged=' +
        isMerged +
        ' declared=' +
        declaredMerged +
        ' mergeCommitSha=' +
        pr.mergeCommitSha,
    );
    // Issue #284: il caso strutturale (la PR e' stata mergiata, ma l'albero
    // sotto esame e' il suo merge commit, quindi lo stato non e' ancora
    // applicabile perche' il writer post-merge non e' ancora passato) viene
    // DIFFERITO, non fallito. Il gate autoritativo gira sullo stato finale,
    // dopo il writer: li' nessun confronto e' differito.
    console.error(
      '[DBG] isMerged=' + isMerged + ' declared=' + declaredMerged + ' prSha=' + pr.mergeCommitSha,
    );
    console.error(
      '[DBG] isMerged=' + isMerged + ' declared=' + declaredMerged + ' prSha=' + pr.mergeCommitSha,
    );
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

/**
 * Le story (issue #297): il formato e' `status: done`, non `state` + `merged`.
 * Il drift che questo giro intercetta e' quello della Story 2.5: una story
 * mergiata che dichiara ancora `status: in-review`, con l'aggregatore che la
 * conta come non-done e il blocco NEXT-STEP che la indica come «prossima
 * story da implementare».
 */
for (const story of stories) {
  const prRaw = story.fm.pr;
  const prNumber = Number.parseInt(prRaw ?? '', 10);
  if (!Number.isFinite(prNumber) || prNumber <= 0) {
    skipped++;
    continue;
  }
  const pr = pulls.get(prNumber);
  if (!pr) {
    environmentError(
      `PR #${prNumber} (citata da ${story.file}) non trovata nella risposta dell'API: ` +
        'il dato esterno e\' incompleto, il gate non puo\' dichiarare "in sync"',
    );
  }

  compared++;
  checks++;
  const isMerged = pr.mergedAt !== null;
  const status = story.fm.status ?? '';

  if (!isMerged) {
    if (status === STORY_DONE) {
      fail(
        `${story.file}: \`status: done\`, ma la PR #${prNumber} non risulta mergiata ` +
          `(state ${pr.state})`,
      );
    }
    continue;
  }

  if (status !== STORY_DONE) {
    // Stati terminali dichiarati (scope cancellato, dipendenza esterna): il
    // merge della PR non li cancella, non e' drift.
    if (STORY_TERMINAL.has(status)) continue;

    // Caso strutturale (issue #284): l'albero sotto esame e' il merge commit
    // della PR, quindi lo stato non e' ancora applicabile (il writer
    // post-merge non e' passato). Differito, non fallito.
    if (
      deferUnapplied &&
      headSha &&
      pr.mergeCommitSha &&
      pr.mergeCommitSha.toLowerCase() === headSha.toLowerCase()
    ) {
      deferred++;
      console.log(
        `[DEFERRED] ${story.file}: la PR #${prNumber} e' MERGED e l'albero sotto esame ne' e' ` +
          `il merge commit (${headSha.slice(0, 7)}): lo stato viene applicato dal writer ` +
          "post-merge, il confronto e' differito al passaggio successivo.",
      );
      continue;
    }

    fail(
      `${story.file}: la PR #${prNumber} e' MERGED, ma \`status\` e' "${status || '(assente)'}" ` +
        `invece di "${STORY_DONE}" (story completata)`,
    );
    continue;
  }

  const declaredSha = story.fm.merged_commit ?? '';
  if (!shaMatches(declaredSha, pr.mergeCommitSha)) {
    fail(
      `${story.file}: \`merged_commit\` non coincide con il merge commit della PR #${prNumber} ` +
        `(dichiarato: "${declaredSha || '(vuoto)'}", reale: "${pr.mergeCommitSha ?? '(null)'}")`,
    );
    continue;
  }

  const declaredDate = story.fm.merged_date ?? '';
  if (!dateMatches(declaredDate, pr.mergedAt)) {
    fail(
      `${story.file}: \`merged_date\` non coincide con la data di merge della PR #${prNumber} ` +
        `(dichiarato: "${declaredDate || '(vuoto)'}", reale: "${pr.mergedAt}")`,
    );
  }
}

/**
 * DEV-LOG perimeter (issue #324): verifica che le entry del DEV-LOG dichiarino
 * lo stato di merge corretto per le sessioni/PR che referenziano.
 */
const devlogEntries = readDevlogEntries();
const sessionMap = buildSessionMap(sessions);

let devlogCompared = 0;
let devlogSkipped = 0;
let devlogDeferred = 0;

for (const entry of devlogEntries) {
  // Risolvi il numero di PR: prima la riga **PR**:, poi la sessione referenziata
  let prNumber = extractPrFromLine(entry.prLine);
  let matchedBy = 'prLine';
  if (!prNumber && entry.sessionRefs.length > 0) {
    // Usa la prima sessione con un PR valido
    for (const sn of entry.sessionRefs) {
      const s = sessionMap.get(sn);
      if (s && s.fm.pr) {
        const p = Number.parseInt(s.fm.pr, 10);
        if (Number.isFinite(p) && p > 0) {
          prNumber = p;
          matchedBy = `sessione ${sn}`;
          break;
        }
      }
    }
  }
  if (!prNumber) {
    devlogSkipped++;
    continue;
  }

  const pr = pulls.get(prNumber);
  if (!pr) {
    environmentError(
      `PR #${prNumber} (citata da DEV-LOG entry L${entry.line} via ${matchedBy}) non trovata nell'API: ` +
        'dato esterno incompleto, gate fail-closed',
    );
  }

  devlogCompared++;
  checks++;
  const isMerged = pr.mergedAt !== null;
  const markerClass = classifyMarker(entry.stato);

  // R1: MERGED claim -> PR deve essere mergiata + citazione PR+sha
  if (markerClass === 'MERGED') {
    if (!isMerged) {
      fail(
        `DEV-LOG L${entry.line} (${entry.heading}): marker dichiara MERGED ma la PR #${prNumber} non e' mergiata (state: ${pr.state})`,
      );
      continue;
    }
    // Richiesta citazione PR e sha per entry moderne (con sessionRefs)
    if (entry.sessionRefs.length > 0) {
      const { hasPr, hasSha } = checkCitation(entry.stato, prNumber, pr.mergeCommitSha);
      if (!hasPr || !hasSha) {
        fail(
          `DEV-LOG L${entry.line} (${entry.heading}): marker MERGED deve citare \`PR #${prNumber}\` e il merge commit (sha) - trovati: PR=${hasPr}, sha=${hasSha}`,
        );
      }
    }
    // Differimento (issue #284): se l'albero e' il merge commit, lo stato non e' ancora applicabile
    if (
      deferUnapplied &&
      headSha &&
      pr.mergeCommitSha &&
      pr.mergeCommitSha.toLowerCase() === headSha.toLowerCase()
    ) {
      devlogDeferred++;
      console.log(
        `[DEFERRED] DEV-LOG L${entry.line} (${entry.heading}): la PR #${prNumber} e' MERGED e l'albero e' ` +
          `il suo merge commit (${headSha.slice(0, 7)}): confronto differito.`,
      );
      continue;
    }
    continue;
  }

  // R2: WIP claim -> PR NON deve essere mergiata
  if (markerClass === 'WIP') {
    if (isMerged) {
      // Differimento per caso strutturale (stato non ancora applicato dal writer)
      if (
        deferUnapplied &&
        headSha &&
        pr.mergeCommitSha &&
        pr.mergeCommitSha.toLowerCase() === headSha.toLowerCase()
      ) {
        devlogDeferred++;
        console.log(
          `[DEFERRED] DEV-LOG L${entry.line} (${entry.heading}): la PR #${prNumber} e' MERGED e l'albero e' ` +
            `il suo merge commit (${headSha.slice(0, 7)}): confronto differito.`,
        );
      } else {
        fail(
          `DEV-LOG L${entry.line} (${entry.heading}): marker dichiara WIP (${entry.stato}) ma la PR #${prNumber} e' MERGED (merge commit ${pr.mergeCommitSha?.slice(0, 7)})`,
        );
      }
    }
    continue;
  }

  // R3: DONE claim per entry moderne con sessione -> se PR mergiata, deve essere canonico MERGED
  if (markerClass === 'DONE' && entry.sessionRefs.length > 0 && isMerged) {
    fail(
      `DEV-LOG L${entry.line} (${entry.heading}): marker DONE (${entry.stato}) per PR mergiata #${prNumber} - deve essere MERGED canonico con citazione PR e sha`,
    );
    continue;
  }

  // UNKNOWN o DONE per entry legacy / PR non mergiata -> nessun controllo stretto
}

if (failures === 0) {
  ok(
    `stato di merge delle sessioni, story e DEV-LOG in sync con GitHub: ` +
      `${compared} file di stato (sessions+stories) con PR confrontati, ${skipped} senza PR (ignorati)` +
      (deferred > 0 ? `, ${deferred} differiti (stato non ancora applicato dal writer)` : '') +
      `; DEV-LOG: ${devlogCompared} entry confrontate, ${devlogSkipped} senza PR verificabile` +
      (devlogDeferred > 0 ? `, ${devlogDeferred} differite` : ''),
  );
}

console.log('');
console.log(
  `[INFO] check-merge-state: ${checks} confronti, ${failures} falliti` +
    (deferred + devlogDeferred > 0 ? `, ${deferred + devlogDeferred} differiti` : ''),
);
process.exit(failures > 0 ? 1 : 0);
