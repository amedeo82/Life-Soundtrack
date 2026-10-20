# 🤖 AGENTS.md — Protocollo per Agenti di Sviluppo

> **Questo è il primo file che un agente deve leggere, prima di qualsiasi altro.**
> Versione 1.13 — Sessione 36 (2026-10-20)

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

## ♻️ Pulizia branch post-merge — procedura canonica *(vincolante)*

Dopo il merge di una PR su `main` l'agente che ha mergiato (o, in mancanza, il reviewer) esegue **una sola procedura**, automatizzata in `scripts/post-merge.ps1` e testata in `scripts/test-post-merge.sh`.

**Cosa è già automatico** (livello 1, vedi §"📤 Post-merge actions"): il branch **remoto** viene eliminato da `auto-branch-cleanup`, le label dell'issue sono transizionate da `auto-status-done` e il commento `release:` viene pubblicato automaticamente. **Cosa resta all'agente**: rimuovere la worktree e il branch **locale**, e verificare.

**L'ordine è parte della procedura**: allineare `main` e smontare la worktree *prima* di eliminare i branch. La sequenza inversa produce `not fully merged`, branch orfani, falsi "non mergato" e working tree su branch già eliminato.

### Ordine obbligatorio (8 passi)

| # | Passo | Operazione | Failure mode prevenuto |
|---|-------|------------|------------------------|
| 0 | Zero-WIP guard | `git status --porcelain` filtrato sulle righe tracked: se sporco, `stash push -u` o stop (exit 10) | E3/E4/E5 — transizione distruttiva con lavoro non committato (issue #45) |
| 1 | Worktree **prima** del delete locale | `git worktree remove --force <path>` (auto-rilevata da `git worktree list`) | `git branch -d` fallisce se il branch è checked-out in una worktree |
| 2 | Fetch | `git fetch origin --prune` | `origin/main` non contiene il merge commit: ogni check successivo mente |
| 3 | Allineamento `main` | `git checkout main` + `git merge --ff-only origin/main` | E4 (branch inquinato), F7 (lavorare da main stale), `not fully merged` |
| 4 | Verifica merge | `gh pr list --head <branch> --state merged` (autorevole) **oppure** `git merge-base --is-ancestor <branch> origin/main` | cancellazione di un branch **non** mergato → perdita di lavoro |
| 5 | Delete remoto | `git push origin --delete <branch>` | branch orfano su `origin` |
| 6 | Delete locale | `git branch -d <branch>`; se rifiutato (merge squash), `-D` **solo se** `git cherry main <branch>` non rileva contenuto nuovo | perdita di contenuto nei merge squash/rebase |
| 7 | Prune + audit | `git remote prune origin`, `git worktree prune`, `post-merge.ps1 -Check` | ref stale e worktree zombie che inquinano i check dei sessioni successive |

### Esecuzione (comando unico)

```powershell
# dalla working copy principale — NON da dentro la worktree (lo script lo rifiuta, exit 15)
pwsh scripts/post-merge.ps1 -Branch feat/53-worktree-default -IssueNumber 53

# anteprima, nessuna modifica
pwsh scripts/post-merge.ps1 -Branch feat/53-worktree-default -DryRun

# audit read-only dei residui: exit 14 se c'è da pulire, 0 se è pulito
pwsh scripts/post-merge.ps1 -Check
```

L'audit segnala quattro classi di residuo: `main` locale indietro, branch **remoti** merged, worktree attive, e branch **locali** orfani. Un branch locale è orfano solo se ha **zero commit unici** rispetto a `origin/main` **e** non è checked-out in nessuna worktree: un branch con anche un solo commit non pushato non viene mai segnalato, perché il costo di un falso positivo (perdita di lavoro) è incomparabile con quello di un falso negativo. Il `-Check` è read-only: stampa il `git branch -d` suggerito senza eseguirlo.

Lo script è **idempotente**: rieseguirlo su un branch già eliminato esce 0 senza errori. Stampa inoltre il comando esatto per il commento `release:` sull'issue.

### Equivalente manuale (solo se lo script non è disponibile)

```powershell
# 0. zero-WIP: se `git status --porcelain` mostra righe tracked, STAI FERMO (o stash -u)
# 1. worktree PRIMA (obbligatorio se il branch è checked-out li)
git worktree list                      # individuare la worktree del branch
git worktree remove --force ../ls-<N>-<slug>

# 2. fetch: senza questo, `origin/main` non contiene il merge commit
git fetch origin --prune

# 3. allineare main (prima di qualunque delete)
git checkout main
git merge --ff-only origin/main         # MAI `git pull` e MAI `git reset --hard`

# 4. verificare il merge CONTRO origin/main (non contro il main locale)
git merge-base --is-ancestor <branch> origin/main
#    oppure, se il merge è squash (l'antenato non coincide): gh pr list --head <branch> --state merged

# 5. eliminare il remoto
git push origin --delete <branch>

# 6. eliminare il locale (solo dopo il passo 4)
git branch -d <branch>                 # se rifiutato: git cherry main <branch> per capire perché

# 7. prune
git remote prune origin
git worktree prune
```

### Regole di sicurezza (non negoziabili)

- **Mai** `git push --delete` o `git branch -D` prima del passo 4. Nel dubbio: `-Check` + `gh pr list`.
- **Mai** eseguire la procedura da dentro la worktree: lì il branch è checked-out, quindi `git branch -d` fallisce e `git checkout main` può essere rifiutato perché `main` è già checked-out nella working copy principale. Lo script esce 15 e stampa il path corretto.
- **Mai** con WIP non committato in gioco: `-Stash` salva e prosegue, altrimenti stop (exit 10) con zero azioni distruttive.
- Se `main` locale diverge da `origin/main`: **nessun reset**, nessun force, nessuna perdita. Uscita 11 e risoluzione manuale esplicita.
- `-AllowUnmerged` è una via di fuga: solo con giustifica scritta nel PR o nell'issue.
- `-Force` è una via di fuga: solo per cherry-pick/hotfix, mai di routine.

### Exit code (utili a hook e CI)

| Code | Significato | Azione richiesta |
|------|-------------|------------------|
| 0 | ok, oppure audit pulito | — |
| 2 | errore di ambiente o parametri invalidi | correggi invocazione |
| 10 | WIP non committato rilevato, **nessuna azione eseguita** | `-Stash` o stash manuale |
| 11 | `main` locale divergente, **nessuna azione distruttiva** | risolvi a mano (mai reset automatico) |
| 12 | merge non verificato, **branch preservato** | `-IssueNumber <N>` o `-AllowUnmerged` con giustifica |
| 13 | `git branch -d` rifiutato con contenuto non in base | ispeziona `git cherry`, poi `-D` **solo se** il lavoro è altrove |
| 14 | `-Check`: residui post-merge presenti | esegui la procedura sui branch elencati |
| 15 | eseguito da dentro una worktree | rilancia dalla working copy principale |

### Copertura dei test

```bash
bash scripts/test-post-merge.sh    # 9 scenari su repo git temporanei (T1..T9)
```

| Scenario | Cosa dimostra |
|----------|--------------|
| T1 | merge commit + worktree: `main` allineato, worktree smontata, branch eliminati |
| T2b | HEAD sul branch da eliminare (caso peggiore): `main` allineata comunque |
| T3 | branch non mergato: exit 12, branch e remoto **preservati** |
| T4 | WIP tracked: exit 10, zero azioni distruttive; con `-Stash` procedura completa |
| T5 | merge squash: fail chiusa senza evidenza, poi `-AllowUnmerged` con fallback `git cherry` |
| T6 | `main` divergente: exit 11, branch non toccato |
| T7 | audit `-Check`: exit 14 con residui, exit 0 dopo la pulizia |
| T8 | idempotenza della procedura |
| T9 | esecuzione da dentro la worktree: exit 15, branch intatto |

**Eccezioni** (NON eliminare):

- Branch di release (`release/*`, `hotfix/*` di una versione pubblicata ancora supportata)
- Branch usato come base da un'altra PR aperta (verificare con `git branch -r --no-merged origin/main`)
- Branch di lavoro abbandonato ma ancora citato in una issue `blocked` o `needs-spec`

**Perché è importante**: con il workflow parallelo (più agenti su più issue contemporaneamente, vedi `11-BACKLOG.md` §"Priorità di lavorazione"), i branch stale sono la principale fonte di errori "ho lavorato sul branch sbagliato" e di conflitti fantasma in fase di review. I check vanno fatti **sempre** contro `origin/main`: il `main` locale è stale per definizione dopo un merge fatto dall'interfaccia GitHub, e un `main` locale stale trasforma ogni verifica in un falso negativo.

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

## 🔀 Transizioni tra branch *(safety obbligatoria)*

Le **transizioni tra branch** (`git checkout <branch>`, `git pull origin <branch>`, `git reset --hard`) eseguite con working tree sporco di modifiche tracked possono **distruggere lavoro non committato** appartenente all'operatore corrente o ad agenti paralleli. La categoria di failure mode (E3/E4/E5) e' emersa chiaramente in Sessione 26 (issue #45, DATA-LOSS post-merge PR #44): `git reset --hard` ha eliminato `M packages/core/src/db/index.ts` di un altro agente perche' il working tree era sporco e il check pre-reset non esisteva.

**Regola d'oro**: prima di una qualsiasi transizione distruttiva, **verificare che il working tree tracked sia pulito**. Se sporco, **salvare con `git stash push -u`** (includendo untracked).

### Checklist pre-transizione

```powershell
# PRIMA di `git checkout main` o `git pull origin <branch>` o `git reset --hard`:
$dirtyTracked = git status --porcelain | Select-String '^.[^\\?]'   # righe tracked (ignora untracked)
if ($dirtyTracked) {
    Write-Host "Working tree sporco con modifiche TRACKED:" -ForegroundColor Yellow
    $dirtyTracked | ForEach-Object { Write-Host "  $_" }
    throw "Salva con 'git stash push -u -m <subject>' PRIMA della transizione (vedi D.26.4)"
}

# Dopo la transizione, verifica untracked preservati:
git status --short   # se vedi '??' di file dell'altro agente, ripristinali dal suo stash
```

### Esempi di transizioni pericolose

| Operazione | Rischio | Mitigazione |
|------------|---------|-------------|
| `git reset --hard origin/<branch>` con working tree tracked dirty | **Distrugge WIP tracked** (E3) | Stash -u prima; controlla `git status --porcelain` |
| `git pull origin main` su branch non-main | **Inquina il branch con commit main** (E4) | Lavora in worktree separata, oppure `git rebase` esplicito |
| `git checkout main` con WIP tracked | **Porta via il WIP** (E5) | Stash -u prima; verifica post-checkout |
| `git checkout -b <new>` con WIP tracked | Il WIP resta tracked e viene portato | Stash -u prima; oppure accetta (e' esplicito) |

### Post-checkout hook (advisory)

Il file `.githooks/post-checkout` (nuovo, vedi D.26.4) rileva `git checkout <branch>` con working tree tracked dirty e **stampa un warning** (advisory, non blocca). Setup automatico via `scripts/setup-hooks.js` (postinstall) — non richiede configurazione manuale. Bypass: `LIFE_SOUNDTRACK_SKIP_HOOKS=1 git checkout ...`.

**Limitazione nota**: l'hook e' post-checkout (interviene DOPO che il branch e' cambiato), non pre-checkout. Non puo' bloccare l'azione; solo avvisare. Per bloccarla serve una `worktree` separata (vedi issue #47).

### Script di supporto: `scripts/safe-branch-switch.ps1`

Oltre all'hook `.githooks/post-checkout` (advisory), e' disponibile lo script
`scripts/safe-branch-switch.ps1` che wrappa `git checkout <branch>` con lo stesso
safety check (stash `-u` automatico su tracked dirty + verifica post-checkout degli
untracked). Puo' essere usato come alternativa advisory all'hook post-checkout, o in
sua assenza, prima di qualunque transizione distruttiva tra branch.

Uso: `pwsh scripts/safe-branch-switch.ps1 <branch> [-h|--help]`

### Lezione operativa D.26.4 (Sessione 26, 2026-10-19)

**Errore E3 + E4 + E5 in sequenza** durante post-merge PR #44: l'agente ha eseguito `git checkout main` (porta via WIP), poi `git pull` su main (allinea OK), poi `git reset --hard origin/feat/39-operations-runbook` per riallineare il branch dopo averlo inquinato con i commit della PR. Il reset ha eliminato `M packages/core/src/db/index.ts` (WIP dell'altro agente Story 0.7). Recovery impossibile (no stash, no dangling blob significativo). Issue di tracking: #45 (DATA-LOSS).

**Costo evitabile**: ~10 minuti di data loss + tempo di re-issue + confusione operativa.

### Lezione operativa D.45.1 (Sessione 32, 2026-10-19, issue #45)

**Recovery automatico di un delta perso**: quando un file tracked viene perso per DATA-LOSS post-merge (E3/E4/E5), **non serve ricreare il contenuto da zero** se sono presenti nella worktree file *untracked* che importano il modulo perso (test, file di wiring, ecc.). Procedura conservativa:

```powershell
# 1. Identifica cosa il file perso doveva esportare
git show <untracked-test-file> --format='%s' --name-only    # capire cosa importa
rg "from .*db/?(index|barrel)?'?" <untracked-test-file>    # import diretti al barrel

# 2. Rigenera solo gli export mancanti (delta minimo)
#    Vedere i test del modulo per le funzioni effettivamente usate
```

**Caso reale (issue #45)**: `packages/core/src/db/index.ts` ha perso un delta durante `git reset --hard` post-merge PR #44. Recovery effettuata dallo `AGENTS.md` stesso osservando che `packages/core/src/db/__tests__/maintenance.test.ts` (untracked, 35KB) importa simboli specifici del barrel — gli export necessari sono stati dedotti eseguendo `rg` sul file di test. Zero ambiguità sul cosa serve.

**Lezione generale**: in caso di DATA-LOSS, **i test untracked sono la migliore spec implicita** del file perso. Sono aggiornati, typecheckati, e riflettono l'API che il barrel deve esporre. Il barile va ricostruito analizzando cosa i test chiamano, non cosa l'agente "pensava dovesse esserci".

**Auto-check** (preventivo, per ridurre il rischio di delta perso):

```powershell
# Prima di una transizione distruttiva, dump incrementale dei file tracked modificati
git diff --name-only HEAD > /tmp/pre-transition-tracked.txt
# Dopo la transizione: ripristina da qui se qualcosa manca
```

Issue chiusa come `wontdo` perché la mitigazione strutturale (worktree come default, issue #53) elimina per costruzione la categoria E3/E4/E5; la modifica persa non era necessaria per il typecheck corrente; il recovery demandato all'altro agente Story 0.7 è ora documentato e replicabile.

## 🪝 Pre-commit hook

Il repo include un **pre-commit hook** committato in `.githooks/pre-commit` che verifica che il branch corrente sia valido per il workflow agenti. Pattern ammessi:

- `main` (solo per GH Action auto-commits: `kilo-bot[bot]` con `auto-status-done` o `auto-state-aggregate`; vietato per agenti umani)
- `docs/<desc>` (branch di documentazione)
- `feat/<N>-<desc>` o `fix/<N>-<desc>` (per issue con numero)

### Eccezione `main` chiarita

Il pattern `main` e ammesso dal hook **esclusivamente** per i commit automatici delle GH Action (identity `kilo-bot[bot]`). Gli agenti umani NON devono committare direttamente su `main` per nessuna ragione (vedi §"📤 Post-merge actions" → "Regola fondamentale — NO commit su main"). Il doc-sync (rigenerazione SESSIONS/BACKLOG/INDEX/BUNDLE) e gestito automaticamente dall'auto-state-aggregate workflow, che usa il bot identity.

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

> **Template GitHub**: il file `.github/pull_request_template.md` (introdotto in Sessione 27, issue #51, P2) rende questa checklist interattiva in GitHub. Le caselle non spuntate sono blocker per il merge.
>
> **Branch protection**: il Boss applichera (post-merge #51) `branch protection` su `main` che richiede review Boss + CI verde. Vedi §"📤 Post-merge actions" → "Branch protection Boss-only".

- [ ] Ho letto `AGENTS.md` e i documenti linkati dal task
- [ ] **Lavoro eseguito in worktree dedicata**: `pwsh scripts/setup-worktree.ps1 <N>` (vedi §"🌳 Worktree workflow")
- [ ] Il codice rispetta lo schema dati (`02-DATA-SCHEMA.md`)
- [ ] Ho scritto test che coprono il caso felice e almeno 2 edge case
- [ ] Ho usato i fixture di `fixtures/synthetic-history/`
- [ ] JSDoc su tutte le funzioni pubbliche
- [ ] Nessun dato personale hardcoded, nessun log di PII
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build` passano in locale
- [ ] **NON ho modificato direttamente** `docs/INDEX.md`, `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/BUNDLE.md` (regola ADR-0008: solo `docs/state/<propria>/*`)
- [ ] **Il body della PR include `Closes #N`** (o `Fixes #N` / `Resolves #N`) per l'issue che questa PR risolve — GitHub lo usa per chiudere automaticamente l'issue al merge (vedi §"📦 Macchina a stati delle issue (status:*)")
- [ ] **Se ho aperto la PR**: prima dell'apertura ho rimosso `agent-ready` e aggiunto `status:in-review` all'issue (vedi §"📦 Macchina a stati delle issue (status:*)")
- [ ] **Se ho aggiunto/rimosso/rinominato un file in `docs/`, `fixtures/` o root**: ho aggiornato l'array `$files` in `scripts/generate-bundle.ps1` e rigenerato `docs/BUNDLE.md` nella stessa PR
- [ ] `pwsh scripts/generate-bundle.ps1 --check` esce con exit code 0
- [ ] `pwsh scripts/aggregate-state.ps1 --check` esce con exit code 0 (se ho toccato `docs/state/` o file di stato)
- [ ] Se ho toccato `scripts/aggregate-state.ps1`: `bash scripts/test-aggregate-determinism.sh` passa (9/9) — **gate bloccante in CI**

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
pwsh scripts/post-merge.ps1 -Check          # audit read-only: residui post-merge (exit 14 con sporco, 0 pulito)
```

Se l'audit elenca worktree attive o branch `feat/*` / `fix/*` merged-orfani, eseguire la procedura canonica (§"♻️ Pulizia branch post-merge"). **Mai** confrontare contro il `main` locale: dopo un merge via GitHub UI il `main` locale è stale e ogni check diverge (vedi Tabella F7 nell'errore E3/E4/E5 del D.26.4).

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
        ├── aggregate-state.ps1      ← aggregatore lazy-state (ADR-0008): genera blocchi in SESSIONS.md + BACKLOG.md
        ├── post-merge.ps1          ← procedura canonica post-merge (allinea main, rimuove worktree e branch)
        └── test-post-merge.sh      ← 9 scenari (T1..T9) su repo temporanei che coprono E3/E4/E5/F7 + squash

## 🚀 Primo task di un agente

1. Leggi questo file
2. Esegui il protocollo di claim (§"🎫 Presa in carico delle story"): ottieni il claim della prima issue `agent-ready` **libera** secondo l'ordine di `docs/11-BACKLOG.md` §"Priorità di lavorazione" — una issue è libera se non ha `in-progress` né `status:*` (vedi §"📦 Macchina a stati delle issue (status:*)")
3. **Crea una worktree isolata** con `pwsh scripts/setup-worktree.ps1 <N>` (vedi §"🌳 Worktree workflow" qui sotto) — **non usare** `git checkout -b` sul main repo. La worktree elimina i failure mode E3/E4/E5 (DATA-LOSS post-merge) documentati in D.26.4.
4. Leggi la specifica del task e implementa con test (nella worktree)
5. Apri PR dalla worktree (rimuovendo `agent-ready` e aggiungendo `status:in-review` all'issue) con `Closes #N` nel body
6. Al merge: GH Action `auto-status-done` applica automaticamente `status:done` + GH Action `auto-state-aggregate` rigenera SESSIONS/BACKLOG/INDEX/BUNDLE; tu fai `release:` comment + **procedura canonica post-merge** (`pwsh scripts/post-merge.ps1 -Branch <branch> -IssueNumber <N>` dalla working copy principale: allinea `main`, smonta la worktree, elimina i branch locale e remoto) (vedi §"📤 Post-merge actions" e §"♻️ Pulizia branch post-merge")

Se non ci sono issue `agent-ready` libere, apri issue con label `needs-spec`. **Mai iniziare a lavorare una story senza un claim valido** (ADR-0006).

## 🌳 Worktree workflow

Da Sessione 27 (issue #53, PR #54), ogni agente lavora in una **worktree isolata** invece di una working copy condivisa. Questo elimina per costruzione i failure mode E3/E4/E5 che hanno causato il DATA-LOSS documentato in issue #45 (vedi D.26.4 in SESSIONS.md).

### Perché worktree

- **Isolamento fisico**: il WIP di un agente non è toccabile dalle operazioni di un altro agente (`git checkout main`, `git reset --hard`, ecc.). Vedi issue #45.
- **Nessuna contesa su file locali**: più agenti su issue diverse lavorano in directory separate senza interferenze.
- **Cleanup esplicito**: `git worktree remove --force ../ls-<N>-<slug>` dopo il merge.

### Flusso operativo

```powershell
# PRIMA di lavorare sulla issue, crea la worktree:
pwsh scripts/setup-worktree.ps1 53
# Output: cd ../ls-53-worktree-default + gh claim command

cd ../ls-53-worktree-default
# claim (ADR-0006):
gh issue edit 53 --add-label in-progress
gh issue comment 53 --body "claim: kilo-HP-ELITEBOOK-xxxx (UTC ...) — worktree: C:\..\ls-53-..."

# lavora nel branch feat/53-worktree-default (pushato automaticamente da setup-worktree.ps1)
# ... scrivi codice, test, AGENTS.md updates ...
git add -A
git commit -m "feat: ..."
git push  # hook pre-push: BUNDLE auto-regen se docs/ hai cambiato

# apri PR (Closes #N nel body)
gh pr create --base main --head feat/53-worktree-default --title "..." --body "Closes #53 ..."
```

### Parametri di `setup-worktree.ps1`

| Parametro | Default | Note |
|---|---|---|
| `-IssueNumber` (pos 0) | obbligatorio | numero issue da claimare |
| `-Slug` | derivato dal titolo | kebab-case, max 40 char |
| `-BaseBranch` | `origin/main` | branch da cui creare la worktree |
| `-BranchName` | `feat/<N>-<slug>` o `fix/<N>-<slug>` | nome del branch di lavoro |
| `-WorktreePath` | `../ls-<N>-<slug>` | path della worktree |
| `-SkipGhCheck` | off | salta validazione `gh` (per test) |
| `-NoPush` | off | non eseguire push early (D.20.2) |

### Validazioni applicate

Lo script fallisce (exit code 2-7) se:
- L'issue non esiste o non è `agent-ready` o ha `in-progress` o `status:*`
- Il branch base non esiste (fetch non eseguito)
- Il path della worktree è già esistente
- `git worktree add` fallisce

Vedi `scripts/test-setup-worktree.sh` per gli scenari coperti (8 test).

### Backward compatibility

Il vecchio flusso `git checkout -b feat/<N>-<slug>` su main è **deprecato** ma ancora funzionante (nessuna enforcement nel pre-push). Tuttavia:

- ⚠️ **NON È RACCOMANDATO** per lavoro parallelo (causa esattamente i failure mode E3/E4/E5)
- Le difese advisory (`.githooks/post-checkout` + `scripts/safe-branch-switch.ps1`) restano in piedi come safety net ma sono **ridondanti** se la worktree è usata correttamente
- Vedi §"⚠️ Deprecazione" per il piano di rimozione

### Cleanup della worktree (post-merge)

La worktree va rimossa **dalla working copy principale**, mai da dentro se stessa: `scripts/post-merge.ps1` esegue il cleanup completo (worktree → `main` → branch) ed esce 15 se invocato da dentro una worktree (§"♻️ Pulizia branch post-merge").

## 📤 Post-merge actions

Dopo che il Boss mergia la PR, le azioni post-merge sono **a 3 livelli**:

### Livello 1 — Automazioni GH Action (no intervento manuale)

Dopo il merge di una PR su `main` girano **quattro** workflow. Tre scattano sul `pull_request: closed` e uno è pianificato.

| Workflow | Trigger | Cosa fa |
|----------|---------|---------|
| `auto-status-done` | PR merged | Applica `status:done` alle issue chiuse dalla PR (`Closes/Fixes/Resolves`) e **rimuove `agent-ready`, `in-progress` e `status:in-review`**; emette il commento `release:` estraendo l'agent-id dalla claim `claim:` dell'issue |
| `auto-branch-cleanup` | PR merged | Elimina il **branch remoto** della PR, con guard su `main`/`release/*`/`hotfix/*`, sui branch di fork e sui branch usati come base di un'altra PR aperta |
| `auto-state-aggregate` | push su `main` con paths `docs/state/**` o `scripts/aggregate-state.ps1` | Rigenera i blocchi `<!-- AGGREGATE-* -->` in `docs/SESSIONS.md` + `docs/11-BACKLOG.md` (V1) + `docs/INDEX.md` + `docs/BUNDLE.md` (V2) e committa il diff con identity `kilo-bot[bot]` |
| `stale-claim-sweeper` | cron giornaliero + dispatch manuale | Elenca in job summary le claim `in-progress` ferme da >12h (TTL di ADR-0006). **Advisory**: non rimuove label — il rilascio resta una decisione dell'agente che subentra |

Dettagli e motivazioni:

1. **`auto-status-done` e la mutua esclusività (ADR-0007)**: prima rimuoveva solo `in-progress` e `status:in-review`. Un agente che apriva la PR dimenticando di togliere `agent-ready` lasciava l'issue con `agent-ready + status:done` — stato non previsto dalla macchina a stati, e l'issue restava nella query dei candidati, quindi **un altro agente poteva claimare un lavoro già completato**. Ora rimuove tutte e tre.

2. **Il commento `release:` è automatico**: prima era un passo manuale e il più spesso dimenticato. Il workflow legge l'ultimo commento `claim:` dell'issue, ne estrae l'agent-id e posta `release: <AGENT-ID> - PR #N merged (<sha>)`. Idempotente: se il commento esiste già per quella PR, salta.

3. **`auto-branch-cleanup`** replica il checkbox "Delete branch when merging" di GitHub. Elimina **solo il ref remoto**: branch locali e worktree restano responsabilità dell'agente che le possiede (vedi `scripts/post-merge.ps1`).

4. **`stale-claim-sweeper`** applica il TTL di 12h di ADR-0006, che era documentato ma non controllato da nulla. Non rimuove la label di proposito: un agente che lavora da >12h su un task pesante non deve perdere la claim per merito del timer. Segnala e lascia decidere.

I workflow sono validati in CI da `node scripts/validate-workflows.mjs .github/workflows`, che estrae i blocchi `script:` di `github-script` e ne verifica la sintassi JS emulando il wrapper async reale: senza, un errore JS in un workflow si scoprirebbe solo a runtime, dopo il merge.

### Livello 2 — Issue (release + label)

3. **Non devi più fare niente su GitHub**: il livello 1 ha già applicato `status:done`, rimosso `agent-ready`/`in-progress`/`status:in-review` e pubblicato il commento `release:` con l'agent-id e il merge commit SHA. Resta solo la pulizia git locale.

### Livello 3 — Verifica (post-merge sanity check)

4. **Verifica statale post-merge** (sostituisce l'ex "Verifica statale post-merge" v1.7):
     ```powershell
     # 4a. Aggregator in sync (post GH Action auto-state-aggregate)
     pwsh scripts/aggregate-state.ps1 --check
     # 4b. Bundle in sync
     pwsh scripts/generate-bundle.ps1 --check
     # 4c. Nessun residuo post-merge (worktree attive, branch merged, main locale stale)
     pwsh scripts/post-merge.ps1 -Check    # exit 14 se c'e' da pulire, 0 se pulito
     ```
   Se uno qualsiasi fallisce, **intervieni**:
   - (4a) drift su SESSIONS/BACKLOG/INDEX/BUNDLE → `pwsh scripts/aggregate-state.ps1` localmente + commit (doc-sync di emergenza; il workflow dovrebbe averlo gia fatto)
   - (4b) drift su BUNDLE → `pwsh scripts/generate-bundle.ps1` + commit (BUNDLE.md e autogestito, drift indica file `$files` non allineato)
   - (4c) residui post-merge → `pwsh scripts/post-merge.ps1 -Branch <branch> -IssueNumber <N>` (vedi §"♻️ Pulizia branch post-merge")

### Regola fondamentale — NO commit su `main`

**Niente commit su `main` da parte degli agenti**. Il doc-sync finale è gia nel branch PR (vedi §"📝 Checklist di auto-revisione PR"). L'unica eccezione sono le GH Action `auto-status-done` e `auto-state-aggregate`, che committano automaticamente (con bot identity `kilo-bot[bot]`) e sono autorizzate dal PAT. Per situazioni di recovery (es. fix drift che GH Action non ha committato), apri una PR `docs:` separata invece di committare su `main`.

Vedi §"🛡️ Hardening multi-agente" (S21) per il contesto sul perché questa separazione (commit nel branch vs. label sull'issue vs. auto-commit GH Action) elimina le race condition.

## 🔄 Lazy-state aggregation (D.24.x + D.29.x + D.30.x)

Da Sessione 25 (2026-10-18), adottato **ADR-0008** per eliminare i conflitti di merge ricorrenti generati dal doc-sync IN PR su file globali. Vedi `docs/13-ADR/0008-lazy-state-aggregation.md` per la spec completa.

**V2** (Sessione 29, issue #52): estensione a `docs/INDEX.md` (status + roadmap) e `docs/BUNDLE.md` (inventory). I 5 file globali sono ora tutti aggregator-managed.

**Robustezza** (Sessione 30, issue #58+#60): fix CRLF in `StringBuilder.AppendLine` + workflow `auto-state-aggregate` step 6 parse error. Garantito LF-only output + workflow end-to-end funzionante.

### Regola d'oro (vincolante per tutti gli agenti da S25 in poi, estesa V2 da S29)

**Le PR di implementazione **NON** toccano direttamente `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`, `docs/BUNDLE.md`.** Modificano invece solo:

- I file nelle rispettive aree tecniche (`apps/*`, `packages/*`, `scripts/*`, ...)
- I file in `docs/state/sessions/<N>-<slug>.md` (se la PR documenta una sessione)
- I file in `docs/state/stories/<id>-<slug>.md` (se la PR chiude una story)

I file globali vengono **rigenerati automaticamente** dopo il merge dalla GH Action `auto-state-aggregate.yml`, che esegue `pwsh scripts/aggregate-state.ps1` e committa eventuali blocchi `<!-- AGGREGATE-* -->` drift.

### Target V1 + V2

| File | Blocchi gestiti | Versione |
|------|----------------|----------|
| `docs/SESSIONS.md` | `<!-- AGGREGATE-SESSIONS-{START,END} -->` | V1 |
| `docs/11-BACKLOG.md` | `<!-- AGGREGATE-STORIES-{START,END} -->` | V1 |
| `docs/INDEX.md` | `<!-- AGGREGATE-INDEX-STATUS-{START,END} -->` | V2 |
| `docs/INDEX.md` | `<!-- AGGREGATE-INDEX-ROADMAP-{START,END} -->` | V2 |
| `docs/BUNDLE.md` | `<!-- AGGREGATE-BUNDLE-INVENTORY-{START,END} -->` | V2 |

### Eccezione

Le PR di introduzione V1 (`#24`, S25) e V2 (`#52`, S29) sono le uniche che toccano direttamente i file globali (necessario per inserire i marker `<!-- AGGREGATE-* -->`). Dopo S29, vietato modificare i blocchi globali a mano.

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
pwsh scripts/aggregate-state.ps1 --check --strict  # fallisce anche sul drift "lenient"
pwsh scripts/aggregate-state.ps1 --dry-run    # preview senza scrivere
pwsh scripts/aggregate-state.ps1              # scrivi (idempotente: 0 diff se nulla e' cambiato)
```

CI gate bloccante in `.github/workflows/ci.yml` (introdotto in #51). Se la PR modifica solo `docs/state/`, lo script esce 0 e non blocca. Se per errore un agente modifica direttamente `SESSIONS.md`, `BACKLOG.md`, `INDEX.md` o `BUNDLE.md`, lo script rileva drift e fallisce.

### Determinismo e idempotenza *(vincolante — issue #70)*

L'aggregator è la linfa dorsale del workflow parallelo: se produce output diverso a parità di input, due agenti su piattaforme diverse generano drift opposti e conflitti ricorrenti proprio sui file globali. Tre garanzie, ciascuna coperta da un test:

| Garanzia | Perché | Test |
|----------|--------|------|
| **Ordinamento per valore** (sessioni per `Number`, story per `[version]$Id`, tie-break su `Base`) | L'ordine di enumerazione del filesystem non è garantito: senza sort per valore lo stesso input produceva `0.3,0.5,0.6` su Linux e `0.6,0.5,0.3` su Windows | T1, T2, T6 |
| **Idempotenza byte-identica** (il timestamp `Ultima aggregazione` viene riusato quando il blocco non cambia altro) | Senza questo, ogni run produceva un diff e `auto-state-aggregate` committava a vuoto su `main` | T3 |
| **Degradazione invece di crash** su file `state/` malformati (`Get-Frontmatter`) | Un singolo file corrotto faceva crashare l'intera aggregazione, bloccando anche il workflow post-merge | T5 (più il guard `Get-Frontmatter`) |

```bash
bash scripts/test-aggregate-determinism.sh    # 9 assert, gate bloccante in CI
```

**Se tocchi `scripts/aggregate-state.ps1`, il test è bloccante**: eseguilo prima di aprire la PR. Il gate `--check` resta warning-only in CI per incompatibilità residue PS 5.1 vs 7 (issue #63, risolto strutturalmente da #66); il test di determinismo copre invece la stessa classe di bug in modo affidabile, perché confronta l'output **dentro la stessa piattaforma**.

### GH Action auto-state-aggregate (post-merge auto-commit)

Dopo ogni push su `main` con paths `docs/state/**` o `scripts/aggregate-state.ps1`, la GH Action:
1. Esegue `pwsh scripts/aggregate-state.ps1 --check` (rileva drift)
2. Esegue `pwsh scripts/aggregate-state.ps1` (applica i blocchi corretti)
3. Rileva il diff con `git diff --name-only`
4. Se modificato, committa e pusha con bot identity `kilo-bot[bot]`

Fissato in S30 (issue #58+#60): exit 0 esplicito dopo warning + `if: always()` sul diff step + `if (git diff --cached --quiet)` syntax fix PowerShell + `-replace CRLF, LF` in tutti gli script di write.

### Checklist PR aggiuntiva (D.24.x + D.29.x + D.30.x)

- [ ] **NON** ho modificato direttamente `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`, `docs/BUNDLE.md` (a meno che non sia la PR di introduzione ADR-0008 stessa)
- [ ] Se la PR tocca una sessione, ho aggiornato/creato il file `docs/state/sessions/<N>-<slug>.md` corrispondente
- [ ] Se la PR chiude una story, ho aggiornato/creato `docs/state/stories/<id>-<slug>.md` con frontmatter aggiornato (stato, PR number, merge_commit, merged_date)
- [ ] Ho eseguito `pwsh scripts/aggregate-state.ps1 --check` localmente: exit 0
- [ ] Se ho toccato `scripts/aggregate-state.ps1`: `bash scripts/test-aggregate-determinism.sh` passa (determinismo + idempotenza, issue #70)
- [ ] Se ho aggiunto un nuovo file in `docs/state/` o `scripts/aggregate-state.ps1`, ho aggiornato `scripts/generate-bundle.ps1` `$files` + rigenerato `BUNDLE.md`

## 🛡️ Session start checklist

Prima di iniziare a lavorare su un'issue claimata, esegui i seguenti **5 check** per catturare precocemente i failure mode del parallelismo:

```powershell
git status                          # working tree clean? (F3, F5)
git branch --show-current           # sul branch giusto? (F1)
git fetch origin && git status -uno # main stale? (F4)
gh issue view <N> --jq .state       # issue ancora nostra e aperta? (F7)
git worktree list                   # non in worktree di un altro agente? (F8, post-#54)
```

Tutti e 5 i check devono tornare positivi. Se qualcosa non torna, risolvere **prima** di modificare file.

**Opzionale (se si ritorna dopo un merge di un altro agente)**: audit dei residui post-merge prima di iniziare lavoro nuovo — exit 14 indica branch/worktree merged-orfani da pulire con `pwsh scripts/post-merge.ps1 -Check` (vedi §"♻️ Pulizia branch post-merge").

## 📞 Contatti

- Project owner: `@amedeo82`
- Per decisioni strategiche: aspetta review sulla PR
- Per questioni tecniche: usa le issue
- Per ambiguità di specifica: issue `needs-spec`

---

*Ultimo aggiornamento: v1.13 — residui post-merge e base stale (issue #76, Sessione 36). Chiusi due buchi: `post-merge.ps1 -Check` non guardava i branch **locali** (due orfani sopravvissuti indisturbati), e `setup-worktree.ps1` non faceva mai `fetch` prima di validare `-BaseBranch origin/main` (base stale **silenziosa**).
- `post-merge.ps1 -Check`: nuova classe di residui "branch LOCALE orfano", con garanzia anti-perdita (0 commit unici **E** non checked-out in nessuna worktree)
- `setup-worktree.ps1`: `git fetch` prima della validazione del branch base, flag `-SkipFetch`, avviso esplicito quando la base può essere stale, e funzione `Write-Warn` che **mancava** (bug runtime)
- `scripts/test-issue-76-residue.sh` (nuovo, 9 assert) + gate bloccante in CI; copre il caso di sicurezza: un branch con lavoro non pushato **non deve mai** essere segnalato come orfano
- Nota: l'allineamento di `main` in post-merge **esisteva già** (passi 2-3 di `post-merge.ps1`); il buco era altrove, nella creazione della worktree

*Precedente v1.12 — automazioni post-merge (issue #73, Sessione 35). `auto-status-done` ora rimuove anche `agent-ready` (ADR-0007) e emette il `release:` automatico; aggiunti `auto-branch-cleanup` e `stale-claim-sweeper` (TTL ADR-0006, advisory); `scripts/validate-workflows.mjs` in CI.*
- §"📤 Post-merge actions" Livello 1 riscritto come tabella dei 4 workflow con trigger, effetti e motivazione; Livello 2 ridotto alla sola pulizia git locale
- §"♻️ Pulizia branch post-merge": dichiarato esplicitamente cosa è automatico (ref remoto) e cosa resta all'agente (worktree + branch locale)
- `scripts/validate-workflows.mjs` (nuovo) + gate bloccante in CI: un errore JS in un workflow si scoprirebbe altrimenti solo a runtime, dopo il merge

*Precedente v1.11 — determinismo e idempotenza dell'aggregator (issue #70, Sessione 34). Cinque cause corrette: `$Id` invece di `$_.Id` nell'ordinamento story (output divergente Linux vs Windows), timestamp non-idempotente (commit-rumore su `main`), fallback mojibake per il campo `state`, crash su file `state/` malformati, e lenient match che mascherava il drift come `[OK]`. Aggiunto `scripts/test-aggregate-determinism.sh` (9 assert) come gate bloccante in CI.
- §"🔄 Lazy-state aggregation": nuova sottosezione "Determinismo e idempotenza" con tabella delle 3 garanzie e relativi test
- `--strict` aggiunto ad `aggregate-state.ps1` (il lenient match ora emette `[WARN]` visibile invece di `[OK]`)
- `Get-Frontmatter`: degrada a default con warning invece di crashare su frontmatter malformato
- Checklist PR: nuovo item bloccante se si tocca `scripts/aggregate-state.ps1`

*Precedente v1.10 — procedura canonica post-merge (Sessione 33, review Boss): mancava l'aggiornamento di `main` prima del delete branch. §"♻️ Pulizia branch post-merge" ristrutturata in 8 passi vincolanti + `scripts/post-merge.ps1` (fail-closed, idempotente) + `scripts/test-post-merge.sh` (9 scenari).
- Nuovo `scripts/post-merge.ps1` e `scripts/test-post-merge.sh` (9 scenari T1..T9)
- §"♻️ Pulizia branch post-merge" completamente ristrutturata in 8 passi ordinati (zero-WIP → worktree → fetch → allineamento main → verifica merge → delete remoto → delete locale → prune) con tabella dei failure mode E/F + eccezioni + exit code
- §"📤 Post-merge actions" Livello 2/3, §"📝 Checklist di sincronizzazione" auto-check post-merge, §"🚀 Primo task" step 6 aggiornati per riferirsi al nuovo script
- §"🛡️ Session start checklist": aggiunto audit post-merge opzionale (`post-merge.ps1 -Check`)
- Bug fix nell'analogia condivisa: `git branch -r --merged main` (che usava il main locale stale) sostituito da check contro `origin/main`

*Precedente v1.9 Sessione 30 (2026-10-19) — cleanup completo del workflow (issue #60 + audit v1.9); dettagli:
- §"🚀 Primo task" step 3 aggiornato: worktree setup via `setup-worktree.ps1 <N>` invece di `git checkout -b` (post-#53); step 6 aggiornato per riflettere il 3-livello post-merge (auto-status-done + auto-state-aggregate + agent release)
- §"📤 Post-merge actions" completamente ristrutturato in 3 livelli (automatizzazioni GH Action / issue / verifica) con regola "NO commit su main" piu esplicita; aggiunto il check del auto-state-aggregate (prima mancante)
- §"🔄 Lazy-state aggregation" aggiornato a v1.9: include V2 (5 target) + robustness section (S30 fix CRLF + workflow parse error); aggiunto il dettaglio del GH Action auto-state-aggregate (prima implicito)
- §"🛡️ Session start checklist" estesa a 5 check: aggiunto `git worktree list` (F8, post-#53)
- §"🪝 Pre-commit hook" pattern `main` chiarito: solo GH Action con identity `kilo-bot[bot]`, vietato per agenti umani
- Footer v1.7 → v1.9: changelog cumulativo di S27 (worktree), S28 (PR template + CODEOWNERS), S29 (ADR-0008 V2), S30 (CRLF + workflow fix)
- Cross-ref consolidati: `auto-state-aggregate.yml` esplicitamente referenziato in Post-merge + Lazy-state sections (prima implicito)

*Precedente v1.6 Sessione 21 (2026-10-17): refactor catena (D1 doc-sync IN PR + D2 GH Action `auto-status-done` + D3 pre-commit clean check + D4 pre-push BUNDLE auto-regen + D5 pre-push base-stale warning); nuova sezione §"📤 Post-merge actions"; §"🚀 Primo task" step 6 semplificato (GH Action automatizza label transitions); §"Checklist di sincronizzazione" aggiornata (doc-sync preferito nel branch, no race su main)*