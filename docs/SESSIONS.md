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

---

*Aggiornato ad ogni nuova sessione.*
