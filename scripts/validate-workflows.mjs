// Estrae i blocchi `script:` dai workflow e li syntax-checka con node.
// Verifica anche che le scope dichiarate in `permissions:` siano valide (issue #135)
// e che i trigger `paths:` coprano tutti gli input dei blocchi aggregati (issue #216).
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
let pushers = 0;

// === Issue #283 - nessuna action su Node 20 nei workflow ===
//
// Node 20 e' stato rimosso dai runner GitHub il 2026-09-23 (changelog
// GitHub del 2025-09-19, aggiornato il 2026-08-25): le action che dichiarano
// `using: 'node20'` non girano piu' su un runtime supportato. Il runner le
// forza su Node 24, ma il runtime dichiarato resta fuori supporto.
//
// La mappa elenca, per ogni action di terze parti usata dal repository, la
// PRIMA major che dichiara `using: node24`. Il gate e' fail-closed: un'azione
// assente dalla mappa non e' verificabile, e un'azione non verificabile non e'
// un'azione accettata (la si dichiara nella mappa con la sua major node24).
const NODE24_ACTIONS = new Map([
  ['actions/checkout', 'v5'], // v6: creds su file separato | v7: blocco dei fork
  ['actions/setup-node', 'v5'], // v6: caching automatico limitato a npm | v7: ESM
  ['actions/github-script', 'v8'], // v9: getOctokit iniettato come parametro ESM
  ['pnpm/action-setup', 'v5'], // v6: supporto pnpm v11
  ['actions/upload-artifact', 'v6'], // v7: upload diretto, ESM
  ['actions/download-artifact', 'v7'], // v8: ESM, digest-mismatch = error
]);

/** La major numerica di un tag `vN` (null se il riferimento non e' una major). */
function majorOf(ref) {
  const m = /^v(\d+)$/.exec(ref);
  return m ? Number(m[1]) : null;
}

let node24Refs = 0;

function checkNode24Actions(dir) {
  let bad = 0;
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
    let fileRefs = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // un COMMENTO non e' una reference: `uses:` in un commento non esegue nulla
      if (line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*(?:-\s+)?uses:\s*(\S+)/);
      if (!m) continue;
      const ref = m[1].trim().replace(/^['"]|['"]$/g, '');
      // azioni locali (`.github/actions/...`) e docker: nessun runtime dichiarato
      if (ref.startsWith('./') || ref.startsWith('../') || ref.startsWith('docker://')) continue;
      const at = ref.lastIndexOf('@');
      if (at < 0) {
        console.error(
          `[FAIL] ${file}:${i + 1}: \`uses: ${ref}\` non dichiara una versione: il runtime non e' verificabile.`,
        );
        bad++;
        continue;
      }
      const action = ref.slice(0, at);
      const version = ref.slice(at + 1);
      const min = NODE24_ACTIONS.get(action);
      if (!min) {
        console.error(
          `[FAIL] ${file}:${i + 1}: \`${ref}\` non e' in NODE24_ACTIONS: il runtime dichiarato non e' verificabile.`,
        );
        console.error(
          `       Dichiarala nella mappa con la prima major su node24 (azioni note: ${[...NODE24_ACTIONS.keys()].join(', ')}).`,
        );
        bad++;
        continue;
      }
      const major = majorOf(version);
      if (major === null) {
        console.error(
          `[FAIL] ${file}:${i + 1}: \`${ref}\` non e' pinnata a una major (attesa la forma \`vN\`): il runtime non e' verificabile.`,
        );
        bad++;
        continue;
      }
      fileRefs++;
      node24Refs++;
      if (major < majorOf(min)) {
        console.error(
          `[FAIL] ${file}:${i + 1}: \`${ref}\` dichiara il runtime node20 (prima major su node24: ${min}).`,
        );
        console.error(
          "       Node 20 e' stato rimosso dai runner il 2026-09-23: le action node20 girano fuori supporto (issue #283).",
        );
        bad++;
      }
    }
    if (fileRefs > 0) console.log(`[OK] ${file}: ${fileRefs} reference a action, nessuna su node20`);
  }
  return bad;
}

