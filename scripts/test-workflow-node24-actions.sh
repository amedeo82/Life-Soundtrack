#!/usr/bin/env bash
# Test di regressione per il gate "nessuna action su node20" (issue #283).
#
# Node 20 e' stato rimosso dai runner GitHub il 2026-09-23: le action che
# dichiarano `using: 'node20'` non girano piu' su un runtime supportato. Il
# runner le forza su Node 24, ma il runtime dichiarato resta fuori supporto.
#
# Il gate vive in scripts/validate-workflows.mjs (gia' bloccante in CI); questo
# file e' il suo test di regressione: verifica che il gate **esca 1** quando
# il runtime node20 viene reintrodotto. Un gate che passa sempre non e' un
# gate (lesson 43-1).
#
# La mappa NODE24_ACTIONS del gate elenca la PRIMA major su node24 di ogni
# action di terze parti usata dal repository. Il gate e' fail-closed: un'azione
# assente dalla mappa non e' verificabile, e non e' accettata.
#
# Scenari coperti:
#   T1  repo reale: nessuna reference su node20 -> exit 0
#   T2  fixture con `actions/checkout@v4` (node20) -> exit 1, messaggio che
#       nomina il file, la riga e la major node24 attesa
#   T3  fixture con `actions/upload-artifact@v5`: e' la major PIU' RECENTE
#       dichiarata node20 (la v6 e' la prima su node24) -> exit 1
#   T4  fixture con un'azione assente dalla mappa -> exit 1 (fail-closed)
#   T5  fixture con un riferimento pinnato a SHA -> exit 1 (non verificabile)
#   T6  fixture con un'azione locale (`./.github/actions/...`) -> exit 0
#       (nessun falso positivo: le azioni locali non dichiarano un runtime)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-workflows.mjs"
AGGREGATOR="$SCRIPT_DIR/aggregate-state.ps1"
AUTO_AGGREGATE_WF="$REPO_ROOT/.github/workflows/post-merge.yml"
CI_WF="$REPO_ROOT/.github/workflows/ci.yml"

if ! command -v node >/dev/null 2>&1; then
  echo "[SKIP] node non disponibile: impossibile eseguire validate-workflows.mjs"
  exit 0
fi

pass=0
fail=0
ok() { echo "  [PASS] $1"; pass=$((pass + 1)); }
ng() { echo "  [FAIL] $1"; fail=$((fail + 1)); }

# Repo fixture minimo. La struttura conta: validate-workflows.mjs risolve
# repoRoot come <dir>/../.., e i gate di copertura `git add` (#136) e di
# single-writer (#284) falliscono se `post-merge.yml` o l'aggregator mancano:
# altrimenti T2-T6 passerebbero per il motivo sbagliato.
make_fixture() {
  local d="$1"
  mkdir -p "$d/.github/workflows" "$d/scripts"
  cp "$VALIDATOR" "$d/scripts/validate-workflows.mjs"
  cp "$AGGREGATOR" "$d/scripts/aggregate-state.ps1"
  cp "$AUTO_AGGREGATE_WF" "$d/.github/workflows/post-merge.yml"
  cp "$CI_WF" "$d/.github/workflows/ci.yml"
}

run_validator() {
  node "$1/scripts/validate-workflows.mjs" "$1/.github/workflows" 2>&1
}

echo "=== T1: repo reale - nessuna reference su node20 ==="
out="$(node "$VALIDATOR" "$REPO_ROOT/.github/workflows" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (nessuna action node20 in .github/workflows)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -5)"; fi
if echo "$out" | grep -q "reference a action su node24"; then ok "il riepilogo riporta le reference verificate"; else ng "manca il riepilogo delle reference a action"; fi
if echo "$out" | grep -q "dichiara il runtime node20"; then ng "il gate segnala un runtime node20 sul repo reale"; else ok "nessun runtime node20 nel repo reale"; fi

