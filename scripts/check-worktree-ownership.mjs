#!/usr/bin/env node
/**
 * Gate "proprieta' della worktree" (issue #319, ADR-0012 regola 5).
 *
 * ADR-0006 mette il lock sull'*issue* GitHub, non sulla risorsa fisica: la
 * worktree `ls-<N>-<slug>` ha un path DETERMINISTICO, quindi due agenti che
 * puntano alla stessa story finiscono nella stessa cartella. Il claim
 * (riverificato sull'id numerico del commento) arbitra chi *dovrebbe* lavorarci,
 * ma nessun gate verificava chi sta *davvero* scrivendo li'.
 *
 * Consequenza misurata (issue #319): il codice del secondo agente finiva nel
 * commit e nella PR del primo, indistinguibile per la CI — il doppio lavoro
 * era silenzioso e la perdita di attribuzione era irreversibile.
 *
 * Questo gate confronta i due fatti:
 *   - chi possiede la worktree LOCALE (`agent-state.json`, scritto da
 *     `scripts/agent-claim.ps1` al momento del claim);
 *   - chi ha vinto il claim sull'issue (commento `claim:` con l'id numerico
 *     piu' basso fra quelli non ancora rilasciati).
 *
 * Se i due agenti differiscono, il lavoro locale non e' del claimante: e'
 * doppio lavoro.
 *
 * Semantica dell'uscita (fail-closed sul difetto, fail-open sull'ambiente):
 *   0 = coerente (o niente da verificare)
 *   1 = MISMATCH: la worktree non appartiene al claim vincente
 *   2 = errore di ambiente (stato illeggibile, `gh` assente, API irraggiungibile)
 *
 * Il codice 2 NON blocca: un gate che blocca per una disconnessione di rete
 * non e' un gate, e' un ostacolo. Il codice 1 blocca.
 *
 * Uso:
 *   node scripts/check-worktree-ownership.mjs
 *   node scripts/check-worktree-ownership.mjs --state-json s.json --comments-json c.json
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
}

let failures = 0;
const fail = (m) => {
  console.error(`[FAIL] ${m}`);
  failures++;
};
const ok = (m) => console.log(`[OK] ${m}`);
const info = (m) => console.log(`[INFO] ${m}`);
const warn = (m) => console.log(`[WARN] ${m}`);

/** Uscita 2: errore di ambiente (non un difetto del protocollo). */
function envError(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(2);
}

