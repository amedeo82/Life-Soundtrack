#!/usr/bin/env bash
# Test per i fix di issue #76:
#   (1) post-merge.ps1 -Check rileva i branch LOCALI orfani
#   (2) setup-worktree.ps1 esegue il fetch prima di validare il branch base
#
# Copre i tre casi che contano:
#   T1  branch locale con 0 commit unici e non checked-out -> ORFANO (segnalato)
#   T2  branch locale con >=1 commit unico               -> NONorfano (mai segnalato: non si perde lavoro)
#   T3  branch con 0 commit unici ma checked-out in una worktree -> NON orfano (lavoro attivo)
#   T4  setup-worktree.ps1 -SkipFetch avvisa che la base puo' essere stale
#   T5  setup-worktree.ps1 esegue il fetch prima di validare la base
#
# Richiede: git, bash e pwsh (o Windows PowerShell come fallback).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
POST_MERGE="$SCRIPT_DIR/post-merge.ps1"
SETUP_WT="$SCRIPT_DIR/setup-worktree.ps1"

if command -v pwsh >/dev/null 2>&1; then
  PS="pwsh"
elif command -v powershell >/dev/null 2>&1; then
  PS="powershell"
else
  echo "[SKIP] pwsh/powershell non disponibili"
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo "[SKIP] git non disponibile"
  exit 0
fi

pass=0
fail=0
ok() { echo "  [PASS] $1"; pass=$((pass + 1)); }
ng() { echo "  [FAIL] $1"; fail=$((fail + 1)); }

# Identita' git per i repo temporanei, via env var invece di `git config`.
# `git config` e' un processo separato: 4 spawn per ogni repo temporaneo.
# Con le env var l'identita' e le impostazioni sono risolte da git senza
# scrivere il file .git/config e senza spawn.
export GIT_AUTHOR_NAME="Test"
export GIT_AUTHOR_EMAIL="t@t.local"
export GIT_COMMITTER_NAME="Test"
export GIT_COMMITTER_EMAIL="t@t.local"
# `commit.gpgsign=false` + `core.autocrlf=false` iniettati via env: git >= 2.31
# (CI: ubuntu-latest, dev: 2.56) legge GIT_CONFIG_COUNT/KEY_n/VALUE_n come
# config addizionale per-process.
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0="commit.gpgsign"
export GIT_CONFIG_VALUE_0="false"
export GIT_CONFIG_KEY_1="core.autocrlf"
export GIT_CONFIG_VALUE_1="false"

# Repo temporaneo con origin bare e 2 commit su main.
make_repo() {
  local d="$1"
  mkdir -p "$d/origin.git"
  # `-b main`: branch iniziale esplicito, indipendente da
  # `init.defaultBranch` (che sul runner GitHub e' `master`).
  git init -q --bare -b main "$d/origin.git"
  git init -q -b main "$d/work"
  (
    cd "$d/work" || exit 1
    # NB: identita', gpgsign e autocrlf arrivano dalle env var esportate in
    # testa allo script: niente `git config` (4 processi per repo).
    printf 'a\n' > f.txt; git add f.txt; git commit -q -m "c1"
    git remote add origin "$d/origin.git"; git push -q -u origin main
    printf 'b\n' >> f.txt; git commit -q -am "c2"; git push -q origin main
    cp "$POST_MERGE" scripts_post_merge.ps1 2>/dev/null || true
    mkdir -p scripts && cp "$POST_MERGE" scripts/post-merge.ps1 && cp "$SETUP_WT" scripts/setup-worktree.ps1
    git add -A >/dev/null 2>&1; git commit -q -m "add scripts" >/dev/null 2>&1; git push -q origin main
  )
}

run_check() {
  (cd "$1" && "$PS" -NoProfile -ExecutionPolicy Bypass -File scripts/post-merge.ps1 -Check 2>&1)
}

echo "=== T1: branch locale orfano (0 commit unici, non checked-out) ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D/work" || exit 1
  git branch feat/80-orfano main

  out="$(run_check "$D/work")"
  if echo "$out" | grep -q "branch LOCALE orfano: feat/80-orfano"; then ok "orfano rilevato"; else ng "orfano NON rilevato"; echo "$out" | tail -5; fi
  if echo "$out" | grep -q "git branch -d feat/80-orfano"; then ok "comando di cleanup suggerito"; else ng "manca il comando suggerito"; fi
  git branch --list "feat/80-orfano" >/dev/null 2>&1 && [ -n "$(git branch --list 'feat/80-orfano')" ] && ok "-Check resta read-only (branch non toccato)" || ng "-Check ha modificato qualcosa"

  cd /; rm -rf "$D"
}

echo "=== T2: branch con lavoro non pushato NON deve essere segnalato ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D/work" || exit 1
  git checkout -q -b feat/81-lavoro
  printf 'lavoro\n' > nuovo.txt; git add nuovo.txt; git commit -q --no-verify -m "feat: lavoro non pushato"
  git checkout -q main

  out="$(run_check "$D/work")"
  if echo "$out" | grep -q "feat/81-lavoro"; then ng "lavoro non pushato segnalato come orfano (PERDITA LAVORO)"; echo "$out" | tail -6; else ok "lavoro non pushato NON segnalato (corretto)"; fi

  cd /; rm -rf "$D"
}

echo "=== T3: branch vuoto ma checked-out in una worktree NON e' orfano ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D/work" || exit 1
  git branch feat/82-inuso main
  git worktree add "$D/wt" feat/82-inuso >/dev/null 2>&1

  out="$(run_check "$D/work")"
  if echo "$out" | grep -q "branch LOCALE orfano: feat/82-inuso"; then ng "branch in uso segnalato come orfano"; else ok "branch checked-out NON segnalato (corretto)"; fi
  if echo "$out" | grep -q "feat/82-inuso' in uso"; then ok "mostrato come 'in uso (worktree attiva)'"; else ng "manca l'etichetta 'in uso'"; fi

  cd /; rm -rf "$D"
}

echo "=== T4+T5: setup-worktree.ps1 fetch ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D/work" || exit 1

  # T5: con fetch (percorso normale)
  out="$("$PS" -NoProfile -ExecutionPolicy Bypass -File scripts/setup-worktree.ps1 90 -Slug "fetch-on" -SkipGhCheck -NoPush 2>&1)"
  if echo "$out" | grep -q "Fetch di origin prima di validare"; then ok "fetch eseguito prima della validazione"; else ng "fetch non eseguito"; echo "$out" | tail -5; fi
  if echo "$out" | grep -q "Fetch completato"; then ok "fetch completato senza errori"; else ng "fetch non completato"; fi

  # T4: con -SkipFetch deve avvisare che la base puo' essere stale
  out="$("$PS" -NoProfile -ExecutionPolicy Bypass -File scripts/setup-worktree.ps1 90 -Slug "fetch-off" -SkipGhCheck -SkipFetch -NoPush 2>&1)"
  if echo "$out" | grep -q "PUO' essere stale"; then ok "con -SkipFetch avvisa della base potenzialmente stale"; else ng "nessun avviso stale con -SkipFetch"; echo "$out" | tail -5; fi

  # cleanup delle worktree create dai due setup (path derivato dal cwd del repo di prova)
  git worktree remove --force "$(pwd)/../ls-90-fetch-on" >/dev/null 2>&1
  git worktree remove --force "$(pwd)/../ls-90-fetch-off" >/dev/null 2>&1
  git worktree prune >/dev/null 2>&1
  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]