# 26 — Anteprima del risultato in onboarding (modalità demo)

> Status: 🟡 DRAFT (diventa **🟢 APPROVED v1.0** alla ratifica del project owner)
> Versione: 0.1
> Ultima modifica: Sessione 86 (2026-11-02)
> Responsabile: Boss
> Story: **3.5** (`docs/11-BACKLOG.md` §"Story 3.5") · Area: `ui` · Size: M · **Priorità P0 (piccola)**
> Origine: `docs/22-COMPETITIVE-POSITIONING.md` §9 · Requisito di UX: `docs/06-UX-FLOWS-STATES.md` §2.14

---

## 🎯 Scopo

L'onboarding oggi termina con un **contatore** di eventi (`apps/web/src/onboarding/OnboardingRouter.tsx:517–547`, schermata ⑤ Reveal): l'utente non vede mai il prodotto prima di usarlo, e il README dichiarava un'«anteprima del risultato» che il codice non ha.

Il progetto ha già i mattoni: `fixtures/demo-user.json` (1 anno, 4 500 eventi, 200 brani, 30 artisti, `_metadata.demoMode = true`) è previsto da `06-UX-FLOWS-STATES.md` §2.14 e la CTA «Scopri come funziona» esiste nelle stringhe (`empty.cta.demo`, `it.json:178`) — ma **nessun file di codice li usa** (grep `demo-user` su `*.ts,*.tsx` → 0 risultati).

Questa spec definisce **come** mostrare il risultato, in tre tempi:

1. **prima** dell'import: la CTA «Scopri come funziona» apre un **diario di esempio**;
2. **durante** l'import: il reveal mostra le **prime righe** della timeline reale, non un contatore;
3. **dopo**: la demo è cancellabile con un click, e non lascia tracce nel database dell'utente.

## 🔍 Stato reale (verificato in Sessione 86)

| Fatto | Dove |
|-------|------|
| Il fixture ha 4 chiavi: `_metadata`, `listens` (4500), `tracks` (200), `artists` (30) — **nessun `albums`, nessun `features`** | `fixtures/demo-user.json:2`, `:17`, `:99019`, `:103409` |
| `_metadata.demoMode = true`, `counts: {listens: 4500, tracks: 200, artists: 30}`, `seed: 12639110` | `fixtures/demo-user.json:2–16` |
| Gli ascolti del fixture **non hanno** `city`/`citySource`/`cityConfidence` (aggiunti in schema v6 dalla Story 1.6) | `fixtures/demo-user.json:18–39` |
| I track hanno `albumId` valorizzato, ma **non esiste la tabella `albums`** ⇒ riferimenti pendenti | `fixtures/demo-user.json:99020–99041` |
| Il fixture è prodotto da `scripts/generate-fixtures.mjs demo` (`buildDemoUser`, seed `SEED ^ 0x2468`) | `scripts/generate-fixtures.mjs:1066–1099`, `:1219`, `:1255` |
| ⚠️ `generatedAt` è `new Date().toISOString()` ⇒ **rigenerare il fixture lo modifica** (non deterministico) | `scripts/generate-fixtures.mjs:1087` |
| La schermata Reveal mostra `events` e `t('onboarding.reveal.subtitle', { years: 1, events })` — **anno cablato** | `apps/web/src/onboarding/OnboardingRouter.tsx:517–547` |
| Le schermate dell'onboarding sono una **union in due file paralleli** | `OnboardingRouter.tsx:64` e `apps/web/src/onboarding/types.ts:4` |
| Il copy esistente | `empty.cta.demo`, `onboarding.reveal.{title,subtitle,cta,skip}`, `onboarding.welcome.*` (`it.json:2–27`, `:178`) |
| I componenti Home/Timeline leggono dal DB con `openDb()` **interno** | `apps/web/src/hooks/useHomeTimelineData.ts:108` |

## 🧭 La decisione di design che regge tutto