// === Issue #135 — le scope di `permissions:` devono essere dichiarabili ===
//
// Elenco preso da "Workflow syntax for GitHub Actions" -> permissions.
// `metadata` e' volutamente assente: e' sempre attiva e non dichiarabile.
const PERMISSION_SCOPES = [
  'actions',
  'artifact-metadata',
  'attestations',
  'checks',
  'code-quality',
  'contents',
  'deployments',
  'discussions',
  'id-token',
  'issues',
  'models',
  'packages',
  'pages',
  'pull-requests',
  'security-events',
  'statuses',
  'vulnerability-alerts',
];
const PERMISSION_SCOPE_SET = new Set(PERMISSION_SCOPES);
const PERMISSION_VALUES = new Set(['read', 'write', 'none']);
// Scope con dominio ristretto (docs: `id-token: write|none`).
const PERMISSION_RESTRICTED = new Map([['id-token', new Set(['write', 'none'])]]);
// Forme compatte ammesse al posto di un blocco mapping.
const PERMISSION_SHORTHANDS = new Set(['{}', 'read-all', 'write-all']);

// Issue #140 — forme di sincronizzazione con `origin/main` accettate come
// difesa di un writer di `main` (spiegazione e caso reale sotto, in
// `checkPushSync`). Devono stare prima di `git push origin main`: l'ordine fa
// parte del contratto.
const SYNC_FORMS = [
  /git\s+rebase\s+origin\/main\b/,
  /git\s+reset\s+--hard\s+origin\/main\b/,
  /git\s+pull\s+(?:--rebase\s+)?origin\s+main\b/,
];
// La push a `main` puo' comparire anche dentro un ciclo di retry
// (`if git push origin main; then`): il pattern non e' piu' ancorato alla riga.
// Le righe di COMMENTO sono escluse dal controllo (vedi checkPushSync).
// Issue #284: il writer unico usa la forma `git push origin HEAD:main` (il
// checkout e' su `main`, ma il push e' esplicito sul ref di destinazione).
const PUSH_MAIN_RE = /git\s+push\s+origin\s+(?:HEAD:)?main\b/;

