# 23 — Collegamento del pipeline di analisi all'app

> Status: 🟡 DRAFT (diventa **🟢 APPROVED v1.0** alla ratifica del project owner, cioè al merge della PR)
> Versione: 0.1
> Ultima modifica: Sessione 86 (2026-11-02)
> Responsabile: Boss
> Story: **2.5** (`docs/11-BACKLOG.md` §"Story 2.5") · Area: `analysis` · Size: L
> Origine: `docs/22-COMPETITIVE-POSITIONING.md` §7 (differenziatore 3 «retrospettiva storica» verificato 🟡)

---

## 🎯 Scopo

I quattro motori di analisi sono **scritti e testati** in `packages/core/src/analysis/`, ma **nessun codice in `apps/web` li esegue**: `useHomeTimelineData` legge gli insight che nessuno scrive. Dopo un import pulito le sezioni mood, ere e ricordi restano vuote.

Questa spec definisce **come** collegarli all'app, in modo che:

1. dopo un import (o su richiesta) l'app **generi e persista** gli insight;
2. la Home e la Timeline li mostrino **senza codice nuovo** (i lettori esistono già);
3. l'utente senza dati acustici veda un **messaggio esplicito**, non uno schermo vuoto ambiguo.

> **Fuori perimetro (dichiarato)**: l'integrazione di `essentia.js` (il WASM non è ancora una dipendenza: vedi `21-AUDIO-FEATURES.md` §2.4 e `docs/22-COMPETITIVE-POSITIONING.md` §4), la nuova UI di Esplora/Analisi (Story 3.3, spec `25-MEMORIES-SHARE-EXPLORE.md`), il tagging manuale (Story 3.2, stessa spec).

## 📐 Contratti esistenti (da NON reinventare)

Verificati sul codice in Sessione 86. La story deve **usare** queste API, non crearne di parallele.

### Core — pipeline (`packages/core/src/analysis/pipeline.ts`)

```ts
export interface AnalysisInput {
  readonly listens: readonly ListenEvent[];
  readonly tracks: readonly Track[];
  readonly artists: readonly Artist[];
  readonly features?: readonly AudioFeatures[];
  readonly today: number;        // unix ms UTC
  readonly locale: string;
}

export interface AnalysisGenerator {
  readonly name: string;
  generate(input: AnalysisInput): Promise<Insight[]>;
}

export class AnalysisPipeline {
  constructor(generators: readonly AnalysisGenerator[] = []);
  get names(): string[];
  run(input: AnalysisInput): Promise<Insight[]>;   // concatena gli Insight[], in ordine di registrazione
}
```

Le quattro factory (stesso file):

| Factory | Firma | Note |
|---------|-------|------|
| `createMoodGenerator` | `(options?: { config?: Partial<MoodConfig>; periods?: readonly MoodPeriod[]; logger?: Logger }) => AnalysisGenerator` | unico senza `translator` |
| `createEraGenerator` | `(options: { translator: Translator; config?: EraConfigOverrides; logger?: Logger }) => AnalysisGenerator` | `translator` **obbligatorio** |
| `createEventGenerator` | `(options: { translator: Translator; config?: EventConfigOverrides; logger?: Logger }) => AnalysisGenerator` | `translator` **obbligatorio** |
| `createMemoryGenerator` | `(options: { translator: Translator; config?: Partial<MemoryConfig> }) => AnalysisGenerator` | `translator` **obbligatorio** |

> **Limite noto del contract (L100–L109, L139–L148, L178–L188, L218–L229)**: ogni factory costruisce il motore **a ogni `generate()`** e la factory **scarta** l'output ricco (`GeneratedMood.period/payload`, `GeneratedMemory.score`, `GeneratedEra.payload`, `GeneratedEvent.payload`), restituendo solo `Insight[]`.
> **Conseguenza per la story**: l'app deve usare il **payload** dell'`Insight` (che contiene già i dati necessari: `EraPayload`, `MoodPeriodPayload`, `EventPayload`, `MemoryPayload`), **non** il `score` del motore. Se serve il ranking per rilevanza, il ranking è già dentro `Insight.confidence` (`04§7.4`).

