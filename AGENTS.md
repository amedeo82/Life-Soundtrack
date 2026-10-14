# 🤖 AGENTS.md — Protocollo per Agenti di Sviluppo

> **Questo è il primo file che un agente deve leggere, prima di qualsiasi altro.**
> Versione 1.0 — Sessione 3 (stabile)

---

## 📚 Ordine obbligatorio di lettura

Quando ricevi un task su questo repository, segui questo ordine:

1. **Questo file** (`AGENTS.md`) — il protocollo
2. **[`docs/INDEX.md`](docs/INDEX.md)** — stato del progetto
3. **[`docs/00-VISION.md`](docs/00-VISION.md)** — il "perché"
4. **[`docs/05-ARCHITECTURE.md`](docs/05-ARCHITECTURE.md)** — architettura
5. **[`docs/14-GLOSSARY.md`](docs/14-GLOSSARY.md)** — linguaggio comune
6. **[`docs/11-BACKLOG.md`](docs/11-BACKLOG.md)** — il lavoro da fare
7. **[`docs/10-TESTING.md`](docs/10-TESTING.md)`** — come testare
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

4. L'AI userà i suoi tool web (se il repo è pubblico) o i file incollati per continuare

**Il PAT va dato agli agenti di sviluppo** (Claude Code, Cursor, Copilot) con scope `contents: read/write` sul repo solo. L'AI di review (come Claude in chat) non ha bisogno di PAT.

## ✅ Cosa puoi fare autonomamente

- Scrivere codice in TypeScript/React secondo lo stack definito
- Creare test unitari e di integrazione
- Aprire PR con checklist di auto-revisione
- Segnalare ambiguità nelle specifiche tramite issue con label `needs-spec`
- Usare i fixture in `fixtures/` per i test

## 🚫 Cosa NON puoi decidere autonomamente

Queste decisioni sono già prese e **vincolanti** (status 🟢 APPROVED):

- Architettura: PWA-first, local-first, adapter pattern (ADR 0001, 0002, 0003)
- Schema dati: `02-DATA-SCHEMA.md` (quando approvato)
- Formato adapter: `03-ADAPTERS/SPEC-TEMPLATE.md`
- Algoritmi: `04-ANALYSIS-ALGORITHMS.md` (quando scritto)
- Design system: `15-DESIGN-SYSTEM.md`
- Copy e i18n: `08-COPY-I18N.md` (quando scritto)
- Privacy: `09-PRIVACY-SECURITY.md` (quando scritto)
- Test strategy: `10-TESTING.md`

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
| Gate | `agent-ready`, `needs-spec`, `blocked` | Stato lavorabilità |
| Tipo | `bug`, `enhancement`, `refactor`, `docs` | Classificazione |

### Template issue

    ## Descrizione
    Cosa deve essere fatto e perché.

    ## Specifica di riferimento
    - [ ] `docs/XX-NOME.md` (status: 🟢 APPROVED)

    ## Acceptance criteria
    - [ ] criterio 1 verificabile
    - [ ] criterio 2 verificabile

    ## Fixture di test
    - `fixtures/.../...`

    ## Note
    Eventuali edge case o vincoli.

## 🌳 Git workflow

- Branch: `feat/<issue-number>-<descrizione>` o `fix/<issue-number>-<descrizione>`
- Commit: **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Branch `main` protetto: richiede PR e review
- Nessun force push su `main`
- Una PR = una issue (salvo eccezioni)

### Template commit

    <type>(<scope>): <description>

    [body opzionale]

    Ref: #<issue-number>

## 📝 Checklist di auto-revisione PR

Prima di aprire una PR, verifica:

- [ ] Ho letto `AGENTS.md` e i documenti linkati dal task
- [ ] Il codice rispetta lo schema dati (`02-DATA-SCHEMA.md`)
- [ ] Ho scritto test che coprono il caso felice e almeno 2 edge case
- [ ] Ho usato i fixture di `fixtures/synthetic-history/` e `fixtures/scenarios/`
- [ ] Ho seguito il naming e lo stile del codebase
- [ ] JSDoc su tutte le funzioni pubbliche
- [ ] Nessun dato personale hardcoded, nessun log di PII
- [ ] `pnpm run lint` e `pnpm run test` passano in locale
- [ ] Coverage del modulo ≥ target in `10-TESTING.md` §2
- [ ] Ho aggiornato `docs/11-BACKLOG.md` se la story è completata

## 💬 Come segnalare problemi

### Discrepanza tra specifiche

1. Cerca tra le issue aperte
2. Apri issue con label `needs-spec`
3. Riferimento ai documenti e linee specifiche
4. Descrizione dell'incoerenza
5. Proposta di risoluzione (opzionale)

**Mai risolvere incoerenze modificando il codice senza documentarlo.**

### Bug nel codice

- Issue con label `bug`
- Passi per riprodurre
- Comportamento atteso vs osservato
- Eventuale test di regressione da aggiungere

## 📜 Registro delle decisioni

Tutte le decisioni architetturali importanti sono in `docs/13-ADR/`. Prima di proporre modifiche architetturali, verifica che non ci sia già un ADR. Se vuoi proporre un nuovo ADR, apri issue con label `area:devops` e proponi il testo.

## 🗺️ Struttura del repository

    Life-Soundtrack/
    ├── AGENTS.md                ← questo file
    ├── README.md
    ├── docs/                    ← specifica completa
    │   ├── INDEX.md             ← stato master
    │   ├── SESSIONS.md          ← log sessioni
    │   ├── 00-VISION.md
    │   ├── 01-PLATFORMS.md
    │   ├── 02-DATA-SCHEMA.md
    │   ├── 03-ADAPTERS/         ← spec di ogni adapter
    │   ├── 04-ANALYSIS-ALGORITHMS.md
    │   ├── 05-ARCHITECTURE.md
    │   ├── 10-TESTING.md
    │   ├── 11-BACKLOG.md
    │   ├── 13-ADR/              ← decisioni architetturali
    │   ├── 14-GLOSSARY.md
    │   └── 15-DESIGN-SYSTEM.md
    ├── design/                  ← mockup, token, asset
    ├── fixtures/                ← dataset di test
    │   ├── synthetic-history/   ← fixture per adapter
    │   ├── db-seed/             ← seed per DB
    │   ├── scenarios/           ← scenari di vita
    │   └── api-mocks/           ← mock API esterne
    ├── apps/
    │   ├── web/                 ← PWA principale
    │   └── desktop/             ← Tauri (Fase 2)
    ├── packages/
    │   ├── core/                ← logica condivisa
    │   └── ui/                  ← design system
    └── scripts/                 ← utility

## 🚀 Primo task di un agente

Se sei un agente e ti hanno chiesto di iniziare a lavorare senza un task specifico:

1. Leggi questo file
2. Leggi `docs/INDEX.md` e `docs/11-BACKLOG.md`
3. Cerca la prima story ⬚ TODO con label `agent-ready` nella fase più bassa disponibile
4. Clona il repo, crea branch `feat/<issue>-<descrizione>`
5. Implementa con test
6. Apri PR

Se non ci sono issue `agent-ready`, segnalalo al project owner aprendo una issue con label `needs-spec`.

## 📞 Contatti

- Project owner: `@amedeo82`
- Per decisioni strategiche: aspetta review sulla PR
- Per questioni tecniche: usa le issue
- Per ambiguità di specifica: issue `needs-spec`

---

*Ultimo aggiornamento: Sessione 3 — Versione stabile 1.0*