// === Scalari semplici con ": " — YAML non valido (Sessione 74) ===
//
// Un file workflow che GitHub **rifiuta in fase di validazione** non produce
// un job che fallisce: produce una run con `jobs: 0` che chiude `failure` a
// 0 secondi, senza log e senza annotazioni via API. Il sintomo e'
// indistinguibile da "Actions rotta per billing" — la classe di failure mode
// dell'issue #135 (22 ore di gate spenti senza che nessuno se ne accorgesse).
//
// La forma invalida piu' comune e' uno **scalare semplice** (non quotato, non
// block scalar) che contiene `: ` (due punti + spazio). In contesto block
// quello e' l'indicatore di chiave, quindi il valore non puo' contenerlo:
//
//     run: echo "::notice::PR di sola documentazione: lint."   <- INVALIDO
//     run: |                                                 <- valido
//       echo "::notice::PR di sola documentazione: lint."
//     run: "echo a: b"                                      <- valido (quotato)
//
// Nota: dentro un block scalar (`|` o `>`) il `: ` e' testo letterale e
// valido — per questo i corpi dei block scalar sono esclusi dal controllo.
function checkYamlScalars(lines, file) {
  let fails = 0;
  let blockIndent = -1; // >= 0: siamo dentro il corpo di un block scalar
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (blockIndent >= 0) {
      if (line.trim() === '') continue;
      const indent = line.match(/^\s*/)[0].length;
      if (indent > blockIndent) continue; // ancora dentro il blocco
      blockIndent = -1;
    }
    const m = line.match(/^(\s*)(?:-\s+)?([A-Za-z0-9_"'-]+):(?:\s+(.*))?$/);
    if (!m) continue;
    // In YAML un `#` preceduto da spazio apre un commento: il commento NON fa
    // parte del valore. Senza questo strip, `if: always()  # nota: x` verrebbe
    // segnalato come falso positivo.
    const value = (m[3] || '').replace(/\s+#.*$/, '').trim();
    if (value === '') continue;
    if (value.startsWith('|') || value.startsWith('>')) {
      blockIndent = m[1].length;
      continue;
    }
    if (value.startsWith('"') || value.startsWith("'")) continue; // quotato: valido
    if (value.startsWith('[') || value.startsWith('{')) continue; // flow: valido
    if (/: /.test(value)) {
      console.error(
        `[FAIL] ${file}: riga ${i + 1}: scalare semplice non quotato che contiene ": " — ` +
          `YAML non valido, GitHub rifiuterebbe il file (run con 0 job). ` +
          `Usa un block scalar (|) o quota il valore.`,
      );
      fails++;
    }
  }
  return fails;
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
  const full = join(dir, file);
  const text = readFileSync(full, 'utf8');

  // Tab usati per l'indentazione sono illegali in YAML.
  const tabLine = text.split('\n').findIndex((l) => /^\s*\t/.test(l)) + 1;
  if (tabLine > 0) {
    console.error(`[FAIL] ${file}: tab nell'indentazione alla riga ${tabLine}`);
    failures++;
  }

  // Estrae i blocchi scalari `script: |` e ne verifica la sintassi JS.
  //
  // NB: si normalizza il fine-riga. Senza questo, un file salvato con CRLF
  // (un contributore su Windows) lascerebbe un `\r` finale su ogni riga: i
  // pattern ancorati con `$` — incluso quello del controllo sui push su
  // `main` — non matcherebbero piu', e i controlli fallirebbero in SILENZIO
  // su un file CRLF. Il `\r` non e' un terminatore di riga per il regex
  // JavaScript: `.` non lo matcha.
  const lines = text.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));

  // Issue #135: le scope dichiarate in `permissions:` devono essere reali.
  failures += checkPermissionScopes(lines, file);
  // Sessione 74: uno scalare semplice con ": " rende il file non valido per
  // GitHub, che lo rifiuterebbe in fase di validazione (run con 0 job).
  failures += checkYamlScalars(lines, file);
  // Issue #140: chi pusha su `main` deve sincronizzarsi con `origin/main` prima.
  failures += checkPushSync(lines, file);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)script:\s*\|\s*$/);
    if (!m) continue;
    const baseIndent = m[1].length;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '') {
        body.push('');
        continue;
      }
      const indent = line.match(/^\s*/)[0].length;
      if (indent <= baseIndent) break; // uscita dal blocco scalare
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
      console.log(
        `[OK] ${file}: blocco script alla riga ${i + 1} (${js.split('\n').length} righe JS) sintatticamente valido`,
      );
    } catch (e) {
      console.error(
        `[FAIL] ${file}: script alla riga ${i + 1} non valido:\n${e.stderr?.toString() || e.message}`,
      );
      failures++;
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* noop */
      }
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
  // Issue #284: il writer e' UNO (`post-merge.yml`) e sostituisce i tre writer
  // precedenti, che concorrevano sugli stessi file generati.
  { workflow: 'post-merge.yml', script: 'scripts/aggregate-state.ps1' },
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
    return m[1].split(/\s+/).filter((t) => t && !t.startsWith('-'));
  }
  return null;
}

