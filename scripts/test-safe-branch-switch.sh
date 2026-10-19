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
ok()   { echo "  [PASS] $1"; pass=$((pass + 1)); }
ng()   { echo "  [FAIL] $1"; fail=$((fail + 1)); }

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
    git config user.email "t@t.local"
    git config user.name "Test"
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
)

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]
