// Estrae i blocchi `script:` dai workflow e li syntax-checka con node.
// Verifica anche che le scope dichiarate in `permissions:` siano valide (issue #135).
// Uso: node scripts/validate-workflows.mjs [dir]
// Serve a catturare errori JS nei workflow github-script prima del push,
// dato che non esiste un runner GitHub Actions locale.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const dir = process.argv[2] || '.github/workflows';
let failures = 0;
let checked = 0;
let permissionBlocks = 0;
let permissionScopes = 0;

// === Issue #135 — le scope di `permissions:` devono essere dichiarabili ===
//
// Elenco preso da "Workflow syntax for GitHub Actions" -> permissions.
// `metadata` e' volutamente assente: e' sempre attiva e non dichiarabile.
const PERMISSION_SCOPES = [
  'actions', 'artifact-metadata', 'attestations', 'checks', 'code-quality',
  'contents', 'deployments', 'discussions', 'id-token', 'issues', 'models',
  'packages', 'pages', 'pull-requests', 'security-events', 'statuses',
  'vulnerability-alerts',
];
const PERMISSION_SCOPE_SET = new Set(PERMISSION_SCOPES);
const PERMISSION_VALUES = new Set(['read', 'write', 'none']);
// Scope con dominio ristretto (docs: `id-token: write|none`).
const PERMISSION_RESTRICTED = new Map([['id-token', new Set(['write', 'none'])]]);
// Forme compatte ammesse al posto di un blocco mapping.
const PERMISSION_SHORTHANDS = new Set(['{}', 'read-all', 'write-all']);

for (const file of readdirSync(dir).filter(f => f.endsWith('.yml'))) {
  const full = join(dir, file);
  const text = readFileSync(full, 'utf8');

  // Tab usati per l'indentazione sono illegali in YAML.
  const tabLine = text.split('\n').findIndex(l => /^\s*\t/.test(l)) + 1;
  if (tabLine > 0) {
    console.error(`[FAIL] ${file}: tab nell'indentazione alla riga ${tabLine}`);
    failures++;
  }

  // Estrae i blocchi scalari `script: |` e ne verifica la sintassi JS.
  const lines = text.split('\n');

  // Issue #135: le scope dichiarate in `permissions:` devono essere reali.
  failures += checkPermissionScopes(lines, file);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)script:\s*\|\s*$/);
    if (!m) continue;
    const baseIndent = m[1].length;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '') { body.push(''); continue; }
      const indent = line.match(/^\s*/)[0].length;
      if (indent <= baseIndent) break;   // uscita dal blocco scalare
      body.push(line.slice(baseIndent + 2));
    }
    // github-script avvolge il codice in una arrow function async, quindi
    // `return` a livello top-level e' legale. Emuliamo lo stesso wrapper,
    // altrimenti lo syntax-check produce falsi positivi.
    const js = body.join('\n');
    const wrapped = [
      '// github-script wrapper (emulato)',
      'async function __githubScript({ github, context, core, io, exec, glob, require }) {',
      js,
      '}',
      'export default __githubScript;',
    ].join('\n');
    checked++;
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tmp = join(tmpdir(), `wf-check-${file}-${i}.mjs`);
    writeFileSync(tmp, wrapped, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
      console.log(`[OK] ${file}: blocco script alla riga ${i + 1} (${js.split('\n').length} righe JS) sintatticamente valido`);
    } catch (e) {
      console.error(`[FAIL] ${file}: script alla riga ${i + 1} non valido:\n${e.stderr?.toString() || e.message}`);
      failures++;
    } finally {
      try { unlinkSync(tmp); } catch { /* noop */ }
    }
  }
}

