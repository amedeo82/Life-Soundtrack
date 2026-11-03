#!/usr/bin/env bash
# Test funzionale del WRITER post-merge (issue #284, issue #287).
#
# Questa suite non ispeziona il testo del workflow: **esegue** i passi del
# writer `post-merge.yml` in un clone locale con un remoto finto, e verifica
# il risultato. Copre:
#
#   T1  PR con una sessione: lo stato di merge e' applicato, i blocchi sono
#       rigenerati, il bundle e' in sync, **un solo commit** viene prodotto e
#       spinto sul remoto.
#   T2  il messaggio di commit prodotto dal writer non contiene escape
#       PowerShell rotti (backslash residui) e nessuna riga supera i 100
#       caratteri (regola `body-max-line-length` di commitlint).
#   T3  PR **senza** sessione: il writer non fallisce e **non** committa
#       niente (una PR che non ha sessione non deve sporcare `main`).
#   T4  il writer e' idempotente: rieseguendolo non produce un secondo commit.
#
# Il comando `git commit` e' estratto dal workflow reale (non ricopiato qui):
# cosi' il test verifica il messaggio che il writer scrive davvero, e la
# regressione dell'issue #287 (backslash al posto dei backtick) viene
# intercettata per costruzione.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKFLOW="$REPO_ROOT/.github/workflows/post-merge.yml"

for bin in git node pwsh; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[SKIP] '$bin' non disponibile: il test funzionale del writer richiede git, node e pwsh 7+"
    exit 0
  fi
done

pass=0
fail=0
ok() { echo "  [PASS] $1"; pass=$((pass + 1)); }
ng() { echo "  [FAIL] $1"; fail=$((fail + 1)); }

