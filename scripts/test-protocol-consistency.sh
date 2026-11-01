#!/usr/bin/env bash
# Test di scenario per scripts/check-protocol-consistency.mjs (issue #248, ADR-0012).
#
# Il gate confronta i fatti normativi del protocollo con la realta' del
# repository. Un gate che passa sempre non e' un gate (lesson 43-1): qui ogni
# controllo ha UN scenario che lo fa fallire, oltre a quello che lo fa passare.
#
# Esegui con: bash scripts/test-protocol-consistency.sh
# Richiede: bash, node.

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
GATE="$SCRIPT_DIR/check-protocol-consistency.mjs"

if [ ! -f "$GATE" ]; then
  echo "[FAIL] gate non trovato: $GATE"
  exit 2
fi

WORK=$(mktemp -d)
trap "rm -rf '$WORK'" EXIT
REPO="$WORK/repo"
mkdir -p "$REPO/docs" "$REPO/scripts" "$REPO/.github"

# ---------------------------------------------------------------------------
# Fixture: un repository minimale ma coerente
# ---------------------------------------------------------------------------

write_fixture() {
  local agents_version="$1"
  local labels_row="$2"
  local exit_rows="$3"
  local extra_ref="$4"
  local extra_flag="${5:--Check}"
  local checklist_item="${6:-}"

  cat > "$REPO/AGENTS.md" <<'EOF'
# 🤖 Protocollo di test

> **Versione __AGENTS_VERSION__ — Sessione 80 (2026-11-01)**

## 🎫 Presa in carico delle story

Regola di coordinazione.

### Label disponibili

| Categoria | Label | Significato |
|-----------|-------|-------------|
__LABELS_ROW__

### Exit code (utili a hook e CI)

| Code | Significato |
|------|-------------|
__EXIT_ROWS__

## 📦 Appendice

__EXTRA_REF__

```powershell
pwsh scripts/post-merge.ps1 __EXTRA_FLAG__
```
EOF

  cat > "$REPO/docs/INDEX.md" <<'EOF'
# Indice

| Documento | Stato | Note |
|-----------|-------|------|
| [`../AGENTS.md`](../AGENTS.md) | 🟢 v__AGENTS_VERSION__ | protocollo |
EOF

  cat > "$REPO/scripts/validate-labels.mjs" <<'EOF'
const expectedByCategory = {
  Fase: ['phase-0', 'phase-1', 'phase-2', 'phase-post'],
  Area: ['area:devops'],
  'Priorità': ['priority:important'],
  Size: ['size:M'],
  Gate: ['agent-ready'],
  'Status (post-claim)': ['status:done'],
  Tipo: ['docs'],
};
EOF

  cat > "$REPO/scripts/post-merge.ps1" <<'EOF'
param(
    [switch]$Check
)
exit 0
exit 14
EOF

  cat > "$REPO/.github/pull_request_template.md" <<'EOF'
## Checklist

- [ ] Ho letto `AGENTS.md`
EOF

  # sostituzioni (via node: i valori contengono backtick e `|`, che la shell
  # interpreterebbe come command substitution)
  replace_in "$REPO/AGENTS.md" "__AGENTS_VERSION__" "$agents_version"
  replace_in "$REPO/docs/INDEX.md" "__AGENTS_VERSION__" "$agents_version"
  replace_in "$REPO/AGENTS.md" "__LABELS_ROW__" "$labels_row"
  replace_in "$REPO/AGENTS.md" "__EXIT_ROWS__" "$exit_rows"
  replace_in "$REPO/AGENTS.md" "__EXTRA_REF__" "$extra_ref"
  replace_in "$REPO/AGENTS.md" "__EXTRA_FLAG__" "$extra_flag"

  if [ -n "$checklist_item" ]; then
    printf '\n%s\n' "$checklist_item" >> "$REPO/AGENTS.md"
  fi
}

# Sostituzione letterale in un file, senza passare dalla shell.
replace_in() {
  node -e '
    const fs = require("fs");
    const [f, k, v] = process.argv.slice(1);
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").split(k).join(v));
  ' "$1" "$2" "$3"
}

PASS=0
FAIL=0

