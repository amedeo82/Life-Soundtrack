#!/usr/bin/env bash
# Test per scripts/post-merge.ps1 — procedura canonica post-merge.
#
# Copre i failure mode che la procedura deve impedire:
#   T1 main non aggiornato dopo il merge (il buco segnalato in review)
#   T2 worktree ancora registrata quando si tenta `git branch -d`
#   T3 cancellazione di un branch NON mergato (perdita di lavoro)
#   T4 WIP non committato durante una transizione distruttiva (E3/E4/E5)
#   T5 merge squash: `git branch -d` rifiutato, fallback `git cherry`
#   T6 main locale divergente: nessuna azione distruttiva
#   T7 audit -Check: segnala i residui, esce pulito quando tutto e' pulito
#   T8 idempotenza della procedura
#   T9 esecuzione da dentro la worktree: exit 15, branch intatto
#   T10 rimozione worktree con `git worktree remove` che fallisce: la
#      procedura deve usare il fallback long-path-safe ed uscire 0
#   T11 -WorktreePath sulla working copy principale: nessuna cancellazione
#      (guard di sicurezza del fallback manuale), exit 16
#   T12 path lunghi (> MAX_PATH) dentro la worktree: rimozione riuscita
#      (Windows: e' il caso "Filename too long" / "Result too large")
#   T13 catena completa su Windows PowerShell 5.1: L1 (git) e L2 (Remove-Item)
#      falliscono, interviene L3 (`rd /s /q "\\?\"`)
#   T14 rete di sicurezza L3 forzata (LIFE_SOUNDTRACK_WT_REMOVAL=rd)
#
# Richiede: git, bash e pwsh (o Windows PowerShell come fallback).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/post-merge.ps1"

is_windows() {
  [ "${OS:-}" = "Windows_NT" ] || uname -s 2>/dev/null | grep -qiE 'mingw|msys|cygwin'
}

if command -v pwsh >/dev/null 2>&1; then
  PS="pwsh"
elif command -v powershell >/dev/null 2>&1; then
  PS="powershell"
else
  echo "[SKIP] pwsh/powershell non disponibili: impossibile eseguire post-merge.ps1"
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

run_ps() {
  "$PS" -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT" "$@" 2>&1
  return $?
}

run_ps51() {
  powershell -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT" "$@" 2>&1
  return $?
}

# Installa uno shim di `git` che fallisce SOLO su `worktree remove`,
# simulando l'errore Windows "Filename too long" / "Result too large".
# Tutto il resto e' delegato al git vero. Esporta SHIM_DIR.
install_git_shim() {
  SHIM_DIR="$(mktemp -d)"
  REAL_GIT="$(command -v git)"
  if is_windows; then
    cat > "$SHIM_DIR/git.cmd" <<EOF
@echo off
echo %* | findstr /C:"worktree remove" >nul && (
  echo error: failed to delete: Filename too long 1>&2
  exit /b 255
)
"$(cygpath -w "$REAL_GIT")" %*
EOF
  else
    cat > "$SHIM_DIR/git" <<EOF
#!/usr/bin/env bash
prev=""
for a in "\$@"; do
  if [ "\$a" = "remove" ] && [ "\$prev" = "worktree" ]; then
    echo "error: failed to delete: Filename too long" >&2
    exit 255
  fi
  prev="\$a"
done
exec "$REAL_GIT" "\$@"
EOF
    chmod +x "$SHIM_DIR/git"
  fi
}

# Crea dentro la worktree un albero con path > MAX_PATH (simula node_modules).
# Windows-only: su POSIX il limite MAX_PATH non esiste.
make_long_paths() {
  local wt="$1" win_wt ps_cmd
  is_windows || return 1
  win_wt="$(cygpath -w "$wt")"
  ps_cmd="\$p = Join-Path '$win_wt' 'node_modules'; for (\$i=0; \$i -lt 8; \$i++) { \$p = Join-Path \$p ('seg' + ('x' * 40)) }; [System.IO.Directory]::CreateDirectory(\$p) | Out-Null; [System.IO.File]::WriteAllText((Join-Path \$p 'file.js'), 'x')"
  pwsh -NoProfile -Command "$ps_cmd" >/dev/null 2>&1
}

branch_exists_locally() { git rev-parse --verify --quiet "refs/heads/$1" >/dev/null 2>&1; }
branch_exists_remotely() { git ls-remote --exit-code origin "$1" >/dev/null 2>&1; }