> **D-26.1 — la demo vive in un database separato, non in memoria e non nel DB dell'utente.**
>
> Il DB dell'utente (`life-soundtrack`) **non** viene mai toccato dalla demo: nessuna scrittura, nessuna lettura. La demo usa un **secondo database Dexie** (`life-soundtrack-demo`) che viene creato, popolato e poi **cancellato** con un click (`db.delete()`), come previsto da `06§2.14` («tutti i dati cancellabili con un click»).
>
> **Perché un DB e non solo memoria**: Home e Timeline sono già scritti e testati e leggono dal DB; un percorso dati parallelo (fixture → view model → componenti) significa **due renderer da mantenere** — l'antipattern esplicitamente escluso dalla story 3.5 («gli stessi componenti, nessun renderer parallelo»).
>
> **Costo**: `useHomeTimelineData` e gli altri hook devono accettare un'istanza di DB **iniettabile** invece di chiamare `openDb()` da soli. È un refactor piccolo e utile (testabilità).

```ts
// apps/web/src/hooks/useHomeTimelineData.ts (dopo il refactor)
export function useHomeTimelineData(
  granularity: 'years' | 'months' | 'weeks' | 'days',
  db?: LifeSoundtrackDB,        // default: openDb()
): HomeTimelineData;
```

## 📐 Contratti da costruire

### 1. Core — loader del fixture (`packages/core/src/db/demoSeed.ts`, nuovo)

```ts
export const DEMO_DB_NAME = 'life-soundtrack-demo';

export interface DemoSeedReport {
  readonly listens: number;
  readonly tracks: number;
  readonly artists: number;
  readonly albums: number;
  readonly features: number;
}

export async function seedDemoDatabase(
  db: LifeSoundtrackDB,
  fixture?: unknown,             // default: import del fixture
  options?: { now?: number },
): Promise<DemoSeedReport>;

export async function clearDemoDatabase(): Promise<void>;   // db.delete() + reopen
```

Comportamento richiesto:

