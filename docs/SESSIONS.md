# 📝 Log delle Sessioni di Progettazione

> Memoria cronologica di tutte le sessioni di lavoro sul progetto.
> **Questo file è la nostra memoria condivisa** tra Boss, AI progettista e futuri agenti.

---

## Sessione 0 — 🔒 Consolidamento + Bootstrap

**Data**: ottobre 2026
**Stato**: 🟡 In corso

### Obiettivi

1. Creare il repository GitHub privato `Life-Soundtrack`
2. Consolidare tutto il materiale prodotto nelle sessioni esplorative in file strutturati in `docs/` e `design/`
3. Creare i documenti base di governance (`README.md`, `AGENTS.md`, `INDEX.md`, `SESSIONS.md`, `00-VISION.md`)
4. Preparare il terreno per le sessioni tecniche 1-8

### Documenti prodotti

- ✅ `README.md`
- ✅ `AGENTS.md` (scheletro — da raffinare in Sessione 3)
- ✅ `docs/INDEX.md`
- ✅ `docs/SESSIONS.md` (questo file)
- ✅ `docs/00-VISION.md` (DRAFT)

### Decisioni prese

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D0.1 | Repo privato su account `amedeo82`, nome `Life-Soundtrack` | Scelta del project owner |
| D0.2 | Struttura cartelle: `docs/`, `design/`, `fixtures/`, `scripts/` | Separazione chiara tra specifica, asset, test e tooling |
| D0.3 | Branch model: `main` protetto + branch temporanei feat/fix | Semplice e sicuro |
| D0.4 | Commit convention: Conventional Commits | Leggibilità della storia |
| D0.5 | Label GitHub con `agent-ready` come gate per gli agenti | Gli agenti lavorano solo su specifiche approvate |
| D0.6 | 8 sessioni di progettazione pianificate (vedi INDEX.md) | Copertura completa prima dell'handoff agli agenti |
| D0.7 | Pilastri non negoziabili: local-first e privacy-first | Differenziazione e compliance GDPR |

### Materiale pregresso da consolidare (Sessione 0 — Parte 2)

| Contenuto prodotto in chat | Destinazione |
|----------------------------|--------------|
| Analisi fattibilità + matrice dati piattaforme | `01-PLATFORMS.md` |
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

## Sessione 0 — Parte 2 — 📦 Consolidamento materiale esplorativo

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- ✅ `docs/01-PLATFORMS.md` (DRAFT)
- ✅ `docs/05-ARCHITECTURE.md` (DRAFT)
- ✅ `docs/15-DESIGN-SYSTEM.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D0.8 | Scope MVP = 8 sorgenti + self-hosted via scrobbling; resto rinviato | Coprire il 90%+ del mercato europeo con sforzo sostenibile |
| D0.9 | Design system consolidato ora; spec per componente rinviata a Sessione 7 | Evitare over-engineering prima dello schema dati |
| D0.10 | Edge case noti catalogati in `01-PLATFORMS.md` §5 come vincoli adapter | Gli agenti non devono riscoprirli da zero |

### Prossimi passi
- Sessione 1: `02-DATA-SCHEMA.md`, `14-GLOSSARY.md`, ADR 0001-0003

## Sessione 1 — 🗄️ Fondamenta dati

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- ✅ `docs/02-DATA-SCHEMA.md` (DRAFT — pending approvazione Boss)
- ✅ `docs/14-GLOSSARY.md` (DRAFT — pending approvazione Boss)
- ✅ `docs/13-ADR/0001-pwa-first.md` (DRAFT — pending approvazione Boss)
- ✅ `docs/13-ADR/0002-local-first.md` (DRAFT — pending approvazione Boss)
- ✅ `docs/13-ADR/0003-adapter-pattern.md` (DRAFT — pending approvazione Boss)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D1.1 | `timestamp` = fine ascolto, `startedAt` = inizio; tabella semantica per piattaforma | Coerenza temporale cross-platform |
| D1.2 | Idempotenza import via `eventKey` unico | Re-import sicuri senza duplicati |
| D1.3 | Dedup tracce: ISRC → MBID → fuzzy hash **con durata** (DEDUP-1..3) | Bilancia precisione e copertura; bucket 2s |
| D1.4 | IP non persistito DI DEFAULT; toggle esplicito `PrivacySettings.retainIp` | Privacy-by-design + controllo utente |
| D1.5 | Derivati versionati (`derivedVersion`) e ricalcolabili | Coerenza analisi nel tempo |
| D1.6 | Contatori denormalizzati ricalcolabili (`recount()`) | Performance senza perdere verità |

### Aperti per approvazione Boss
- [ ] 02-DATA-SCHEMA.md → 🟢 APPROVED?
- [ ] 14-GLOSSARY.md → 🟢 APPROVED?
- [ ] ADR 0001/0002/0003 → 🟢 APPROVED?

### Prossimo passo
- **Sessione 2** (in nuova chat): SPEC-TEMPLATE adapter + spotify.md + fixture `fixtures/synthetic-history/spotify-sample.json`

## Sessione 2 — 🔌 Template adapter + Spotify

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- ✅ `docs/03-ADAPTERS/SPEC-TEMPLATE.md` (DRAFT)
- ✅ `docs/03-ADAPTERS/spotify.md` (DRAFT)
- ✅ `fixtures/synthetic-history/spotify-sample.json` (10 eventi sintetici con edge case)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D2.1 | SPEC-TEMPLATE come formato fisso per ogni adapter | Coerenza, reviewability |
| D2.2 | Regola `skipped` derivata (E1) documentata in spotify.md | Risolve bug storico Spotify |
| D2.3 | `CarDetectionEvent.json` richiede consenso separato da `retainIp` | Tracciamento movimenti = dato particolarmente sensibile |
| D2.4 | Fixture sintetico con 10 eventi rappresentativi | Base test per tutti gli adapter |
| D2.5 | `eventKey` = `platform:spotify_uri` o hash fallback | Idempotenza garantita |

### Aperti per approvazione Boss
- [ ] 03-ADAPTERS/SPEC-TEMPLATE.md → 🟢 APPROVED?
- [ ] 03-ADAPTERS/spotify.md → 🟢 APPROVED?

### Prossimo passo
- Sessione 3: Backlog strutturato + Testing strategy + AGENTS.md finale
- Dopo Sessione 3: valutare bundle di handoff per chiudere chat o continuare

---

## Template sessione (da copiare per le sessioni future)

    ## Sessione N — 🎯 [Nome]

    **Data**: [data]
    **Stato**: 🟡 In corso / ✅ Completata

    ### Obiettivi
    - [ ] obiettivo 1

    ### Documenti prodotti
    - ✅ `percorso/file.md` (APPROVED/DRAFT)

    ### Decisioni prese
    | # | Decisione | Motivazione |
    |---|-----------|-------------|
    | D.N.1 | ... | ... |

    ### Prossimi passi
    - ...

---

*Aggiornato ad ogni nuova sessione.*