# Identita' git per i repo temporanei, via env var invece di `git config`.
# `git config` e' un processo separato: 4 spawn per ogni repo temporaneo
# (~20 repo in questa suite). Con le env var l'identita' e le impostazioni
# sono risolte da git senza scrivere il file .git/config e senza spawn.
export GIT_AUTHOR_NAME="Test"
export GIT_AUTHOR_EMAIL="t@t.local"
export GIT_COMMITTER_NAME="Test"
export GIT_COMMITTER_EMAIL="t@t.local"
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0="commit.gpgsign"
export GIT_CONFIG_VALUE_0="false"
export GIT_CONFIG_KEY_1="core.autocrlf"
export GIT_CONFIG_VALUE_1="false"

# Repo con origin bare: main + feat/x. Con WORKTREE=1 crea anche ../wt su feat/x.
make_repo() {
  local d="$1" use_wt="${2:-0}"
  mkdir -p "$d"
  (
    cd "$d" || exit 1
    # `-b main`: il branch iniziale del bare repo e' esplicito. Senza, il
    # default e' `init.defaultBranch`, che sul runner GitHub e' `master`:
    # `git clone` del bare repo allora avvisa "remote HEAD refers to
    # nonexistent ref" e **non fa il checkout di nessun branch**, e il
    # successivo `git push origin main` fallisce con "src refspec main does
    # not match any". Il test era verde solo in locale, dove
    # `init.defaultBranch` e' `main` (Sessione 73, issue #224).
    git init -q --bare -b main origin.git
    git init -q -b main work
    cd work || exit 1
    # NB: identita', gpgsign e autocrlf arrivano dalle env var esportate in
    # testa allo script: niente `git config` (4 processi per repo).
    printf 'initial\n' > file.txt
    git add file.txt >/dev/null 2>&1
    git commit -q -m "chore: initial"
    git remote add origin "$d/origin.git"
    git push -q -u origin main
    git checkout -q -b feat/x
    printf 'feature work\n' > file.txt
    git commit -q -am "feat: work on x"
    git push -q -u origin feat/x
    if [ "$use_wt" = "1" ]; then
      git checkout -q main
      git worktree add "$d/wt" feat/x >/dev/null
    fi
  )
}

# Simula il merge della PR: main riceve un merge commit e lo pusha.
do_merge_commit() {
  git checkout -q main
  git merge -q --no-ff feat/x -m "Merge pull request #1 from t/feat/x"
  git push -q origin main
}

drop_worktree() { git worktree remove --force "$1/wt" >/dev/null 2>&1; }

echo "=== T1+T2: merge commit + worktree (procedura completa) ==="
{
  D="$(mktemp -d)"; make_repo "$D" 1; cd "$D/work" || exit 1
  do_merge_commit
  MERGE_SHA="$(git rev-parse origin/main)"

  out="$(run_ps -Branch feat/x)"; rc=$?
  if [ $rc -eq 0 ]; then ok "exit 0"; else ng "exit $rc"; echo "$out" | tail -20; fi

  # T1: main LOCALE deve contenere il merge commit (era il buco della procedura)
  LOCAL_SHA="$(git rev-parse main)"
  if [ "$LOCAL_SHA" = "$MERGE_SHA" ]; then ok "main locale allineato a origin/main"; else ng "main locale non allineato ($LOCAL_SHA != $MERGE_SHA)"; fi

  # T2: worktree rimossa PRIMA del delete locale
  if [ ! -d "$D/wt" ]; then ok "worktree rimossa dal filesystem"; else ng "worktree ancora presente"; fi
  if git worktree list | grep -q "$D/wt"; then ng "worktree ancora in worktree list"; else ok "worktree deregistrata"; fi
  if branch_exists_locally feat/x; then ng "branch locale ancora presente"; else ok "branch locale eliminato"; fi
  if branch_exists_remotely feat/x; then ng "branch remoto ancora presente"; else ok "branch remoto eliminato"; fi

  cd /; rm -rf "$D"
}

echo "=== T2b: HEAD sul branch da eliminare (caso peggiore, senza worktree) ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D/work" || exit 1
  do_merge_commit
  MERGE_SHA="$(git rev-parse origin/main)"

  out="$(run_ps -Branch feat/x)"; rc=$?
  if [ $rc -eq 0 ]; then ok "exit 0 con HEAD su feat/x"; else ng "exit $rc"; echo "$out" | tail -20; fi
  if [ "$(git rev-parse main)" = "$MERGE_SHA" ]; then ok "main allineato nonostante HEAD su feat/x"; else ng "main non allineato"; fi
  if [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ]; then ok "HEAD riportato su main"; else ng "HEAD non riportato su main"; fi
  if branch_exists_locally feat/x; then ng "branch locale ancora presente"; else ok "branch locale eliminato"; fi

  cd /; rm -rf "$D"
}

