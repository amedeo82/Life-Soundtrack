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
const PUSH_MAIN_RE = /^\s*git\s+push\s+origin\s+main\s*$/;

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
  const pushAt = lines.findIndex((l) => PUSH_MAIN_RE.test(l));
  if (pushAt < 0) return 0; // non e' un writer di `main`: niente da tassare
  pushers++;
  const before = lines.slice(0, pushAt).join('\n');
  if (SYNC_FORMS.some((re) => re.test(before))) {
    console.log(
      `[OK] ${file}:${pushAt + 1}: \`git push origin main\` preceduto da una sincronizzazione con origin/main`,
    );
    return 0;
  }
  console.error(
    `[FAIL] ${file}:${pushAt + 1}: \`git push origin main\` senza sincronizzazione preventiva con \`origin/main\`.`,
  );
  console.error(
    `       Con piu' workflow che pushano su \`main\` (auto-bundle + auto-state-aggregate), il checkout di default e' il \`github.sha\` del merge commit: se l'altra ha gia' pushato, questo push viene rifiutato con \`non-fast-forward\` e i blocchi aggregati restano indietro senza che nessun gate se ne accorga.`,
  );
  console.error(
    `       Aggiungi uno step "Sync con origin/main" (git fetch origin main + git rebase origin/main, con fallback \`git reset --hard origin/main\`) PRIMA del push.`,
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
    consumer: 'auto-bundle.yml',
    producer: 'auto-state-aggregate.yml',
    producerName: 'auto-state-aggregate',
  },
];

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

// === Issue #216 — i trigger del workflow devono coprire gli input dei blocchi ===
//
// Il blocco `AGGREGATE-PROGRESS-*` (ADR-0008 V4, issue #216) calcola la percentuale
// di implementazione su TRE sorgenti: lo stato delle story (`docs/state/stories/`),
// il CATALOGO delle story (`docs/11-BACKLOG.md`, il denominatore) e il generatore
// stesso (`scripts/aggregate-state.ps1`).
//
// `auto-state-aggregate.yml` dichiarava in `paths:` solo i primi due: una story
// nuova nel backlog (o un EPIC nuovo) non avrebbe fatto scattare il workflow, e
// l'indicatore sarebbe rimasto fermo su una percentuale falsa. E' la stessa classe
// di fallimento silenzioso chiusa dall'issue #136 per la riga `git add`, applicata
// ai trigger invece che allo staging.
//
// Il check richiede che ogni sorgente sia coperta da almeno un pattern di `paths:`:
// "se questo file cambia, il workflow deve scattare".

const AGGREGATOR_TRIGGER_INPUTS = [
  {
    workflow: 'auto-state-aggregate.yml',
    path: 'docs/state/stories/3.1-home-timeline.md',
    why: 'stato di una story (frontmatter `status`)',
  },
  {
    workflow: 'auto-state-aggregate.yml',
    path: 'docs/state/sessions/75-progress-indicator.md',
    why: 'stato di una sessione (analisi narrativa + blocco SESSIONS)',
  },
  {
    workflow: 'auto-state-aggregate.yml',
    path: 'docs/11-BACKLOG.md',
    why: 'catalogo delle story = denominatore della percentuale (issue #216, AC2)',
  },
  {
    workflow: 'auto-state-aggregate.yml',
    path: 'scripts/aggregate-state.ps1',
    why: 'il generatore stesso',
  },
];

/**
 * Converte un pattern di `paths:` (globo GitHub) in espressione regolare.
 * `**` copre zero o piu' segmenti, `*` copre un segmento, `?` un carattere.
 */
function pathPatternToRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          out += '(?:[^/]+/)*';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
      continue;
    }
    if (c === '?') {
      out += '[^/]';
      continue;
    }
    out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/**
 * Estrae la lista `paths:` del blocco `on.push` di un file YAML.
 * Ritorna null se il blocco non esiste.
 */
function extractPushPaths(text) {
  const lines = text.split('\n');
  let inOn = false;
  let onIndent = -1;
  let inPush = false;
  let pushIndent = -1;
  let inPaths = false;
  let pathsIndent = -1;
  const paths = [];
  for (const raw of lines) {
    const indent = raw.match(/^\s*/)[0].length;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    if (!inOn) {
      if (/^on:\s*$/.test(trimmed)) {
        inOn = true;
        onIndent = indent;
      }
      continue;
    }
    if (indent <= onIndent) break;          // uscita dal blocco `on:`
    if (!inPush) {
      if (/^push:\s*$/.test(trimmed)) {
        inPush = true;
        pushIndent = indent;
      }
      continue;
    }
    if (indent <= pushIndent) break;         // uscita dal blocco `push:`
    if (!inPaths) {
      if (/^paths:\s*$/.test(trimmed)) {
        inPaths = true;
        pathsIndent = indent;
      }
      continue;
    }
    if (indent <= pathsIndent) break;        // uscita dal blocco `paths:`
    const m = trimmed.match(/^-\s*(.+?)\s*$/);
    if (m) paths.push(m[1].replace(/^["']|["']$/g, ''));
  }
  return paths.length > 0 ? paths : null;
}

function checkTriggerCoverage(dir) {
  let bad = 0;
  const byWorkflow = new Map();
  for (const input of AGGREGATOR_TRIGGER_INPUTS) {
    if (!byWorkflow.has(input.workflow)) byWorkflow.set(input.workflow, []);
    byWorkflow.get(input.workflow).push(input);
  }
  for (const [workflow, inputs] of byWorkflow) {
    const wfPath = join(dir, workflow);
    if (!existsSync(wfPath)) {
      console.log(`[SKIP] ${workflow}: assente dalla directory ispezionata, il check di copertura dei trigger non e' applicabile`);
      continue;
    }
    const paths = extractPushPaths(readFileSync(wfPath, 'utf8'));
    if (!paths) {
      console.error(`[FAIL] ${workflow}: nessun blocco \`paths:\` trovato sotto \`on.push\`.`);
      console.error('       Il workflow non scatterebbe mai su un cambio degli input dei blocchi aggregati: l\'indicatore resterebbe fermo mentre le sue sorgenti cambiano.');
      bad++;
      continue;
    }
    const uncovered = inputs.filter(
      input => !paths.some(pattern => pathPatternToRegExp(pattern).test(input.path)),
    );
    if (uncovered.length > 0) {
      console.error(`[FAIL] ${workflow}: i trigger \`paths:\` NON coprono ${uncovered.length}/${inputs.length} input dei blocchi aggregati:`);
      for (const input of uncovered) {
        console.error(`         NON coprono ${input.path} (${input.why})`);
      }
      console.error(`         Filtri dichiarati: ${paths.join(', ')}`);
      console.error('         Senza copertura il blocco generato resta fermo mentre la sua sorgente cambia: percentuale falsa, in silenzio.');
      bad++;
    } else {
      console.log(`[OK] ${workflow}: i trigger \`paths:\` coprono tutti i ${inputs.length} input dei blocchi aggregati`);
    }
  }
  return bad;
}

failures += checkTriggerCoverage(dir);

console.log(
  `\nWorkflow: ${checked} blocchi script verificati, ${permissionScopes} scope permissions verificate in ${permissionBlocks} blocchi, ${pushers} writer di main verificati, ${failures} fallimenti.`,
);
process.exit(failures === 0 ? 0 : 1);
