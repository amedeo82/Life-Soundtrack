# 10 — Strategia di Testing

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 3

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

`fixtures/db-seed/` contiene:
- `minimal.json` — 10 eventi, 5 track, 2 artisti (per test unit)
- `medium.json` — 5.000 eventi, 500 track (per test integrazione)
- `large.json` — 100.000 eventi, 5.000 track (per test performance)

Tutti generati sinteticamente con script `scripts/generate-fixtures.ts`.

### 3.3 Fixture di scenari di vita

`fixtures/scenarios/` contiene cronologie complete pre-costruite che rappresentano scenari specifici:
- `lockdown-2020.json` — esplosione Lo-fi, ascolti notturni
- `breakup-oct2021.json` — crollo valence, spike Adele
- `summer-roadtrip.json` — alta valence, country multipli

Ogni scenario ha `_expectedInsights` con gli insight attesi dopo l'analisi.

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
- **FreqBlog / Musicae**: mock con fixture di audio features
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