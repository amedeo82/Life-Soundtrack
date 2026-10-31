#!/usr/bin/env bash
# Test per scripts/setup-worktree.ps1 (Issue #53 - P1 worktree default).
# Pattern analogo a scripts/test-pre-commit-clean-check.sh (S23): mock repo in tmpdir.
#
# Scenari coperti:
#   S1 - Issue inesistente (senza -SkipGhCheck, con mock gh che fallisce)
#   S2 - Slug derivato dal titolo (default behaviour)
#   S3 - Slug esplicito passato dall'utente
#   S4 - Worktree path gia esistente
#   S5 - Branch base inesistente
#   S6 - Idempotenza: 2 chiamate identiche consecutive -> la 2a fallisce (path esistente)
#   S7 - -NoPush salta il push
#   S8 - -SkipGhCheck funziona senza gh nel PATH
#
# Uso:
#   bash scripts/test-setup-worktree.sh
#
# Requisiti:
#   - bash 3.2+ (compatibile WSL, Git Bash, Linux, macOS)
#   - pwsh (PowerShell Core/Desktop) disponibile
#   - git disponibile

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_SCRIPT="$SCRIPT_DIR/setup-worktree.ps1"

if [ ! -f "$TARGET_SCRIPT" ]; then
  echo "ERRORE: $TARGET_SCRIPT non trovato." >&2
  exit 1
fi

if ! command -v pwsh >/dev/null 2>&1; then
  echo "ERRORE: pwsh non trovato nel PATH. Installare PowerShell per eseguire i test." >&2
  exit 1
fi

# Contatore pass/fail
PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "  [FAIL] $1"; echo "         $2"; }

# Sessione 73 (issue #224): `mktemp -d` restituisce un path POSIX
# (/tmp/tmp.XXXX) che il pwsh nativo su Windows NON risolve: i path vanno
# convertiti con `cygpath -w` (disponibile in Git Bash, assente su Linux,
# dove il path POSIX passa invariato e il comportamento in CI non cambia).
# Stesso helper di scripts/test-bundle-check-idempotent.sh (D.117.4).
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

# TMPDIR e PATH originali, ripristinati dopo ogni scenario.
ORIG_TMPDIR="${TMPDIR:-}"
ORIG_PATH="$PATH"

