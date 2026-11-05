#!/usr/bin/env node
/**
 * Test di scenario NEGATIVO del gate "privacy dei fixture" (issue #309).
 *
 * Perche' un test separato e non un assert dentro il gate: la lesson 43-1 del
 * repo ("un gate che passa sempre non e' un gate") si applica anche ai gate.
 * Un gate che esce 0 su tutto non dimostra nulla: il test deve costruire un
 * repository con dati REALI e dimostrare che il gate lo RESPINTA.
 *
 * Ogni scenario costruisce una directory temporanea con fixture sintetici,
 * esegue il gate su quella directory (`--dir`) e verifica l'exit code atteso.
 *
 * Uso: node scripts/test-fixtures-privacy-gate.mjs
 *
 * Exit code: 0 = tutti gli scenari passano, 1 = un scenario e' fallito,
 * 2 = errore di ambiente.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'check-fixtures-privacy.mjs');

let passed = 0;
let failed = 0;

function ok(msg) {
  passed++;
  console.log(`[OK] ${msg}`);
}

function fail(msg) {
  failed++;
  console.error(`[FAIL] ${msg}`);
}

/**
 * Esegue il gate su una directory temporanea e restituisce { code, out }.
 * Non lancia: l'exit code del gate e' il dato da verificare.
 */
function runGate(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ls-fixtures-privacy-'));
  try {
    for (const [relPath, content] of Object.entries(files)) {
      const full = join(dir, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, 'utf8');
    }
    let code = 0;
    let out = '';
    try {
      out = execFileSync(process.execPath, [scriptPath, '--dir', dir], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      code = typeof err.status === 'number' ? err.status : 2;
      out = `${err.stdout || ''}${err.stderr || ''}`;
    }
    return { code, out };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- scenari -----------------------------------------------------------------

console.log('[INFO] test-fixtures-privacy-gate: scenari T1..T6');

// T1 — fixture con IP pubblico reale: il gate DEVE fallire.
{
  const { code, out } = runGate({
    'spotify-sample.json': JSON.stringify({
      events: [{ ts: '2024-04-01T18:00:00Z', ip_addr: '92.40.100.50' }],
    }),
  });
  if (code === 1 && out.includes('ipv4-routable')) {
    ok('T1 IP pubblico reale respinto (exit 1, ipv4-routable)');
  } else {
    fail(`T1 atteso exit 1 con ipv4-routable, ottenuto exit ${code}: ${out.trim()}`);
  }
}

// T2 — email reale: il gate DEVE fallire.
{
  const { code, out } = runGate({
    'lastfm-sample.json': JSON.stringify({
      user: { email: 'mario.rossi@gmail.com' },
    }),
  });
  if (code === 1 && out.includes('email-reale')) {
    ok('T2 email reale respinta (exit 1, email-reale)');
  } else {
    fail(`T2 atteso exit 1 con email-reale, ottenuto exit ${code}: ${out.trim()}`);
  }
}

// T3 — path con nome utente: il gate DEVE fallire.
{
  const { code, out } = runGate({
    'notes.md': 'Esportato da C:\\Users\\mario.rossi\\Downloads\\streaming-history.json\n',
  });
  if (code === 1 && out.includes('user-path')) {
    ok('T3 path con nome utente respinto (exit 1, user-path)');
  } else {
    fail(`T3 atteso exit 1 con user-path, ottenuto exit ${code}: ${out.trim()}`);
  }
}

// T4 — dati sintetici leciti: il gate DEVE accettare.
{
  const { code, out } = runGate({
    'spotify-sample.json': JSON.stringify({
      events: [
        { ts: '2024-04-01T18:00:00Z', ip_addr: '192.0.2.50' },
        { ts: '2024-04-01T18:00:00Z', ip_addr: '198.51.100.10' },
        { ts: '2024-04-01T18:00:00Z', ip_addr: '203.0.113.20' },
        { ts: '2024-04-01T18:00:00Z', ip_addr: '192.168.1.1' },
      ],
    }),
    'lastfm-sample.json': JSON.stringify({
      user: { email: 'test@example.com', name: 'Test User' },
    }),
    'notes.md': 'Generato da /home/testuser/runner/work\n',
  });
  if (code === 0) {
    ok('T4 dati sintetici leciti accettati (exit 0)');
  } else {
    fail(`T4 atteso exit 0, ottenuto exit ${code}: ${out.trim()}`);
  }
}

// T5 — directory inesistente: il gate DEVE fallire chiuso (exit 2, non 0).
{
  const { code } = runGate({});
  // `runGate` pulisce la directory: qui si testa un path che non esiste.
  const missing = join(tmpdir(), 'ls-fixtures-privacy-does-not-exist-' + Date.now());
  let realCode = 0;
  try {
    execFileSync(process.execPath, [scriptPath, '--dir', missing], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    realCode = typeof err.status === 'number' ? err.status : 2;
  }
  if (realCode === 2) {
    ok('T5 directory inesistente respinta chiusa (exit 2, fail-closed)');
  } else {
    fail(
      `T5 atteso exit 2, ottenuto exit ${realCode} (il gate ha dichiarato "pulito" senza guardare)`,
    );
  }
  if (code !== 0 && code !== 2) {
    fail(`T5 scenario ausiliario incoerente: exit ${code}`);
  }
}

// T6 — piu' finding nella stessa directory: il gate DEVE elencarli TUTTI.
{
  const { code, out } = runGate({
    'a.json': JSON.stringify({ ip: '92.40.100.50', mail: 'a@gmail.com' }),
    'b.json': JSON.stringify({ ip: '85.20.40.10' }),
  });
  const hasIp = out.includes('92.40.100.50') && out.includes('85.20.40.10');
  const hasMail = out.includes('a@gmail.com');
  if (code === 1 && hasIp && hasMail) {
    ok('T6 tutti i finding elencati (exit 1, 3 finding)');
  } else {
    fail(`T6 atteso exit 1 con tutti i finding, ottenuto exit ${code}: ${out.trim()}`);
  }
}

// --- esito -------------------------------------------------------------------

console.log('');
console.log(`[INFO] scenari passati: ${passed}, falliti: ${failed}`);
if (failed > 0) {
  console.error('[FAIL] il gate "privacy dei fixture" non si comporta come specificato');
  process.exit(1);
}
console.log('[OK] gate "privacy dei fixture": comportamento specificato in tutti gli scenari');
process.exit(0);
