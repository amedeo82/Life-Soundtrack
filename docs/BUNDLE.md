# BUNDLE CONTENUTO

> Generato automaticamente da scripts/generate-bundle.ps1
> Data: 2026-10-14 14:55

===== FILE: AGENTS.md =====

# ðŸ¤– AGENTS.md â€” Protocollo per Agenti di Sviluppo

> **Questo Ã¨ il primo file che un agente deve leggere, prima di qualsiasi altro.**
> Versione 1.0 â€” Sessione 3 (stabile)

---

## ðŸ“š Ordine obbligatorio di lettura

Quando ricevi un task su questo repository, segui questo ordine:

1. **Questo file** (`AGENTS.md`) â€” il protocollo
2. **[`docs/INDEX.md`](docs/INDEX.md)** â€” stato del progetto
3. **[`docs/00-VISION.md`](docs/00-VISION.md)** â€” il "perchÃ©"
4. **[`docs/05-ARCHITECTURE.md`](docs/05-ARCHITECTURE.md)** â€” architettura
5. **[`docs/14-GLOSSARY.md`](docs/14-GLOSSARY.md)** â€” linguaggio comune
6. **[`docs/11-BACKLOG.md`](docs/11-BACKLOG.md)** â€” il lavoro da fare
7. **[`docs/10-TESTING.md`](docs/10-TESTING.md)`** â€” come testare
8. **La specifica del task** (linkata nell'issue)

**Non saltare questi passi.** Il contesto Ã¨ essenziale.

## ðŸ”„ Handoff tra conversazioni AI

Questo progetto Ã¨ progettato per funzionare attraverso conversazioni multiple con l'AI. Quando una conversazione diventa lunga o devi riprendere dopo un'interruzione:

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

4. L'AI userÃ  i suoi tool web (se il repo Ã¨ pubblico) o i file incollati per continuare

**Il PAT va dato agli agenti di sviluppo** (Claude Code, Cursor, Copilot) con scope `contents: read/write` sul repo solo. L'AI di review (come Claude in chat) non ha bisogno di PAT.

## âœ… Cosa puoi fare autonomamente

- Scrivere codice in TypeScript/React secondo lo stack definito
- Creare test unitari e di integrazione
- Aprire PR con checklist di auto-revisione
- Segnalare ambiguitÃ  nelle specifiche tramite issue con label `needs-spec`
- Usare i fixture in `fixtures/` per i test

## ðŸš« Cosa NON puoi decidere autonomamente

Queste decisioni sono giÃ  prese e **vincolanti** (status ðŸŸ¢ APPROVED):

- Architettura: PWA-first, local-first, adapter pattern (ADR 0001, 0002, 0003)
- Schema dati: `02-DATA-SCHEMA.md` (quando approvato)
- Formato adapter: `03-ADAPTERS/SPEC-TEMPLATE.md`
- Algoritmi: `04-ANALYSIS-ALGORITHMS.md` (quando scritto)
- Design system: `15-DESIGN-SYSTEM.md`
- Copy e i18n: `08-COPY-I18N.md` (quando scritto)
- Privacy: `09-PRIVACY-SECURITY.md` (quando scritto)
- Test strategy: `10-TESTING.md`

**Regola d'oro**: se una decisione Ã¨ documentata e ðŸŸ¢ APPROVED, Ã¨ vincolante. Se Ã¨ ðŸŸ¡ DRAFT, puoi proporre modifiche aprendo una issue. Se non esiste, **apri una issue `needs-spec` invece di inventare**.

## ðŸ”– Sistema di issue e label

### Label obbligatorie per agent-ready

Una issue puÃ² essere lavorata da un agente **solo se**:

- [ ] Ha label `agent-ready`
- [ ] Contiene link a una specifica ðŸŸ¢ APPROVED nel repo
- [ ] Ha acceptance criteria verificabili

### Label disponibili

| Categoria | Label | Significato |
|-----------|-------|-------------|
| Fase | `phase-0` â€¦ `phase-6` | Fase della roadmap |
| Area | `area:adapter`, `area:analysis`, `area:ui`, `area:ux`, `area:db`, `area:enrichment`, `area:privacy`, `area:devops` | Modulo coinvolto |
| PrioritÃ  | `priority:blocker`, `priority:important`, `priority:later` | Ordine di lavoro |
| Size | `size:S`, `size:M`, `size:L`, `size:XL` | Stima relativa |
| Gate | `agent-ready`, `needs-spec`, `blocked` | Stato lavorabilitÃ  |
| Tipo | `bug`, `enhancement`, `refactor`, `docs` | Classificazione |

### Template issue

    ## Descrizione
    Cosa deve essere fatto e perchÃ©.

    ## Specifica di riferimento
    - [ ] `docs/XX-NOME.md` (status: ðŸŸ¢ APPROVED)

    ## Acceptance criteria
    - [ ] criterio 1 verificabile
    - [ ] criterio 2 verificabile

    ## Fixture di test
    - `fixtures/.../...`

    ## Note
    Eventuali edge case o vincoli.

## ðŸŒ³ Git workflow

- Branch: `feat/<issue-number>-<descrizione>` o `fix/<issue-number>-<descrizione>`
- Commit: **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Branch `main` protetto: richiede PR e review
- Nessun force push su `main`
- Una PR = una issue (salvo eccezioni)

### Template commit

    <type>(<scope>): <description>

    [body opzionale]

    Ref: #<issue-number>

## ðŸ“ Checklist di auto-revisione PR

Prima di aprire una PR, verifica:

- [ ] Ho letto `AGENTS.md` e i documenti linkati dal task
- [ ] Il codice rispetta lo schema dati (`02-DATA-SCHEMA.md`)
- [ ] Ho scritto test che coprono il caso felice e almeno 2 edge case
- [ ] Ho usato i fixture di `fixtures/synthetic-history/` e `fixtures/scenarios/`
- [ ] Ho seguito il naming e lo stile del codebase
- [ ] JSDoc su tutte le funzioni pubbliche
- [ ] Nessun dato personale hardcoded, nessun log di PII
- [ ] `pnpm run lint` e `pnpm run test` passano in locale
- [ ] Coverage del modulo â‰¥ target in `10-TESTING.md` Â§2
- [ ] Ho aggiornato `docs/11-BACKLOG.md` se la story Ã¨ completata

## ðŸ’¬ Come segnalare problemi

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

## ðŸ“œ Registro delle decisioni

Tutte le decisioni architetturali importanti sono in `docs/13-ADR/`. Prima di proporre modifiche architetturali, verifica che non ci sia giÃ  un ADR. Se vuoi proporre un nuovo ADR, apri issue con label `area:devops` e proponi il testo.

## ðŸ—ºï¸ Struttura del repository

    Life-Soundtrack/
    â”œâ”€â”€ AGENTS.md                â† questo file
    â”œâ”€â”€ README.md
    â”œâ”€â”€ docs/                    â† specifica completa
    â”‚   â”œâ”€â”€ INDEX.md             â† stato master
    â”‚   â”œâ”€â”€ SESSIONS.md          â† log sessioni
    â”‚   â”œâ”€â”€ 00-VISION.md
    â”‚   â”œâ”€â”€ 01-PLATFORMS.md
    â”‚   â”œâ”€â”€ 02-DATA-SCHEMA.md
    â”‚   â”œâ”€â”€ 03-ADAPTERS/         â† spec di ogni adapter
    â”‚   â”œâ”€â”€ 04-ANALYSIS-ALGORITHMS.md
    â”‚   â”œâ”€â”€ 05-ARCHITECTURE.md
    â”‚   â”œâ”€â”€ 10-TESTING.md
    â”‚   â”œâ”€â”€ 11-BACKLOG.md
    â”‚   â”œâ”€â”€ 13-ADR/              â† decisioni architetturali
    â”‚   â”œâ”€â”€ 14-GLOSSARY.md
    â”‚   â””â”€â”€ 15-DESIGN-SYSTEM.md
    â”œâ”€â”€ design/                  â† mockup, token, asset
    â”œâ”€â”€ fixtures/                â† dataset di test
    â”‚   â”œâ”€â”€ synthetic-history/   â† fixture per adapter
    â”‚   â”œâ”€â”€ db-seed/             â† seed per DB
    â”‚   â”œâ”€â”€ scenarios/           â† scenari di vita
    â”‚   â””â”€â”€ api-mocks/           â† mock API esterne
    â”œâ”€â”€ apps/
    â”‚   â”œâ”€â”€ web/                 â† PWA principale
    â”‚   â””â”€â”€ desktop/             â† Tauri (Fase 2)
    â”œâ”€â”€ packages/
    â”‚   â”œâ”€â”€ core/                â† logica condivisa
    â”‚   â””â”€â”€ ui/                  â† design system
    â””â”€â”€ scripts/                 â† utility

## ðŸš€ Primo task di un agente

Se sei un agente e ti hanno chiesto di iniziare a lavorare senza un task specifico:

1. Leggi questo file
2. Leggi `docs/INDEX.md` e `docs/11-BACKLOG.md`
3. Cerca la prima story â¬š TODO con label `agent-ready` nella fase piÃ¹ bassa disponibile
4. Clona il repo, crea branch `feat/<issue>-<descrizione>`
5. Implementa con test
6. Apri PR

Se non ci sono issue `agent-ready`, segnalalo al project owner aprendo una issue con label `needs-spec`.

## ðŸ“ž Contatti

- Project owner: `@amedeo82`
- Per decisioni strategiche: aspetta review sulla PR
- Per questioni tecniche: usa le issue
- Per ambiguitÃ  di specifica: issue `needs-spec`

---

*Ultimo aggiornamento: Sessione 3 â€” Versione stabile 1.0*

===== FILE: README.md =====

# ðŸŽµ Life Soundtrack

> *La colonna sonora della tua vita, finalmente leggibile.*

Life Soundtrack Ã¨ un'applicazione web (PWA) che trasforma i metadati grezzi delle piattaforme di streaming musicale in un **diario di vita personale**: una timeline emotiva, contestuale e narrativa che racconta la storia dell'utente attraverso la musica che ha ascoltato.

## âœ¨ Cosa fa

- Importa la cronologia di ascolto da Spotify, YouTube Music, Apple Music, Deezer, Tidal, SoundCloud, Last.fm, ListenBrainz
- Arricchisce i dati con audio features (valence, energy, danceability, BPM)
- Ricostruisce la tua vita musicale in **ere**, **mood**, **eventi**, **ricordi**
- Ti permette di rivivere i periodi della tua vita attraverso la loro colonna sonora
- **Tutto resta sul tuo dispositivo**: elaborazione locale, privacy-first, GDPR-compliant

## ðŸ—ï¸ Stato del progetto

Attualmente in **fase di progettazione** (docs/). Nessuna riga di codice ancora scritta.

- Documentazione: [`docs/INDEX.md`](docs/INDEX.md)
- Protocollo agenti: [`AGENTS.md`](AGENTS.md)
- Visione: [`docs/00-VISION.md`](docs/00-VISION.md)

## ðŸ¤ Come contribuire

Questo progetto Ã¨ attualmente gestito da un team umano + AI. Per iniziare a lavorare sul codice, leggi **`AGENTS.md`** come primo file.

## ðŸ“œ Licenza

Da definire (vedi [`docs/13-ADR/`](docs/13-ADR/)). Placeholder: tutti i diritti riservati.

---

*Questo README Ã¨ mantenuto aggiornato dal log delle sessioni in [`docs/SESSIONS.md`](docs/SESSIONS.md).*


===== FILE: docs/INDEX.md =====

# ðŸ“š Indice della Documentazione

> Stato master del progetto. Aggiornato ad ogni sessione di progettazione.
> **Leggi questo file prima di qualsiasi altro per avere una panoramica.**

## Legenda stati

| Status | Significato |
|--------|-------------|
| ðŸŸ¢ APPROVED | Documento approvato da Boss, vincolante per gli agenti |
| ðŸŸ¡ DRAFT | Bozza in discussione, non ancora approvata |
| ðŸ”´ TODO | Documento da scrivere |

## Documenti fondamentali

| # | File | Stato | Ultima modifica | Descrizione |
|---|------|-------|-----------------|-------------|
| 00 | [`00-VISION.md`](00-VISION.md) | ðŸŸ¡ DRAFT | Sessione 0 | Visione, missione, target, principi |
| 01 | [`01-PLATFORMS.md`](01-PLATFORMS.md) | ðŸŸ¡ DRAFT | Sessione 0 | Matrice piattaforme europee + campi dati |
| 02 | [`02-DATA-SCHEMA.md`](02-DATA-SCHEMA.md) | ðŸŸ¡ DRAFT | Sessione 1 | Schema dati unificato (TypeScript + Dexie) |
| 03 | [`03-ADAPTERS/`](03-ADAPTERS/) | ðŸŸ¡ DRAFT | Sessione 2 | Specifiche dei singoli adapter (TEMPLATE + Spotify) |
| 04 | [`04-ANALYSIS-ALGORITHMS.md`](04-ANALYSIS-ALGORITHMS.md) | ðŸŸ¡ DRAFT | Sessione 4 | Algoritmi di analisi (mood, ere, eventi, ricordi) |
| 05 | [`05-ARCHITECTURE.md`](05-ARCHITECTURE.md) | ðŸŸ¡ DRAFT | Sessione 0 | Architettura tecnica generale |
| 06 | [`06-UX-FLOWS-STATES.md`](06-UX-FLOWS-STATES.md) | ðŸŸ¡ DRAFT | Sessione 5 | Flussi UX e stati per schermata |
| 07 | [`07-UI-SPEC.md`](07-UI-SPEC.md) | ðŸ”´ TODO | â€” | Specifiche UI componenti |
| 08 | [`08-COPY-I18N.md`](08-COPY-I18N.md) | ðŸŸ¡ DRAFT | Sessione 5 | Tutte le stringhe UI con chiavi i18n |
| 09 | [`09-PRIVACY-SECURITY.md`](09-PRIVACY-SECURITY.md) | ðŸ”´ TODO | â€” | Privacy spec, data flow, security |
| 10 | [`10-TESTING.md`](10-TESTING.md) | ðŸŸ¡ DRAFT | Sessione 3 | Strategia di testing |
| 11 | [`11-BACKLOG.md`](11-BACKLOG.md) | ðŸŸ¡ DRAFT | Sessione 3 | Backlog strutturato (epic â†’ story â†’ task) |
| 12 | [`12-DEVOPS.md`](12-DEVOPS.md) | ðŸ”´ TODO | â€” | CI/CD, deploy, self-hosting |
| 13 | [`13-ADR/`](13-ADR/) | ðŸŸ¡ DRAFT | Sessione 1 | Architecture Decision Records (0001-0003) |
| 14 | [`14-GLOSSARY.md`](14-GLOSSARY.md) | ðŸŸ¡ DRAFT | Sessione 1 | Glossario di dominio |
| 15 | [`15-DESIGN-SYSTEM.md`](15-DESIGN-SYSTEM.md) | ðŸŸ¡ DRAFT | Sessione 0 | Design system completo |

## Documenti di supporto

| File | Stato | Descrizione |
|------|-------|-------------|
| [`SESSIONS.md`](SESSIONS.md) | ðŸŸ¡ LIVE | Log di tutte le sessioni di progettazione |
| [`../AGENTS.md`](../AGENTS.md) | ðŸŸ¡ DRAFT | Protocollo per agenti |

## Design & mockup

| Cartella | Contenuto |
|----------|-----------|
| [`../design/mockups/`](../design/mockups/) | Le 14 schermate generate + tour logico |
| [`../design/tokens.json`](../design/tokens.json) | (futuro) Design tokens per il codice |
| [`../design/assets/`](../design/assets/) | (futuro) Logo, icone, illustrazioni |

## Fixture di test

| Cartella | Contenuto |
|----------|-----------|
| [`../fixtures/synthetic-history/`](../fixtures/synthetic-history/) | Dataset di test sintetici per ogni adapter |

## Roadmap Sessioni di Progettazione

| Sessione | Nome | Stato |
|----------|------|-------|
| 0 | ðŸ”’ Consolidamento + Bootstrap | âœ… **COMPLETATA** |
| 1 | ðŸ—„ï¸ Fondamenta dati | âœ… **COMPLETATA** |
| 2 | ðŸ”Œ Primo adapter (Spotify) | âœ… **COMPLETATA** |
| 3 | ðŸ“‹ Governo (backlog + testing + AGENTS finale) | âœ… **COMPLETATA** |
| 4 | ðŸ§  Analisi algoritmica | âœ… **COMPLETATA** |
| 5 | ðŸ§­ UX completa + i18n | âœ… **COMPLETATA** |
| 6 | ðŸ” Privacy & legale | ðŸ”´ |
| 7 | ðŸŽ¨ UI eseguibile + tokens | ðŸ”´ |
| 8 | âš™ï¸ DevOps | ðŸ”´ |

---

*Questo file viene aggiornato ad ogni sessione. Non modificarlo senza aggiornare anche `SESSIONS.md`.*

===== FILE: docs/SESSIONS.md =====

# ðŸ“ Log delle Sessioni di Progettazione

> Memoria cronologica di tutte le sessioni di lavoro sul progetto.
> **Questo file Ã¨ la nostra memoria condivisa** tra Boss, AI progettista e futuri agenti.

---

## Sessione 0 â€” ðŸ”’ Consolidamento + Bootstrap

**Data**: ottobre 2026
**Stato**: ðŸŸ¡ In corso

### Obiettivi

1. Creare il repository GitHub privato `Life-Soundtrack`
2. Consolidare tutto il materiale prodotto nelle sessioni esplorative in file strutturati in `docs/` e `design/`
3. Creare i documenti base di governance (`README.md`, `AGENTS.md`, `INDEX.md`, `SESSIONS.md`, `00-VISION.md`)
4. Preparare il terreno per le sessioni tecniche 1-8

### Documenti prodotti

- âœ… `README.md`
- âœ… `AGENTS.md` (scheletro â€” da raffinare in Sessione 3)
- âœ… `docs/INDEX.md`
- âœ… `docs/SESSIONS.md` (questo file)
- âœ… `docs/00-VISION.md` (DRAFT)

### Decisioni prese

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D0.1 | Repo privato su account `amedeo82`, nome `Life-Soundtrack` | Scelta del project owner |
| D0.2 | Struttura cartelle: `docs/`, `design/`, `fixtures/`, `scripts/` | Separazione chiara tra specifica, asset, test e tooling |
| D0.3 | Branch model: `main` protetto + branch temporanei feat/fix | Semplice e sicuro |
| D0.4 | Commit convention: Conventional Commits | LeggibilitÃ  della storia |
| D0.5 | Label GitHub con `agent-ready` come gate per gli agenti | Gli agenti lavorano solo su specifiche approvate |
| D0.6 | 8 sessioni di progettazione pianificate (vedi INDEX.md) | Copertura completa prima dell'handoff agli agenti |
| D0.7 | Pilastri non negoziabili: local-first e privacy-first | Differenziazione e compliance GDPR |

### Materiale pregresso da consolidare (Sessione 0 â€” Parte 2)

| Contenuto prodotto in chat | Destinazione |
|----------------------------|--------------|
| Analisi fattibilitÃ  + matrice dati piattaforme | `01-PLATFORMS.md` |
| Architettura (local-first, adapter pattern, stack) | `05-ARCHITECTURE.md` |
| Design system (brand, palette, type, componenti) | `15-DESIGN-SYSTEM.md` |
| Tour delle 14 schermate + copy deck | `design/mockups/` + `06-UX-FLOWS-STATES.md` + `08-COPY-I18N.md` |
| Scelta PWA-first | ADR `0001-pwa-first.md` |
| Roadmap a fasi + rischi | `11-BACKLOG.md` |

### Prossimi passi

1. Commit e push dei 5 file di governance
2. Sessione 0 Parte 2: consolidamento materiale pregresso
3. Sessione 1: schema dati eseguibile

---

## Sessione 0 â€” Parte 2 â€” ðŸ“¦ Consolidamento materiale esplorativo

**Data**: ottobre 2026
**Stato**: âœ… Completata

### Documenti prodotti
- âœ… `docs/01-PLATFORMS.md` (DRAFT)
- âœ… `docs/05-ARCHITECTURE.md` (DRAFT)
- âœ… `docs/15-DESIGN-SYSTEM.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D0.8 | Scope MVP = 8 sorgenti + self-hosted via scrobbling; resto rinviato | Coprire il 90%+ del mercato europeo con sforzo sostenibile |
| D0.9 | Design system consolidato ora; spec per componente rinviata a Sessione 7 | Evitare over-engineering prima dello schema dati |
| D0.10 | Edge case noti catalogati in `01-PLATFORMS.md` Â§5 come vincoli adapter | Gli agenti non devono riscoprirli da zero |

### Prossimi passi
- Sessione 1: `02-DATA-SCHEMA.md`, `14-GLOSSARY.md`, ADR 0001-0003

## Sessione 1 â€” ðŸ—„ï¸ Fondamenta dati

**Data**: ottobre 2026
**Stato**: âœ… Completata

### Documenti prodotti
- âœ… `docs/02-DATA-SCHEMA.md` (DRAFT â€” pending approvazione Boss)
- âœ… `docs/14-GLOSSARY.md` (DRAFT â€” pending approvazione Boss)
- âœ… `docs/13-ADR/0001-pwa-first.md` (DRAFT â€” pending approvazione Boss)
- âœ… `docs/13-ADR/0002-local-first.md` (DRAFT â€” pending approvazione Boss)
- âœ… `docs/13-ADR/0003-adapter-pattern.md` (DRAFT â€” pending approvazione Boss)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D1.1 | `timestamp` = fine ascolto, `startedAt` = inizio; tabella semantica per piattaforma | Coerenza temporale cross-platform |
| D1.2 | Idempotenza import via `eventKey` unico | Re-import sicuri senza duplicati |
| D1.3 | Dedup tracce: ISRC â†’ MBID â†’ fuzzy hash **con durata** (DEDUP-1..3) | Bilancia precisione e copertura; bucket 2s |
| D1.4 | IP non persistito DI DEFAULT; toggle esplicito `PrivacySettings.retainIp` | Privacy-by-design + controllo utente |
| D1.5 | Derivati versionati (`derivedVersion`) e ricalcolabili | Coerenza analisi nel tempo |
| D1.6 | Contatori denormalizzati ricalcolabili (`recount()`) | Performance senza perdere veritÃ  |

### Aperti per approvazione Boss
- [ ] 02-DATA-SCHEMA.md â†’ ðŸŸ¢ APPROVED?
- [ ] 14-GLOSSARY.md â†’ ðŸŸ¢ APPROVED?
- [ ] ADR 0001/0002/0003 â†’ ðŸŸ¢ APPROVED?

### Prossimo passo
- **Sessione 2** (in nuova chat): SPEC-TEMPLATE adapter + spotify.md + fixture `fixtures/synthetic-history/spotify-sample.json`

## Sessione 2 â€” ðŸ”Œ Template adapter + Spotify

**Data**: ottobre 2026
**Stato**: âœ… Completata

### Documenti prodotti
- âœ… `docs/03-ADAPTERS/SPEC-TEMPLATE.md` (DRAFT)
- âœ… `docs/03-ADAPTERS/spotify.md` (DRAFT)
- âœ… `fixtures/synthetic-history/spotify-sample.json` (10 eventi sintetici con edge case)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D2.1 | SPEC-TEMPLATE come formato fisso per ogni adapter | Coerenza, reviewability |
| D2.2 | Regola `skipped` derivata (E1) documentata in spotify.md | Risolve bug storico Spotify |
| D2.3 | `CarDetectionEvent.json` richiede consenso separato da `retainIp` | Tracciamento movimenti = dato particolarmente sensibile |
| D2.4 | Fixture sintetico con 10 eventi rappresentativi | Base test per tutti gli adapter |
| D2.5 | `eventKey` = `platform:spotify_uri` o hash fallback | Idempotenza garantita |

