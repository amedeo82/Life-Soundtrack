#!/usr/bin/env bash
# Test di regressione per la copertura `git add` vs `$targets` dell'aggregator (issue #136).
#
# Difende il bug chiuso in issue #136: `post-merge.yml` genera il blocco
# `AGGREGATE-NEXT-STEP-*` del README.md (quinto target di scripts/aggregate-state.ps1,
# introdotto da ADR-0008 V3 / issue #127) e poi lo scarta, perche' `README.md` non era
# nella riga `git add`. Il blocco restava congelato allo stato in cui era quando V3 ha
# atterrato, e il drift restava invisibile perche' il fallback generato coincideva per
# caso col testo in file.
#
# La radice non era il workflow: erano due elenchi che descrivevano lo stesso insieme
# di file tenuti in due posti diversi (riga `git add` vs array `$targets`) senza nessun
# gate che li confrontasse. Il gate vive ora in scripts/validate-workflows.mjs (gia'
# bloccante in CI); questo file e' il suo test di regressione: verifica che il gate
# esce 0 sul repo vero e che **esce 1** quando si reintroduce il bug.
#
# Scenari coperti:
#   T1  repo reale: `git add` copre tutti i $targets -> exit 0
#   T2  fixture con README.md rimosso dalla riga `git add` (il bug di #136) -> exit 1,
#       con messaggio che nomina il path mancante
#   T3  fixture senza alcuna riga `git add` -> exit 1 (target non committati)
#   T4  fixture che copre i target via directory staged (`git add .`) -> exit 0
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-workflows.mjs"
AGGREGATOR="$SCRIPT_DIR/aggregate-state.ps1"
WORKFLOW="$REPO_ROOT/.github/workflows/post-merge.yml"

if ! command -v node >/dev/null 2>&1; then
  echo "[SKIP] node non disponibile: impossibile eseguire validate-workflows.mjs"
  exit 0
fi

pass=0
fail=0
ok() { echo "  [PASS] $1"; pass=$((pass + 1)); }
ng() { echo "  [FAIL] $1"; fail=$((fail + 1)); }

# Repo fixture: .github/workflows/ + scripts/ con l'aggregator e il validator reali.
# La struttura conta: validate-workflows.mjs risolve repoRoot come <dir>/../.. .
make_fixture() {
  local d="$1"
  mkdir -p "$d/.github/workflows" "$d/scripts"
  cp "$VALIDATOR" "$d/scripts/validate-workflows.mjs"
  cp "$AGGREGATOR" "$d/scripts/aggregate-state.ps1"
  cp "$WORKFLOW" "$d/.github/workflows/post-merge.yml"
}

run_validator() {
  local d="$1"
  node "$d/scripts/validate-workflows.mjs" "$d/.github/workflows" 2>&1
}

echo "=== T1: repo reale - la riga \`git add\` copre tutti i \$targets ==="
out="$(node "$VALIDATOR" "$REPO_ROOT/.github/workflows" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (README.md incluso nei target e nella riga git add)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -5)"; fi
if echo "$out" | grep -q "copre tutti i .* \$targets"; then ok "messaggio di copertura presente"; else ng "manca il messaggio di copertura"; fi

echo "=== T2: fixture senza README.md nella riga \`git add\` (reintroduzione del bug #136) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  # Reintroduce esattamente il bug: toglie README.md dalla riga git add.
  # La riga `git add` deve coprire TUTTI i $targets: la mutazione li rimuove
  # da OGNI riga `git add` del workflow (con il retry ce n'e' piu' di una:
  # quella preventiva e quella dentro il ciclo di ri-sincronizzazione).
  sed -i.bak '/git add/ s#README\.md##g' "$D/.github/workflows/post-merge.yml"
  if grep -qE '^[[:space:]]*git add .*README\.md' "$D/.github/workflows/post-merge.yml"; then
    ng "mutazione non applicata: README.md e' ancora nella riga git add"
  else
    ok "mutazione applicata (README.md rimosso dalla riga git add)"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (gate bloccante sul target non coperto)"; else ng "exit $ec (atteso 1): il gate NON intercetta il bug"; fi
  if echo "$out" | grep -q "README.md"; then ok "il messaggio nomina il path mancante"; else ng "il messaggio non cita README.md: $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo "=== T3: fixture senza nessuna riga \`git add\` ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak '/^[[:space:]]*git add /d' "$D/.github/workflows/post-merge.yml"

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (nessun target committato)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -5)"; fi
  if echo "$out" | grep -q "git add"; then ok "il messaggio spiega che manca la riga git add"; else ng "messaggio non esplicativo"; fi

  cd /; rm -rf "$D"
}

echo "=== T4: copertura via directory staged invece di path singoli ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  # `git add .` copre tutti i $targets per prefisso: il gate deve accettare la
  # forma "directory" senza pretendere i path letterali.
  sed -i.bak 's#^\(\s*git add \).*#\1.#' "$D/.github/workflows/post-merge.yml"

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 0 ]; then ok "exit 0 (copertura per directory accettata)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]