### Core — persistenza (`packages/core/src/db/insights.ts`)

| Funzione | Firma | Transazionale |
|----------|-------|---------------|
| `putInsights` | `(db, insights: Insight[]) => Promise<void>` | ❌ (`bulkPut`) |
| `listInsightsByType` | `(db, type: InsightType) => Promise<Insight[]>` | — (ordinata per `periodStart` ASC) |
| `listStaleInsights` | `(db, type: InsightType, currentDerivedVersion: string) => Promise<Insight[]>` | — |
| `replaceInsights` | `(db, {type, insights, derivedVersion, periodStart}) => Promise<ReplaceInsightsReport>` | ✅ sostituisce **un** periodo |
| `replaceInsightsOfType` | `(db, {type, insights, derivedVersion}) => Promise<ReplaceInsightsReport>` | ✅ sostituisce i periodi calcolati |
| `replaceAllInsightsOfType` | `(db, {type, insights, derivedVersion}) => Promise<ReplaceInsightsReport>` | ✅ sostituisce **tutto** il tipo (obbligatorio per le **ere**, i cui confini si spostano: D.69.8) |

> La scelta tra le tre `replace*` è **vincolante**: mood → `replaceInsightsOfType` (per periodi), ere → `replaceAllInsightsOfType`, eventi → `replaceInsightsOfType`, ricordi → `replaceAllInsightsOfType` (il feed si riordina per rilevanza).

### Core — tipi (`packages/core/src/schema/index.ts`)

```ts
export type InsightType = 'mood_day' | 'mood_week' | 'mood_month' | 'era' | 'event' | 'memory' | 'pattern';

export interface Insight {
  id: string; type: InsightType; periodStart: number; periodEnd: number;
  payload: InsightPayload; confidence: number; derivedVersion: string;
  status: 'pending' | 'confirmed' | 'corrected' | 'dismissed';
  userNote: string | null; createdAt: number;
}
```

Payload: `EraPayload {kind:'era', label, moodDominant, topArtistIds, topTrackIds, genreDistribution, avgValence, avgEnergy, nightShare, repeatRate}` · `MoodPeriodPayload {kind:'mood', mood, avgValence, avgEnergy, eventCount}` · `EventPayload {kind:'event', eventType, description, metrics}` · `MemoryPayload {kind:'memory', memoryKind, trackId, artistId, yearsAgo, text}`.

### Core — i18n (`packages/core/src/analysis/i18n.ts`)

```ts
export interface Translator { translate(key: string, params?: Record<string, string | number>): string; }
export function createI18nTranslator(instance: I18nInstance): Translator  // apps/web/src/i18n/translator.ts
```

> **Attenzione (fail-fast)**: `parseMissingKeyHandler: () => ''` (i18next) ⇒ una chiave mancante fa **lanciare** `renderMemoryText` / `renderEraLabel` (`analysis/memory/i18n.ts:49`, `analysis/era/i18n.ts:50`). Una chiave i18n assente = **errore runtime**, non un blank. Le chiavi `insight.*` devono esistere in **it** ed **en**.

### Core — precondizione dei dati (D-A.1 / D-AF.4)

`ANALYSIS_FEATURE_SOURCES = ['essentia', 'acousticbrainz', 'manual']` (`analysis/mood/features.ts:25`): il sorgente `heuristic` **non** alimenta l'analisi. `MoodEngine` richiede `minEventsPerPeriod = 3` eventi **con** `valence` ed `energy` non nulli (`analysis/mood/engine.ts:107–115`): sotto soglia **non produce alcun insight** (nessun segnale inventato).

## 🔌 Punti di innesto nell'app (verificati)

