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
#   T7  "Dimensione totale" del blocco BUNDLE inventory non dipende dai 4 file
#       aggregator-managed (issue #86, opt A): dopo aver aggiunto 200 righe a
#       SESSIONS.md, la `Dimensione totale` deve restare identica al baseline.
#       Include anche: il blocco inventory dichiara l'esclusione esplicita
#       ("escluso"/"esclusi dal calcolo") e --check resta exit 0 dopo la modifica.
#   T8  "Dimensione totale" e coerente cross-platform: il calcolo normalizza
#       CRLF->LF (issue #88) cosi il valore e identico su Windows (dove 14
#       file di testo sono CRLF sul disco con core.autocrlf=true) e su Linux
#       (LF committed). Setup: file README.md con line endings miste LF+CRLF
#       nel working tree; totale calcolato == dimensione LF committed; --
#       check stabile dopo il toggle dei line endings.
#   T9  collisione di `Number` tra due file di sessione (issue #105): il check
#       emette il messaggio `[FAIL] N numeri di sessione duplicati` con i path
#       di entrambi i file coinvolti ed esce con codice non-zero. -List mostra
#       lo stesso WARN. Risolvibile rinominando uno dei due file.
#   T10 NEXT-STEP block (ADR-0008 V3, issue #127): il blocco `AGGREGATE-NEXT-STEP-*`
#       sul README.md e deterministico + idempotente: pick del primo id non-done per
#       ordinamento [version] (indipendente dall'ordine di creazione dei file),
#       fallback graceful quando non ci sono story non-done, --check exit 0 dopo
#       write. Previene il drift della stringa "Prossima sbloccata" del README.
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

# File target con i 5 marker vuoti (V1+V2) + il marker AGGREGATE-NEXT-STEP-* nel
# README.md (introdotto con ADR-0008 V3, issue #127).
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

  # README.md e' gestito dall'aggregator dal V3 (issue #127).
  # Deve esistere perche' --check fallisce altrimenti con "README.md non esiste".
  cat > "$1/README.md" <<'EOF'
# README

<!-- AGGREGATE-NEXT-STEP-START -->
vecchio contenuto
<!-- AGGREGATE-NEXT-STEP-END -->
EOF
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
echo "=== T7: 'Dimensione totale' non dipende dai file riscritti dall'aggregator (issue #86) ==="
{
  D="$(mktemp -d)"; make_repo "$D" asc; make_targets "$D"
  # Aggiunge un generate-bundle.ps1 minimale con 4 file (3 docs/ + 1 root) cosi
  # l'aggregator ha qualcosa da misurare e il blocco inventory e significativo.
  cat > "$D/scripts/generate-bundle.ps1" <<'EOF'
# mock
$files = @(
    "README.md",
    "docs/00-VISION.md",
    "docs/01-PLATFORMS.md",
    "docs/SESSIONS.md"
)
EOF
  echo "seed" > "$D/README.md"
  echo "vision" > "$D/docs/00-VISION.md"
  echo "plat" > "$D/docs/01-PLATFORMS.md"
  cd "$D" || exit 1
  run_agg >/dev/null 2>&1

  # Baseline: cattura la riga "Dimensione totale:" corrente in docs/BUNDLE.md.
  BASELINE_TOTAL="$(grep '^- Dimensione totale:' docs/BUNDLE.md | head -1)"

  # Simula una crescita realistica di SESSIONS.md (~ 4 KB) come quella che produrrebbe
  # l'aggregator in un run "di settling" (post-merge). SESSIONS.md e uno dei 4 file
  # aggregator-managed; la dimensione deve restare invariata per costruzione.
  for _ in $(seq 1 200); do echo 'filler line added by T7 (simulates post-merge drift)'; done >> docs/SESSIONS.md

  run_agg >/dev/null 2>&1
  AFTER_TOTAL="$(grep '^- Dimensione totale:' docs/BUNDLE.md | head -1)"

  if [ "$BASELINE_TOTAL" = "$AFTER_TOTAL" ]; then
    ok "Dimensione totale invariata dopo +200 righe in SESSIONS.md: $BASELINE_TOTAL"
  else
    ng "Dimensione totale cambiata: '$BASELINE_TOTAL' -> '$AFTER_TOTAL' (drift su SESSIONS.md non escluso)"
  fi

  # Il blocco inventory deve dichiarare l'esclusione esplicita (singolare o plurale).
  # NB: 'escluso' (singolare) vs 'esclusi' (plurale). La regex deve accettare entrambi.
  if grep -Eq -e 'esclusi dal calcolo' -e 'escluso dal calcolo' docs/BUNDLE.md; then
    ok "blocco inventory dichiara l'esclusione: $(grep -oE 'esclus[oi] dal calcolo[^)]*' docs/BUNDLE.md | head -1)"
  else
    ng "blocco inventory non dichiara i file esclusi"
  fi

  # Round-trip --check dopo la manipolazione di SESSIONS.md.
  out="$(run_agg --check)"; rc=$?
  if [ $rc -eq 0 ]; then ok "--check exit 0 dopo T7"; else ng "--check exit $rc dopo T7"; echo "$out" | tail -8; fi

  cd /; rm -rf "$D"
}

