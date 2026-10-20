// Estrae i blocchi `script:` dai workflow e li syntax-checka con node.
// Uso: node scripts/validate-workflows.mjs [dir]
// Serve a catturare errori JS nei workflow github-script prima del push,
// dato che non esiste un runner GitHub Actions locale.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

console.log(`\nWorkflow: ${checked} blocchi script verificati, ${failures} fallimenti.`);
process.exit(failures === 0 ? 0 : 1);