| Punto | File | Fatto |
|-------|------|-------|
| **Dopo l'import** | `apps/web/src/onboarding/OnboardingRouter.tsx:157–222` | `handleImportAll` chiama `runImport(db, adapter, file, {...})` e poi `setScreen('reveal')` (L220) — **questo è il punto di innesto** |
| **Lettura degli insight** | `apps/web/src/hooks/useHomeTimelineData.ts:112–114` | legge `'era'`, `'mood_day'`, `'memory'` (⚠️ **`mood_week` non è letto**: `AppShell.tsx:66` passa `weekMoodLabel={null}` → va aggiunto) |
| **Stato vuoto** | `apps/web/src/screens/Home.tsx:71–81` | `data-testid="home-empty"` con CTA `empty.cta.import` — va distinto il caso «nessun dato» dal caso «dati senza feature» |
| **Feature** | tabella Dexie `features` (`&trackId, source`) | una riga per track, `AudioFeatures` con 12 campi nullable + `source` + `fetchedAt` + `schemaVersion` |
| **Nessun router** | `apps/web/src/screens/AppShell.tsx:21` | `export type AppSection = 'home' | 'timeline'` — l'unica navigazione è uno switch su questo tipo |

## 🧩 Cosa costruire

### 1. `packages/core/src/analysis/runner.ts` (nuovo) — orchestrazione nel core

Il core resta **senza React** (D-AF.5) e senza dipendenze dal DB beyond Dexie.

```ts
export interface AnalysisRunOptions {
  readonly db: LifeSoundtrackDB;
  readonly translator: Translator;
  readonly locale?: string;                 // default: 'it'
  readonly today?: number;                  // default: Date.now()
  readonly logger?: Logger;
  readonly now?: () => number;
}

export interface AnalysisRunReport {
  readonly produced: Record<InsightType, number>;   // per tipo
  readonly replaced: Record<InsightType, number>;    // righe stale rimosse
  readonly skipped: number;                          // generator che hanno prodotto 0 insight
  readonly durationMs: number;
  readonly missingFeatures: number;                  // eventi senza valence/energy
}

export async function runAnalysisPipeline(options: AnalysisRunOptions): Promise<AnalysisRunReport>;
```

Comportamento richiesto:

1. legge `listens` (tutti), `tracks`, `artists`, `features` dal DB;
2. costruisce i quattro generator con `createMoodGenerator` / `createEraGenerator` / `createEventGenerator` / `createMemoryGenerator` (**in quest'ordine**: l'ordine è quello dichiarato in `04§8.1`);
3. esegue `pipeline.run(input)`;
4. **persiste** con le `replace*` corrette (§"Core — persistenza"), in **transazione** per tipo;
5. **scarta** gli insight di tipo `pattern` (non prodotti oggi: `04§4` è fuori perimetro);
6. ritorna il report.

> **Vincolo di idempotenza (T-AF.14)**: due esecuzioni consecutive producono lo stesso insieme di `Insight` (gli id sono deterministici: `era-${periodStart}`, e così per gli altri tipi) e **non** duplicano righe.

### 2. `apps/web/src/analysis/analysisRunner.ts` (nuovo) — adapter app

```ts
export interface AnalysisRunner {
  run(reason: 'post-import' | 'manual' | 'on-demand'): Promise<AnalysisRunReport>;
  isRunning(): boolean;
}
export function createAnalysisRunner(deps: {
  db: LifeSoundtrackDB;
  translator: Translator;
  logger?: Logger;
}): AnalysisRunner;
```

Responsabilità: aprire il DB (`openDb()`), costruire il `Translator` dall'istanza i18next (`createI18nTranslator(i18n)`), chiamare `runAnalysisPipeline`, loggare il report (`logger.info('analisi completata', {produced, replaced, durationMs})`) e **non propagare errori al chiamante** (un fallimento dell'analisi non deve far fallire l'import).

### 3. Trigger (dove e quando)

| Trigger | Quando | Priorità |
|---------|--------|----------|
| `post-import` | alla fine di `handleImportAll`, **dopo** `setScreen('reveal')` | P0 |
| `manual` | da Impostazioni → «Ricalcola analisi» (vedi `27-PRIVACY-DATA-SETTINGS.md`) | P1 |
| `on-demand` | da un punto della UI (Refresh della Timeline) | P1 |

> **Vincolo (05§6.1)**: l'import **non attende** l'analisi. Il trigger `post-import` parte **in background** (`void runner.run('post-import')`) con gestione degli errori; l'utente vede il reveal subito e gli insight arrivano quando arrivano.

### 4. Stato vuoto esplicito (Home)

Distinguere tre casi, con tre messaggi distinti (chiavi i18n nuove, namespace `home.*`):

