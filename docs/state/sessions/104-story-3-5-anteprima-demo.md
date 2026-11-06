---
number: 104
title: "Anteprima del risultato in onboarding: il diario di esempio (issue #270)"
date: 2026-11-06
state: 🟡
merged: false
branch: feat/270-story-3-5---anteprima-e-modalita-demo-in
pr: 322
claim: kilo-hp-elitebook-a320
tags: [ui, onboarding, demo, fixture, i18n, timeline]
---

# Sessione 104 — Anteprima del risultato in onboarding: il diario di esempio (issue #270)

> **Oggetto**: la **Story 3.5** — la modalità demo: il diario di esempio
> *prima* dell'import e le prime righe della timeline reale *dopo*.

## Sintesi

L'issue #270 è stata implementata sulla specifica `docs/26-ONBOARDING-DEMO.md`
(v1.0 🟢 APPROVED, ratificata dal project owner il 2026-11-02).

La story chiude il buco più rumoroso del progetto: il README e la
documentazione promettevano un'«anteprima del risultato» e una CTA «Scopri
come funziona», ma **nessun file di codice le usava**. Il fixture
`fixtures/demo-user.json` esisteva da anni (1 anno, 4.500 eventi) e nessuna
riga di codice lo leggeva.

Il lavoro è stato **interamente locale** e senza librerie:

- il **database demo è separato** (`life-soundtrack-demo`): è un secondo
  database Dexie, quindi il diario di esempio e la storia dell'utente non
  possono mescolarsi, e la cancellazione è un `db.delete()`;
- il fixture è stato **rigenerato**: ora dichiara **album** (75) e **feature**
  (200) deterministiche, tre fasi musicali su 366 giorni e un `generatedAt`
  derivato dal seed (non da `new Date()`): due run producono lo stesso SHA;
- la **demo non ha una schermata propria**: la CTA apre la stessa `AppShell`
  della Home, con il `dbName` demo propagato a Timeline, Ricordi, Esplora e
  Analisi — nessun renderer parallelo da mantenere;
- il **reveal** post-import mostra le prime righe della timeline **reale** e
  l'anno **calcolato** dallo span dei dati, non cablato a 1.

## Cosa è stato fatto

### Core (`packages/core`)

- `db/demoSeed.ts` (nuovo): `DEMO_DB_NAME`, `seedDemoDatabase(db, fixture)` —
  normalizzazione v6 degli eventi, album derivati, `bulkPut` in transazione,
  `recount` dei `listenCount` — `clearDemoDatabase`, `hasDemoData` e il
  tipo `DemoFixture`;
- `db/index.ts`: gli export pubblici.

### Fixture (`scripts/generate-fixtures.mjs`)

- `buildDemoUser` riscritta: tre fasi (indie/folk → pop/electronic →
  jazz/ambient) con generi e artisti disgiunti, 10 artisti per fase e
  67/67/66 brani, 4.500 ascolti su 366 giorni, 75 album, 200 feature
  `source: 'manual'`, chiavi `eventKey`/`canonicalKey` univoche e
  `generatedAt` deterministico.

### App (`apps/web`)

- `demo/demoMode.ts` (nuovo): `loadDemoFixture` (`import('…?raw')` + parse),
  `startDemo` (open + seed + pipeline sul database demo), `stopDemo`;
- `analysis/analysisRunner.ts`: la dipendenza `db?` — senza, il runner
  aprirebbe sempre il database dell'utente e la demo resterebbe senza ere;
- `screens/AppShell.tsx`: props `dbName` / `demo` / `onExitDemo`, il banner
  dichiarativo e il bottone d'uscita;
- `onboarding/OnboardingRouter.tsx`: la CTA sul primo passo, gli stati
  `demo-loading` / `demo` / `demo-error` e il reveal con anteprima;
- `onboarding/revealPreview.ts` (nuovo): `buildRevealPreview` — le prime
  righe e l'anno calcolato.

### i18n

Le **12 chiavi** nuove in it ed en: `onboarding.demo.*` (banner, uscita,
caricamento, errore), `onboarding.reveal.preview.*` e la coppia pluralizzata
`onboarding.reveal.subtitle_one` / `_other` (che sostituisce la chiave
`subtitle` cablata su un anno).

