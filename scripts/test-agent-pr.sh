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
#   T3 - Gate locale: Conventional Commits non conforme -> PR NON aperta
#   T4 - Gate locale: test del writer post-merge rosso -> PR NON aperta
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

# Percorso ASSOLUTO del bash REALE.
#
# I mock (`pnpm`, `bash`) hanno uno shebang che richiama `bash`: se il mock
# di `bash` finisce nel PATH (ed è il caso: i mock vivono nella stessa
# directory), `#!/usr/bin/env bash` ritrova il MOCK STESSO e la ricorsione
# diventa infinita — un fork bomb che in CI ha bloccato il job
# `gates-procedure` per 20 minuti (poi timeout). Su Windows il wrapper
# `.cmd` chiamava il bash reale per percorso assoluto, e il difetto non
# compariva: è la differenza di piattaforma che lo nascondeva.
#
# `ORIG_PATH` è il PATH senza i mock: `command -v bash` li cerca lì e
# restituisce il binario di sistema.
REAL_BASH="$(PATH="$ORIG_PATH" command -v bash)"
[ -n "$REAL_BASH" ] || REAL_BASH="/bin/sh"

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

  # Il gate del writer post-merge (job `gates-workflows`) gira solo se lo
  # script esiste: nel repo mock ne basta la presenza.
  cp "$SCRIPT_DIR/test-post-merge-writer.sh" scripts/test-post-merge-writer.sh 2>/dev/null \
    || echo "# stub" > scripts/test-post-merge-writer.sh

  # `node_modules/.bin/commitlint` e' il segnale che agent-pr.ps1 usa per
  # decidere se commitlint e' eseguibile (issue #306). Il controllo e' sul
  # BINARIO, non sulla cartella: con `node_modules/.bin` vuota `pnpm exec`
  # tenta un'installazione dal registry invece di fallire subito.
  mkdir -p node_modules/.bin
  echo "mock" > node_modules/.bin/commitlint
  echo "mock" > node_modules/.bin/commitlint.cmd

  # Bundle TRACCIATO + generatore MOCK: `agent-pr.ps1` rigenera il bundle
  # prima di committare il file di sessione (la sessione e' nel catalogo
  # `$files`). Il mock lo modifica davvero, cosi' il percorso "bundle
  # cambiato" e' esercitato: e' il caso in cui il commit del bundle puo'
  # "inghiottare" il file di sessione (scenario T5).
  echo "bundle iniziale" > docs/BUNDLE.md
  cat > scripts/generate-bundle.ps1 <<'EOF'
# Mock del generatore del bundle: modifica docs/BUNDLE.md.
# Il percorso e' costruito con Split-Path (non con "..\") per funzionare
# anche su Linux, dove il backslash non e' un separatore.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$p = Join-Path $root "docs/BUNDLE.md"
Set-Content -LiteralPath $p -Value "bundle rigenerato" -Encoding utf8
exit 0
EOF
  git add -A
  GIT_AUTHOR_NAME="Test" GIT_AUTHOR_EMAIL="test@example.com" \
  GIT_COMMITTER_NAME="Test" GIT_COMMITTER_EMAIL="test@example.com" \
    git commit --quiet -m "setup bundle"

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
  if ($env:MOCK_GH_LOG) { Add-Content -Path $env:MOCK_GH_LOG -Value "pr create" }
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

# Mock pnpm: `pnpm exec commitlint` fallisce (simula un body di commit che
# viola `body-max-line-length`).
#
# $2 = "fail" (default) -> commitlint fallisce; "ok" -> commitlint passa.
#
# Il mock serve anche a ISOLARE il test dalla rete: senza, `pnpm exec` in un
# repo senza package.json tenta un'installazione dal registry (in CI: 20
# minuti di attesa, poi timeout del job).
make_mock_pnpm() {
  local tmpdir="$1"
  local mode="${2:-fail}"
  local mock_bin="$tmpdir/mock-bin"
  mkdir -p "$mock_bin"
  cat > "$mock_bin/pnpm" <<EOF
#!$REAL_BASH
if [ "\$1" = "exec" ] && [ "\$2" = "commitlint" ]; then
  if [ "$mode" = "fail" ]; then
    echo "mock commitlint: body's lines must not be longer than 100 characters [body-max-line-length]" >&2
    exit 1
  fi
  exit 0
fi
exit 0
EOF
  chmod +x "$mock_bin/pnpm"
  if uname -s 2>/dev/null | grep -qi 'mingw\|msys\|cygwin\|windows'; then
    if [ "$mode" = "fail" ]; then
      cat > "$mock_bin/pnpm.cmd" <<'EOF'
@echo off
if "%1"=="exec" if "%2"=="commitlint" (
  echo mock commitlint: body's lines must not be longer than 100 characters 1>&2
  exit /b 1
)
exit /b 0
EOF
    else
      cat > "$mock_bin/pnpm.cmd" <<'EOF'
@echo off
exit /b 0
EOF
    fi
  fi
}