| Caso | Condizione | Messaggio |
|------|-----------|-----------|
| `empty` | `countListens(db) === 0` | oggi (`empty.description.home`) — invariato |
| `no-features` | ci sono ascolti ma **zero** feature con `valence`+`energy` utilizzabili | «I tuoi dati ci sono, ma per raccontare il loro umore serve l'analisi acustica: attivala in Impostazioni → Privacy» + CTA |
| `ready` | ci sono insight | com'oggi |

> La regola «**mai schermate bianche**» (`06§1`) impone il terzo caso: senza questa distinzione l'utente vede una Home vuota e conclude che l'app non funzioni.

### 5. Lettura degli insight: allineare l'app al core

- `useHomeTimelineData` deve chiedere **anche** `'mood_week'` (per `weekMoodLabel`, oggi cablato a `null` in `AppShell.tsx:66`);
- `AppShell` passa `weekMoodLabel` = etichetta del mood settimanale più recente (i18n `insight.mood.*` + `home.moodWeek` esistono già).

### 6. Le feature: precondizione, non parte di questa story

La pipeline audio features (`packages/core/src/enrichment/`) **è già implementata** ma non è collegata all'app. Il collegamento (cascata `cache → Essentia.js → AcousticBrainz → euristico`, coda con budget 5 min/giorno, toggle `enrichMetadata`) è **un'altra story** — da aprire come `needs-spec` con la stessa logica di questa spec.

> **Vincolo di questa story**: **senza** feature non ci sono mood/ere/eventi basati sulla valence, e l'app **deve dirlo** (§4, caso `no-features`). La story **non** inventa segnali (D-A.1) e **non** abilita l'enrichment di nascosto.

## 🔒 Privacy

