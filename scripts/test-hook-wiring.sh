#!/usr/bin/env bash
# Test di regressione per il WIRING degli hook del repository (issue #290).
#
# Difetto chiuso: `package.json` dichiarava sia `postinstall` (che imposta
# `core.hooksPath = .githooks` via `scripts/setup-hooks.js`) sia `prepare:
# husky` (husky v9 scrive `core.hooksPath = .husky/_`). pnpm esegue `prepare`
# DOPO `postinstall`: il setup veniva sovrascritto a ogni `pnpm install` e i
# tre hook di `.githooks/` (pre-commit, pre-push, post-checkout) NON sono mai
# stati eseguiti. Le difese documentate in AGENTS.md (F1/F7, D.4/G.4, F5)
# erano scritte ma mai esercitate.
#
# Un gate che passa sempre non e' un gate (lesson 43-1): qui la parte
# comportamentale esegue un `git commit` REALE in un repository temporaneo con
# `core.hooksPath` impostata su `.githooks/` e verifica che l'hook abortisca il
# commit su un branch non conforme. Non basta verificare che i file esistano:
# il difetto era esattamente "i file ci sono, ma non vengono eseguiti".
#
# Esegui con: bash scripts/test-hook-wiring.sh
# Richiede: bash, git.

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
GITHOOKS="$REPO_ROOT/.githooks"
PKG="$REPO_ROOT/package.json"

if ! command -v git >/dev/null 2>&1; then
  echo "[SKIP] git non disponibile"
  exit 0
fi

PASS=0
FAIL=0
ok() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
ng() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "=== parte 1: wiring statico ==="

# T1: nessun lifecycle script puo' puntare gli hook altrove.
if grep -q '"prepare"' "$PKG"; then
  ng "package.json dichiara ancora uno script \"prepare\" (potrebbe sovrascrivere core.hooksPath)"
else
  ok "T1 package.json non ha piu' uno script \"prepare\""
fi

# T2: nessuna dipendenza che tocchi il percorso degli hook.
if grep -q '"husky"' "$PKG"; then
  ng "package.json dipende ancora da husky (scrive core.hooksPath = .husky/_)"
else
  ok "T2 package.json non dipende piu' da husky"
fi

# T3: il setup degli hook e' ancora agganciato a postinstall.
if grep -q '"postinstall": "node scripts/setup-hooks.js"' "$PKG"; then
  ok "T3 postinstall esegue scripts/setup-hooks.js"
else
  ng "T3 postinstall non esegue piu' scripts/setup-hooks.js"
fi

# T4: la cartella .husky/ non esiste piu' (il sistema di hook e' uno solo).
if [ -d "$REPO_ROOT/.husky" ]; then
  ng "la cartella .husky/ esiste ancora: un secondo sistema di hook puo' prendere il path"
else
  ok "T4 non esiste una cartella .husky/ (un solo sistema di hook)"
fi

# T5: i quattro hook del repository ci sono.
missing=""
for hook in pre-commit commit-msg pre-push post-checkout; do
  [ -f "$GITHOOKS/$hook" ] || missing="$missing $hook"
done
if [ -z "$missing" ]; then
  ok "T5 i 4 hook sono presenti in .githooks/"
else
  ng "T5 hook mancanti in .githooks/:$missing"
fi

# T6: commitlint vive nel commit-msg.
if grep -q 'commitlint' "$GITHOOKS/commit-msg"; then
  ok "T6 .githooks/commit-msg esegue commitlint"
else
  ng "T6 .githooks/commit-msg non esegue commitlint"
fi

# T7: lint-staged vive nel pre-commit.
if grep -q 'lint-staged' "$GITHOOKS/pre-commit"; then
  ok "T7 .githooks/pre-commit esegue lint-staged"
else
  ng "T7 .githooks/pre-commit non esegue lint-staged"
fi

# T8: setup-hooks.js imposta .githooks E rilegge il valore (non si fida della scrittura).
if grep -q 'git config core.hooksPath' "$GITHOOKS/../scripts/setup-hooks.js" \
   && grep -q 'git config --get core.hooksPath' "$GITHOOKS/../scripts/setup-hooks.js"; then
  ok "T8 setup-hooks.js scrive core.hooksPath e lo rilegge per verifica"
else
  ng "T8 setup-hooks.js non scrive+riliegue core.hooksPath"
fi

# T9: la worktree configura lo stesso percorso (D-27.6).
if grep -q 'core.hooksPath .githooks' "$REPO_ROOT/scripts/setup-worktree.ps1"; then
  ok "T9 setup-worktree.ps1 configura core.hooksPath = .githooks"
else
  ng "T9 setup-worktree.ps1 non configura core.hooksPath = .githooks"
fi

echo "=== parte 2: comportamento reale (git commit in un repo temporaneo) ==="

