#!/usr/bin/env bash
# Smoke test per scripts/safe-branch-switch.ps1 (issue #49).
# Esegue 3 scenari sul working tree: clean / dirty tracked / dirty untracked.
# Richiede: pwsh, bash, git. (pwsh e' disponibile in CI; in locale assente => skip.)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/safe-branch-switch.ps1"

if ! command -v pwsh >/dev/null 2>&1; then
  echo "[SKIP] pwsh non disponibile: impossibile eseguire safe-branch-switch.ps1"
  exit 0
fi

pass=0
fail=0
# Sessione 73 (issue #224): i tre scenari girano dentro subshell `( ... )`, e
# gli incrementi di `pass`/`fail` dentro una subshell NON arrivano al padre:
# la suite riportava "0 passati, 0 falliti" e `[ "$fail" -eq 0 ]` era sempre
# vero, cioe' il gate NON poteva mai fallire (fail-open, lesson 43-1).
# Correzione: ogni assert scrive una riga su un file di risultati condiviso;
# il conteggio finale legge il file. I file sono append-only e gli scenari
# girano in sequenza, quindi non c'e' interleaving.
RESULTS="$(mktemp)"
trap 'rm -f "$RESULTS"' EXIT
ok()   { echo "  [PASS] $1"; echo "PASS" >> "$RESULTS"; }
ng()   { echo "  [FAIL] $1"; echo "FAIL" >> "$RESULTS"; }

# Identita' git via env var invece di `git config` (nessun subprocess).
export GIT_AUTHOR_NAME="Test"
export GIT_AUTHOR_EMAIL="t@t.local"
export GIT_COMMITTER_NAME="Test"
export GIT_COMMITTER_EMAIL="t@t.local"
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0="commit.gpgsign"
export GIT_CONFIG_VALUE_0="false"

run_ps() {
  pwsh -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT" "$@"
}

# Crea un repo con main + branch feature-x, lascia il working tree su main pulito.
make_repo() {
  local d="$1"
  mkdir -p "$d"
  (
    cd "$d" || exit 1
    git init -q -b main
    # Identita' e gpgsign via env var (vedi header dello script).
    printf 'initial\n' > file.txt
    git add file.txt >/dev/null 2>&1
    git commit -q -m "chore: initial"
    git checkout -q -b feature-x
    printf 'branch work\n' > file.txt
    git add file.txt >/dev/null 2>&1
    git commit -q -m "chore: branch"
    git checkout -q main
  )
}

echo "=== Scenario 1: working tree pulito ==="
(
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1
  run_ps feature-x >/tmp/sbs-s1.out 2>&1
  rc=$?
  [ $rc -eq 0 ] && ok "exit 0 su albero pulito" || { ng "exit !=0 su albero pulito"; cat /tmp/sbs-s1.out; }
  [ "$(git branch --show-current)" = "feature-x" ] && ok "su feature-x dopo switch" || { ng "non su feature-x"; git branch --show-current; }
  [ -z "$(git stash list)" ] && ok "nessuno stash su albero pulito" || { ng "stash inatteso su albero pulito"; git stash list; }
  cd /; rm -rf "$D"
)

echo "=== Scenario 2: tracked dirty ==="
(
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1
  printf 'modifica tracked\n' >> file.txt
  run_ps feature-x >/tmp/sbs-s2.out 2>&1
  rc=$?
  [ $rc -eq 0 ] && ok "exit 0 su tracked dirty" || { ng "exit !=0 su tracked dirty"; cat /tmp/sbs-s2.out; }
  [ "$(git branch --show-current)" = "feature-x" ] && ok "su feature-x dopo switch" || { ng "non su feature-x"; }
  [ -n "$(git stash list)" ] && ok "stash creato su tracked dirty" || { ng "nessuno stash su tracked dirty"; }
  [ "$(git show HEAD:file.txt)" = "branch work" ] && ok "tracked ripristinato allo stato committato" || { ng "tracked non ripristinato"; git show HEAD:file.txt; }
  cd /; rm -rf "$D"
)

echo "=== Scenario 3: untracked dirty ==="
(
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1
  printf 'nuovo file\n' > untracked.txt
  run_ps feature-x >/tmp/sbs-s3.out 2>&1
  rc=$?
  [ $rc -eq 0 ] && ok "exit 0 su untracked dirty" || { ng "exit !=0 su untracked dirty"; cat /tmp/sbs-s3.out; }
  [ "$(git branch --show-current)" = "feature-x" ] && ok "su feature-x dopo switch" || { ng "non su feature-x"; }
  [ -z "$(git stash list)" ] && ok "nessuno stash su solo untracked" || { ng "stash inatteso su solo untracked"; git stash list; }
  [ -f untracked.txt ] && ok "untracked preservato post-checkout" || { ng "untracked perso post-checkout"; }
  cd /; rm -rf "$D"
)

# Contatore letto dal file di risultati: i contatori in memoria dei subshell
# non arrivano al padre (vedi nota in testa allo script).
pass=$(grep -c '^PASS$' "$RESULTS" 2>/dev/null || true)
fail=$(grep -c '^FAIL$' "$RESULTS" 2>/dev/null || true)
echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]
