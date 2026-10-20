#!/usr/bin/env bash
# Test di regressione per scripts/aggregate-state.ps1 — determinismo e idempotenza.
#
# Protegge i bug chiusi in issue #70, scoperti durante il post-merge della PR #69:
#
# T1  ordinamento story per VALORE (0.3 < 0.5 < 0.6), non per ordine di filesystem
#   T2  l'ordinamento non dipende dall'ordine di creazione dei file
#      La combinazione di T1+T2 e' il regression test per issue #79: la forma
#      abbreviata `$Id` in `Sort-Object { [version]$Id }` non viene espansa come
#      `$_.Id` quando il primo token e' un cast `[version]`; tutti gli item hanno
#      sort key `$null` e l'ordine degenera a quello di `Get-ChildItem`. Con il fix
#      `$_.Id` il sort produce ordine numerico indipendente dal filesystem.
#   T3  idempotenza byte-identica: due run consecutivi non producono alcun diff
#       (il timestamp "Ultima aggregazione" viene riusato)
#   T4  round-trip: dopo la scrittura, --check deve uscire 0
#   T5  il fallback del campo `state` mancante e' ASCII (niente sequenze mojibake)
#   T6  l'ordinamento sessioni e' per numero, con tie-break stabile
#
# I test girano su repo temporanei con i propri file state/, quindi non toccano
# il repo reale. Richiede: git, bash e pwsh (o Windows PowerShell come fallback).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/aggregate-state.ps1"

if command -v pwsh >/dev/null 2>&1; then
  PS="pwsh"
elif command -v powershell >/dev/null 2>&1; then
  PS="powershell"
else
  echo "[SKIP] pwsh/powershell non disponibili: impossibile eseguire aggregate-state.ps1"
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

run_agg() {
  "$PS" -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT" "$@" 2>&1
  return $?
}

