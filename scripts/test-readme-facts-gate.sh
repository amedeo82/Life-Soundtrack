#!/usr/bin/env bash
# Test di regressione per il gate "fatti del README" (issue #161).
#
# Difende il difetto chiuso in issue #161: `README.md` dichiarava come presenti
# funzionalita' e piattaforme che non esistono (8 piattaforme invece di 5,
# audio features ed analisi non implementate), e i merge delle Story 1.2 e 1.3
# non l'hanno toccato: nessun gate confrontava la prosa del README con il
# codice, quindi il drift era silenzioso e la pipeline restava verde.
#
# Il gate vive in scripts/check-readme-facts.mjs (bloccante in CI dal #161);
# questo file e' il suo test di regressione: verifica che il gate **esca 1**
# quando si reintroduce il drift. Un gate che passa sempre non e' un gate
# (lesson 43-1).
#
# Scenari coperti:
#   T1  repo reale: la prosa e' in sync con il codice -> exit 0
#   T2  fixture: il README elenca una piattaforma senza adapter (`deezer`)
#       -> exit 1, il messaggio nomina `deezer`
#   T3  fixture: il README non elenca una piattaforma implementata (`lastfm`)
#       -> exit 1, il messaggio nomina `lastfm`
#   T4  fixture: la UI espone una piattaforma senza factory adapter
#       -> exit 1
#   T5  fixture: la factory punta a una classe che non esiste nel codice
#       -> exit 1
#   T6  fixture: capability non implementata (valence) dichiarata in "Cosa c'e
#       oggi" -> exit 1
#   T7  fixture: la stessa capability nella sezione roadmap -> exit 0
#       (la roadmap e' il posto legittimo per i claim futuri: nessun falso
#       positivo)
#   T8  fixture: conteggio duplicato in prosa (7/7) dentro "Stato del progetto"
#       -> exit 1
#   T9  fixture: manca il file README -> exit 2 (errore di ambiente, non drift)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GATE="$SCRIPT_DIR/check-readme-facts.mjs"

if ! command -v node >/dev/null 2>&1; then
  echo "[SKIP] node non disponibile: impossibile eseguire check-readme-facts.mjs"
  exit 0
fi

pass=0
fail=0
ok() { echo "  [PASS] $1"; pass=$((pass + 1)); }
ng() { echo "  [FAIL] $1"; fail=$((fail + 1)); }

# Fixture minimale: un router con due piattaforme, due adapter nel codice e un
# README con le tre sezioni canoniche.
make_fixture() {
  local d="$1"
  mkdir -p "$d/apps/web/src/onboarding" "$d/packages/core/src/adapters/demo" \
           "$d/packages/core/src/adapters/other"
  cat > "$d/apps/web/src/onboarding/OnboardingRouter.tsx" <<'EOF'
const ADAPTER_FACTORIES: Partial<Record<PlatformId, () => PlatformAdapter>> = {
  demo: () => new DemoAdapter(),
  other: () => new OtherAdapter(),
};

const ACTIVE_PLATFORMS: PlatformId[] = [
  'demo',
  'other',
];
EOF
  cat > "$d/packages/core/src/adapters/demo/index.ts" <<'EOF'
export class DemoAdapter {}
EOF
  cat > "$d/packages/core/src/adapters/other/index.ts" <<'EOF'
export class OtherAdapter {}
EOF
  cat > "$d/README.md" <<'EOF'
# Fixture

## ✨ Cosa c'è oggi

- Importa la cronologia di ascolto dai servizi supportati

### Piattaforme importabili

- `demo` — Demo
- `other` — Other

## 🗺️ Roadmap

- **Analisi** (EPIC 2): mood, ricordi

## 🏗️ Stato del progetto

Lo stato globale vive nei blocchi aggregati di `docs/INDEX.md`.
EOF
}

run_gate() {
  node "$GATE" --root "$1" 2>&1
}

echo "=== T1: repo reale - la prosa del README e' in sync con il codice ==="
out="$(run_gate "$REPO_ROOT")"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (README in sync con il codice)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -8)"; fi