echo "=== T2: fixture con actions/checkout@v4 (reintroduzione del bug #283) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak '0,/actions\/checkout@v5/s//actions\/checkout@v4/' "$D/.github/workflows/ci.yml"
  if grep -q "actions/checkout@v4" "$D/.github/workflows/ci.yml"; then
    ok "mutazione applicata (checkout@v5 -> checkout@v4)"
  else
    ng "mutazione non applicata"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (gate bloccante sul runtime node20)"; else ng "exit $ec (atteso 1): il gate NON intercetta il bug"; fi
  if echo "$out" | grep -q "dichiara il runtime node20"; then ok "il messaggio nomina il runtime node20"; else ng "il messaggio non nomina il runtime: $(echo "$out" | tail -5)"; fi
  if echo "$out" | grep -q "ci.yml:[0-9]"; then ok "il messaggio cita il file e la riga"; else ng "il messaggio non cita file:riga"; fi
  if echo "$out" | grep -q "prima major su node24: v5"; then ok "il messaggio indica la major node24 attesa"; else ng "il messaggio non indica la major attesa"; fi

  cd /; rm -rf "$D"
}

echo "=== T3: fixture con actions/upload-artifact@v5 (ancora node20) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak 's#actions/upload-artifact@v6#actions/upload-artifact@v5#' "$D/.github/workflows/ci.yml"
  if grep -q "actions/upload-artifact@v5" "$D/.github/workflows/ci.yml"; then
    ok "mutazione applicata (upload-artifact@v6 -> upload-artifact@v5)"
  else
    ng "mutazione non applicata"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (v5 dichiara ancora node20)"; else ng "exit $ec (atteso 1): il gate NON intercetta il bug"; fi
  if echo "$out" | grep -q "prima major su node24: v6"; then ok "il messaggio indica v6 come prima major su node24"; else ng "il messaggio non indica v6: $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo "=== T4: fixture con un'azione assente dalla mappa (fail-closed) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak '0,/^\(      - uses: actions\/checkout@v5\)$/s//\1\n      - uses: vendor\/unknown-action@v1/' "$D/.github/workflows/ci.yml"
  if grep -q "vendor/unknown-action@v1" "$D/.github/workflows/ci.yml"; then
    ok "mutazione applicata (azione sconosciuta inserita)"
  else
    ng "mutazione non applicata"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (azione non verificabile rifiutata)"; else ng "exit $ec (atteso 1): il gate accetta un'azione non verificabile"; fi
  if echo "$out" | grep -q "non e' in NODE24_ACTIONS"; then ok "il messaggio spiega che l'azione non e' verificabile"; else ng "messaggio non esplicativo: $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo "=== T5: fixture con un riferimento pinnato a SHA (non verificabile) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak '0,/^\(      - uses: actions\/checkout@v5\)$/s//\1\n      - uses: actions\/checkout@8ade135a41bc03c155e62e844d188df1ea18608/' "$D/.github/workflows/ci.yml"
  if grep -q "actions/checkout@8ade135a" "$D/.github/workflows/ci.yml"; then
    ok "mutazione applicata (checkout pinnato a SHA)"
  else
    ng "mutazione non applicata"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (riferimento non verificabile rifiutato)"; else ng "exit $ec (atteso 1): il gate accetta un riferimento non verificabile"; fi
  if echo "$out" | grep -q "non e' pinnata a una major"; then ok "il messaggio spiega che il riferimento non e' una major"; else ng "messaggio non esplicativo: $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo "=== T6: fixture con un'azione locale (nessun runtime dichiarato) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak '0,/^\(      - uses: actions\/checkout@v5\)$/s//\1\n      - uses: .\/scripts\/local-action/' "$D/.github/workflows/ci.yml"
  if grep -q "uses: ./scripts/local-action" "$D/.github/workflows/ci.yml"; then
    ok "mutazione applicata (azione locale inserita)"
  else
    ng "mutazione non applicata"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 0 ]; then ok "exit 0 (azione locale accettata, nessun falso positivo)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]