### Aperti per approvazione Boss
- [ ] 03-ADAPTERS/SPEC-TEMPLATE.md â†’ ðŸŸ¢ APPROVED?
- [ ] 03-ADAPTERS/spotify.md â†’ ðŸŸ¢ APPROVED?

### Prossimo passo
- Sessione 3: Backlog strutturato + Testing strategy + AGENTS.md finale
- Dopo Sessione 3: valutare bundle di handoff per chiudere chat o continuare

## Sessione 3 â€” ðŸ“‹ Governo

**Data**: ottobre 2026
**Stato**: âœ… Completata

### Documenti prodotti
- âœ… `docs/11-BACKLOG.md` (DRAFT) â€” 5 epic, 17 story, ordinamento prioritÃ 
- âœ… `docs/10-TESTING.md` (DRAFT) â€” piramide test, coverage target, fixture strategy
- âœ… `AGENTS.md` (v1.0 stabile) â€” protocollo finale con handoff tra chat

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D3.1 | Backlog con 5 epic (fondamenta, import, analisi, UI, privacy) | Copertura MVP + estensioni future |
| D3.2 | Story 0.1-0.4 come "fondamenta obbligatorie" sequenziali | Dipendenza critica; senza queste nulla funziona |
| D3.3 | Label GitHub `agent-ready` come gate unico per lavoro agenti | Evita agenti che improvvisano su spec mancanti |
| D3.4 | Coverage target differenziato per modulo | Adapter critici al 90%, UI al 70% |
| D3.5 | 3 categorie di fixture: synthetic-history, db-seed, scenarios | Separazione responsabilitÃ  test |
| D3.6 | AGENTS.md v1.0 stabile con sezione handoff | Pronti per chat multiple senza perdita di contesto |

### Aperti per approvazione Boss
- [ ] `docs/11-BACKLOG.md` â†’ ðŸŸ¢ APPROVED?
- [ ] `docs/10-TESTING.md` â†’ ðŸŸ¢ APPROVED?
- [ ] `AGENTS.md` v1.0 â†’ ðŸŸ¢ APPROVED?
- [ ] Documenti Sessione 1 (02-DATA-SCHEMA, GLOSSARY, ADR 0001-0003) â†’ ðŸŸ¢ APPROVED?
- [ ] Documenti Sessione 2 (SPEC-TEMPLATE, spotify.md) â†’ ðŸŸ¢ APPROVED?

### Prossimi passi
- Boss approva i documenti DRAFT (o chiede modifiche)
- Sessione 4: `04-ANALYSIS-ALGORITHMS.md` (formule mood, ere, eventi, ricordi)
- Valutare se fare bundle di handoff o continuare qui

## Sessione 4 â€” ðŸ§  Algoritmi di analisi

**Data**: ottobre 2026
**Stato**: âœ… Completata

