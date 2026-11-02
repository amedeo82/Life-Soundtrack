#!/usr/bin/env bash
# Test di regressione per il sync `origin/main` dei writer di `main` (issue #140).
#
# Difende il bug chiuso in issue #140: `auto-bundle.yml` e `auto-state-aggregate.yml`
# condividono il concurrency group `post-merge-main` (`cancel-in-progress: false`),
# pensato per serializzare i due writer di `main`. Ma il group serializza i *run*,
# non i *checkout*: `actions/checkout` senza `with: ref:` mette il workspace sul
# `github.sha` del merge commit, non sulla testa corrente di `main`.
#
# Sequenza del fallimento (run 39803721229, 2026-10-22T15:19:20Z):
#   1. merge di PR #138 -> `main` = 5e2d602
#   2. auto-bundle parte, fa sync col tip corrente, pusha -> `main` = 6287490
#   3. auto-state-aggregate parte, fa checkout del `github.sha` (5e2d602),
#      rigenera i blocchi, committa e pusha
#   4. `git push origin main` -> `! [rejected] main -> main (non-fast-forward)`
#
# La firma e' insidiosa perche' il merge sembra riuscito: i blocchi aggregati
# restano indietro, nessun gate di `ci.yml` lo segnala, e lo stato dichiarato
# diverge da quello reale. Caso concreto: il doc-sync della Story 1.2 (PR #139)
# non e' mai arrivato su `main`.
#
# Il gate vive in scripts/validate-workflows.mjs (gia' bloccante in CI dal #73);
# questo file e' il suo test di regressione: verifica che il gate **esca 1**
# quando si reintroduce il bug. Un gate che passa sempre non e' un gate
# (lesson 43-1).
#
# Scenari coperti:
#   T1  repo reale: entrambi i writer di `main` sono sincronizzati -> exit 0
#   T2  fixture con lo step "Sync con origin/main" rimosso da auto-state-aggregate.yml
#       (reintroduzione del bug #140) -> exit 1, messaggio che nomina file e riga
#   T3  fixture con una forma di sync alternativa (`git pull --rebase origin main`)
#       -> exit 0 (nessun falso positivo sulle forme equivalenti)
#   T4  fixture con un workflow che pusha su un BRANCH (`git push origin feat/x`)
#       -> exit 0 e non conteggiato fra i writer di `main`
#   T5  fixture con il sync dichiarato DOPO il push -> exit 1: l'ordine fa parte
#       del contratto, un sync tardivo non protegge nessuno
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-workflows.mjs"
AGGREGATOR="$SCRIPT_DIR/aggregate-state.ps1"
AUTO_AGGREGATE_WF="$REPO_ROOT/.github/workflows/auto-state-aggregate.yml"
AUTO_BUNDLE_WF="$REPO_ROOT/.github/workflows/auto-bundle.yml"
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
# `auto-state-aggregate.yml` o l'agregator mancano — altrimenti T2-T5 passerebbero
# per il motivo sbagliato. Copiamo anche auto-bundle.yml cosi' il caso reale
# (due writer) resta rappresentato.
make_fixture() {
  local d="$1"
  mkdir -p "$d/.github/workflows" "$d/scripts"
  cp "$VALIDATOR" "$d/scripts/validate-workflows.mjs"
  cp "$AGGREGATOR" "$d/scripts/aggregate-state.ps1"
  cp "$AUTO_AGGREGATE_WF" "$d/.github/workflows/auto-state-aggregate.yml"
  cp "$AUTO_BUNDLE_WF" "$d/.github/workflows/auto-bundle.yml"
  cp "$CI_WF" "$d/.github/workflows/ci.yml"
}

run_validator() {
  node "$1/scripts/validate-workflows.mjs" "$1/.github/workflows" 2>&1
}

echo "=== T1: repo reale - entrambi i writer di main sono sincronizzati ==="
out="$(node "$VALIDATOR" "$REPO_ROOT/.github/workflows" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (nessun writer di main senza sync)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -6)"; fi
if echo "$out" | grep -q "auto-state-aggregate.yml:[0-9]*: .git push origin main. preceduto da una sincronizzazione"; then
  ok "auto-state-aggregate.yml e' riconosciuto come writer sincronizzato"
else
  ng "auto-state-aggregate.yml non e' riconosciuto come writer sincronizzato"
fi
if echo "$out" | grep -q "auto-bundle.yml:[0-9]*: .git push origin main. preceduto da una sincronizzazione"; then
  ok "auto-bundle.yml e' riconosciuto come writer sincronizzato"
else
  ng "auto-bundle.yml non e' riconosciuto come writer sincronizzato"
fi
if echo "$out" | grep -q "2 writer di main verificati"; then ok "il riepilogo conta 2 writer di main"; else ng "il riepilogo non conta 2 writer di main: $(echo "$out" | tail -3)"; fi

