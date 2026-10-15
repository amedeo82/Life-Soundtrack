# BUNDLE CONTENUTO

> Generato automaticamente da scripts/generate-bundle.ps1
> Data: 2026-10-15 17:17
> Totale file: 21


===== FILE: AGENTS.md =====

# 🤖 AGENTS.md — Protocollo per Agenti di Sviluppo

> **Questo è il primo file che un agente deve leggere, prima di qualsiasi altro.**
> Versione 1.1 — Sessione 9 (post-audit, stabile)

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

**Il PAT va dato agli agenti di sviluppo** (Claude Code, Cursor, Copilot) con scope `contents: read/write` sul repo solo. L'AI di review non ha bisogno di PAT.

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
| Gate | `agent-ready`, `needs-spec`, `blocked` | Stato lavorabilità |
| Tipo | `bug`, `enhancement`, `refactor`, `docs` | Classificazione |

## 🌳 Git workflow

- Branch: `feat/<issue-number>-<descrizione>` o `fix/<issue-number>-<descrizione>`
- Commit: **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Branch `main` protetto: richiede PR e review
- Nessun force push su `main`
- Una PR = una issue (salvo eccezioni)

## 📝 Checklist di auto-revisione PR

- [ ] Ho letto `AGENTS.md` e i documenti linkati dal task
- [ ] Il codice rispetta lo schema dati (`02-DATA-SCHEMA.md`)
- [ ] Ho scritto test che coprono il caso felice e almeno 2 edge case
- [ ] Ho usato i fixture di `fixtures/synthetic-history/`
- [ ] JSDoc su tutte le funzioni pubbliche
- [ ] Nessun dato personale hardcoded, nessun log di PII
- [ ] `pnpm run lint` e `pnpm run test` passano in locale

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
    │   └── synthetic-history/
    └── scripts/                 ← utility (es. generate-bundle.ps1)

## 🚀 Primo task di un agente

1. Leggi questo file
2. Leggi `docs/INDEX.md` e `docs/11-BACKLOG.md`
3. Cerca la prima story ⬚ TODO con label `agent-ready`
4. Clona il repo, crea branch `feat/<issue>-<descrizione>`
5. Implementa con test
6. Apri PR

Se non ci sono issue `agent-ready`, apri issue con label `needs-spec`.

## 📞 Contatti

- Project owner: `@amedeo82`
- Per decisioni strategiche: aspetta review sulla PR
- Per questioni tecniche: usa le issue
- Per ambiguità di specifica: issue `needs-spec`

---

*Ultimo aggiornamento: Sessione 9 (2026-10-15) — allineamento post-audit*


===== FILE: README.md =====

# 🎵 Life Soundtrack

> *La colonna sonora della tua vita, finalmente leggibile.*

Life Soundtrack è un'applicazione web (PWA) che trasforma i metadati grezzi delle piattaforme di streaming musicale in un **diario di vita personale**: una timeline emotiva, contestuale e narrativa che racconta la storia dell'utente attraverso la musica che ha ascoltato.

## ✨ Cosa fa

- Importa la cronologia di ascolto da Spotify, YouTube Music, Apple Music, Deezer, Tidal, SoundCloud, Last.fm, ListenBrainz
- Arricchisce i dati con audio features (valence, energy, danceability, BPM)
- Ricostruisce la tua vita musicale in **ere**, **mood**, **eventi**, **ricordi**
- Ti permette di rivivere i periodi della tua vita attraverso la loro colonna sonora
- **Tutto resta sul tuo dispositivo**: elaborazione locale, privacy-first, GDPR-compliant

## 🏗️ Stato del progetto

Attualmente in **fase di progettazione** (docs/). Nessuna riga di codice ancora scritta.

- Documentazione: [`docs/INDEX.md`](docs/INDEX.md)
- Protocollo agenti: [`AGENTS.md`](AGENTS.md)
- Visione: [`docs/00-VISION.md`](docs/00-VISION.md)

## 🤝 Come contribuire

Questo progetto è attualmente gestito da un team umano + AI. Per iniziare a lavorare sul codice, leggi **`AGENTS.md`** come primo file.

## 📜 Licenza

[Apache-2.0](LICENSE) — vedi decisione D.A.10 dell'audit del 2026-10-15. Open-source puro, nessuna monetizzazione (D.A.9).

---

*Questo README è mantenuto aggiornato dal log delle sessioni in [`docs/SESSIONS.md`](docs/SESSIONS.md).*



===== FILE: docs/INDEX.md =====

# 📚 Indice della Documentazione

> Stato master del progetto. Aggiornato ad ogni sessione di progettazione.
> **Leggi questo file prima di qualsiasi altro per avere una panoramica.**

## Legenda stati
| Status | Significato |
|--------|-------------|
| 🟢 APPROVED | Documento approvato da Boss, vincolante per gli agenti |
| 🟡 DRAFT | Bozza in discussione, non ancora approvata |
| 🔴 TODO | Documento da scrivere |

## Documenti fondamentali
| # | File | Stato | Ultima modifica | Descrizione |
|---|------|-------|-----------------|-------------|
| 00 | [`00-VISION.md`](00-VISION.md) | 🟡 DRAFT | Sessione 9 | Visione, missione, target, principi (decisioni strategiche chiuse in S9) |
| 01 | [`01-PLATFORMS.md`](01-PLATFORMS.md) | 🟡 DRAFT | Sessione 9 | Matrice piattaforme europee + campi dati |
| 02 | [`02-DATA-SCHEMA.md`](02-DATA-SCHEMA.md) | 🟢 APPROVED | Sessione 9 (v1.1) | Schema dati unificato (TypeScript + Dexie) |
| 03 | [`03-ADAPTERS/`](03-ADAPTERS/) | 🟢 APPROVED | Sessione 2 | SPEC-TEMPLATE + Spotify (altri TBD) |
| 04 | [`04-ANALYSIS-ALGORITHMS.md`](04-ANALYSIS-ALGORITHMS.md) | 🟡 DRAFT | Sessione 9 | Algoritmi di analisi (mood, ere, eventi, ricordi) |
| 05 | [`05-ARCHITECTURE.md`](05-ARCHITECTURE.md) | 🟢 APPROVED | Sessione 9 (v1.0) | Architettura tecnica generale |
| 06 | [`06-UX-FLOWS-STATES.md`](06-UX-FLOWS-STATES.md) | 🟡 DRAFT | Sessione 9 | Flussi UX e stati per schermata |
| 07 | [`07-UI-SPEC.md`](07-UI-SPEC.md) | 🟡 DRAFT | Sessione 7 | Specifiche UI componenti |
| 08 | [`08-COPY-I18N.md`](08-COPY-I18N.md) | 🟡 DRAFT | Sessione 9 (v0.2) | Tutte le stringhe UI con chiavi i18n |
| 09 | [`09-PRIVACY-SECURITY.md`](09-PRIVACY-SECURITY.md) | 🟡 DRAFT | Sessione 6 | Privacy spec, data flow, security |
| 10 | [`10-TESTING.md`](10-TESTING.md) | 🟢 APPROVED | Sessione 3 | Strategia di testing |
| 11 | [`11-BACKLOG.md`](11-BACKLOG.md) | 🟢 APPROVED | Sessione 9 (v1.1) | Backlog strutturato (epic → story → task) |
| 12 | [`12-DEVOPS.md`](12-DEVOPS.md) | 🟡 DRAFT | Sessione 9 (v0.2) | CI/CD, deploy, self-hosting |
| 13 | [`13-ADR/`](13-ADR/) | 🟢 APPROVED | Sessione 9 | Architecture Decision Records (0001, 0002, 0003, 0005) |
| 14 | [`14-GLOSSARY.md`](14-GLOSSARY.md) | 🟢 APPROVED | Sessione 1 | Glossario di dominio |
| 15 | [`15-DESIGN-SYSTEM.md`](15-DESIGN-SYSTEM.md) | 🟡 DRAFT | Sessione 9 | Design system completo |

## Documenti di supporto
| File | Stato | Descrizione |
|------|-------|-------------|
| [`SESSIONS.md`](SESSIONS.md) | 🟢 LIVE | Log di tutte le sessioni di progettazione |
| [`BUNDLE.md`](BUNDLE.md) | 🟢 SNAPSHOT | Backup completo del progetto |
| [`../AGENTS.md`](../AGENTS.md) | 🟢 v1.1 | Protocollo per agenti |
| [`../LICENSE`](../LICENSE) | 🟢 Apache-2.0 | Licenza del progetto (D.A.10) |
| [`AUDIT-2026-10-15.md`](AUDIT-2026-10-15.md) | 🟢 LIVE | Audit completo di documentazione e decisioni |

## Design & mockup
| Cartella | Contenuto |
|----------|-----------|
| [`../design/mockups/`](../design/mockups/) | Mockup schermate (PNG storiche) |
| [`../design/tokens.json`](../design/tokens.json) | 🟢 Design tokens per il codice (v0.2) |
| [`../design/assets/`](../design/assets/) | 🔴 (futuro) Logo, icone, illustrazioni vettoriali |

## Fixture di test
| Cartella | Contenuto |
|----------|-----------|
| [`../fixtures/synthetic-history/`](../fixtures/synthetic-history/) | Dataset di test sintetici per ogni adapter |

## Roadmap Sessioni di Progettazione
| Sessione | Nome | Stato |
|----------|------|-------|
| 0 | 🔒 Consolidamento + Bootstrap | ✅ COMPLETATA |
| 1 | 🗄️ Fondamenta dati | ✅ COMPLETATA (APPROVED) |
| 2 | 🔌 Primo adapter (Spotify) | ✅ COMPLETATA (APPROVED) |
| 3 | 📋 Governo (backlog + testing + AGENTS) | ✅ COMPLETATA (APPROVED) |
| 4 | 🧠 Analisi algoritmica | ✅ COMPLETATA |
| 5 | 🧭 UX completa + i18n | ✅ COMPLETATA |
| 6 | 🔐 Privacy & legale | ✅ COMPLETATA |
| 7 | 🎨 UI eseguibile + tokens | ✅ COMPLETATA |
| 8 | ⚙️ DevOps | ✅ COMPLETATA |
| 9 | 🩺 Audit + allineamento post-sessione | ✅ COMPLETATA |

## Stato del progetto (post-audit 2026-10-15)
- **Documenti APPROVED**: 8 (02 v1.1, 03, **05 v1.0**, 10, 11 v1.1, 13-ADR ×4, 14)
- **Documenti DRAFT**: 8 (00, 01, 04, 06, 07, 08, 09, 12, 15)
- **Documenti TODO**: 0
- **Licenza**: Apache-2.0
- **Business model**: Open-source puro, no monetizzazione
- **Prossimo step tecnico**: story 0.1 (`agent-ready`) **sbloccata** dopo approvazione Boss di `05` v1.0

---
*Questo file viene aggiornato ad ogni sessione. Non modificarlo senza aggiornare anche `SESSIONS.md`.*


===== FILE: docs/SESSIONS.md =====

# 📝 Log delle Sessioni di Progettazione

> Memoria cronologica di tutte le sessioni di lavoro sul progetto.
> **Questo file è la nostra memoria condivisa** tra Boss, AI progettista e futuri agenti.

---

## Sessione 0 — 🔒 Consolidamento + Bootstrap

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- ✅ `README.md` (supporto di progetto)
- ✅ `AGENTS.md` (v0, poi evoluto in v1.0 🟢 APPROVED)
- ✅ `docs/INDEX.md` (supporto, 🟢 LIVE)
- ✅ `docs/SESSIONS.md` (supporto, 🟢 LIVE)
- 🟡 `docs/00-VISION.md` (DRAFT)
- 🟡 `docs/01-PLATFORMS.md` (DRAFT)
- 🟡 `docs/05-ARCHITECTURE.md` (DRAFT)
- 🟡 `docs/15-DESIGN-SYSTEM.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.0.1 | Repository privato su GitHub | Proteggere il lavoro prima dell'apertura |
| D.0.2 | Struttura cartelle (`docs/`, `design/`, `fixtures/`, `scripts/`) | Separare specifica, design e test dal codice futuro |
| D.0.3 | 8 sessioni di progettazione pianificate | Copertura completa: dati, adapter, governo, analisi, UX, privacy, UI, DevOps |
| D.0.4 | Pilastri local-first e privacy-first | I dati dell'utente restano sul dispositivo |

---

## Sessione 1 — 🗄️ Fondamenta dati

**Data**: ottobre 2026
**Stato**: ✅ Completata + APPROVED

### Documenti prodotti
- 🟢 `docs/02-DATA-SCHEMA.md` (APPROVED)
- 🟢 `docs/14-GLOSSARY.md` (APPROVED)
- 🟢 `docs/13-ADR/0001-pwa-first.md` (APPROVED)
- 🟢 `docs/13-ADR/0002-local-first.md` (APPROVED)
- 🟢 `docs/13-ADR/0003-adapter-pattern.md` (APPROVED)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.1.1 | `timestamp` = fine ascolto | Convenzione univoca per ordinare e deduplicare gli eventi |
| D.1.2 | Idempotenza via `eventKey` | Reimport sicuro senza creare duplicati |
| D.1.3 | Dedup ISRC→MBID→fuzzy | Precisione progressiva nella riconciliazione dei brani |
| D.1.4 | IP non persistito di default | Coerenza con il pilastro privacy-first |

---

## Sessione 2 — 🔌 Template adapter + Spotify

**Data**: ottobre 2026
**Stato**: ✅ Completata + APPROVED

### Documenti prodotti
- 🟢 `docs/03-ADAPTERS/SPEC-TEMPLATE.md` (APPROVED)
- 🟢 `docs/03-ADAPTERS/spotify.md` (APPROVED)
- 🟢 `fixtures/synthetic-history/spotify-sample.json` (APPROVED)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.2.1 | Regola `skipped` derivata (E1) | Derivare lo skip dai dati invece di fidarsi dei flag delle piattaforme |
| D.2.2 | Consenso separato per `CarDetectionEvent` | Dato potenzialmente più sensibile, richiede consenso dedicato |
| D.2.3 | Fixture con 10 eventi e edge case | Test riproducibili fin dalla fase di sviluppo adapter |

---

## Sessione 3 — 📋 Governo

**Data**: ottobre 2026
**Stato**: ✅ Completata + APPROVED

### Documenti prodotti
- 🟢 `docs/11-BACKLOG.md` (APPROVED)
- 🟢 `docs/10-TESTING.md` (APPROVED)
- 🟢 `AGENTS.md` (v1.0, APPROVED)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.3.1 | Backlog con 5 epic e 17 story | Struttura epic → story → task per lavorare per incrementi |
| D.3.2 | Label `agent-ready` come gate | Una story è lavorabile da un agente solo se pronta e specificata |
| D.3.3 | Coverage differenziato | Sforzo di test proporzionale alla criticità del modulo |
| D.3.4 | Handoff tra conversazioni AI | Continuità garantita da `AGENTS.md` + `SESSIONS.md` |

---

## Sessione 4 — 🧠 Algoritmi di analisi

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- 🟡 `docs/04-ANALYSIS-ALGORITHMS.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.4.1 | Mood come quadrante valence×energy | Modello semplice e interpretabile su 4 quadranti |
| D.4.2 | Era detector via change point | Individuare i periodi musicali senza etichette manuali |
| D.4.3 | Event detector via z-score | Individuare i momenti anomali rispetto all'abitudine |
| D.4.4 | 5 tipi di ricordo | Tassonomia chiusa per la generazione dei ricordi |

---

## Sessione 5 — 🧭 UX completa + i18n

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- 🟡 `docs/06-UX-FLOWS-STATES.md` (DRAFT)
- 🟡 `docs/08-COPY-I18N.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.5.1 | 6 stati globali | Mappa completa e prevedibile delle schermate |
| D.5.2 | Stato machine per l'Import | Transizioni esplicite, nessuno stato ambiguo |
| D.5.3 | Keyboard navigation | Accessibilità e usabilità da desktop |
| D.5.4 | MVP bilingue IT+EN | Due lingue solo, per limitare il costo di traduzione |
| D.5.5 | Pluralizzazione ICU | Standard industriale per gestire i plurali nelle lingue |

---

## Sessione 6 — 🔐 Privacy & Legale

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- 🟡 `docs/09-PRIVACY-SECURITY.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.6.1 | Base giuridica: consenso esplicito | Le inferenze sul gusto musicale non rientrano nel legittimo interesse |
| D.6.2 | Inferenze come dati potenzialmente sensibili | Trattamento cautelativo a tutela dell'utente |
| D.6.3 | Disclaimer obbligatorio | Chiarire i limiti delle inferenze all'utente |
| D.6.4 | Loghi ufficiali delle piattaforme vietati | Evitare violazioni di marchio e linee guida brand |

---

## Sessione 7 — 🎨 UI eseguibile + Design Tokens

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- 🟡 `docs/07-UI-SPEC.md` (DRAFT)
- 🟢 `design/tokens.json` (APPROVED)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.7.1 | Dark-first | Coerenza con l'identità visiva e l'uso in auto |
| D.7.2 | Glow over shadow | Linguaggio visivo distintivo del design system |
| D.7.3 | A11y integrata nella specifica | Accessibilità come requisito, non come retrofit |
| D.7.4 | Design tokens W3C-compatible | Portabilità dei token tra strumenti e codice |
| D.7.5 | Rispetto di `prefers-reduced-motion` | Animazioni degradabili per chi ne ha bisogno |

---

