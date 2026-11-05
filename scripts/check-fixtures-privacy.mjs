#!/usr/bin/env node
/**
 * Gate "privacy dei fixture" (issue #309, regola L2 di docs/09-PRIVACY-SECURITY.md §10.1).
 *
 * §10.1 dichiara la regola piu' importante del progetto:
 *
 *   > Regola d'oro per il repo: Mai committare dati reali di ascolto nel repository.
 *
 * Fino a questa PR quella regola era **solo prosa**: nessun gate la verificava. Il
 * threat model T5 ("Repo pubblico espone dati reali") ha come mitigazione dichiarata
 * "Fixture SOLO sintetici; policy: mai commit di dati reali" — ma una policy non
 * verificata da una macchina e' un consiglio (ADR-0012, contratto regola <-> gate).
 *
 * Con il repository PUBBLICO la regola smette di essere un'opzione: ogni file
 * tracciato diventa scaricabile da chiunque, e la finestra per committare per
 * sbaglio un export reale di Spotify/Last.fm non e' piu' chiusa dal perimetro del
 * repo privato.
 *
 * Questo gate scansiona i fixture alla ricerca di marker di DATI REALI:
 *
 *   1. **IPv4 routable non-documentazione**: un IP pubblico assegnato a un ISP
 *      reale (es. 92.40.100.50) puo' identificare una persona. I range
 *      documentazione RFC 5737 (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) e
 *      i range privati/riservati sono gli unici ammessi.
 *   2. **Email non-placeholder**: un indirizzo reale (es. mario.rossi@gmail.com)
 *      e' PII diretta. Sono ammessi i domini di test riservati (example.com,
 *      example.org, example.net, example.edu), `.invalid`, `.test`, `.localhost`,
 *      `localhost` e gli indirizzi `*.noreply.github.com`.
 *   3. **Path utente assoluti**: un percorso tipo `C:\Users\mario.rossi\...` o
 *      `/home/mario.rossi/...` rivela il nome utente della macchina di chi ha
 *      generato il fixture.
 *
 * Il gate e' **READ-ONLY**: non scrive, non modifica, non cancella nulla. E'
 * fail-closed: se non riesce a ispezionare i fixture, esce 2 (errore di ambiente)
 * invece di 0. Un gate che "non trova niente perche' non ha guardato" e' un gate
 * che non e' un gate.
 *
 * Uso: node scripts/check-fixtures-privacy.mjs [--dir <path>] [--quiet]
 *
 * Exit code: 0 = nessun dato reale, 1 = dati reali rilevati, 2 = errore di ambiente.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
}

const quiet = argv.includes('--quiet');

/** Radice del repository: due livelli sopra `scripts/`. */
const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const targetDir = arg('--dir', join(repoRoot, 'fixtures'));

/**
 * Estensioni ispezionate. I fixture sono JSON/CSV/JSONL: sono dati, non codice.
 * `.png` e gli altri binari non contengono marker di PII in forma testuale.
 */
const TEXT_EXTENSIONS = new Set(['.json', '.jsonl', '.csv', '.txt', '.md']);

/** Directory escludute dalla scansione (build, cache, node_modules). */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out']);

/**
 * Range IPv4 ammessi nei fixture.
 *
 * - `0.0.0.0/8`      "this network" (RFC 1122)
 * - `10/8`, `172.16/12`, `192.168/16`  privati (RFC 1918)
 * - `127/8`          loopback (RFC 1122)
 * - `169.254/16`     link-local (RFC 3927)
 * - `100.64/10`      CGNAT (RFC 6598)
 * - `192.0.0/24`, `192.0.2/24`, `198.18/15`, `198.51.100/24`, `203.0.113/24`
 *                   documentazione/riservati (RFC 5737, RFC 2544, RFC 6890)
 * - `224/4`, `240/4` multicast/riservati (RFC 5771)
 */
const ALLOWED_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.0\.[02]\./,
  /^192\.0\.2\./,
  /^192\.168\./,
  /^198\.(1[89]|51\.100)\./,
  /^203\.0\.113\./,
  /^22[4-9]\./,
  /^2[3-9]\d\./,
  /^24\d\./,
  /^25[0-5]\./,
];

const IPV4_RE = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

/** Domini email ammessi: riservati per test o non-routable. */
const ALLOWED_EMAIL_DOMAINS = [
  /^example\.(com|org|net|edu)$/i,
  /^.*\.example$/i,
  /^example$/i,
  /^invalid$/i,
  /^test$/i,
  /^localhost$/i,
  /^.*\.invalid$/i,
  /^.*\.test$/i,
  /^.*\.localhost$/i,
  /^.*\.noreply\.github\.com$/i,
];

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)\b/g;