echo ""
echo "=== T8: 'Dimensione totale' normalizza CRLF->LF (issue #88, cross-platform) ==="
{
  D="$(mktemp -d)"; make_repo "$D" asc; make_targets "$D"
  # Scenario minimale: un file README.md (root/) e due file docs/.
  cat > "$D/scripts/generate-bundle.ps1" <<'PSEOF'
$files = @(
    "README.md",
    "docs/LF.md",
    "docs/CRLF.md"
)
PSEOF
  cd "$D" || exit 1
  # 10 righe LF per ogni file (committed state).
  for _ in $(seq 1 10); do echo 'line on LF'; done > README.md
  for _ in $(seq 1 10); do echo 'line on LF'; done > docs/LF.md
  for _ in $(seq 1 10); do echo 'line on LF'; done > docs/CRLF.md
  git add -A >/dev/null 2>&1; git commit -q -m "baseline LF" >/dev/null 2>&1

  # Baseline: tutto LF.
  run_agg >/dev/null 2>&1
  BASELINE_TOTAL="$(grep '^- Dimensione totale:' docs/BUNDLE.md | head -1 | sed 's/.*: //')"

  # Toggle di un file a CRLF (simula il checkout Windows con core.autocrlf=true).
  # Il contenuto semantico resta lo stesso ma i raw bytes cambiano.
  for _ in $(seq 1 10); do printf 'line on LF\r\n'; done > README.md
  run_agg >/dev/null 2>&1
  AFTER_TOTAL="$(grep '^- Dimensione totale:' docs/BUNDLE.md | head -1 | sed 's/.*: //')"

  if [ "$BASELINE_TOTAL" = "$AFTER_TOTAL" ]; then
    ok "Dimensione totale stabile dopo toggle CRLF/LF su README.md: $BASELINE_TOTAL"
  else
    ng "Dimensione totale cambiata con CRLF: '$BASELINE_TOTAL' -> '$AFTER_TOTAL' (drift cross-platform)"
  fi

  # Round-trip --check dopo il toggle.
  out="$(run_agg --check)"; rc=$?
  if [ $rc -eq 0 ]; then ok "--check exit 0 dopo toggle CRLF"; else ng "--check exit $rc dopo toggle CRLF"; echo "$out" | tail -8; fi

  # Sanity: i raw byte DEVONO essere diversi quando il file e LF vs CRLF, altrimenti
  # il test e' nullo. Misuriamo in un file separato (non toccato dal toggle prima)
  # per evitare interferenze con lo stato gia mutato di README.md.
  SANITY_LF=$(mktemp)
  SANITY_CRLF=$(mktemp)
  for _ in $(seq 1 10); do echo 'line on LF' >> $SANITY_LF; done
  for _ in $(seq 1 10); do printf 'line on LF\r\n' >> $SANITY_CRLF; done
  RAW_LF=$(wc -c < $SANITY_LF)
  RAW_CRLF=$(wc -c < $SANITY_CRLF)
  rm -f $SANITY_LF $SANITY_CRLF
  if [ "$RAW_LF" != "$RAW_CRLF" ]; then
    ok "byte-count raw LF/CRLF distinto (LF=$RAW_LF vs CRLF=$RAW_CRLF): il fix lavora sul contenuto, non sui raw bytes"
  else
    ng "byte-count raw identico: il test non distingue LF/CRLF"
  fi

  cd /; rm -rf "$D"
}

