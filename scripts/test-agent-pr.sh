#!/usr/bin/env bash
# Test di regressione per scripts/agent-pr.ps1 (Issue #286).
# Verifica che lo step 6 scriva `pr: N` nel file di sessione ed esca 0,
# anche quando esiste un singolo file di sessione per la branch (caso che,
# senza il wrapping `@(...)`, faceva fallire `.Count` su uno scalare
# sotto Set-StrictMode).
#
# Scenari:
#   T1 - Sessione singola matching -> step 6 scrive pr: N, exit 0
#   T2 - Nessuna sessione matching -> warning "NESSUN file di sessione", exit 0
#
# Uso: bash scripts/test-agent-pr.sh
# Richiede: bash, git, pwsh.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_SCRIPT="$SCRIPT_DIR/agent-pr.ps1"

if [ ! -f "$TARGET_SCRIPT" ]; then
  echo "ERRORE: $TARGET_SCRIPT non trovato." >&2
  exit 1
fi

if ! command -v pwsh >/dev/null 2>&1; then
  echo "ERRORE: pwsh non trovato nel PATH. Installare PowerShell per eseguire i test." >&2
  exit 1
fi

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "  [FAIL] $1"; echo "         $2"; }

# Helper: converte path POSIX in path nativo Windows per pwsh nativo (Sessione 73, issue #224).
# Su Linux il path passa invariato. Su Windows (Git Bash) serve cygpath.
PS_IS_PWSH=0
if command -v pwsh >/dev/null 2>&1; then PS_IS_PWSH=1; fi

ps_path() {
  local p="$1"
  if [ "$PS_IS_PWSH" = "1" ] && command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$p"
  else
    echo "$p"
  fi
}

TARGET_SCRIPT_PS="$(ps_path "$TARGET_SCRIPT")"

ORIG_TMPDIR="${TMPDIR:-}"
ORIG_PATH="$PATH"

# Crea repo mock con branch feat/286-test, agent-state.json, file sessione.
# $1 = tmpdir base
# $2 = branch name (default feat/286-test)
# $3 = session branch value (default feat/286-test)
# Output: stampa repo_dir
make_repo() {
  local tmpdir="$1"
  local branch="${2:-feat/286-test}"
  local session_branch="${3:-feat/286-test}"

  local repo_dir="$tmpdir/repo"
  mkdir -p "$repo_dir"
  cd "$repo_dir"
  git init --quiet -b main
  # Configura identità git locale per i commit (necessario per agent-pr.ps1 step 6)
  git config user.name "Test Agent"
  git config user.email "test@example.com"
  GIT_AUTHOR_NAME="Test" GIT_AUTHOR_EMAIL="test@example.com" \
  GIT_COMMITTER_NAME="Test" GIT_COMMITTER_EMAIL="test@example.com" \
    git commit --quiet --allow-empty -m "initial commit" 2>/dev/null || true
  echo "# test" > README.md
  git add README.md
  GIT_AUTHOR_NAME="Test" GIT_AUTHOR_EMAIL="test@example.com" \
  GIT_COMMITTER_NAME="Test" GIT_COMMITTER_EMAIL="test@example.com" \
    git commit --quiet -m "initial commit"

  # bare remote per push
  local remote_dir="$tmpdir/remote.git"
  git init --quiet --bare -b main "$remote_dir"
  git remote add origin "$remote_dir"
  git push --quiet -u origin main

  # branch di lavoro (simula worktree)
  git checkout --quiet -b "$branch"

  # stato agente SENZA campo 'session' -> percorso di fallback sui candidati (linee 160-167 agent-pr.ps1)
  mkdir -p docs/state/sessions
  cat > .git/agent-state.json <<EOF
{"issue":286,"branch":"$branch","agent_id":"kilo-test-286"}
EOF

  # file di sessione con pr: 0 e branch matching (o no per T2)
  cat > docs/state/sessions/286-test.md <<EOF
---
branch: $session_branch
pr: 0
---
EOF
  git add -A
  GIT_AUTHOR_NAME="Test" GIT_AUTHOR_EMAIL="test@example.com" \
  GIT_COMMITTER_NAME="Test" GIT_COMMITTER_EMAIL="test@example.com" \
    git commit --quiet -m "setup sessione"

  # set upstream per il push finale di agent-pr.ps1 (step 6: git push)
  git push --quiet -u origin "$branch"

  # Copia agent-pr.ps1 nel repo mock affinché $PSScriptRoot punti qui
  mkdir -p scripts
  cp "$SCRIPT_DIR/agent-pr.ps1" scripts/agent-pr.ps1

  echo "$repo_dir"
}

