#!/usr/bin/env node
/**
 * Gate "coerenza claim <-> issue <-> branch <-> PR" (issue #256, ADR-0012 regola 5).
 *
 * ADR-0006 ha 8 regole VINCOLANTI sul claim, ma fino alla Sessione 80 non
 * aveva alcun enforcement: `in-progress`, `claim:` e `status:in-review` non
 * compaiono in alcun gate. Due agenti potevano implementare la stessa story
 * senza che nulla se ne accorgesse — esattamente la race che ADR-0006 dichiara
 * di aver chiuso. La sola difesa era la prosa.
 *
 * Questo gate e' READ-ONLY: non scrive nulla su GitHub.
 *
 * Controlli:
 *   C1  la branch dichiara l'issue (feat|fix/<N>-...) e la keyword di chiusura
 *       e' nuda, unica, e punta a quell'issue
 *   C2  l'issue e' in `status:in-review` (o `in-progress`): la transizione di
 *       stato e' avvenuta
 *   C3  l'issue ha un commento di `claim:` e non e' stata lasciata per un
 *       `yield:` — il protocollo di claim e' verificato, non solo dichiarato
 *   C4  una branch `docs/<slug>` tocca SOLO file sotto `docs/`: un doc-sync
 *       non puo' portare con se' il codice di un altro task (il leak della
 *       PR #250: due script finiti in una PR di doc-sync per un `git add -A`
 *       nella working copy condivisa)
 *   C5  nessuna keyword di chiusura extra (niente occorrenze dentro backtick
 *       o caselle di checklist: GitHub chiude solo le keyword nude)
 *   C6  l'agent-id dichiarato nel body della PR coincide con l'agente del
 *       claim VINCENTE (issue #319): una PR aperta da un agente diverso dal
 *       claimante e' doppio lavoro. Dichiarazione ASSENTE -> WARN, per non
 *       rendere rosse le PR aperte da altri agenti prima di questa regola.
 *
 * Uso: node scripts/check-claim-state.mjs [--pr <N>] [--repo <owner/name>]
 *
 * Exit code: 0 = coerente, 1 = violazione, 2 = errore di ambiente.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

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

function gh(args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    console.error(`[FAIL] gh ${args.join(' ')}: ${String(err.stderr || err.message).trim()}`);
    process.exit(2);
  }
}

function ghJson(args) {
  const out = gh(args);
  try {
    return JSON.parse(out);
  } catch {
    console.error('[FAIL] output JSON non valido da gh');
    process.exit(2);
  }
}

/**
 * Dati del gate: da GitHub (via gh) oppure da file JSON.
 *
 * I file servono ai test: rendono il gate verificabile senza rete e senza
 * dipendere da come il sistema operativo risolve un eseguibile chiamato
 * `gh` (su Windows un mock bash senza estensione non e' eseguibile, e il
 * PATH finirebbe per chiamare il gh vero).
 */
