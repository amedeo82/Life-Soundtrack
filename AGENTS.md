# 🤖 AGENTS.md — Protocollo per Agenti di Sviluppo

> **Questo è il primo file che un agente deve leggere, prima di qualsiasi altro.**
> **Versione 1.31 — Sessione 73 (2026-10-31)**

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

**La keyword deve comparire una sola volta nel body, nuda, in una riga propria** (tipicamente subito sotto `## Issue`):

```
Closes #42
```

Non ripeterla **dentro backtick**, dentro una **casella di checklist**, o in una frase come "body PR include `Closes #N`": GitHub non la riconosce e l'issue resta `OPEN` dopo il merge, nonostante la checklist risulti spuntata. È successo con PR #91 (issue #90, merge `a778add`, 2026-10-21): la chiusura è stata fatta a mano con l'audit retroattivo qui sotto.

**Attenzione anche in senso inverso**: se la keyword compare *altrove* (in una descrizione, in una citazione), `auto-status-done.yml` la interpreta come una chiusura anche per quell'altra issue e le applica `status:done` + un commento `release:` spurio (è successo con PR #93 → issue #90, chiusa a mano dopo aver rimosso il commento). Per **citare** la keyword senza attivarla, spezzala: `` `Closes` #N `` invece di `` `Closes #N` ``.

**Auto-check prima di aprire la PR** (deve restituire **esattamente una** riga):

