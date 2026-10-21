## Issue

- Issue: #
- Tipo: [ ] story (adazione #N)  [ ] bug fix  [ ] docs  [ ] refactor  [ ] infra

## Checklist di auto-revisione

L'autore della PR deve compilare questa checklist PRIMA di chiedere review. Le caselle non spuntate sono blocker per il merge.

### Documentazione letta

- [ ] Ho letto `AGENTS.md` e i documenti linkati dal task
- [ ] Ho letto la specifica della story (link nell'issue)

### Codice e test

- [ ] `pnpm run lint` passa in locale
- [ ] `pnpm run typecheck` passa in locale
- [ ] `pnpm run test` passa in locale (no test saltati senza motivo)
- [ ] `pnpm run build` passa in locale
- [ ] Coverage rispettata per area modificata (vedi `docs/10-TESTING.md`)

### Documentazione di stato (ADR-0008 V1 + V2)

- [ ] **NON** ho modificato i blocchi `<!-- AGGREGATE-* -->` di `docs/INDEX.md`, `docs/SESSIONS.md`, `docs/11-BACKLOG.md` o `docs/BUNDLE.md` (regola ADR-0008: lo stato si cambia solo in `docs/state/<propria>/*`)
- [ ] Se ho cambiato un blocco aggregato per errore, l'ho riportato in `docs/state/` e ho annullato la modifica diretta
- [ ] **Ho allineato le sezioni legacy** dei file globali che questa PR rende false: conteggi/versione/"Prossimo step tecnico" in `docs/INDEX.md`, tabella "roadmap delle story non ancora completate" e righe `**Stato**:` in `docs/11-BACKLOG.md` (vedi `AGENTS.md` §"Chi può scrivere cosa nei file globali")
- [ ] Se ho aggiunto o rimosso un file in `docs/`, ho aggiornato la tabella documenti di `docs/INDEX.md` e l'array `$files` di `scripts/generate-bundle.ps1`
- [ ] `pwsh scripts/generate-bundle.ps1 --check` exit 0
- [ ] `pwsh scripts/aggregate-state.ps1 --check` exit 0 (o non applicabile se non ho toccato `docs/state/`)

### Issue tracking

- [ ] Body PR include `Closes #N` (o `Fixes #N` / `Resolves #N`) per l'issue che questa PR risolve — GitHub auto-close al merge
- [ ] PR rimossa label `agent-ready` dall'issue + aggiunta `status:in-review` (vedi §"📦 Macchina a stati delle issue" in AGENTS.md)
- [ ] Se l'issue aveva label `in-progress`, il comment `release:` verra postato dopo il merge (vedi §"📤 Post-merge actions")

### Git workflow

- [ ] Branch name: `feat/<N>-<desc>` o `fix/<N>-<desc>` (NO `main` direttamente)
- [ ] Worktree creata **prima** del claim: `pwsh scripts/setup-worktree.ps1 <N>` (lo script rifiuta un'issue già `in-progress`), poi claim con `in-progress` + commento `claim:` (vedi §"🌳 Worktree workflow" e §"🎫 Presa in carico delle story" in AGENTS.md)
- [ ] Working tree pulito (no modifiche tracked non committate, vedi pre-commit hook D3)
- [ ] Push early: il branch e stato pushato subito dopo `git checkout -b` (D.20.2)
- [ ] Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)

## Test eseguiti

- Comando: `...`
- Risultato: [ ] PASS / [ ] FAIL
- Acceptance criteria verificati: (linkare al backlog Story AC o alla sezione AC nell'issue)

## Decisioni e lesson learned

- Decisioni (D.X.Y) introdotte in questa PR: (vedi `docs/state/sessions/<N>-<slug>.md`)
- Lesson learned: (vedi `docs/18-DEV-LOG.md` sezione pertinente)

## Note reviewer

- Rischio: (es. "modifica a DB index → migration test E2E richiesto")
- Blocker noti: (es. "richiede merge di PR #54 prima")
- File di governance toccati (richiede review Boss): [ ] `AGENTS.md` [ ] ADR/* [ ] `scripts/*` [ ] `.github/workflows/*`