#!/usr/bin/env bash
# Test di regressione per il gate "stato di merge delle sessioni" (issue #239).
#
# Difende il difetto: 14 sessioni su ~56 riportavano `merged: false` anche
# DOPO il merge della propria PR (5 di esse senza neppure il numero di PR), e
# il drift era invisibile perche' nessun gate confrontava `docs/state/` con lo
# stato reale delle PR: i gate esistenti verificano la consistenza INTERNA
# (il blocco aggregato coincide con i file di quel momento), quindi il flag
# sbagliato veniva riprodotto fedelmente e la pipeline restava verde con la
# documentazione falsa.
#
# Il gate vive in scripts/check-merge-state.mjs (bloccante in CI dal #239);
# questo file e' il suo test di regressione: verifica che il gate **esca 1**
# quando si reintroduce il drift. Un gate che passa sempre non e' un gate
# (lesson 43-1).
#
# Il test e' ermetico: un server HTTP locale (node, modulo http) serve le
# fixture delle PR, e il gate viene puntato ad esso con GITHUB_API_URL. Nessuna
# chiamata alla rete durante gli scenari T1..T9.
#
# Scenari coperti:
#   T0  repo reale: lo stato di merge delle sessioni e' in sync con GitHub -> exit 0
#   T1  fixture coerente (PR mergiata + frontmatter allineato) -> exit 0
#   T2  fixture: PR mergiata ma `merged: false` -> exit 1, il messaggio nomina il file
#   T3  fixture: PR ancora aperta ma `merged: true` -> exit 1
#   T4  fixture: `merged_commit` diverso dal merge commit reale -> exit 1
#   T5  fixture: `merged_date` assente -> exit 1
#   T6  fixture: `state` non chiuso su una sessione mergiata -> exit 1
#   T7  fixture: API GitHub in errore (HTTP 500) -> exit 2 (fail-closed)
#   T8  fixture: sessione senza PR (`pr: 0`) -> exit 0 (ignorata, nessun falso positivo)
#   T9  fixture: la sessione cita una PR assente dalla risposta -> exit 2 (dato incompleto)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GATE="$SCRIPT_DIR/check-merge-state.mjs"

if ! command -v node >/dev/null 2>&1; then
  echo "[SKIP] node non disponibile: impossibile eseguire check-merge-state.mjs"
  exit 0
fi

pass=0
fail=0
ok() { echo "  [PASS] $1"; pass=$((pass + 1)); }
ng() { echo "  [FAIL] $1"; fail=$((fail + 1)); }

WORK="$(mktemp -d)"
SERVER_JS="$WORK/server.js"
PORT_FILE="$WORK/port"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

cat > "$SERVER_JS" <<'EOF'
const http = require('node:http');
const fs = require('node:fs');

const fixturePath = process.argv[2];
const portFile = process.argv[3];
const payload = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const failMode = payload && payload.__error === true;
const items = Array.isArray(payload) ? payload : [];

const server = http.createServer((req, res) => {
  if (failMode) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"message":"fixture failure"}');
    return;
  }
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!url.pathname.endsWith('/pulls')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{}');
    return;
  }
  const page = Number(url.searchParams.get('page') || '1');
  const perPage = Number(url.searchParams.get('per_page') || '100');
  const slice = items.slice((page - 1) * perPage, page * perPage);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(slice));
});

server.listen(0, '127.0.0.1', () => {
  fs.writeFileSync(portFile, String(server.address().port));
});
EOF

# Avvia il server con la fixture indicata e attende che scriva la porta.
start_server() {
  local fixture="$1"
  : > "$PORT_FILE"
  node "$SERVER_JS" "$fixture" "$PORT_FILE" &
  SERVER_PID=$!
  local i=0
  while [ ! -s "$PORT_FILE" ]; do
    i=$((i + 1))
    if [ $i -gt 100 ]; then
      echo "  [FAIL] il server di fixture non ha fatto partire"
      return 1
    fi
    sleep 0.1
  done
  PORT="$(cat "$PORT_FILE")"
}

stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
    SERVER_PID=""
  fi
}

# Crea una sessione di fixture. I parametri sono: dir, numero file, pr,
# merged, merged_commit, merged_date, state.
make_session() {
  local d="$1" num="$2" pr="$3" merged="$4" sha="$5" date="$6" state="$7"
  mkdir -p "$d/docs/state/sessions"
  {
    echo "---"
    echo "number: $num"
    echo "title: \"Fixture $num\""
    echo "date: 2026-11-01"
    echo "state: $state"
    echo "merged: $merged"
    if [ -n "$sha" ]; then echo "merged_commit: \"$sha\""; fi
    if [ -n "$date" ]; then echo "merged_date: \"$date\""; fi
    echo "branch: feat/$num-fixture"
    echo "pr: $pr"
    echo "---"
    echo ""
    echo "# Fixture $num"
  } > "$d/docs/state/sessions/$num-fixture.md"
}

SHA_A="aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbccccccc"
SHA_B="ddddddddddddddddeeeeeeeeeeeeeeeeeefffffff"
DATE_A="2026-11-01T09:58:20Z"
DATE_B="2026-11-02T10:00:00Z"

pr_merged() {
  echo "[{\"number\":$1,\"state\":\"closed\",\"merged_at\":\"$3\",\"merge_commit_sha\":\"$2\"}]"
}
pr_open() {
  echo "[{\"number\":$1,\"state\":\"open\",\"merged_at\":null,\"merge_commit_sha\":null}]"
}