echo "=== T2: fixture con lo step Sync rimosso ma con il retry (issue #261) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  # Rimuove l'intero blocco dello step "Sync con origin/main" (dal `- name:` fino
  # alla riga prima del `- name:` successivo).
  perl -0777 -pi -e 's/^[ ]{6}- name: Sync con origin\/main\n(?:(?!^[ ]{6}- name: ).*\n)*//m' "$D/.github/workflows/auto-state-aggregate.yml"

  # Verifica lo step, non la stringa: l'header del workflow cita il nome dello
  # step anche nei commenti, quindi un grep grezzo darebbe un falso "non applicata".
  if grep -qE '^[ ]{6}- name: Sync con origin/main' "$D/.github/workflows/auto-state-aggregate.yml"; then
    ng "mutazione non applicata: lo step Sync e' ancora presente nella fixture"
  else
    ok "mutazione applicata (step Sync rimosso)"
  fi

  # Il contratto del gate (issue #261): una strategia di ri-sincronizzazione e'
  # sufficiente se e' PREVENTIVA (step precedente) OPPURE un RETRY dentro lo
  # step della push. Con il retry presente il writer non puo' perdere la race:
  # ri-sincronizza e riprova.
  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 0 ]; then ok "exit 0 (il retry copre la race: strategia di ri-sincronizzazione presente)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -6)"; fi
  if echo "$out" | grep -q "auto-state-aggregate.yml:[0-9]*: .git push origin main. protetto da un retry con ri-sincronizzazione"; then
    ok "il messaggio dichiara la strategia adottata (retry)"
  else
    ng "il messaggio non dichiara il retry: $(echo "$out" | tail -6)"
  fi

  cd /; rm -rf "$D"
}

echo "=== T2b: fixture senza NESSUNA strategia di ri-sincronizzazione (bug #140) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  # Rimuove sia lo step "Sync con origin/main" sia il blocco di retry: senza
  # nessuna strategia, il writer perde la race e i blocchi restano indietro.
  perl -0777 -pi -e 's/^[ ]{6}- name: Sync con origin\/main\n(?:(?!^[ ]{6}- name: ).*\n)*//m' "$D/.github/workflows/auto-state-aggregate.yml"
  # Sostituisce il ciclo di retry con una push secca: la fixture deve avere
  # un writer che pusha su `main` senza ALCUNA strategia di ri-sincronizzazione
  # (neppure il retry, che contiene il push al suo interno).
  # Issue #279: il ciclo di retry e' in sintassi PowerShell (gli step dei writer
  # dichiarano `shell: pwsh`): la mutazione deve riconoscere quella forma, non
  # piu' il ciclo bash (`for attempt in 1 2 3; do ... done`), che non parse e
  # causava un ParserError a runtime (i writer non committavano piu' nulla).
  perl -0777 -pi -e 's/^[ ]{10}\$pushed = \$false\n(?:^[ ]{10,}.*\n)*?^[ ]{10}\}\n/          git push origin main\n/m' "$D/.github/workflows/auto-state-aggregate.yml"
  perl -0777 -pi -e 's/^[ ]{10}\$pushed = \$false\n(?:^[ ]{10,}.*\n)*?^[ ]{10}\}\n/          git push origin main\n/m' "$D/.github/workflows/auto-bundle.yml"

  if grep -qF 'for ($attempt = 1;' "$D/.github/workflows/auto-state-aggregate.yml"; then
    ng "mutazione non applicata: il retry e' ancora presente nella fixture"
  else
    ok "mutazione applicata (sync e retry rimossi)"
  fi
  if grep -q "git push origin main" "$D/.github/workflows/auto-state-aggregate.yml"; then
    ok "la fixture contiene ancora un writer che pusha su main"
  else
    ng "la fixture non contiene piu' nessun writer: la mutazione ha rimosso anche la push"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (gate bloccante sul writer senza alcuna strategia)"; else ng "exit $ec (atteso 1): il gate NON intercetta il bug"; fi
  if echo "$out" | grep -q "auto-state-aggregate.yml:[0-9]*: .git push origin main. senza sincronizzazione preventiva"; then
    ok "il messaggio nomina il file, la riga e l'assenza di sync"
  else
    ng "il messaggio non nomina file:riga del push: $(echo "$out" | tail -6)"
  fi
  if echo "$out" | grep -q "non-fast-forward"; then ok "il messaggio spiega la firma del fallimento"; else ng "il messaggio non spiega il fallimento"; fi

  cd /; rm -rf "$D"
}

echo "=== T3: fixture con forma di sync alternativa (git pull --rebase origin main) ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  sed -i.bak 's#git rebase origin/main#git pull --rebase origin main#' "$D/.github/workflows/auto-state-aggregate.yml"
  if grep -q "git pull --rebase origin main" "$D/.github/workflows/auto-state-aggregate.yml"; then
    ok "mutazione applicata (forma alternativa di sync)"
  else
    ng "mutazione non applicata"
  fi

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 0 ]; then ok "exit 0 (forma equivalente accettata, nessun falso positivo)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -6)"; fi

  cd /; rm -rf "$D"
}

echo "=== T4: fixture con workflow che pusha su un branch, non su main ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  cat > "$D/.github/workflows/zz-push-branch.yml" <<'YML'
name: push-branch
on:
  workflow_dispatch:
permissions:
  contents: write
jobs:
  push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Push
        shell: pwsh
        run: |
          git push origin feat/1-example
YML
  ok "fixture creata (workflow che pusha su feat/1-example)"

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 0 ]; then ok "exit 0 (un writer di branch non e' tassato come writer di main)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -6)"; fi
  if echo "$out" | grep -q "2 writer di main verificati"; then ok "i writer di main contati restano 2"; else ng "il conteggio dei writer di main e' cambiato: $(echo "$out" | tail -3)"; fi

  cd /; rm -rf "$D"
}

echo "=== T5: fixture con il sync dichiarato DOPO il push ==="
{
  D="$(mktemp -d)"; make_fixture "$D"
  cat > "$D/.github/workflows/zz-late-sync.yml" <<'YML'
name: late-sync
on:
  workflow_dispatch:
permissions:
  contents: write
jobs:
  push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Push
        shell: pwsh
        run: |
          git push origin main
          git rebase origin/main
YML
  ok "fixture creata (sync dopo il push)"

  out="$(run_validator "$D")"; ec=$?
  if [ $ec -eq 1 ]; then ok "exit 1 (l'ordine sync->push e' parte del contratto)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -6)"; fi

  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]