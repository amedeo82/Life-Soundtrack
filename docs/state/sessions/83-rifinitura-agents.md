---
number: 83
title: "AGENTS.md: il contratto senza la storia (rifinitura I3)"
date: 2026-11-01
state: 🟡
merged: false
branch: feat/259-rifinitura-agents
pr: 0
claim: kilo-hp-elitebook-4e7b
tags: [devops, governance, docs]
---

# Sessione 83 — AGENTS.md: il contratto senza la storia (rifinitura I3)

> **Issue di tracking**: #259 (lotto I3 dell'epic #248). **Branch**: `feat/259-rifinitura-agents`.

## Sintesi

`AGENTS.md` era cresciuto per addizione organica fino a **1410 righe**: procedure, rationale,
storia delle versioni e lezioni operative nello stesso file. Con la Sessione 79 era diventato un
**contratto verificato** (2 gate), ma il file non aveva cambiato forma: il gate verificava che
fosse *corretto*, non che fosse *leggibile*.

Questa sessione applica la decisione D2 (del project owner, Sessione 79): **la storia del
protocollo ha una sede** (`docs/18-DEV-LOG.md`), `AGENTS.md` resta il **contratto**.

## Cosa è cambiato

| Cosa | Prima | Dopo |
|------|-------|------|
| **Changelog delle versioni del protocollo** | 188 righe nel footer di `AGENTS.md` | sezione «Changelog del protocollo» in `docs/18-DEV-LOG.md`; in `AGENTS.md` resta **una riga** di stato |
| **§"🏎️ La CI: 12 job"** (catalogo dei 26 gate) | 84 righe, in copia di `docs/12-DEVOPS.md §9.10` | 8 righe: l'invariante operativo + il puntatore al catalogo autorevole |
| **§"Livello 1 — Automazioni GH Action"** | 40 righe, in copia della tabella dei workflow | 6 righe: il punto operativo (nessuna automazione scrive su `main` senza `git add` esplicito e sync) |
| **§"Lezione operativa D.26.4"** | rationale esteso sul bundle stale | 5 righe: la procedura canonica (`post-merge.ps1` passo 6) + la lezione in `DEV-LOG` |
| **§"Lezione operativa D.45.1"** | rationale esteso | 4 righe: idem |
| **§"⚠️ Trappola specifica: `git stash push -- <paths>`"** | 25 righe di spiegazione | 4 righe: `safe-branch-switch.ps1` + `DEV-LOG` Sessione 40 |
| **§"Difetto ricorrente: la rimozione della worktree su Windows"** | 45 righe di cronologia | 5 righe: `post-merge.ps1` passo 1 + i 14 scenari di `test-post-merge.sh` |

**Totale: 1410 → 1091 righe (−319, −23%)**.

## Vincolo rispettato

**Nessun heading è cambiato.** I 77 anchor di `AGENTS.md` sono un'API pubblica: 29 citazioni
`§"..."` in `docs/`, `.github/` e `scripts/`, più 8 script che ne dipendono. Il gate
`check-protocol-consistency.mjs` (C4) verifica che ogni riferimento risolva a un heading
esistente: **è il gate che rende sicuro questo refactor**, ed è la ragione per cui I3 è potuto
avvenire solo dopo I2-b.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-83.1 | La storia delle versioni del protocollo va in `docs/18-DEV-LOG.md` | Decisione D2 del project owner (Sessione 79): il repo aveva già tre sedi di storia (`SESSIONS.md`, `18-DEV-LOG.md`, `BUNDLE.md`); una quarta sarebbe stato un nuovo drift |
| D-83.2 | Il **catalogo dei gate** resta solo in `docs/12-DEVOPS.md §9.10` | Due copie di un catalogo divergono (è successo con la checklist PR: 22 voci per parte, 2 identiche). `AGENTS.md` deve dire **quale** regola vale e **dove** sta il dettaglio |
| D-83.3 | Il **rationale** non sparisce: cambia sede | Una regola senza il *perché* viene modificata senza criterio. Il *perché* resta nel DEV-LOG, che è il diario; il *cosa* resta nel contratto |
| D-83.4 | Le procedure restano negli **script** | Lo script è la procedura canonica: `post-merge.ps1` e `safe-branch-switch.ps1` hanno già i loro failure mode e i test che li coprono. Il markdown non è un terzo esecutore |
| D-83.5 | Nessuna sezione è stata **cancellata**, solo ridotta a puntatore | Una sezione eliminata perde il suo anchor → i 29 riferimenti esterni si romperebbero. Il gate C4 lo segnalerebbe, ma il costo di una rottura è maggiore del beneficio di una riga risparmiata |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **75%** (21 story su 28, effort 77%), restano **7 step**.
Lavoro di **governance** su un'epic (#248).

