#!/usr/bin/env node
/**
 * Gate "coerenza del protocollo" (issue #248, ADR-0012).
 *
 * `AGENTS.md` era l'unico artefatto di governance del repo SENZA generatore e
 * SENZA gate: 1328 righe, 77 anchor, 643 citazioni, 0 controlli automatici.
 * Tutti gli altri ne hanno uno (`check-readme-facts.mjs` per il README,
 * `check-merge-state.mjs` per le sessioni, `validate-workflows.mjs` per i
 * workflow, `validate-labels.mjs` per le label, `aggregate-state.ps1` per i
 * blocchi aggregati, `generate-bundle.ps1` per il bundle).
 *
 * Questo gate e' il meccanismo che chiude per sempre i drift misurati nella
 * Sessione 79 (D1-D8): confronta i fatti *normativi* del protocollo con la
 * realta' del repository. Un drift che non ha un gate e' un drift che torna.
 *
 * Il gate e' **read-only**: non genera e non scrive nulla.
 *
 * Controlli (uno per drift chiuso nella Sessione 79):
 *   C1  versione di AGENTS.md == versione dichiarata in docs/INDEX.md
 *   C2  tabella "Label disponibili" == elenco atteso di validate-labels.mjs
 *   C3  tabella exit code == letterali `exit N` dei script che li emettono
 *   C4  ogni riferimento `AGENTS.md §"..."` risolve a un heading esistente
 *   C5  ogni `scripts/<file>` e ogni flag `-<Flag>` citati esistono davvero
 *   C6  nessuna checklist duplicata: AGENTS.md non contiene copie delle voci
 *       del PR template (un solo artifact, decisione D3 del project owner)
 *
 * Uso: node scripts/check-protocol-consistency.mjs [--root <dir>]
 *
 * Exit code: 0 = in sync, 1 = drift, 2 = errore di ambiente (file mancante).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const root = resolve(rootIdx >= 0 ? argv[rootIdx + 1] : '.');

let failures = 0;

function fail(message) {
  console.error(`[FAIL] ${message}`);
  failures++;
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function requireFile(path, label) {
  if (!existsSync(path)) {
    console.error(`[FAIL] ${label}: file non trovato: ${path}`);
    process.exit(2);
  }
  return readFileSync(path, 'utf8');
}

function listFiles(dir, filter, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      listFiles(full, filter, acc);
    } else if (filter(full)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Riduce un titolo a una chiave confrontabile (via emoji, punteggiatura, backtick). */
function normalizeTitle(text) {
  return text
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// C1 - versione dichiarata
// ---------------------------------------------------------------------------

function checkVersion() {
  const agents = requireFile(join(root, 'AGENTS.md'), 'C1');
  const index = requireFile(join(root, 'docs', 'INDEX.md'), 'C1');

  const inAgents = agents.match(/\*\*Versione\s+(\d+\.\d+)/);
  if (!inAgents) {
    fail('C1: AGENTS.md non dichiara una versione nel formato "**Versione X.Y"');
    return;
  }
  const inIndex = index.match(/\[\s*`?\.\.\/AGENTS\.md`?\]\([^)]*\)\s*\|[^|]*?v(\d+\.\d+)/);
  if (!inIndex) {
    fail('C1: docs/INDEX.md non dichiara la versione di AGENTS.md nella riga "Documenti di supporto"');
    return;
  }
  if (inAgents[1] !== inIndex[1]) {
    fail(`C1: versione disallineata — AGENTS.md dichiara v${inAgents[1]}, docs/INDEX.md dichiara v${inIndex[1]}`);
    return;
  }
  ok(`C1: versione di AGENTS.md in sync (v${inAgents[1]})`);
}

// ---------------------------------------------------------------------------
// C2 - tabella label vs gate delle label
// ---------------------------------------------------------------------------

