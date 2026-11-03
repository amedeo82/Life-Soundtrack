#!/usr/bin/env node
// scripts/setup-hooks.js — configura `core.hooksPath` per il workflow agenti.
// Eseguito come `postinstall` in package.json. Idempotente e non-fatal.
//
// Sessione 93 (issue #290): il percorso degli hook era in realta' `.husky/_`.
// `package.json` dichiarava anche `"prepare": "husky"` e husky v9 scrive
// `core.hooksPath = .husky/_` nel suo lifecycle `prepare`, che pnpm esegue
// DOPO `postinstall`: il setup di questo script veniva sovrascritto a ogni
// `pnpm install` e i tre hook del repository (`.githooks/pre-commit`,
// `.githooks/pre-push`, `.githooks/post-checkout`) non sono mai stati
// eseguiti. Ora `husky` non e' piu' una dipendenza e `.githooks` e' l'unico
// hooks path.
//
// Il setup non si limita a scrivere il valore: lo RILEGGE e avvisa se qualcosa
// lo ha cambiato, e segnala i sintomi di un secondo sistema di hook (la
// cartella `.husky/`), che e' la causa storica del difetto.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const gitDir = resolve(repoRoot, '.git');
const hooksDir = resolve(repoRoot, '.githooks');
const HOOKS_PATH = '.githooks';
// Gli hook che il repository si aspetta di trovare nel percorso configurato.
const EXPECTED_HOOKS = ['pre-commit', 'commit-msg', 'pre-push', 'post-checkout'];

if (!existsSync(gitDir)) {
  console.log('[setup-hooks] .git non trovato, skip (CI o build container?)');
  process.exit(0);
}

if (!existsSync(hooksDir)) {
  console.log('[setup-hooks] .githooks/ non trovato, skip');
  process.exit(0);
}

try {
  execSync(`git config core.hooksPath ${HOOKS_PATH}`, { stdio: 'inherit', cwd: repoRoot });
  console.log(`[setup-hooks] OK: git config core.hooksPath ${HOOKS_PATH}`);
} catch (err) {
  console.warn('[setup-hooks] WARN: git non disponibile. Eseguire manualmente dopo il clone:');
  console.warn(`  git config core.hooksPath ${HOOKS_PATH}`);
  process.exit(0);
}

// --- verifica che il valore sia quello appena scritto ------------------------
// Scrivere il valore non basta: un altro tooling puo' scriverne uno diverso
// subito dopo (e' esattamente quello che faceva husky). Rileggere e' l'unico
// modo per accorgersi che il setup e' stato annullato.
try {
  const applied = execSync('git config --get core.hooksPath', {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  if (applied !== HOOKS_PATH) {
    console.warn(`[setup-hooks] WARN: core.hooksPath vale "${applied}" e non "${HOOKS_PATH}".`);
    console.warn('  Gli hook del repository NON verranno eseguiti. Chi ha cambiato il valore?');
    console.warn(`  Ripristinalo con: git config core.hooksPath ${HOOKS_PATH}`);
  }
} catch (err) {
  console.warn(`[setup-hooks] WARN: impossibile rileggere core.hooksPath: ${err.message}`);
}

// --- un solo sistema di hook -------------------------------------------------
// La cartella `.husky/` e' il sintomo del difetto storico (issue #290): con
// `husky` installato, il suo lifecycle `prepare` scriveva il path degli hook
// DOPO il `postinstall` che lo configura, e i tre hook di `.githooks/` non
// giravano. Se la cartella ricompare, il problema torna.
if (existsSync(resolve(repoRoot, '.husky'))) {
  console.warn('[setup-hooks] WARN: esiste ancora la cartella .husky/.');
  console.warn('  Il lifecycle "prepare" di husky scrive core.hooksPath DOPO questo script');
  console.warn('  e lo sovrascrive: gli hook di .githooks/ non verrebbero eseguiti (issue #290).');
}

// --- gli hook attesi ci sono? -------------------------------------------------
const missing = EXPECTED_HOOKS.filter((hook) => !existsSync(resolve(hooksDir, hook)));
if (missing.length > 0) {
  console.warn(`[setup-hooks] WARN: hook mancanti in ${HOOKS_PATH}/: ${missing.join(', ')}`);
  console.warn('  Il percorso degli hook e configurato, ma i file non ci sono.');
}

process.exit(0);
