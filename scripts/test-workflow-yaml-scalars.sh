#!/usr/bin/env bash
# Test di regressione per la validita' YAML dei workflow (Sessione 74).
#
# Un file workflow che GitHub **rifiuta in fase di validazione** non produce un
# job che fallisce: produce una run con `jobs: []` (0 check-run), `conclusion:
# failure` e `run_started_at == created_at` (0 secondi), nessun log e nessuna
# annotazione via API. E' la stessa firma del failure mode dell'issue #135
# (22 ore di gate spenti senza che nessuno se ne accorgesse), e il sintomo e'
# indistinguibile da "Actions rotta per billing".
#
# La forma invalida piu' comune e' uno **scalare semplice** (non quotato, non
# block scalar) che contiene `: ` — in contesto block quello e' l'indicatore
# di chiave, quindi non puo' stare dentro il valore:
#
#     run: echo "::notice::PR: solo documentazione."     <- INVALIDO
#     run: |                                              <- valido
#       echo "::notice::PR: solo documentazione."
#     run: "echo a: b"                                   <- valido (quotato)
#
# Il gate vive in scripts/validate-workflows.mjs; questo file e' il suo test di
# regressione: verifica che il gate **esca 1** quando si reintroduce l'errore.
# Un gate che passa sempre non e' un gate (lesson 43-1).
#
# Scenari coperti:
#   T1  repo reale: nessuno scalare semplice invalido -> exit 0
#   T2  fixture con uno scalare semplice che contiene ": " -> exit 1, messaggio
#       che nomina il file e la riga
#   T3  fixture con le forme valide equivalenti (block scalar, valore quotato,
#       commento) -> exit 0: nessun falso positivo
#   T4  fixture CRLF (un contributore su Windows salva con CRLF): il gate deve
#       comunque intercettare — e i controlli gia' esistenti non devono
#       fallire in silenzio per il `\r` finale
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-workflows.mjs"
AGGREGATOR="$SCRIPT_DIR/aggregate-state.ps1"
AUTO_AGGREGATE_WF="$REPO_ROOT/.github/workflows/auto-state-aggregate.yml"
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
# repoRoot come <dir>/../.., e il gate di copertura `git add` (#136) fallisce se
# `auto-state-aggregate.yml` o l'aggregator mancano — altrimenti i test
# passerebbero per il motivo sbagliato.
make_fixture() {
  local d="$1"
  mkdir -p "$d/.github/workflows" "$d/scripts"
  cp "$VALIDATOR" "$d/scripts/validate-workflows.mjs"
  cp "$AGGREGATOR" "$d/scripts/aggregate-state.ps1"
  cp "$AUTO_AGGREGATE_WF" "$d/.github/workflows/auto-state-aggregate.yml"
  cp "$CI_WF" "$d/.github/workflows/ci.yml"
}

run_validator() {
  node "$1/scripts/validate-workflows.mjs" "$1/.github/workflows" 2>&1
}

echo "=== T1: repo reale - nessuno scalare semplice invalido ==="
out="$(node "$VALIDATOR" "$REPO_ROOT/.github/workflows" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (nessuno scalare invalido in .github/workflows)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -5)"; fi
if echo "$out" | grep -q "scalare semplice non quotato"; then ng "il gate segnala uno scalare invalido sul repo reale"; else ok "nessuno scalare invalido nel repo reale"; fi

echo "=== T2: fixture con uno scalare semplice che contiene ': ' ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  # Scalare semplice: il valore non e' quotato e contiene ": ".
  printf '%s\n' \
    'name: Fixture' \
    'on:' \
    '  push:' \
    '    branches: [main]' \
    'jobs:' \
    '  x:' \
    '    runs-on: ubuntu-latest' \
    '    steps:' \
    '      - name: Rotto' \
    '        run: echo "::notice::PR di sola documentazione: lint e typecheck."' \
    > "$D/.github/workflows/rotto.yml"

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (gate bloccante sullo scalare invalido)"; else ng "exit $ec (atteso 1): il gate NON intercetta l'errore"; fi
  if echo "$out" | grep -q "rotto.yml: riga [0-9]"; then ok "il messaggio cita il file e la riga"; else ng "il messaggio non cita file:riga: $(echo "$out" | tail -5)"; fi
  if echo "$out" | grep -q "scalare semplice non quotato"; then ok "il messaggio spiega il problema"; else ng "il messaggio non spiega il problema: $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo "=== T3: fixture con le forme valide equivalenti -> nessun falso positivo ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  printf '%s\n' \
    'name: Fixture' \
    'on:' \
    '  push:' \
    '    branches: [main]' \
    'jobs:' \
    '  x:' \
    '    runs-on: ubuntu-latest' \
    '    steps:' \
    '      - name: Block scalar' \
    '        run: |' \
    '          echo "::notice::PR di sola documentazione: lint e typecheck."' \
    '      - name: Valore quotato' \
    '        run: "echo a: b"' \
    '      - name: Commento' \
    '        if: always()  # nota: questo e'"'"' un commento' \
    '        run: echo ciao' \
    > "$D/.github/workflows/valido.yml"

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 0 ]; then ok "exit 0 (block scalar, quotato e commento accettati)"; else ng "exit $ec (atteso 0): falso positivo: $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo "=== T4: fixture CRLF - il gate deve comunque intercettare ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  printf '%s\n' \
    'name: Fixture' \
    'on:' \
    '  push:' \
    '    branches: [main]' \
    'jobs:' \
    '  x:' \
    '    runs-on: ubuntu-latest' \
    '    steps:' \
    '      - name: Rotto' \
    '        run: echo "::notice::PR di sola documentazione: lint e typecheck."' \
    | sed 's/$/\r/' \
    > "$D/.github/workflows/crlf.yml"
  if grep -qU $'\r' "$D/.github/workflows/crlf.yml"; then
    ok "mutazione applicata (fixture CRLF)"
  else
    ng "mutazione non applicata: la fixture non ha CRLF"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (intercettato anche su file CRLF)"; else ng "exit $ec (atteso 1): il gate NON intercetta l'errore su CRLF"; fi

  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]