/** Espande `phase-0 … phase-6` in [phase-0, ..., phase-6]. */
function expandRange(from, to) {
  const out = [];
  const num = (s) => {
    const m = s.match(/(\d+)$/);
    return m ? Number(m[1]) : NaN;
  };
  const a = num(from);
  const b = num(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  const prefix = from.replace(/\d+$/, '');
  for (let i = a; i <= b; i++) out.push(`${prefix}${i}`);
  return out;
}

/** Valori label citati in una cella della tabella. */
function labelsFromCell(cell) {
  const out = [];
  let rest = cell;
  const rangeRe = /`([^`]+)`\s*…\s*`([^`]+)`/g;
  let m;
  while ((m = rangeRe.exec(cell)) !== null) {
    out.push(...expandRange(m[1], m[2]));
    rest = rest.replace(m[0], ' ');
  }
  for (const raw of rest.match(/`([^`]+)`/g) || []) {
    const value = raw.replace(/`/g, '').trim();
    if (/^[a-z][a-z0-9-]*(?:[:/][a-z0-9-]+)*$/i.test(value)) out.push(value);
  }
  return out;
}

function checkLabelTable() {
  const agents = requireFile(join(root, 'AGENTS.md'), 'C2');
  const gateSrc = requireFile(join(root, 'scripts', 'validate-labels.mjs'), 'C2');

  // --- tabella "Label disponibili" di AGENTS.md
  const section = agents.match(/### Label disponibili[\s\S]*?(?=\n#{2,4} |\n\n\n)/);
  if (!section) {
    fail('C2: sezione "### Label disponibili" non trovata in AGENTS.md');
    return;
  }
  const documentedLabels = new Map();
  for (const line of section[0].split(/\r?\n/)) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const labels = labelsFromCell(m[2]);
    if (labels.length) documentedLabels.set(m[1].trim(), labels);
  }
  if (documentedLabels.size === 0) {
    fail('C2: nessuna riga di label trovata nella tabella "Label disponibili"');
    return;
  }

  // --- elenco atteso nel gate
  const expected = new Map();
  const gateRe = /^\s*'?([^\n:']+?)'?:\s*\[([^\]]*)\]/gm;
  let m;
  while ((m = gateRe.exec(gateSrc)) !== null) {
    const category = m[1].trim();
    const labels = m[2]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    if (labels.length) expected.set(category, labels);
  }
  if (expected.size === 0) {
    fail('C2: elenco atteso non trovato in scripts/validate-labels.mjs');
    return;
  }

  let drift = 0;
  for (const [category, labels] of expected) {
    const doc = documentedLabels.get(category);
    if (!doc) {
      fail(`C2: la tabella di AGENTS.md non dichiara la categoria "${category}" (il gate la si aspetta)`);
      drift++;
      continue;
    }
    const missing = labels.filter((l) => !doc.includes(l));
    const extra = doc.filter((l) => !labels.includes(l));
    if (missing.length || extra.length) {
      const parts = [];
      if (missing.length) parts.push(`mancano nel documento: ${missing.join(', ')}`);
      if (extra.length) parts.push(`non previste dal gate: ${extra.join(', ')}`);
      fail(`C2: categoria "${category}" disallineata — ${parts.join('; ')}`);
      drift++;
    }
  }
  if (drift === 0) {
    ok(`C2: tabella label in sync con validate-labels.mjs (${expected.size} categorie)`);
  }
}

// ---------------------------------------------------------------------------
// C3 - tabella exit code vs script
// ---------------------------------------------------------------------------