// === Issue #136 — la riga `git add` deve coprire TUTTI i `$targets` ===
//
// L'elenco dei path staged dal workflow e l'array `$targets` dell'aggregator
// descrivono lo stesso insieme di file, ma tenuti in due posti diversi senza
// nessun check che li confronti. Issue #127 (ADR-0008 V3) ha aggiunto README.md
// come quinto target senza aggiornare la riga `git add`: il blocco NEXT-STEP
// veniva generato ad ogni push su `main` e poi scartato, e il drift restava
// invisibile finche' il fallback generato coincideva per caso col testo in file.
// Questo assert e' la difesa di seconda linea che mancava.
const GIT_ADD_BINDINGS = [
  { workflow: 'auto-state-aggregate.yml', script: 'scripts/aggregate-state.ps1' },
];

// Estrae i path dall'array `$targets = @( @{ Path = "..." ... } )` del Powershell.
function extractAggregatorTargets(psText) {
  const start = psText.indexOf('$targets = @(');
  if (start < 0) return null;
  const end = psText.indexOf('\n)', start);
  if (end < 0) return null;
  const block = psText.slice(start, end);
  const paths = [];
  for (const m of block.matchAll(/Path\s*=\s*"([^"]+)"/g)) paths.push(m[1]);
  return [...new Set(paths)];
}

// Estrae i path dalla riga `git add ...` del workflow (una sola per file).
function extractGitAddPaths(text) {
  for (const raw of text.split('\n')) {
    const cleaned = raw.replace(/\s*2>&1\s*\|\s*Out-Null\s*$/, '').replace(/\s*2>&1\s*$/, '');
    const m = cleaned.match(/^\s*git add\s+(.+?)\s*$/);
    if (!m) continue;
    return m[1].split(/\s+/).filter(t => t && !t.startsWith('-'));
  }
  return null;
}

// Un target e' coperto se compare letteralmente nella lista, oppure se e' sotto
// una directory staged (es. `docs/state/` copre `docs/state/stories/x.md`) o
// sotto la radice (`.` copre tutto).
function isStaged(target, staged) {
  if (staged.includes(target)) return true;
  return staged.some(p => p === '.' || p === './' || (p.endsWith('/') && target.startsWith(p)));
}

const repoRoot = resolve(dir, '..', '..');
const aggregatorRoot = resolve(repoRoot, 'scripts');

if (existsSync(aggregatorRoot)) {
  for (const { workflow, script } of GIT_ADD_BINDINGS) {
    const wfPath = join(dir, workflow);
    if (!existsSync(wfPath)) {
      console.error(`[FAIL] ${workflow}: assente, impossibile verificare la copertura \`git add\``);
      failures++;
      continue;
    }
    const scriptPath = join(repoRoot, script);
    if (!existsSync(scriptPath)) {
      console.error(`[FAIL] ${workflow}: ${script} non trovato, la copertura \`git add\` non e' verificabile`);
      failures++;
      continue;
    }
    const targets = extractAggregatorTargets(readFileSync(scriptPath, 'utf8'));
    const staged = extractGitAddPaths(readFileSync(wfPath, 'utf8'));
    if (!targets || targets.length === 0) {
      console.error(`[FAIL] ${workflow}: nessun target estratto da $targets in ${script} (la forma dell'array e' cambiata?)`);
      failures++;
      continue;
    }
    if (!staged) {
      console.error(`[FAIL] ${workflow}: nessuna riga \`git add\` trovata, i target dell'aggregator non verrebbero committati`);
      failures++;
      continue;
    }
    const missing = targets.filter(t => !isStaged(t, staged));
    if (missing.length > 0) {
      console.error(`[FAIL] ${workflow}: la riga \`git add\` NON copre ${missing.length}/${targets.length} $targets di ${script}:`);
      for (const t of missing) console.error(`         mancante: ${t} (generato dal blocco aggregato, mai committato)`);
      failures++;
    } else {
      console.log(`[OK] ${workflow}: la riga \`git add\` copre tutti i ${targets.length} $targets di ${script}`);
    }
  }
}