echo "=== T3: branch NON mergato (non deve perdere lavoro) ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D/work" || exit 1
  drop_worktree "$D"
  git checkout -q main   # feat/x esiste ma NON e' mergato

  out="$(run_ps -Branch feat/x)"; rc=$?
  if [ $rc -eq 12 ]; then ok "exit 12 (merge non verificato)"; else ng "exit $rc invece di 12"; echo "$out" | tail -10; fi
  if branch_exists_locally feat/x; then ok "branch preservato"; else ng "branch perso"; fi
  if branch_exists_remotely feat/x; then ok "remoto preservato"; else ng "remoto eliminato"; fi

  cd /; rm -rf "$D"
}

echo "=== T4: WIP non committato ==="
{
  D="$(mktemp -d)"; make_repo "$D" 1; cd "$D/work" || exit 1
  do_merge_commit
  printf 'wip non committato\n' >> file.txt   # dirty TRACKED

  out="$(run_ps -Branch feat/x)"; rc=$?
  if [ $rc -eq 10 ]; then ok "exit 10 su WIP tracked"; else ng "exit $rc invece di 10"; echo "$out" | tail -10; fi
  if branch_exists_remotely feat/x; then ok "nessuna azione distruttiva col WIP presente"; else ng "ramo cancellato col WIP presente"; fi
  if [ -d "$D/wt" ]; then ok "worktree non rimossa col WIP"; else ng "worktree rimossa col WIP"; fi

  out="$(run_ps -Branch feat/x -Stash)"; rc=$?
  if [ $rc -eq 0 ]; then ok "exit 0 con -Stash"; else ng "exit $rc con -Stash"; echo "$out" | tail -10; fi
  if [ -n "$(git stash list)" ]; then ok "stash creato"; else ng "nessuno stash creato"; fi

  cd /; rm -rf "$D"
}

echo "=== T5: merge squash (git branch -d rifiutato, fallback git cherry) ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D/work" || exit 1
  # Simula squash: su main viene ricreato lo stesso contenuto con un commit diverso.
  drop_worktree "$D"
  git checkout -q main
  git merge -q --squash feat/x >/dev/null 2>&1
  git commit -q -m "feat: work on x (#1)"
  git push -q origin main

  # Senza -AllowUnmerged e senza gh: la procedura deve fallire chiusa (fail-safe)
  out="$(run_ps -Branch feat/x)"; rc=$?
  if [ $rc -eq 12 ]; then ok "fail chiusa su squash non verificabile (exit 12)"; else ng "exit $rc invece di 12"; echo "$out" | tail -10; fi

  # Con -AllowUnmerged: elimina usando l'evidenza di `git cherry`
  out="$(run_ps -Branch feat/x -AllowUnmerged)"; rc=$?
  if [ $rc -eq 0 ]; then ok "exit 0 con -AllowUnmerged"; else ng "exit $rc con -AllowUnmerged"; echo "$out" | tail -20; fi
  if branch_exists_locally feat/x; then ng "branch locale ancora presente dopo squash"; else ok "branch locale eliminato dopo squash"; fi
  if branch_exists_remotely feat/x; then ng "branch remoto ancora presente dopo squash"; else ok "branch remoto eliminato dopo squash"; fi

  cd /; rm -rf "$D"
}

echo "=== T6: main locale divergente (nessuna azione distruttiva) ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D/work" || exit 1
  do_merge_commit
  drop_worktree "$D"
  git checkout -q main

  # Clone concorrente: porta avanti origin/main con un commit diverso.
  git clone -q "$D/origin.git" "$D/clone2"
  (
    cd "$D/clone2" || exit 1
    # Identita' del clone: env var locali (non quelle globali dello script).
    printf 'altro\n' > other.txt
    git add other.txt >/dev/null 2>&1
    GIT_AUTHOR_NAME="Test2" GIT_AUTHOR_EMAIL="t2@t.local" \
    GIT_COMMITTER_NAME="Test2" GIT_COMMITTER_EMAIL="t2@t.local" \
      git commit -q -m "chore: concurrent commit"
    git push -q origin main
  )

  # Commit locale su main: ora i due main divergono davvero.
  printf 'divergent\n' > other.txt
  git add other.txt >/dev/null 2>&1
  git commit -q -m "chore: divergent local commit"
  git fetch -q origin

  out="$(run_ps -Branch feat/x)"; rc=$?
  if [ $rc -eq 11 ]; then ok "exit 11 su main divergente"; else ng "exit $rc invece di 11"; echo "$out" | tail -10; fi
  if branch_exists_locally feat/x; then ok "branch non toccato"; else ng "branch eliminato su main divergente"; fi

  cd /; rm -rf "$D"
}

