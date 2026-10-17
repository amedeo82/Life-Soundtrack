# 🤖 AGENTS.md — Protocollo per Agenti di Sviluppo

> **Questo è il primo file che un agente deve leggere, prima di qualsiasi altro.**
> Versione 1.3 — Sessione 18 (2026-10-17)

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
| Tipo | `bug`, `enhancement`, `refactor`, `docs` | Classificazione |

## 🎫 Presa in carico delle story (claim)

**Regola vincolante (ADR-0006): nessun agente inizia a lavorare una story senza un claim valido.** Il claim è il meccanismo che impedisce a più agenti paralleli di scegliere e implementare la stessa issue. È il primo gesto operativo, **prima** di leggere la spec dettagliata e creare il branch.

### Identificativo agente

All'avvio l'agente genera il proprio identificativo univoco, in formato `<tool>-<hostname>-<random>` (es. `kilo-HP-ELITEBOOK-hjoe`). Serve perché gli agenti condividono lo stesso PAT: l'utente GitHub non discrimina, l'identificativo agente sì.

### Procedura di claim

1. **Elenca le issue candidabili** — aperte, `agent-ready`, **senza** label `in-progress`:

   ```powershell
   gh issue list --state open --label agent-ready --limit 20 --json number,title,labels
   ```

   Filtra via quelle che hanno `in-progress` tra le label.

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
gh issue comment <N> --body "release: <AGENT-ID> — <motivo: PR mergata / abbandono / spec cambiata>"
gh issue edit <N> --remove-label in-progress
```

Il rilascio è **obbligatorio**: al merge o rifiuto della PR, in caso di abbandono, o se la spec collegata torna 🟡 DRAFT. Mai lasciare label `in-progress` orfane: sono falsi blocchi che solo il TTL può pulire.

### Casi particolari

- **Assegnazione esplicita del project owner**: l'agente esegue comunque claim + riverifica (punti 3-4), così la presa in carico resta visibile agli altri agenti.
- **Issue senza `in-progress` ma con branch `feat/<N>-…` remoto esistente**: segnala con issue `needs-spec` e passa alla prossima. Un branch orfano non è un lock (ADR-0006) ed è materia della §"♻️ Pulizia branch post-merge".
- **Nessuna issue candidabile**: apri issue `needs-spec` e termina la sessione **senza lavorare nessuna story**.

## 🌳 Git workflow

- Branch: `feat/<issue-number>-<descrizione>` o `fix/<issue-number>-<descrizione>`
- Commit: **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Branch `main` protetto: richiede PR e review
- Nessun force push su `main`
- Una PR = una issue (salvo eccezioni)
- **Branch stale vanno eliminati** dopo il merge — vedi §"♻️ Pulizia branch post-merge"

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

# 3. (Opzionale) Se esiste un tracking locale
git branch -d feat/<issue-number>-<descrizione

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

## 📝 Checklist di auto-revisione PR

- [ ] Ho letto `AGENTS.md` e i documenti linkati dal task
- [ ] Il codice rispetta lo schema dati (`02-DATA-SCHEMA.md`)
- [ ] Ho scritto test che coprono il caso felice e almeno 2 edge case
- [ ] Ho usato i fixture di `fixtures/synthetic-history/`
- [ ] JSDoc su tutte le funzioni pubbliche
- [ ] Nessun dato personale hardcoded, nessun log di PII
- [ ] `pnpm run lint` e `pnpm run test` passano in locale
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

**Regola operativa**: se una PR tocca codice, schema, policy o stato di story, allora tocca anche documentazione. La PR senza aggiornamenti di stato è **incompleta**.

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

## 🗺️ Struttura del repository

    Life-Soundtrack/
    ├── AGENTS.md                ← questo file
    ├── README.md
    ├── docs/                    ← specifica completa
    │   ├── INDEX.md, SESSIONS.md, BUNDLE.md
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
        └── generate-fixtures.mjs    ← generator deterministico dei fixture (10-TESTING §3.5)

## 🚀 Primo task di un agente

1. Leggi questo file
2. Esegui il protocollo di claim (§"🎫 Presa in carico delle story"): ottieni il claim della prima issue `agent-ready` **libera** secondo l'ordine di `docs/11-BACKLOG.md` §"Priorità di lavorazione" — mai una issue già in `in-progress`
3. Crea branch `feat/<issue>-<descrizione>`
4. Leggi la specifica del task e implementa con test
5. Apri PR

Se non ci sono issue `agent-ready` libere, apri issue con label `needs-spec`. **Mai iniziare a lavorare una story senza un claim valido** (ADR-0006).

## 📞 Contatti

- Project owner: `@amedeo82`
- Per decisioni strategiche: aspetta review sulla PR
- Per questioni tecniche: usa le issue
- Per ambiguità di specifica: issue `needs-spec`

---

*Ultimo aggiornamento: Sessione 18 (2026-10-17) — v1.3: aggiunta §"🎫 Presa in carico delle story (claim)" (ADR-0006: label `in-progress` + commento di claim, riverifica, cascata, TTL 12h); §"Primo task" riscritto claim-first; PAT esteso a `issues: read/write`*