#!/usr/bin/env bash
# Test di regressione per il gate di PORTABILITA' dei generatori (issue #284).
#
# Il gate `scripts/check-generators-portable.mjs` verifica che i generatori,
# rieseguiti su un sistema operativo, riproducano i BYTE committati. E' la
# prova empirica dell'indipendenza dal sistema operativo: se un generatore
# dipendesse dalla locale, dal fuso orario o dai line ending, il diff sarebbe
# non vuoto e il gate fallirebbe.
#
# Il test e' ermetico: lo scenario negativo lavora in un worktree temporaneo
# (creato da `git worktree add --detach`), dove il generatore viene alterato
# in modo che produca un output diverso da quello committato.
#
# Scenari coperti:
#   T1  repo reale: i generatori riproducono lo stato committato -> exit 0
#   T2  worktree con il generatore alterato -> exit 1 (il gate intercetta)
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

echo "=== T1: repo reale - i generatori riproducono lo stato committato ==="
out="$(node "$GATE" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then
  ok "exit 0 (output identico a parita' di stato)"
else
  ng "exit $ec (atteso 0): $(echo "$out" | tail -8)"
fi

echo "=== T2: generatore alterato in un worktree - il gate deve intercettare ==="
WT="$(mktemp -d)/wt"
cleanup() {
  git -C "$REPO_ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true
  git -C "$REPO_ROOT" worktree prune >/dev/null 2>&1 || true
  rm -rf "$(dirname "$WT")" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! git -C "$REPO_ROOT" worktree add --detach "$WT" HEAD >/dev/null 2>&1; then
  echo "  [SKIP] non e' stato possibile creare il worktree temporaneo"
  echo ""
  echo "=== Risultato: $pass pass, $fail fail ==="
  exit 0
fi

# Il generatore produce un testo diverso: il gate deve accorgersene.
if sed -i 's/- Totale file: /- Totale file (mutato): /' "$WT/scripts/aggregate-state.ps1"; then
  ok "mutazione applicata (il generatore produce un output diverso)"
else
  ng "mutazione non applicata"
fi

out="$(cd "$WT" && node "$GATE" 2>&1)"; ec=$?
if [ $ec -eq 1 ]; then
  ok "exit 1 (il gate intercetta l'output divergente)"
else
  ng "exit $ec (atteso 1): $(echo "$out" | tail -8)"
fi
if echo "$out" | grep -q "output DIVERSO"; then
  ok "il messaggio nomina la divergenza"
else
  ng "il messaggio non nomina la divergenza: $(echo "$out" | tail -4)"
fi

echo ""
echo "=== Risultato: $pass pass, $fail fail ==="
if [ $fail -gt 0 ]; then
  echo "[FAIL] il gate di portabilita' non intercetta un generatore divergente: non e' un gate"
  exit 1
fi
echo "[OK] il gate di portabilita' intercetta l'output divergente"
exit 0
