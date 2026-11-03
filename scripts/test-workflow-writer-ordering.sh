#!/usr/bin/env bash
# Test di regressione per il cablaggio del writer post-merge (issue #284).
#
# Difende la struttura che rende le automazioni deterministiche:
#
#   * la CI consuma il writer con il trigger `workflow_run` (agganciato alla
#     CONCLUSIONE del writer: sopravvive alla soppressione del GITHUB_TOKEN,
#     che vale solo per gli eventi `push`/`pull_request` generati dal token
#     stesso — misurato: nessuna run `CI` per il commit `831b9e7` della
#     PR #282);
#   * nel passaggio `workflow_run` la CI fa il checkout della TESTA di `main`
#     (`workflow_run.head_sha` e' il commit di PARTENZA del writer: validarlo
#     equivarrebbe a far fallire il gate merge-state per costruzione);
#   * `main` ha UN solo writer;
#   * il writer scatta su ogni PR mergiata (nessun filtro `paths:`).
#
# Scenari coperti:
#   T1  repo reale: cablaggio presente e allineato -> exit 0
#   T2  fixture senza il blocco `workflow_run:` in ci.yml -> exit 1
#   T3  fixture con `workflows:` che punta a un altro workflow -> exit 1
#   T4  fixture con `workflows: ["post-merge"]` ma `name:` del producer cambiato -> exit 1
#   T5  fixture senza il producer -> exit 1
#   T6  fixture con un SECONDO writer che pusha su `main` -> exit 1 (single-writer)
#   T7  fixture con un filtro `paths:` nel trigger del writer -> exit 1 (writer-trigger)
#   T8  fixture senza il checkout di `main` nel passaggio `workflow_run` -> exit 1
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-workflows.mjs"
CI_WF="$REPO_ROOT/.github/workflows/ci.yml"
WRITER_WF="$REPO_ROOT/.github/workflows/post-merge.yml"

PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  [OK] $1"; }
ko()   { FAIL=$((FAIL+1)); echo "  [KO] $1"; }

run_validator() {
  # $1 = directory dei workflow, $2 = exit code atteso, $3 = descrizione
  local dir="$1" expected="$2" desc="$3" out ec
  out="$(node "$VALIDATOR" "$dir" 2>&1)"; ec=$?
  if [ "$ec" = "$expected" ]; then
    ok "$desc (exit $ec)"
  else
    ko "$desc: exit $ec (atteso $expected)"
    echo "$out" | tail -8 | sed 's/^/       /'
  fi
  LAST_OUT="$out"
}

FIXTURE_DIR="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_DIR"' EXIT

# --- T1: repo reale, deve passare --------------------------------------------
run_validator "$REPO_ROOT/.github/workflows" 0 "T1 repo reale: cablaggio del writer presente e allineato"
if echo "$LAST_OUT" | grep -q 'trigger `workflow_run` su "post-merge" presente e allineato'; then
  ok "T1 il gate riconosce il trigger workflow_run sul writer"
else
  ko "T1 il gate non riconosce il trigger workflow_run sul writer"
fi
if echo "$LAST_OUT" | grep -q "single-writer: un solo writer su"; then
  ok "T1 il gate riconosce un solo writer su main"
else
  ko "T1 il gate non riconosce il single-writer"
fi

# --- fixture: copia di ci.yml + post-merge.yml --------------------------------
mkfixture() {
  local d="$1"
  mkdir -p "$d"
  cp "$CI_WF" "$d/ci.yml"
  cp "$WRITER_WF" "$d/post-merge.yml"
}

# --- T2: ci.yml senza il blocco `workflow_run:` -------------------------------
d="$FIXTURE_DIR/t2"; mkfixture "$d"
sed -i '/^  workflow_run:$/,+2d' "$d/ci.yml"
if grep -q 'workflow_run:' "$d/ci.yml"; then
  ko "T2 preparazione: il blocco workflow_run non e' stato rimosso"
else
  ok "T2 preparazione: blocco workflow_run rimosso"
fi
run_validator "$d" 1 "T2 ci.yml senza workflow_run: il gate segnala l'assenza del passaggio post-writer"

# --- T3: workflow_run che punta a un altro workflow ---------------------------
d="$FIXTURE_DIR/t3"; mkfixture "$d"
sed -i 's/workflows: \["post-merge"\]/workflows: ["altro-workflow"]/' "$d/ci.yml"
run_validator "$d" 1 "T3 workflow_run su un altro workflow: il gate segnala il trigger errato"

# --- T4: il `name:` del producer non combacia --------------------------------
d="$FIXTURE_DIR/t4"; mkfixture "$d"
sed -i 's/^name: post-merge$/name: post-merge-rinominato/' "$d/post-merge.yml"
run_validator "$d" 1 "T4 name: del producer disallineato: il gate segnala il trigger che non scatterebbe"

# --- T5: producer assente ----------------------------------------------------
d="$FIXTURE_DIR/t5"; mkdir -p "$d"; cp "$CI_WF" "$d/ci.yml"
run_validator "$d" 1 "T5 producer assente: il gate segnala l'impossibilita' di verificare"

# --- T6: un secondo writer che pusha su `main` -------------------------------
d="$FIXTURE_DIR/t6"; mkfixture "$d"
cat > "$d/second-writer.yml" <<'YAML'
name: second-writer
on:
  push:
    branches: [main]
jobs:
  write:
    runs-on: ubuntu-latest
    steps:
      - name: Push
        run: |
          git fetch origin main
          git reset --hard origin/main
          git push origin main
YAML
run_validator "$d" 1 "T6 secondo writer su main: il gate single-writer lo intercetta"

# --- T7: il writer filtra i merge con `paths:` -------------------------------
d="$FIXTURE_DIR/t7"; mkfixture "$d"
sed -i 's/^    types: \[closed\]$/    types: [closed]\n    paths:\n      - "docs\/state\/**"/' "$d/post-merge.yml"
if grep -q 'paths:' "$d/post-merge.yml"; then
  ok "T7 preparazione: filtro paths inserito"
else
  ko "T7 preparazione: il filtro paths non e' stato inserito"
fi
run_validator "$d" 1 "T7 writer con filtro paths: il gate segnala che alcune PR mergiate resterebbero fuori"

# --- T8: la CI non fa il checkout di `main` nel passaggio workflow_run --------
d="$FIXTURE_DIR/t8"; mkfixture "$d"
sed -i "s/ref: \${{ github.event_name == 'workflow_run' && 'main' || github.sha }}/ref: \${{ github.sha }}/g" "$d/ci.yml"
if grep -q "workflow_run' && 'main'" "$d/ci.yml"; then
  ko "T8 preparazione: il checkout di main e' ancora presente"
else
  ok "T8 preparazione: checkout di main rimosso"
fi
run_validator "$d" 1 "T8 CI senza checkout di main nel passaggio workflow_run: il gate lo segnala"

echo ""
echo "test-workflow-writer-ordering: $PASS passati, $FAIL falliti"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
