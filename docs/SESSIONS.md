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

## Sessione 10 — 🔄 Policy versioni toolchain (mini-sessione)

**Data**: 2026-10-16
**Stato**: ✅ Completata
**Trigger**: durante `pnpm install` compaiono l'avviso "Update available! 9.15.9 → 12.11.2" (pnpm) e `WARN deprecated eslint@9.39.5`. Il Boss chiede verifica in documentazione: la policy "ultime versioni per tutti i pacchetti" **non era mai stata formalizzata** (nessuna decisione in Sessioni 0-9 né nell'audit).

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.10.1 | Policy versioni: toolchain e dipendenze dirette seguono le **ultime major disponibili** | Evitare di sviluppare su major EOL (es. ESLint 9) e accumulare debito di upgrade |
| D.10.2 | L'upgrade corrente (pnpm 9→12, ESLint 9→10+, bump a cascata) è **differito al termine dell'implementazione** → Story 6.1 `[PHASE-POST]` in `11-BACKLOG.md` v1.2 | Non bloccare la Fase 0 tecnica: le story correnti proseguono su pnpm 9 / ESLint 9 finché l'implementazione non è conclusa |

### Documenti aggiornati
- 🟢 `docs/11-BACKLOG.md` → v1.2 (EPIC 6 + Story 6.1; rimossa duplicazione accidentale del blocco Story 0.6)
- 🟢 `docs/SESSIONS.md` → questa entry
- `docs/INDEX.md` → roadmap e versione backlog allineate
- `docs/BUNDLE.md` → rigenerato

### Prossimi step
1. Proseguire con la Fase 0 tecnica (story 0.1 `agent-ready`) **senza attendere l'upgrade**: Story 6.1 viene eseguita solo a implementazione conclusa.

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