| Vincolo | Applicazione |
|---------|--------------|
| Nessuna uscita di rete | questa story **non** fa rete: legge e scrive solo sul DB locale |
| Toggle `enrichMetadata` | non pertinente (nessun arricchimento qui): se un domani l'enrichment, il toggle resta il primo check (cascade L181) |
| Dati derivati | gli insight derivano dagli ascolti: sono dati personali, restano locali, e sono inclusi nell'export della Story 5.2 |
| Nessun segnale inventato | senza feature non si produce nulla: **mai** un mood dedotto dal genere (D-A.6, issue #193 — il fallback mood-by-genre **non esiste**) |

## 🧪 Test

| Livello | File | Cosa copre |
|---------|------|-----------|
| unit (core) | `packages/core/src/analysis/__tests__/runner.test.ts` | il runner produce `mood_day`/`era`/`event`/`memory` con `derivedVersion`; **idempotenza**: due run → stesse righe, nessun duplicato; senza feature → 0 insight |
| integrazione (core) | `packages/core/src/analysis/__tests__/runner-persistence.test.ts` | `replaceAllInsightsOfType` sulle ere: un confine che si sposta **elimina** l'era precedente (nessuna era fantasma) |
| unit (app) | `apps/web/src/analysis/__tests__/analysisRunner.test.ts` | il runner non propaga gli errori; il report è loggato |
| integrazione (app) | `apps/web/src/screens/__tests__/home-no-features.test.tsx` | stato vuoto `no-features`: mostra il messaggio e la CTA, non lo schermo bianco |
| integrazione (app) | `apps/web/src/hooks/__tests__/useHomeTimelineData.test.ts` | legge `mood_week`; `weekMoodLabel` popolato quando esiste |

I fixture esistenti sono riutilizzabili: `fixtures/scenarios/era-shift.json` (8+8 settimane, confine al giorno 56), `fixtures/scenarios/lockdown-2020.json`, `fixtures/scenarios/listening-spike.json`, `fixtures/db-seed/{minimal,medium,large}.json`.

## ✅ Acceptance criteria

- [ ] `runAnalysisPipeline` esiste in `@core/analysis` ed è coperto da test (idempotenza, assenza di feature, sostituzione delle ere)
- [ ] Dopo un import, il trigger `post-import` avvia l'analisi **senza bloccare l'import** (il tempo di import non dipende dal numero di eventi)
- [ ] La tabella `insights` contiene righe `mood_day`, `era`, `event`, `memory` con `derivedVersion` quando le feature ci sono
- [ ] La Timeline mostra almeno un'era e la Home un ricordo del giorno, **letti dal DB**
- [ ] **Nessun segnale inventato**: senza feature misurate o manuali non viene prodotto alcun insight basato sulla valence, e la UI lo dice (`no-features`)
- [ ] `mood_week` viene letto e `weekMoodLabel` è popolato in `AppShell`
- [ ] Il testo degli insight è **reso** dal resolver i18n: nessuna chiave mancante in it/en (un test verifichi che `insight.*` esista in entrambe le lingue)
- [ ] Due esecuzioni consecutive non duplicano righe e lasciano le stesse `id`
- [ ] Un errore dell'analisi **non** fa fallire l'import e viene loggato
- [ ] Nessuna richiesta di rete introdotta dalla story

## 📋 Task

- T23.1 — `packages/core/src/analysis/runner.ts`: `runAnalysisPipeline` + report + persistenza transazionale per tipo
- T23.2 — Test del runner in `@core/analysis` (idempotenza, senza feature, sostituzione delle ere)
- T23.3 — `apps/web/src/analysis/analysisRunner.ts`: adapter con DB, translator, logging, errori non fatali
- T23.4 — Trigger `post-import` in `OnboardingRouter.handleImportAll` (in background, dopo il reveal)
- T23.5 — Stato vuoto `no-features` in `Home.tsx` (+ chiavi i18n `home.*` in it/en)
- T23.6 — `useHomeTimelineData`: lettura di `mood_week`; `AppShell`: `weekMoodLabel` popolato
- T23.7 — Test app: runner, stato vuoto `no-features`, `mood_week`
- T23.8 — Allineamento documentale: `docs/INDEX.md` (righe `04`, `23`), `docs/11-BACKLOG.md` (§2.5), `docs/state/stories/2.5-*.md`, `docs/08-COPY-I18N.md` (chiavi nuove)

## 🧾 Decisioni proposte

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-23.1 | Il runner vive nel **core** (`analysis/runner.ts`), non nell'app | Il core resta senza React (D-AF.5) e il runner è testabile senza browser; l'app resta un adapter |
| D-23.2 | L'analisi gira **in background** dopo l'import e non blocca | `05§6.1`: l'import non attende la rete né l'analisi; l'utente vede il reveal subito |
| D-23.3 | Persistenza con `replaceAllInsightsOfType` per **ere** e **ricordi**, `replaceInsightsOfType` per **mood** ed **eventi** | Le ere hanno confini mobili (D.69.8): senza sostituzione totale resterebbero ere fantasma; mood ed eventi sono per-periodo |
| D-23.4 | `mood_week` viene letto e popolato `weekMoodLabel` | Oggi `AppShell` passa `null` hard-coded: una feature già pronta che non viene mostrata |
| D-23.5 | Stato vuoto **`no-features`** distinto da `empty` | «Mai schermate bianche» (`06§1`): senza feature l'utente deve capire che il problema è l'arricchimento, non l'import |
| D-23.6 | Il tipo `pattern` resta fuori (non prodotto, `04§4` fuori perimetro) | Non produrre insight di un tipo che il core non emette |

## 🚧 Cosa NON è in scope

- Il collegamento della **pipeline audio features** all'app (altra story, stessa logica: toggle prima di ogni accesso, budget, coda).
- L'integrazione di **essentia.js** (WASM, dipendenza, CSP, modello).
- Le **schermate** Esplora/Analisi/Ricordi (Story 3.2/3.3 → `25-MEMORIES-SHARE-EXPLORE.md`).
- Il **tagging manuale** e la rinomina delle ere (Story 3.2).
- L'**export** degli insight (Story 5.2 → `27-PRIVACY-DATA-SETTINGS.md`).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 86 (2026-11-02) | Prima stesura: contratti reali del core (pipeline, persistenza, i18n, tipi), punti di innesto nell'app, runner da costruire, stato vuoto `no-features`, piano di test, D-23.1…D-23.6 |

---

*Questo documento diventa vincolante (🟢 APPROVED v1.0) alla ratifica del project owner. Fino ad allora è una proposta.*
