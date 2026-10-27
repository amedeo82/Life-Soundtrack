#!/usr/bin/env node
/**
 * Gate "fatti del README" (issue #161).
 *
 * Il README dichiara fatti che il codice può contraddire: l'elenco delle
 * piattaforme importabili, le funzionalita' presenti, i conteggi di stato.
 * Finche' nessun gate confronta la prosa con il codice, il drift e' silenzioso:
 * i merge delle Story 1.2 e 1.3 non hanno toccato `README.md`, e i 16 gate di
 * `ci.yml` restavano verdi lo stesso (la prosa era rimasta quella del
 * bootstrap, del 2026-10-14).
 *
 * Il gate e' **read-only**: non genera e non scrive nulla. Motivo: `README.md`
 * e' gia' un target di `scripts/aggregate-state.ps1` (blocchi `AGGREGATE-*`),
 * e un secondo writer sullo stesso file riprodurrebbe la race fra i writer di
 * `main` risolta dall'issue #149. Qui si verifica, non si riscrive.
 *
 * Fonti di verita':
 *   1. `apps/web/src/onboarding/OnboardingRouter.tsx`
 *      - `ADAPTER_FACTORIES`: platform id -> classe adapter
 *      - `ACTIVE_PLATFORMS`: le piattaforme che l'utente puo' davvero importare
 *   2. `packages/core/src/adapters/`: le classi adapter devono esistere
 *   3. `README.md`: la prosa dichiarata
 *
 * Uso: node scripts/check-readme-facts.mjs [--root <dir>]
 *
 * Exit code: 0 = in sync, 1 = drift, 2 = errore di ambiente (file mancante).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const root = resolve(rootIdx >= 0 ? argv[rootIdx + 1] : '.');

const README = join(root, 'README.md');
const ROUTER = join(root, 'apps/web/src/onboarding/OnboardingRouter.tsx');
const ADAPTERS_DIR = join(root, 'packages/core/src/adapters');

/**
 * Funzionalita' non ancora implementate: non possono essere dichiarate come
 * presenti dal README. Sono le capability degli EPIC 2 (analisi) e 4
 * (enrichment), piu' il vocabolo "ricordi" che le descrive.
 *
 * Nota sul perimetro: `ere` non e' nella lista perche' in italiano e' una
 * parola comune ("l'era della Fase 0") e produrrebbe falsi positivi; il
 * concetto e' coperto da `mood` e `ricordi`.
 */
const FORBIDDEN_CAPABILITIES = [
  { re: /enrichment/i, label: 'enrichment (EPIC 4)' },
  { re: /audio features?/i, label: 'audio features (EPIC 4)' },
  { re: /\bvalence\b/i, label: 'valence (EPIC 4)' },
  { re: /\bdanceability\b/i, label: 'danceability (EPIC 4)' },
  { re: /\bBPM\b/, label: 'BPM (EPIC 4)' },
  { re: /\bmoods?\b/i, label: 'mood (EPIC 2)' },
  { re: /\bricordi\b/i, label: 'ricordi (EPIC 2)' },
];

const SECTION_TODAY = /cosa c['\u2019][e\u00E8] oggi|cosa fa/i;
const SECTION_PLATFORMS = /piattaforme/i;
const SECTION_ROADMAP = /roadmap|prossimi passi|non ancora/i;
const SECTION_STATUS = /stato del progetto/i;

let failures = 0;
let checks = 0;

function fail(message) {
  console.error(`[FAIL] ${message}`);
  failures++;
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function requireFile(path) {
  if (!existsSync(path)) {
    console.error(`[FAIL] file non trovato: ${path}`);
    process.exit(2);
  }
  return readFileSync(path, 'utf8');
}

/** Cerca una classe `export class <name>` nell'albero degli adapter. */
function findAdapterClass(className) {
  const stack = [ADAPTERS_DIR];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      const text = readFileSync(full, 'utf8');
      if (new RegExp(`export\\s+class\\s+${className}\\b`).test(text)) return full;
    }
  }
  return null;
}

/**
 * Divide il markdown in sezioni di livello 2 (`## `). I heading di altro
 * livello restano DENTRO la sezione: le sottosezioni (`###`) fanno parte
 * della sezione e servono al gate (es. "Piattaforme importabili").
 */
function splitSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = { heading: '(preambolo)', level: 0, lines: [] };
  for (const line of lines) {
    const m = /^(##)\s+(.*)$/.exec(line);
    if (m) {
      sections.push(current);
      current = { heading: m[2].trim(), level: 2, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  sections.push(current);
  return sections;
}

/**
 * Rimuove i blocchi auto-generati `<!-- AGGREGATE-*-START -->` … `-END -->`.
 * Il loro contenuto non e' prosa scritta a mano: e' output di
 * `scripts/aggregate-state.ps1`, gia' coperto dal gate dell'aggregator. Lasciarli
 * dentro farebbe fallire il gate su una stringa che l'agente non ha scritto —
 * per esempio il titolo di una story "Dedup promozione post-enrichment".
 */
function stripAggregateBlocks(text) {
  return text.replace(
    /<!--\s*AGGREGATE-[A-Z-]+-START\s*-->[\s\S]*?<!--\s*AGGREGATE-[A-Z-]+-END\s*-->/g,
    '',
  );
}

/** Corpo di una sottosezione (fino al prossimo heading di qualsiasi livello). */
function subsectionBody(section, predicate) {
  const lines = section.lines;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (m && predicate.test(m[2].trim())) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return null;
  const body = [];
  for (let i = start; i < lines.length; i++) {
    if (/^#{1,6}\s+/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join('\n');
}

// === 1. Codice: factory e piattaforme attive ===

const router = requireFile(ROUTER);
if (!existsSync(ADAPTERS_DIR)) {
  console.error(`[FAIL] directory non trovata: ${ADAPTERS_DIR}`);
  process.exit(2);
}

/**
 * Estrae il corpo di un oggetto literal a partire dal nome del simbolo.
 * Non si puo' usare `[^=]*` per arrivare all'assegnamento: l'annotazione di
 * tipo contiene essa stessa un `=` (`() => PlatformAdapter`), e il pattern
 * sbaglierebbe la fine del match.
 */
function extractObjectBody(source, symbol) {
  const at = source.indexOf(symbol);
  if (at < 0) return null;
  const open = source.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

const factoriesBody = extractObjectBody(router, 'ADAPTER_FACTORIES');
if (factoriesBody === null) {
  console.error('[FAIL] ADAPTER_FACTORIES non trovato in OnboardingRouter.tsx');
  process.exit(2);
}
const factories = new Map();
for (const m of factoriesBody.matchAll(/(\w+)\s*:\s*\(\)\s*=>\s*new\s+(\w+)\s*\(/g)) {
  factories.set(m[1], m[2]);
}

const activeBlock = /ACTIVE_PLATFORMS[^=]*=\s*\[([\s\S]*?)\];/.exec(router);
if (!activeBlock) {
  console.error('[FAIL] ACTIVE_PLATFORMS non trovato in OnboardingRouter.tsx');
  process.exit(2);
}
const active = [...activeBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

checks++;
if (factories.size === 0) {
  fail('ADAPTER_FACTORIES e vuoto: nessuna piattaforma esposta');
} else {
  ok(`factory adapter nel codice: ${[...factories.keys()].sort().join(', ')}`);
}

checks++;
const orphanFactories = [...factories.keys()].filter((id) => !active.includes(id));
if (orphanFactories.length > 0) {
  fail(
    `adapter implementato ma non esposto in ACTIVE_PLATFORMS: ${orphanFactories.join(', ')} ` +
      '(oppure la UI non e ancora cablata: il README elencerebbe una piattaforma non importabile)',
  );
} else {
  ok('ogni factory adapter corrisponde a una piattaforma attiva');
}

checks++;
const missingFactories = active.filter((id) => !factories.has(id));
if (missingFactories.length > 0) {
  fail(`piattaforma attiva senza factory adapter: ${missingFactories.join(', ')}`);
} else {
  ok('ogni piattaforma attiva ha una factory adapter');
}

for (const id of active) {
  const className = factories.get(id);
  if (!className) continue;
  checks++;
  const path = findAdapterClass(className);
  if (!path) {
    fail(`la classe ${className} (piattaforma ${id}) non esiste in packages/core/src/adapters/`);
  } else {
    ok(`classe ${className} presente (${path.replace(root + '\\', '').replace(root + '/', '')})`);
  }
}

// === 2. README: sezioni e piattaforme dichiarate ===

const readme = requireFile(README);
const sections = splitSections(readme);

const todaySection = sections.find((s) => s.level === 2 && SECTION_TODAY.test(s.heading));
const roadmapSection = sections.find((s) => s.level === 2 && SECTION_ROADMAP.test(s.heading));
const statusSection = sections.find((s) => s.level === 2 && SECTION_STATUS.test(s.heading));

checks++;
if (!todaySection) {
  fail(
    'README.md: manca la sezione "Cosa c\'e oggi" (il gate non puo verificare le capability dichiarate)',
  );
} else {
  ok(`sezione "oggi" trovata: ${todaySection.heading}`);
}

checks++;
if (!roadmapSection) {
  fail(
    'README.md: manca la sezione roadmap: le funzionalita non implementate devono stare li, ' +
      'dove il gate le ammette',
  );
} else {
  ok(`sezione roadmap trovata: ${roadmapSection.heading}`);
}

checks++;
if (!statusSection) {
  fail('README.md: manca la sezione "Stato del progetto"');
} else {
  ok(`sezione "stato del progetto" trovata: ${statusSection.heading}`);
}

const declaredPlatforms = [];
if (todaySection) {
  const body = subsectionBody(todaySection, SECTION_PLATFORMS);
  checks++;
  if (body === null) {
    fail(
      'README.md: manca la sottosezione "Piattaforme ..." dentro "Cosa c\'e oggi": ' +
        "e il punto in cui il gate legge l'elenco delle piattaforme importabili",
    );
  } else {
    for (const m of body.matchAll(/`([a-z][a-z0-9_]*)`/g)) declaredPlatforms.push(m[1]);
    const unique = [...new Set(declaredPlatforms)].sort();
    checks++;
    const missing = active.filter((id) => !unique.includes(id));
    const extra = unique.filter((id) => !active.includes(id));
    if (missing.length > 0 || extra.length > 0) {
      fail(
        "README.md: l'elenco delle piattaforme non corrisponde al codice" +
          (missing.length > 0 ? ` — mancanti: ${missing.join(', ')}` : '') +
          (extra.length > 0 ? ` — inesistenti: ${extra.join(', ')}` : '') +
          `. Nel codice (ACTIVE_PLATFORMS): ${active.slice().sort().join(', ')}`,
      );
    } else {
      ok(`README.md: piattaforme dichiarate in sync con il codice (${unique.join(', ')})`);
    }
  }
}

// === 3. Capability non implementate fuori dalla roadmap ===

checks++;
const offenders = [];
for (const section of sections) {
  if (section.level !== 2) continue;
  if (roadmapSection && section.heading === roadmapSection.heading) continue;
  if (SECTION_ROADMAP.test(section.heading)) continue;
  const text = stripAggregateBlocks(section.lines.join('\n'));
  for (const cap of FORBIDDEN_CAPABILITIES) {
    if (cap.re.test(text)) offenders.push(`"${section.heading}" -> ${cap.label}`);
  }
}
if (offenders.length > 0) {
  fail(
    'README.md: funzionalita non ancora implementate dichiarate come presenti: ' +
      offenders.join(' | '),
  );
} else {
  ok('README.md: nessuna capability non implementata dichiarata fuori dalla roadmap');
}

// === 4. Nessun conteggio duplicato in prosa ===

checks++;
if (statusSection) {
  const text = stripAggregateBlocks(statusSection.lines.join('\n'));
  const counts = [...text.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)].map((m) => m[0]);
  if (counts.length > 0) {
    fail(
      `README.md §"${statusSection.heading}": conteggi duplicati in prosa (${counts.join(', ')}). ` +
        'I conteggi di stato vivono nei blocchi aggregati di docs/INDEX.md e docs/11-BACKLOG.md: ' +
        'metti un puntatore, non una copia.',
    );
  } else {
    ok('README.md §"stato del progetto": nessun conteggio duplicato in prosa');
  }
}

console.log('');
console.log(`[INFO] check-readme-facts: ${checks} check, ${failures} falliti`);
process.exit(failures > 0 ? 1 : 0);
