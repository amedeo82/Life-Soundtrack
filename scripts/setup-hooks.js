#!/usr/bin/env node
// scripts/setup-hooks.js — configura `core.hooksPath` per il workflow agenti.
// Eseguito come `postinstall` in package.json. Idempotente e non-fatal.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const gitDir = resolve(repoRoot, '.git');
const hooksDir = resolve(repoRoot, '.githooks');

if (!existsSync(gitDir)) {
  console.log('[setup-hooks] .git non trovato, skip (CI o build container?)');
  process.exit(0);
}

if (!existsSync(hooksDir)) {
  console.log('[setup-hooks] .githooks/ non trovato, skip');
  process.exit(0);
}

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'inherit', cwd: repoRoot });
  console.log('[setup-hooks] OK: git config core.hooksPath .githooks');
} catch (err) {
  console.warn('[setup-hooks] WARN: git non disponibile. Eseguire manualmente dopo il clone:');
  console.warn('  git config core.hooksPath .githooks');
}

process.exit(0);