# Mock bash: il probe di disponibilita' (`bash -c "exit 0"`) passa, ma
# l'esecuzione di uno script fallisce: simula il gate del writer post-merge
# che non passa.
make_mock_bash() {
  local tmpdir="$1"
  local mock_bin="$tmpdir/mock-bin"
  mkdir -p "$mock_bin"
  cat > "$mock_bin/bash" <<EOF
#!$REAL_BASH
if [ "\$1" = "-c" ]; then exit 0; fi
echo "mock bash: script fallito" >&2
exit 1
EOF
  chmod +x "$mock_bin/bash"
  if uname -s 2>/dev/null | grep -qi 'mingw\|msys\|cygwin\|windows'; then
    local bash_win
    bash_win="$(cygpath -w "$(command -v bash)")"
    cat > "$mock_bin/bash.cmd" <<EOF
@echo off
"$bash_win" "%~dp0bash" %*
EOF
  fi
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
  # Rimuove SOLO la directory creata dal test (`TEST_TMPDIR`).
  #
  # `TMPDIR` puo' essere la directory temporanea DI SISTEMA (Windows: %TEMP%,
  # cioe' C:\Users\<utente>\AppData\Local\Temp): rimuoverla a quel punto
  # cancellerebbe i file temporanei di altri programmi. Il bug era gia' nel
  # test (la `trap cleanup EXIT` rimuoveva `$TMPDIR`, che a quel punto era
  # gia' stato ripristinato sul valore ORIGINALE) e si e' manifestato su
  # Windows, dove `TMPDIR` e' impostata: `rm -rf /tmp` ha cancellato la
  # `%TEMP%` dell'utente. Da qui la separazione esplicita.
  if [ -n "${TEST_TMPDIR:-}" ] && [ -d "$TEST_TMPDIR" ]; then
    if [ -n "${KEEP_TEST_TMP:-}" ]; then
      echo "[test-agent-pr] KEEP_TEST_TMP: directory mantenuta: $TEST_TMPDIR"
    else
      rm -rf "$TEST_TMPDIR"
    fi
  fi
  TEST_TMPDIR=""
  if [ -n "$ORIG_TMPDIR" ]; then export TMPDIR="$ORIG_TMPDIR"; else unset TMPDIR; fi
  export PATH="$ORIG_PATH"
  # `MOCK_GH_LOG` deve morire con la directory che lo ospita: se resta
  # esportato, il mock `gh` scrive in un percorso gia' cancellato e fallisce
  # (scenario T5).
  unset MOCK_GH_LOG
}

# Crea la directory di lavoro del test e la registra per la pulizia.
new_tmpdir() {
  TEST_TMPDIR="$(mktemp -d)"
  export TMPDIR="$TEST_TMPDIR"
}

trap cleanup EXIT

# === T1: Sessione singola matching -> step 6 scrive pr: 77, exit 0 ===
echo ""
echo "Scenario T1: sessione singola matching (caso buggato pre-fix)"
new_tmpdir
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
new_tmpdir
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

# === T3: gate locale Conventional Commits rosso -> la PR NON viene aperta ===
echo ""
echo "Scenario T3: commitlint non conforme -> PR non aperta"
new_tmpdir
REPO_DIR="$(make_repo "$TMPDIR")"
make_mock_gh "$TMPDIR"
make_mock_pnpm "$TMPDIR"
BODY_FILE="$(make_body_file "$TMPDIR")"
BODY_FILE_PS="$(ps_path "$BODY_FILE")"
export MOCK_GH_LOG="$TMPDIR/gh.log"

cd "$REPO_DIR"
LOCAL_SCRIPT_PS="$(ps_path "$REPO_DIR/scripts/agent-pr.ps1")"
OUTPUT="$(pwsh "$LOCAL_SCRIPT_PS" -IssueNumber 286 -BodyFile "$BODY_FILE_PS" 2>&1)" && EC=0 || EC=$?

if [ "$EC" -ne 0 ] && echo "$OUTPUT" | grep -q "commitlint"; then
  pass "T3 commitlint non conforme -> uscita non zero (gate locale bloccante)"
else
  fail "T3" "ec=$EC; output=$OUTPUT"
fi
if [ -f "$MOCK_GH_LOG" ] && grep -q "pr create" "$MOCK_GH_LOG"; then
  fail "T3" "la PR e' stata creata nonostante il gate rosso"
else
  pass "T3 nessuna PR creata (il gate ha bloccato prima di gh pr create)"
fi
cleanup