REPO="$WORK/repo"
mkdir -p "$REPO"
git init -q -b main "$REPO" >/dev/null 2>&1
cd "$REPO" || exit 2
git config user.email "test@example.com"
git config user.name "Test"
git config core.autocrlf false
git config core.eol lf
# Il path degli hook e' quello del repository sotto test: e' il collegamento
# che nella realta' era rotto.
git config core.hooksPath "$GITHOOKS"

printf 'v0\n' > file.txt
git add file.txt
git commit -q -m "chore: initial" >/dev/null 2>&1

# T10: branch NON conforme -> il commit deve essere ABORTATO dall'hook.
git checkout -q -B feature/no-issue-number
printf 'v1\n' > file.txt
git add file.txt
out=$(git commit -m "feat: violazione del pattern" 2>&1)
ec=$?
if [ "$ec" -ne 0 ]; then
  ok "T10 commit su branch non conforme: abortito (exit $ec)"
else
  ng "T10 commit su branch non conforme: PASSATO (l'hook non ha girato)"
fi
if echo "$out" | grep -q "non matcha il pattern del workflow agenti"; then
  ok "T10b il messaggio di abort e' quello del pre-commit hook"
else
  ng "T10b il messaggio di abort non e' quello del pre-commit hook: $out"
fi

# T11: branch conforme -> il commit deve PASSARE (l'hook non blocca tutto).
git checkout -q -B feat/290-hooks-wiring
printf 'v2\n' > file.txt
git add file.txt
out=$(git commit -m "feat: branch conforme" 2>&1)
ec=$?
if [ "$ec" -eq 0 ]; then
  ok "T11 commit su branch conforme: passato"
else
  ng "T11 commit su branch conforme: abortito (l'hook blocca troppo): $out"
fi

# T12: il commit-msg e' collegato (Conventional Commits).
printf 'v3\n' > file.txt
git add file.txt
out=$(git commit -m "questo non e' un conventional commit" 2>&1)
ec=$?
if [ "$ec" -ne 0 ]; then
  ok "T12 messaggio non Conventional Commits: abortito dal commit-msg"
else
  # commitlint non e' installato nel repo temporaneo: il commit-msg deve
  # saltarlo con un WARN, non fallire. In entrambi i casi il gate non e'
  # rotto, ma il caso "passato" e' quello atteso qui.
  if echo "$out" | grep -qE "commitlint non disponibile|nessuna configurazione commitlint"; then
    ok "T12 commitlint non utilizzabile: saltato con WARN (il hook e' collegato)"
  else
    ng "T12 il commit-msg non ha né bloccato né segnalato l'assenza di commitlint: $out"
  fi
fi

cd / >/dev/null 2>&1

# T13: il pre-push NON usa il secondo argomento come branch.
# git invoca il pre-push con <remote-name> <remote-URL>: la versione precedente
# costruiva "origin/<URL>", un ref inesistente, e la condizione non matchava
# MAI (il bundle non veniva rigenerato).
if grep -q 'remote_branch="\$2"' "$GITHOOKS/pre-push"; then
  ng "T13 il pre-push usa \$2 (l'URL del remote) come branch: la condizione non puo' matchare"
else
  ok "T13 il pre-push non usa \$2 come branch (l'URL del remote non e' un branch)"
fi
if grep -q 'git rev-parse --abbrev-ref HEAD' "$GITHOOKS/pre-push"; then
  ok "T13b il pre-push determina il branch corrente"
else
  ng "T13b il pre-push non determina il branch corrente"
fi

# T14: la condizione del pre-push (branch spinto x file del catalogo) MATCHA.
# Repo temporaneo con un `origin/main` locale e un branch che cambia docs/.
PUSH_REPO="$WORK/pushrepo"
mkdir -p "$PUSH_REPO"
git init -q -b main "$PUSH_REPO" >/dev/null 2>&1
(
  cd "$PUSH_REPO" || exit 2
  git config user.email "test@example.com"
  git config user.name "Test"
  git config core.autocrlf false
  mkdir -p docs
  printf 'v0\n' > docs/qualcosa.md
  git add docs/qualcosa.md
  git commit -q -m "chore: base"
  BASE=$(git rev-parse HEAD)
  git update-ref refs/remotes/origin/main "$BASE"
  git checkout -q -B feat/290-prova
  printf 'v1\n' > docs/qualcosa.md
  git commit -q -am "docs: un documento"
  # il push passa l'URL del remote come secondo argomento: non e' un branch
  out=$(printf 'refs/heads/feat/290-prova %s refs/heads/feat/290-prova %s\n' \
    "$(git rev-parse HEAD)" "$(git rev-parse HEAD)" \
    | bash "$GITHOOKS/pre-push" origin https://github.com/example/repo.git 2>&1)
  if echo "$out" | grep -q "Rigenero BUNDLE.md"; then
    echo "  [PASS] T14 la condizione del pre-push matcha (file del catalogo cambiati)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] T14 la condizione del pre-push NON matcha: $out"
    FAIL=$((FAIL + 1))
  fi
)

echo "---"
echo "Risultati: $PASS passati, $FAIL falliti"
[ "$FAIL" -eq 0 ]
