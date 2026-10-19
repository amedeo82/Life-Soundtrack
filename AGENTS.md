# 🤖 AGENTS.md — Protocollo per Agenti di Sviluppo

> **Questo è il primo file che un agente deve leggere, prima di qualsiasi altro.**
> Versione 1.6 — Sessione 21 (2026-10-17)

---

## 📚 Ordine obbligatorio di lettura

Quando ricevi un task su questo repository, segui questo ordine:

1. **Questo file** (`AGENTS.md`) — il protocollo
2. **[`docs/INDEX.md`](docs/INDEX.md)** — stato del progetto
3. **[`docs/00-VISION.md`](docs/00-VISION.md)** — il "perché"
4. **[`docs/05-ARCHITECTURE.md`](docs/05-ARCHITECTURE.md)** — architettura
5. **[`docs/14-GLOSSARY.md`](docs/14-GLOSSARY.md)** — linguaggio comune
6. **[`docs/11-BACKLOG.md`](docs/11-BACKLOG.md)** — il lavoro da fare
7. **[`docs/10-TESTING.md`](docs/10-TESTING.md)** — come testare
8. **La specifica del task** (linkata nell'issue)

**Non saltare questi passi.** Il contesto è essenziale.

## 🔄 Handoff tra conversazioni AI

Questo progetto è progettato per funzionare attraverso conversazioni multiple con l'AI. Quando una conversazione diventa lunga o devi riprendere dopo un'interruzione:

1. Verifica che tutto sia pushato su GitHub: `git status` deve essere pulito
2. Apri una nuova conversazione con l'AI
3. Dai il prompt di riattivazione:

       Sono il project owner (@amedeo82) del progetto Life-Soundtrack su
       https://github.com/amedeo82/Life-Soundtrack.

       Leggi AGENTS.md per capire il protocollo. Poi leggi:
       - docs/INDEX.md (stato dei documenti)
       - docs/SESSIONS.md (dove siamo arrivati)

       Dimmi cosa serve fare nella prossima sessione e proponimi i documenti
       da scrivere, aspettando la mia approvazione prima di procedere.

4. L'AI userà i suoi tool web per leggere il repo e continuerà esattamente da dove eri rimasto

**Il PAT va dato agli agenti di sviluppo** (Claude Code, Cursor, Copilot) con scope `contents: read/write` **+ `issues: read/write`** sul repo solo (lo scope Issues è richiesto dal protocollo di claim, §"🎫 Presa in carico delle story"). L'AI di review non ha bisogno di PAT.

## ✅ Cosa puoi fare autonomamente

- Scrivere codice in TypeScript/React secondo lo stack definito
- Creare test unitari e di integrazione
- Aprire PR con checklist di auto-revisione
- Segnalare ambiguità nelle specifiche tramite issue con label `needs-spec`
- Usare i fixture in `fixtures/` per i test

## 🚫 Cosa NON puoi decidere autonomamente

Queste decisioni sono già prese e **vincolanti** (status 🟢 APPROVED):

- Architettura: PWA-first, local-first, adapter pattern (ADR 0001, 0002, 0003)
- Schema dati: `docs/02-DATA-SCHEMA.md`
- Formato adapter: `docs/03-ADAPTERS/SPEC-TEMPLATE.md` + `spotify.md`
- Test strategy: `docs/10-TESTING.md`
- Backlog: `docs/11-BACKLOG.md`
- Glossario: `docs/14-GLOSSARY.md`

**Regola d'oro**: se una decisione è documentata e 🟢 APPROVED, è vincolante. Se è 🟡 DRAFT, puoi proporre modifiche aprendo una issue. Se non esiste, **apri una issue `needs-spec` invece di inventare**.

## 🔖 Sistema di issue e label

### Label obbligatorie per agent-ready

Una issue può essere lavorata da un agente **solo se**:

- [ ] Ha label `agent-ready`
- [ ] Contiene link a una specifica 🟢 APPROVED nel repo
- [ ] Ha acceptance criteria verificabili

### Label disponibili

| Categoria | Label | Significato |
|-----------|-------|-------------|
| Fase | `phase-0` … `phase-6` | Fase della roadmap |
| Area | `area:adapter`, `area:analysis`, `area:ui`, `area:ux`, `area:db`, `area:enrichment`, `area:privacy`, `area:devops` | Modulo coinvolto |
| Priorità | `priority:blocker`, `priority:important`, `priority:later` | Ordine di lavoro |
| Size | `size:S`, `size:M`, `size:L`, `size:XL` | Stima relativa |
| Gate | `agent-ready`, `needs-spec`, `blocked`, `in-progress` | Stato lavorabilità (`in-progress` = claim attivo di un agente, vedi §"🎫 Presa in carico delle story" e ADR-0006) |
| Status (post-claim) | `status:done`, `status:in-review`, `status:wontdo`, `status:blocked-other` | Stato dopo il rilascio del claim (vedi §"📦 Macchina a stati delle issue" e ADR-0007). Mutuamente esclusivo con `agent-ready`. |
| Tipo | `bug`, `enhancement`, `refactor`, `docs` | Classificazione |

### Ortopedie fra label Gate e Status

Le label `agent-ready` e `status:*` sono **mutuamente esclusive**: un'issue ha l'una OPPURE l'altra, mai entrambe. La query candidati di §"🚀 Primo task" lo garantisce. `needs-spec` e `blocked` sono ortogonali (compossibili con `status:*`).

## 🎫 Presa in carico delle story (claim)

**Regola vincolante (ADR-0006): nessun agente inizia a lavorare una story senza un claim valido.** Il claim è il meccanismo che impedisce a più agenti paralleli di scegliere e implementare la stessa issue. È il primo gesto operativo, **prima** di leggere la spec dettagliata e creare il branch.

### Identificativo agente

All'avvio l'agente genera il proprio identificativo univoco, in formato `<tool>-<hostname>-<random>` (es. `kilo-HP-ELITEBOOK-hjoe`). Serve perché gli agenti condividono lo stesso PAT: l'utente GitHub non discrimina, l'identificativo agente sì.

### Procedura di claim

1. **Elenca le issue candidabili** — aperte, `agent-ready`, **senza** label `in-progress` e **senza** alcuna `status:*` (vedi §"📦 Macchina a stati delle issue"):

   ```powershell
   gh issue list --state open --label agent-ready --limit 20 --json number,title,labels | jq '[.[] | select(([.labels[].name] | any(startswith('status:')) | not))]'
   ```

   Filtra via quelle che hanno `in-progress` oppure una qualsiasi `status:*` tra le label.

2. **Scegli la prima libera** secondo l'ordine di `11-BACKLOG.md` §"Priorità di lavorazione". Se il project owner ha indicato una issue specifica nell'initial prompt, usa quella.

3. **Claim immediato** (label + commento, in sequenza rapida). Il commento DEVE iniziare con `claim:` — è il marker che la riverifica cerca:

   ```powershell
   gh issue edit <N> --add-label in-progress
   gh issue comment <N> --body "claim: <AGENT-ID> (UTC <timestamp>)"
   ```

4. **Riverifica** — scarica tutti i commenti di claim e verifica che il tuo abbia l'**ID GitHub più basso** tra i claim non ancora rilasciati (vince chi ha commentato per primo):

   ```powershell
   gh api repos/amedeo82/Life-Soundtrack/issues/<N>/comments --jq '.[] | select(.body | startswith("claim:")) | {id, created_at, body}'
   ```

   - **Vinci**: procedi — branch `feat/<N>-<descrizione>` e resto del protocollo.
   - **Perdi**: lascia un commento `yield: <AGENT-ID>` e passa alla prossima issue candidabile (torna al punto 2). **Non rimuovere la label `in-progress`**: serve al vincitore.

### Mantenere il claim

- **Un agente = una story alla volta.** Nessun claim multiplo simultaneo.
- **Attività obbligatoria**: qualsiasi attività (commit pushato, PR aperta, commento di progresso `progress: <AGENT-ID> — <update>`) resetta il TTL di 12 ore.
- **Claim stantio (TTL 12 ore)**: un claim senza attività per 12 ore è considerato abbandonato. Qualsiasi agente può prenderlo: prima commenta `stale-release: <AGENT-ID> — claim scaduto, ultima attività >12h`, poi esegue la procedura di claim normale (punti 3-4). Un agente che torna dopo uno stale-release verifica lo storico dei commenti: se esiste un claim più recente attivo, si arrende con `yield:`.

### Rilascio del claim

```powershell
gh issue comment <N> --body "release: <AGENT-ID> — <motivo: PR mergata / PR rifiutata / abbandono / spec cambiata / passata a status:* >"
gh issue edit <N> --remove-label in-progress
```

Il rilascio è **obbligatorio**: al merge o rifiuto della PR, in caso di abbandono, o se la spec collegata torna 🟡 DRAFT. Mai lasciare label `in-progress` orfane: sono falsi blocchi che solo il TTL può pulire.

**A seconda dell'esito del lavoro**, l'agente che rilascia applica anche una label `status:*` (vedi §"📦 Macchina a stati delle issue"). Il `release:` da solo non è sufficiente a chiudere l'issue.

### Casi particolari

- **Assegnazione esplicita del project owner**: l'agente esegue comunque claim + riverifica (punti 3-4), così la presa in carico resta visibile agli altri agenti.
- **Issue senza `in-progress` ma con branch `feat/<N>-…` remoto esistente**: segnala con issue `needs-spec` e passa alla prossima. Un branch orfano non è un lock (ADR-0006) ed è materia della §"♻️ Pulizia branch post-merge".
- **Nessuna issue candidabile**: apri issue `needs-spec` e termina la sessione **senza lavorare nessuna story**.

## 📦 Macchina a stati delle issue (status:*)

**Regola vincolante (ADR-0007):** quando un'issue esce dal ciclo di lavorazione, l'agente che rilascia il claim applica una label `status:*` al posto di `agent-ready`. Le label `status:*` sono **mutuamente esclusive** con `agent-ready`: un'issue con `status:*` non è candidabile per claim.

### Stati possibili

| Stato | Label | Issue aperta? |
|-------|-------|---------------|
| ⬚ candidato | (solo `agent-ready`) | sì |
| 🟡 claim attivo | `agent-ready` + `in-progress` | sì |
| 👀 PR aperta, in attesa di review | `status:in-review` | sì |
| ✅ PR merged & validata | `status:done` | **chiusa** |
| ❌ PR rifiutata / scope cancellato | `status:wontdo` | **chiusa** |
| 🛑 Bloccata da dipendenza | `status:blocked-other` | sì |

### Regole di transizione (dopo il rilascio del claim)

| Esito del lavoro | Azione aggiuntiva dopo `release:` |
|------------------|-----------------------------------|
| PR aperta, in attesa di review | Rimuovi `agent-ready`, aggiungi `status:in-review`. Issue resta aperta. |
| PR merged, doc-sync (gate D.12.1) applicato | Issue già chiusa da GitHub via `Closes #N`. Aggiungi `status:done` alla chiusura. |
| PR rifiutata in review | Rimuovi `agent-ready`, aggiungi `status:wontdo`. Chiudi l'issue con commento motivato. |
| Lavoro abbandonato (spec non più valida, scope cancellato) | Rimuovi `agent-ready`, aggiungi `status:wontdo`. Chiudi l'issue con motivazione. |
| Story bloccata da dipendenza esterna | Rimuovi `agent-ready`, aggiungi `status:blocked-other`. Issue resta aperta. |

### Chiusura al merge: campo `Closes #N` (obbligatorio)

Ogni PR che risolve un'issue **deve** contenere **`Closes #N`**, **`Fixes #N`** o **`Resolves #N`** nel body. GitHub li riconosce e chiude automaticamente l'issue al merge. Vedi §"📝 Checklist di auto-revisione PR".

### Audit retroattivo

Se incontri un'issue `agent-ready` con una PR `merged` associata (esattamente il sintomo che ADR-0007 risolve — vedi issue #11 durante Sessione 19, merge `2891cb5`): rimuovi `agent-ready`, applica `status:done`, chiudi l'issue con commento di riepilogo che punta alla PR già mergata.

## 🌳 Git workflow

- Branch: `feat/<issue-number>-<descrizione>` o `fix/<issue-number>-<descrizione>`
- Commit: **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Branch `main` protetto: richiede PR e review
- Nessun force push su `main`
- Una PR = una issue (salvo eccezioni)
- **Branch stale vanno eliminati** dopo il merge — vedi §"♻️ Pulizia branch post-merge"
- **Body PR**: includere `Closes #N` / `Fixes #N` / `Resolves #N` per la issue che questa PR risolve (vedi §"📦 Macchina di stati delle issue (status:*)")
- **Push early obbligatorio**: dopo `git checkout -b feat/<N>-<desc>`, eseguire `git push -u origin <branch>` (anche con zero commit). Visibilità + backup + anti-collision. Vedi §"🪝 Pre-commit hook" per il setup / `Fixes #N` / `Resolves #N` per la issue che questa PR risolve (vedi §"📦 Macchina a stati delle issue (status:*)")

## ♻️ Pulizia branch post-merge *(obbligatoria)*

Dopo che una PR è stata mergata e verificata in `main`, il branch remoto `feat/*` o `fix/*` non serve più e **deve essere eliminato** per evitare accumulo di ref stale, drift tra agenti paralleli e confusione su "qual è la source of truth".

**Chi esegue**: l'agente che ha mergato la PR (o, in mancanza, il reviewer al momento del merge). Se l'agente usa una worktree, deve anche rimuovere la worktree locale (`git worktree remove`).

**Comandi minimi** (eseguire sul repo locale dopo il merge):

```powershell
# 1. Conferma che il branch è mergato in main
git branch -r --merged main
# (deve mostrare il branch tra gli elencati)

# 2. Elimina il branch remoto
git push origin --delete feat/<issue-number>-<descrizione>

# 3. Elimina il branch locale corrispondente (obbligatorio se mergato in main)
git branch -d feat/<issue-number>-<descrizione>

# 4. Pulisci ref remote stale nella tua working copy
git remote prune origin
```

**Eccezioni** (NON eliminare):

- Branch di release (`release/*`, `hotfix/*` di una versione pubblicata ancora supportata)
- Branch usato come base da un'altra PR aperta (verificare con `git branch -r --no-merged main`)
- Branch di lavoro abbandonato ma ancora citato in una issue `blocked` o `needs-spec`

**Auto-check** (sostituisce o integra la "Verifica statale post-merge"):

```powershell
git branch -r --merged main | Select-String -NotMatch 'main$|HEAD'
```

Se restituisce uno o più branch, **sono da eliminare** (a meno di eccezioni documentate sopra). Gate minimo: **nessun branch remoto mergato deve restare in `origin`** salvo eccezioni.

**Perché è importante**: con il workflow parallelo (più agenti su più issue contemporaneamente, vedi `11-BACKLOG.md` §"Priorità di lavorazione"), i branch stale sono la principale fonte di errori "ho lavorato sul branch sbagliato" e di conflitti fantasma in fase di review.

## 🧹 Pulizia stash post-housekeeping *(obbligatoria se si droppano stash)*

`git stash drop` è **irreversibile** e **non protegge** dagli errori di conteggio degli indici: dopo ogni `drop` gli altri indici si ricompattano automaticamente (`stash@{1}` può diventare `stash@{0}`), e un calcolo mentale affrettato può portare a droppare stash fuori perimetro. **Lezione operativa D.26.1 (Sessione 26, 2026-10-19, issue #42)**: drop di 5 stash quando ne erano previsti 3, perché mancava uno snapshot testuale pre-drop. Danno zero (contenuto già in `main` via commit successivi), ma la procedura va formalizzata per evitare recidive.

**Quando si applica**: solo se si intende droppare uno o più stash. NON sostituisce §"♻️ Pulizia branch post-merge" né §"🪝 Pre-commit hook"; è complementare.

**Chi esegue**: l'agente che decide l'housekeeping (dopo conferma esplicita del Boss su una issue `needs-spec`, vedi §"Cosa NON puoi decidere autonomamente").

**Procedura conservativa obbligatoria**:

```powershell
# 1. SNAPSHOT TESTUALE PRIMA di qualsiasi drop (irreversibile)
git stash list --format='%gd | hash:%H | %gs' | Tee-Object -FilePath stash-snapshot.txt

# 2. STIMA il numero di stash che dropperai e CONFRONTA con lo snapshot
$expected = 3   # AD ESEMPIO: numero previsto di stash da droppare
$actual = (git stash list | Measure-Object -Line).Lines
if ($expected -ne $actual) { throw "Discrepanza conteggio stash: previsto=$expected reale=$actual" }

# 3. DROP uno alla volta, verificando l'hash tra un drop e il successivo
git stash drop 'stash@{0}'   # leggi l'hash nell'output ("Dropped stash@{0} (<hash>)")
git stash list               # RILEGGERE prima del prossimo drop

# 4. Se uno stash è dubbio o fuori perimetro, ESTRAILO prima con git show <hash>
git show <hash> --format='%s' --name-only   # ispeziona cosa c'è dentro

# 5. PULIZIA post-drop
git remote prune origin
```

**Protezione extra per stash da preservare**:

```powershell
# Se uno stash contiene lavoro che potrebbe servire, PRIMA di droppare gli altri, etichettalo:
git tag stash-preserve/<subject> <stash-hash>
git stash drop 'stash@{N}'                                # droppa gli altri
git show stash-preserve/<subject>                         # ... il preservato sopravvive come tag
```

**Recovery dopo drop errato** (entro 30 giorni, finché `gc` non gira):

```powershell
# Gli stash droppati diventano "dangling commit" visibili con:
git fsck --no-reflogs --full | Select-String 'dangling commit'

# Ogni dangling commit è un ex-stash. Recuperalo con:
git stash store -m "recovered: <subject>" <dangling-hash>   # ricrea uno stash
# oppure
git checkout <dangling-hash> -- 0                          # ricrea i file modificati in un working tree separato
```

**Auto-check pre-drop** (mette in sicurezza l'azione):

```powershell
git fsck --no-reflogs --full --unreachable 2>&1 | Select-String 'dangling commit' | Measure-Object -Line
# Se >0 dopo il drop, hai candidati per recovery (vedi sopra)
```

**Perché è importante**: il drop errato non è reversibile senza `git fsck` + reflog, e anche in quel caso solo entro la finestra di `gc` (default 30 giorni). Lo snapshot testuale + drop incrementale sono l'equivalente per gli stash di quello che `git branch -d` (vs `-D`) fa per i branch: una rete di sicurezza.

### ⚠️ Trappola specifica: `git stash push -- <paths>` *(stash mirato)*

Il pattern `git stash push -m "..." -- <path1> <path2> ...` salva **solo** i path elencati. È particolarmente fragile perché:

1. **Nasconde la complessità**: l'output di `git stash list` non distingue tra stash completi (`-u`) e stash mirati (path specifici). Un operatore successivo potrebbe credere che lo stash contenga "tutto" il working tree.
2. **Droppabile per errore**: se l'operatore dimentica che esiste uno stash mirato e fa `git stash drop 'stash@{0}'` "per pulire", perde solo quei 3 file (o quanti siano) senza che il comando protesti.
3. **Recovery più complessa**: lo stash mirato ha 2 parent commits (working tree + index), uno dei quali è HEAD; l'altro contiene solo i path. `git stash store` non lo ricrea perfettamente — serve `git show <parent-hash>:<path>` per estrarre i singoli file.

**Lezione operativa D.26.2 (Sessione 26, 2026-10-19, durante estensione di PR #44)**: l'agente ha creato `git stash push -m 'wip-story-0.7-preserve-before-docs' -- packages/core/src/db/index.ts packages/core/src/db/__tests__/maintenance.test.ts packages/core/src/db/maintenance.ts` (3 path), poi ha droppato quello stash credendo fosse un interim step. **Persi 3 file** di Story 0.7 per ~10 minuti. Recovery immediata via `git show <stash-hash>:<path>` sui parent commit (ancora nella gc-window di 30gg).

**Regola d'oro**: preferire SEMPRE `git stash push -u` (con `-u` per includere untracked) salvo casi eccezzionali documentati. Se devi usare uno stash mirato, **etichettalo con un prefisso riconoscibile**:

```powershell
# Pattern sicuro per stash mirato
git tag stash-preserve/<subject> <hash>      # taggare SUBITO dopo il push
git stash push -u -m 'MIRATO: <descrizione esplicita>' -- <paths>   # il prefisso "MIRATO:" nel subject aiuta `git stash list`
```

Inoltre, prima di droppare uno stash mirato, **estrarre sempre i path con `git show <hash>:<path>` come rete di sicurezza** (anche se pensi che sia obsoleto).

## 🪝 Pre-commit hook

Il repo include un **pre-commit hook** committato in `.githooks/pre-commit` che verifica che il branch corrente sia valido per il workflow agenti. Pattern ammessi:

- `main` (solo per admin / doc-sync)
- `docs/<desc>` (branch di documentazione)
- `feat/<N>-<desc>` o `fix/<N>-<desc>` (per issue con numero)

### Setup

Il setup è automatico via `postinstall` di `package.json`: dopo `pnpm install`, lo script `scripts/setup-hooks.js` esegue `git config core.hooksPath .githooks` automaticamente (non-fatal se git non disponibile in CI).

Per setup manuale (fallback):

```bash
git config core.hooksPath .githooks
```

### Bypass (emergenza)

```bash
git commit --no-verify                           # salta il pre-commit una volta
LIFE_SOUNDTRACK_SKIP_HOOKS=1 git commit ...     # salta via env var
```

Usare il bypass solo in caso di emergenza (cherry-pick, hotfix, fix urgente) e documentare la ragione nel messaggio di commit.

### Failure mode coperti

- **F1**: commit accidentale su `main` → abort
- **F7**: commit su branch dopo merge (dimenticanza di `git checkout main && git pull`) → abort

Vedi `.githooks/README.md` per il dettaglio dei failure mode non coperti (F3, F5, F8) e del perché alcune difese richiedono worktree (scelta NO del Boss, Sessione 20 D.20.1).

## 📝 Checklist di auto-revisione PR

- [ ] Ho letto `AGENTS.md` e i documenti linkati dal task
- [ ] Il codice rispetta lo schema dati (`02-DATA-SCHEMA.md`)
- [ ] Ho scritto test che coprono il caso felice e almeno 2 edge case
- [ ] Ho usato i fixture di `fixtures/synthetic-history/`
- [ ] JSDoc su tutte le funzioni pubbliche
- [ ] Nessun dato personale hardcoded, nessun log di PII
- [ ] `pnpm run lint` e `pnpm run test` passano in locale
- [ ] **Il body della PR include `Closes #N`** (o `Fixes #N` / `Resolves #N`) per l'issue che questa PR risolve — GitHub lo usa per chiudere automaticamente l'issue al merge (vedi §"📦 Macchina a stati delle issue (status:*)")
- [ ] **Se ho aperto la PR**: prima dell'apertura ho rimosso `agent-ready` e aggiunto `status:in-review` all'issue (vedi §"📦 Macchina a stati delle issue (status:*)")
- [ ] **Se ho aggiunto/rimosso/rinominato un file in `docs/`, `fixtures/` o root**: ho aggiornato l'array `$files` in `scripts/generate-bundle.ps1` e rigenerato `docs/BUNDLE.md` nella stessa PR
- [ ] `pwsh scripts/generate-bundle.ps1 --check` esce con exit code 0

### Checklist di sincronizzazione documentazione al merge *(obbligatoria)*

La documentazione di stato (INDEX, SESSIONS, BACKLOG, 18-DEV-LOG, BUNDLE) **deve riflet-care lo stato reale del branch `main` subito dopo ogni merge**. Senza questo gate la documentazione diverge silenziosamente e gli agenti futuri leggono uno stato falso.

Chi esegue il merge (o chi chiude la PR) è responsabile di aggiornare **nella stessa PR, prima del merge** (o in un commit di follow-up immediatamente successivo se il merge è già avvenuto) i seguenti file, in base a cosa è cambiato:

| Cosa è cambiato nella PR | File da aggiornare |
|---|---|
| Stato di una story (es. ⬚→🟡, 🟡→✅, ✅→⬚) | `docs/11-BACKLOG.md` (sezione Story + tabella "Stato di avanzamento") |
| Stato di una story | `docs/INDEX.md` (§"Stato del progetto" e roadmap sessioni) |
| Stato di una story / chiusura di una sessione | `docs/SESSIONS.md` (entry sessione + changelog) |
| Branch mergato o PR chiusa | `docs/18-DEV-LOG.md` (§4 entry: branch → "merged", PR → numero, aggiungere commit) + **eliminare il branch remoto** (vedi §"♻️ Pulizia branch post-merge") |
| Qualsiasi modifica al **contenuto** di `docs/`, `AGENTS.md`, `README.md`, `fixtures/`, `LICENSE` | `docs/BUNDLE.md` (rigenerare con `pwsh scripts/generate-bundle.ps1`) |
| Modifica alla struttura (aggiunta/rimozione file in `docs/`, `fixtures/`, root) | Anche `scripts/generate-bundle.ps1` (`$files`) — vedi sotto |
| Modifica al toolchain o alla policy di versionamento | `docs/17-DEV-NOTES.md` + nuova entry in `SESSIONS.md` |
| Issue chiusa al merge | `status:done` applicato (vedi §"📦 Macchina a stati delle issue (status:*)"); rimozione `agent-ready` |

**Regola operativa**: se una PR tocca codice, schema, policy o stato di story, allora tocca anche documentazione. La PR senza aggiornamenti di stato è **incompleta**.

**Doc-sync nel branch (preferito, vedi Sessione 21 D.21.1)**: il doc-sync finale (con PR number e merge commit hash) va committato nel branch della PR, NON come commit separato su `main` (vedi §"📤 Post-merge actions"). L'eccezione "commit di follow-up immediatamente successivo" è declassata a fallback sconsigliato per race con altri agenti in parallelo.

**Auto-check**: prima del merge, eseguire localmente

```powershell
pwsh scripts/generate-bundle.ps1 --check   # exit 0 = documentazione in sync
```

Se esce con exit ≠ 0, rigenerare il bundle e committarlo nella stessa PR.

**Auto-check post-merge** (subito dopo il merge, prima di considerare chiusa l'operazione):

```powershell
git branch -r --merged main | Select-String -NotMatch 'main$|HEAD'
```

Se l'output elenca branch `feat/*` o `fix/*` (oltre a `main` e `HEAD`), eliminarli con `git push origin --delete <branch>` (vedi §"♻️ Pulizia branch post-merge").

**Verifica statale post-merge** (opzionale ma consigliata per il reviewer): dopo il merge, aprire `docs/INDEX.md` e `docs/11-BACKLOG.md` e confermare che lo "Stato del progetto" rifletta `git log --oneline -5 main`. Se diverge, aprire una PR `docs:` immediata di riallineamento (è esattamente quello che è successo in Sessione 12, vedi `SESSIONS.md`).

## 🔄 Manutenzione del bundle script

`docs/BUNDLE.md` è lo snapshot di tutto il progetto in un unico file markdown, usato per handoff con AI esterne. Quando modifichi la struttura del progetto:

1. **Aggiungi un nuovo file in `docs/`** (es. nuovo ADR, nuovo doc di sezione):
   - Apri `scripts/generate-bundle.ps1`
   - Aggiungi il path all'array `$files` rispettando l'ordine di `docs/INDEX.md`
   - Esegui `pwsh scripts/generate-bundle.ps1` per rigenerare
   - Committa `scripts/generate-bundle.ps1` e `docs/BUNDLE.md` nella stessa PR

2. **Verifica che il bundle sia allineato** (in CI e in locale):
   ```powershell
   pwsh scripts/generate-bundle.ps1 --check
   ```
   Exit code 0 = in sync, 1 = da rigenerare, 2 = file dichiarati mancanti.

3. **Workflow di manutenzione completo**: vedi `docs/12-DEVOPS.md §9`.

Non serve intervenire sullo script se modifichi solo il **contenuto** di un file già elencato (lo script lo rilegge). Intervieni solo se aggiungi/rimuovi file.

### 📦 D.26.3 — Bundle regeneration obbligatoria in stessa PR *(lesson learned)*

**Regola**: ogni PR che modifica il **contenuto** di uno qualsiasi dei file elencati in `$files` (`docs/`, `AGENTS.md`, `README.md`, `fixtures/` foundational, `scripts/*`, `LICENSE`) **deve rigenerare `docs/BUNDLE.md` nello stesso commit** (o in un commit di follow-up immediato prima del merge), per evitare il fail di `pwsh scripts/generate-bundle.ps1 --check` in CI.

**Perché è importante**: il check del bundle è un **CI gate bloccante** (vedi `docs/12-DEVOPS.md §9` + §"📝 Checklist di auto-revisione PR" riga "BUNDLE check exit 0"). Una PR che modifica `AGENTS.md` senza rigenerare `BUNDLE.md` fallirà la pipeline quality anche se il codice di per sé è corretto, costringendo a un commit di fix che prolunga il ciclo di review.

**Procedura consigliata** (snippet per ogni PR docs):

```powershell
# Dopo aver modificato qualsiasi file in scope del bundle:
pwsh scripts/generate-bundle.ps1 --check   # verifica locale: deve uscire 0

# Se esce != 0:
pwsh scripts/generate-bundle.ps1            # rigenera
git add docs/BUNDLE.md
git commit --amend                          # o commit separato nella stessa PR
git push
```

**Lezione operativa D.26.3 (Sessione 26, 2026-10-19, durante estensione di PR #44)**: l'agente ha modificato `AGENTS.md` (v1.6 → v1.7, D.26.1 + D.26.2) senza rigenerare `docs/BUNDLE.md`. La 1a run di CI quality è fallita con `pwsh scripts/generate-bundle.ps1 --check` → `docs/BUNDLE.md non è in sync`. Fix richiesto: 3° commit della PR ha rigenerato il bundle (+8139 byte) e portato la pipeline a verde. **Costo evitabile**: ~5 minuti di review extra + rumore nella history della PR.

**Auto-check pre-push** (rafforzativo di D.4): il pre-push hook di `.githooks/pre-push` esegue già `generate-bundle.ps1 --check` e blocca il push se drift. Se bypassi il hook con `LIFE_SOUNDTRACK_SKIP_HOOKS=1` (emergenza), esegui manualmente il check prima del merge.

## 🗺️ Struttura del repository

    Life-Soundtrack/
    ├── AGENTS.md                ← questo file
    ├── README.md
    ├── docs/                    ← specifica completa
    │   ├── INDEX.md, SESSIONS.md, BUNDLE.md (rigenerati da aggregator, vedi §"🔄 Lazy-state aggregation")
    │   ├── state/               ← sorgenti atomiche per lazy-state aggregation (ADR-0008)
    │   │   ├── _index.md
    │   │   ├── sessions/<N>-<slug>.md
    │   │   └── stories/<id>-<slug>.md
    │   ├── 00-VISION.md … 15-DESIGN-SYSTEM.md
    │   ├── 03-ADAPTERS/, 13-ADR/
    │   └── 09-PRIVACY-SECURITY.md
    ├── design/                  ← mockup, token, asset
    │   └── mockups/             ← PNG storiche dalle sessioni esplorative
    ├── fixtures/                ← dataset di test
    │   ├── synthetic-history/   ← per adapter (es. spotify-sample.json)
    │   ├── db-seed/             ← minimal/medium/large per test DB (vedi 10-TESTING §3.2)
    │   └── scenarios/           ← scenari di vita sintetici (vedi 10-TESTING §3.3)
    └── scripts/                 ← utility
        ├── generate-bundle.ps1      ← snapshot docs in BUNDLE.md
        ├── generate-fixtures.mjs    ← generator deterministico dei fixture (10-TESTING §3.5)
        └── aggregate-state.ps1      ← aggregatore lazy-state (ADR-0008): genera blocchi in SESSIONS.md + BACKLOG.md

## 🚀 Primo task di un agente

1. Leggi questo file
2. Esegui il protocollo di claim (§"🎫 Presa in carico delle story"): ottieni il claim della prima issue `agent-ready` **libera** secondo l'ordine di `docs/11-BACKLOG.md` §"Priorità di lavorazione" — una issue è libera se non ha `in-progress` né `status:*` (vedi §"📦 Macchina a stati delle issue (status:*)")
3. Crea branch `feat/<issue>-<descrizione>`
4. Leggi la specifica del task e implementa con test
5. Apri PR (rimuovendo `agent-ready` e aggiungendo `status:in-review` all'issue) con `Closes #N` nel body
6. Al merge: GH Action `auto-status-done` applica automaticamente `status:done`; tu fai `release:` comment + **branch cleanup obbligatorio (locale e remoto)** (vedi §"📤 Post-merge actions" e §"♻️ Pulizia branch post-merge") (vedi §"📦 Macchina a stati delle issue (status:*)")

Se non ci sono issue `agent-ready` libere, apri issue con label `needs-spec`. **Mai iniziare a lavorare una story senza un claim valido** (ADR-0006).

## 📤 Post-merge actions

Dopo che il Boss mergia la PR, le azioni post-merge sono **solo a livello di issue** (no commit su `main`, no race con altri agenti):

1. **GitHub Action `auto-status-done`** (vedi `.github/workflows/auto-status-done.yml`) applica automaticamente `status:done` all'issue chiusa dalla PR. Rimuove anche `in-progress` e `status:in-review`. **Niente da fare manualmente per le label**.
   2. **Tu devi**:
      - Postare un comment `release: <AGENT-ID> — <motivo: PR mergata / rifiutata / abbandono / spec cambiata>` con dentro il merge commit SHA (letto da `gh pr view --json mergeCommit --jq .oid`)
      - Cancellare il branch remoto: `git push origin --delete <branch>`
      - Cancellare il branch locale corrispondente: `git branch -d <branch>` (solo se è stato mergato in `main`)
      - Pulire i ref remoti obsoleti: `git remote prune origin`
3. **Niente commit su `main`**: il doc-sync finale (con PR number e merge commit) è già nel branch PR (vedi §"📝 Checklist di auto-revisione PR" + §"Checklist di sincronizzazione documentazione al merge"). L'eccezione "follow-up su main" è sconsigliata: crea race con altri agenti.

Vedi §"🛡️ Hardening multi-agente" (Sessione 21) per il contesto sul perché questa separazione (commit nel branch vs. label sull'issue) elimina le race condition.

## 🔄 Lazy-state aggregation (D.24.x)

Da Sessione 25 (2026-10-18), adottato **ADR-0008** per eliminare i conflitti di merge ricorrenti generati dal doc-sync IN PR su file globali (`docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`). Vedi `docs/13-ADR/0008-lazy-state-aggregation.md` per la spec completa.

### Regola d'oro (vincolante per tutti gli agenti da S25 in poi)

**Le PR di implementazione **NON** toccano direttamente `docs/SESSIONS.md`, `docs/11-BACKLOG.md` o `docs/INDEX.md`.** Modificano invece solo:

- I file nelle rispettive aree tecniche (`apps/*`, `packages/*`, `scripts/*`, ...)
- I file in `docs/state/sessions/<N>-<slug>.md` (se la PR documenta una sessione)
- I file in `docs/state/stories/<id>-<slug>.md` (se la PR chiude una story)

I file globali vengono **rigenerati automaticamente** dopo il merge dalla GH Action `auto-state-aggregate.yml`, che esegue `pwsh scripts/aggregate-state.ps1` e committa eventuali blocchi `<!-- AGGREGATE-* -->` drift.

### Eccezione

La PR di introduzione S25 (`#24` / `feat/24-lazy-state-aggregation`) è l'unica che tocca direttamente `INDEX/SESSIONS/BACKLOG` (necessario per inserire i marker `<!-- AGGREGATE-* -->` e fare la migration iniziale delle 3 sessioni + 2 story seed). Dopo S25, vietato modificare i blocchi globali a mano.

### Pattern `state/`

```
docs/state/
├── _index.md                      ← schema frontmatter + convenzioni
├── sessions/<N>-<slug>.md         ← una entry per sessione (frontmatter + body)
└── stories/<id>-<slug>.md         ← una entry per story (frontmatter + body)
```

Esempi: `docs/state/sessions/22-pwa.md`, `docs/state/stories/0.5-pwa.md`. Schema completo in `docs/state/_index.md` §"Schema frontmatter".

### Aggregator

```powershell
pwsh scripts/aggregate-state.ps1 --list       # audit: cosa verrebbe letto/scritto
pwsh scripts/aggregate-state.ps1 --check      # CI gate: --check exit 0 = in sync
pwsh scripts/aggregate-state.ps1 --dry-run    # preview senza scrivere
pwsh scripts/aggregate-state.ps1              # scrivi (idempotente)
```

CI gate consigliato: aggiungere `pwsh scripts/aggregate-state.ps1 --check` al workflow quality (lo stesso che esegue `generate-bundle.ps1 --check`). Se la PR modifica solo `docs/state/`, lo script esce 0 e non blocca. Se per errore un agente modifica `SESSIONS.md` o `BACKLOG.md` direttamente, lo script rileva drift e fallisce.

### Checklist PR aggiuntiva (D.24.x)

- [ ] **NON** ho modificato direttamente `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md` (a meno che non sia la PR di introduzione ADR-0008 stessa)
- [ ] Se la PR tocca una sessione, ho aggiornato/creato il file `docs/state/sessions/<N>-<slug>.md` corrispondente
- [ ] Se la PR chiude una story, ho aggiornato/creato `docs/state/stories/<id>-<slug>.md` con frontmatter aggiornato (stato, PR number, merge_commit, merged_date)
- [ ] Ho eseguito `pwsh scripts/aggregate-state.ps1 --check` localmente: exit 0
- [ ] Se ho aggiunto un nuovo file in `docs/state/` o `scripts/aggregate-state.ps1`, ho aggiornato `scripts/generate-bundle.ps1` `$files` + rigenerato `BUNDLE.md`

## 🛡️ Session start checklist

Prima di iniziare a lavorare su un'issue claimata, esegui i seguenti 4 check per catturare precocemente i failure mode del parallelismo:

```powershell
git status                          # working tree clean? (F3, F5)
git branch --show-current           # sul branch giusto? (F1)
git fetch origin && git status -uno # main stale? (F4)
gh issue view <N> --jq .state       # issue ancora nostra e aperta? (F7)
```

Tutti e 4 i check devono tornare positivi. Se qualcosa non torna, risolvere **prima** di modificare file.

## 📞 Contatti

- Project owner: `@amedeo82`
- Per decisioni strategiche: aspetta review sulla PR
- Per questioni tecniche: usa le issue
- Per ambiguità di specifica: issue `needs-spec`

---

*Ultimo aggiornamento: Sessione 26 (2026-10-19) — v1.7: nuova sezione §"🧹 Pulizia stash post-housekeeping *(obbligatoria se si droppano stash)*" (D.26.1, lezione operativa issue #42: drop di 5 stash quando ne erano previsti 3; procedura conservativa con snapshot testuale, drop incrementale, recovery via `git fsck` + `git tag stash-preserve/*`); §"⚠️ Trappola specifica: stash mirato `git stash push -- <paths>`" (D.26.2: persi 3 file di Story 0.7 per drop di stash mirato; recovery via `git show <hash>:<path>`); §"📦 D.26.3 Bundle regeneration obbligatoria in stessa PR" (lesson learned: modifica `AGENTS.md` senza rigenerare `BUNDLE.md` → CI fail; procedura con snippet `pwsh scripts/generate-bundle.ps1` + `git commit --amend`); ultima: v1.6 Sessione 21 (2026-10-17): refactor catena (D1 doc-sync IN PR + D2 GH Action `auto-status-done` + D3 pre-commit clean check + D4 pre-push BUNDLE auto-regen + D5 pre-push base-stale warning); nuova sezione §"📤 Post-merge actions"; §"🚀 Primo task" step 6 semplificato (GH Action automatizza label transitions); §"Checklist di sincronizzazione" aggiornata (doc-sync preferito nel branch, no race su main)*