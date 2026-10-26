#!/usr/bin/env bash
# Test di regressione per l'ordinamento fra i due writer di `main` (issue #149).
#
# Difende il bug chiuso in issue #149: `auto-bundle.yml` e `auto-state-aggregate.yml`
# condividono il concurrency group `post-merge-main` (`cancel-in-progress: false`),
# pensato per serializzare i due writer di `main`. Ma il group serializza i *run*,
# non ne impone l'*ordine*: quale workflow ottenga prima il lock non e' deterministico.
#
# L'ordine e' essenziale perche' `auto-bundle` copia il contenuto dei file che
# `auto-state-aggregate` modifica. Se il bundle gira PRIMA, copia i blocchi
# aggregati ANCORA VECCHI; il guard idempotente (`git diff --quiet`) scrive
# "gia' in sync" e non committa nulla; l'agregate committa dopo, e la copia
# dentro `docs/BUNDLE.md` resta stale.
#
# Sequenza del fallimento (merge della PR #147, 2026-10-26T12:50Z):
#   12:50:23  auto-bundle           -> copia i blocchi VECCHI -> "gia' in sync", nessun commit
#   12:50:55  auto-state-aggregate  -> committa i blocchi freschi
#   => docs/BUNDLE.md stale di 6 righe (riga Story 1.3, Sessione 47, conteggio merge)
#
# Il drift e' SILENZIOSO: il gate CI sul bundle e' warning-only, la pipeline resta
# verde, e lo stato dichiarato diverge da quello reale.
#
# Difesa: `auto-bundle.yml` dichiara un trigger `workflow_run` su
# `auto-state-aggregate`. `workflow_run` e' agganciato alla *conclusione* del
# workflow, non a un push: sopravvive alla soppressione del GITHUB_TOKEN (che vale
# solo per gli eventi `push`/`pull_request` generati dal token stesso) ed e' il
# workaround documentato per i workflow che si innescano a vicenda.
#
# Il gate vive in scripts/validate-workflows.mjs (gia' bloccante in CI dal #73);
# questo file e' il suo test di regressione: verifica che il gate **esca 1**
# quando si reintroduce il bug. Un gate che passa sempre non e' un gate
# (lesson 43-1).
#
# Scenari coperti:
#   T1  repo reale: il trigger `workflow_run` c'e' ed e' allineato -> exit 0
#   T2  fixture con il blocco `workflow_run:` rimosso da auto-bundle.yml
#       (reintroduzione del bug #149) -> exit 1, messaggio che nomina file e causa
#   T3  fixture con `workflows:` che punta a un altro workflow -> exit 1
#   T4  fixture con `workflows: ["auto-state-aggregate"]` ma il `name:` reale del
#       producer cambiato -> exit 1 (il trigger non scatterebbe MAI, in silenzio)
#   T5  fixture col producer assente -> exit 1
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-workflows.mjs"
AUTO_BUNDLE_WF="$REPO_ROOT/.github/workflows/auto-bundle.yml"
AUTO_AGGREGATE_WF="$REPO_ROOT/.github/workflows/auto-state-aggregate.yml"

PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  [OK] $1"; }
ko()   { FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }

# Esegue il validator su una directory di fixture.
# $1 = directory dei workflow, $2 = exit code atteso, $3 = descrizione
run_validator() {
  local dir="$1" expected="$2" desc="$3"
  local out
  out="$(node "$VALIDATOR" "$dir" 2>&1)"
  local code=$?
  if [ "$code" -eq "$expected" ]; then
    ok "$desc (exit $code come atteso)"
    echo "$out" | grep -E '^\[FAIL\]' | sed 's/^/       /' | head -5
  else
    ko "$desc (exit $code, atteso $expected)"
    echo "$out" | tail -12 | sed 's/^/       /'
  fi
}

echo "=== Issue #149 — ordinamento fra i due writer di main ==="
echo

# --- T1: repo reale, deve passare ---
run_validator "$REPO_ROOT/.github/workflows" 0 \
  "T1 repo reale: trigger workflow_run presente e allineato"

# --- fixture: copia dei due workflow in una dir temporanea ---
FIXTURE_DIR="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_DIR"' EXIT

# T2: rimuove il blocco `workflow_run:` da auto-bundle.yml
mkdir -p "$FIXTURE_DIR/t2"
cp "$AUTO_BUNDLE_WF" "$FIXTURE_DIR/t2/auto-bundle.yml"
cp "$AUTO_AGGREGATE_WF" "$FIXTURE_DIR/t2/auto-state-aggregate.yml"
# Rimuove il blocco `workflow_run:` (righe di commento di sezione incluse) e la
# riga `types: [completed]`. Usa solo sed: python3 non e' garantito su Windows
# (dove `bash` e' il Git Bash, non il WSL stub).
sed -i '/^  # === Issue #149/,/^    types: \[completed\]$/d' \
  "$FIXTURE_DIR/t2/auto-bundle.yml"
if grep -q 'workflow_run:' "$FIXTURE_DIR/t2/auto-bundle.yml"; then
  ko "T2 preparazione fixture: il blocco workflow_run non e' stato rimosso"
else
  ok "T2 preparazione fixture: blocco workflow_run rimosso"
fi
run_validator "$FIXTURE_DIR/t2" 1 \
  "T2 fixture senza workflow_run: il gate segnala l'ordinamento non garantito"

# T3: workflow_run che punta a un altro workflow
mkdir -p "$FIXTURE_DIR/t3"
cp "$AUTO_BUNDLE_WF" "$FIXTURE_DIR/t3/auto-bundle.yml"
cp "$AUTO_AGGREGATE_WF" "$FIXTURE_DIR/t3/auto-state-aggregate.yml"
sed -i 's/workflows: \["auto-state-aggregate"\]/workflows: ["altro-workflow"]/' \
  "$FIXTURE_DIR/t3/auto-bundle.yml"
run_validator "$FIXTURE_DIR/t3" 1 \
  "T3 fixture con workflow_run su un altro workflow: il gate segnala l'assenza di auto-state-aggregate"

# T4: il nome dichiarato non combacia con il `name:` reale del producer
mkdir -p "$FIXTURE_DIR/t4"
cp "$AUTO_BUNDLE_WF" "$FIXTURE_DIR/t4/auto-bundle.yml"
cp "$AUTO_AGGREGATE_WF" "$FIXTURE_DIR/t4/auto-state-aggregate.yml"
sed -i 's/^name: auto-state-aggregate$/name: auto-state-aggregate-rinominato/' \
  "$FIXTURE_DIR/t4/auto-state-aggregate.yml"
run_validator "$FIXTURE_DIR/t4" 1 \
  "T4 fixture con name: del producer disallineato: il gate segnala il trigger che non scatterebbe"

# T5: producer assente
mkdir -p "$FIXTURE_DIR/t5"
cp "$AUTO_BUNDLE_WF" "$FIXTURE_DIR/t5/auto-bundle.yml"
run_validator "$FIXTURE_DIR/t5" 1 \
  "T5 fixture senza il producer: il gate segnala l'impossibilita' di verificare"

echo
echo "=== $PASS ok, $FAIL fallimenti ==="
[ "$FAIL" -eq 0 ] || exit 1
exit 0
