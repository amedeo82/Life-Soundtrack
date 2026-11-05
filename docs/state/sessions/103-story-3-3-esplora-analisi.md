---
number: 103
title: "Esplora + Analisi: la ricerca nel catalogo e la mappa emotiva (issue #240)"
date: 2026-11-05
state: 🟡
merged: false
branch: feat/240-story-3-3---esplora-analisi-schermate-9
pr: 0
claim: kilo-hp-elitebook-d957
tags: [ui, esplora, analisi, ricerca, quadrante, deep-link, i18n]
---

# Sessione 103 — Esplora + Analisi: la ricerca nel catalogo e la mappa emotiva (issue #240)

> **Oggetto**: la **Story 3.3** — le due schermate che chiudono il percorso
> end-to-end: la ricerca nel proprio catalogo (⑨) e la mappa emotiva (⑩),
> con l'**insight in prosa** come criterio di accettazione.

## Sintesi

L'issue #240 è stata implementata sulla specifica `docs/25-MEMORIES-SHARE-EXPLORE.md`
(v1.0 🟢 APPROVED, ratificata dal project owner il 2026-11-02).

La story ha una regola che la distingue da tutte le altre: **il criterio di
accettazione non è «un grafico in più»**, è la **frase** che spiega un periodo
(`docs/22-COMPETITIVE-POSITIONING.md` §8). Il quadrante valence/energy da solo
è l'ennesimo cruscotto; quello che vale è «a marzo 2023 la tua musica era
più triste del solito».

Il lavoro è stato **interamente locale** e **senza librerie**:

- la ricerca è un **modello puro** (`exploreModel.ts`) sopra il catalogo
  caricato dal database locale: nessuna richiesta di rete, nessun indice
  globale, e il filtro è testabile senza database;
- il debounce è di **300 ms** (`06§2.9`) e vive in un hook dedicato, testato
  con i timer falsi;
- il quadrante è **SVG scritto a mano** come gli altri grafici della casa
  (`MoodLine`, `StreamChart`), con i punti come **`<button>` HTML** sopra la
  cornice: un punto cliccabile deve essere un controllo della tastiera, e il
  suo `aria-label` dichiara i due valori («2026-01: valence 0.80, energy 0.70»)
  invece di un nome generico;
- gli insight mostrati sono **persistiti**: la schermata legge la tabella
  `insights` (Story 2.5), non ricalcola nulla «a caldo».

Il deep-link fra le schermate è a **stato** (D-25.1): nessun router, nessun
URL — un `AppFocus` che la Timeline usa per evidenziare l'era del periodo
cliccato.

## Cosa è stato fatto

### App (`apps/web`)

- `screens/exploreModel.ts`: il modello puro — filtro per sottostringa,
  ordinamento per `listenCount` decrescente (nome come spareggio **stabile**),
  indice dei generi (il genere sta in `Track.genres`, non in una tabella) e
  tab Mood;
- `hooks/useExploreData.ts`: il catalogo dell'utente e i periodi con mood
  (gli insight `mood_day`);
- `hooks/useDebouncedValue.ts`: il debounce di 300 ms;
- `components/SearchField.tsx`: il campo con `role="searchbox"` e `aria-label`;
- `screens/ExploreScreen.tsx`: la schermata ⑨ — cinque tab, mood pill,
  deep-link dal periodo;
- `screens/analysisModel.ts`: l'aggregazione **per mese** degli insight
  `mood_day` (media **pesata** sugli ascolti) e i punti del quadrante;
- `components/QuadrantChart.tsx` e `components/InsightCard.tsx`;
- `hooks/useAnalysisData.ts` e `screens/AnalysisScreen.tsx`: la schermata ⑩ —
  il quadrante, la **frase** che lo accompagna e gli insight persistiti con
  le tre azioni dell'utente;
- `screens/appNavigation.ts` (nuovo), `screens/AppShell.tsx`,
  `screens/Timeline.tsx`: la navigazione estesa e il deep-link interno;
- `hooks/useHomeTimelineData.ts`: il mood della settimana è adesso il
  **MoodId** (`weekMood`) e la shell lo **traduce** — la Home mostrava
  «happy» invece di «Felice».

### i18n

Le nuove chiavi in it ed en: `nav.explore`, `nav.analysis`,
`explore.listens` (con i plurali), le **otto** di `analysis.*` e le **due**
frasi che mancavano in `insight.*` (`mood.neutral`, `mood.angry`). Le chiavi
che **esistevano già** (`explore.*`, `analysis.quadrant.*`, `analysis.moods.*`,
`insight.mood.*`) sono state **usate**, non duplicate.