function checkExitCodes() {
  const agents = requireFile(join(root, 'AGENTS.md'), 'C3');
  const postMerge = requireFile(join(root, 'scripts', 'post-merge.ps1'), 'C3');

  const section = agents.match(/### Exit code[^\n]*\n([\s\S]*?)\n\n/);
  if (!section) {
    fail('C3: tabella "Exit code" non trovata in AGENTS.md');
    return;
  }
  const documented = new Set();
  for (const line of section[1].split(/\r?\n/)) {
    const m = line.match(/^\|\s*(\d+)\s*\|/);
    if (m) documented.add(Number(m[1]));
  }
  if (documented.size === 0) {
    fail('C3: nessun exit code nella tabella di AGENTS.md');
    return;
  }

  // letterali `exit N` delle righe di CODICE (i commenti non sono contratto)
  const emitted = new Set();
  for (const line of postMerge.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    for (const m of line.matchAll(/\bexit\s+(\d+)/g)) emitted.add(Number(m[1]));
  }

  const missing = [...emitted].filter((c) => !documented.has(c)).sort((a, b) => a - b);
  const extra = [...documented].filter((c) => !emitted.has(c)).sort((a, b) => a - b);
  if (missing.length || extra.length) {
    const parts = [];
    if (missing.length) parts.push(`emessi dallo script ma non documentati: ${missing.join(', ')}`);
    if (extra.length) parts.push(`documentati ma non emessi: ${extra.join(', ')}`);
    fail(`C3: tabella exit code disallineata con scripts/post-merge.ps1 — ${parts.join('; ')}`);
    return;
  }
  ok(`C3: tabella exit code in sync con post-merge.ps1 (${emitted.size} codici)`);
}

// ---------------------------------------------------------------------------
// C4 - integrita' degli anchor
// ---------------------------------------------------------------------------

/**
 * File in cui i riferimenti ad AGENTS.md sono "vivi".
 * Esclusi i documenti storici (18-DEV-LOG, SESSIONS) e i derivati (BUNDLE):
 * un riferimento a una sezione rinominata in un diario storico non e' un drift.
 */
const LIVE_SCAN = [
  { label: 'AGENTS.md', path: 'AGENTS.md' },
  { label: '.github/', dir: '.github', exts: ['.md', '.yml', '.yaml'] },
  { label: 'scripts/', dir: 'scripts', exts: ['.mjs', '.ps1', '.sh'], skipFiles: ['check-protocol-consistency.mjs'] },
  {
    label: 'docs/',
    dir: 'docs',
    exts: ['.md'],
    skipFiles: ['18-DEV-LOG.md', 'SESSIONS.md', 'BUNDLE.md'],
    skipDirs: ['state'],
  },
];

function extractHeadings(text) {
  const headings = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (m) headings.push(m[1]);
  }
  return headings;
}

/**
 * Riferimenti `AGENTS.md §...` presenti in una riga.
 *
 * L'attribuzione e' per "menzione di documento piu' vicina": una riga puo' citare
 * piu' documenti (`AGENTS.md §"x" e docs/12-DEVOPS.md §9.10`) e ogni `§`
 * appartiene all'ultimo documento citato prima di lui. Sono riconosciute sia le
 * menzioni con estensione (`18-DEV-LOG.md`) sia quelle senza (`18-DEV-LOG`),
 * che altrimenti verrebbero attribuite al documento citato prima.
 */