### Documenti prodotti
- âœ… `docs/04-ANALYSIS-ALGORITHMS.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D4.1 | Mood come quadrante valenceÃ—energy con fascia neutra centrale | Evita flip-flop tra mood |
| D4.2 | Era detector via change point detection su firme settimanali | PiÃ¹ robusto del clustering k-means puro |
| D4.3 | Similarity multi-dimensionale pesata (generi 50%, artisti 30%, numerici 20%) | Bilancia aspetti qualitativi e quantitativi |
| D4.4 | Event detector via z-score + rilevatori specializzati per silence/exploration | z-score Ã¨ interpretabile, specializzati catturano casi non-statistici |
| D4.5 | 5 tipi di ricordo con scoring e ranking | Feed ordinato per rilevanza |
| D4.6 | Pipeline incrementale (non full-rewrite) | Performance su file grandi |
| D4.7 | derivedVersion = sha1(config)[:8] | Rileva automaticamente cambiamenti parametri |

### Aperti per approvazione Boss
- [ ] `04-ANALYSIS-ALGORITHMS.md` â†’ ðŸŸ¢ APPROVED?

### Stato progetto dopo Sessione 4
- âœ… Visione, piattaforme, architettura, design system
- âœ… Schema dati, glossario, ADR fondanti
- âœ… Template adapter + Spotify adapter + fixture
- âœ… Backlog, testing, protocollo agenti
- âœ… **Algoritmi di analisi** â† completato ora
- â³ Rimangono: UX states/i18n (S5), privacy (S6), UI spec (S7), devops (S8)

### Prossimi passi
- Boss approva `04-ANALYSIS-ALGORITHMS.md`
- Valutare bundle di handoff per chiudere chat pulita
- Sessione 5 (UX flows + i18n) in nuova chat o qui

## Sessione 5 â€” ðŸ§­ UX completa + i18n

**Data**: ottobre 2026
**Stato**: âœ… Completata

### Documenti prodotti
- âœ… `docs/06-UX-FLOWS-STATES.md` (DRAFT)
- âœ… `docs/08-COPY-I18N.md` (DRAFT)
- âœ… `docs/BUNDLE.md` (snapshot backup)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D5.1 | 6 stati globali (loading, empty, partial, ready, error, offline) | Copertura completa di ogni scenario |
| D5.2 | Stato machine di Import con 6 stati | Tracciamento preciso del flusso |
| D5.3 | Keyboard navigation per ogni schermata | AccessibilitÃ  e power user |
| D5.4 | Alternative testuali per ogni visualizzazione | Screen reader compliance |
| D5.5 | Namespace i18n per modulo | ManutenibilitÃ  |
| D5.6 | MVP bilingue IT+EN | Target europeo |
| D5.7 | Pluralizzazione ICU | Supporto corretto per tutte le lingue future |
| D5.8 | Demo mode con fixture sintetico | Onboarding senza dati personali |

### Stato progetto dopo Sessione 5
**Progetto completo al 95%.** Rimangono solo Sessioni 6-8 (privacy, UI spec dettagliata, devops) da fare in nuove chat.

### Documenti approvati in questa sessione
- âœ… Tutti i documenti Sessione 1, 2, 3, 4 confermati APPROVED
- ðŸŸ¡ Documenti Sessione 5 (UX flows + i18n) in attesa di approvazione

### Prossimi passi
- Boss approva Sessione 5
- Generazione file BUNDLE.md con contenuti effettivi
- Commit finale e chiusura chat
- Sessione 6-8 in nuove chat quando Boss vorrÃ 

---

## Template sessione (da copiare per le sessioni future)

    ## Sessione N â€” ðŸŽ¯ [Nome]

    **Data**: [data]
    **Stato**: ðŸŸ¡ In corso / âœ… Completata

    ### Obiettivi
    - [ ] obiettivo 1

    ### Documenti prodotti
    - âœ… `percorso/file.md` (APPROVED/DRAFT)

    ### Decisioni prese
    | # | Decisione | Motivazione |
    |---|-----------|-------------|
    | D.N.1 | ... | ... |

    ### Prossimi passi
    - ...

---

*Aggiornato ad ogni nuova sessione.*

===== FILE: docs/00-VISION.md =====

# 00 â€” Visione e Missione

> Status: ðŸŸ¡ DRAFT
> Versione: 0.1
> Ultima modifica: Sessione 0
> Responsabile: Boss

---

## ðŸŽ¯ Il Problema

Le piattaforme di streaming musicale raccolgono **una quantitÃ  enorme di dati intimi** su ogni utente: cosa ascolta, quando, dove, da quale dispositivo, per quanto tempo, se salta i brani, se usa lo shuffle. Eppure, tutto quello che restituiscono Ã¨ un **"Wrapped" annuale** con 5 artisti e 5 brani.

Ãˆ come avere un diario segreto di 10 anni e usarlo solo per contare quante volte hai scritto la parola "ciao".

I dati esistono giÃ . Quello che manca Ã¨ un **lettore** che li trasformi in una storia.

## ðŸ’¡ La Soluzione

**Life Soundtrack** Ã¨ un'applicazione web (PWA) che trasforma i metadati grezzi delle piattaforme di streaming in un **diario di vita musicale**: una timeline personale, emotiva e contestuale che racconta la storia dell'utente attraverso la musica.

Non Ã¨ un'app di statistica. Ãˆ un'app di **narrazione autobiografica** basata sui dati di ascolto.

## ðŸ§­ Principi Fondamentali

| Principio | Significato | Implicazione tecnica |
|-----------|-------------|---------------------|
| **Privacy-first** | I dati restano sul dispositivo dell'utente | Elaborazione in-browser, IndexedDB, nessun server centrale obbligatorio |
| **Local-first** | L'app funziona offline dopo il primo caricamento | PWA con service worker, dati locali |
| **Open data** | L'utente Ã¨ proprietario dei propri dati | Export JSON in qualsiasi momento, portabilitÃ  GDPR |
| **EstensibilitÃ ** | Aggiungere una piattaforma non richiede modifiche al core | Adapter pattern, formato dati unificato |
| **Nessun lock-in** | Nessun abbonamento forzato, nessun dato ostaggio | Nessuna autenticazione obbligatoria, sync cloud opzionale e cifrato |
| **Narrazione prima dei numeri** | I dati raccontano storie, non statistiche | Insight in linguaggio naturale, non solo grafici |

## ðŸŽ¬ Tagline

> *"La colonna sonora della tua vita, finalmente leggibile."*

## ðŸ‘¥ Target Utenti

| Segmento | EtÃ  | Bisogno | Messaggio |
|----------|-----|---------|-----------|
| **Nostalgici** | 25-45 | Rivivere periodi della vita | "Che musica ascoltavi quando ti sei laureato?" |
| **Quantified Self** | 25-50 | Pattern e statistiche profonde | "Guarda l'evoluzione del tuo umore attraverso la musica" |
| **Audiofili** | 30-55 | Unificare sorgenti diverse | "Spotify + Qobuz + Plex, un'unica storia" |
| **Curiosi** | 20-40 | Andare oltre il Wrapped | "5 canzoni non bastano a raccontare il tuo anno" |
| **Privacy-conscious** | 25-50 | Controllo totale dei dati | "I tuoi dati, solo tuoi" |

## ðŸŒ Perimetro Iniziale (MVP)

- **Piattaforme supportate (Europa)**: Spotify, YouTube Music, Apple Music, Deezer, Tidal, SoundCloud, Last.fm, ListenBrainz
- **Piattaforma di distribuzione**: PWA (web app installabile)
- **ModalitÃ  operativa**: Local-first, elaborazione in-browser
- **Lingue MVP**: Italiano, Inglese
- **Modello di business**: Da definire (placeholder: gratuito + opzioni premium)

## ðŸš« Cosa NON Ã¨ Life Soundtrack

- Non Ã¨ un clone di Spotify Wrapped
- Non Ã¨ una piattaforma di streaming
- Non Ã¨ un social network musicale
- Non Ã¨ un'app di raccomandazione
- Non Ã¨ uno strumento per artisti/label (fuori scope per ora)

## ðŸŽ Cosa offre di unico

1. **Timeline narrativa**: non solo "hai ascoltato X", ma "in quel periodo della tua vita..."
2. **Unificazione multi-sorgente**: la storia completa attraverso tutte le piattaforme usate
3. **Rilevamento ere musicali ed eventi**: pattern e anomalie che raccontano capitoli della vita
4. **Ricordi tipo "Facebook Memories"**: ma basati sulla musica, non sulle foto
5. **Privacy come valore**: i dati non escono mai dal dispositivo

## ðŸ“ˆ Metriche di Successo

- **Attivazione**: % di utenti che completano l'import
- **Retention settimanale**: % che apre l'app almeno 1 volta a settimana
- **Engagement con ricordi**: % di ricordi visti / condivisi
- **NPS**: soddisfazione percepita

## ðŸ§­ Decisioni Strategiche Aperte

| Decisione | Stato | Note |
|-----------|-------|------|
| Modello di business (free / freemium / donation) | ðŸ”´ Aperto | Da decidere in Sessione 6 |
| Open source o proprietario | ðŸ”´ Aperto | Tendenza verso open source |
| Licenza (se open source) | ðŸ”´ Aperto | AGPL vs MIT vs Apache |
| Self-hosting supportato ufficialmente | ðŸ”´ Aperto | Probabilmente sÃ¬, tramite Docker |
| Sync cloud opzionale | ðŸ”´ Aperto | Probabilmente sÃ¬ in Fase 2 |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Bozza iniziale, consolidata dal lavoro esplorativo |

---

*Questo documento Ã¨ DRAFT. Diventa vincolante per gli agenti solo dopo approvazione di Boss (status: ðŸŸ¢ APPROVED).*

===== FILE: docs/01-PLATFORMS.md =====

# 01 â€” Matrice Piattaforme e Dati Ottenibili

> Status: ðŸŸ¡ DRAFT
> Versione: 0.1
> Ultima modifica: Sessione 0 (consolidamento)
> Scope: MVP europeo

---

## 1. Scopo

Definire, per ogni piattaforma di streaming nel perimetro MVP, **quali dati sono ottenibili, con quale metodo, in quale formato e con quali limiti**. Questo documento Ã¨ la base delle specifiche adapter (`03-ADAPTERS/`).

## 2. I tre canali di accesso ai dati

| Canale | Descrizione | Pro | Contro |
|--------|-------------|-----|--------|
| **Export GDPR** | Download dei dati personali obbligatorio per legge (UE) | Storico completo, campi contestuali ricchi | Manuale, non automatizzabile, tempi variabili |
| **API pubblica** | Endpoint ufficiali per sviluppatori | Real-time, automatizzabile | Limiti severi, deprecazioni, nessun storico completo |
| **Scrobbling** | Registrazione continua degli ascolti su hub esterni (Last.fm, ListenBrainz, Maloja) | Continuo, multi-piattaforma, storico illimitato | Copre solo dal momento dell'attivazione |

**Strategia MVP**: export GDPR per lo *storico*, scrobbling per il *continuo*, API solo dove aggiungono valore reale.

## 3. Schede piattaforma

### 3.1 Spotify ðŸ‡¸ â€” Tier S (prioritÃ  massima)

- **Accesso storico**: GDPR "Extended Streaming History" (JSON, ~15k eventi/anno)
- **Accesso real-time**: Web API (limitata: recently played max 50; top items 3 finestre)
- **Scrobbling**: sÃ¬ (Last.fm, ListenBrainz, multi-scrobbler)

**Campi per evento di ascolto (export GDPR)**:

| Campo | Tipo | Note |
|-------|------|------|
| `ts` | ISO 8601 UTC | Timestamp fine ascolto |
| `platform` | string | Dispositivo/OS (dettagliato pre ott-2023, generico dopo) |
| `ms_played` | int | Millisecondi ascoltati |
| `conn_country` | ISO 3166-1 | Paese di connessione |
| `ip_addr` | string | Indirizzo IP |
| `master_metadata_track_name` | string | Nome brano |
| `master_metadata_album_artist_name` | string | Artista |
| `master_metadata_album_album_name` | string | Album |
| `spotify_track_uri` | string | `spotify:track:<id>` |
| `episode_name` / `episode_show_name` | string/null | Podcast |
| `reason_start` | enum | `playbtn`, `clickrow`, `trackdone`, `appload`, `fwdbtn`, `backbtn`, `remote`, `uriopen`, `unknown`... |
| `reason_end` | enum | `endplay`, `fwdbtn`, `backbtn`, `trackdone`, `logout`, `unexpected-exit`... |
| `shuffle` | bool | |
| `skipped` | bool | âš ï¸ inaffidabile in alcuni periodi (vedi Â§5) |
| `offline` | bool | |
| `offline_timestamp` | int/null | âš ï¸ unitÃ  cambiate nel tempo (vedi Â§5) |
| `incognito_mode` | bool | |

**File aggiuntivi nell'export**: `SearchQueries.json` (ricerche con timestamp), `Playlist*.json` (playlist con date di aggiunta), `YourLibrary.json` (brani salvati), `Follow.json`, `Wrapped*.json`, `Userdata.json`. Nei technical log: `CarDetectionEvent.json` (rilevamento auto), `AdRequestEvent.json` (ads, account free).

**Limiti API (2026)**: audio-features deprecate (nov 2024); Dev Mode richiede Premium e max 5 utenti (feb 2026). â†’ Le audio features vanno ricavate da fonti esterne (vedi `05-ARCHITECTURE.md` Â§6).

### 3.2 YouTube Music ðŸ‡ºðŸ‡¸ (dominante in EU) â€” Tier S

- **Accesso storico**: Google Takeout ("YouTube and YouTube Music") â†’ JSON/HTML
- **Campi**: `time`, `title`, `titleUrl`, `products`, `details.name` (canale/artista), `details.url`, `locationInfo` (opzionale)
- **Limiti**: cronologia unificata video+musica (serve filtro); nessun campo skip/shuffle/dispositivo
- **Scrobbling**: sÃ¬ (scrobbler dedicati)

### 3.3 Apple Music ðŸ‡ºðŸ‡¸ (molto diffusa in EU) â€” Tier A

- **Accesso storico**: Apple Privacy Portal â†’ "Apple Media Services" (CSV/JSON)
- **Campi**: Song Name, Artist Name, Album Name, Play Date UTC, Media Type, Playlist Name
- **Limiti**: nessun campo contestuale (skip/shuffle/device); API MusicKit senza audio features
- **Scrobbling**: sÃ¬ (scrobbler di terze parti)

### 3.4 Deezer ðŸ‡«ðŸ‡· â€” Tier A

- **Accesso storico**: export GDPR (âš ï¸ storicamente lento e a volte incompleto)
- **API pubblica**: buona per catalogo, preferiti, playlist; cronologia utente limitata
- **Scrobbling**: sÃ¬
- **Limiti**: meno metadati contestuali di Spotify

### 3.5 Tidal ðŸ‡³ðŸ‡´/ðŸ‡¸ â€” Tier A

- **API pubblica aperta**: `openapi.tidal.com` v2, OAuth 2.0 + PKCE, JSON:API
- **Campi catalogo**: title, artist, album, duration, **ISRC**, `audioQuality` (LOW/HIGH/LOSSLESS/HI_RES), `audioModes` (STEREO/DOLBY_ATMOS)
- **Limiti**: nessuna cronologia di ascolto storica via API â†’ utile per metadati e libreria, non per lo storico

### 3.6 SoundCloud ðŸ‡©ðŸ‡ª â€” Tier B

- **Export GDPR**: cronologia limitata a ~1000 brani; like, playlist, follow
- **API pubblica**: preferiti, playlist, follow
- **Valore**: musica indie/elettronica/DJ set assente altrove

### 3.7 Last.fm ðŸ‡¬ðŸ‡§ â€” Tier S (come hub, non sorgente)

- **API pubblica gratuita**: `user.getRecentTracks` paginabile sull'intero storico, top artists/tracks/albums per periodo, weekly charts
- **Campi**: name, artist, album, `date`, `loved`
- **Limiti**: nessun contesto (device/luogo); solo dati scrobblati; rate limit ~5 req/s

### 3.8 ListenBrainz ðŸŒ (no-profit) â€” Tier S (come hub)

- **API pubblica senza limiti restrittivi**: `/1/user/{username}/listens` paginabile
- **Campi**: `listened_at`, `track_metadata.track_name/artist_name/release_name`, `additional_info`: **`recording_mbid`, `artist_mbids`, `release_mbid`, `isrc`, `spotify_id`, `youtube_id`, `origin_url`**
- **Valore unico**: identificativi MusicBrainz/ISRC nativi â†’ normalizzazione perfetta tra piattaforme

### 3.9 Self-hosted (Plex, Navidrome, Subsonic, Roon) â€” Tier S+ per nicchia

- Nessuna piattaforma commerciale: librerie personali (CD digitalizzati, acquisti, file rari)
- Integrazione via scrobbling (Maloja, multi-scrobbler, webhook Plexâ†’ListenBrainz)
- **Valore unico**: copre la parte piÃ¹ intima della storia musicale, invisibile alle piattaforme

### 3.10 Fuori perimetro MVP (estensioni future)

Qobuz (export solo playlist), Bandcamp (solo acquisti), IDAGIO (classica), Boomplay (Africa), JioSaavn/Gaana (India), Anghami (MENA), NetEase/Tencent (Cina), MelOn (Corea), LINE Music/AWA (Giappone), iHeartRadio/SiriusXM (radio USA). Vedi `SESSIONS.md` per la strategia di estensione.

## 4. Confronto per categoria di dato

| Categoria | Spotify | YT Music | Apple | Deezer | Tidal | SoundCloud | Last.fm | ListenBrainz |
|---|---|---|---|---|---|---|---|---|
| Timestamp ascolto | âœ… | âœ… | âœ… | âœ… | âŒ | ï¸ | âœ… | âœ… |
| Durata ascoltata | âœ… | âŒ | âŒ | âœ… | âŒ | âŒ | âŒ | âŒ |
| Dispositivo | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ |
| IP / Paese | âœ… | âš ï¸ | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ |
| Skip / Shuffle / Offline | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ |
| Ricerche | âœ… | âš ï¸ | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ |
| Playlist con date | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ | âŒ |
| Brani salvati | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âš ï¸ |
| ISRC / MBID | âŒ | âŒ | âŒ | âŒ | âœ… | âŒ | âŒ | âœ… |
| Storico completo | âœ… | âœ… | âœ… | âš ï¸ | âŒ | ï¸ | âœ… | âœ… |

Legenda: âœ… completo Â· âš ï¸ parziale Â· âŒ assente

## 5. Catalogo edge case noti (vincoli per gli adapter)

| # | Piattaforma | Edge case | Impatto | Azione adapter |
|---|-------------|-----------|---------|----------------|
| E1 | Spotify | `skipped` non affidabile: nessun skip registrato 2015-04â†’2022-10; valori misti prima/dopo | Statistiche skip errate | Regola derivata: `skipped OR reason_end IN (backbtn, unknown, endplay, fwdbtn)` â€” **da validare in Sessione 2** |
| E2 | Spotify | Timestamp sovrapposti (~2.6% della durata totale); stream duplicati identici con `ts` diverso | Durata totale sovrastimata | Deduplicazione per (uri, tsÂ±1s, ms_played) |
| E3 | Spotify | `offline_timestamp`: unitÃ  passate da secondi a millisecondi | Parsing errato | Normalizzazione unitÃ  per epoca |
| E4 | Spotify | Stessa registrazione con URI/ISRC diversi (singolo + album + compilation) | Conteggi frammentati | Dedup via ISRC/MBID + fuzzy title (vedi `02-DATA-SCHEMA.md`) |
| E5 | Spotify | GranularitÃ  `platform` cambiata ott-2023 (da modello dettagliato a `android`/`windows`/...) | Classificazione device discontinua | Mapping a `device_type` normalizzato |
| E6 | YouTube | Cronologia unifica video e musica | Falsi positivi musicali | Filtro su `products` + euristiche titolo/URL |
| E7 | Deezer | Export GDPR storicamente lento (casi documentati di mesi) e incompleto | Storico mancante | Fallback: API + scrobbling; avviso utente |
| E8 | SoundCloud | Export limitato a ~1000 brani; brani rimossi nel tempo | Storico troncato | Dichiarare limite all'utente; integrare con scrobbling |
| E9 | Apple | Nessun campo contestuale | Analisi comportamentale limitata | Adattare insight disponibili |
| E10 | Tutte | Fusi orari: `ts` Spotify Ã¨ UTC; Apple "Play Date UTC"; Takeout locale+UTC | Timeline sfalsata | Normalizzare tutto a UTC in fase di parse |

## 6. Strategia di integrazione MVP

1. **Storico**: adapter di import file per Spotify, YouTube Music, Apple Music (+ Deezer quando disponibile)
2. **Continuo**: connessione opzionale a Last.fm / ListenBrainz; supporto Maloja self-hosted
3. **Normalizzazione**: unificazione tramite ISRC/MBID (ListenBrainz e Tidal come fonti di veritÃ  per gli identificatori)
4. **Arricchimento**: audio features da fonti esterne (vedi `05-ARCHITECTURE.md` Â§6)

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Consolidamento dalle sessioni esplorative |

===== FILE: docs/02-DATA-SCHEMA.md =====

# 02 â€” Schema Dati Unificato (eseguibile)

> Status: ðŸŸ¡ DRAFT
> Versione: 0.1
> Ultima modifica: Sessione 1
> Vincolante per: adapter (03), analisi (04), db (core/db), test (10)

---

## 1. Principi dello schema

1. **Un evento di ascolto Ã¨ l'atomo**: tutto deriva da `ListenEvent`
2. **Normalizza presto**: i dati grezzi delle piattaforme vivono solo nel file dell'utente; nel DB entra solo il formato unificato (vedi ADR-0003)
3. **Idempotenza**: re-importare lo stesso file non duplica nulla (`eventKey` unico)
4. **Derivati versionati**: sessioni e insight sono ricalcolabili; portano il `derivedVersion` del set di parametri che li ha generati
5. **UTC ovunque**: ogni timestamp Ã¨ unix millisecondi UTC

## 2. Semantica dei timestamp per piattaforma

| Piattaforma | Campo origine | Semantica | Derivazione in adapter |
|-------------|---------------|-----------|------------------------|
| Spotify | `ts` | fine ascolto | `startedAt = ts - ms_played` |
| YouTube Takeout | `time` | inizio azione | `timestamp = time + durata stimata` (durata da catalogo) |
| Apple | `Play Date UTC` | inizio ascolto | `timestamp = playDate + durationMs` |
| Last.fm | `date` | inizio scrobble | `timestamp = date + durationMs` |
| ListenBrainz | `listened_at` | inizio listen | `timestamp = listened_at*1000 + durationMs` |

Regola: `timestamp` = **momento in cui l'ascolto si conclude**; `startedAt` = inizio. Le analisi temporali usano `startedAt` quando disponibile, altrimenti `timestamp`.

## 3. Interfacce TypeScript (source of truth)

### 3.1 Tipi base

    export type PlatformId =
      | 'spotify' | 'youtube_music' | 'apple_music' | 'deezer'
      | 'tidal' | 'soundcloud' | 'lastfm' | 'listenbrainz'
      | 'plex' | 'navidrome' | 'manual';

    export type DeviceType =
      | 'mobile' | 'desktop' | 'web' | 'speaker'
      | 'car' | 'wearable' | 'tv' | 'unknown';

    export type MoodId =
      | 'sad' | 'angry' | 'neutral' | 'calm' | 'happy' | 'excited';

### 3.2 ListenEvent

    export interface ListenEvent {
      id: string;              // UUID interno
      eventKey: string;        // chiave di idempotenza (UNIQUE)
      platform: PlatformId;
      importId: string;        // FK imports
      timestamp: number;       // unix ms UTC, fine ascolto
      startedAt: number | null;
      durationMs: number;      // ms effettivamente ascoltati
      trackId: string;         // FK tracks
      completed: boolean;      // ascoltato fino alla fine
      skipped: boolean;
      shuffle: boolean | null;
      offline: boolean | null;
      incognito: boolean | null;
      reasonStart: string | null;
      reasonEnd: string | null;
      deviceType: DeviceType;
      deviceDetail: string | null;
      ip: string | null;         // conservato SOLO se PrivacySettings.retainIp
      country: string | null;    // ISO 3166-1 alpha-2, sempre derivato      
      day: string;             // 'YYYY-MM-DD' (derivato, indicizzato)
    }

**eventKey** = `platform + ':' + (sourceEventId ?? sha1(trackId|timestamp|durationMs))`
Calcolato dall'adapter. Garantisce import idempotenti.

### 3.3 Track / Artist / Album

    export interface Track {
      id: string;
      canonicalKey: string;    // UNIQUE â€” regola DEDUP (Â§5)
      name: string;
      artistId: string;
      albumId: string | null;
      durationMs: number | null;
      isrc: string | null;
      mbid: string | null;     // MusicBrainz Recording ID
      explicit: boolean | null;
      platformIds: Partial<Record<PlatformId, string>>;
      firstSeenAt: number;
      lastSeenAt: number;
      listenCount: number;     // contatore denormalizzato
    }

    export interface Artist {
      id: string;
      name: string;
      mbid: string | null;
      platformIds: Partial<Record<PlatformId, string>>;
      listenCount: number;
    }

    export interface Album {
      id: string;
      name: string;
      artistId: string;
      mbid: string | null;
      upc: string | null;
      releaseDate: string | null;   // 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'
      platformIds: Partial<Record<PlatformId, string>>;
    }

### 3.4 AudioFeatures

    export interface AudioFeatures {
      trackId: string;         // PK
      valence: number | null;          // 0..1 positivitÃ  emotiva
      energy: number | null;           // 0..1 intensitÃ 
      danceability: number | null;
      acousticness: number | null;
      instrumentalness: number | null;
      speechiness: number | null;
      liveness: number | null;
      tempo: number | null;            // BPM
      key: number | null;              // 0-11
      mode: 0 | 1 | null;              // 0=minore 1=maggiore
      loudness: number | null;         // dB
      timeSignature: number | null;
      source: 'acousticbrainz' | 'api_freqblog' | 'api_musicae' | 'essentia' | 'manual';
      fetchedAt: number;
      schemaVersion: number;
    }

### 3.5 ListeningSession (derivato)

    export interface ListeningSession {
      id: string;
      startTime: number;
      endTime: number;
      durationMs: number;
      eventCount: number;
      trackCount: number;
      platform: PlatformId;
      deviceType: DeviceType;
      gapThresholdMs: number;      // parametro usato (default 1_800_000)
      derivedVersion: string;
    }

### 3.6 Insight (derivato, con verdetto utente)

    export type InsightType =
      | 'mood_day' | 'mood_week' | 'mood_month'
      | 'era' | 'event' | 'memory' | 'pattern';

    export interface Insight {
      id: string;
      type: InsightType;
      periodStart: number;
      periodEnd: number;
      payload: InsightPayload;       // unione discriminata (Â§4)
      confidence: number;            // 0..1
      derivedVersion: string;
      status: 'pending' | 'confirmed' | 'corrected' | 'dismissed';
      userNote: string | null;
      createdAt: number;
    }

### 3.7 Import, Library, Playlist

    export interface ImportRecord {
      id: string;
      platform: PlatformId;
      fileName: string;
      fileHash: string;              // sha256 del file
      startedAt: number;
      completedAt: number | null;
      status: 'running' | 'done' | 'partial' | 'failed';
      eventsParsed: number;
      eventsInserted: number;
      eventsDuplicated: number;
      warnings: string[];            // codici edge case (E1..E10)
    }

    export interface LibraryItem {
      id: string;
      platform: PlatformId;
      kind: 'saved_track' | 'saved_album' | 'followed_artist';
      trackId: string | null;
      albumId: string | null;
      artistId: string | null;
      addedAt: number | null;
    }

    export interface Playlist {
      id: string;
      platform: PlatformId;
      name: string;
      createdAt: number | null;
      lastModifiedAt: number | null;
    }

    export interface PlaylistItem {
      playlistId: string;
      trackId: string;
      position: number | null;
      addedAt: number | null;
    }

### 3.8 PrivacySettings (toggle espliciti, default off)

    export interface PrivacySettings {
      retainIp: boolean;          // default false; toggle ESPLICITO dell'utente
      enrichMetadata: boolean;    // default false; arricchimento metadati brani
      scrobbleHubs: PlatformId[]; // default []; hub di scrobbling scelti
      syncCloud: boolean;         // default false; sync E2E opzionale (Fase 2)
    }

Quando `retainIp` Ã¨ true:
- `ListenEvent.ip` Ã¨ conservato (string, IPv4/IPv6)
- L'IP resta SOLO nel DB locale, mai inviato in rete
- L'utente puÃ² purgarlo in qualsiasi momento (`purgeIp()` azzera tutti gli ip)
- Il `country` Ã¨ sempre derivato dall'IP al parse e conservato (indipendentemente dal toggle)

Quando `retainIp` Ã¨ false (default):
- `ListenEvent.ip` Ã¨ null dopo il parse
- Il `country` Ã¨ derivato e conservato (privacy-by-design)

## 4. Payload degli Insight (unione discriminata)

    export type InsightPayload =
      | EraPayload | MoodPeriodPayload | EventPayload | MemoryPayload | PatternPayload;

    export interface EraPayload {
      kind: 'era';
      label: string;                    // es. "Era Malinconia"
      moodDominant: MoodId;
      topArtistIds: string[];
      topTrackIds: string[];
      genreDistribution: Record<string, number>;
      avgValence: number;
      avgEnergy: number;
      nightShare: number;               // quota ascolti 00-06
      repeatRate: number;               // quota brani giÃ  noti
    }

    export interface MoodPeriodPayload {
      kind: 'mood';
      mood: MoodId;
      avgValence: number;
      avgEnergy: number;
      eventCount: number;
    }

    export interface EventPayload {
      kind: 'event';
      eventType: 'spike_artist' | 'spike_genre' | 'valence_drop' | 'valence_rise'
               | 'volume_spike' | 'volume_drop' | 'exploration' | 'silence';
      description: string;              // frase in linguaggio naturale
      metrics: Record<string, number>;
    }

    export interface MemoryPayload {
      kind: 'memory';
      memoryKind: 'on_this_day' | 'first_time' | 'milestone' | 'return' | 'seasonal';
      trackId: string | null;
      artistId: string | null;
      yearsAgo: number | null;
      text: string;
    }

    export interface PatternPayload {
      kind: 'pattern';
      patternType: 'circadian' | 'weekly' | 'seasonal';
      buckets: Record<string, number>;  // es. ora->quota, giorno->quota, mese->quota
    }

## 5. Regole di deduplicazione tracce (DEDUP)

PrioritÃ  per `canonicalKey`, valutata al momento dell'upsert:

| # | Regola | canonicalKey |
|---|--------|--------------|
| DEDUP-1 | ISRC presente | `isrc:<ISRC upper>` |
| DEDUP-2 | MBID presente (no ISRC) | `mbid:<mbid>` |
| DEDUP-3 | altrimenti | `fuzzy:<sha1(normalize(name) + '\|' + normalize(artistPrincipal) + '\|' + durationBucketMs)>` |

`durationBucketMs = Math.floor(durationMs / 2000) * 2000` (bucket da 2 secondi)

`normalize(s)`: lowercase â†’ rimuovi feat./ft./with â†’ rimuovi contenuti tra parentesi tonde/quadre â†’ rimuovi punteggiatura â†’ collassa spazi â†’ trim.

### Tradeoff di DEDUP-3 con durata (documentato)

- **Pro**: includere la durata riduce drasticamente le fusioni false di brani omonimi ma diversi (radio edit vs album version vs live)
- **Contro**: puÃ² separare la stessa registrazione quando la durata differisce tra piattaforme (remaster, rounding Â±1-2s)
- **Mitigazione**: DEDUP-1/2 (ISRC/MBID) catturano comunque quelle; il bucket da 2s assorbe il rounding
- **Rischio accettato**: registrazioni omonime con durata identica restano fuse (documentato; mitigabile in futuro con fuzzy a 3 campi: nome+artista+durata+album)

Comportamento upsert:
- Se esiste track con stesso canonicalKey â†’ aggiungi platformId, aggiorna lastSeenAt e contatori
- Altrimenti crea nuova track
- Conflitti nome: il nome visualizzato Ã¨ quello della prima piattaforma importata per ordine di prioritÃ  (spotify > apple > tidal > listenbrainz > altro), salvo override utente futuro

## 6. Schema Dexie (IndexedDB) â€” versione 1

    db.version(1).stores({
      listens:       '&eventKey, timestamp, startedAt, trackId, platform, day, importId',
      tracks:        '&canonicalKey, name, artistId, albumId, isrc, mbid',
      artists:       '&id, name, mbid',
      albums:        '&id, name, artistId',
      features:      '&trackId, source',
      sessions:      '&id, startTime, platform, derivedVersion',
      insights:      '&id, type, periodStart, derivedVersion, status',
      imports:       '&id, platform, fileHash, startedAt',
      library:       '&id, trackId, artistId, albumId, platform',
      playlists:     '&id, platform',
      playlistItems: '&[playlistId+trackId], playlistId, addedAt',
    });

PrimKey: dove non indicato con `&`, Dexie usa la prima chiave; le tabelle con `&x` usano x come chiave primaria unica. `id` espliciti sono UUID generati dal core.

## 7. Politiche di migrazione e ricalcolo

- **MIG-1**: ogni cambio schema = `db.version(n+1).stores({...}).upgrade(tx => ...)`; mai drop di tabelle utente
- **MIG-2**: tabelle derivate (`sessions`, `insights`) sono **ricostruibili**: comando `recompute()` le rigenera da `listens` + `features`
- **MIG-3**: ogni modifica ai parametri di analisi cambia `derivedVersion` (hash del config); insight con version vecchia sono marcati `stale` e ricalcolati al prossimo avvio
- **MIG-4**: i contatori denormalizzati (`listenCount`) sono ricalcolabili con `recount()`; servono solo per performance UI

## 8. Cosa NON Ã¨ nello schema (decisioni esplicite)

- **Raw payload piattaforma**: non persistito (ADR-0003). Il file dell'utente Ã¨ la fonte di veritÃ ; l'import Ã¨ ri-eseguibile
- **IP address**: non persistito DI DEFAULT. Conservato SOLO con toggle esplicito `PrivacySettings.retainIp`; mai inviato in rete; purgabile con `purgeIp()`. Il `country` Ã¨ sempre derivato e conservato
- **Coordinate GPS**: mai raccolte
- **Testi/lyrics**: fuori scope

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 1 | Prima versione eseguibile |

===== FILE: docs/03-ADAPTERS/SPEC-TEMPLATE.md =====

# 03-ADAPTERS/SPEC-TEMPLATE â€” Template Specifica Adapter

> Status: ðŸŸ¡ DRAFT Â· Versione 0.1 Â· Sessione 2
> Scopo: formato riutilizzabile per ogni adapter. Copia questo template in `03-ADAPTERS/<platform>.md` e compilalo.

---

# Adapter <PLATFORM_NAME>

> Status:
[Stato iniziale] â†’ [Rilevamento formato] â†’ [Parsing streaming] â†’ [Normalizzazione] â†’ [Upsert DB]


Descrivi:
- Come l'utente procura il file (URL, passaggi)
- Come l'adapter lo riconosce (`detect(input)` â€” firma magica, header, nome file)
- Come gestisce file multipli (Spotify: ZIP con JSON partizionati)

## 3. Mapping campi sorgente â†’ unificato

### 3.1 ListenEvent

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `timestamp` | | | | vedi Â§2 (semantica temporale) |
| `startedAt` | | | | derivato se mancante |
| `durationMs` | | | | |
| `eventKey` | | | | regola di calcolo |
| `platform` | (fisso) | | | |
| `track.name` | | | | |
| `track.artist` | | | | |
| `track.album` | | | | nullable |
| `track.isrc` | | | | nullable |
| `track.mbid` | | | | nullable; lookup se possibile |
| `deviceType` | | | | mapping a enum |
| `deviceDetail` | | | | stringa raw |
| `country` | | | | ISO 3166-1 |
| `ip` | | | | SOLO se `retainIp` true |
| `shuffle` | | | | nullable |
| `skipped` | | | | bool; regola derivata se inaffidabile |
| `offline` | | | | nullable |
| `incognito` | | | | nullable |
| `reasonStart` | | | | raw string |
| `reasonEnd` | | | | raw string |
| `completed` | | | | bool (derivata da duration/total) |

### 3.2 Library / Playlist / Artist / Album

| EntitÃ  | Campo | Sorgente | Note |
|--------|-------|----------|------|
| Artist | ... | ... | |
| Album | ... | ... | |
| Playlist | ... | ... | |

## 4. Edge case noti (catalogo E)

Copia il catalogo da `01-PLATFORMS.md` Â§5 filtrando per questa piattaforma, poi aggiungi eventuali nuovi:

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E.N.1 | | | |

## 5. Semantica temporale

Specifica chiaramente: il timestamp sorgente rappresenta **l'inizio** o la **fine** dell'ascolto? Come si derivano `timestamp` (fine) e `startedAt` (inizio)?

## 6. Regole di dedup tracce

Riferimento a `02-DATA-SCHEMA.md` Â§5 (DEDUP-1..3). Se la piattaforma fornisce ISRC/MBID, specificarlo. Altrimenti conferma DEDUP-3.

## 7. Comportamento privacy

| Dato sensibile | Default | Se `retainIp` true |
|----------------|---------|---------------------|
| IP address | scartato dopo `country` | conservato |
| Coordinate GPS | mai raccolte | mai raccolte |
| ... | | |

## 8. Test â€” fixture atteso

Riferimento a `fixtures/synthetic-history/<platform>-sample.json`. Il fixture deve contenere almeno un esempio di ogni edge case E.N.x.

Casi di test minimi:
1. Import pulito (happy path)
2. Idempotenza (re-import stesso file â†’ 0 duplicati)
3. Ogni edge case E.N.x â†’ risultato atteso documentato
4. DEDUP: due record con stesso ISRC â†’ una sola track
5. DEDUP: due record omonimi senza ISRC, durata diversa â†’ due track separate

## 9. Segnalazione all'utente

Elenco messaggi UI che l'adapter puÃ² emettere:
- Warning: "X eventi con timestamp invalidi scartati"
- Error: "Formato file non riconosciuto"
- Info: "Import completato: X eventi, Y brani unici"

Codici di warning/errori definiti in `08-COPY-I18N.md`.

## 10. Note di implementazione

Dettagli specifici per questa piattaforma che non rientrano nelle sezioni precedenti. Esempio: limiti di rate API, chunking consigliato, formati di compressione.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 2 | Template iniziale |

===== FILE: docs/03-ADAPTERS/spotify.md =====

# Adapter Spotify

> Status: ðŸŸ¡ DRAFT Â· Versione 0.1 Â· Sessione 2
> Piattaforma: Spotify
> Sede legale: Svezia
> Tier: **S** Â· PrioritÃ  MVP: **sÃ¬**

## 1. Metodi di accesso

| Canale | Disponibile | Formato output | Frequenza | Note |
|--------|:-----------:|----------------|-----------|------|
| Export GDPR | âœ… | JSON in ZIP | Manuale | "Extended streaming history" |
| API pubblica | âš ï¸ | REST | Real-time | Deprecate audio-features (2024-11); Dev Mode limitato |
| Scrobbling LB/L.fm | âœ… | â€” | Continuo | via client terzi |

**Canale principale MVP**: Export GDPR. L'API pubblica Ã¨ usata solo per recupero catalog metadata (non per cronologia).

## 2. Flusso di import

### 2.1 Come l'utente procura il file

1. Account Spotify â†’ Privacy â†’ "Download your data"
2. Seleziona **"Extended streaming history"** (non la cronologia breve!)
3. Attesa: da 4 ore a 30 giorni (email con link)
4. Download: archivio ZIP contenente:
   - `Streaming_History_Audio_<periodo>_<n>.json` (uno o piÃ¹)
   - `Streaming_History_Video_<periodo>.json` (se presente)
   - `Streaming_History_Podcast_<periodo>_<n>.json`
   - `Streaming_History_Audiobook_<periodo>_<n>.json`
   - `SearchQueries.json`
   - `Playlist*.json`
   - `YourLibrary.json`
   - `Follow.json`
   - `Wrapped*.json`, `Userdata.json`
   - Technical log: `CarDetectionEvent.json`, `AdRequestEvent.json`

### 2.2 Rilevamento formato (`detect`)

L'adapter riconosce il file da:
- **ZIP**: contiene almeno un file `Streaming_History_Audio_*.json`
- **JSON singolo**: array di oggetti con campo `spotify_track_uri`
- **Rifiuta** file senza `ts` e `ms_played`

### 2.3 Parsing

- Iterazione streaming sui JSON (AsyncIterable)
- Chunk da ~1000 eventi per batch di upsert
- Gestione file multipli audio/video/podcast/audiobook in parallelo
- File `SearchQueries.json`, `Playlist*.json`, `YourLibrary.json`, `Follow.json` processati separatamente per popolare library/playlists

## 3. Mapping campi sorgente â†’ unificato

### 3.1 ListenEvent

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `timestamp` | `ts` | ISO 8601 UTC | `Date.parse(ts)` | **FINE ascolto** |
| `startedAt` | â€” | â€” | `timestamp - ms_played` | derivato |
| `durationMs` | `ms_played` | int | diretto | |
| `eventKey` | â€” | â€” | `'spotify:' + (spotify_track_uri ?? sha1(name+artist+ts))` | se URI mancante (podcast?), hash |
| `platform` | (fisso) | â€” | `'spotify'` | |
| `track.name` | `master_metadata_track_name` | string/null | diretto; null â†’ skip evento | |
| `track.artist` | `master_metadata_album_artist_name` | string/null | diretto; null â†’ "Unknown" | |
| `track.album` | `master_metadata_album_album_name` | string/null | nullable | |
| `track.isrc` | â€” | â€” | null (non nell'export GDPR) | recuperabile via MBID lookup successivo |
| `track.mbid` | â€” | â€” | null | lookup enrichment pipeline |
| `deviceType` | `platform` | string | mapping Â§3.2 | |
| `deviceDetail` | `platform` | string | valore raw | |
| `country` | `conn_country` | string | ISO 3166-1 alpha-2 | |
| `ip` | `ip_addr` | string | conservato SOLO se `PrivacySettings.retainIp` | |
| `shuffle` | `shuffle` | bool | diretto | |
| `skipped` | `skipped` + `reason_end` | bool | regola derivata E1 | |
| `offline` | `offline` | bool | diretto | |
| `incognito` | `incognito_mode` | bool | diretto | |
| `reasonStart` | `reason_start` | string | diretto | |
| `reasonEnd` | `reason_end` | string | diretto | |
| `completed` | â€” | â€” | `ms_played >= durataCatalogo - 5000` | 5s tolleranza |

### 3.2 Mapping `platform` â†’ `deviceType`

| Pattern `platform` | `deviceType` |
|---------------------|--------------|
| `/Android/i` | `mobile` |
| `/iOS|iPhone|iPad/i` | `mobile` |
| `/Windows|Linux|OS X|Mac/i` | `desktop` |
| `/web_player|WebPlayer/i` | `web` |
| `/car|CarPlay|Android Auto/i` | `car` |
| `/speaker|Cast|Sonos/i` | `speaker` |
| altro | `unknown` |

Nota: post ott-2023 `platform` Ã¨ generico (`android`, `windows`, `linux`). In questi casi `deviceDetail` Ã¨ meno informativo ma `deviceType` resta derivabile.

### 3.3 Regola `skipped` derivata (edge case E1)

Il campo `skipped` Spotify Ã¨ inaffidabile (tutti false tra 2015-04 e 2022-10). Adottiamo:

    isSkipped = skipped === true
             OR reason_end IN ('backbtn', 'fwdbtn', 'unknown')
             OR (reason_end === 'endplay' AND ms_played < durataCatalogo * 0.80)

`durataCatalogo` Ã¨ la durata del brano da metadata; se non disponibile, soglia fissa `ms_played < 30000`.

### 3.4 Library / Playlist / Artist / Album

| EntitÃ  | File sorgente | Campo chiave |
|--------|---------------|--------------|
| Artist seguito | `Follow.json` | `artist` + `spotify_artist_uri` |
| Album salvato | `YourLibrary.json` (`tracks`) | dedotto da track salvata |
| Track salvata | `YourLibrary.json` (`tracks`) | `trackUri` |
| Playlist | `Playlist*.json` | `name`, `lastModifiedDate` |
| PlaylistItem | `Playlist*.json` â†’ `items` | `track.trackUri`, `addedDate` |

## 4. Edge case noti

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E1 | `skipped` inaffidabile 2015-04 â†’ 2022-10 | Statistiche skip errate | Regola derivata Â§3.3 |
| E2 | Timestamp sovrapposti ~2.6% durata | Durata totale sovrastimata | Dedup via `eventKey` univoco; `ImportRecord.warnings` conta |
| E3 | `offline_timestamp` unitÃ  cambiate (s â†’ ms) | Timestamp errato | Rileva valore < 1e12 â†’ moltiplica 1000 |
| E4 | Stessa registrazione con URI diversi (singolo + album + compilation) | Conteggi frammentati | DEDUP via ISRC/MBID dopo enrichment |
| E5 | GranularitÃ  `platform` cambiata ott-2023 | DiscontinuitÃ  deviceType | Mapping pattern-based Â§3.2 |
| E6 | Podcast / video / audiobook con `spotify_track_uri` null | Eventi incompleti | Se `episode_name` presente â†’ tipo `podcast` (se supportato); altrimenti skip con warning |

## 5. Semantica temporale

- `ts` = **istante in cui lo stream Ã¨ terminato** (fine ascolto)
- `timestamp` (unificato) = `ts`
- `startedAt` = `ts - ms_played`

## 6. Dedup tracce

- Export GDPR **non fornisce ISRC nÃ© MBID**
- `spotify_track_uri` non Ã¨ ISRC/MBID (Ã¨ ID proprietario Spotify)
- **DEDUP-3** si applica di default (fuzzy name+artist+duration bucket 2s)
- Dopo enrichment (MusicBrainz lookup opzionale) il canonicalKey puÃ² essere promosso a DEDUP-1/2 se ISRC/MBID trovato
- La promozione Ã¨ implementata come job `rekey()` nel core

## 7. Privacy

| Dato | Default | Se `retainIp` true |
|------|---------|---------------------|
| `ip_addr` | scartato dopo derivazione `country` | conservato in `ListenEvent.ip` |
| Coordinate GPS | mai presenti nell'export | n/a |
| `SearchQueries.json` | processato, conservato in `searchQueries` (tabella dedicata, opzionale) | idem |
| `CarDetectionEvent.json` | processato SOLO se utente acconsente (opt-in esplicito separato) | idem |

Nota: `CarDetectionEvent` Ã¨ sensibile (tracciamento movimenti). Trattarlo come **consenso separato** da `retainIp`.

## 8. Test â€” fixture atteso

File: `fixtures/synthetic-history/spotify-sample.json` (Sessione 2 â€” vedi sotto).

Casi minimi:
1. **Happy path**: 3 eventi normali â†’ 3 ListenEvent, 3 track uniche
2. **Idempotenza**: re-import stesso file â†’ 0 nuovi eventi (`eventsDuplicated = 3`)
3. **E1 skipped**: evento con `reason_end: 'fwdbtn'`, `skipped: false` â†’ `skipped: true` derivato
4. **E3 offline**: `offline_timestamp: 1625932808` (vecchia unitÃ ) â†’ convertito a `1625932808000`
5. **E4 URI duplicati**: due eventi con URI diversi ma stesso nome+artista+durata â†’ una sola Track
6. **E5 platform pre/post ott-2023**: entrambi mappati a `deviceType` corretto
7. **E6 podcast**: evento con `episode_name` non null â†’ evento tipo `podcast` o skip con warning
8. **DEDUP promozione**: dopo enrichment con ISRC trovato, canonicalKey cambia da `fuzzy:...` a `isrc:...`
9. **Privacy retainIp=true**: `ip` conservato
10. **Privacy retainIp=false**: `ip` = null, `country` valorizzato

## 9. Segnalazione all'utente

| Codice i18n | Messaggio | Quando |
|-------------|-----------|--------|
| `adapter.spotify.detect.success` | "File Spotify riconosciuto" | detect ok |
| `adapter.spotify.detect.fail` | "File non riconosciuto come export Spotify" | detect ko |
| `adapter.spotify.warn.podcastSkipped` | "X episodi podcast esclusi (formato non supportato)" | E6 |
| `adapter.spotify.warn.overlaps` | "X eventi sovrapposti temporali rilevati" | E2 |
| `adapter.spotify.warn.offlineConverted` | "X timestamp offline convertiti" | E3 |
| `adapter.spotify.info.complete` | "Import completato: X eventi, Y brani unici" | fine |

## 10. Note implementative

- **Chunking**: batch da 1000 eventi per upsert, per evitare memory spike su file grandi (155MB+ di JSON pretty-printed)
- **Streaming parse**: usare `stream-json` o equivalente per AsyncIterable; non caricare tutto il JSON
- **Retry enrichment**: se MusicBrainz lookup fallisce per un track, riprova dopo 24h (queue)
- **Ordine file**: processare i JSON in ordine cronologico inverso (piÃ¹ recente â†’ piÃ¹ vecchio) per avere `lastSeenAt` corretto al primo passaggio

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 2 | Prima specifica completa |

===== FILE: docs/04-ANALYSIS-ALGORITHMS.md =====

# 04 â€” Algoritmi di Analisi

> Status: ðŸŸ¡ DRAFT Â· Versione 0.1 Â· Sessione 4
> Vincolante per: `packages/core/analysis/*` e relativi test

---

## 1. Principi generali

### 1.1 Derivati versionati

Ogni insight/sessione salvati nel DB porta un campo `derivedVersion`: stringa esadecimale (8 char) calcolata come:

    derivedVersion = sha1(JSON.stringify(configObject)).slice(0, 8)

dove `configObject` contiene tutti i parametri dell'algoritmo (threshold, window, weights). **Quando i parametri cambiano, cambia la versione**: gli insight vecchi diventano `stale` e vengono ricalcolati al prossimo avvio.

### 1.2 IncrementalitÃ 

Tutti gli algoritmi devono essere **incrementali**: dato lo stato precedente + nuovi eventi, aggiornare lo stato senza ricalcolare tutto. Serve per non bloccare l'UI durante import di file grandi.

### 1.3 Persistenza

| EntitÃ  | Tabella | Aggiornato |
|--------|---------|------------|
| `ListeningSession` | `sessions` | Ad ogni nuovo evento (estende o chiude sessione) |
| `Insight` (mood) | `insights` type=mood_day/week/month | Fine giornata/settimana/mese |
| `Insight` (era) | `insights` type=era | Ad ogni nuova sessione |
| `Insight` (event) | `insights` type=event | Quando viene rilevata anomalia |
| `Insight` (memory) | `insights` type=memory | Generato giornalmente |
| `Insight` (pattern) | `insights` type=pattern | Su richiesta / periodicamente |

### 1.4 Degradazione graziosa

Se mancano `AudioFeatures` (valence/energy null), l'algoritmo:
- Non produce insight basati su mood (salta)
- Usa `genre` come proxy quando disponibile (mapping genreâ†’valence/energy di default)
- Logga warning aggregato "X eventi senza audio features"

### 1.5 Tabella config â†’ derivedVersion

| Algoritmo | Config chiave | Versione iniziale |
|-----------|---------------|-------------------|
| Session segmentation | `gapThresholdMs` | `v1.0` |
| Mood tracker | `weights`, `moodThresholds` | `v1.0` |
| Pattern analyzer | `bucketSize` | `v1.0` |
| Era detector | `windowDays`, `kMin`, `kMax`, `similarityThreshold` | `v1.0` |
| Event detector | `zScoreThreshold`, `windowDays`, `baselineDays` | `v1.0` |
| Memory engine | `thresholds` per ogni tipo | `v1.0` |

---

## 2. Session Segmentation

### 2.1 Scopo

Dividere la sequenza cronologica di `ListenEvent` in **sessioni di ascolto continue**: una sessione Ã¨ una sequenza di eventi dove ogni evento inizia entro `gapThresholdMs` dalla fine del precedente.

### 2.2 Algoritmo

**Input**: array `events` ordinato per `startedAt` crescente
**Output**: array `sessions` di `ListeningSession`

    gapThresholdMs = 30 * 60 * 1000  // 30 minuti default

    function segmentSessions(events):
      sessions = []
      current = null
      prevEndTime = -infinity

      for event in events:
        gap = event.startedAt - prevEndTime

        if current == null OR gap > gapThresholdMs:
          if current != null:
            finalize(current)
            sessions.push(current)
          current = newSession(event)
        else:
          extend(current, event)

        prevEndTime = event.timestamp  // fine ascolto

      if current != null:
        finalize(current)
        sessions.push(current)

      return sessions

    function newSession(event):
      return {
        startTime: event.startedAt,
        endTime: event.timestamp,
        events: [event.id],
        tracks: new Set([event.trackId]),
        platform: event.platform,
        deviceType: event.deviceType
      }

    function extend(session, event):
      session.endTime = max(session.endTime, event.timestamp)
      session.events.push(event.id)
      session.tracks.add(event.trackId)

    function finalize(session):
      session.durationMs = session.endTime - session.startTime
      session.eventCount = session.events.length
      session.trackCount = session.tracks.size
      session.gapThresholdMs = gapThresholdMs
      session.derivedVersion = sha1({gapThresholdMs}).slice(0,8)
      session.id = uuid()

### 2.3 Parametri

| Parametro | Default | Range | Note |
|-----------|---------|-------|------|
| `gapThresholdMs` | 1.800.000 (30 min) | 300.000 - 7.200.000 | Utente puÃ² personalizzare |

### 2.4 Esempio numerico

Input (3 eventi):
- E1: 10:00-10:05 (Brano A)
- E2: 10:07-10:12 (Brano B)
- E3: 11:30-11:35 (Brano C)

Gap E1â†’E2: 2 min < 30 min â†’ stessa sessione
Gap E2â†’E3: 78 min > 30 min â†’ nuova sessione

Output: 2 sessioni (S1: 30 min, 3 eventi, 2 track; S2: 5 min, 1 evento, 1 track)

### 2.5 Invarianti testabili

- âˆ€ session: `durationMs â‰¥ 0`
- âˆ€ session: `eventCount â‰¥ 1`
- âˆ€ session: `trackCount â‰¤ eventCount`
- âˆ€ session: `startTime â‰¤ endTime`
- Sum(session.durationMs) â‰¤ total listening time + (n-1) Ã— gapThresholdMs

---

## 3. Mood Tracker

### 3.1 Scopo

Calcolare il **mood dominante** di un periodo (giorno/settimana/mese) come uno dei 6 valori: `sad | angry | neutral | calm | happy | excited`.

### 3.2 Mappatura valence/energy â†’ mood

Il quadrante Ã¨ definito da due soglie:

    valenceThreshold = 0.5
    energyThreshold = 0.5

| Valence | Energy | Mood |
|---------|--------|------|
| < 0.5 | < 0.5 | sad |
| < 0.5 | â‰¥ 0.5 | angry |
| [0.4, 0.6] | [0.4, 0.6] | neutral |
| â‰¥ 0.5 | < 0.5 | calm |
| â‰¥ 0.5 | [0.5, 0.75) | happy |
| â‰¥ 0.5 | â‰¥ 0.75 | excited |

Note:
- `neutral` Ã¨ una **fascia centrale** (non un punto) per evitare flip-flop
- `neutral` sovrascrive `sad`/`angry`/`calm`/`happy` se entrambe le coordinate sono nella fascia [0.4, 0.6]
- `excited` richiede valence ALTA (â‰¥0.5) E energy MOLTO ALTA (â‰¥0.75)

### 3.3 Mood di periodo

**Input**: tutti i `ListenEvent` in un periodo (giorno/settimana/mese) con `AudioFeatures` disponibili
**Output**: `MoodPeriodPayload`

    function computeMoodForPeriod(events, periodStart, periodEnd):
      valences = []
      energies = []

      for e in events:
        af = getAudioFeatures(e.trackId)
        if af.valence != null:
          weight = e.durationMs / 240000  // peso = durata / 4 min
          valences.push({val: af.valence, weight})
          energies.push({val: af.energy, weight})

      if valences.length < 3:
        return null  // insufficient data

      avgValence = weightedAverage(valences)
      avgEnergy = weightedAverage(energies)
      mood = classifyMood(avgValence, avgEnergy)

      return {
        kind: 'mood',
        mood,
        avgValence,
        avgEnergy,
        eventCount: events.length
      }

    function weightedAverage(items):
      sum = items.reduce((acc, x) => acc + x.val * x.weight, 0)
      weightSum = items.reduce((acc, x) => acc + x.weight, 0)
      return sum / weightSum

    function classifyMood(v, e):
      if v >= 0.4 AND v <= 0.6 AND e >= 0.4 AND e <= 0.6:
        return 'neutral'
      if v >= 0.5 AND e >= 0.75:
        return 'excited'
      if v >= 0.5 AND e >= 0.5:
        return 'happy'
      if v >= 0.5 AND e < 0.5:
        return 'calm'
      if v < 0.5 AND e < 0.5:
        return 'sad'
      if v < 0.5 AND e >= 0.5:
        return 'angry'

### 3.4 Parametri

| Parametro | Default | Note |
|-----------|---------|------|
| `valenceThreshold` | 0.5 | Centro quadrante |
| `energyThreshold` | 0.5 | Centro quadrante |
| `neutralBand` | 0.1 | Fascia neutra Â± |
| `excitedEnergyThreshold` | 0.75 | Per excited serve energy alta |
| `minEventsPerPeriod` | 3 | Sotto questo soglia â†’ no insight |

### 3.5 Esempio numerico

Periodo: lunedÃ¬ (5 eventi)
- Brano A: valence 0.3, energy 0.4, durata 200s â†’ weight 0.83
- Brano B: valence 0.7, energy 0.8, durata 240s â†’ weight 1.0
- Brano C: valence 0.4, energy 0.6, durata 180s â†’ weight 0.75
- Brano D: valence 0.8, energy 0.9, durata 300s â†’ weight 1.25
- Brano E: valence 0.5, energy 0.5, durata 220s â†’ weight 0.92

Weighted avg valence: (0.3Â·0.83 + 0.7Â·1.0 + 0.4Â·0.75 + 0.8Â·1.25 + 0.5Â·0.92) / 4.75 = 0.585
Weighted avg energy: (0.4Â·0.83 + 0.8Â·1.0 + 0.6Â·0.75 + 0.9Â·1.25 + 0.5Â·0.92) / 4.75 = 0.675

Classify: valence â‰¥ 0.5, energy in [0.5, 0.75) â†’ **happy**

### 3.6 Invarianti

- `mood âˆˆ {sad, angry, neutral, calm, happy, excited}`
- `avgValence âˆˆ [0, 1]`
- `avgEnergy âˆˆ [0, 1]`
- Se tutti gli eventi hanno lo stesso (v, e), mood = classifyMood(v, e)

---

## 4. Pattern Analyzer

### 4.1 Scopo

Rilevare pattern ricorrenti negli ascolti: **circadiano** (ora del giorno), **settimanale** (giorno della settimana), **stagionale** (mese dell'anno).

### 4.2 Algoritmo

Per ogni tipo di pattern, distribuire gli eventi in bucket e calcolare quote.

    function computeCircadianPattern(events):
      buckets = {0..23: 0}  // ore
      total = 0
      for e in events:
        hour = hourOf(e.startedAt, userTimezone)
        buckets[hour] += e.durationMs
        total += e.durationMs

      normalizedBuckets = {h: buckets[h] / total for h in 0..23}
      peakHour = argmax(buckets)

      return {
        kind: 'pattern',
        patternType: 'circadian',
        buckets: normalizedBuckets,
        peakHour,
        nightShare: sum(buckets[h] for h in [0,1,2,3,4,5]) / total
      }

    function computeWeeklyPattern(events):
      buckets = {Mon..Sun: 0}
      ... analogo

    function computeSeasonalPattern(events):
      buckets = {Jan..Dec: 0}
      ... analogo

### 4.3 Metriche derivate

- **peakHour / peakDay / peakMonth**: bucket con quota massima
- **nightShare**: quota ascolti notturni (00:00-05:59) â€” usata in Era detector
- **weekendShare**: quota sab+dom su totale
- **seasonalEntropy**: quanto Ã¨ distribuito (bassa = ascolti concentrati in pochi mesi)

### 4.4 Parametri

| Parametro | Default |
|-----------|---------|
| `nightHours` | [0, 1, 2, 3, 4, 5] |
| `weekendDays` | ['Sat', 'Sun'] |
| `minEvents` | 50 (altrimenti pattern non affidabile) |

### 4.5 Invarianti

- `sum(buckets.values) â‰ˆ 1.0` (tolleranza 0.01)
- `nightShare âˆˆ [0, 1]`
- `peakHour âˆˆ 0..23`

---

## 5. Era Detector

### 5.1 Scopo

Identificare **ere musicali**: periodi prolungati (â‰¥14 giorni) con caratteristiche coerenti, separati da cambiamenti significativi.

### 5.2 Algoritmo â€” Sliding window + change point detection

Approccio: calcolare una "firma musicale" per finestre settimanali, rilevare i punti di cambio significativi.

    windowDays = 14
    stepDays = 7
    similarityThreshold = 0.65
    minEraDays = 14

    function detectEras(events, sessions):
      // 1. Calcola firme settimanali
      signatures = computeWeeklySignatures(events, windowDays, stepDays)

      // 2. Rileva change points
      changePoints = detectChangePoints(signatures, similarityThreshold)

      // 3. Costruisci ere dai change points
      eras = buildEras(changePoints, events, minEraDays)

      // 4. Filtra ere troppo corte
      return eras.filter(e => daysBetween(e.start, e.end) >= minEraDays)

    function computeWeeklySignatures(events, windowDays, stepDays):
      signatures = []
      start = events[0].startedAt
      end = events.last().timestamp

      cursor = start
      while cursor < end:
        windowEnd = cursor + windowDays * 86400000
        windowEvents = events.filter(e => e.startedAt >= cursor AND e.startedAt < windowEnd)

        if windowEvents.length >= 5:
          signature = computeSignature(windowEvents)
          signatures.push({start: cursor, end: windowEnd, signature})

        cursor += stepDays * 86400000

      return signatures

    function computeSignature(events):
      // Vettore multidimensionale
      genreDistribution = computeGenreDistribution(events)  // {rock: 0.3, pop: 0.4, ...}
      topArtists = topN(events.groupBy(track.artistId), 5)    // [id1, id2, ...]
      avgValence = computeWeightedAvg(events, 'valence')
      avgEnergy = computeWeightedAvg(events, 'energy')
      nightShare = computeNightShare(events)
      repeatRate = computeRepeatRate(events)

      return {
        genreDistribution,
        topArtists,
        avgValence,
        avgEnergy,
        nightShare,
        repeatRate
      }

    function similarity(sig1, sig2):
      // Cosine similarity su generi + overlap Jaccard su topArtist + distanza normalizzata su valence/energy/nightShare/repeatRate
      genreSim = cosineSimilarity(sig1.genreDistribution, sig2.genreDistribution)
      artistSim = jaccard(sig1.topArtists, sig2.topArtists)
      numericSim = 1 - (
        abs(sig1.avgValence - sig2.avgValence) +
        abs(sig1.avgEnergy - sig2.avgEnergy) +
        abs(sig1.nightShare - sig2.nightShare) +
        abs(sig1.repeatRate - sig2.repeatRate)
      ) / 4

      return 0.5 * genreSim + 0.3 * artistSim + 0.2 * numericSim

    function detectChangePoints(signatures, threshold):
      changePoints = []
      for i in 1..signatures.length-1:
        sim = similarity(signatures[i-1].signature, signatures[i].signature)
        if sim < threshold:
          changePoints.push(signatures[i].start)
      return changePoints

    function buildEras(changePoints, events, minEraDays):
      boundaries = [events[0].startedAt, ...changePoints, events.last().timestamp]
      eras = []
      for i in 0..boundaries.length-2:
        start = boundaries[i]
        end = boundaries[i+1]
        eraEvents = events.filter(e => e.startedAt >= start AND e.startedAt < end)
        signature = computeSignature(eraEvents)
        mood = classifyMood(signature.avgValence, signature.avgEnergy)
        label = generateEraLabel(mood, signature)
        eras.push({
          periodStart: start,
          periodEnd: end,
          payload: {
            kind: 'era',
            label,
            moodDominant: mood,
            topArtistIds: signature.topArtists,
            topTrackIds: topN(eraEvents.groupBy(trackId), 5),
            genreDistribution: signature.genreDistribution,
            avgValence: signature.avgValence,
            avgEnergy: signature.avgEnergy,
            nightShare: signature.nightShare,
            repeatRate: signature.repeatRate
          },
          confidence: computeEraConfidence(eraEvents, signature)
        })
      return eras

    function generateEraLabel(mood, signature):
      topGenre = argmax(signature.genreDistribution)
      moodNames = {
        sad: 'Malinconia', angry: 'Rabbia', neutral: 'Neutro',
        calm: 'Calma', happy: 'FelicitÃ ', excited: 'Energia'
      }
      return "Era " + moodNames[mood] + " " + topGenre  // es. "Era Malinconia Indie"

### 5.3 Parametri

| Parametro | Default | Range | Note |
|-----------|---------|-------|------|
| `windowDays` | 14 | 7-30 | Finestra analisi |
| `stepDays` | 7 | 3-14 | Passo scorrimento |
| `similarityThreshold` | 0.65 | 0.5-0.8 | Sotto â†’ change point |
| `minEraDays` | 14 | 7-30 | Sotto â†’ scartata |
| `minEventsPerWindow` | 5 | 3-10 | Sotto â†’ finestra invalida |
| `weights.genre` | 0.5 | | Peso similarity |
| `weights.artist` | 0.3 | | |
| `weights.numeric` | 0.2 | | |

### 5.4 Esempio numerico

30 settimane di ascolto, con cambio netto alla settimana 12 (da pop a indie folk).

- Settimane 1-11: signature simile (cosine genre 0.9, Jaccard artist 0.7)
- Settimane 12-30: signature simile interna, ma similarity con settimana 11 = 0.4 (< 0.65)

Output: 2 ere separate al confine settimana 11/12.

### 5.5 Invarianti

- Ere sono **disgiunte e coprenti**: âˆªere = periodo totale, âˆ©ere = âˆ…
- `era.periodStart < era.periodEnd`
- `sum(genreDistribution.values) â‰ˆ 1.0`
- `moodDominant âˆˆ {sad, angry, neutral, calm, happy, excited}`

---

## 6. Event Detector

### 6.1 Scopo

Rilevare **anomalie significative** nei pattern di ascolto che suggeriscono eventi di vita (non solo variazioni naturali).

### 6.2 Tipi di evento

| Tipo | Descrizione | Trigger |
|------|-------------|---------|
| `spike_artist` | Picco improvviso di un artista | quota artista > 2Ã— baseline |
| `spike_genre` | Picco improvviso di un genere | quota genere > 2Ã— baseline |
| `valence_drop` | Crollo emotivo | Î”valence > 0.25 su 14gg |
| `valence_rise` | Risalita emotiva | Î”valence > 0.25 su 14gg |
| `volume_spike` | Esplosione di ascolto | durata > 2Ã— baseline |
| `volume_drop` | Silenzio prolungato | durata < 0.3Ã— baseline per â‰¥7gg |
| `exploration` | Esplorazione intensa | â‰¥10 artisti nuovi in 7gg |
| `silence` | Periodo di non-ascolto | â‰¥3 giorni senza eventi |

### 6.3 Algoritmo generico (z-score)

    baselineDays = 60
    windowDays = 14
    zScoreThreshold = 2.0

    function detectEvents(events):
      dailyMetrics = computeDailyMetrics(events)  // {day: {volume, valence, energy, diversity, newArtists}}

      events_detected = []
      cursor = earliestDay + baselineDays

      while cursor <= latestDay:
        baseline = dailyMetrics[cursor - baselineDays .. cursor]
        window = dailyMetrics[cursor .. cursor + windowDays]

        for metric in ['volume', 'valence', 'diversity']:
          mean, std = stats(baseline[metric])
          if std == 0: continue
          windowMean = avg(window[metric])
          z = (windowMean - mean) / std

          if abs(z) > zScoreThreshold:
            eventType = metricToEventType(metric, sign(z))
            events_detected.push({
              type: 'event',
              eventType,
              periodStart: cursor,
              periodEnd: cursor + windowDays,
              payload: {
                kind: 'event',
                eventType,
                description: generateDescription(eventType, z, metric),
                metrics: {z, baseline_mean: mean, window_mean: windowMean}
              },
              confidence: min(1, abs(z) / 4)
            })

        cursor += 7 days  // stride settimanale

      return dedupeOverlapping(events_detected)

    function generateDescription(eventType, z, metric):
      templates = {
        spike_artist: "Hai scoperto un nuovo artista che ha dominato il tuo ascolto",
        valence_drop: "La tua musica Ã¨ diventata piÃ¹ malinconica",
        valence_rise: "La tua musica Ã¨ diventata piÃ¹ allegra",
        volume_spike: "Hai ascoltato molta piÃ¹ musica del solito",
        volume_drop: "Hai ascoltato molta meno musica del solito",
        exploration: "Hai esplorato molti nuovi artisti",
        silence: "Periodo di silenzio musicale"
      }
      return templates[eventType] + " (z-score: " + z.toFixed(2) + ")"

### 6.4 Rilevatori specializzati (oltre z-score)

**silence detector**:

    function detectSilence(events):
      sorted = events.sortBy(startedAt)
      silences = []
      for i in 1..sorted.length-1:
        gap = sorted[i].startedAt - sorted[i-1].timestamp
        if gap >= 3 * 86400000:  // â‰¥ 3 giorni
          silences.push({
            periodStart: sorted[i-1].timestamp,
            periodEnd: sorted[i].startedAt,
            eventType: 'silence',
            durationDays: gap / 86400000
          })
      return silences

**exploration detector**:

    function detectExploration(events):
      // 7-day windows, count distinct new artists (mai ascoltati prima)
      ...
      // trigger: â‰¥10 nuovi artisti in 7 giorni

### 6.5 Parametri

| Parametro | Default |
|-----------|---------|
| `baselineDays` | 60 |
| `windowDays` | 14 |
| `zScoreThreshold` | 2.0 |
| `silenceMinDays` | 3 |
| `explorationMinNewArtists` | 10 |
| `strideDays` | 7 |

### 6.6 Esempio numerico

Baseline 60gg: avg volume 3h/giorno, std 1h
Window 14gg: avg volume 7h/giorno

z = (7 - 3) / 1 = 4.0 > 2.0 â†’ **volume_spike** rilevato con confidence min(1, 4/4) = 1.0

### 6.7 Invarianti

- `confidence âˆˆ [0, 1]`
- `eventType âˆˆ enum definito`
- Eventi non sovrapposti (dedupe mantiene solo quello con confidence piÃ¹ alta)
- `periodStart < periodEnd`

---

## 7. Memory Engine

### 7.1 Scopo

Generare **ricordi** giornalieri basati su 5 tipologie.

### 7.2 Tipologie e trigger

#### `on_this_day`

Trigger: esiste almeno un evento nella stessa data (mese+giorno) di `N` anni fa, con N âˆˆ {1, 2, 3, 5, 10}.

    function generateOnThisDay(today, events):
      memories = []
      for yearsAgo in [1, 2, 3, 5, 10]:
        targetDate = subtractYears(today, yearsAgo)
        eventsOnDate = events.filter(e => isSameDayMonth(e.startedAt, targetDate))
        if eventsOnDate.length > 0:
          topTrack = topByCount(eventsOnDate.groupBy(trackId))[0]
          memories.push({
            memoryKind: 'on_this_day',
            yearsAgo,
            trackId: topTrack.id,
            text: `yearsAgo anni fa ascoltavi "${topTrack.name}" di ${topTrack.artist}`
          })
      return memories

#### `first_time`

Trigger: oggi Ã¨ l'anniversario del primo ascolto di un artista significativo (â‰¥5 brani totali).

    function generateFirstTime(today, events):
      artistFirstListen = events.groupBy(artistId).map(artist => artist.min(startedAt))
      memories = []
      for (artistId, firstDate) in artistFirstListen:
        yearsAgo = yearsBetween(firstDate, today)
        if yearsAgo >= 1 AND isSameDayMonth(firstDate, today):
          totalListens = count(events.filter(e => e.track.artistId == artistId))
          if totalListens >= 5:
            memories.push({
              memoryKind: 'first_time',
              yearsAgo,
              artistId,
              text: `${yearsAgo} anni fa scoprivi ${artist.name}`
            })
      return memories

#### `milestone`

Trigger: raggiungimento di soglie cumulative (1000, 5000, 10000, 50000, 100000 eventi; 100, 500, 1000 ore; 100, 500 artisti unici).

    function generateMilestone(today, events):
      milestones = [1000, 5000, 10000, 50000, 100000]
      totalCount = events.length
      memories = []
      for m in milestones:
        if totalCount == m:
          memories.push({
            memoryKind: 'milestone',
            text: `Hai raggiunto ${m} brani ascoltati!`,
            metrics: {milestone: m}
          })
      return memories

#### `return`

Trigger: oggi riascolti un artista/brano che non ascoltavi da â‰¥6 mesi.

    function generateReturn(today, events):
      // per ogni artista, trova il gap piÃ¹ lungo tra due ascolti
      // se un gap si chiude oggi dopo â‰¥180gg â†’ ricordo return
      ...

#### `seasonal`

Trigger: ricorrenza stagionale (ascolti un artista/genere che hai ascoltato prevalentemente in questo mese negli anni passati).

    function generateSeasonal(today, events):
      currentMonth = monthOf(today)
      // trova artisti con â‰¥60% degli ascolti concentrati in currentMonth
      // se quest'anno li hai riascoltati in currentMonth â†’ ricordo
      ...

### 7.3 Parametri

| Parametro | Default |
|-----------|---------|
| `onThisDayYears` | [1, 2, 3, 5, 10] |
| `firstTimeMinListens` | 5 |
| `milestones` | [1000, 5000, 10000, 50000, 100000] |
| `returnMinGapDays` | 180 |
| `seasonalConcentration` | 0.6 |

### 7.4 Ranking ricordi

Ogni ricordo ha un `score` calcolato come:

    score = baseScore(memoryKind) Ã— relevance Ã— recency

- `baseScore`: `on_this_day=10`, `first_time=8`, `milestone=9`, `return=7`, `seasonal=6`
- `relevance`: `trackCount / medianTrackCount` (quanto Ã¨ rappresentativo il brano)
- `recency`: `exp(-daysAgo / 365)` (attenuazione per distanza)

Il feed ricordi mostra i top N score per giorno.

### 7.5 Invarianti

- `memoryKind âˆˆ enum`
- `yearsAgo âˆˆ {1, 2, 3, 5, 10}` per `on_this_day`
- `text` mai vuoto, contiene sempre almeno un dato concreto (nome artista/brano/numero)

---

## 8. Pipeline orchestratore

    function analyzeIncremental(newEvents, state):
      // 1. Aggiorna sessioni
      sessions = updateSessions(state.sessions, newEvents)

      // 2. Aggiorna pattern
      patterns = updatePatterns(state.patterns, newEvents)

      // 3. Calcola mood per periodi appena chiusi
      newDayInsights = computeMoodForPeriod(newEvents, 'day')
      newWeekInsights = computeMoodForPeriod(newEvents, 'week')

      // 4. Rileva ere (solo se nuovo change point)
      eras = detectErasIncremental(state.eras, newEvents)

      // 5. Rileva eventi
      events = detectEvents(state.events, newEvents)

      // 6. Genera ricordi del giorno
      memories = generateMemories(today(), state.allEvents)

      return {
        sessions,
        patterns,
        insights: [...newDayInsights, ...newWeekInsights, ...eras, ...events, ...memories]
      }

---

## 9. DerivedVersion registry

| Algoritmo | Config object | Versione |
|-----------|---------------|----------|
| Session segmentation | `{gapThresholdMs}` | calcolata |
| Mood tracker | `{valenceThreshold, energyThreshold, neutralBand, excitedEnergyThreshold, minEventsPerPeriod}` | calcolata |
| Pattern analyzer | `{nightHours, weekendDays, minEvents}` | calcolata |
| Era detector | `{windowDays, stepDays, similarityThreshold, minEraDays, weights}` | calcolata |
| Event detector | `{baselineDays, windowDays, zScoreThreshold, silenceMinDays, explorationMinNewArtists, strideDays}` | calcolata |
| Memory engine | `{onThisDayYears, firstTimeMinListens, milestones, returnMinGapDays, seasonalConcentration}` | calcolata |

Ogni volta che si cambia un parametro di default, la versione cambia e gli insight diventano `stale` â†’ ricalcolo automatico al prossimo avvio.

---

## 10. Esempio end-to-end

**Utente**: 10.000 eventi in 2 anni.

1. Import â†’ 10.000 ListenEvent persistiti
2. Session segmentation â†’ ~1.500 sessioni
3. Mood tracker â†’ 730 insight `mood_day`, 104 `mood_week`, 24 `mood_month`
4. Pattern analyzer â†’ 3 insight (circadian, weekly, seasonal)
5. Era detector â†’ ~4-8 ere (dipende da similarity threshold)
6. Event detector â†’ ~10-30 eventi (spike, drop, exploration)
7. Memory engine â†’ 1-5 ricordi generati ogni giorno

Tempo di esecuzione target su laptop medio: < 5 secondi totali (incrementale dopo primo calcolo).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 4 | Prima versione completa |

===== FILE: docs/05-ARCHITECTURE.md =====

# 05 â€” Architettura Tecnica

> Status: ðŸŸ¡ DRAFT
> Versione: 0.1
> Ultima modifica: Sessione 0 (consolidamento)
> ADR collegati: 0001-pwa-first, 0002-local-first, 0003-adapter-pattern (da scrivere in Sessione 1)

---

## 1. Principi architetturali

| Principio | Conseguenza |
|-----------|-------------|
| **Local-first** | Tutti i dati vivono nel browser (IndexedDB). L'app funziona offline dopo il primo caricamento |
| **Privacy-first** | Nessuna telemetria. Le uniche chiamate di rete sono: arricchimento metadati (opzionale), scrobbling hub (opzionale), sync cloud (opzionale, E2E) |
| **Adapter pattern** | Ogni piattaforma Ã¨ un modulo indipendente che produce il formato unificato; aggiungere una piattaforma = aggiungere un adapter |
| **Analisi deterministica e documentata** | Ogni insight deriva da formule specificate in `04-ANALYSIS-ALGORITHMS.md`, testabili con fixture |
| **Progressive enhancement** | Funziona con una sola piattaforma; migliora con piÃ¹ sorgenti |

## 2. Diagramma a layer

    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚ LIVELLO 4 â€” PRESENTAZIONE (React PWA)          â”‚
    â”‚  Timeline Â· Home Â· Esplora Â· Analisi Â· Ricordi â”‚
    â”‚  Impostazioni Â· Import Â· Share                 â”‚
    â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
    â”‚ LIVELLO 3 â€” ANALYSIS ENGINE (Web Worker)       â”‚
    â”‚  MoodTracker Â· EraDetector Â· EventDetector     â”‚
    â”‚  MemoryEngine Â· PatternAnalyzer                â”‚
    â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
    â”‚ LIVELLO 2 â€” ENRICHMENT PIPELINE                â”‚
    â”‚  AudioFeatures Â· MusicBrainz lookup Â· Generi   â”‚
    â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
    â”‚ LIVELLO 1 â€” IMPORT ENGINE (Adapters)           â”‚
    â”‚  spotify Â· youtube Â· apple Â· deezer Â· tidal    â”‚
    â”‚  soundcloud Â· lastfm Â· listenbrainz Â· plex     â”‚
    â”‚            â†“ formato unificato â†“               â”‚
    â”‚  LOCAL DATABASE (IndexedDB / Dexie)            â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

## 3. Formato unificato (record di ascolto)

Ogni adapter produce record conformi a questo schema (dettaglio completo in `02-DATA-SCHEMA.md`):

    {
      "id": "uuid",
      "source_platform": "spotify",
      "source_id": "spotify:track:xxx",
      "timestamp": "2024-03-15T14:30:00Z",
      "duration_ms": 245000,
      "track": {
        "name": "...", "artist": "...", "album": "...",
        "isrc": "GBUM71029604", "mbid": "..."
      },
      "context": {
        "device_type": "mobile", "device_detail": "...",
        "country": "IT", "offline": false, "incognito": false,
        "shuffle": true, "skipped": false,
        "reason_start": "playbtn", "reason_end": "endplay"
      },
      "audio_features": {
        "valence": 0.45, "energy": 0.62, "danceability": 0.41,
        "tempo": 72.3, "key": 2, "mode": 0
      }
    }

I campi contestuali sono **opzionali**: le piattaforme che non li forniscono li lasciano null. Le analisi devono degradare con grazia in loro assenza.

## 4. Adapter pattern â€” contratto

Ogni adapter espone la stessa interfaccia logica:

    interface PlatformAdapter {
      readonly platform: PlatformId;
      detect(input: File | Blob): boolean;          // riconosce il formato
      parse(input: File | Blob): AsyncIterable<RawListenEvent>;
      parseLibrary?(input: File | Blob): Promise<LibrarySnapshot>; // playlist, saved...
    }

Regole:
- `parse` Ã¨ **streaming** (AsyncIterable): mai caricare 200k eventi in memoria in un colpo
- Ogni adapter dichiara i propri edge case (vedi `01-PLATFORMS.md` Â§5) e li gestisce o li marca
- Output grezzo â†’ normalizzazione UTC â†’ deduplicazione â†’ persistenza

## 5. Database locale

- **Engine**: IndexedDB via Dexie.js
- **Tabelle principali**: `listen_events`, `tracks`, `artists`, `albums`, `audio_features`, `sessions`, `insights`, `imports_log`
- **Indici critici**: `listen_events.timestamp`, `listen_events.track_id`, `tracks.isrc`, `tracks.mbid`
- **Migrazioni**: versionate in Dexie; ogni cambio schema = nuova versione + funzione di upgrade
- Dettaglio completo in `02-DATA-SCHEMA.md` (Sessione 1)

## 6. Pipeline di arricchimento

Problema: Spotify ha deprecato le audio-features (nov 2024); Apple non le ha mai avute.

Strategia a cascata per ogni traccia:
1. **Cache locale** (giÃ  calcolata in precedenza)
2. **AcousticBrainz dump** (gratuito, congelato a giu-2022) per MBID/ISRC noti
3. **API esterna** (FreqBlog / Musicae) â€” chiamata opzionale, governata dal toggle privacy
4. **Essentia.js (WASM) in-browser** su preview audio quando disponibile
5. **Fallback**: nessuna feature â†’ le analisi basate su valence/energy degradano a analisi per genere/tag

Ogni feature salvata registra la **fonte** (`source: acousticbrainz | api | essentia | manual`) per trasparenza e ri-calcolo futuro.

## 7. Analysis engine

Esegue in **Web Worker** dedicato per non bloccare la UI. Moduli: MoodTracker, EraDetector, EventDetector, MemoryEngine, PatternAnalyzer. Ogni algoritmo Ã¨ specificato con formula, parametri e esempio inputâ†’output in `04-ANALYSIS-ALGORITHMS.md` (Sessione 4). I risultati sono persistiti in `insights` con versionamento del parametro-set (permette ricalcolo coerente).

## 8. Stack tecnologico

| Componente | Scelta | Motivazione |
|------------|--------|-------------|
| Runtime UI | React 19 + TypeScript + Vite | Ecosistema, PWA-first |
| PWA | vite-plugin-pwa (Workbox) | Offline, installabilitÃ  |
| Stato | Zustand + React Query | Leggerezza, semplicitÃ  |
| DB locale | Dexie.js (IndexedDB) | API matura, migrazioni |
| Grafici | D3.js (custom) + Recharts (standard) | Timeline custom + velocitÃ  |
| UI kit | Tailwind + shadcn/ui | Coerenza col design system |
| Parsing | PapaParse (CSV), JSON nativo, streaming | File grandi |
| Audio features | Essentia.js (WASM) + API fallback | Open source |
| Test | Vitest + Playwright | Unit + e2e |
| Desktop (Fase 2) | Tauri 2.0 | 10x piÃ¹ leggero di Electron |
| Sync cloud (Fase 2+, opzionale) | Fastify + PostgreSQL + CRDT + E2E | Solo se richiesto |

## 9. Struttura monorepo (target Fase 0 tecnica)

    life-soundtrack/
    â”œâ”€â”€ apps/
    â”‚   â”œâ”€â”€ web/                  # PWA principale
    â”‚   â””â”€â”€ desktop/              # Tauri (Fase 2)
    â”œâ”€â”€ packages/
    â”‚   â”œâ”€â”€ core/
    â”‚   â”‚   â”œâ”€â”€ adapters/         # un modulo per piattaforma
    â”‚   â”‚   â”œâ”€â”€ analysis/
    â”‚   â”‚   â”œâ”€â”€ enrichment/
    â”‚   â”‚   â”œâ”€â”€ schema/           # tipi TypeScript condivisi
    â”‚   â”‚   â””â”€â”€ db/
    â”‚   â””â”€â”€ ui/                   # design system componentizzato
    â”œâ”€â”€ docs/ Â· design/ Â· fixtures/ Â· scripts/

## 10. Requisiti non funzionali

| Requisito | Target |
|-----------|--------|
| Import 100k eventi | < 30 s |
| First contentful paint | < 1.5 s |
| Bundle iniziale | < 300 KB gzip (worker e WASM lazy) |
| Offline | 100% funzionale dopo primo load |
| Privacy | Zero PII in uscita senza toggle esplicito |
| AccessibilitÃ  | WCAG 2.1 AA |
| Browser | Chrome/Edge 90+, Firefox 90+, Safari 15+ |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Consolidamento dalle sessioni esplorative |

===== FILE: docs/06-UX-FLOWS-STATES.md =====

# 06 â€” UX Flows e Stati per Schermata

> Status: ðŸŸ¡ DRAFT Â· Versione 0.1 Â· Sessione 5
> Vincolante per: UI implementation, test E2E, copy

---

## 1. Matrice stati globale

Ogni schermata puÃ² trovarsi in uno di questi stati:

| Stato | Descrizione | Comportamento |
|-------|-------------|---------------|
| `loading` | Dati/caricamento in corso | Spinner/skeleton, nessuna azione utente |
| `empty` | Nessun dato disponibile | Illustrazione + CTA di uscita |
| `partial` | Alcuni dati, non tutti | FunzionalitÃ  ridotte + prompt per completare |
| `ready` | Stato normale | Tutte le funzionalitÃ  attive |
| `error` | Errore bloccante | Messaggio + retry + fallback |
| `offline` | Nessuna connessione (solo per feature cloud) | Messaggio + cache locale |

Regola: **mai schermate bianche**. Ogni stato ha un design definito in `15-DESIGN-SYSTEM.md` Â§Empty States.

## 2. Catalogo schermate con stati

### 2.1 â‘  Benvenuto

| Stato | Contenuto | CTA |
|-------|-----------|-----|
| `ready` (unico) | Logo + tagline + bottone | `i18n: onboarding.start` â†’ â‘¡ |

Note: nessuna gestione errore (schermata statica).

### 2.2 â‘¡ Privacy

| Stato | Contenuto | CTA |
|-------|-----------|-----|
| `ready` | Shield + 3 garanzie + bottone | `i18n: onboarding.understood` â†’ â‘¢ |

### 2.3 â‘¢ Import

| Stato | Comportamento |
|-------|---------------|
| `ready` | Lista PlatformCard (tutte vuote) |
| `partial` | â‰¥1 piattaforma connessa, bottone "Importa tutto" attivo |
| `loading` | DropZone mostra "Validazione..." durante drop |
| `error` | Piattaforma con file invalido â†’ messaggio specifico sotto la card |
| `empty` | (non applicabile: c'Ã¨ sempre la lista piattaforme) |

**Transizioni**:
- Drop file â†’ stato `loading` della PlatformCard (spinner interno)
- Validazione fallita â†’ stato `error` della card con messaggio (es. "Questo file sembra di Apple Music, non di Spotify")
- Validazione OK â†’ stato `done` della card con badge verde e conteggio
- "Importa tutto" disabilitato se 0 piattaforme in stato `done`

**Edge case UX**:
- Trascinamento di file non supportato â†’ toast "Formato non supportato"
- Doppio drop stesso file â†’ "GiÃ  importato" (no re-import)
- File > 500MB â†’ warning "File grande, potrebbe richiedere qualche minuto"

### 2.4 â‘£ Processing

| Stato | Contenuto |
|-------|-----------|
| `loading` | Progress ring + counter live + equalizer animato |
| `error` | Messaggio errore + "Riprova" / "Annulla" |
| `ready` | (transizione automatica a â‘¤) |

**Counter live** (aggiornati ogni 500ms):
- Eventi analizzati
- Artisti riconosciuti
- Ere musicali in formazione (stima)

**Annullamento**: utente puÃ² annullare; import parziali sono salvati, UI torna a â‘¢ con stato `partial`.

### 2.5 â‘¤ Prima Rivelazione Timeline

| Stato | Note |
|-------|------|
| `ready` | Mostra una sola volta (flag `first_reveal_done` in localStorage) |
| `loading` | Animazione di formazione ere (sequenza 2016â†’oggi, 3s) |

**Comportamento**:
- Animazione non skippabile (momento wow deliberato)
- Pulsante "Salta" visibile ma discreto in basso a destra
- Click su un'era durante l'animazione â†’ interrupt e navigazione a â‘§
- Dopo completamento â†’ pulsante "Esplora la tua timeline" â†’ â‘¦

### 2.6 â‘¥ Home

| Stato | Comportamento |
|-------|---------------|
| `empty` | Empty state: "Importa i tuoi dati per vedere la tua timeline" â†’ â‘¢ |
| `partial` | <100 eventi totali: mostra stats base + messaggio "PiÃ¹ dati importi, piÃ¹ la tua storia diventa ricca" |
| `ready` | 4 StatCard + MemoryCard + BarWeek + mood settimana |
| `loading` | Skeleton su tutte le card durante ricalcolo |

**Animazioni**:
- StatCard: count-up numeri all'apparizione (600ms, easing-out)
- MemoryCard: fade-in con delay 200ms
- BarWeek: barre che crescono con stagger

**Refresh**:
- Pull-to-refresh su mobile
- Auto-refresh all'apertura app se dati modificati

### 2.7 â‘¦ Timeline

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Non hai ancora abbastanza dati per una timeline" â†’ suggerisce import |
| `partial` | <6 mesi di dati: timeline presente ma con avviso "Timeline parziale" |
| `loading` | Skeleton chart durante cambio granularitÃ  |
| `ready` | EraBands + StreamChart + MoodLine sincronizzati |
| `error` | "Errore caricamento timeline" + retry |

**GranularitÃ **: toggle Anni/Mesi/Settimane/Giorni. Cambio granularitÃ  = transizione fade 200ms.

**Sincronizzazione visualizzazioni**:
- Hover su EraBand â†’ highlight punto corrispondente in StreamChart e MoodLine
- Hover su punto MoodLine â†’ highlight EraBand corrispondente
- Click su EraBand â†’ navigazione a â‘§

**Performance**:
- Lazy rendering di ere fuori viewport (virtualized list)
- Debounce hover 50ms

### 2.8 â‘§ Dettaglio Era

| Stato | Comportamento |
|-------|---------------|
| `ready` | Banner + stats + top artists + top tracks + chart |
| `loading` | Skeleton dettagliato |
| `error` | "Impossibile caricare i dettagli" + back button |

**Interazioni**:
- Click artista â†’ â‘¨ filtrato su quell'artista
- Click brano â†’ modal con dettagli brano (mood, periodo, contesto)
- "Rivivi questo periodo" â†’ player preview (opzionale) o lista scroll

### 2.9 â‘¨ Esplora

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Nessun artista/brano/album da esplorare" â†’ suggerisce import |
| `ready` | Search + tabs + griglie |
| `loading` | Skeleton + spinner search |
| `no-results` | "Nessun risultato per X" + suggerimenti |

**Tabs**: Artisti, Brani, Album, Generi, Mood. Cambio tab = transizione slide 200ms.

**Search**:
- Autocomplete su propri dati (non catalogo globale)
- Debounce 300ms
- Risultati ordinati per listenCount

**Mood pills**: riga in basso con 6 emoji. Click = filtro. Pill attivo ha glow.

### 2.10 â‘© Analisi â€” Mappa Emotiva

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Servono almeno 3 mesi di dati per la mappa emotiva" |
| `partial` | 3-6 mesi: mappa parziale + avviso |
| `ready` | QuadrantChart + line charts + insight narrativo |
| `loading` | Skeleton grafici |

**Interazioni**:
- Click su punto mese â†’ highlight nelle line chart sotto
- Hover su punto â†’ tooltip con "Marzo 2024 â€” valence 0.31, energy 0.42, mood sad"
- Selettore periodo (anno) in alto

### 2.11 â‘ª Ricordi (mobile)

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Nessun ricordo per oggi" + "Guarda tutti i ricordi" |
| `ready` | Feed scrollabile di MemoryCard |
| `loading` | Skeleton 3 card + infinite scroll |
| `error` | "Errore caricamento ricordi" + retry |

**Infinite scroll**: carica 10 ricordi alla volta.

**Swipe actions**:
- Swipe left â†’ "Nascondi questo tipo di ricordo"
- Swipe right â†’ "Salva nei preferiti"

### 2.12 â‘« Share Sheet

| Stato | Comportamento |
|-------|---------------|
| `loading` | "Generazione card..." |
| `ready` | Preview card + 5 destinazioni |
| `error` | "Errore generazione immagine" + retry |

**Destinazioni**:
- Instagram Stories (deep link)
- WhatsApp (share)
- X (Twitter) (share)
- Copia negli appunti
- Scarica

**Bottom sheet**: swipe down o tap fuori â†’ chiudi.

### 2.13 â‘¬ Impostazioni

| Stato | Sempre ready |

**Sezioni**:
1. **Piattaforme collegate**: lista con stato (connected/disconnected) + reconnect/disconnect
2. **Privacy**: 3 toggle + spiegazioni
3. **Dati**: "Esporta tutto (JSON)" + "Cancella tutti i dati" (rosso, con conferma doppia)
4. **Preferenze**: tema, lingua

**Cancella dati**:
- Click â†’ modal conferma 1: "Sicuro?"
- Conferma â†’ modal 2: "Digita ELIMINA per confermare"
- Input corretto â†’ delete + redirect a â‘­ Empty

### 2.14 â‘­ Empty State

| Stato | Comportamento |
|-------|---------------|
| `empty` | Illustrazione + "La tua storia inizia qui" + CTA Import + CTA Demo |

**Variante per sezione**:
- Home: "Importa i tuoi dati di streaming"
- Timeline: "Importa per vedere la tua timeline"
- Esplora: "Importa per esplorare il tuo catalogo"
- Analisi: "Importa per vedere le tue analisi"
- Ricordi: "Importa per generare ricordi"

**Demo mode**: click su "Scopri come funziona" â†’ carica fixture `demo-user.json` con 1 anno di storia sintetica, flag `demo=true` (tutti i dati cancellabili con un click).

## 3. Flussi utente principali

### 3.1 Flusso Onboarding (prima volta)

    â‘  Benvenuto
       â”‚
       â–¼ (tap "Inizia il viaggio")
    â‘¡ Privacy
       â”‚
       â–¼ (tap "Ho capito, continua")
    â‘¢ Import
       â”‚
       â–¼ (drag&drop file Spotify + click "Importa tutto")
    â‘£ Processing
       â”‚
       â–¼ (automatico al 100%)
    â‘¤ Prima Rivelazione
       â”‚
       â–¼ (tap "Esplora la tua timeline")
    â‘¦ Timeline
       â”‚
       â–¼ (auto-redirect dopo 10s o tap)
    â‘¥ Home

### 3.2 Flusso Quotidiano

    Apertura app
       â”‚
       â–¼
    â‘¥ Home
       â”œâ†’ tap StatCard â†’ â‘© Analisi
       â”œâ†’ tap MemoryCard â†’ â‘ª Ricordi
       â””â†’ tap barra settimanale â†’ â‘¦ Timeline â†’ â‘§ Era â†’ â‘¨ Esplora

### 3.3 Flusso Condivisione Ricordo

    â‘ª Ricordi
       â”‚
       â–¼ (tap "Condividi")
    â‘« Share Sheet
       â”‚
       â”œâ†’ Instagram â†’ deep link con immagine
       â”œâ†’ WhatsApp â†’ share sheet nativo
       â”œâ†’ Copia â†’ toast "Immagine copiata"
       â””â†’ Scarica â†’ save to gallery + toast "Salvato"

### 3.4 Flusso Cancellazione Totale

    â‘¬ Impostazioni
       â”‚
       â–¼ (tap "Cancella tutti i dati")
    Modal 1 ("Sicuro?")
       â”‚
       â–¼ (tap "Continua")
    Modal 2 ("Digita ELIMINA")
       â”‚
       â–¼ (input corretto)
    Delete DB + redirect a â‘­ Empty

## 4. Stato machine di Import

    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”    drop     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   valid    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚  IDLE  â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚  VALIDATING â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚ PARSING  â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”˜             â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜
       â–²                           â”‚                        â”‚
       â”‚                      invalid                   parse ok
       â”‚                           â”‚                        â”‚
       â”‚                           â–¼                        â–¼
       â”‚                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â”‚                    â”‚   ERROR     â”‚          â”‚ENRICHING â”‚
       â”‚                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜          â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜
       â”‚                          â”‚                        â”‚
       â”‚                      retry                   enrich ok
       â”‚                          â”‚                        â”‚
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â–¶ DONE
                                                                       â”‚
                                                                    upsert
                                                                       â”‚
                                                                       â–¼
                                                                  PERSISTED

## 5. Gestione errori

| Categoria | UX Pattern |
|-----------|------------|
| **Errore validazione file** | Messaggio inline sotto la card, tono umano ("Questo file sembra di Apple Music, non di Spotify") |
| **Errore parsing** | Toast "Import parzialmente fallito: X eventi importati, Y scartati" + dettaglio in Settings |
| **Errore enrichment** | Silenzioso; dati salvati senza audio features; avviso aggregato in Settings |
| **Errore DB** | Modal "Errore critico, ricarica l'app" + log in console |
| **Errore rete (se cloud)** | Banner in alto "Sei offline, i dati sono salvati localmente" |

## 6. Feedback micro-interazioni

| Interazione | Feedback |
|-------------|----------|
| Hover StatCard | Glow + count-up animato |
| Click EraBand | Espansione smooth 200ms |
| Scroll Timeline | Fade-in ere al passaggio |
| Import completato | Confetti sottili (ridotti se `prefers-reduced-motion`) |
| Ricordo condiviso | Toast "Immagine condivisa" 3s |
| Swipe MemoryCard | Animazione 150ms con rubber-band |
| Toggle privacy | Switch 150ms + conferma "Impostazione salvata" |

## 7. Keyboard navigation

| Schermata | Scorciatoie |
|-----------|-------------|
| Globale | `/` focus search; `Esc` chiude modal; `?` mostra shortcuts |
| Timeline | `â†` `â†’` cambio periodo; `+` `-` zoom granularitÃ  |
| Home | `M` vai a ricordi; `T` vai a timeline |
| Esplora | `â†‘` `â†“` navigate risultati; `Enter` seleziona |

## 8. Screen reader

Ogni visualizzazione ha un'alternativa testuale nascosta:
- StreamChart â†’ "Ascolti mensili: gennaio 40h, febbraio 52h, ..."
- MoodLine â†’ "Mood dominante: gennaio felice, febbraio neutro, marzo triste"
- QuadrantChart â†’ "Il tuo anno Ã¨ stato prevalentemente felice (valence media 0.62)"

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 5 | Prima versione completa |

===== FILE: docs/08-COPY-I18N.md =====

# 08 â€” Copy e Internationalization

> Status: ðŸŸ¡ DRAFT Â· Versione 0.1 Â· Sessione 5
> Lingue MVP: Italiano (it), English (en)
> Formato chiavi: `namespace.scope.key`

---

## 1. Struttura chiavi

    namespace.scope.key

| Namespace | Uso |
|-----------|-----|
| `onboarding` | Schermate â‘ -â‘£ |
| `home` | Schermata â‘¥ |
| `timeline` | Schermata â‘¦ |
| `era` | Schermata â‘§ |
| `explore` | Schermata â‘¨ |
| `analysis` | Schermata â‘© |
| `memories` | Schermata â‘ª |
| `share` | Schermata â‘« |
| `settings` | Schermata â‘¬ |
| `empty` | Schermata â‘­ e empty states |
| `import` | Flusso import |
| `adapter` | Messaggi specifici per piattaforma |
| `error` | Messaggi di errore |
| `common` | Bottoni e testi condivisi |
| `insight` | Insight narrativi |

## 2. Stringhe UI

### 2.1 `onboarding.*`

| Key | IT | EN |
|-----|----|----|
| `welcome.title` | La colonna sonora della tua vita | The soundtrack of your life |
| `welcome.subtitle` | Finalmente leggibile | Finally readable |
| `welcome.cta` | Inizia il viaggio | Start the journey |
| `privacy.title` | I tuoi dati, solo tuoi | Your data, only yours |
| `privacy.bullet1` | Elaborazione locale sul dispositivo | Local processing on your device |
| `privacy.bullet2` | Nessun account richiesto | No account required |
| `privacy.bullet3` | Export dei dati in qualsiasi momento | Export your data anytime |
| `privacy.cta` | Ho capito, continua | Got it, continue |
| `import.title` | Importa la tua musica | Import your music |
| `import.subtitle` | Scegli le piattaforme che usi o hai usato | Choose the platforms you use or used |
| `import.dropzone` | Trascina qui il file | Drop file here |
| `import.browse` | Oppure sfoglia | Or browse |
| `import.importAll` | Importa tutto | Import all |
| `import.lock` | I tuoi dati restano solo sul tuo dispositivo | Your data stays only on your device |
| `processing.title` | Sto leggendo la tua storia musicale | Reading your musical history |
| `processing.events` | {count} eventi analizzati | {count} events analyzed |
| `processing.artists` | {count} artisti riconosciuti | {count} artists recognized |
| `processing.eras` | {count} ere musicali in formazione | {count} musical eras forming |
| `processing.cancel` | Annulla | Cancel |
| `reveal.title` | La tua vita in musica | Your life in music |
| `reveal.subtitle` | {years} anni, {events} momenti, un solo racconto | {years} years, {events} moments, one story |
| `reveal.cta` | Esplora la tua timeline | Explore your timeline |
| `reveal.skip` | Salta | Skip |

### 2.2 `home.*`

| Key | IT | EN |
|-----|----|----|
| `greeting` | Ciao, {name} ðŸ‘‹ | Hello, {name} ðŸ‘‹ |
| `stats.tracks` | brani | tracks |
| `stats.hours` | ore ascoltate | hours listened |
| `stats.artists` | artisti | artists |
| `stats.eras` | ere musicali | musical eras |
| `todayInHistory` | Oggi nella tua storia | Today in your history |
| `weekTitle` | La tua settimana | Your week |
| `moodWeek` | Mood della settimana | Week mood |
| `days.mon` | Lun | Mon |
| `days.tue` | Mar | Tue |
| `days.wed` | Mer | Wed |
| `days.thu` | Thu | Thu |
| `days.fri` | Ven | Fri |
| `days.sat` | Sab | Sat |
| `days.sun` | Dom | Sun |

### 2.3 `timeline.*`

| Key | IT | EN |
|-----|----|----|
| `title` | La tua vita in musica | Your life in music |
| `volume` | Volume di ascolto | Listening volume |
| `mood` | Mood (valence) | Mood (valence) |
| `granularity.years` | Anni | Years |
| `granularity.months` | Mesi | Months |
| `granularity.weeks` | Settimane | Weeks |
| `granularity.days` | Giorni | Days |
| `exploreEra` | Esplora questa era | Explore this era |

### 2.4 `era.*`

| Key | IT | EN |
|-----|----|----|
| `title` | Era {label} | {label} Era |
| `period` | {start} â†’ {end} | {start} â†’ {end} |
| `topArtists` | Top artisti | Top artists |
| `topSongs` | Top brani | Top songs |
| `moodDominant` | Mood dominante | Dominant mood |
| `nightShare` | Ascolti notturni | Night listens |
| `repeatRate` | Ripetizioni | Repeats |
| `relive` | Rivivi questo periodo | Relive this period |

### 2.5 `explore.*`

| Key | IT | EN |
|-----|----|----|
| `title` | Esplora | Explore |
| `search` | Cerca nel tuo catalogo | Search your library |
| `tab.artists` | Artisti | Artists |
| `tab.tracks` | Brani | Tracks |
| `tab.albums` | Album | Albums |
| `tab.genres` | Generi | Genres |
| `tab.mood` | Mood | Mood |
| `noResults` | Nessun risultato per "{query}" | No results for "{query}" |

### 2.6 `analysis.*`

| Key | IT | EN |
|-----|----|----|
| `title` | La tua mappa emotiva | Your emotional map |
| `quadrant.high` | ALTA ENERGIA | HIGH ENERGY |
| `quadrant.low` | BASSA ENERGIA | LOW ENERGY |
| `quadrant.valence` | VALENCE â†’ | VALENCE â†’ |
| `moods.sad` | Triste | Sad |
| `moods.angry` | Arrabbiato | Angry |
| `moods.neutral` | Neutro | Neutral |
| `moods.calm` | Calmo | Calm |
| `moods.happy` | Felice | Happy |
| `moods.excited` | Eccitato | Excited |
| `valenceOverTime` | Valence nel tempo | Valence over time |
| `energyOverTime` | Energy nel tempo | Energy over time |

### 2.7 `memories.*`

| Key | IT | EN |
|-----|----|----|
| `title` | I tuoi ricordi musicali | Your musical memories |
| `onThisDay` | ON QUESTO GIORNO | ON THIS DAY |
| `milestone` | MILESTONE | MILESTONE |
| `return` | RITORNO | RETURN |
| `seasonal` | STAGIONALE | SEASONAL |
| `relive` | Rivivi | Relive |
| `share` | Condividi | Share |
| `save` | Salva | Save |
| `hide` | Nascondi | Hide |
| `yearsAgo` | {n} anni fa | {n} years ago |

### 2.8 `share.*`

| Key | IT | EN |
|-----|----|----|
| `title` | Condividi | Share |
| `generating` | Generazione card... | Generating card... |
| `instagram` | Instagram | Instagram |
| `whatsapp` | WhatsApp | WhatsApp |
| `twitter` | X (Twitter) | X (Twitter) |
| `copy` | Copia | Copy |
| `download` | Scarica | Download |
| `copied` | Immagine copiata | Image copied |
| `saved` | Immagine salvata | Image saved |

### 2.9 `settings.*`

| Key | IT | EN |
|-----|----|----|
| `title` | Impostazioni | Settings |
| `platforms` | Piattaforme collegate | Connected platforms |
| `privacy` | Privacy | Privacy |
| `data` | Dati | Data |
| `preferences` | Preferenze | Preferences |
| `privacy.retainIp` | Conserva indirizzi IP | Retain IP addresses |
| `privacy.retainIpDesc` | Gli IP restano solo sul tuo dispositivo | IPs stay only on your device |
| `privacy.enrich` | Arricchimento metadati online | Online metadata enrichment |
| `privacy.enrichDesc` | Recupera audio features da fonti esterne | Fetch audio features from external sources |
| `privacy.stats` | Statistiche anonime | Anonymous statistics |
| `privacy.statsDesc` | Aiutaci a migliorare (no dati personali) | Help us improve (no personal data) |
| `data.export` | Esporta tutto (JSON) | Export all (JSON) |
| `data.delete` | Cancella tutti i dati | Delete all data |
| `prefs.theme` | Tema | Theme |
| `prefs.theme.dark` | Scuro | Dark |
| `prefs.theme.light` | Chiaro | Light |
| `prefs.language` | Lingua | Language |
| `delete.confirm1` | Sei sicuro? Questa azione Ã¨ irreversibile. | Are you sure? This cannot be undone. |
| `delete.confirm2` | Digita ELIMINA per confermare | Type DELETE to confirm |
| `delete.keyword` | ELIMINA | DELETE |

### 2.10 `empty.*`

| Key | IT | EN |
|-----|----|----|
| `title` | La tua storia inizia qui | Your story starts here |
| `description.home` | Importa i tuoi dati di streaming per vedere la timeline della tua vita musicale | Import your streaming data to see your musical life timeline |
| `description.timeline` | Importa per vedere la tua timeline | Import to see your timeline |
| `description.explore` | Importa per esplorare il tuo catalogo | Import to explore your library |
| `description.analysis` | Importa per vedere le tue analisi | Import to see your analysis |
| `description.memories` | Importa per generare ricordi | Import to generate memories |
| `cta.import` | Importa la tua musica | Import your music |
| `cta.demo` | Scopri come funziona | See how it works |

### 2.11 `import.*`

| Key | IT | EN |
|-----|----|----|
| `status.empty` | Trascina o sfoglia | Drop or browse |
| `status.validating` | Validazione... | Validating... |
| `status.parsing` | Parsing... | Parsing... |
| `status.done` | {count} eventi trovati | {count} events found |
| `status.error` | Formato non riconosciuto | Format not recognized |
| `platform.connect` | Connetti | Connect |
| `platform.disconnect` | Disconnetti | Disconnect |
| `platform.connected` | Connesso | Connected |

### 2.12 `adapter.*`

| Key | IT | EN |
|-----|----|----|
| `spotify.detect.success` | File Spotify riconosciuto | Spotify file recognized |
| `spotify.detect.fail` | File non riconosciuto come export Spotify | File not recognized as Spotify export |
| `spotify.wrongFormat` | Questo file sembra di {platform}, non di Spotify | This file looks like {platform}, not Spotify |
| `spotify.warn.podcastSkipped` | {count} episodi podcast esclusi | {count} podcast episodes excluded |
| `spotify.warn.overlaps` | {count} eventi sovrapposti rilevati | {count} overlapping events detected |
| `spotify.info.complete` | Import completato: {events} eventi, {tracks} brani unici | Import complete: {events} events, {tracks} unique tracks |
| *(analoghi per youtube, apple, deezer, tidal, soundcloud, lastfm, listenbrainz)* | | |

### 2.13 `error.*`

| Key | IT | EN |
|-----|----|----|
| `generic` | Qualcosa Ã¨ andato storto | Something went wrong |
| `retry` | Riprova | Retry |
| `fileTooLarge` | File troppo grande (max 1GB) | File too large (max 1GB) |
| `networkOffline` | Sei offline, i dati sono salvati localmente | You're offline, data is saved locally |
| `dbCritical` | Errore critico, ricarica l'app | Critical error, reload the app |

### 2.14 `common.*`

| Key | IT | EN |
|-----|----|----|
| `save` | Salva | Save |
| `cancel` | Annulla | Cancel |
| `close` | Chiudi | Close |
| `confirm` | Conferma | Confirm |
| `continue` | Continua | Continue |
| `back` | Indietro | Back |
| `next` | Avanti | Next |
| `loading` | Caricamento... | Loading... |
| `search` | Cerca | Search |

### 2.15 `insight.*`

| Key | IT | EN |
|-----|----|----|
| `mood.happy` | La tua musica Ã¨ stata prevalentemente felice | Your music was mostly happy |
| `mood.sad` | La tua musica Ã¨ stata prevalentemente malinconica | Your music was mostly melancholic |
| `mood.excited` | Periodo ad alta energia | High-energy period |
| `mood.calm` | Periodo rilassato | Relaxed period |
| `event.spike_artist` | Hai scoperto {artist} che ha dominato il tuo ascolto | You discovered {artist} who dominated your listening |
| `event.valence_drop` | La tua musica Ã¨ diventata piÃ¹ malinconica | Your music became more melancholic |
| `event.valence_rise` | La tua musica Ã¨ diventata piÃ¹ allegra | Your music became more cheerful |
| `event.volume_spike` | Hai ascoltato molta piÃ¹ musica del solito | You listened to much more music than usual |
| `event.volume_drop` | Hai ascoltato molta meno musica del solito | You listened to much less music than usual |
| `event.exploration` | Hai esplorato molti nuovi artisti | You explored many new artists |
| `event.silence` | Periodo di silenzio musicale | Period of musical silence |
| `memory.on_this_day` | {years} anni fa ascoltavi "{track}" di {artist} | {years} years ago you were listening to "{track}" by {artist} |
| `memory.first_time` | {years} anni fa scoprivi {artist} | {years} years ago you discovered {artist} |
| `memory.milestone.events` | Hai raggiunto {count} brani ascoltati! | You reached {count} tracks listened! |
| `memory.milestone.hours` | Hai raggiunto {count} ore di ascolto! | You reached {count} hours of listening! |
| `memory.return` | Non ascoltavi {artist} da {months} mesi | You hadn't listened to {artist} for {months} months |
| `memory.seasonal` | Come ogni {month}, Ã¨ tornato il periodo {genre} | Like every {month}, the {genre} period is back |

## 3. Pluralizzazione

Formato: `{count, plural, one {...} other {...}}`

Esempio:
    import.info.events = {count, plural,
      one {1 evento}
      other {{count} eventi}
    }

## 4. Variabili template

Sintassi: `{variableName}`

Variabili comuni: `{count}`, `{name}`, `{track}`, `{artist}`, `{years}`, `{months}`, `{days}`, `{platform}`, `{query}`, `{start}`, `{end}`, `{label}`.

## 5. Formattazione numeri/date

| Tipo | IT | EN |
|------|----|----|
| Migliaia | `1.000` | `1,000` |
| Decimali | `0,5` | `0.5` |
| Data breve | `15 gen 2024` | `Jan 15, 2024` |
| Data lunga | `15 gennaio 2024` | `January 15, 2024` |
| Ora | `14:30` | `2:30 PM` |

## 6. Linee guida tono

- **Conciso**: max 60 caratteri per label bottone
- **Umano**: evita linguaggio tecnico ("Parsing" â†’ "Sto analizzando")
- **Attivo**: "Hai ascoltato" non "Sono stati ascoltati"
- **Empatico**: per insight emotivi, tono narrativo ("Il tuo marzo 2020 Ã¨ stato...")
- **Discreto**: per errori, tono neutro e orientato alla soluzione

## 7. Implementazione

Struttura file:

    apps/web/
    â””â”€â”€ src/
        â””â”€â”€ i18n/
            â”œâ”€â”€ index.ts          # init i18next
            â”œâ”€â”€ locales/
            â”‚   â”œâ”€â”€ it.json
            â”‚   â””â”€â”€ en.json
            â””â”€â”€ formatter.ts      # numeri/date localizzati

Libreria consigliata: `i18next` + `react-i18next`.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 5 | Prima versione completa |

===== FILE: docs/10-TESTING.md =====

# 10 â€” Strategia di Testing

> Status: ðŸŸ¡ DRAFT Â· Versione 0.1 Â· Sessione 3

---

## 1. Piramide di testing

    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚  E2E (Playwright)       â”‚  ~5% dei test
    â”‚  Flussi utente critici  â”‚
    â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
    â”‚  Integration            â”‚  ~25%
    â”‚  Adapter+DB, analysis+DBâ”‚
    â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
    â”‚  Unit (Vitest)          â”‚  ~70%
    â”‚  Funzioni, algoritmi    â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

## 2. Target coverage per modulo

| Modulo | Coverage target | Note |
|--------|-----------------|------|
| `packages/core/adapters/*` | â‰¥ 90% | Ogni edge case E.N.x coperto |
| `packages/core/analysis/*` | â‰¥ 85% | Property-based + fixture |
| `packages/core/db/*` | â‰¥ 80% | Migrazioni testate |
| `packages/core/enrichment/*` | â‰¥ 75% | Mock API esterne |
| `packages/ui/components` | â‰¥ 70% | Snapshot + interaction |
| `apps/web` | â‰¥ 60% | E2E su flussi critici |

## 3. Fixture strategy

### 3.1 Fixture sintetici (per adapter)

Ogni adapter ha un fixture in `fixtures/synthetic-history/<platform>-sample.json` con:
- â‰¥ 10 eventi rappresentativi
- Almeno 1 caso per ogni edge case E.N.x documentato
- Campo `_case` che descrive lo scenario
- Campo `_expectedOutput` con valori attesi

Il primo fixture Ã¨ `spotify-sample.json` (Sessione 2).

### 3.2 Fixture di test DB

`fixtures/db-seed/` contiene:
- `minimal.json` â€” 10 eventi, 5 track, 2 artisti (per test unit)
- `medium.json` â€” 5.000 eventi, 500 track (per test integrazione)
- `large.json` â€” 100.000 eventi, 5.000 track (per test performance)

Tutti generati sinteticamente con script `scripts/generate-fixtures.ts`.

### 3.3 Fixture di scenari di vita

`fixtures/scenarios/` contiene cronologie complete pre-costruite che rappresentano scenari specifici:
- `lockdown-2020.json` â€” esplosione Lo-fi, ascolti notturni
- `breakup-oct2021.json` â€” crollo valence, spike Adele
- `summer-roadtrip.json` â€” alta valence, country multipli

Ogni scenario ha `_expectedInsights` con gli insight attesi dopo l'analisi.

## 4. Tipi di test per categoria

### 4.1 Adapter

- **Unit**: mapping campi, derivazioni (skipped, startedAt), dedup, normalizzazione
- **Integration**: import di fixture â†’ DB popolato correttamente
- **Property**: re-import Ã¨ idempotente (eventKey unico)
- **Edge case**: ogni E.N.x deve avere test dedicato

### 4.2 Analysis engine

- **Unit**: ogni algoritmo con input/output attesi
- **Property-based** (fast-check): invarianti (es. mood_day Ã¨ sempre uno dei 6 mood; valence in [0,1])
- **Scenario**: ogni `fixtures/scenarios/*.json` produce insight attesi

### 4.3 DB

- **Migrazioni**: ogni upgrade da v(n) a v(n+1) testato con dati pre-migrazione
- **Query**: indici usati correttamente (EXPLAIN)
- **Concurrency**: upsert paralleli non creano duplicati

### 4.4 UI

- **Snapshot**: componenti renderizzati correttamente
- **Interaction**: click, drag&drop, form funzionano
- **E2E**: flussi completi (onboarding â†’ home â†’ timeline â†’ ricordo)

## 5. Comandi

    pnpm test                # tutti i test
    pnpm test:unit           # solo unit
    pnpm test:integration    # solo integration
    pnpm test:e2e            # solo e2e (Playwright)
    pnpm test:coverage       # con report coverage
    pnpm test:watch          # modalitÃ  watch

## 6. CI gating

La CI GitHub Actions deve:
- [ ] Eseguire `pnpm run lint` su ogni PR
- [ ] Eseguire `pnpm test:unit` e `pnpm test:integration`
- [ ] Rifiutare PR con coverage sotto target per modulo
- [ ] Eseguire `pnpm test:e2e` su main (non su ogni PR, troppo lento)
- [ ] Buildare `apps/web` e verificare nessun errore TypeScript

## 7. Test di proprietÃ  per analisi (property-based)

Invarianti che devono SEMPRE valere:

| Invariante | Modulo |
|------------|--------|
| `valence âˆˆ [0, 1]` per ogni audio feature | enrichment |
| `mood âˆˆ {sad, angry, neutral, calm, happy, excited}` | analysis |
| `sum(genreDistribution) â‰ˆ 1.0` per era | analysis |
| `era.periodStart < era.periodEnd` | analysis |
| `insight.derivedVersion` == versione attuale dell'algoritmo | analysis |
| `session.eventCount >= 1` | analysis |
| `listen_events.eventKey` Ã¨ unico nel DB | db |
| `tracks.canonicalKey` Ã¨ unico nel DB | db |

## 8. Mock delle API esterne

- **MusicBrainz**: mock con risposte predefinite da `fixtures/api-mocks/musicbrainz/`
- **FreqBlog / Musicae**: mock con fixture di audio features
- **Last.fm / ListenBrainz**: mock API per test adapter

Mai chiamate reali in CI.

## 9. Test di regressione

Ogni bug fixato deve avere un test di regressione. Il test va aggiunto al fixture sintetico dell'adapter o allo scenario appropriato.

## 10. Come aggiungere un test

1. Identifica il modulo e il tipo (unit/integration/e2e)
2. Aggiungi il caso al fixture appropriato o creane uno nuovo
3. Scrivi il test con `describe` + `it` e asserzioni chiare
4. Verifica coverage: `pnpm test:coverage`
5. Aggiorna `docs/11-BACKLOG.md` acceptance criteria se pertinente

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 3 | Prima versione |

===== FILE: docs/11-BACKLOG.md =====

# 11 â€” Backlog Strutturato

> Status: ðŸŸ¡ DRAFT Â· Versione 0.1 Â· Sessione 3
> Formato: Epic â†’ Story â†’ Task con acceptance criteria verificabili

---

## Legenda

| Simbolo | Significato |
|---------|-------------|
| `[PHASE-N]` | Fase della roadmap (0=fondamenta, 1=import core, 2=analisi, 3=UI, 4=beta) |
| `[AREA:X]` | Modulo: `adapter`, `analysis`, `ui`, `ux`, `db`, `enrichment`, `privacy`, `devops` |
| `[PRI:B]` / `[PRI:I]` / `[PRI:L]` | PrioritÃ : blocker / important / later |
| `[DEP:#]` | Dipende dalla story # |
| `[SIZE:S/M/L/XL]` | Stima relativa |

## Stato di una Story

- â¬š TODO â€” non iniziata
- ðŸŸ¡ IN PROGRESS â€” in lavorazione
- âœ… DONE â€” completata e verificata
- ðŸ›‘ BLOCKED â€” dipende da altro o da spec mancante

---

## EPIC 0 â€” Fondamenta (Fase 0 tecnica)

Obiettivo: monorepo funzionante, schema DB live, primo adapter end-to-end.

### Story 0.1 â€” Setup monorepo e toolchain `[PHASE-0]` `[AREA:devops]` `[PRI:B]` `[SIZE:L]`

**Descrizione**: Inizializzare il monorepo Turborepo con le cartelle `apps/web`, `packages/core`, `packages/ui`, toolchain TypeScript, lint, format.

**Task**:
- T0.1.1 â€” Init monorepo con pnpm workspaces + Turborepo
- T0.1.2 â€” Config TypeScript base + path aliases
- T0.1.3 â€” ESLint + Prettier + commit hook (husky + lint-staged)
- T0.1.4 â€” Vitest + Playwright setup
- T0.1.5 â€” `pnpm run lint`, `pnpm run test`, `pnpm run build` funzionanti

**Acceptance criteria**:
- [ ] `pnpm install` senza errori su node 20 LTS
- [ ] `pnpm run lint` passa su codebase vuoto
- [ ] `pnpm run test` esegue almeno un test dummy
- [ ] `pnpm run build` produce artefatti
- [ ] CI GitHub Actions: lint + test su ogni PR

**Dipendenze**: nessuna
**Spec**: `05-ARCHITECTURE.md` Â§8-9

---

### Story 0.2 â€” Schema DB e layer Dexie `[PHASE-0]` `[AREA:db]` `[PRI:B]` `[SIZE:L]` `[DEP:0.1]`

**Descrizione**: Implementare lo schema Dexie come definito in `02-DATA-SCHEMA.md` Â§6, con migrazioni e API di accesso.

**Task**:
- T0.2.1 â€” Interfacce TypeScript in `packages/core/schema/`
- T0.2.2 â€” Class Dexie con `db.version(1).stores(...)`
- T0.2.3 â€” Repository: `listens`, `tracks`, `artists`, `albums`, `features` (CRUD + query base)
- T0.2.4 â€” Funzione `recount()` per contatori denormalizzati
- T0.2.5 â€” Test con DB in-memory (fake-indexeddb)

**Acceptance criteria**:
- [ ] Tutte le tabelle di `02-DATA-SCHEMA.md` Â§6 esistono
- [ ] Indici corrispondono alla spec
- [ ] `recount()` ricalcola `listenCount` correttamente
- [ ] Test unitari: â‰¥80% coverage su `packages/core/db/`
- [ ] Test con 10.000 ListenEvent in < 500ms

**Dipendenze**: Story 0.1
**Spec**: `02-DATA-SCHEMA.md` Â§3, Â§6, Â§7

---

### Story 0.3 â€” Adapter Spotify base `[PHASE-0]` `[AREA:adapter]` `[PRI:B]` `[SIZE:L]` `[DEP:0.2]`

**Descrizione**: Implementare l'adapter Spotify completo secondo `03-ADAPTERS/spotify.md`.

**Task**:
- T0.3.1 â€” `SpotifyAdapter.detect()` (riconoscimento ZIP/JSON)
- T0.3.2 â€” `SpotifyAdapter.parse()` streaming su JSON (AsyncIterable)
- T0.3.3 â€” Mapping campi Â§3.1 con regola `skipped` derivata (E1)
- T0.3.4 â€” Gestione `offline_timestamp` unitÃ  (E3)
- T0.3.5 â€” Upsert con dedup via `eventKey` e `canonicalKey` (DEDUP-3)
- T0.3.6 â€” Processamento `YourLibrary.json`, `Playlist*.json`, `Follow.json`
- T0.3.7 â€” Segnalazione UI via codici i18n (Â§9)

**Acceptance criteria**:
- [ ] Tutti i 10 casi di `fixtures/synthetic-history/spotify-sample.json` passano
- [ ] Re-import stesso file â†’ `eventsDuplicated = N`, nessun raddoppio
- [ ] Import di file reale (â‰¥50k eventi) in < 30s, memoria < 500MB
- [ ] `CarDetectionEvent.json` rifiutato senza opt-in esplicito
- [ ] `ip_addr` conservato solo se `PrivacySettings.retainIp === true`

**Dipendenze**: Story 0.2
**Spec**: `03-ADAPTERS/spotify.md`, `01-PLATFORMS.md` Â§3.1

---

### Story 0.4 â€” UI import (onboarding) `[PHASE-0]` `[AREA:ui]` `[PRI:B]` `[SIZE:M]` `[DEP:0.3]`

**Descrizione**: Schermate â‘  Benvenuto â†’ â‘¡ Privacy â†’ â‘¢ Import â†’ â‘£ Processing.

**Task**:
- T0.4.1 â€” Componente `DropZone` + `PlatformCard` (4 stati: vuoto/processing/done/error)
- T0.4.2 â€” Schermata Benvenuto + Privacy
- T0.4.3 â€” Schermata Import con validazione file
- T0.4.4 â€” Schermata Processing con progress e counter live
- T0.4.5 â€” Integrazione con `SpotifyAdapter`

**Acceptance criteria**:
- [ ] Drag&drop ZIP Spotify â†’ import completato con messaggio Â§9
- [ ] File errato â†’ errore umano "Questo file sembra di Apple Music, non di Spotify"
- [ ] Privacy screen mostra i 3 toggle (`retainIp`, `enrichMetadata`, `scrobbleHubs`)
- [ ] Nessun dato persistito prima del click "Importa tutto"
- [ ] Design system rispettato (colori, typo, componenti `15-DESIGN-SYSTEM.md`)

**Dipendenze**: Story 0.3
**Spec**: `15-DESIGN-SYSTEM.md`, mockup schermate â‘ -â‘£

---

## EPIC 1 â€” Import core (Fase 1)

### Story 1.1 â€” Adapter YouTube Music `[PHASE-1]` `[AREA:adapter]` `[PRI:I]` `[SIZE:M]` `[DEP:0.3]`

**Descrizione**: Import da Google Takeout (formato JSON/HTML).

**Acceptance criteria**:
- [ ] Filtro video/musica funzionante (campo `products`)
- [ ] Gestione cronologia unificata
- [ ] Test con fixture `youtube-sample.json`

**Spec**: `01-PLATFORMS.md` Â§3.2 (da scrivere in dettaglio post-Sessione 3)

---

### Story 1.2 â€” Adapter Apple Music `[PHASE-1]` `[AREA:adapter]` `[PRI:I]` `[SIZE:M]` `[DEP:0.3]`

**Descrizione**: Import CSV da Apple Privacy Portal.

**Acceptance criteria**:
- [ ] Parsing CSV robusto (PapaParse)
- [ ] Mapping campi Â§3.1 Apple
- [ ] Test con fixture

**Spec**: `01-PLATFORMS.md` Â§3.3

---

### Story 1.3 â€” Adapter Last.fm + ListenBrainz `[PHASE-1]` `[AREA:adapter]` `[PRI:I]` `[SIZE:M]` `[DEP:0.3]`

**Descrizione**: Import storico via API (paginazione completa).

**Acceptance criteria**:
- [ ] Paginazione su tutto lo storico
- [ ] Rate limit rispettato (5 req/s per Last.fm)
- [ ] MBID da ListenBrainz alimenta DEDUP-2
- [ ] Test con mock API

**Spec**: `01-PLATFORMS.md` Â§3.7-3.8

---

### Story 1.4 â€” Dedup promozione post-enrichment `[PHASE-1]` `[AREA:db]` `[PRI:I]` `[SIZE:S]` `[DEP:0.3]`

**Descrizione**: Job `rekey()` che, quando un track acquisisce ISRC/MBID via enrichment, aggiorna il `canonicalKey` da `fuzzy:...` a `isrc:...` o `mbid:...`, unendo duplicati.

**Acceptance criteria**:
- [ ] Due track con `fuzzy:` diverso ma stesso ISRC â†’ una sola track dopo `rekey()`
- [ ] `listenCount` aggregato correttamente
- [ ] `listen_events.trackId` riorientato

**Spec**: `02-DATA-SCHEMA.md` Â§5-6

---

## EPIC 2 â€” Analisi (Fase 2)

### Story 2.1 â€” Mood Tracker giornaliero `[PHASE-2]` `[AREA:analysis]` `[PRI:B]` `[SIZE:M]` `[DEP:0.2]`

**Acceptance criteria**:
- [ ] Formula specificata in `04-ANALYSIS-ALGORITHMS.md` (da scrivere Sessione 4)
- [ ] Insight tipo `mood_day` persistito con `derivedVersion`
- [ ] Test su fixture con scenario noto

---

### Story 2.2 â€” Era Detector `[PHASE-2]` `[AREA:analysis]` `[PRI:I]` `[SIZE:L]` `[DEP:2.1]`

**Acceptance criteria**:
- [ ] Clustering (k-means o DBSCAN) con parametri documentati
- [ ] EraPayload completo per ogni era
- [ ] Test: 1 anno con 2 ere evidenti â†’ rilevate correttamente

---

### Story 2.3 â€” Event Detector `[PHASE-2]` `[AREA:analysis]` `[PRI:I]` `[SIZE:L]` `[DEP:2.1]`

**Acceptance criteria**:
- [ ] Rileva spike/crolli volume, valence drop/rise, exploration, silence
- [ ] Z-score o IQR con finestra documentata
- [ ] Falsi positivi < 10% su fixture di test

---

### Story 2.4 â€” Memory Engine `[PHASE-2]` `[AREA:analysis]` `[PRI:B]` `[SIZE:M]` `[DEP:0.2]`

**Acceptance criteria**:
- [ ] 5 tipi di ricordo (on_this_day, first_time, milestone, return, seasonal)
- [ ] Trigger documentati in `04-ANALYSIS-ALGORITHMS.md`
- [ ] Feed ricordi ordinato per rilevanza

---

## EPIC 3 â€” UI/UX (Fase 3)

### Story 3.1 â€” Home + Timeline `[PHASE-3]` `[AREA:ui]` `[PRI:B]` `[SIZE:XL]`

**Acceptance criteria**:
- [ ] Schermata â‘¥ Home con StatCard animate, ricordo del giorno, bar week
- [ ] Schermata â‘¦ Timeline con EraBands, StreamChart, MoodLine sincronizzati
- [ ] Zoom progressivo anni â†’ mesi â†’ giorni
- [ ] Responsive breakpoint rispettati

---

### Story 3.2 â€” Ricordi + Share `[PHASE-3]` `[AREA:ui]` `[PRI:I]` `[SIZE:L]`

**Acceptance criteria**:
- [ ] Feed ricordi mobile (schermata â‘ª)
- [ ] ShareSheet con card 1080Ã—1350 generata via canvas
- [ ] Condivisione nativa + download immagine

---

### Story 3.3 â€” Esplora + Analisi `[PHASE-3]` `[AREA:ui]` `[PRI:I]` `[SIZE:L]`

**Acceptance criteria**:
- [ ] Schermata â‘¨ con search autocomplete sui propri dati
- [ ] Schermata â‘© QuadrantChart valence/energy
- [ ] Click su punto â†’ deep-link timeline

---

## EPIC 4 â€” Arricchimento (Fase 2/3)

### Story 4.1 â€” Pipeline audio features `[PHASE-2]` `[AREA:enrichment]` `[PRI:I]` `[SIZE:L]`

**Acceptance criteria**:
- [ ] Cascata: cache â†’ AcousticBrainz â†’ API FreqBlog/Musicae â†’ Essentia.js
- [ ] Toggle privacy `enrichMetadata` rispettato
- [ ] Rate limiting API esterne
- [ ] `AudioFeatures.source` tracciato

---

### Story 4.2 â€” MusicBrainz lookup `[PHASE-2]` `[AREA:enrichment]` `[PRI:I]` `[SIZE:M]`

**Acceptance criteria**:
- [ ] Lookup per track name + artist
- [ ] Cache locale MBID
- [ ] Rispetto rate limit MB (1 req/s)

---

## EPIC 5 â€” Privacy e legale (Fase 6)

### Story 5.1 â€” Privacy spec finale `[PHASE-6]` `[AREA:privacy]` `[PRI:B]`

**Acceptance criteria**:
- [ ] `09-PRIVACY-SECURITY.md` APPROVED
- [ ] Data flow diagram
- [ ] Bozza privacy policy GDPR-compliant

---

### Story 5.2 â€” Export e purge `[PHASE-6]` `[AREA:privacy]` `[PRI:B]`

**Acceptance criteria**:
- [ ] `purgeIp()` cancella tutti gli IP
- [ ] Export JSON completo (portabilitÃ  GDPR)
- [ ] Cancellazione totale con doppia conferma

---

## PrioritÃ  di lavorazione per agenti

Quando un agente arriva sul repo, deve lavorare le story in questo ordine:

1. **0.1** Setup monorepo
2. **0.2** Schema DB
3. **0.3** Adapter Spotify
4. **0.4** UI import
5. **1.1, 1.2, 1.3** in parallelo (altri adapter)
6. **1.4** Dedup promozione
7. **2.1, 2.4** analisi base
8. **2.2, 2.3** analisi avanzata
9. **4.1, 4.2** enrichment
10. **3.1, 3.2, 3.3** UI
11. **5.1, 5.2** privacy

Ogni story deve avere label GitHub:
- `phase-0`/`phase-1`/`phase-2`/`phase-3`/`phase-6`
- `area:adapter` / `area:db` / `area:ui` / `area:analysis` / `area:enrichment` / `area:privacy`
- `priority:blocker` / `priority:important`
- `size:S` / `size:M` / `size:L` / `size:XL`
- `agent-ready` (solo quando la spec collegata Ã¨ ðŸŸ¢ APPROVED)

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 3 | Prima versione con 5 epic e 17 story |

===== FILE: docs/13-ADR/0001-pwa-first.md =====

# ADR-0001 â€” PWA come piattaforma primaria

> Status: ðŸŸ¡ DRAFT (approvazione Boss pending) Â· Sessione 1

## Contesto

Il prodotto deve raggiungere utenti desktop e mobile con un team di sviluppo piccolo (umano + agenti). Le opzioni: app native separate, desktop-first (Electron/Tauri), web-first (PWA).

## Decisione

**PWA (Progressive Web App) come piattaforma primaria e unica del MVP.** Desktop Tauri e wrapper mobile nativo rinviati a Fase 2 come estensioni opzionali.

## Motivazioni

- Un solo codebase per tutti i form factor
- Nessun app store: distribuzione diretta, aggiornamenti immediati, zero commissioni
- Local-first realizzabile con IndexedDB + Service Worker
- Installabile su desktop e home mobile
- Coerente con privacy-first: nessun intermediario

## Alternative considerate

- **Native mobile first**: scartata per costo doppio e frizione app store in fase di validazione
- **Electron desktop first**: scartata per peso e per target non solo desktop
- **Desktop Tauri first**: rinviata; resta opzione Fase 2 per utenti power (file system, Plex locale)

## Conseguenze

- Positive: velocitÃ  di sviluppo, manutenzione singola, privacy
- Negative: push notification e integrazione OS limitate nel MVP; File System Access API non uniforme tra browser
- Mitigazioni: fallback drag&drop per upload file; Tauri in Fase 2 per i casi power-user

## Collegamenti

- 05-ARCHITECTURE Â§8 Â· 00-VISION Â§Perimetro MVP

===== FILE: docs/13-ADR/0002-local-first.md =====

# ADR-0002 â€” Local-first e privacy-by-design

> Status: ðŸŸ¡ DRAFT (approvazione Boss pending) Â· Sessione 1

## Contesto

Il progetto tratta dati altamente personali (cronologia di ascolto, contesto, inferenze emotive). Il target europeo Ã¨ sensibile al GDPR. Ogni architettura cloud-first introdurrebbe obblighi legali, costi e rischi di trust.

## Decisione

**Tutti i dati personali risiedono nel browser dell'utente (IndexedDB).** Nessuna autenticazione obbligatoria. Nessuna telemetria. Le uniche comunicazioni di rete possibili sono: (1) arricchimento metadati brani, disattivabile; (2) hub di scrobbling scelti dall'utente; (3) sync cloud opzionale E2E in Fase 2.

## Motivazioni

- La privacy Ã¨ il differenziale competitivo, non un vincolo
- Zero costi di infrastruttura nel MVP
- Compliance GDPR semplificata: nessun trattamento server-side di PII
- ReversibilitÃ  totale: export e cancellazione sono operazioni locali

## Alternative considerate

- **Cloud-first con account**: scartata (costi legali, trust, lock-in)
- **Self-hosted server obbligatorio**: scartata per frizione; resta opzione Docker documentata

## Conseguenze

- Positive: trust, costi, semplicitÃ  legale
- Negative: nessun cross-device nel MVP; elaborazione limitata alle risorse del browser
- Mitigazioni: Web Worker e streaming parse per file grandi; sync E2E opzionale in Fase 2
- **IP address**: non persistito di default; conservato SOLO con toggle esplicito `retainIp`; mai inviato in rete; purgabile con `purgeIp()`. Il `country` Ã¨ sempre derivato (privacy-by-design, vedi 09)

## Collegamenti

- 02-DATA-SCHEMA Â§8 Â· 09-PRIVACY-SECURITY (Sessione 6)

===== FILE: docs/13-ADR/0003-adapter-pattern.md =====

# ADR-0003 â€” Adapter pattern e normalizzazione early

> Status: ðŸŸ¡ DRAFT (approvazione Boss pending) Â· Sessione 1

## Contesto

Otto+ sorgenti eterogenee (formati, campi, semantica temporale, edge case). Serviva una strategia per non far degenerare il core in logica per-platform.

## Decisione

**Ogni piattaforma Ã¨ un adapter indipendente** che implementa l'interfaccia `PlatformAdapter` (05-ARCHITECTURE Â§4) e produce esclusivamente il formato unificato (02-DATA-SCHEMA). La normalizzazione avviene al parse ("early"): il payload raw **non** Ã¨ persistito nel DB.

## Motivazioni

- Aggiungere una piattaforma = aggiungere un modulo, senza toccare il core
- Analisi e UI lavorano su un solo schema
- TestabilitÃ : ogni adapter Ã¨ testabile isolato con fixture
- Spazio: persistere il raw di 200k eventi raddoppierebbe il DB locale

## Alternative considerate

- **Silos per-platform**: scartata (analisi cross-platform impossibili)
- **ETL server-side**: scartata (contraria ad ADR-0002)
- **Persistenza del raw nel DB**: scartata per spazio; il file dell'utente resta fonte di veritÃ  e l'import Ã¨ ri-eseguibile (idempotenza via eventKey)

## Conseguenze

- Positive: core pulito, estensibilitÃ , test semplici
- Negative: perdita di campi platform-specific non mappati; debugging di parse errori richiede il file originale
- Mitigazioni: `ImportRecord.warnings` cataloga gli edge case (E1..E10); log di import conservato; campi futuri aggiungibili con migrazioni

## Collegamenti

- 01-PLATFORMS Â§5 Â· 02-DATA-SCHEMA Â§6-7 Â· 05-ARCHITECTURE Â§4

===== FILE: docs/14-GLOSSARY.md =====

# 14 â€” Glossario di Dominio

> Status: ðŸŸ¡ DRAFT Â· Versione 0.1 Â· Sessione 1
> Definizioni univoche. In caso di conflitto tra un documento e questo glossario, vale questo glossario (finchÃ© non viene aggiornato).

## Termini di dominio

| Termine | Definizione |
|---------|-------------|
| **Listen Event** | Un singolo evento di ascolto: brano, istante, durata, contesto. Atomo del sistema (`ListenEvent`) |
| **Scrobble** | La registrazione automatica di un ascolto verso un hub esterno (Last.fm, ListenBrainz, Maloja) |
| **Sessione di ascolto** | Sequenza continua di listen event separati da pause inferiori al gap threshold (default 30 min) |
| **Era musicale** | Periodo prolungato (settimane/mesi) con caratteristiche musicali ed emotive coerenti, rilevato per clustering |
| **Mood** | Stato emotivo prevalente di un periodo, derivato da valence/energy. Valori: sad, angry, neutral, calm, happy, excited |
| **Ricordo (Memory)** | Insight di tipo memoriale: on_this_day, first_time, milestone, return, seasonal |
| **Evento (Event)** | Anomalia rilevata nei pattern di ascolto che suggerisce un cambiamento significativo (picco, crollo, esplorazione, silenzio) |
| **Insight** | Risultato derivato dell'analysis engine, persistito con verdetto utente (pending/confirmed/corrected/dismissed) |
| **Valence** | Punteggio 0..1 di positivitÃ  emotiva percepita del brano |
| **Energy** | Punteggio 0..1 di intensitÃ /attivazione del brano |
| **Danceability** | Punteggio 0..1 di attitudine al ballo del brano |

## Identificatori

| Termine | Definizione |
|---------|-------------|
| **ISRC** | International Standard Recording Code: identificativo univoco di una *registrazione* (12 caratteri) |
| **MBID** | MusicBrainz Identifier: UUID di un'entitÃ  MusicBrainz (recording, artist, release) |
| **UPC** | Codice univoco di un *prodotto* (album/release) |
| **canonicalKey** | Chiave di deduplicazione traccia: ISRC â†’ MBID â†’ fuzzy hash (regole DEDUP) |
| **eventKey** | Chiave di idempotenza di un listen event (platform + sourceEventId o hash) |
| **platformIds** | Mappa degli identificatori originali dello stesso brano sulle varie piattaforme |

## Architettura

| Termine | Definizione |
|---------|-------------|
| **Adapter** | Modulo che converte il formato di una piattaforma nel formato unificato |
| **Formato unificato** | Schema di `ListenEvent` e entitÃ  collegate (02-DATA-SCHEMA) |
| **Local-first** | I dati vivono sul dispositivo; il cloud Ã¨ opzionale e aggiuntivo |
| **Privacy-first** | Nessuna PII esce dal dispositivo senza toggle esplicito dell'utente |
| **derivedVersion** | Hash del set di parametri che ha generato sessioni/insight; abilita ricalcolo coerente |
| **Fixture** | Dataset sintetico di test in `fixtures/synthetic-history/` |
| **ADR** | Architecture Decision Record: decisione architetturale registrata in `docs/13-ADR/` |

## Processo

| Termine | Definizione |
|---------|-------------|
| **agent-ready** | Label di issue la cui specifica Ã¨ APPROVED: un agente puÃ² lavorarci |
| **needs-spec** | Label di issue bloccata in attesa di specifica |
| **APPROVED / DRAFT** | Stato di un documento: vincolante per gli agenti / in discussione |
| **Boss** | Project owner (@amedeo82), unica autoritÃ  di approvazione |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 1 | Prima versione |

===== FILE: docs/15-DESIGN-SYSTEM.md =====

# 15 â€” Design System

> Status: ðŸŸ¡ DRAFT
> Versione: 0.1
> Ultima modifica: Sessione 0 (consolidamento)
> Asset collegati: `design/mockups/` (14 schermate), `design/tokens.json` (Sessione 7)

---

## 1. IdentitÃ  del brand

### 1.1 Concept del logo

Un'**onda sonora che si distende in linea del tempo**: a sinistra la forma d'onda vibrante (la musica), a destra una linea orizzontale stabile (la vita). Metafora del prodotto: *la musica che diventa storia*.

Varianti: primaria gradiente Â· monocroma viola Â· neutra grigia Â· bianca Â· wordmark "LIFE SOUNDTRACK".

### 1.2 Tagline

> *"La colonna sonora della tua vita, finalmente leggibile."*

## 2. Palette

### 2.1 Base (dark-first, default)

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-base` | `#0A0E1A` | Sfondo principale |
| `bg-surface` | `#131829` | Card e pannelli |
| `bg-elevated` | `#1A2138` | Hover, modali |
| `border-subtle` | `rgba(139,92,246,0.25)` | Bordi card |
| `text-primary` | `#FFFFFF` | Titoli, numeri |
| `text-secondary` | `#94A3B8` | Sottotitoli |
| `text-muted` | `#64748B` | Meta-info |

### 2.2 Gradiente brand

`#8B5CF6` (violet) â†’ `#EC4899` (magenta) â†’ `#F59E0B` (amber)
Usi: logo, CTA primarie, elementi attivi, highlight.

### 2.3 Palette mood (semantica, vincolante)

| Mood | Hex | Posizione valence/energy |
|------|-----|--------------------------|
| ðŸ˜¢ Triste | `#3B82F6` | valence bassa, energy bassa |
| ðŸ˜¤ Arrabbiato | `#EF4444` | valence bassa, energy alta |
| ðŸ˜ Neutro | `#8B5CF6` | valence media |
| ðŸ§˜ Calmo | `#10B981` | valence media, energy bassa |
| ðŸ˜Š Felice | `#F59E0B` | valence alta, energy media |
| ðŸŽ‰ Eccitato | `#EC4899` | valence alta, energy alta |

**Regola**: ogni visualizzazione di mood usa questa palette. Ogni mood ha sempre emoji + label testuale (mai solo colore).

### 2.4 Colori piattaforma (schermate import/settings)

Spotify `#1DB954` Â· YouTube `#FF0000` Â· Apple Music `#FA243C` Â· Deezer `#A238FF` Â· Tidal `#00FFFF` Â· Last.fm `#D51007` Â· ListenBrainz `#EB7431`

âš ï¸ Nota legale: nell'UI usare **riferimenti nominativi testuali o icone proprie**, non i loghi ufficiali (trademark). Da verificare in Sessione 6.

## 3. Tipografia

| Uso | Font | Peso |
|-----|------|------|
| Titoli, numeri grandi | Inter Tight | 700-800 (tabular figures) |
| Corpo, UI | Inter | 400-600 |
| Dati tecnici (URI, timestamp, IP) | JetBrains Mono | 400 |

Scala: Display 48-64 Â· H1 32 Â· H2 24 Â· H3 20 Â· Body 16 Â· Small 14 Â· Caption 12.
Licenze: Inter e JetBrains Mono sono SIL OFL â†’ ok per uso commerciale. Documentare in Sessione 6.

## 4. Principi stilistici

1. **Dark-first**: il dark non Ã¨ un'opzione, Ã¨ l'identitÃ  (light mode come opzione secondaria)
2. **Glow, non ombre**: bagliori colorati sugli elementi attivi, come luci di un palco
3. **Glassmorphism moderato**: card semi-trasparenti, blur leggero, bordi gradiente sottili
4. **Angoli generosi**: 16px card desktop Â· 20px card mobile Â· full-round per pill e bottoni
5. **Spazio respirante**: padding 24-32px; una sola visualizzazione "eroe" per viewport
6. **Il colore codifica dati**: i gradienti non sono decorazione, raccontano mood/energia/periodo

## 5. Inventario componenti

| Componente | Uso |
|------------|-----|
| StatCard | Numeri grandi + label + icona (Home) |
| MemoryCard | Ricordo con artwork, titolo, mood pill, azioni |
| EraBand | Segmento colorato di era musicale (Timeline) |
| MoodPill | Pill colorata con nome mood |
| GradientButton / GhostButton | CTA primaria / secondaria |
| PlatformCard | Piattaforma con stato import (vuoto/processing/done/error) |
| DropZone | Area drag&drop file |
| StreamChart / MoodLine / QuadrantChart / BarWeek | Visualizzazioni |
| InsightCard | Narrazione in linguaggio naturale con icona lampadina |
| NavBar (desktop) / TabBar (mobile) | Navigazione |
| ShareSheet | Condivisione ricordo con card generata |

Spec dettagliate per componente (props, stati, a11y) â†’ Sessione 7 (`07-UI-SPEC.md`).

## 6. Principi UX

1. **Privacy come feature**: il messaggio "i tuoi dati restano sul tuo dispositivo" appare in ogni punto di contatto coi dati
2. **Progressive disclosure**: prima l'emozione (ricordi, mood), poi i dati, poi i dettagli tecnici
3. **Narrazione prima dei numeri**: ogni insight Ã¨ una frase in linguaggio naturale; i numeri sono supporto
4. **L'utente ha l'ultima parola**: le inferenze (eventi, mood) sono ipotesi confermabili/correggibili/ignorabili
5. **Zero frizione nell'import**: drag&drop ovunque, validazione immediata, errori con messaggi umani

## 7. Flussi principali (sintesi)

- **Onboarding**: Benvenuto â†’ Privacy â†’ Import â†’ Processing â†’ Prima Rivelazione Timeline (momento wow, una sola volta)
- **Loop quotidiano**: Home (stat + ricordo del giorno + settimana) â†’ Timeline â†’ Era â†’ Esplora/Analisi
- **Ricordi**: feed mobile â†’ Rivivi (deep-link timeline) / Condividi (ShareSheet) / Salva
- **Controllo**: Settings (piattaforme, privacy toggle, export JSON, cancellazione totale)
- **Empty state**: ogni sezione ha illustrazione + CTA di uscita; mai pagine bianche

Tour completo delle 14 schermate con navigation map: `design/mockups/TOUR.md` (da creare in Sessione 5).

## 8. Micro-interazioni

| Interazione | Feedback |
|-------------|----------|
| Hover StatCard | Glow + count-up numeri |
| Click EraBand | Espansione smooth + dettaglio |
| Scroll Timeline | Ere si illuminano al passaggio |
| Import completato | Confetti sottili |
| Prima rivelazione | Ere si colorano in sequenza 2016â†’2026 |
| Long-press brano (mobile) | Menu contestuale |

Motion reduction rispettata (`prefers-reduced-motion`).

## 9. AccessibilitÃ 

- Contrasti â‰¥ 4.5:1 su sfondo scuro
- Mood sempre con emoji + testo (non solo colore)
- Navigazione da tastiera completa; focus visibile
- Alternative testuali per ogni grafico (screen reader)
- Touch target â‰¥ 44px su mobile

## 10. Responsive

| Breakpoint | Layout |
|------------|--------|
| < 768px | 1 colonna, TabBar bottom, card full-width, pinch-zoom sui grafici |
| 768-1024px | Sidebar a icone, grid 2 colonne |
| > 1024px | Sidebar completa, grid 3-4 colonne |
| > 1440px | Contenuto centrato max 1400px |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Consolidamento dalle sessioni esplorative |

===== FILE: fixtures/synthetic-history/spotify-sample.json =====

{
  "_comment": "Dataset sintetico per test adapter Spotify. Include edge case E1-E6. 10 eventi rappresentativi.",
  "_metadata": {
    "generatedFor": "Life-Soundtrack adapter testing",
    "version": "0.1",
    "session": 2
  },
  "events": [
    {
      "_case": "happy_path_normal_listen",
      "ts": "2024-03-15T20:30:00Z",
      "platform": "Android OS 13 (samsung, SM-S911B)",
      "ms_played": 245000,
      "conn_country": "IT",
      "ip_addr": "92.40.100.50",
      "master_metadata_track_name": "Bohemian Rhapsody",
      "master_metadata_album_artist_name": "Queen",
      "master_metadata_album_album_name": "A Night at the Opera",
      "spotify_track_uri": "spotify:track:4u7EnebtmKWzUH433cf5Qv",
      "reason_start": "playbtn",
      "reason_end": "trackdone",
      "shuffle": false,
      "skipped": false,
      "offline": false,
      "offline_timestamp": null,
      "incognito_mode": false
    },
    {
      "_case": "E1_skipped_unreliable_fwd_btn",
      "ts": "2020-06-10T14:15:30Z",
      "platform": "Windows 10 (10.0.19045; x64)",
      "ms_played": 12000,
      "conn_country": "IT",
      "ip_addr": "92.40.100.50",
      "master_metadata_track_name": "Radio Gaga",
      "master_metadata_album_artist_name": "Queen",
      "master_metadata_album_album_name": "The Works",
      "spotify_track_uri": "spotify:track:1TSZDcvlPtAnekTaItI3qO",
      "reason_start": "playbtn",
      "reason_end": "fwdbtn",
      "shuffle": true,
      "skipped": false,
      "offline": false,
      "offline_timestamp": null,
      "incognito_mode": false
    },
    {
      "_case": "E1_skipped_unreliable_endplay_short",
      "ts": "2019-11-05T08:22:15Z",
      "platform": "web_player windows 10; chrome 119",
      "ms_played": 25000,
      "conn_country": "DE",
      "ip_addr": "85.20.40.10",
      "master_metadata_track_name": "We Will Rock You",
      "master_metadata_album_artist_name": "Queen",
      "master_metadata_album_album_name": "News of the World",
      "spotify_track_uri": "spotify:track:2Oi33MRnQV4rxZU8HH9K7j",
      "reason_start": "playbtn",
      "reason_end": "endplay",
      "shuffle": true,
      "skipped": false,
      "offline": false,
      "offline_timestamp": null,
      "incognito_mode": false
    },
    {
      "_case": "E3_offline_timestamp_old_unit",
      "ts": "2021-07-10T16:21:33Z",
      "platform": "Android OS 7.0 API 24 (motorola, Moto G4)",
      "ms_played": 312800,
      "conn_country": "IT",
      "ip_addr": "92.40.100.50",
      "master_metadata_track_name": "Don't Stop Me Now",
      "master_metadata_album_artist_name": "Queen",
      "master_metadata_album_album_name": "Jazz",
      "spotify_track_uri": "spotify:track:5TgU7lW4wXjMQ7UgFJbN8p",
      "reason_start": "trackdone",
      "reason_end": "trackdone",
      "shuffle": false,
      "skipped": false,
      "offline": true,
      "offline_timestamp": 1625933120,
      "incognito_mode": false
    },
    {
      "_case": "E4_duplicate_uri_different_album",
      "ts": "2022-05-20T19:45:00Z",
      "platform": "iOS 16.4 (iPhone 13)",
      "ms_played": 354000,
      "conn_country": "IT",
      "ip_addr": "92.40.100.50",
      "master_metadata_track_name": "Bohemian Rhapsody",
      "master_metadata_album_artist_name": "Queen",
      "master_metadata_album_album_name": "Greatest Hits",
      "spotify_track_uri": "spotify:track:DIFFERENT_URI_1",
      "reason_start": "playbtn",
      "reason_end": "trackdone",
      "shuffle": false,
      "skipped": false,
      "offline": false,
      "offline_timestamp": null,
      "incognito_mode": false
    },
    {
      "_case": "E4_duplicate_uri_same_name_different_recording",
      "ts": "2022-05-20T20:00:00Z",
      "platform": "iOS 16.4 (iPhone 13)",
      "ms_played": 412000,
      "conn_country": "IT",
      "ip_addr": "92.40.100.50",
      "master_metadata_track_name": "Bohemian Rhapsody",
      "master_metadata_album_artist_name": "Queen",
      "master_metadata_album_album_name": "Live at Wembley",
      "spotify_track_uri": "spotify:track:DIFFERENT_URI_2",
      "reason_start": "playbtn",
      "reason_end": "trackdone",
      "shuffle": false,
      "skipped": false,
      "offline": false,
      "offline_timestamp": null,
      "incognito_mode": false
    },
    {
      "_case": "E5_platform_post_oct2023_generic",
      "ts": "2024-01-10T22:10:00Z",
      "platform": "android",
      "ms_played": 180000,
      "conn_country": "IT",
      "ip_addr": "92.40.100.50",
      "master_metadata_track_name": "Under Pressure",
      "master_metadata_album_artist_name": "Queen & David Bowie",
      "master_metadata_album_album_name": "Hot Space",
      "spotify_track_uri": "spotify:track:0z5UJ8cFtF7FqUjY8k9hFp",
      "reason_start": "playbtn",
      "reason_end": "trackdone",
      "shuffle": true,
      "skipped": false,
      "offline": false,
      "offline_timestamp": null,
      "incognito_mode": false
    },
    {
      "_case": "E5_platform_pre_oct2023_detailed",
      "ts": "2023-09-01T22:10:00Z",
      "platform": "Android OS 12 API 31 (google, Pixel 6)",
      "ms_played": 240000,
      "conn_country": "FR",
      "ip_addr": "78.195.10.20",
      "master_metadata_track_name": "Another One Bites the Dust",
      "master_metadata_album_artist_name": "Queen",
      "master_metadata_album_album_name": "The Game",
      "spotify_track_uri": "spotify:track:3KkXRkHbMCARz0aVfEt68P",
      "reason_start": "playbtn",
      "reason_end": "trackdone",
      "shuffle": false,
      "skipped": false,
      "offline": false,
      "offline_timestamp": null,
      "incognito_mode": false
    },
    {
      "_case": "E6_podcast_episode",
      "ts": "2024-02-14T07:30:00Z",
      "platform": "android",
      "ms_played": 1800000,
      "conn_country": "IT",
      "ip_addr": "92.40.100.50",
      "master_metadata_track_name": null,
      "master_metadata_album_artist_name": null,
      "master_metadata_album_album_name": null,
      "spotify_track_uri": null,
      "episode_name": "Episodio 42 - La storia del rock",
      "episode_show_name": "Rock & Talk",
      "spotify_episode_uri": "spotify:episode:abc123",
      "reason_start": "playbtn",
      "reason_end": "trackdone",
      "shuffle": false,
      "skipped": false,
      "offline": false,
      "offline_timestamp": null,
      "incognito_mode": false
    },
    {
      "_case": "incognito_mode",
      "ts": "2024-04-01T23:45:00Z",
      "platform": "windows",
      "ms_played": 200000,
      "conn_country": "IT",
      "ip_addr": "92.40.100.50",
      "master_metadata_track_name": "Guilty Pleasure Song",
      "master_metadata_album_artist_name": "Some Pop Artist",
      "master_metadata_album_album_name": "Guilty Pleasures",
      "spotify_track_uri": "spotify:track:guilty123",
      "reason_start": "playbtn",
      "reason_end": "trackdone",
      "shuffle": false,
      "skipped": false,
      "offline": false,
      "offline_timestamp": null,
      "incognito_mode": true
    }
  ],
  "_expectedOutput": {
    "totalEvents": 10,
    "musicEvents": 9,
    "podcastEvents": 1,
    "uniqueTracks": 8,
    "uniqueArtists": 3,
    "skippedDerived": 2,
    "offlineTimestampsConverted": 1,
    "incognitoCount": 1,
    "dedupApplied": 1
  }
}


