# 11 — Backlog Strutturato

> Status: 🟢 APPROVED · Versione 1.2.2 · Sessione 12 (2026-10-16) · aggiornato S12 (doc-sync post-merge PR #2)
> Formato: Epic → Story → Task con acceptance criteria verificabili

---

## Legenda

| Simbolo | Significato |
|---------|-------------|
| `[PHASE-N]` | Fase della roadmap (0=fondamenta, 1=import core, 2=analisi, 3=UI, 4=beta) |
| `[PHASE-POST]` | Post-implementazione: da eseguire **solo a sviluppo concluso** (decisione D.10.2, `SESSIONS.md`) |
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

**Stato**: ✅ **DONE** — merged in `main` (PR #2, squash `c0fb0a4`, 2026-10-16 16:54 +0200)
**Branch**: `feat/0.1-monorepo-setup` (merged → eliminata dopo il merge)
**Commits**: `66cbc72`, `bff252d`, `e654ffc` (branch) + `c0fb0a4` (squash merge in `main`)
**Registro**: `docs/18-DEV-LOG.md` §4 entry Story 0.1 (**9** problemi/fix/lesson)
**Pitfalls**: `docs/17-DEV-NOTES.md` §3 (P0-P5)

**Descrizione**: Inizializzare il monorepo Turborepo con le cartelle `apps/web`, `packages/core`, `packages/ui`, toolchain TypeScript, lint, format.

**Task**:
- [x] T0.1.1 — Init monorepo con pnpm workspaces + Turborepo
- [x] T0.1.2 — Config TypeScript base + path aliases
- [x] T0.1.3 — ESLint + Prettier + commit hook (husky + lint-staged + commitlint)
- [x] T0.1.4 — Vitest + Playwright setup
- [x] T0.1.5 — `pnpm run lint`, `pnpm run test`, `pnpm run build` funzionanti

**Acceptance criteria**:
- [x] `pnpm install` senza errori su node 20 LTS (warning pnpm 9→12 atteso per D.10.2, differito a Story 6.1)
- [x] `pnpm run lint` passa su codebase vuoto
- [x] `pnpm run test` esegue almeno un test dummy (in `@ls/core` e `@ls/web`)
- [x] `pnpm run build` produce artefatti (`dist/` in @ls/core, @ls/ui, @ls/web)
- [x] CI GitHub Actions: lint + typecheck + test + build su ogni PR

**Cosa rimane (non bloccante per Story 0.2+)**:
- Sostituire `@ls/core` placeholder `db/index.ts` con implementazione Dexie reale (Story 0.2)
- Sostituire `Button` placeholder in `@ls/ui` con design system reale (Story 3.1+)
- Sostituire `App.tsx` placeholder in `@ls/web` con onboarding reale (Story 0.4)

**Dipendenze**: nessuna
**Spec**: `05-ARCHITECTURE.md` §8-9 (confermata in pratica)
**Sblocca**: Story 0.2 (Schema DB), Story 0.5 (PWA), Story 0.6 (i18n)

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

## EPIC 6 — Manutenzione stack (post-implementazione)

Obiettivo: allineare toolchain e dipendenze alle ultime major disponibili **a sviluppo concluso**, senza bloccare le fasi correnti (decisioni D.10.1 e D.10.2, `SESSIONS.md`).

### Story 6.1 — Upgrade toolchain e dipendenze a ultime major `[PHASE-POST]` `[AREA:devops]` `[PRI:L]` `[SIZE:M]` `[DEP:0.1]`

**Descrizione**: Il progetto adotta la policy "ultime major disponibili" per toolchain e dipendenze dirette (D.10.1). L'upgrade **non viene eseguito durante le fasi di sviluppo**: si esegue al termine dell'implementazione (D.10.2), così la Fase 0 tecnica e le story correnti proseguono senza attese. Alla data della decisione (2026-10-16) gli avvisi noti sono: pnpm 9.15.9 → 12.x, ESLint 9 (linea deprecata) → 10.x. **All'esecuzione valgono le major più recenti disponibili in quel momento**, non le versioni citate qui.

**Task**:
- T6.1.1 — Bump `packageManager` in `package.json` all'ultima major di pnpm; rigenerare `pnpm-lock.yaml`; allineare CI (`12-DEVOPS.md` §2) e Dockerfile (`§3.1`)
- T6.1.2 — Bump ESLint a ultima major in `packages/config/` (flat config) con plugin compatibili (`typescript-eslint`, react, vitest); correggere le nuove regole
- T6.1.3 — Bump a cascata di tooling e dipendenze dirette (TypeScript, Vite, Vitest, Tailwind, Turborepo, ...) via `pnpm update --latest`; revisionare i breaking changes
- T6.1.4 — Allineare la documentazione: `05-ARCHITECTURE.md` §8/§8.1 e `12-DEVOPS.md` alle versioni effettive; rigenerare `docs/BUNDLE.md`
- T6.1.5 — Verifica completa: `pnpm run lint`, `pnpm run test`, `pnpm run build`, `pnpm run e2e`; CI verde

**Acceptance criteria**:
- [ ] `pnpm install --frozen-lockfile` passa in CI con il lockfile rigenerato
- [ ] Nessun warning `deprecated` sulle dipendenze dirette (root + workspace projects)
- [ ] `pnpm run lint`, `pnpm run test`, `pnpm run build` verdi dopo il bump
- [ ] `05-ARCHITECTURE.md` §8 e `12-DEVOPS.md` citano le versioni effettivamente in uso
- [ ] `pwsh scripts/generate-bundle.ps1 --check` exit 0

**Dipendenze**: Story 0.1 (scheduling: **solo a implementazione conclusa**, mai a metà di altre story)
**Spec**: `05-ARCHITECTURE.md` §8; `12-DEVOPS.md` §2-3; decisioni D.10.1/D.10.2 in `SESSIONS.md`

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
16. **6.1** Upgrade stack a ultime major — **solo al termine dell'implementazione** (D.10.2): non blocca le fasi 0-5

## Stato di avanzamento (snapshot implementazione)

> Aggiornato alla **Sessione 12** (2026-10-16) dopo doc-sync post-merge. Per il dettaglio cronologico vedi `docs/18-DEV-LOG.md`.

| EPIC | Story | Stato | Branch | Note |
|------|-------|-------|--------|------|
| 0 | 0.1 Setup monorepo | ✅ DONE | — (merged in `main`) | Scaffold + toolchain completi (5/5 task, 5/5 AC); 9 problemi risolti in `18-DEV-LOG` §4. **PR #2 squash-merged `c0fb0a4` (2026-10-16 16:54 +0200)**. |
| 0 | 0.2 Schema DB Dexie | ⬚ TODO (sbloccata) | — | sbloccata da 0.1 ✅; issue `agent-ready` da aprire |
| 0 | 0.3 Adapter Spotify | ⬚ TODO | — | dipende da 0.2 |
| 0 | 0.4 UI import | ⬚ TODO | — | dipende da 0.3 |
| 0 | 0.5 PWA / service worker | ⬚ TODO (può partire) | — | parallelo a 0.1; nessuna dipendenza bloccante |
| 0 | 0.6 Setup i18n | ⬚ TODO (può partire) | — | parallelo a 0.1; nessuna dipendenza bloccante |
| 0 | 0.7 Operations runbook | ⬚ TODO | — | dipende da 0.2 e 0.5 |
| 1 | 1.1-1.3 altri adapter | ⬚ TODO | — | dipende da 0.3 |
| 1 | 1.4 Dedup promozione | ⬚ TODO | — | dipende da 0.3 |
| 1 | 1.5 Scrobbling hub | ⬚ TODO | — | — |
| 2-3 | 2.x, 3.x analisi + UI | ⬚ TODO | — | dipendono da 0.2 |
| 4 | 4.x enrichment | ⬚ TODO | — | dipendono da 0.2 |
| 5 | 5.x privacy | ⬚ TODO | — | — |
| 6 | 6.1 Upgrade stack | ⬚ SCHEDULED (post-impl) | — | D.10.2: solo a implementazione conclusa |

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
| 1.2 | Sessione 10 (2026-10-16) | Nuova EPIC 6 (post-implementazione) con **Story 6.1 "Upgrade toolchain a ultime major"**: policy D.10.1 + scheduling differito D.10.2 (pnpm 9→12, ESLint 9→10+ e bump a cascata eseguiti solo a fine sviluppo); legenda + tag `[PHASE-POST]`; rimossa duplicazione accidentale del blocco Story 0.6 dopo Story 0.7 (reflow Sessione 9) |
| 1.2.1 | Sessione 11 (2026-10-16) | **Story 0.1 marcata IN PROGRESS**: task 5/5, AC 5/5 verificati (scaffold monorepo + toolchain); nuove sezioni "Stato" e "Cosa rimane" nella story; aggiunta tabella "Stato di avanzamento" globale; cross-ref a `17-DEV-NOTES.md` e `18-DEV-LOG.md` |
| 1.2.2 | Sessione 12 (2026-10-16) | **Doc-sync post-merge**: Story 0.1 ora ✅ DONE (PR #2 squash-merged `c0fb0a4`); tabella "Stato di avanzamento" corretta; riferimento "8 problemi" → "9 problemi" (coerente con messaggio commit) |