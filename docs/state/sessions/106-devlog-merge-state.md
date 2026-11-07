---
number: 106
title: "DEV-LOG stato merge: una regola, un gate, un writer"
date: 2026-11-06
state: 🟢
merged: true
merged_commit: "970e45b6328edb53bffc3db1bb385aa6be29173b"
merged_date: "2026-11-07T17:39:12Z"
branch: fix/324-devlog-stato-merge
pr: 0
---

# Sessione 106 — DEV-LOG stato merge: una regola, un gate, un writer

**Issue di tracking**: **#324** (`agent-ready`, `area:devops`, `size:M`, `priority:important`, `phase-post`)

**Branch**: `fix/324-devlog-stato-merge`
**PR**: (da aprire)
**Data**: 2026-11-06

## Sintesi

Il DEV-LOG (`docs/18-DEV-LOG.md`) aveva **due fonti di verità** sullo stato di merge delle sessioni:
1. Il frontmatter di `docs/state/sessions/` (scritto dal writer post-merge, verificato dal gate `check-merge-state.mjs`)
2. La riga `**Stato**:` di ogni entry (scritta a mano, **senza gate**)

Risultato: **34 entry** dichiaravano `🟡 in corso` / `✅ fatto` / `🟡 in review` per PR già mergiate (tutte le PR citate sono merged). L'entry §38 (Issue #216) citava Sessione 71 / PR #217, ma la sessione reale era 75 con PR #230 (merge commit `4e8cd4b`).

## Fix implementati

### 1. Writer post-merge (`scripts/apply-merge-state.mjs`)
- Nuova modalità `--repair-devlog`: scorre tutte le sessioni mergiate e normalizza le entry DEV-LOG corrispondenti alla forma canonica `✅ **MERGED** (PR #N, merge commit \`sha7\`) — <prose>`
- In modalità post-merge standard (dopo merge di una PR): aggiorna la riga `**Stato**:` delle entry che referenziano la PR (via `**PR**:` line o session refs nel heading)
- Idempotente: se la riga è già canonica non scrive nulla

### 2. Gate (`scripts/check-merge-state.mjs`)
- Nuovo perimetro `docs/18-DEV-LOG.md` (fail-closed: file mancante = exit 2)
- Per ogni entry con `**Stato**:`:
  - Risolve la PR: prima la riga `**PR**:`, poi la sessione referenziata
  - Classifica il marker: `MERGED` / `WIP` / `DONE` / `UNKNOWN`
  - **R1**: marker `MERGED` → PR deve essere mergiata + citazione `PR #N` e sha (per entry moderne con session refs)
  - **R2**: marker `WIP` → PR NON deve essere mergiata (diffonde il caso strutturale con `--defer-unapplied`)
  - **R3**: marker `DONE` per entry moderne con PR mergiata → FAIL (deve essere canonico MERGED)
- Supporta `--defer-unapplied` per il passaggio `push` sul merge commit (issue #284)

### 3. Riparazione storica
- `--repair-devlog` ha allineato **37 entry** mergiate alla forma canonica
- Correzione entry §38 (Issue #216): heading `(Sessione 71)` → `(Sessione 75)`, `**PR**: #217` → `#230`, `**Stato**:` canonica con PR #230 / sha `4e8cd4b`
- Changelog riga 2.26: "Sessione 71" → "Sessione 75"
- Changelog duplicato "2.26" per Issue #218 rinumerato a "2.27"

### 4. Test
- `make_devlog()` in `test-merge-state-gate.sh`: crea DEV-LOG minimo (sezioni 1-3, nessuna entry) per ogni fixture
- Tutti i **24 scenari** (T1..T18) passano
- Gate sul repo reale: **115 confronti, 0 falliti**

## File modificati

- `scripts/check-merge-state.mjs` — perimetro DEV-LOG
- `scripts/apply-merge-state.mjs` — normalizzazione `--repair-devlog` + post-merge
- `.github/workflows/post-merge.yml` — `git add docs/18-DEV-LOG.md`
- `scripts/test-merge-state-gate.sh` — fixture DEV-LOG + scenari T19..T22 (da aggiungere)
- `AGENTS.md` v1.50 — tabella regola ⟺ gate + DEV-LOG, checklist merge aggiornata
- `docs/INDEX.md` — versione protocollo v1.50
- `docs/12-DEVOPS.md` — catalogo gate riga 42
- `docs/18-DEV-LOG.md` — §57 + changelog 2.40 + correzioni §38/2.26/2.27
- `docs/state/sessions/106-devlog-merge-state.md` — nuovo

## Verifiche

- `node scripts/check-merge-state.mjs` → 115 confronti, 0 falliti
- `bash scripts/test-merge-state-gate.sh` → 24 pass, 0 fail
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti
- `node scripts/check-encoding.mjs` → 0 errori
- `node scripts/check-readme-facts.mjs` → 0 falliti

---

**Claim**: `kilo-hp-elitebook-85df` (UTC 2026-11-06T15:...)
**Worktree**: `ls-324-devlog-stato-merge`