echo ""
echo "=== T9: collisione di Number tra session file (issue #105) ==="
{
  D="$(mktemp -d)"; make_repo "$D" asc; make_targets "$D"; cd "$D" || exit 1
  run_agg >/dev/null 2>&1

  # Snapshot dello stato "no collisioni".
  out0="$(run_agg --check)"; rc0=$?
  if [ $rc0 -eq 0 ]; then ok "baseline: --check exit 0 senza duplicati"; else ng "baseline --check exit $rc0"; fi

  # Crea un duplicato: copia 32-trentadue.md come 32-alias-test.md (entrambi
  # hanno Number=32 nel filename). Lo scenario reale e': due agenti paralleli
  # scelgono entrambi "32" come nuovo numero di sessione.
  cp docs/state/sessions/32-trentadue.md docs/state/sessions/32-alias-test.md

  # --check deve emettere FAIL + exit non-zero.
  out="$(run_agg --check)"; rc=$?
  if [ $rc -ne 0 ]; then ok "--check exit non-zero ($rc) in presenza di duplicati"; else ng "--check exit 0 con duplicati: fail-open!"; echo "$out" | tail -8; fi

  # Il messaggio [FAIL] deve nominare il Number coinvolto (32) e includere
  # entrambi i path. Senza questo, il drift sarebbe "invisibile" come descritto
  # nell'issue #105.
  if echo "$out" | grep -q '\[FAIL\].*numeri di sessione duplicati'; then
    ok "[FAIL] emette il messaggio 'numeri di sessione duplicati'"
  else
    ng "[FAIL] messaggio mancante: duplicati invisibili al check"
  fi
  if echo "$out" | grep -q 'Number=32'; then
    ok "messaggio cita il Number=32 coinvolto"
  else
    ng "messaggio non cita il Number: l'agente non sa quale rinominare"
  fi
  if echo "$out" | grep -q '32-trentadue.md'; then
    ok "messaggio cita il path '32-trentadue.md' (originale)"
  else
    ng "messaggio non cita il path originale"
  fi
  if echo "$out" | grep -q '32-alias-test.md'; then
    ok "messaggio cita il path '32-alias-test.md' (duplicato)"
  else
    ng "messaggio non cita il path duplicato"
  fi

  # -List deve mostrare lo stesso WARN anche fuori da --check.
  out_list="$(run_agg --list)" || true
  if echo "$out_list" | grep -q 'numeri di sessione duplicati'; then
    ok "-List evidenzia i duplicati con WARN"
  else
    ng "-List non evidenzia i duplicati"
  fi

  # Apply-mode (default write) deve continuare a SCRIVERE (il drift e' gia'
  # su main, l'allineamento non lo risolve - serve intervento umano) ma
  # emettere il WARN visibile.
  out_apply="$(run_agg 2>&1)" || true
  if echo "$out_apply" | grep -q '\[WARN\].*numeri di sessione duplicati'; then
    ok "apply-mode emette [WARN] visibile ma continua a scrivere"
  else
    ng "apply-mode non emette [WARN]: drift invisibile anche qui"
  fi

  # Cleanup del duplicato: --check deve tornare a exit 0 (entrambi i file
  # ora non sono piu' una collisione perche' rimane solo l'originale).
  rm docs/state/sessions/32-alias-test.md
  run_agg >/dev/null 2>&1
  out1="$(run_agg --check)"; rc1=$?
  if [ $rc1 -eq 0 ]; then ok "dopo rimozione duplicato: --check exit 0"; else ng "dopo rimozione: --check exit $rc1"; fi

  cd /; rm -rf "$D"
}

