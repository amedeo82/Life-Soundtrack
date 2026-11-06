# 11 — Backlog Strutturato

> Status: 🟢 APPROVED · Versione 1.6.37 · Sessione 104 (2026-11-06, Story 3.5) · l'**EPIC 3** (UI) ha **chiuso il percorso end-to-end**: la **3.4** (nastro contesto, Sessione 76), la **3.1** (Home + Timeline, Sessione 77 — schermate ⑥ e ⑦, grafici SVG scritti a mano, prima navigazione dell'app), la **3.2** (Ricordi + Share, Sessione 97 — schermata ⑪ e ShareSheet ⑫, card 1080×1350 su canvas, capitolo HTML autonomo, tagging manuale), la **3.3** (Esplora + Analisi, Sessione 103 — schermate ⑨ e ⑩, la ricerca sul catalogo e la mappa emotiva con l'insight in prosa) e la **3.5** (anteprima e modalità demo in onboarding, Sessione 104 — il diario di esempio in un database separato e le prime righe della timeline reale nel reveal). L'app non è più solo onboarding: la scelta fra onboarding e app è legata ai **dati**. Restano la **5.2/5.1** (export e purge, privacy) e l'**artwork** (4.3, ora **P0** e senza dipendenza dal lookup MusicBrainz 4.2). Il buco rilevato il 2026-11-02 — i **motori di analisi dell'EPIC 2 scritti e testati in core ma mai eseguiti dall'app** — è **chiuso**: la **2.5** (collegamento del pipeline di analisi all'app) è **mergata in `main`** (issue #266, PR #295, merge `265fa50`). Fuori perimetro e dichiarato: la **session segmentation** (`04§2`) e il **pattern analyzer** (`04§4`)
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
- [x] T0.1.3 — ESLint + Prettier + commit hook (hook in `.githooks/`: lint-staged + commitlint)
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

**Stato**: ✅ **COMPLETATA** (Sessione 52) — spec ListenBrainz 🟢 APPROVED v1.0 (PR #146, issue #145 chiusa); **ADR-0010 v1.0 🟢 APPROVED** (PR #152, issue #148 chiusa); **spec Last.fm v1.0 🟢 APPROVED** (PR #154, issue #144 chiusa); **implementazione** (issue #155 chiusa con `status:done`): adapter ListenBrainz (export API ZIP/JSONL) e adapter Last.fm (percorso ibrido API + file), `parseRemote?()`/`RemoteSource` (ADR-0010), `SOURCE_UNREACHABLE`, tabella `settings` per le credenziali per-utente, pannello Last.fm in UI, 6 fixture e 47 test nuovi

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

**Stato**: ✅ **COMPLETATA** (Sessione 53) — issue #160 chiusa con `status:done`. `rekey()` esisteva già dalla Story 0.7 (PR #39) ma era **incompleta** rispetto agli AC e senza i test: la Sessione 53 ne ha chiuso i buchi — **transazione Dexie** (atomicità, MIG-1), **sopravvivenza deterministica** (la track più vecchia), **riorientamento** di `library`/`playlistItems`/`features`, **unione** di `platformIds`/`generi`/finestra temporale, **ISRC normalizzato** in maiuscole, contatori delegati a `recount()` (MIG-4). 9 test nuovi (`packages/core/src/db/__tests__/rekey.test.ts`).

**Acceptance criteria**:
- [x] Due track con `fuzzy:` diverso ma stesso ISRC → una sola track dopo `rekey()`
- [x] `listenCount` aggregato correttamente
- [x] `listen_events.trackId` riorientato

**Spec**: `02-DATA-SCHEMA.md` §5-6

---

### Story 1.5 — Scrobbling hub (Last.fm, ListenBrainz, Maloja) `[PHASE-1]` `[AREA:adapter]` `[PRI:L]` `[SIZE:L]` `[DEP:0.3]`

**Descrizione**: Sorgente continua di ascolti tramite hub di scrobbling. Risolve il vuoto V4 dell'audit.

**Stato**: ✅ DONE — **implementata nella Sessione 58 (issue #173, PR #176)**: spec `docs/20-SCROBBLING-HUB.md` **v1.0 🟢 APPROVED** (ratificata dal Boss al merge della PR di ratifica, issue #172 chiusa con `status:done`), con le quattro decisioni aperte chiuse come proposte (**D-SH.11…D-SH.14**: md5 in JS puro, finestra di candidatura a 7 giorni, soglia dei 4 minuti con fiducia nella fonte, modalità del proxy dichiarata). Contratto di scrittura **v1.0 🟢 APPROVED** (`13-ADR/0011-scrobble-sink.md`, Sessione 56, issue #168) e recepito in `05§4.2`: la dipendenza ADR-0011 è **soddisfatta**. Issue di implementazione: **#173** (`agent-ready`, `size:L`), con i 15 deliverable di `20§16` e i 31 casi di test di `20§14.3` — consegnati: contratto `ScrobbleSink`, coda `scrobbleOutbox` (schema Dexie v5), sink Last.fm (firma md5, batch 50, POST via proxy) e ListenBrainz (`submit-listens`), filtro di eleggibilità `20§5` con la regola di maturità D-SH.13, sync incrementale con cursore persistito, percorso web auth Last.fm, pannello UI con selettore per-hub e modalità del proxy, namespace i18n `scrobble`. **AC-SH.11 parzialmente soddisfatto**: la parte MBID → DEDUP-2 è coperta dal pipeline esistente, la parte `track.genres` via lookup MusicBrainz dipende dall'enrichment (EPIC 4, non implementato) e va aperta come issue dedicata.

**Task**:
- T1.5.1 — ~~Adapter Last.fm (recupero storico via API `user.getRecentTracks`, paginazione)~~ → **spostato alla Story 1.3** (Sessione 47)
- T1.5.2 — ~~Adapter ListenBrainz (recupero storico via API `/1/user/{username}/listens`)~~ → **spostato alla Story 1.3** (Sessione 47); nella 1.5 resta il **percorso incrementale** `/listens` con cursori `max_ts` (specificato in `20-SCROBBLING-HUB.md` §9, C-SH.1…C-SH.8)
- T1.5.3 — Adapter Maloja self-hosted (server opzionale, scope futuro Fase 2) — **fuori perimetro** della prima tranche (D-SH.2)
- T1.5.4 — Toggle `PrivacySettings.scrobbleHubs` per abilitare l'invio — **per-hub**, default `[]` (D-SH.4, `20§10.1`)
- T1.5.5 — Rispetto rate limit (Last.fm ~5 req/s, ListenBrainz 1 req/s con User Token) — **per-hub**, nel client del sink (D-SH.8, `20§6`)
- T1.5.6 — **Invio scrobble** verso i hub (la Story 1.5 è nata come "fonte continua" ma non aveva il task di scrittura) — contratto `ScrobbleSink` + coda `scrobbleOutbox` (`20§4`, `20§8`)

**Nota (Sessione 47)**: T1.5.1 e T1.5.2 duplicavano esattamente il recupero storico della Story 1.3. La 1.5 è stata **ridimensionata** a *invio scrobble + sync continua + toggle*, riusando gli adapter creati nella 1.3. La duplicazione è il motivo per cui la 1.3 è passata da `M` a `L` in un colpo solo.

**Nota (Sessione 55, issue #164)**: la spec dichiara una premessa che il backlog non riportava — **la PWA non osserva la riproduzione di altre applicazioni**, quindi la prima tranche non è uno scrobbling *live* ma uno **specchio idempotente dello storico locale** verso i hub abilitati (`20§3`). Il percorso live (now playing) è differito.

**Acceptance criteria**:
- [x] Sync continua incrementale (non re-import da zero): cursore `max_ts` / `min_ts` → `20§9` (C-SH.1, C-SH.2) · `20§15` AC-SH.6, AC-SH.7
- [ ] MBID da ListenBrainz alimenta DEDUP-2 e genera `track.genres` via MusicBrainz lookup → `20§15` AC-SH.11 — **parziale**: DEDUP-2 ✓ (il pipeline usa già `raw.mbid`), `track.genres` ✗ (dipende dall'enrichment EPIC 4)
- [x] Toggle `scrobbleHubs` rispettato (vuoto = nessuna scrittura) → `20§10.1` (P-SH.1, P-SH.3) · `20§15` AC-SH.1
- [x] Invio scrobble funzionante verso i hub configurati → `20§5`, `20§6` · `20§15` AC-SH.2, AC-SH.3
- [x] Test con mock API → `20§14` (**31** casi, nessuna dipendenza nuova)
- [x] **Dipendenza**: il percorso incrementale richiede il metodo opzionale `parseRemote?()` → **ADR-0010** (Story 1.3 / issue #144) — **soddisfatto** (🟢 v1.0). Il contratto di scrittura dentro `05§4` richiede **ADR-0011** (`20§18` punto 1, issue **#168**) — **soddisfatto**: `13-ADR/0011-scrobble-sink.md` **v1.0 🟢 APPROVED** (PR #170, merge `8900c3b`, issue #168 chiusa), decisione A1 (`ScrobbleSink` dedicato, separato da `PlatformAdapter`), vincoli V1-V10 in `05§4.2`
- [x] **Dipendenza**: la **spec** della story (`20-SCROBBLING-HUB.md`) deve essere 🟢 APPROVED — **soddisfatto** (v1.0 🟢, Sessione 57, issue #172): le quattro decisioni aperte sono chiuse (D-SH.11…D-SH.14) e i documenti che la spec tocca sono allineati (`02§3.8`+`§6.2`, `09§3.3`+`§4`, `08§1`+`§2.16`, `03-ADAPTERS/lastfm.md` §4+§10, `03-ADAPTERS/listenbrainz.md` §3.4+D-LB.5)

**Spec**: `20-SCROBBLING-HUB.md` (**v1.0 🟢 APPROVED**, Sessione 57) · `01-PLATFORMS.md` §3.7, §3.8; `02-DATA-SCHEMA.md` §3.8 e §6.2; `03-ADAPTERS/lastfm.md` D-LF.8, E.LF.21; `03-ADAPTERS/listenbrainz.md` §3.4, D-LB.5 · **contratto di scrittura**: `13-ADR/0011-scrobble-sink.md` (v1.0 🟢 APPROVED, Sessione 56) → `05§4.2`

**Issue**: #164 (spec, ratificata) · #168 (ADR-0011, chiusa con `status:done`) · #172 (decisioni aperte, chiuse alla ratifica) · **#173** (implementazione, chiusa con `status:done` al merge della PR #176)

---

### Story 1.6 — Fondazione geo e contesto di ascolto `[PHASE-2]` `[AREA:db]` `[PRI:I]` `[SIZE:L]` `[DEP:0.2]`

**Descrizione**: La base dati del contesto di ascolto: il delta su `02-DATA-SCHEMA.md` (v1.7, Dexie v5→v6) con i campi `city`/`citySource`/`cityConfidence` e l'entità derivata `ContextPeriod` (tabella `contexts`), i toggle `retainCity`/`retainDeviceType`/`retainDeviceDetail`/`deriveContext`, e il classificatore **L1** (contesto dedotto: casa, lavoro, viaggio) come algoritmo deterministico e versionato.

**Stato**: ✅ **DONE — implementata nella Sessione 68** (issue #205, PR #209 merged il 2026-10-31, merge commit `68c27e5`, branch `feat/205-geo-context-foundation`). Consegnato: il **delta su `02-DATA-SCHEMA.md` v1.7** (i campi `city`/`citySource`/`cityConfidence` su `ListenEvent`, l'entità derivata `ContextPeriod` con la tassonomia `CONTEXT_KINDS`, i toggle `retainCountry`/`retainCity`/`retainDeviceType`/`retainDeviceDetail`/`deriveContext`, la tabella `contexts` nello **schema Dexie v6** con migrazione non distruttiva e MIG-5 sul ricalcolo esplicito), il **classificatore L1** in `packages/core/src/context/` (regole R1..R7 nell'ordine dichiarato, soglia 0.5, `derivedVersion` dai parametri, slot = giorno locale × dispositivo) con la persistenza dei periodi (`recompute()`, verdetto utente con `userLabel`) e il **fixture di scenario geo** (`fixtures/scenarios/geo-context.json`). Il **delta su `02`** era ratificato come decisione ed è stato applicato **in questa story**, come avvenuto per la `21` nella Story 4.1. Dettagli e scelte dichiarate: `docs/state/stories/1.6-geo-foundation.md`.

**Task**:
- T1.6.1 — Applicare il delta a `02-DATA-SCHEMA.md` (v1.7): `city`/`citySource`/`cityConfidence` su `ListenEvent`, `ContextPeriod`, tabella `contexts`, toggle, migrazione Dexie v5→v6
- T1.6.2 — Classificatore L1 deterministico e versionato (`19§5`): le regole R1..R7 nell'ordine dichiarato, la soglia 0.5, il `derivedVersion` (MIG-3)
- T1.6.3 — Persistenza dei periodi con `recompute()` e `userLabel` (verdetto utente: `confirmed`/`corrected`/`dismissed`)
- T1.6.4 — Test sul fixture di scenario: il classificatore è ricalcolabile e deterministico a parità di `derivedVersion`

**Acceptance criteria** (da `19` v1.0 🟢):
- [x] Il classificatore produce gli stessi periodi a parità di input e di `derivedVersion` (`19§5.2`)
- [x] Un periodo sotto la soglia 0.5 **non** viene aggregato (`19§5.3`, **E19** — la numerazione del documento ratificato; il backlog citava «E22», che non esiste in `19`)
- [x] `country` resta derivato e conservato indipendentemente da `retainIp` (issue #108)
- [x] `car` è classificabile solo con `carDetectionConsent` attivo (`19§5.3`)

**Spec**: `docs/19-GEO-CONTEXT.md` (v1.0 🟢 APPROVED, Sessione 67) §4, §5, §7 · `docs/13-ADR/0009-local-ip-geolocation.md` (v1.0 🟢 APPROVED) · `docs/02-DATA-SCHEMA.md` §3.8 · `docs/09-PRIVACY-SECURITY.md` §3.1, §4

---
## EPIC 2 — Analisi (Fase 2)

### Story 2.1 — Mood Tracker giornaliero `[PHASE-2]` `[AREA:analysis]` `[PRI:B]` `[SIZE:M]` `[DEP:0.2]`

**Stato**: ✅ **DONE — implementata nella Sessione 63** (issue #180, PR #192 merged il 2026-10-29, merge commit `d018a26`, branch `feat/180-mood-tracker`). La story era ⛔ bloccata dalle audio features (EPIC 4.1, decisione **D-A.1**, ratifica del 2026-10-28): il **project owner** ha invertito l'ordine il 2026-10-29 ("prendi in carico la issue 180"). Consegnato: il motore in `packages/core/src/analysis/mood/` (periodi UTC di giorno, settimana e mese; media ponderata per durata; mappa dei sei quadranti; invarianti `04§3.6`), il **filtro per sorgente** delle feature (`21-AUDIO-FEATURES.md` §12, D-AF.4: il motore vede solo feature misurate o manuali), la persistenza degli insight `mood_day`/`mood_week`/`mood_month` con `derivedVersion` (`04§9`) e il ricalcolo batch che rimuove gli insight `stale` (MIG-3), il plug-in `createMoodGenerator` dell'orchestratore (`04§8.1`) e **51 test** (classificazione, periodi, persistenza, fixture di scenario). **Il percorso dati resta alla Story 4.1 (issue #188)**: senza feature vere nella tabella `features` il motore non produce nulla — comportamento dichiarato e testato, nessun segnale inventato (D-A.1). Dettagli e scelte: `docs/state/stories/2.1-mood-tracker.md`.

**Acceptance criteria**:
- [x] Formula specificata in `04-ANALYSIS-ALGORITHMS.md` (Sessione 4; **ratificata** in v1.0 🟢 il 2026-10-28, §3.2-§3.6)
- [x] Insight tipo `mood_day` persistito con `derivedVersion`
- [x] Test su fixture con scenario noto

---

### Story 2.2 — Era Detector `[PHASE-2]` `[AREA:analysis]` `[PRI:I]` `[SIZE:L]` `[DEP:2.1]`

**Stato**: ✅ **DONE — implementata nella Sessione 69** (issue #211, PR #212 merged il 2026-10-31T09:49:44Z, merge commit `3294aa4`, branch `feat/211-era-detector`). La spec `04-ANALYSIS-ALGORITHMS.md` è **v1.2 🟢 APPROVED** (la ratifica v1.0 è della Sessione 59, issue #178; l'emendamento D-A.6 è della Sessione 65) e l'algoritmo di §5 è **change point detection** su firme settimanali — non clustering non supervisionato. Consegnato: il motore in `packages/core/src/analysis/era/` (firme con distribuzione dei generi, top artist, valence/energy medie, quota notturna e tasso di ripetizione; similarità con cosine + Jaccard + distanza normalizzata; rilevamento dei change point; costruzione delle ere; filtro `minEraDays`), il **classificatore del mood tracker** per il mood dominante dell'era (D.69.2), la persistenza degli insight `era` con `derivedVersion` (`04§9`) e il ricalcolo che sostituisce **l'insieme** delle ere (`replaceAllInsightsOfType`, D.69.8), il plug-in `createEraGenerator` dell'orchestratore (`04§8.1`) e il **fixture di scenario** `fixtures/scenarios/era-shift.json` (8 settimane di *pop* + 8 di *indie folk*, confine dichiarato al giorno 56). **37 test** nuovi in `@ls/core`. Dettagli e scelte dichiarate (D.69.1…D.69.8): `docs/state/stories/2.2-era-detector.md`.

**Acceptance criteria**:
- [x] **Algoritmo come specificato in `04-ANALYSIS-ALGORITHMS §5`** (sliding window + change point su similarity signature): parametri `windowDays=14`, `stepDays=7`, `similarityThreshold=0.65`, `minEraDays=14`, `weights={genre:0.5, artist:0.3, numeric:0.2}` (allineato alla spec, chiusura ambiguità "Bayesiano/PELT" in Sessione 13)
- [x] EraPayload completo per ogni era (vedi `02-DATA-SCHEMA.md §4`): `label`, `moodDominant`, `topArtistIds`, `topTrackIds`, `genreDistribution`, `avgValence`, `avgEnergy`, `nightShare`, `repeatRate`
- [x] Test: 2 ere evidenti (`fixtures/scenarios/era-shift.json`, confine dichiarato al giorno 56) → rilevate correttamente; invarianti `04§5.5` verificate (disgiunte e ordinate, `sum(genreDistribution)≈1.0`, `moodDominant ∈ enum`), anche su `fixtures/scenarios/lockdown-2020.json`
- [x] **Niente segnali inventati** (D-A.1): senza feature misurate o manuali l'era non viene prodotta (`avgValence`/`avgEnergy` non sono nullable in `02§4`)

---

### Story 2.3 — Event Detector `[PHASE-2]` `[AREA:analysis]` `[PRI:I]` `[SIZE:L]` `[DEP:2.1]`

**Stato**: ✅ **DONE — implementata nella Sessione 70** (issue #214, PR #215 merged il 2026-10-31T11:18:48Z, merge commit `5149b2c`, branch `feat/214-event-detector`). La spec `04-ANALYSIS-ALGORITHMS.md` è **v1.3 🟢 APPROVED** (la ratifica v1.0 è della Sessione 59, issue #178; l'emendamento D-A.6 è della Sessione 65) e il §6 dichiara gli **otto tipi** di evento e i loro trigger. Consegnato: il motore in `packages/core/src/analysis/event/` (metriche giornaliere con volume in ore, valence/energy medie ponderate, diversità e artisti nuovi; detector a **z-score** su griglia settimanale; detector a **quota** per `spike_artist`/`spike_genre`; detector specialistici per `silence` ed `exploration`; dedupe per tipo e per soggetto), la persistenza degli insight `event` con `derivedVersion` (`04§9`) e il ricalcolo che sostituisce **l'insieme** degli eventi (`replaceAllInsightsOfType`), il plug-in `createEventGenerator` dell'orchestratore (`04§8.1`) e il **fixture di scenario** `fixtures/scenarios/listening-spike.json` (81 giorni di baseline + 14 di picco, il picco dichiarato al giorno 81). **Nessun segnale inventato** (D-A.1): senza feature misurate o manuali non viene prodotto alcun evento basato sulla valence. Dettagli e scelte dichiarate (D.70.1…D.70.8): `docs/state/stories/2.3-event-detector.md`.

**Acceptance criteria**:
- [x] Rileva spike/crolli volume, valence drop/rise, exploration, silence
- [x] Z-score o IQR con finestra documentata
- [x] Falsi positivi < 10% su fixture di test

---

### Story 2.4 — Memory Engine `[PHASE-2]` `[AREA:analysis]` `[PRI:B]` `[SIZE:M]` `[DEP:0.2]`

**Stato**: ✅ **DONE — implementata nella Sessione 61** (issue #179, PR #185, merge `40ad0b7`). La spec `04-ANALYSIS-ALGORITHMS.md` è **v1.0 🟢 APPROVED** (ratifica del 2026-10-28, issue #178) e i **trigger dei 5 tipi** sono specificati (§7.2, con le formule di `return` e `seasonal` e il criterio dei 5 brani distinti per `first_time`: decisioni **D-A.2** e **D-A.3**). Consegnato: i 5 generatori in `packages/core/src/analysis/memory/`, il feed ordinato per rilevanza (`04§7.4`), la persistenza degli insight `memory` con `derivedVersion` calcolata dai parametri (`04§9`) e l'insight vecchio `stale` al cambio dei parametri (MIG-3), l'orchestratore minimale (`04§8.1`). I template i18n dei ricordi sono **già dichiarati** in `08-COPY-I18N.md` §2.15 (`memory.*`): il testo è una stringa **resa alla generazione** dal resolver i18n (D-A.4). Dettagli e scelte di implementazione: `docs/state/stories/2.4-memory-engine.md`.

**Acceptance criteria**:
- [x] 5 tipi di ricordo (on_this_day, first_time, milestone, return, seasonal) — specificati in `04§7.2` (v1.0 🟢)
- [x] Trigger documentati in `04-ANALYSIS-ALGORITHMS.md` (§7.2, ratificati)
- [x] Insight `memory` persistito con `derivedVersion` e feed ordinato per rilevanza (§7.4)

---

### Story 2.5 — Collegamento del pipeline di analisi all'app `[PHASE-2]` `[AREA:analysis]` `[PRI:B]` `[SIZE:L]` `[DEP:2.1, 2.2, 2.3, 2.4]`

**Descrizione**: I quattro motori di analisi sono implementati e testati in `packages/core/src/analysis/` (mood `mood/`, ere `era/`, eventi `event/`, ricordi `memory/`, con l'orchestratore `pipeline.ts`) e la persistenza degli insight esiste (`db/insights.ts`), ma **nessun codice in `apps/web` li esegue**: la Home **legge** gli insight (`apps/web/src/hooks/useHomeTimelineData.ts`) che nessuno **scrive**. Dopo un import pulito le sezioni mood, ere e ricordi restano vuote e i differenziatori narrativi del progetto — «dati storici + emozioni» — non sono visibili a nessuno. Questa story collega il core all'app: è il lavoro che trasforma «abbiamo gli algoritmi» in «l'app conosce la tua musica».

**Stato**: ✅ **DONE — mergiata in `main`** (issue #266, PR #295 merged il 2026-11-03, merge commit `265fa50`, branch `feat/266-story-2-5---collegamento-del-pipeline-di`). La spec di collegamento (`docs/23-ANALYSIS-PIPELINE.md`, 🟢 APPROVED v1.0, ratificata dal project owner il 2026-11-02) è vincolante e l'implementazione la rispetta. Consegnato: l'orchestratore `runAnalysisPipeline` in `packages/core/src/analysis/runner.ts` (i 4 generator nell'ordine di `04§8.1`, la persistenza con le `replace*` corrette per tipo, il report `AnalysisRunReport`), l'adapter app `apps/web/src/analysis/analysisRunner.ts` (DB, translator i18n, logging, **errori non fatali**), il trigger `post-import` in coda che **non blocca l'import** (`05§6.1`), lo stato vuoto **`no-features`** nella Home (`home.noFeatures.*` in it/en) e la lettura di `mood_week` con `weekMoodLabel` popolato in `AppShell`. **Nessun segnale inventato** (D-A.1): senza feature misurate o manuali non viene prodotto alcun insight basato sulla valence, e la UI lo dice. Dettagli e scelte dichiarate (D-23.1…D-23.6): `docs/state/stories/2.5-analysis-pipeline-link.md`.

**Task**:
- T2.5.1 — Trigger di esecuzione: dopo l'import e a richiesta, in **coda** (l'import non deve mai attendere l'analisi: `05§6.1`)
- T2.5.2 — Precondizione dei dati: il mood tracker usa **solo** feature misurate o manuali (D-AF.4: l'euristico non alimenta il mood); senza feature l'analisi **non produce nulla** e nessun segnale viene inventato (D-A.1)
- T2.5.3 — Persistenza degli insight con `derivedVersion` e ricalcolo batch che rimuove gli insight `stale` (MIG-3, `04§9`)
- T2.5.4 — Stato vuoto **esplicito** nella UI («non c'è ancora niente da raccontare: importa il tuo storico»), mai uno schermo vuoto senza spiegazione
- T2.5.5 — Wiring dei quattro plug-in dell'orchestratore (`04§8.1`): `createMoodGenerator`, `createEraGenerator`, `createEventGenerator`, `createMemoryGenerator`
- T2.5.6 — i18n: i testi dei ricordi sono **stringhe rese** dal resolver (D-A.4), nessuna stringa italiana nel core
- T2.5.7 — Collegamento alla pipeline audio features (Story 4.1): la coda di arricchimento è il **precondizionamento** dell'analisi, non un doppione

**Acceptance criteria**:
- [x] Dopo un import reale con feature disponibili, la tabella `insights` contiene righe `mood_day`, `era`, `event` e `memory` con `derivedVersion`
- [x] La Timeline mostra almeno un'era e la Home un ricordo del giorno, letti dal DB (non da dati in memoria)
- [x] **Nessun segnale inventato**: senza feature misurate o manuali non viene prodotto alcun insight basato sulla valence (D-A.1), e la UI lo dice
- [x] Esecuzione **idempotente**: un ricalcolo non duplica gli insight e un'interruzione non lascia righe parziali (`21§11.3`, T-AF.14)
- [x] L'import non attende l'analisi: il tempo di import resta indipendente dal numero di eventi analizzati
- [x] Test con i fixture di scenario (`fixtures/scenarios/*.json`) e copertura dei quattro generatori
- [x] La spec di collegamento è scritta e 🟢 APPROVED prima dell'implementazione (protocollo: `agent-ready` solo con spec approvata)

**Dipendenze**: Story 2.1, 2.2, 2.3, 2.4 (tutte ✅ DONE) · la 4.1 è la sorgente delle feature
**Spec**: **`docs/23-ANALYSIS-PIPELINE.md`** (🟢 APPROVED v1.0, ratificata dal project owner il 2026-11-02) · `04-ANALYSIS-ALGORITHMS.md` (v1.2 🟢 APPROVED) §8.1, §9 · `21-AUDIO-FEATURES.md` (v1.1 🟢 APPROVED) §12 · `05-ARCHITECTURE.md` §6.1 · `docs/22-COMPETITIVE-POSITIONING.md` §7
**Issue**: #266 (chiusa con `status:done` al merge della PR #295)

---

## EPIC 3 — UI/UX (Fase 3)

### Story 3.1 — Home + Timeline `[PHASE-3]` `[AREA:ui]` `[PRI:B]` `[SIZE:XL]`

**Stato**: ✅ **DONE** — implementata nella Sessione 77 (issue **#233**, branch `feat/233-home-timeline`). Spec `06-UX-FLOWS-STATES.md` §2.6-2.7, `07-UI-SPEC.md` §2.1-2.7, `15-DESIGN-SYSTEM.md` §5 e §10.

Consegnato: la schermata ⑥ **Home** (4 StatCard con count-up, ricordo del giorno, bar week, mood della settimana) e la ⑦ **Timeline** (EraBands, StreamChart, MoodLine sincronizzati, nastro contesto della Story 3.4 sotto le bande, toggle di granularità e zoom progressivo); la prima navigazione dell'app (`AppShell`) e la scelta onboarding/app legata ai **dati**. I grafici sono **SVG scritti a mano** (nessuna libreria di chart), il modello è **puro** e riutilizza il vocabolario temporale del core. **19 test** nuovi.

**Acceptance criteria**:
- [x] Schermata ⑥ Home con StatCard animate, ricordo del giorno, bar week
- [x] Schermata ⑦ Timeline con EraBands, StreamChart, MoodLine sincronizzati
- [x] Zoom progressivo anni → mesi → giorni
- [x] Responsive breakpoint rispettati
- [x] Hover su EraBand ↔ punto corrispondente nei grafici, e viceversa (`06§2.7`)
- [x] Grafici SVG con `<title>`/`<desc>` e tabella dati nascosta per screen reader (`07§2.7`)
- [x] Animazioni rispettate sotto `prefers-reduced-motion` (`07§4`)
- [x] Nessuna dipendenza cartografica e nessuna richiesta di rete

---

### Story 3.2 — Ricordi + Share `[PHASE-3]` `[AREA:ui]` `[PRI:I]` `[SIZE:L]`

**Stato**: ✅ **DONE** — implementata nella Sessione 97 (issue **#241**, branch `feat/241-story-3-2---ricordi-share`). Spec `25-MEMORIES-SHARE-EXPLORE.md` (v1.0 🟢 APPROVED), `06-UX-FLOWS-STATES.md` §2.11-§2.12, `07-UI-SPEC.md` §2.2, §2.10, `08-COPY-I18N.md`.

Consegnato: la schermata ⑪ **Ricordi** (feed a pagine di 10 con infinite scroll, esclusione dei `dismissed` che **restano** nel database, ordinamento per rilevanza) e il foglio ⑫ **ShareSheet** (dialog accessibile con focus trap e stati `generating`/`ready`/`error`); la card **1080×1350** disegnata a mano su canvas e il **capitolo HTML autonomo** come export statico alternativo; le azioni di condivisione con fallback (Web Share API → download, clipboard → download); il **tagging manuale** (nome e parole chiave dell'era, nota libera sul ricordo) con la **preservazione al ricalcolo** dei campi dell'utente. **37 test** nuovi.

**Descrizione**: Il feed dei ricordi (schermata ⑪) e la **condivisione** di un capitolo della timeline. Il vincolo «tutto locale» non è un blocco: la condivisione esporta **un capitolo statico** (immagine, HTML autonomo, PDF), **mai** il database. La privacy resta il messaggio: la card dice «la mia estate 2019 su Life Soundtrack» e non contiene dati identificativi. In questa story cade anche il **tagging manuale** di ere e canzoni («viaggio a Berlino», «esame di laurea»): è il ponte fra l'analisi automatica, che dice *cosa* suonava, e l'utente, che sa *perché*. I dati del tagging sono testo libero e restano sul dispositivo: sono coperti dall'export e dalla cancellazione della Story 5.2.

**Acceptance criteria**:
- [x] Feed ricordi mobile (schermata ⑪)
- [x] ShareSheet con card 1080×1350 generata via canvas
- [x] Condivisione nativa + download immagine
- [x] La card è un **capitolo statico**: copertine, periodo, canone simbolo, nome dell'era — nessun dump del database nei canali di condivisione
- [x] Export statico alternativo (HTML autonomo) per chi non usa i social
- [x] Tagging manuale di un'era (nome libero + parole chiave) e di una canzone (la nota libera del ricordo), persistito localmente in `Insight.userNote` (D-25.4: nessuna migrazione dello schema) e cancellabile dalla Story 5.2
- [x] L'utente può rinominare un'era rilevata automaticamente: il campo esiste già (`Insight.userNote`) e ha **ora** UI e percorso di scrittura
- [x] i18n IT/EN per le nuove stringhe

**Spec**: **`docs/25-MEMORIES-SHARE-EXPLORE.md`** (🟢 APPROVED v1.0, ratificata dal project owner il 2026-11-02) · `docs/06-UX-FLOWS-STATES.md` §2.11, §2.12, §3.3 · `docs/07-UI-SPEC.md` §2.2, §2.10 · `docs/09-PRIVACY-SECURITY.md` §6.1 · `docs/22-COMPETITIVE-POSITIONING.md` §10, §11
**Issue**: #241 (issue canonica della story — Sessione 86: corpo e checklist aggiornati con la spec)

---

### Story 3.3 — Esplora + Analisi `[PHASE-3]` `[AREA:ui]` `[PRI:I]` `[SIZE:L]`

**Stato**: 🟡 **IN REVIEW** — implementata nella Sessione 103 (issue **#240**, branch `feat/240-story-3-3---esplora-analisi-schermate-9`). Spec `25-MEMORIES-SHARE-EXPLORE.md` (v1.0 🟢 APPROVED), `06-UX-FLOWS-STATES.md` §2.9-§2.10, `07-UI-SPEC.md` §2.8-§2.9.

Consegnato: la schermata ⑨ **Esplora** (ricerca sul **proprio** catalogo con debounce di 300 ms, cinque tab — Artisti · Brani · Album · Generi · Mood — e i risultati ordinati per `listenCount`) e la schermata ⑩ **Analisi** (il `QuadrantChart` valence/energy con un punto per mese, la **frase in prosa** che accompagna il grafico e gli insight persistiti con le tre azioni dell'utente); il **deep-link interno** dal punto del quadrante alla Timeline (`AppSection` + `AppFocus`, senza router); il mood della settimana letto da `mood_week` e **tradotto** nella shell. **20 test** nuovi.

**Descrizione**: Le schermate di esplorazione (⑨ ricerca, ⑩ quadrante valence/energy) sono il luogo dove l'utente **interroga** il proprio diario. Il criterio di accettazione di questa story non è «un grafico in più»: è l'**insight in prosa** — la stessa analisi raccontata in linguaggio naturale («A marzo 2023 hai ascoltato 47 canzoni malinconiche in due settimane: stava succedendo qualcosa?»). Un grafico senza lettura è l'ennesimo cruscotto; l'«aha moment» è la frase che spiega un periodo.

**Acceptance criteria**:
- [x] Schermata ⑨ con search autocomplete sui propri dati
- [x] Schermata ⑩ QuadrantChart valence/energy
- [x] Click su punto → deep-link timeline
- [x] **Insight in prosa**: ogni insight mostrato è accompagnato da una frase generata dai template i18n (`insight.*`), non da un solo valore numerico
- [x] Gli insight visualizzati sono **persistiti** (nessuna lettura «a caldo» che non passi dalla tabella `insights`): la story consuma l'output della Story **2.5**
- [x] Il percorso è interamente locale: nessuna richiesta di rete per cercare o spiegare

**Spec**: **`docs/25-MEMORIES-SHARE-EXPLORE.md`** (🟢 APPROVED v1.0, ratificata dal project owner il 2026-11-02) · `docs/06-UX-FLOWS-STATES.md` §2.9, §2.10 · `docs/07-UI-SPEC.md` §2.8, §2.9 · `docs/22-COMPETITIVE-POSITIONING.md` §8
**Issue**: #240 (issue canonica della story — Sessione 86: corpo e checklist aggiornati con la spec)

---

### Story 3.4 — Nastro contesto (Timeline) `[PHASE-3]` `[AREA:ui]` `[PRI:I]` `[SIZE:M]` `[DEP:1.6, 4.4]`

**Descrizione**: Il nastro contesto sotto le `EraBand` della Timeline (schermata ⑦) e la schermata di dettaglio del periodo (⑧): un segmento per `ContextPeriod`, colore per `kind`, etichetta paese (+ «circa *città*» solo se la fonte non è manuale), pips dei dispositivi, filtri per `kind`/paese/dispositivo, azioni utente (`confirmed` / etichetta / `dismissed`).

**Stato**: ✅ **DONE** — implementata nella Sessione 76 (issue **#231**, branch `feat/231-context-ribbon`). La specifica è ratificata (`19` v1.0 🟢 §8.2-8.3, Sessione 67). **Nessuna mappa**: nessuna dipendenza cartografica, nessun tile online — la scala disponibile non lo giustifica e un tile implicherebbe uscita di rete.

Consegnato: il nastro (`apps/web/src/components/ContextRibbon.tsx`) con un segmento per `ContextPeriod`, colore per `kind`, pips dei dispositivi, filtri e sincronizzazione con lo zoom; il dettaglio del periodo (`ContextPeriodDetail.tsx`) con eventi, etichetta e le tre azioni utente; il namespace `timeline.context.*` materializzato in `08§2.12h` (36 chiavi, la sezione era **dichiarata** dal changelog 0.9 della Sessione 67 ma non scritta); **15 test** in `@ls/web`.

**Task**:
- [x] T3.4.1 — Componente del nastro (segmenti, colori per `kind`, pips dei dispositivi), sincronizzato con lo zoom della Timeline
- [x] T3.4.2 — Schermata di dettaglio del periodo: eventi, label, azioni utente
- [x] T3.4.3 — Namespace `timeline.context.*` (`08§2.12h`): la città è **sempre** introdotta da un indicatore di incertezza, il paese mai
- [x] T3.4.4 — Nessuna dipendenza MapLibre/Leaflet e nessuna richiesta di rete per il nastro

**Acceptance criteria** (da `19` v1.0 🟢):
- [x] Il nastro mostra il **paese**; la città compare solo come «circa *X*» e mai come fatto (`19§8.2`)
- [x] Le azioni utente aggiornano lo `status` del periodo (`confirmed`/`corrected`/`dismissed`)
- [x] Il nastro **non** effettua richieste di rete

**Spec**: `docs/19-GEO-CONTEXT.md` (v1.0 🟢 APPROVED, Sessione 67) §8.2-8.3 · `docs/08-COPY-I18N.md` §2.12h · `docs/06-UX-FLOWS-STATES.md` (schermata ⑦)
---

### Story 3.5 — Anteprima del risultato in onboarding (modalità demo) `[PHASE-3]` `[AREA:ui]` `[PRI:I]` `[SIZE:M]` `[DEP:0.4, 3.1]`

**Descrizione**: L'onboarding oggi termina con un **contatore** di eventi (`apps/web/src/onboarding/OnboardingRouter.tsx`, schermata ⑤ Reveal): l'utente non vede mai il prodotto prima di usarlo, e il README dichiarava un'«anteprima del risultato» che il codice non ha. Il progetto ha già i mattoni: `fixtures/demo-user.json` (1 anno, 4500 eventi, 200 track, 30 artisti, `demoMode: true`) è previsto da `06-UX-FLOWS-STATES.md` §2.14 e la CTA «Scopri come funziona» esiste nelle stringhe i18n (`empty.cta.demo`) — ma **nessun file di codice li usa**. Questa story rende l'onboarding **spettacolare**: il diario di esempio *prima* dell'import, le prime righe della timeline reale *dopo*.

**Stato**: 🟡 **IN REVIEW** — implementata nella Sessione 104 (issue **#270**, branch `feat/270-story-3-5---anteprima-e-modalita-demo-in`). Consegnato: il **database demo separato** (`life-soundtrack-demo`) con il loader del fixture (`packages/core/src/db/demoSeed.ts`), il fixture **rigenerato** con `albums` e `features` deterministiche (75 album, 200 feature, tre fasi musicali, `generatedAt` deterministico), la CTA «Scopri come funziona» sul **primo passo** dell'onboarding, il banner dichiarativo e l'uscita con un click, e il **reveal con anteprima** (le prime righe della timeline reale e l'anno **calcolato**). Dettagli: `docs/state/stories/3.5-anteprima-onboarding-demo.md`.

**Task**:
- [x] T3.5.1 — CTA «Scopri come funziona» sul primo passo dell'onboarding (la stringa `empty.cta.demo` esiste ma non è renderizzata)
- [x] T3.5.2 — Demo: caricamento di `fixtures/demo-user.json` in un contesto **isolato** (nessun dato scritto nel database dell'utente)
- [x] T3.5.3 — Anteprima resa con gli **stessi componenti** della Home e della Timeline (Story 3.1): nessun renderer parallelo da mantenere
- [x] T3.5.4 — Reveal post-import: le **prime tre righe** della timeline reale invece del solo contatore di eventi
- [x] T3.5.5 — Dichiarazione: i dati della demo sono **sintetici** e il passaggio all'import reale è esplicito

**Acceptance criteria**:
- [x] La CTA della demo è raggiungibile dal primo passo e mostra un **diario di esempio**, non un testo descrittivo
- [x] La demo usa gli stessi componenti della Home/Timeline (nessun renderer separato)
- [x] La demo **non scrive** nel database dell'utente (test: dopo la demo il DB è vuoto)
- [x] Il reveal post-import mostra almeno 3 righe della timeline reale
- [x] i18n IT/EN per le nuove stringhe
- [x] Test: rendering della demo, assenza di scritture nel DB, reveal post-import

**Dipendenze**: Story 0.4 ✅ (onboarding), Story 3.1 ✅ (Home + Timeline) · **effetto pieno dipende dalla Story 2.5** (senza, la demo non ha ere né mood)
**Spec**: **`docs/26-ONBOARDING-DEMO.md`** (🟢 APPROVED v1.0, ratificata dal project owner il 2026-11-02) · `06-UX-FLOWS-STATES.md` §2.14 (demo mode) · `07-UI-SPEC.md` · `docs/22-COMPETITIVE-POSITIONING.md` §9
**Issue**: #270 (nuova, Sessione 86 — `needs-spec` fino alla ratifica della spec)

---

## EPIC 4 — Arricchimento (Fase 2/3)

### Story 4.1 — Pipeline audio features `[PHASE-2]` `[AREA:enrichment]` `[PRI:I]` `[SIZE:L]`

**Stato**: ✅ **DONE** (Sessione 64, issue #188, PR #197 merged il 2026-10-30, merge commit `7458220`, branch `feat/188-feat-enrichment-pipeline-audio-features`) — la pipeline è **implementata e completata** secondo la spec ratificata (`docs/21-AUDIO-FEATURES.md` v1.0 🟢 APPROVED, Sessione 62, issue #187; ratificata dalla PR #190 `b1dd83e`). Consegnato: il pacchetto `packages/core/src/enrichment/` **senza React** (D-AF.5) — il contratto `AudioFeatureProvider` con `fetch(track, context)`, la **cascata** `cache → Essentia.js → AcousticBrainz → euristico` con i salti dichiarati (`21§5.1`) e la regola "l'import non attende mai la rete", la **normalizzazione** DEAM `[1,9] → [0,1]` con clamp e arrotondamento a 4 decimali (`21§6.2`, E8), la **derivazione** mood → valence/energy di AcousticBrainz con pesi dichiarati (`21§7.3`, D-AF.8), il **fallback euristico** che stima tempo/ballabilità/acustica dal genere e **non** stima valence/energy (`21§8.1`), i **limiter** (MusicBrainz 1 req/s a intervallo fisso, AcousticBrainz **dagli header** `X-RateLimit-*` senza costanti, D-AF.6), la **coda** con i tre trigger, il budget di 5 min/giorno, la concurrency 1 e l'interrompibilità (`21§5.2`, D-AF.7), lo **stoccaggio** (TTL 90 giorni per AB, `schemaVersion`, LRU a 50.000 righe) e il **subpath** `@ls/core/enrichment`. La **CSP** dichiarata in `12§2.1` è applicata al bundle (`apps/web/src/security/csp.ts` + header Vite + tag `<meta>`), le **8 chiavi** `enrichment.*` (`08§2.17`) sono materializzate in `it`/`en`, e i **fixture** delle API esterne vivono in `fixtures/api-mocks/`. **142 test** nuovi in `@ls/core` (unit, integrazione, property-based con PRNG seeded, scenari) + **15** in `@ls/web` (CSP, i18n). **Fuori perimetro, dichiarato**: la UI (Story 3.x), il *lookup* MusicBrainz (Story 4.2) e il cambio di licenza AGPL-3.0 (D-A.2: atto del Boss). Dettagli e scelte: `docs/state/stories/4.1-audio-features.md`.

**Acceptance criteria** (riscritti in `21§16`):
- [ ] La cascata è **cache → Essentia.js → AcousticBrainz → euristico**, con i salti dichiarati (`21§5.1`) e la regola "l'import non attende mai la rete" (`05§6.1`)
- [ ] `PrivacySettings.enrichMetadata` è rispettato in **tutte** le forme: zero uscite, zero scritture, zero letture della cache (`21§10.4`)
- [ ] Il rate limiting è applicato a **MusicBrainz** (1 req/s) e ad **AcousticBrainz** (letto dagli header `X-RateLimit-*`, senza costanti hard-coded) (`21§7.2`, D-AF.6)
- [ ] `AudioFeatures.source` ∈ `{essentia, acousticbrainz, heuristic, manual}` è tracciato e **le feature derivate sono dichiarate** come derivate (`21§7.3`, D-AF.8)
- [ ] `valence` ed `energy` sono in [0,1] **per costruzione** e l'invariante di `10§7` è verificato da un test property-based (`21§6.2`)
- [ ] Il layer di analisi legge **solo** le feature misurate o manuali: il fallback euristico non alimenta il mood tracker (`21§12`, D-AF.4)
- [ ] Il WASM e i modelli **non** sono nel bundle iniziale né nel precache: download su richiesta, cache browser, versionamento (`21§6.5`)
- [ ] La pipeline è **idempotente** e **interrompibile**: due esecuzioni non producono righe duplicate; un job interrotto non lascia righe parziali (`21§11.3`, T-AF.14)
- [ ] Il consumo di rete è limitato ai **tre host** dichiarati (ricerca iTunes, CDN delle anteprime, API di AcousticBrainz), con la CSP allineata (`21§10.2`)
- [ ] L'inventario dati di `09§4` ha le righe delle audio features e delle query di ricerca (`21§10.3`)
- [ ] I test coprono i 14 casi minimi (`21§15.3`) con i mock delle API esterne, **mai** chiamate reali (`21§15.2`)

**Spec**: `docs/21-AUDIO-FEATURES.md` (v1.0 🟢 APPROVED, Sessione 62) · `05-ARCHITECTURE.md` §6, §6.1, §6.2 · `02-DATA-SCHEMA.md` §3.4 · `04-ANALYSIS-ALGORITHMS.md` §3, §12 · `09-PRIVACY-SECURITY.md` §3.1, §3.3, §4, §7.4 · `12-DEVOPS.md` §2.1 · `08-COPY-I18N.md` §2.17 · issue #187 (spec, ratificata) · issue #188 (implementazione, `agent-ready`)

---

### Story 4.2 — MusicBrainz lookup `[PHASE-2]` `[AREA:enrichment]` `[PRI:I]` `[SIZE:M]`

**Acceptance criteria**:
- [ ] Lookup per track name + artist
- [ ] Cache locale MBID
- [ ] Rispetto rate limit MB (1 req/s)

---

### Story 4.3 — Artwork enrichment `[PHASE-2]` `[AREA:enrichment]` `[PRI:I]` `[SIZE:M]`

**Descrizione**: Popolamento di `Track.artworkUrl` e `Album.artworkUrl` (aggiunti in `02 v1.2` per chiusura M5 audit). Cascata di fonti: **Spotify Web API** (se utente Spotify-first e `PrivacySettings.enrichMetadata=true`) → **MusicBrainz Cover Art Archive** (`/release/{mbid}/cover-art`, no auth, rate limit 1 req/s) → **iTunes Search API** (`/search?term=`, no auth, fallback per utenti Apple/Last.fm-first) → **placeholder gradient** generato runtime.

**Priorità 2026-11-02 (P0)**: le copertine sono l'**ancora visiva** del diario — senza, la timeline è un elenco di testo e l'app resta uno strumento tecnico invece di un oggetto emotivo. L'artwork è inoltre il **moltiplicatore** delle story vicine: il colore dominante dell'era, la card condivisibile (3.2) e la lettura visiva del mood (3.3) nascono tutti dalle copertine. La verifica del 2026-11-02 (`22-COMPETITIVE-POSITIONING.md` §4) ha confermato che **non esiste alcun artwork nel repository**: il campo esiste nello schema ma la pipeline di import scrive sempre `artworkUrl: null` (`packages/core/src/adapters/pipeline.ts`), e il componente `MemoryCard` ha solo lo slot vuoto.

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

**Dipendenze**: **nessuna** — la cascata funziona senza `mbid`: Spotify Web API e iTunes Search coprono la maggior parte dei casi, MB Cover Art Archive si usa solo dove esiste un MBID e il placeholder gradient è il fallback finale. Il lookup MusicBrainz (Story 4.2) è un **miglioramento incrementale** del catalogo, non un prerequisito: il vincolo `[DEP:4.2]` è stato rimosso il 2026-11-02 (`22-COMPETITIVE-POSITIONING.md` §8 e §15, decisione D-22.4)
**Spec**: **`docs/24-ARTWORK-ENRICHMENT.md`** (🟢 APPROVED v1.0, ratificata dal project owner il 2026-11-02) · `02-DATA-SCHEMA §11` · `05-ARCHITECTURE §6 §6.1 §6.2` · `07-UI-SPEC §2.2 §2.10`
**Issue**: #242 (issue canonica della story — Sessione 86: corpo e checklist aggiornati con la spec)
**Spec**: `02-DATA-SCHEMA §11`, `05-ARCHITECTURE §6 §6.1 §6.2`, `07-UI-SPEC §2.2 §2.10`

---

### Story 4.4 — DB IP→città (geolocalizzazione locale) `[PHASE-2]` `[AREA:enrichment]` `[PRI:L]` `[SIZE:L]` `[DEP:1.6]`

**Descrizione**: Il livello **L2** del contesto: la derivazione della città dall'IP tramite un database MMDB (DB-IP Lite City, CC BY 4.0) **scaricato on-demand** e interrogato in-process durante l'import, **prima** che l'IP venga azzerato. Il database non è embedded: esce dal bundle e dal precache, va in Cache Storage, e la sua assenza degrada L2 senza toccare L0/L1.

**Stato**: ⬚ **TODO** — la specifica è ratificata (`13-ADR/0009-local-ip-geolocation.md` v1.0 🟢 APPROVED, Sessione 67, issue #201; D-B.2). L'implementazione non è iniziata: manca l'issue di claim.

**Task**:
- T4.4.1 — Download on-demand del `.mmdb` (fuori dal bundle e dal precache, in Cache Storage), con l'host **dichiarato** nella CSP applicata (`12§2.1`) e l'utente informato della dimensione prima del download
- T4.4.2 — Lookup MMDB in-process nella pipeline di import, **prima** dello scarto dell'IP (`19§6.1`)
- T4.4.3 — Provenance e correzione: `citySource` (`dbip-lite`/`manual`), `cityConfidence`, soglia 0.6 con warning `cityLowConfidence`
- T4.4.4 — Freshness: build date del `.mmdb` visibile nella UI, warning `cityDbStale` oltre i 60 giorni
- T4.4.5 — Attribuzione **CC BY 4.0**: NOTICE/LICENSE, `⑭ Impostazioni` e footer di about

**Acceptance criteria** (da `13-ADR/0009` v1.0 🟢 e `19` v1.0 🟢):
- [ ] L'IP non esce mai dal dispositivo e, senza `retainIp`, non viene persistito (`19§6.1`)
- [ ] Senza database la città è `null` e il paese resta (E24)
- [ ] Il database **non** entra nel bundle iniziale né nel precache
- [ ] L'host di download è dichiarato nella CSP applicata **e** nella spec (`12§2.1`, la lezione della issue #196)
- [ ] L'attribuzione CC BY 4.0 è esposta all'utente

**Spec**: `docs/13-ADR/0009-local-ip-geolocation.md` (v1.0 🟢 APPROVED, Sessione 67) · `docs/19-GEO-CONTEXT.md` (v1.0 🟢 APPROVED) §6 · `docs/09-PRIVACY-SECURITY.md` §3.1, §4, §7.2

---
## EPIC 5 — Privacy e legale (Fase 6)

### Story 5.1 — Privacy spec finale `[PHASE-6]` `[AREA:privacy]` `[PRI:B]` `[SIZE:M]`

**Acceptance criteria**:
- [ ] `09-PRIVACY-SECURITY.md` APPROVED
- [ ] Data flow diagram
- [ ] Bozza privacy policy GDPR-compliant
- [ ] **Pagina in-app «Come trattiamo i tuoi dati»**: per il lancio non serve un documento legale monumentale, serve una pagina chiara e onesta che dica (a) cosa resta sul dispositivo e cosa non esce mai, (b) che l'**unica** uscita è l'invio ai hub di scrobbling e solo se l'utente ha attivato quel hub (default: nessuno), (c) cosa succede ai dati quando li esporta o li cancella, (d) che il progetto è AGPL-3.0 e offre il sorgente (§13). La pagina utente è il documento (`09`) tradotto in linguaggio semplice — vedi `22-COMPETITIVE-POSITIONING.md` §13 (decisione D-22.7)

**Spec**: **`docs/27-PRIVACY-DATA-SETTINGS.md`** (🟢 APPROVED v1.0, ratificata dal project owner il 2026-11-02) · `docs/09-PRIVACY-SECURITY.md` (🟡 DRAFT v0.7) §6.1 · `docs/06-UX-FLOWS-STATES.md` §2.13 · `docs/12-DEVOPS.md` §5.3 (AGPL §13)
**Issue**: #244 (issue canonica della story — Sessione 86: corpo e checklist aggiornati con la spec)

---

### Story 5.2 — Export e purge `[PHASE-6]` `[AREA:privacy]` `[PRI:B]` `[SIZE:M]`

**Acceptance criteria**:
- [ ] `purgeIp()` cancella tutti gli IP
- [ ] Export JSON completo (portabilità GDPR)
- [ ] Cancellazione totale con doppia conferma

**Spec**: **`docs/27-PRIVACY-DATA-SETTINGS.md`** (🟢 APPROVED v1.0, ratificata dal project owner il 2026-11-02) · `docs/09-PRIVACY-SECURITY.md` (🟡 DRAFT v0.7) §6.1 · `docs/06-UX-FLOWS-STATES.md` §2.13, §3.4 · `docs/22-COMPETITIVE-POSITIONING.md` §12
**Issue**: #246 (issue canonica della story — Sessione 86: corpo e checklist aggiornati con la spec)

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
- [ ] `pwsh scripts/generate-bundle.ps1 -Check` exit 0

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
11. **4.1** pipeline audio features (issue #188, ✅ **DONE**, PR #197 merged `7458220`) — la pipeline è **completata** (Sessione 64): cascata, provider, limiter, coda, stoccaggio, CSP e i18n (`21§4…§11`), con **142 test** in `@ls/core` e **15** in `@ls/web`. La spec è ratificata (`21-AUDIO-FEATURES.md` v1.0 🟢 APPROVED, Sessione 62): le nove decisioni D-AF.1…D-AF.9 sono chiuse e gli AC sono riscritti (`21§16`). Era il **primo** anello della catena **4.1 → 2.1 → 2.2/2.3**: ha fornito le valence/energy senza le quali la **2.2** (era detector) non ha `moodDominant`/`avgValence`/`avgEnergy` e la **2.3** (event detector) non ha i signal di cui parlare
12. **2.1** mood tracker — **completata** (Sessione 63, issue #180, PR #192 merged `d018a26`): il motore è consegnato e consuma le feature già persistite. Il **percorso dati** è arrivato con la 4.1: la catena **4.1 (dati) → 2.1 (letture)** è completa
13. **1.6, 4.4, 3.4** geo e contesto di ascolto — **tranche chiusa** (Sessione 76, issue #231): dopo la ratifica di `19-GEO-CONTEXT.md` v1.0 🟢 e dell'ADR-0009 v1.0 🟢 (Sessione 67, issue #201) sono state completate la **1.6** (fondazione geo: delta su `02` v1.7, tabella `contexts`, classificatore L1 — Sessione 68, issue #205, PR #209, merge `68c27e5`), la **4.4** (DB MMDB on-demand + derivazione della città — issue #221) e la **3.4** (nastro contesto — Sessione 76, issue #231: il nastro e il dettaglio del periodo, con il namespace `timeline.context.*` materializzato). Il **perimetro L2 è opt-in** (`retainCity` default OFF) e **L0/L1 reggono da sole**: senza database c'è il paese, non la città. Il blocco NEXT-STEP del README indica ora la **3.1** (Home + Timeline): con il nastro pronto, la Timeline è il pezzo che manca per montarlo e per sbloccare il test end-to-end
14. **2.2, 2.3** analisi avanzata — dopo la 2.1 (il backlog dichiara `[DEP:2.1]`): hanno ricevuto il loro state file nella Sessione 67 perché il blocco NEXT-STEP non poteva puntare a una story fuori ordine di priorità. La **2.2** (era detector) e la **2.3** (event detector) sono **entrambe completate** (Sessione 69 e Sessione 70): con la 2.3 l'**EPIC 2** ha consegnato mood, ere, eventi e ricordi. Il blocco NEXT-STEP del README ricade quindi sulla tranche **geo** — **4.4** (DB IP→città, on-demand) e **3.4** (nastro contesto), entrambe con la specifica già ratificata
15. **2.5** Collegamento del pipeline di analisi all'app — **completata** (issue #266, PR #295 merged `265fa50`, 2026-11-03): i motori di analisi (mood, ere, eventi, ricordi) erano scritti e testati in `packages/core/src/analysis/` ma **nessun codice in `apps/web` li eseguiva**: la Home leggeva gli insight che nessuno scriveva. Ora l'orchestratore `runAnalysisPipeline` gira in coda dopo l'import, persiste gli insight con `derivedVersion`, la Home e la Timeline li leggono dal DB, e l'utente senza feature acustiche vede il messaggio `no-features` invece di uno schermo vuoto. È il differenziatore narrativo del progetto ed è più economico dell'artwork (`22-COMPETITIVE-POSITIONING.md` §7, D-22.2). Dettagli: `docs/state/stories/2.5-analysis-pipeline-link.md`
16. **4.3** Artwork enrichment — **P0**: l'ancora visiva del diario, e il moltiplicatore delle story vicine (colore dell'era, card condivisibile, lettura del mood). **Non dipende più dal lookup MusicBrainz** (D-22.4): Spotify Web API + iTunes Search + placeholder gradient bastano
17. **3.2, 3.3, 3.5** UI — la **3.1** (Home + Timeline) è **completata** (Sessione 77, issue #233), la **3.4** (nastro contesto) pure (Sessione 76, issue #231) e la **3.2** (Ricordi + Share) **completata** (Sessione 97, issue #241: il feed ⑪, il ShareSheet ⑫, la card 1080×1350 su canvas e il capitolo HTML autonomo — un **capitolo statico**, mai un dump del database — e il tagging manuale). Restano la **3.3** (Esplora + Analisi: insight **in prosa**, non un grafico in più) e la **3.5** (anteprima/demo in onboarding): le due chiudono il percorso end-to-end. La 3.3 consuma l'output della **2.5**
18. **5.2, 5.1** privacy — nell'ordine **5.2 → 5.1**: export e purge sono l'atto di fiducia che rende vera la promessa della privacy (pulsanti **prominenti**, non nascosti in un menu), la pagina «Come trattiamo i tuoi dati» ne è la traduzione in linguaggio utente (D-22.7)
19. **4.2** Lookup MusicBrainz — **P2**: utile per la precisione dei metadati, non per l'esperienza; non è più il prerequisito dell'artwork (D-22.4)
20. **6.1** Upgrade stack a ultime major — **solo al termine dell'implementazione** (D.10.2): non blocca le fasi 0-5

**Regola di selezione per agenti paralleli (ADR-0006)**: l'ordine sopra è l'ordine di **tentativo**, non una scelta automatica. Un agente lavora la prima story dell'ordine che sia **libera** — issue `agent-ready` senza label `in-progress` (o con claim stantio oltre le 12h). Se la prima è già claimata da un altro agente, passa alla successiva. La procedura obbligatoria — claim, riverifica, cascata, TTL — è definita in `AGENTS.md` §"🎫 Presa in carico delle story (claim)". **Nessuna selezione di story avviene senza quella procedura.**

## Stato di avanzamento — roadmap delle story non ancora completate

> **La fonte di verità per le story completate è il blocco aggregato `AGGREGATE-STORIES-*` in fondo a questo file**, generato da `scripts/aggregate-state.ps1` a partire da `docs/state/stories/*.md` (ADR-0008).
>
> Questa tabella elenca **solo le story ancora da implementare**. Non duplicare qui le story già `done`: la duplicazione è stata la causa del drift corretto in Sessione 38 (issue #90), che dichiarava 0.4/0.6/0.7 come `⬚ TODO` mesi dopo il loro merge.
>
> **Regola per gli agenti**: quando una story passa a `done`, si rimuove da questa tabella e si aggiorna (o si crea) il suo `docs/state/stories/<id>-<slug>.md` — l'aggregatore farà comparire la story nel blocco aggregato al merge. Non modificare mai a mano il blocco aggregato.

| EPIC | Story | Stato | Note |
|------|-------|-------|------|
| 2-3 | 2.x analisi, 3.x UI | ⬚ TODO | dipendono da 0.2 ✅ · l'**EPIC 2** ha implementato 2.1 (mood), 2.2 (ere), 2.3 (eventi) e 2.4 (ricordi), e la **2.5** li ha **collegati all'app** (issue #266, PR #295, merge `265fa50`): l'orchestratore gira in coda dopo l'import e la Home/Timeline leggono gli insight dal DB · nell'**EPIC 3** sono completate la **3.4** (nastro contesto, Sessione 76, issue #231), la **3.1** (Home + Timeline, Sessione 77, issue #233) e la **3.2** (Ricordi + Share, Sessione 97, issue #241): l'app ha ora le sue prime tre schermate vere e il tagging manuale. Restano la **3.3** (Esplora + Analisi) e la **3.5** (anteprima/demo in onboarding, nuova, Sessione 85) |
| 4 | 4.x enrichment (audio features, artwork, generi) | ⬚ TODO | dipende da 0.2 ✅ · **4.1 completata** (Sessione 64, issue #188, PR #197, merge `7458220`): restano **4.3** (artwork, **P0** dal 2026-11-02 e **senza dipendenza** dal lookup MusicBrainz), **4.2** (lookup MusicBrainz, P2), i generi e la **4.4** (DB IP→città, specificata dalla ratifica dell'ADR-0009 nella Sessione 67) |
| 1-3 | **1.6, 4.4, 3.4** geo e contesto di ascolto | ✅ **DONE** (tranche chiusa) | la specifica è **ratificata** (`19-GEO-CONTEXT.md` v1.0 🟢, `13-ADR/0009` v1.0 🟢, Sessione 67, issue #201): la **1.6** fonda lo schema e il classificatore L1 — **completata** (Sessione 68, issue #205, PR #209, merge `68c27e5`) — la **4.4** porta il DB MMDB on-demand e la derivazione della città (opt-in) — **completata** (issue #221) — la **3.4** disegna il nastro contesto — **completata** (Sessione 76, issue #231). L2 è il «condimento»: L0/L1 reggono da sole |
| 5 | 5.x privacy | ⬚ TODO | — |
| 6 | 6.1 Upgrade stack a ultime major | ⬚ SCHEDULED (post-impl) | D.10.2: solo a implementazione conclusa |

**EPIC 0 — Fundamentals: 7/7 ✅** (0.1 scaffold · 0.2 schema DB · 0.3 adapter Spotify · 0.4 UI import · 0.5 PWA · 0.6 i18n · 0.7 operations runbook). **EPIC 1 — Import core: 5/5 ✅** (1.1 YouTube Music · 1.2 Apple Music · 1.3 Last.fm + ListenBrainz · 1.4 dedup promozione post-enrichment · 1.5 scrobbling hub). Dettaglio per story in `docs/state/stories/` e `docs/18-DEV-LOG.md`.

> **Allineato al 2026-11-03** (Sessione 97, issue #241): la **3.2** (Ricordi + Share) è **implementata** — il feed ⑪, il ShareSheet ⑫, la card 1080×1350, il capitolo HTML autonomo e il tagging manuale (nome dell'era e nota sul ricordo), con la conservazione dei campi dell'utente al ricalcolo dell'analisi. La sezione Story 3.2 passa a **✅ DONE** e i suoi acceptance criteria sono spuntati; la riga della tabella «Stato di avanzamento» è allineata. La prossima story lavorabile è la **3.3** (Esplora + Analisi), poi **3.5**, **4.3**, **5.2**, **5.1**, **4.2**, **6.1**.
>
> **Allineato al 2026-11-03** (Sessione 94, doc-sync post-merge della PR #295): la **2.5** è **mergata in `main`** (issue #266, PR #295, merge `265fa50`) e le sue sezioni legacy sono allineate: `**Stato**:` da `⬚ TODO` a `✅ DONE`, i **7 acceptance criteria** spuntati, la riga della tabella «Stato di avanzamento» aggiornata e l'entry #15 della lista di priorità riscritta. Il **blocco NEXT-STEP del README** non indica più la 2.5: l'indicatore di avanzamento passa a **73%** (22 story su 30, effort 76%) e l'**EPIC 2** è **completo (5/5)**. La prossima story lavorabile era la **3.2** (Ricordi + Share), poi **3.3**, **3.5**, **4.3**, **5.2**, **5.1**, **4.2**, **6.1**.
>
> **Allineato al 2026-11-02** (Sessione 85, analisi competitiva verificata sul codice): il catalogo passa da 28 a **30 story** con **2.5** (collegamento del pipeline di analisi all'app) e **3.5** (anteprima/demo in onboarding); l'ordine di lavorazione diventa **2.5 → 4.3 → 3.2 → 3.3 → 3.5 → 5.2 → 5.1 → 4.2 → 6.1**; la **4.3** non dipende più dalla **4.2** e sale a **P0**; la **3.2** incorpora il **tagging manuale** e l'**export statico** del capitolo; la **3.3** richiede **insight in prosa**; la **5.1** richiede la **pagina in-app «Come trattiamo i tuoi dati»**. Motivazioni, evidenze e decisioni proposte: `docs/22-COMPETITIVE-POSITIONING.md` (D-22.1…D-22.7).
>
> **Allineato al 2026-10-30** (Sessione 67, follow-up post-merge): la **tranche geo sale al posto 13**, davanti alle 2.2/2.3, per allineare la lista di priorità al blocco NEXT-STEP del README. L'aggregatore ordina le story **migrate per id** (e non per la priorità di questa lista): con lo state file della 1.6 creato nella Sessione 67, il puntatore indicava «1.6» mentre questa lista e la prosa dell'INDEX indicavano «2.2/2.3» — due documenti, due risposte diverse sul prossimo lavoro. La scelta è del project owner: **geo prima**, e la lista è stata riallineata al puntatore (nessuna modifica al codice dell'aggregatore).
>
> **Aggiornato al 2026-10-30** (Sessione 67, issue #201: gli **atti del project owner** sono chiusi — la ratifica di `19-GEO-CONTEXT.md` (v1.0 🟢) e dell'ADR-0009 (v1.0 🟢) e l'applicazione della **licenza AGPL-3.0** (D-AF.2). Le tre story della tranche geo — **1.6** (fondazione geo), **4.4** (DB IP→città) e **3.4** (nastro contesto) — entrano nella roadmap con la specifica già ratificata; le story **2.2** e **2.3** ricevono il loro state file (la dipendenza `[DEP:2.1]` è soddisfatta dal merge della 2.1). Con i loro state file il blocco NEXT-STEP del README punta alla **prima story lavorabile** invece del fallback. Per il dettaglio cronologico vedi `docs/18-DEV-LOG.md`).
>
> **Aggiornato al 2026-10-30** (Sessione 64, issue #188: la 4.1 è **completata** — PR #197 merged `7458220` — e il suo `**Stato**:` passa a ✅ DONE; la riga dell'EPIC 4 torna a ⬚ TODO perché restano **4.2** (lookup MusicBrainz), **4.3** (artwork) e i generi. Con la 4.1 e la 2.1 completate il blocco NEXT-STEP del README ricade sul fallback "nessuna story non-done e non bloccata migrata": è la risposta **corretta**, non una regressione — le 2.2/2.3 dipendono dalla 2.1 (`[DEP:2.1]`) e non hanno uno state file. Per il dettaglio cronologico vedi `docs/18-DEV-LOG.md`).
>
> **Aggiornato al 2026-10-28** (Sessione 58, issue #173: la 1.5 rimossa dalla roadmap perché implementata e mergiata con la PR #176, e il suo `**Stato**:` allineato a ✅ — l'EPIC 1 è 5/5. Per il dettaglio cronologico vedi `docs/18-DEV-LOG.md`).
>
> **Aggiornato al 2026-10-27** (Sessione 54, issue #161: il conteggio dell'EPIC 1 era fermo a `2/5` dal 2026-10-22 — la 1.3 (PR #158, merge `7afbf03`) e la 1.4 (PR #162, merge `471a049`) erano state completate senza allineare questa riga legacy. Il drift è silenzioso: i blocchi aggregati sono corretti, questa riga no. Per il dettaglio cronologico vedi `docs/18-DEV-LOG.md`).
>
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
| 1.6.10 | Sessione 52 (2026-10-26, issue #155) | **Story 1.3 completata**: implementazione della issue #155 (adapter ListenBrainz file-only + adapter Last.fm ibrido API/file). Sezione Story 1.3 `**Stato**:` → ✅ COMPLETATA; **rimossa dalla tabella "roadmap delle story non ancora completate"** (la fonte di verità per le completate è il blocco aggregato, ADR-0008); `docs/state/stories/1.3-*` → `status: done`. Documenti allineati: `02-DATA-SCHEMA.md` §6.1 (tabella `settings`, schema Dexie v4) + §3.1 (i due campi additivi del contratto) + changelog 1.4; `03-ADAPTERS/lastfm.md` §3.1.0 (la chiave fra i due percorsi) + changelog 1.1; `03-ADAPTERS/listenbrainz.md` §3.1.3 (i due campi che il contratto non aveva) + changelog 1.1; `08-COPY-I18N.md` §2.12e (`settings.lastfm.*`) + changelog 0.4; `docs/18-DEV-LOG.md` §18; `docs/state/sessions/52-*` (nuova); `scripts/generate-bundle.ps1` `$files` (6 fixture + sessione 52); `docs/BUNDLE.md` rigenerato |
| 1.6.11 | Sessione 53 (2026-10-26, issue #160) | **Story 1.4 completata**: `rekey()` (promozione dedup post-enrichment) resa completa e testata. La funzione esisteva dalla Story 0.7 (PR #39) ma non soddisfava gli AC: ora è **transazionale** (MIG-1), a **sopravvivenza deterministica** (la track più vecchia), **riorienta** `library`/`playlistItems`/`features`, **unisce** `platformIds`/`generi`/finestra temporale, **normalizza** l'ISRC in maiuscole e delega i contatori a `recount()` (MIG-4). Sezione Story 1.4: `**Stato**:` → ✅ COMPLETATA; **rimossa dalla tabella "roadmap delle story non ancora completate"**. `docs/state/stories/1.4-dedup-promotion.md` (nuova). Documenti allineati: `05-ARCHITECTURE.md` §12.1/§12.2 (`rekey()` da "futuro" a "attivo") + changelog 1.2; `16-OPERATIONS.md` §2.3 (forma del report) + changelog 0.2; `02-DATA-SCHEMA.md` §5 (nota sul job) + changelog 1.5; `docs/INDEX.md` (righe `05`, `11`, `16`, `18-DEV-LOG`, "Prossimo passo tecnico"); `docs/18-DEV-LOG.md` §19 + changelog 1.9; `docs/state/sessions/53-story-1-4-rekey.md` (nuova); `docs/BUNDLE.md` rigenerato |
| 1.6.12 | Sessione 54 (2026-10-27, issue #161) | **Conteggio EPIC 1 allineato**: la riga di stato legacy dichiarava `EPIC 1 — Import core: 2/5 ✅` dal 2026-10-22, ma la 1.3 (PR #158, merge `7afbf03`) e la 1.4 (PR #162, merge `471a049`) erano state completate senza allineare la riga → `4/5 ✅` (1.1 YouTube Music · 1.2 Apple Music · 1.3 Last.fm + ListenBrainz · 1.4 dedup promozione post-enrichment). La fonte di verità per lo stato delle story resta il blocco aggregato `AGGREGATE-STORIES-*`; questa riga è una **copia di conteggio** legacy, ed è il tipo di duplicazione che l'issue #161 ha introdotto un gate per (prosa del README confrontata con il codice). Aggiornata anche la nota "Aggiornato al …" con la provenienza del drift |
| 1.6.13 | Sessione 55 (2026-10-27, issue #164) | **Spec della Story 1.5 scritta**: `docs/20-SCROBBLING-HUB.md` v0.1 (🟡 DRAFT). Risponde alle 5 decisioni richieste dall'issue (hub della prima tranche, semantica dell'invio, consenso per-hub, coda e idempotenza, collocazione del documento) e ne aggiunge una che l'issue non sapeva di dover chiedere: **la PWA non osserva la riproduzione di altre app**, quindi la prima tranche è uno specchio idempotente dello storico locale, non uno scrobbling live. Definiti il contratto `ScrobbleSink` (da ratificare via **ADR-0011**), la mappa `ScrobbleError` (separata da `AdapterError`, orientato al parsing), i vincoli di protocollo dei due hub verificati sulle doc ufficiali, 16 edge case, 15 codici i18n, 29 casi di test e 15 deliverable di implementazione. Sezione Story 1.5 allineata (`**Stato**:` con la premessa nuova, task con i rimandi ai §, AC con i cross-ref alla spec, `**Spec**:` e `**Issue**:`); riga roadmap aggiornata. La story resta `⬚ TODO`: non è implementabile finché la spec non è 🟢 APPROVED e ADR-0011 non è ratificato |
| 1.6.14 | Sessione 56 (2026-10-27, issue #168) | **ADR-0011 scritta**: `docs/13-ADR/0011-scrobble-sink.md` v0.1 (🟡 DRAFT) formalizza la decisione sul **contratto di scrittura** negli hub di scrobbling, che `05§4` (🟢 APPROVED) poteva recepire solo via ADR — lo stesso percorso di ADR-0010 sul lato della lettura. Decisione **A1**: l'interfaccia `ScrobbleSink` è **separata** da `PlatformAdapter` (che non cambia), con la stessa forma di `parseRemote?()`; scartate A2 (metodo `scrobble?()` su `PlatformAdapter`), A3 (nessuna astrazione), A4 (flag "write" su `RemoteSource`) e A5 (contratto bidirezionale unico). Vincoli **V1-V10**: separazione dal contratto di lettura, rate limiting per-hub **nel sink**, nessun segreto nel bundle, nessun backend, `AbortSignal`, `ScrobbleError` dedicato (`recoverable` = "si può ritentare"), `ScrobbleHubId` dedicato, payload chiuso per costruzione, protocollo ignoto al core, idempotenza locale write-ahead. `05-ARCHITECTURE.md` §4.2 aggiunta (v1.1 → **v1.3**, con la riga di changelog v1.2 della Sessione 53 riposizionata nella tabella: era stata appesa in cima al file). Sezione Story 1.5 allineata (`**Stato**:` con la dipendenza **soddisfatta nel contenuto**, AC della dipendenza, `**Spec**:` e `**Issue**:`), riga roadmap aggiornata. La story resta `⬚ TODO`: mancano le due **ratifiche** (spec v1.0 🟢 e ADR v1.0 🟢), atti del Boss in PR separate |
| 1.6.15 | Sessione 56 (2026-10-27, issue #168) | **ADR-0011 ratificata**: il merge della PR #170 (`8900c3b`) è la ratifica del Boss → `docs/13-ADR/0011-scrobble-sink.md` passa da 🟡 DRAFT v0.1 a **🟢 APPROVED v1.0**, **nessuna modifica di contenuto** (stesso pattern di ADR-0010, PR #152). La decisione A1 (`ScrobbleSink` separato da `PlatformAdapter`) e i vincoli V1-V10 diventano vincolanti: `05§4.2` è la loro sede e `05` header aggiornato. Allineati: `docs/INDEX.md` (riga `13-ADR/`, conteggio ADR APPROVED 8 → **9**, DRAFT solo 0009, riga `11`, "Prossimo step tecnico"); `docs/11-BACKLOG.md` (Story 1.5 `**Stato**:` con la dipendenza **soddisfatta**, AC della dipendenza `[x]`, `**Spec**:` e `**Issue**:`; riga roadmap; header v1.6.15); `docs/18-DEV-LOG.md` §22 (ratifica) + changelog 2.3; `docs/state/sessions/56-*.md` (frontmatter: `state: 🟢`, `merged: true`, merge commit `8900c3b`); `docs/state/_index.md`; `docs/20-SCROBBLING-HUB.md` §18 punto 1 chiuso (restano i punti 2-5). La story resta `⬚ TODO`: manca solo la **ratifica della spec** (punti aperti 2-5 di `20§18`) |
| 1.6.16 | Sessione 57 (2026-10-27, issue #172) | **Spec della Story 1.5 ratificata**: `docs/20-SCROBBLING-HUB.md` passa da 🟡 DRAFT v0.2 a **🟢 APPROVED v1.0**, con le **quattro decisioni aperte** (`20§18` punti 2-5) chiuse come proposte in **D-SH.11…D-SH.14** (§2.1): md5 in JS puro (nessuna dipendenza nuova), finestra di candidatura a 7 giorni + azione esplicita per tutta la cronologia, durata ignota → soglia dei 4 minuti con fiducia nella fonte per gli eventi importati da un hub, modalità del proxy dichiarata dall'utente (`solo lettura` / `lettura + scrittura`). La ratifica **modifica regole normative** (T-SH.3, T-SH.4, E.SH.10, E.SH.11, la finestra, la modalità proxy): a differenza della promozione dell'ADR-0011, qui non è una promozione senza contenuto. **Allineati i documenti che la spec tocca** (atto dichiarato dall'ADR-0011 §"Documenti da aggiornare"): `02-DATA-SCHEMA.md` §3.8 (`ScrobbleHubId`) e §6.2 (`scrobbleOutbox`, schema Dexie v5), `09-PRIVACY-SECURITY.md` §3.3 e §4 (payload chiuso per costruzione, inventario), `08-COPY-I18N.md` §1 e §2.16 (i 15 codici `scrobble.*`), `03-ADAPTERS/lastfm.md` §4 (E.LF.21) e §10 (proxy in scrittura), `03-ADAPTERS/listenbrainz.md` D-LB.5 e §3.4, `01-PLATFORMS.md` §3.7-3.9. Difetti corretti: `02-DATA-SCHEMA.md` aveva la riga di changelog v1.5 **appesa in cima al file** (come `05-ARCHITECTURE.md` nella Sessione 56) e l'header fermo a v1.3; cinque documenti dichiaravano nell'header una versione più vecchia del proprio changelog — header allineati ovunque. **Issue di implementazione aperta: #173** (`agent-ready`, `size:L`). La story resta `⬚ TODO` fino al merge della PR |
| 1.6.17 | Sessione 58 (2026-10-28, issue #173) | **Story 1.5 implementata**: la sezione Story passa a ✅ DONE e l'issue #173 (implementazione, `agent-ready`, `size:L`) è chiusa con `status:done` al merge della PR #176. Consegnati i 15 deliverable di `20§16`: contratto `ScrobbleSink` (`packages/core/src/adapters/scrobble/types.ts`), registry dei sink, sink Last.fm (firma `api_sig` md5 in JS puro, batch 50, POST via proxy, mappa errori) e ListenBrainz (`POST /1/submit-listens`, `listen_type: import`, `User-Agent`, rate limit 1 req/s), tabella `scrobbleOutbox` (schema Dexie **v5**, PK `hub\|eventKey`, write-ahead, backoff con jitter), filtro di eleggibilità `20§5` con la regola di maturità **D-SH.13**, `parseRemote?()` incrementale su `/1/user/{u}/listens` con cursore persistito, percorso web auth Last.fm (token → session key), pannello UI (selettore per-hub, modalità del proxy, vista della coda) e namespace i18n `scrobble` (15 codici). **31 casi di test** della spec `20§14.3` coperti (267 test in `@ls/core`, 91 in `@ls/web`). **AC-SH.11 dichiarata parzialmente soddisfatta**: la parte MBID → DEDUP-2 è coperta dal pipeline esistente, la parte `track.genres` via lookup MusicBrainz dipende dall'enrichment (EPIC 4, non implementato) e va aperta come issue dedicata. La riga della 1.5 è rimossa dalla roadmap delle story non completate e il conteggio legacy dell'EPIC 1 passa a **5/5** |
| 1.6.18 | Sessione 59 (2026-10-28, issue #178) | **Spec dell'analisi ratificata**: `docs/04-ANALYSIS-ALGORITHMS.md` passa da 🟡 DRAFT v0.2 a **🟢 APPROVED v1.0**, con le cinque decisioni aperte chiuse come proposte (**D-A.1…D-A.5**, §11): la **Story 2.1** (mood tracker) **aspetta le audio features dell'EPIC 4.1** (senza valence/energy non produce insight: consegnarla sarebbe un falso verde), la **Story 2.4** (Memory Engine) è **implementabile subito**; `return` e `seasonal` sono specificati in §7.2 (D-A.2), `first_time` passa a **5 brani distinti** (D-A.3), il `text` del ricordo è una **stringa resa** con i template i18n già dichiarati in `08§2.15` (D-A.4), e l'orchestratore è **minimale ed estensibile** (D-A.5, §8.1). Allineati: `08-COPY-I18N.md` §2.15 (i template `memory.*` dichiarati vincolanti + la chiave `memory.milestone.artists`), le sezioni Story 2.1 e 2.4 e la lista di priorità degli agenti. **Issue di implementazione #179** aperta per la 2.4 (`agent-ready`, `size:M`) |
| 1.6.19 | Sessione 60 (2026-10-28, issue #182) | **Il blocco NEXT-STEP indica solo story lavorabili**: con la Story 2.1 in stato `blocked` (dipende dalle audio features dell'EPIC 4.1, decisione D-A.1) il puntatore del README era finito su una story non implementabile, mentre la **2.4** era libera. `scripts/aggregate-state.ps1` esclude ora `done`, `blocked` e `wontdo` (restano `todo`, `in_progress`, `in_review`: sono in lavorazione, non bloccate), e il messaggio di fallback dice "non-done **e non bloccate**". Il fix **non** committa i blocchi aggregati (ADR-0008): li rigenera `auto-state-aggregate` post-merge, perché la PR tocca lo script. Test: `scripts/test-aggregate-determinism.sh` da 34 a **37 assert** (T10e, T10f nuovi, verificati in entrambe le direzioni — senza il fix falliscono). Allineati `AGENTS.md` (v1.28), `docs/state/_index.md` (i valori di `status` nello schema), `docs/12-DEVOPS.md` (§9.8g) |
| 1.6.20 | Sessione 61 (2026-10-28, issue #179) | **Story 2.4 implementata** (Memory Engine, PR #185): il pacchetto `packages/core/src/analysis/` è nato — i **5 generatori** (`on_this_day`, `first_time`, `milestone`, `return`, `seasonal`), il **ranking** `baseScore × relevance × recency` (`04§7.4`), la **persistenza** degli insight `memory` con `derivedVersion` calcolata dai parametri (`04§9`) e l'insight vecchio `stale` al cambio dei parametri (MIG-3), l'**orchestratore minimale** (`04§8.1`, D-A.5) e il **testo reso** dal resolver i18n (D-A.4: nessuna stringa italiana nel core, i template `insight.memory.*` vivono nei locale `it`/`en` dell'app). La sezione Story 2.4 passa a 👀 **IN REVIEW** e il suo terzo AC è verificato. **27 test** nuovi in `@ls/core` + **5** in `@ls/web`. Scelte dichiarate (D.61.1…D.61.7): il config object versiona **anche** `milestoneHours` e `milestoneArtists` (le tre famiglie di milestone del trigger `04§7.2`), `on_this_day` confronta anno+mese+giorno, la rilevanza ordinata vive in `Insight.confidence` (il payload `02§4` è chiuso), l'id dell'insight è deterministico (ricalcolo idempotente), il confine del giorno è UTC. La lista di priorità degli agenti mette la **spec dell'EPIC 4.1** prima della 2.1: senza le audio features il mood tracker non produce insight (D-A.1) |
| 1.6.21 | Sessione 61 (2026-10-28, issue #179) | **Story 2.4 completata** (Memory Engine, PR #185, merge `40ad0b7`): la sezione Story passa a ✅ DONE. Il blocco NEXT-STEP del README ricade sul fallback "nessuna story non-done e non bloccata migrata" — **risposta corretta**, non una regressione: la 2.1 resta bloccata dalle audio features dell'EPIC 4.1 (D-A.1) e 2.2/2.3 dipendono dalla 2.1 (`[DEP:2.1]`), quindi **non esiste** una story implementabile finché l'EPIC 4.1 non è specificata (issue #180). Per questo la lista di priorità degli agenti mette la **spec dell'EPIC 4.1 al primo posto** e dichiara la catena 4.1 → 2.1 → 2.2/2.3: il puntatore è tornato veritiero invece di indicare un vicolo cieco (lesson della issue #182). Non si è creato uno state file per la 2.2: il blocco avrebbe indicato una story bloccata a monte — lo stesso difetto che la issue #182 ha chiuso |
| 1.6.22 | Sessione 62 (2026-10-28, issue #187) | **Spec dell'EPIC 4.1 ratificata**: `docs/21-AUDIO-FEATURES.md` passa da 🟡 DRAFT v0.1 a **🟢 APPROVED v1.0** (ratificata dalla PR #190 `b1dd83e`, 2026-10-29T16:09:16Z): le **nove decisioni** (D-AF.1…D-AF.9) sono chiuse come proposte e ratificate — la fonte dell'audio è il preview di 30 s dell'**iTunes Search API** (D-AF.1), la licenza dell'app passa ad **AGPL-3.0** per `essentia.js` (D-AF.2: atto del Boss sul file `LICENSE`, non applicato qui), il modello valence/energy è **DEAM** (D-AF.3), l'euristico **non** alimenta il mood tracker (D-AF.4), il codice vive in `packages/core/src/enrichment/` **senza React** (D-AF.5), il rate limit di AcousticBrainz è **letto dagli header** (D-AF.6), trigger e budget restano quelli di `05§6.1` (D-AF.7), il `source` delle feature derivate resta `acousticbrainz` (D-AF.8) e la CSP ha **due host in più** (D-AF.9). La sezione **Story 4.1** passa a **implementabile**: `**Stato**:` 🟢, i **4 AC** originali (di cui uno ambiguo) sostituiti dagli **11 AC** riscritti di `21§16`, `**Spec**:` aggiornata. Issue di implementazione **#188**: `needs-spec` → **`agent-ready`**. Allineati i documenti che la spec tocca: `05` (v1.4), `09` (v0.6), `10` (v1.1), `12` (v1.0), `14` (v1.1), `08` (v0.8: il namespace `enrichment.*` in §2.17) e il nuovo `docs/state/stories/4.1-audio-features.md` (`status: todo`). La **lista di priorità** degli agenti mette la **4.1** al primo posto dell'EPIC 2 e la 2.1 dopo la 4.1 *implementata*: la catena 4.1 → 2.1 → 2.2/2.3 riparte |
| 1.6.23 | Sessione 63 (2026-10-29, issue #180) | **Story 2.1 implementata** (Mood Tracker, PR #192): il motore in `packages/core/src/analysis/mood/` calcola il mood dominante di giorno, settimana e mese dalla valence/energy media ponderata per durata (`04§3.2`…`04§3.6`) e lo persiste come insight `mood_day`/`mood_week`/`mood_month` con `derivedVersion` (`04§9`); il plug-in `createMoodGenerator` entra nell'orchestratore (`04§8.1`) e il ricalcolo batch (`replaceInsightsOfType`) rimuove gli insight `stale` (MIG-3). La sezione Story 2.1 passa da ⛔ bloccata a 👀 **IN REVIEW** e i suoi tre AC sono verificati. **L'ordine è stato invertito dal project owner** (2026-10-29): la D-A.1 diceva "la 2.1 aspetta la 4.1", ma il codice del mood tracker era già interamente specificato — a mancare era il **riempimento** della tabella `features`, che resta alla Story 4.1 (#188). Le due story sono quindi parallele: **4.1 (dati) → 2.1 (letture)**. Scelte dichiarate (D.63.1…D.63.12): il **filtro per sorgente** delle feature vive nel layer di analisi e lascia fuori l'euristico (`21§12`, D-AF.4), `weekStartDay` (lunedì) è un parametro **versionato**, il fallback **mood-by-genre** di `04§1.4` **non** è implementato (la mappa non è ratificata: inventarla sarebbe il segnale inventato che D-A.1 esclude), un ascolto è utilizzabile solo se ha **valence ed energy**, `Insight.confidence` è la **copertura dei dati** (il payload `02§4` è chiuso) e l'id dell'insight è **deterministico**. **51 test** nuovi in `@ls/core` (classificazione, periodi, persistenza, fixture di scenario). La **lista di priorità** degli agenti mette la 2.1 come **implementata** |
| 1.6.24 | Sessione 63 (2026-10-29, issue #180) | **Story 2.1 completata** (Mood Tracker, PR #192 merged, merge commit `d018a26`): la sezione Story passa a ✅ **DONE** e `docs/state/stories/2.1-mood-tracker.md` ha `status: done` con `merged_commit` e `merged_date`. La PR è stata merged in `main` il 2026-10-29T16:49:33Z con CI verde (`quality`, `cleanup`, `apply-status-done`, GitGuardian); l'issue **#180** è chiusa con `status:done` e le label `agent-ready`/`in-progress`/`status:in-review` rimosse da `auto-status-done`, che ha pubblicato anche il commento `release:`. Automazioni post-merge: `auto-branch-cleanup` (branch remoto eliminato), `auto-state-aggregate` (`b10cf70`) e `auto-bundle` (`e64504d`). La pulizia git locale (worktree `ls-180-mood-tracker`, branch `feat/180-mood-tracker`) è stata fatta con `scripts/post-merge.ps1`: `git worktree remove` ha di nuovo fallito con "Result too large" (path lunghi con `node_modules` su Windows) e la rimozione è passata da `rd /s /q` con prefisso `\\?\`; `post-merge.ps1 -Check` esce 0. Aperte dal lavoro due issue: **#193** (la mappa `genre → valence/energy` del fallback mood-by-genre di `04§1.4`, `needs-spec`) e **#194** (l'esempio numerico di `04§3.5` che non torna, `docs`: la correzione di un documento APPROVED è un atto del project owner). La **lista di priorità** degli agenti mette la 2.1 come **completata** |
| 1.6.25 | Sessione 64 (2026-10-30, issue #188) | **Story 4.1 implementata** (Pipeline audio features): il pacchetto `packages/core/src/enrichment/` è nato — **senza React** (D-AF.5), con il contratto `AudioFeatureProvider` (`fetch(track, context)`: il `Track` di `02§3.3` non porta il nome dell'artista, e la ricerca del preview lo richiede, D-AF.1), la **cascata** `cache → Essentia.js → AcousticBrainz → euristico` con i salti dichiarati (`21§5.1`) e la regola "l'import non attende mai la rete", la **normalizzazione** DEAM `[1,9] → [0,1]` con clamp e warning (E8, `10§7`), la **derivazione** mood → valence/energy di AcousticBrainz con i pesi dichiarati (`21§7.3`, D-AF.8), il **fallback euristico** che stima tempo/ballabilità/acustica dal genere e **non** stima valence/energy (`21§8.1`), i **limiter** (MusicBrainz 1 req/s a intervallo fisso, AcousticBrainz **dagli header** `X-RateLimit-*` senza costanti, D-AF.6), la **coda** con i tre trigger, il budget di 5 min/giorno, la concurrency 1 e l'interrompibilità (`21§5.2`, D-AF.7), lo **stoccaggio** (TTL 90 giorni per AB, `schemaVersion`, LRU a 50.000 righe) e il subpath `@ls/core/enrichment`. Tutte le dipendenze esterne sono **porte iniettate** (HTTP, clock, sleep, storage, policy): i **142 test** nuovi in `@ls/core` (unit, integrazione, property-based con PRNG seeded, scenari) non chiamano mai la rete (`10§8`). La **CSP** dichiarata in `12§2.1` è applicata al bundle (`apps/web/src/security/csp.ts` + header Vite + tag `<meta>`) e le **8 chiavi** `enrichment.*` (`08§2.17`) sono materializzate in `it`/`en` (15 test in `@ls/web`). **Contraddizione dichiarata**: D-AF.1 impone la ricerca `GET https://itunes.apple.com/search`, ma D-AF.9 elenca in `connect-src` solo i due host che **non** sono quello della ricerca → la CSP applicata include il terzo host e il conflitto è segnalato all'issue **#196** (`needs-spec`). Fuori perimetro e dichiarato: la UI (Story 3.x), il lookup MusicBrainz (Story 4.2, di cui è consegnato il limiter) e il cambio di licenza AGPL-3.0 (D-AF.2, atto del Boss) |
| 1.6.26 | Sessione 64 (2026-10-30, issue #188) | **Story 4.1 completata** (Pipeline audio features, PR #197 merged, merge commit `7458220`): la sezione Story passa a ✅ **DONE** e `docs/state/stories/4.1-audio-features.md` ha `status: done` con `merged_commit` e `merged_date`; `docs/state/sessions/64-audio-features-pipeline.md` ha `state: 🟢`, `merged: true` e la sezione "Esito post-merge". La PR è stata merged in `main` il 2026-10-30T11:24:49Z con CI verde (22 step del job `quality`); l'issue **#188** è chiusa con `status:done` e le label `agent-ready`/`in-progress`/`status:in-review` rimosse da `auto-status-done`, che ha pubblicato anche il commento `release:`. Automazioni post-merge: `auto-branch-cleanup` (branch remoto eliminato), `auto-state-aggregate` (`9c3a13f`) e `auto-bundle` (`1062c04`). La pulizia git locale (worktree `ls-188-feat-enrichment-pipeline-audio-features`, branch `feat/188-feat-enrichment-pipeline-audio-features`) è stata fatta con `scripts/post-merge.ps1`: `git worktree remove` ha di nuovo fallito con "Result too large" (path lunghi con `node_modules` su Windows) e la rimozione è passata da `rd /s /q` con prefisso `\\?\`; `post-merge.ps1 -Check` esce 0. La riga dell'EPIC 4 nella roadmap torna a ⬚ TODO (restano 4.2, 4.3 e i generi) e il blocco NEXT-STEP del README ricade sul fallback "nessuna story non-done e non bloccata migrata" — **risposta corretta**, non una regressione: le 2.2/2.3 dipendono dalla 2.1 (`[DEP:2.1]`) e non hanno uno state file. Aperta dal lavoro l'issue **#196** (`needs-spec`): la contraddizione fra D-AF.1 e D-AF.9 sulla CSP. La **lista di priorità** degli agenti mette la 4.1 e la 2.1 come **completate** |
| 1.6.27 | Sessione 66 (2026-10-30, issue #196) | **Ratifica del terzo host della CSP**: `docs/21-AUDIO-FEATURES.md` passa a **v1.1 🟢 APPROVED** con **D-AF.9 emendata** — `connect-src` ammette anche `https://itunes.apple.com`, l'host che **risponde** alla ricerca del preview. La v1.0 elencava i due host che **non** sono quello della ricerca (l'API di AcousticBrainz e il **CDN** dei file audio): la CSP applicata bloccava `GET https://itunes.apple.com/search` e la pipeline degradava **sempre** ad AcousticBrainz/euristico (Essentia mai chiamabile, `valence`/`energy` mai misurate, mood tracker senza dati — D.A.1). Il project owner ha ratificato l'opzione **A** (confermare il terzo host) fra le due proposte dall'issue #196: l'opzione B (rivedere D-AF.1) avrebbe lasciato la pipeline senza provider acustico. Allineati: l'AC della Story 4.1 (i **tre** host dichiarati), `12-DEVOPS.md` (v1.1), `docs/INDEX.md` (le righe `12` e `21`, il "Prossimo passo tecnico"), `docs/state/stories/4.1-audio-features.md` (AC e limiti dichiarati) e i commenti del codice applicato (`apps/web/src/security/`). **La CSP applicata al bundle non cambia**: l'host della ricerca era già in `connect-src` dal merge della PR #197 — la ratifica allinea la **dichiarazione** al codice |
| 1.6.29 | Sessione 68 (2026-10-31, issue #205) | **§35 — esito post-merge della Story 1.6**: la PR #209 è **merged** in `main` il 2026-10-31T08:40:45Z (merge commit `68c27e5`), CI verde (job `quality`: lint, typecheck, test, build e i gate su bundle, aggregator, workflow e README; GitGuardian) → l'issue #205 è chiusa con `status:done` e il commento `release:` è automatico (`release: kilo-HP-ELITEBOOK-q7v2 - PR #209 merged (68c27e5…)`). Automazioni post-merge: `auto-status-done`, `auto-branch-cleanup`, `auto-state-aggregate`, `auto-bundle`. La pulizia git locale è passata da `scripts/post-merge.ps1`: `git worktree remove` ha di nuovo fallito con **Result too large** (path lunghi con `node_modules` su Windows) e la rimozione è avvenuta con `rd /s /q` e prefisso `\\?\` — il fallimento noto, non una regressione; i passi restanti sono passati (`main` allineato a `origin/main`, merge verificato via `gh`, branch remoto già assente, branch locale eliminato con `git branch -d`, prune + audit `post-merge.ps1 -Check` a 0). La story 1.6 passa a ✅ **DONE** con `merged_commit` e `merged_date` nel frontmatter; la riga dell'EPIC geo nella roadmap torna a ⬚ TODO (restano **4.4** e **3.4**); il blocco NEXT-STEP del README ricade sulla **4.4**, la prima story lavorabile della tranche |
| 1.6.28 | Sessione 68 (2026-10-31, issue #205) | **Story 1.6 implementata** (fondazione geo e contesto di ascolto): il delta su `02-DATA-SCHEMA.md` passa a **v1.7** (i tre campi derivati `city`/`citySource`/`cityConfidence` su `ListenEvent`, l'entità derivata `ContextPeriod` con la tassonomia vincolante `CONTEXT_KINDS`, i toggle `retainCountry` (**default true**: il paese è derivato e non identificativo — decisione del project owner sull'issue #108), `retainCity`/`retainDeviceDetail` (default false) e `retainDeviceType`/`deriveContext` (default true), la tabella `contexts` nello **schema Dexie v6** con migrazione non distruttiva e **MIG-5**: il ricalcolo del contesto è esplicito e non azzera i campi già persistiti). Il **classificatore L1** vive in `packages/core/src/context/` (regole R1..R7 nell'ordine dichiarato, soglia 0.5, `derivedVersion` dai parametri, slot = giorno locale × dispositivo, paese di riferimento = moda su 90gg con ≥30 eventi) con la persistenza dei periodi (`recompute()`, verdetto utente con `userLabel` sopravvive al ricalcolo) e il **fixture di scenario geo** (`fixtures/scenarios/geo-context.json`, generato da `scripts/generate-fixtures.mjs geo`). **39 test** nuovi in `@ls/core`. Scelte dichiarate (`docs/state/stories/1.6-geo-foundation.md`): `away` come complemento di R1, R4 vincolata alla durata delle sessioni (25 minuti, la soglia di R6) perché uno spostamento ricorrente non venga classificato `home`, il viaggio riconosciuto sull'intero *run* di giorni esteri, il modulo in `context/` (il layer `analysis` è puro e non ha dipendenze dal DB), il fuso come dato in `settings` (`app.timezone`). Correzione di numerazione: l'AC citava «E22», la spec `19` dichiara **E19** |
| 1.6.30 | Sessione 69 (2026-10-31, issue #211) | **Story 2.2 implementata** (Era Detector): il motore in `packages/core/src/analysis/era/` — firme settimanali (distribuzione dei generi, top artist, valence/energy medie, quota notturna, tasso di ripetizione), similarità (cosine + Jaccard + distanza normalizzata), **change point detection** (nessun clustering non supervisionato, `04§5`), costruzione delle ere e filtro `minEraDays`; il mood dominante dell’era è classificato dal **classificatore del mood tracker** (D.69.2); la persistenza sostituisce **l’insieme** delle ere (`replaceAllInsightsOfType`, D.69.8); il plug-in `createEraGenerator` dell’orchestratore (`04§8.1`) e il **fixture di scenario** `fixtures/scenarios/era-shift.json` (confine dichiarato al giorno 56). **37 test** nuovi in `@ls/core`. Sezione Story 2.2: `**Stato**:` ✅ DONE e i **4 AC** spuntati; la riga roadmap «2-3» allineata (restano 2.3 e 3.x); la lista di priorità aggiornata (il blocco NEXT-STEP ricade sulla **2.3**). `docs/04-ANALYSIS-ALGORITHMS.md` → **v1.2** (`§8.1`), `docs/08-COPY-I18N.md` → **v0.10** (namespace `insight.era.*`), `docs/10-TESTING.md` → **v1.2** (§3.3) |
| 1.6.31 | Sessione 70 (2026-10-31, issue #214) | **Story 2.3 implementata** (Event Detector): il motore in `packages/core/src/analysis/event/` — metriche giornaliere (volume in ore, valence/energy medie ponderate, diversità, artisti nuovi), detector a **z-score** su griglia settimanale (baseline 60gg, finestra 14gg, soglia 2.0), detector a **quota** per `spike_artist`/`spike_genre` (dominanza + rapporto 2× sulla baseline), detector specialistici per `silence` ed `exploration`, dedupe per tipo e per soggetto; la persistenza sostituisce **l’insieme** degli eventi (`replaceAllInsightsOfType`); il plug-in `createEventGenerator` dell’orchestratore (`04§8.1`) e il **fixture di scenario** `fixtures/scenarios/listening-spike.json` (81 giorni di baseline + 14 di picco, il picco dichiarato al giorno 81). **Nessun segnale inventato** (D-A.1): senza feature misurate o manuali non c’è alcun evento basato sulla valence. Sezione Story 2.3: `**Stato**:` ✅ DONE e i **3 AC** spuntati; la riga roadmap «2-3» allineata (l’EPIC 2 ha ora mood, ere, eventi e ricordi); la lista di priorità aggiornata (il blocco NEXT-STEP ricade sulla tranche **geo**, 4.4 e 3.4). `docs/04-ANALYSIS-ALGORITHMS.md` → **v1.3** (`§6.8` nuova, `§8.1`, `§9`), `docs/08-COPY-I18N.md` → **v0.11** (`insight.event.spike_genre`), `docs/10-TESTING.md` → **v1.2** (§3.3) |
| 1.6.34 | Sessione 85 (2026-11-02, analisi competitiva) | **Posizionamento competitivo verificato sul codice** e riflesso nel backlog. Le story **2.5** (collegamento del pipeline di analisi all'app) e **3.5** (anteprima/demo in onboarding) entrano nel catalogo: 28 → **30 story**. La verifica ha rilevato che i quattro motori di analisi dell'EPIC 2 **non sono mai eseguiti dall'app** (la Home legge gli insight che nessuno scrive) e che l'artwork **non esiste** nel repository (`artworkUrl` sempre `null`): da qui l'ordine ricalcolato **2.5 → 4.3 → 3.2 → 3.3 → 3.5 → 5.2 → 5.1 → 4.2 → 6.1**. La **4.3** perde il vincolo `[DEP:4.2]` e sale a **P0** (D-22.4); la **3.2** incorpora l'export statico del capitolo e il **tagging manuale** (D-22.5); la **3.3** richiede **insight in prosa**; la **5.1** richiede la **pagina in-app «Come trattiamo i tuoi dati»** (D-22.7). Le decisioni proposte e le evidenze sono in `docs/22-COMPETITIVE-POSITIONING.md` (D-22.1…D-22.7) |



| 1.6.36 | Sessione 97 (2026-11-03, issue #241) | **Story 3.2 implementata** (Ricordi + Share): la schermata ⑪ **Ricordi** (feed a pagine di 10 con infinite scroll, `dismissed` esclusi dal feed ma **presenti** nel database, ordinamento per `Insight.confidence`) e il foglio ⑫ **ShareSheet** (dialog accessibile con focus trap e stati `generating`/`ready`/`error`); la card **1080×1350** disegnata a mano su canvas e il **capitolo HTML autonomo** (export statico alternativo: nessuno script, nessuno stile esterno); le azioni di condivisione con **fallback** (Web Share API → download, clipboard → download); il **tagging manuale** (nome e parole chiave dell'era, nota libera del ricordo) con la **conservazione dei campi dell'utente al ricalcolo** (`Insight.userNote` e `Insight.status` riportati dagli insight esistenti a quelli nuovi). **37 test** nuovi. Sezione Story 3.2: `**Stato**:` ✅ DONE e gli **8 AC** spuntati; la riga roadmap «2-3» allineata (l'EPIC 3 ha ora tre schermate); la lista di priorità aggiornata (il blocco NEXT-STEP ricade sulla **3.3**). Documenti allineati: `docs/06-UX-FLOWS-STATES.md` → **v0.5** (§2.11, §2.12), `docs/07-UI-SPEC.md` → **v0.2** (§2.2, §2.10, §2.10b), `docs/08-COPY-I18N.md` → **v0.14** (`memories.*`, `share.*`, `nav.memories`), `docs/18-DEV-LOG.md` → **v2.30** (§53); `docs/state/stories/3.2-ricordi-share.md` e `docs/state/sessions/97-ricordi-share.md` (nuovi) |


<!-- AGGREGATE-STORIES-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` leggendo `docs/state/stories/*.md`.
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.
> Aggregator version: 1 (ADR-0008, S25).

| Story | Stato | PR | Merge commit | Area |
|-------|-------|----|--------------|------|
| 0.1 - Setup monorepo e toolchain | done | #2 | `c0fb0a4` | devops |
| 0.2 - Schema DB e layer Dexie | done | #4 | `fa09b0617b273a99e303df41de9cbea2db381237` | db |
| 0.3 - Adapter Spotify base | done | #28 | `3dc9654c8ce037035176732ca11e2f5e86f27735` | adapter |
| 0.4 - UI import (onboarding) | done | #71 | `0a8e83f2aaf90cb61862e0737417eb7ec8b63881` | ui |
| 0.5 - PWA e service worker | done | #19 | `0ebe8dad10e348a63a04c83d9b1484767e4a0013` | devops |
| 0.6 - Setup i18n | done | #22 | `5235c88` | ui |
| 0.7 - Operations runbook + manutenzione DB | done | #64 | `b44420beb9ec95ea16ec47305ac4873f41b1a15b` | devops |
| 1.1 - Adapter YouTube Music | done | #130 | `43f75291e5184144dc9d974c5003cd6ae6a7583e` | adapter |
| 1.2 - Adapter Apple Music | done | #139 | `2e1a4cc921ad7b5d9cd74a3d3ccb667445578c8d` | adapter |
| 1.3 - Adapter Last.fm + ListenBrainz | done | #158 | `7afbf0337b94b5bfca2fb1eb9751320f84b0cbf4` | adapter |
| 1.4 - Dedup promozione post-enrichment | done | #162 | `471a049a1fc5c8605ca264b0c20b1ecd201ca649` | db |
| 1.5 - Scrobbling hub (invio scrobble, sync continua, toggle) | done | #176 | `bfb5946bd547fed46fb32be2638e1f5785f4b579` | adapter |
| 1.6 - Fondazione geo e contesto di ascolto | done | #209 | `68c27e5` | db |
| 2.1 - Mood Tracker giornaliero | done | #192 | `d018a26` | analysis |
| 2.2 - Era Detector | done | #212 | `3294aa4` | analysis |
| 2.3 - Event Detector | done | #215 | `5149b2c` | analysis |
| 2.4 - Memory Engine | done | #185 | `40ad0b75be5efb70af17cce82531b523970059ea` | analysis |
| 2.5 - Collegamento del pipeline di analisi all'app | done | #295 | `265fa50f279a7dbec70507388a3a7ffe405acc14` | analysis |
| 3.1 - Home + Timeline | done | #234 | `815ce171f9bfd70133d0a788d6e15f717624a290` | ui |
| 3.2 - Ricordi + Share | done | #301 | `22cf5916140c5869ea296bc778e6cb094ed71037` | ui |
| 3.3 - Esplora + Analisi | done | #320 | `d082c0046fe4e30fe99436990ce96530f9ee8ef2` | ui |
| 3.4 - Nastro contesto (Timeline) | done | #232 | `bc959d3a932ab2d4210ae0f243b59f598d9cbc8d` | ui |
| 3.5 - Anteprima del risultato in onboarding (modalità demo) | done | #322 | `4ceacc1f30df485ef1894d59059e39eeea32e2e2` | ui |
| 4.1 - Pipeline audio features | done | #197 | `7458220` | enrichment |
| 4.3 - Artwork enrichment | todo | - | - | enrichment |
| 4.4 - DB IP→città (geolocalizzazione locale) | done | #222 | `beaefba677f9dbaf0ec9891c3e70516015a1adcf` | enrichment |
| 5.1 - Privacy spec finale | todo | - | - | privacy |
| 5.2 - Export e purge | todo | - | - | privacy |

<!-- AGGREGATE-STORIES-END -->