# === T4: gate locale del writer post-merge rosso -> la PR NON viene aperta ===
echo ""
echo "Scenario T4: test del writer post-merge rosso -> PR non aperta"
new_tmpdir
REPO_DIR="$(make_repo "$TMPDIR")"
make_mock_gh "$TMPDIR"
make_mock_bash "$TMPDIR"
# commitlint deve PASSARE: e' il gate successivo (quello del writer
# post-merge) che deve fallire. Senza il mock, `pnpm exec` in questo repo
# mock tenta un'installazione dal registry (in CI: 20 minuti, poi timeout).
make_mock_pnpm "$TMPDIR" ok
BODY_FILE="$(make_body_file "$TMPDIR")"
BODY_FILE_PS="$(ps_path "$BODY_FILE")"
export MOCK_GH_LOG="$TMPDIR/gh.log"

cd "$REPO_DIR"
LOCAL_SCRIPT_PS="$(ps_path "$REPO_DIR/scripts/agent-pr.ps1")"
OUTPUT="$(pwsh "$LOCAL_SCRIPT_PS" -IssueNumber 286 -BodyFile "$BODY_FILE_PS" 2>&1)" && EC=0 || EC=$?

if [ "$EC" -ne 0 ] && echo "$OUTPUT" | grep -q "test-post-merge-writer.sh"; then
  pass "T4 gate del writer rosso -> uscita non zero (gate locale bloccante)"
else
  fail "T4" "ec=$EC; output=$OUTPUT"
fi
# Il mock di `bash` non puo' avere uno shebang `env bash`: il mock e' nel
# PATH, `env` lo ritroverebbe e la ricorsione sarebbe infinita (fork bomb:
# in CI il job `gates-procedure` e' rimasto bloccato 20 minuti).
if head -1 "$TMPDIR/mock-bin/bash" | grep -q 'env bash'; then
  fail "T4" "il mock di bash ha uno shebang 'env bash': rischio di ricorsione infinita"
else
  pass "T4 il mock di bash non puo' richiamare se stesso"
fi
if [ -f "$MOCK_GH_LOG" ] && grep -q "pr create" "$MOCK_GH_LOG"; then
  fail "T4" "la PR e' stata creata nonostante il gate rosso"
else
  pass "T4 nessuna PR creata (il gate ha bloccato prima di gh pr create)"
fi
cleanup

# === T5: il commit del bundle NON inghiotte il commit della sessione ===
echo ""
echo "Scenario T5: bundle rigenerato -> due commit separati"
new_tmpdir
REPO_DIR="$(make_repo "$TMPDIR")"
make_mock_gh "$TMPDIR"
BODY_FILE="$(make_body_file "$TMPDIR")"
BODY_FILE_PS="$(ps_path "$BODY_FILE")"

cd "$REPO_DIR"
LOCAL_SCRIPT_PS="$(ps_path "$REPO_DIR/scripts/agent-pr.ps1")"
export MOCK_GH_LOG="$TMPDIR/gh.log"
OUTPUT="$(pwsh "$LOCAL_SCRIPT_PS" -IssueNumber 286 -SkipChecks -BodyFile "$BODY_FILE_PS" 2>&1)" && EC=0 || EC=$?

SESSION_FILE="$REPO_DIR/docs/state/sessions/286-test.md"
if [ "$EC" -eq 0 ]; then
  pass "T5 exit 0: il bundle non inghiotte il commit della sessione"
else
  fail "T5" "ec=$EC; output=$OUTPUT"
fi
if grep -q "^pr: 77$" "$SESSION_FILE" 2>/dev/null; then
  pass "T5 la sessione dichiara pr: 77"
else
  fail "T5" "la sessione non dichiara pr: 77: $(cat "$SESSION_FILE" 2>/dev/null)"
fi
BUNDLE_COMMIT="$(git log --format='%H %s' | grep 'chore(bundle)' | head -1 | cut -d' ' -f1)"
SESSION_COMMIT="$(git log --format='%H %s' | grep 'docs(state):' | head -1 | cut -d' ' -f1)"
if [ -z "$BUNDLE_COMMIT" ]; then
  fail "T5" "nessun commit 'chore(bundle)' trovato: il bundle non e' stato rigenerato"
elif git show --name-only --format= "$BUNDLE_COMMIT" | grep -q "docs/state/sessions/286-test.md"; then
  fail "T5" "il commit del bundle contiene anche il file di sessione: lo inghiotte"
else
  pass "T5 il commit del bundle contiene solo docs/BUNDLE.md"
fi
if [ -n "$SESSION_COMMIT" ]; then
  pass "T5 esiste un commit dedicato alla sessione"
else
  fail "T5" "nessun commit 'docs(state):' trovato"
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