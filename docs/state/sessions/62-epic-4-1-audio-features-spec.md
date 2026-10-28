---
number: 62
title: "Spec dell'EPIC 4.1 — pipeline audio features: provider, privacy, stoccaggio, costi (issue #187)"
date: 2026-10-28
state: 🟡
merged: false
merged_commit: ""
merged_date: ""
branch: feat/187-audio-features-spec
pr: 0
claim: kilo-hp-elitebook-hj59
cross_refs: [187, 188, 180, 178]
tags: [enrichment, phase-2, spec]
---

# Sessione 62 — La spec dell'EPIC 4.1: la pipeline audio features (issue #187)

## Sintesi

Dopo la chiusura della Story 2.4 la catena dell'EPIC 2 era ferma: la 2.1
(mood tracker) dipende dalle **audio features**, che non hanno una spec. È
quello che chiede esplicitamente l'issue #180, e quello che `04§12` dichiara
da quando la spec dell'analisi è stata ratificata (Sessione 59).

Questa sessione scrive **`docs/21-AUDIO-FEATURES.md`** (v0.1 🟡 DRAFT): il
contratto del provider, la cascata, la mappatura dei campi di `AudioFeatures`,
la normalizzazione, il contratto con il layer di analisi, la privacy, la
CSP, lo stoccaggio, i costi **misurati**, i test e gli acceptance criteria
riscritti della Story 4.1. Apre **nove decisioni** (D-AF.1…D-AF.9) da
chiudere alla ratifica.

## Trigger

Issue **#180** (mood tracker, `needs-spec`): chiede *"l'issue dell'EPIC 4.1
(audio features) con la sua spec: provider, privacy, stoccaggio, costi"* e la
decisione su *quando* implementare la 2.1. Aperti **#187** (la spec, da
lavorare in questa sessione) e **#188** (l'implementazione della Story 4.1,
`needs-spec` fino alla ratifica).

## Le cinque premesse che la story non dichiarava

La Story 4.1 ha quattro acceptance criteria e un riferimento implicito a
`05§6`. Scrivendo la spec sono emerse cinque premesse che la cascata
dichiarata non copre — e tre di queste sono **fatti verificati in data**, non
opinioni:

1. **La PWA non ha l'audio** (§2.1). `05§6` dice "Essentia.js quando è
   disponibile un preview audio (30s) dal catalogo", ma **quale** catalogo non
   è scritto da nessuna parte. Le tre fonti possibili: Spotify (morto per le
   nuove app), Apple Music (99 $/anno) e **iTunes Search API** (gratis, senza
   auth: verificato oggi, `previewUrl` presente).
2. **Spotify `audio_features` non è un provider** (§2.2). Deprecato il
   27/11/2024, 403 per le app nuove, ulteriori restrizioni nel 2026. La story
   non ha un provider "ovvio": è una **scelta di motore di inferenza**.
3. **AcousticBrainz dà classi `mood_*` e `danceability`, non `valence` ed
   `energy`** (§2.3). L'API è viva (verificata oggi: 200 con gli header di
   rate limit), ma `valence`/`energy` sono concetti di Spotify (Echo Nest) e
   **nessun provider li dà nativi**: o si derivano, o si stimano.
4. **`essentia.js` è AGPL-3.0 e l'app è Apache-2.0** (§2.4). Verificato su npm.
   Bundlare il WASM cambia il regime di licenza dell'app: è una decisione del
   Boss, non un dettaglio implementativo.
5. **Il budget del bundle è 300 KB gzip e il percorso Essentia ne vale ~6 MB**
   (§2.5). Misurati oggi: WASM 2,69 MB (tarball npm) + backbone MusicNN
   3,19 MB + TFJS. Il WASM non può stare nel bundle iniziale né nel precache.

## Decisioni proposte (D-AF.1…D-AF.9)

| # | Decisione | Proposta |
|---|-----------|----------|
| D-AF.1 | La fonte dell'audio | il preview di 30 s dell'iTunes Search API |
| D-AF.2 | La licenza dell'app | AGPL-3.0 (altrimenti si rinuncia al provider acustico) |
| D-AF.3 | Il modello valence/energy | DEAM (1.802 brani, CCC 0,647) |
| D-AF.4 | Il fallback euristico | **non** alimenta il mood tracker (D-A.1): l'analisi vede solo feature misurate o manuali |
| D-AF.5 | Dove vive il codice | `packages/core/src/enrichment/` **senza React**; React Query resta nel web |
| D-AF.6 | Il rate limiting | MB 1 req/s; **AB letto dagli header** `X-RateLimit-*` (il valore live non è quello documentato) |
| D-AF.7 | Trigger e budget | i tre di `05§6.1`, concurrency 1, 5 min/giorno, mai bloccante |
| D-AF.8 | Il `source` delle feature derivate | resta `acousticbrainz` (lo schema è chiuso) e la derivazione è dichiarata nella spec |
| D-AF.9 | La rete consentita | `connect-src` += `acousticbrainz.org` e `audio-ssl.itunes.apple.com` |

## Difetti (e incoerenze) trovati lungo il percorso

**Due documenti APPROVED si contraddicono su un punto**: `05§6` mette il
fallback euristico in cascata, `04§11` (D-A.1) esclude i segnali inventati dal
mood tracker. La risposta non è scegliere un vincitore: è separare i due
**usi** (l'euristico serve la UI e la copertura, l'analisi non lo legge) —
D-AF.4, §12.