## Sessione 8 — ⚙️ DevOps & Deployment

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- 🟡 `docs/12-DEVOPS.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.8.1 | GitHub Actions per CI/CD | Pipeline nativa nel repository, senza strumenti esterni |
| D.8.2 | Docker per il self-hosting | Deployment riproducibile per chi vuole i dati in casa |
| D.8.3 | Vercel/Netlify per la PWA | Hosting statico semplice per l'app pubblica |
| D.8.4 | CSP strict | Ridurre la superficie di attacco a valle |
| D.8.5 | Zero dati reali nei fixture | Nessun dato personale nel repository |

---

## Sessione 9 — 🩺 Audit completo + allineamento post-sessione

**Data**: 2026-10-15
**Stato**: ✅ Completata
**Trigger**: drift tra documenti APPROVED e DRAFT accumulato nelle sessioni 4-8 non sincronizzato.

### Documenti aggiornati
- 🟢 `docs/02-DATA-SCHEMA.md` → v1.1 (`genres`, `carDetectionConsent`, `searchQueries`, Dexie v2, PatternPayload esteso)
- 🟡 `docs/00-VISION.md` → v0.2 (decisioni strategiche chiuse)
- 🟡 `docs/05-ARCHITECTURE.md` → v0.2 (formato flat, detect() union, Essentia→AB→euristic, Recharts+D3 lazy, React Query solo enrichment, sync cloud placeholder)
- 🟡 `docs/08-COPY-I18N.md` → v0.2 (rimosse `privacy.stats`, aggiunte `carDetection`, `syncCloud`, `insight.disclaimer`, `adapter.spotify.warn.offlineConverted`, soglia 500MB)
- 🟡 `docs/12-DEVOPS.md` → v0.2 (rimosso Sentry, CSP ripulita, Dockerfile monorepo-aware, Apache-2.0)
- 🟡 `docs/15-DESIGN-SYSTEM.md` → scale Display + count-up documentate
- 🟢 `docs/11-BACKLOG.md` → v1.1 (Story 2.2 change point, nuove story scrobbleHubs + PWA/i18n, Story 4.1 Essentia)
- 🟡 `docs/01-PLATFORMS.md` → E1 validata, hubs chiariti
- 🟡 `docs/06-UX-FLOWS-STATES.md` → re-import idempotente esplicitato
- `design/tokens.json` → display scale, count-up duration
- `docs/INDEX.md` → conteggi corretti, ADR-0005, LICENSE, AUDIT
- `docs/13-ADR/0005-sync-cloud.md` → nuovo ADR placeholder
- `LICENSE` → nuovo file (Apache-2.0)
- `AGENTS.md` → footer aggiornato

### Decisioni prese (audit)

| # | Decisione | Esito |
|---|-----------|-------|
| D.A.1 | Telemetria e statistiche | **Rinviate a Fase 2.** Niente Sentry, niente toggle stats |
| D.A.2 | Generi | `genres: string[]` su Track e Artist in 02 v1.1 |
| D.A.3 | searchQueries | Aggiungere tabella in 02 v1.1 |
| D.A.4 | Libreria grafici | Recharts standard + D3 solo Timeline (lazy import) |
| D.A.5 | React Query | Solo per enrichment |
| D.A.6 | Provider audio features | Essentia.js (wasm) + AcousticBrainz bonus + fallback euristico |
| D.A.7 | Cloud sync (impl.) | Placeholder + ADR-0005 in Fase 2 |
| D.A.8 | `detect()` adapter | `boolean \| Promise<boolean>` |
| D.A.9 | Business model | Open-source puro, no monetizzazione |
| D.A.10 | Licenza | **Apache-2.0** |
| D.A.11 | Self-hosting | Solo self-hosting con docs curata; demo gratuita eventuale in Fase 2 |
| D.A.12 | Cloud sync (vision) | Previsto come servizio self-hosted in Fase 2; ADR-0005 con E2EE, consenso granulare, opt-in per categoria |

### Esito sintetico
30 decisioni su 38 storicamente coerenti. **9 incongruenze critiche risolte** (C1-C9), 13 medie risolte o accettate (M1-M13), 6 vuoti documentati (V1-V6).

### Prossimi step
1. ✅ **Approvazione Boss di `05-ARCHITECTURE.md` v0.2 → v1.0 🟢 APPROVED** (sblocca story 0.1 `agent-ready`)
2. ⬚ Fixture Spotify v1.1 (C6)
3. ⬚ `design/mockups/TOUR.md` (V2)
4. ⬚ Story backlog per `scrobbleHubs` (V4) e PWA/service worker + i18n (V5) — **aggiunte in v1.1 come Story 0.5, 0.6, 0.7, 1.5**

---

### Stato del progetto post-Sessione 9
La progettazione è **allineata**. Spina dorsale APPROVED (02 ↔ 03 ↔ **05** ↔ 10 ↔ 11 ↔ 14) solida. Il prossimo handoff è per gli agenti di sviluppo (Fase 0 tecnica): **story 0.1 sbloccata**.

*Progettazione chiusa. 🟢 APPROVED su 8 documenti. Story 0.1 `agent-ready` sbloccata: si parte con la Fase 0 tecnica.*

---

## Template sessione (da copiare per le sessioni future)

    ## Sessione N — 🎯 [Nome]

    **Data**: [data]
    **Stato**: 🟡 In corso / ✅ Completata

    ### Documenti prodotti
    - ✅ `percorso/file.md` (APPROVED/DRAFT)

    ### Decisioni prese
    | # | Decisione | Motivazione |
    |---|-----------|-------------|
    | D.N.1 | ... | ... |

---

*Aggiornato ad ogni nuova sessione.*



===== FILE: docs/00-VISION.md =====

# 00 — Visione e Missione

> Status: 🟡 DRAFT
> Versione: 0.2
> Ultima modifica: Sessione 9 (audit 2026-10-15)
> Responsabile: Boss

---

## 🎯 Il Problema

Le piattaforme di streaming musicale raccolgono **una quantità enorme di dati intimi** su ogni utente: cosa ascolta, quando, dove, da quale dispositivo, per quanto tempo, se salta i brani, se usa lo shuffle. Eppure, tutto quello che restituiscono è un **"Wrapped" annuale** con 5 artisti e 5 brani.

È come avere un diario segreto di 10 anni e usarlo solo per contare quante volte hai scritto la parola "ciao".

I dati esistono già. Quello che manca è un **lettore** che li trasformi in una storia.

## 💡 La Soluzione

**Life Soundtrack** è un'applicazione web (PWA) che trasforma i metadati grezzi delle piattaforme di streaming in un **diario di vita musicale**: una timeline personale, emotiva e contestuale che racconta la storia dell'utente attraverso la musica.

Non è un'app di statistica. È un'app di **narrazione autobiografica** basata sui dati di ascolto.

## 🧭 Principi Fondamentali

| Principio | Significato | Implicazione tecnica |
|-----------|-------------|---------------------|
| **Privacy-first** | I dati restano sul dispositivo dell'utente | Elaborazione in-browser, IndexedDB, nessun server centrale obbligatorio |
| **Local-first** | L'app funziona offline dopo il primo caricamento | PWA con service worker, dati locali |
| **Open data** | L'utente è proprietario dei propri dati | Export JSON in qualsiasi momento, portabilità GDPR |
| **Estensibilità** | Aggiungere una piattaforma non richiede modifiche al core | Adapter pattern, formato dati unificato |
| **Nessun lock-in** | Nessun abbonamento forzato, nessun dato ostaggio | Nessuna autenticazione obbligatoria, sync cloud opzionale e cifrato |
| **Narrazione prima dei numeri** | I dati raccontano storie, non statistiche | Insight in linguaggio naturale, non solo grafici |

## 🎬 Tagline

> *"La colonna sonora della tua vita, finalmente leggibile."*

## 👥 Target Utenti

| Segmento | Età | Bisogno | Messaggio |
|----------|-----|---------|-----------|
| **Nostalgici** | 25-45 | Rivivere periodi della vita | "Che musica ascoltavi quando ti sei laureato?" |
| **Quantified Self** | 25-50 | Pattern e statistiche profonde | "Guarda l'evoluzione del tuo umore attraverso la musica" |
| **Audiofili** | 30-55 | Unificare sorgenti diverse | "Spotify + Qobuz + Plex, un'unica storia" |
| **Curiosi** | 20-40 | Andare oltre il Wrapped | "5 canzoni non bastano a raccontare il tuo anno" |
| **Privacy-conscious** | 25-50 | Controllo totale dei dati | "I tuoi dati, solo tuoi" |

## 🌍 Perimetro Iniziale (MVP)

- **Piattaforme supportate (Europa)**: Spotify, YouTube Music, Apple Music, Deezer, Tidal, SoundCloud, Last.fm, ListenBrainz
- **Piattaforma di distribuzione**: PWA (web app installabile)
- **Modalità operativa**: Local-first, elaborazione in-browser
- **Lingue MVP**: Italiano, Inglese
- **Modello di business**: Open-source puro, nessuna monetizzazione (donazioni opzionali) — vedi D.A.9

## 🚫 Cosa NON è Life Soundtrack

- Non è un clone di Spotify Wrapped
- Non è una piattaforma di streaming
- Non è un social network musicale
- Non è un'app di raccomandazione
- Non è uno strumento per artisti/label (fuori scope per ora)

## 🎁 Cosa offre di unico

1. **Timeline narrativa**: non solo "hai ascoltato X", ma "in quel periodo della tua vita..."
2. **Unificazione multi-sorgente**: la storia completa attraverso tutte le piattaforme usate
3. **Rilevamento ere musicali ed eventi**: pattern e anomalie che raccontano capitoli della vita
4. **Ricordi tipo "Facebook Memories"**: ma basati sulla musica, non sulle foto
5. **Privacy come valore**: i dati non escono mai dal dispositivo

## 📈 Metriche di Successo

- **Attivazione**: % di utenti che completano l'import
- **Retention settimanale**: % che apre l'app almeno 1 volta a settimana
- **Engagement con ricordi**: % di ricordi visti / condivisi
- **NPS**: soddisfazione percepita

## 🧭 Decisioni Strategiche (risolte in audit 2026-10-15)

| Decisione | Esito | Rif. |
|-----------|-------|------|
| Modello di business | ✅ Open-source puro, nessuna monetizzazione | D.A.9 |
| Licenza | ✅ Apache-2.0 (con patent grant) | D.A.10 |
| Self-hosting supportato | ✅ Solo self-hosting con docs curata; istanza demo gratuita eventuale in Fase 2 | D.A.11 |
| Sync cloud | ✅ Previsto come servizio self-hosted in Fase 2 (mai SaaS); ADR-0005 con E2EE + consenso granulare + opt-in per categoria | D.A.12 |
| Cloud sync (implementazione MVP) | ✅ Placeholder in `05`, ADR-0005 da scrivere prima dell'implementazione | D.A.7 |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Bozza iniziale, consolidata dal lavoro esplorativo |
| 0.2 | Sessione 9 (2026-10-15) | Audit: chiuse tutte le decisioni strategiche aperte (D.A.9-12). Aggiornato modello di business |

---

*Questo documento è DRAFT. Diventa vincolante per gli agenti solo dopo approvazione di Boss (status: 🟢 APPROVED).*


===== FILE: docs/01-PLATFORMS.md =====

# 01 — Matrice Piattaforme e Dati Ottenibili

> Status: 🟡 DRAFT
> Versione: 0.2
> Ultima modifica: Sessione 9 (audit 2026-10-15)
> Scope: MVP europeo

---

## 1. Scopo

Definire, per ogni piattaforma di streaming nel perimetro MVP, **quali dati sono ottenibili, con quale metodo, in quale formato e con quali limiti**. Questo documento è la base delle specifiche adapter (`03-ADAPTERS/`).

## 2. I tre canali di accesso ai dati

| Canale | Descrizione | Pro | Contro |
|--------|-------------|-----|--------|
| **Export GDPR** | Download dei dati personali obbligatorio per legge (UE) | Storico completo, campi contestuali ricchi | Manuale, non automatizzabile, tempi variabili |
| **API pubblica** | Endpoint ufficiali per sviluppatori | Real-time, automatizzabile | Limiti severi, deprecazioni, nessun storico completo |
| **Scrobbling** | Registrazione continua degli ascolti su hub esterni (Last.fm, ListenBrainz, Maloja) | Continuo, multi-piattaforma, storico illimitato | Copre solo dal momento dell'attivazione |

**Strategia MVP**: export GDPR per lo *storico*, scrobbling per il *continuo*, API solo dove aggiungono valore reale.

## 3. Schede piattaforma

### 3.1 Spotify 🇸 — Tier S (priorità massima)

- **Accesso storico**: GDPR "Extended Streaming History" (JSON, ~15k eventi/anno)
- **Accesso real-time**: Web API (limitata: recently played max 50; top items 3 finestre)
- **Scrobbling**: sì (Last.fm, ListenBrainz, multi-scrobbler)

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
| `skipped` | bool | ⚠️ inaffidabile in alcuni periodi (vedi §5) |
| `offline` | bool | |
| `offline_timestamp` | int/null | ⚠️ unità cambiate nel tempo (vedi §5) |
| `incognito_mode` | bool | |

**File aggiuntivi nell'export**: `SearchQueries.json` (ricerche con timestamp), `Playlist*.json` (playlist con date di aggiunta), `YourLibrary.json` (brani salvati), `Follow.json`, `Wrapped*.json`, `Userdata.json`. Nei technical log: `CarDetectionEvent.json` (rilevamento auto), `AdRequestEvent.json` (ads, account free).

**Limiti API (2026)**: audio-features deprecate (nov 2024); Dev Mode richiede Premium e max 5 utenti (feb 2026). → Le audio features vanno ricavate da fonti esterne (vedi `05-ARCHITECTURE.md` §6).

### 3.2 YouTube Music 🇺🇸 (dominante in EU) — Tier S

- **Accesso storico**: Google Takeout ("YouTube and YouTube Music") → JSON/HTML
- **Campi**: `time`, `title`, `titleUrl`, `products`, `details.name` (canale/artista), `details.url`, `locationInfo` (opzionale)
- **Limiti**: cronologia unificata video+musica (serve filtro); nessun campo skip/shuffle/dispositivo
- **Scrobbling**: sì (scrobbler dedicati)

### 3.3 Apple Music 🇺🇸 (molto diffusa in EU) — Tier A

- **Accesso storico**: Apple Privacy Portal → "Apple Media Services" (CSV/JSON)
- **Campi**: Song Name, Artist Name, Album Name, Play Date UTC, Media Type, Playlist Name
- **Limiti**: nessun campo contestuale (skip/shuffle/device); API MusicKit senza audio features
- **Scrobbling**: sì (scrobbler di terze parti)

### 3.4 Deezer 🇫🇷 — Tier A

- **Accesso storico**: export GDPR (⚠️ storicamente lento e a volte incompleto)
- **API pubblica**: buona per catalogo, preferiti, playlist; cronologia utente limitata
- **Scrobbling**: sì
- **Limiti**: meno metadati contestuali di Spotify

### 3.5 Tidal 🇳🇴/🇸 — Tier A

- **API pubblica aperta**: `openapi.tidal.com` v2, OAuth 2.0 + PKCE, JSON:API
- **Campi catalogo**: title, artist, album, duration, **ISRC**, `audioQuality` (LOW/HIGH/LOSSLESS/HI_RES), `audioModes` (STEREO/DOLBY_ATMOS)
- **Limiti**: nessuna cronologia di ascolto storica via API → utile per metadati e libreria, non per lo storico

### 3.6 SoundCloud 🇩🇪 — Tier B

- **Export GDPR**: cronologia limitata a ~1000 brani; like, playlist, follow
- **API pubblica**: preferiti, playlist, follow
- **Valore**: musica indie/elettronica/DJ set assente altrove

### 3.7 Last.fm 🇬🇧 — Tier S (come hub, non sorgente)

- **API pubblica gratuita**: `user.getRecentTracks` paginabile sull'intero storico, top artists/tracks/albums per periodo, weekly charts
- **Campi**: name, artist, album, `date`, `loved`
- **Limiti**: nessun contesto (device/luogo); solo dati scrobblati; rate limit ~5 req/s

### 3.8 ListenBrainz 🌐 (no-profit) — Tier S (come hub)

- **API pubblica senza limiti restrittivi**: `/1/user/{username}/listens` paginabile
- **Campi**: `listened_at`, `track_metadata.track_name/artist_name/release_name`, `additional_info`: **`recording_mbid`, `artist_mbids`, `release_mbid`, `isrc`, `spotify_id`, `youtube_id`, `origin_url`**
- **Valore unico**: identificativi MusicBrainz/ISRC nativi → normalizzazione perfetta tra piattaforme

### 3.9 Self-hosted (Plex, Navidrome, Subsonic, Roon) — Tier S+ per nicchia

- Nessuna piattaforma commerciale: librerie personali (CD digitalizzati, acquisti, file rari)
- Integrazione via scrobbling (Maloja, multi-scrobbler, webhook Plex→ListenBrainz)
- **Valore unico**: copre la parte più intima della storia musicale, invisibile alle piattaforme
- **Nota su `PlatformId`**: in `02-DATA-SCHEMA.md` le piattaforme commerciali sono in `PlatformId`; Subsonic/Roon/Maloja **non** sono piattaforme sorgente del modello, ma **hub di scrobbling** — vivono in `PrivacySettings.scrobbleHubs` (e nell'eventuale adapter Subsonic dedicato in `03-ADAPTERS/`, fuori perimetro MVP). `navidrome` è in `PlatformId` come caso particolare di Subsonic API.

### 3.10 Fuori perimetro MVP (estensioni future)

Qobuz (export solo playlist), Bandcamp (solo acquisti), IDAGIO (classica), Boomplay (Africa), JioSaavn/Gaana (India), Anghami (MENA), NetEase/Tencent (Cina), MelOn (Corea), LINE Music/AWA (Giappone), iHeartRadio/SiriusXM (radio USA). Vedi `SESSIONS.md` per la strategia di estensione.

## 4. Confronto per categoria di dato

| Categoria | Spotify | YT Music | Apple | Deezer | Tidal | SoundCloud | Last.fm | ListenBrainz |
|---|---|---|---|---|---|---|---|---|
| Timestamp ascolto | ✅ | ✅ | ✅ | ✅ | ❌ | ️ | ✅ | ✅ |
| Durata ascoltata | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dispositivo | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| IP / Paese | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Skip / Shuffle / Offline | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ricerche | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Playlist con date | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Brani salvati | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| ISRC / MBID | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Storico completo | ✅ | ✅ | ✅ | ⚠️ | ❌ | ️ | ✅ | ✅ |

Legenda: ✅ completo · ⚠️ parziale · ❌ assente

## 5. Catalogo edge case noti (vincoli per gli adapter)

| # | Piattaforma | Edge case | Impatto | Azione adapter |
|---|-------------|-----------|---------|----------------|
| E1 | Spotify | `skipped` non affidabile: nessun skip registrato 2015-04→2022-10; valori misti prima/dopo | Statistiche skip errate | Regola derivata: `skipped OR reason_end IN (backbtn, unknown, endplay, fwdbtn)` — **validata in Sessione 2** (`03-ADAPTERS/spotify.md`) |
| E2 | Spotify | Timestamp sovrapposti (~2.6% della durata totale); stream duplicati identici con `ts` diverso | Durata totale sovrastimata | Deduplicazione per (uri, ts±1s, ms_played) |
| E3 | Spotify | `offline_timestamp`: unità passate da secondi a millisecondi | Parsing errato | Normalizzazione unità per epoca |
| E4 | Spotify | Stessa registrazione con URI/ISRC diversi (singolo + album + compilation) | Conteggi frammentati | Dedup via ISRC/MBID + fuzzy title (vedi `02-DATA-SCHEMA.md`) |
| E5 | Spotify | Granularità `platform` cambiata ott-2023 (da modello dettagliato a `android`/`windows`/...) | Classificazione device discontinua | Mapping a `device_type` normalizzato |
| E6 | YouTube | Cronologia unifica video e musica | Falsi positivi musicali | Filtro su `products` + euristiche titolo/URL |
| E7 | Deezer | Export GDPR storicamente lento (casi documentati di mesi) e incompleto | Storico mancante | Fallback: API + scrobbling; avviso utente |
| E8 | SoundCloud | Export limitato a ~1000 brani; brani rimossi nel tempo | Storico troncato | Dichiarare limite all'utente; integrare con scrobbling |
| E9 | Apple | Nessun campo contestuale | Analisi comportamentale limitata | Adattare insight disponibili |
| E10 | Tutte | Fusi orari: `ts` Spotify è UTC; Apple "Play Date UTC"; Takeout locale+UTC | Timeline sfalsata | Normalizzare tutto a UTC in fase di parse |

## 6. Strategia di integrazione MVP

1. **Storico**: adapter di import file per Spotify, YouTube Music, Apple Music (+ Deezer quando disponibile)
2. **Continuo**: connessione opzionale a Last.fm / ListenBrainz; supporto Maloja self-hosted
3. **Normalizzazione**: unificazione tramite ISRC/MBID (ListenBrainz e Tidal come fonti di verità per gli identificatori)
4. **Arricchimento**: audio features da fonti esterne (vedi `05-ARCHITECTURE.md` §6)

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Consolidamento dalle sessioni esplorative |
| 0.2 | Sessione 9 (2026-10-15) | Audit: E1 validata in S2 (riferimento `03-ADAPTERS/spotify.md`); chiarita distinzione `PlatformId` (sorgenti) vs `scrobbleHubs` (Subsonic/Roon/Maloja) (M4) |


===== FILE: docs/02-DATA-SCHEMA.md =====

# 02 — Schema Dati Unificato (eseguibile)

> Status: 🟢 APPROVED · Versione 1.1 · Sessione 9 (audit 2026-10-15)
> Vincolante per: adapter (03), analisi (04), db (core/db), test (10)

---

## 1. Principi dello schema

1. **Un evento di ascolto è l'atomo**: tutto deriva da `ListenEvent`
2. **Normalizza presto**: i dati grezzi delle piattaforme vivono solo nel file dell'utente; nel DB entra solo il formato unificato (vedi ADR-0003)
3. **Idempotenza**: re-importare lo stesso file non duplica nulla (`eventKey` unico)
4. **Derivati versionati**: sessioni e insight sono ricalcolabili; portano il `derivedVersion` del set di parametri che li ha generati
5. **UTC ovunque**: ogni timestamp è unix millisecondi UTC

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
      canonicalKey: string;    // UNIQUE — regola DEDUP (§5)
      name: string;
      artistId: string;
      albumId: string | null;
      durationMs: number | null;
      isrc: string | null;
      mbid: string | null;     // MusicBrainz Recording ID
      explicit: boolean | null;
      genres: string[];        // popolato da enrichment (MusicBrainz) o dall'adapter
      platformIds: Partial<Record<PlatformId, string>>;
      firstSeenAt: number;
      lastSeenAt: number;
      listenCount: number;     // contatore denormalizzato
    }

    export interface Artist {
      id: string;
      name: string;
      mbid: string | null;
      genres: string[];        // popolato da enrichment (MusicBrainz) o dall'adapter
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
      valence: number | null;          // 0..1 positività emotiva
      energy: number | null;           // 0..1 intensità
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
      source: 'acousticbrainz' | 'essentia' | 'heuristic' | 'manual';
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
      payload: InsightPayload;       // unione discriminata (§4)
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
      carDetectionConsent: boolean; // default false; rilevamento ascolti in auto (es. Bluetooth/Battery)
      scrobbleHubs: PlatformId[]; // default []; hub di scrobbling scelti
      syncCloud: boolean;         // default false; sync E2E opzionale (Fase 2, ADR-0005)
    }

Quando `retainIp` è true:
- `ListenEvent.ip` è conservato (string, IPv4/IPv6)
- L'IP resta SOLO nel DB locale, mai inviato in rete
- L'utente può purgarlo in qualsiasi momento (`purgeIp()` azzera tutti gli ip)
- Il `country` è sempre derivato dall'IP al parse e conservato (indipendentemente dal toggle)

Quando `retainIp` è false (default):
- `ListenEvent.ip` è null dopo il parse
- Il `country` è derivato e conservato (privacy-by-design)

Quando `carDetectionConsent` è true (default false):
- L'utente acconsente a eventi `deviceType='car'` rilevati da segnali locali (Bluetooth auto, CarPlay, Android Auto, power profile)
- L'evento resta locale; nessun dato auto-specifico lascia il dispositivo
- Disattivabile in qualsiasi momento

### 3.9 SearchQuery (criteri di ricerca)

    export interface SearchQuery {
      id: string;
      platform: PlatformId;
      query: string;             // testo libero cercato dall'utente
      normalized: string;        // query normalizzata (lowercase, trim) per dedup
      timestamp: number;         // unix ms UTC
      resultCount: number | null; // null se non disponibile
      context: 'manual' | 'browse' | 'recommendation';
    }

Regole di persistenza:
- Solo se `PrivacySettings.enrichMetadata` è true OPPURE il consenso specifico è attivo
- Mai condivisi con terze parti
- Deduplicazione per `(platform, normalized, day)` via indice

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
      repeatRate: number;               // quota brani già noti
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
      peakHour: number | null;         // 0..23, in userTimezone (circadian)
      peakDay: number | null;          // 0=Sun..6=Sat, in userTimezone (weekly)
      peakMonth: number | null;        // 1..12, in userTimezone (seasonal)
      nightShare: number | null;       // quota ascolti 00:00-05:59 (userTimezone)
      weekendShare: number | null;     // quota sab+dom (userTimezone)
      userTimezone: string;            // IANA tz, es. 'Europe/Rome'
    }

## 5. Regole di deduplicazione tracce (DEDUP)

Priorità per `canonicalKey`, valutata al momento dell'upsert:

| # | Regola | canonicalKey |
|---|--------|--------------|
| DEDUP-1 | ISRC presente | `isrc:<ISRC upper>` |
| DEDUP-2 | MBID presente (no ISRC) | `mbid:<mbid>` |
| DEDUP-3 | altrimenti | `fuzzy:<sha1(normalize(name) + '\|' + normalize(artistPrincipal) + '\|' + durationBucketMs)>` |

`durationBucketMs = Math.floor(durationMs / 2000) * 2000` (bucket da 2 secondi)

`normalize(s)`: lowercase → rimuovi feat./ft./with → rimuovi contenuti tra parentesi tonde/quadre → rimuovi punteggiatura → collassa spazi → trim.

### Tradeoff di DEDUP-3 con durata (documentato)

- **Pro**: includere la durata riduce drasticamente le fusioni false di brani omonimi ma diversi (radio edit vs album version vs live)
- **Contro**: può separare la stessa registrazione quando la durata differisce tra piattaforme (remaster, rounding ±1-2s)
- **Mitigazione**: DEDUP-1/2 (ISRC/MBID) catturano comunque quelle; il bucket da 2s assorbe il rounding
- **Rischio accettato**: registrazioni omonime con durata identica restano fuse (documentato; mitigabile in futuro con fuzzy a 3 campi: nome+artista+durata+album)

Comportamento upsert:
- Se esiste track con stesso canonicalKey → aggiungi platformId, aggiorna lastSeenAt e contatori
- Altrimenti crea nuova track
- Conflitti nome: il nome visualizzato è quello della prima piattaforma importata per ordine di priorità (spotify > apple > tidal > listenbrainz > altro), salvo override utente futuro

## 6. Schema Dexie (IndexedDB) — versione 1

    db.version(2).stores({
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
      searchQueries: '&id, platform, timestamp, [platform+normalized]',
    });

Migrazione v1→v2: aggiunge `searchQueries`; nessuna modifica distruttiva a tabelle esistenti. Le colonne `genres` su `tracks`/`artists` sono nullable e backfill opzionale via enrichment.

PrimKey: dove non indicato con `&`, Dexie usa la prima chiave; le tabelle con `&x` usano x come chiave primaria unica. `id` espliciti sono UUID generati dal core.

## 7. Politiche di migrazione e ricalcolo

- **MIG-1**: ogni cambio schema = `db.version(n+1).stores({...}).upgrade(tx => ...)`; mai drop di tabelle utente
- **MIG-2**: tabelle derivate (`sessions`, `insights`) sono **ricostruibili**: comando `recompute()` le rigenera da `listens` + `features`
- **MIG-3**: ogni modifica ai parametri di analisi cambia `derivedVersion` (hash del config); insight con version vecchia sono marcati `stale` e ricalcolati al prossimo avvio
- **MIG-4**: i contatori denormalizzati (`listenCount`) sono ricalcolabili con `recount()`; servono solo per performance UI

## 8. Cosa NON è nello schema (decisioni esplicite)

- **Raw payload piattaforma**: non persistito (ADR-0003). Il file dell'utente è la fonte di verità; l'import è ri-eseguibile
- **IP address**: non persistito DI DEFAULT. Conservato SOLO con toggle esplicito `PrivacySettings.retainIp`; mai inviato in rete; purgabile con `purgeIp()`. Il `country` è sempre derivato e conservato
- **Coordinate GPS**: mai raccolte
- **Testi/lyrics**: fuori scope

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 1 | Prima versione eseguibile |
| 1.0 | Sessione 1 | 🟢 APPROVED · Versione 1.0 · Sessione 1 |
| 1.1 | Sessione 9 (2026-10-15) | Audit: `genres: string[]` su Track/Artist (D.A.2); `carDetectionConsent` in PrivacySettings (C1); tabella `searchQueries` + interfaccia (D.A.3); `AudioFeatures.source` ripulito a `{acousticbrainz, essentia, heuristic, manual}` (D.A.6); schema Dexie portato a v2; `PatternPayload` esteso con `peakHour`, `peakDay`, `peakMonth`, `nightShare`, `weekendShare`, `userTimezone` (M6/M7) |


===== FILE: docs/03-ADAPTERS/SPEC-TEMPLATE.md =====

# 03-ADAPTERS/SPEC-TEMPLATE — Template Specifica Adapter

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 2
> Scopo: formato riutilizzabile per ogni adapter. Copia questo template in `03-ADAPTERS/<platform>.md` e compilalo.

---

# Adapter <PLATFORM_NAME>

> Status: 🟡 DRAFT · Versione 0.1 · Ultima modifica: <data>
> Piattaforma: <nome commerciale>
> Sede legale: <paese>
> Tier: <S / A / B> · Priorità MVP: <sì / no>

## 1. Metodi di accesso

| Canale | Disponibile | Formato output | Frequenza | Note |
|--------|:-----------:|----------------|-----------|------|
| Export GDPR | sì/no | <JSON/CSV/ZIP> | Manuale | |
| API pubblica | sì/no | <REST/GraphQL> | Real-time | |
| Scrobbling (Last.fm/LB) | sì/no | — | Continuo | |
| File utente diretto | sì/no | <descrivi> | — | |

## 2. Flusso di import

[Stato iniziale] → [Rilevamento formato] → [Parsing streaming] → [Normalizzazione] → [Upsert DB]


Descrivi:
- Come l'utente procura il file (URL, passaggi)
- Come l'adapter lo riconosce (`detect(input)`)
- Come gestisce file multipli

## 3. Mapping campi sorgente → unificato

### 3.1 ListenEvent

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `timestamp` | — | — | — | vedi §5 (semantica temporale) |
| `startedAt` | — | — | — | derivato se mancante |
| `durationMs` | — | — | — | — |
| `eventKey` | — | — | — | regola di calcolo |
| `platform` | (fisso) | string | — | — |
| `track.name` | — | string | — | — |
| `track.artist` | — | string | — | — |
| `track.album` | — | string | — | nullable |
| `track.isrc` | — | string | — | nullable |
| `track.mbid` | — | string | — | nullable; lookup se possibile |
| `deviceType` | — | string | — | mapping a enum |
| `deviceDetail` | — | string | — | stringa raw |
| `country` | — | string | — | ISO 3166-1 |
| `ip` | — | string | — | SOLO se `retainIp` true |
| `shuffle` | — | bool | — | nullable |
| `skipped` | — | bool | — | regola derivata se inaffidabile |
| `offline` | — | bool | — | nullable |
| `incognito` | — | bool | — | nullable |
| `reasonStart` | — | string | — | raw string |
| `reasonEnd` | — | string | — | raw string |
| `completed` | — | bool | — | derivata da duration/total |

### 3.2 Library / Playlist / Artist / Album

| Entità | Campo | Sorgente | Note |
|--------|-------|----------|------|
| Artist | — | — | — |
| Album | — | — | — |
| Playlist | — | — | — |
| PlaylistItem | — | — | — |

## 4. Edge case noti (catalogo E)

Copia da `01-PLATFORMS.md` §5 filtrando per piattaforma.

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E.N.1 | — | — | — |

## 5. Semantica temporale

Specifica se il timestamp sorgente è inizio o fine ascolto. Come si derivano `timestamp` (fine) e `startedAt` (inizio)?

## 6. Regole di dedup tracce

Riferimento a `02-DATA-SCHEMA.md` §5 (DEDUP-1..3).

## 7. Comportamento privacy

| Dato sensibile | Default | Se `retainIp` true |
|----------------|---------|---------------------|
| IP address | scartato dopo `country` | conservato |
| Coordinate GPS | mai raccolte | mai raccolte |

## 8. Test — fixture atteso

Riferimento a `fixtures/synthetic-history/<platform>-sample.json`.

Casi di test minimi:
1. Import pulito (happy path)
2. Idempotenza (re-import → 0 duplicati)
3. Ogni edge case E.N.x → risultato atteso
4. DEDUP: due record stesso ISRC → una sola track
5. DEDUP: due record omonimi, durata diversa → due track

## 9. Segnalazione all'utente

Elenco codici i18n (`08-COPY-I18N.md`) usati dall'adapter.

## 10. Note di implementazione

Dettagli specifici (rate limit API, chunking, formati compressione).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 2 | Template approvato |


===== FILE: docs/03-ADAPTERS/spotify.md =====

# Adapter Spotify

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 2
> Tier: **S** · Priorità MVP: **sì**

## 1. Metodi di accesso

| Canale | Disponibile | Formato output | Frequenza | Note |
|--------|:-----------:|----------------|-----------|------|
| Export GDPR | ✅ | JSON in ZIP | Manuale | "Extended streaming history" |
| API pubblica | ⚠️ | REST | Real-time | Deprecate audio-features (2024-11); Dev Mode limitato |
| Scrobbling LB/L.fm | ✅ | — | Continuo | via client terzi |

**Canale principale MVP**: Export GDPR. L'API pubblica è usata solo per recupero catalog metadata (non per cronologia).

## 2. Flusso di import

### 2.1 Come l'utente procura il file

1. Account Spotify → Privacy → "Download your data"
2. Seleziona **"Extended streaming history"** (non la cronologia breve!)
3. Attesa: da 4 ore a 30 giorni (email con link)
4. Download: archivio ZIP contenente:
   - `Streaming_History_Audio_<periodo>_<n>.json` (uno o più)
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

## 3. Mapping campi sorgente → unificato

### 3.1 ListenEvent

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `timestamp` | `ts` | ISO 8601 UTC | `Date.parse(ts)` | **FINE ascolto** |
| `startedAt` | — | — | `timestamp - ms_played` | derivato |
| `durationMs` | `ms_played` | int | diretto | |
| `eventKey` | — | — | `'spotify:' + (spotify_track_uri ?? sha1(name+artist+ts))` | se URI mancante (podcast?), hash |
| `platform` | (fisso) | — | `'spotify'` | |
| `track.name` | `master_metadata_track_name` | string/null | diretto; null → skip evento | |
| `track.artist` | `master_metadata_album_artist_name` | string/null | diretto; null → "Unknown" | |
| `track.album` | `master_metadata_album_album_name` | string/null | nullable | |
| `track.isrc` | — | — | null (non nell'export GDPR) | recuperabile via MBID lookup successivo |
| `track.mbid` | — | — | null | lookup enrichment pipeline |
| `deviceType` | `platform` | string | mapping §3.2 | |
| `deviceDetail` | `platform` | string | valore raw | |
| `country` | `conn_country` | string | ISO 3166-1 alpha-2 | |
| `ip` | `ip_addr` | string | conservato SOLO se `PrivacySettings.retainIp` | |
| `shuffle` | `shuffle` | bool | diretto | |
| `skipped` | `skipped` + `reason_end` | bool | regola derivata E1 | |
| `offline` | `offline` | bool | diretto | |
| `incognito` | `incognito_mode` | bool | diretto | |
| `reasonStart` | `reason_start` | string | diretto | |
| `reasonEnd` | `reason_end` | string | diretto | |
| `completed` | — | — | `ms_played >= durataCatalogo - 5000` | 5s tolleranza |

### 3.2 Mapping `platform` → `deviceType`

| Pattern `platform` | `deviceType` |
|---------------------|--------------|
| `/Android/i` | `mobile` |
| `/iOS|iPhone|iPad/i` | `mobile` |
| `/Windows|Linux|OS X|Mac/i` | `desktop` |
| `/web_player|WebPlayer/i` | `web` |
| `/car|CarPlay|Android Auto/i` | `car` |
| `/speaker|Cast|Sonos/i` | `speaker` |
| altro | `unknown` |

Nota: post ott-2023 `platform` è generico (`android`, `windows`, `linux`). In questi casi `deviceDetail` è meno informativo ma `deviceType` resta derivabile.

### 3.3 Regola `skipped` derivata (edge case E1)

Il campo `skipped` Spotify è inaffidabile (tutti false tra 2015-04 e 2022-10). Adottiamo:

    isSkipped = skipped === true
             OR reason_end IN ('backbtn', 'fwdbtn', 'unknown')
             OR (reason_end === 'endplay' AND ms_played < durataCatalogo * 0.80)

`durataCatalogo` è la durata del brano da metadata; se non disponibile, soglia fissa `ms_played < 30000`.

### 3.4 Library / Playlist / Artist / Album

| Entità | File sorgente | Campo chiave |
|--------|---------------|--------------|
| Artist seguito | `Follow.json` | `artist` + `spotify_artist_uri` |
| Album salvato | `YourLibrary.json` (`tracks`) | dedotto da track salvata |
| Track salvata | `YourLibrary.json` (`tracks`) | `trackUri` |
| Playlist | `Playlist*.json` | `name`, `lastModifiedDate` |
| PlaylistItem | `Playlist*.json` → `items` | `track.trackUri`, `addedDate` |

## 4. Edge case noti

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E1 | `skipped` inaffidabile 2015-04 → 2022-10 | Statistiche skip errate | Regola derivata §3.3 |
| E2 | Timestamp sovrapposti ~2.6% durata | Durata totale sovrastimata | Dedup via `eventKey` univoco; `ImportRecord.warnings` conta |
| E3 | `offline_timestamp` unità cambiate (s → ms) | Timestamp errato | Rileva valore < 1e12 → moltiplica 1000 |
| E4 | Stessa registrazione con URI diversi (singolo + album + compilation) | Conteggi frammentati | DEDUP via ISRC/MBID dopo enrichment |
| E5 | Granularità `platform` cambiata ott-2023 | Discontinuità deviceType | Mapping pattern-based §3.2 |
| E6 | Podcast / video / audiobook con `spotify_track_uri` null | Eventi incompleti | Se `episode_name` presente → tipo `podcast` (se supportato); altrimenti skip con warning |

## 5. Semantica temporale

- `ts` = **istante in cui lo stream è terminato** (fine ascolto)
- `timestamp` (unificato) = `ts`
- `startedAt` = `ts - ms_played`

## 6. Dedup tracce

- Export GDPR **non fornisce ISRC né MBID**
- `spotify_track_uri` non è ISRC/MBID (è ID proprietario Spotify)
- **DEDUP-3** si applica di default (fuzzy name+artist+duration bucket 2s)
- Dopo enrichment (MusicBrainz lookup opzionale) il canonicalKey può essere promosso a DEDUP-1/2 se ISRC/MBID trovato
- La promozione è implementata come job `rekey()` nel core

## 7. Privacy

| Dato | Default | Se `retainIp` true |
|------|---------|---------------------|
| `ip_addr` | scartato dopo derivazione `country` | conservato in `ListenEvent.ip` |
| Coordinate GPS | mai presenti nell'export | n/a |
| `SearchQueries.json` | processato, conservato in `searchQueries` (tabella dedicata, opzionale) | idem |
| `CarDetectionEvent.json` | processato SOLO se utente acconsente (opt-in esplicito separato) | idem |

Nota: `CarDetectionEvent` è sensibile (tracciamento movimenti). Trattarlo come **consenso separato** da `retainIp`.

## 8. Test — fixture atteso

File: `fixtures/synthetic-history/spotify-sample.json` (Sessione 2 — vedi sotto).

Casi minimi:
1. **Happy path**: 3 eventi normali → 3 ListenEvent, 3 track uniche
2. **Idempotenza**: re-import stesso file → 0 nuovi eventi (`eventsDuplicated = 3`)
3. **E1 skipped**: evento con `reason_end: 'fwdbtn'`, `skipped: false` → `skipped: true` derivato
4. **E3 offline**: `offline_timestamp: 1625932808` (vecchia unità) → convertito a `1625932808000`
5. **E4 URI duplicati**: due eventi con URI diversi ma stesso nome+artista+durata → una sola Track
6. **E5 platform pre/post ott-2023**: entrambi mappati a `deviceType` corretto
7. **E6 podcast**: evento con `episode_name` non null → evento tipo `podcast` o skip con warning
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
- **Ordine file**: processare i JSON in ordine cronologico inverso (più recente → più vecchio) per avere `lastSeenAt` corretto al primo passaggio

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 2 | Prima specifica completa |
| 1.0 | Sessione 2 | 🟢 APPROVED · Versione 1.0 · Sessione 2 |


===== FILE: docs/04-ANALYSIS-ALGORITHMS.md =====

# 04 — Algoritmi di Analisi

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 4
> Vincolante per: `packages/core/analysis/*` e relativi test

---

## 1. Principi generali

### 1.1 Derivati versionati

Ogni insight/sessione salvati nel DB porta un campo `derivedVersion`: stringa esadecimale (8 char) calcolata come:

    derivedVersion = sha1(JSON.stringify(configObject)).slice(0, 8)

dove `configObject` contiene tutti i parametri dell'algoritmo (threshold, window, weights). **Quando i parametri cambiano, cambia la versione**: gli insight vecchi diventano `stale` e vengono ricalcolati al prossimo avvio.

### 1.2 Incrementalità

Tutti gli algoritmi devono essere **incrementali**: dato lo stato precedente + nuovi eventi, aggiornare lo stato senza ricalcolare tutto. Serve per non bloccare l'UI durante import di file grandi.

### 1.3 Persistenza

| Entità | Tabella | Aggiornato |
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
- Usa `genre` come proxy quando disponibile (mapping genre→valence/energy di default)
- Logga warning aggregato "X eventi senza audio features"

### 1.5 Tabella config → derivedVersion

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

Dividere la sequenza cronologica di `ListenEvent` in **sessioni di ascolto continue**: una sessione è una sequenza di eventi dove ogni evento inizia entro `gapThresholdMs` dalla fine del precedente.

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
| `gapThresholdMs` | 1.800.000 (30 min) | 300.000 - 7.200.000 | Utente può personalizzare |

### 2.4 Esempio numerico

Input (3 eventi):
- E1: 10:00-10:05 (Brano A)
- E2: 10:07-10:12 (Brano B)
- E3: 11:30-11:35 (Brano C)

Gap E1→E2: 2 min < 30 min → stessa sessione
Gap E2→E3: 78 min > 30 min → nuova sessione

Output: 2 sessioni (S1: 30 min, 3 eventi, 2 track; S2: 5 min, 1 evento, 1 track)

### 2.5 Invarianti testabili

- ∀ session: `durationMs ≥ 0`
- ∀ session: `eventCount ≥ 1`
- ∀ session: `trackCount ≤ eventCount`
- ∀ session: `startTime ≤ endTime`
- Sum(session.durationMs) ≤ total listening time + (n-1) × gapThresholdMs

---

## 3. Mood Tracker

### 3.1 Scopo

Calcolare il **mood dominante** di un periodo (giorno/settimana/mese) come uno dei 6 valori: `sad | angry | neutral | calm | happy | excited`.

### 3.2 Mappatura valence/energy → mood

Il quadrante è definito da due soglie:

    valenceThreshold = 0.5
    energyThreshold = 0.5

| Valence | Energy | Mood |
|---------|--------|------|
| < 0.5 | < 0.5 | sad |
| < 0.5 | ≥ 0.5 | angry |
| [0.4, 0.6] | [0.4, 0.6] | neutral |
| ≥ 0.5 | < 0.5 | calm |
| ≥ 0.5 | [0.5, 0.75) | happy |
| ≥ 0.5 | ≥ 0.75 | excited |

Note:
- `neutral` è una **fascia centrale** (non un punto) per evitare flip-flop
- `neutral` sovrascrive `sad`/`angry`/`calm`/`happy` se entrambe le coordinate sono nella fascia [0.4, 0.6]
- `excited` richiede valence ALTA (≥0.5) E energy MOLTO ALTA (≥0.75)

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
| `neutralBand` | 0.1 | Fascia neutra ± |
| `excitedEnergyThreshold` | 0.75 | Per excited serve energy alta |
| `minEventsPerPeriod` | 3 | Sotto questo soglia → no insight |

### 3.5 Esempio numerico

Periodo: lunedì (5 eventi)
- Brano A: valence 0.3, energy 0.4, durata 200s → weight 0.83
- Brano B: valence 0.7, energy 0.8, durata 240s → weight 1.0
- Brano C: valence 0.4, energy 0.6, durata 180s → weight 0.75
- Brano D: valence 0.8, energy 0.9, durata 300s → weight 1.25
- Brano E: valence 0.5, energy 0.5, durata 220s → weight 0.92

Weighted avg valence: (0.3·0.83 + 0.7·1.0 + 0.4·0.75 + 0.8·1.25 + 0.5·0.92) / 4.75 = 0.585
Weighted avg energy: (0.4·0.83 + 0.8·1.0 + 0.6·0.75 + 0.9·1.25 + 0.5·0.92) / 4.75 = 0.675

Classify: valence ≥ 0.5, energy in [0.5, 0.75) → **happy**

### 3.6 Invarianti

- `mood ∈ {sad, angry, neutral, calm, happy, excited}`
- `avgValence ∈ [0, 1]`
- `avgEnergy ∈ [0, 1]`
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
- **nightShare**: quota ascolti notturni (00:00-05:59) — usata in Era detector
- **weekendShare**: quota sab+dom su totale
- **seasonalEntropy**: quanto è distribuito (bassa = ascolti concentrati in pochi mesi)

### 4.4 Parametri

| Parametro | Default |
|-----------|---------|
| `nightHours` | [0, 1, 2, 3, 4, 5] |
| `weekendDays` | ['Sat', 'Sun'] |
| `minEvents` | 50 (altrimenti pattern non affidabile) |

### 4.5 Invarianti

- `sum(buckets.values) ≈ 1.0` (tolleranza 0.01)
- `nightShare ∈ [0, 1]`
- `peakHour ∈ 0..23`

---

## 5. Era Detector

### 5.1 Scopo

Identificare **ere musicali**: periodi prolungati (≥14 giorni) con caratteristiche coerenti, separati da cambiamenti significativi.

### 5.2 Algoritmo — Sliding window + change point detection

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
        calm: 'Calma', happy: 'Felicità', excited: 'Energia'
      }
      return "Era " + moodNames[mood] + " " + topGenre  // es. "Era Malinconia Indie"

### 5.3 Parametri

| Parametro | Default | Range | Note |
|-----------|---------|-------|------|
| `windowDays` | 14 | 7-30 | Finestra analisi |
| `stepDays` | 7 | 3-14 | Passo scorrimento |
| `similarityThreshold` | 0.65 | 0.5-0.8 | Sotto → change point |
| `minEraDays` | 14 | 7-30 | Sotto → scartata |
| `minEventsPerWindow` | 5 | 3-10 | Sotto → finestra invalida |
| `weights.genre` | 0.5 | | Peso similarity |
| `weights.artist` | 0.3 | | |
| `weights.numeric` | 0.2 | | |

### 5.4 Esempio numerico

30 settimane di ascolto, con cambio netto alla settimana 12 (da pop a indie folk).

- Settimane 1-11: signature simile (cosine genre 0.9, Jaccard artist 0.7)
- Settimane 12-30: signature simile interna, ma similarity con settimana 11 = 0.4 (< 0.65)

Output: 2 ere separate al confine settimana 11/12.

### 5.5 Invarianti

- Ere sono **disgiunte e coprenti**: ∪ere = periodo totale, ∩ere = ∅
- `era.periodStart < era.periodEnd`
- `sum(genreDistribution.values) ≈ 1.0`
- `moodDominant ∈ {sad, angry, neutral, calm, happy, excited}`

---

## 6. Event Detector

### 6.1 Scopo

Rilevare **anomalie significative** nei pattern di ascolto che suggeriscono eventi di vita (non solo variazioni naturali).

### 6.2 Tipi di evento

| Tipo | Descrizione | Trigger |
|------|-------------|---------|
| `spike_artist` | Picco improvviso di un artista | quota artista > 2× baseline |
| `spike_genre` | Picco improvviso di un genere | quota genere > 2× baseline |
| `valence_drop` | Crollo emotivo | Δvalence > 0.25 su 14gg |
| `valence_rise` | Risalita emotiva | Δvalence > 0.25 su 14gg |
| `volume_spike` | Esplosione di ascolto | durata > 2× baseline |
| `volume_drop` | Silenzio prolungato | durata < 0.3× baseline per ≥7gg |
| `exploration` | Esplorazione intensa | ≥10 artisti nuovi in 7gg |
| `silence` | Periodo di non-ascolto | ≥3 giorni senza eventi |

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
        valence_drop: "La tua musica è diventata più malinconica",
        valence_rise: "La tua musica è diventata più allegra",
        volume_spike: "Hai ascoltato molta più musica del solito",
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
        if gap >= 3 * 86400000:  // ≥ 3 giorni
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
      // trigger: ≥10 nuovi artisti in 7 giorni

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

z = (7 - 3) / 1 = 4.0 > 2.0 → **volume_spike** rilevato con confidence min(1, 4/4) = 1.0

### 6.7 Invarianti

- `confidence ∈ [0, 1]`
- `eventType ∈ enum definito`
- Eventi non sovrapposti (dedupe mantiene solo quello con confidence più alta)
- `periodStart < periodEnd`

---

## 7. Memory Engine

### 7.1 Scopo

Generare **ricordi** giornalieri basati su 5 tipologie.

### 7.2 Tipologie e trigger

#### `on_this_day`

Trigger: esiste almeno un evento nella stessa data (mese+giorno) di `N` anni fa, con N ∈ {1, 2, 3, 5, 10}.

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

Trigger: oggi è l'anniversario del primo ascolto di un artista significativo (≥5 brani totali).

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

Trigger: oggi riascolti un artista/brano che non ascoltavi da ≥6 mesi.

    function generateReturn(today, events):
      // per ogni artista, trova il gap più lungo tra due ascolti
      // se un gap si chiude oggi dopo ≥180gg → ricordo return
      ...

#### `seasonal`

Trigger: ricorrenza stagionale (ascolti un artista/genere che hai ascoltato prevalentemente in questo mese negli anni passati).

    function generateSeasonal(today, events):
      currentMonth = monthOf(today)
      // trova artisti con ≥60% degli ascolti concentrati in currentMonth
      // se quest'anno li hai riascoltati in currentMonth → ricordo
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

    score = baseScore(memoryKind) × relevance × recency

- `baseScore`: `on_this_day=10`, `first_time=8`, `milestone=9`, `return=7`, `seasonal=6`
- `relevance`: `trackCount / medianTrackCount` (quanto è rappresentativo il brano)
- `recency`: `exp(-daysAgo / 365)` (attenuazione per distanza)

Il feed ricordi mostra i top N score per giorno.

### 7.5 Invarianti

- `memoryKind ∈ enum`
- `yearsAgo ∈ {1, 2, 3, 5, 10}` per `on_this_day`
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

Ogni volta che si cambia un parametro di default, la versione cambia e gli insight diventano `stale` → ricalcolo automatico al prossimo avvio.

---

## 10. Esempio end-to-end

**Utente**: 10.000 eventi in 2 anni.

1. Import → 10.000 ListenEvent persistiti
2. Session segmentation → ~1.500 sessioni
3. Mood tracker → 730 insight `mood_day`, 104 `mood_week`, 24 `mood_month`
4. Pattern analyzer → 3 insight (circadian, weekly, seasonal)
5. Era detector → ~4-8 ere (dipende da similarity threshold)
6. Event detector → ~10-30 eventi (spike, drop, exploration)
7. Memory engine → 1-5 ricordi generati ogni giorno

Tempo di esecuzione target su laptop medio: < 5 secondi totali (incrementale dopo primo calcolo).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 4 | Prima versione completa |


===== FILE: docs/05-ARCHITECTURE.md =====

# 05 — Architettura Tecnica

> Status: 🟢 APPROVED
> Versione: 1.0
> Ultima modifica: Sessione 9 (audit 2026-10-15)
> ADR collegati: 0001-pwa-first, 0002-local-first, 0003-adapter-pattern, 0005-sync-cloud (Fase 2)

---

## 1. Principi architetturali

| Principio | Conseguenza |
|-----------|-------------|
| **Local-first** | Tutti i dati vivono nel browser (IndexedDB). L'app funziona offline dopo il primo caricamento |
| **Privacy-first** | Nessuna telemetria (D.A.1). Le uniche chiamate di rete sono: arricchimento metadati (opzionale, governed by `PrivacySettings.enrichMetadata`), scrobbling hub (opzionale), sync cloud (Fase 2, ADR-0005) |
| **Adapter pattern** | Ogni piattaforma è un modulo indipendente che produce il formato unificato; aggiungere una piattaforma = aggiungere un adapter |
| **Analisi deterministica e documentata** | Ogni insight deriva da formule specificate in `04-ANALYSIS-ALGORITHMS.md`, testabili con fixture |
| **Progressive enhancement** | Funziona con una sola piattaforma; migliora con più sorgenti |

## 2. Diagramma a layer

    ┌────────────────────────────────────────────────┐
    │ LIVELLO 4 — PRESENTAZIONE (React PWA)          │
    │  Timeline · Home · Esplora · Analisi · Ricordi │
    │  Impostazioni · Import · Share                 │
    ├────────────────────────────────────────────────┤
    │ LIVELLO 3 — ANALYSIS ENGINE (Web Worker)       │
    │  MoodTracker · EraDetector · EventDetector     │
    │  MemoryEngine · PatternAnalyzer                │
    ├────────────────────────────────────────────────┤
    │ LIVELLO 2 — ENRICHMENT PIPELINE                │
    │  AudioFeatures · MusicBrainz lookup · Generi   │
    │  (React Query — vedi §8)                       │
    ├────────────────────────────────────────────────┤
    │ LIVELLO 1 — IMPORT ENGINE (Adapters)           │
    │  spotify · youtube · apple · deezer · tidal    │
    │  soundcloud · lastfm · listenbrainz · plex     │
    │  navidrome · manual                            │
    │            ↓ formato unificato ↓               │
    │  LOCAL DATABASE (IndexedDB / Dexie v2)         │
    └────────────────────────────────────────────────┘

## 3. Formato unificato (record di ascolto)

Gli adapter producono record conformi a `02-DATA-SCHEMA.md §3.2 (ListenEvent)`. Forma **piatta**, allineata allo schema, NON nested come nella v0.1:

    {
      "id": "uuid",
      "eventKey": "spotify:abc123",
      "platform": "spotify",
      "importId": "import-uuid",
      "timestamp": 1710523800000,      // unix ms UTC, fine ascolto
      "startedAt": 1710523555000,     // unix ms UTC, inizio ascolto (null se non noto)
      "durationMs": 245000,
      "trackId": "track-uuid",
      "completed": true,
      "skipped": false,
      "shuffle": true,
      "offline": false,
      "incognito": false,
      "reasonStart": "playbtn",
      "reasonEnd": "endplay",
      "deviceType": "mobile",
      "deviceDetail": "iPhone 15",
      "ip": null,                     // popolato SOLO se PrivacySettings.retainIp
      "country": "IT",                // sempre derivato (privacy-by-design)
      "day": "2024-03-15"             // derivato, indicizzato
    }

I campi contestuali sono **opzionali**: le piattaforme che non li forniscono li lasciano null. Le analisi devono degradare con grazia in loro assenza.

### 3.1 Trasformazione adapter → core

L'adapter emette un `RawListenEvent` con metadati nativi della piattaforma (`sourceTrackUri`, `sourceArtistName`, `sourceAlbumName`, `rawTimestamp`, `sourceDurationMs`, ...).

Il core trasforma ogni `RawListenEvent` in `ListenEvent` (persistito in `02§3.2`) applicando in ordine:

1. **Normalizzazione timestamp** → UTC unix ms (`timestamp` = fine ascolto, `startedAt` se noto)
2. **Calcolo `eventKey`** (vedi §3.2)
3. **Risoluzione `trackId`** via regole DEDUP di `02§5` (ISRC → MBID → fuzzy con `durationBucketMs`)
4. **Derivazione `day`** da `timestamp` (UTC, formato `YYYY-MM-DD`)
5. **Mapping `platform` raw** → `PlatformId` normalizzato
6. **Mapping device** (es. Spotify `iOS`+`iPhone15,2` → `DeviceType.mobile` + `deviceDetail` libero)

Questa separazione permette di:
- Testare la pipeline di normalizzazione in isolamento con fixture (`10-TESTING.md` §3)
- Cambiare il formato nativo di un adapter senza toccare lo schema
- Far evolvere `DEDUP` senza riscrivere gli adapter

### 3.2 Calcolo `eventKey`

    eventKey =
      platform + ':' +
      (sourceEventId ?? sha1(trackId + '|' + timestamp + '|' + durationMs))

`sourceEventId` è fornito dall'adapter se la piattaforma espone un identificativo nativo stabile (es. Spotify `trackId` + `played_at`); altrimenti fallback SHA-1. Garantisce idempotenza (D.1.2): reimportare lo stesso file non duplica nulla.

## 4. Adapter pattern — contratto

Ogni adapter espone la stessa interfaccia logica:

    interface PlatformAdapter {
      readonly platform: PlatformId;
      readonly name: string;          // es. "Spotify"
      readonly version: string;       // semver adapter
      detect(input: File | Blob): boolean | Promise<boolean>;
      parse(
        input: File | Blob,
        options?: { signal?: AbortSignal }
      ): AsyncIterable<RawListenEvent>;
      parseLibrary?(input: File | Blob): Promise<LibrarySnapshot>;
    }

**Regole**:
- `parse` è **streaming** (AsyncIterable): mai caricare 200k eventi in memoria in un colpo
- **Cancellazione cooperativa**: l'utente può annullare l'import a metà (vedi `06§2.4 Processing`); l'adapter controlla `signal.aborted` ad ogni `yield` (o ogni N eventi per performance) e lancia `DOMException('AbortError')` su cancel
- **Partial recovery**: se il file è corrotto a metà, gli eventi validi parsati prima dell'errore sono **persistiti** (transazione in `02§7`)
- `detect()` ritorna `boolean | Promise<boolean>` (D.A.8): supporta detection statica (euristica su header/campi) **e** remota (ping credenziali, Fase 2). I caller devono **sempre** trattarlo come Promise con `await`
- Ogni adapter dichiara i propri edge case in `01-PLATFORMS.md` §5
- Output grezzo → normalizzazione UTC → `eventKey` calcolato (`§3.2`) → DEDUP (`02§5`) → upsert in Dexie

**Errori**:

    class AdapterError extends Error {
      code: 'INVALID_FORMAT' | 'TRUNCATED' | 'UNSUPPORTED_VERSION' | 'INTERNAL';
      recoverable: boolean;   // se true, partialEvents è stato persistito
      partialEvents: number;  // quanti eventi validi parsati prima dell'errore
    }

| `code` | Quando | `recoverable` |
|--------|--------|---------------|
| `INVALID_FORMAT` | File completamente sbagliato o versione non supportata | `false` |
| `TRUNCATED` | File/zip corrotto a metà | `true` |
| `UNSUPPORTED_VERSION` | Schema della piattaforma cambiato, serve aggiornare adapter | `false` |
| `INTERNAL` | Bug dell'adapter | dipende |

`sourceEventId` (citato dalla regola `eventKey` in `02§3.2`) è opzionale e fornito dall'adapter quando la piattaforma espone un ID nativo stabile (es. Spotify `trackId` + `played_at`). In assenza, si usa lo SHA-1 di fallback.

## 5. Database locale

- **Engine**: IndexedDB via Dexie.js
- **Versione corrente**: Dexie v2 (vedi `02-DATA-SCHEMA.md §6`)
- **Tabelle (12)**: `listens`, `tracks`, `artists`, `albums`, `features`, `sessions`, `insights`, `imports`, `library`, `playlists`, `playlistItems`, `searchQueries`
- **PK reali**:
  - `listens`: `eventKey` (UNIQUE, idempotenza)
  - `tracks`: `canonicalKey` (UNIQUE, dedup)
  - `features`: `trackId` (1:1)
  - `playlistItems`: `[playlistId+trackId]` (composita)
- **Indici critici**: `listens.timestamp`, `listens.day`, `listens.trackId`, `tracks.isrc`, `tracks.mbid`, `searchQueries.[platform+normalized]`
- **Migrazioni**: versionate in Dexie; ogni cambio schema = nuova versione + funzione di upgrade; **mai drop di tabelle utente** (MIG-1)
- **Transazioni**: ogni import scrive in una **singola transazione** che include `listens` + `tracks` + `artists` upsert. In caso di `AdapterError` con `recoverable: true` (`§4`), la tx viene committata con i record validi già scritti; se `recoverable: false`, rollback totale
- **Read-only mode**: se IndexedDB è in quota esaurita, in `VersionError` (DB lock) o in blocco browser (private mode Safari, edge cases), l'app entra in **read-only mode**: nessuna scrittura accettata, messaggio utente localizzato in `error.dbCritical` / nuovo `error.dbReadOnly`, e un banner persistente invita a liberare spazio o ricaricare
- Dettaglio completo in `02-DATA-SCHEMA.md`

## 6. Pipeline di arricchimento

Problema: Spotify ha deprecato le audio-features (nov 2024); Apple non le ha mai avute.

**Strategia a cascata per ogni traccia** (D.A.6):

1. **Cache locale** (feature già calcolata/scaricata)
2. **Essentia.js (WASM) in-browser** — provider di default quando è disponibile un preview audio (30s) dal catalogo
3. **AcousticBrainz** — bonus se il brano ha un MBID mappato (lookup per recording_id)
4. **Fallback euristico** (`source: 'heuristic'`) — stime da metadata (BPM da genre, energia da popolarità, valence da key/mode); qualità bassa ma copre il 100% del catalogo
5. **Niente feature**: le analisi basate su valence/energy degradano a mood-by-genre (vedi `04-ANALYSIS-ALGORITHMS.md`)

Ogni feature salvata registra la **fonte** (`AudioFeatures.source: 'essentia' | 'acousticbrainz' | 'heuristic' | 'manual'`) per trasparenza e ricalcolo futuro. **Rimosse** le voci placeholder `api_freqblog` / `api_musicae` (non sono provider reali).

### 6.1 Trigger conditions

La pipeline di arricchimento è invocata in 3 contesti:

| Trigger | Quando | Comportamento |
|---------|--------|---------------|
| **on-import** | Al termine di un import (transazione `02§7` committata) | Per ogni nuovo `trackId` senza `AudioFeatures`, prova Essentia → AB → euristica |
| **on-demand** | L'utente apre una schermata analisi (`06§2.9 Analisi`, `QuadrantChart`) | Refresh lazy delle feature mancanti per i brani nel viewport |
| **scheduled** | Job in Web Worker idle (`requestIdleCallback`), max 5 min/giorno | Backfill di feature mancanti in batch; throttle 1 track/sec per non impattare la UI |

L'arricchimento **non blocca mai l'import**: se Essentia o AB falliscono, si cade immediatamente al fallback euristico, e l'utente vede i risultati senza attendere.

### 6.2 Caching policy

- **Cache locale**: tabella `features` con PK `trackId` (1:1), indicizzata per `source`
- **TTL**: nessuno per i risultati Essentia/heuristica (calcolo locale, deterministico). Per AcousticBrainz: 90 giorni (i dataset AB sono congelati per data di dump)
- **LRU**: limite 50k record; oltre, evict LRU basato su `lastSeenAt` del track
- **Invalidazione**: bump del `schemaVersion` in `AudioFeatures` (vedi `02§3.4`) quando cambia la versione Essentia o il modello euristica; i record con `schemaVersion` vecchio vengono ricalcolati al prossimo trigger
- **Disattivazione**: se `PrivacySettings.enrichMetadata === false`, la cache non viene letta né scritta; le analisi degradano a mood-by-genre

## 7. Analysis engine

Esegue in **Web Worker** dedicato per non bloccare la UI. Moduli: MoodTracker, EraDetector, EventDetector, MemoryEngine, PatternAnalyzer. Ogni algoritmo è specificato con formula, parametri e esempio input→output in `04-ANALYSIS-ALGORITHMS.md`. I risultati sono persistiti in `insights` con versionamento del parametro-set (`derivedVersion`) per ricalcolo coerente (MIG-3).

### 7.1 Scheduling e incrementalità

- Ogni algoritmo gira in chunk con **budget 50ms** schedulato via `requestIdleCallback` (o fallback `setTimeout(0)`)
- Gli algoritmi sono **incrementali** (`04§1.2`): ricevono `(state, newEvents)` invece di `(allEvents)`; `state` è persistito in `insights`
- La pipeline gira **on-trigger** (import completato, on-demand dall'utente) o in **background idle**; max 5 min/giorno di budget
- L'UI resta a 60fps: nessun algoritmo blocca il main thread

### 7.2 Failure isolation

- Ogni modulo è wrappato in un `try/catch` interno: un crash (es. divisione per zero su dataset patologico) **non blocca gli altri moduli**
- L'errore viene loggato in console con stack trace + `module` + `inputSummary` (no PII)
- L'insight parziale viene marcato con `status: 'pending'` e `confidence: 0`; l'utente vede un placeholder "Insight non disponibile"
- Test in `10-TESTING.md` §3 prevedono fixture patologiche (eventi con `valence: NaN`, durate 0, overlap totale)

### 7.3 Versioning esplicito

- `derivedVersion` calcolato come `sha1(JSON.stringify(configObject)).slice(0, 8)` (`04§1.1`)
- Quando `configObject` cambia (parametri, pesi, soglie), `derivedVersion` cambia → insight vecchi marcati `stale`
- Al prossimo avvio (o trigger), `recompute()` ricalcola solo gli insight con `derivedVersion` non corrente
- L'utente vede una progress bar "Aggiornamento insights in corso (X%)" durante il backfill

## 8. Stack tecnologico

| Componente | Scelta | Motivazione |
|------------|--------|-------------|
| Runtime UI | React 19 + TypeScript 5.6+ + Vite 6 | Ecosistema, PWA-first |
| PWA | vite-plugin-pwa (Workbox) | Offline, installabilità |
| Stato client | **Zustand** (UI) + **dexie-react-hooks** (DB live queries) | Local-first: stato derivato da Dexie, no store globale |
| Data fetching remoto | **React Query 5** solo per enrichment (D.A.5) | Chiamate a MB/Last.fm; niente su dati core |
| DB locale | **Dexie 4** (IndexedDB) v2 schema | API matura, migrazioni |
| Schema validation | **Zod 3** | `RawListenEvent`, payload adapter, form |
| Form | **react-hook-form** + `@hookform/resolvers/zod` | Settings/Import |
| i18n | **i18next** + react-i18next | `08§7`, Story 0.6 |
| Date/time | **date-fns** + date-fns-tz | `userTimezone` PatternPayload (`02§4`) |
| Worker bridge | **Comlink 4** | Typed RPC main↔worker (`§7`) |
| Grafici | **Recharts 2.15+** standard + **D3 7** solo per Timeline (D.A.4, lazy import) | 90% Recharts, Timeline custom |
| UI kit | **Tailwind 4** + shadcn/ui | Coerenza col design system |
| Parsing | **PapaParse** (CSV), JSON nativo, streaming | File grandi |
| Audio features | **Essentia.js (WASM)** (D.A.6) + AcousticBrainz bonus + fallback euristico | Open source, locale, no rete |
| Logger | **core/logger** wrapper | Schema `{level, module, msg, ctx}` consistente, no PII |
| Test | **Vitest 2+** + fake-indexeddb + **MSW** + **Playwright 1.5+** | Unit + e2e + API mock |
| Coverage | **@vitest/coverage-v8** per package | Soglie da `10§2` |
| Build | Vite 6 + **Turborepo** | Monorepo incrementale |
| Tooling | **ESLint 9** + Prettier 3 + Husky + lint-staged + commitlint | Convenzioni `AGENTS.md` |
| Bundle analyzer | rollup-plugin-visualizer | NFR budget 300KB (`§10`) |
| Desktop (Fase 2) | Tauri 2.0 | 10x più leggero di Electron |
| **Sync cloud (Fase 2+, ADR-0005)** | **Placeholder** — non implementato nel MVP (D.A.7). Servizio self-hosted opzionale con E2EE | Previsto ma non vincolante per Fase 0/1 |

### 8.1 Tooling dev

- **Linting**: ESLint 9 (flat config) + plugin React/TS/Vitest, Prettier 3
- **Hook pre-commit**: Husky + lint-staged (lint + format solo sui file staged)
- **Commit**: commitlint enforce Conventional Commits (vedi `AGENTS.md` §Git workflow)
- **TypeScript**: 5.6+ con `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **Path aliases**: `@core/*`, `@ui/*`, `@web/*` (vedi `§9` monorepo)
- **`fake-indexeddb`**: polyfill per test Node, configurato in `vitest.setup.ts`
- **Fast-check pre-flight** (smoke test del DB): comando `db.fastCheck()` esposto da `core/db` (vedi `10-TESTING.md §3`)
- **Turborepo**: pipeline `build → test → lint` cacheata per package

## 9. Struttura monorepo (target Fase 0 tecnica)

    life-soundtrack/
    ├── apps/
    │   ├── web/                  # PWA principale
    │   └── desktop/              # Tauri (Fase 2)
    ├── packages/
    │   ├── core/
    │   │   ├── adapters/         # un modulo per piattaforma
    │   │   ├── analysis/         # Web Worker
    │   │   ├── enrichment/       # React Query per MB/Last.fm
    │   │   ├── schema/           # tipi TypeScript condivisi (= 02)
    │   │   ├── db/               # Dexie wrapper
    │   │   └── logger/           # wrapper logger strutturato
    │   ├── ui/                   # design system componentizzato
    │   └── config/               # tsconfig, eslint, vitest condivisi
    ├── docs/ · design/ · fixtures/ · scripts/

### 9.1 Convenzioni package

- **Naming**: scope `@ls/*` (es. `@ls/core`, `@ls/ui`, `@ls/web`, `@ls/config`)
- **Versioning**: tutti i package partono da `0.1.0`; bump sincronizzato in fase 1 release (changeset-driven)
- **Entry point**: `src/index.ts` con `export` espliciti; niente barrel file "tutto da index"
- **`package.json` minimi**: solo `name`, `version`, `type: "module"`, `main`, `types`, `exports`, `scripts`, `dependencies`, `devDependencies`, `peerDependencies` (no `private` fittizi)
- **`exports` map**: ogni package dichiara i subpath (`./adapters/spotify`, `./db`, ...) per consentire tree-shaking
- **Lockfile unico**: `pnpm-lock.yaml` alla root, monorepo-aware (`pnpm-workspace.yaml` con `packages/*`)

### 9.2 Dipendenze tra package (regola aciclica)

Le frecce rappresentano `import from`. Le dipendenze inverse sono **vietate**:

    @ls/web  ──┬──> @ls/ui
               ├──> @ls/core
               └──> @ls/config (devDep)
    
    @ls/ui    ────> @ls/core (solo tipi, non runtime)
    @ls/core  ────> (niente, è foglia)
    @ls/config───> (niente, è foglia)

Regole pratiche:
- `@ls/core` non importa MAI da `@ls/ui` né `@ls/web` (è runtime-agnostic, gira anche nel Worker)
- `@ls/core/analysis` non importa da React (è puro TS, gira in Web Worker)
- `@ls/ui` può importare **solo tipi** da `@ls/core` (no runtime coupling); i consumer passano i dati via props
- `@ls/web` è l'unico che importa da tutto: orchestra UI + chiama core + usa config

## 10. Requisiti non funzionali

| Requisito | Target |
|-----------|--------|
| Import 50k eventi | < 30 s (revisione M13: 50k è il target realistico Fase 0) |
| Import 100k eventi | < 90 s (best effort) |
| First contentful paint | < 1.5 s |
| Bundle iniziale | < 300 KB gzip (worker, D3, WASM lazy) |
| Offline | 100% funzionale dopo primo load |
| Privacy | Zero PII in uscita senza toggle esplicito (D.A.1) |
| Accessibilità | WCAG 2.1 AA |
| Browser | Chrome/Edge 90+, Firefox 90+, Safari 15+ |

### 10.1 Budget di performance (per route/feature)

I target sono **P95** (95° percentile) misurati su device baseline (`§10.2`):

| Route / Feature | Metrica | Target P95 |
|-----------------|---------|------------|
| First load (cold cache) | FCP | < 1.5 s |
| Home (schermata ⑥) | Render after DB query | < 200 ms |
| Timeline (schermata ⑦) | Initial paint + zoom 1y | < 400 ms |
| Timeline zoom 1d | Re-render con filtri | < 250 ms |
| Esplora search (schermata ⑨) | Autocomplete response | < 150 ms |
| Import 50k eventi | E2E (drag → "Import completato") | < 30 s |
| Import 100k eventi | E2E | < 90 s |
| Settings toggle | Save + re-render | < 100 ms |
| PWA install prompt | First paint | < 1 s |
| Memory footprint (idle) | Heap dopo 10 min su Home | < 250 MB |

I budget sono enforced da:
- **Bundle**: `rollup-plugin-visualizer` in CI; fallisce la build se main chunk > 300KB gzip
- **Runtime**: Web Vitals reporting via `core/logger` (no telemetry esterna, vedi D.A.1)
- **E2E**: Playwright in CI con tracing; soglie via `playwright.config.ts` `expect.toHavePerformanceTiming`

### 10.2 Dispositivi target

L'ottimizzazione è **mobile-first** (la maggioranza degli ascolti musicali avviene da mobile).

**Baseline** (target minimo garantito):
- iPhone 12 (A14, 4GB RAM, Safari iOS 15)
- Google Pixel 6 (Tensor, 8GB RAM, Chrome Android)
- Mid-range Android (Snapdragon 7-series, 6GB RAM, Chrome)

**Desktop**:
- 1080p+ (target primario)
- 1440p+ (layout esteso, contenuto centrato max 1400px vedi `15§10`)

**Limiti hardware**:
- IndexedDB quota: assume `navigator.storage.estimate()` > 1GB disponibile; degradare a read-only sotto soglia (`§5`)
- WebAssembly SIMD: opzionale, fallback scalare se non disponibile (Essentia.js)
- Touch target ≥ 44px (vedi `15§9` a11y)
- Connessione di rete: assume offline dopo primo load; enrichment richiede rete esplicita

## 11. App update management (PWA)

Le PWA richiedono un ciclo di aggiornamento **esplicito e controllato** perché l'utente non scarica attivamente: il Service Worker aggiorna la cache in background. Senza gestione, l'utente può restare bloccato su una versione vecchia (anche con cache buggate).

### 11.1 Version manifest

- L'app pubblica un `version.json` su `/version.json` con `{version, buildHash, releasedAt, minSchemaVersion}`
- Il client confronta a ogni boot; se `version` corrente > versione cached → update disponibile
- `minSchemaVersion` indica la **versione minima di `02-DATA-SCHEMA.md`** che il client sa gestire; se il DB locale ha `schemaVersion < minSchemaVersion`, l'utente **deve** aggiornare prima di continuare

### 11.2 Service Worker update lifecycle

Gestito da **Workbox** (`vite-plugin-pwa`):

1. **Install**: SW nuovo scarica i precached assets in `tempCache`
2. **Waiting**: SW nuovo aspetta che tutte le tab del SW vecchio siano chiuse
3. **Activate**: SW nuovo prende il controllo, pulisce `oldCaches`
4. **Clients claim**: il SW nuovo si annuncia via `clients.claim()` solo se la versione è **soft-compatible** (minor/patch); per major → attende chiusura tab

### 11.3 Prompt policy

| Tipo cambio | Comportamento |
|-------------|---------------|
| **Patch** (es. 1.0.0 → 1.0.1) | Auto-apply al prossimo boot, nessun prompt |
| **Minor** (es. 1.0.0 → 1.1.0) | Banner soft: "Nuova versione disponibile" con CTA "Aggiorna ora" / "Più tardi" |
| **Major** (es. 1.x → 2.x) | **Modal bloccante** se c'è una migrazione DB; altrimenti banner come minor |

Il prompt è gestito dall'hook `useAppUpdate()` in `@ls/web/hooks`, che ascolta `serviceWorker.controllerchange` e il custom event `ls:update-available`.

### 11.4 Migrazione DB tra versioni

Quando una nuova versione di `02-DATA-SCHEMA.md` viene rilasciata, il client:

1. Confronta `currentDbVersion` (letto da `db.verno`) con `expectedDbVersion` (build-time constant)
2. Se `currentDbVersion < expectedDbVersion`: esegue le funzioni di upgrade di Dexie (`02§7` MIG-1..4) in sequenza
3. Se l'upgrade fallisce: rollback all'ultima versione funzionante via SW + banner "Ripristino versione precedente" (solo per failure di migrazione, NON per failure di feature)

### 11.5 Cosa NON è qui

- Dettaglio implementativo di Workbox (vedi Story 0.5 + `12-DEVOPS.md`)
- Changelog UI / "What's new" (vedi Story dedicata, `11-BACKLOG.md` Story 6.2)
- Operazioni di manutenzione DB (vedi `§12`)

## 12. Database maintenance

Operazioni di manutenzione che il client deve supportare per garantire salute del DB locale nel tempo. Sono **non-bloccanti** per l'utente: girano in background, con throttling, e notifichino l'utente solo se rilevano problemi.

### 12.1 Operazioni standard

| Operazione | Quando | Cosa fa | Costo |
|------------|--------|---------|-------|
| `recount()` | Dopo ogni import + settimanale | Ricalcola `listenCount` denormalizzati su tracks/artists | O(n listens) |
| `rekey()` | Dopo enrichment con ISRC/MBID | Promuove `canonicalKey` da `fuzzy:` a `isrc:`/`mbid:`, unisce duplicati | O(n tracks) |
| `orphanCleanup()` | Mensile | Rimuove `tracks`/`artists` non referenziati da `listens` né da `library` | O(n tracks) |
| `indexRebuild()` | Manuale + dopo migrazione | Ricostruisce indici Dexie se corrotti | Lock lungo |
| `fastCheck()` | Ad ogni boot (in dev/prod) | Smoke test: DB apribile, schema version corretto, indici funzionanti | < 100ms |
| `quotaCheck()` | Settimanale | `navigator.storage.estimate()` → warning se > 80% | < 50ms |
| `compact()` | Manuale (utente) | `IDBObjectStore` compaction se supportato | Variabile |

### 12.2 Scheduling

- **On-trigger**: `recount` e `rekey` dopo ogni import (transazione `02§7`)
- **Scheduled**: `orphanCleanup`, `quotaCheck` via Web Worker in `requestIdleCallback`, max 5 min/giorno (cumulativo con `§7.1`)
- **Manuale**: `indexRebuild`, `compact` da pulsante in Settings → "Manutenzione DB" (raro)
- **Boot**: `fastCheck` sempre; se fallisce, l'app entra in read-only mode (`§5`)

### 12.3 Health monitoring (no telemetry, D.A.1)

- I risultati di `fastCheck` / `quotaCheck` sono loggati in `core/logger` localmente
- L'utente vede un badge "Tutto ok" o un banner "Spazio in esaurimento" in Settings → Manutenzione
- Un contatore anonimo `lastMaintenance: { recount, rekey, orphan, fastCheck }` è mostrato all'utente per trasparenza
- **Nessun dato** viene inviato a server (coerente con ADR-0002)

### 12.4 Migrazioni schema (MIG-1..4)

Le migrazioni sono definite in `02-DATA-SCHEMA.md §7`. Regole di processo:

1. **Mai drop di tabelle utente** (MIG-1)
2. Ogni cambio schema = `db.version(n+1).stores({...}).upgrade(tx => ...)` con **funzione di upgrade testata** (vedi `10-TESTING.md §4`)
3. Le tabelle derivate (`sessions`, `insights`) sono **ricostruibili** con `recompute()` (MIG-2)
4. I parametri di analisi cambiano `derivedVersion` (MIG-3)
5. I contatori denormalizzati sono ricalcolabili con `recount()` (MIG-4)

Una migration che fallisce **non corrompe il DB**: la transazione Dexie fa rollback automatico. L'utente vede un banner "Aggiornamento DB non riuscito, ripristino versione precedente" (`11.4`).

### 12.5 Cosa NON è qui

- Backup cloud (non c'è cloud in MVP, vedi D.A.7)
- Sync DB (vedi ADR-0005, Fase 2)
- Operazioni di rete di qualsiasi tipo
- Implementazione dettagliata di `recount`/`rekey`/etc (vedi Story 0.2 + `10-TESTING.md`)

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Consolidamento dalle sessioni esplorative |
| 0.2 | Sessione 9 (2026-10-15) | Audit: §3 formato unificato riallineato a 02 (piatto, eventKey, day); §3.1 pipeline 6 step RawListenEvent→ListenEvent; §3.2 formula `eventKey`; §4 contratto esteso con `name`/`version`, `AbortSignal`, `AdapterError` con `recoverable` e `partialEvents`; §4 `detect(): boolean \| Promise<boolean>` (D.A.8); §5 allineato a Dexie v2 (12 tabelle); §5 + transazioni e read-only mode; §6 pipeline Essentia→AB→euristica (D.A.6); §6.1 trigger conditions (on-import/on-demand/scheduled); §6.2 caching policy (TTL, LRU, invalidazione); §7.1 scheduling 50ms chunk + incrementalità; §7.2 failure isolation; §7.3 versioning esplicito; §8 stack esteso: TS 5.6, Vite 6, Dexie 4, React Query 5, Tailwind 4, Recharts 2.15, D3 7, Tauri 2, Zod 3, react-hook-form, i18next, date-fns(-tz), Comlink 4, MSW, Playwright 1.5+, @vitest/coverage-v8, rollup-plugin-visualizer, core/logger; §8.1 tooling dev (ESLint 9 flat, Prettier 3, Husky, lint-staged, commitlint, TS strict); §9 + logger/ in core; §9.1 convenzioni package (`@ls/*`, exports map, lockfile unico); §9.2 regole acicliche (core/runtime-agnostic, ui solo tipi, web orchestra); §10 NFR rivisti (M13); §10.1 budget performance P95 per route; §10.2 dispositivi target (mobile-first, baseline iPhone 12/Pixel 6); §11 App update management (PWA) — version manifest, SW lifecycle Workbox, prompt policy patch/minor/major, migrazione DB tra versioni; §12 Database maintenance — recount/rekey/orphanCleanup/indexRebuild/fastCheck/quotaCheck/compact, scheduling, health monitoring locale, MIG-1..4; aggiunti fast-check, fake-indexeddb, Turborepo |
| 1.0 | Sessione 9 (2026-10-15) | 🟢 APPROVED · Promozione a versione vincolante dopo review completa di tutte le 12 sezioni con Boss. Sblocca story 0.1 `agent-ready` |


===== FILE: docs/06-UX-FLOWS-STATES.md =====

# 06 — UX Flows e Stati per Schermata

> Status: 🟡 DRAFT · Versione 0.2 · Sessione 9 (audit 2026-10-15)
> Vincolante per: UI implementation, test E2E, copy

---

## 1. Matrice stati globale

Ogni schermata può trovarsi in uno di questi stati:

| Stato | Descrizione | Comportamento |
|-------|-------------|---------------|
| `loading` | Dati/caricamento in corso | Spinner/skeleton, nessuna azione utente |
| `empty` | Nessun dato disponibile | Illustrazione + CTA di uscita |
| `partial` | Alcuni dati, non tutti | Funzionalità ridotte + prompt per completare |
| `ready` | Stato normale | Tutte le funzionalità attive |
| `error` | Errore bloccante | Messaggio + retry + fallback |
| `offline` | Nessuna connessione (solo per feature cloud) | Messaggio + cache locale |

Regola: **mai schermate bianche**. Ogni stato ha un design definito in `15-DESIGN-SYSTEM.md` §Empty States.

## 2. Catalogo schermate con stati

### 2.1 ① Benvenuto

| Stato | Contenuto | CTA |
|-------|-----------|-----|
| `ready` (unico) | Logo + tagline + bottone | `i18n: onboarding.start` → ② |

Note: nessuna gestione errore (schermata statica).

### 2.2 ② Privacy

| Stato | Contenuto | CTA |
|-------|-----------|-----|
| `ready` | Shield + 3 garanzie + bottone | `i18n: onboarding.understood` → ③ |

### 2.3 ③ Import

| Stato | Comportamento |
|-------|---------------|
| `ready` | Lista PlatformCard (tutte vuote) |
| `partial` | ≥1 piattaforma connessa, bottone "Importa tutto" attivo |
| `loading` | DropZone mostra "Validazione..." durante drop |
| `error` | Piattaforma con file invalido → messaggio specifico sotto la card |
| `empty` | (non applicabile: c'è sempre la lista piattaforme) |

**Transizioni**:
- Drop file → stato `loading` della PlatformCard (spinner interno)
- Validazione fallita → stato `error` della card con messaggio (es. "Questo file sembra di Apple Music, non di Spotify")
- Validazione OK → stato `done` della card con badge verde e conteggio
- "Importa tutto" disabilitato se 0 piattaforme in stato `done`

**Edge case UX**:
- Trascinamento di file non supportato → toast "Formato non supportato"
- Doppio drop stesso file (stesso `fileHash`) → toast "File già importato, operazione idempotente" con conteggio `eventsDuplicated`. **Non blocchiamo il re-import** (coerente con D.1.2 di `02-DATA-SCHEMA.md`): l'utente può forzare il re-import cliccando "Riprocessa" e il sistema deduplica via `eventKey`.
- File > 500MB → warning "File grande, potrebbe richiedere qualche minuto"

### 2.4 ④ Processing

| Stato | Contenuto |
|-------|-----------|
| `loading` | Progress ring + counter live + equalizer animato |
| `error` | Messaggio errore + "Riprova" / "Annulla" |
| `ready` | (transizione automatica a ⑤) |

**Counter live** (aggiornati ogni 500ms):
- Eventi analizzati
- Artisti riconosciuti
- Ere musicali in formazione (stima)

**Annullamento**: utente può annullare; import parziali sono salvati, UI torna a ③ con stato `partial`.

### 2.5 ⑤ Prima Rivelazione Timeline

| Stato | Note |
|-------|------|
| `ready` | Mostra una sola volta (flag `first_reveal_done` in localStorage) |
| `loading` | Animazione di formazione ere (sequenza 2016→oggi, 3s) |

**Comportamento**:
- Animazione non skippabile (momento wow deliberato)
- Pulsante "Salta" visibile ma discreto in basso a destra
- Click su un'era durante l'animazione → interrupt e navigazione a ⑧
- Dopo completamento → pulsante "Esplora la tua timeline" → ⑦

### 2.6 ⑥ Home

| Stato | Comportamento |
|-------|---------------|
| `empty` | Empty state: "Importa i tuoi dati per vedere la tua timeline" → ③ |
| `partial` | <100 eventi totali: mostra stats base + messaggio "Più dati importi, più la tua storia diventa ricca" |
| `ready` | 4 StatCard + MemoryCard + BarWeek + mood settimana |
| `loading` | Skeleton su tutte le card durante ricalcolo |

**Animazioni**:
- StatCard: count-up numeri all'apparizione (600ms, easing-out, vedi `design/tokens.json` `motion.countUp.duration`)
- MemoryCard: fade-in con delay 200ms
- BarWeek: barre che crescono con stagger

**Refresh**:
- Pull-to-refresh su mobile
- Auto-refresh all'apertura app se dati modificati

### 2.7 ⑦ Timeline

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Non hai ancora abbastanza dati per una timeline" → suggerisce import |
| `partial` | <6 mesi di dati: timeline presente ma con avviso "Timeline parziale" |
| `loading` | Skeleton chart durante cambio granularità |
| `ready` | EraBands + StreamChart + MoodLine sincronizzati |
| `error` | "Errore caricamento timeline" + retry |

**Granularità**: toggle Anni/Mesi/Settimane/Giorni. Cambio granularità = transizione fade 200ms.

**Sincronizzazione visualizzazioni**:
- Hover su EraBand → highlight punto corrispondente in StreamChart e MoodLine
- Hover su punto MoodLine → highlight EraBand corrispondente
- Click su EraBand → navigazione a ⑧

**Performance**:
- Lazy rendering di ere fuori viewport (virtualized list)
- Debounce hover 50ms

### 2.8 ⑧ Dettaglio Era

| Stato | Comportamento |
|-------|---------------|
| `ready` | Banner + stats + top artists + top tracks + chart |
| `loading` | Skeleton dettagliato |
| `error` | "Impossibile caricare i dettagli" + back button |

**Interazioni**:
- Click artista → ⑨ filtrato su quell'artista
- Click brano → modal con dettagli brano (mood, periodo, contesto)
- "Rivivi questo periodo" → player preview (opzionale) o lista scroll

### 2.9 ⑨ Esplora

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Nessun artista/brano/album da esplorare" → suggerisce import |
| `ready` | Search + tabs + griglie |
| `loading` | Skeleton + spinner search |
| `no-results` | "Nessun risultato per X" + suggerimenti |

**Tabs**: Artisti, Brani, Album, Generi, Mood. Cambio tab = transizione slide 200ms.

**Search**:
- Autocomplete su propri dati (non catalogo globale)
- Debounce 300ms
- Risultati ordinati per listenCount

**Mood pills**: riga in basso con 6 emoji. Click = filtro. Pill attivo ha glow.

### 2.10 ⑩ Analisi — Mappa Emotiva

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Servono almeno 3 mesi di dati per la mappa emotiva" |
| `partial` | 3-6 mesi: mappa parziale + avviso |
| `ready` | QuadrantChart + line charts + insight narrativo |
| `loading` | Skeleton grafici |

**Interazioni**:
- Click su punto mese → highlight nelle line chart sotto
- Hover su punto → tooltip con "Marzo 2024 — valence 0.31, energy 0.42, mood sad"
- Selettore periodo (anno) in alto

### 2.11 ⑪ Ricordi (mobile)

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Nessun ricordo per oggi" + "Guarda tutti i ricordi" |
| `ready` | Feed scrollabile di MemoryCard |
| `loading` | Skeleton 3 card + infinite scroll |
| `error` | "Errore caricamento ricordi" + retry |

**Infinite scroll**: carica 10 ricordi alla volta.

**Swipe actions**:
- Swipe left → "Nascondi questo tipo di ricordo"
- Swipe right → "Salva nei preferiti"

### 2.12 ⑫ Share Sheet

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

**Bottom sheet**: swipe down o tap fuori → chiudi.

### 2.13 ⑬ Impostazioni

| Stato | Sempre ready |

**Sezioni**:
1. **Piattaforme collegate**: lista con stato (connected/disconnected) + reconnect/disconnect
2. **Privacy**: 3 toggle + spiegazioni
3. **Dati**: "Esporta tutto (JSON)" + "Cancella tutti i dati" (rosso, con conferma doppia)
4. **Preferenze**: tema, lingua

**Cancella dati**:
- Click → modal conferma 1: "Sicuro?"
- Conferma → modal 2: "Digita ELIMINA per confermare"
- Input corretto → delete + redirect a ⑭ Empty

### 2.14 ⑭ Empty State

| Stato | Comportamento |
|-------|---------------|
| `empty` | Illustrazione + "La tua storia inizia qui" + CTA Import + CTA Demo |

**Variante per sezione**:
- Home: "Importa i tuoi dati di streaming"
- Timeline: "Importa per vedere la tua timeline"
- Esplora: "Importa per esplorare il tuo catalogo"
- Analisi: "Importa per vedere le tue analisi"
- Ricordi: "Importa per generare ricordi"

**Demo mode**: click su "Scopri come funziona" → carica fixture `demo-user.json` con 1 anno di storia sintetica, flag `demo=true` (tutti i dati cancellabili con un click).

## 3. Flussi utente principali

### 3.1 Flusso Onboarding (prima volta)

    ① Benvenuto
       │
       ▼ (tap "Inizia il viaggio")
    ② Privacy
       │
       ▼ (tap "Ho capito, continua")
    ③ Import
       │
       ▼ (drag&drop file Spotify + click "Importa tutto")
    ④ Processing
       │
       ▼ (automatico al 100%)
    ⑤ Prima Rivelazione
       │
       ▼ (tap "Esplora la tua timeline")
    ⑦ Timeline
       │
       ▼ (auto-redirect dopo 10s o tap)
    ⑥ Home

### 3.2 Flusso Quotidiano

    Apertura app
       │
       ▼
    ⑥ Home
       ├→ tap StatCard → ⑩ Analisi
       ├→ tap MemoryCard → ⑪ Ricordi
       └→ tap barra settimanale → ⑦ Timeline → ⑧ Era → ⑨ Esplora

### 3.3 Flusso Condivisione Ricordo

    ⑪ Ricordi
       │
       ▼ (tap "Condividi")
    ⑫ Share Sheet
       │
       ├→ Instagram → deep link con immagine
       ├→ WhatsApp → share sheet nativo
       ├→ Copia → toast "Immagine copiata"
       └→ Scarica → save to gallery + toast "Salvato"

### 3.4 Flusso Cancellazione Totale

    ⑬ Impostazioni
       │
       ▼ (tap "Cancella tutti i dati")
    Modal 1 ("Sicuro?")
       │
       ▼ (tap "Continua")
    Modal 2 ("Digita ELIMINA")
       │
       ▼ (input corretto)
    Delete DB + redirect a ⑭ Empty

## 4. Stato machine di Import

    ┌────────┐    drop     ┌─────────────┐   valid    ┌──────────┐
    │  IDLE  │────────────▶│  VALIDATING │───────────▶│ PARSING  │
    └────────┘             └─────────────┘            └─────┬────┘
       ▲                           │                        │
       │                      invalid                   parse ok
       │                           │                        │
       │                           ▼                        ▼
       │                    ┌─────────────┐          ┌──────────┐
       │                    │   ERROR     │          │ENRICHING │
       │                    └─────────────┘          └─────┬────┘
       │                          │                        │
       │                      retry                   enrich ok
       │                          │                        │
       └──────────────────────────┴────────────────────────┴──────▶ DONE
                                                                       │
                                                                    upsert
                                                                       │
                                                                       ▼
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
| Timeline | `←` `→` cambio periodo; `+` `-` zoom granularità |
| Home | `M` vai a ricordi; `T` vai a timeline |
| Esplora | `↑` `↓` navigate risultati; `Enter` seleziona |

## 8. Screen reader

Ogni visualizzazione ha un'alternativa testuale nascosta:
- StreamChart → "Ascolti mensili: gennaio 40h, febbraio 52h, ..."
- MoodLine → "Mood dominante: gennaio felice, febbraio neutro, marzo triste"
- QuadrantChart → "Il tuo anno è stato prevalentemente felice (valence media 0.62)"

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 5 | Prima versione completa |
| 0.2 | Sessione 9 (2026-10-15) | Audit: re-import esplicito come idempotente (M8) — niente blocco al doppio drop, dedup via `eventKey`; riferimento count-up al token `motion.countUp.duration` (M11) |


===== FILE: docs/08-COPY-I18N.md =====

# 08 — Copy e Internationalization

> Status: 🟡 DRAFT · Versione 0.2 · Sessione 9 (audit 2026-10-15)
> Lingue MVP: Italiano (it), English (en)
> Formato chiavi: `namespace.scope.key`

---

## 1. Struttura chiavi

    namespace.scope.key

| Namespace | Uso |
|-----------|-----|
| `onboarding` | Schermate ①-④ |
| `home` | Schermata ⑥ |
| `timeline` | Schermata ⑦ |
| `era` | Schermata ⑧ |
| `explore` | Schermata ⑨ |
| `analysis` | Schermata ⑩ |
| `memories` | Schermata ⑪ |
| `share` | Schermata ⑫ |
| `settings` | Schermata ⑬ |
| `empty` | Schermata ⑭ e empty states |
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
| `greeting` | Ciao, {name} 👋 | Hello, {name} 👋 |
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
| `period` | {start} → {end} | {start} → {end} |
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
| `quadrant.valence` | VALENCE → | VALENCE → |
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
| `privacy.carDetection` | Rileva ascolti in auto | Detect car listening |
| `privacy.carDetectionDesc` | Deduce l'ascolto in auto da segnali locali (Bluetooth, CarPlay). Nessun dato lascia il dispositivo | Deduce car listening from local signals (Bluetooth, CarPlay). No data leaves the device |
| `privacy.syncCloud` | Sincronizza tra dispositivi (Fase 2) | Sync across devices (Phase 2) |
| `privacy.syncCloudDesc` | Sincronizzazione cifrata end-to-end, opzionale | End-to-end encrypted sync, optional |
| `data.export` | Esporta tutto (JSON) | Export all (JSON) |
| `data.delete` | Cancella tutti i dati | Delete all data |
| `prefs.theme` | Tema | Theme |
| `prefs.theme.dark` | Scuro | Dark |
| `prefs.theme.light` | Chiaro | Light |
| `prefs.language` | Lingua | Language |
| `delete.confirm1` | Sei sicuro? Questa azione è irreversibile. | Are you sure? This cannot be undone. |
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
| `spotify.warn.offlineConverted` | {count} tracce offline convertite in eventi stimati | {count} offline tracks converted to estimated events |
| `spotify.info.complete` | Import completato: {events} eventi, {tracks} brani unici | Import complete: {events} events, {tracks} unique tracks |
| *(analoghi per youtube, apple, deezer, tidal, soundcloud, lastfm, listenbrainz)* | | |

### 2.13 `error.*`

| Key | IT | EN |
|-----|----|----|
| `generic` | Qualcosa è andato storto | Something went wrong |
| `retry` | Riprova | Retry |
| `fileTooLarge` | File troppo grande (max 500MB) | File too large (max 500MB) |
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
| `mood.happy` | La tua musica è stata prevalentemente felice | Your music was mostly happy |
| `mood.sad` | La tua musica è stata prevalentemente malinconica | Your music was mostly melancholic |
| `mood.excited` | Periodo ad alta energia | High-energy period |
| `mood.calm` | Periodo rilassato | Relaxed period |
| `event.spike_artist` | Hai scoperto {artist} che ha dominato il tuo ascolto | You discovered {artist} who dominated your listening |
| `event.valence_drop` | La tua musica è diventata più malinconica | Your music became more melancholic |
| `event.valence_rise` | La tua musica è diventata più allegra | Your music became more cheerful |
| `event.volume_spike` | Hai ascoltato molta più musica del solito | You listened to much more music than usual |
| `event.volume_drop` | Hai ascoltato molta meno musica del solito | You listened to much less music than usual |
| `event.exploration` | Hai esplorato molti nuovi artisti | You explored many new artists |
| `event.silence` | Periodo di silenzio musicale | Period of musical silence |
| `memory.on_this_day` | {years} anni fa ascoltavi "{track}" di {artist} | {years} years ago you were listening to "{track}" by {artist} |
| `memory.first_time` | {years} anni fa scoprivi {artist} | {years} years ago you discovered {artist} |
| `memory.milestone.events` | Hai raggiunto {count} brani ascoltati! | You reached {count} tracks listened! |
| `memory.milestone.hours` | Hai raggiunto {count} ore di ascolto! | You reached {count} hours of listening! |
| `memory.return` | Non ascoltavi {artist} da {months} mesi | You hadn't listened to {artist} for {months} months |
| `memory.seasonal` | Come ogni {month}, è tornato il periodo {genre} | Like every {month}, the {genre} period is back |
| `disclaimer` | Questo insight è generato automaticamente a partire dai tuoi dati di ascolto. Non è una diagnosi. | This insight is derived automatically from your listening data. It is not a diagnosis. |
| `disclaimerShort` | Generato automaticamente | Auto-generated |

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
- **Umano**: evita linguaggio tecnico ("Parsing" → "Sto analizzando")
- **Attivo**: "Hai ascoltato" non "Sono stati ascoltati"
- **Empatico**: per insight emotivi, tono narrativo ("Il tuo marzo 2020 è stato...")
- **Discreto**: per errori, tono neutro e orientato alla soluzione

## 7. Implementazione

Struttura file:

    apps/web/
    └── src/
        └── i18n/
            ├── index.ts          # init i18next
            ├── locales/
            │   ├── it.json
            │   └── en.json
            └── formatter.ts      # numeri/date localizzati

Libreria consigliata: `i18next` + `react-i18next`.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 5 | Prima versione completa |
| 0.2 | Sessione 9 (2026-10-15) | Audit: rimosse `privacy.stats`/`privacy.statsDesc` (D.A.1, rinviate a Fase 2); aggiunte `privacy.carDetection` e `privacy.syncCloud` (02 v1.1); aggiunte `insight.disclaimer` e `insight.disclaimerShort` (C9); aggiunta `adapter.spotify.warn.offlineConverted` (M2); `fileTooLarge` portato a 500MB per coerenza con 06§2.3 (M3) |


===== FILE: docs/10-TESTING.md =====

# 10 — Strategia di Testing

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 3

---

## 1. Piramide di testing

    ┌─────────────────────────┐
    │  E2E (Playwright)       │  ~5% dei test
    │  Flussi utente critici  │
    ├─────────────────────────┤
    │  Integration            │  ~25%
    │  Adapter+DB, analysis+DB│
    ├─────────────────────────┤
    │  Unit (Vitest)          │  ~70%
    │  Funzioni, algoritmi    │
    └─────────────────────────┘

## 2. Target coverage per modulo

| Modulo | Coverage target | Note |
|--------|-----------------|------|
| `packages/core/adapters/*` | ≥ 90% | Ogni edge case E.N.x coperto |
| `packages/core/analysis/*` | ≥ 85% | Property-based + fixture |
| `packages/core/db/*` | ≥ 80% | Migrazioni testate |
| `packages/core/enrichment/*` | ≥ 75% | Mock API esterne |
| `packages/ui/components` | ≥ 70% | Snapshot + interaction |
| `apps/web` | ≥ 60% | E2E su flussi critici |

## 3. Fixture strategy

### 3.1 Fixture sintetici (per adapter)

Ogni adapter ha un fixture in `fixtures/synthetic-history/<platform>-sample.json` con:
- ≥ 10 eventi rappresentativi
- Almeno 1 caso per ogni edge case E.N.x documentato
- Campo `_case` che descrive lo scenario
- Campo `_expectedOutput` con valori attesi

Il primo fixture è `spotify-sample.json` (Sessione 2).

### 3.2 Fixture di test DB

`fixtures/db-seed/` contiene:
- `minimal.json` — 10 eventi, 5 track, 2 artisti (per test unit)
- `medium.json` — 5.000 eventi, 500 track (per test integrazione)
- `large.json` — 100.000 eventi, 5.000 track (per test performance)

Tutti generati sinteticamente con script `scripts/generate-fixtures.ts`.

### 3.3 Fixture di scenari di vita

`fixtures/scenarios/` contiene cronologie complete pre-costruite che rappresentano scenari specifici:
- `lockdown-2020.json` — esplosione Lo-fi, ascolti notturni
- `breakup-oct2021.json` — crollo valence, spike Adele
- `summer-roadtrip.json` — alta valence, country multipli

Ogni scenario ha `_expectedInsights` con gli insight attesi dopo l'analisi.

## 4. Tipi di test per categoria

### 4.1 Adapter

- **Unit**: mapping campi, derivazioni (skipped, startedAt), dedup, normalizzazione
- **Integration**: import di fixture → DB popolato correttamente
- **Property**: re-import è idempotente (eventKey unico)
- **Edge case**: ogni E.N.x deve avere test dedicato

### 4.2 Analysis engine

- **Unit**: ogni algoritmo con input/output attesi
- **Property-based** (fast-check): invarianti (es. mood_day è sempre uno dei 6 mood; valence in [0,1])
- **Scenario**: ogni `fixtures/scenarios/*.json` produce insight attesi

### 4.3 DB

- **Migrazioni**: ogni upgrade da v(n) a v(n+1) testato con dati pre-migrazione
- **Query**: indici usati correttamente (EXPLAIN)
- **Concurrency**: upsert paralleli non creano duplicati

### 4.4 UI

- **Snapshot**: componenti renderizzati correttamente
- **Interaction**: click, drag&drop, form funzionano
- **E2E**: flussi completi (onboarding → home → timeline → ricordo)

## 5. Comandi

    pnpm test                # tutti i test
    pnpm test:unit           # solo unit
    pnpm test:integration    # solo integration
    pnpm test:e2e            # solo e2e (Playwright)
    pnpm test:coverage       # con report coverage
    pnpm test:watch          # modalità watch

## 6. CI gating

La CI GitHub Actions deve:
- [ ] Eseguire `pnpm run lint` su ogni PR
- [ ] Eseguire `pnpm test:unit` e `pnpm test:integration`
- [ ] Rifiutare PR con coverage sotto target per modulo
- [ ] Eseguire `pnpm test:e2e` su main (non su ogni PR, troppo lento)
- [ ] Buildare `apps/web` e verificare nessun errore TypeScript

## 7. Test di proprietà per analisi (property-based)

Invarianti che devono SEMPRE valere:

| Invariante | Modulo |
|------------|--------|
| `valence ∈ [0, 1]` per ogni audio feature | enrichment |
| `mood ∈ {sad, angry, neutral, calm, happy, excited}` | analysis |
| `sum(genreDistribution) ≈ 1.0` per era | analysis |
| `era.periodStart < era.periodEnd` | analysis |
| `insight.derivedVersion` == versione attuale dell'algoritmo | analysis |
| `session.eventCount >= 1` | analysis |
| `listen_events.eventKey` è unico nel DB | db |
| `tracks.canonicalKey` è unico nel DB | db |

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
| 1.0 | Sessione 3 | 🟢 APPROVED · Versione 1.0 · Sessione 3 |


===== FILE: docs/11-BACKLOG.md =====

# 11 — Backlog Strutturato

> Status: 🟢 APPROVED · Versione 1.1 · Sessione 9 (audit 2026-10-15)
> Formato: Epic → Story → Task con acceptance criteria verificabili

---

## Legenda

| Simbolo | Significato |
|---------|-------------|
| `[PHASE-N]` | Fase della roadmap (0=fondamenta, 1=import core, 2=analisi, 3=UI, 4=beta) |
| `[AREA:X]` | Modulo: `adapter`, `analysis`, `ui`, `ux`, `db`, `enrichment`, `privacy`, `devops` |
| `[PRI:B]` / `[PRI:I]` / `[PRI:L]` | Priorità: blocker / important / later |
| `[DEP:#]` | Dipende dalla story # |
| `[SIZE:S/M/L/XL]` | Stima relativa |

## Stato di una Story

- ⬚ TODO — non iniziata
- 🟡 IN PROGRESS — in lavorazione
- ✅ DONE — completata e verificata
- 🛑 BLOCKED — dipende da altro o da spec mancante

---

## EPIC 0 — Fondamenta (Fase 0 tecnica)

Obiettivo: monorepo funzionante, schema DB live, primo adapter end-to-end.

### Story 0.1 — Setup monorepo e toolchain `[PHASE-0]` `[AREA:devops]` `[PRI:B]` `[SIZE:L]`

**Descrizione**: Inizializzare il monorepo Turborepo con le cartelle `apps/web`, `packages/core`, `packages/ui`, toolchain TypeScript, lint, format.

**Task**:
- T0.1.1 — Init monorepo con pnpm workspaces + Turborepo
- T0.1.2 — Config TypeScript base + path aliases
- T0.1.3 — ESLint + Prettier + commit hook (husky + lint-staged)
- T0.1.4 — Vitest + Playwright setup
- T0.1.5 — `pnpm run lint`, `pnpm run test`, `pnpm run build` funzionanti

**Acceptance criteria**:
- [ ] `pnpm install` senza errori su node 20 LTS
- [ ] `pnpm run lint` passa su codebase vuoto
- [ ] `pnpm run test` esegue almeno un test dummy
- [ ] `pnpm run build` produce artefatti
- [ ] CI GitHub Actions: lint + test su ogni PR

**Dipendenze**: nessuna
**Spec**: `05-ARCHITECTURE.md` §8-9

---

### Story 0.2 — Schema DB e layer Dexie `[PHASE-0]` `[AREA:db]` `[PRI:B]` `[SIZE:L]` `[DEP:0.1]`

**Descrizione**: Implementare lo schema Dexie come definito in `02-DATA-SCHEMA.md` §6, con migrazioni e API di accesso.

**Task**:
- T0.2.1 — Interfacce TypeScript in `packages/core/schema/`
- T0.2.2 — Class Dexie con `db.version(1).stores(...)`
- T0.2.3 — Repository: `listens`, `tracks`, `artists`, `albums`, `features` (CRUD + query base)
- T0.2.4 — Funzione `recount()` per contatori denormalizzati
- T0.2.5 — Test con DB in-memory (fake-indexeddb)

**Acceptance criteria**:
- [ ] Tutte le tabelle di `02-DATA-SCHEMA.md` §6 esistono
- [ ] Indici corrispondono alla spec
- [ ] `recount()` ricalcola `listenCount` correttamente
- [ ] Test unitari: ≥80% coverage su `packages/core/db/`
- [ ] Test con 10.000 ListenEvent in < 500ms

**Dipendenze**: Story 0.1
**Spec**: `02-DATA-SCHEMA.md` §3, §6, §7

---

### Story 0.3 — Adapter Spotify base `[PHASE-0]` `[AREA:adapter]` `[PRI:B]` `[SIZE:L]` `[DEP:0.2]`

**Descrizione**: Implementare l'adapter Spotify completo secondo `03-ADAPTERS/spotify.md`.

**Task**:
- T0.3.1 — `SpotifyAdapter.detect()` (riconoscimento ZIP/JSON)
- T0.3.2 — `SpotifyAdapter.parse()` streaming su JSON (AsyncIterable)
- T0.3.3 — Mapping campi §3.1 con regola `skipped` derivata (E1)
- T0.3.4 — Gestione `offline_timestamp` unità (E3)
- T0.3.5 — Upsert con dedup via `eventKey` e `canonicalKey` (DEDUP-3)
- T0.3.6 — Processamento `YourLibrary.json`, `Playlist*.json`, `Follow.json`
- T0.3.7 — Segnalazione UI via codici i18n (§9)

**Acceptance criteria**:
- [ ] Tutti i 10 casi di `fixtures/synthetic-history/spotify-sample.json` passano
- [ ] Re-import stesso file → `eventsDuplicated = N`, nessun raddoppio
- [ ] Import di file reale (≥50k eventi) in < 30s, memoria < 500MB
- [ ] `CarDetectionEvent.json` rifiutato senza opt-in esplicito
- [ ] `ip_addr` conservato solo se `PrivacySettings.retainIp === true`

**Dipendenze**: Story 0.2
**Spec**: `03-ADAPTERS/spotify.md`, `01-PLATFORMS.md` §3.1

---

### Story 0.4 — UI import (onboarding) `[PHASE-0]` `[AREA:ui]` `[PRI:B]` `[SIZE:M]` `[DEP:0.3]`

**Descrizione**: Schermate ① Benvenuto → ② Privacy → ③ Import → ④ Processing.

**Task**:
- T0.4.1 — Componente `DropZone` + `PlatformCard` (4 stati: vuoto/processing/done/error)
- T0.4.2 — Schermata Benvenuto + Privacy
- T0.4.3 — Schermata Import con validazione file
- T0.4.4 — Schermata Processing con progress e counter live
- T0.4.5 — Integrazione con `SpotifyAdapter`

**Acceptance criteria**:
- [ ] Drag&drop ZIP Spotify → import completato con messaggio §9
- [ ] File errato → errore umano "Questo file sembra di Apple Music, non di Spotify"
- [ ] Privacy screen mostra i 4 toggle (`retainIp`, `enrichMetadata`, `carDetection`, `syncCloud`)
- [ ] Nessun dato persistito prima del click "Importa tutto"
- [ ] Design system rispettato (colori, typo, componenti `15-DESIGN-SYSTEM.md`)

**Dipendenze**: Story 0.3
**Spec**: `15-DESIGN-SYSTEM.md`, mockup schermate ①-④

---

### Story 0.5 — PWA e service worker `[PHASE-0]` `[AREA:devops]` `[PRI:B]` `[SIZE:M]` `[DEP:0.1]`

**Descrizione**: Trasformare la web app in una PWA installabile, con service worker che gestisce offline-first, precache degli asset e strategia network-first per enrichment con fallback cache.

**Task**:
- T0.5.1 — Configurazione `vite-plugin-pwa` con Workbox
- T0.5.2 — Manifest.json (nome, icone, theme color)
- T0.5.3 — Strategia cache: precache shell, runtime cache per asset statici, network-first per enrichment
- T0.5.4 — Update prompt UX (banner "Nuova versione disponibile")

**Acceptance criteria**:
- [ ] App installabile da Chrome/Edge su desktop e mobile
- [ ] Offline: tutte le schermate funzionano (tranne enrichment)
- [ ] Update disponibile → banner con bottone "Ricarica"
- [ ] Lighthouse PWA score ≥ 90

**Dipendenze**: Story 0.1
**Spec**: `05-ARCHITECTURE.md` §8, ADR-0001

---

### Story 0.6 — Setup i18n (i18next) `[PHASE-0]` `[AREA:ui]` `[PRI:B]` `[SIZE:S]` `[DEP:0.1]`

**Descrizione**: Inizializzare la pipeline i18n con `i18next` + `react-i18next` per IT/EN, caricamento asincrono, fallback intelligente, rispetto delle stringhe definite in `08-COPY-I18N.md`.

**Task**:
- T0.6.1 — Init i18next con namespace per `08-COPY-I18N.md` (it/en)
- T0.6.2 — Language detector (localStorage → browser)
- T0.6.3 — Pluralizzazione ICU (`{count, plural, ...}`)
- T0.6.4 — Componente `<T>` e hook `useT()`

**Acceptance criteria**:
- [ ] Tutte le chiavi di `08-COPY-I18N.md` sono importate
- [ ] Switch IT↔EN senza reload
- [ ] Plurali corretti (`{count, plural, one {...} other {...}}`)
- [ ] Lingua fallback se chiave mancante (no crash, no `{{key}}`)

**Dipendenze**: Story 0.1
**Spec**: `08-COPY-I18N.md` §3, §4, §5

---

### Story 0.7 — Operations runbook + manutenzione `[PHASE-0]` `[AREA:devops]` `[PRI:I]` `[SIZE:M]` `[DEP:0.2, 0.5]`

**Descrizione**: Documentare in dettaglio le operazioni di update management (`05§11`) e DB maintenance (`05§12`) nel nuovo file `docs/16-OPERATIONS.md`. Includere runbook per l'operatore (sviluppatore che mantiene il progetto) su diagnosi e remediation di problemi noti.

**Task**:
- T0.7.1 — Creare `docs/16-OPERATIONS.md` 🟡 DRAFT con §1 Update playbook, §2 Maintenance playbook, §3 Migrazioni schema, §4 Diagnosi & remediation
- T0.7.2 — Hook `useAppUpdate()` in `@ls/web` (vedi `05§11.3`)
- T0.7.3 — Implementare `recount()`, `rekey()`, `orphanCleanup()` in `@ls/core/db` con test (`10-TESTING.md §4`)
- T0.7.4 — Implementare `fastCheck()` + `quotaCheck()` con logging strutturato
- T0.7.5 — Settings → Manutenzione: UI per `indexRebuild`/`compact` manuale e contatore `lastMaintenance`
- T0.7.6 — Version manifest: build script che genera `public/version.json` da `package.json` + `git rev-parse HEAD`

**Acceptance criteria**:
- [ ] `16-OPERATIONS.md` esiste e referenzia le sezioni `05§11` e `05§12`
- [ ] Tutte le funzioni di manutenzione hanno test unitari ≥ 80% coverage
- [ ] `fastCheck` eseguito al boot; failure → read-only mode + banner
- [ ] Update soft (minor) mostra banner; update major mostra modal
- [ ] Migrazione DB v1→v2 simulata in test passa senza perdita dati
- [ ] Rollback SW in caso di migration failure funziona (test E2E)

**Dipendenze**: Story 0.2, Story 0.5
**Spec**: `05-ARCHITECTURE.md` §11, §12; `02-DATA-SCHEMA.md` §7

**Descrizione**: Inizializzare la pipeline i18n con `i18next` + `react-i18next` per IT/EN, caricamento asincrono, fallback intelligente, rispetto delle stringhe definite in `08-COPY-I18N.md`.

**Task**:
- T0.6.1 — Init i18next con namespace per `08-COPY-I18N.md` (it/en)
- T0.6.2 — Language detector (localStorage → browser)
- T0.6.3 — Pluralizzazione ICU (`{count, plural, ...}`)
- T0.6.4 — Componente `<T>` e hook `useT()`

**Acceptance criteria**:
- [ ] Tutte le chiavi di `08-COPY-I18N.md` sono importate
- [ ] Switch IT↔EN senza reload
- [ ] Plurali corretti (`{count, plural, one {...} other {...}}`)
- [ ] Lingua fallback se chiave mancante (no crash, no `{{key}}`)

**Dipendenze**: Story 0.1
**Spec**: `08-COPY-I18N.md` §3, §4, §5

---

## EPIC 1 — Import core (Fase 1)

### Story 1.1 — Adapter YouTube Music `[PHASE-1]` `[AREA:adapter]` `[PRI:I]` `[SIZE:M]` `[DEP:0.3]`

**Descrizione**: Import da Google Takeout (formato JSON/HTML).

**Acceptance criteria**:
- [ ] Filtro video/musica funzionante (campo `products`)
- [ ] Gestione cronologia unificata
- [ ] Test con fixture `youtube-sample.json`

**Spec**: `01-PLATFORMS.md` §3.2 (da scrivere in dettaglio post-Sessione 3)

---

### Story 1.2 — Adapter Apple Music `[PHASE-1]` `[AREA:adapter]` `[PRI:I]` `[SIZE:M]` `[DEP:0.3]`

**Descrizione**: Import CSV da Apple Privacy Portal.

**Acceptance criteria**:
- [ ] Parsing CSV robusto (PapaParse)
- [ ] Mapping campi §3.1 Apple
- [ ] Test con fixture

**Spec**: `01-PLATFORMS.md` §3.3

---

### Story 1.3 — Adapter Last.fm + ListenBrainz `[PHASE-1]` `[AREA:adapter]` `[PRI:I]` `[SIZE:M]` `[DEP:0.3]`

**Descrizione**: Import storico via API (paginazione completa).

**Acceptance criteria**:
- [ ] Paginazione su tutto lo storico
- [ ] Rate limit rispettato (5 req/s per Last.fm)
- [ ] MBID da ListenBrainz alimenta DEDUP-2
- [ ] Test con mock API

**Spec**: `01-PLATFORMS.md` §3.7-3.8

---

### Story 1.4 — Dedup promozione post-enrichment `[PHASE-1]` `[AREA:db]` `[PRI:I]` `[SIZE:S]` `[DEP:0.3]`

**Descrizione**: Job `rekey()` che, quando un track acquisisce ISRC/MBID via enrichment, aggiorna il `canonicalKey` da `fuzzy:...` a `isrc:...` o `mbid:...`, unendo duplicati.

**Acceptance criteria**:
- [ ] Due track con `fuzzy:` diverso ma stesso ISRC → una sola track dopo `rekey()`
- [ ] `listenCount` aggregato correttamente
- [ ] `listen_events.trackId` riorientato

**Spec**: `02-DATA-SCHEMA.md` §5-6

---

### Story 1.5 — Scrobbling hub (Last.fm, ListenBrainz, Maloja) `[PHASE-1]` `[AREA:adapter]` `[PRI:L]` `[SIZE:L]` `[DEP:0.3]`

**Descrizione**: Sorgente continua di ascolti tramite hub di scrobbling. Risolve il vuoto V4 dell'audit.

**Task**:
- T1.5.1 — Adapter Last.fm (recupero storico via API `user.getRecentTracks`, paginazione)
- T1.5.2 — Adapter ListenBrainz (recupero storico via API `/1/user/{username}/listens`)
- T1.5.3 — Adapter Maloja self-hosted (server opzionale, scope futuro Fase 2)
- T1.5.4 — Toggle `PrivacySettings.scrobbleHubs` per abilitare l'invio
- T1.5.5 — Rispetto rate limit (Last.fm ~5 req/s, ListenBrainz ragionevole)

**Acceptance criteria**:
- [ ] Storico completo recuperato (paginazione)
- [ ] MBID da ListenBrainz alimenta DEDUP-2 e genera `track.genres` via MusicBrainz lookup
- [ ] Toggle `scrobbleHubs` rispettato (vuoto = nessuna scrittura)
- [ ] Test con mock API

**Spec**: `01-PLATFORMS.md` §3.7, §3.8; `02-DATA-SCHEMA.md` §3.8

---

## EPIC 2 — Analisi (Fase 2)

### Story 2.1 — Mood Tracker giornaliero `[PHASE-2]` `[AREA:analysis]` `[PRI:B]` `[SIZE:M]` `[DEP:0.2]`

**Acceptance criteria**:
- [ ] Formula specificata in `04-ANALYSIS-ALGORITHMS.md` (da scrivere Sessione 4)
- [ ] Insight tipo `mood_day` persistito con `derivedVersion`
- [ ] Test su fixture con scenario noto

---

### Story 2.2 — Era Detector `[PHASE-2]` `[AREA:analysis]` `[PRI:I]` `[SIZE:L]` `[DEP:2.1]`

**Acceptance criteria**:
- [ ] **Change point detection** (Bayesiano o PELT) con parametri `windowDays`, `kMin`, `kMax`, `similarityThreshold` documentati in `04-ANALYSIS-ALGORITHMS.md` §4
- [ ] EraPayload completo per ogni era (vedi `02-DATA-SCHEMA.md` §4)
- [ ] Test: 1 anno con 2 ere evidenti → rilevate correttamente

---

### Story 2.3 — Event Detector `[PHASE-2]` `[AREA:analysis]` `[PRI:I]` `[SIZE:L]` `[DEP:2.1]`

**Acceptance criteria**:
- [ ] Rileva spike/crolli volume, valence drop/rise, exploration, silence
- [ ] Z-score o IQR con finestra documentata
- [ ] Falsi positivi < 10% su fixture di test

---

### Story 2.4 — Memory Engine `[PHASE-2]` `[AREA:analysis]` `[PRI:B]` `[SIZE:M]` `[DEP:0.2]`

**Acceptance criteria**:
- [ ] 5 tipi di ricordo (on_this_day, first_time, milestone, return, seasonal)
- [ ] Trigger documentati in `04-ANALYSIS-ALGORITHMS.md`
- [ ] Feed ricordi ordinato per rilevanza

---

## EPIC 3 — UI/UX (Fase 3)

### Story 3.1 — Home + Timeline `[PHASE-3]` `[AREA:ui]` `[PRI:B]` `[SIZE:XL]`

**Acceptance criteria**:
- [ ] Schermata ⑥ Home con StatCard animate, ricordo del giorno, bar week
- [ ] Schermata ⑦ Timeline con EraBands, StreamChart, MoodLine sincronizzati
- [ ] Zoom progressivo anni → mesi → giorni
- [ ] Responsive breakpoint rispettati

---

### Story 3.2 — Ricordi + Share `[PHASE-3]` `[AREA:ui]` `[PRI:I]` `[SIZE:L]`

**Acceptance criteria**:
- [ ] Feed ricordi mobile (schermata ⑪)
- [ ] ShareSheet con card 1080×1350 generata via canvas
- [ ] Condivisione nativa + download immagine

---

### Story 3.3 — Esplora + Analisi `[PHASE-3]` `[AREA:ui]` `[PRI:I]` `[SIZE:L]`

**Acceptance criteria**:
- [ ] Schermata ⑨ con search autocomplete sui propri dati
- [ ] Schermata ⑩ QuadrantChart valence/energy
- [ ] Click su punto → deep-link timeline

---

## EPIC 4 — Arricchimento (Fase 2/3)

### Story 4.1 — Pipeline audio features `[PHASE-2]` `[AREA:enrichment]` `[PRI:I]` `[SIZE:L]`

**Acceptance criteria**:
- [ ] Cascata: cache → **Essentia.js (WASM, browser)** → **AcousticBrainz (bonus su MBID)** → **fallback euristico** (D.A.6)
- [ ] Toggle privacy `enrichMetadata` rispettato
- [ ] Rate limiting MusicBrainz (1 req/s)
- [ ] `AudioFeatures.source` ∈ `{essentia, acousticbrainz, heuristic, manual}` tracciato

---

### Story 4.2 — MusicBrainz lookup `[PHASE-2]` `[AREA:enrichment]` `[PRI:I]` `[SIZE:M]`

**Acceptance criteria**:
- [ ] Lookup per track name + artist
- [ ] Cache locale MBID
- [ ] Rispetto rate limit MB (1 req/s)

---

## EPIC 5 — Privacy e legale (Fase 6)

### Story 5.1 — Privacy spec finale `[PHASE-6]` `[AREA:privacy]` `[PRI:B]`

**Acceptance criteria**:
- [ ] `09-PRIVACY-SECURITY.md` APPROVED
- [ ] Data flow diagram
- [ ] Bozza privacy policy GDPR-compliant

---

### Story 5.2 — Export e purge `[PHASE-6]` `[AREA:privacy]` `[PRI:B]`

**Acceptance criteria**:
- [ ] `purgeIp()` cancella tutti gli IP
- [ ] Export JSON completo (portabilità GDPR)
- [ ] Cancellazione totale con doppia conferma

---

## Priorità di lavorazione per agenti

Quando un agente arriva sul repo, deve lavorare le story in questo ordine:

1. **0.1** Setup monorepo
2. **0.5** PWA / service worker (parallelo a 0.1)
3. **0.6** i18n setup (parallelo a 0.1)
4. **0.2** Schema DB
5. **0.7** Operations runbook + manutenzione (dopo 0.2 e 0.5)
6. **0.3** Adapter Spotify
7. **0.4** UI import
8. **1.1, 1.2, 1.3** in parallelo (altri adapter)
9. **1.4** Dedup promozione
10. **1.5** Scrobbling hub (Last.fm, ListenBrainz, Maloja)
11. **2.1, 2.4** analisi base
12. **2.2, 2.3** analisi avanzata
13. **4.1, 4.2** enrichment
14. **3.1, 3.2, 3.3** UI
15. **5.1, 5.2** privacy

Ogni story deve avere label GitHub:
- `phase-0`/`phase-1`/`phase-2`/`phase-3`/`phase-6`
- `area:adapter` / `area:db` / `area:ui` / `area:analysis` / `area:enrichment` / `area:privacy`
- `priority:blocker` / `priority:important`
- `size:S` / `size:M` / `size:L` / `size:XL`
- `agent-ready` (solo quando la spec collegata è 🟢 APPROVED)

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 3 | Prima versione con 5 epic e 17 story |
| 1.0 | Sessione 3 | 🟢 APPROVED · Versione 1.0 · Sessione 3 |
| 1.1 | Sessione 9 (2026-10-15) | Audit: Story 2.2 aggiornata a change point detection (C7); Story 4.1 provider audio features → Essentia.js + AcousticBrainz + euristica (D.A.6); Story 0.4 toggle privacy → 4 (`carDetection`, `syncCloud` aggiunti); nuove Story 0.5 (PWA/service worker) e 0.6 (i18n setup) per V5; nuova Story 1.5 (scrobbling hub) per V4; **nuova Story 0.7 Operations runbook** (post-review `05` v0.2 §11+12) per documentare update management e DB maintenance; ordine priorità rivisto |


===== FILE: docs/13-ADR/0001-pwa-first.md =====

# ADR-0001 — PWA come piattaforma primaria

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 1

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

- Positive: velocità di sviluppo, manutenzione singola, privacy
- Negative: push notification e integrazione OS limitate nel MVP; File System Access API non uniforme tra browser
- Mitigazioni: fallback drag&drop per upload file; Tauri in Fase 2 per i casi power-user

## Collegamenti

- 05-ARCHITECTURE §8 · 00-VISION §Perimetro MVP

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 1 | 🟢 APPROVED · Versione 1.0 · Sessione 1 |


===== FILE: docs/13-ADR/0002-local-first.md =====

# ADR-0002 — Local-first e privacy-by-design

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 1

## Contesto

Il progetto tratta dati altamente personali (cronologia di ascolto, contesto, inferenze emotive). Il target europeo è sensibile al GDPR. Ogni architettura cloud-first introdurrebbe obblighi legali, costi e rischi di trust.

## Decisione

**Tutti i dati personali risiedono nel browser dell'utente (IndexedDB).** Nessuna autenticazione obbligatoria. Nessuna telemetria. Le uniche comunicazioni di rete possibili sono: (1) arricchimento metadati brani, disattivabile; (2) hub di scrobbling scelti dall'utente; (3) sync cloud opzionale E2E in Fase 2.

## Motivazioni

- La privacy è il differenziale competitivo, non un vincolo
- Zero costi di infrastruttura nel MVP
- Compliance GDPR semplificata: nessun trattamento server-side di PII
- Reversibilità totale: export e cancellazione sono operazioni locali

## Alternative considerate

- **Cloud-first con account**: scartata (costi legali, trust, lock-in)
- **Self-hosted server obbligatorio**: scartata per frizione; resta opzione Docker documentata

## Conseguenze

- Positive: trust, costi, semplicità legale
- Negative: nessun cross-device nel MVP; elaborazione limitata alle risorse del browser
- Mitigazioni: Web Worker e streaming parse per file grandi; sync E2E opzionale in Fase 2
- **IP address**: non persistito di default; conservato SOLO con toggle esplicito `retainIp`; mai inviato in rete; purgabile con `purgeIp()`. Il `country` è sempre derivato (privacy-by-design, vedi 09)

## Collegamenti

- 02-DATA-SCHEMA §8 · 09-PRIVACY-SECURITY (Sessione 6)

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 1 | 🟢 APPROVED · Versione 1.0 · Sessione 1 |


===== FILE: docs/13-ADR/0003-adapter-pattern.md =====

# ADR-0003 — Adapter pattern e normalizzazione early

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 1

## Contesto

Otto+ sorgenti eterogenee (formati, campi, semantica temporale, edge case). Serviva una strategia per non far degenerare il core in logica per-platform.

## Decisione

**Ogni piattaforma è un adapter indipendente** che implementa l'interfaccia `PlatformAdapter` (05-ARCHITECTURE §4) e produce esclusivamente il formato unificato (02-DATA-SCHEMA). La normalizzazione avviene al parse ("early"): il payload raw **non** è persistito nel DB.

## Motivazioni

- Aggiungere una piattaforma = aggiungere un modulo, senza toccare il core
- Analisi e UI lavorano su un solo schema
- Testabilità: ogni adapter è testabile isolato con fixture
- Spazio: persistere il raw di 200k eventi raddoppierebbe il DB locale

## Alternative considerate

- **Silos per-platform**: scartata (analisi cross-platform impossibili)
- **ETL server-side**: scartata (contraria ad ADR-0002)
- **Persistenza del raw nel DB**: scartata per spazio; il file dell'utente resta fonte di verità e l'import è ri-eseguibile (idempotenza via eventKey)

## Conseguenze

- Positive: core pulito, estensibilità, test semplici
- Negative: perdita di campi platform-specific non mappati; debugging di parse errori richiede il file originale
- Mitigazioni: `ImportRecord.warnings` cataloga gli edge case (E1..E10); log di import conservato; campi futuri aggiungibili con migrazioni

## Collegamenti

- 01-PLATFORMS §5 · 02-DATA-SCHEMA §6-7 · 05-ARCHITECTURE §4

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 1 | 🟢 APPROVED · Versione 1.0 · Sessione 1 |


===== FILE: docs/14-GLOSSARY.md =====

# 14 — Glossario di Dominio

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 1
> Definizioni univoche. In caso di conflitto tra un documento e questo glossario, vale questo glossario (finché non viene aggiornato).

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
| **Valence** | Punteggio 0..1 di positività emotiva percepita del brano |
| **Energy** | Punteggio 0..1 di intensità/attivazione del brano |
| **Danceability** | Punteggio 0..1 di attitudine al ballo del brano |

## Identificatori

| Termine | Definizione |
|---------|-------------|
| **ISRC** | International Standard Recording Code: identificativo univoco di una *registrazione* (12 caratteri) |
| **MBID** | MusicBrainz Identifier: UUID di un'entità MusicBrainz (recording, artist, release) |
| **UPC** | Codice univoco di un *prodotto* (album/release) |
| **canonicalKey** | Chiave di deduplicazione traccia: ISRC → MBID → fuzzy hash (regole DEDUP) |
| **eventKey** | Chiave di idempotenza di un listen event (platform + sourceEventId o hash) |
| **platformIds** | Mappa degli identificatori originali dello stesso brano sulle varie piattaforme |

## Architettura

| Termine | Definizione |
|---------|-------------|
| **Adapter** | Modulo che converte il formato di una piattaforma nel formato unificato |
| **Formato unificato** | Schema di `ListenEvent` e entità collegate (02-DATA-SCHEMA) |
| **Local-first** | I dati vivono sul dispositivo; il cloud è opzionale e aggiuntivo |
| **Privacy-first** | Nessuna PII esce dal dispositivo senza toggle esplicito dell'utente |
| **derivedVersion** | Hash del set di parametri che ha generato sessioni/insight; abilita ricalcolo coerente |
| **Fixture** | Dataset sintetico di test in `fixtures/synthetic-history/` |
| **ADR** | Architecture Decision Record: decisione architetturale registrata in `docs/13-ADR/` |

## Processo

| Termine | Definizione |
|---------|-------------|
| **agent-ready** | Label di issue la cui specifica è APPROVED: un agente può lavorarci |
| **needs-spec** | Label di issue bloccata in attesa di specifica |
| **APPROVED / DRAFT** | Stato di un documento: vincolante per gli agenti / in discussione |
| **Boss** | Project owner (@amedeo82), unica autorità di approvazione |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 1 | Prima versione |
| 1.0 | Sessione 1 | 🟢 APPROVED · Versione 1.0 · Sessione 1 |


===== FILE: docs/15-DESIGN-SYSTEM.md =====

# 15 — Design System

> Status: 🟡 DRAFT
> Versione: 0.2
> Ultima modifica: Sessione 9 (audit 2026-10-15)
> Asset collegati: `design/mockups/` (14 schermate), `design/tokens.json` (v0.2)

---

## 1. Identità del brand

### 1.1 Concept del logo

Un'**onda sonora che si distende in linea del tempo**: a sinistra la forma d'onda vibrante (la musica), a destra una linea orizzontale stabile (la vita). Metafora del prodotto: *la musica che diventa storia*.

Varianti: primaria gradiente · monocroma viola · neutra grigia · bianca · wordmark "LIFE SOUNDTRACK".

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

`#8B5CF6` (violet) → `#EC4899` (magenta) → `#F59E0B` (amber)
Usi: logo, CTA primarie, elementi attivi, highlight.

### 2.3 Palette mood (semantica, vincolante)

| Mood | Hex | Posizione valence/energy |
|------|-----|--------------------------|
| 😢 Triste | `#3B82F6` | valence bassa, energy bassa |
| 😤 Arrabbiato | `#EF4444` | valence bassa, energy alta |
| 😐 Neutro | `#8B5CF6` | valence media |
| 🧘 Calmo | `#10B981` | valence media, energy bassa |
| 😊 Felice | `#F59E0B` | valence alta, energy media |
| 🎉 Eccitato | `#EC4899` | valence alta, energy alta |

**Regola**: ogni visualizzazione di mood usa questa palette. Ogni mood ha sempre emoji + label testuale (mai solo colore).

### 2.4 Colori piattaforma (schermate import/settings)

Spotify `#1DB954` · YouTube `#FF0000` · Apple Music `#FA243C` · Deezer `#A238FF` · Tidal `#00FFFF` · Last.fm `#D51007` · ListenBrainz `#EB7431`

⚠️ Nota legale: nell'UI usare **riferimenti nominativi testuali o icone proprie**, non i loghi ufficiali (trademark). Da verificare in Sessione 6.

## 3. Tipografia

| Uso | Font | Peso |
|-----|------|------|
| Titoli, numeri grandi | Inter Tight | 700-800 (tabular figures) |
| Corpo, UI | Inter | 400-600 |
| Dati tecnici (URI, timestamp, IP) | JetBrains Mono | 400 |

Scala: Display 48-64 · H1 32 · H2 24 · H3 20 · Body 16 · Small 14 · Caption 12.

**Display 48-64px** (audit M11): usato per i numeri hero delle `StatCard` (schermata ⑥ Home). Tre scale definite in `design/tokens.json` `typography.fontSize.display.*`:

| Token | px | Uso |
|-------|-----|-----|
| `display.sm` | 48 | StatCard con 1-2 cifre (anni, conteggi bassi) |
| `display.md` | 56 | StatCard standard (ore ascoltate) |
| `display.lg` | 64 | StatCard hero (eventi totali, metriche signature) |

Licenze: Inter e JetBrains Mono sono SIL OFL → ok per uso commerciale. Documentare in Sessione 6.

## 4. Principi stilistici

1. **Dark-first**: il dark non è un'opzione, è l'identità (light mode come opzione secondaria)
2. **Glow, non ombre**: bagliori colorati sugli elementi attivi, come luci di un palco
3. **Glassmorphism moderato**: card semi-trasparenti, blur leggero, bordi gradiente sottili
4. **Angoli generosi**: 16px card desktop · 20px card mobile · full-round per pill e bottoni
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

Spec dettagliate per componente (props, stati, a11y) → Sessione 7 (`07-UI-SPEC.md`).

## 6. Principi UX

1. **Privacy come feature**: il messaggio "i tuoi dati restano sul tuo dispositivo" appare in ogni punto di contatto coi dati
2. **Progressive disclosure**: prima l'emozione (ricordi, mood), poi i dati, poi i dettagli tecnici
3. **Narrazione prima dei numeri**: ogni insight è una frase in linguaggio naturale; i numeri sono supporto
4. **L'utente ha l'ultima parola**: le inferenze (eventi, mood) sono ipotesi confermabili/correggibili/ignorabili
5. **Zero frizione nell'import**: drag&drop ovunque, validazione immediata, errori con messaggi umani

## 7. Flussi principali (sintesi)

- **Onboarding**: Benvenuto → Privacy → Import → Processing → Prima Rivelazione Timeline (momento wow, una sola volta)
- **Loop quotidiano**: Home (stat + ricordo del giorno + settimana) → Timeline → Era → Esplora/Analisi
- **Ricordi**: feed mobile → Rivivi (deep-link timeline) / Condividi (ShareSheet) / Salva
- **Controllo**: Settings (piattaforme, privacy toggle, export JSON, cancellazione totale)
- **Empty state**: ogni sezione ha illustrazione + CTA di uscita; mai pagine bianche

Tour completo delle 14 schermate con navigation map: `design/mockups/TOUR.md` (audit V2, da creare in Sessione 10).

## 8. Micro-interazioni

| Interazione | Feedback | Token |
|-------------|----------|-------|
| Hover StatCard | Glow + **count-up** numeri (600ms, easing-out) | `motion.countUp.duration` |
| Click EraBand | Espansione smooth + dettaglio | `motion.expand` |
| Scroll Timeline | Ere si illuminano al passaggio | — |
| Import completato | Confetti sottili | — |
| Prima rivelazione | Ere si colorano in sequenza 2016→2026 | `motion.reveal` |
| Long-press brano (mobile) | Menu contestuale | — |

Motion reduction rispettata (`prefers-reduced-motion`).

## 9. Accessibilità

- Contrasti ≥ 4.5:1 su sfondo scuro
- Mood sempre con emoji + testo (non solo colore)
- Navigazione da tastiera completa; focus visibile
- Alternative testuali per ogni grafico (screen reader)
- Touch target ≥ 44px su mobile

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
| 0.2 | Sessione 9 (2026-10-15) | Audit: scala Display 48/56/64 documentata (M11) con tabella di utilizzo; micro-interazioni con riferimento ai token `motion.*`; TOUR.md rinviato a Sessione 10 (V2) |


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

