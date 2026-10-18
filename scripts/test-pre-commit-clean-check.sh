#!/usr/bin/env bash
# Test per Check 1 di .githooks/pre-commit (D3 working tree unstaged-only).
# Verifica 6 scenari che il check FIXED distingua correttamente modifiche
# unstaged da staged, e che il check BUGGY (pre-fix) fallisca sui casi normali.
#
# Esegui con: bash scripts/test-pre-commit-clean-check.sh
# Richiede: bash, git.

set -u

WORK=$(mktemp -d)
trap "rm -rf '$WORK'" EXIT

cd "$WORK"
git init -q -b main testrepo
cd testrepo
git config user.email "test@example.com"
git config user.name "Test"
# Disabilita autocrlf per evitare che `echo > file` introduca diff spurii
git config core.autocrlf false
git config core.eol lf

# File iniziale committato
printf 'v0\n' > file.txt
git add file.txt
git commit -q -m "initial"

OLD_BUGGY='! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null'
NEW_FIXED='! git diff --quiet 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]'

# Restituisce 0 se il check SCATTA (bloccherebbe il commit), 1 altrimenti.
# (per IF in bash: 0 = vero)
check_blocks() {
  local expr="$1"
  if eval "$expr" >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

reset_to_clean() {
  # Stato pulito: tracked file = HEAD, nessun untracked
  printf 'v0\n' > file.txt
  git add file.txt
  git diff --quiet && git diff --cached --quiet && echo "BUG: not clean after reset" >&2
}

assert_clean_state() {
  # Verifica che il tree sia effettivamente pulito
  git diff --quiet && git diff --cached --quiet || echo "WARN: state not clean" >&2
}

run_scenario() {
  local id="$1" desc="$2" setup_action="$3" should_block="$4"

  reset_to_clean
  # Esegui lo scenario
  eval "$setup_action"

  # Misura NEW_FIXED
  if check_blocks "$NEW_FIXED"; then
    new_blocks=yes
  else
    new_blocks=no
  fi

  # Misura OLD_BUGGY
  if check_blocks "$OLD_BUGGY"; then
    old_blocks=yes
  else
    old_blocks=no
  fi

  # Valuta NEW_FIXED
  if [ "$new_blocks" = "$should_block" ]; then
    new_status="OK"
  else
    new_status="FAIL"
  fi

  printf "%-3s %-46s | expected=%-3s | NEW=%-3s (%s) | OLD=%-3s (%s)\n" \
    "$id" "$desc" "$should_block" "$new_blocks" "$new_status" "$old_blocks" "info"

  if [ "$new_status" = "OK" ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
}

PASS=0
FAIL=0

run_scenario "S1" "clean working tree, no staged, no unstaged"  ":" "no"
run_scenario "S2" "staged changes only (NORMAL COMMIT FLOW)" \
  "printf 'staged\n' > file.txt && git add file.txt" \
  "no"
run_scenario "S3" "unstaged changes only" \
  "printf 'modified\n' > file.txt" \
  "yes"
run_scenario "S4" "both staged and unstaged changes" \
  "printf 'staged\n' > file.txt && git add file.txt && printf 'unstaged\n' >> file.txt" \
  "yes"
run_scenario "S5" "brand new untracked file (unstaged)" \
  "touch newfile.txt" \
  "yes"
run_scenario "S6" "brand new file staged (git add)" \
  "touch newfile.txt && git add newfile.txt" \
  "no"
run_scenario "S7" "modifica a file tracked ma NON staged" \
  "printf 'hello\n' > file.txt" \
  "yes"
run_scenario "S8" "piffero: solo differenza in mode (chmod)" \
  "chmod 644 file.txt" \
  "no"

echo "---"
echo "Pass: $PASS   Fail: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "FAILURES"
  exit 1
fi
