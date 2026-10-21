// Confronta le label documentate nella tabella "Label disponibili" di AGENTS.md
// con le label effettivamente esistenti su GitHub (gh label list).
// Uso: node scripts/validate-labels.mjs [--owner <owner>] [--repo <repo>]
// Esce con codice 0 se tutte le label documentate esistono su GitHub, 1 altrimenti.
// Serve a impedire che la tabella di AGENTS.md e le label su GitHub divergano
// silenziosamente (vedi issue #110).
//
// L'elenco delle label attese è tratto da AGENTS.md §"Label disponibili".

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const ownerIdx = args.indexOf('--owner');
const owner = ownerIdx >= 0 ? args[ownerIdx + 1] : 'amedeo82';
const repoIdx = args.indexOf('--repo');
const repo = repoIdx >= 0 ? args[repoIdx + 1] : 'Life-Soundtrack';

// Label attese per categoria, come documentato in AGENTS.md.
const expectedByCategory = {
  Fase: ['phase-0', 'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-post'],
  Area: ['area:adapter', 'area:analysis', 'area:db', 'area:devops', 'area:enrichment', 'area:privacy', 'area:ui', 'area:ux'],
  Priorità: ['priority:blocker', 'priority:important', 'priority:later'],
  Size: ['size:S', 'size:M', 'size:L', 'size:XL'],
  Gate: ['agent-ready', 'needs-spec', 'blocked', 'in-progress'],
  'Status (post-claim)': ['status:done', 'status:in-review', 'status:wontdo', 'status:blocked-other'],
  Tipo: ['bug', 'enhancement', 'refactor', 'docs'],
};

const expectedLabels = Object.values(expectedByCategory).flat();

let ghLabels = new Set();
try {
  const out = execFileSync('gh', [
    'label', 'list',
    '--repo', `${owner}/${repo}`,
    '--limit', '200',
    '--json', 'name',
  ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const arr = JSON.parse(out);
  for (const l of arr) ghLabels.add(l.name);
} catch (e) {
  console.error(`[FAIL] Impossibile leggere le label da GitHub: ${e.message}`);
  process.exit(2);
}

const missing = expectedLabels.filter(l => !ghLabels.has(l)).sort();
const byCatMissing = {};
for (const [cat, labels] of Object.entries(expectedByCategory)) {
  const m = labels.filter(l => !ghLabels.has(l));
  if (m.length > 0) byCatMissing[cat] = m;
}

let failures = 0;

if (missing.length > 0) {
  console.error('[FAIL] Label documentate in AGENTS.md ma assenti su GitHub:');
  for (const [cat, labels] of Object.entries(byCatMissing)) {
    console.error(`  [${cat}] ${labels.join(', ')}`);
  }
  failures++;
} else {
  console.log(`[OK] Tutte le ${expectedLabels.length} label documentate in AGENTS.md esistono su GitHub.`);
}

// Label esistenti su GitHub ma non nell'elenco atteso (escluse le label di sistema GitHub
// e quelle documentate altrove, non nella tabella di AGENTS.md).
const systemLabels = new Set(['accessibility', 'good first issue', 'help wanted', 'question', 'wontfix', 'duplicate', 'documentation', 'invalid']);
const extra = [...ghLabels].filter(
  l => !expectedLabels.includes(l) && !systemLabels.has(l) && !l.startsWith('status:')
).sort();

if (extra.length > 0) {
  console.warn('[WARN] Label esistenti su GitHub ma non elencate nella tabella di AGENTS.md:');
  for (const l of extra) console.warn(`  - ${l}`);
} else {
  console.log('[OK] Nessuna label extra su GitHub non elencata in AGENTS.md.');
}

console.log(`\nLabel attese: ${expectedLabels.length} | Label su GitHub: ${ghLabels.size} | Mancanti: ${missing.length} | Extra: ${extra.length}`);
process.exit(failures === 0 ? 0 : 1);