### Test

**19 test** nuovi: 10 in `@ls/core` (7 sul loader — troncamento, album,
`listenCount`, cancellazione, database dell'utente intatto — e 3 sul fixture:
conteggi, determinismo, pipeline che produce **3 ere** e i mood
`mood_day`/`mood_week`), 9 in `@ls/web` (CTA, stati della demo, anteprima del
reveal, propagazione del `dbName`).

## Decisioni

- **Il fixture entra come parametro, non come import**: `@ls/core` non può
  importare `fixtures/` (build `tsc` con `rootDir` su `src`). La specifica
  prevedeva l'import di default: la deviazione è dichiarata e il contratto
  del core resta identico.
- **Il database si inietta per `dbName`**: la via già usata dalla Story 3.3
  per i test; un secondo database Dexie non può mescolarsi con quello
  dell'utente (D-26.1).
- **Il fixture è un chunk lazy (`?raw`)**: 3,6 MB non entrano nel bundle
  iniziale, e l'import di un JSON così grande farebbe inferire a TypeScript
  un tipo enorme. Il chunk è **fuori dal precache** del service worker
  (`globIgnores`): 3,7 MB nel precache li scaricherebbero tutti gli utenti,
  anche quelli che non aprono la demo, e superano il limite di Workbox
  (2 MiB) — la build fallirebbe. La runtime cache `ls-demo-fixture` lo
  conserva dopo il primo uso, quindi la demo resta disponibile offline.
- **Tre fasi disgiunte** nel fixture: è ciò che fa produrre all'era detector
  **tre** ere — un fixture a genera casuale non avrebbe frontiere.

## Analisi di avanzamento

- **Numeri**: 19 test nuovi (10 in `@ls/core`, 9 in `@ls/web`); suite
  `@ls/core` 651 test verdi in 58 file; suite `@ls/web` 207 test verdi di 215
  (gli **8 fallimenti i18n** sono quelli noti del `localStorage` assente sotto
  Node 26 — **identici su `main`**; il CI gira su Node 24); il test di
  **performance** del core passa da solo (è l'indicatore di saturazione già
  documentato, cfr. 97-6: 1.040 ms contro la soglia locale di 500 ms, in un
  run parallelo).
- **Cosa è pronto**: la CTA, il diario di esempio con album e feature, il
  banner dichiarativo, l'uscita con un click, l'anteprima del reveal con
  l'anno calcolato.
- **Cosa manca**: l'export e la cancellazione definitiva dei dati reali
  (Story 5.2); la pipeline delle **audio features** vere (EPIC 4, Story 4.1);
  le piattaforme di import.
- **Salute tecnica**: lint e typecheck verdi su `@ls/core` e `@ls/web`; i gate
  `check-aggregate-blocks`, `check-encoding` e `check-fixtures-privacy` verdi.
- **Gate per il test**: `pnpm run verify` deve essere verde in CI (Node 24);
  in locale gli 8 fallimenti i18n sono attesi e documentati.

## Lesson learned

- **Un fixture da 3,6 MB non si importa in un pacchetto**: il vincolo non è
  il peso, è il `rootDir` del `tsc`. Il parametro è più semplice del `?raw`
  lato core.
- **Il cablaggio mancante era invisibile**: il `dbName` esisteva già sui
  componenti (per i test), ma nessuno lo propagava dalla shell. Il sintomo
  (la demo vuota) era lontano dalla causa (il parametro mai passato): il
  bundle dei dati è una catena, e ogni anello va ispezionato da capo a
  fondo.

## Documenti aggiornati

- `docs/state/stories/3.5-anteprima-onboarding-demo.md` e
  `docs/state/sessions/104-story-3-5-anteprima-demo.md` (questa)
- `docs/06-UX-FLOWS-STATES.md` — §2.14 e changelog
- `docs/07-UI-SPEC.md` — §2.10c e changelog
- `docs/08-COPY-I18N.md` — §2.1 e changelog
- `docs/10-TESTING.md` — §3.4 e changelog
- `docs/11-BACKLOG.md` — sezione Story 3.5
- `docs/18-DEV-LOG.md` — la entry della sessione
- `scripts/generate-bundle.ps1` — `$files`