# Mock gh (PowerShell): repo view, pr create (restituisce URL con numero), issue edit (ok).
# pwsh nativo su Windows non esegue script bash come comandi; usiamo uno script .ps1.
make_mock_gh() {
  local tmpdir="$1"
  local mock_bin="$tmpdir/mock-bin"
  mkdir -p "$mock_bin"
  cat > "$mock_bin/gh.ps1" <<'EOF'
# $args è l'array automatico degli argomenti passati allo script
if ($args[0] -eq "repo" -and $args[1] -eq "view") {
  '{"nameWithOwner":"test/test"}'
  exit 0
}
if ($args[0] -eq "issue" -and $args[1] -eq "view") {
  '{"title":"Test issue 286"}'
  exit 0
}
if ($args[0] -eq "pr" -and $args[1] -eq "create") {
  "https://github.com/test/test/pull/77"
  exit 0
}
if ($args[0] -eq "issue" -and $args[1] -eq "edit") {
  exit 0
}
exit 0
EOF
  # Crea wrapper gh.cmd per compatibilità PATH Windows (chiama pwsh -File gh.ps1)
  cat > "$mock_bin/gh.cmd" <<'EOF'
@echo off
pwsh -NoProfile -File "%~dp0gh.ps1" %*
EOF
  export PATH="$mock_bin:$PATH"
}

# File body con keyword di chiusura nuda per issue 286.
make_body_file() {
  local tmpdir="$1"
  cat > "$tmpdir/pr-body.md" <<'EOF'
## Issue

Closes #286

- Tipo: bug fix
EOF
  echo "$tmpdir/pr-body.md"
}

cleanup() {
  if [ -n "${TMPDIR:-}" ] && [ -d "$TMPDIR" ]; then
    rm -rf "$TMPDIR"
  fi
  if [ -n "$ORIG_TMPDIR" ]; then export TMPDIR="$ORIG_TMPDIR"; else unset TMPDIR; fi
  export PATH="$ORIG_PATH"
}

trap cleanup EXIT

# === T1: Sessione singola matching -> step 6 scrive pr: 77, exit 0 ===
echo ""
echo "Scenario T1: sessione singola matching (caso buggato pre-fix)"
TMPDIR="$(mktemp -d)"
REPO_DIR="$(make_repo "$TMPDIR")"
make_mock_gh "$TMPDIR"
BODY_FILE="$(make_body_file "$TMPDIR")"
BODY_FILE_PS="$(ps_path "$BODY_FILE")"

# Esegui agent-pr.ps1 copiato nel repo mock (così $PSScriptRoot = repo mock)
cd "$REPO_DIR"
LOCAL_SCRIPT_PS="$(ps_path "$REPO_DIR/scripts/agent-pr.ps1")"
OUTPUT="$(pwsh "$LOCAL_SCRIPT_PS" -IssueNumber 286 -SkipChecks -BodyFile "$BODY_FILE_PS" 2>&1)" && EC=0 || EC=$?
SESSION_FILE="$REPO_DIR/docs/state/sessions/286-test.md"

if [ "$EC" -eq 0 ] && grep -q "^pr: 77$" "$SESSION_FILE"; then
  pass "T1 step 6 scrive pr: 77 ed esce 0 (sessione singola matching)"
else
  fail "T1" "ec=$EC; session=$(cat "$SESSION_FILE" 2>/dev/null || echo 'missing'); output=$OUTPUT"
fi
cleanup

# === T2: Nessuna sessione matching -> warning "NESSUN file di sessione", exit 0 ===
echo ""
echo "Scenario T2: nessuna sessione matching"
TMPDIR="$(mktemp -d)"
# session_branch diverso da branch lavoro -> nessun match
REPO_DIR="$(make_repo "$TMPDIR" "feat/286-test" "feat/99-other")"
make_mock_gh "$TMPDIR"
BODY_FILE="$(make_body_file "$TMPDIR")"
BODY_FILE_PS="$(ps_path "$BODY_FILE")"

cd "$REPO_DIR"
LOCAL_SCRIPT_PS="$(ps_path "$REPO_DIR/scripts/agent-pr.ps1")"
OUTPUT="$(pwsh "$LOCAL_SCRIPT_PS" -IssueNumber 286 -SkipChecks -BodyFile "$BODY_FILE_PS" 2>&1)" && EC=0 || EC=$?

if [ "$EC" -eq 0 ] && echo "$OUTPUT" | grep -q "NESSUN file di sessione"; then
  pass "T2 nessuna sessione matching -> warning + exit 0"
else
  fail "T2" "ec=$EC; output=$OUTPUT"
fi
cleanup

echo ""
echo "=============================================="
echo "Risultato: $PASS passati, $FAIL falliti su $TOTAL scenari"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0