1. **normalizzazione dello schema**: gli ascolti del fixture **non hanno** `city`/`citySource`/`cityConfidence` → il loader li aggiunge a `null` (schema v6). Lo stesso per i campi assenti in `Track`/`Artist`.
2. **album**: per ogni `albumId` distinto dei track, crea una riga `Album` (nome derivato dall'artista + id, `mbid: null`, `artworkUrl: null`) → nessun riferimento pendente.
3. **arrotondamento**: i contatori denormalizzati (`listenCount` dei track e degli artisti) sono **ricalcolati** con `recount(db)` — mai copiati dal fixture.
4. **transazione**: il seed avviene in una transazione Dexie (o in un'`imports` record con `importId` dedicato), così un'interruzione non lascia metà demo.

### 2. Fixture — estensione del generatore

> **D-26.2 — il fixture demo viene esteso con `albums` e `features`.**
>
> Il problema: senza `features` (con `valence` ed `energy`) i motori di analisi **non producono nulla** (D-A.1) ⇒ la demo mostrerebbe una timeline **senza ere e senza mood**: cioè il prodotto più povero, non «la magia». Le feature demo devono essere **sintetiche ma dichiarate**: `source: 'manual'` (l'unico sorgente oltre a `essentia`/`acousticbrainz` che l'analisi accetta, `analysis/mood/features.ts:25`), generate **deterministicamente** dal PRNG del generatore (seed fisso), mai a mano.

Modifiche a `scripts/generate-fixtures.mjs` (funzione `buildDemoUser`):

- emettere `albums` (derivati dai `albumId` dei track);
- emettere `features` per ogni track, con `valence`/`energy` in [0,1] **coerenti col genere** (così le ere risultano distinte e leggibili), `source: 'manual'`, `fetchedAt` = timestamp del fixture, `schemaVersion` = `CURRENT_FEATURE_SCHEMA_VERSION`;
- **rendere `generatedAt` deterministico** (derivato dal seed, non da `new Date()`): oggi rigenerare il fixture produce un file diverso, e un fixture non deterministico è un test che non si ripete.

> **D-26.3 — la demo è dichiarata come demo, ovunque.** Le feature demo hanno `source: 'manual'` e il `_metadata.demoMode = true` resta leggibile: un utente (o un revisore) deve poter distinguere in un colpo d'occhio che quei numeri non sono misurati.

### 3. App — la CTA e il flusso

| Passo | Comportamento |
|-------|--------------|
| **Welcome (①)** | la CTA «Scopri come funziona» (`empty.cta.demo`) sotto «Importa la tua musica» |
| **Demo** | `seedDemoDatabase()` → `openDb(DEMO_DB_NAME)` → la navigazione passa a un `AppShell` con `db = demoDb` → l'utente vede **Home + Timeline** con dati |
| **Uscita dalla demo** | pulsante «Esci dalla demo»: `clearDemoDatabase()` → torna all'onboarding con il DB utente intatto |
| **Import reale (⑤ Reveal)** | `handleImportAll` → `setScreen('reveal')` → il reveal mostra le **prime 3 righe** della timeline reale (`reveal.preview.*`, chiavi nuove) invece del solo contatore; l'anno **non** è più cablato a 1 ma calcolato dallo span reale (`timestamp` minimo → massimo) |

> Il reveal attuale passa `{ years: 1, events }`: con uno storico reale di 6 anni, «1 anno» è **falso**. Il parametro va calcolato (`years: Math.max(1, round(span))`), e la chiave `onboarding.reveal.subtitle` deve supportare il singolare/plurale (`_one`/`_other`).

### 4. Il reveal: le prime tre righe

- Tre righe = tre **bucket mensili** della timeline reale (volume + mood), letti dal DB con la stessa logica di `homeTimelineModel.ts` (`bucketizeListens`).
- Se non ci sono dati sufficienti → il reveal resta com'è oggi (contatore) e mostra `onboarding.reveal.skip`.
- Il CTA «Esplora» (`onboarding.reveal.cta`) porta all'app: oggi esiste la chiave ma **non c'è il passaggio** dal reveal all'app (il passaggio avviene solo al riavvio dell'app, via `App.tsx`).

## 🔒 Privacy

| Vincolo | Applicazione |
|---------|--------------|
| Il DB dell'utente non è toccato | un secondo database, creato e cancellato; test: dopo la demo, `countListens(userDb) === 0` |
| La demo non invia nulla | nessuna rete: il fixture è locale, le feature sono sintetiche |
| Dati identificativi | il fixture non ne contiene (nomi di artisti/brani reali, ma **nessun ascolto reale**); i nomi sono parte del dataset pubblico di test |
| Cancellazione | `clearDemoDatabase()` con un click, come `06§2.14` |

## 🧪 Test

| Livello | File | Cosa copre |
|---------|------|-----------|
| unit (core) | `packages/core/src/db/__tests__/demo-seed.test.ts` | il seed popola `listens`/`tracks`/`artists`/`albums`/`features`; i campi v6 assenti diventano `null`; **nessun riferimento penduto**; `recount` allineato |
| unit (core) | idem | **idempotenza**: due seed sullo stesso DB non duplicano |
| unit (core) | idem | `clearDemoDatabase()` svuota il DB demo e **non tocca** quello dell'utente |
| integrazione (app) | `apps/web/src/onboarding/__tests__/demo-cta.test.tsx` | la CTA «Scopri come funziona» esiste ed è cliccabile; la demo **non scrive** nel DB utente |
| integrazione (app) | `apps/web/src/onboarding/__tests__/reveal-preview.test.tsx` | il reveal mostra ≥3 righe quando ci sono dati; l'anno non è cablato a 1 |
| integrazione (app) | `apps/web/src/hooks/__tests__/use-home-timeline-data-db.test.ts` | l'hook accetta un DB iniettabile (demo) e legge da lì |
| determinismo | `scripts/generate-fixtures.mjs` | due esecuzioni consecutive producono **lo stesso** file (con `generatedAt` derivato dal seed) |

## ✅ Acceptance criteria

- [ ] La CTA «Scopri come funziona» è raggiungibile dal primo passo e mostra un **diario di esempio**, non un testo descrittivo
- [ ] La demo usa **gli stessi componenti** della Home e della Timeline (nessun renderer parallelo)
- [ ] La demo **non scrive** nel database dell'utente (test: dopo la demo il DB utente è vuoto)
- [ ] Il DB demo si cancella con un click (`06§2.14`) e l'utente torna all'onboarding
- [ ] Il **reveal post-import** mostra almeno 3 righe della timeline reale e l'anno visualizzato è **calcolato**, non cablato
- [ ] Il fixture demo contiene `albums` e `features` **deterministiche**, così la demo mostra almeno un'era e un mood
- [ ] `scripts/generate-fixtures.mjs demo` è **deterministico**: due run producono lo stesso file
- [ ] i18n IT/EN per le nuove stringhe (namespace `onboarding.*` e `empty.*`, già dichiarati)
- [ ] Nessuna richiesta di rete introdotta dalla story

## 📋 Task

- T26.1 — `scripts/generate-fixtures.mjs`: emettere `albums` e `features` demo deterministiche; `generatedAt` derivato dal seed
- T26.2 — Core: `packages/core/src/db/demoSeed.ts` (`seedDemoDatabase`, `clearDemoDatabase`) + test
- T26.3 — App: refactor degli hook per **DB iniettabile** (`useHomeTimelineData(db?)`) + test
- T26.4 — App: CTA «Scopri come funziona» nella schermata di benvenuto + flusso demo (`AppShell` con `db` demo) + «Esci dalla demo»
- T26.5 — App: reveal post-import con ≥3 righe reali + anno calcolato (+ chiavi `_one`/`_other`)
- T26.6 — i18n: chiavi nuove in it/en (`onboarding.reveal.*`, `onboarding.demo.*`)
- T26.7 — Allineamento documentale: `docs/06-UX-FLOWS-STATES.md` §2.14, `docs/07-UI-SPEC.md`, `docs/INDEX.md`, `docs/11-BACKLOG.md` §3.5, `docs/state/stories/3.5-*.md`, `docs/10-TESTING.md` §3 (fixture)

## 🧾 Decisioni proposte

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-26.1 | La demo usa un **DB Dexie separato** (`life-soundtrack-demo`), mai il DB dell'utente, e gli hook accettano un DB **iniettabile** | Riusa Home/Timeline senza un renderer parallelo; l'utente non vede dati misti; il costo è un refactor piccolo |
| D-26.2 | Il fixture demo viene esteso con `albums` e `features` (`source: 'manual'`, deterministiche) | Senza feature la demo non mostra ere né mood: sarebbe il prodotto più povero, non «la magia» |
| D-26.3 | Le feature demo sono **sintetiche ma dichiarate** (`source: 'manual'`, `_metadata.demoMode`) | La demo non deve mentire: i numeri non sono misurati e si vede |
| D-26.4 | `generatedAt` diventa **deterministico** (derivato dal seed) | Un fixture non deterministico non è un fixture: la rigenerazione deve produrre lo stesso file |
| D-26.5 | Il reveal mostra **3 righe reali** e l'anno **calcolato** | Il reveal attuale dichiara «1 anno» anche su uno storico di 6: è un fatto falso in una schermata |

## 🚧 Cosa NON è in scope

- Il collegamento del **pipeline di analisi** (Story 2.5): la demo ha feature già pronte, ma **se non c'è la 2.5** non ci sono né ere né mood nella demo → la story 3.5 è dipendente dalla 2.5 per il suo effetto completo. **Ordine consigliato: 2.5 → 3.5**.
- L'artwork delle copertine nella demo (Story 4.3): la demo userà il placeholder.
- Il **raycasting dei colori** per il colore dominante dell'era (fuori perimetro anche della 4.3).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 86 (2026-11-02) | Prima stesura: stato reale del fixture e del reveal, decisione del DB separato, loader e normalizzazione, estensione del generatore (albums + features deterministiche), piano di test, D-26.1…D-26.5 |

---

*Questo documento diventa vincolante (🟢 APPROVED v1.0) alla ratifica del project owner.*
