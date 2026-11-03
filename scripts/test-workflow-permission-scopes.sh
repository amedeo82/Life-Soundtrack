#!/usr/bin/env bash
# Test di regressione per le scope dichiarate in `permissions:` (issue #135).
#
# Difende il bug chiuso in issue #135: `ci.yml` dichiarava `metadata: read` nel
# blocco `permissions:` del job `quality`. `metadata` NON e' una scope dichiarabile
# della GITHUB_TOKEN (e' sempre concessa implicitamente e non e' fra le scope
# documentate), quindi GitHub **rifiuta il file workflow in fase di validazione**.
#
# La firma di questo fallimento e' particolare e non assomiglia a nessun'altra:
#   - la run viene creata, ma `jobs: []` (0 check-run)
#   - `conclusion: failure` con `run_started_at == created_at` (0 secondi)
#   - nessun log, nessuna annotazione via API (la check-suite non contiene check-run)
#   - l'API `/actions/workflows` continua a rispondere `state=active`
#   - qualunque parser YAML accetta `metadata: read` senza errori: e' la *schema*
#     GitHub a rifiutare la chiave, non la sintassi
#   - gli altri workflow dello stesso repo continuano a girare verdi
#
# Il gate vive ora in scripts/validate-workflows.mjs (gia' bloccante in CI dal #73);
# questo file e' il suo test di regressione: verifica che il gate **esca 1** quando
# si reintroduce il bug. Un gate che passa sempre non e' un gate (lesson 43-1).
#
# Scenari coperti:
#   T1  repo reale: tutte le scope dichiarate sono valide -> exit 0
#   T2  fixture con `metadata: read` (il bug di #135) -> exit 1, messaggio che nomina
#       la scope e la riga
#   T3  fixture con una scope valida ma un valore inesistente (`contents: readonly`)
#       -> exit 1
#   T4  fixture con forma compatta `permissions: read-all` -> exit 0 (nessun falso
#       positivo sulle forme brevi)
#   T5  fixture con typo di scope (`issue: read`) -> exit 1: la classe piu' probabile
#       di regressione, cioe' il nome sbagliato per una scope che esiste
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

# Repo fixture minimo. La struttura conta: validate-workflows.mjs risolve repoRoot
# come <dir>/../.., e il gate di copertura `git add` (#136) fallisce se
# `post-merge.yml` o l'aggregator mancano — altrimenti T2-T5 passerebbero
# per il motivo sbagliato.
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

echo "=== T1: repo reale - tutte le scope dichiarate sono valide ==="
out="$(node "$VALIDATOR" "$REPO_ROOT/.github/workflows" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (nessuna scope inesistente in .github/workflows)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -5)"; fi
if echo "$out" | grep -q "scope permissions verificate in"; then ok "il riepilogo riporta le scope verificate"; else ng "manca il riepilogo delle scope verificate"; fi
if echo "$out" | grep -q "non valida in"; then ng "il gate segnala una scope non valida sul repo reale"; else ok "nessuna scope non valida nel repo reale"; fi

echo "=== T2: fixture con \`metadata: read\` (reintroduzione del bug #135) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak 's#^\([[:space:]]*\)issues: read#\1issues: read\n\1metadata: read#' "$D/.github/workflows/ci.yml"
  if grep -qE '^[[:space:]]*metadata: read' "$D/.github/workflows/ci.yml"; then
    ok "mutazione applicata (metadata: read reintrodotta)"
  else
    ng "mutazione non applicata: metadata: read non presente nella fixture"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (gate bloccante sulla scope inesistente)"; else ng "exit $ec (atteso 1): il gate NON intercetta il bug"; fi
  if echo "$out" | grep -q "scope \`metadata\` non valida"; then ok "il messaggio nomina la scope non valida"; else ng "il messaggio non nomina la scope: $(echo "$out" | tail -5)"; fi
  if echo "$out" | grep -q "ci.yml:[0-9]"; then ok "il messaggio cita il file e la riga"; else ng "il messaggio non cita file:riga"; fi

  cd /; rm -rf "$D"
}

echo "=== T3: fixture con valore di scope inesistente (contents: readonly) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak 's#^\([[:space:]]*\)contents: read#\1contents: readonly#' "$D/.github/workflows/ci.yml"
  if grep -qE '^[[:space:]]*contents: readonly' "$D/.github/workflows/ci.yml"; then
    ok "mutazione applicata (valore readonly)"
  else
    ng "mutazione non applicata"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (valore non ammesso)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -5)"; fi
  if echo "$out" | grep -q "accetta solo"; then ok "il messaggio spiega i valori ammessi"; else ng "messaggio non esplicativo: $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo "=== T4: fixture con forma compatta \`permissions: read-all\` ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  # Sostituisce l'intero blocco scope del job con la forma breve: il gate deve
  # accettarla, altrimenti diventerebbe un falso positivo bloccante.
  python3 - "$D/.github/workflows/ci.yml" <<'PY' 2>/dev/null || perl -0777 -pi -e 's/^([ \t]*)permissions:\n(?:[ \t]+\S+:[ \t]*\S+[ \t]*\n)+/$1permissions: read-all\n/m' "$D/.github/workflows/ci.yml"
import re, sys
p = sys.argv[1]
s = open(p, encoding='utf8').read()
s = re.sub(r'^([ \t]*)permissions:\n(?:[ \t]+\S+:[ \t]*\S+[ \t]*\n)+', r'\1permissions: read-all\n', s, flags=re.M)
open(p, 'w', encoding='utf8').write(s)
PY
  if grep -qE '^[[:space:]]*permissions: read-all$' "$D/.github/workflows/ci.yml"; then
    ok "mutazione applicata (blocco scope sostituito da read-all)"
  else
    ng "mutazione non applicata"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 0 ]; then ok "exit 0 (forma compatta accettata, nessun falso positivo)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -5)"; fi

  cd /; rm -rf "$D"
}

echo "=== T5: fixture con typo di scope (issue: read al posto di issues: read) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak 's#^\([[:space:]]*\)issues: read#\1issue: read#' "$D/.github/workflows/ci.yml"
  if grep -qE '^[[:space:]]*issue: read' "$D/.github/workflows/ci.yml"; then
    ok "mutazione applicata (scope issues -> issue)"
  else
    ng "mutazione non applicata"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (scope inesistente per typo)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -5)"; fi
  if echo "$out" | grep -q "scope valide:"; then ok "il messaggio elenca le scope valide"; else ng "il messaggio non elenca le scope valide"; fi

  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]