# Helper: crea mock repo + mock gh in tmpdir
# $1 = scenario name (per logging)
# Output: variabili d'ambiente TMPDIR, REPO_DIR, WORKTREE_PARENT, PATH (esteso con mock bin)
make_mock_env() {
  local name="$1"
  local tmpdir
  tmpdir="$(mktemp -d)"
  # Repo principale
  local repo_dir="$tmpdir/repo"
  mkdir -p "$repo_dir"
  cd "$repo_dir"
  git init --quiet -b main
  # Identita' git via env var invece di `git config` (nessun subprocess).
  GIT_AUTHOR_NAME="Test" GIT_AUTHOR_EMAIL="test@example.com" \
  GIT_COMMITTER_NAME="Test" GIT_COMMITTER_EMAIL="test@example.com" \
    git commit --quiet --allow-empty -m "initial commit" 2>/dev/null || true
  echo "# Test repo" > README.md
  git add README.md
  GIT_AUTHOR_NAME="Test" GIT_AUTHOR_EMAIL="test@example.com" \
  GIT_COMMITTER_NAME="Test" GIT_COMMITTER_EMAIL="test@example.com" \
    git commit --quiet -m "initial commit"
  # Bare remote per il push
  local remote_dir="$tmpdir/remote.git"
  # `-b main`: branch iniziale esplicito, indipendente da
  # `init.defaultBranch` (che sul runner GitHub e' `master`).
  git init --quiet --bare -b main "$remote_dir"
  git remote add origin "$remote_dir"
  git push --quiet -u origin main

  # Worktree parent (un livello sopra la repo)
  local parent_dir
  parent_dir="$(dirname "$repo_dir")"

  # Mock gh script: legge issue da $MOCK_ISSUE_STATE env var
  local mock_bin="$tmpdir/mock-bin"
  mkdir -p "$mock_bin"
  cat > "$mock_bin/gh" <<'EOF'
#!/usr/bin/env bash
# Mock gh per test setup-worktree.ps1
# Comportamento controllato da env vars:
#   MOCK_ISSUE_STATE  = "ok" | "missing" | "closed" | "no-agent-ready" | "in-progress" | "status-blocked"
#   MOCK_ISSUE_TITLE  = titolo restituito (default: "Test issue")
#   MOCK_ISSUE_LABELS = CSV label (default: "agent-ready,phase-0,docs")
if [ "$1" = "issue" ] && [ "$2" = "view" ]; then
  case "${MOCK_ISSUE_STATE:-ok}" in
    missing)
      echo "Could not resolve to a Repository or Issue" >&2
      exit 1
      ;;
    closed)
      echo '{"state":"CLOSED","title":"test","labels":[]}'
      exit 0
      ;;
    no-agent-ready)
      echo '{"state":"OPEN","title":"Test issue","labels":[{"name":"docs"}]}'
      exit 0
      ;;
    in-progress)
      echo '{"state":"OPEN","title":"Test issue","labels":[{"name":"agent-ready"},{"name":"in-progress"}]}'
      exit 0
      ;;
    status-blocked)
      echo '{"state":"OPEN","title":"Test issue","labels":[{"name":"agent-ready"},{"name":"status:blocked"}]}'
      exit 0
      ;;
    *)
      title="${MOCK_ISSUE_TITLE:-Test issue}"
      labels="${MOCK_ISSUE_LABELS:-agent-ready,phase-0,docs}"
      labels_json=""
      IFS=',' read -ra arr <<< "$labels"
      for l in "${arr[@]}"; do
        [ -n "$labels_json" ] && labels_json+=","
        labels_json+="{\"name\":\"$l\"}"
      done
      echo "{\"state\":\"OPEN\",\"title\":\"$title\",\"labels\":[$labels_json]}"
      exit 0
      ;;
  esac
fi
# Comportamento di default: ignora altri comandi (per non rompere il flusso)
exit 0
EOF
  chmod +x "$mock_bin/gh"

  # Sessione 73 (issue #224): su Windows il pwsh NATIVO risolve `gh` tramite
  # PATHEXT, quindi uno script bash senza estensione non e' eseguibile e il
  # mock non veniva intercettato ("impossibile leggere issue #N"). Si aggiunge
  # un wrapper `gh.cmd` che delega al mock bash. Su Linux il wrapper non serve
  # (il mock e' gia' eseguibile) e non viene creato.
  if uname -s 2>/dev/null | grep -qi 'mingw\|msys\|cygwin\|windows'; then
    cat > "$mock_bin/gh.cmd" <<'EOF'
@echo off
bash "%~dp0gh" %*
EOF
  fi

  # Esporta variabili
  export TMPDIR="$tmpdir"
  export REPO_DIR="$repo_dir"
  export WORKTREE_PARENT="$parent_dir"
  export PATH="$mock_bin:$PATH"
  export MOCK_ISSUE_STATE="ok"
  export MOCK_ISSUE_TITLE="Test issue"
  export MOCK_ISSUE_LABELS="agent-ready,phase-0,docs"
}

cleanup_mock_env() {
  if [ -n "${TMPDIR:-}" ] && [ -d "$TMPDIR" ]; then
    rm -rf "$TMPDIR"
  fi
  # Sessione 73 (issue #224): TMPDIR e PATH vanno RIPRISTINATI. Senza questo,
  # lo scenario successivo ereditava un TMPDIR gia' cancellato (`mktemp -d`
  # falliva con "No such file or directory") e il PATH accumulava i
  # mock_bin deprecati — cosi' lo scenario S8 non riusciva a togliere il mock
  # `gh` dal PATH e falliva. Il difetto non era specifico di Windows:
  # `mktemp` onora TMPDIR anche su Linux, quindi la suite falliva ovunque.
  if [ -n "$ORIG_TMPDIR" ]; then export TMPDIR="$ORIG_TMPDIR"; else unset TMPDIR; fi
  export PATH="$ORIG_PATH"
}

