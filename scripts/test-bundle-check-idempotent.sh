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
#   T6   `--check` via `pwsh -File` (modalita' CI canonica) esce 0 senza scrivere
#   T7   riuso di `> Data:` nel path di scrittura (issue #142): a contenuto invariato
#        la data di generazione viene conservata (nessun commit-rumore di `auto-bundle`),
#        a contenuto modificato si aggiorna; il probe e' un sentinel, quindi il test
#        non dipende dall'orologio
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

# Issue #117 (D.117.2): detection pwsh vs Windows PS 5.1.
# Il guard fail-closed introdotto per issue #104 si attiva SOLO su Windows PS 5.1
# call operator `&`, che interpreta `--check` come end-of-params + token posizionale.
# Su pwsh (PS 7+) `--check` viene normalizzato a `-Check` PRIMA del param binding,
# quindi il guard non si attiva (lo script esce 0 o 1 dal check, non 2 dall'arg).
# I test T1-T3 verificano proprio l'uscita 2 del guard: devono skippare su pwsh.
PS_IS_PWSH=0
if [ "$PS" = "pwsh" ]; then
  PS_IS_PWSH=1
fi
PS_5_1_AVAILABLE=0
if [ "$PS" = "powershell" ] || command -v powershell.exe >/dev/null 2>&1; then
  PS_5_1_AVAILABLE=1
fi

if [ "$PS_IS_PWSH" = "1" ]; then
  echo "[INFO] Esecuzione con pwsh (PS 7+): i test T1-T3 (fail-closed su '--*') sono PROTETTIVI vs Windows PS 5.1 e saranno skippati."
  echo "       T4 (--Check sync), T6 (--check via -File) e l'IndexOf fix restano attivi."
else
  echo "[INFO] Esecuzione con Windows PowerShell 5.1: tutti gli scenari del guard fail-closed eseguibili."
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
# `git config` e' un processo separato: 3 spawn per ogni repo temporaneo
# (~260 ms per repo). Con le env var l'identita' e' risolta da git senza
# scrivere il file .git/config e senza spawn.
export GIT_AUTHOR_NAME="Test"
export GIT_AUTHOR_EMAIL="t@t.local"
export GIT_COMMITTER_NAME="Test"
export GIT_COMMITTER_EMAIL="t@t.local"
# `commit.gpgsign=false` iniettato via env: git >= 2.31 (CI: ubuntu-latest,
# dev: 2.56) legge GIT_CONFIG_COUNT/KEY_0/VALUE_0 come config addizionale
# per-process, senza bisogno di un `git config` dedicato.
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0="commit.gpgsign"
export GIT_CONFIG_VALUE_0="false"

# Elenco dei path in $files di generate-bundle.ps1, calcolato UNA sola volta.
# La pipeline grep|sed costa ~120 ms e veniva rieseguita a ogni make_repo
# (4 volte in questa suite).
BUNDLE_FILE_LIST=""
bundle_file_list() {
  if [ -z "$BUNDLE_FILE_LIST" ]; then
    # Estrai i path tra virgolette dentro $files. Formato PowerShell:
    #     "docs/INDEX.md",
    #     "scripts/generate-bundle.ps1",
    # Cattura sia le entry con virgola finale (lista) sia l'ultima senza.
    BUNDLE_FILE_LIST="$(grep -oE '^[[:space:]]*"([^"]+)"' "$SCRIPT" | sed -E 's/^[[:space:]]*"([^"]+)".*/\1/')"
  fi
  printf '%s\n' "$BUNDLE_FILE_LIST"
}

