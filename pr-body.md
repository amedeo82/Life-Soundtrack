## Issue

Closes #266

- Issue: #266
- Tipo: [x] story (adazione #266)  [ ] bug fix  [ ] docs  [ ] refactor  [ ] infra

<!-- La riga di chiusura qui sopra DEVE restare nuda (niente backtick, niente casella di
     checklist, una sola volta nel body): solo così GitHub chiude l'issue al merge e
     `auto-status-done` non transiziona issue non collegate. Vedi AGENTS.md
     §"Chiusura al merge: campo Closes #N (obbligatorio)". Per CITARE la keyword
     senza attivarla, scrivere `Closes` #N (spaziata), mai `Closes #N`. -->

## Checklist di auto-revisione

> **Unico artifact della checklist PR** (decisione D3 di ADR-0012): questa sezione è la sola
> copia. `AGENTS.md` rimanda qui e non ne contiene una copia — due copie divergono in silenzio
> (è successo: 22 voci per parte, 2 identiche al testo). Le caselle non spuntate sono blocker
> per il merge.

### Documentazione letta

- [x] Ho letto `AGENTS.md` e i documenti linkati dal task
- [x] Ho letto la specifica della story (link nell'issue)
- [x] Ho verificato che l'issue #266 è in `status:in-review` o `in-progress` (claim valido, ADR-0006)

### Codice e test

- [x] Il codice rispetta lo schema dati (`docs/02-DATA-SCHEMA.md`)
- [x] Ho scritto test che coprono il caso felice e almeno 2 edge case
- [x] Ho usato i fixture di `fixtures/synthetic-history/`
- [x] Coverage rispettata per area modificata (vedi `docs/10-TESTING.md`)
- [x] JSDoc su tutte le funzioni pubbliche
- [x] Nessun dato personale hardcoded, nessun log di PII
- [x] `pnpm run lint` passa in locale
- [x] `pnpm run typecheck` passa in locale
- [x] `pnpm run test` passa in locale (no test saltati senza motivo)
- [x] `pnpm run build` passa in locale

### Documentazione di stato (ADR-0008 V1 + V2)

- [x] **NON** ho modificato i blocchi `<!-- AGGREGATE-* -->` di `docs/INDEX.md`, `docs/SESSIONS.md`, `docs/11-BACKLOG.md` o `docs/BUNDLE.md` (regola ADR-0008: lo stato si cambia solo in `docs/state/<propria>/*`)
- [x] Se ho cambiato un blocco aggregato per errore, l'ho riportato in `docs/state/` e ho annullato la modifica diretta
- [x] **Ho allineato le sezioni legacy** dei file globali che questa PR rende false: conteggi/versione/"Prossimo step tecnico" in `docs/INDEX.md`, tabella "roadmap delle story non ancora completate" e righe `**Stato**:` in `docs/11-BACKLOG.md` (vedi `AGENTS.md` §"Chi può scrivere cosa nei file globali")
- [x] Se la PR tocca una sessione, ho aggiornato/creato il file `docs/state/sessions/<N>-<slug>.md` corrispondente
- [x] Se la PR chiude una story, ho aggiornato/creato `docs/state/stories/<id>-<slug>.md` con frontmatter aggiornato (stato, PR number, merge_commit, merged_date)
- [x] Se ho scritto una sessione: il file `docs/state/sessions/<N>-<slug>.md` ha la sezione **`## Analisi di avanzamento`** (numeri, cosa è pronto, cosa manca, salute tecnica): è ciò che il blocco `AGGREGATE-PROGRESS` rende al project owner (issue #216)
- [x] Se ho aggiunto o rimosso un file in `docs/`, ho aggiornato la tabella documenti di `docs/INDEX.md` e l'array `$files` di `scripts/generate-bundle.ps1`
- [x] Se la PR tocca `docs/state/sessions/` o crea un nuovo `<N>-<slug>.md`, ho pre-allocato `N` con la procedura in `docs/state/_index.md` (issue #105): nessun `[FAIL] numeri di sessione duplicati` appare nell'output di `-Check`.
- [x] `pwsh scripts/generate-bundle.ps1 -Check` exit 0
- [x] `pwsh scripts/aggregate-state.ps1 -Check` exit 0 (o non applicabile se non ho toccato `docs/state/`)
- [x] Se ho toccato `scripts/aggregate-state.ps1`: `bash scripts/test-aggregate-determinism.sh` passa (scenari T1..T14) — **gate bloccante in CI**
- [x] Se ho toccato `README.md` o le piattaforme importabili: `node scripts/check-readme-facts.mjs` exit 0 (gate bloccante in CI, issue #161)
- [x] `node scripts/check-merge-state.mjs` exit 0 — il frontmatter di `docs/state/sessions/*.md` è coerente con lo stato reale delle PR (gate bloccante in CI, issue #239)

### Issue tracking

- [x] La keyword di chiusura compare **una sola volta**, come **riga nuda** (non dentro backtick né checklist) — GitHub auto-close al merge e `auto-status-done` non transiziona issue non collegate
- [x] PR rimossa label `agent-ready` dall'issue + aggiunta `status:in-review` (vedi §"📦 Macchina a stati delle issue" in AGENTS.md)
- [x] Se l'issue aveva label `in-progress`, il comment `release:` verra postato dopo il merge (vedi §"📤 Post-merge actions")

### Git workflow

- [x] Branch name: `feat/266-story-2-5---collegamento-del-pipeline-di` (NO `main` direttamente)
- [x] Worktree creata **prima** del claim: `pwsh scripts/setup-worktree.ps1 266` (lo script rifiuta un'issue già `in-progress`), poi claim con `in-progress` + commento `claim:` (vedi §"🌳 Worktree workflow" e §"🎫 Presa in carico delle story" in AGENTS.md)
- [x] Working tree pulito (no modifiche tracked non committate, vedi pre-commit hook D3)
- [x] Push early: il branch e stato pushato subito dopo `git checkout -b` (D.20.2)
- [x] Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)

## Test eseguiti

- Comando: `pnpm run test`
- Risultato: [x] PASS / [ ] FAIL
- Acceptance criteria verificati: Story 2.5 AC in `docs/state/stories/2.5-analysis-pipeline-link.md`

## Decisioni e lesson learned

- Decisioni (D-23.1..D-23.6) introdotte in questa PR: (vedi `docs/state/stories/2.5-analysis-pipeline-link.md`)
- Lesson learned: (vedi `docs/18-DEV-LOG.md` sezione pertinente)

## Note reviewer

- Rischio: modifica a DB insights + runner analisi → migration test E2E richiesto
- Blocker noti: nessuno
- File di governance toccati (richiede review Boss): [x] `AGENTS.md` [ ] ADR/* [ ] `scripts/*` [ ] `.github/workflows/*`