/**
 * Path che rivelano il nome utente della macchina.
 * Windows: `C:\Users\<utente>\...`; POSIX: `/home/<utente>/...`, `/Users/<utente>/...`.
 */
const WINDOWS_USER_PATH_RE = /[A-Za-z]:\\Users\\([^\\\s"']+)/g;
const POSIX_USER_PATH_RE = /\/(?:home|Users)\/([^/\s"']+)/g;

/**
 * Nomi utente placeholder ammessi nei path.
 *
 * Un percorso con un nome utente generico (`testuser`, `runner`, `user`) non
 * identifica nessuno: e' il pattern dei runner CI e della documentazione.
 * Un percorso con un nome vero (`mario.rossi`) e' PII e va respinto.
 */
const PLACEHOLDER_USERS = new Set([
  '*',
  'example',
  'exampleuser',
  'runner',
  'test',
  'tester',
  'testuser',
  'user',
  'username',
]);

const findings = [];
let scannedFiles = 0;

function addFinding(file, line, kind, detail) {
  findings.push({ file, line, kind, detail });
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function checkIpv4(relPath, text) {
  IPV4_RE.lastIndex = 0;
  let m;
  while ((m = IPV4_RE.exec(text)) !== null) {
    const ip = m[0];
    const parts = ip.split('.').map(Number);
    const validOctets = parts.every((p) => p >= 0 && p <= 255);
    if (!validOctets) {
      addFinding(relPath, lineOf(text, m.index), 'ipv4-malformato', ip);
      continue;
    }
    if (!ALLOWED_IPV4.some((re) => re.test(ip))) {
      addFinding(
        relPath,
        lineOf(text, m.index),
        'ipv4-routable',
        `${ip} (IP pubblico assegnato: usare un range documentazione RFC 5737, es. 192.0.2.x)`,
      );
    }
  }
}

function checkEmails(relPath, text) {
  EMAIL_RE.lastIndex = 0;
  let m;
  while ((m = EMAIL_RE.exec(text)) !== null) {
    const domain = m[1];
    if (!ALLOWED_EMAIL_DOMAINS.some((re) => re.test(domain))) {
      addFinding(
        relPath,
        lineOf(text, m.index),
        'email-reale',
        `${m[0]} (dominio non riservato: usare @example.com o @example.test)`,
      );
    }
  }
}

function checkUserPaths(relPath, text) {
  for (const re of [WINDOWS_USER_PATH_RE, POSIX_USER_PATH_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const user = m[1];
      // `C:\Users\<utente>` senza nome utente non e' un path
      if (!user || PLACEHOLDER_USERS.has(user.toLowerCase())) continue;
      addFinding(
        relPath,
        lineOf(text, m.index),
        'user-path',
        `${m[0]} (path che rivela il nome utente della macchina)`,
      );
    }
  }
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`[FAIL] impossibile leggere ${dir}: ${err.message}`);
    process.exit(2);
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

// --- esecuzione ---------------------------------------------------------------

if (!existsSync(targetDir)) {
  console.error(`[FAIL] directory dei fixture non trovata: ${targetDir}`);
  process.exit(2);
}

try {
  statSync(targetDir);
} catch (err) {
  console.error(`[FAIL] directory dei fixture non accessibile: ${err.message}`);
  process.exit(2);
}

for (const file of walk(targetDir)) {
  const ext = file.slice(file.lastIndexOf('.'));
  if (!TEXT_EXTENSIONS.has(ext.toLowerCase())) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`[FAIL] impossibile leggere ${file}: ${err.message}`);
    process.exit(2);
  }
  scannedFiles++;
  const relPath = relative(repoRoot, file).split(sep).join('/');
  checkIpv4(relPath, text);
  checkEmails(relPath, text);
  checkUserPaths(relPath, text);
}

if (scannedFiles === 0) {
  console.error('[FAIL] nessun file di testo ispezionato: il gate non puo\' dichiarare "pulito"');
  process.exit(2);
}

if (findings.length > 0) {
  console.error(
    '[FAIL] Dati reali rilevati nei fixture (regola: mai committare dati reali di ascolto)',
  );
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} [${f.kind}] ${f.detail}`);
  }
  console.error('');
  console.error(`  ${findings.length} finding(s) in ${scannedFiles} file ispezionati.`);
  console.error('  I fixture devono contenere esclusivamente dati sintetici.');
  process.exit(1);
}

if (!quiet) {
  console.log(`[OK] privacy dei fixture: ${scannedFiles} file ispezionati, nessun dato reale`);
}
process.exit(0);