# Repo temporaneo con docs/state/ minimale + file target con i marker vuoti.
# $1 = dir, $2 = "asc" | "desc" (ordine di creazione dei file story)
make_repo() {
  local d="$1" order="${2:-asc}"
  mkdir -p "$d/docs/state/sessions" "$d/docs/state/stories" "$d/scripts"
  cp "$SCRIPT" "$d/scripts/aggregate-state.ps1"
  (
    cd "$d" || exit 1
    git init -q -b main
    git config user.email "t@t.local"
    git config user.name "Test"
    git config commit.gpgsign false

    if [ "$order" = "asc" ]; then
      write_story 0.3 "adapter-spotify" "Adapter Spotify base" done "#28" "adapter"
      write_story 0.5 "pwa" "PWA e service worker" done "#19" "devops"
      write_story 0.6 "i18n" "Setup i18n" done "#22" "ui"
    else
      write_story 0.6 "i18n" "Setup i18n" done "#22" "ui"
      write_story 0.5 "pwa" "PWA e service worker" done "#19" "devops"
      write_story 0.3 "adapter-spotify" "Adapter Spotify base" done "#28" "adapter"
    fi

    write_session 30 "trenta" "Sessione trenta" "?"
    write_session 32 "trentadue" "Sessione trentadue" "?"
    write_session 33 "trentatre" "Sessione trentatre" "?"

    # Fail-fast: se i sorgenti non esistono, i test darebbero falsi positivi.
    local n
    n=$(ls docs/state/stories/*.md 2>/dev/null | wc -l)
    [ "$n" -eq 3 ] || { echo "SETUP ERRATO: trovati $n file story invece di 3" >&2; exit 1; }
    n=$(ls docs/state/sessions/*.md 2>/dev/null | wc -l)
    [ "$n" -eq 3 ] || { echo "SETUP ERRATO: trovati $n file session invece di 3" >&2; exit 1; }
  )
}

write_story() {
  cat > "docs/state/stories/$1-$2.md" <<EOF
---
id: "$1"
title: "$3"
status: $4
pr: $5
area: $6
merged_commit: "abc1234"
---
EOF
}

write_session() {
  cat > "docs/state/sessions/$1-$2.md" <<EOF
---
number: $1
title: "$3"
date: 2026-10-20
state: $4
pr: 0
---
Body della sessione $1.
EOF
}

# File target con i 5 marker vuoti.
make_targets() {
  mkdir -p "$1/docs"
  {
    printf '# SESSIONS\n\n<!-- AGGREGATE-SESSIONS-START -->\n<!-- AGGREGATE-SESSIONS-END -->\n'
    printf '# BACKLOG\n\n<!-- AGGREGATE-STORIES-START -->\n<!-- AGGREGATE-STORIES-END -->\n'
    printf '# INDEX\n\n<!-- AGGREGATE-INDEX-STATUS-START -->\n<!-- AGGREGATE-INDEX-STATUS-END -->\n'
    printf '<!-- AGGREGATE-INDEX-ROADMAP-START -->\n<!-- AGGREGATE-INDEX-ROADMAP-END -->\n'
    printf '# BUNDLE\n\n<!-- AGGREGATE-BUNDLE-INVENTORY-START -->\n<!-- AGGREGATE-BUNDLE-INVENTORY-END -->\n'
  } > "$1/docs/targets.md"
  cp "$1/docs/targets.md" "$1/docs/SESSIONS.md"
  cp "$1/docs/targets.md" "$1/docs/11-BACKLOG.md"
  cp "$1/docs/targets.md" "$1/docs/INDEX.md"
  cp "$1/docs/targets.md" "$1/docs/BUNDLE.md"
  rm -f "$1/docs/targets.md"
}

story_ids_in_backlog() {
  sed -n '/AGGREGATE-STORIES-START/,/AGGREGATE-STORIES-END/p' "$1/docs/11-BACKLOG.md" \
    | grep -o '| [0-9][0-9.]* - ' | sed 's/| //; s/ - //' | tr '\n' ' '
}

session_numbers_in_roadmap() {
  sed -n '/AGGREGATE-INDEX-ROADMAP-START/,/AGGREGATE-INDEX-ROADMAP-END/p' "$1/docs/INDEX.md" \
    | grep -o '^| [0-9][0-9]* |' | tr -d '| ' | tr '\n' ' '
}

echo "=== T1+T2: ordinamento story per VALORE, indipendente dalla creazione ==="
{
  D="$(mktemp -d)"; make_repo "$D" asc; make_targets "$D"; cd "$D" || exit 1

  run_agg >/dev/null 2>&1
  ORDER="$(story_ids_in_backlog "$D")"
  EXPECTED="0.3 0.5 0.6 "
  if [ "$ORDER" = "$EXPECTED" ]; then ok "ordine stories ascendente (creazione asc): $ORDER"; else ng "ordine inatteso (asc): '$ORDER' invece di '$EXPECTED'"; fi

  cd /; rm -rf "$D"

  D="$(mktemp -d)"; make_repo "$D" desc; make_targets "$D"; cd "$D" || exit 1
  run_agg >/dev/null 2>&1
  ORDER="$(story_ids_in_backlog "$D")"
  if [ "$ORDER" = "$EXPECTED" ]; then ok "ordine stories identico con creazione inversa: $ORDER"; else ng "ordine dipende dalla creazione: '$ORDER' invece di '$EXPECTED'"; fi

  cd /; rm -rf "$D"
}

echo "=== T3: idempotenza byte-identica (nessun commit-rumore) ==="
{
  D="$(mktemp -d)"; make_repo "$D" asc; make_targets "$D"; cd "$D" || exit 1

  run_agg >/dev/null 2>&1
  git add -A >/dev/null 2>&1; git commit -q -m "baseline" >/dev/null 2>&1
  FIRST_TS="$(grep '^- Ultima aggregazione:' docs/BUNDLE.md)"

  sleep 1
  run_agg >/dev/null 2>&1
  if git diff --quiet; then ok "secondo run: nessun diff (git diff vuoto)"; else ng "secondo run ha prodotto un diff (commit-rumore)"; git diff --stat; fi

  SECOND_TS="$(grep '^- Ultima aggregazione:' docs/BUNDLE.md)"
  if [ "$FIRST_TS" = "$SECOND_TS" ]; then ok "timestamp riusato ($FIRST_TS)"; else ng "timestamp cambiato: '$FIRST_TS' -> '$SECOND_TS'"; fi

  cd /; rm -rf "$D"
}

echo "=== T4: round-trip --check dopo la scrittura ==="
{
  D="$(mktemp -d)"; make_repo "$D" asc; make_targets "$D"; cd "$D" || exit 1
  run_agg >/dev/null 2>&1

  out="$(run_agg --check)"; rc=$?
  if [ $rc -eq 0 ]; then ok "--check exit 0 dopo la scrittura"; else ng "--check exit $rc dopo la scrittura"; echo "$out" | tail -8; fi

  if echo "$out" | grep -q '\[WARN\]'; then
    ng "--check segnala drift lenient dopo la propria scrittura"
    echo "$out" | grep '\[WARN\]'
  else
    ok "nessun drift lenient auto-generato"
  fi

  cd /; rm -rf "$D"
}

echo "=== T5: fallback ASCII del campo state mancante ==="
{
  D="$(mktemp -d)"; make_repo "$D" asc; make_targets "$D"
  cat > "$D/docs/state/sessions/34-senza-state.md" <<'EOF'
---
number: 34
title: "Sessione senza campo state"
date: 2026-10-20
pr: 0
---
Body senza campo state.
EOF
  cd "$D" || exit 1
  run_agg >/dev/null 2>&1

  if grep -q 'Ã¢Â¬Å¡' docs/SESSIONS.md; then
    ng "SESSIONS.md contiene il fallback mojibake"
  else
    ok "nessun fallback mojibake in SESSIONS.md"
  fi

  FALLBACK_LINE="$(sed -n '/Sessione 34/,+6p' docs/SESSIONS.md | grep 'Stato' | head -1)"
  if echo "$FALLBACK_LINE" | grep -q '?'; then ok "fallback ASCII presente: $FALLBACK_LINE"; else ng "fallback inatteso: '$FALLBACK_LINE'"; fi

  cd /; rm -rf "$D"
}

echo "=== T6: ordinamento sessioni per numero ==="
{
  D="$(mktemp -d)"; make_repo "$D" desc; make_targets "$D"; cd "$D" || exit 1
  run_agg >/dev/null 2>&1

  NUMS="$(session_numbers_in_roadmap "$D")"
  EXPECTED_N="30 32 33 "
  if [ "$NUMS" = "$EXPECTED_N" ]; then ok "sessioni ordinate per numero: $NUMS"; else ng "ordine sessioni inatteso: '$NUMS' invece di '$EXPECTED_N'"; fi

  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]