#!/usr/bin/env node
/**
 * Gate "encoding dei file tracciati" (issue #277).
 *
 * **Perche' esiste**: Windows PowerShell 5.1 decodifica i file con la **code
 * page ANSI** quando `Get-Content` non ha `-Encoding`, e li riscrive **con il
 * BOM** quando `Set-Content -Encoding UTF8`. Un file con accenti, em-dash o
 * emoji diventa illegibile senza che nessun comando fallisca:
 *
 *     à  ->  "Ã " (U+00C3 + NBSP)      —  ->  "â€”"
 *     €  ->  "â‚¬"                  ✅ ->  "ðŸ˜€"
 *
 * Il danno e' silenzioso: il file si apre, il diff e' plausibile, e il
 * contenuto arriva in `main`. Nella Sessione 85 due file di sessione sono
 * stati riscritti cosi' (40+ punti corrotti ciascuno) e il rilevamento e'
 * avvenuto per caso, cercando la sequenza `Ã|â€|Â`.
 *
 * **Cosa controlla**:
 *   1. **BOM UTF-8** in testa al file (lo aggiunge `Set-Content -Encoding UTF8` di 5.1)
 *   2. **UTF-8 non valido** (byte sciolti, file troncato)
 *   3. **mojibake**: doppia codifica UTF-8 -> cp1252, riconosciuta dalla coppia
 *      carattere-guida + carattere di continuazione cp1252
 *
 * **Cosa NON fa**: non decide cosa sia "giusto": segnala. Il `--fix` ripara
 * solo i casi in cui l'inversione e' **inequivocabile** (il testo rovesciato e'
 * UTF-8 valido e non contiene piu' firme) e non tocca mai i file che non
 * riesce a riparare: li lascia segnalati.
 *
 * Uso:
 *   node scripts/check-encoding.mjs                 # tutto il repository (working tree)
 *   node scripts/check-encoding.mjs --staged        # solo i file staged (pre-commit)
 *   node scripts/check-encoding.mjs --fix           # ripara dove possibile
 *
 * Exit code: 0 = pulito, 1 = drift (mojibake / BOM / UTF-8 non valido),
 *             2 = errore di ambiente (nessun repository git, file illeggibile).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
}

const ROOT = resolve(arg('--root', '.'));
const STAGED = argv.includes('--staged');
const FIX = argv.includes('--fix');
const ALLOWLIST_FILE = join(ROOT, 'scripts', 'encoding-allowlist.txt');

/**
 * La tabella cp1252 (0x80-0x9F): i byte che il decoder ANSI di Windows
 * mappa su caratteri Unicode. Serve in due direzioni: per riconoscere il
 * mojibake e per invertirlo.
 */
const CP1252_HIGH = {
  0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026',
  0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02C6', 0x89: '\u2030', 0x8A: '\u0160',
  0x8B: '\u2039', 0x8C: '\u0152', 0x8E: '\u017D', 0x91: '\u2018', 0x92: '\u2019',
  0x93: '\u201C', 0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A', 0x9C: '\u0153',
  0x9E: '\u017E', 0x9F: '\u0178',
};
const CP1252_REVERSE = new Map(
  Object.entries(CP1252_HIGH).map(([byte, char]) => [char, Number(byte)]),
);

/** I caratteri cp1252 "alto" (0x80-0x9F), espressi come classe di caratteri. */
const HIGH_CLASS =
  '\\u0080-\\u00bf' +
  '\\u0152\\u0153\\u0160\\u0161\\u0178\\u017d\\u017e\\u0192' +
  '\\u02c6\\u02dc\\u20ac' +
  '\\u2013\\u2014\\u2018\\u2019\\u201a\\u201c\\u201d\\u201e' +
  '\\u2020\\u2021\\u2022\\u2026\\u2030\\u2039\\u203a\\u2122';

/**
 * Il mojibake e' una coppia: un carattere-guida (quello che la doppia
 * codifica produce dal primo byte di una sequenza UTF-8) seguito da un
 * carattere di continuazione. La coppia e' il segnale: un carattere-guida
 * isolato ("Ã") puo' essere legittimo (un nome proprio), ma "Ã©" o "â€”"
 * non lo sono mai.
 */
const MOJIBAKE_SOURCE = '[\\u00c2-\\u00c5\\u00d0\\u00d1\\u00e2\\u00ef\\u00f0][' + HIGH_CLASS + ']';

function mojibakeMatches(text) {
  const re = new RegExp(MOJIBAKE_SOURCE, 'g');
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const line = text.slice(0, m.index).split('\n').length;
    out.push({ index: m.index, text: m[0], line });
  }
  return out;
}

function hasMojibake(text) {
  return new RegExp(MOJIBAKE_SOURCE).test(text);
}

/** Inverte la doppia codifica su un testo; null se non e' reversibile. */
function tryReverse(text) {
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (CP1252_REVERSE.has(char)) {
      bytes.push(CP1252_REVERSE.get(char));
      continue;
    }
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }
    return null; // carattere non rappresentabile in cp1252: inversione impossibile
  }
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
    return decoded.replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

