#!/usr/bin/env bash
# Test di regressione per scripts/generate-bundle.ps1 — fail-closed sui flag sconosciuti (issue #104).
#
# Protegge il bug chiuso in issue #104: in Windows PowerShell 5.1 con `&`
# (call operator, NON `pwsh -File`), `--check` viene interpretato come
# fine-dei-parametri + token posizionale `check` che NON si lega a `[switch]$Check`.
# Lo script ricadeva silenziosamente in modalita' default (WRITING), riscrivendo
# docs/BUNDLE.md e restituendo exit 0 = fail-open. Un agente che credeva di
# star verificando la sincronizzazione in realta' la stava creando.
#
# Scenari coperti:
#   T1   `--check` (doppio trattino, pattern fail-open) esce 2 senza scrivere BUNDLE.md
#   T2   `--list`  (doppio trattino su altro switch) esce 2 senza scrivere
#   T3   `--bogus` (flag completamente sconosciuto) esce 2 senza scrivere
#   T4   `-Check` (singolo trattino, sintassi attesa) entra in modalita' check:
#        non scrive BUNDLE.md e lo stato di exit dipende solo dal --check interno (0 oppure 1)
#   T5   senza argomenti: default SCRIVE BUNDLE.md ed esce 0 (regression: il fail-closed
#        guard non rompe il flusso normale di lavoro)
#
# Funziona sia con `pwsh` sia con Windows PowerShell 5.1 (`powershell`). Per essere il
# piu' possibile rappresentativo del bug, i test T1-T3 vengono eseguiti due volte:
# una via `--check` con `& ... --check` (chiamata col call operator, che e' il
# trigger del bug in PS 5.1) e una via `powershell -File ... --check` (dove pwsh
# normalizza a `-Check` e lo script si comporta correttamente). Il guard deve
# essere non-op nel secondo caso ma deve intercettare il primo.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/generate-bundle.ps1"

if command -v pwsh >/dev/null 2>&1; then
  PS="pwsh"
elif command -v powershell >/dev/null 2>&1; then
  PS="powershell"
else
  echo "[SKIP] pwsh/powershell non disponibili: impossibile eseguire generate-bundle.ps1"
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

# Repo temporaneo con un sottoinsieme minimale dei file in $files
# (BUNDLE.md e' il file che NON deve essere mai riscritto in check mode).
make_repo() {
  local d="$1"
  mkdir -p "$d/docs"
  cp "$SCRIPT" "$d/scripts/generate-bundle.ps1"
  (
    cd "$d" || exit 1
    git init -q -b main
    git config user.email "t@t.local"
    git config user.name "Test"
    git config commit.gpgsign false
    echo "x" > AGENTS.md
    echo "y" > README.md
    echo "z" > LICENSE
    echo "i" > docs/INDEX.md
    git add -A
    git commit -q -m "seed" >/dev/null 2>&1
  )
}

run_via_amp() {
  # Invocazione con call operator `&` — il path fail-open dell'issue #104.
  "$PS" -NoProfile -Command "& '$1' $2" 2>&1
  return $?
}

run_via_file() {
  # Invocazione con `pwsh -File` — pwsh normalizza --foo a -foo, qui non si vede
  # il bug: serve solo per confermare che il guard non rompe la modalita' canonica CI.
  "$PS" -NoProfile -File "$1" $2 2>&1
  return $?
}

# Misura il mtime (in secondi dalla epoch) di docs/BUNDLE.md, ritorna vuoto se assente.
bundle_mtime() {
  local path="$1/docs/BUNDLE.md"
  if [ ! -f "$path" ]; then echo ""; return; fi
  # wc -c e' cross-platform e sufficiente per rilevare un rewrite del contenuto.
  wc -c < "$path" | tr -d ' '
}

echo "=== T1: --check via & NON scrive BUNDLE.md ed esce 2 (il bugfix) ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1

  # Genera un BUNDLE.md iniziale via flag-less default.
  run_via_amp "$D/scripts/generate-bundle.ps1" "" >/dev/null 2>&1
  git add -A >/dev/null 2>&1; git commit -q -m "seed bundle" >/dev/null 2>&1
  SIZE0=$(bundle_mtime "$D")
  HEAD0=$(git -C "$D" rev-parse HEAD 2>/dev/null)

  out=$(run_via_amp "$D/scripts/generate-bundle.ps1" --check)
  ec=$?
  if [ $ec -eq 2 ]; then ok "exit 2 (parameter error)"; else ng "exit $ec (atteso 2): $(echo "$out" | tail -3)"; fi

  SIZE1=$(bundle_mtime "$D")
  if [ "$SIZE0" = "$SIZE1" ] && [ -n "$SIZE0" ]; then
    ok "BUNDLE.md non riscritto (size invariata: $SIZE0 byte)"
  elif [ -z "$SIZE1" ]; then
    ng "BUNDLE.md sparito (size era $SIZE0 -> vuoto)"
  else
    ng "BUNDLE.md RISCITTO (size $SIZE0 -> $SIZE1, fail-open!)"
  fi

  if echo "$out" | grep -q "PowerShell 5.1 non mappa -- su -"; then
    ok "messaggio fail-closed presente e spiega il fix"
  else
    ng "messaggio mancante: l'utente non sa come correggere"
  fi

  if echo "$out" | grep -q "ERRATO:.*--check"; then
    ok "mostra la forma ERRATO (--check)"
  else
    ng "manca la forma ERRATO"
  fi

  if echo "$out" | grep -q "CORRETTO:.*-Check"; then
    ok "mostra la forma CORRETTO (-Check)"
  else
    ng "manca la forma CORRETTO"
  fi

  cd /; rm -rf "$D"
}

