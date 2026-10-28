---
number: 60
title: "Il blocco NEXT-STEP indica solo story lavorabili (issue #182)"
date: 2026-10-28
state: 🟡
merged: false
merged_commit: ""
merged_date: ""
branch: feat/182-next-step-skip-blocked
pr: 0
claim: kilo-hp-elitebook-41xb
cross_refs: [182, 179, 180]
tags: [devops, docs, phase-1]
---

# Sessione 60 — Il NEXT-STEP non deve indicare una story bloccata (issue #182)

## Sintesi

Il blocco `<!-- AGGREGATE-NEXT-STEP-* -->` del README indica **la prossima story da
implementare**: con la Story 2.1 appena ratificata (Sessione 59) e **bloccata**
dalle audio features dell'EPIC 4.1 (decisione D-A.1), il puntatore era finito su
di lei — un vicolo cieco — mentre la story implementabile era la **2.4**
(Memory Engine, issue #179).

La correzione è in `scripts/aggregate-state.ps1`: il filtro esclude ora anche
`blocked` (STOP) e `wontdo` (NO), oltre a `done` (già escluso). Restano elencate
`todo`, `in_progress` e `in_review`: sono **in lavorazione**, non bloccate, e il
blocco ricorda comunque come filtrare le candidate libere.

## Trigger

Issue **#182** (`agent-ready`, `size:S`, `area:devops`), aperta nella Sessione 59
dopo la ratifica della spec dell'analisi: la ratifica aveva creato la prima story
`blocked` del progetto (la 2.1), e la conseguenza immediata era il puntatore
sbagliato nel README.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.60.1 | Il filtro esclude `done`, `blocked` e `wontdo` | Sono le tre condizioni in cui la story **non** è "da implementare": completata, bloccata da una dipendenza esterna, scope cancellato. Il blocco deve indicare ciò che è **lavorabile** |
| D.60.2 | `in_progress` e `in_review` restano elencate | Sono *in lavorazione*, non bloccate: escluderle nasconderebbe il lavoro attivo. Il blocco dice comunque come filtrare le candidate libere (`gh issue list --label agent-ready --state open`) |
| D.60.3 | Il messaggio di fallback e la riga delle altre candidate dicono "non-done **e non bloccate**" | Il testo del blocco è la **prosa** del gate: se dice "non-done" e la lista esclude le bloccate, il testo mente. Il gate del README (D.161.1) vale per la prosa, non solo per i fatti |
| D.60.4 | Il fix **non** committa i blocchi aggregati | ADR-0008: i blocchi sono scritti solo dall'aggregator. La PR tocca `scripts/aggregate-state.ps1` → il trigger di `auto-state-aggregate` scatta post-merge e rigenera il blocco NEXT-STEP. Il gate CI `-Check` è warning-only per il residuo #63 |
| D.60.5 | Due sub-test nuovi (T10e, T10f) che **falliscono senza il fix** | Un gate che passa sempre non è un gate (lesson 43-1): il test è stato verificato in entrambe le direzioni (senza il fix: 4 assert falliti, exit 1; con il fix: 37/37) |

## Difetti trovati lungo il percorso

**Il blocco NEXT-STEP era una sorgente di verità parziale**: la regola "prima
story non completata" era documentata in tre posti (`AGENTS.md`, `docs/12-DEVOPS.md`
e il commento dello script) e nessuno dei tre ammetteva che una story potesse
essere `blocked`: il valore esisteva già nella macchina a stati
(`11-BACKLOG.md` §"Stato di una Story", 🛑) e **non** era mai comparso in un
file di stato. Il primo file `state/stories/*.md` con `status: blocked` (la 2.1,
Sessione 59) ha reso il disallineamento visibile.

**I valori `status` non erano documentati nello schema**: `docs/state/_index.md`
§"Schema frontmatter" dichiarava `status: done # 🟡/⬚/👀/✅/❌/🛑` — la lista
degli **emoji** senza i **valori** (`todo` / `in_progress` / `in_review` / `done` /
`blocked` / `wontdo`), che sono ciò che l'aggregator confronta. Ora i valori sono
espliciti.

