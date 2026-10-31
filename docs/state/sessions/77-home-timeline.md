---
number: 77
title: "Home + Timeline (Story 3.1, issue #233)"
date: 2026-10-31
state: 🟡
merged: false
branch: feat/233-home-timeline
pr: 0
claim: kilo-HP-ELITEBOOK-progress
cross_refs: [233, 231, 216]
tags: [ui, timeline, home]
---

# Sessione 77 — Home + Timeline (Story 3.1, issue #233)

## Sintesi

La **Story 3.1** porta l'app dal solo onboarding alle sue **prime due
schermate vere**: ⑥ Home e ⑦ Timeline. È la story che sblocca il **gate
end-to-end**: fino a qui si poteva testare il motore, non l'esperienza «colonna
sonora della mia vita».

La scelta di fondo è la stessa della Story 3.4 (nastro contesto): **il modello
è puro, i componenti sono presentazionali**. Tutta la logica — i quattro numeri
della Home, la bar week, i bucket per granularità, le serie di volume e mood,
le bande di era, il zoom progressivo — sta in
`apps/web/src/screens/homeTimelineModel.ts`, senza React e senza DOM. I
componenti (`StatCard`, `MemoryCard`, `BarWeek`, `EraBand`, `StreamChart`,
`MoodLine`) ricevono dati per props e restituiscono callback.

Tre scelte della spec sono state prese sul serio, al punto da renderle
**strutturali**:

- **il bucket vuoto esiste e vale zero**: una linea che salta i buchi
  suggerirebbe continuità che i dati non hanno; e il **mood non viene
  interpolato** nei bucket senza dati — l'assenza di un dato non è uno zero;
- **l'area del volume è chiusa sul minimo del dominio**, non su zero: un
  ascolto non riparte da zero minuti, e un'area che scende a zero inventerebbe
  un silenzio;
- **la sincronizzazione fra EraBand, StreamChart e MoodLine è uno stato
  condiviso**, non un effetto locale: l'hover su una banda evidenzia il bucket
  nei due grafici, e l'hover su un punto evidenzia l'era che lo contiene.

Nessuna libreria di grafici: i tre grafici sono **SVG scritti a mano**, con la
geometria in un file puro e testato (`chartGeometry.ts`). Introdurre una
dipendenza di chart sarebbe una decisione di **stack**, non di story.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.77.1 | Il modello è **puro** (`homeTimelineModel.ts`), i componenti sono presentazionali | Testabile con il solo dato (19 test senza mock di IndexedDB) e la stessa separazione della Story 3.4; inoltre la regola `react-refresh/only-export-components` pretende che un file di componente esporti solo componenti |
| D.77.2 | Il vocabolario temporale è quello del core (`@core/analysis`) | La Timeline non introduce un secondo calendario (lesson 27-7): stessi bucket, stesso inizio settimana, stessa base UTC |
| D.77.3 | I bucket vuoti **esistono** (valore 0) e il mood **non** viene interpolato | Una linea senza buchi mente; un mood assente non è un mood nullo. I dati mancanti restano mancanti |
| D.77.4 | L'area del volume è chiusa sul **minimo** del dominio | Il volume di ascolto ha un basale nonzero: chiudere su zero inventerebbe silenzi fra un giorno e l'altro |
| D.77.5 | Nessuna libreria di chart: SVG scritto a mano | Il toolchain non ha una libreria di grafici e introdurla è una decisione di stack, non di story. Tre grafici con la geometria in un file puro sono meno codice di una dipendenza e del suo adattamento |
| D.77.6 | I grafici hanno `<title>`, `<desc>` e una **tabella dati nascosta** (`sr-only`) | Contratto a11y vincolante (`07§2.7`): un grafico da solo non è leggibile da uno screen reader, e i valori esatti devono essere disponibili |
| D.77.7 | Il conteggio della StatCard si anima all'**hover**, non al mount | Una StatCard che si conta da sola consuma attenzione senza informare; `prefers-reduced-motion` disattiva del tutto l'animazione (`07§4`) |
| D.77.8 | La scelta fra onboarding e app è legata ai **dati** (il DB ha ascolti?), non a un flag | Un flag in `localStorage` mentirebbe dopo una cancellazione dei dati o un import su un altro dispositivo: i dati sono la verità |
| D.77.9 | Le soglie di stato sono dichiarate **in un punto solo** (`useHomeTimelineData.ts`): 100 eventi per la Home, 6 mesi per la Timeline | Sono i valori della spec (`06§2.6-2.7`): dichiararli in due schermate li avrebbe fatti divergere |
| D.77.10 | La granularità **segue lo zoom** finché l'utente non sceglie | Una storia lunga si legge per anni, poche settimane per giorni: il default è derivato dalla durata dei dati (`granularityForSpan`), non arbitrario |

## Analisi di avanzamento

### Numeri

- **Implementazione: 75%** — 21 story completate su 28 · effort pesato 77% · **mancano 7 step**
- EPIC 0 (Fondamenta) 7/7 · EPIC 1 (Import core) 6/6 · EPIC 2 (Analisi) 4/4 · EPIC 3 (UI/UX) 2/4 · EPIC 4 (Arricchimento) 2/4 · EPIC 5 (Privacy e legale) 0/2 · EPIC 6 (Stack) 0/1