**`05§9` colloca `enrichment` dentro `@ls/core` con l'annotazione "React
Query", mentre `05§9.2` dichiara `@ls/core` una foglia runtime-agnostic senza
React.** Le due righe non possono stare insieme: il core espone porte e
orchestratore puri, React Query resta nel web (D-AF.5).

**Il rate limit documentato non è quello reale**: la documentazione di
AcousticBrainz dice "tipicamente 10 query ogni 10 secondi per IP"; la
risposta live del 28/10/2026 diceva `X-RateLimit-Limit: 100`,
`Remaining: 99`, `Reset-In: 2`. Una costante hard-coded sbaglierebbe in
entrambe le direzioni: il client deve leggere gli header (D-AF.6).

**L'inventario privacy non ha una riga per le audio features** (`09§4`), e il
diagramma di `09§3.1` menziona ancora **FreqBlog**, un provider che non è
più usato (`02§3.4` e `12§2.1` lo hanno già rimosso). Stessa riga in
`10§8` ("FreqBlog / Musicae: mock con fixture di audio features"): sono
placeholder mai esistiti, e la directory `fixtures/api-mocks/` che `10§8`
cita **non esiste**.

**Nessun campo `lastSeenAt` in `Track`**: il criterio LRU di `05§6.2`
("evict basato su `lastSeenAt` del track") presuppone un campo che `02§3.3`
non dichiara. Il fallback è `fetchedAt` della feature (§19, punto 7).

## Verifica

Documento di spec: nessun gate di codice. I gate eseguiti:
`pwsh scripts/generate-bundle.ps1 -Check` (exit 0, 107 file),
`pwsh scripts/aggregate-state.ps1 -Check` (il drift dei blocchi aggregati è
quello atteso: la sessione 62 e la story 4.1 sono nuove),
`node scripts/check-readme-facts.mjs` (exit 0 — la pipeline audio features
resta una capability **non implementata**, e il README la dichiara solo nella
roadmap).

## Lesson learned

| # | Osservazione |
|---|----------------|
| 62-1 | **Una specifica che scrive "quando è disponibile un preview dal catalogo" ha già scritto metà della decisione senza accorgersene.** Il "catalogo" era la parte mancante della premessa, e la premessa mancante decideva il costo (6 MB), la privacy (una query in rete) e la licenza (AGPL). Scrivere la premessa *prima* del contratto ha cambiato il contratto |
| 62-2 | **Il provider più popolare e il provider più utile non coincidono.** Spotify `audio_features` è il riferimento mentale di tutti, ma è morto; AcousticBrainz è vivo e ha un dataset enorme, ma non dà i due campi che il mood tracker legge. Il tempo speso a verificare gli endpoint (un'ora di ricerca con probe live) ha evitato una specificazione interamente sbagliata |
| 62-3 | **Le specifiche approvate possono contraddirsi, e la contraddizione è informative.** `05§6` e `04§11` non possono essere vere insieme: la loro tensione indica esattamente il punto in cui il prodotto non aveva deciso (chi consuma la stima?). La risposta non è "scegli un documento": è trovare la **distinzione** che li rende entrambi veri (uso per la UI vs uso per l'analisi) |
| 62-4 | **Una licenza incompatibile è una decisione di prodotto, non un dettaglio di build.** `essentia.js` è AGPL-3.0 e l'app Apache-2.0: il bundle è distribuito ai browser, quindi l'opera combinata cambia licenza. Scriverlo nella spec, prima che l'agente implementatore lo scopra alla build, costa una riga; scoprirlo dopo costa una PR di rilicenza e una discussione |
| 62-5 | **I costi vanno misurati, non stimati.** "Il WASM è pesante" è un'opinione; "2,69 MB di tarball + 3,19 MB di backbone + TFJS, contro un budget di 300 KB gzip" è un fatto che decide il caricamento lazy, il precache e la strategia di cache. Le misure vengono dalla rete (npm, `Content-Length` dei pesi, header dei rate limit), non dalla documentazione |
| 62-6 | **Un rate limit documentato è un'ipotesi, non un contratto.** Il valore reale di AcousticBrainz differiva da quello dichiarato (100 ogni ~2 s contro "10 ogni 10 s"). I limiti vanno letti dagli header, sempre: la costante hard-coded è una bomba a orologeria |

## Documenti aggiornati

- `docs/21-AUDIO-FEATURES.md` — **nuovo** (v0.1 🟡 DRAFT): la spec della
  pipeline audio features, con 9 decisioni aperte
- `docs/INDEX.md` — la riga del nuovo documento nella tabella dei documenti
- `docs/11-BACKLOG.md` — la sezione Story 4.1 (Stato + Spec); gli AC
  riscritti sono in `21§16` e valgono dalla ratifica
- `scripts/generate-bundle.ps1` — `$files`: il nuovo documento
- `docs/BUNDLE.md` — rigenerato
- `docs/state/sessions/62-epic-4-1-audio-features-spec.md` — **nuovo**

## Cross-refs

- **#187** — la spec (claim `kilo-hp-elitebook-hj59`), chiusa da questa PR
- **#188** — l'implementazione della Story 4.1 (`needs-spec` fino alla
  ratifica della spec)
- **#180** — la Story 2.1: la catena 4.1 → 2.1 → 2.2/2.3 è quella dichiarata
  nella lista di priorità degli agenti (`11§Priorità`)
- **#178** — la ratifica della spec dell'analisi (`04` v1.0 🟢), da cui
  `04§12` discende l'obbligo di questa spec