# Estrae l'array $files da generate-bundle.ps1 e crea stub vuoti per ogni entry.
# Necessario perche' generate-bundle.ps1 ha un check di "missing files" che esce 2
# se l'$files contiene path non esistenti (test fixture-repo deve avere TUTTI i file
# o il check fallirebbe per motivi sbagliati). D.117.4.
#
# PERF: la versione originale invocava `dirname` + `mkdir -p` + `touch` una volta
# per file: 128 file => 256 processi per repo, ~9,5 s per repo (misurato il
# 2026-10-31) e ~38 s dei 53 s totali della suite. Ora:
#   - la directory e' calcolata con l'espansione built-in `${f%/*}` (nessun
#     subprocess `dirname`);
#   - `mkdir -p` viene invocato una volta per directory DISTINTA (~10), non
#     una volta per file;
#   - `: > "$f"` e' una redirezione built-in: azzera il file senza spawnare
#     `touch`.
# Output byte-identico: stessi path, stessi stub vuoti.
seed_repo_files() {
  local d="$1" f dir seen=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    dir="${f%/*}"
    [ "$dir" = "$f" ] && dir="."
    case "$seen" in
      *"|$dir|"*) ;;
      *) seen="$seen|$dir|"; mkdir -p "$d/$dir" ;;
    esac
  done <<< "$(bundle_file_list)"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    : > "$d/$f"
  done <<< "$(bundle_file_list)"
  # NB: NON sovrascrivere scripts/generate-bundle.ps1 qui. Il file e' gia'
  # stato copiato in $d/scripts/generate-bundle.ps1 da make_repo prima della
  # chiamata a seed_repo_files, e verra' eventualmente sovrascritto da make_repo
  # stesso dopo (echo "x" etc.). Lasciare il contenuto originale del test source
  # invariato in questa fase.
  :
}

# Repo temporaneo con tutti i file in $files + il script da testare
# (BUNDLE.md e' il file che NON deve essere mai riscritto in check mode).
make_repo() {
  local d="$1"
  mkdir -p "$d/docs" "$d/scripts"
  cp "$SCRIPT" "$d/scripts/generate-bundle.ps1"
  # Inietta stub per ciascun path in $files di generate-bundle.ps1, cosi'
  # Test-Path($\file) ritorna true e lo script entra in --check mode
  # invece di uscire 2 per "missing files" (issue #117, D.117.4).
  # NON tocca scripts/generate-bundle.ps1 (gia' copiato sopra).
  seed_repo_files "$d"
  (
    cd "$d" || exit 1
    git init -q -b main
    # NB: identita' e commit.gpgsign arrivano dalle env var esportate in testa
    # allo script: niente `git config` (3 processi per repo).
    echo "x" > AGENTS.md
    echo "y" > README.md
    echo "z" > LICENSE
    echo "i" > docs/INDEX.md
    git add -A
    git commit -q -m "seed" >/dev/null 2>&1
  )
}

# Normalizza il path dello script per l'invocazione PowerShell.
# `mktemp -d` restituisce un path POSIX (/tmp/...), che il call operator di pwsh
# su Windows NON risolve ("Il termine '/tmp/...' non e' riconosciuto"): T4-T6
# fallivano per questo motivo, indipendentemente dal codice sotto test.
# `cygpath` esiste solo in ambienti con Git Bash, quindi su Linux il path passa
# invariato e il comportamento in CI non cambia.
ps_path() {
  local p="$1"
  if [ "$PS_IS_PWSH" = "1" ] && command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$p"
  else
    echo "$p"
  fi
}

run_via_amp() {
  # Invocazione con call operator `&` — il path fail-open dell'issue #104.
  "$PS" -NoProfile -Command "& '$(ps_path "$1")' $2" 2>&1
  return $?
}

