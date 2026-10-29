# 10 — Strategia di Testing

> Status: 🟢 APPROVED · Versione 1.1 · Sessione 62 (2026-10-28, issue #187)

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

`fixtures/db-seed/` contiene (generati da `scripts/generate-fixtures.mjs`, vedi §11):
- `minimal.json` — 10 eventi, 5 track, 2 artisti (per test unit)
- `medium.json` — 5.000 eventi, 500 track, 50 artisti (per test integrazione)
- `large.json` — **25.000 eventi**, 2.500 track, 250 artisti (per test performance)

**Nota su large.json**: la spec originale chiedeva 100.000 eventi ma genererebbe ~73 MB su disco. Per ragioni git-friendly la versione corrente è 25k (~18 MB), sufficiente per il target AC Story 0.2 ("10.000 eventi in <500ms") con margine di stress test. Per ripristinare 100k: modificare `count` in `scripts/generate-fixtures.mjs` `large: () => {...}`.

Tutti i fixture sono **deterministici** (seed mulberry32 fisso, default `0xC0FFEE`). Per rigenerare con seed diverso: `node scripts/generate-fixtures.mjs --seed 42`.

### 3.3 Fixture di scenari di vita

`fixtures/scenarios/` contiene cronologie complete pre-costruite che rappresentano scenari specifici (generati da `scripts/generate-fixtures.mjs`):
- `lockdown-2020.json` — 6.000 eventi, lockdown Italia (9 marzo → 31 maggio 2020); mood sad/calm dominante; ascolti notturni; per testare session segmentation + mood + pattern circadian
- `breakup-oct2021.json` — 3.000 eventi, ottobre 2021; crollo valence, mood sad; per testare mood + valence_drop event detector + memory engine
- `summer-roadtrip.json` — 5.000 eventi, giugno-agosto 2022; mood happy/excited; alta valence; per testare exploration event detector + mood

Ogni scenario ha `_expectedInsights` (nel `_metadata`) con gli insight attesi dopo l'analisi, secondo le spec di `04-ANALYSIS-ALGORITHMS.md`.

### 3.4 Fixture demo mode

`fixtures/demo-user.json` (1 anno, 4.500 eventi, 200 brani, 30 artisti) per la modalità "Scopri come funziona" di `06-UX-FLOWS-STATES §2.14`. Il flag `_metadata.demoMode = true` segnala all'app che i dati vanno cancellati con un click.

### 3.5 Generazione fixture

Tutti i fixture sono generati dallo script `scripts/generate-fixtures.mjs` (deterministico, no dipendenze esterne, Node ≥ 20 LTS).

```bash
node scripts/generate-fixtures.mjs                  # tutti
node scripts/generate-fixtures.mjs minimal          # solo uno
node scripts/generate-fixtures.mjs --seed 42        # seed custom
```

I file generati sono **committati** nel repo (per consistenza tra ambienti di test). Quando modifichi i parametri degli scenari in `scripts/generate-fixtures.mjs`, **rigenera** i fixture con `node scripts/generate-fixtures.mjs` e committa nella stessa PR.

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
- **iTunes Search API** (anteprima audio per Essentia.js) e **AcousticBrainz** (bonus sui MBID): mock con fixture di audio features in `fixtures/api-mocks/itunes/` e `fixtures/api-mocks/acousticbrainz/` (`21-AUDIO-FEATURES.md` §15.2). **Rimosse** le voci "FreqBlog / Musicae": provider placeholder mai esistiti, già rimossi da `02§3.4` e dalla CSP (`12§2.1`)
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
| 1.1 | 2026-10-28 (issue #187) | **§8 allineata alla spec `21-AUDIO-FEATURES.md`** (v1.0 🟢 APPROVED): la riga "FreqBlog / Musicae" — due placeholder mai esistiti come provider, già rimossi da `02§3.4` e dalla CSP di `12§2.1` — è sostituita dai **due mock reali** della pipeline audio features (**iTunes Search API** per l'anteprima audio di 30 s che alimenta Essentia.js, **AcousticBrainz** per il bonus sui MBID), con i fixture in `fixtures/api-mocks/itunes/` e `fixtures/api-mocks/acousticbrainz/` (`21§15.2`). Il resto della strategia di testing non cambia: `§2` (coverage ≥ 75% per `packages/core/enrichment/*`) e `§7` (invarianti `valence ∈ [0,1]`) sono già quelli richiesti dalla spec. Header allineato (era fermo a v1.0 dalla Sessione 3) |