run_scenario() {
  local id="$1" desc="$2" expected_exit="$3"

  node "$GATE" --root "$REPO" > "$WORK/out.txt" 2>&1
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

LABELS_OK='| Fase | `phase-0` … `phase-2`, `phase-post` | Fase |
| Area | `area:devops` | Area |
| Priorità | `priority:important` | Priorità |
| Size | `size:M` | Size |
| Gate | `agent-ready` | Gate |
| Status (post-claim) | `status:done` | Status |
| Tipo | `docs` | Tipo |'

# T1: repository coerente -> il gate passa
write_fixture "1.34" "$LABELS_OK" "| 0 | tutto pulito |
| 14 | residui |" "Vedi §\"🎫 Presa in carico delle story\"." "-Check" ""
run_scenario "T1" "repository coerente" "0"

# T2: versione disallineata fra AGENTS.md e docs/INDEX.md (drift D1)
write_fixture "1.34" "$LABELS_OK" "| 0 | tutto pulito |
| 14 | residui |" "Vedi §\"🎫 Presa in carico delle story\"." "-Check" ""
sed -i 's/| 🟢 v1.34 |/| 🟢 v1.27 |/' "$REPO/docs/INDEX.md"
run_scenario "T2" "versione disallineata in docs/INDEX.md (D1)" "1"

# T3: tabella label senza phase-post (drift D2)
write_fixture "1.34" '| Fase | `phase-0` … `phase-2` | Fase |
| Area | `area:devops` | Area |
| Priorità | `priority:important` | Priorità |
| Size | `size:M` | Size |
| Gate | `agent-ready` | Gate |
| Status (post-claim) | `status:done` | Status |
| Tipo | `docs` | Tipo |' "| 0 | tutto pulito |
| 14 | residui |" "Vedi §\"🎫 Presa in carico delle story\"." "-Check" ""
run_scenario "T3" "tabella label senza phase-post (D2)" "1"

# T4: exit code emesso dallo script ma non documentato (drift D3)
write_fixture "1.34" "$LABELS_OK" "| 0 | tutto pulito |" "Vedi §\"🎫 Presa in carico delle story\"." "-Check" ""
run_scenario "T4" "exit code non documentato (D3)" "1"

# T5: riferimento ad AGENTS.md che non risolve a un heading
write_fixture "1.34" "$LABELS_OK" "| 0 | tutto pulito |
| 14 | residui |" "Vedi §\"Sezione che non esiste\"." "-Check" ""
run_scenario "T5" "riferimento rotto a un heading (C4)" "1"

# T6: script citato che non esiste (drift D7)
write_fixture "1.34" "$LABELS_OK" "| 0 | tutto pulito |
| 14 | residui |" "Vedi §\"🎫 Presa in carico delle story\"." "-Check" ""
cat >> "$REPO/AGENTS.md" <<'EOF'

```bash
node scripts/script-che-non-esiste.mjs
```
EOF
run_scenario "T6" "script citato inesistente (C5)" "1"

# T7: flag citato che lo script non dichiara
write_fixture "1.34" "$LABELS_OK" "| 0 | tutto pulito |
| 14 | residui |" "Vedi §\"🎫 Presa in carico delle story\"." "-FlagInesistente" ""
run_scenario "T7" "flag citato inesistente (C5)" "1"

# T8: voce di checklist copiata dal PR template (drift D8)
write_fixture "1.34" "$LABELS_OK" "| 0 | tutto pulito |
| 14 | residui |" "Vedi §\"🎫 Presa in carico delle story\"." "-Check" "- [ ] Ho letto \`AGENTS.md\`"
run_scenario "T8" "checklist duplicata dal PR template (D8)" "1"

# T9: un riferimento ROTTO ma **citato** dentro un backtick non e' un
# puntamento: non si verifica (issue #254). Il testo della Sessione 80
# riportava `AGENTS.md §V1` come esempio di un riferimento gia' corretto, e
# l'aggregator lo aveva copiato nel blocco AGGREGATE-PROGRESS: il gate lo
# contava come drift e lasciava `main` rosso.
write_fixture "1.34" "$LABELS_OK" "| 0 | tutto pulito |
| 14 | residui |" "Vedi \`AGENTS.md §\"Sezione che non esiste\"\`." "-Check" ""
run_scenario "T9" "riferimento rotto citato dentro un backtick (C4)" "0"

# T10: un riferimento NUMERICO (§9.8b) che appartiene a un altro documento non
# e' un riferimento ad AGENTS.md: la riga cita `docs/12-DEVOPS.md`, quindi il
# gate non lo cerca fra gli heading di AGENTS.md (issue #259).
write_fixture "1.34" "$LABELS_OK" "| 0 | tutto pulito |
| 14 | residui |" "Vedi \`docs/12-DEVOPS.md\` §9.8b e \`18-DEV-LOG.md\` §49: Sessione 83." "-Check" ""
run_scenario "T10" "riferimento numerico di un altro documento (C4)" "0"

echo "---"
echo "Pass: $PASS   Fail: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "FAILURES"
  exit 1
fi
