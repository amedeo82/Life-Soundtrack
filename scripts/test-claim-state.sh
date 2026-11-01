#!/usr/bin/env bash
# Test di scenario per scripts/check-claim-state.mjs (issue #256, ADR-0012 regola 5).
#
# Il gate verifica che il protocollo di claim (ADR-0006) sia rispettato:
# branch <-> issue <-> keyword di chiusura <-> stato dell'issue <-> claim.
# Fino alla Sessione 80 queste regole erano solo prosa.
#
# I dati arrivano da file JSON (--pr-json/--issue-json/--comments-json): il
# test non tocca GitHub e funziona identico su Windows e Linux (un mock `gh`
# bash non e' eseguibile su Windows senza estensione, e il PATH finirebbe per
# chiamare il gh vero).
#
# Esegui con: bash scripts/test-claim-state.sh
# Richiede: bash, node.

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
GATE="$SCRIPT_DIR/check-claim-state.mjs"

if [ ! -f "$GATE" ]; then
  echo "[FAIL] gate non trovato: $GATE"
  exit 2
fi

WORK=$(mktemp -d)
trap "rm -rf '$WORK'" EXIT

PASS=0
FAIL=0

# scenario <id> <descrizione> <expected exit> <pr json> <issue json> <comments json>
scenario() {
  local id="$1" desc="$2" expected_exit="$3"
  printf '%s' "$4" > "$WORK/pr.json"
  printf '%s' "$5" > "$WORK/issue.json"
  printf '%s' "$6" > "$WORK/comments.json"

  node "$GATE" --pr 1 --pr-json "$WORK/pr.json" --issue-json "$WORK/issue.json" \
    --comments-json "$WORK/comments.json" > "$WORK/out.txt" 2>&1
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

# i newline sono espressi come \n: dentro il JSON devono essere escape
PR_BODY_OK='## Sintesi\n\nCloses #7\n\n- [x] fatto'
ISSUE_OK='{"state":"OPEN","labels":[{"name":"agent-ready"},{"name":"status:in-review"}]}'
COMMENTS_OK='[{"id":100,"body":"claim: kilo-hp-abc (UTC 2026-11-01T10:00:00Z)"},{"id":101,"body":"altro commento"}]'

# T1: tutto coerente
scenario "T1" "branch, keyword, stato e claim coerenti" "0" \
  '{"number":1,"state":"OPEN","headRefName":"feat/7-coerenza","body":"'"$PR_BODY_OK"'","files":[{"path":"scripts/x.mjs"}]}' \
  "$ISSUE_OK" "$COMMENTS_OK"

# T2: branch senza numero di issue
scenario "T2" "branch fuori dal pattern feat|fix/<N>-" "1" \
  '{"number":1,"state":"OPEN","headRefName":"feature/coerenza","body":"'"$PR_BODY_OK"'","files":[{"path":"scripts/x.mjs"}]}' \
  "$ISSUE_OK" "$COMMENTS_OK"

# T3: keyword di chiusura assente
scenario "T3" "keyword di chiusura assente" "1" \
  '{"number":1,"state":"OPEN","headRefName":"feat/7-coerenza","body":"## Sintesi\n\nnessuna chiusura","files":[{"path":"scripts/x.mjs"}]}' \
  "$ISSUE_OK" "$COMMENTS_OK"

# T4: keyword di chiusura dentro backtick (non nuda)
scenario "T4" "keyword di chiusura non nuda" "1" \
  '{"number":1,"state":"OPEN","headRefName":"feat/7-coerenza","body":"## Sintesi\n\n`Closes #7`","files":[{"path":"scripts/x.mjs"}]}' \
  "$ISSUE_OK" "$COMMENTS_OK"

# T5: keyword che punta a un'altra issue
scenario "T5" "keyword di chiusura su un'altra issue" "1" \
  '{"number":1,"state":"OPEN","headRefName":"feat/7-coerenza","body":"Closes #9","files":[{"path":"scripts/x.mjs"}]}' \
  "$ISSUE_OK" "$COMMENTS_OK"

# T6: issue non transizionata a status:in-review
scenario "T6" "issue senza status:in-review" "1" \
  '{"number":1,"state":"OPEN","headRefName":"feat/7-coerenza","body":"'"$PR_BODY_OK"'","files":[{"path":"scripts/x.mjs"}]}' \
  '{"state":"OPEN","labels":[{"name":"agent-ready"}]}' "$COMMENTS_OK"

# T7: issue senza nessun claim
scenario "T7" "issue senza commento di claim" "1" \
  '{"number":1,"state":"OPEN","headRefName":"feat/7-coerenza","body":"'"$PR_BODY_OK"'","files":[{"path":"scripts/x.mjs"}]}' \
  "$ISSUE_OK" '[{"id":101,"body":"commento qualsiasi"}]'

# T8: l'agente vincente ha fatto yield
scenario "T8" "claim vincente con yield" "1" \
  '{"number":1,"state":"OPEN","headRefName":"feat/7-coerenza","body":"'"$PR_BODY_OK"'","files":[{"path":"scripts/x.mjs"}]}' \
  "$ISSUE_OK" '[{"id":100,"body":"claim: kilo-hp-abc (UTC 2026-11-01T10:00:00Z)"},{"id":102,"body":"yield: l-agente kilo-hp-abc ha rinunciato (claim 100)"}]'

# T9: branch docs/ che tocca file fuori docs/
scenario "T9" "branch docs/ con file fuori docs/" "1" \
  '{"number":1,"state":"OPEN","headRefName":"docs/session-7-merge-state","body":"## Sintesi\n\nnessuna chiusura","files":[{"path":"docs/state/sessions/7-x.md"},{"path":"scripts/agent-claim.ps1"}]}' \
  "$ISSUE_OK" "$COMMENTS_OK"

# T10: branch docs/ che tocca solo docs/
scenario "T10" "branch docs/ con soli file docs/" "0" \
  '{"number":1,"state":"OPEN","headRefName":"docs/session-7-merge-state","body":"## Sintesi\n\nnessuna chiusura","files":[{"path":"docs/state/sessions/7-x.md"},{"path":"docs/BUNDLE.md"}]}' \
  "$ISSUE_OK" "$COMMENTS_OK"

# T11: PR gia' mergiata -> il gate non si applica
scenario "T11" "PR mergiata (gate non applicabile)" "0" \
  '{"number":1,"state":"MERGED","headRefName":"feat/7-coerenza","body":"'"$PR_BODY_OK"'","files":[{"path":"scripts/x.mjs"}]}' \
  "$ISSUE_OK" "$COMMENTS_OK"

echo "---"
echo "Pass: $PASS   Fail: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "FAILURES"
  exit 1
fi