function readJsonFile(path, label) {
  if (!path) return null;
  if (!existsSync(path)) {
    console.error(`[FAIL] ${label}: file non trovato: ${path}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.error(`[FAIL] ${label}: JSON non valido in ${path}`);
    process.exit(2);
  }
}

// --- individuazione della PR -------------------------------------------------
let prNumber = arg('--pr', process.env.PR_NUMBER || '');
if (!prNumber) {
  const ref = process.env.GITHUB_REF || '';
  const m = ref.match(/refs\/pull\/(\d+)\//);
  if (m) prNumber = m[1];
}
if (!prNumber) {
  console.error('[FAIL] numero della PR non determinabile: passare --pr <N>');
  process.exit(2);
}

console.log(`[INFO] check-claim-state: coerenza claim/issue/branch/PR (PR #${prNumber})`);

const prFile = arg('--pr-json', '');
const issueFile = arg('--issue-json', '');
const commentsFile = arg('--comments-json', '');

const pr = prFile
  ? readJsonFile(prFile, 'PR')
  : ghJson(['pr', 'view', String(prNumber), '--json', 'headRefName,body,files,state,number']);
const branch = pr.headRefName || '';
const body = pr.body || '';
const files = (pr.files || []).map((f) => f.path);

info(`branch: ${branch} — ${files.length} file`);

// su una PR chiusa o mergiata lo stato dell'issue e' gia' cambiato
// (status:done): il gate vale per le PR aperte
if (pr.state !== 'OPEN') {
  console.log(
    `[INFO] check-claim-state: PR #${prNumber} e' ${pr.state} — il gate vale per le PR aperte`,
  );
  console.log('\n[INFO] check-claim-state: 0 violazioni');
  process.exit(0);
}

// --- C5: keyword di chiusura -------------------------------------------------
const naked = [...body.matchAll(/(?:^|\n)\s*(Closes|Fixes|Resolves)\s+#(\d+)\s*(?:\n|$)/g)];
const all = [...body.matchAll(/\b(Closes|Fixes|Resolves)\s+#(\d+)/gi)];

// --- C1: branch <-> issue ----------------------------------------------------
let issueNumber = null;
const branchMatch = branch.match(/^(?:feat|fix)\/(\d+)-/);
if (branchMatch) {
  issueNumber = Number(branchMatch[1]);
} else if (!branch.startsWith('docs/')) {
  fail(
    `C1: la branch "${branch}" non e' nel formato richiesto (feat/<N>-... | fix/<N>-... | docs/<slug>)`,
  );
}

if (issueNumber !== null) {
  if (naked.length !== 1) {
    fail(
      `C1: la keyword di chiusura deve comparire UNA volta come riga nuda nella branch ${branch} (trovate ${naked.length})`,
    );
  } else if (Number(naked[0][2]) !== issueNumber) {
    fail(
      `C1: la keyword di chiusura punta a #${naked[0][2]} ma la branch dichiara l'issue #${issueNumber}`,
    );
  } else {
    ok(`C1: branch ${branch} e keyword di chiusura #${issueNumber} coerenti`);
  }
} else if (branch.startsWith('docs/')) {
  info(`C1: branch docs/ — nessun issue da collegare (naked=${naked.length})`);
}

if (all.length !== naked.length) {
  fail(
    `C5: la keyword di chiusura compare ${all.length} volte ma solo ${naked.length} sono nude: le occorrenze dentro backtick o checklist non chiudono l'issue`,
  );
} else {
  ok('C5: nessuna keyword di chiusura extra (naked = totale)');
}

// --- C4: una branch docs/ tocca solo docs/ ----------------------------------
if (branch.startsWith('docs/')) {
  const fuori = files.filter((f) => !f.startsWith('docs/'));
  if (fuori.length) {
    fail(
      `C4: la branch "${branch}" e' un doc-sync ma tocca ${fuori.length} file fuori da docs/: ${fuori.slice(0, 8).join(', ')}${fuori.length > 8 ? ' …' : ''}`,
    );
  } else {
    ok(`C4: branch docs/ — tutti i ${files.length} file sono sotto docs/`);
  }
}

// --- C2/C3: stato dell'issue e claim -----------------------------------------
if (issueNumber !== null) {
  const issue = issueFile
    ? readJsonFile(issueFile, 'issue')
    : ghJson(['issue', 'view', String(issueNumber), '--json', 'state,labels']);
  const labels = (issue.labels || []).map((l) => l.name);
  const inReview = labels.includes('status:in-review');
  const inProgress = labels.includes('in-progress');
  if (issue.state !== 'OPEN') {
    fail(`C2: l'issue #${issueNumber} non e' aperta (stato: ${issue.state})`);
  } else if (!inReview && !inProgress) {
    fail(
      `C2: l'issue #${issueNumber} non e' in 'status:in-review' ne' in 'in-progress' (labels: ${labels.join(', ')})`,
    );
  } else {
    ok(
      `C2: issue #${issueNumber} in stato coerente (${inReview ? 'status:in-review' : 'in-progress'})`,
    );
  }

  // i commenti di claim (API REST: l'id numerico e' il discriminante)
  const comments = commentsFile
    ? readJsonFile(commentsFile, 'comments')
    : ghJson(['api', `repos/{owner}/{repo}/issues/${issueNumber}/comments`]);
  const claimComments = comments.filter((c) => c.body && c.body.startsWith('claim:'));
  const yieldComments = comments.filter((c) => c.body && c.body.startsWith('yield:'));

  if (claimComments.length === 0) {
    fail(
      `C3: l'issue #${issueNumber} non ha nessun commento di claim: — la regola di ADR-0006 ("nessun lavoro senza claim valido") non e' verificabile`,
    );
  } else {
    const winner = claimComments.sort((a, b) => Number(a.id) - Number(b.id))[0];
    const yielded = yieldComments.some((y) => {
      const m = y.body.match(/agente\s+(\S+)/);
      return m && winner.body.includes(m[1]);
    });
    if (yielded) {
      fail(
        `C3: l'agente del claim vincente (commento ${winner.id}) ha postato un yield: — la story non e' stata presa in carico`,
      );
    } else {
      ok(`C3: claim valido (commento ${winner.id}, ${claimComments.length} claim in totale)`);
    }

    // --- C6: l'agent-id dichiarato nel body coincide con il claim vincente ---
    // Il body della PR dichiara l'agente che l'ha aperta (`agent-pr.ps1` lo
    // aggiunge). Se non coincide con il claim vincente, la PR porta lavoro
    // attribuito a un agente diverso: e' doppio lavoro (issue #319).
    const declared = body.match(/agent-id:\s*`?([A-Za-z0-9._-]+)`?/);
    const winnerAgent = (winner.body.match(/^\s*claim:\s*(\S+)/) || [])[1] || '';
    if (!declared) {
      warn(
        `C6: il body della PR non dichiara l'agent-id: non e' verificabile che la PR sia del claim vincente (${winnerAgent || '?'})`,
      );
    } else if (winnerAgent && declared[1] !== winnerAgent) {
      fail(
        `C6: il body dichiara l'agente "${declared[1]}" ma il claim vincente dell'issue #${issueNumber} e' di "${winnerAgent}" (commento ${winner.id}) — doppio lavoro`,
      );
    } else {
      ok(
        `C6: l'agent-id dichiarato (${declared[1]}) coincide con il claim vincente (commento ${winner.id})`,
      );
    }
  }
}

console.log(`\n[INFO] check-claim-state: ${failures} violazioni`);
process.exit(failures === 0 ? 0 : 1);
