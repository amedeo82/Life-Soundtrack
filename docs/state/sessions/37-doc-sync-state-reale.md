---
number: 37
title: "Reconciliare docs/state/ con i merge reali (Story 0.4 assente, 0.7 stale, sessioni 27-36 pending)"
date: 2026-10-20
state: 🟢
merged: true
merged_commit: 077981e
merged_date: 2026-10-20T18:16:45+02:00
branch: docs/84-doc-sync-state-reale
pr: 85
claim: kilo-HP-ELITEBOOK-52q4
cross_refs: [40, 43, 64, 71, 84]
tags: [docs, state, adr-0008, housekeeping]
---

# Sessione 37 — Doc-sync dello stato reale

## Sintesi

Sessione di sola documentazione. `docs/state/` non rifletteva la realtà dei merge: i gate `aggregate-state.ps1 --check` e `generate-bundle.ps1 --check` erano verdi (exit 0) perché l'agregatore è coerente con i suoi sorgenti, ma i sorgenti stessi erano sbagliati. Il drift è quindi **semantico**, non tecnico: non lo intercetta nessun gate automatico, serve l'auditing umano (o di un agente) contro GitHub.

## Trigger

Il project owner ha chiesto "qual è lo step da completare per procedere con lo sviluppo?". La lettura della documentazione (`README.md`, `docs/INDEX.md`, `docs/11-BACKLOG.md`) suggeriva Story 0.4 come prossima story da implementare. Il confronto con GitHub e con il codebase ha smentito la documentazione.

## Drift trovato

Confronto `docs/state/` contro GitHub e contro il filesystem, su `main` = `23d32c9`:

| Elemento | In `docs/state/` | Realtà verificata |
|---|---|---|
| Story 0.4 (UI import) | **assente** | merged PR #71 `0a8e83f` (2026-10-20T10:34:53Z) |
| Story 0.7 (Operations runbook) | `status: in-progress`, `pr: 39` | merged PR #64 `b44420b` (2026-10-20T12:38:56Z) |
| Sessioni 27-36 | `state: 🟡`, `pr: 0` | tutte merged: PR #54, #55, #56, #59, #62, #63, #69, #72, #74, #77 |
| Issue aperte su GitHub | — | **zero** (tutte chiuse, incluse #40 con `status:done`) |

Il codice di Story 0.4 esiste ed è completo: `apps/web/src/onboarding/` con `OnboardingRouter.tsx`, `PlatformCard.tsx` (5 stati), `DropZone.tsx`, `PrivacySettings.ts` (4 toggle) e 3 file di test.

Cause identificate:

1. **PR #71 non ha creato il suo state file.** La regola di ADR-0008 impone che una PR di implementazione crei/aggiorni `docs/state/stories/<id>-<slug>.md`; senza quel file l'agregatore non ha nulla da elencare. L'aggregatore è coerente, semplicemente non sa della story.
2. **`pr:` ambiguo in Story 0.7.** Il campo conteneva `39`, che è il numero dell'**issue** (`Story 0.7 — issue #39`), non della PR (#64). Lo stato non era stato aggiornato a valle del merge, quindi la story restava `in-progress` a mesi di distanza dal merge di fatto.
3. **Sessioni 27-36 mai chiuse.** Tutte create con `pr: 0` e `state: 🟡` (merge pendente) e mai aggiornate dopo il merge. Le sessioni 22-24, che hanno avuto il doc-sync completo, sono 🟢.

## Modifiche

1. `docs/state/stories/0.4-ui-import.md` (**nuovo**) — `status: done`, `pr: 71`, `merged_commit` e `merged_date` reali, task/AC/test dalla PR #71
2. `docs/state/stories/0.7-operations-runbook.md` — frontmatter `status: done`, `pr: 64` (era `in-progress`/`39`), `merged_commit`, `merged_date`, `size`, `spec_refs`; aggiunta sezione "Stato attuale"
3. `docs/state/sessions/27..36` — `state: 🟡 → 🟢` e `pr: 0 → <N>` con i 10 numeri di PR verificati via `gh pr list --state merged --head <branch>`
4. `docs/state/_index.md` — tabella di migration allineata (0.4 aggiunta; 0.1/0.2 restano legacy)
5. `docs/state/sessions/37-doc-sync-state-reale.md` (**nuovo**) — questa entry
6. `scripts/generate-bundle.ps1` — `$files` += `docs/state/stories/0.4-ui-import.md`

## Decisioni (D.37.x)

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.37.1 | Riconciliare lo stato **da GitHub**, non dai documenti | `gh pr list --state merged --head <branch>` è l'autorità: il branch è la chiave che collega sessione/storia alla PR, ed è univoco |
| D.37.2 | Non modificare la tabella legacy "Stato di avanzamento" di `11-BACKLOG.md` | è fuori dai marcatori `AGGREGATE-*`, quindi non è nel perimetro dell'agregatore; la regola ADR-0008 vieta alle PR di toccare i file globali. Dichiarata come gap aperto |
| D.37.3 | Aggiungere a `$files` solo `0.4-ui-import.md` | la checklist impone di registrare i **propri** file nuovi; allargare l'inventore a 0.3/0.5/0.6 e alle 13 sessioni è una decisione separata (impatto sulla dimensione del bundle) |
| D.37.4 | Sessione 37 dichiarata `🟡` con `pr: 0` | lo schema dice `🟡 = merge pendente`: al momento della scrittura la PR non esiste ancora. Il `pr:` viene riempito con un commit successivo, dopo `gh pr create` |

## Gap aperti (non risolti qui)

- **Tabella legacy "Stato di avanzamento"** in `docs/11-BACKLOG.md`: dichiara ancora 0.4 `⬚ TODO` e 0.6 `⬚ TODO`, entrambe in realtà `done`. È fuori dal perimetro dell'aggregatore: allinearla richiede o un'estensione dell'aggregator, o un'eccezione esplicita alla regola ADR-0008.
- **Inventario `$files` incompleto**: `0.3`, `0.5`, `0.6` e tutte le sessioni sono fuori dal bundle pur essendo sorgenti atomiche. Il bundle da solo è quindi un handoff incompleto (vedi D.37.3).
- **Nessun gate intercetta questo drift**: `aggregate-state --check` verifica coerenza aggregator↔sorgenti, non correttezza dei sorgenti rispetto alla realtà. Un audit periodico `docs/state/` vs `gh pr list` è l'unica difesa.

## Verifica

- `scripts/aggregate-state.ps1 --check` → exit 0
- `scripts/generate-bundle.ps1 --check` → exit 0
- `bash scripts/test-aggregate-determinism.sh` → **non eseguito in locale**: `bash` non è disponibile su questa macchina (stub WSL senza distribuzione). Il gate è comunque bloccante in CI e gira su ogni PR
- Nessun file applicativo (`.ts`/`.tsx`) toccato: `lint`/`typecheck`/`test`/`build` non sono impattati

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 37-1 | Un gate verde non implica uno stato corretto: `aggregate-state --check` confronta l'agregatore con i suoi sorgenti, non i sorgenti con GitHub | ✅ il drift è emerso solo confrontando `gh pr list` con i frontmatter |
| 37-2 | `pr:` senza contratto esplicito si riempie col numero dell'issue invece che della PR | ✅ D.37.1: `gh pr list --head <branch>` come unica fonte |
| 37-3 | Il campo `state:` di una sessione va aggiornato al merge, non all'apertura della PR | ✅ le 10 sessioni erano tutte `🟡` post-merge |
| 37-4 | `[char]0x1F7E1` in PowerShell 5.1 fallisce: i codepoint > 0xFFFF sono surrogate pair | ✅ usato `[System.Text.Encoding]::UTF8.GetString(byte[])` |
| 37-5 | Scrivere con `Set-Content -Encoding UTF8` in PS 5.1 aggiunge il BOM e può introdurre CRLF, violando `.gitattributes` (`eol=lf`) | ✅ usato `[System.IO.File]::WriteAllText` con `UTF8Encoding($false)`, verificato 0 CRLF e assenza di BOM |
| 37-6 | `setup-worktree.ps1` valida che l'issue non abbia `in-progress`, quindi impone worktree→claim, mentre `AGENTS.md` §"Primo task" li mette nell'ordine opposto | ⚠️ incoerenza documentale non risolta qui; risolta con `-SkipGhCheck` + claim già validato a mano |

## Cross-refs

- **#84** — issue di questo lavoro (chiusa dalla PR)
- **#71 / #40** — PR e issue di Story 0.4, la story mancante
- **#64 / #39** — PR e issue di Story 0.7, lo stato stale
- **#43** — `needs-spec` sulla promozione dei doc di design, chiusa `wontdo` perché superata dai fatti (Story 0.4 implementata comunque su spec DRAFT)