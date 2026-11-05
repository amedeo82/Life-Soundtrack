#!/usr/bin/env bash
# Test di scenario per scripts/check-worktree-ownership.mjs (issue #319).
#
# Il gate confronta chi possiede la worktree LOCALE (`agent-state.json`) con
# chi ha vinto il claim sull'issue (commento `claim:` con id numerico piu'
# basso fra quelli non rilasciati). Il gate che passa sempre non e' un gate
# (lesson 43-1): qui si verificano sia il caso positivo sia i casi negativi.
#
# I dati arrivano da file JSON (--state-json/--comments-json): il test non
# tocca GitHub e funziona identico su Windows e Linux (un mock `gh` bash non
# e' eseguibile su Windows senza estensione, e il PATH finirebbe per chiamare
# il gh vero).
#
# Esegui con: bash scripts/test-worktree-ownership.sh
# Richiede: bash, node.

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
GATE="$SCRIPT_DIR/check-worktree-ownership.mjs"

if [ ! -f "$GATE" ]; then
  echo "[FAIL] gate non trovato: $GATE"
  exit 2
fi

WORK=$(mktemp -d)
trap "rm -rf '$WORK'" EXIT

PASS=0
FAIL=0

# scenario <id> <descrizione> <expected exit> <state json> <comments json>
scenario() {
  local id="$1" desc="$2" expected_exit="$3"
  printf '%s' "$4" > "$WORK/state.json"
  printf '%s' "$5" > "$WORK/comments.json"

  node "$GATE" --state-json "$WORK/state.json" --comments-json "$WORK/comments.json" \
    > "$WORK/out.txt" 2>&1
  local actual_exit=$?

  local status="OK"
  if [ "$actual_exit" != "$expected_exit" ]; then
    status="FAIL"
  fi

  printf "%-3s %-56s | expected=%-3s | actual=%-3s (%s)\n" \
    "$id" "$desc" "$expected_exit" "$actual_exit" "$status"

  if [ "$status" = "OK" ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    sed 's/^/       | /' "$WORK/out.txt" | head -6
  fi
}

# il claim attivo: formato di scripts/agent-claim.ps1
STATE_OWNER='{"issue":240,"agent_id":"kilo-hp-abc","claim_id":100,"branch":"feat/240-x"}'
STATE_OTHER='{"issue":240,"agent_id":"kilo-hp-xyz","claim_id":101,"branch":"feat/240-x"}'

COMMENTS_OWNER='[{"id":100,"body":"claim: kilo-hp-abc (UTC 2026-11-05T19:22:34Z) -- worktree: C:/tmp/ls-240"}]'
COMMENTS_TWO='[{"id":100,"body":"claim: kilo-hp-abc (UTC 2026-11-05T19:22:34Z)"},{"id":101,"body":"claim: kilo-hp-xyz (UTC 2026-11-05T19:22:40Z)"}]'
COMMENTS_RELEASED='[{"id":100,"body":"claim: kilo-hp-abc (UTC 2026-11-05T19:22:34Z)"},{"id":102,"body":"release: kilo-hp-abc — PR merged"}]'
COMMENTS_RELEASED_THEN_NEW='[{"id":100,"body":"claim: kilo-hp-abc (UTC 2026-11-05T19:22:34Z)"},{"id":102,"body":"release: kilo-hp-abc — abbandono"},{"id":103,"body":"claim: kilo-hp-xyz (UTC 2026-11-05T20:00:00Z)"}]'

# T1: l'owner locale coincide con il claim vincente
scenario "T1" "owner locale = claim vincente" "0" "$STATE_OWNER" "$COMMENTS_OWNER"

# T2: l'owner locale NON coincide con il claim vincente (doppo lavoro)
scenario "T2" "owner locale != claim vincente (doppio lavoro)" "1" "$STATE_OTHER" "$COMMENTS_OWNER"

# T3: due claim, l'id piu' basso vince (l'owner deve essere il primo)
scenario "T3" "con due claim vince quello con id piu' basso" "1" "$STATE_OTHER" "$COMMENTS_TWO"

# T4: il claim vincente e' stato rilasciato: la worktree e' orfana, non un difetto
scenario "T4" "claim vincente rilasciato (worktree orfana)" "0" "$STATE_OWNER" "$COMMENTS_RELEASED"

# T5: claim rilasciato e poi un nuovo claim: vince il nuovo
scenario "T5" "claim rilasciato seguito da nuovo claim" "1" "$STATE_OWNER" "$COMMENTS_RELEASED_THEN_NEW"

# T6: stesso agente, claim id diverso nello stato: stato precedente, non un difetto
scenario "T6" "stesso agente con claim id diverso nello stato" "0" \
  '{"issue":240,"agent_id":"kilo-hp-abc","claim_id":99,"branch":"feat/240-x"}' "$COMMENTS_OWNER"

# T7: stato illeggibile (nessun agent_id) -> errore di ambiente, non un difetto
scenario "T7" "agent-state.json senza agent_id (errore di ambiente)" "2" \
  '{"issue":240,"claim_id":100}' "$COMMENTS_OWNER"

# T8: nessun claim attivo e nessun stato: niente da verificare
scenario "T8" "nessun claim attivo" "0" "$STATE_OWNER" '[]'

# T9: file di stato inesistente -> errore di ambiente (exit 2, fail-open)
node "$GATE" --state-json "$WORK/does-not-exist.json" --comments-json "$WORK/comments.json" \
  > "$WORK/out.txt" 2>&1
actual_exit=$?
status="OK"
if [ "$actual_exit" != "2" ]; then status="FAIL"; fi
printf "%-3s %-56s | expected=%-3s | actual=%-3s (%s)\n" \
  "T9" "file di stato inesistente (errore di ambiente)" "2" "$actual_exit" "$status"
if [ "$status" = "OK" ]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
  sed 's/^/       | /' "$WORK/out.txt" | head -6
fi

echo "---"
echo "Pass: $PASS   Fail: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "FAILURES"
  exit 1
fi