WORK="$(mktemp -d)"
REMOTE="$WORK/remote.git"
CLONE="$WORK/clone"
cleanup() { rm -rf "$WORK" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# --- estraggo i comandi reali dal workflow -----------------------------------
# `git add ...`
GIT_ADD_LINE="$(grep -E '^[[:space:]]*git add ' "$WORKFLOW" | head -1 | sed 's/^[[:space:]]*//')"
# `git commit -m ...` (blocco multi-riga con continuazione backtick)
awk '/git commit -m/ {f=1} f {print} f && /Out-Null/ {f=0}' "$WORKFLOW" \
  | sed 's/^[[:space:]]*//' > "$WORK/commit.ps1"
if [ -z "$GIT_ADD_LINE" ] || ! grep -q 'git commit -m' "$WORK/commit.ps1"; then
  echo "[FAIL] non sono riuscito a estrarre i comandi di commit dal workflow: il test non puo' verificare il writer"
  exit 1
fi

# --- preparo il clone con un remoto finto ------------------------------------
# NB: NON si clona il repository sorgente. In CI il checkout e' **shallow**
# (fetch-depth 1) e su un HEAD staccato (refs/pull/N/merge): il clone
# risulterebbe shallow e senza HEAD, e il push verso il remoto finito verrebbe
# rifiutato ("shallow update not allowed"). Si ricostruisce quindi il fixture
# dal contenuto tracciato (`git archive`): repository completo, un solo
# commit, file identici a quelli che la CI vede.
git init --bare -q "$REMOTE"
mkdir -p "$CLONE"
git init -q "$CLONE"
git -C "$REPO_ROOT" archive --format=tar HEAD | tar -x -C "$CLONE"
cd "$CLONE" || exit 1
git config user.email "writer@test.local"
git config user.name "Writer Test"
git config commit.gpgsign false
git checkout -q -B main
git add -A >/dev/null 2>&1
git commit -q -m "test: fixture iniziale (contenuto del repository)"
git remote add origin "$REMOTE"
git push -q origin main
BASE_SHA="$(git rev-parse HEAD)"

# --- T1: una PR con una sessione ---------------------------------------------
mkdir -p docs/state/sessions
cat > docs/state/sessions/99-writer-test.md <<'EOF'
---
number: 99
title: "Sessione di prova del writer post-merge"
date: 2026-11-03
state: 🟡
merged: false
branch: feat/99-writer-test
pr: 1
tags: [test]
---

# Sessione 99 — prova

## Analisi di avanzamento

Numeri: test. Cosa e' pronto: test. Cosa manca: test. Salute tecnica: test.
EOF
git add -A >/dev/null 2>&1
git commit -q -m "test: simulazione di merge (PR #1)"
MERGE_SHA="$(git rev-parse HEAD)"

apply_out="$(node scripts/apply-merge-state.mjs --pr 1 --sha "$MERGE_SHA" --date 2026-11-03T07:40:49Z 2>&1)"
apply_rc=$?
if [ "$apply_rc" -eq 0 ]; then ok "T1 apply-merge-state applica lo stato (exit 0)"; else ng "T1 apply-merge-state exit $apply_rc: $apply_out"; fi
if echo "$apply_out" | grep -q 'stato di merge applicato'; then ok "T1 il frontmatter e' stato aggiornato"; else ng "T1 il frontmatter non e' stato aggiornato: $apply_out"; fi

pwsh -NoProfile -File scripts/aggregate-state.ps1 >/dev/null 2>&1
agg_rc=$?
pwsh -NoProfile -File scripts/generate-bundle.ps1 >/dev/null 2>&1
bun_rc=$?
pwsh -NoProfile -File scripts/aggregate-state.ps1 -Check >/dev/null 2>&1
aggchk_rc=$?
pwsh -NoProfile -File scripts/generate-bundle.ps1 -Check >/dev/null 2>&1
bunchk_rc=$?
if [ "$agg_rc" -eq 0 ] && [ "$bun_rc" -eq 0 ]; then ok "T1 i due generatori girano senza errori"; else ng "T1 generatori: aggregate=$agg_rc bundle=$bun_rc"; fi
if [ "$aggchk_rc" -eq 0 ] && [ "$bunchk_rc" -eq 0 ]; then ok "T1 dopo la rigenerazione i check sono verdi"; else ng "T1 check dopo rigenerazione: aggregate=$aggchk_rc bundle=$bunchk_rc"; fi

# Il commit usa i comandi REALI del workflow.
export PR_NUMBER=1
eval "$GIT_ADD_LINE" >/dev/null 2>&1
pwsh -NoProfile -File "$WORK/commit.ps1" >/dev/null 2>&1
commit_rc=$?
if [ "$commit_rc" -eq 0 ]; then ok "T1 il commit del writer va a buon fine"; else ng "T1 il commit del writer e' fallito (exit $commit_rc)"; fi

COMMIT_SHA="$(git rev-parse HEAD)"
if [ "$(git rev-list --count "$MERGE_SHA".."$COMMIT_SHA")" = "1" ]; then
  ok "T1 il writer produce UN solo commit"
else
  ng "T1 il writer ha prodotto $(git rev-list --count "$MERGE_SHA".."$COMMIT_SHA") commit (atteso 1)"
fi

if git push -q origin HEAD:main 2>/dev/null; then
  ok "T1 il push del writer va a buon fine"
else
  ng "T1 il push del writer e' fallito"
fi
if [ "$(git -C "$REMOTE" rev-parse main)" = "$COMMIT_SHA" ]; then
  ok "T1 il remoto e' allineato al commit del writer"
else
  ng "T1 il remoto non coincide con il commit del writer"
fi

# Lo stato applicato e' finito sul remoto?
REMOTE_SESSION="$(git -C "$REMOTE" show main:docs/state/sessions/99-writer-test.md 2>/dev/null)"
if echo "$REMOTE_SESSION" | grep -q 'merged: true'; then ok "T1 lo stato di merge e' finito sul remoto"; else ng "T1 lo stato di merge non e' sul remoto"; fi
if echo "$REMOTE_SESSION" | grep -q "$MERGE_SHA"; then ok "T1 il merge commit e' finito sul remoto"; else ng "T1 il merge commit non e' sul remoto"; fi

# --- T2: il messaggio di commit e' pulito ------------------------------------
MSG="$(git log -1 --pretty=%B "$COMMIT_SHA")"
if echo "$MSG" | grep -q '\\'; then
  ng "T2 il messaggio contiene backslash residui (escape PowerShell rotto): $(echo "$MSG" | tr '\n' '|')"
else
  ok "T2 il messaggio non contiene backslash residui"
fi
if echo "$MSG" | grep -q '`'; then
  ng "T2 il messaggio contiene backtick: il writer doveva produrre testo semplice"
else
  ok "T2 il messaggio non contiene backtick"
fi
long_line="$(echo "$MSG" | awk 'length($0) > 100 {print length($0); exit}')"
if [ -z "$long_line" ]; then
  ok "T2 nessuna riga del messaggio supera i 100 caratteri"
else
  ng "T2 una riga del messaggio supera i 100 caratteri ($long_line)"
fi
if echo "$MSG" | grep -q 'chore(state): stato di merge e blocchi aggregati (PR #1)'; then
  ok "T2 il messaggio cita la PR"
else
  ng "T2 il messaggio non cita la PR: $MSG"
fi

# --- T3: una PR SENZA sessione non deve produrre nulla ------------------------
BEFORE="$(git -C "$REMOTE" rev-parse main)"
out="$(node scripts/apply-merge-state.mjs --pr 4242 --sha deadbeef --date 2026-11-03T00:00:00Z 2>&1)"
rc=$?
if [ "$rc" -eq 0 ]; then ok "T3 apply-merge-state su una PR senza sessione esce 0 (nessun fallimento)"; else ng "T3 apply-merge-state senza sessione esce $rc (atteso 0): $out"; fi
if echo "$out" | grep -q 'nessun file di sessione'; then ok "T3 il caso e' dichiarato esplicitamente"; else ng "T3 l'output non dichiara il caso: $out"; fi
eval "$GIT_ADD_LINE" >/dev/null 2>&1
if git diff --cached --quiet; then
  ok "T3 nessuna modifica da committare (il writerWould esce senza committare)"
else
  ng "T3 ci sono modifiche da committare per una PR senza sessione"
fi
if [ "$(git -C "$REMOTE" rev-parse main)" = "$BEFORE" ]; then
  ok "T3 il remoto non e' cambiato"
else
  ng "T3 il remoto e' cambiato per una PR senza sessione"
fi

# --- T4: idempotenza ----------------------------------------------------------
cp scripts/aggregate-state.ps1 /dev/null 2>/dev/null || true
pwsh -NoProfile -File scripts/aggregate-state.ps1 >/dev/null 2>&1
pwsh -NoProfile -File scripts/generate-bundle.ps1 >/dev/null 2>&1
eval "$GIT_ADD_LINE" >/dev/null 2>&1
if git diff --cached --quiet; then
  ok "T4 rieseguendo il writer non c'e' nessuna modifica (idempotente)"
else
  ng "T4 rieseguendo il writer il writer ha prodotto modifiche (non idempotente)"
fi

echo ""
echo "=== Risultato: $pass pass, $fail fail ==="
if [ "$fail" -gt 0 ]; then
  echo "[FAIL] il writer post-merge non si comporta come dichiarato"
  exit 1
fi
echo "[OK] il writer post-merge si comporta come dichiarato"
exit 0