function extractRefs(text, selfIsAgents) {
  const refs = [];
  const lines = text.split(/\r?\n/);
  // il footer di AGENTS.md e' un CHANGELOG: i suoi riferimenti descrivono le
  // sezioni come erano all'epoca ("La CI: 11 job" quando oggi sono 12) e non
  // sono un contratto. Non si verificano.
  const historyStart = selfIsAgents
    ? lines.findIndex((l) => /^\*Ultimo aggiornamento:/.test(l.trim()))
    : -1;
  lines.forEach((line, i) => {
    if (historyStart >= 0 && i > historyStart) return;
    const mentions = [];
    // dentro AGENTS.md ogni riferimento e' ad AGENTS.md, salvo che una riga
    // citi prima un altro documento (l'attribuzione e' per menzione piu' vicina)
    if (selfIsAgents) mentions.push({ at: -1, name: 'AGENTS.md' });
    const mentionRe = /([A-Za-z0-9_.-]*\.md|\b\d{2}-[A-Z][A-Za-z-]*)/g;
    let m;
    while ((m = mentionRe.exec(line)) !== null) {
      mentions.push({ at: m.index, name: m[1] });
    }
    let idx = -1;
    while ((idx = line.indexOf('§', idx + 1)) !== -1) {
      const last = mentions.filter((x) => x.at < idx).pop();
      if (!last) continue;
      const isAgents = /(^|\/)AGENTS\.md$/.test(last.name);
      if (!isAgents) continue;
      const rest = line.slice(idx + 1);
      // se subito dopo il § c'e' un altro documento, il riferimento e' suo
      // (es. "§9.8b di `docs/12-DEVOPS.md`")
      const ahead = rest.slice(0, 40);
      const aheadMention = ahead.match(/([A-Za-z0-9_.-]*\.md|\b\d{2}-[A-Z][A-Za-z-]*)/);
      if (aheadMention && !/(^|\/)AGENTS\.md$/.test(aheadMention[1])) continue;
      const quoted = rest.match(/^\s*["“]([^"”\n]+)["”]/);
      if (quoted) {
        // "Sezione → sottosezione": la freccia introduce un percorso, non un titolo
        const ref = quoted[1].split('→')[0].trim();
        if (ref) refs.push({ ref, line: i + 1 });
        continue;
      }
      const bare = rest.match(/^\s*([^,\n§`()"/]{1,60})/);
      if (bare) {
        const t = bare[1].split(' (')[0].split('→')[0].replace(/[.\s]+$/, '');
        if (t) refs.push({ ref: t, line: i + 1 });
      }
    }
  });
  return refs;
}

function checkAnchors() {
  const agents = requireFile(join(root, 'AGENTS.md'), 'C4');
  const headings = extractHeadings(agents).map((h) => normalizeTitle(h));
  if (headings.length === 0) {
    fail('C4: nessun heading trovato in AGENTS.md');
    return;
  }

  const broken = [];
  let total = 0;

  for (const target of LIVE_SCAN) {
    let files = [];
    if (target.path) {
      files = [join(root, target.path)];
    } else {
      files = listFiles(join(root, target.dir), (f) => {
        const rel = relative(root, f).split(sep).join('/');
        if (target.skipFiles && target.skipFiles.some((s) => rel.endsWith(`/${s}`) || rel === s)) return false;
        if (target.skipDirs && target.skipDirs.some((d) => rel.includes(`/${d}/`))) return false;
        return target.exts.some((e) => f.endsWith(e));
      });
    }
    for (const file of files) {
      if (!existsSync(file)) continue;
      const text = readFileSync(file, 'utf8');
      const selfIsAgents = /(^|\/)AGENTS\.md$/.test(file.replace(/\\/g, '/'));
      for (const { ref, line } of extractRefs(text, selfIsAgents)) {
        const key = normalizeTitle(ref);
        if (key.length < 2) continue;
        total++;
        const resolved = headings.some((h) => h.startsWith(key) || key.startsWith(h));
        if (!resolved) {
          broken.push(`${relative(root, file).replace(/\\/g, '/')}:${line} -> §${ref}`);
        }
      }
    }
  }

  if (broken.length) {
    fail(`C4: ${broken.length} riferimenti ad AGENTS.md non risolvono a un heading esistente:`);
    for (const b of broken) console.error(`       ${b}`);
    return;
  }
  ok(`C4: integrita' degli anchor — ${total} riferimenti, tutti risolti (${headings.length} heading)`);
}

// ---------------------------------------------------------------------------
// C5 - script e flag citati esistono
// ---------------------------------------------------------------------------

/** Blocchi di codice (fenced) di un testo markdown. */
function fencedBlocks(text) {
  const blocks = [];
  const re = /```[^\n]*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) blocks.push(m[1]);
  return blocks;
}

/** Flag dichiarati nel blocco `param(...)` di uno script PowerShell. */
function declaredFlags(ps1) {
  const start = ps1.indexOf('param(');
  if (start === -1) return new Set();
  const end = ps1.indexOf('\n)', start);
  const block = ps1.slice(start, end === -1 ? undefined : end);
  const flags = new Set();
  for (const m of block.matchAll(/\[\s*([^\]]*)\]\s*\$(\w+)/g)) {
    if (/(switch|string|int|long|double|bool|ValidateSet|ValidateNotNull|ValidateRange)/i.test(m[1])) {
      flags.add(m[2].toLowerCase());
    }
  }
  return flags;
}

function checkScriptsAndFlags() {
  const agents = requireFile(join(root, 'AGENTS.md'), 'C5');
  const code = fencedBlocks(agents).join('\n');

  // 1. gli script citati esistono
  const scripts = new Set();
  for (const m of code.matchAll(/\bscripts\/[A-Za-z0-9._-]+/g)) scripts.add(m[0]);
  let missingScripts = 0;
  for (const s of scripts) {
    if (!existsSync(join(root, s))) {
      fail(`C5: lo script citato non esiste: ${s}`);
      missingScripts++;
    }
  }

  // 2. i flag citati sono dichiarati dallo script
  const flagRe = /\bpwsh\s+(scripts\/[A-Za-z0-9._-]+\.ps1)\s+((?:-{1,2}[A-Za-z][\w-]*\s*)+)/g;
  let missingFlags = 0;
  for (const m of code.matchAll(flagRe)) {
    const full = join(root, m[1]);
    if (!existsSync(full)) continue;
    const declared = declaredFlags(readFileSync(full, 'utf8'));
    if (declared.size === 0) continue;
    for (const raw of m[2].trim().split(/\s+/)) {
      const name = raw.replace(/^-+/, '').toLowerCase();
      if (name.length < 2) continue; // alias di una lettera (es. -h): non verificabile
      if (!declared.has(name)) {
        fail(`C5: il flag "${raw}" citato per ${m[1]} non e' dichiarato come parametro`);
        missingFlags++;
      }
    }
  }

  if (missingScripts === 0 && missingFlags === 0) {
    ok(`C5: script e flag citati esistono (${scripts.size} script verificati)`);
  }
}

// ---------------------------------------------------------------------------
// C6 - nessuna checklist duplicata
// ---------------------------------------------------------------------------

function checkNoDuplicateChecklist() {
  const agents = requireFile(join(root, 'AGENTS.md'), 'C6');
  const template = requireFile(join(root, '.github', 'pull_request_template.md'), 'C6');

  // le sezioni che devono contenere solo un puntatore (nessuna copia)
  const pointerSections = ['Checklist di auto-revisione PR', 'Checklist PR aggiuntiva'];
  const lines = agents.split(/\r?\n/);
  let section = '';
  const itemsInPointerSections = [];
  const allItems = [];
  lines.forEach((line, i) => {
    const heading = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (heading) section = heading[1];
    const item = line.match(/^\s*[-*]\s+\[[ xX]\]\s+(.+?)\s*$/);
    if (!item) return;
    allItems.push({ text: item[1], line: i + 1 });
    if (pointerSections.some((s) => section.includes(s))) {
      itemsInPointerSections.push({ text: item[1], line: i + 1 });
    }
  });

  let drift = 0;
  if (itemsInPointerSections.length) {
    fail(`C6: la sezione "Checklist di auto-revisione PR" contiene ${itemsInPointerSections.length} voci: l'unico artifact e' .github/pull_request_template.md (decisione D3 di ADR-0012), AGENTS.md deve rimandare.`);
    for (const i of itemsInPointerSections.slice(0, 5)) console.error(`       riga ${i.line}: ${i.text}`);
    drift++;
  }

  // nessuna voce di AGENTS.md puo' essere una copia di una voce del template
  const templateItems = new Set(
    template
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*[-*]\s+\[[ xX]\]\s+(.+?)\s*$/))
      .filter(Boolean)
      .map((m) => normalizeTitle(m[1])),
  );
  const duplicated = allItems.filter((i) => templateItems.has(normalizeTitle(i.text)));
  if (duplicated.length) {
    fail(`C6: ${duplicated.length} voci di AGENTS.md sono copie di voci del PR template (un solo artifact).`);
    for (const i of duplicated.slice(0, 5)) console.error(`       riga ${i.line}: ${i.text}`);
    drift++;
  }

  if (drift === 0) {
    ok(`C6: nessuna checklist duplicata in AGENTS.md (${allItems.length} voci proprie, unico artifact: il PR template)`);
  }
}

// ---------------------------------------------------------------------------
// Esecuzione
// ---------------------------------------------------------------------------

console.log("[INFO] check-protocol-consistency: coerenza del protocollo agenti vs realta' del repository");

checkVersion();
checkLabelTable();
checkExitCodes();
checkAnchors();
checkScriptsAndFlags();
checkNoDuplicateChecklist();

console.log(`\n[INFO] check-protocol-consistency: 6 check, ${failures} falliti`);
process.exit(failures === 0 ? 0 : 1);