// === Issue #135 — le scope di `permissions:` devono essere dichiarabili ===
//
// Una scope inesistente dentro `permissions:` non produce un job che fallisce:
// produce un workflow che GitHub **rifiuta in fase di validazione**. La run
// viene creata, `jobs: []`, `conclusion: failure`, `run_started_at == created_at`
// (0s), e il banner e' "This run likely failed because of a workflow file issue".
//
// Il caso reale e' `metadata: read` (commit 43d982d, issue #120): `metadata` non
// e' fra le scope documentate della GITHUB_TOKEN, e' sempre concessa
// implicitamente e **non e' dichiarabile**. Dal 2026-10-21T16:21Z questo ha
// spento tutti i gate di `ci.yml` su ogni push e su ogni pull_request.
//
// Perche' nessun controllo esistente lo vedeva:
//   - `js-yaml` (e qualunque parser YAML) accetta `metadata: read` senza errore:
//     la chiave e' sintatticamente lecita, e' la *schema* GitHub a rifiutarla;
//   - l'API REST `/actions/workflows` continua a rispondere `state=active`;
//   - la check-suite esiste e finisce `completed`/`failure`, ma con 0 check-run.
//
// Nota il contrasto con `validate-labels.mjs` (#110): quel fallimento e' un job
// reale che esce 2. Qui non c'e' nessun job, nessun log, nessuna annotazione via
// API. Il sintomo — 43 run consecutivi a 0s — era indistinguibile da "Actions
// rotta per billing", motivo per cui l'ipotesi della quota (issue #135) e' stata
// formulata e poi esclusa: gli altri 5 workflow dello stesso repo, sugli stessi
// runner e nella stessa finestra, andavano verdi.

function checkPermissionScopes(lines, file) {
  let bad = 0;
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(/^(\s*)permissions:\s*(.*?)\s*(?:#.*)?$/);
    if (!head) continue;
    const baseIndent = head[1].length;
    const inline = head[2];
    permissionBlocks++;

    if (inline !== '') {
      if (!PERMISSION_SHORTHANDS.has(inline)) {
        console.error(`[FAIL] ${file}:${i + 1}: \`permissions: ${inline}\` non e' una forma ammessa (usa un blocco scope, \`{}\`, \`read-all\` o \`write-all\`)`);
        bad++;
      }
      continue;
    }

    let entries = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j];
      const trimmed = raw.trim();
      // Commenti e righe vuote non chiudono il blocco: in questo repo le
      // separazioni fra step sono commenti a colonna 0 (vedi ci.yml riga 57+).
      if (trimmed === '' || trimmed.startsWith('#')) continue;
      if (raw.match(/^\s*/)[0].length <= baseIndent) break;
      const entry = raw.match(/^\s*([A-Za-z0-9_-]+):\s*(\S+)\s*(?:#.*)?$/);
      if (!entry) break;   // forma non `scope: valore` (flow mapping): niente da validare
      const [, scope, value] = entry;
      entries++;
      if (!PERMISSION_SCOPE_SET.has(scope)) {
        console.error(`[FAIL] ${file}:${j + 1}: scope \`${scope}\` non valida in \`permissions:\` — GitHub rifiuta l'intero workflow (\`Unexpected value '${scope}'\`), la run viene creata con 0 job e fallisce a 0s su ogni trigger.`);
        console.error(`         scope valide: ${PERMISSION_SCOPES.join(', ')}`);
        bad++;
        continue;
      }
      const allowed = PERMISSION_RESTRICTED.get(scope) || PERMISSION_VALUES;
      if (!allowed.has(value)) {
        console.error(`[FAIL] ${file}:${j + 1}: scope \`${scope}\` accetta solo ${[...allowed].join('|')}, trovato \`${value || '(vuoto)'}\``);
        bad++;
      }
    }
    if (entries > 0) {
      permissionScopes += entries;
      console.log(`[OK] ${file}:${i + 1}: blocco \`permissions:\` con ${entries} scope valide`);
    }
  }
  return bad;
}

console.log(`\nWorkflow: ${checked} blocchi script verificati, ${permissionScopes} scope permissions verificate in ${permissionBlocks} blocchi, ${failures} fallimenti.`);
process.exit(failures === 0 ? 0 : 1);