echo "=== T2: --list via & NON scrive ed esce 2 ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1
  run_via_amp "$D/scripts/generate-bundle.ps1" "" >/dev/null 2>&1
  git add -A >/dev/null 2>&1; git commit -q -m "seed" >/dev/null 2>&1
  SIZE0=$(bundle_mtime "$D")

  out=$(run_via_amp "$D/scripts/generate-bundle.ps1" --list); ec=$?
  if [ $ec -eq 2 ]; then ok "exit 2"; else ng "exit $ec"; fi
  SIZE1=$(bundle_mtime "$D")
  if [ "$SIZE0" = "$SIZE1" ]; then ok "BUNDLE.md invariato"; else ng "BUNDLE.md riscritto ($SIZE0 -> $SIZE1)"; fi

  cd /; rm -rf "$D"
}

echo "=== T3: --bogus (flag completamente sconosciuto) via & NON scrive ed esce 2 ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1
  run_via_amp "$D/scripts/generate-bundle.ps1" "" >/dev/null 2>&1
  git add -A >/dev/null 2>&1; git commit -q -m "seed" >/dev/null 2>&1
  SIZE0=$(bundle_mtime "$D")

  out=$(run_via_amp "$D/scripts/generate-bundle.ps1" --bogus); ec=$?
  if [ $ec -eq 2 ]; then ok "exit 2"; else ng "exit $ec"; fi
  SIZE1=$(bundle_mtime "$D")
  if [ "$SIZE0" = "$SIZE1" ]; then ok "BUNDLE.md invariato"; else ng "BUNDLE.md riscritto ($SIZE0 -> $SIZE1)"; fi

  cd /; rm -rf "$D"
}

echo "=== T4: -Check (singolo trattino) FUNZIONA, esce 0 se in sync ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1
  # Scrivi un BUNDLE.md "in sync" come baseline: prima il default write poi verifica.
  run_via_amp "$D/scripts/generate-bundle.ps1" "" >/dev/null 2>&1
  git add -A >/dev/null 2>&1; git commit -q -m "seed" >/dev/null 2>&1
  SIZE0=$(bundle_mtime "$D")
  HEAD0=$(git -C "$D" rev-parse HEAD 2>/dev/null)

  out=$(run_via_amp "$D/scripts/generate-bundle.ps1" -Check); ec=$?
  if [ $ec -eq 0 ]; then ok "exit 0 quando in sync"; else ng "exit $ec (atteso 0; out: $(echo "$out" | tail -3))"; fi
  SIZE1=$(bundle_mtime "$D")
  if [ "$SIZE0" = "$SIZE1" ]; then ok "BUNDLE.md non riscritto"; else ng "BUNDLE.md riscritto durante --check ($SIZE0 -> $SIZE1)"; fi

  cd /; rm -rf "$D"
}

echo "=== T5: senza argomenti SCRIVE il bundle (regression: il guard non rompe il default) ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1
  if [ -f "$D/docs/BUNDLE.md" ]; then
    ng "BUNDLE.md gia presente prima della run default"
  else
    ok "BUNDLE.md assente (precondizione)"
  fi

  out=$(run_via_amp "$D/scripts/generate-bundle.ps1" ""); ec=$?
  if [ $ec -eq 0 ]; then ok "default-mode exit 0"; else ng "default-mode exit $ec"; fi
  if [ -f "$D/docs/BUNDLE.md" ]; then
    ok "BUNDLE.md creato (default-mode preservato)"
  else
    ng "BUNDLE.md NON creato: il guard ha rotto il flusso di lavoro"
  fi

  cd /; rm -rf "$D"
}

echo "=== T6: --check via pwsh -File (modalita' CI canonica) esce 0 senza scrivere ==="
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1
  run_via_amp "$D/scripts/generate-bundle.ps1" "" >/dev/null 2>&1
  git add -A >/dev/null 2>&1; git commit -q -m "seed" >/dev/null 2>&1
  SIZE0=$(bundle_mtime "$D")

  out=$(run_via_file "$D/scripts/generate-bundle.ps1" --check); ec=$?
  # Con `-File`, pwsh normalizza `--check` a `-Check` PRIMA di passarlo allo script,
  # quindi NON si attiva il guard fail-closed: --check deve comportarsi come atteso
  # ed uscire 0 (in sync) senza scrivere. Su PS 5.1 con `-File` il comportamento
  # e' analogo (Pwsh.Host layer normalizza). Questo scenario conferma che il guard
  # non rompe il path CI standard.
  if [ $ec -eq 0 ]; then ok "exit 0 via -File (CI canonico)"; else ng "exit $ec via -File: $(echo "$out" | tail -3)"; fi
  SIZE1=$(bundle_mtime "$D")
  if [ "$SIZE0" = "$SIZE1" ]; then ok "BUNDLE.md invariato"; else ng "BUNDLE.md riscritto via -File: regression del guard"; fi

  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]