echo "=== T7: audit -Check ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D/work" || exit 1
  do_merge_commit
  drop_worktree "$D"
  git checkout -q main
  git merge -q --ff-only origin/main >/dev/null 2>&1

  out="$(run_ps -Check)"; rc=$?
  if [ $rc -eq 14 ]; then ok "exit 14 con residui (feat/x merged)"; else ng "exit $rc invece di 14"; echo "$out" | tail -10; fi

  run_ps -Branch feat/x >/dev/null 2>&1
  out="$(run_ps -Check)"; rc=$?
  if [ $rc -eq 0 ]; then ok "exit 0 a residuo zero"; else ng "exit $rc invece di 0 dopo cleanup"; echo "$out" | tail -10; fi

  cd /; rm -rf "$D"
}

echo "=== T8: idempotenza (seconda esecuzione sul branch gia' rimosso) ==="
{
  D="$(mktemp -d)"; make_repo "$D" 1; cd "$D/work" || exit 1
  do_merge_commit
  run_ps -Branch feat/x >/dev/null 2>&1
  out="$(run_ps -Branch feat/x)"; rc=$?
  if [ $rc -eq 0 ]; then ok "seconda esecuzione idempotente (exit 0)"; else ng "exit $rc su seconda esecuzione"; echo "$out" | tail -10; fi

  cd /; rm -rf "$D"
}

echo "=== T9: esecuzione da dentro la worktree (deve rifiutarsi) ==="
{
  D="$(mktemp -d)"; make_repo "$D" 1; cd "$D/work" || exit 1
  do_merge_commit
  cd "$D/wt" || exit 1

  out="$(run_ps -Branch feat/x)"; rc=$?
  if [ $rc -eq 15 ]; then ok "exit 15 da dentro la worktree"; else ng "exit $rc invece di 15"; echo "$out" | tail -10; fi
  if branch_exists_locally feat/x; then ok "branch intatto"; else ng "branch eliminato da dentro la worktree"; fi

  cd /; rm -rf "$D"
}

echo "=== T10: git worktree remove fallisce -> fallback long-path-safe ==="
{
  D="$(mktemp -d)"; make_repo "$D" 1; cd "$D/work" || exit 1
  do_merge_commit

  # Shim di `git`: fallisce SOLO su `worktree remove`, simulando l'errore
  # Windows "Filename too long" / "Result too large"; tutto il resto e'
  # delegato al git vero. E' il modo deterministico di esercitare il
  # fallback su ogni piattaforma (su Windows il caso reale e' il path
  # lungo, coperto da T12 e T13).
  install_git_shim

  OLD_PATH="$PATH"
  export PATH="$SHIM_DIR:$PATH"
  out="$(run_ps -Branch feat/x)"; rc=$?
  export PATH="$OLD_PATH"

  if [ $rc -eq 0 ]; then ok "exit 0 nonostante il fallimento di git worktree remove"; else ng "exit $rc invece di 0"; echo "$out" | tail -20; fi
  if [ ! -d "$D/wt" ]; then ok "worktree rimossa dal filesystem via fallback"; else ng "worktree ancora presente"; fi
  if git worktree list | grep -q "$D/wt"; then ng "worktree ancora registrata"; else ok "worktree deregistrata (prune)"; fi
  if branch_exists_locally feat/x; then ng "branch locale ancora presente"; else ok "branch locale eliminato"; fi
  if branch_exists_remotely feat/x; then ng "branch remoto ancora presente"; else ok "branch remoto eliminato"; fi

  cd /; rm -rf "$D" "$SHIM_DIR"
}

