#!/usr/bin/env bash
# Test per il pre-commit hook (.githooks/pre-commit).
#
# Parte 1: verifica che l'espressione del check "clean tree" (D3 working tree
# unstaged-only) distingua correttamente modifiche unstaged da staged, e che il
# check BUGGY (pre-fix) fallisca sui casi normali.
#
# Parte 2 (Sessione 79, issue #248, ADR-0012 D-79.6): verifica il COMPORTAMENTO
# del hook reale — invariante (pattern del branch) BLOCCANTE e igiene (working
# tree pulito) ADVISORY, con opt-in LIFE_SOUNDTRACK_STRICT_CLEAN=1.
# Un gate che passa sempre non è un gate (lesson 43-1): senza questa parte il
# refactor del pre-commit potrebbe essere fail-open senza che nessuno se ne accorga.
#
# Esegui con: bash scripts/test-pre-commit-clean-check.sh
# Richiede: bash, git.

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
HOOK_SRC="$REPO_ROOT/.githooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
  echo "[FAIL] hook non trovato: $HOOK_SRC"
  exit 2
fi

WORK=$(mktemp -d)
trap "rm -rf '$WORK'" EXIT

# Il hook viene copilotto FUORI dal repo di test: dentro creerebbe file
# untracked, che il check "clean tree" segnalerebbe come sporco in ogni scenario.
HOOK_COPY="$WORK/pre-commit-hook"
cp "$HOOK_SRC" "$HOOK_COPY"
chmod +x "$HOOK_COPY"

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

# ---------------------------------------------------------------------------
# Parte 2: comportamento REALE del hook
# ---------------------------------------------------------------------------

# Esegue il hook (dal cwd = repo di test) e restituisce il suo exit code.
run_hook() {
  local env_prefix="$1"
  ( export $env_prefix; bash "$HOOK_COPY" >/dev/null 2>&1 )
  echo $?
}

run_hook_scenario() {
  local id="$1" desc="$2" setup_action="$3" env_prefix="$4" expected_exit="$5"

  reset_to_clean
  # -B: ricrea/reset del branch, così lo scenario non dipende dall'ordine
  git checkout -q -B feat/1-test
  eval "$setup_action"

  local actual_exit
  actual_exit=$(run_hook "$env_prefix")

  local status="OK"
  if [ "$actual_exit" != "$expected_exit" ]; then
    status="FAIL"
  fi

  printf "%-3s %-46s | expected exit=%-3s | actual=%-3s (%s)\n" \
    "$id" "$desc" "$expected_exit" "$actual_exit" "$status"

  if [ "$status" = "OK" ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
}

PASS=0
FAIL=0

# --- Parte 1: espressione del check "clean tree" -----------------------------
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

# --- Parte 2: comportamento del hook ----------------------------------------
# H1: invariante — branch non conforme => BLOCCANTE (exit 1)
run_hook_scenario "H1" "branch non conforme (invariant) => abort" \
  "git checkout -q -B feature/no-issue-number" "LIFE_SOUNDTRACK_SKIP_HOOKS=0" "1"

# H2: igiene — tree sporco in modalita' default => ADVISORY (exit 0)
run_hook_scenario "H2" "tree sporco, default => advisory (no abort)" \
  "printf 'dirty\n' > file.txt" "LIFE_SOUNDTRACK_SKIP_HOOKS=0" "0"

# H3: igiene — tree sporco con STRICT_CLEAN => BLOCCANTE (exit 1)
run_hook_scenario "H3" "tree sporco, STRICT_CLEAN=1 => abort" \
  "printf 'dirty\n' > file.txt" "LIFE_SOUNDTRACK_STRICT_CLEAN=1" "1"

# H4: tutto pulito e branch conforme => exit 0
run_hook_scenario "H4" "tree pulito, branch conforme => ok" \
  ":" "LIFE_SOUNDTRACK_SKIP_HOOKS=0" "0"

# H5: file untracked in modalita' default => ADVISORY (exit 0)
run_hook_scenario "H5" "file untracked, default => advisory (no abort)" \
  "touch untracked-h5.txt" "LIFE_SOUNDTRACK_SKIP_HOOKS=0" "0"

# H6: bypass esplicito => exit 0 anche con invariante violata
run_hook_scenario "H6" "branch non conforme + SKIP_HOOKS=1 => ok" \
  "git checkout -q -B feature/no-issue-number" "LIFE_SOUNDTRACK_SKIP_HOOKS=1" "0"

# ---------------------------------------------------------------------------
# Parte 3: il PERCORSO ENCODING del pre-commit hook (issue #290)
# ---------------------------------------------------------------------------
# Il blocco encoding conteneva un `exit 0` che chiudeva l'hook prima dei
# controlli successivi. Con `scripts/check-encoding.mjs` presente (cioe' nel
# repository vero, sempre) l'hook:
#   - usciva con 0 anche quando il check encoding FALLIVA: il gate anti-mojibake
#     della issue #277 era morto dentro l'hook (scenario H9);
#   - non verificava MAI l'invariante del branch (F1/F7): l'unica difesa
#     documentata in AGENTS.md non girava (scenario H8).
# H1..H6 girano in un repo SENZA `scripts/check-encoding.mjs`: il percorso
# encoding (quello del repository vero) non era mai coperto. Qui lo si copre.
# Contro-prova: con l'hook di `main` gli scenari H8 e H9 escono 0 invece di 1.
create_encoding_stub() {
  mkdir -p scripts
  cat > scripts/check-encoding.mjs <<'STUB'
const mode = process.env.ENCODING_STUB_MODE || 'ok';
if (mode === 'fail') {
  console.error('[FAIL] encoding non valido (stub)');
  process.exit(1);
}
if (mode === 'warn') {
  console.log('[WARN] encoding in allowlist (stub)');
  process.exit(0);
}
console.log('[OK] 0 file con errori (stub)');
STUB
}

# H7: encoding pulito + branch conforme => exit 0
run_hook_scenario "H7" "encoding ok + branch conforme => ok" \
  "create_encoding_stub" "LIFE_SOUNDTRACK_SKIP_HOOKS=0 ENCODING_STUB_MODE=ok" "0"

# H8: encoding pulito + branch NON conforme => abort (l'invariante del branch
# deve eseguire DOPO il blocco encoding, non essere schiacciato dal suo exit 0)
run_hook_scenario "H8" "encoding ok + branch non conforme => abort" \
  "create_encoding_stub && git checkout -q -B feature/no-issue-number" \
  "LIFE_SOUNDTRACK_SKIP_HOOKS=0 ENCODING_STUB_MODE=ok" "1"

# H9: encoding FAIL + branch conforme => abort (il gate anti-mojibake deve
# poter bloccare il commit: con l'hook di main questo percorso usciva con 0)
run_hook_scenario "H9" "encoding fail + branch conforme => abort" \
  "create_encoding_stub" "LIFE_SOUNDTRACK_SKIP_HOOKS=0 ENCODING_STUB_MODE=fail" "1"

# H10: encoding in allowlist (WARN) + branch conforme => exit 0
run_hook_scenario "H10" "encoding warn + branch conforme => ok" \
  "create_encoding_stub" "LIFE_SOUNDTRACK_SKIP_HOOKS=0 ENCODING_STUB_MODE=warn" "0"

echo "---"
echo "Pass: $PASS   Fail: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "FAILURES"
  exit 1
fi