/**
 * Ripara un testo: prima sul file intero, poi riga per riga (per i file
 * solo parzialmente corrotti). Ritorna null se niente e' riparabile.
 */
function repair(text) {
  const whole = tryReverse(text);
  if (whole && !hasMojibake(whole)) return whole;

  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  let changed = false;
  const fixed = text.split(/\r?\n/).map((line) => {
    if (!hasMojibake(line)) return line;
    const reversed = tryReverse(line);
    if (reversed && !hasMojibake(reversed)) {
      changed = true;
      return reversed;
    }
    return line;
  });
  return changed ? fixed.join(eol) : null;
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.pdf', '.zip', '.gz', '.7z',
  '.mp3', '.wav', '.ogg', '.m4a', '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.sqlite', '.db', '.mmdb', '.exe', '.dll', '.so', '.dylib', '.wasm',
]);

function git(args, encoding) {
  return execFileSync('git', args, { cwd: ROOT, encoding: encoding ?? 'buffer' });
}

function listFiles() {
  const args = STAGED
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z']
    : ['ls-files', '-z'];
  return git(args).toString('utf8').split('\0').filter(Boolean);
}

function readContent(file) {
  if (STAGED) return git(['show', `:${file}`]);
  return readFileSync(join(ROOT, file));
}

function readAllowlist() {
  if (!existsSync(ALLOWLIST_FILE)) return new Set();
  const allowed = new Set();
  for (const line of readFileSync(ALLOWLIST_FILE, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    allowed.add(trimmed.split('#')[0].trim());
  }
  return allowed;
}

const utf8Strict = new TextDecoder('utf-8', { fatal: true });

function inspect(file, buffer) {
  const findings = [];
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    findings.push({ kind: 'bom', detail: 'BOM UTF-8 (EF BB BF) in testa al file' });
  }
  let text;
  try {
    text = utf8Strict.decode(buffer.subarray(buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? 3 : 0));
  } catch {
    findings.push({ kind: 'invalid-utf8', detail: 'byte non validi: il file non e\' UTF-8 valido' });
    return { findings, text: null };
  }
  const matches = mojibakeMatches(text);
  if (matches.length > 0) {
    const preview = [...new Set(matches.map((m) => m.text))].slice(0, 4).join(' ');
    findings.push({
      kind: 'mojibake',
      detail: `${matches.length} occorrenza/e di doppia codifica (righe ${[...new Set(matches.map((m) => m.line))].slice(0, 6).join(', ')}) — es. ${preview}`,
    });
  }
  return { findings, text };
}

function main() {
  let files;
  try {
    files = listFiles();
  } catch (err) {
    console.error(`[FAIL] impossibile elencare i file tracciati: ${String(err.message || err)}`);
    process.exit(2);
  }

  const allowlist = readAllowlist();
  let errors = 0;
  let warnings = 0;
  let fixed = 0;

  for (const file of files) {
    if (BINARY_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    let buffer;
    try {
      buffer = readContent(file);
    } catch (err) {
      console.error(`[FAIL] ${file}: illeggibile (${String(err.message || err)})`);
      errors++;
      continue;
    }
    if (buffer.length === 0) continue;
    // controllo rapido: i binari senza estensione nota
    if (buffer.subarray(0, 8000).includes(0)) continue;

    const { findings, text } = inspect(file, buffer);
    if (findings.length === 0) continue;

    const allowed = allowlist.has(file);
    const tag = allowed ? '[WARN]' : '[FAIL]';

    for (const finding of findings) {
      console.log(`${tag} ${file}: ${finding.detail}`);
    }

    if (!FIX || allowed || text === null) {
      if (allowed) warnings++;
      else errors++;
      continue;
    }

    const repaired = repair(text);
    if (repaired === null) {
      errors++;
      console.log(`[WARN] ${file}: non riparabile automaticamente (inversione non inequivocabile): correggi a mano`);
      continue;
    }
    const stillBad = mojibakeMatches(repaired);
    if (stillBad.length > 0) {
      errors++;
      console.log(`[WARN] ${file}: riparazione incompleta (${stillBad.length} occorrenza/e residue): correggi a mano`);
      continue;
    }
    if (STAGED) {
      errors++;
      console.log(`[WARN] ${file}: --fix non puo' scrivere sui file staged: correggi il file nella working copy e ri-staga`);
      continue;
    }
    writeFileSync(join(ROOT, file), repaired, 'utf8');
    fixed++;
    console.log(`[ok] ${file}: riparato (doppia codifica invertita, BOM rimosso)`);
  }

  console.log('');
  if (fixed > 0) {
    console.log(`[INFO] check-encoding: ${fixed} file riparati`);
  }
  if (errors === 0 && warnings === 0) {
    console.log(`[OK] check-encoding: ${files.length} file esaminati, 0 problemi`);
    process.exit(0);
  }
  console.log(
    `[INFO] check-encoding: ${files.length} file esaminati, ${errors} con errori, ${warnings} in allowlist`,
  );
  process.exit(errors > 0 ? 1 : 0);
}

main();
