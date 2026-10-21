---
number: 38
title: "Allineare la documentazione di stato legacy e rendere il doc-sync obbligatorio per gli agenti"
date: 2026-10-21
state: 🟢
merged: true
merged_commit: a778add
merged_date: 2026-10-21T11:00:00+02:00
branch: feat/90-docs-allineare-la-documentazione-di-stat
pr: 91
claim: kilo-hp-elitebook-36a7
cross_refs: [84, 90]
tags: [docs, state, adr-0008, housekeeping]
---

# Sessione 38 — Allineamento della documentazione di stato legacy

## Sintesi

Chiusura del gap che S37 (issue #84) aveva dichiarato aperto: la tabella "Stato di avanzamento" di `docs/11-BACKLOG.md` e la sezione "Dettaglio (legacy)" di `docs/INDEX.md` dichiaravano fatti falsi (0.4/0.6/0.7 `⬚ TODO` mesi dopo il merge; "Prossimo step tecnico" che puntava a issue #19 e #23, entrambe chiuse). Oltre all'allineamento, la sessione **rimuove la causa strutturale**: la regola "NON modificare i file globali" era applicata all'intero file, vietando anche la correzione delle sezioni legacy che nessun generatore aggiorna. La nuova sottosezione di `AGENTS.md` distingue i due casi e rende l'allineamento delle sezioni legacy un obbligo di PR.

## Trigger

Il project owner ha chiesto un riepilogo delle piattaforme supportate e poi "che cosa occorre fare adesso" per procedere con lo sviluppo. La lettura della documentazione ha rivelato che le fonti di stato consultabili (`INDEX.md`, `11-BACKLOG.md`) non riflettevano `main`: la Fase 0 risultava a 5/7 mentre le 7 story erano merged.

## Drift trovato e corretto

| Elemento | Prima | Dopo | Fonte di verità |
|---|---|---|---|
| `11-BACKLOG.md` tabella di stato | 0.4, 0.6, 0.7 `⬚ TODO`; 0.1-0.3, 0.5 con note obsolete | rimossa: la tabella elenca **solo** la roadmap EPIC 1-6 | blocco `AGGREGATE-STORIES-*` |
| `11-BACKLOG.md` righe `**Stato**:` | presenti solo su 0.1, 0.2, 0.5 | presenti su tutte e 7 le story con PR + merge commit | `docs/state/stories/` |
| `INDEX.md` "Dettaglio (legacy)" | "5/7 story completate", conteggi documenti errati, "Prossimo step tecnico" del 2026-10-18 con issue chiuse | 7/7, conteggi ricalcolati (7 APPROVED + 7 ADR, 11 DRAFT), prossimo step = EPIC 1 con prerequisito di specifica | `git log main` + `gh pr list` |
| `INDEX.md` tabelle documenti | `11` a v1.2.5, `13-ADR` a 0001-0007, `AGENTS.md` a v1.6, `16-OPERATIONS.md` assente | allineate; `16-OPERATIONS.md` aggiunto; `docs/state/` aggiunto ai documenti di supporto | header dei file |
| `AGENTS.md` | v1.13 (header fermo a S36 mentre il footer era a v1.15) | v1.16 | — |

## Modifiche

1. `docs/11-BACKLOG.md` — tabella "Stato di avanzamento" → "roadmap delle story non ancora completate" (EPIC 1-6), con intestazione che dichiara la fonte di verità e la regola per gli agenti; righe `**Stato**:` su 0.3, 0.4, 0.6, 0.7 e sistemata quella di 0.5; changelog v1.6.0
2. `docs/INDEX.md` — sezione "Dettaglio (legacy)" riscritta con nota di ownership; conteggi APPROVED/DRAFT ricalcolati; "Implementazione" 7/7; "Prossimo step tecnico" aggiornato a EPIC 1; tabelle documenti allineate + `16-OPERATIONS.md` e `docs/state/`
3. `AGENTS.md` **v1.16** — nuova sottosezione §"Chi può scrivere cosa nei file globali" (D.38.1); tre voci di checklist riformulate da "file" a "blocchi `AGGREGATE-*`" + nuova voce sull'allineamento delle sezioni legacy; tabella di sincronizzazione al merge riscritta; §"🚀 Primo task" con ordine worktree→claim
4. `.github/pull_request_template.md` — stessa regola nella sezione "Documentazione di stato" + voce sul worktree/claim
5. `docs/state/sessions/38-doc-sync-legacy.md` (**nuovo**) — questa entry
6. `docs/BUNDLE.md` — rigenerato

## Decisioni (D.38.x)

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.38.1 | Distinguere **blocchi aggregati** e **sezioni legacy** nei file globali, con due regole diverse | la proibizione assoluta lasciava le sezioni legacy invecchiare in silenzio; nessun gate le copre, perché non hanno generatore |
| D.38.2 | La tabella di stato del backlog elenca **solo le story non completate** | duplicare in una sezione legacy ciò che il blocco aggregato già fornisce crea una seconda fonte di verità che invecchia — è la causa diretta del drift |
| D.38.3 | Allineare le righe `**Stato**:` delle sezioni Story | convenzione già presente su 0.1/0.2/0.5: le story senza riga erano indistinguibili da quelle non implementate |
| D.38.4 | Correggere anche l'ordine worktree→claim in `AGENTS.md` | `setup-worktree.ps1` rifiuta un'issue con `in-progress`: la procedura documentata era ineffettuabile senza aggirare la validazione (lesson 37-6) |
| D.38.5 | Sessione dichiarata `🟡` con `pr: 0` | schema dello stato: `🟡` = merge pendente; `pr:` compilato dopo `gh pr create` (stesso criterio di D.37.4) |
| D.38.6 | I blocchi aggregati vengono **rigenerati dal generatore nella stessa PR** (non a mano), invece di lasciarli stale fino al workflow post-merge | `aggregate-state.ps1` riscrive solo le regioni tra marker: le modifiche alle sezioni legacy sono intatte. Così la checklist "exit 0" vale davvero e il reviewer legge documenti coerenti. Se in futuro il parallelismo lo rendesse sconsigliato, basta omettere la write: il GH Action `auto-state-aggregate` colma il drift al merge |

## Gap chiusi

- ~~Tabella legacy "Stato di avanzamento" con story stale~~ (aperto in S37, D.37.2)
- ~~Nessun modo per gli agenti di correggere le sezioni legacy~~ (la regola li vietava esplicitamente)

## Gap ancora aperti

- **Nessun gate intercetta il drift semantico**: `aggregate-state --check` confronta l'agregatore con i suoi sorgenti, non i sorgenti con GitHub. L'audit `docs/state/` vs `gh pr list` resta manuale (proposto in S37, non risolto)
- **Inventario `$files` incompleto**: `0.3`, `0.5`, `0.6` e le sessioni non sono nel bundle pur essendo sorgenti atomiche (D.37.3)
- **Story 0.1 e 0.2** non hanno ancora un `docs/state/stories/*.md` (migration incrementale)

## Verifica

- `scripts/aggregate-state.ps1` → applicati 5 blocchi, poi `--check` → **exit 0** (tutti `[OK]`)
- `scripts/generate-bundle.ps1` → rigenerato (58 file), poi `--check` → **exit 0**
- Nessun file applicativo (`.ts`/`.tsx`) toccato e `scripts/generate-bundle.ps1` è PowerShell (non coperto da ESLint): `lint`/`typecheck`/`test`/`build` non sono impattati
- `bash scripts/test-aggregate-determinism.sh` non eseguito in locale: `bash` non disponibile su questa macchina (stesso limite di S37); il gate è bloccante in CI e gira su ogni PR
- Marker aggregati: verificato che nessun file contenga marker duplicati (un riferimento in prosa a `AGGREGATE-STORIES-START` faceva fallire il check perche il matching usa il primo match — lesson 38-5)

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 38-1 | Una regola assoluta ("non toccare questo file") applicata senza eccezioni trasforma gli strumenti di auto-correzione in un divieto: l'agente non può nemmeno correggere un fatto obsoleto | ✅ risolto: due regole distinte per contenuto aggregato e legacy |
| 38-2 | Il drift più pericoloso è quello che un gate verde non intercetta | ⚠️ resta manuale: da qui l'obbligo di allineamento in PR |
| 38-3 | `setup-worktree.ps1` e `AGENTS.md` §"Primo task" imponevano ordini opposti (prima claim, poi worktree) | ✅ documentato l'ordine reale (worktree → claim) |
| 38-4 | Istruire un agente "non modificare i file globali" senza dire *cosa* può modificare produce PR che dichiarano fatti falsi con il massimo delle buone maniere | ✅ checklist e template ora dicono esattamente quali sezioni toccare |
| 38-5 | Scrivere un marker aggregato completo (`<!-- AGGREGATE-X-START -->`) in una prosa **rompe il check**: il matching usa il primo match e finisce per misurare dal punto sbagliato (`Trovato: 7137 chars`) | ✅ in prosa si cita `AGGREGATE-X-*`, mai il marker per esteso |
| 38-6 | La keyword di chiusura `Closes #90` era dentro una **casella di checklist** del body PR: GitHub non la riconosce, l'issue #90 è rimasta `OPEN` dopo il merge `a778add` nonostante la checklist fosse spuntata | ✅ chiusa a mano con l'audit retroattivo (ADR-0007); requisito reso esplicito in `AGENTS.md` + template (issue #92) |
| 38-7 | La regex di `auto-status-done` matchava la keyword **ovunque nel body**: la PR #93 che *citava* `Closes #90` nella descrizione ha transizionato anche #90 (`status:done` + commento `release:` spurio, poi rimosso) | ✅ regex ancorata alla riga (issue #94): transiziona solo una riga che è esattamente la keyword + numero; per citarla si scrive `` `Closes` #N `` |

## Cross-refs

- **#90** — issue di questo lavoro (chiusa dalla PR, dopo audit retroattivo: la keyword era dentro la checklist)
- **#92** — resa esplicita la keyword di chiusura (lesson 38-6)
- **#84 / #85** — S37: riconciliazione di `docs/state/`; il gap chiuso qui è il primo dei "Gap aperti" di quella sessione