// Un target e' coperto se compare letteralmente nella lista, oppure se e' sotto
// una directory staged (es. `docs/state/` copre `docs/state/stories/x.md`) o
// sotto la radice (`.` copre tutto).
function isStaged(target, staged) {
  if (staged.includes(target)) return true;
  return staged.some((p) => p === '.' || p === './' || (p.endsWith('/') && target.startsWith(p)));
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
      console.error(
        `[FAIL] ${workflow}: ${script} non trovato, la copertura \`git add\` non e' verificabile`,
      );
      failures++;
      continue;
    }
    const targets = extractAggregatorTargets(readFileSync(scriptPath, 'utf8'));
    const staged = extractGitAddPaths(readFileSync(wfPath, 'utf8'));
    if (!targets || targets.length === 0) {
      console.error(
        `[FAIL] ${workflow}: nessun target estratto da $targets in ${script} (la forma dell'array e' cambiata?)`,
      );
      failures++;
      continue;
    }
    if (!staged) {
      console.error(
        `[FAIL] ${workflow}: nessuna riga \`git add\` trovata, i target dell'aggregator non verrebbero committati`,
      );
      failures++;
      continue;
    }
    const missing = targets.filter((t) => !isStaged(t, staged));
    if (missing.length > 0) {
      console.error(
        `[FAIL] ${workflow}: la riga \`git add\` NON copre ${missing.length}/${targets.length} $targets di ${script}:`,
      );
      for (const t of missing)
        console.error(`         mancante: ${t} (generato dal blocco aggregato, mai committato)`);
      failures++;
    } else {
      console.log(
        `[OK] ${workflow}: la riga \`git add\` copre tutti i ${targets.length} $targets di ${script}`,
      );
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
        console.error(
          `[FAIL] ${file}:${i + 1}: \`permissions: ${inline}\` non e' una forma ammessa (usa un blocco scope, \`{}\`, \`read-all\` o \`write-all\`)`,
        );
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
      if (!entry) break; // forma non `scope: valore` (flow mapping): niente da validare
      const [, scope, value] = entry;
      entries++;
      if (!PERMISSION_SCOPE_SET.has(scope)) {
        console.error(
          `[FAIL] ${file}:${j + 1}: scope \`${scope}\` non valida in \`permissions:\` — GitHub rifiuta l'intero workflow (\`Unexpected value '${scope}'\`), la run viene creata con 0 job e fallisce a 0s su ogni trigger.`,
        );
        console.error(`         scope valide: ${PERMISSION_SCOPES.join(', ')}`);
        bad++;
        continue;
      }
      const allowed = PERMISSION_RESTRICTED.get(scope) || PERMISSION_VALUES;
      if (!allowed.has(value)) {
        console.error(
          `[FAIL] ${file}:${j + 1}: scope \`${scope}\` accetta solo ${[...allowed].join('|')}, trovato \`${value || '(vuoto)'}\``,
        );
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

// === Issue #140 — chi pusha su `main` deve sincronizzarsi con `origin/main` ===
//
// `auto-bundle.yml` e `auto-state-aggregate.yml` condividono il concurrency group
// `post-merge-main` (`cancel-in-progress: false`), pensato per serializzare i due
// writer di `main`. Ma il group serializza i *run*, non i *checkout*:
// `actions/checkout` senza `with: ref:` mette il workspace sul `github.sha` del
// merge commit, non sulla testa corrente di `main`. Quando il secondo run parte
// dopo che il primo ha pushato, il suo `git push origin main` viene rifiutato:
//
//   ! [rejected]        main -> main (non-fast-forward)
//   hint: the tip of your current branch is behind its remote counterpart
//
// Il fallimento e' silenzioso dal punto di vista dello stato: il blocco aggregato
// resta indietro, nessun gate di `ci.yml` lo segnala, e il merge sembra riuscito.
// Caso reale: run `39803721229` (2026-10-22T15:19:20Z) e `39802198985`, con
// conseguenza diretta sul doc-sync della Story 1.2 rimasto fuori da `main`.
//
// Difesa: ogni workflow che contiene `git push origin main` deve dichiarare una
// sincronizzazione verso `origin/main` **prima** del push. L'ordine e' parte del
// contratto: un sync dopo il push non serve a niente.

function checkPushSync(lines, file) {
  // una push dentro un COMMENTO non e' una push: il commento che spiega la
  // race menziona `git push origin main` senza eseguirla. E la push puo'
  // stare dentro un ciclo di retry (`if git push origin main; then`).
  const pushAt = lines.findIndex((l) => PUSH_MAIN_RE.test(l) && !l.trim().startsWith('#'));
  if (pushAt < 0) return 0; // non e' un writer di `main`: niente da tassare
  pushers++;

  // lo step che contiene la push (dal suo `- name:` fino al successivo)
  let stepStart = pushAt;
  for (let i = pushAt - 1; i >= 0; i--) {
    if (/^\s{6}- name: /.test(lines[i])) {
      stepStart = i;
      break;
    }
  }
  let stepEnd = lines.length;
  for (let i = pushAt + 1; i < lines.length; i++) {
    if (/^\s{6}- name: /.test(lines[i])) {
      stepEnd = i;
      break;
    }
  }
  const before = lines.slice(0, stepStart).join('\n'); // gli step precedenti
  const wholeStep = lines.slice(stepStart, stepEnd).join('\n'); // lo step della push
  // Issue #284: un COMMENTO non e' un comando. Una riga di commento che
  // contiene `git reset --hard origin/main` non sincronizza niente: senza
  // questo filtro il gate accettava un writer che non ha nessuna difesa
  // (la stessa regola che esclude i commenti dalla detection della push).
  const codeOnly = (text) =>
    text
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
  const hasSync = (text) => SYNC_FORMS.some((re) => re.test(codeOnly(text)));

  if (hasSync(before)) {
    console.log(
      `[OK] ${file}:${pushAt + 1}: \`git push origin main\` preceduto da una sincronizzazione con origin/main`,
    );
    return 0;
  }
  // Strategia di ri-sincronizzazione RETRY: la ri-sincronizzazione deve
  // stare DENTRO il ciclo (for/while) che contiene la push, e il push deve
  // stare dentro quel ciclo (issue #261: i writer girano in parallelo e due
  // push su `main` possono incrociarsi -> il writer ri-sincronizza e riprova).
  // Una sincronizzazione "tardiva" (dopo la push, ma fuori da un ciclo)
  // NON e' una strategia: il push e' gia' fallito.
  //
  // Issue #279: il ciclo e' riconosciuto in **due** forme — quella bash
  // (`for ...; do` / `done`) e quella PowerShell (`for (...) {` / `}`), che e'
  // l'unica che parse dentro uno step `shell: pwsh`.
  const loopRe = /^\s*(for|while|until|foreach)\b.*(?:\bdo\s*|\{\s*)$/;
  let loopStart = -1;
  for (let i = pushAt; i >= stepStart; i--) {
    if (loopRe.test(lines[i])) {
      loopStart = i;
      break;
    }
  }
  if (loopStart >= 0) {
    let loopEnd = lines.length;
    const loopIndent = lines[loopStart].match(/^\s*/)[0].length;
    for (let i = pushAt + 1; i < stepEnd; i++) {
      // fine del ciclo: `done` (bash) oppure la graffa di chiusura all'indentazione
      // del `for` (PowerShell: le graffe interne sono piu' annidate).
      if (/^\s*done\s*$/.test(lines[i])) {
        loopEnd = i;
        break;
      }
      const indent = lines[i].length - lines[i].trimStart().length;
      if (lines[i].trim() === '}' && indent === loopIndent) {
        loopEnd = i;
        break;
      }
    }
    const loop = lines.slice(loopStart, loopEnd).join('\n');
    if (hasSync(loop)) {
      console.log(
        `[OK] ${file}:${pushAt + 1}: \`git push origin main\` protetto da un retry con ri-sincronizzazione`,
      );
      return 0;
    }
  }
  console.error(
    `[FAIL] ${file}:${pushAt + 1}: \`git push origin main\` senza sincronizzazione preventiva con \`origin/main\`.`,
  );
  console.error(
    `       Con piu' workflow che pushano su \`main\` (auto-bundle + auto-state-aggregate), il checkout di default e' il \`github.sha\` del merge commit: se l'altra ha gia' pushato, questo push viene rifiutato con \`non-fast-forward\` e i blocchi aggregati restano indietro senza che nessun gate se ne accorga.`,
  );
  console.error(
    `       Aggiungi uno step "Sync con origin/main" (git fetch origin main + git rebase origin/main, con fallback \`git reset --hard origin/main\`) PRIMA del push, OPPURE un retry con ri-sincronizzazione dentro lo step della push.`,
  );
  return 1;
}

// === Issue #149 — l'ordinamento fra i due writer di `main` deve essere esplicito ===
//
// `auto-bundle.yml` e `auto-state-aggregate.yml` condividono il concurrency group
// `post-merge-main`, che serializza i *run* ma NON ne impone l'*ordine*: quale
// workflow ottenga prima il lock non e' deterministico.
//
// L'ordine e' pero' essenziale: `auto-bundle` copia il contenuto dei file che
// `auto-state-aggregate` modifica, quindi puo' copiare blocchi aggregati stale.
// Caso reale: merge della PR #147 (2026-10-26T12:50Z) — `auto-bundle` girò alle
// 12:50:23, `auto-state-aggregate` alle 12:50:55. Il bundle copio' i blocchi
// ANCORA VECCHI, il guard idempotente scrisse "gia' in sync" e non committò; poi
// l'agregate committò e la copia dentro `docs/BUNDLE.md` restò stale (6 righe
// fuori sync, drift silenzioso: il gate CI sul bundle è warning-only).
//
// Difesa: `auto-bundle.yml` deve dichiarare un trigger `workflow_run` su
// `auto-state-aggregate`. `workflow_run` e' agganciato alla *conclusione* del
// workflow, non a un push: sopravvive alla soppressione del GITHUB_TOKEN (che
// vale solo per gli eventi `push`/`pull_request` generati dal token stesso) ed
// e' il workaround documentato per i workflow che si innescano a vicenda.
//
// Il check verifica anche che il nome dichiarato in `workflows:` corrisponda
// esattamente al campo `name:` del workflow target: una disallineazione li'
// silenziosa (il trigger semplicemente non scatta mai).

const WRITER_ORDERING = [
  {
    // Issue #284: la CI consuma lo stato finale prodotto dal writer. Il
    // trigger e' `workflow_run` (agganciato alla CONCLUSIONE del writer, non
    // a un push): e' l'unico trigger che sopravvive alla soppressione del
    // `GITHUB_TOKEN`, che vale solo per gli eventi `push`/`pull_request`
    // generati dal token stesso. Con il trigger `push` il commit del writer
    // non avrebbe MAI attivato la pipeline (misurato: nessuna run `CI` per il
    // commit `831b9e7` della PR #282).
    consumer: 'ci.yml',
    producer: 'post-merge.yml',
    producerName: 'post-merge',
  },
];

// Issue #284: nel passaggio `workflow_run` la CI deve validare la TESTA di
// `main` (che contiene il commit del writer), non `workflow_run.head_sha`
// (che e' il commit di PARTENZA del writer: il merge commit, senza lo stato
// applicato). Senza questo contratto il passaggio post-writer validerebbe
// l'albero sbagliato — il gate merge-state fallirebbe per costruzione.
const WORKFLOW_RUN_CHECKOUT_RE =
  /github\.event_name\s*==\s*['"]workflow_run['"]\s*&&\s*['"]main['"]/;

// Estrae il nome logico di un workflow dal campo `name:` intestazione.
function extractWorkflowName(text) {
  const m = text.match(/^name:\s*(.+?)\s*$/m);
  return m ? m[1].replace(/^["']|["']$/g, '') : null;
}

// Estrae la lista `workflows:` del blocco `workflow_run:` di un file YAML.
// Restituisce null se il blocco non esiste.
function extractWorkflowRunTargets(text) {
  const lines = text.split('\n');
  let inOn = false;
  let onIndent = -1;
  let inRun = false;
  let runIndent = -1;
  const targets = [];
  for (const raw of lines) {
    const indent = raw.match(/^\s*/)[0].length;
    const trimmed = raw.trim();
    if (!inOn) {
      if (/^on:\s*$/.test(trimmed)) {
        inOn = true;
        onIndent = indent;
      }
      continue;
    }
    if (indent <= onIndent && trimmed !== '' && !trimmed.startsWith('#')) {
      // uscita dal blocco `on:`
      inOn = false;
      inRun = false;
      continue;
    }
    if (!inRun) {
      if (/^workflow_run:\s*$/.test(trimmed)) {
        inRun = true;
        runIndent = indent;
      }
      continue;
    }
    if (indent <= runIndent && trimmed !== '' && !trimmed.startsWith('#')) {
      inRun = false; // uscita dal blocco `workflow_run:`
      continue;
    }
    const m = trimmed.match(/^workflows:\s*\[(.*)\]\s*$/);
    if (m) {
      for (const t of m[1].split(',')) {
        const name = t.trim().replace(/^["']|["']$/g, '');
        if (name) targets.push(name);
      }
    }
  }
  return targets.length > 0 ? targets : null;
}

function checkWriterOrdering(dir) {
  let bad = 0;
  for (const { consumer, producer, producerName } of WRITER_ORDERING) {
    const consumerPath = join(dir, consumer);
    const producerPath = join(dir, producer);
    // Se il consumer non c'e' nella directory ispezionata, il check non e'
    // applicabile: alcune fixture coprono un solo workflow (es. il test della
    // copertura `git add` ne porta solo uno). Tassarle produrrebbe un falso
    // positivo su un check che qui non ha niente da dire.
    if (!existsSync(consumerPath)) {
      console.log(
        `[SKIP] ${consumer}: assente dalla directory ispezionata, il check di ordinamento non e' applicabile`,
      );
      continue;
    }
    if (!existsSync(producerPath)) {
      console.error(
        `[FAIL] ${consumer}: il workflow produttore ${producer} non esiste, l'ordinamento non e' verificabile`,
      );
      bad++;
      continue;
    }
    const consumerText = readFileSync(consumerPath, 'utf8');
    const producerText = readFileSync(producerPath, 'utf8');
    const targets = extractWorkflowRunTargets(consumerText);
    if (!targets) {
      console.error(
        `[FAIL] ${consumer}: nessun trigger \`workflow_run:\` con \`workflows:\` trovato.`,
      );
      console.error(
        `       Senza di esso i due writer di \`main\` restano serializzati ma NON ordinati: \`${consumer}\` puo' copiare blocchi aggregati stale da \`${producer}\` (caso reale: PR #147, 2026-10-26T12:50Z, drift di 6 righe in docs/BUNDLE.md).`,
      );
      console.error(
        `       Aggiungi un blocco \`workflow_run:\` con \`workflows: ["${producerName}"]\` e \`types: [completed]\`.`,
      );
      bad++;
      continue;
    }
    if (!targets.includes(producerName)) {
      console.error(
        `[FAIL] ${consumer}: il trigger \`workflow_run:\` non include \`${producerName}\` (trovati: ${targets.join(', ') || 'nessuno'}).`,
      );
      console.error(
        `       Il bundle deve rigenerarsi DOPO che \`${producer}\` ha committato i blocchi aggregati, altrimenti copia il contenuto stale.`,
      );
      bad++;
      continue;
    }
    // Il nome in `workflows:` deve corrispondere al `name:` reale del producer:
    // una disallineazione non da' errore, ma il trigger semplicemente non scatta.
    const actualName = extractWorkflowName(producerText);
    if (actualName !== producerName) {
      console.error(
        `[FAIL] ${consumer}: \`workflows: ["${producerName}"]\` non combacia con il \`name:\` reale di ${producer} ("${actualName}").`,
      );
      console.error(
        `       Il trigger \`workflow_run\` non scatterebbe MAI: silenzioso, senza errore di GitHub.`,
      );
      bad++;
      continue;
    }
    console.log(
      `[OK] ${consumer}: trigger \`workflow_run\` su "${producerName}" presente e allineato al \`name:\` di ${producer}`,
    );
  }
  return bad;
}

// === Issue #149 — l'ordinamento fra i due writer di `main` deve essere esplicito ===
//
// (la definizione di WRITER_ORDERING e di checkWriterOrdering sta piu' in basso:
//  il check viene eseguito in fondo al file, dopo le dichiarazioni)

failures += checkWriterOrdering(dir);

// === Issue #284 — il writer di `main` e' UNO, e la CI lo consuma ===
//
// I tre writer precedenti (`auto-session-merge-state`, `auto-state-aggregate`,
// `auto-bundle`) concorrevano sullo stesso `main` e sugli stessi file
// generati: misurato il 2026-11-02, push rifiutato + rebase dei file
// generati -> conflitto -> run fallito. Il writer unico (`post-merge.yml`)
// elimina la race per costruzione.
//
// I gate che ne difendono la struttura:
//
//   1. **Un solo writer**: due workflow che pushano su `main` riportano
//      indietro la race, per quanto bene scritti.
//   2. **Il writer non filtra i merge**: un `paths:` sotto `on.pull_request`
//      lascerebbe fuori some PR mergiate (il bundle dipende da molti file,
//      non solo dallo stato).
//   3. **La CI consuma il writer con `workflow_run`** e fa il checkout della
//      TESTA di `main` in quel passaggio.

/** Il blocco `on:` del workflow (fino a `jobs:`), come testo. */
function extractOnBlock(text) {
  const jobsAt = text.indexOf('\njobs:');
  return jobsAt > 0 ? text.slice(0, jobsAt) : text;
}

/** Writer che pushano su `main` (una riga di push reale, non un commento). */
function findMainWriters(dir) {
  const writers = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
    const text = readFileSync(join(dir, file), 'utf8');
    const pushes = text
      .split('\n')
      .some((l) => PUSH_MAIN_RE.test(l) && !l.trim().startsWith('#'));
    if (pushes) writers.push(file);
  }
  return writers;
}

function checkSingleWriter(dir) {
  // Il gate vale per la directory reale dei workflow: su una fixture che
  // contiene un solo writer il controllo e' vacuo ma non dannoso.
  if (!existsSync(join(dir, 'post-merge.yml'))) {
    console.log('[SKIP] single-writer: `post-merge.yml` non e\' nella directory ispezionata');
    return 0;
  }
  const writers = findMainWriters(dir);
  if (writers.length > 1) {
    console.error(
      `[FAIL] single-writer: ${writers.length} workflow pushano su \`main\`: ${writers.join(', ')}.`,
    );
    console.error(
      '       Due writer sullo stesso `main` e sugli stessi file generati producono la race ' +
        'misurata il 2026-11-02 (push rifiutato, rebase dei file generati, conflitto, run fallito).',
    );
    console.error('       Un solo writer: `post-merge.yml`.');
    return 1;
  }
  if (writers.length === 0) {
    console.error('[FAIL] single-writer: nessun workflow pusha su `main`: nessuno applicherebbe lo stato di merge.');
    return 1;
  }
  console.log(`[OK] single-writer: un solo writer su \`main\` (${writers[0]})`);
  return 0;
}

function checkWriterTrigger(dir) {
  const wfPath = join(dir, 'post-merge.yml');
  if (!existsSync(wfPath)) {
    console.log('[SKIP] writer-trigger: `post-merge.yml` non e\' nella directory ispezionata');
    return 0;
  }
  const text = readFileSync(wfPath, 'utf8');
  let bad = 0;

  if (!/^\s*pull_request:\s*$/m.test(extractOnBlock(text))) {
    console.error('[FAIL] writer-trigger: `post-merge.yml` non ha un trigger `pull_request:`.');
    console.error('       Senza il trigger sulla PR chiusa il writer non gira mai.');
    bad++;
  }
  if (!/types:\s*\[closed\]/.test(text)) {
    console.error('[FAIL] writer-trigger: `post-merge.yml` non scatta su `types: [closed]`.');
    bad++;
  }
  if (/^\s+paths:/m.test(extractOnBlock(text))) {
    console.error('[FAIL] writer-trigger: `post-merge.yml` filtra i merge con un blocco `paths:`.');
    console.error(
      '       Il bundle dipende da molti file (non solo da `docs/state/**`): un filtro lascerebbe ' +
        'fuori delle PR mergiate, e i loro file resterebbero fuori dal bundle.',
    );
    bad++;
  }
  if (bad === 0) {
    console.log('[OK] writer-trigger: il writer scatta su ogni PR mergiata (nessun filtro `paths:`)');
  }
  return bad;
}

function checkWorkflowRunCheckout(dir) {
  const ciPath = join(dir, 'ci.yml');
  if (!existsSync(ciPath)) {
    console.log('[SKIP] workflow-run-checkout: `ci.yml` non e\' nella directory ispezionata');
    return 0;
  }
  const text = readFileSync(ciPath, 'utf8');
  if (!/workflow_run:/.test(text)) {
    console.error('[FAIL] workflow-run-checkout: `ci.yml` non ha un trigger `workflow_run:`.');
    console.error(
      '       Il passaggio sullo stato finale di `main` deve essere agganciato alla CONCLUSIONE ' +
        'del writer: il trigger `push` e\' soppresso quando il push e\' fatto con il GITHUB_TOKEN.',
    );
    return 1;
  }
  if (!WORKFLOW_RUN_CHECKOUT_RE.test(text)) {
    console.error('[FAIL] workflow-run-checkout: `ci.yml` non fa il checkout di `main` nel passaggio `workflow_run`.');
    console.error(
      '       `workflow_run.head_sha` e\' il commit di PARTENZA del writer (il merge commit, senza ' +
        'lo stato applicato): validarlo equivarrebbe a far fallire il gate merge-state per costruzione.',
    );
    return 1;
  }
  console.log('[OK] workflow-run-checkout: nel passaggio `workflow_run` la CI valida la testa di `main`');
  return 0;
}

failures += checkSingleWriter(dir);
failures += checkWriterTrigger(dir);
failures += checkWorkflowRunCheckout(dir);
failures += checkNode24Actions(dir);

console.log(
  `\nWorkflow: ${checked} blocchi script verificati, ${permissionScopes} scope permissions verificate in ${permissionBlocks} blocchi, ${pushers} writer di main verificati, ${node24Refs} reference a action su node24, ${failures} fallimenti.`,
);
process.exit(failures === 0 ? 0 : 1);