run_gate() {
  GITHUB_TOKEN=fixture-token node "$GATE" --root "$1" --repo owner/repo --api "http://127.0.0.1:$PORT" 2>&1
}

echo "=== T0: repo reale - lo stato di merge delle sessioni e' in sync con GitHub ==="
out="$(node "$GATE" --root "$REPO_ROOT" 2>&1)"; ec=$?
if [ $ec -eq 0 ]; then
  ok "exit 0 (stato di merge in sync con GitHub)"
elif [ $ec -eq 2 ]; then
  echo "  [SKIP] API GitHub non raggiungibile: scenario T0 non verificabile in questa run"
else
  ng "exit $ec (atteso 0): $(echo "$out" | tail -6)"
fi

echo "=== T1: fixture coerente (PR mergiata, frontmatter allineato) ==="
D="$WORK/t1"; make_session "$D" 10 10 true "$SHA_A" "$DATE_A" "🟢"
echo "$(pr_merged 10 "$SHA_A" "$DATE_A")" > "$WORK/f1.json"
start_server "$WORK/f1.json" || exit 1
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (nessun drift)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -6)"; fi
stop_server

echo "=== T2: la PR e' mergiata ma la sessione dichiara merged: false ==="
D="$WORK/t2"; make_session "$D" 10 10 false "" "" "🟡"
echo "$(pr_merged 10 "$SHA_A" "$DATE_A")" > "$WORK/f2.json"
start_server "$WORK/f2.json" || exit 1
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (drift intercettato)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -6)"; fi
if echo "$out" | grep -q "10-fixture.md"; then ok "il messaggio nomina il file della sessione"; else ng "il messaggio non cita il file: $(echo "$out" | tail -6)"; fi
stop_server

echo "=== T3: la PR e' ancora aperta ma la sessione dichiara merged: true ==="
D="$WORK/t3"; make_session "$D" 10 10 true "$SHA_A" "$DATE_A" "🟢"
echo "$(pr_open 10)" > "$WORK/f3.json"
start_server "$WORK/f3.json" || exit 1
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (drift intercettato)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -6)"; fi
stop_server

echo "=== T4: merged_commit diverso dal merge commit reale ==="
D="$WORK/t4"; make_session "$D" 10 10 true "$SHA_B" "$DATE_A" "🟢"
echo "$(pr_merged 10 "$SHA_A" "$DATE_A")" > "$WORK/f4.json"
start_server "$WORK/f4.json" || exit 1
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (drift intercettato)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -6)"; fi
if echo "$out" | grep -q "merged_commit"; then ok "il messaggio cita il campo merged_commit"; else ng "il messaggio non cita merged_commit: $(echo "$out" | tail -6)"; fi
stop_server

echo "=== T5: merged_date assente ==="
D="$WORK/t5"; make_session "$D" 10 10 true "$SHA_A" "" "🟢"
echo "$(pr_merged 10 "$SHA_A" "$DATE_A")" > "$WORK/f5.json"
start_server "$WORK/f5.json" || exit 1
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (drift intercettato)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -6)"; fi
stop_server

echo "=== T6: la sessione e' mergiata ma lo stato del lavoro non e' chiuso ==="
D="$WORK/t6"; make_session "$D" 10 10 true "$SHA_A" "$DATE_A" "🟡"
echo "$(pr_merged 10 "$SHA_A" "$DATE_A")" > "$WORK/f6.json"
start_server "$WORK/f6.json" || exit 1
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (drift intercettato)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -6)"; fi
stop_server

echo "=== T7: API GitHub in errore -> fail-closed (exit 2) ==="
D="$WORK/t7"; make_session "$D" 10 10 true "$SHA_A" "$DATE_A" "🟢"
echo '{"__error":true}' > "$WORK/f7.json"
start_server "$WORK/f7.json" || exit 1
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 2 ]; then ok "exit 2 (errore di ambiente, distinto dal drift)"; else ng "exit $ec (atteso 2): $(echo "$out" | tail -6)"; fi
stop_server

echo "=== T8: sessione senza PR (pr: 0) -> ignorata, nessun falso positivo ==="
D="$WORK/t8"; make_session "$D" 10 0 false "" "" "🟡"
echo "$(pr_merged 10 "$SHA_A" "$DATE_A")" > "$WORK/f8.json"
start_server "$WORK/f8.json" || exit 1
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (sessione senza PR ignorata)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -6)"; fi
stop_server

echo "=== T9: la sessione cita una PR assente dalla risposta -> exit 2 ==="
D="$WORK/t9"; make_session "$D" 10 99 true "$SHA_A" "$DATE_A" "🟢"
echo "$(pr_merged 10 "$SHA_A" "$DATE_A")" > "$WORK/f9.json"
start_server "$WORK/f9.json" || exit 1
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 2 ]; then ok "exit 2 (dato esterno incompleto: fail-closed)"; else ng "exit $ec (atteso 2): $(echo "$out" | tail -6)"; fi
stop_server

echo ""
echo "=== Risultato: $pass pass, $fail fail ==="
if [ $fail -gt 0 ]; then
  echo "[FAIL] il gate NON intercetta tutti i casi di drift: non e' un gate (lesson 43-1)"
  exit 1
fi
echo "[OK] il gate intercetta tutti i casi di drift verificati"
exit 0