echo "=== T2: il README elenca una piattaforma senza adapter ==="
D="$(mktemp -d)"; make_fixture "$D"
# La riga va DENTRO la sottosezione "Piattaforme importabili": appenderla in
# fondo al file la metterebbe nella sezione "Licenza", fuori dal perimetro che
# il gate legge (la prova deve fallire per il motivo giusto).
sed -i 's|^- `other` — Other$|- `other` — Other\n- `deezer` — Deezer|' "$D/README.md"
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (drift intercettato)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -8)"; fi
if echo "$out" | grep -q "deezer"; then ok "il messaggio nomina la piattaforma inesistente (deezer)"; else ng "il messaggio non cita 'deezer': $(echo "$out" | tail -8)"; fi
rm -rf "$D"

echo "=== T3: il README non elenca una piattaforma implementata ==="
D="$(mktemp -d)"; make_fixture "$D"
sed -i '/- `other` — Other/d' "$D/README.md"
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (drift intercettato)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -8)"; fi
if echo "$out" | grep -q "other"; then ok "il messaggio nomina la piattaforma mancante (other)"; else ng "il messaggio non cita 'other': $(echo "$out" | tail -8)"; fi
rm -rf "$D"

echo "=== T4: la UI espone una piattaforma senza factory adapter ==="
D="$(mktemp -d)"; make_fixture "$D"
sed -i "s/  'other',/  'other',\n  'ghost',/" "$D/apps/web/src/onboarding/OnboardingRouter.tsx"
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (piattaforma attiva senza factory)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -8)"; fi
rm -rf "$D"

echo "=== T5: la factory punta a una classe inesistente nel codice ==="
D="$(mktemp -d)"; make_fixture "$D"
sed -i "s/new OtherAdapter()/new MissingAdapter()/" "$D/apps/web/src/onboarding/OnboardingRouter.tsx"
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (classe adapter inesistente)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -8)"; fi
if echo "$out" | grep -q "MissingAdapter"; then ok "il messaggio nomina la classe mancante (MissingAdapter)"; else ng "il messaggio non cita 'MissingAdapter': $(echo "$out" | tail -8)"; fi
rm -rf "$D"

echo "=== T6: capability non implementata dichiarata in 'Cosa c'e oggi' ==="
D="$(mktemp -d)"; make_fixture "$D"
sed -i "s/- Importa la cronologia di ascolto dai servizi supportati/- Importa la cronologia e arricchisce con valence e danceability/" "$D/README.md"
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (capability non implementata dichiarata)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -8)"; fi
rm -rf "$D"

echo "=== T7: la stessa capability nella sezione roadmap e' legittima ==="
D="$(mktemp -d)"; make_fixture "$D"
sed -i "s/- \*\*Analisi\*\* (EPIC 2): mood, ricordi/- **Analisi** (EPIC 2): mood, ricordi, valence/" "$D/README.md"
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 0 ]; then ok "exit 0 (nessun falso positivo sulla roadmap)"; else ng "exit $ec (atteso 0): $(echo "$out" | tail -8)"; fi
rm -rf "$D"

echo "=== T8: conteggio duplicato in prosa dentro 'Stato del progetto' ==="
D="$(mktemp -d)"; make_fixture "$D"
sed -i "s|Lo stato globale vive nei blocchi aggregati di \`docs/INDEX.md\`.|EPIC 0 e' completo 7/7.|" "$D/README.md"
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 1 ]; then ok "exit 1 (conteggio duplicato in prosa)"; else ng "exit $ec (atteso 1): $(echo "$out" | tail -8)"; fi
rm -rf "$D"

echo "=== T9: README mancante -> errore di ambiente (exit 2) ==="
D="$(mktemp -d)"; make_fixture "$D"
rm -f "$D/README.md"
out="$(run_gate "$D")"; ec=$?
if [ $ec -eq 2 ]; then ok "exit 2 (errore di ambiente, distinto dal drift)"; else ng "exit $ec (atteso 2): $(echo "$out" | tail -8)"; fi
rm -rf "$D"

echo ""
echo "=== Risultato: $pass pass, $fail fail ==="
if [ $fail -gt 0 ]; then
  echo "[FAIL] il gate NON intercetta tutti i casi di drift: non e' un gate (lesson 43-1)"
  exit 1
fi
echo "[OK] il gate intercetta tutti i casi di drift verificati"
exit 0
