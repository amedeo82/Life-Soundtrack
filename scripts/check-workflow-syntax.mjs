#!/usr/bin/env node
/**
 * Gate "sintassi dei blocchi `run:` dei workflow" (issue #279).
 *
 * **Perche' esiste**: uno step GitHub Actions che dichiara `shell: pwsh` ma
 * contiene **sintassi bash** non fallisce al lint: fallisce **a runtime**, con
 * un `ParserError` che arriva dopo il checkout e lascia `main` rotto. E' successo
 * due volte di fila:
 *
 *   - `auto-state-aggregate.yml` -> i blocchi aggregati non venivano piu' committati
 *   - `auto-bundle.yml` -> il bundle non veniva piu' committato
 *
 * Il controllo e' **statico**: ogni blocco `run:` viene estratto con il suo
 * `shell:` effettivo e passato al parser dello shell dichiarato
 * (`pwsh` -> parser di PowerShell; `bash` -> `bash -n`). Le espressioni GitHub
 * `${{ ... }}` sono sostituite con un segnaposto: GitHub le interpola **prima**
 * dell'esecuzione, e il parser non deve giudicarne la sintassi.
 *
 * Uso: node scripts/check-workflow-syntax.mjs [--dir <dir>]
 * Exit code: 0 = sintassi valida, 1 = almeno un blocco non valido,
 *             2 = errore di ambiente (parser non disponibile).
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
}

const DIR = resolve(arg('--dir', '.github/workflows'));
if (!existsSync(DIR)) {
  console.error(`[FAIL] directory dei workflow non trovata: ${DIR}`);
  process.exit(2);
}

/** Le espressioni GitHub sono interpolate prima dell'esecuzione: non le giudichiamo. */
function neutralizeGithubExpressions(text) {
  return text.replace(/\$\{\{[^}]*\}\}/g, '0');
}

/**
 * Estrae gli step con `run:` dal YAML, per via linee: ogni step e' un blocco
 * indentato che inizia con `- name:` (o `- uses:`) e puo' contenere `shell:` e
 * `run: |`.
 */
function extractRunBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const stepMatch = lines[i].match(/^(\s*)- (name:|uses:)/);
    if (!stepMatch) {
      i++;
      continue;
    }
    const stepIndent = stepMatch[1].length;
    const stepStart = i;
    let shell = null;
    let run = null;
    let runLine = null;
    i++;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') {
        i++;
        continue;
      }
      const indent = line.length - line.trimStart().length;
      if (indent <= stepIndent && /^\s*- /.test(line)) break; // step successivo
      const shellMatch = line.match(/^\s*shell:\s*(\S+)\s*$/);
      if (shellMatch) {
        shell = shellMatch[1];
        i++;
        continue;
      }
      if (/^\s*run:\s*\|\s*$/.test(line)) {
        const blockIndent = indent;
        const body = [];
        runLine = i + 1;
        i++;
        while (i < lines.length) {
          const bodyLine = lines[i];
          if (bodyLine.trim() === '') {
            body.push('');
            i++;
            continue;
          }
          const bodyIndent = bodyLine.length - bodyLine.trimStart().length;
          if (bodyIndent <= blockIndent) break;
          body.push(bodyLine.slice(blockIndent + 2));
          i++;
        }
        run = body.join('\n');
        continue;
      }
      i++;
    }
    if (run !== null) {
      blocks.push({ start: stepStart + 1, shell, run });
    }
  }
  return blocks;
}

/** Lo shell di default: su `ubuntu-latest` e' bash; su Windows e' pwsh. */
function defaultShell(runnerOs) {
  return runnerOs === 'windows' ? 'pwsh' : 'bash';
}

function runnerOs(text) {
  const m = text.match(/runs-on:\s*(\S+)/);
  return m ? m[1] : 'ubuntu-latest';
}

/**
 * Su Windows il comando `bash` puo' essere lo stub di WSL, che esce con un
 * messaggio di installazione invece di eseguire lo script. In quel caso il
 * controllo dei blocchi bash viene saltato (la CI, su ubuntu, ha il bash vero).
 */
function bashUsable() {
  try {
    const out = execFileSync('bash', ['--version'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return /GNU bash/i.test(out);
  } catch {
    return false;
  }
}

const BASH_USABLE = bashUsable();
if (!BASH_USABLE) {
  console.log('[SKIP] bash non utilizzabile su questa macchina (stub WSL?): i blocchi "shell: bash" non vengono verificati');
}

let failures = 0;
let checked = 0;
let skipped = 0;

const tmpRoot = mkdtempSync(join(tmpdir(), 'ls-wf-syntax-'));

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.yml'))) {
  const text = readFileSync(join(DIR, file), 'utf8');
  const os = runnerOs(text);
  for (const block of extractRunBlocks(text)) {
    const shell = block.shell ?? defaultShell(os);
    const script = neutralizeGithubExpressions(block.run);
    const tmpFile = join(tmpRoot, `${file.replace(/[^a-z0-9]/gi, '_')}-${block.start}.${shell === 'pwsh' ? 'ps1' : 'sh'}`);
    writeFileSync(tmpFile, script, 'utf8');

    try {
      if (shell === 'pwsh') {
        execFileSync(
          'pwsh',
          [
            '-NoProfile',
            '-Command',
            `$errors = $null; [System.Management.Automation.Language.Parser]::ParseFile('${tmpFile.replace(/'/g, "''")}', [ref]$null, [ref]$errors) | Out-Null; if ($errors -and $errors.Count -gt 0) { $errors | ForEach-Object { $_.Message }; exit 1 } else { exit 0 }`,
          ],
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
        );
        checked++;
      } else {
        if (!BASH_USABLE) {
          skipped++;
          continue;
        }
        execFileSync('bash', ['-n', tmpFile], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        checked++;
      }
    } catch (err) {
      // Se l'interprete non c'e' (bash assente su un dev Windows), non e' un errore
      // del file: si salta e lo si dichiara.
      const message = String(err.stdout || err.stderr || err.message || '').trim();
      if (err.code === 'ENOENT') {
        skipped++;
        console.log(`[SKIP] ${file}:${block.start} — interprete "${shell}" non disponibile`);
        continue;
      }
      failures++;
      console.error(`[FAIL] ${file}:${block.start} — blocco "run:" con shell "${shell}" non valido:`);
      for (const line of message.split('\n').slice(0, 6)) console.error(`       ${line}`);
    }
  }
}

console.log('');
if (failures > 0) {
  console.log(`[INFO] check-workflow-syntax: ${checked} blocchi verificati, ${failures} non validi, ${skipped} saltati`);
  process.exit(1);
}
console.log(`[OK] check-workflow-syntax: ${checked} blocchi verificati, 0 non validi${skipped > 0 ? `, ${skipped} saltati` : ''}`);
process.exit(0);