echo "=== T11: -WorktreePath sulla working copy principale (mai cancellare) ==="
{
  D="$(mktemp -d)"; make_repo "$D" 1; cd "$D/work" || exit 1
  do_merge_commit

  out="$(run_ps -Branch feat/x -WorktreePath "$D/work")"; rc=$?
  if [ $rc -eq 16 ]; then ok "exit 16 (rimozione rifiutata)"; else ng "exit $rc invece di 16"; echo "$out" | tail -20; fi
  if [ -f "$D/work/file.txt" ]; then ok "working copy principale intatta"; else ng "working copy principale cancellata"; fi
  if [ -d "$D/wt" ]; then ok "worktree reale non toccata"; else ng "worktree reale rimossa"; fi
  if branch_exists_locally feat/x; then ok "branch intatto"; else ng "branch eliminato"; fi

  cd /; rm -rf "$D"
}

echo "=== T12: path lunghi (> MAX_PATH) dentro la worktree ==="
{
  if ! is_windows; then
    echo "  [SKIP] scenario Windows-only (path lunghi): su POSIX il limite MAX_PATH non esiste"
  else
    D="$(mktemp -d)"; make_repo "$D" 1; cd "$D/work" || exit 1
    do_merge_commit

    if make_long_paths "$D/wt"; then
      out="$(run_ps -Branch feat/x)"; rc=$?
      if [ $rc -eq 0 ]; then ok "exit 0 con path lunghi nella worktree"; else ng "exit $rc invece di 0"; echo "$out" | tail -20; fi
      if [ ! -d "$D/wt" ]; then ok "worktree rimossa (path lunghi)"; else ng "worktree ancora presente"; fi
      if branch_exists_locally feat/x; then ng "branch locale ancora presente"; else ok "branch locale eliminato"; fi
    else
      echo "  [SKIP] creazione dell'albero con path lunghi non riuscita"
    fi

    cd /; rm -rf "$D"
  fi
}

echo "=== T13: catena completa su Windows PowerShell 5.1 (L1+L2 falliscono -> L3 rd) ==="
{
  if ! is_windows; then
    echo "  [SKIP] scenario Windows-only (Windows PowerShell 5.1 + path lunghi)"
  elif ! command -v powershell >/dev/null 2>&1; then
    echo "  [SKIP] Windows PowerShell 5.1 non disponibile"
  else
    D="$(mktemp -d)"; make_repo "$D" 1; cd "$D/work" || exit 1
    do_merge_commit

    if make_long_paths "$D/wt"; then
      install_git_shim
      OLD_PATH="$PATH"
      export PATH="$SHIM_DIR:$PATH"
      # Windows PowerShell 5.1 non e' long-path-aware: `Remove-Item` fallisce
      # sui path > MAX_PATH -> deve intervenire il fallback `rd /s /q "\\?\"`.
      out="$(run_ps51 -Branch feat/x)"; rc=$?
      export PATH="$OLD_PATH"

      if [ $rc -eq 0 ]; then ok "exit 0 con la catena L1+L2+L3"; else ng "exit $rc invece di 0"; echo "$out" | tail -25; fi
      if [ ! -d "$D/wt" ]; then ok "worktree rimossa (catena completa)"; else ng "worktree ancora presente"; fi
      if branch_exists_locally feat/x; then ng "branch locale ancora presente"; else ok "branch locale eliminato"; fi
    else
      echo "  [SKIP] creazione dell'albero con path lunghi non riuscita"
    fi

    cd /; rm -rf "$D" "$SHIM_DIR"
  fi
}

echo "=== T14: rete di sicurezza L3 (rd /s /q \"\\\\?\\\") forzata ==="
{
  if ! is_windows; then
    echo "  [SKIP] scenario Windows-only (cmd rd con prefisso \\?\ )"
  else
    D="$(mktemp -d)"; make_repo "$D" 1; cd "$D/work" || exit 1
    do_merge_commit

    # L1 fallisce (shim) e L2 viene saltata: deve intervenire L3.
    install_git_shim
    OLD_PATH="$PATH"
    export PATH="$SHIM_DIR:$PATH"
    out="$(LIFE_SOUNDTRACK_WT_REMOVAL=rd run_ps -Branch feat/x)"; rc=$?
    export PATH="$OLD_PATH"

    if [ $rc -eq 0 ]; then ok "exit 0 con la rimozione via rd"; else ng "exit $rc invece di 0"; echo "$out" | tail -25; fi
    if [ ! -d "$D/wt" ]; then ok "worktree rimossa via rd"; else ng "worktree ancora presente"; fi
    if branch_exists_locally feat/x; then ng "branch locale ancora presente"; else ok "branch locale eliminato"; fi

    cd /; rm -rf "$D" "$SHIM_DIR"
  fi
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]
