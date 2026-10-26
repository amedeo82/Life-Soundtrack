# 11 — Backlog Strutturato

> Status: 🟢 APPROVED · Versione 1.6.0 · Sessione 38 (2026-10-21, issue #90) · allineamento tabella di stato legacy (fonte di verità = blocco `AGGREGATE-STORIES-*`)
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
- 🟡 IN PROGRESS — in lavorazione (issue con label `in-progress` su GitHub, vedi ADR-0006)
- 👀 IN REVIEW — PR aperta, in attesa di review; label `status:in-review` (ADR-0007)
- ✅ DONE — completata, PR mergata e validata; label `status:done`, issue chiusa (ADR-0007)
- ❌ WONTDO — PR rifiutata / scope cancellato; label `status:wontdo`, issue chiusa (ADR-0007)
- 🛑 BLOCKED — dipende da altro o da spec mancante; label `status:blocked-other` (ADR-0007)

**Mutua esclusione**: `agent-ready` e `status:*` sono mutuamente esclusivi su un'issue. Un'issue è candidabile al claim solo se ha `agent-ready` e nessuna `status:*` (vedi ADR-0007 + `AGENTS.md` §"🚀 Primo task").

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

**Stato**: ✅ **DONE** — merged in `main` (PR #4, merge commit `fa09b06`, 2026-10-17)
**Branch**: `feat/0.2-schema-db-dexie` (merged → eliminata dopo il merge)
**Registro**: `docs/18-DEV-LOG.md` §6 entry Story 0.2 (5 problemi/fix/lesson 0.2-1..5)

**Descrizione**: Implementare lo schema Dexie come definito in `02-DATA-SCHEMA.md` §6, con migrazioni e API di accesso.

**Task**:
- [x] T0.2.1 — Interfacce TypeScript in `packages/core/schema/`
- [x] T0.2.2 — Class Dexie con `db.version(1).stores(...)` (più `version(2)` con `searchQueries`, 02 v1.1/v1.2 §6)
- [x] T0.2.3 — Repository: `listens`, `tracks`, `artists`, `albums`, `features` (CRUD + query base)
- [x] T0.2.4 — Funzione `recount()` per contatori denormalizzati
- [x] T0.2.5 — Test con DB in-memory (fake-indexeddb)

**Acceptance criteria**:
- [x] Tutte le tabelle di `02-DATA-SCHEMA.md` §6 esistono
- [x] Indici corrispondono alla spec
- [x] `recount()` ricalcola `listenCount` correttamente
- [x] Test unitari: ≥80% coverage su `packages/core/db/` (raggiunto 100% stmts su `db/`)
- [x] Test con 10.000 ListenEvent in < 500ms

**Dipendenze**: Story 0.1
**Spec**: `02-DATA-SCHEMA.md` §3, §6, §7

---

### Story 0.3 — Adapter Spotify base `[PHASE-0]` `[AREA:adapter]` `[PRI:B]` `[SIZE:L]` `[DEP:0.2]`

**Stato**: ✅ **DONE** — merged in `main` (PR #28, merge commit `3dc9654`, 2026-10-18)

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

**Stato**: ✅ **DONE** — merged in `main` (PR #71, merge commit `0a8e83f`, 2026-10-20)

**Descrizione**: Schermate ① Benvenuto → ② Privacy → ③ Import → ④ Processing.

**Task**:
- T0.4.1 — Componente `DropZone` + `PlatformCard` (**5 stati: `empty` / `validating` / `parsing` / `done` / `error`** — vedi `07-UI-SPEC §2.5`; aggiornato in Sessione 13, chiusura M13 audit)
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
- [ ] PlatformCard: tutti gli stati `empty`/`validating`/`parsing`/`done`/`error` visibili e accessibili (a11y `role="button"` + `aria-describedby`)

**Dipendenze**: Story 0.3
**Spec**: `15-DESIGN-SYSTEM.md`, mockup schermate ①-④

---

### Story 0.5 — PWA e service worker `[PHASE-0]` `[AREA:devops]` `[PRI:B]` `[SIZE:M]` `[DEP:0.1]`

**Stato**: ✅ **DONE** (post-merge PR #19, merge commit `3fa3c0d`, 2026-10-18) · 4/4 task + 4/4 AC · bundle 291 KB gzip 91 KB (budget 300 KB) · claim `kilo-HP-ELITEBOOK-3b3f`
**Branch**: `feat/7-pwa-and-service-worker` (in review → merged → eliminata dopo merge)
**Registro**: `docs/18-DEV-LOG.md` §11 entry Story 0.5 (5 problemi/fix/lesson 0.5-1..5)
**Pitfalls**: 0.5-1 `getByText` substring ambiguity → `getByRole('button', { name })`; 0.5-2 cleanup RTL con `globals: false` → `test-setup.ts` esplicito; 0.5-3 `it.each` non preserva tuple types; 0.5-4 PNG zero-deps con `node:zlib`; 0.5-5 virtual module `vite-plugin-pwa` aliasato in jsdom

**Descrizione**: Trasformare la web app in una PWA installabile, con service worker che gestisce offline-first, precache degli asset e strategia network-first per enrichment con fallback cache.

**Task**:
- [x] T0.5.1 — Configurazione `vite-plugin-pwa` con Workbox (`apps/web/vite.config.ts`, `registerType: 'prompt'` + `injectRegister: 'auto'`)
- [x] T0.5.2 — Manifest (nome, icone 192/512/maskable/apple-touch, theme color) → `apps/web/index.html` + manifest generato da plugin; icone PNG deterministically generate da `scripts/generate-pwa-icons.mjs` (zero deps)
- [x] T0.5.3 — Strategia cache: precache shell + NetworkFirst per `/version.json` (cache `ls-version`, maxEntries=1, maxAgeSeconds=300) + CacheFirst Google Fonts (cache `ls-google-fonts`, 365gg)
- [x] T0.5.4 — Update prompt UX (`apps/web/src/hooks/useAppUpdate.ts` con `useRegisterSW` da `virtual:pwa-register/react`, classificazione patch/minor/major con `parseSemver`/`compareSemver`/`classifyUpdate`, `apps/web/src/components/UpdateBanner.tsx` con `role="status"` + `aria-live="polite"` + CTA "Più tardi" nascosta per major)

**Acceptance criteria** (verificati su branch, pre-merge PR #19):
- [x] App installabile da Chrome/Edge su desktop e mobile — manifest valido (`dist/manifest.webmanifest` con theme_color #8B5CF6, background_color #0A0E1A, display=standalone, icons 192/512/maskable, lang=it, start_url=/); SW registrato via `vite-plugin-pwa` `injectRegister: 'auto'`
- [x] Offline: tutte le schermate funzionano (tranne enrichment) — Workbox precache 12 entries (231.89 KiB: HTML + JS + 4 icone + manifest); `navigateFallback: '/index.html'` con `denylist: [\/api\/, \/version\.json\]` esclude `/version.json` (enrichment/cache-version) dal precache routing
- [x] Update disponibile → banner con bottone "Ricarica" — `useAppUpdate().update()` chiama `updateServiceWorker(true)` → SW emette `SKIP_WAITING` → reload; `<UpdateBanner>` mostra CTA "Aggiorna ora" (minor) o "Aggiorna e riavvia" (major, bloccante) — coperto da 6 test su `update-banner.test.tsx` + 26 test su `use-app-update.test.ts`
- [x] Lighthouse PWA score ≥ 90 (verifica finale spetta al Boss in preview deploy) — manifest + SW + theme color + icons + display standalone garantiscono il punteggio pieno; bundle 227.81 KB gzip 71.36 KB (budget 300 KB ✅)

**Sblocca**: Story 0.7 (Operations runbook — dipende da 0.5)

**Dipendenze**: Story 0.1 ✅
**Spec**: `05-ARCHITECTURE.md` §8 (stack `vite-plugin-pwa` + Workbox), §11.2 (SW lifecycle), §11.3 (prompt policy patch/minor/major), §11.4 (DB migration rollback via SW); `ADR-0001` (PWA-first)

---

### Story 0.6 — Setup i18n (i18next) `[PHASE-0]` `[AREA:ui]` `[PRI:B]` `[SIZE:S]` `[DEP:0.1]`

**Stato**: ✅ **DONE** — merged in `main` (PR #22, merge commit `5235c88`, 2026-10-18)

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

**Stato**: ✅ **DONE** — merged in `main` (PR #64, merge commit `b44420b`, 2026-10-20) · runbook pubblicato in `docs/16-OPERATIONS.md`

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

**Stato**: ✅ **DONE** — merged in `main` (PR #130, merge commit `43f7529`, 2026-10-22) · adapter in `packages/core/src/adapters/youtube/` · fixture `fixtures/synthetic-history/youtube-sample.json`

**Descrizione**: Import da Google Takeout (formato JSON).

**Acceptance criteria**:
- [x] Filtro video/musica funzionante (campo `products`)
- [x] Gestione cronologia unificata
- [x] Test con fixture `youtube-sample.json`

**Spec**: `03-ADAPTERS/youtube-music.md` (v1.0 APPROVED, PR #97); dettagli piattaforma in `01-PLATFORMS.md` §3.2

---

### Story 1.2 — Adapter Apple Music `[PHASE-1]` `[AREA:adapter]` `[PRI:I]` `[SIZE:L]` `[DEP:0.3]`

**Stato**: ✅ **DONE** — merged in `main` (PR #139, merge commit `2e1a4cc`, 2026-10-22) · adapter in `packages/core/src/adapters/apple/` · fixture `fixtures/synthetic-history/apple-music-sample.csv`

**Descrizione**: Import CSV da Apple Privacy Portal (export *Apple Media Services*).

**Acceptance criteria** (fonte: `03-ADAPTERS/apple-music.md` §8, issue #132):
- [ ] Detection su ZIP annidato multi-part (≤5 livelli) e su CSV singolo; gli altri CSV dell'archivio rifiutati con guida all'utente
- [ ] Parsing streaming (`papaparse` row mode, decisione **D5** §10) + tabella alias legacy/2026.2
- [ ] Filtro eventi §3.3: scrub, sotto-soglia 30s e senza titolo scartati con warning e contatori
- [ ] Mapping §3.1 (`eventKey = Event ID`, `completed`/`skipped`/`deviceType`/`shuffle`/`offline`) + catena di risoluzione artista D3 fino a `"Unknown"`
- [ ] Fonte secondaria Daily Tracks: solo mappa artisti e riconciliazione, **mai** importata come `ListenEvent`
- [ ] Privacy §7: geo e `Device Identifier` mai persistiti, `ip` solo con `retainIp`, `country` senza derivare dall'IP
- [ ] Bias E.AP.1 dichiarato **sempre** all'utente (`info.pauseBias`), non solo sopra la soglia del 10%
- [ ] Fixture `fixtures/synthetic-history/apple-music-sample.csv` con i 16 casi della spec §8

**Spec**: `03-ADAPTERS/apple-music.md` (v1.0, 🟢 APPROVED, Sessione 42) · `01-PLATFORMS.md` §3.3 · `03-ADAPTERS/SPEC-TEMPLATE.md`

**Issue**: #132 · **Size**: `L` — ricalibrata da `M` in Sessione 42: lo scope supera quello della 1.1 per 2 fonti dati, 2 schemi di export e ZIP ricorsivo

---

### Story 1.3 — Adapter Last.fm + ListenBrainz `[PHASE-1]` `[AREA:adapter]` `[PRI:I]` `[SIZE:L]` `[DEP:0.3]`

**Stato**: 🟡 **IN CORSO** — spec ListenBrainz 🟢 APPROVED v1.0 (PR #146, issue #145 chiusa); **ADR-0010 v1.0 🟢 APPROVED** (PR #152, issue #148 chiusa); **spec Last.fm v1.0 🟢 APPROVED** (PR #154, issue #144 chiusa) — i tre pezzi della story sono pronti; **issue di implementazione #155 aperta** (`agent-ready`, size L)

**Descrizione**: Import dello storico di ascolto da Last.fm e ListenBrainz.

**Nota di perimetro (Sessione 47)**: la descrizione originaria era "Import storico via API (paginazione completa)" per entrambe. La verifica delle due piattaforme ha corretto il perimetro:

- **ListenBrainz**: il canale MVP è l'**export API** (ZIP con JSONL), non la paginazione `/1/user/{username}/listens` — la documentazione ufficiale prescrive l'export per lo storico completo e **sconsiglia esplicitamente** di paginare tutto lo storico sull'endpoint listens. Il percorso `/listens` (query incrementali) resta alla Story 1.5
- **Last.fm**: l'export GDPR non è utilizzabile dall'app (procedura manuale via email, e risulta incompleto per eventi) → il canale è l'API `user.getRecentTracks`, che richiede un **proxy CORS** configurabile dall'utente (l'API non emette header CORS) e una `api_key` **per-utente** (i ToS §4.4 vietano una key condivisa che serva N utenti)

**Acceptance criteria** (fonte: `03-ADAPTERS/listenbrainz.md` §8, issue #145):
- [ ] Detection su ZIP con `listens/*.jsonl` + `user.json`, e su JSONL sciolto
- [ ] Parsing streaming JSONL con scanner dedicato (bounded memory, una riga malformata non abortisce lo stream)
- [ ] `eventKey = listenbrainz:<listened_at>|<recording_msid>` (D-LB.2 — il msid **non** è univoco per ascolto)
- [ ] Semantica temporale uniforme: `timestamp = startedAt = listened_at*1000`, `durationMs = 0`, bias dichiarato
- [ ] DEDUP-1 (ISRC) e DEDUP-2 (MBID da `mbid_mapping`) attivati alla prima importazione; bucket DEDUP-3 sempre 0
- [ ] `feedback.jsonl` e `pinned_recording.jsonl` scartati con warning; `user_name` e `inserted_at` mai persistiti
- [ ] Fixture `fixtures/synthetic-history/listenbrainz-sample.jsonl` con i 20 casi della spec §8

**Acceptance criteria** (fonte: `03-ADAPTERS/lastfm.md`, issue #144):
- [ ] Percorso API via `parseRemote?()` (ADR-0010) su proxy CORS configurato dall'utente + percorso file (export di terze parti, senza proxy)
- [ ] `api_key` per-utente (mai embedded nel bundle); percorso **senza** `sk` operativo subito; web auth per la `sk` differito alla Story 1.5 (manca un helper md5 per `api_sig`)
- [ ] `eventKey` normalizzato al **minuto** su tutti i percorsi (il re-import misto API+file non duplica)
- [ ] Rate limiter client-side (~5 req/s) con backoff su `11/16/29/429/5xx` e `AbortSignal`; mappa dei 10 codici errore Last.fm → `AdapterError`
- [x] Contratto adapter: metodo opzionale `parseRemote?()` → **ADR-0010 v1.0 🟢 APPROVED** (PR #152, merge `1b2d280`, issue #148 chiusa): estende `05§4` con `RemoteSource` e il codice errore `SOURCE_UNREACHABLE`
- [ ] Codice errore `SOURCE_UNREACHABLE` aggiunto a `packages/core/src/adapters/errors.ts` (`AdapterErrorCode` ha oggi 4 valori)
- [ ] Test con mock API (paginazione, rate limit, errori 6/8/9/10/26) + 23 casi di fixture

**Spec**: `03-ADAPTERS/listenbrainz.md` (v1.0, 🟢 APPROVED, Sessione 47) · `03-ADAPTERS/lastfm.md` (v1.0, 🟢 APPROVED, Sessione 50) · `01-PLATFORMS.md` §3.7, §3.8

**Issue**: #145 (ListenBrainz) · #144 (Last.fm) · **Size**: `L` — ricalibrata da `M` in Sessione 47: 2 fonti dati, 2 API, autenticazione, rate limiting, mock API e 2 percorsi per adapter

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
- T1.5.1 — ~~Adapter Last.fm (recupero storico via API `user.getRecentTracks`, paginazione)~~ → **spostato alla Story 1.3** (Sessione 47)
- T1.5.2 — ~~Adapter ListenBrainz (recupero storico via API `/1/user/{username}/listens`)~~ → **spostato alla Story 1.3** (Sessione 47); nella 1.5 resta il **percorso incrementale** `/listens` con cursore `max_ts`
- T1.5.3 — Adapter Maloja self-hosted (server opzionale, scope futuro Fase 2)
- T1.5.4 — Toggle `PrivacySettings.scrobbleHubs` per abilitare l'invio
- T1.5.5 — Rispetto rate limit (Last.fm ~5 req/s, ListenBrainz 1 req/s con User Token)
- T1.5.6 — **Invio scrobble** verso i hub (la Story 1.5 è nata come "fonte continua" ma non aveva il task di scrittura)

**Nota (Sessione 47)**: T1.5.1 e T1.5.2 duplicavano esattamente il recupero storico della Story 1.3. La 1.5 è stata **ridimensionata** a *invio scrobble + sync continua + toggle*, riusando gli adapter creati nella 1.3. La duplicazione è il motivo per cui la 1.3 è passata da `M` a `L` in un colpo solo.

**Acceptance criteria**:
- [ ] Sync continua incrementale (non re-import da zero): cursore `max_ts` / `min_ts`
- [ ] MBID da ListenBrainz alimenta DEDUP-2 e genera `track.genres` via MusicBrainz lookup
- [ ] Toggle `scrobbleHubs` rispettato (vuoto = nessuna scrittura)
- [ ] Invio scrobble funzionante verso i hub configurati
- [ ] Test con mock API
- [ ] **Dipendenza**: il percorso incrementale richiede il metodo opzionale `parseRemote?()` → **ADR-0010** (Story 1.3 / issue #144)

**Spec**: `01-PLATFORMS.md` §3.7, §3.8; `02-DATA-SCHEMA.md` §3.8; `03-ADAPTERS/lastfm.md` D-LF.8; `03-ADAPTERS/listenbrainz.md` §3.4

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
- [ ] **Algoritmo come specificato in `04-ANALYSIS-ALGORITHMS §5`** (sliding window + change point su similarity signature): parametri `windowDays=14`, `stepDays=7`, `similarityThreshold=0.65`, `minEraDays=14`, `weights={genre:0.5, artist:0.3, numeric:0.2}` (allineato alla spec, chiusura ambiguità "Bayesiano/PELT" in Sessione 13)
- [ ] EraPayload completo per ogni era (vedi `02-DATA-SCHEMA.md §4`): `label`, `moodDominant`, `topArtistIds`, `topTrackIds`, `genreDistribution`, `avgValence`, `avgEnergy`, `nightShare`, `repeatRate`
- [ ] Test: 1 anno con 2 ere evidenti (`fixtures/scenarios/lockdown-2020.json`) → rilevate correttamente; invarianti `04§5.5` verificate (disgiunte e coprenti, `sum(genreDistribution)≈1.0`, `moodDominant ∈ enum`)

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

### Story 4.3 — Artwork enrichment `[PHASE-2]` `[AREA:enrichment]` `[PRI:I]` `[SIZE:M]` `[DEP:4.2]`

**Descrizione**: Popolamento di `Track.artworkUrl` e `Album.artworkUrl` (aggiunti in `02 v1.2` per chiusura M5 audit). Cascata di fonti: **Spotify Web API** (se utente Spotify-first e `PrivacySettings.enrichMetadata=true`) → **MusicBrainz Cover Art Archive** (`/release/{mbid}/cover-art`, no auth, rate limit 1 req/s) → **iTunes Search API** (`/search?term=`, no auth, fallback per utenti Apple/Last.fm-first) → **placeholder gradient** generato runtime.

**Task**:
- T4.3.1 — Modulo `enrichment/artwork.ts` con funzione `fetchArtworkUrl(track|album, deps)` che applica la cascata
- T4.3.2 — Integrazione con `recount()` o job `enrichOnImport()` di Story 0.7 per popolamento batch post-import
- T4.3.3 — Trigger on-demand: schermata che richiede artwork (`Home MemoryCard`, `Timeline EraBand`, `Esplora`) → fetch lazy se `artworkUrl === null`
- T4.3.4 — Rispettare `PrivacySettings.enrichMetadata`: se `false`, salta Spotify API (no rete); mantieni solo MB Cover Art (no PII esposta, è solo fetch pubblico) e iTunes Search; placeholder come fallback finale
- T4.3.5 — Gestione errori: 404 (no artwork disponibile), 429 (rate limit MB), timeout → fallback a fonte successiva
- T4.3.6 — Migrazione Dexie v2→v3 (`02 §10`): aggiunta campo nullable, non distruttiva

**Acceptance criteria**:
- [ ] Dato un Track con `spotify:track:<id>`, `fetchArtworkUrl()` ritorna URL Spotify valido (mock test)
- [ ] Dato un Track con solo `mbid`, fallback a MB Cover Art Archive (mock test)
- [ ] Dato un Track senza ID, fallback a iTunes Search (mock test)
- [ ] Dato un Track senza match, ritorna `null` (UI mostra placeholder gradient)
- [ ] Toggle `enrichMetadata=false` → Spotify API saltata; altre fonti tentate
- [ ] Migrazione Dexie v2→v3 testata con dati pre-migrazione (10-TESTING §4.3)
- [ ] Placeholder gradient generato coerente con Mood (vedi `15-DESIGN-SYSTEM` §3 palette mood)

**Dipendenze**: Story 4.2 (per `mbid` arricchito da MB lookup)
**Spec**: `02-DATA-SCHEMA §11`, `05-ARCHITECTURE §6 §6.1 §6.2`, `07-UI-SPEC §2.2 §2.10`

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

Quando un agente arriva sul repo, deve **tentare** le story in questo ordine di preferenza:

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

**Regola di selezione per agenti paralleli (ADR-0006)**: l'ordine sopra è l'ordine di **tentativo**, non una scelta automatica. Un agente lavora la prima story dell'ordine che sia **libera** — issue `agent-ready` senza label `in-progress` (o con claim stantio oltre le 12h). Se la prima è già claimata da un altro agente, passa alla successiva. La procedura obbligatoria — claim, riverifica, cascata, TTL — è definita in `AGENTS.md` §"🎫 Presa in carico delle story (claim)". **Nessuna selezione di story avviene senza quella procedura.**

## Stato di avanzamento — roadmap delle story non ancora completate

> **La fonte di verità per le story completate è il blocco aggregato `AGGREGATE-STORIES-*` in fondo a questo file**, generato da `scripts/aggregate-state.ps1` a partire da `docs/state/stories/*.md` (ADR-0008).
>
> Questa tabella elenca **solo le story ancora da implementare**. Non duplicare qui le story già `done`: la duplicazione è stata la causa del drift corretto in Sessione 38 (issue #90), che dichiarava 0.4/0.6/0.7 come `⬚ TODO` mesi dopo il loro merge.
>
> **Regola per gli agenti**: quando una story passa a `done`, si rimuove da questa tabella e si aggiorna (o si crea) il suo `docs/state/stories/<id>-<slug>.md` — l'aggregatore farà comparire la story nel blocco aggregato al merge. Non modificare mai a mano il blocco aggregato.

| EPIC | Story | Stato | Note |
|------|-------|-------|------|
| 1 | 1.3 Adapter Last.fm + ListenBrainz | 🟡 IN CORSO | spec ListenBrainz 🟢 APPROVED v1.0 (PR #146); ADR-0010 🟢 APPROVED v1.0 (PR #152); spec Last.fm 🟢 APPROVED v1.0 (PR #154) — i tre pezzi pronti, issue di implementazione **#155** aperta (`agent-ready`, size L); `[SIZE:M]` → `[SIZE:L]`; perimetro corretto: ListenBrainz via **export API** (non paginazione), Last.fm via API + proxy CORS |
| 1 | 1.4 Dedup promozione post-enrichment | ⬚ TODO | 0.3 ✅ — spec `02-DATA-SCHEMA.md` §5-6 🟢 APPROVED |
| 1 | 1.5 Scrobbling hub (Last.fm, ListenBrainz, Maloja) | ⬚ TODO | **Ridimensionata in Sessione 47**: T1.5.1/T1.5.2 spostati alla 1.3; resta invio scrobble + sync continua + toggle. T1.5.3 (Maloja self-hosted) è scope Fase 2 |
| 2-3 | 2.x analisi, 3.x UI | ⬚ TODO | dipendono da 0.2 ✅ |
| 4 | 4.x enrichment (audio features, artwork, generi) | ⬚ TODO | dipende da 0.2 ✅ |
| 5 | 5.x privacy | ⬚ TODO | — |
| 6 | 6.1 Upgrade stack a ultime major | ⬚ SCHEDULED (post-impl) | D.10.2: solo a implementazione conclusa |

**EPIC 0 — Fundamentals: 7/7 ✅** (0.1 scaffold · 0.2 schema DB · 0.3 adapter Spotify · 0.4 UI import · 0.5 PWA · 0.6 i18n · 0.7 operations runbook). **EPIC 1 — Import core: 2/5 ✅** (1.1 YouTube Music · 1.2 Apple Music). Dettaglio per story in `docs/state/stories/` e `docs/18-DEV-LOG.md`.

> **Aggiornato al 2026-10-22** (Sessione 45, issue #140: la 1.2 rimossa dalla roadmap perché mergata con PR #139 e il suo `**Stato**:` allineato — il doc-sync era rimasto fuori da `main`). Per il dettaglio cronologico vedi `docs/18-DEV-LOG.md`.

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
| 1.2.3 | Sessione 13 (2026-10-16) | **Consolidamento doc pre-Fase 0**: Story 0.4 T0.4.1 PlatformCard → 5 stati canonici (chiusura M13); Story 2.2 AC allineata a `04§5` (chiusura ambiguità "Bayesiano/PELT"); **nuova Story 4.3 Artwork enrichment** (chiusura M5 con `artworkUrl` in 02 v1.2); aggiornato ordine di lavorazione per agenti |
| 1.2.4 | Sessione 14 (2026-10-16) | **Story 0.2 marcata IN PROGRESS**: task 5/5, AC 5/5 verificati (schema Dexie v1+v2, repository CRUD, `recount()`; coverage `db/` 100%, AC 10k eventi < 500ms con fake-indexeddb); test di performance isolati in `perf.test.ts` ed esclusi dalle run coverage; cross-ref a `18-DEV-LOG` §6 |
| 1.2.5 | 2026-10-17 (post-merge) | **Doc-sync post-merge**: Story 0.2 ora ✅ DONE (PR #4 merged `fa09b06`, CI su main ✅); tabella "Stato di avanzamento" aggiornata; Story 0.3 sbloccata |
| 1.3.0 | Sessione 18 (2026-10-17) | **Protocollo di claim per agenti paralleli (ADR-0006)**: §"Priorità di lavorazione" ora claim-first (la priorità è ordine di tentativo; si lavora la prima story *libera*); legenda 🟡 legata alla label `in-progress`; procedura operativa in `AGENTS.md` §"Presa in carico delle story (claim)" |
| 1.4.0 | Sessione 19 (2026-10-17) | **Estensione post-claim (ADR-0007)**: aggiunti 4 stati `status:*` (done / in-review / wontdo / blocked-other) alla §"Stato di una Story"; `agent-ready` e `status:*` mutuamente esclusivi; rinvio a `AGENTS.md` §"📦 Macchina a stati delle issue" per le regole di transizione; ADR-0007 v1.0 in `docs/13-ADR/` |
| 1.5.0 | 2026-10-18 (post-merge Sessione 22) | **Story 0.5 PWA e service worker** ora ✅ DONE: `useAppUpdate()` + `<UpdateBanner/>` + Workbox precache + NetworkFirst `/version.json` + CacheFirst Google Fonts + manifest con icone 192/512/maskable/apple-touch (generate via `scripts/generate-pwa-icons.mjs`, zero deps); `apps/web/index.html` esteso con theme-color, manifest link, apple-touch-icon; PR #19 (aperta) chiude #7; dettagli in `18-DEV-LOG §11` |
| 1.6.0 | Sessione 38 (2026-10-21, issue #90) | **Allineamento della documentazione di stato legacy** (chiude il gap aperto in Sessione 38 di S37, D.37.2): la tabella "Stato di avanzamento" non duplica più le story `done` (fonte di verità = blocco `AGGREGATE-STORIES-*`) ed elenca solo la roadmap EPIC 1-6; allineate le righe `**Stato**` delle sezioni Story 0.3, 0.4, 0.5, 0.6, 0.7 (prima mancanti o stale); `AGENTS.md` v1.16 introduce la regola di ownership *blocchi aggregati vs sezioni legacy* |
| 1.6.1 | Sessione 39 (2026-10-21, issue #96) | Nota Story 1.1 nella tabella roadmap: spec adapter YouTube Music scritta (`03-ADAPTERS/youtube-music.md`, 🟡 DRAFT — `agent-ready` all'approvazione Boss) |
| 1.6.2 | Sessione 40 (2026-10-21, issue #98) | Note Story 1.1 (spec 🟢 APPROVED, PR #97) e 1.2 (spec scritta, 🟡 DRAFT) nella tabella roadmap |
| 1.6.3 | Sessione 42 (2026-10-22, issue #132) | Story 1.2: spec 🟢 APPROVED v1.0 (PR #134), `[SIZE:M]` → `[SIZE:L]`, sezione Story riscritta con gli AC della spec §8 e `**Spec**:` che punta a `03-ADAPTERS/apple-music.md` (prima puntava solo a `01-PLATFORMS.md` §3.3, censito come più povero dell'export reale). Nota roadmap allineata. Tabella "Stato di avanzamento": la 1.2 resta `⬚ TODO` perché lo stato vive in `docs/state/stories/1.2-adapter-apple-music.md` |
| 1.6.4 | Sessione 45 (2026-10-22, issue #140) | Story 1.2 ✅ DONE (PR #139, merge `2e1a4cc`): rimossa dalla tabella roadmap e allineata la riga `**Stato**:` della sezione Story. Il doc-sync era rimasto fuori da `main` perché `auto-state-aggregate.yml` falliva con `non-fast-forward` (vedi `docs/state/sessions/45-*.md`). Nota della 1.3 aggiornata: le specifiche adapter Last.fm / ListenBrainz **non esistono** (`01-PLATFORMS.md` §3.7-3.8 è 🟡 DRAFT), quindi la 1.3 non è lavorabile finché non vengono scritte e ratificate |
| 1.6.5 | Sessione 47 (2026-10-26, issue #145, #144) | **Story 1.3 perimetro corretto**: la descrizione "Import storico via API (paginazione completa)" era imprecisa per entrambe le piattaforme. **ListenBrainz**: il canale MVP è l'**export API** (ZIP con JSONL) — la doc prescrive l'export per lo storico completo e sconsiglia la paginazione `/listens` (che resta alla 1.5). **Last.fm**: l'export GDPR non è utilizzabile dall'app → canale API con proxy CORS e `api_key` per-utente (ToS §4.4). `[SIZE:M]` → `[SIZE:L]`. **Story 1.5 ridimensionata**: T1.5.1/T1.5.2 duplicavano la 1.3 → la 1.5 resta invio scrobble + sync continua + toggle, con il task di scrittura T1.5.6 aggiunto. Sezione Story 1.3 riscritta con gli AC delle due spec; nota roadmap allineata |
| 1.6.6 | Sessione 47 (2026-10-26, issue #145) | **Spec ListenBrainz approvata**: `03-ADAPTERS/listenbrainz.md` v0.1 🟡 DRAFT → **v1.0 🟢 APPROVED** (PR #146, merge `6d66233`); issue #145 chiusa con `status:done`. Decisioni D1-D7 chiuse come proposte, nessuna modifica di contenuto. Allineati: sezione Story 1.3 (`**Stato**:` e `**Spec**:`), riga roadmap, `01-PLATFORMS.md` §3.8 (riferimento spec), `18-DEV-LOG.md` §15 (nuova entry, v1.5) |
| 1.6.7 | Sessione 50 (2026-10-26, issue #144) | **Spec Last.fm scritta**: `03-ADAPTERS/lastfm.md` v0.1 🟡 DRAFT (10 sezioni, 21 edge case E.LF.1…E.LF.21, 23 casi di fixture). Perimetro confermato: nessun export utilizzabile dall'app (l'export GDPR è manuale, asincrono, incompleto, e richiede di degradare la privacy) → canale MVP = API `user.getRecentTracks` via **proxy CORS configurato dall'utente**; percorso **file** (export di terze parti) come alternativa senza proxy. Corretti due limiti: `limit` max **200** (doc ufficiale, non 1000) e `artist` è **stringa** senza `extended=1` / **oggetto** con `extended=1`; il brano in riproduzione **non ha `date`**. `eventKey` normalizzato al **minuto** su tutti i percorsi (il re-import misto API+file non duplica). Il percorso web auth per la `sk` è **differito alla Story 1.5**: `api_sig` richiede md5 e il repo espone solo SHA-1/SHA-256 (E.LF.21). Allineati: `01-PLATFORMS.md` §3.7 + tabella §4 (ISRC/MBID e "brani salvati" da ❌ a ⚠️) + E14-E18 + changelog 0.6; `02-DATA-SCHEMA.md` §2 (riga Last.fm) + §5 (sorgenti con durata non affidabile); `08-COPY-I18N.md` §2.12d; `09-PRIVACY-SECURITY.md` §4 (5 righe) + §7.2 (nota sul proxy) + changelog 0.4 |
| 1.6.8 | Sessione 51 (2026-10-26, issue #144) | **Spec Last.fm approvata**: `03-ADAPTERS/lastfm.md` v0.1 🟡 DRAFT → **v1.0 🟢 APPROVED** (PR #154, merge `b3130a9`); issue #144 chiusa con `status:done`. Nessuna modifica di contenuto: D-LF.0…D-LF.8 ratificate come formulate, percorso web auth confermato alla Story 1.5. **Story 1.3 completa dei suoi tre pezzi** (spec ListenBrainz 🟢 v1.0, ADR-0010 🟢 v1.0, spec Last.fm 🟢 v1.0) → aperta l'issue di implementazione (#155, `agent-ready`, size L). Allineati: sezione Story 1.3 (`**Stato**:` e `**Spec**:`), riga roadmap, `01-PLATFORMS.md` §3.7 (riferimento spec), `docs/state/sessions/50-*` e `51-*` |
| 1.6.9 | Sessione 51 (2026-10-26, issue #144) | **Doc-sync post-merge della PR #156** (merge `6ec71bb`): il frontmatter di `docs/state/sessions/51-*` riflette il merge reale (`pr: 156`, `merged_commit: 6ec71bb`, `state: 🟢`, `merged: true`) — era rimasto `pr: null` / `merged: false` perché la sessione è stata scritta dalla stessa PR che la chiude. Story 1.3 allineata: `issue: 155`, T1.3.7 ✅, "Stato attuale" aggiornato. Sezioni legacy riallineate: `11-BACKLOG.md` (`**Stato**:` della 1.3 + riga roadmap, che dichiaravano ancora «manca l'issue di implementazione»), `docs/INDEX.md` (riga `03-ADAPTERS/`, versioni dei documenti, "Prossimo passo tecnico"), `docs/18-DEV-LOG.md` §17 (entry delle sessioni 50-51). La riga di changelog 1.6.8 è stata riportata dentro la tabella: era stata appesa **dopo** il blocco `AGGREGATE-STORIES-*`, fuori dal suo schema |

<!-- AGGREGATE-STORIES-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` leggendo `docs/state/stories/*.md`.
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.
> Aggregator version: 1 (ADR-0008, S25).

| Story | Stato | PR | Merge commit | Area |
|-------|-------|----|--------------|------|
| 0.1 - Setup monorepo e toolchain | done | #2 | `c0fb0a4` | devops |
| 0.2 - Schema DB e layer Dexie | done | #4 | `fa09b06` | db |
| 0.3 - Adapter Spotify base | done | #28 | `3dc9654c8ce037035176732ca11e2f5e86f27735` | adapter |
| 0.4 - UI import (onboarding) | done | #71 | `0a8e83f2aaf90cb61862e0737417eb7ec8b63881` | ui |
| 0.5 - PWA e service worker | done | #19 | `3fa3c0d` | devops |
| 0.6 - Setup i18n | done | #22 | `5235c88` | ui |
| 0.7 - Operations runbook + manutenzione DB | done | #64 | `b44420beb9ec95ea16ec47305ac4873f41b1a15b` | devops |
| 1.1 - Adapter YouTube Music | done | #130 | `43f75291e5184144dc9d974c5003cd6ae6a7583e` | adapter |
| 1.2 - Adapter Apple Music | done | #139 | `7640d83` | adapter |
| 1.3 - Adapter Last.fm + ListenBrainz | in_progress | - | - | adapter |

<!-- AGGREGATE-STORIES-END -->