echo ""
echo "=== T10: NEXT-STEP block deterministico (ADR-0008 V3, issue #127) ==="
{
  # Helper: repo con 3 stories done + 2 non-done (1.1 = prossima attesa).
  make_repo_with_status() {
    local d="$1"
    mkdir -p "$d/docs/state/sessions" "$d/docs/state/stories" "$d/scripts"
    cp "$SCRIPT" "$d/scripts/aggregate-state.ps1"
    (
      cd "$d" || exit 1
      git init -q -b main
      git config user.email "t@t.local"
      git config user.name "Test"
      git config commit.gpgsign false

      write_story 0.3 "adapter-spotify" "Adapter Spotify base" done "#28" "adapter"
      write_story 0.5 "pwa" "PWA e service worker" done "#19" "devops"
      write_story 0.7 "ops-runbook" "Operations runbook" done "#64" "devops"
      write_story 1.1 "adapter-youtube-music" "Adapter YouTube Music" todo "" "adapter"
      write_story 1.2 "adapter-apple-music" "Adapter Apple Music" todo "" "adapter"
    )
  }

  # Estrae l'id story raccomandato dal blocco NEXT-STEP del README.md.
  next_step_id_in_readme() {
    sed -n '/AGGREGATE-NEXT-STEP-START/,/AGGREGATE-NEXT-STEP-END/p' "$1/README.md" \
      | grep -oE '\*\*[0-9]+\.[0-9]+\*\*' | head -1 | tr -d '*'
  }

  # --- Sub-test 10a: pick deterministico (ordine creazione ascendente) ---
  D="$(mktemp -d)"; make_repo_with_status "$D"; make_targets "$D"; cd "$D" || exit 1
  run_agg >/dev/null 2>&1
  PICK="$(next_step_id_in_readme "$D")"
  if [ "$PICK" = "1.1" ]; then ok "NEXT-STEP sceglie 1.1 (primo non-done per [version]Id)"; else ng "NEXT-STEP inatteso: '$PICK' invece di '1.1'"; fi

  out="$(run_agg --check)"; rc=$?
  if [ $rc -eq 0 ]; then ok "NEXT-STEP: --check exit 0 dopo la scrittura"; else ng "NEXT-STEP: --check exit $rc"; echo "$out" | tail -8; fi
  cd /; rm -rf "$D"

  # --- Sub-test 10b: indipendente dall'ordine di creazione ---
  D="$(mktemp -d)"
  mkdir -p "$D/docs/state/sessions" "$D/docs/state/stories" "$D/scripts"
  cp "$SCRIPT" "$D/scripts/aggregate-state.ps1"
  (
    cd "$D" || exit 1
    git init -q -b main
    git config user.email "t@t.local"; git config user.name "Test"; git config commit.gpgsign false
    # Ordine INVERSO: 1.2 prima di 1.1 (scenario "filesystem-dipendente")
    write_story 1.2 "adapter-apple-music" "Adapter Apple Music" todo "" "adapter"
    write_story 1.1 "adapter-youtube-music" "Adapter YouTube Music" todo "" "adapter"
    write_story 0.7 "ops-runbook" "Operations runbook" done "#64" "devops"
    write_story 0.3 "adapter-spotify" "Adapter Spotify base" done "#28" "adapter"
  )
  make_targets "$D"; cd "$D" || exit 1
  run_agg >/dev/null 2>&1
  PICK="$(next_step_id_in_readme "$D")"
  if [ "$PICK" = "1.1" ]; then ok "NEXT-STEP indipendente da ordine creazione (ancora 1.1)"; else ng "NEXT-STEP ordine-dipendente: '$PICK' invece di '1.1'"; fi
  cd /; rm -rf "$D"

  # --- Sub-test 10c: fallback graceful (tutte done) ---
  D="$(mktemp -d)"; make_repo "$D" asc; make_targets "$D"; cd "$D" || exit 1
  run_agg >/dev/null 2>&1
  if grep -q 'Nessuna story non-done migrata' README.md; then
    ok "NEXT-STEP fallback: messaggio esplicito quando tutte le story sono done"
  else
    ng "NEXT-STEP fallback mancante: emette contenuto fuorviante invece del fallback"
  fi
  out="$(run_agg --check)"; rc=$?
  if [ $rc -eq 0 ]; then ok "NEXT-STEP fallback: --check exit 0"; else ng "NEXT-STEP fallback: --check exit $rc"; fi
  cd /; rm -rf "$D"

  # --- Sub-test 10d: idempotenza byte-identica ---
  D="$(mktemp -d)"; make_repo_with_status "$D"; make_targets "$D"; cd "$D" || exit 1
  run_agg >/dev/null 2>&1
  FIRST_HASH="$(git hash-object README.md)"

  sleep 1
  run_agg >/dev/null 2>&1
  SECOND_HASH="$(git hash-object README.md)"
  if [ "$FIRST_HASH" = "$SECOND_HASH" ]; then
    ok "NEXT-STEP idempotente: hash README.md invariato tra due run"
  else
    ng "NEXT-STEP non idempotente: $FIRST_HASH -> $SECOND_HASH"
  fi
  cd /; rm -rf "$D"
}

echo ""
echo "Risultati: $pass passati, $fail falliti"
[ "$fail" -eq 0 ]