### Cosa e' pronto e cosa manca

- **Il motore e' completo** e da questa sessione c'e' anche la **prima UI vera**: Home con i suoi quattro numeri, il ricordo del giorno e la bar week; Timeline con le ere, il volume, il mood, il nastro contesto e lo zoom. L'app non e' piu' solo onboarding: con dei dati importati si apre su Home.
- **L'EPIC 3 e' a 2/4**: restano la **3.2** (Ricordi + Share, L) e la **3.3** (Esplora + Analisi, L). Il **dettaglio dell'era (⑧)** resta fuori dalla 3.1: e' la schermata successiva e non ha una sua story.
- **Il gate end-to-end non e' ancora superato**: l'app ha la sua UI, ma il percorso completo «importa → guarda la timeline → esplora → condividi» ha ancora due schermate vuote (⑨, ⑪) e la ShareSheet (⑫).
- **Mancano 4.2/4.3** (lookup MusicBrainz, artwork) e **5.1/5.2** (privacy spec finale, export & purge): senza export/purge non e' prudente testare con dati personali reali.
- **6.1** (upgrade a ultime major) e' schedulata a fine implementazione per policy (D.10.2).

> I numeri sopra sono quelli **calcolati** dal blocco al momento della stesura: se il blocco e
> l'analisi divergono, il primo e' la fonte di verita' — la percentuale e' un dato calcolato,
> la prosa e' un commento.

### Salute tecnica (verificata in questa worktree)

`typecheck` ✅ · `lint` ✅ (0 warning) · `test` ✅ **146 test in `@ls/web`** (127 precedenti + 19 nuovi) e **628 in `@ls/core`** · `build` ✅ · `pnpm run verify` (lint + typecheck + test + build in una invocazione).

### Procedura introdotta con questa sessione

1. `apps/web/src/screens/homeTimelineModel.ts` — il modello puro: numeri, bar week, bucket, serie, bande, zoom.
2. `apps/web/src/components/chartGeometry.ts` — la geometria SVG (scala, path, barre), pura e testata.
3. `apps/web/src/components/StatCard.tsx` — count-up 600 ms all'hover, `role="status"`, `aria-label` con unita'.
4. `apps/web/src/components/MemoryCard.tsx` — il ricordo del giorno, con artwork **opzionale** (l'artwork non esiste ancora: Story 4.3).
5. `apps/web/src/components/BarWeek.tsx`, `EraBand.tsx`, `StreamChart.tsx`, `MoodLine.tsx` — i tre grafici e le bande, con `<title>`/`<desc>` e tabella nascosta.
6. `apps/web/src/screens/Home.tsx`, `Timeline.tsx`, `AppShell.tsx` — le schermate e la navigazione.
7. `apps/web/src/hooks/useHomeTimelineData.ts` — il cablaggio al database e le soglie di stato.
8. `apps/web/src/App.tsx` — onboarding o app, deciso dai dati.

## Lesson learned

- **Il modello puro rende la UI testabile senza mock**: i 19 test della sessione girano senza IndexedDB, senza Dexie e senza `fake-indexeddb`, perché la logica non li tocca. Il costo e' stato separare il modello dal componente fin dall'inizio — il prezzo di quel lavoro e' stato ripagato in test che scrivono.
- **«Il dato mancante non e' zero»**: due scelte nella stessa sessione (il bucket vuoto esiste, il mood non viene interpolato) discendono dalla stessa idea. Interpollare un'assenza produce una curva che mente sul dato, ed e' il tipo di errore che nessun gate segnala, perche' il codice funziona.
- **La decisione fra onboarding e app non puo' essere un flag**: con il flag, l'app apriva l'onboarding anche su un dispositivo gia' importato (o viceversa). Leggerlo dai dati costa una query e toglie una classe intera di bug.

## Documenti aggiornati

- `apps/web/src/screens/homeTimelineModel.ts`, `Home.tsx`, `Timeline.tsx`, `AppShell.tsx` (nuovi)
- `apps/web/src/components/StatCard.tsx`, `MemoryCard.tsx`, `BarWeek.tsx`, `EraBand.tsx`, `StreamChart.tsx`, `MoodLine.tsx`, `chartGeometry.ts` (nuovi)
- `apps/web/src/hooks/useCountUp.ts`, `useHomeTimelineData.ts` (nuovi)
- `apps/web/src/__tests__/home-timeline.test.tsx` (nuovo) — 19 test
- `apps/web/src/App.tsx`, `apps/web/src/onboarding/OnboardingRouter.tsx` — la scelta onboarding/app
- `apps/web/src/i18n/index.ts`, `i18n/locales/it.json`, `en.json` — namespace `nav` e le nuove chiavi
- `apps/web/src/onboarding/onboarding.css` — gli stili della shell, delle StatCard, dei grafici e delle bande
- `docs/08-COPY-I18N.md` — namespace `nav` in §1 + changelog 0.13
- `docs/state/stories/3.1-home-timeline.md` — `status: done`, task e acceptance criteria spuntati
- `scripts/generate-bundle.ps1` — `$files` += il file di sessione e il file di story
- `docs/11-BACKLOG.md`, `docs/INDEX.md`, `docs/18-DEV-LOG.md` — sezioni legacy allineate
