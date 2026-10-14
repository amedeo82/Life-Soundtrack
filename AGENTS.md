# 🤖 AGENTS.md — Protocollo per Agenti di Sviluppo

> **Questo è il primo file che un agente deve leggere, prima di qualsiasi altro.**
> Se sei un agente di sviluppo (Cursor, Claude, GPT, Codex, Copilot, etc.) questo documento definisce come lavorare su Life Soundtrack.

---

## 📚 Ordine obbligatorio di lettura

Quando ricevi un task su questo repository, segui questo ordine:

1. **Questo file** (`AGENTS.md`) — il protocollo
2. **[`docs/INDEX.md`](docs/INDEX.md)** — lo stato del progetto e l'indice dei documenti
3. **[`docs/00-VISION.md`](docs/00-VISION.md)** — il "perché" del progetto
4. **[`docs/05-ARCHITECTURE.md`](docs/05-ARCHITECTURE.md)** — l'architettura generale
5. **[`docs/14-GLOSSARY.md`](docs/14-GLOSSARY.md)`** — definizioni condivise
6. **La specifica del task** (linkata nell'issue GitHub che ti è stata assegnata)

**Non saltare questi passi.** Il contesto è essenziale per produrre codice coerente.

## ✅ Cosa puoi fare autonomamente

- Scrivere codice in TypeScript/React/Python secondo lo stack definito
- Creare test unitari e di integrazione
- Aprire PR con checklist di auto-revisione (vedi sotto)
- Segnalare ambiguità nelle specifiche tramite issue GitHub con label `needs-spec`

## 🚫 Cosa NON puoi decidere autonomamente

Queste decisioni sono già state prese e **non devono essere rimesse in discussione** senza passare per una issue `needs-spec` e approvazione umana:

- Architettura (PWA-first, local-first, adapter pattern)
- Schema dati (`docs/02-DATA-SCHEMA.md`)
- Formati e parsing degli adapter (`docs/03-ADAPTERS/`)
- Algoritmi di analisi (`docs/04-ANALYSIS-ALGORITHMS.md`)
- Design system (colori, tipografia, componenti → `docs/15-DESIGN-SYSTEM.md`)
- Copy e stringhe utente (`docs/08-COPY-I18N.md`)
- Privacy e flusso dati (`docs/09-PRIVACY-SECURITY.md`)

**Regola d'oro**: se una decisione è già documentata, *è vincolante*. In caso di dubbio, **apri una issue invece di inventare**.

## 🔖 Sistema di issue e label

Le issue su GitHub sono il backlog operativo. Una issue può essere lavorata da un agente **solo se**:

- Ha la label `agent-ready`
- Contiene un link a una specifica approvata (`status: APPROVED`) nel repo

### Label disponibili

| Label | Significato |
|-------|-------------|
| `phase-0` … `phase-4` | Fase della roadmap |
| `area:adapter`, `area:analysis`, `area:ui`, `area:ux`, `area:privacy`, `area:devops` | Modulo coinvolto |
| `priority:blocker`, `priority:important`, `priority:later` | Priorità |
| `agent-ready` | ⭐ **Specifica approvata, agente può procedere** |
| `needs-spec` | 🛑 **Bloccato: manca la specifica** |
| `bug`, `enhancement`, `refactor` | Classificazione tecnica |

## 🌳 Git workflow

- Branch di lavoro: `feat/<issue-number>-<descrizione>` o `fix/<issue-number>-<descrizione>`
- Commit message: **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Il branch `main` è protetto: richiede PR e review
- Nessun force push su `main`
- Una PR = una issue (salvo eccezioni documentate)

### Template commit

    <type>(<scope>): <description>

    [body opzionale]

    Ref: #<issue-number>

Esempio: `feat(adapter): implement spotify gdpr parser (Ref: #12)`

## 🧪 Testing

- Ogni adapter ha test contro i fixture in `fixtures/synthetic-history/`
- Ogni algoritmo di analisi ha test con input/output attesi documentati nella specifica
- Coverage target: 80% sul `packages/core/`
- Comando test: definito in `docs/10-TESTING.md`

## 📝 Checklist di auto-revisione PR

Prima di aprire una PR, verifica:

- [ ] Ho letto `AGENTS.md` e i documenti linkati dal task
- [ ] Il codice rispetta lo schema dati (`docs/02-DATA-SCHEMA.md`)
- [ ] Ho scritto test che coprono il caso felice e almeno 2 edge case
- [ ] Ho usato i fixture di `fixtures/synthetic-history/` per i test
- [ ] Ho seguito il naming e lo stile del resto del codebase
- [ ] Ho aggiunto/aggiornato i commenti JSDoc sulle funzioni pubbliche
- [ ] Nessun dato personale hardcoded, nessun log di PII
- [ ] `npm run lint` e `npm run test` passano in locale

## 💬 Come segnalare problemi

Se trovi una discrepanza tra una specifica e il codice, o tra due specifiche:

1. Cerca prima tra le issue aperte
2. Se non esiste, apri una issue con:
   - Label `needs-spec` o `bug`
   - Riferimento al documento/linea specifica
   - Descrizione dell'incoerenza
   - Proposta di risoluzione (opzionale)

**Mai risolvere incoerenze modificando il codice senza documentarlo.**

## 📜 Registro delle decisioni

Tutte le decisioni architetturali importanti sono tracciate come **Architecture Decision Record (ADR)** in `docs/13-ADR/`. Prima di proporre una modifica architetturale, verifica che non ci sia già un ADR che la copre.

## 🗺️ Struttura del repository

    Life-Soundtrack/
    ├── AGENTS.md              ← questo file
    ├── README.md
    ├── docs/                  ← specifica completa del progetto
    ├── design/                ← mockup, token, asset grafici
    ├── fixtures/              ← dataset di test sintetici
    ├── scripts/               ← utility
    └── (src/ verrà creato nella Fase 0 tecnica)

## 📞 Contatti

Il project owner è `@amedeo82`. Per decisioni non tecniche o dubbi strategici, aspetta la sua review sulla PR. Per tutto ciò che è tecnico, usa le issue.

---

## 🔄 Handoff tra conversazioni (per umani)

Questo progetto è progettato per funzionare attraverso **conversazioni multiple** con l'AI (Claude o altri). Quando la conversazione diventa troppo lunga o devi riprendere dopo un'interruzione:

1. **Verifica che tutto sia pushato su GitHub**: `git status` deve essere pulito
2. **Apri una nuova conversazione** con l'AI
3. **Dai il prompt di riattivazione** (copialo sotto):

---

*Ultimo aggiornamento: Sessione 0 — Bootstrap repository*
