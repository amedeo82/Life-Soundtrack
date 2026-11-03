#!/usr/bin/env bash
# Test di regressione per il gate di PORTABILITA' dei generatori (issue #284).
#
# Il gate `scripts/check-generators-portable.mjs` verifica tre proprieta':
#
#   1. **Determinismo**: due rigenerazioni consecutive producono gli stessi
#      byte.
#   2. **Invarianti del repo**: il bundle e' in sync con lo stato committato.
#   3. **Cross-OS**: il manifest dei file generati (sha256 per file) prodotto
#      su un sistema operativo e' identico a quello prodotto su un altro. In CI
#      i due manifest sono prodotti dalla matrix `gates-portability` (ubuntu +
#      windows) e confrontati dal job `gates-portability-compare`.
#
# Il test e' ermetico: lo scenario negativo costruisce un manifest alterato
# (simula "l'altro sistema operativo ha prodotto byte diversi") e verifica che
# il confronto lo intercetti.
#
# Scenari coperti:
#   T1  repo reale: il gate passa (determinismo + invarianti) -> exit 0
#   T2  il manifest e' scritto e il confronto di due manifest identici passa -> exit 0
#   T3  manifest alterato: il confronto fallisce -> exit 1
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GATE="$SCRIPT_DIR/check-generators-portable.mjs"

if ! command -v node >/dev/null 2>&1; then
  echo "[SKIP] node non disponibile"
  exit 0
fi
if ! command -v pwsh >/dev/null 2>&1; then
  echo "[SKIP] pwsh non disponibile: il gate richiede PowerShell 7+"
  exit 0
fi

pass=0
fail=0
ok() { echo "  [PASS] $1"; pass=$((pass + 1)); }
ng() { echo "  [FAIL] $1"; fail=$((fail + 1)); }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "=== T1: repo reale - determinismo e invarianti del repo ==="
out="$(node "$GATE" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then
  ok "exit 0 (determinismo + invarianti)"
else
  ng "exit $ec (atteso 0): $(echo "$out" | tail -8)"
fi

echo "=== T2: manifest e confronto di due manifest identici ==="
out="$(node "$GATE" --manifest "$WORK/a.json" 2>&1)"; ec=$?
if [ $ec -eq 0 ] && [ -s "$WORK/a.json" ]; then
  ok "exit 0 e manifest scritto"
else
  ng "exit $ec (atteso 0) o manifest mancante: $(echo "$out" | tail -6)"
fi
cp "$WORK/a.json" "$WORK/b.json"
out="$(node "$GATE" --compare "$WORK/a.json" --compare "$WORK/b.json" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then
  ok "exit 0 (due manifest identici sono equivalenti)"
else
  ng "exit $ec (atteso 0): $(echo "$out" | tail -6)"
fi

echo "=== T3: manifest alterato (l'altro OS ha prodotto byte diversi) ==="
node -e '
const fs=require("node:fs");
const p=process.argv[1];
const m=JSON.parse(fs.readFileSync(p,"utf8"));
const k=Object.keys(m)[0];
m[k]="0".repeat(64);
fs.writeFileSync(p, JSON.stringify(m,null,2)+"\n");
' "$WORK/b.json"
out="$(node "$GATE" --compare "$WORK/a.json" --compare "$WORK/b.json" 2>&1)"; ec=$?
if [ $ec -eq 1 ]; then
  ok "exit 1 (il confronto intercetta la divergenza cross-OS)"
else
  ng "exit $ec (atteso 1): $(echo "$out" | tail -6)"
fi
if echo "$out" | grep -q "output DIVERSI"; then
  ok "il messaggio nomina la divergenza cross-OS"
else
  ng "il messaggio non nomina la divergenza: $(echo "$out" | tail -4)"
fi

echo ""
echo "=== T4: la normalizzazione dei campi mutabili rende l'hash invariante ==="
# I campi mutabili (Data del bundle, Ultima aggregazione) cambiano a ogni
# esecuzione: se l'hash li includesse, il confronto cross-OS sarebbe
# falsamente positivo quando i due job cadono in minuti diversi (misurato il
# 2026-11-03: docs/BUNDLE.md con hash diversi su ubuntu e windows, senza
# differenze reali). Il confronto deve essere INVARIANTE rispetto a questi
# campi.
if node --input-type=module -e '
import { normalizeMutable } from "./scripts/check-generators-portable.mjs";
const a = normalizeMutable("> Data: 2026-01-01 00:00\n- Ultima aggregazione: 2026-01-01 00:00\ncorpo\n");
const b = normalizeMutable("> Data: 2026-12-31 23:59\n- Ultima aggregazione: 2026-12-31 23:59\ncorpo\n");
if (a !== b) {
  console.error("la normalizzazione NON rende invariante l hash rispetto ai campi mutabili");
  process.exit(1);
}
const c = normalizeMutable("> Data: 2026-01-01 00:00\n- Ultima aggregazione: 2026-01-01 00:00\ncorpo DIVERSO\n");
if (a === c) {
  console.error("la normalizzazione nasconde anche le differenze REALI di contenuto");
  process.exit(1);
}
' 2>/dev/null; then
  ok "T4 l'hash e' invariante rispetto ai timestamp mutabili e sensibile al contenuto reale"
else
  ng "T4 la normalizzazione dei campi mutabili non e' corretta"
fi

echo ""
echo "=== Risultato: $pass pass, $fail fail ==="
if [ $fail -gt 0 ]; then
  echo "[FAIL] il gate di portabilita' non intercetta un manifest divergente: non e' un gate"
  exit 1
fi
echo "[OK] il gate di portabilita' intercetta la divergenza cross-OS"
exit 0
