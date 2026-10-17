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

## Sessione 11 — 🛠️ Implementazione Story 0.1 (scaffold monorepo + toolchain)

**Data**: 2026-10-16
**Stato**: ✅ Completata e **merged in `main`** (PR #2, squash `c0fb0a4`, 2026-10-16 16:54 +0200)
**Trigger**: dopo l'approvazione di `05-ARCHITECTURE` v1.0 (S9) e la policy versioni D.10.1/D.10.2 (S10), Story 0.1 viene implementata come prima storia della Fase 0 tecnica.

### Stato di avanzamento per story

| Story | Stato | Note |
|-------|-------|------|
| 0.1 Setup monorepo e toolchain | ✅ **DONE** — merged in `main` (PR #2, squash `c0fb0a4`) | scaffold completo; 5/5 task + 5/5 AC verificati; 9 problemi/fix/lesson in `18-DEV-LOG.md` §4 |
| 0.2 Schema DB e layer Dexie | ⬚ TODO | dipende da 0.1 ✅ |
| 0.3 Adapter Spotify base | ⬚ TODO | dipende da 0.2 |
| 0.4 UI import (onboarding) | ⬚ TODO | dipende da 0.3 |
| 0.5 PWA / service worker | ⬚ TODO | parallelo a 0.1, può partire |
| 0.6 Setup i18n | ⬚ TODO | parallelo a 0.1, può partire |
| 0.7 Operations runbook | ⬚ TODO | dipende da 0.2 e 0.5 |

### Risultato concreto di Story 0.1

- **Monorepo Turborepo** con workspace `apps/web` (@ls/web), `packages/core` (@ls/core), `packages/ui` (@ls/ui), `packages/config` (@ls/config)
- **Toolchain operativa**: ESLint 9 flat config, Prettier 3, Husky + lint-staged + commitlint, Vitest 3 + Playwright 1.5+
- **TypeScript 5.6+** con `paths` aliases (`@core/*`, `@ui/*`, `@web/*`); strict mode attivo
- **CI GitHub Actions** con Node 20, job lint + typecheck + test + build + bundle --check
- **Scaffold minimo** in `@ls/core`: `Logger` (con sink console, schema `{level, module, msg, ctx}`), `PLATFORM_IDS`/`PlatformId`, placeholder `packages/core/src/db/index.ts` per Story 0.2
- **Scaffold minimo** in `@ls/ui`: componente `Button` dimostrativo
- **Scaffold minimo** in `@ls/web`: `App.tsx` con rendering di PlatformId list + Button, smoke test Vitest, smoke E2E Playwright
- **Bundle script** esteso con `--check` mode (CI-friendly, deterministico)

### Acceptance criteria di Story 0.1 — tutte verificate ✅

- [x] `pnpm install` senza errori su node 20 LTS (warning pnpm 9→12 atteso per D.10.2)
- [x] `pnpm run lint` passa su codebase vuoto
- [x] `pnpm run test` esegue test in `@ls/core` e `@ls/web`
- [x] `pnpm run build` produce artefatti (`dist/` in @ls/core, @ls/ui, @ls/web)
- [x] CI GitHub Actions: lint + typecheck + test + build su ogni PR

### Documenti aggiornati
- 🟡 `docs/17-DEV-NOTES.md` (nuovo) — pitfalls toolchain consolidati (P0-P5)
- 🟡 `docs/18-DEV-LOG.md` (nuovo) — registro cronologico con entry Story 0.1 (8 problemi/fix/lesson)
- `docs/INDEX.md` → aggiornato post-S11
- `docs/11-BACKLOG.md` → Story 0.1 task marcati ✅
- `docs/BUNDLE.md` → rigenerato (include 17-DEV-NOTES, 18-DEV-LOG)
- `scripts/generate-bundle.ps1` → aggiornato con `docs/18-DEV-LOG.md`

### Decisioni / lesson learned emerse
- **Toolchain monorepo è single point of failure** (Vite/Vitest, paths, exports map, line endings): allocare sempre tempo per stabilizzarla prima delle feature (lesson consolidata in `18-DEV-LOG.md` Story 0.1)
- **Aggiungere sempre `docs/18-DEV-LOG.md` al `$files` del bundle** quando si crea un nuovo file in `docs/`
- **17-DEV-NOTES.md è la reference stabile dei pitfalls**; 18-DEV-LOG.md è il registro cronologico per story

### Prossimi step
1. ✅ ~~Aprire PR per Story 0.1~~ — **fatto**: PR #2 squash-merged `c0fb0a4`
2. Aprire issue `agent-ready` per Story 0.2 (Schema DB e layer Dexie) — ora sbloccata
3. Story 0.5 (PWA) e 0.6 (i18n) possono partire in parallelo a 0.2

### Esito post-merge (aggiunto S12)
PR #2 ha portato in `main` scaffold + toolchain completi ma i doc di stato (INDEX, SESSIONS, BACKLOG, 18-DEV-LOG) sono rimasti indietro rispetto al branch mergato (dicevano tutti "IN PROGRESS / PR non ancora aperta" mentre la realtà era ✅ merged). Il drift è stato corretto in **Sessione 12** e da quel momento `AGENTS.md` include un gate esplicito "post-merge doc sync" per evitare recidive.

---

## Sessione 12 — 📚 Doc-sync post-merge + gate AGENTS.md

**Data**: 2026-10-16
**Stato**: ✅ Completata
**Trigger**: il Boss nota che dopo la merge di PR #2 (squash `c0fb0a4`) i documenti di stato (INDEX, SESSIONS, BACKLOG, 18-DEV-LOG) sono rimasti leggermente indietro: Story 0.1 risultava "🟡 IN PROGRESS / PR non ancora aperta" mentre era in realtà ✅ merged. È esattamente il caso che il check-list PR di `AGENTS.md` non copriva: il gate esistente parlava di "documenti creati nella PR", non di **stato delle story dopo il merge**.

### Decisioni prese

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.12.1 | Aggiungere in `AGENTS.md` la sezione **"Checklist di sincronizzazione documentazione al merge"** (obbligatoria) | Il drift Story 0.1 dimostra che la checklist PR non bastava: serve un gate post-merge esplicito con tabella "cosa è cambiato → file da aggiornare" |
| D.12.2 | Responsabilità del sync = **chi esegue il merge** (o chi chiude la PR) | Chi fa il merge vede lo stato finale; deve aggiornare i doc nella stessa PR o in un commit di follow-up immediato |
| D.12.3 | Auto-check obbligatorio: `pwsh scripts/generate-bundle.ps1 --check` deve uscire 0 prima del merge | Il check già esiste in CI; promosso a gate di merge |
| D.12.4 | Verifica statale post-merge (revisioner): `docs/INDEX.md` §"Stato del progetto" deve riflettere `git log --oneline -5 main` | Catch-of-last-resort: se il sync fallisce in PR, il reviewer lo intercetta post-merge e apre una PR `docs:` immediata |
| D.12.5 | Aggiornare contestualmente INDEX, SESSIONS, BACKLOG, 18-DEV-LOG per riflettere lo stato reale di Story 0.1 | Allineamento alla realtà: PR #2 merged, branch `feat/0.1-monorepo-setup` non più aperto, 9 problemi risolti (non 8) |

### Documenti aggiornati
- `AGENTS.md` → aggiunta sezione "Checklist di sincronizzazione documentazione al merge"
- `docs/INDEX.md` → "Stato del progetto" e roadmap sessioni aggiornati; aggiunta Sessione 12
- `docs/SESSIONS.md` → Sessione 11 corretta (DONE, PR #2, `c0fb0a4`); aggiunta questa Sessione 12; changelog bumped
- `docs/11-BACKLOG.md` → Story 0.1 ✅ DONE; tabella "Stato di avanzamento" aggiornata; changelog bumped a v1.2.2
- `docs/18-DEV-LOG.md` → branch/PR status aggiornati; "8 problemi" → "9 problemi" (consistente con messaggio commit `c0fb0a4`); versione bumped a v0.3
- `docs/BUNDLE.md` → rigenerato (include le correzioni)

### Prossimi step
1. Aprire issue `agent-ready` per Story 0.2 (Schema DB e layer Dexie)
2. Story 0.5 (PWA) e 0.6 (i18n) possono partire in parallelo
3. Da ora in poi: ogni PR con merge in `main` deve soddisfare il nuovo gate D.12.1

---

## Sessione 13 — 🔧 Consolidamento documentazione pre-Fase 0

**Data**: 2026-10-16
**Stato**: ✅ Completata
**Trigger**: prima di aprire issue `agent-ready` per Story 0.2, audit finale della documentazione rivela **3 incongruenze bloccanti** e **1 gap di coverage** che avrebbero costretto l'agente a inventare. Il Boss chiede di chiudere tutto ora con una sessione di consolidamento.

### Gap chiusi

| # | Gap | Audit | Fix applicato |
|---|-----|-------|---------------|
| **F1** | M13 | PlatformCard states 4 (Backlog 0.4) vs 5 (07-UI-SPEC §2.5) | Canone 5: aggiornato Backlog Story 0.4 T0.4.1 + 06-UX §2.3 con tabella esplicita dei 5 stati + transizioni |
| **F2** | M5 | `artworkUrl` referenziato da 07-UI-SPEC §2.2/§2.10 ma inesistente in 02 | Aggiunto `artworkUrl: string \| null` su Track/Album in **02 v1.2**; nuova sezione §11 con cascata fonti (Spotify API → MB Cover Art → iTunes Search → placeholder); aggiornato schema TS; aggiornata spec Spotify adapter §3.1.1; nuova **Story 4.3 "Artwork enrichment"** in backlog |
| **F3** | C6 | Fixture Spotify `_expectedOutput` incoerente (uniqueTracks 8 vs 9 reali; nessun caso reale DEDUP-3) | Fixture v1.1: corretto `_expectedOutput`; aggiunto evento "Bohemian Rhapsody - Greatest Hits (Remaster)" con stessa durata di "Greatest Hits" → DEDUP-3 merge reale; `_metadata` bumped a 1.1; changelog audit con derivation esplicita di ogni numero |
| **F4** | V1 | `fixtures/db-seed/*` e `fixtures/scenarios/*` e `fixtures/demo-user.json` promessi da 10-TESTING §3.2/§3.3 e 06-UX §2.14, inesistenti | Creato `scripts/generate-fixtures.mjs` (deterministico, mulberry32, no dipendenze esterne); generati e committati: `minimal.json` (10), `medium.json` (5k), `large.json` (25k), 3 scenari, `demo-user.json`. Totale ~35 MB su disco. Nota: large.json ridotto da 100k a 25k per ragioni git-friendly (commento in script) |
| **F5** | audit | Story 2.2 AC "Bayesiano o PELT" vs 04§5 (custom change point) | AC Story 2.2 allineato: "Algoritmo come specificato in 04§5" con parametri e invarianti espliciti |
| **F6** | — | Decisione Boss: nessuna promozione DRAFT→APPROVED ora (mantieni APPROVED = zero ambiguità) | Lasciato 04/06/07/08/15 come DRAFT; chiarito in 02 v1.2 che 02 è l'unica source of truth "schema" |

### Decisioni prese

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.13.1 | PlatformCard = 5 stati canonici (empty/validating/parsing/done/error) | 07-UI-SPEC §2.5 era già dettagliata; il backlog era impreciso. Canone = spec dettagliata |
| D.13.2 | `artworkUrl` aggiunto a Track + Album (02 v1.2) | Chiusura M5 audit; popolamento demandato a enrichment (Story 4.3) con toggle `enrichMetadata` |
| D.13.3 | Cascata fonti artwork: Spotify Web API → MB Cover Art Archive → iTunes Search → placeholder gradient | Gerarchia: rete paid (Spotify) → rete free (MB) → rete free (iTunes) → locale (placeholder); tutte rispettano privacy-by-default |
| D.13.4 | Fixture Spotify v1.1 con 12 eventi (era 10) + caso reale DEDUP-3 | Audit C6 chiuso: 11 eventi musicali (1 DEDUP-3 merge) + 1 podcast = 12 totali; uniqueTracks 9, dedupApplied 1 |
| D.13.5 | `scripts/generate-fixtures.mjs` come unica source of truth per fixture grandi | Riproducibilità cross-environment; commit del solo minimal.json nel bundle; medium/large/scenari/demo rigenerati on-demand |
| D.13.6 | `large.json` ridotto a 25k eventi (vs 100k chiesti da 10-TESTING §3.2) | Git-friendly (~18 MB); supera il target AC Story 0.2 (10k in <500ms) con margine. Per ripristinare 100k: editare `count` in `scripts/generate-fixtures.mjs` |
| D.13.7 | Bundle `docs/BUNDLE.md` esclude fixture >10KB; include solo minimal.json + spotify-sample.json + scripts/generate-fixtures.mjs | BUNDLE era 300KB, con tutti i fixture sarebbe ~35MB; fuori scope per handoff AI. Il generator permette di rigenerare |
| D.13.8 | Nessuna promozione DRAFT→APPROVED in questa sessione | Il Boss preferisce attendere che eventuali altri fix emergano prima di promuovere; "APPROVED = zero ambiguità" |

### Documenti aggiornati

- `docs/02-DATA-SCHEMA.md` → **v1.2 APPROVED** (artworkUrl, §11 fonti, §10 migrazione, §9 indici)
- `docs/11-BACKLOG.md` → Story 0.4 T0.4.1 (5 stati) + Story 2.2 AC allineata + **nuova Story 4.3**
- `docs/06-UX-FLOWS-STATES.md` → §2.3 PlatformCard 5 stati + transizioni esplicite; §2.14 demo-user.json
- `docs/10-TESTING.md` → §3.2 note su large.json, §3.3 scenari con description, **nuovo §3.4 demo + §3.5 generazione**
- `docs/03-ADAPTERS/spotify.md` → §3.1.1 nota `artworkUrl: null` da export GDPR + rinvio Story 4.3
- `fixtures/synthetic-history/spotify-sample.json` → **v1.1** (12 eventi, _expectedOutput ricalcolato)
- `fixtures/db-seed/{minimal,medium,large}.json` → **nuovi** (10/5k/25k eventi)
- `fixtures/scenarios/{lockdown-2020,breakup-oct2021,summer-roadtrip}.json` → **nuovi** (6k/3k/5k eventi)
- `fixtures/demo-user.json` → **nuovo** (4.5k eventi, 1 anno)
- `scripts/generate-fixtures.mjs` → **nuovo** (Node ≥ 20, no deps, deterministico)
- `packages/core/src/schema/index.ts` → `Track.artworkUrl` + `Album.artworkUrl`
- `AGENTS.md` → struttura repo aggiornata (fixtures/ + scripts/generate-fixtures.mjs)
- `scripts/generate-bundle.ps1` → `$files` include script + 2 fixture piccoli; esclude i grossi (con commento)
- `docs/BUNDLE.md` → rigenerato

### Prossimi step
1. ✅ Aprire issue `agent-ready` per **Story 0.2 (Schema DB Dexie)** — ora bloccata
2. Story 0.5 (PWA) e 0.6 (i18n) possono partire in parallelo
3. Eventuale audit pre-`agent-ready` per Story 0.3 (Spotify adapter): la fixture v1.1 copre tutti gli edge case E1-E6 dichiarati, AC dovrebbe essere verificabile

### Esito post-merge (aggiunto in S13+post-merge)
PR #3 (merge commit `10ecde5` su `main`, 2026-10-16) ha portato in `main` tutto il consolidamento documentazione di S13. Gate D.12.1 applicato: verifica che `INDEX.md`, `SESSIONS.md` (questa entry), `18-DEV-LOG.md` (entry §5) e `BUNDLE.md` riflettano lo stato reale. Nessun drift rilevato (la S13 era già stata documentata in modo completo pre-merge). Branch `feat/0.2-dexie-schema` eliminata dopo il merge.

---

## Sessione 14 — 🗄️ Implementazione Story 0.2 (schema DB e layer Dexie)

**Data**: 2026-10-16/17
**Stato**: ✅ Completata + **merged in `main`** (PR #4, merge commit `fa09b06`, 2026-10-17, CI ✅)
**Trigger**: `main` aggiornato a `774e520` (doc-sync post PR #3): Story 0.2 sbloccata da 0.1 ✅, spec APPROVED `02-DATA-SCHEMA v1.2` + fixture `db-seed` disponibili. Nota operativa: una sessione parallela aveva lasciato un'implementazione parziale in stash sul branch (nome `feat/0.2-dexie-schema` consumato da PR #3); il lavoro è stato recuperato via stash, allineato a 02 v1.2 e completato.

### Risultato concreto di Story 0.2

- **Interfacce TypeScript complete** in `packages/core/src/schema/` (02 v1.2 §3+§4: `ListenEvent`, `Track`, `Artist`, `Album` con `artworkUrl`, `AudioFeatures`, `ListeningSession`, `Insight` + payload union, `ImportRecord`, `LibraryItem`, `Playlist(Item)`, `PrivacySettings`, `SearchQuery`; enum runtime `PLATFORM_IDS` allineati a §3.1 con `youtube_music`/`apple_music`)
- **Classe Dexie 4** `LifeSoundtrackDB` in `packages/core/src/db/db.ts`: `version(1).stores(...)` (11 tabelle) + `version(2)` (aggiunge `searchQueries`, D.A.3) — indici identici a 02 §6, verificati testualmente nel test di schema
- **Repository** CRUD + query base su `listens`, `tracks`, `artists`, `albums`, `features` in `repositories.ts` (upsert per PK `eventKey`/`canonicalKey`, query indicizzate, `purgeIp()` §3.8)
- **`recount()`** per contatori denormalizzati `listenCount` (02 §7 MIG-4), idempotente
- **26 test** con fake-indexeddb: schema/indici §6, migrazione v1→v2 con dati preservati, CRUD, idempotenza `eventKey` (invariante 10-TESTING §7), recount su fixture db-seed, integrazione `medium.json` (5k eventi, merge DEDUP su PK canonicalKey), performance (AC 10k < 500ms, min-of-3)
- **Coverage `packages/core/db/`: 100% stmts/branch/funcs** (target ≥80%); script `test:coverage` (core + root) che esclude i test di performance dalla strumentazione (P9)

### Acceptance criteria di Story 0.2 — tutte verificate ✅

- [x] Tutte le tabelle di `02-DATA-SCHEMA.md` §6 esistono (12/12)
- [x] Indici corrispondono alla spec (primKey + indici verificati uno a uno)
- [x] `recount()` ricalcola `listenCount` correttamente (minimal + medium, incluse fusioni DEDUP)
- [x] Coverage `db/` ≥80% (raggiunto 100%)
- [x] Test 10.000 ListenEvent < 500ms (AC, min-of-3)

### Decisioni / lesson learned emerse

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.14.1 | `Artist` riallineato a 02 v1.2 §3.3 (rimossi `artworkUrl`/`firstSeenAt`/`lastSeenAt` introdotti nel consolidamento S13) | Golden rule: la spec APPROVED è fonte di verità; i fixture db-seed non emettono quei campi |
| D.14.2 | Semantica FK documentata: `listens.trackId` → `Track.id` (UUID), PK di `tracks` resta `canonicalKey` | I fixture db-seed (10-TESTING §3.2) usano l'UUID; il DEDUP resta identità della track |
| D.14.3 | Test di performance isolati in `perf.test.ts`, esclusi dalle run coverage (`test:coverage`) | La strumentazione v8 raddoppia i tempi: l'AC sotto coverage sarebbe un artefatto (dettagli in `17-DEV-NOTES` P9) |
| D.14.4 | Verifiche di re-import su slice nei test (fake-indexeddb slow-path su bulkPut di chiavi esistenti) | L'invariante è garantito dalla PK unique; il re-import integrale 50k è AC Story 0.3 su IndexedDB nativo |
| D.14.5 | Zod NON incluso in Story 0.2 | I task/AC del backlog (v1.2.4) non lo prevedono; la validazione runtime è naturale confine dell'adapter (Story 0.3) |

### Documenti aggiornati

- `docs/11-BACKLOG.md` → **v1.2.4**: Story 0.2 🟡 IN PROGRESS (5/5 task, 5/5 AC), tabella stato avanzamento, changelog
- `docs/17-DEV-NOTES.md` → **v0.2**: pitfall P6 (Dexie `modify` su Collection), P7 (slow-path fake-indexeddb), P8 (barrel multipli + `import type`), P9 (perf vs coverage); §1 comando `test:coverage`; §4 aggiornato
- `docs/18-DEV-LOG.md` → **v0.5**: §6 entry Sessione 14 (5 problemi/fix/lesson 0.2-1..5) + indice sintomi + osservazione fixture per Story 0.3
- `docs/INDEX.md` → roadmap (Sessione 14) e "Stato del progetto" aggiornati
- `docs/BUNDLE.md` → rigenerato

### Prossimi step
1. ~~Review + merge della PR Story 0.2~~ ✅ **PR #4 merged (`fa09b06`, 2026-10-17), CI su main ✅, gate D.12.1 applicato**
2. **Story 0.3 (Adapter Spotify base)** — sbloccata dal merge di 0.2; aprire issue `agent-ready` (creare prima i label mancanti su GitHub: `agent-ready`, `phase-0`, `area:db`, …)
3. In parallelo: Story 0.5 (PWA) e 0.6 (i18n); Story 0.7 (Operations runbook) resta in attesa di 0.5

### Esito post-merge (aggiunto in S14+post-merge, 2026-10-17)
PR #4 (merge commit `fa09b06` su `main`) ha portato in `main` l'implementazione completa di Story 0.2 (19 file, +1458/−58). Gate D.12.1 applicato senza drift: `11-BACKLOG` v1.2.5 (Story 0.2 ✅ DONE, 0.3 sbloccata), `INDEX.md` (stato "fondamenta completate"), `18-DEV-LOG` §6 (stato merged), `BUNDLE.md` rigenerato (check exit 0). CI su main: **success**. Branch `feat/0.2-schema-db-dexie` eliminata dopo il merge.

---

## Sessione 17 — 🧹 Governance post-merge (cleanup + parallelismo)

**Data**: 2026-10-17
**Stato**: ✅ Completata
**Trigger**: le verifiche di governance post-merge di Story 0.2 (PR #4) rivelano due branch remoti mergati non eliminati (`origin/feat/0.2-dexie-schema`, `origin/feat/0.2-schema-db-dexie`), l'assenza dei label GitHub previsti da `11-BACKLOG.md` (gate `agent-ready`) e nessuna issue aperta per le story sbloccate. La pulizia dei branch era una pratica implicita: viene formalizzata come policy obbligatoria in `AGENTS.md`.

### Attività svolte

- **Cleanup branch remoti**: eliminati `origin/feat/0.2-schema-db-dexie` (merged via PR #4, `fa09b06`) e `origin/feat/0.2-dexie-schema` (merged via PR #3, `10ecde5`); `git remote prune origin` eseguito. Stato finale: **zero branch remoti** oltre a `main` (auto-check §♻️ pulito).
- **Policy**: `AGENTS.md` → **v1.2** (PR #8, branch `docs/agents-md-post-merge-cleanup`, merge commit `a9f31a3`): nuova sezione obbligatoria **"♻️ Pulizia branch post-merge"** (chi esegue, comandi minimi, eccezioni, auto-check one-liner) + riferimenti in §"Git workflow" e nella tabella "Checklist di sincronizzazione documentazione al merge". `docs/BUNDLE.md` rigenerato nella PR e riallineato con follow-up `e514404` (solo header `Data:`).
- **Label GitHub creati**: `agent-ready`, `needs-spec`, `docs`, `phase-0`, `area:adapter`, `area:ui`, `area:devops`, `priority:blocker`, `priority:important`, `priority:later`, `size:S`, `size:M`, `size:L` — il set previsto da `11-BACKLOG.md` §"Stato di avanzamento" e `AGENTS.md` §"Sistema di issue e label".
- **Issue aperte per il parallelismo della Fase 0** (tutte `agent-ready`, aree di file disgiunte):
  - #5 — Story 0.6 Setup i18n (i18next) — `size:S`, `area:ui`
  - #6 — Story 0.3 Adapter Spotify base — `size:L`, `area:adapter`
  - #7 — Story 0.5 PWA e service worker — `size:M`, `area:devops`
- **Issue di follow-up**: #9 (questo sync di INDEX/SESSIONS), #10 (bug: `generate-bundle.ps1 --check` ritenuto non deterministico — `needs-spec`, decisione Boss pendente; verifica 2026-10-17: la normalizzazione della riga `Data:` è attiva in `main` dal commit `03c1290`, vedi `18-DEV-LOG.md` 0.1-5, e il check esce 0 con timestamp stantio).

### Decisioni prese

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.17.1 | La pulizia dei branch remoti post-merge diventa policy obbligatoria in `AGENTS.md` v1.2, con auto-check | I branch stale sono la principale fonte di errori "ho lavorato sul branch sbagliato" e di conflitti fantasma nel workflow parallelo (più agenti su più issue) |
| D.17.2 | PR #8 mantenuta chirurgica (solo `AGENTS.md` + `BUNDLE.md`); il sync di INDEX/SESSIONS demandato all'issue dedicata #9 | Prima si approva la policy (review focalizzata), poi si registra lo stato nelle memorie di progetto |
| D.17.3 | Apertura immediata di 3 issue `agent-ready` (Story 0.3, 0.5, 0.6) per abilitare il lavoro parallelo di più agenti | Le tre story non condividono file: adapter (`@ls/core/adapters/spotify/*`), PWA (`apps/web` vite/manifest), i18n (setup `@ls/web`) — nessun merge conflict atteso |
| D.17.4 | Issue #10 (bundle-check) lasciata `needs-spec`: la scelta tra le opzioni A/B/C compete al Boss | Il check è un gate CI: cambiarne la semantica richiede la decisione del project owner, non di un agente |

### Documenti aggiornati

- `AGENTS.md` → **v1.2** (§"♻️ Pulizia branch post-merge" + auto-check) — PR #8, `a9f31a3`
- `docs/BUNDLE.md` → rigenerato in PR #8; riallineato con follow-up `e514404`
- `docs/INDEX.md` → issue #9 (questa PR): riga 17 in roadmap, §"Stato del progetto", versioni allineate nella tabella documenti (AGENTS v1.2, 11 v1.2.5, 17 v0.2, 18 v0.6)
- `docs/SESSIONS.md` → issue #9 (questa PR): questa entry + changelog v0.7

### Prossimi step

1. Lavorare in parallelo le issue #6 (Story 0.3), #7 (Story 0.5), #5 (Story 0.6) — un branch `feat/*` per issue
2. Decisione del Boss su #10 (evidenza raccolta nel commento sull'issue: normalizzazione già attiva)
3. Story 0.4 (UI import) dopo 0.3; Story 0.7 (Operations runbook) dopo 0.2 + 0.5
4. A ogni merge: applicare la policy §♻️ (eliminazione branch remoto + auto-check `git branch -r --merged main | Select-String -NotMatch 'main$|HEAD'`)

---

## Sessione 18 — 🎫 Protocollo di claim per agenti paralleli (ADR-0006)

**Data**: 2026-10-17
**Stato**: 🟡 In corso (issue #11, claim `kilo-HP-ELITEBOOK-hjoe`)

**Trigger**: il project owner nota che il workflow multi-agente produceva duplicazioni: N agenti lanciati in parallelo seguivano lo stesso percorso documentato e convergevano sulla stessa story. Mancava un meccanismo di claim + lock visibile.

### Attività svolte

- **ADR-0006** creato in `docs/13-ADR/0006-multi-agent-task-claiming.md` 🟢 APPROVED v1.0: self-claim via label `in-progress` + commento `claim:`; vince l'ID commento GitHub più basso; riverifica obbligatoria; cascata per priorità; TTL 12h; rilascio obbligatorio; assignee scartato come discriminatore perché gli agenti condividono lo stesso PAT.
- **`AGENTS.md`** aggiornato a **v1.3**: nuova sezione **"🎫 Presa in carico delle story (claim)"** con procedura `gh` (claim, riverifica, yield, stale-release, release); §"🚀 Primo task" riscritta claim-first; label `in-progress` aggiunta alla tabella label; PAT scope esteso a `issues: read/write`.
- **`docs/11-BACKLOG.md`** aggiornato a **v1.3.0**: §"Priorità di lavorazione" rivista come ordine di **tentativo** (claim-first), con regola ADR-0006 in calce; legenda 🟡 legata alla label `in-progress`; changelog.
- **`docs/INDEX.md`** aggiornato: `13-ADR` ×5 (0006 incluso), AGENTS v1.2 (NB: bump a v1.3 avviene in questa stessa PR), "Stato del progetto" e roadmap allineati.
- **`docs/BUNDLE.md`** rigenerato; `scripts/generate-bundle.ps1 --check` esce 0.
- **Label GitHub `in-progress`** creata (le altre label del set erano state create in S17).

### Decisioni prese

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.18.1 | Self-claim via label `in-progress` + commento `claim:` come meccanismo primario di presa in carico | Race condition eliminata deterministicamente (ID commento GitHub monotonico) e visibile in UI senza toccare `main` |
| D.18.2 | Assignee GitHub scartato come discriminatore del vincitore | Tutti gli agenti di sviluppo condividono lo stesso PAT (`@me` non discrimina); usato il commento + ID agente |
| D.18.3 | TTL claim 12h con procedura `stale-release` esplicita | Recupero automatico di claim abbandonati senza intervento del project owner |
| D.18.4 | PAT esteso a `contents: read/write` **+ `issues: read/write`** (repo-only) per gli agenti di sviluppo | Necessario per `gh issue edit/comment`; l'AI di review non richiede PAT |

### Documenti aggiornati

- `docs/13-ADR/0006-multi-agent-task-claiming.md` → **nuovo** 🟢 APPROVED v1.0
- `AGENTS.md` → **v1.3** (§"🎫 Presa in carico delle story" + §"🚀 Primo task" claim-first + label `in-progress` in tabella + PAT esteso)
- `docs/11-BACKLOG.md` → **v1.3.0** (claim-first + legenda 🟡 + changelog)
- `docs/INDEX.md` → tabella documenti e "Stato del progetto" allineati
- `docs/SESSIONS.md` → questa entry + changelog v0.8
- `docs/BUNDLE.md` → rigenerato
- `scripts/generate-bundle.ps1` → `$files` include `docs/13-ADR/0006-multi-agent-task-claiming.md`

### Prossimi step

1. Aprire PR per questa issue (#11) → merge in `main`
2. Eliminare il branch `feat/11-task-claiming-protocol` dopo il merge (policy §♻️)
3. Da questo merge in poi: ogni agente che arriva sul repo esegue **prima** la procedura di claim descritta in `AGENTS.md` §"🎫 Presa in carico delle story" prima di toccare codice o branch

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

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Bozza iniziale, consolidata dal lavoro esplorativo |
| 0.2 | Sessione 11 (2026-10-16) | Aggiunte Sessioni 10 (policy versioni D.10.1/D.10.2) e 11 (Story 0.1 scaffold monorepo) con stato avanzamento per story |
| 0.3 | Sessione 12 (2026-10-16) | Corretta Sessione 11 (Story 0.1 ✅ DONE, PR #2, squash `c0fb0a4`); aggiunta Sessione 12 (doc-sync post-merge + gate D.12.1-D.12.5 in `AGENTS.md`) |
| 0.4 | Sessione 13 (2026-10-16) | Aggiunta Sessione 13 (consolidamento documentazione pre-Fase 0): chiusi M13/M5/C6/V1 + ambiguità Story 2.2; 02 v1.2 con artworkUrl; nuovi fixture generator + 7 file; backlog v1.2.3 con Story 4.3; **post-merge**: PR #3 merged (`10ecde5`), branch eliminata, gate D.12.1 applicato senza drift |
| 0.5 | Sessione 14 (2026-10-16) | Aggiunta Sessione 14 (implementazione Story 0.2 — schema DB e layer Dexie): 5/5 task + 5/5 AC, coverage `db/` 100%, decisioni D.14.1-D.14.5 (riallineamento Artist a 02 v1.2, semantica FK, perf test isolati, Zod fuori perimetro) |
| 0.6 | 2026-10-17 (post-merge) | **Esito post-merge S14**: PR #4 merged (`fa09b06`, CI su main ✅), gate D.12.1 applicato senza drift; Story 0.3 sbloccata; Sessione 14 aggiornata con esito |
| 0.7 | 2026-10-17 (Sessione 17) | Aggiunta Sessione 17 (governance post-merge): policy pulizia branch in AGENTS.md v1.2 (PR #8, `a9f31a3`), cleanup branch remoti, label GitHub creati, 3 issue `agent-ready` aperte (#5/#6/#7), follow-up #9/#10; sync INDEX/SESSIONS via issue #9 |
| 0.8 | 2026-10-17 (Sessione 18) | Aggiunta Sessione 18 (protocollo claim agenti paralleli — ADR-0006): self-claim via label `in-progress` + commento `claim:`, ID GitHub come discriminatore del vincitore, TTL 12h, rilascio obbligatorio; AGENTS.md v1.3 con §"🎫 Presa in carico delle story" + §"🚀 Primo task" claim-first; 11-BACKLOG v1.3.0; decisioni D.18.1-D.18.4; issue #11 in-progress (claim `kilo-HP-ELITEBOOK-hjoe`) |

---

*Aggiornato ad ogni nuova sessione.*
