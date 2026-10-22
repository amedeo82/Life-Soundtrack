// Estrae i blocchi `script:` dai workflow e li syntax-checka con node.
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

console.log(`\nWorkflow: ${checked} blocchi script verificati, ${failures} fallimenti.`);
process.exit(failures === 0 ? 0 : 1);