# === S1: Issue inesistente ===
test_s1_issue_missing() {
  echo ""
  echo "Scenario S1: issue inesistente (mock gh fallisce)"
  make_mock_env "s1"
  MOCK_ISSUE_STATE="missing"
  local output exitcode
  # NB: senza `-SkipGhCheck`: e' il mock `gh` (MOCK_ISSUE_STATE=missing) a
  # dover fallire. Con -SkipGhCheck la verifica dell'issue viene saltata e
  # lo scenario non testerebbe nulla.
  output="$(cd "$REPO_DIR" && pwsh "$TARGET_SCRIPT_PS" 99 2>&1)" && exitcode=0 || exitcode=$?
  if [ "$exitcode" -ne 0 ]; then
    pass "S1 exitcode non-zero per issue inesistente (exit=$exitcode)"
  else
    fail "S1" "doveva fallire ma exit=$exitcode"
  fi
  cleanup_mock_env
}

# === S2: Slug derivato dal titolo (default) ===
test_s2_slug_derived() {
  echo ""
  echo "Scenario S2: slug derivato dal titolo"
  make_mock_env "s2"
  MOCK_ISSUE_TITLE="My Cool Feature [Test]"
  local output
  output="$(cd "$REPO_DIR" && pwsh "$TARGET_SCRIPT_PS" 42 -NoPush 2>&1)" || true
  # Sessione 73 (issue #224): l'asserzione confrontava l'intero path, che su
  # Windows e' un path nativo (`C:\...\ls-42-...`) e su Linux un path POSIX
  # (`/tmp/.../ls-42-...`): la suite passava solo su Linux. Qui si confronta
  # il LEAF del path — che e' cio' che lo scenario verifica davvero (la
  # derivazione dello slug) — ed e' indipendente dalla piattaforma.
  if echo "$output" | grep -q "Worktree creata:.*ls-42-my-cool-feature-test"; then
    pass "S2 worktree creata con path corretto"
  else
    fail "S2" "path worktree non trovato. Output: $output"
  fi
  cleanup_mock_env
}

# === S3: Slug esplicito ===
test_s3_slug_explicit() {
  echo ""
  echo "Scenario S3: slug esplicito dall'utente"
  make_mock_env "s3"
  local output
  output="$(cd "$REPO_DIR" && pwsh "$TARGET_SCRIPT_PS" 42 -Slug "custom-fix" -NoPush 2>&1)" || true
  # Leaf del path (vedi nota in S2): indipendente dalla piattaforma.
  if echo "$output" | grep -q "Worktree creata:.*ls-42-custom-fix"; then
    pass "S3 worktree creata con slug esplicito"
  else
    fail "S3" "slug esplicito non rispettato. Output: $output"
  fi
  cleanup_mock_env
}

# === S4: Worktree path gia esistente ===
test_s4_path_exists() {
  echo ""
  echo "Scenario S4: worktree path gia esistente"
  make_mock_env "s4"
  mkdir -p "$WORKTREE_PARENT/ls-99-existing"
  local output exitcode
  output="$(cd "$REPO_DIR" && pwsh "$TARGET_SCRIPT_PS" 99 -Slug "existing" -NoPush 2>&1)" && exitcode=0 || exitcode=$?
  if [ "$exitcode" -ne 0 ] && echo "$output" | grep -q "gia esistente"; then
    pass "S4 errore rilevato correttamente (exit=$exitcode)"
  else
    fail "S4" "doveva fallire con messaggio 'gia esistente'. Output: $output"
  fi
  cleanup_mock_env
}

