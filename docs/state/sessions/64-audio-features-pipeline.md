---
number: 64
title: "Story 4.1 — Pipeline audio features: provider, privacy, stoccaggio, costi (issue #188)"
date: 2026-10-30
state: 🟢
merged: true
merged_commit: 7458220
merged_date: 2026-10-30
branch: feat/188-feat-enrichment-pipeline-audio-features
pr: 197
claim: kilo-HP-EliteBook-fc1d
cross_refs: [188, 187, 180]
tags: [enrichment, phase-2]
---

# Sessione 64 — Story 4.1: la pipeline delle audio features (issue #188)

## Sintesi

Prima implementazione dell'**EPIC 4.1**: il pacchetto
`packages/core/src/enrichment/` non esisteva, e ora c'è. La pipeline
trasforma "un brano di cui l'utente conosce solo il nome" in "un brano di cui
l'utente conosce anche l'intensità, la positività, il BPM, la tonalità", con la
cascata dichiarata in `05-ARCHITECTURE.md` §6: **cache → Essentia.js →
AcousticBrainz → euristico**.

Il codice è **puro**: nessuna dipendenza da React, nessuna chiamata di rete
implicita, nessun accesso diretto al DB. Client HTTP, orologio, attesa,
limiter, storage e politica del toggle sono **porte iniettate** (D-AF.5): i 125
test della pipeline non toccano mai la rete (`10-TESTING.md` §8).

## Trigger