### Test

20 test nuovi: il modello della ricerca (ordine e filtro), il debounce (con
i timer falsi), la schermata ⑨ (filtro, tab, mood, nessuna richiesta di
rete), la schermata ⑩ (punti accessibili, la frase accanto al grafico, gli
insight in prosa, il deep-link), i due componenti e il focus della Timeline.

## Decisioni

- **La ricerca filtra in memoria, non con un indice**: il catalogo dell'utente
  è locale e piccolo rispetto a una raccolta indicizzata; il vantaggio del
  modello puro (testabile, nessuna dipendenza dal DB) supera il vantaggio
  dell'indice.
- **Il tab Mood filtra sul MoodId**: il testo tradotto cambierebbe i
  risultati a seconda della lingua dell'interfaccia.
- **I punti del quadrante sono aggregati per mese**: la serie `mood_day` esiste
  già (la `MoodLine` della Timeline la disegna) e non va duplicata; la media
  mensile è **pesata** sugli ascolti.
- **Il README non è stato toccato**: il gate `check-readme-facts.mjs` vieta di
  dichiarare come presenti le capability degli EPIC 2 e 4 fuori dalla sezione
  roadmap, e l'EPIC 4 (audio features) non è ancora merged. La prosa
  dichiara quindi esattamente la stessa cosa di prima.

## Analisi di avanzamento

- **Numeri**: 20 test nuovi; suite `@ls/core` 642 test in 56 file (il test di
  **performance** fallisce solo quando le suite girano in parallelo — 598 ms
  contro la soglia locale di 500 ms — e **passa da solo**: è l'indicatore di
  saturazione già documentato, cfr. 97-6); suite `@ls/web` 206 test di cui 198
  verdi e 8 falliti **per l'ambiente locale** (i test del «language detector»
  usano `localStorage`, che il jsdom non espone sotto Node 26: **gli stessi
  file falliscono identici su `main`**, il CI gira su Node 24).
- **Cosa è pronto**: la ricerca sul catalogo con debounce e tab, la mappa
  emotiva con l'insight in prosa, il deep-link alla Timeline, le azioni
  dell'utente sugli insight.
- **Cosa manca**: la pipeline delle **audio features** (EPIC 4, Story 4.1) —
  senza valence ed energy reali la mappa emotiva resta vuota; l'export e la
  cancellazione definitiva (Story 5.2); l'anteprima in onboarding (Story 3.5).
- **Salute tecnica**: lint e typecheck verdi su `@ls/web`; nessuna modifica
  al layer `@ls/core` (la story è di sola UI e lettura del database).
- **Gate per il test**: `pnpm --filter @ls/web exec vitest run` deve essere
  verde **in CI** (Node 24); in locale gli 8 fallimenti i18n sono attesi e
  documentati.

## Lesson learned

- **Una chiave i18n si scrive in un solo posto.** I primi tentativi di
  inserire le chiavi con uno script ad hoc hanno prodotto chiavi «spazzatura»
  (i resti di una destructuring sbagliata: una lettera sola). Il test «ogni
  chiave appartiene a un namespace di 08§1» le ha smascherate subito: è la
  ragione per cui quel test esiste.
- **Il campo `weekMoodLabel` era un MoodId travestito da etichetta**: la Home
  mostrava «happy» al posto di «Felice». Rinominare il campo in `weekMood` e
  tradurre nella shell ha reso il difetto **visibile** invece di implicito.
- **Un modulo per i tipi condivisi evita l'import circolare**: `AppFocus` sta
  in `appNavigation.ts` e non in `AppShell.tsx`, perché le schermate ricevono
  il tipo del focus e la shell riceve le schermate.

## Documenti aggiornati

- `docs/state/stories/3.3-esplora-analisi.md` e
  `docs/state/sessions/103-story-3-3-esplora-analisi.md` (questa)
- `docs/11-BACKLOG.md` — sezione Story 3.3
- `docs/07-UI-SPEC.md` — §2.8, §2.9
- `docs/08-COPY-I18N.md` — §2.5, §2.6, §2.15, changelog 0.15
- `docs/18-DEV-LOG.md` — la entry della sessione
- `scripts/generate-bundle.ps1` — `$files`
