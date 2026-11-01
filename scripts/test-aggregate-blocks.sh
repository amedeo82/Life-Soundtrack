#!/usr/bin/env bash
# Test di scenario per scripts/check-aggregate-blocks.mjs (issue #248, ADR-0012 regola 4).
#
# Il gate verifica che una PR non modifichi i blocchi `<!-- AGGREGATE-* -->` dei
# file globali: hanno un solo scrittore (`scripts/aggregate-state.ps1`), che
# rigenera post-merge. La regola V1 di ADR-0008 ("mai modificare i blocchi
# aggregati a mano") era finora garantita solo da un check warning-only.
#
# Un gate che passa sempre non e' un gate (lesson 43-1): qui ogni caso ha uno
# scenario che lo fa fallire, oltre a quelli che lo fanno passare.
#
# Esegui con: bash scripts/test-aggregate-blocks.sh
# Richiede: bash, git, node.

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
GATE="$SCRIPT_DIR/check-aggregate-blocks.mjs"

if [ ! -f "$GATE" ]; then
  echo "[FAIL] gate non trovato: $GATE"
  exit 2
fi

WORK=$(mktemp -d)
trap "rm -rf '$WORK'" EXIT
REPO="$WORK/repo"
mkdir -p "$REPO/docs" "$REPO/scripts"

cd "$REPO"
git init -q -b main
git config user.email "test@example.com"
git config user.name "Test"
git config core.autocrlf false
git config core.eol lf

# --- fixture: l'aggregator (per la lista dei target) e un file con blocchi ---
cat > scripts/aggregate-state.ps1 <<'EOF'
$targets = @(
    @{ Path = "docs/INDEX.md";      Start = $markerIndexStatusStart; End = $markerIndexStatusEnd },
    @{ Path = "docs/BUNDLE.md";     Start = $markerBundleInventoryStart; End = $markerBundleInventoryEnd }
)
EOF

cat > docs/INDEX.md <<'EOF'
# Indice

<!-- AGGREGATE-INDEX-STATUS-START -->
stato: verde
<!-- AGGREGATE-INDEX-STATUS-END -->
EOF

cat > docs/BUNDLE.md <<'EOF'
# Bundle

<!-- AGGREGATE-BUNDLE-INVENTORY-START -->
inventario: 1 file
<!-- AGGREGATE-BUNDLE-INVENTORY-END -->
EOF

git add -A
git commit -q -m "base"
BASE=$(git rev-parse HEAD)

PASS=0
FAIL=0

run_scenario() {
  local id="$1" desc="$2" expected_exit="$3"

  node "$GATE" --root "$REPO" --base "$BASE" --head HEAD > "$WORK/out.txt" 2>&1
  local actual_exit=$?

  local status="OK"
  if [ "$actual_exit" != "$expected_exit" ]; then
    status="FAIL"
  fi

  printf "%-3s %-52s | expected=%-3s | actual=%-3s (%s)\n" \
    "$id" "$desc" "$expected_exit" "$actual_exit" "$status"

  if [ "$status" = "OK" ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    sed 's/^/       | /' "$WORK/out.txt" | head -6
  fi
}

# T1: nessuna modifica ai blocchi -> passa
run_scenario "T1" "nessuna modifica ai blocchi" "0"

# T2: blocco di stato modificato a mano -> fallisce
sed -i 's/stato: verde/stato: rosso/' docs/INDEX.md
git add -A && git commit -q -m "modifica manuale del blocco"
run_scenario "T2" "blocco di stato modificato a mano" "1"
git reset -q --hard "$BASE"

# T3: blocco aggiunto -> fallisce
cat >> docs/INDEX.md <<'EOF'

<!-- AGGREGATE-NUOVO-START -->
inventato
<!-- AGGREGATE-NUOVO-END -->
EOF
git add -A && git commit -q -m "aggiunta di un blocco"
run_scenario "T3" "blocco aggiunto a mano" "1"
git reset -q --hard "$BASE"

# T4: blocco rimosso -> fallisce
python3 - <<'EOF' 2>/dev/null || sed -i '/AGGREGATE-INDEX-STATUS-START/,/AGGREGATE-INDEX-STATUS-END/d' docs/INDEX.md
import re
p = "docs/INDEX.md"
s = open(p, encoding="utf-8").read()
s = re.sub(r"<!-- AGGREGATE-INDEX-STATUS-START -->.*?<!-- AGGREGATE-INDEX-STATUS-END -->\n", "", s, flags=re.S)
open(p, "w", encoding="utf-8").write(s)
EOF
git add -A && git commit -q -m "rimozione di un blocco"
run_scenario "T4" "blocco rimosso" "1"
git reset -q --hard "$BASE"

# T5: blocco esente (inventario = misura, non stato) modificato -> passa
sed -i 's/inventario: 1 file/inventario: 2 file/' docs/BUNDLE.md
git add -A && git commit -q -m "inventario aggiornato"
run_scenario "T5" "blocco esente (inventario) modificato" "0"
git reset -q --hard "$BASE"

# T6: file che non contiene blocchi -> passa
cat > docs/NUOVO.md <<'EOF'
# Documento nuovo

Nessun blocco aggregato qui.
EOF
git add -A && git commit -q -m "file nuovo senza blocchi"
run_scenario "T6" "file nuovo senza blocchi aggregati" "0"
git reset -q --hard "$BASE"

echo "---"
echo "Pass: $PASS   Fail: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "FAILURES"
  exit 1
fi