```powershell
$hits = @(gh pr view <N> --json body --jq .body | Select-String '^\s*(Closes|Fixes|Resolves)\s+#\d+\s*$')
$hits.Count -eq 1   # 0 = l'issue non verra chiusa; >1 = transizioni su issue sbagliate
```

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
- [ ] **NON ho modificato i blocchi `<!-- AGGREGATE-* -->`** di `docs/INDEX.md`, `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/BUNDLE.md` (regola ADR-0008: lo stato si cambia solo in `docs/state/<propria>/*`)
- [ ] **Ho allineato le sezioni legacy** che la mia PR rende false: stato/count/versioni/riferimenti in `INDEX.md` §"Dettaglio (legacy)", tabella "roadmap" e righe `**Stato**:` in `11-BACKLOG.md` (vedi §"Chi può scrivere cosa nei file globali")
- [ ] **Se ho toccato `README.md` o le piattaforme importabili**: la prosa del README è in sync con il codice — `node scripts/check-readme-facts.mjs` esce 0 (gate bloccante in CI, issue #161). Le capability non implementate stanno nella sezione roadmap, i conteggi non sono duplicati in prosa (vedi §"Ownership del `README.md`")
- [ ] **Il body della PR contiene la keyword di chiusura come riga nuda e una sola volta** — `Closes #N` (o `Fixes #N` / `Resolves #N`), **fuori da backtick, fuori dalle checklist e senza ripetizioni**, così GitHub chiude l'issue al merge e `auto-status-done` non transiziona issue non collegate (vedi §"📦 Macchina a stati delle issue (status:*)" → "Chiusura al merge")
- [ ] **Se ho aperto la PR**: prima dell'apertura ho rimosso `agent-ready` e aggiunto `status:in-review` all'issue (vedi §"📦 Macchina a stati delle issue (status:*)")
- [ ] **Se ho aggiunto/rimosso/rinominato un file in `docs/`, `fixtures/` o root**: ho aggiornato l'array `$files` in `scripts/generate-bundle.ps1` e rigenerato `docs/BUNDLE.md` nella stessa PR
- [ ] `pwsh scripts/generate-bundle.ps1 -Check` esce con exit code 0
- [ ] `pwsh scripts/aggregate-state.ps1 -Check` esce con exit code 0 (se ho toccato `docs/state/` o file di stato)
- [ ] Se ho toccato `scripts/aggregate-state.ps1`: `bash scripts/test-aggregate-determinism.sh` passa (9/9) — **gate bloccante in CI**

### Checklist di sincronizzazione documentazione al merge *(obbligatoria)*

La documentazione di stato (INDEX, SESSIONS, BACKLOG, 18-DEV-LOG, BUNDLE) **deve riflet-care lo stato reale del branch `main` subito dopo ogni merge**. Senza questo gate la documentazione diverge silenziosamente e gli agenti futuri leggono uno stato falso.

Chi esegue il merge (o chi chiude la PR) è responsabile di aggiornare **nella stessa PR, prima del merge** (o in un commit di follow-up immediatamente successivo se il merge è già avvenuto) i seguenti file, in base a cosa è cambiato:

| Cosa è cambiato nella PR | File da aggiornare |
|---|---|
| Stato di una story (es. ⬚→🟡, 🟡→✅, ✅→⬚) | `docs/state/stories/<id>-<slug>.md` (fonte) + `docs/11-BACKLOG.md` (rimuoverla dalla tabella "roadmap" e aggiornare la riga `**Stato**:` della sezione Story) |
| Stato di una story | `docs/INDEX.md` §"Dettaglio (legacy)" (conteggi, "Prossimo step tecnico") — i blocchi `AGGREGATE-*` si aggiornano da soli |
| Chiusura di una sessione | `docs/state/sessions/<N>-<slug>.md` (fonte) + `docs/SESSIONS.md` (blocco aggregato, automatico) |
| Aggiunta/rimozione di un documento in `docs/` | `docs/INDEX.md` §"Documenti fondamentali" / "Documenti di supporto" + `scripts/generate-bundle.ps1` (`$files`) |
| Aggiunta/rimozione di una **piattaforma importabile** o di una capability | `README.md` §"Cosa c'è oggi" / §"Roadmap" — la **prosa**, mai il blocco `AGGREGATE-NEXT-STEP-*` (vedi §"Ownership del `README.md`") |
| Branch mergato o PR chiusa | `docs/18-DEV-LOG.md` (§4 entry: branch → "merged", PR → numero, aggiungere commit) + **eliminare il branch remoto** (vedi §"♻️ Pulizia branch post-merge") |
| Qualsiasi modifica al **contenuto** di `docs/`, `AGENTS.md`, `README.md`, `fixtures/`, `LICENSE` | `docs/BUNDLE.md` (rigenerare con `pwsh scripts/generate-bundle.ps1`) |
| Modifica alla struttura (aggiunta/rimozione file in `docs/`, `fixtures/`, root) | Anche `scripts/generate-bundle.ps1` (`$files`) — vedi sotto |
| Modifica al toolchain o alla policy di versionamento | `docs/17-DEV-NOTES.md` + nuova entry in `SESSIONS.md` |
| Issue chiusa al merge | `status:done` applicato (vedi §"📦 Macchina a stati delle issue (status:*)"); rimozione `agent-ready` |

**Regola operativa**: se una PR tocca codice, schema, policy o stato di story, allora tocca anche documentazione. La PR senza aggiornamenti di stato è **incompleta**.

**Perché la tabella distingue aggregato da legacy**: i blocchi `AGGREGATE-*` si aggiornano da soli post-merge, quindi chiederne la modifica manuale crea solo drift e fallisce il gate `-Check`. Le sezioni legacy non hanno un generatore: se un agente le ignora, invecchiano senza che nessun gate se ne accorga (è successo tra S22 e S38, issue #84 e #90). Vedi §"Chi può scrivere cosa nei file globali".

**Doc-sync nel branch (preferito, vedi Sessione 21 D.21.1)**: il doc-sync finale (con PR number e merge commit hash) va committato nel branch della PR, NON come commit separato su `main` (vedi §"📤 Post-merge actions"). L'eccezione "commit di follow-up immediatamente successivo" è declassata a fallback sconsigliato per race con altri agenti in parallelo.

**Auto-check**: prima del merge, eseguire localmente

```powershell
pwsh scripts/generate-bundle.ps1 -Check   # exit 0 = documentazione in sync
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
   pwsh scripts/generate-bundle.ps1 -Check
   ```
   Exit code 0 = in sync, 1 = da rigenerare, 2 = file dichiarati mancanti.

3. **Workflow di manutenzione completo**: vedi `docs/12-DEVOPS.md §9`.

### ⚠️ L'ordine dei due generatori è vincolante *(Sessione 73, issue #224)*

`docs/INDEX.md` è **sia** un file in `$files` **sia** un target dell'aggregator. Quindi:

```
pwsh scripts/aggregate-state.ps1     # 1° : scrive i blocchi AGGREGATE-* in INDEX.md
pwsh scripts/generate-bundle.ps1     # 2° : copia INDEX.md (con i blocchi nuovi) dentro BUNDLE.md
```

Nell'ordine inverso (`generate-bundle` prima) la copia di `docs/INDEX.md` dentro `docs/BUNDLE.md`
resta **stale** rispetto ai blocchi appena riscritti, e `generate-bundle.ps1 -Check` **fallisce**
con «non è in sync» anche se i due generatori hanno girato entrambi e nessuno dei due file è
"rotto". È la stessa classe dell'ordinamento fra i due writer di `main` (issue #149), in versione
locale: il `pre-push` hook rigenera il bundle da solo, quindi se l'aggregator non ha girato dopo
l'ultima modifica a `docs/INDEX.md` il bundle ne copia una versione vecchia.

**Regola operativa**: quando tocchi `docs/state/`, `docs/INDEX.md`, `docs/SESSIONS.md`,
`docs/11-BACKLOG.md` o `README.md`, lancia **prima** l'aggregator e **poi** il generatore del
bundle, e verifica **entrambi** i check:

```powershell
pwsh scripts/aggregate-state.ps1
pwsh scripts/generate-bundle.ps1
pwsh scripts/aggregate-state.ps1 -Check    # exit 0
pwsh scripts/generate-bundle.ps1 -Check    # exit 0
```

Non serve intervenire sullo script se modifichi solo il **contenuto** di un file già elencato (lo script lo rilegge). Intervieni solo se aggiungi/rimuovi file.

### 📦 D.26.3 — Bundle regeneration obbligatoria in stessa PR *(lesson learned)*

**Regola**: ogni PR che modifica il **contenuto** di uno qualsiasi dei file elencati in `$files` (`docs/`, `AGENTS.md`, `README.md`, `fixtures/` foundational, `scripts/*`, `LICENSE`) **deve rigenerare `docs/BUNDLE.md` nello stesso commit** (o in un commit di follow-up immediato prima del merge), per evitare il fail di `pwsh scripts/generate-bundle.ps1 -Check` in CI.

**Perché è importante**: il check del bundle è un **CI gate bloccante** (vedi `docs/12-DEVOPS.md §9` + §"📝 Checklist di auto-revisione PR" riga "BUNDLE check exit 0"). Una PR che modifica `AGENTS.md` senza rigenerare `BUNDLE.md` fallirà la pipeline quality anche se il codice di per sé è corretto, costringendo a un commit di fix che prolunga il ciclo di review.

**Procedura consigliata** (snippet per ogni PR docs):

```powershell
# Dopo aver modificato qualsiasi file in scope del bundle:
pwsh scripts/generate-bundle.ps1 -Check   # verifica locale: deve uscire 0

# Se esce != 0:
pwsh scripts/generate-bundle.ps1            # rigenera
git add docs/BUNDLE.md
git commit --amend                          # o commit separato nella stessa PR
git push
```

**Lezione operativa D.26.3 (Sessione 26, 2026-10-19, durante estensione di PR #44)**: l'agente ha modificato `AGENTS.md` (v1.6 → v1.7, D.26.1 + D.26.2) senza rigenerare `docs/BUNDLE.md`. La 1a run di CI quality è fallita con `pwsh scripts/generate-bundle.ps1 -Check` → `docs/BUNDLE.md non è in sync`. Fix richiesto: 3° commit della PR ha rigenerato il bundle (+8139 byte) e portato la pipeline a verde. **Costo evitabile**: ~5 minuti di review extra + rumore nella history della PR.

**Auto-check pre-push** (rafforzativo di D.4): il pre-push hook di `.githooks/pre-push` esegue già `generate-bundle.ps1 -Check` e blocca il push se drift. Se bypassi il hook con `LIFE_SOUNDTRACK_SKIP_HOOKS=1` (emergenza), esegui manualmente il check prima del merge.

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
        ├── check-readme-facts.mjs  ← gate read-only: confronta la prosa del README con il codice (issue #161)
        ├── test-post-merge.sh      ← 9 scenari (T1..T9) su repo temporanei che coprono E3/E4/E5/F7 + squash
        └── test-readme-facts-gate.sh ← 9 scenari (T1..T9) sul gate "fatti del README" (issue #161)

## 🚀 Primo task di un agente

1. Leggi questo file
2. Scegli la prima issue `agent-ready` **libera** secondo l'ordine di `docs/11-BACKLOG.md` §"Priorità di lavorazione" — libera = senza label `in-progress` né `status:*` (vedi §"📦 Macchina a stati delle issue (status:*)")
3. **Crea la worktree isolata** con `pwsh scripts/setup-worktree.ps1 <N>` (vedi §"🌳 Worktree workflow" qui sotto) — **non usare** `git checkout -b` sul main repo. La worktree elimina i failure mode E3/E4/E5 (DATA-LOSS post-merge) documentati in D.26.4. **Attenzione**: lo script valida che l'issue non abbia già `in-progress`, quindi va eseguito **prima** del claim (o con `-SkipGhCheck` se hai già claimato tu).
4. **Claima** l'issue (ADR-0006): `gh issue edit <N> --add-label in-progress` + commento `claim: <AGENT-ID> (UTC <timestamp>)`, poi **riverifica** (vince chi ha il commento con ID GitHub più basso)
5. Leggi la specifica del task e implementa con test (nella worktree)
6. Apri PR dalla worktree (rimuovendo `agent-ready` e aggiungendo `status:in-review` all'issue) con `Closes #N` nel body

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

Dopo il merge di una PR su `main` girano **cinque** workflow (al 2026-10-21; quattro PR-chiusi + due su push a main con concurrency group condiviso). Tre scattano sul `pull_request: closed` e due sono push-trigger serializzati.

| Workflow | Trigger | Cosa fa |
|----------|---------|---------|
| `auto-status-done` | PR merged | Applica `status:done` alle issue chiuse dalla PR (`Closes/Fixes/Resolves`) e **rimuove `agent-ready`, `in-progress` e `status:in-review`**; emette il commento `release:` estraendo l'agent-id dalla claim `claim:` dell'issue |
| `auto-branch-cleanup` | PR merged | Elimina il **branch remoto** della PR, con guard su `main`/`release/*`/`hotfix/*`, sui branch di fork e sui branch usati come base di un'altra PR aperta |
| `auto-state-aggregate` | push su `main` con paths `docs/state/**` o `scripts/aggregate-state.ps1` | Rigenera i blocchi `<!-- AGGREGATE-* -->` in `docs/SESSIONS.md` + `docs/11-BACKLOG.md` (V1) + `docs/INDEX.md` + `docs/BUNDLE.md` (V2) + `README.md` (V3, issue #127; committato a partire da issue #136) e committa il diff con identity `kilo-bot[bot]`. **Concurrency group `post-merge-main`** (con `cancel-in-progress: false`) introdotto in issue #115 per serializzare con `auto-bundle.yml`. La riga `git add` deve coprire **tutti** i `$targets` di `scripts/aggregate-state.ps1`: lo verifica `scripts/validate-workflows.mjs` (issue #136) |
| `auto-bundle` (issue #115) | push su `main` con paths che coprono `$files` (vedi §9.8b di `docs/12-DEVOPS.md`) **+ `workflow_run` su `auto-state-aggregate` completato** (issue #149) | Rigenera il **contenuto FILE** di `docs/BUNDLE.md` (`===== FILE: ... =====` sezioni) eseguendo `pwsh scripts/generate-bundle.ps1`. Idempotente via `git diff --quiet docs/BUNDLE.md`. Companion di `auto-state-aggregate`, serializzato via stesso concurrency group. Il trigger `workflow_run` (issue #149) garantisce che rigeneri **dopo** che l'aggregate ha committato i blocchi: il concurrency group serializza i run ma non ne impone l'ordine, e il bundle copia il contenuto dei file che l'aggregate modifica |
| `stale-claim-sweeper` | cron giornaliero + dispatch manuale | Elenca in job summary le claim `in-progress` ferme da >12h (TTL di ADR-0006). **Advisory**: non rimuove label — il rilascio resta una decisione dell'agente che subentra |

> **Sessione 73 (issue #224) — il bundle rigenera una volta sola.** `auto-bundle` ha due trigger
> (`push` e `workflow_run`) e, su un merge che tocca `docs/state/**`, partiva **due volte**
> (misurato: 20 s + 22 s). Il secondo run serve solo se l'aggregator ha prodotto un commit:
> è quello il caso in cui i blocchi aggregati sono cambiati e il bundle li deve copiare. Ora il
> run su `workflow_run` viene **saltato** quando `workflow_run.head_sha` coincide con
> `origin/main` (l'aggregator non ha pushato nulla ⇒ il run sul `push` ha già rigenerato il
> bundle da quello stato). Se l'aggregator è **fallito** si rigenera comunque: un fallimento
> può aver lasciato i blocchi a metà. Vedi `docs/12-DEVOPS.md §9.14`.

Dettagli e motivazioni:

1. **`auto-status-done` e la mutua esclusività (ADR-0007)**: prima rimuoveva solo `in-progress` e `status:in-review`. Un agente che apriva la PR dimenticando di togliere `agent-ready` lasciava l'issue con `agent-ready + status:done` — stato non previsto dalla macchina a stati, e l'issue restava nella query dei candidati, quindi **un altro agente poteva claimare un lavoro già completato**. Ora rimuove tutte e tre.

2. **Il commento `release:` è automatico**: prima era un passo manuale e il più spesso dimenticato. Il workflow legge l'ultimo commento `claim:` dell'issue, ne estrae l'agent-id e posta `release: <AGENT-ID> - PR #N merged (<sha>)`. Idempotente: se il commento esiste già per quella PR, salta.

3. **`auto-branch-cleanup`** replica il checkbox "Delete branch when merging" di GitHub. Elimina **solo il ref remoto**: branch locali e worktree restano responsabilità dell'agente che le possiede (vedi `scripts/post-merge.ps1`).

4. **`stale-claim-sweeper`** applica il TTL di 12h di ADR-0006, che era documentato ma non controllato da nulla. Non rimuove la label di proposito: un agente che lavora da >12h su un task pesante non deve perdere la claim per merito del timer. Segnala e lascia decidere.

I workflow sono validati in CI da `node scripts/validate-workflows.mjs .github/workflows`, che applica **cinque** controlli indipendenti sul testo dei workflow:

1. **Sintassi JS dei blocchi `script:` di `github-script`**, emulando il wrapper `async` reale (issue #73): senza, un errore JS in un workflow si scoprirebbe solo a runtime, dopo il merge.
2. **Copertura `git add` vs `$targets`** dell'agregator (issue #136): vedi §"🔄 Lazy-state aggregation → Target V1 + V2 + V3".
3. **Scope dichiarate in `permissions:`** (issue #135): ogni chiave deve essere una scope reale della `GITHUB_TOKEN`, ogni valore `read`/`write`/`none`. Una scope inesistente — per esempio `metadata`, che è sempre concessa e **non** è dichiarabile — non produce un job che fallisce: GitHub *rifiuta il file in fase di validazione*, quindi la run viene creata con `jobs: 0` e finisce `failure` a 0 secondi, senza log e senza annotazioni via API. Il sintomo è indistinguibile da "Actions rotta per billing" ed è la ragione per cui #135 ha spento tutti i gate di `ci.yml` per ~22 ore senza che nessuno se ne accorgesse. Test di scenario negativo: `scripts/test-workflow-permission-scopes.sh`.
4. **Sync con `origin/main` prima del push** (issue #140): ogni workflow che contiene `git push origin main` deve aver allineato il workspace a `origin/main` **prima** del push. Il concurrency group `post-merge-main` serializza i *run*, non i *checkout*, e `actions/checkout` senza `with: ref:` mette il workspace sul `github.sha` del merge commit: quando l'altra workflow ha già pushato sullo stesso merge, il push viene rifiutato con `non-fast-forward` e i blocchi aggregati restano indietro **in silenzio** (merge verde, CI verde, stato falso). `auto-state-aggregate.yml` ne era privo ed è stato il motivo per cui il doc-sync della Story 1.2 non è mai arrivato su `main`. Test di scenario negativo: `scripts/test-workflow-push-sync.sh`.
5. **Ordinamento fra i due writer di `main`** (issue #149): `auto-bundle.yml` deve dichiarare un trigger `workflow_run` su `auto-state-aggregate`, e il nome in `workflows:` deve combaciare con il `name:` reale del producer. Il concurrency group serializza i *run* ma **non ne impone l'ordine**, e `auto-bundle` copia il contenuto dei file che `auto-state-aggregate` modifica: senza il trigger, il bundle può copiare blocchi aggregati stale (caso reale: merge della PR #147, drift di 6 righe in `docs/BUNDLE.md`, silenzioso perché il gate sul bundle è warning-only). `workflow_run` è agganciato alla *conclusione* del workflow e quindi sopravvive alla soppressione del GITHUB_TOKEN. Test di scenario negativo: `scripts/test-workflow-writer-ordering.sh`.

### Livello 2 — Issue (release + label)

3. **Non devi più fare niente su GitHub**: il livello 1 ha già applicato `status:done`, rimosso `agent-ready`/`in-progress`/`status:in-review` e pubblicato il commento `release:` con l'agent-id e il merge commit SHA. Resta solo la pulizia git locale.

### Livello 3 — Verifica (post-merge sanity check)

4. **Verifica statale post-merge** (sostituisce l'ex "Verifica statale post-merge" v1.7):
     ```powershell
     # 4a. Aggregator in sync (post GH Action auto-state-aggregate)
     pwsh scripts/aggregate-state.ps1 -Check
     # 4b. Bundle in sync
     pwsh scripts/generate-bundle.ps1 -Check
     # 4c. Nessun residuo post-merge (worktree attive, branch merged, main locale stale)
     pwsh scripts/post-merge.ps1 -Check    # exit 14 se c'e' da pulire, 0 se pulito
     ```
   Se uno qualsiasi fallisce, **intervieni**:
   - (4a) drift su SESSIONS/BACKLOG/INDEX/BUNDLE → `pwsh scripts/aggregate-state.ps1` localmente + commit (doc-sync di emergenza; il workflow dovrebbe averlo gia fatto)
   - (4b) drift su BUNDLE → `pwsh scripts/generate-bundle.ps1` + commit (BUNDLE.md e autogestito, drift indica file `$files` non allineato)
   - (4c) residui post-merge → `pwsh scripts/post-merge.ps1 -Branch <branch> -IssueNumber <N>` (vedi §"♻️ Pulizia branch post-merge")

### 🏎️ La CI: 11 job in parallelo *(Sessione 73, issue #224)*

`ci.yml` è stato riorganizzato: era **un job unico con 18 step in sequenza** (misurato: **172 s**
di tempo pareggio sul runner), ora è **11 job** di cui **10 girano in parallelo** e l'undicesimo (`quality`)
è il check aggregatore.

| Job | Cosa contiene |
|---|---|
| 
ode-lint-typecheck | pnpm install + lint + 	ypecheck |\n| 
ode-test | pnpm install + 	est (**isolato**: nessun altro task CPU-bound condivide il processore) |\n| 
ode-build | pnpm install + uild |
| `gates-docs` | bundle in sync, lazy-state in sync, fatti del README (+ il suo scenario negativo) |
| `gates-aggregate` | `test-aggregate-determinism.sh` (37 assert) |
| `gates-bundle` | `test-bundle-check-idempotent.sh` (12 assert) |
| `gates-workflows` | `validate-workflows.mjs` + i 4 test di scenario negativo dei workflow |
| `gates-git` | `test-issue-76-residue.sh` + `validate-labels.mjs` |
| `gates-scripts` | `test-post-merge.sh` (29 assert) — la procedura più distruttiva del repo |
| `gates-procedure` | `test-setup-worktree.sh`, `test-pre-commit-clean-check.sh`, `test-safe-branch-switch.sh`, `test-appendline-lf-fix.ps1` |
| `quality` | **aggregatore**: fallisce esplicitamente se un job parallelo è fallito, annullato o saltato |

Tre cose da sapere quando si legge una pipeline verde:

1. **Il check da richiedere in branch protection resta `CI / quality`**: conserva il nome ed è
   l'aggregatore. I nuovi job hanno nomi propri e possono essere richiesti singolarmente.
2. **`quality` è fail-closed, non solo `skipped`**: senza il controllo esplicito sui risultati,
   `needs:` renderebbe `quality` *skipped* quando un job dipendente fallisce, e la branch
   protection può interpretare un check saltato come successo.
3. **I gate non richiedono `pnpm install`**: `scripts/validate-*.mjs` e
   `scripts/check-readme-facts.mjs` usano solo i moduli built-in di node. Solo il job `node`
   installa le dipendenze npm.

L'elenco completo dei 26 gate (per job, con bloccante/non-bloccante e issue di riferimento) è in
`docs/12-DEVOPS.md §9.10`; le misure di prestazione in `§9.14`.

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

### Chi può scrivere cosa nei file globali *(D.38.1 — vincolante, Sessione 38)*

La regola sopra vieta di toccare i **file** globali. Ma questi file contengono due tipi di contenuto con regole diverse, ed è proprio questa ambiguità a lasciare le sezioni legacy invecchiare in silenzio (drift corretto in Sessione 38, issue #90: `11-BACKLOG.md` dichiarava 0.4/0.6/0.7 `⬚ TODO` mesi dopo il merge).

| Tipo di contenuto | Dove si trova | Chi lo scrive | Regola |
|---|---|---|---|
| **Blocchi aggregati** | dentro `<!-- AGGREGATE-*-START -->` / `-END -->` | **solo** `scripts/aggregate-state.ps1`, in automatico post-merge | **Mai** a mano. `aggregate-state.ps1 -Check` fallisce (gate CI) e `auto-state-aggregate` sovrascrive il diff |
| **Sezioni legacy** | tutto il resto: prosa, tabelle statiche, changelog, `INDEX.md` §"Dettaglio (legacy)", tabella "roadmap" di `11-BACKLOG.md`, `18-DEV-LOG.md` | **l'agente**, nella stessa PR che cambia i fatti che dichiarano | **Allinearle è obbligatorio**, non facoltativo: se la sezione dichiara uno stato, un conteggio, una versione o un riferimento che la tua PR cambia, aggiornala in quella PR |

**Non è un allargamento di ADR-0008**: i blocchi aggregati restano vietati. La regola riguarda le sezioni legacy, che non hanno alcun generatore e quindi nessuno le aggiorna al posto tuo.

Esempi di obbligo concreto:

- cambi lo stato di una story → **rimuovila** dalla tabella "roadmap delle story non ancora completate" in `11-BACKLOG.md`, aggiorna la riga `**Stato**:` della sua sezione Story, e crea/aggiorna `docs/state/stories/<id>-<slug>.md`
- mergi una sessione → aggiorna il bullet "Prossimo step tecnico" e i contatori di `INDEX.md` §"Dettaglio (legacy)" se citano issue chiuse
- aggiungi o rimuovi un documento in `docs/` → aggiorna la tabella "Documenti fondamentali" / "Documenti di supporto" di `INDEX.md`

**Anti-pattern ricorrente**: duplicare in una sezione legacy un dato che un blocco aggregato già fornisce. Ogni duplicazione è una seconda fonte di verità che invecchia. Se il dato è già in un blocco `AGGREGATE-*`, **mettici un puntatore, non una copia**.

### Ownership del `README.md` *(D.161.1 — vincolante, Sessione 54, issue #161)*

`README.md` è **ibrido**: un file con due owner diversi nella stessa pagina. La confusione fra i due è la causa radice del drift chiuso dall'issue #161 — al 2026-10-27 il README dichiarava 8 piattaforme importabili (Deezer, Tidal, SoundCloud inesistenti) e capability non implementate (audio features, analisi, mood, ricordi), i merge delle Story 1.2 e 1.3 non l'avevano toccato, e i 16 gate di `ci.yml` restavano verdi lo stesso.

| Parte | Chi la scrive | Regola |
|---|---|---|
| Blocco `<!-- AGGREGATE-NEXT-STEP-* -->` | **solo** `scripts/aggregate-state.ps1`, post-merge | **Mai** a mano (V3, ADR-0008, issue #127) |
| **Tutta la prosa** (le altre sezioni) | **l'agente**, nella stessa PR che cambia i fatti che dichiarano | Sottoposta al gate `scripts/check-readme-facts.mjs` (read-only) |

**Le regole della prosa**:

- L'elenco delle piattaforme importabili (sottosezione "Piattaforme importabili" dentro "Cosa c'è oggi") deve corrispondere **esattamente** a `ACTIVE_PLATFORMS` in `apps/web/src/onboarding/OnboardingRouter.tsx`; ogni piattaforma deve avere una factory in `ADAPTER_FACTORIES` e una classe adapter in `packages/core/src/adapters/`.
- Una capability **non ancora implementata** (analisi, mood, ricordi, enrichment, audio features, valence, danceability, BPM) si dichiara **solo nella sezione roadmap**, mai come feature presente.
- La sezione "Stato del progetto" **non duplica conteggi** (`N/M`): i conteggi vivono nei blocchi aggregati di `docs/INDEX.md` e `docs/11-BACKLOG.md`; lì si mette un **puntatore**, non una copia (è l'anti-pattern sopra, applicato al README).
- Il blocco NEXT-STEP elenca la prima story **lavorabile** fra quelle già migrate in `docs/state/stories/`: non è la roadmap. Sono escluse le story `done` (completate), `blocked` (bloccate da una dipendenza esterna) e `wontdo` (scope cancellato): il blocco deve indicare **la prossima story da implementare**, non un vicolo cieco (issue #182). La prosa del README deve rendere esplicito questo punto, perché il lettore del repository cerca lì la "prossima story".

**Il gate**: `node scripts/check-readme-facts.mjs` — exit 0 = in sync, 1 = drift, 2 = errore di ambiente (fail-closed). È **bloccante in CI** (`.github/workflows/ci.yml`, step "Fatti del README in sync con il codice") e **non ha una modalità di scrittura**: è un verificatore, non un generatore. Un secondo writer sullo stesso file riprodurrebbe la race fra i writer di `main` risolta dall'issue #149.

```bash
node scripts/check-readme-facts.mjs     # verifica la prosa contro il codice
bash scripts/test-readme-facts-gate.sh  # scenario negativo del gate (T1..T9)
```

**Quando scatta**: ogni PR che aggiunge o rimuove una piattaforma importabile, o che dichiara una capability nel README, aggiorna la prosa del README **nella stessa PR** e fa passare il gate. Una PR che cambia `ACTIVE_PLATFORMS` senza toccare il README è una PR che il gate blocca — è esattamente il drift che l'issue #161 ha chiuso.

### Target V1 + V2 + V3

| File | Blocchi gestiti | Versione |
|------|----------------|----------|
| `docs/SESSIONS.md` | `<!-- AGGREGATE-SESSIONS-{START,END} -->` | V1 |
| `docs/11-BACKLOG.md` | `<!-- AGGREGATE-STORIES-{START,END} -->` | V1 |
| `docs/INDEX.md` | `<!-- AGGREGATE-INDEX-STATUS-{START,END} -->` | V2 |
| `docs/INDEX.md` | `<!-- AGGREGATE-INDEX-ROADMAP-{START,END} -->` | V2 |
| `docs/BUNDLE.md` | `<!-- AGGREGATE-BUNDLE-INVENTORY-{START,END} -->` | V2 |
| `README.md` | `<!-- AGGREGATE-NEXT-STEP-{START,END} -->` | V3 (issue #127) |

**Vincolante (issue #136)**: la riga `git add` di `.github/workflows/auto-state-aggregate.yml` deve contenere **tutti** i file di questa tabella. Due elenchi che descrivono lo stesso insieme di file senza un gate che li confronti è la classe di drift di ADR-0008 applicata agli strumenti: #127 ha aggiunto `README.md` come target e il workflow ha continuato a generare il blocco NEXT-STEP per poi scartarlo. Il gate è in `scripts/validate-workflows.mjs` (bloccante in CI); il test di scenario negativo è `scripts/test-workflow-git-add-coverage.sh`. Vedi `docs/12-DEVOPS.md` §9.8c.

### Eccezione

Le PR di introduzione V1 (`#24`, S25), V2 (`#52`, S29) e V3 (`#127`, S42) sono le uniche che toccano direttamente i file globali (necessario per inserire i marker `<!-- AGGREGATE-* -->`). Dopo S29, vietato modificare i blocchi globali a mano.

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
pwsh scripts/aggregate-state.ps1 -List       # audit: cosa verrebbe letto/scritto
pwsh scripts/aggregate-state.ps1 -Check      # CI gate: exit 0 = in sync
pwsh scripts/aggregate-state.ps1 -DryRun     # preview senza scrivere
pwsh scripts/aggregate-state.ps1            # scrivi (idempotente: 0 diff se nulla e' cambiato)
```

> **Forma dei flag**: il **singolo trattino** (`-Check`, `-List`, `-DryRun`) è la forma canonica. Il doppio trattino (`--check`) funziona **solo** sotto PowerShell 7, dove viene normalizzato sul singolo prima del binding: con Windows PowerShell 5.1 ricade in modalità WRITING (fail-open, issue #104) e con un flag inesistente esce **2** (errore di parametro), non 1 (drift). Baseline del repo: **PowerShell 7 (`pwsh`)** — vedi `docs/12-DEVOPS.md §9.1` e `§9.7b`.
>
> **Nota**: il flag `-Strict` citato nelle versioni precedenti di questo file **non esiste** in `scripts/aggregate-state.ps1`: il parametro non è dichiarato e il guard fail-closed lo rifiuta con exit 2. Non usarlo.

CI gate bloccante in `.github/workflows/ci.yml` (introdotto in #51). Se la PR modifica solo `docs/state/`, lo script esce 0 e non blocca. Se per errore un agente modifica direttamente `SESSIONS.md`, `BACKLOG.md`, `INDEX.md` o `BUNDLE.md`, lo script rileva drift e fallisce.

### Determinismo e idempotenza *(vincolante — issue #70)*

L'aggregator è la linfa dorsale del workflow parallelo: se produce output diverso a parità di input, due agenti su piattaforme diverse generano drift opposti e conflitti ricorrenti proprio sui file globali. Tre garanzie, ciascuna coperta da un test:

| Garanzia | Perché | Test |
|----------|--------|------|
| **Ordinamento per valore** (sessioni per `Number`, story per `[version]$Id`, tie-break su `Base`) | L'ordine di enumerazione del filesystem non è garantito: senza sort per valore lo stesso input produceva `0.3,0.5,0.6` su Linux e `0.6,0.5,0.3` su Windows | T1, T2, T6 |
| **Idempotenza byte-identica** (il timestamp `Ultima aggregazione` viene riusato quando il blocco non cambia altro): `Apply-Blocks` confronta il blocco calcolato con quello su disco **a parità del campo mutabile** e, se coincidono, riusa il valore esistente (`Get-NormalizedBlock` + `Sync-MutableTimestamp`) | Senza questo, ogni run produceva un diff e `auto-state-aggregate` committava a vuoto su `main`. **Issue #142**: la normalizzazione esisteva solo in `-Check`, quindi il path di scrittura ristampava `Get-Date` e T3 falliva a intermittenza quando i due run strappavano il confine di minuto (run `39818043647`) | T3, **T11** |
| **Degradazione invece di crash** su file `state/` malformati (`Get-Frontmatter`) | Un singolo file corrotto faceva crashare l'intera aggregazione, bloccando anche il workflow post-merge | T5 (più il guard `Get-Frontmatter`) |
| **`Dimensione totale` indipendente dai file riscritti dall'aggregator** (issue #86, opt A): i 4 file aggregator-managed (`SESSIONS.md`, `INDEX.md`, `11-BACKLOG.md`, `BUNDLE.md`) sono esclusi dal calcolo della taglia nel blocco BUNDLE inventory, perche' vengono misurati **prima** della riscrittura e oscillano di 1-2 run dopo ogni merge | Senza esclusione: `-Check` su main appena mergato segnalava "blocco drift" con blocchi della stessa lunghezza e contenuto identico (rumore puro). Il drift era in `766.6 KB` vs `764.2 KB` su main = 2.4 KB = drift dei 4 file aggregator-managed tra due run consecutivi | T7 (3 assert) |
| **`Dimensione totale` coerente cross-platform** (issue #88): il calcolo normalizza CRLF->LF via `Get-Content -Raw` + `GetByteCount(($text -replace "`r`n","`n"))`, in modo che la dimensione sia la stessa su Windows (`core.autocrlf=true`, 14 file CRLF sul disco) e su Linux (LF committed). Senza normalizzazione, `-Check` su Windows mostrava un drift spurio di ~2.3 KB rispetto a origin/main | Conseguenza dell'autocrlf Windows: la dimensione su disco (CRLF) divergeva dai byte committed (LF) per ognuno dei 14 file di testo con EOL conversion abilitata; il `Get-Item .Length` riportava i byte CRLF. Il fix trasforma l'aggregator in cross-platform-deterministic, chiudendo la radice del warning `#63` (differenza di **piattaforma**) per il blocco BUNDLE | T8 (3 assert) |

```bash
bash scripts/test-aggregate-determinism.sh    # 34 assert (T1..T11), gate bloccante in CI
```

**T3 da solo non basta** *(issue #142)*: verifica l'idempotenza con due run ravvicinati, ma il timestamp ha granularità al minuto — se i due run cadono su minuti diversi il test fallisce **per l'orologio, non per il codice** (è successo sul run `39818043647`, 16:55 → 16:56). **T11** verifica la stessa garanzia senza orologio: semina un *sentinel* nella riga del timestamp, esegue l'aggregator e verifica che il valore venga riusato; la contro-prova verifica che il timestamp si aggiorni quando il blocco cambia davvero. Stessa struttura per `> Data:` in `test-bundle-check-idempotent.sh` (T7).

**Se tocchi `scripts/aggregate-state.ps1`, il test è bloccante**: eseguilo prima di aprire la PR. Il gate `-Check` resta warning-only in CI per l'incompatibilità **residua di piattaforma** (dev Windows vs CI Linux, issue #63 risolto strutturalmente da #66): l'asse **versione di PowerShell** è chiuso dal baseline **PowerShell 7 (`pwsh`)** (Sessione 71) — dev e CI girano lo stesso engine. Il test di determinismo copre la stessa classe di bug in modo affidabile, perché confronta l'output **dentro la stessa piattaforma**.

### Allocazione numero di sessione *(vincolante, issue #105)*

Il numero `N` nel filename `docs/state/sessions/<N>-<slug>.md` deve essere univoco al momento di aprire la PR. Due agenti paralleli che scelgono lo stesso `N` producono due righe "Sessione N" in SESSIONS.md + INDEX-roadmap, indistinguibili e formalmente "in sync" → `-Check` esce 0 = **fail-open** (lesson 41-4).

**Pre-check obbligatorio** prima di scegliere `N` (procedura completa + storia del caso reale in `docs/state/_index.md` §"Allocazione del numero di sessione"):

```powershell
git fetch origin
$N = (git ls-tree --name-only origin/main docs/state/sessions/ |
      ForEach-Object { Split-Path $_ -Leaf } |
      Where-Object { $_ -match '^[0-9]+-' } |
      ForEach-Object { [int]($_ -split '-')[0] } |
      Measure-Object -Maximum).Maximum + 1
```

**Difesa di seconda linea**: `aggregate-state.ps1` ora rileva il duplicato a run-time (vedi §"Aggregator" sopra → `Find-DuplicateSessionNumbers`). In `-Check` esce 1 con messaggio esplicito che cita entrambi i path; in apply mode emette `[WARN]` ma continua a scrivere (il drift a quel punto e' gia' su `main` e va risolto rinumerando uno dei due file). Test di regressione T9 in `test-aggregate-determinism.sh`.

### GH Action auto-state-aggregate (post-merge auto-commit)

Dopo ogni push su `main` con paths `docs/state/**` o `scripts/aggregate-state.ps1`, la GH Action:
1. Esegue `pwsh scripts/aggregate-state.ps1 -Check` (rileva drift)
2. Esegue `pwsh scripts/aggregate-state.ps1` (applica i blocchi corretti)
3. Rileva il diff con `git diff --name-only`
4. Se modificato, committa e pusha con bot identity `kilo-bot[bot]`

Fissato in S30 (issue #58+#60): exit 0 esplicito dopo warning + `if: always()` sul diff step + `if (git diff --cached --quiet)` syntax fix PowerShell + `-replace CRLF, LF` in tutti gli script di write.

### Checklist PR aggiuntiva (D.24.x + D.29.x + D.30.x)

- [ ] **NON** ho modificato i blocchi `<!-- AGGREGATE-* -->` di `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`, `docs/BUNDLE.md` (a meno che non sia la PR di introduzione ADR-0008 stessa)
- [ ] Ho allineato le **sezioni legacy** dei file globali che la mia PR rende false (vedi §"Chi può scrivere cosa nei file globali")
- [ ] Se la PR tocca una sessione, ho aggiornato/creato il file `docs/state/sessions/<N>-<slug>.md` corrispondente
- [ ] Se la PR chiude una story, ho aggiornato/creato `docs/state/stories/<id>-<slug>.md` con frontmatter aggiornato (stato, PR number, merge_commit, merged_date)
- [ ] Ho eseguito `pwsh scripts/aggregate-state.ps1 -Check` localmente: exit 0
- [ ] Se ho toccato `scripts/aggregate-state.ps1`: `bash scripts/test-aggregate-determinism.sh` passa (determinismo + idempotenza, issue #70)
- [ ] Se ho aggiunto un nuovo file in `docs/state/` o `scripts/aggregate-state.ps1`, ho aggiornato `scripts/generate-bundle.ps1` `$files` + rigenerato `BUNDLE.md`

## 🛡️ Session start checklist

Prima di iniziare a lavorare su un'issue claimata, esegui i seguenti **6 check** per catturare precocemente i failure mode del parallelismo:

```powershell
git status                          # working tree clean? (F3, F5)
git branch --show-current           # sul branch giusto? (F1)
git fetch origin && git status -uno # main stale? (F4)
gh issue view <N> --jq .state       # issue ancora nostra e aperta? (F7)
git worktree list                   # non in worktree di un altro agente? (F8, post-#54)
pwsh -NoProfile -c '$PSVersionTable.PSVersion.Major'  # PowerShell 7? (F9, Sessione 71)
```

Tutti e 6 i check devono tornare positivi. Se qualcosa non torna, risolvere **prima** di modificare file.

**F9 — PowerShell 7 (`pwsh`) è il baseline del repo** *(Sessione 71, rafforzato dalla Sessione 72)*: gli script in `scripts/*.ps1` si invocano con `pwsh`. Sotto Windows PowerShell 5.1 il doppio trattino non viene normalizzato e i gate con `--check` ricadono silenziosamente in modalità WRITING (fail-open, issue #104): verificare sempre l'`exit code` **e** la riga `[OK] … in sync` nell'output. La forma canonica dei flag resta a **singolo trattino** (`-Check`, `-List`, `-DryRun`). Vedi `docs/12-DEVOPS.md §9.1`.

**F9-bis — `powershell` (5.1) non è un fallback: è un rischio di corruzione** *(Sessione 72)*. I `.ps1` del repo sono UTF-8 **senza BOM** e contengono letterali non-ASCII: sotto 5.1 il **parsing del sorgente** li sovradecodifica (`—` → `â€”`) e i blocchi calcolati non corrispondono più a quelli su disco (`aggregate-state.ps1 -Check` esce **1** con drift spurio: attesi 620 caratteri, trovati 616) — e in modalità scrittura il mojibake verrebbe **scritto** nei file globali (`README.md`, `SESSIONS.md`, `INDEX.md`, `11-BACKLOG.md`). Regole: (a) scrivere **`pwsh`** per esteso, mai `powershell`; (b) eseguire il check F9 **prima** di qualunque `.ps1`; (c) i nuovi `.ps1` restano **ASCII-only** (o con BOM UTF-8 esplicito). Dettagli e misure: `docs/12-DEVOPS.md §9.12`, `docs/17-DEV-NOTES.md` P12.

**Opzionale (se si ritorna dopo un merge di un altro agente)**: audit dei residui post-merge prima di iniziare lavoro nuovo — exit 14 indica branch/worktree merged-orfani da pulire con `pwsh scripts/post-merge.ps1 -Check` (vedi §"♻️ Pulizia branch post-merge").

## 📞 Contatti

- Project owner: `@amedeo82`
- Per decisioni strategiche: aspetta review sulla PR
- Per questioni tecniche: usa le issue
- Per ambiguità di specifica: issue `needs-spec`

---

*Ultimo aggiornamento: v1.31 — **le procedure automatiche sono state misurate e velocizzate** (Sessione 73, issue #224). La Sessione 72 aveva **misurato** le procedure automatiche (tempi reali, difetti, copertura CI) ma le aveva solo **documentate**: nessuna correzione, perché «aggiungere step alla CI e modificare la semantica di un gate sono decisioni sul test strategy» (D.72.5). Il project owner ha chiesto esplicitamente di «controllare tutte le procedure automatiche e renderle il più veloci possibili»: l'audit è stato quindi **chiuso con le correzioni**. Il dato di partenza è il tempo pareggio reale del job `quality` (unico, 18 step in sequenza): **172 s** (run `41212641314`, 2026-10-31). Il risultato: **73 s**, con **nessun gate** rimosso, indebolito o reso non-bloccante. Aggiunti:
- **§"🏎️ La CI: 11 job in parallelo"** (nuova): `ci.yml` passa da 1 job sequenziale a **11 job** (10 in parallelo + `quality` aggregatore). Il check `CI / quality` **conserva il nome** ed è **fail-closed**: fallisce esplicitamente se un job parallelo è fallito, annullato o saltato — senza il controllo esplicito, `needs:` produrrebbe un check *skipped*, che la branch protection può accettare come successo. I 5 job di gate **non richiedono `pnpm install`** (`validate-*.mjs` e `check-readme-facts.mjs` usano solo i moduli built-in di node)
- **`package.json`**: nuovo script **`verify`** = `turbo run lint && turbo run typecheck && turbo run test && turbo run build` (i 4 gate del CI in una sola invocazione locale). Le 4 invocazioni `turbo run` **restano sequenziali** nella CI: la forma parallela (`turbo run lint typecheck test build`, 32,8 s misurati) **rompeva il gate** — sul runner a 2 vCPU, `build` in concorrenza con `test` faceva scadere per timeout i 2 test di integrazione del fixture `db-seed/medium.json`. È la classe del lesson 30-1: la soglia di un test time-sensitive è un acceptance criterion e non si tocca (`docs/12-DEVOPS.md §9.14.7`)
- **`docs/12-DEVOPS.md` §9.10** (riscritta): l'elenco autorevole dei **26 gate** riorganizzati per job, con bloccante/non-bloccante e issue di riferimento
- **`docs/12-DEVOPS.md` §9.13** (nuova sezione *Chiusura dell'audit*): le **5 suite che la CI non esegueva** sono ora in CI, con i difetti corretti — `test-safe-branch-switch.sh` **fail-open** (i contatori vivevano dentro subshell ⇒ «0 passati, 0 falliti» e uscita sempre 0; ora 11 assert), `test-appendline-lf-fix.ps1` S3 **stale** e S5 che **mutava il working tree**, `test-setup-worktree.sh` che falliva **su ogni piattaforma** (`TMPDIR` non ripristinato nel cleanup, path POSIX non convertito, mock `gh` non eseguibile dal `pwsh` nativo su Windows)
- **`docs/12-DEVOPS.md` §9.14** (nuova): il profilo delle procedure automatiche, il costo nascosto dei **processi figli** (`seed_repo_files` = 256 spawn per repo = **9,5 s per repo** → ~50 ms), la tabella dei risultati e l'equivalenza dimostrata di ogni modifica. Il costo più alto della sessione **non era nella logica**: era nel numero di processi figli
- **`scripts/generate-bundle.ps1`**: `StringBuilder` al posto di `$bundle += ...` (O(n²) → O(n) su ~2,4 MB), `ReadAllText` al posto di `Get-Content -Raw`, `.Replace()` al posto di `-replace` per il CRLF. **Output byte-identico** (SHA-256 verificato sullo stesso albero)
- **`scripts/aggregate-state.ps1`**: cache per-process di elenco file / contenuti / frontmatter (i file di sessione erano letti **4 volte**, quelli di story **3 volte**), i file aggregator-managed non vengono più letti per l'inventario (la loro dimensione veniva calcolata e **scartata**), `ReadAllText` + conteggio CRLF senza allocare la copia da ~2,4 MB
- **`.github/workflows/auto-bundle.yml`**: il run su `workflow_run` viene **saltato** se l'aggregator non ha prodotto alcun commit (`workflow_run.head_sha` == `origin/main`). Su un merge che tocca `docs/state/**` il bundle rigenerava **due volte** (20 s + 22 s); se l'aggregator è **fallito** si rigenera comunque
- **`docs/17-DEV-NOTES.md`** (v0.6): nuovo **P13** — il costo dei processi figli in bash, e la forma `StringBuilder` per la concatenazione in PowerShell

*Precedente v1.30 — **la provenienza e il confine di encoding di `pwsh`** (Sessione 72). La Sessione 71 aveva dichiarato il baseline (PowerShell 7) ma non aveva risolto due cose: **da dove arriva l'installazione** e **cosa succede se si usa 5.1 per sbaglio**. Verificato il 2026-10-31: `pwsh` **7.6.9** è un pacchetto **MSIX/Store** (`Microsoft.PowerShell_7.6.9.0_x64__8wekyb3d8bbwe`), esposto via alias per-utente in `WindowsApps`; non è un MSI (`C:\Program Files\PowerShell\7` assente, nessuna voce nel registro) ed è visibile anche da Git Bash, quindi il `pre-push` rigenera il bundle con l'engine corretto. Il confine: i `.ps1` del repo sono UTF-8 **senza BOM** con letterali non-ASCII ⇒ sotto 5.1 il **parsing** li sovradecodifica e `aggregate-state.ps1 -Check` esce **1** con drift spurio (attesi 620 char, trovati 616), mentre in scrittura il mojibake finirebbe nei file globali. Aggiunti:
- **§"🛡️ Session start checklist"**: nuovo **F9-bis** — `powershell` (5.1) non è un fallback accettabile ma un rischio di corruzione; `pwsh` va scritto per esteso, il check F9 va eseguito prima di qualunque `.ps1`, e i nuovi `.ps1` restano **ASCII-only** (o con BOM UTF-8 esplicito)
- **`docs/12-DEVOPS.md` §9.12** (nuova): provenienza dell'installazione con i comandi di verifica, matrice misurata PS7 vs PS5.1 sui due generatori, e la distinzione fra **parsing** (version-dipendente, BOM) e **scrittura** (version-indipendente, `WriteAllText` + `UTF8Encoding($false)`). La motivazione dei due gate warning-only si riduce a «piattaforma»; la loro promozione a bloccante resta **decisione del project owner** (D.71.4)
- **`docs/12-DEVOPS.md` §9.13** (nuova): audit della copertura CI delle suite locali — 5 suite in `scripts/` **non** eseguite da `ci.yml`, con tempi misurati e i difetti rilevati: `test-safe-branch-switch.sh` è **fail-open** (i contatori vivono dentro subshell ⇒ «0 passati, 0 falliti» e uscita sempre 0), `test-appendline-lf-fix.ps1` ha S3 stale e S5 che muta il working tree, `test-setup-worktree.sh` fallisce su Windows/Git Bash. I due gate più pesanti (116,4 s su ~213 s) sono indipendenti e parallelizzabili
- **`docs/13-ADR/0008`**: il vincolo «ASCII-only nel codice PowerShell» viene corretto — riguarda il **parsing del sorgente**, non solo la scrittura; stato misurato: `aggregate-state.ps1` oggi lo **viola** (9 righe non-ASCII, nessun BOM) e il fix è manutenzione dello script, decisione del project owner
- **`docs/17-DEV-NOTES.md`** (v0.5): nuovo **P12** — provenienza di `pwsh`, comandi di verifica, e i due failure modes distinti (drift spurio in `-Check`, corruzione in scrittura) con la relativa causa (encoding del sorgente)

*Precedente v1.29 — **PowerShell 7 (`pwsh`)** è il baseline del repo per gli script in `scripts/*.ps1` (Sessione 71). La situazione di partenza: `pwsh` era già disponibile sulla dev machine dalla Sessione 42 (lesson 42-1, pwsh 7.6.7) e la CI usa `shell: pwsh` da sempre, ma la **documentazione** era rimasta ancorata al world di PS 5.1 — il README avvertiva ancora che «senza `pwsh`» i gate richiedevano il singolo trattino, `12-DEVOPS.md §9.1` prescriveva «MAI `--check`» e `§9.7b` descriveva il fail-open dell'issue #104 come se fosse il caso normale. Il drift è la classe di problema che questo repo già sa riconoscere: **nessun gate confronta la documentazione con l'ambiente reale**. Correzioni:
- **Forma canonica dei flag**: il **singolo trattino** (`-Check`, `-List`, `-DryRun`, `-Help`) è ormai la forma usata in tutto il file. I `--check` sparsi nel corpo del protocollo erano un residuo: il footer v1.20 dichiarava già «tutti i `pwsh scripts/* --check` convertiti a `-Check` (issue #104, PR #111 gia' aperta)», ma la conversione non era stata applicata al corpo del file — il protocollo diceva una cosa e ne faceva un'altra. Verificato su pwsh 7.6.9: `--check` e `-Check` danno lo stesso risultato e lo stesso exit code (in `pwsh` il doppio trattino viene normalizzato sul singolo **prima** del binding), quindi il fail-open dell'issue #104 è un bug di **5.1** e non si reproduce con il baseline corrente
- **§"🔄 Lazy-state aggregation" → Aggregator**: il blocco dei comandi usa `-List` / `-Check` / `-DryRun`. Rimossa la riga `--check --strict`: il flag **`-Strict` non esiste** in `scripts/aggregate-state.ps1` (il parametro non è dichiarato) e il guard fail-closed lo rifiuta con exit 2 — la riga indicava un comando che non può funzionare. Aggiunta la nota esplicita
- **§"🛡️ Session start checklist"**: estesa a **6 check** con `pwsh -NoProfile -c '$PSVersionTable.PSVersion.Major'` (F9). Un check che passa sempre non è un gate (lesson 43-1): senza questo, l'ambiente PowerShell sbagliato viene scoperto solo quando un gate riscrive un file invece di verificarlo
- **§"Determinismo e idempotenza"**: la motivazione del warning-only dei due gate CI è riformulata — l'asse **versione di PowerShell** è chiuso (dev e CI girano lo stesso engine), resta quello di **piattaforma** (dev Windows vs CI Linux). La semantica dei gate in CI **non** cambia
- `README.md`, `docs/17-DEV-NOTES.md` (nuovo **P11**), `docs/12-DEVOPS.md` (§9.1, §9.7b, §9.8, changelog 1.3), `docs/13-ADR/0008` (vincoli implementativi), `docs/13-ADR/0006`, `docs/state/_index.md`, `docs/11-BACKLOG.md` allineati

*Precedente v1.28 — il blocco NEXT-STEP del README indicava una story **bloccata** (issue #182). `scripts/aggregate-state.ps1` filtra ora anche `blocked` (STOP) e `wontdo` (NO) accanto a `done`: il blocco indica la prima story **lavorabile**, non una dipendenza esterna irrisolvibile. Il caso reale: la Story 2.1 (Mood Tracker) è bloccata dalle audio features dell'EPIC 4.1 (decisione D-A.1, Sessione 59) e il puntatore era finito su di lei, mentre la story implementabile era la 2.4 (Memory Engine, issue #179). La regola è coperta da due sub-test nuovi in `scripts/test-aggregate-determinism.sh` (T10e, T10f) che **falliscono senza il fix**: un gate che passa sempre non è un gate (lesson 43-1). Il messaggio di fallback e la riga delle "altre candidate" dicono ora "non-done e non bloccate".

*Ultimo aggiornamento: v1.27 — la prosa del `README.md` non aveva **nessun gate** (Sessione 54, issue #161). Il README dichiarava 8 piattaforme importabili (Deezer, Tidal, SoundCloud inesistenti: le classi adapter non ci sono), audio features e analisi/mood/ricordi come feature presenti (nessuna implementata), e un conteggio di stato (`EPIC 0 7/7`) che l'aggregatore ricalcola altrove; la prosa era rimasta quella del bootstrap (`ebdab9d`, 2026-10-14), perché i merge delle Story 1.2 (`2e1a4cc`) e 1.3 (`7afbf03`) non avevano toccato il README e nessuno dei 16 gate di `ci.yml` confrontava la prosa con il codice. Fallimento **silenzioso**: pipeline verde, README falso. La causa radice era di ownership: `README.md` è un file ibrido (blocco `AGGREGATE-NEXT-STEP-*` generato + prosa scritta a mano) ma la regola di D.38.1 copriva solo i file globali, e il README non era in nessuna tabella di ownership. Aggiunti:
- `scripts/check-readme-facts.mjs` (nuovo): gate **read-only** che confronta la prosa del README con `ACTIVE_PLATFORMS` + `ADAPTER_FACTORIES` (`apps/web/src/onboarding/OnboardingRouter.tsx`) e con le classi in `packages/core/src/adapters/`; vieta le capability non implementate fuori dalla sezione roadmap; vieta i conteggi duplicati in prosa. Exit 0 = in sync, 1 = drift, 2 = errore di ambiente (fail-closed). **Nessuna modalità di scrittura**: un secondo writer sullo stesso file riprodurrebbe la race fra i writer di `main` risolta dal #149
- `scripts/test-readme-facts-gate.sh` (nuovo): 9 scenari (T1..T9) con fixture — piattaforma inesistente, piattaforma mancante, factory senza adapter, classe inesistente, capability fuori roadmap, capability nella roadmap (nessun falso positivo), conteggio duplicato, README mancante (exit 2). Un gate che passa sempre non è un gate (lesson 43-1)
- `.github/workflows/ci.yml`: due step bloccanti — «Fatti del README in sync con il codice (issue #161)» e «Gate "fatti del README" fail-closed (issue #161)», quest'ultimo è lo scenario negativo del precedente
- §"Ownership del `README.md`" (D.161.1, nuova): la tabella dei due owner, le quattro regole della prosa, il perimetro del gate e il fatto che scatta a ogni PR che cambia le piattaforme importabili; checklist di auto-revisione PR e tabella di sincronizzazione al merge aggiornate di conseguenza
- `README.md`: prosa riscritta — "Cosa c'è oggi" con l'elenco delle 5 piattaforme reali, "Roadmap" separata (dove stanno i claim futuri), "Stato del progetto" ridotta a puntatori (nessun conteggio duplicato), sezioni "Sviluppo locale" e "Come contribuire"
- `docs/12-DEVOPS.md` §9.8f (nuova) + §9.10 aggiornata a 18 step; `docs/11-BACKLOG.md` allineato (`EPIC 1 — Import core: 2/5` → `3/5`); `docs/18-DEV-LOG.md` §20; `docs/state/sessions/54-readme-maintenance.md` (nuova)
- `scripts/generate-bundle.ps1`: `$files` += i due nuovi script; `docs/BUNDLE.md` rigenerato nella stessa PR

*Precedente v1.26 — i due writer di `main` erano serializzati ma **non ordinati** (Sessione 47, issue #149). Il concurrency group `post-merge-main` garantisce che i due run non si sovrappongono, ma non quale dei due ottenga prima il lock: e l'ordine è essenziale, perché `auto-bundle` **copia** il contenuto dei file che `auto-state-aggregate` **modifica**. Caso reale: merge della PR #147 (2026-10-26T12:50Z) — `auto-bundle` alle 12:50:23, `auto-state-aggregate` alle 12:50:55. Il bundle copiò i blocchi aggregati ancora vecchi, il guard idempotente (`git diff --quiet`) scrisse «già in sync» e non committò nulla; l'agregate committò dopo, e la copia dentro `docs/BUNDLE.md` restò stale di 6 righe. Drift **silenzioso**: il gate CI sul bundle è warning-only, la pipeline restava verde. Il commit del bot non poteva auto-correggerlo, perché il push con `GITHUB_TOKEN` sopprime i workflow run innescati dal token stesso (le sole eccezioni documentate sono `workflow_dispatch` e `repository_dispatch`). Aggiunti:
- `.github/workflows/auto-bundle.yml`: trigger `workflow_run` su `auto-state-aggregate` (`types: [completed]`) — è agganciato alla **conclusione** del workflow, non a un push, quindi sopravvive alla soppressione del GITHUB_TOKEN ed è il workaround documentato per i workflow che si innescano a vicenda. Con esso il bundle rigenera **sempre** una seconda volta dopo che l'aggregate ha committato: la copia embedded è allineata ai sorgente, indipendentemente dall'ordine di scheduling
- `scripts/validate-workflows.mjs`: quinto controllo `checkWriterOrdering` — verifica che `auto-bundle.yml` dichiari il trigger `workflow_run` **e** che il nome in `workflows:` combaci con il `name:` reale del producer (una disallineazione non dà errore: il trigger semplicemente non scatterebbe mai, in silenzio)
- `scripts/test-workflow-writer-ordering.sh` (nuovo, T1..T5, 6 assert): T2 rimuove il blocco `workflow_run:` e verifica che il gate esca 1, T3 un trigger su un altro workflow, T4 il `name:` del producer disallineato (il caso silenzioso), T5 il producer assente — un gate che passa sempre non è un gate (lesson 43-1)
- `.github/workflows/ci.yml`: nuovo step bloccante `Ordinamento dei writer di main (issue #149)` in posizione 13
- `scripts/generate-bundle.ps1`: `$files` += il nuovo test
- `docs/12-DEVOPS.md` §9.8e (nuova) con la sequenza temporale del fallimento, il meccanismo della soppressione del GITHUB_TOKEN e la regola generale (quando il secondo workflow **legge** ciò che il primo **scrive**, il trigger corretto è `workflow_run`, non `push`); §9.10 aggiornata a 16 step; changelog 0.8
- §"📤 Post-merge actions" Livello 1: la riga `auto-bundle` dichiara il doppio trigger; i controlli del validatore elencati sono cinque, non quattro

*Precedente v1.25 — l'idempotenza dell'agregator esisteva solo in `-Check` (Sessione 46, issue #142). La garanzia «il timestamp `Ultima aggregazione` viene riusato quando il blocco non cambia altro» (issue #70) era documentata e verificata unicamente dal check, dove la normalizzazione maschera il campo: nel path di scrittura `Get-Date` veniva ristampato a ogni run. Con granularità al minuto, due run ravvicinati che strappano il confine producevano un diff di una riga — il «commit-rumore su `main`» che la garanzia prometteva di eliminare — e `test-aggregate-determinism.sh` T3 falliva a intermittenza (run `39818043647`, 16:55 → 16:56), cioè un gate bloccante che dipendeva dall'orologio. Difetto gemello in `generate-bundle.ps1`: `Build-Bundle` accettava già un parametro `-Timestamp` mai passato, e il path di scrittura ristampava `> Data:` — nessun gate lo vedeva (`-Check` normalizzava), ma `auto-bundle` committava dopo ogni merge a contenuto identico. Aggiunti:
- `scripts/aggregate-state.ps1`: `Get-NormalizedBlock` e `Sync-MutableTimestamp`; `Apply-Blocks` confronta il blocco calcolato con quello su disco **a parità del campo mutabile** e riusa il valore esistente; `Test-Blocks` riusa la stessa funzione di normalizzazione (una sola definizione, le due copie non possono divergere)
- `scripts/generate-bundle.ps1`: riuso di `> Data:` prima della scrittura — **confronto su tutto il bundle, sostituzione solo sulla prima occorrenza** (i documenti inclusi possono avere una riga `> Data:` propria: `docs/AUDIT-2026-10-15.md`)
- `scripts/test-aggregate-determinism.sh`: **T11** (4 assert) — sentinel seminato nella riga del timestamp, verifica del riuso e contro-prova «contenuto cambiato → il timestamp si aggiorna». Con il riuso assente fallisce **sempre**, non una volta su N
- `scripts/test-bundle-check-idempotent.sh`: **T7** (5 assert) con lo stesso probe per `> Data:`, più `ps_path` — i path POSIX di `mktemp` non erano risolti dal call operator di pwsh su Windows e facevano fallire T4-T6 (3 assert recuperati); su Linux il path passa invariato
- §"🔄 Lazy-state aggregation → Determinismo e idempotenza": la riga dell'idempotenza ora nomina l'implementazione (`Apply-Blocks`) e il test che la verifica senza orologio, con la nota sul perché T3 da solo è flake
- `docs/12-DEVOPS.md` §9.11 (nuova) + changelog 0.7; AGENTS.md v1.24 → v1.25, footer cumulativo v1.25

*Precedente v1.24 — `auto-state-aggregate` non riusciva più a pushare su `main` (Sessione 45, issue #140). Il workflow che rigenera i blocchi `AGGREGATE-*` falliva su ogni merge con `! [rejected] main -> main (non-fast-forward)` (run `39802198985`, `39803721229`): il concurrency group `post-merge-main` serializza i *run*, non i *checkout*, e `actions/checkout` senza `with: ref:` mette il workspace sul `github.sha` del merge commit — quando `auto-bundle.yml` ha già pushato sullo stesso merge (ha uno step di sync, il companion no), il secondo writer pusha da un checkout stale. Il fallimento è **silenzioso**: merge verde, `ci.yml` verde, blocchi aggregati indietro, nessun gate che lo segnali; conseguenza diretta, il doc-sync della Story 1.2 (PR #139, merge `2e1a4cc`) era rimasto fuori da `main` e `README.md` continuava ad annunciarla come «prossima story». Aggiunti:
- `.github/workflows/auto-state-aggregate.yml`: step «Sync con origin/main» (`git fetch origin main` + `git rebase origin/main`, fallback `git reset --hard origin/main`), identico a quello di `auto-bundle.yml`, prima di `-Check`; nota di-header che dichiara la differenza fra serializzare i run e allineare il checkout
- `.github/workflows/ci.yml`: nuovo step bloccante `Sync origin/main prima del push su main (issue #140)`
- `scripts/validate-workflows.mjs`: quarto controllo `checkPushSync` — ogni `git push origin main` richiede un sync **precedente** (l'ordine è parte del contratto: uno step di sync dopo il push è inerte), tre forme equivalenti accettate, i writer di branch non tassati; il riepilogo riporta quanti writer di `main` sono stati verificati
- `scripts/test-workflow-push-sync.sh` (nuovo, T1..T5, 15 assert): T2 rimuove lo step di sync da `auto-state-aggregate.yml` e verifica che il gate esca 1, T3 una forma di sync alternativa non viene tassata, T4 un push su branch non viene tassato, T5 un sync **dopo** il push viene tassato — un gate che passa sempre non è un gate (lesson 43-1)
- `scripts/generate-bundle.ps1`: `$files` += il nuovo test
- `docs/12-DEVOPS.md` §9.8d (nuova) con la tabella temporale del fallimento e la regola generale (chi pusha per primo **e** su quale commit si pusha sono due proprietà distinte); §9.10 aggiornata a 15 step con il nuovo gate in posizione 12; changelog 0.6
- `docs/state/sessions/45-auto-state-aggregate-push-sync.md` (nuova) e doc-sync di `docs/state/stories/1.2-adapter-apple-music.md` (`status: done`, `pr: 139`, `merged_commit`): senza la sorgente aggiornata l'agregator continua a dichiarare la 1.2 come `todo`
- §"📤 Post-merge actions" Livello 1: i controlli del validatore elencati sono quattro, non tre
- AGENTS.md v1.23 → v1.24, footer cumulativo v1.24

*Precedente v1.23 — `ci.yml` non eseguiva più alcun job (Sessione 44, issue #135). Una scope non dichiarabile dentro `permissions:` (`metadata: read`, introdotta dal commit `43d982d` per la issue #120) non produce un job che fallisce: GitHub **rifiuta il file workflow in fase di validazione**, quindi dal 2026-10-21T16:21Z ogni run di `ci.yml` — push e pull_request — veniva creata con `jobs: 0` e chiudeva `failure` a 0 secondi, senza log né annotazioni via API, con `state: active` sull'API dei workflow. Nessun parser YAML lo intercetta (`metadata` è sintatticamente lecito, è la *schema* GitHub a rifiutarlo) e la firma è ambigua con un blocco di billing: la diagnosi è arrivata dalla tabella `jobs` × `conclusion` dei 60 run (salto `1 → 0` esattamente su `43d982d`) e dalla constatazione che gli altri 5 workflow, sugli stessi runner e nella stessa finestra, erano verdi. Aggiunti:
- `.github/workflows/ci.yml`: `metadata: read` rimossa dal blocco `permissions:` del job `quality` (una riga), commento che spiega perché `metadata` non è dichiarabile, e nuovo step bloccante `Scope permissions: valide (issue #135)`
- `scripts/validate-workflows.mjs`: validazione delle scope di `permissions:` contro l'elenco documentato + valori `read`/`write`/`none` (`id-token` ristretto a `write|none`), con forme compatte `{}`/`read-all`/`write-all` accettate per non generare falsi positivi; il riepilogo finale riporta quante scope sono state verificate
- `scripts/test-workflow-permission-scopes.sh` (nuovo, T1..T5): T2 reintroduce `metadata: read` in una fixture e verifica che il gate esca 1, T3 il valore inesistente, T4 la forma compatta (nessun falso positivo), T5 il typo di scope — un gate che passa sempre non è un gate (lesson 43-1)
- `scripts/generate-bundle.ps1`: `$files` += il nuovo test
- §"📤 Post-merge actions" Livello 1: la frase sul validatore dei workflow elencava solo il controllo JS; ora elenca i tre controlli che il file applica davvero
- `docs/12-DEVOPS.md` §9.9 (nuova) + §9.10 (nuova, elenco autorevole dei 14 gate di `ci.yml` con bloccante/non-bloccante e issue) + nota in §2.1 che dichiara il suo YAML uno scheletro di progetto e rimanda a §9.10 + changelog 0.5
- AGENTS.md v1.22 → v1.23, footer cumulativo v1.23

*Precedente v1.22 — il blocco NEXT-STEP del README non veniva committato (Sessione 43, issue #136). ADR-0008 V3 (#127) aveva aggiunto `README.md` come quinto `$targets` di `scripts/aggregate-state.ps1`, ma la riga `git add` di `auto-state-aggregate.yml` — elenco tenuto a mano, separato — era rimasta quella di V2: il blocco veniva generato e poi scartato. Il drift restava invisibile finche' il fallback generato coincideva per caso col testo in file, ed e' emerso solo alla prima story `todo` (1.2, S42). Aggiunti:
- `.github/workflows/auto-state-aggregate.yml`: `README.md` nella riga `git add` (ordine di precedenza del generatore) + blocco NEXT-STEP nell'elenco dei target del messaggio di commit + nota di-header che rimanda al gate
- `scripts/validate-workflows.mjs`: assert di copertura fra i `$targets` dell'aggregator e la riga `git add` del workflow (accetta path letterali, directory e radice `.`) — gate bloccante in CI dal #73
- `scripts/test-workflow-git-add-coverage.sh` (nuovo, T1..T4) + step bloccante in `ci.yml`: il test reintroduce il bug in una fixture e verifica che il gate lo intercetti
- §"🔄 Lazy-state aggregation → Target V1 + V2 + V3": tabella dei target allineata al V3 con la regola vincolante sulla copertura; §"📤 Post-merge actions" Livello 1: riga `auto-state-aggregate` allineata
- `docs/12-DEVOPS.md` §9.8c (nuova) + changelog 0.4: sintesi della divergenza fra i due elenchi, perchè è rimasta invisibile, e la regola generale (nuovo target ⇒ aggiornare ogni lista che lo consuma a mano + gate di confronto)

*Precedente v1.21 — auto-bundle workflow post-merge (Sessione 41, issue #115 follow-up di PR #113). Il drift `docs/BUNDLE.md` (sezioni `===== FILE:`) rilevato dopo il merge di PR #112 era strutturalmente non prevenuto: `auto-state-aggregate.yml` aggiorna solo i blocchi `<!-- AGGREGATE-* -->` per design, e nessuna workflow rigenerava il contenuto FILE di `BUNDLE.md` post-merge. Aggiunti:
- `.github/workflows/auto-bundle.yml` (nuovo, ~100 righe): trigger su push a main con paths che coprono `$files` + `scripts/generate-bundle.ps1` stesso. Esegue `pwsh scripts/generate-bundle.ps1`, skippa il commit via guard `git diff --quiet docs/BUNDLE.md` (idempotente), committa e pusha con `kilo-bot[bot]`
- `.github/workflows/auto-state-aggregate.yml`: aggiunto blocco `concurrency: { group: post-merge-main, cancel-in-progress: false }` per serializzare le due workflow (evita race su push di `BUNDLE.md`)
- `.github/CODEOWNERS`: aggiunto `/.github/workflows/auto-bundle.yml @amedeo82` alla sezione workflows
- `generate-bundle.ps1` `$files`: aggiunto `.github/workflows/auto-bundle.yml` (coerenza: il workflow è incluso nel proprio bundle)
- `docs/12-DEVOPS.md` §9.8b: nuova sottosezione "auto-bundle.yml (issue #115)" con sintesi del workflow, motivazione storica, lezione D.116.1; §9.8 aggiornato per cross-riferimento; changelog 0.3 con riepilogo
- AGENTS.md v1.20 → v1.21, footer cumulativo v1.21 con sintesi del fix

*Precedente v1.20 — rilevamento collisioni di numero di sessione (Sessione 41, issue #105). Il pre-check esistente in `docs/state/_index.md` (zero-padded a 2 cifre) era una convenzione "best effort" ma non impediva a due agenti paralleli di scegliere lo stesso `N` (lesson 41-4: S41 con S40 dell'altro agente). L'aggregator ordinava per `Number` + tie-break `Base` e produceva in SESSIONS.md / INDEX-roadmap due righe "Sessione N" indistinguibili e formalmente "in sync" con se stesse → `-Check` usciva 0 = fail-open. Aggiunti:
- `scripts/aggregate-state.ps1`: nuova funzione `Find-DuplicateSessionNumbers` consumata da `Apply-Blocks` (WARN visibile ma scrive, perche' il drift a quel punto e' gia' su `main` e serve rinumerazione manuale) e `Test-Blocks` (FAIL + exit 1, fail-closed); `--list` evidenzia i duplicati
- `scripts/test-aggregate-determinism.sh` T9 (5 assert, scenario "copia 32-issue-cleanup-cumulativo.md come 32-dup-test.md"): --check esce non-zero, il messaggio cita `Number=32` e i path di entrambi i file, -List mostra il WARN, apply-mode WARN+scrittura, dopo rimozione del duplicato --check torna a exit 0
- `docs/state/_index.md`: nuova sottosezione vincolante "Allocazione del numero di sessione" con procedura di pre-check (`git fetch` + `git ls-tree origin/main docs/state/sessions/` + `Measure-Object -Maximum + 1`), incluse storia del caso reale e note di difesa in profondita' (controllo anche sui file locali non ancora pushati)
- §"🔄 Lazy-state aggregation → Allocazione numero di sessione": regola e procedura cross-reference a `_index.md`
- AGENTS.md v1.19 → v1.20, footer v1.20 con sintesi del fix; tutti i `pwsh scripts/* --check` convertiti a `-Check` (issue #104, PR #111 gia' aperta)

*Precedente v1.18 — la keyword di chiusura transiziona **solo** issue realmente collegate (Sessione 38, issue #94). `auto-status-done.yml` matchava `Closes #N` **ovunque** nel body: la PR #93, che *citava* la keyword nella descrizione, ha applicato `status:done` e un commento `release:` spurio all'issue #90 (commento rimosso a mano). La regex è ora ancorata alla riga (`/^[ \t]*(?:Closes|Fixes|Resolves)[ \t]+#(\d+)[ \t]*$/gim`): transiziona solo una riga che è *esattamente* la keyword + numero. §"Chiusura al merge" e il PR template dicono ora di scrivere la keyword **una sola volta**, nuda, e di spezzarla (`` `Closes` #N ``) quando serve citarla.

*Precedente v1.17 — keyword di chiusura `Closes #N` resa inequivocabile (Sessione 38, issue #92). Con PR #91 la keyword era comparsa dentro una casella di checklist del body: GitHub non la riconosce e l'issue #90 è rimasta `OPEN` dopo il merge, nonostante la checklist fosse spuntata. Ora §"Chiusura al merge" mostra la keyword come riga nuda, vieta backtick e checklist, e include un auto-check; il PR template espone il campo `Closes #` in posizione che GitHub legge.

*Precedente v1.16 — ownership *blocchi aggregati vs sezioni legacy* nei file globali (Sessione 38, issue #90). La regola "NON modificare `docs/INDEX.md`, `SESSIONS.md`, `11-BACKLOG.md`, `BUNDLE.md`" era applicata all'intero file, così le sezioni legacy non aggregate (prose, tabelle statiche, "Prossimo step tecnico") invecchiavano senza che nessun gate se ne accorgesse: al 2026-10-21 `11-BACKLOG.md` dichiarava 0.4/0.6/0.7 `⬚ TODO` mesi dopo il loro merge, e `INDEX.md` puntava a issue già chiuse. Ora:
- §"🔄 Lazy-state aggregation" → nuova sottosezione **"Chi può scrivere cosa nei file globali" (D.38.1)**: i blocchi `<!-- AGGREGATE-* -->` restano vietati a mano (con il perché), le sezioni legacy vanno **allineate nella stessa PR** che cambia i fatti che dichiarano, con l'anti-pattern della duplicazione
- §"📝 Checklist di auto-revisione PR" + §"Checklist di sincronizzazione documentazione al merge" + §"🔄 Lazy-state aggregation → Checklist PR aggiuntiva": le tre voci "NON ho modificato direttamente …" diventano "NON ho modificato i **blocchi** `AGGREGATE-*`", con la voce nuova sull'allineamento delle sezioni legacy
- §"🚀 Primo task": ordine worktree→claim (coerente con la validazione di `setup-worktree.ps1`, che rifiuta un'issue già `in-progress` — incoerenza segnalata in S37, lesson 37-6)

*Precedente v1.15 — 'Dimensione totale' inventory normalizzata CRLF->LF (issue #88, follow-up di #86). La `Dimensione totale` del blocco `AGGREGATE-BUNDLE-INVENTORY-*` viene ora calcolata sul contenuto decodificato normalizzato a LF invece che sui raw byte del file: `Get-Content -Raw -Encoding UTF8` + `[System.Text.Encoding]::UTF8.GetByteCount(($text -replace "`r`n","`n"))`. Conseguenza: la dimensione coincide con `git cat-file -s HEAD:<file>` su qualsiasi piattaforma, e `aggregate-state.ps1 --check` su Windows (dove 14 file di testo sono `core.autocrlf=true` → CRLF sul disco) non segnala piu un drift spurio di ~2.3 KB rispetto a origin/main (committed LF). `scripts/test-aggregate-determinism.sh` esteso con T8 (3 assert → 15 totali) come regression dedicata; il warning `#63` (PS 5.1 vs 7 incompatibilita residue) resta solo per eventuali altri blocchi.

*Precedente v1.14 — 'Dimensione totale' inventory esclude i file aggregator-managed (issue #86, opt A).

*Precedente v1.13 — residui post-merge e base stale (issue #76, Sessione 36). Chiusi due buchi: `post-merge.ps1 -Check` non guardava i branch **locali** (due orfani sopravvissuti indisturbati), e `setup-worktree.ps1` non faceva mai `fetch` prima di validare `-BaseBranch origin/main` (base stale **silenziosa**).
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