## Verifica

- `bash scripts/test-aggregate-determinism.sh` → **37 assert, 0 falliti** (era 34:
  +3 dai sub-test T10e/T10f)
- Contro-prova: senza il fix gli stessi test danno **4 falliti, exit 1**
- `pwsh scripts/aggregate-state.ps1` (in locale) → il blocco NEXT-STEP passa da
  **2.1** a **2.4** ✓
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `node scripts/check-readme-facts.mjs` → exit 0

## Lesson learned

| # | Osservazione |
|---|----------------|
| 60-1 | **Un blocco generato che indica "cosa fare dopo" è un gate di lavoro, non un semplice riepilogo.** Il NEXT-STEP non elenca la cronologia: indica **la prossima cosa da fare**. Bastava una story `blocked` in cima alla lista per trasformarlo in un vicolo cieco — e nessuno dei gate lo segnalava, perché il gate confrontava il blocco con il calcolo, non il calcolo con la **realtà** |
| 60-2 | **Una macchina a stati che nessuno usa produce bug di stato.** `blocked` e `wontdo` esistevano nello stato delle issue (`11-BACKLOG.md`, ADR-0007) e nei label GitHub, ma **mai** in un `docs/state/stories/*.md`: il primo file che li usa ha fatto emergere che il filtro dell'aggregator ne era ignaro. Le nuove regole vanno scoperte dai dati, non dai documenti |
| 60-3 | **La prosa di un blocco generato è soggetta allo stesso gate dei fatti.** Il messaggio diceva "non-done" mentre la lista escludeva le bloccate: un gate che confronta i numeri ma non le frasi lascia passare una contraddizione. La regola: se il **conteggio** cambia, la **frase** che lo descrive cambia con lui (lesson 58-4, la stessa forma sotto un altro nome) |
| 60-4 | **Il fix di uno script di governance non si committa da solo**: la PR tocca `scripts/aggregate-state.ps1`, il trigger di `auto-state-aggregate` scatta post-merge e rigenera il blocco. Committare il blocco a mano nella PR avrebbe violato ADR-0008 e creato un conflitto con il bot |

## Documenti aggiornati

- `scripts/aggregate-state.ps1` — `Build-Block-NextStep`: il filtro esclude
  `blocked` e `wontdo`; il messaggio di fallback e la riga delle altre candidate
  dicono "non-done e non bloccate"; il commento di intestazione documenta la
  regola
- `scripts/test-aggregate-determinism.sh` — **T10e** (salta la story bloccata e
  sceglie la prima lavorabile; la bloccata non compare fra le altre candidate) e
  **T10f** (con sole story bloccate il fallback è esplicito); il grep di T10c
  aggiornato al nuovo messaggio
- `AGENTS.md` — v1.27 → **v1.28**: la regola del blocco NEXT-STEP nella sezione
  "Ownership del `README.md`" + il footer cumulativo
- `docs/state/_index.md` — i **valori** `status` nello schema frontmatter
- `docs/12-DEVOPS.md` — **§9.8g** (nuova): la tabella degli stati e chi finisce
  nel NEXT-STEP
- `docs/18-DEV-LOG.md` — §26 (nuova) + changelog 2.8
- `docs/11-BACKLOG.md` — la lista di priorità degli agenti (la prossima
  candidate è la 2.4) + changelog 1.6.19
- `docs/INDEX.md` — "Prossimo step tecnico"
- `docs/state/sessions/60-next-step-skip-blocked.md` — **nuovo**
- `docs/state/_index.md` — riga della Sessione 60
- `scripts/generate-bundle.ps1` + `docs/BUNDLE.md` — la sessione 60

## Cross-refs

- **#182** — il blocco NEXT-STEP non deve indicare una story bloccata (claim
  `kilo-hp-elitebook-41xb`)
- **#179** — la Story 2.4, la candidate che il blocco indica **dopo** il fix
- **#180** — la Story 2.1, la story bloccata che il blocco indicava **prima**
- **#178** — la ratifica della spec dell'analisi (Sessione 59), che ha creato la
  prima story `blocked` del progetto