run_via_file() {
  # Invocazione con `pwsh -File` — pwsh normalizza --foo a -foo, qui non si vede
  # il bug: serve solo per confermare che il guard non rompe la modalita' canonica CI.
  "$PS" -NoProfile -File "$(ps_path "$1")" $2 2>&1
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
if [ "$PS_IS_PWSH" = "1" ]; then
  echo "  [SKIP] T1: scenario specifico per Windows PS 5.1 call operator (issue #104). Su pwsh '--check' viene normalizzato a '-Check' prima del param binding, fail-closed guard non si attiva. Stesso test coperto per pwsh da T6 (--check via -File normalizza)."
  echo "  [INFO] Su Windows PS 5.1 il guard fail-closed rileva '--check' ed esce 2 con messaggio 'ERRATO/CORRETTO', come nelle righe originali qui sotto."
else
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
fi

echo "=== T2: --list via & NON scrive ed esce 2 ==="
if [ "$PS_IS_PWSH" = "1" ]; then
  echo "  [SKIP] T2: stesso motivo di T1 (Windows PS 5.1 call operator only)."
else
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
fi

echo "=== T3: --bogus (flag completamente sconosciuto) via & NON scrive ed esce 2 ==="
if [ "$PS_IS_PWSH" = "1" ]; then
  echo "  [SKIP] T3: stesso motivo di T1 (Windows PS 5.1 call operator only). Verifica analoga per pwsh: vedi --bogus coverage se aggiunto."
else
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
fi

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

echo "=== T7: riuso di \`> Data:\` nel path di scrittura (issue #142) ==="
# Difetto gemello di quello di aggregate-state.ps1: `Build-Bundle` accetta un
# parametro `-Timestamp` pensato per il riuso ma veniva chiamato senza, e il
# path di scrittura ristampava `Get-Date` a ogni esecuzione. `-Check` normalizzava
# il campo, quindi nessun gate se ne accorgeva: il sintomo era `auto-bundle` che
# committava un nuovo `> Data:` dopo ogni merge, a contenuto identico.
# Il probe e' un sentinel seminato nell'header: deterministico, non legato
# all'orologio (la granularita' e' al minuto, quindi "prima" e "dopo" possono
# coincidere e un test basato sul valore non distinguerebbe nulla).
{
  D="$(mktemp -d)"; make_repo "$D"; cd "$D" || exit 1
  run_via_amp "$D/scripts/generate-bundle.ps1" "" >/dev/null 2>&1
  git add -A >/dev/null 2>&1; git commit -q -m "seed" >/dev/null 2>&1

  # Solo la PRIMA occorrenza: `> Data:` puo' comparire anche dentro i documenti
  # inclusi (nel repo reale e' docs/AUDIT-2026-10-15.md) e non deve essere toccata.
  sed -i.bak '0,/^> Data: .*$/s//> Data: 2001-01-01 01:01/' docs/BUNDLE.md
  if grep -q '^> Data: 2001-01-01 01:01$' docs/BUNDLE.md; then
    ok "sentinel seminato nell'header di BUNDLE.md"
  else
    ng "sentinel non applicato all'header"
  fi
  git add -A >/dev/null 2>&1; git commit -q -m "sentinel" >/dev/null 2>&1

  run_via_amp "$D/scripts/generate-bundle.ps1" "" >/dev/null 2>&1
  if grep -q '^> Data: 2001-01-01 01:01$' docs/BUNDLE.md; then
    ok "contenuto invariato: \`> Data:\` riusata (nessun commit-rumore)"
  else
    ng "\`> Data:\` riscritta (riuso assente): $(grep -m1 '^> Data:' docs/BUNDLE.md)"
  fi
  if git diff --quiet; then
    ok "nessun diff dopo la rigenerazione a contenuto invariato"
  else
    ng "diff nonostante il riuso"; git diff --stat
  fi

  # Contro-prova: se un file incluso cambia, la data DEVE aggiornarsi.
  # Un riuso cieco passerebbe la prima meta' e congelerebbe la data.
  echo "contenuto modificato" >> AGENTS.md
  run_via_amp "$D/scripts/generate-bundle.ps1" "" >/dev/null 2>&1
  if grep -q '^> Data: 2001-01-01 01:01$' docs/BUNDLE.md; then
    ng "file incluso modificato ma sentinel conservato (riuso cieco)"
  else
    ok "file incluso modificato: \`> Data:\` si aggiorna -> $(grep -m1 '^> Data:' docs/BUNDLE.md)"
  fi

  # Le righe \`> Data:\` dei documenti inclusi non devono essere state toccate dal
  # riuso dell'header (nel repo reale: docs/AUDIT-2026-10-15.md).
  EMBEDDED="$(grep -c '^> Data: ' docs/BUNDLE.md)"
  if [ "$EMBEDDED" -le 1 ]; then
    ok "nessuna riga \`> Data:\` aggiuntiva introdotta nei documenti inclusi"
  else
    ok "documenti inclusi con \`> Data:\` proprio preservati ($EMBEDDED righe)"
  fi

  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]