function readJsonFile(path, label) {
  if (!existsSync(path)) envError(`${label}: file non trovato: ${path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    envError(`${label}: JSON non valido in ${path}`);
  }
}

function ghJson(args) {
  let out;
  try {
    out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    envError(`gh ${args.join(' ')}: ${String(err.stderr || err.message).trim()}`);
  }
  try {
    return JSON.parse(out);
  } catch {
    envError('output JSON non valido da gh');
  }
}

/**
 * Agente di un commento di claim: il primo token dopo il marker `claim:`.
 * Il formato e' quello di `scripts/agent-claim.ps1`:
 *   claim: <AGENT-ID> (UTC <timestamp>) -- worktree: <path>
 */
function claimAgent(comment) {
  const m = String(comment.body || '').match(/^\s*claim:\s*(\S+)/);
  return m ? m[1] : '';
}

/**
 * Un claim RILASCIATO non conta: `release:` / `stale-release:` successivi al
 * claim e che ne citano l'agente lo annullano. Stessa semantica di
 * `Test-ClaimReleased` in `scripts/agent-claim.ps1`.
 */
function isReleased(claim, comments) {
  const agent = claimAgent(claim);
  if (!agent) return false;
  return comments.some(
    (c) =>
      /^\s*(release|stale-release)\s*:/.test(String(c.body || '')) &&
      Number(c.id) > Number(claim.id) &&
      String(c.body).includes(agent),
  );
}

/**
 * Claim vincente: quello con l'id numerico piu' basso fra i claim non
 * rilasciati. Il discriminatore e' l'id NUMERICO dell'API REST, non il
 * `node_id` GraphQL e non `created_at` (vedi AGENTS.md, procedura di claim).
 */
function winningClaim(comments) {
  const claims = comments
    .filter((c) => /^\s*claim:/.test(String(c.body || '')))
    .filter((c) => !isReleased(c, comments))
    .sort((a, b) => Number(a.id) - Number(b.id));
  return claims[0] || null;
}

console.log("[INFO] check-worktree-ownership: proprieta' della worktree vs claim vincente");

// --- 1. stato locale della worktree -------------------------------------------
const root = resolve(arg('--root', '.'));
const stateFile = arg('--state-json', '');
let state = null;

if (stateFile) {
  state = readJsonFile(stateFile, 'stato della worktree');
} else {
  let gitDir = '';
  try {
    gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    envError(`git rev-parse --absolute-git-dir: ${String(err.stderr || err.message).trim()}`);
  }
  const candidate = join(gitDir, 'agent-state.json');
  if (!existsSync(candidate)) {
    // La working copy principale (e le worktree create a mano) non hanno
    // stato: non c'e' nessun claim da confrontare.
    info(`nessun agent-state.json in ${gitDir}: niente da verificare`);
    console.log('\n[INFO] check-worktree-ownership: 0 violazioni');
    process.exit(0);
  }
  state = readJsonFile(candidate, 'stato della worktree');
}

const owner = String(state.agent_id || '');
const stateIssue = Number(state.issue || 0);
const stateClaimId = Number(state.claim_id || 0);

if (!owner) envError('agent-state.json senza agent_id: stato illeggibile');
if (!stateIssue) envError('agent-state.json senza issue: stato illeggibile');

info(`worktree: owner ${owner} (issue #${stateIssue}, claim ${stateClaimId || '?'})`);

// --- 2. claim attivo sull'issue ------------------------------------------------
const issueNumber = Number(arg('--issue', String(stateIssue))) || stateIssue;
const commentsFile = arg('--comments-json', '');
const comments = commentsFile
  ? readJsonFile(commentsFile, 'commenti')
  : ghJson(['api', `repos/{owner}/{repo}/issues/${issueNumber}/comments`]);

const winner = winningClaim(comments);
if (!winner) {
  // Nessun claim attivo: la worktree e' orfana (il claimante ha rilasciato).
  // Non e' un difetto: la worktree viene rimossa dalla procedura post-merge.
  warn(`nessun claim attivo sull'issue #${issueNumber}: la worktree e' orfana`);
  console.log('\n[INFO] check-worktree-ownership: 0 violazioni');
  process.exit(0);
}

const winnerAgent = claimAgent(winner);
info(`claim vincente: commento ${winner.id} — agente ${winnerAgent}`);

if (winnerAgent !== owner) {
  fail(
    `la worktree e' di ${owner} ma il claim vincente sull'issue #${issueNumber} e' di ${winnerAgent} (commento ${winner.id}): ` +
      'lavoro locale non attribuito al claimante — doppio lavoro',
  );
} else if (stateClaimId && Number(winner.id) !== stateClaimId) {
  // Stesso agente, claim diverso: il file di stato e' precedente (per esempio
  // un re-claim dopo un rilascio). Non e' un doppio lavoro.
  warn(
    `stesso agente (${owner}) ma il file di stato cita il claim ${stateClaimId} e il vincente e' ${winner.id}: ` +
      'stato precedente, nessun doppio lavoro',
  );
  ok(`worktree di ${owner}: l'agente coincide con il claim vincente`);
} else {
  ok(`worktree di ${owner}: l'agente coincide con il claim vincente (commento ${winner.id})`);
}

console.log(`\n[INFO] check-worktree-ownership: ${failures} violazioni`);
process.exit(failures === 0 ? 0 : 1);