# === S5: Branch base inesistente ===
test_s5_base_branch_missing() {
  echo ""
  echo "Scenario S5: branch base inesistente"
  make_mock_env "s5"
  local output exitcode
  output="$(cd "$REPO_DIR" && pwsh "$TARGET_SCRIPT_PS" 42 -BaseBranch origin/does-not-exist -NoPush 2>&1)" && exitcode=0 || exitcode=$?
  if [ "$exitcode" -ne 0 ] && echo "$output" | grep -q "branch base 'origin/does-not-exist' non trovato"; then
    pass "S5 errore branch base mancante (exit=$exitcode)"
  else
    fail "S5" "doveva fallire con messaggio branch base. Output: $output"
  fi
  cleanup_mock_env
}

# === S6: Idempotenza (2 chiamate identiche) ===
test_s6_idempotent_fails() {
  echo ""
  echo "Scenario S6: 2 chiamate identiche -> la 2a fallisce"
  make_mock_env "s6"
  cd "$REPO_DIR"
  local first second
  first="$(pwsh "$TARGET_SCRIPT_PS" 42 -Slug "idem" -NoPush 2>&1)" || true
  second="$(pwsh "$TARGET_SCRIPT_PS" 42 -Slug "idem" -NoPush 2>&1)" && ec=0 || ec=$?
  if echo "$first" | grep -q "Worktree creata"; then
    if [ "$ec" -ne 0 ] && echo "$second" | grep -q "gia esistente"; then
      pass "S6 1a chiamata OK + 2a fallisce con 'gia esistente'"
    else
      fail "S6" "2a chiamata doveva fallire. Output 2a: $second"
    fi
  else
    fail "S6" "1a chiamata doveva riuscire. Output: $first"
  fi
  cleanup_mock_env
}

# === S7: -NoPush salta il push ===
test_s7_no_push() {
  echo ""
  echo "Scenario S7: -NoPush salta il push"
  make_mock_env "s7"
  local output
  output="$(cd "$REPO_DIR" && pwsh "$TARGET_SCRIPT_PS" 42 -NoPush 2>&1)" || true
  if echo "$output" | grep -q "Push early SKIPPATO"; then
    pass "S7 push saltato correttamente con -NoPush"
  else
    fail "S7" "doveva mostrare 'Push early SKIPPATO'. Output: $output"
  fi
  cleanup_mock_env
}

# === S8: -SkipGhCheck funziona senza gh ===
test_s8_skip_gh_check() {
  echo ""
  echo "Scenario S8: -SkipGhCheck senza gh disponibile"
  make_mock_env "s8"
  # Rimuovi mock gh dal PATH
  local mock_bin_path
  mock_bin_path="$(echo "$PATH" | tr ':' '\n' | grep "mock-bin$" || true)"
  if [ -n "$mock_bin_path" ]; then
    export PATH="${PATH//$mock_bin_path:/}"
  fi
  # Rinomina il mock gh per assicurarsi che non sia in PATH
  if [ -d "$mock_bin_path" ]; then
    rm -rf "$mock_bin_path"
  fi
  local output exitcode
  output="$(cd "$REPO_DIR" && pwsh "$TARGET_SCRIPT_PS" 42 -SkipGhCheck -NoPush 2>&1)" && exitcode=0 || exitcode=$?
  if [ "$exitcode" -eq 0 ] && echo "$output" | grep -q "Salto verifica issue"; then
    pass "S8 -SkipGhCheck funziona senza gh nel PATH (exit=$exitcode)"
  else
    fail "S8" "SkipGhCheck doveva riuscire. Output: $output"
  fi
  cleanup_mock_env
}

# === Esegui tutti ===
test_s1_issue_missing
test_s2_slug_derived
test_s3_slug_explicit
test_s4_path_exists
test_s5_base_branch_missing
test_s6_idempotent_fails
test_s7_no_push
test_s8_skip_gh_check

echo ""
echo "=============================================="
echo "Risultato: $PASS passati, $FAIL falliti su $TOTAL scenari"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0