**Il numero che conta.** `AGENTS.md` scende da 1410 a **1091 righe** e — soprattutto — non contiene
più **storia**: ogni sezione è o una **regola** (con il gate che la enforce) o un **puntatore** a
un file che è il proprietario del dettaglio. Il file è tornato a essere un contratto.

**Cosa è pronto.** Changelog del protocollo spostato nel DEV-LOG; 5 sezioni di rationale ridotte a
puntatori; 2 sezioni in duplicato ridotte al minimo; i 77 anchor **invariati**.

**Cosa manca.** Nulla dell'epic #248: con questo lotto i quattro lotti (I1, I2-a, I2-b, I2-c) e
questo (I3) sono completi. Il lavoro residuo è la **doc-sync di chiusura** delle sessioni (la
catena post-merge la fa, e la Sessione 82 l'ha resa advisory).

**Salute tecnica.** Worktree attiva su `feat/259-rifinitura-agents`. Claim riverificato sull'issue
#259. Nessun blocco `AGGREGATE-*` modificato a mano. `pwsh` 7.6.9.

**Gate di testabilità.** `node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti (**C4:
gli 77 anchor sono intatti e tutte le citazioni esterne risolvono**) · `node
scripts/check-aggregate-blocks.mjs` → 0 violazioni · `node scripts/check-merge-state.mjs` → 0
falliti · `node scripts/check-readme-facts.mjs` → 0 falliti · `pwsh
scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Il gate C4 (integrità degli anchor) è ciò che ha reso **sicuro** spostare 300 righe di un file con 77 anchor referenziati da 29 citazioni e 8 script | L'ordine dei lotti non è stato un capriccio: **prima il gate, poi il refactor**. Un gate che verifica l'integrità delle strutture referenziate è ciò che trasforma un refactor da «rischioso» a «misurabile» |
| La riduzione più grande non è stata la **cancellazione** ma la **de-duplicazione**: due sezioni (CI e automazioni) erano copie di `docs/12-DEVOPS.md §9.10`, che il validatore considera il catalogo autorevole | Due copie di un catalogo divergono: è già successo con la checklist PR (22 voci per parte, 2 identiche). «Eliminare la duplicazione» vale più di «accorciare il file» |
| Il *perché* di una regola non sparisce quando si accorcia la sezione: **cambia sede** | Un contratto senza rationale viene modificato senza criterio; un diario senza contratto non dice nulla. I due documenti hanno compiti diversi, e tenere entrambi in un file solo li faceva degradare insieme |

## Documenti aggiornati

- `AGENTS.md` v1.37 → **v1.38**: 1410 → 1091 righe, 77 anchor invariati
- `docs/18-DEV-LOG.md`: sezione «Changelog del protocollo (`AGENTS.md`)» (la storia delle versioni) + §49
- `scripts/generate-bundle.ps1`: `$files` += la sessione 83
- `docs/INDEX.md`: versione di `AGENTS.md`, riga `18-DEV-LOG.md`
