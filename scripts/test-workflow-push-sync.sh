#!/usr/bin/env bash
# Test di regressione per il sync `origin/main` del writer di `main` (issue #140, #284).
#
# Difende il bug chiuso in issue #140: il checkout di default di un writer e'
# il `github.sha` del merge commit, non la testa corrente di `main`. Se un
# altro scrittore ha gia' pushato, `git push origin main` viene rifiutato con
# `! [rejected] main -> main (non-fast-forward)` e i blocchi aggregati
# restano indietro — fallimento SILENZIOSO (il merge sembra riuscito).
#
# Issue #284: con il writer unico (`post-merge.yml`) la difesa e' dentro il
# writer stesso: il tentativo successivo fa `git reset --hard origin/main` e
# RIGENERA (i file generati non si ribasano: il rebase e' un conflitto
# strutturale). Il gate verifica che il writer abbia una strategia di
# sincronizzazione con `origin/main` prima del push.
#
# Scenari coperti:
#   T1  repo reale: il writer e' sincronizzato -> exit 0
#   T2  fixture con il sync e il retry rimossi -> exit 1 (gate bloccante)
#   T3  fixture con una forma di sync alternativa (`git pull --rebase origin main`) -> exit 0
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-workflows.mjs"
AGGREGATOR="$SCRIPT_DIR/aggregate-state.ps1"
WRITER_WF="$REPO_ROOT/.github/workflows/post-merge.yml"
CI_WF="$REPO_ROOT/.github/workflows/ci.yml"

PASS=0
FAIL=0
ok() { PASS=$((PASS+1)); echo "  [OK] $1"; }
ko() { FAIL=$((FAIL+1)); echo "  [KO] $1"; }

run_validator() {
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

# Repo fixture minimo: il validator risolve repoRoot come <dir>/../.., e il
# gate di copertura `git add` (#136) fallisce se il writer o l'aggregator
# mancano — altrimenti i test passerebbero per il motivo sbagliato.
make_fixture() {
  local d="$1"
  mkdir -p "$d/scripts" "$d/.github/workflows"
  cp "$VALIDATOR" "$d/scripts/validate-workflows.mjs"
  cp "$AGGREGATOR" "$d/scripts/aggregate-state.ps1"
  cp "$WRITER_WF" "$d/.github/workflows/post-merge.yml"
  cp "$CI_WF" "$d/.github/workflows/ci.yml"
}

# --- T1: repo reale, deve passare --------------------------------------------
out="$(node "$VALIDATOR" "$REPO_ROOT/.github/workflows" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (il writer ha una strategia di sincronizzazione)"; else ko "exit $ec (atteso 0): $(echo "$out" | tail -6)"; fi
if echo "$out" | grep -qE "post-merge\.yml:[0-9]+: .git push origin main. (preceduto da una sincronizzazione|protetto da un retry)"; then
  ok "post-merge.yml e' riconosciuto come writer sincronizzato"
else
  ko "post-merge.yml non e' riconosciuto come writer sincronizzato: $(echo "$out" | tail -4)"
fi
if echo "$out" | grep -q "1 writer di main verificati"; then
  ok "il riepilogo conta 1 writer di main"
else
  ko "il riepilogo non conta 1 writer di main: $(echo "$out" | tail -3)"
fi

FIXTURE_DIR="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_DIR"' EXIT

# --- T2: il writer perde sia il sync sia il retry ---------------------------
D="$FIXTURE_DIR/t2"; make_fixture "$D"
# Rimuove il `git fetch origin main` + `git reset --hard origin/main` (il sync)
# e il ciclo di retry (che rigenera e riprova): resta una push secca.
perl -0777 -pi -e 's/^[ ]{12}git fetch origin main\n//m' "$D/.github/workflows/post-merge.yml"
perl -0777 -pi -e 's/^[ ]{12}git reset --hard origin\/main\n//m' "$D/.github/workflows/post-merge.yml"
perl -0777 -pi -e 's/^[ ]{10}\$pushed = \$false\n(?:^[ ]{10,}.*\n)*?^[ ]{10}\}\n/          git push origin main\n/m' "$D/.github/workflows/post-merge.yml"

if grep -qF 'for ($attempt = 1;' "$D/.github/workflows/post-merge.yml"; then
  ko "mutazione non applicata: il retry e' ancora presente nella fixture"
else
  ok "mutazione applicata (sync e retry rimossi)"
fi
if grep -qF 'git fetch origin main' "$D/.github/workflows/post-merge.yml"; then
  ko "mutazione non applicata: il sync e' ancora presente nella fixture"
else
  ok "mutazione applicata (sync rimosso)"
fi

run_validator "$D/.github/workflows" 1 "T2 writer senza alcuna strategia di sincronizzazione: il gate bloccante lo intercetta"
if echo "$LAST_OUT" | grep -q "post-merge.yml:[0-9]*: .git push origin main. senza sincronizzazione preventiva"; then
  ok "il messaggio nomina il file, la riga e l'assenza di sync"
else
  ko "il messaggio non nomina l'assenza di sync: $(echo "$LAST_OUT" | tail -4)"
fi

# --- T3: forma di sync alternativa -------------------------------------------
D="$FIXTURE_DIR/t3"; make_fixture "$D"
sed -i 's#git reset --hard origin/main#git pull --rebase origin main#' "$D/.github/workflows/post-merge.yml"
if grep -q "git pull --rebase origin main" "$D/.github/workflows/post-merge.yml"; then
  ok "mutazione applicata (forma alternativa di sync)"
else
  ko "mutazione non applicata (forma alternativa di sync)"
fi
run_validator "$D/.github/workflows" 0 "T3 forma alternativa di sync: il gate la riconosce come difesa valida"

echo ""
echo "test-workflow-push-sync: $PASS passati, $FAIL falliti"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