Issue **#188** (`agent-ready`, `size:L`, `area:enrichment`), aperta nella
Sessione 62 dopo la ratifica della spec (issue #187, PR #190 `b1dd83e`).
Claim `kilo-HP-EliteBook-fc1d` (unico claim, riverificato). Worktree
`ls-188-feat-enrichment-pipeline-audio-features`.

## Cosa è stato consegnato

| Deliverable | Dove |
|-------------|------|
| Il contratto `AudioFeatureProvider` e le porte (storage, HTTP, clock, sleep, limiter, policy) | `packages/core/src/enrichment/types.ts` |
| La cascata (cache → Essentia → AB → euristico) con salti, clamp, TTL e regole di scrittura | `packages/core/src/enrichment/cascade.ts` |
| La normalizzazione e la mappatura dei campi (DEAM `[1,9] → [0,1]`, mood → valence/energy, origini dichiarate) | `packages/core/src/enrichment/mapping.ts` |
| Il provider Essentia.js (WASM lazy, DEAM) | `packages/core/src/enrichment/essentia.ts` |
| Il provider AcousticBrainz (HTTP, rate limit dagli header) | `packages/core/src/enrichment/acousticbrainz.ts` |
| Il resolver del preview iTunes (match esatto, E2) | `packages/core/src/enrichment/itunes.ts` |
| Il fallback euristico (tempo/ballabilità/acustica dal genere) | `packages/core/src/enrichment/heuristic.ts` |
| I limiter (intervallo fisso per MusicBrainz/iTunes, a header per AB) | `packages/core/src/enrichment/rateLimiter.ts` |
| La coda e i trigger (on-import, on-demand, scheduled; budget 5 min/giorno; concurrency 1) | `packages/core/src/enrichment/queue.ts` |
| Lo stoccaggio (negozio Dexie, negozio in memoria, TTL, LRU) | `packages/core/src/enrichment/storage.ts` |
| Il subpath `@ls/core/enrichment` e il barrel | `packages/core/package.json`, `packages/core/src/enrichment/index.ts` |
| I fixture delle API esterne | `fixtures/api-mocks/{itunes,acousticbrainz}/` |
| I test (unit, integrazione, property-based, scenario) | `packages/core/src/enrichment/__tests__/` |
| La CSP applicata al bundle (costante, header Vite, tag `<meta>`) | `apps/web/src/security/`, `apps/web/vite.config.ts`, `apps/web/index.html` |
| Le 8 chiavi `enrichment.*` materializzate | `apps/web/src/i18n/locales/{it,en}.json` |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.188.1 | Il contratto ha `fetch(track, context)`: il contesto porta nome artista e generi dell'artista | `Track` (`02§3.3`) non porta il nome dell'artista e la ricerca del preview lo richiede (D-AF.1). Il contesto è un dato **del brano**, non dell'utente (`09§3.3`) |
| D.188.2 | Tutte le dipendenze esterne sono **porte iniettate** | D-AF.5 (core senza React) e `10§8` (mai chiamate reali in CI): i test non hanno bisogno di `nock`, `msw` né fake timer |
| D.188.3 | Il **limiter MusicBrainz** (1 req/s) è consegnato come limiter + test, non come client di lookup | Il lookup è la Story 4.2 (`21§1`): consegnarlo sarebbe stato inventare scope |
| D.188.4 | Il motore Essentia è una **porta** e il modulo si carica con `import(/* @vite-ignore */ url)` su URL configurato a runtime | Il WASM (~2,7 MB) deve restare fuori dal bundle iniziale e dal precache (`21§2.5`, `21§6.5`): nessun URL è inventato nel codice |
| D.188.5 | L'euristico stima tempo, ballabilità e acustica dal genere, e **non** stima valence/energy | `21§8.1`: la tonalità da sola non dice il mood; D-AF.4 esclude comunque l'euristico dal mood tracker |
| D.188.6 | Una feature in cache con `source: 'heuristic'` **non** termina la cascata | La stima è un fallback: quando compare un preview il brano deve poter salire di qualità (`21§11.3`, T-AF.14). La riga identica non viene riscritta → idempotenza byte per byte |
| D.188.7 | `lastSkipReason()` è un membro **opzionale** del provider | Serve a distinguere `no_audio` da `none` (testi diversi, `08§2.17`) senza rompere il contratto minimo di `21§4.1` |
| D.188.8 | Il ramo euristico **non** scrive sopra una feature misurata, nemmeno scaduta | `21§11.3`: l'euristico non degrada una misura; la riga vecchia viene ricalcolata al trigger successivo |
| D.188.9 | Il limiter AB è **a header**: prima della prima risposta non c'è limite noto e il limiter non blocca | D-AF.6: un valore hard-coded sbaglierebbe in entrambe le direzioni (`21§7.2`) |
| D.188.10 | La coverage esclude i file **solo tipi** (`types.ts`) e i **barrel** (`index.ts`) dal report | Il provider v8 li mappa come 0% coperto: non contengono una sola istruzione eseguibile e abbassavano il modulo sotto il target dichiarato in `10§2` (≥ 75%). L'esclusione **non indebolisce il gate**: il codice con logica resta misurato, e il modulo `src/enrichment` è a **100%** delle istruzioni e **89,9%** dei rami |

## Difetti trovati lungo il percorso

**Il percorso del file sbagliato è un difetto di processo, non di codice**: due file sono finiti in una directory gemella
("finalmente leggible" invece di "finalmente leggibile") per un errore di percorso nei comandi di scrittura. Il sintomo
era immediato (TypeScript non trovava `./acousticbrainz`) e la correzione è stata spostare il file e cancellare la
directory estranea. La regola emersa: **il percorso si copia, non si riscrive a mano** — una directory quasi-identica è
il modo più economico di creare doppioni.

**La cache euristica non è un cache hit pieno**: la prima implementazione restituiva subito la feature in cache e il
brano non poteva più salire di qualità. Il sintomo sarebbe stato invisibile (nessun errore, solo feature peggiori del
previsto): l'ho trovato rileggendo `21§5.1` ("`source ≠ 'heuristic'` se l'analisi la consumerà") e confrontando con
`21§11.3` (l'euristico scrive solo se non esiste già una fonte migliore). Dichiarato in D.188.6.

**`exactOptionalPropertyTypes`**: il documento AcousticBrainz ha campi assenti, e `{ mood_happy: undefined }` non è
assegnabile a `{ mood_happy?: number }` con l'opzionale esplicito disabilitato. La correzione non è un `as any` ma la
dichiarazione del tipo (`mood_happy?: number | undefined`): il contratto dice cosa può arrivare, anche "niente".

**Il test della CSP leggeva `import.meta.url`**: in jsdom `import.meta.url` non è un URL `file:`, e `fileURLToPath`
falliva con "The URL must be of scheme file". La correzione è `resolve(process.cwd(), 'index.html')`: Vitest gira con
la cwd sul package.

## Verifica

- `pnpm run lint` → verde (core e web)
- `pnpm run typecheck` → verde (4 package)
- `pnpm run test` → **490** test in `@ls/core` (142 nuovi) + **109** in `@ls/web`
  (15 nuovi), tutti verdi
- `pnpm run build` → verde; bundle iniziale **167 KB gzip** (< 300 KB, `05§10`)
- `pnpm --filter @ls/core exec vitest run --coverage src/enrichment` →
  `src/enrichment` a **100%** istruzioni / **89,9%** rami / **100%** funzioni
  (target `10§2`: ≥ 75%)
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → drift **atteso** nei blocchi
  aggregati (SESSIONS/BACKLOG/INDEX/BUNDLE): li rigenera
  `auto-state-aggregate` post-merge (ADR-0008); nessun numero di sessione
  duplicato (`64` pre-allocato con la procedura di `docs/state/_index.md`)
- `node scripts/check-readme-facts.mjs` → 15 check, 0 falliti
- `node scripts/validate-workflows.mjs .github/workflows` → 0 fallimenti

## Lesson learned

| # | Osservazione |
|---|----------------|
| 64-1 | **Una porta iniettata vale dieci mock.** Con `HttpClient`, `Clock`, `Sleep` e `RateLimiter` iniettati, i test della pipeline sono 142 test *veloci* e deterministici: il tempo si simula avanzando un orologio finto, la risposta dell'API arriva da un fixture. Il prezzo (una firma più lunga) si paga una volta; il risparmio (niente `nock`, niente `msw`, niente fake timer) si paga per sempre |
| 64-2 | **La spec che elenca un endpoint solo nel corpo del testo lascia un buco reale.** D-AF.1 prescrive `GET https://itunes.apple.com/search`, ma D-AF.9 mette in `connect-src` solo `https://acousticbrainz.org` e `https://audio-ssl.itunes.apple.com`: **l'host della ricerca non è in lista**. La pipeline ha bisogno della ricerca per ottenere il preview, quindi la CSP applicata include anche `https://itunes.apple.com`, e la contraddizione è segnalata all'issue con `needs-spec` (l'AC "due host" e la fonte dell'audio non possono essere vere insieme) |
| 64-3 | **Un test che verifica il divieto vale più di un commento che lo dichiara.** "Il WASM non è nel bundle iniziale" è un AC: il test legge il sorgente del provider e verifica che l'import sia dinamico con `@vite-ignore` e che non esista alcun import statico. Il divieto è nel codice, non in una promessa |
| 64-4 | **I fixture di scenario sono un terreno di prova gratuito per la determinismo.** T-AF.13 non ha bisogno di rete: il provider AB finto risponde ai brani con MBID (il 10% del catalogo dei fixture) e l'euristico copre il resto; la pipeline produce una feature per brano, sempre la stessa, e il mood tracker ne vede solo le misurate |
| 64-5 | **Un rate limit letto dagli header è una porta, non una costante.** Il limiter AB non ha un intervallo proprio: prima della prima risposta non sa nulla e non blocca, poi aspetta `Reset-In` quando `Remaining` è 0, e un 429 imposta un cooldown dal `Retry-After`. È l'unico modo di onorare un limite che cambia (`21§7.2`) |

## Documenti aggiornati

- `packages/core/src/enrichment/` — **nuovo** pacchetto: `types.ts`, `mapping.ts`,
  `rateLimiter.ts`, `itunes.ts`, `essentia.ts`, `acousticbrainz.ts`, `heuristic.ts`,
  `cascade.ts`, `storage.ts`, `queue.ts`, `index.ts`
- `packages/core/src/enrichment/__tests__/` — **nuovo**: 11 file di test (142 test)
- `packages/core/src/index.ts`, `packages/core/package.json` — gli export del nuovo
  modulo (`@ls/core/enrichment`)
- `packages/core/vitest.config.ts` — la coverage esclude i file solo tipi e i
  barrel (D.188.10): il gate di `10§2` misura il codice che ha logica
- `apps/web/src/security/` — **nuovo**: la CSP dichiarata in `12§2.1` come
  costante applicabile (header Vite + tag `<meta>`), con i due host della pipeline
- `apps/web/vite.config.ts` — gli header CSP di `server` e `preview`
- `apps/web/index.html` — il tag `<meta http-equiv="Content-Security-Policy">`
- `apps/web/src/i18n/locales/{it,en}.json` — le 8 chiavi `enrichment.*` (`08§2.17`)
- `apps/web/src/i18n/index.ts` — il namespace `enrichment`
- `fixtures/api-mocks/` — **nuovo**: i 4 fixture delle risposte esterne
- `docs/state/stories/4.1-audio-features.md` — `status: done`, task e AC
  verificati, scelte implementative e limiti dichiarati
- `docs/state/sessions/64-audio-features-pipeline.md` — **nuovo**
- `docs/11-BACKLOG.md` — sezione Story 4.1 (`**Stato**:`), riga roadmap, lista di
  priorità degli agenti, changelog v1.6.25
- `docs/18-DEV-LOG.md` §4 — entry della story
- `scripts/generate-bundle.ps1` — `$files`: i 4 fixture di `fixtures/api-mocks/`
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#188** — la Story 4.1 (claim `kilo-HP-EliteBook-fc1d`)
- **#187** — la ratifica della spec (`21` v1.0 🟢 APPROVED), Sessione 62
- **#180** — la Story 2.1 (Mood Tracker): consuma le feature che questa pipeline
  produce; è **completata** (Sessione 63, merge `d018a26`) e il percorso dati
  che le mancava è quello consegnato qui (D-A.1)

## Esito post-merge

La PR #197 è **merged** in `main` il 2026-10-30T11:24:49Z (merge commit
`7458220`), CI verde (job `quality`: lint, typecheck, test, build e i gate su
bundle, aggregator, workflow e README). L'issue **#188** è chiusa con
`status:done` (applicato da `auto-status-done`), le label `agent-ready` /
`in-progress` / `status:in-review` sono rimosse e il commento `release:` è
automatico.

Automazioni post-merge: `auto-status-done`, `auto-branch-cleanup` (branch
remoto eliminato), `auto-state-aggregate` (`9c3a13f`) e `auto-bundle`
(`1062c04`). La pulizia git locale (worktree
`ls-188-feat-enrichment-pipeline-audio-features` e branch
`feat/188-feat-enrichment-pipeline-audio-features`) è stata eseguita con
`scripts/post-merge.ps1`: la rimozione della worktree ha richiesto di nuovo
`rd /s /q` con prefisso `\\?\` (su Windows `git worktree remove` fallisce con
"Result too large" sui path lunghi con `node_modules`), poi
`post-merge.ps1 -Check` esce 0.

Con la 4.1 e la 2.1 completate **non esiste più una story lavorabile già
migrata** in `docs/state/stories/`: il blocco NEXT-STEP del README ricade sul
fallback "_Nessuna story non-done e non bloccata migrata_", che è la risposta
**corretta** — le 2.2/2.3 dipendono dalla 2.1 (`[DEP:2.1]`) e non hanno uno
state file. Le tranche rimaste sono la **UI** (Story 3.x), il **lookup
MusicBrainz** (Story 4.2) e gli atti del Boss: la ratifica di
`19-GEO-CONTEXT.md` + `13-ADR/0009`, il cambio di licenza AGPL-3.0 (D-AF.2) e
l'issue **#196**.

Issue aperte dal lavoro, ancora da fare: **#196** (`needs-spec`) — la
contraddizione fra D-AF.1 e D-AF.9 sulla CSP (l'host della ricerca iTunes non
è fra i due host dichiarati in `connect-src`).
